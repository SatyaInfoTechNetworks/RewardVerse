import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import { generateUniqueUserId } from '../utils/userId.js';
import { sendNotification } from '../utils/notifications.js';

// Generates legacy token
function generateLegacyToken(userId) {
  return Buffer.from(`${userId}:${Date.now()}`).toString('base64');
}

// Generates new JWT token
function generateJwtToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET || 'rewardverse_super_secret_jwt_key_2026', {
    expiresIn: '30d'
  });
}

// Formats the user object to return a hashed integer id for Kotlin client compatibility
function formatUserResponse(user) {
  if (!user) return null;
  let idVal = user.id;
  if (typeof idVal === 'string') {
    let hash = 0;
    for (let i = 0; i < idVal.length; i++) {
      hash = idVal.charCodeAt(i) + ((hash << 5) - hash);
    }
    idVal = Math.abs(hash) % 10000000;
  }
  return {
    ...user,
    id: idVal
  };
}

// Google Login
export const loginGoogle = async (req, res) => {
  try {
    const { uid, email, name, android_id, device_model, os_version } = req.body;

    if (!uid || !email || !name) {
      return res.status(400).json({ success: false, message: 'Incomplete data' });
    }

    // 1. Hardened Device Binding & Multi-Account Check
    if (android_id) {
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

      const [fingerprintRows] = await pool.query(
        `SELECT u.uid FROM device_fingerprints df 
         JOIN users u ON df.user_id = u.id 
         WHERE df.android_id = ? AND u.uid != ? LIMIT 1`,
        [android_id, uid]
      );
      if (fingerprintRows.length > 0) {
        return res.json({ success: false, message: 'Device already registered with another account' });
      }

      // Legacy fallback check
      const [devRows] = await pool.query(
        'SELECT uid FROM users WHERE android_id = ? AND uid != ? LIMIT 1',
        [android_id, uid]
      );
      if (devRows.length > 0) {
        return res.json({ success: false, message: 'Device already registered with another account' });
      }
    }

    // 2. Check if user exists
    const [userRows] = await pool.query('SELECT * FROM users WHERE uid = ? LIMIT 1', [uid]);

    if (userRows.length > 0) {
      const user = userRows[0];

      // Update existing user properties
      await pool.query(
        'UPDATE users SET name = ?, email = ?, android_id = ? WHERE uid = ?',
        [name, email, android_id || user.android_id, uid]
      );

      // Record/Update Device Fingerprint
      if (android_id) {
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        await pool.query(
          `INSERT INTO device_fingerprints (id, user_id, android_id, device_model, os_version, ip_address, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE device_model=VALUES(device_model), os_version=VALUES(os_version), ip_address=VALUES(ip_address)`,
          [uuidv4(), user.id, android_id, device_model || null, os_version || null, ipAddress]
        ).catch(dfErr => console.error('Failed to log device fingerprint:', dfErr));
      }

      // Fetch fresh row
      const [updatedUserRows] = await pool.query('SELECT * FROM users WHERE uid = ? LIMIT 1', [uid]);
      const updatedUser = updatedUserRows[0];

      // Return both modern JWT and legacy token
      return res.json({
        success: true,
        status: 'SUCCESS', // Required by Kotlin AuthResponse
        message: 'Login successful',
        token: generateLegacyToken(updatedUser.id),
        jwt: generateJwtToken({ id: updatedUser.id, role: 'user' }),
        user: formatUserResponse(updatedUser)
      });
    } else {
      // User not found -> client will trigger signup
      return res.json({ success: false, status: 'ERROR', message: 'User not found' });
    }
  } catch (error) {
    console.error('Google Login Error:', error);
    res.status(500).json({ success: false, status: 'ERROR', message: 'Server Error: ' + error.message });
  }
};

