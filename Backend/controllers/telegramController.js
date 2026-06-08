import pool from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// Helper: Get Config
async function getConfig(key, defaultValue) {
  try {
    const [rows] = await pool.query('SELECT config_value FROM app_configs WHERE config_key = ? LIMIT 1', [key]);
    if (rows.length > 0) {
      return rows[0].config_value;
    }
  } catch (error) {
    console.error(`Error getting config for ${key}:`, error);
  }
  return defaultValue;
}

// Helper: Send Message to Telegram API
async function sendTelegramMessage(botToken, chatId, text, replyMarkup = null) {
  if (!botToken || !chatId) return;
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  try {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error('Error sending Telegram message:', error);
  }
}

// Helper: Answer Callback Query to stop the loading spinner on Telegram client
async function answerCallbackQuery(botToken, callbackQueryId, text = '') {
  if (!botToken || !callbackQueryId) return;
  const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text
      })
    });
  } catch (error) {
    console.error('Error answering callback query:', error);
  }
}

// Helper: Check Chat Membership via Telegram Bot API
async function checkTelegramMembership(botToken, channelHandle, tgUserId) {
  if (!botToken || !channelHandle || !tgUserId) return false;
  const url = `https://api.telegram.org/bot${botToken}/getChatMember`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: channelHandle,
        user_id: parseInt(tgUserId)
      })
    });
    const data = await response.json();
    if (!data.ok) return false;
    const status = data.result.status;
    return ['creator', 'administrator', 'member'].includes(status);
  } catch (error) {
    console.error('Error checking Telegram membership:', error);
    return false;
  }
}

