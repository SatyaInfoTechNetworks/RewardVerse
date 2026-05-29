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
async function sendTelegramMessage(botToken, chatId, text) {
  if (!botToken || !chatId) return;
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      })
    });
  } catch (error) {
    console.error('Error sending Telegram message:', error);
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

    const botUsername = await getConfig('telegram_bot_username', 'rewardverse_bot');

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

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const channelHandle = await getConfig('telegram_channel_username', '@rewardverse');

    if (!botToken) {
      console.warn('⚠️ Telegram Bot Token is missing in environment variables.');
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
          await sendTelegramMessage(
            botToken,
            chatId,
            `<b>Welcome to Rewardverse!</b> 🌟\n\nTo verify your task, please click the <b>Join Telegram</b> button inside the Rewardverse App.\n\nOfficial Channel: https://t.me/${channelClean}`
          );
          return;
        }

        // Look up token or click ID
        const [rows] = await pool.query(
          'SELECT * FROM telegram_verification WHERE verify_token = ? OR click_id = ? LIMIT 1',
          [token, token]
        );

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
          await sendTelegramMessage(
            botToken,
            chatId,
            `<b>Welcome to Rewardverse Verification!</b> 🚀\n\nTo claim your reward, you must join our official channel:\n👉 https://t.me/${channelClean}\n\n<b>Action Required:</b> Join the channel above. You will be verified and rewarded <b>instantly</b> upon joining!`
          );
        }
      } else {
        const channelClean = channelHandle.replace('@', '');
        await sendTelegramMessage(
          botToken,
          chatId,
          `Welcome to Rewardverse! 🌟\n\nPlease use the verification link from the Rewardverse App to earn rewards.\n\nOfficial Channel: https://t.me/${channelClean}`
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

    const rewardAmount = 5.00; // Telegram joining coin reward

    await connection.beginTransaction();

    // Mark as USED
    await connection.query(
      'UPDATE telegram_verification SET status = "USED", telegram_user_id = ? WHERE id = ?',
      [tgUserId, record.id]
    );

    if (record.user_id) {
      // Credit user balance
      await connection.query('UPDATE users SET balance = balance + ? WHERE id = ?', [rewardAmount, record.user_id]);

      // Add credit transaction record
      const transId = uuidv4();
      await connection.query(
        `INSERT INTO transactions (id, user_id, amount, type, source, description, created_at) 
         VALUES (?, ?, ?, "CREDIT", "TELEGRAM_JOIN", "Joined official Telegram channel reward", NOW())`,
        [transId, record.user_id, rewardAmount]
      );
    }

    await connection.commit();

    // Send congratulatory message to user
    const targetChat = alertChatId || tgUserId;
    await sendTelegramMessage(
      botToken,
      targetChat,
      '✅ <b>Verification Successful!</b>\n\nYour reward of 5.00 coins has been credited instantly. You can now return to the app.'
    );
  } catch (error) {
    await connection.rollback();
    console.error('Error processing Telegram reward:', error);
  } finally {
    connection.release();
  }
}
