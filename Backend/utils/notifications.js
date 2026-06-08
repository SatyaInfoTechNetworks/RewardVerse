import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import pool from '../db.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let firebaseApp = null;
const serviceAccountPath = process.env.FCM_SERVICE_ACCOUNT_PATH || './config/service-account.json';

try {
  if (process.env.FCM_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FCM_SERVICE_ACCOUNT_JSON);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin SDK initialized successfully from env variable.');
  } else {
    let resolvedPath = null;
    const pathsToCheck = [
      path.resolve(serviceAccountPath),
      path.resolve(process.cwd(), 'Backend', serviceAccountPath),
      path.resolve(__dirname, '..', serviceAccountPath)
    ];

    for (const p of pathsToCheck) {
      if (fs.existsSync(p)) {
        resolvedPath = p;
        break;
      }
    }

    if (resolvedPath) {
      const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log(`✅ Firebase Admin SDK initialized successfully from file: ${resolvedPath}`);
    } else {
      console.warn(`⚠️ Firebase service-account.json not found. Push notifications will be mocked. Checked paths: ${pathsToCheck.join(', ')}`);
    }
  }
} catch (err) {
  console.error('❌ Failed to initialize Firebase Admin SDK:', err.message);
}

/**
 * Send push notification to a specific user
 */
export async function sendNotification(userId, title, body, imageUrl = null) {
  try {
    // 1. Get user fcm_token, uid, and id using multiple identifier types
    const [rows] = await pool.query(
      'SELECT id, fcm_token, uid, user_id FROM users WHERE id = ? OR user_id = ? OR uid = ? LIMIT 1',
      [userId, userId, userId]
    );
    
    if (rows.length === 0) return false;
    const user = rows[0];
    const resolvedUserId = user.id;

    let success = false;

    if (user.fcm_token) {
      if (firebaseApp) {
        const message = {
          token: user.fcm_token,
          notification: {
            title,
            body,
            ...(imageUrl ? { image: imageUrl } : {})
          },
          data: {
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
            title,
            body,
            image: imageUrl || '',
            type: 'general'
          },
          android: {
            priority: 'high',
            notification: {
              channelId: 'default_channel',
              sound: 'default',
              priority: 'high',
              defaultVibrateTimings: true,
              defaultSound: true
            }
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1
              }
            }
          }
        };

        await admin.messaging().send(message);
        console.log(`📲 Push notification sent to user ${resolvedUserId}`);
        success = true;
      } else {
        console.log(`📲 [Mock Push] ${title}: ${body} (Sent to token: ${user.fcm_token}, Banner: ${imageUrl || 'None'})`);
        success = true;
      }
    } else {
      console.log(`ℹ️ User ${resolvedUserId} has no FCM token. Notification logged but not sent.`);
    }

    // Log to notification history
    await pool.query(
      'INSERT INTO notifications (id, title, message, image_url, target_type, target_user_id, sent_count, success_count, failure_count, created_at) VALUES (UUID(), ?, ?, ?, "specific", ?, 1, ?, ?, NOW())',
      [title, body, imageUrl || null, resolvedUserId, success ? 1 : 0, success ? 0 : 1]
    );

    return success;
  } catch (error) {
    console.error('❌ Notification Error:', error.message);
    return false;
  }
}

/**
 * Broadcast notification to all users
 */