// ----------------------------------------------------
// GENERATE TOKEN (CLIENT API)
// ----------------------------------------------------
export const generateTelegramToken = async (req, res) => {
  try {
    let targetUserId = req.query.user_id || req.body.user_id || (req.user ? req.user.id : null);

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    // Resolve userId if UID is passed
    if (targetUserId.length !== 36) {
      const [uRows] = await pool.query('SELECT id FROM users WHERE uid = ? LIMIT 1', [targetUserId]);
      if (uRows.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      targetUserId = uRows[0].id;
    }

    // Check if user already claimed reward
    const [checkClaims] = await pool.query(
      'SELECT id FROM telegram_verification WHERE user_id = ? AND status = "USED" LIMIT 1',
      [targetUserId]
    );

    if (checkClaims.length > 0) {
      return res.status(400).json({ success: false, message: 'Reward already claimed' });
    }

    // Generate token
    const token = crypto.randomBytes(16).toString('hex');
    const verifyId = uuidv4();

    // Insert into verification table
    await pool.query(
      'INSERT INTO telegram_verification (id, user_id, verify_token, status, created_at) VALUES (?, ?, ?, "PENDING", NOW())',
      [verifyId, targetUserId, token]
    );

    const botUsername = await getConfig('telegram_bot_username', 'sit_verification_bot');

    res.json({
      success: true,
      token: token,
      bot_link: `https://t.me/${botUsername}?start=${token}`
    });
  } catch (error) {
    console.error('Generate Telegram Token Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ----------------------------------------------------
// TELEGRAM BOT WEBHOOK LISTENER
// ----------------------------------------------------
export const handleTelegramWebhook = async (req, res) => {
  res.status(200).send('OK'); // Acknowledge early to prevent Telegram retries

  try {
    const update = req.body;
    if (!update) return;

    const botToken = process.env.TELEGRAM_BOT_TOKEN || '8771960138:AAEVH2KyUvsjs5q_sE96JMU1hriKemgQ3jk';
    const channelHandle = await getConfig('telegram_channel_username', '@SatyainfotechNetworks');

    if (!botToken) {
      console.warn('⚠️ Telegram Bot Token is missing in environment variables.');
      return;
    }

    // CASE C: Callback Query (Inline buttons click)
    if (update.callback_query) {
      const cb = update.callback_query;
      const callbackQueryId = cb.id;
      const tgUserId = cb.from.id;
      const chatId = cb.message.chat.id;
      const data = cb.data || '';

      if (data.startsWith('check_join:')) {
        const token = data.replace('check_join:', '').trim();

        // 1. Answer callback query to stop the loading spinner in user's Telegram client
        await answerCallbackQuery(botToken, callbackQueryId, 'Checking membership status...');

        // 2. Check if user is member of the channel
        const isMember = await checkTelegramMembership(botToken, channelHandle, tgUserId);

        if (!isMember) {
          // Send notification alert popup inside Telegram
          await answerCallbackQuery(botToken, callbackQueryId, '❌ You haven\'t joined the channel yet!');
          await sendTelegramMessage(
            botToken,
            chatId,
            `❌ <b>Verification Failed</b>\n\nYou haven't joined the channel yet. Please click the <b>Join Channel</b> button above and join before clicking verify.`
          );
          return;
        }

        // 3. Find verification record in DB
        const [rows] = await pool.query(
          'SELECT * FROM telegram_verification WHERE (verify_token = ? OR click_id = ?) AND status = "PENDING" LIMIT 1',
          [token, token]
        );

        if (rows.length === 0) {
          // Check if already verified
          const [checkUsed] = await pool.query(
            'SELECT * FROM telegram_verification WHERE (verify_token = ? OR click_id = ?) AND status = "USED" LIMIT 1',
            [token, token]
          );
          if (checkUsed.length > 0) {
            await sendTelegramMessage(botToken, chatId, '⚠️ <b>Already Verified</b>\n\nYou have already claimed the reward for this task.');
          } else {
            await sendTelegramMessage(botToken, chatId, '❌ <b>Invalid or expired verification session.</b>');
          }
          return;
        }

        const record = rows[0];
        await processTelegramReward(record, String(tgUserId), botToken, chatId);
      }
      return;
    }

    // CASE A: User joins/updates membership in the channel
    if (update.chat_member) {
      const cm = update.chat_member;
      const tgUserId = cm.new_chat_member.user.id;
      const newStatus = cm.new_chat_member.status;

      if (['member', 'administrator', 'creator'].includes(newStatus)) {
        // Look for pending verification record
        const [pendRows] = await pool.query(
          `SELECT * FROM telegram_verification 
           WHERE telegram_user_id = ? AND status = "PENDING" 
           ORDER BY created_at DESC LIMIT 1`,
          [String(tgUserId)]
        );

        if (pendRows.length > 0) {
          const record = pendRows[0];
          await processTelegramReward(record, String(tgUserId), botToken);
        }
      }
      return;
    }

    // CASE B: Direct /start message
    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const text = message.text || '';
      const tgUserId = message.from.id;

      if (text.startsWith('/start')) {
        const parts = text.split(' ');
        const token = parts[1] ? parts[1].trim() : '';

        if (!token) {
          const channelClean = channelHandle.replace('@', '');
          const replyMarkup = {
            inline_keyboard: [
              [
                { text: "📢 Join Channel", url: `https://t.me/${channelClean}` }
              ]
            ]
          };
          await sendTelegramMessage(
            botToken,
            chatId,
            `<b>Welcome to Rewardverse!</b> 🌟\n\nTo verify your task, please click the <b>Join Telegram</b> button inside the Rewardverse App.`,
            replyMarkup
          );
          return;
        }

        // Look up token or click ID
        let [rows] = await pool.query(
          'SELECT * FROM telegram_verification WHERE verify_token = ? OR click_id = ? LIMIT 1',
          [token, token]
        );

        if (rows.length === 0) {
          // If not found in verification table, check if it's a valid click_id from user_offer_progress
          const [progressRows] = await pool.query(
            'SELECT * FROM user_offer_progress WHERE click_id = ? LIMIT 1',
            [token]
          );
          if (progressRows.length > 0) {
            const progress = progressRows[0];
            const verifyId = uuidv4();
            // Insert a new verification record linked to this click_id
            await pool.query(
              'INSERT INTO telegram_verification (id, user_id, click_id, verify_token, status, created_at) VALUES (?, ?, ?, NULL, "PENDING", NOW())',
              [verifyId, progress.user_id, token]
            );
            // Fetch the newly created record
            const [newRows] = await pool.query(
              'SELECT * FROM telegram_verification WHERE id = ? LIMIT 1',
              [verifyId]
            );
            rows = newRows;
          }
        }

        if (rows.length === 0) {
          await sendTelegramMessage(botToken, chatId, '❌ <b>Invalid verification link/token.</b>');
          return;
        }

        const record = rows[0];

        if (record.status === 'USED') {
          await sendTelegramMessage(botToken, chatId, '⚠️ <b>Already Verified</b>\n\nYou have already claimed the reward for this task.');
          return;
        }

        // Save Telegram User ID and update status to PENDING
        await pool.query(
          'UPDATE telegram_verification SET telegram_user_id = ? WHERE id = ?',
          [String(tgUserId), record.id]
        );

        // Check if user is already a member
        const isMember = await checkTelegramMembership(botToken, channelHandle, tgUserId);

        if (isMember) {
          await processTelegramReward(record, String(tgUserId), botToken, chatId);
        } else {
          const channelClean = channelHandle.replace('@', '');
          const replyMarkup = {
            inline_keyboard: [
              [
                { text: "📢 Join Channel", url: `https://t.me/${channelClean}` },
                { text: "✅ I Have Joined", callback_data: `check_join:${token}` }
              ]
            ]
          };
          await sendTelegramMessage(
            botToken,
            chatId,
            `<b>Welcome to Rewardverse Verification!</b> 🚀\n\nTo claim your reward, you must join our official channel:\n👉 https://t.me/${channelClean}\n\n<b>Action Required:</b> Join the channel above, then click the <b>I Have Joined</b> button below to verify.`,
            replyMarkup
          );
        }
      } else {
        const channelClean = channelHandle.replace('@', '');
        const replyMarkup = {
          inline_keyboard: [
            [
              { text: "📢 Open Official Channel", url: `https://t.me/${channelClean}` }
            ]
          ]
        };
        await sendTelegramMessage(
          botToken,
          chatId,
          `Welcome to Rewardverse! 🌟\n\nPlease use the verification link from the Rewardverse App to earn rewards.`,
          replyMarkup
        );
      }
    }
  } catch (error) {
    console.error('Handle Telegram Webhook Error:', error);
  }
};

// Helper: Process Reward and Mark Token Used
async function processTelegramReward(record, tgUserId, botToken, alertChatId = null) {
  const connection = await pool.getConnection();
  try {
    // Double check: One Telegram Account = One Reward
    const [fraudRows] = await connection.query(
      'SELECT id FROM telegram_verification WHERE telegram_user_id = ? AND status = "USED" LIMIT 1',
      [tgUserId]
    );

    if (fraudRows.length > 0) {
      await connection.release();
      const targetChat = alertChatId || tgUserId;
      await sendTelegramMessage(
        botToken,
        targetChat,
        '🚫 <b>Verification Failed</b>\n\nThis Telegram account has already been used to claim a reward. Only one claim per Telegram account is allowed.'
      );
      return;
    }

    let rewardAmount = 5.00; // Telegram joining coin reward
    let isCustomOffer = false;
    let customOfferTitle = '';
    let customTierTitle = '';

    await connection.beginTransaction();

    // Mark as USED
    await connection.query(
      'UPDATE telegram_verification SET status = "USED", telegram_user_id = ? WHERE id = ?',
      [tgUserId, record.id]
    );

    if (record.click_id) {
      // It's a custom offer! Let's resolve the offer and its tiers
      const [progressRows] = await connection.query(
        'SELECT * FROM user_offer_progress WHERE click_id = ? LIMIT 1 FOR UPDATE',
        [record.click_id]
      );
      if (progressRows.length > 0) {
        const progress = progressRows[0];
        const { offer_id, user_id } = progress;

        // Fetch offer details
        const [offerRows] = await connection.query('SELECT title FROM offers WHERE id = ? LIMIT 1', [offer_id]);
        const offerTitle = offerRows.length > 0 ? offerRows[0].title : 'Offer';
        customOfferTitle = offerTitle;

        // Fetch all tiers for this offer
        const [tierRows] = await connection.query(
          'SELECT * FROM offer_tiers WHERE offer_id = ? ORDER BY sequence ASC',
          [offer_id]
        );

        if (tierRows.length > 0) {
          isCustomOffer = true;

          // Parse completed tiers from progress
          let completedTiers = [];
          if (progress.completed_tiers) {
            try {
              completedTiers = typeof progress.completed_tiers === 'string'
                ? JSON.parse(progress.completed_tiers)
                : progress.completed_tiers;
            } catch (e) {
              completedTiers = [];
            }
          }

          // Find the first tier that has not been completed yet
          const completedTitles = completedTiers.map(ct => ct.title.toLowerCase().trim());
          const nextTier = tierRows.find(t => !completedTitles.includes(t.tier_title.toLowerCase().trim())) || tierRows[0];

          rewardAmount = parseFloat(nextTier.reward || 0);
          customTierTitle = nextTier.app_tier_title || nextTier.tier_title;

          // Mark this tier as completed
          const alreadyCompleted = completedTiers.some(ct =>
            ct.title.toLowerCase().trim() === nextTier.tier_title.toLowerCase().trim()
          );

          if (!alreadyCompleted) {
            completedTiers.push({
              title: nextTier.tier_title,
              reward: rewardAmount,
              completed_at: new Date().toISOString()
            });

            const completedTiersJson = JSON.stringify(completedTiers);

            // Check if all tiers are now completed
            const allTierTitles = tierRows.map(r => r.tier_title.toLowerCase().trim());
            const updatedCompletedTitles = completedTiers.map(ct => ct.title.toLowerCase().trim());
            const isAllCompleted = allTierTitles.every(t => updatedCompletedTitles.includes(t));
            const finalStatus = isAllCompleted ? 'COMPLETED' : 'STARTED';

            // Update user_offer_progress
            await connection.query(
              'UPDATE user_offer_progress SET completed_tiers = ?, status = ?, last_updated = NOW() WHERE click_id = ?',
              [completedTiersJson, finalStatus, record.click_id]
            );
          }
        }
      }
    }

    if (record.user_id) {
      // Credit user balance
      await connection.query('UPDATE users SET balance = balance + ? WHERE id = ?', [rewardAmount, record.user_id]);

      // Add credit transaction record
      const transId = uuidv4();
      const txSource = isCustomOffer ? 'OFFER' : 'TELEGRAM_JOIN';
      const txDesc = isCustomOffer
        ? `${customOfferTitle} : ${customTierTitle}`
        : "Joined official Telegram channel reward";
      const refId = record.click_id || null;

      await connection.query(
        `INSERT INTO transactions (id, user_id, amount, type, source, description, reference_id, created_at) 
         VALUES (?, ?, ?, "CREDIT", ?, ?, ?, NOW())`,
        [transId, record.user_id, rewardAmount, txSource, txDesc, refId]
      );
    }

    await connection.commit();

    // Send push notification if it's a custom offer
    if (isCustomOffer && record.user_id) {
      try {
        const { sendNotification } = await import('../utils/notifications.js');
        await sendNotification(
          record.user_id,
          "Coins Received!",
          `You earned ${rewardAmount.toFixed(0)} coins for completing ${customTierTitle}.`
        ).catch(err => console.error('Push Notification Error:', err.message));
      } catch (err) {
        console.error('Failed to send push notification:', err.message);
      }
    }

    // Send congratulatory message to user
    const targetChat = alertChatId || tgUserId;
    const successMsg = isCustomOffer
      ? `✅ <b>Verification Successful!</b>\n\nYour task <b>${customOfferTitle}</b> has been completed and <b>${rewardAmount.toFixed(2)} coins</b> credited to your wallet.`
      : `✅ <b>Verification Successful!</b>\n\nYour reward of 5.00 coins has been credited instantly. You can now return to the app.`;

    await sendTelegramMessage(botToken, targetChat, successMsg);
  } catch (error) {
    await connection.rollback();
    console.error('Error processing Telegram reward:', error);
  } finally {
    connection.release();
  }
}