// User Signup
export const signupUser = async (req, res) => {
  try {
    const { uid, name, email, phone_number, profile_pic, location, referred_by, fcm_token, android_id, device_model, os_version } = req.body;

    if (!uid || !name || !email) {
      return res.status(400).json({ success: false, message: 'Incomplete data' });
    }

    // 1. Hardened Device Binding & Multi-Account Check
    if (android_id) {
      const [fingerprintRows] = await pool.query(
        `SELECT u.uid FROM device_fingerprints df 
         JOIN users u ON df.user_id = u.id 
         WHERE df.android_id = ? AND u.uid != ? LIMIT 1`,
        [android_id, uid]
      );
      if (fingerprintRows.length > 0) {
        return res.json({ success: false, message: 'Device already registered with another account' });
      }

      // Legacy fallback check
      const [devRows] = await pool.query(
        'SELECT uid FROM users WHERE android_id = ? AND uid != ? LIMIT 1',
        [android_id, uid]
      );
      if (devRows.length > 0) {
        return res.json({ success: false, message: 'Device already registered with another account' });
      }
    }

    // Resolve referral code to referrer user UUID (supports referral_code, user_id hex, uid, id)
    let referrerUuid = null;
    if (referred_by) {
      const cleanReferredBy = referred_by.trim();
      const [refRows] = await pool.query(
        'SELECT id FROM users WHERE id = ? OR LOWER(referral_code) = LOWER(?) OR user_id = ? OR uid = ? LIMIT 1',
        [cleanReferredBy, cleanReferredBy, cleanReferredBy, cleanReferredBy]
      );
      if (refRows.length > 0) {
        referrerUuid = refRows[0].id;
      }
    }

    // 2. Check if UID already exists (Update logic)
    const [userRows] = await pool.query('SELECT * FROM users WHERE uid = ? LIMIT 1', [uid]);

    if (userRows.length > 0) {
      const user = userRows[0];

      // Update details
      await pool.query(
        `UPDATE users SET 
          name = ?, email = ?, phone_number = ?, android_id = ?,
          referred_by = ?, location = ?, fcm_token = ?
         WHERE uid = ?`,
        [
          name,
          email,
          phone_number || user.phone_number,
          android_id || user.android_id,
          referrerUuid || user.referred_by,
          location || user.location,
          fcm_token || user.fcm_token,
          uid
        ]
      );

      // Record/Update Device Fingerprint
      if (android_id) {
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        await pool.query(
          `INSERT INTO device_fingerprints (id, user_id, android_id, device_model, os_version, ip_address, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE device_model=VALUES(device_model), os_version=VALUES(os_version), ip_address=VALUES(ip_address)`,
          [uuidv4(), user.id, android_id, device_model || null, os_version || null, ipAddress]
        ).catch(dfErr => console.error('Failed to log device fingerprint:', dfErr));
      }

      // Handle referral mapping if referred_by is set
      if (referred_by) {
        await handleReferralMapping(user.id, referred_by);
      }

      const [updatedUser] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [user.id]);

      return res.json({
        success: true,
        message: 'User updated successfully',
        token: generateLegacyToken(user.id),
        jwt: generateJwtToken({ id: user.id, role: 'user' }),
        user: formatUserResponse(updatedUser[0])
      });
    }

    // 3. New User Registration
    const newUserId = uuidv4();
    const publicUserId = await generateUniqueUserId(); // Custom 10-char hexadecimal ID

    // Generate referral code (Case-insensitive unique code, e.g. uppercase base36)
    const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Fetch welcome bonus coins from referral_settings (applies to all new users as starting balance)
    const [settingsRows] = await pool.query('SELECT bonus_coins FROM referral_settings LIMIT 1');
    const welcomeBonus = settingsRows.length > 0 ? parseFloat(settingsRows[0].bonus_coins || 0) : 0;

    try {
      await pool.query(
        `INSERT INTO users 
          (id, uid, user_id, name, email, phone_number, profile_pic, location, referred_by, fcm_token, android_id, referral_code, balance, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          newUserId,
          uid,
          publicUserId,
          name,
          email,
          phone_number || null,
          profile_pic || '',
          location || '',
          referrerUuid,
          fcm_token || '',
          android_id || '',
          referralCode,
          welcomeBonus
        ]
      );

      if (welcomeBonus > 0) {
        const transId = uuidv4();
        await pool.query(
          `INSERT INTO transactions (id, user_id, amount, type, source, description, reference_id, created_at) 
           VALUES (?, ?, ?, 'CREDIT', 'WELCOME_BONUS', ?, ?, NOW())`,
          [
            transId,
            newUserId,
            welcomeBonus,
            'Welcome Bonus',
            referrerUuid || 'SYSTEM'
          ]
        );

        // Send push notification to user
        sendNotification(
          newUserId,
          'Welcome Bonus Claimed! 🎉',
          `You received a welcome bonus of ${welcomeBonus.toFixed(0)} coins!`
        ).catch(err => console.error('Failed to send welcome bonus notification:', err.message));
      }
    } catch (insertErr) {
      if (insertErr.code === 'ER_DUP_ENTRY') {
        console.warn(`[signupUser] Duplicate entry detected during insert for UID ${uid}. Retrying as update flow.`);

        // 1. Fetch the existing user (which must have been created by the concurrent request)
        const [retryUserRows] = await pool.query('SELECT * FROM users WHERE uid = ? LIMIT 1', [uid]);
        if (retryUserRows.length > 0) {
          const user = retryUserRows[0];

          // 2. Perform the update just like we do in the exist flow
          await pool.query(
            `UPDATE users SET 
              name = ?, email = ?, phone_number = ?, android_id = ?,
              referred_by = ?, location = ?, fcm_token = ?
             WHERE uid = ?`,
            [
              name,
              email,
              phone_number || user.phone_number,
              android_id || user.android_id,
              referrerUuid || user.referred_by,
              location || user.location,
              fcm_token || user.fcm_token,
              uid
            ]
          );

          // Record/Update Device Fingerprint
          if (android_id) {
            const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
            await pool.query(
              `INSERT INTO device_fingerprints (id, user_id, android_id, device_model, os_version, ip_address, created_at)
               VALUES (?, ?, ?, ?, ?, ?, NOW())
               ON DUPLICATE KEY UPDATE device_model=VALUES(device_model), os_version=VALUES(os_version), ip_address=VALUES(ip_address)`,
              [uuidv4(), user.id, android_id, device_model || null, os_version || null, ipAddress]
            ).catch(dfErr => console.error('Failed to log device fingerprint:', dfErr));
          }

          // Handle referral mapping if referred_by is set
          if (referred_by) {
            await handleReferralMapping(user.id, referred_by);
          }

          const [updatedUser] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [user.id]);

          return res.json({
            success: true,
            message: 'User updated successfully (resolved concurrency)',
            token: generateLegacyToken(user.id),
            jwt: generateJwtToken({ id: user.id, role: 'user' }),
            user: formatUserResponse(updatedUser[0])
          });
        }
      }

      // If it's not ER_DUP_ENTRY or retry didn't find the user, rethrow
      throw insertErr;
    }

    // Record Device Fingerprint for New User
    if (android_id) {
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      await pool.query(
        `INSERT INTO device_fingerprints (id, user_id, android_id, device_model, os_version, ip_address, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE device_model=VALUES(device_model), os_version=VALUES(os_version), ip_address=VALUES(ip_address)`,
        [uuidv4(), newUserId, android_id, device_model || null, os_version || null, ipAddress]
      ).catch(dfErr => console.error('Failed to log device fingerprint:', dfErr));
    }

    // Handle referral mapping if referred_by is set
    if (referred_by) {
      await handleReferralMapping(newUserId, referred_by);
    }

    const [newUserRows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [newUserId]);
    const newUser = newUserRows[0];

    res.json({
      success: true,
      message: 'User created successfully',
      token: generateLegacyToken(newUserId),
      jwt: generateJwtToken({ id: newUserId, role: 'user' }),
      user: formatUserResponse(newUser)
    });
  } catch (error) {
    console.error('Signup Error:', error);
    res.status(500).json({ success: false, message: 'Server Error: ' + error.message });
  }
};

// Admin Login
export const loginAdmin = async (req, res) => {
  try {
    const { username, password } = req.body;

    const adminPass = process.env.ADMIN_PASSWORD || 'admin_rewardverse_secure_pass';

    if (username === 'admin' && password === adminPass) {
      const jwtToken = generateJwtToken({ role: 'admin' });
      return res.json({
        success: true,
        message: 'Admin login successful',
        token: jwtToken
      });
    }

    res.status(401).json({ success: false, message: 'Invalid admin credentials' });
  } catch (error) {
    console.error('Admin Login Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Helper: Handle Referral relation mapping in referral_uses / database table
async function handleReferralMapping(referredUserId, referrerCode) {
  try {
    if (!referrerCode) return;

    // Find referrer ID by referral code, user_id (public hex), id (UUID), or uid
    const cleanReferrerCode = referrerCode.trim();
    const [refRows] = await pool.query(
      'SELECT id, referral_code FROM users WHERE id = ? OR LOWER(referral_code) = LOWER(?) OR user_id = ? OR uid = ? LIMIT 1',
      [cleanReferrerCode, cleanReferrerCode, cleanReferrerCode, cleanReferrerCode]
    );

    if (refRows.length === 0) return;
    const referrerId = refRows[0].id;
    const actualReferrerCode = refRows[0].referral_code || cleanReferrerCode;

    // Check if referral mapping already exists
    const [existRows] = await pool.query(
      'SELECT id FROM referral_uses WHERE referred_user_id = ? LIMIT 1',
      [referredUserId]
    );

    if (existRows.length === 0) {
      // Insert into referral_uses (if the table exists in user's DB, otherwise we support it)
      await pool.query(
        `CREATE TABLE IF NOT EXISTS referral_uses (
          id CHAR(36) PRIMARY KEY,
          referrer_id CHAR(36) NOT NULL,
          referred_user_id CHAR(36) NOT NULL,
          referral_code VARCHAR(50) NOT NULL,
          status VARCHAR(20) DEFAULT 'PENDING',
          offers_completed_count INT DEFAULT 0,
          rewarded_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (referred_user_id) REFERENCES users(id) ON DELETE CASCADE
        )`
      );

      await pool.query(
        'INSERT INTO referral_uses (id, referrer_id, referred_user_id, referral_code, status, offers_completed_count) VALUES (?, ?, ?, ?, "PENDING", 0)',
        [uuidv4(), referrerId, referredUserId, actualReferrerCode]
      );
    }
  } catch (err) {
    console.error('Error in handleReferralMapping:', err.message);
  }
}

// Check if UID exists and optionally update FCM token
export const checkUid = async (req, res) => {
  try {
    const { uid, fcm_token } = req.body;

    if (!uid) {
      return res.status(400).json({ success: false, exist: null, message: 'UID is required' });
    }

    // Update FCM token if provided and user exists
    if (fcm_token) {
      await pool.query('UPDATE users SET fcm_token = ? WHERE uid = ?', [fcm_token, uid]);
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE uid = ? LIMIT 1', [uid]);

    if (rows.length > 0) {
      const user = rows[0];
      return res.json({
        success: true,
        exist: true,
        is_new_user: false,
        message: 'Login successful',
        token: generateLegacyToken(user.id),
        jwt: generateJwtToken({ id: user.id, role: 'user' }),
        user: formatUserResponse(user)
      });
    } else {
      return res.json({
        success: false,
        exist: false,
        is_new_user: true,
        message: 'Please register first'
      });
    }
  } catch (error) {
    console.error('Check UID Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