export async function broadcastNotification(title, body, imageUrl = null) {
  try {
    // 1. Fetch all active FCM tokens
    const [tokenRows] = await pool.query(
      'SELECT fcm_token FROM users WHERE fcm_token IS NOT NULL AND fcm_token != ""'
    );
    const tokens = tokenRows.map(row => row.fcm_token).filter(Boolean);
    const sentCount = tokens.length;

    let successCount = 0;
    let failureCount = 0;

    if (firebaseApp) {
      if (sentCount === 0) {
        console.log('ℹ️ No active FCM tokens found in database. Broadcast logged but not sent.');
      } else {
        // Helper function to split array into chunks of a given size
        const chunkArray = (arr, size) => {
          const chunks = [];
          for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
          }
          return chunks;
        };

        const tokenBatches = chunkArray(tokens, 500);

        for (const batch of tokenBatches) {
          const message = {
            tokens: batch,
            notification: {
              title,
              body,
              ...(imageUrl ? { image: imageUrl } : {})
            },
            data: {
              click_action: 'FLUTTER_NOTIFICATION_CLICK',
              title,
              body,
              image: imageUrl || '',
              type: 'general'
            },
            android: {
              priority: 'high',
              notification: {
                channelId: 'default_channel',
                sound: 'default',
                priority: 'high',
                defaultVibrateTimings: true,
                defaultSound: true
              }
            },
            apns: {
              payload: {
                aps: {
                  sound: 'default',
                  badge: 1
                }
              }
            }
          };

          const response = await admin.messaging().sendEachForMulticast(message);
          successCount += response.successCount;
          failureCount += response.failureCount;

          if (response.failureCount > 0) {
            for (let i = 0; i < response.responses.length; i++) {
              const resp = response.responses[i];
              if (!resp.success) {
                const failedToken = batch[i];
                const errorCode = resp.error?.code;
                const errorMessage = resp.error?.message;
                console.error(`❌ FCM Token delivery failed for token [${failedToken.substring(0, 15)}...]: ${errorMessage} (Code: ${errorCode})`);

                // Auto-cleanup stale/unregistered tokens
                if (
                  errorCode === 'messaging/registration-token-not-registered' ||
                  errorCode === 'messaging/invalid-registration-token'
                ) {
                  console.log(`🧹 Auto-cleaning stale FCM token: ${failedToken.substring(0, 15)}...`);
                  await pool.query('UPDATE users SET fcm_token = NULL WHERE fcm_token = ?', [failedToken]).catch(err => {
                    console.error('❌ Failed to clean stale FCM token:', err.message);
                  });
                }
              }
            }
          }
        }

        console.log(`📢 Global push broadcast sent using multicast. Total tokens: ${sentCount}, Success: ${successCount}, Failure: ${failureCount}`);
      }
    } else {
      successCount = sentCount;
      console.log(`📢 [Mock Global Broadcast] ${title}: ${body} (Tokens count: ${sentCount}, Banner: ${imageUrl || 'None'})`);
    }

    // Log to notification history
    await pool.query(
      'INSERT INTO notifications (id, title, message, image_url, target_type, target_user_id, sent_count, success_count, failure_count, created_at) VALUES (UUID(), ?, ?, ?, "broadcast", NULL, ?, ?, ?, NOW())',
      [title, body, imageUrl || null, sentCount, successCount, failureCount]
    );

    return {
      success: true,
      sentCount,
      successCount,
      failureCount
    };
  } catch (error) {
    console.error('❌ Broadcast Notification Error:', error.message);
    return {
      success: false,
      sentCount: 0,
      successCount: 0,
      failureCount: 0
    };
  }
}

/**
 * Send push notification to a specific topic (e.g. offers, games, wallet, vip)
 */
export async function sendTopicNotification(topic, title, body, imageUrl = null) {
  try {
    let success = false;

    if (firebaseApp) {
      const message = {
        topic: topic,
        notification: {
          title,
          body,
          ...(imageUrl ? { image: imageUrl } : {})
        },
        data: {
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
          title,
          body,
          image: imageUrl || '',
          type: 'topic'
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'default_channel',
            sound: 'default',
            priority: 'high',
            defaultVibrateTimings: true,
            defaultSound: true
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        }
      };

      await admin.messaging().send(message);
      console.log(`📢 Topic push broadcast sent to: ${topic}`);
      success = true;
    } else {
      console.log(`📢 [Mock Topic Broadcast] ${topic} -> ${title}: ${body} (Banner: ${imageUrl || 'None'})`);
      success = true;
    }

    // Log to notification history
    await pool.query(
      'INSERT INTO notifications (id, title, message, image_url, target_type, target_topic, sent_count, success_count, failure_count, created_at) VALUES (UUID(), ?, ?, ?, "topic", ?, 0, ?, ?, NOW())',
      [title, body, imageUrl || null, topic, success ? 1 : 0, success ? 0 : 1]
    );

    return success;
  } catch (error) {
    console.error('❌ Topic Notification Error:', error.message);
    return false;
  }
}
