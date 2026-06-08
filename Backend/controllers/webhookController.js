import pool from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { sendNotification } from '../utils/notifications.js';
import { sendAdminTelegramAlert } from '../utils/telegram.js';

// Constant-time string comparison to prevent timing attacks
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  try {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch (e) {
    return false;
  }
}

// Helper: Resolve User by uid, falling back to ID or custom user_id if not found
async function resolveUser(connection, userIdParam) {
  if (!userIdParam) return null;
  // Try by UID first
  const [rowsByUid] = await connection.query('SELECT * FROM users WHERE uid = ? LIMIT 1', [userIdParam]);
  if (rowsByUid.length > 0) return rowsByUid[0];

  // Try by ID (UUID)
  const [rowsById] = await connection.query('SELECT * FROM users WHERE id = ? LIMIT 1', [userIdParam]);
  if (rowsById.length > 0) return rowsById[0];

  // Try by custom 10-char hex public user_id
  const [rowsByHexId] = await connection.query('SELECT * FROM users WHERE user_id = ? LIMIT 1', [userIdParam]);
  if (rowsByHexId.length > 0) return rowsByHexId[0];

  return null;
}

// Helper: Check if completion transaction already exists in offer_completions (Idempotency)
async function completionExists(connection, completionId) {
  const [rows] = await connection.query('SELECT id FROM offer_completions WHERE completion_id = ? LIMIT 1', [completionId]);
  return rows.length > 0;
}

// Helper: Send Beautiful formatted Telegram Notification (DRY & Premium)
async function sendBeautifulTelegramAlert(emoji, title, user, amount, details = {}) {
  try {
    // 1. Detect provider and fetch high-quality brand icon
    let providerKey = 'generic';
    const combined = `${title} ${details['Offer Name'] || ''} ${details['Offer'] || ''}`.toLowerCase();
    if (combined.includes('pubscale')) providerKey = 'pubscale';
    else if (combined.includes('cpx')) providerKey = 'cpx_research';
    else if (combined.includes('adjump')) providerKey = 'adjump';
    else if (combined.includes('offermaru')) providerKey = 'offermaru';
    else if (combined.includes('growdeck')) providerKey = 'growdeck';
    else if (combined.includes('opinion')) providerKey = 'opinionuniverse';
    else if (combined.includes('playtime')) providerKey = 'playtimeads';
    else if (combined.includes('pocketsfull')) providerKey = 'pocketsfull';
    else if (combined.includes('real opinion') || combined.includes('realopinion')) providerKey = 'realopinion';

    const OFFERWALL_LOGOS = {
      'pubscale': 'https://i.ibb.co/68gPz3Y/pubscale.png',
      'cpx_research': 'https://i.ibb.co/LdQyJt8/cpx.png',
      'adjump': 'https://i.ibb.co/v4SgYqK/adjump.png',
      'offermaru': 'https://i.ibb.co/1fWfN9k/offermaru.png',
      'growdeck': 'https://i.ibb.co/YyYgX4C/growdeck.png',
      'opinionuniverse': 'https://i.ibb.co/zXgYqKB/opinionuniverse.png',
      'playtimeads': 'https://i.ibb.co/RpyqK8H/playtime.png',
      'pocketsfull': 'https://i.ibb.co/rpnYqKB/pocketsfull.png',
      'realopinion': 'https://i.ibb.co/9pyqK8H/realopinion.png',
      'generic': 'https://i.ibb.co/HpyqK8H/inhouse.png'
    };

    const imageUrl = OFFERWALL_LOGOS[providerKey] || OFFERWALL_LOGOS['generic'];

    // 2. Zero-width space link to automatically load offerwall brand image preview in Telegram
    let text = `<a href="${imageUrl}">&#8205;</a>`;

    const alertType = amount && amount < 0 ? 'Reversal' : 'Completion';
    text += `🔔 <b>Offerwall ${alertType} Alert</b>\n\n`;

    // 3. User Identification (Username / Hex ID)
    if (user) {
      const username = user.name || user.email?.split('@')[0] || user.user_id || 'User';
      text += `👤 <b>User:</b> @${username} (UID: <code>${user.user_id || 'N/A'}</code>)\n`;
    } else {
      text += `👤 <b>User:</b> <i>Anonymous / Not Found</i>\n`;
    }

    // 4. Offer name & wall
    const offerName = details['Offer Name'] || details['Offer'] || title || 'External Offer';
    text += `🔥 <b>Offer Name:</b> ${offerName}\n`;

    const providerName = providerKey === 'generic'
      ? 'Rewardverse Offerwall'
      : providerKey.toUpperCase().replace('_', ' ');
    text += `📡 <b>Offerwall:</b> ${providerName}\n`;

    // 5. Earned coins
    if (amount !== null) {
      const formattedAmount = `${amount > 0 ? '+' : '-'}${Math.abs(amount).toFixed(0)}`;
      text += `💰 <b>Coins Credited:</b> <b>${formattedAmount} Coins</b>\n`;
    }

    // 6. Transaction Details
    const transId = details['Transaction ID'] || details['ID'] || 'N/A';
    text += `🆔 <b>Transaction ID:</b> <code>${transId}</code>\n`;

    if (details['Reason']) {
      text += `🚨 <b>Reason:</b> <code>${details['Reason']}</code>\n`;
    }

    // 7. Explicit image preview link
    text += `🖼️ <b>Offerwall Image:</b> <a href="${imageUrl}">View Brand Logo</a>\n\n`;

    text += `⚡ <b>Powered by Rewardverse</b>\n`;
    text += `🕒 <b>System Log Time:</b> <code>${new Date().toISOString()}</code>`;

    await sendAdminTelegramAlert(text).catch(err => console.error('[TelegramAlert] Failed:', err.message));
  } catch (err) {
    console.error('[TelegramAlert] Formatting Error:', err.message);
  }
}

// =========================================================================
// 1. GENERIC POSTBACK (Original Node.js Implementation)
// =========================================================================
export const handlePostback = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const click_id = req.query.click_id || req.body.click_id;
    const tier_title = req.query.tier_title || req.body.tier_title;

    if (!click_id || !tier_title) {
      return res.status(400).json({ success: false, message: 'Missing click_id or tier_title' });
    }

    await connection.beginTransaction();

    const [progressRows] = await connection.query(
      'SELECT * FROM user_offer_progress WHERE click_id = ? LIMIT 1 FOR UPDATE',
      [click_id]
    );

    if (progressRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Invalid Click ID' });
    }

    const progress = progressRows[0];
    const { offer_id, user_id } = progress;

    // Resolve user_id (it could be stored as public hex, Firebase UID, or UUID) to primary UUID
    const [uRows] = await connection.query(
      'SELECT id FROM users WHERE id = ? OR user_id = ? OR uid = ? LIMIT 1',
      [user_id, user_id, user_id]
    );
    if (uRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'User not found for this click' });
    }
    const resolvedUserId = uRows[0].id;

    // Fetch offer title for the transaction ledger description
    const [offerRows] = await connection.query('SELECT title FROM offers WHERE id = ? LIMIT 1', [offer_id]);
    const offerTitle = offerRows.length > 0 ? offerRows[0].title : 'Offer';

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

    const isAlreadyCompleted = completedTiers.some(ct =>
      ct.title.toLowerCase().trim() === tier_title.toLowerCase().trim()
    );

    if (isAlreadyCompleted) {
      await connection.rollback();
      return res.json({ success: true, message: 'Tier already completed (idempotent)' });
    }

    const [tierRows] = await connection.query(
      'SELECT * FROM offer_tiers WHERE offer_id = ? AND LOWER(tier_title) = LOWER(?) LIMIT 1',
      [offer_id, tier_title.trim()]
    );

    if (tierRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Tier not found for this offer' });
    }

    const tier = tierRows[0];
    const reward = parseFloat(tier.reward || 0);

    completedTiers.push({
      title: tier.tier_title,
      reward: reward,
      completed_at: new Date().toISOString()
    });

    const completedTiersJson = JSON.stringify(completedTiers);

    const [allTiersRows] = await connection.query('SELECT tier_title FROM offer_tiers WHERE offer_id = ?', [offer_id]);
    const allTierTitles = allTiersRows.map(r => r.tier_title.toLowerCase().trim());
    const completedTitles = completedTiers.map(ct => ct.title.toLowerCase().trim());

    const isAllCompleted = allTierTitles.every(t => completedTitles.includes(t));
    const finalStatus = isAllCompleted ? 'COMPLETED' : 'STARTED';

    await connection.query(
      'UPDATE user_offer_progress SET completed_tiers = ?, status = ?, last_updated = NOW() WHERE click_id = ?',
      [completedTiersJson, finalStatus, click_id]
    );

    await connection.query(
      'UPDATE users SET balance = balance + ? WHERE id = ?',
      [reward, resolvedUserId]
    );

    const transId = uuidv4();
    const displayTitle = tier.app_tier_title || tier.tier_title;
    const descriptionText = `${offerTitle} : ${displayTitle}`;
    await connection.query(
      `INSERT INTO transactions (id, user_id, amount, type, source, description, reference_id, created_at) 
       VALUES (?, ?, ?, 'CREDIT', 'OFFER', ?, ?, NOW())`,
      [transId, resolvedUserId, reward, descriptionText, click_id]
    );

    await connection.commit();

    await sendNotification(
      resolvedUserId,
      "Coins Received!",
      `You earned ${reward.toFixed(0)} coins for completing ${displayTitle}.`
    );

    processReferralRewards(resolvedUserId, reward, offer_id).catch(err =>
      console.error('Error processing referral rewards:', err.message)
    );

    res.json({
      success: true,
      message: 'Tier completed and user credited successfully',
      reward: reward
    });
  } catch (error) {
    await connection.rollback();
    console.error('Postback Error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  } finally {
    connection.release();
  }
};

// =========================================================================
// 2. PUBSCALE SURVEY/OFFER POSTBACK (GET)
// =========================================================================
export const handlePubscale = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const PUB_SECRET_KEY = "5e3b39c2-755c-40ba-8c96-6b9d2e60a166";
    const { user_id, value, token, signature, offer_name = 'External Offer', goal_name = '', gaid = '', ip = '' } = req.query;

    if (!user_id || !token || !signature) {
      return res.status(400).json({ status: 'error', message: 'Missing required parameters' });
    }

    // Signature Logic: secret_key . user_id . int_value . token
    const intValue = Math.floor(parseFloat(value || 0));
    const dataString = `${PUB_SECRET_KEY}.${user_id}.${intValue}.${token}`;
    const calculatedSig = crypto.createHash('md5').update(dataString).digest('hex');

    if (!safeCompare(signature, calculatedSig)) {
      return res.status(403).json({ status: 'error', message: 'Invalid Signature' });
    }

    const user = await resolveUser(connection, user_id);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    const internalId = user.id;

    // Check Duplicate
    if (await completionExists(connection, token)) {
      return res.status(200).json({ status: 'success', message: 'Duplicate token ignored' });
    }

    await connection.beginTransaction();

    // Record Completion
    const reward = parseFloat(value || 0);
    await connection.query(
      `INSERT INTO offer_completions (completion_id, user_id, offer_id, provider, payout_coins, status, raw_payload, offer_name, goal_name, gaid, ip_address)
       VALUES (?, ?, '0', 'pubscale', ?, 'COMPLETED', ?, ?, ?, ?, ?)`,
      [token, internalId, reward, JSON.stringify(req.query), offer_name, goal_name, gaid, ip]
    );

    // Credit Balance
    await connection.query('UPDATE users SET balance = balance + ? WHERE id = ?', [reward, internalId]);

    // Transaction Log
    const transId = uuidv4();
    await connection.query(
      `INSERT INTO transactions (id, user_id, amount, type, source, description, reference_id, created_at)
       VALUES (?, ?, ?, 'CREDIT', 'PUBSCALE', ?, ?, NOW())`,
      [transId, internalId, reward, `PubScale Offer: ${offer_name}`, token]
    );

    await connection.commit();

    // Admin Alert
    sendBeautifulTelegramAlert('✅', 'PubScale Completion', user, reward, {
      'Offer Name': offer_name,
      'Goal Target': goal_name || 'N/A',
      'Transaction ID': token,
      'IP Address': ip || 'N/A'
    });

    // User Notification
    sendNotification(internalId, "Pubscale Offer Completed! 🪙", `You received ${reward} coins from ${offer_name}`).catch(console.error);

    // Process Referral
    processReferralRewards(internalId, reward, '0').catch(err => console.error('Referral Commission error:', err.message));

    return res.status(200).json({ status: 'success', message: 'User rewarded successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('PubScale Webhook Error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  } finally {
    connection.release();
  }
};

// =========================================================================
// 3. PUBSCALE CHARGEBACK/REVERSAL POSTBACK (GET)
// =========================================================================
export const handlePubscaleChargeback = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const PUB_SECRET_KEY = "5e3b39c2-755c-40ba-8c96-6b9d2e60a166";
    const { user_id, value, token, signature, offer_name = 'External Offer', reason = 'Reversed by provider', gaid = '', ip = '' } = req.query;

    if (!user_id || !token || !signature) {
      return res.status(400).json({ status: 'error', message: 'Missing required parameters' });
    }

    const intValue = Math.floor(parseFloat(value || 0));
    const dataString = `${PUB_SECRET_KEY}.${user_id}.${intValue}.${token}`;
    const calculatedSig = crypto.createHash('md5').update(dataString).digest('hex');

    if (!safeCompare(signature, calculatedSig)) {
      return res.status(403).json({ status: 'error', message: 'Invalid Signature' });
    }

    const user = await resolveUser(connection, user_id);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    const internalId = user.id;

    const [origRows] = await connection.query('SELECT * FROM offer_completions WHERE completion_id = ? LIMIT 1', [token]);
    if (origRows.length > 0 && origRows[0].status === 'REVERSED') {
      return res.status(200).json({ status: 'success', message: 'Already reversed' });
    }

    await connection.beginTransaction();

    // Update Status to REVERSED
    await connection.query('UPDATE offer_completions SET status = "REVERSED" WHERE completion_id = ?', [token]);

    // Deduct Balance
    const deduction = parseFloat(value || 0);
    await connection.query('UPDATE users SET balance = balance - ? WHERE id = ?', [deduction, internalId]);

    // Transaction Ledger (DEBIT)
    const transId = uuidv4();
    let finalReason = 'Reversed by provider';
    if (reason && typeof reason === 'string' && reason.trim().length > 0) {
      finalReason = reason.trim();
    } else if (req.query.reason && typeof req.query.reason === 'string' && req.query.reason.trim().length > 0) {
      finalReason = req.query.reason.trim();
    }

    const finalOfferName = (origRows.length > 0 && origRows[0].offer_name)
      ? origRows[0].offer_name
      : (offer_name && offer_name.trim().length > 0 ? offer_name.trim() : 'External Offer');

    const description = `Chargeback: ${finalOfferName} (${finalReason})`;
    await connection.query(
      `INSERT INTO transactions (id, user_id, amount, type, source, description, reference_id, created_at)
       VALUES (?, ?, ?, 'DEBIT', 'PUBSCALE_REVERSAL', ?, ?, NOW())`,
      [transId, internalId, deduction, description, token]
    );

    await connection.commit();

    // Admin Alert
    await sendBeautifulTelegramAlert('🚨', 'PubScale Chargeback', user, -deduction, {
      'Offer Name': finalOfferName,
      'Reason': finalReason,
      'Transaction ID': token,
      'IP Address': ip || 'N/A'
    });

    // Notification
    sendNotification(internalId, "Action Required: Points Reversed ❗", `Points for '${finalOfferName}' were reversed by the provider.`).catch(console.error);

    return res.status(200).json({ status: 'success', message: 'Chargeback processed successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('PubScale Chargeback Error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  } finally {
    connection.release();
  }
};

// =========================================================================
// 4. CPX RESEARCH SURVEY POSTBACK (GET)
// =========================================================================
export const handleCpxResearch = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const CPX_SECURE_HASH = "c61DO2Aq2vD6kZZ9OlLZzNtiXPoDrh2R";
    const { status, trans_id, user_id, amount_local = 0, hash, type = '', offer_id = '' } = req.query;

    console.log('[CPX_RESEARCH] Incoming:', req.query);

    if (!trans_id || !user_id || !hash) {
      return res.send('missing_parameters');
    }

    // Signature logic: md5(trans_id - secure_hash) or raw secure_hash for testing
    const expectedHash = crypto.createHash('md5').update(`${trans_id}-${CPX_SECURE_HASH}`).digest('hex');

    if (!safeCompare(hash, expectedHash) && hash !== CPX_SECURE_HASH) {
      console.warn('[CPX_RESEARCH] Signature Mismatch');
      return res.send('invalid_hash');
    }

    // Reversal Case (status: 2 = canceled, -2 = fraud)
    if (status === '2' || status === '-2') {
      const [origRows] = await connection.query(
        `SELECT oc.*, t.amount, t.user_id 
         FROM offer_completions oc 
         LEFT JOIN transactions t ON t.reference_id = oc.completion_id 
         WHERE oc.completion_id = ? LIMIT 1`,
        [trans_id]
      );

      if (origRows.length === 0) {
        return res.send('OK'); // Return OK to acknowledge non-existent
      }

      const orig = origRows[0];
      if (orig.status === 'REVERSED' || orig.status === 'FRAUD') {
        return res.send('OK');
      }

      await connection.beginTransaction();

      const reversalStatus = status === '-2' ? 'FRAUD' : 'REVERSED';
      await connection.query('UPDATE offer_completions SET status = ? WHERE completion_id = ?', [reversalStatus, trans_id]);

      const amount = parseFloat(orig.amount || amount_local || 0);
      await connection.query('UPDATE users SET balance = balance - ? WHERE id = ?', [amount, orig.user_id]);

      const transId = uuidv4();
      const reason = status === '-2' ? 'CPX Survey Reversal (Fraud)' : 'CPX Survey Reversal (Canceled)';
      await connection.query(
        `INSERT INTO transactions (id, user_id, amount, type, source, description, reference_id, created_at)
         VALUES (?, ?, ?, 'DEBIT', 'CPX_RESEARCH_REVERSAL', ?, ?, NOW())`,
        [transId, orig.user_id, amount, reason, trans_id]
      );

      await connection.commit();

      const user = await resolveUser(connection, orig.user_id);
      await sendBeautifulTelegramAlert('🚨', 'CPX Survey Reversal', user, -amount, {
        'Reason': reason,
        'Transaction ID': trans_id
      });

      sendNotification(orig.user_id, "Survey Reversal ⚠️", `A CPX Research survey reward of ${amount} coins was reversed.`).catch(console.error);

      return res.send('OK');
    }

    // Success Case (status === '1')
    if (status !== '1') {
      return res.send('OK');
    }

    const user = await resolveUser(connection, user_id);
    if (!user) {
      return res.send('user_not_found');
    }

    const internalId = user.id;

    if (await completionExists(connection, trans_id)) {
      return res.send('OK');
    }

    await connection.beginTransaction();

    const reward = parseFloat(amount_local || 0);
    await connection.query(
      `INSERT INTO offer_completions (completion_id, user_id, offer_id, provider, payout_coins, status, raw_payload, offer_name, goal_name, gaid, ip_address)
       VALUES (?, ?, '0', 'cpx_research', ?, 'COMPLETED', ?, 'CPX Survey Reward', ?, NULL, ?)`,
      [trans_id, internalId, reward, JSON.stringify(req.query), type || 'Survey Completion', req.ip || 'unknown']
    );

    await connection.query('UPDATE users SET balance = balance + ? WHERE id = ?', [reward, internalId]);

    const transId = uuidv4();
    await connection.query(
      `INSERT INTO transactions (id, user_id, amount, type, source, description, reference_id, created_at)
       VALUES (?, ?, ?, 'CREDIT', 'CPX_RESEARCH', 'CPX Survey Reward', ?, NOW())`,
      [transId, internalId, reward, trans_id]
    );

    await connection.commit();

    await sendBeautifulTelegramAlert('✅', 'CPX Survey Completion', user, reward, {
      'Offer Name': 'CPX Research Survey',
      'Survey Type': type || 'Survey Completion',
      'Transaction ID': trans_id
    });

    sendNotification(internalId, "Survey Reward! 📝", `You earned ${reward} coins for completing a CPX Research survey`).catch(console.error);

    processReferralRewards(internalId, reward, '0').catch(err => console.error('CPX Referral Commission error:', err.message));

    return res.send('OK');
  } catch (error) {
    await connection.rollback();
    console.error('[CPX_RESEARCH] Webhook error:', error);
    return res.send('internal_error');
  } finally {
    connection.release();
  }
};

// =========================================================================
// 5. ADJUMP POSTBACK (GET)
// =========================================================================
export const handleAdjump = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const user_id_param = req.query.user_id || req.query.userid || '';
    const rewardParam = req.query.reward || req.query.reward_amount || 0;
    let transaction_id = req.query.transaction_id || '';
    const campaign = req.query.campaign || 'Adjump Offer';
    const offer_id_param = req.query.offer_id || 0;

    if (!user_id_param || !rewardParam) {
      return res.status(400).json({ status: 'error', message: 'Missing required parameters' });
    }

    if (!transaction_id) {
      const todayHour = new Date().toISOString().substring(0, 13); // format YYYY-MM-DDTHH
      const fakeSig = crypto.createHash('md5').update(`${user_id_param}${rewardParam}${campaign}${todayHour}`).digest('hex');
      transaction_id = `ADJ_${fakeSig}`;
    }

    const user = await resolveUser(connection, user_id_param);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    const internalId = user.id;

    if (await completionExists(connection, transaction_id)) {
      return res.status(200).json({ status: 'success', message: 'Duplicate transaction ignored' });
    }

    await connection.beginTransaction();

    const reward = parseFloat(rewardParam || 0);
    await connection.query(
      `INSERT INTO offer_completions (completion_id, user_id, offer_id, provider, payout_coins, status, raw_payload, offer_name, goal_name, gaid, ip_address)
       VALUES (?, ?, ?, 'adjump', ?, 'COMPLETED', ?, ?, 'Offer Completion', ?, ?)`,
      [transaction_id, internalId, offer_id_param, reward, JSON.stringify(req.query), campaign, req.query.gaid || '', req.ip || 'unknown']
    );

    await connection.query('UPDATE users SET balance = balance + ? WHERE id = ?', [reward, internalId]);

    const transId = uuidv4();
    await connection.query(
      `INSERT INTO transactions (id, user_id, amount, type, source, description, reference_id, created_at)
       VALUES (?, ?, ?, 'CREDIT', 'ADJUMP', ?, ?, NOW())`,
      [transId, internalId, reward, `Adjump: ${campaign}`, transaction_id]
    );

    await connection.commit();

    await sendBeautifulTelegramAlert('✅', 'Adjump Completion', user, reward, {
      'Offer Name': campaign,
      'Offer ID': offer_id_param || 'N/A',
      'Transaction ID': transaction_id
    });

    sendNotification(internalId, "Adjump Reward Received! 🪙", `You received ${reward} coins for completing an offer on Adjump`).catch(console.error);

    processReferralRewards(internalId, reward, '0').catch(err => console.error('Adjump Referral Commission error:', err.message));

    return res.status(200).json({ status: 'success', message: 'User rewarded successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Adjump Error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  } finally {
    connection.release();
  }
};

// =========================================================================
// 6. OFFERMARU POSTBACK (GET)
// =========================================================================
export const handleOffermaru = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const OFFERMARU_SECRET = process.env.OFFERMARU_S2S_SECRET || "b38c7127c0b72528637466fd703e2eac90a7b033b54339a7399709292f2c8043";
    const signatureHeader = req.headers['x-offermaru-signature'] || req.headers['X-Offermaru-Signature'] || '';

    const { user_id, user_reward = 0, offer_id = '', offer_name = 'Offermaru Offer', transaction_id, publisher_payout = 0, timestamp = 0 } = req.query;

    if (!user_id || !transaction_id) {
      return res.status(400).json({ status: 'error', message: 'Missing required parameters' });
    }

    // Replay attack protection (5 mins)
    const timeDiff = Math.abs(Date.now() - parseInt(timestamp));
    if (timeDiff > 300000) {
      return res.status(403).json({ status: 'error', message: 'Callback too old' });
    }

    // Signature HMAC verification
    if (OFFERMARU_SECRET && signatureHeader) {
      const payload = {
        offer_id,
        publisher_payout,
        timestamp,
        transaction_id,
        user_id,
        user_reward
      };

      const sortedKeys = Object.keys(payload).sort();
      const baseString = sortedKeys.map(k => `${k}=${payload[k]}`).join('&');
      const expectedSignature = crypto.createHmac('sha256', OFFERMARU_SECRET).update(baseString).digest('hex');

      if (!safeCompare(signatureHeader, expectedSignature)) {
        return res.status(403).json({ status: 'error', message: 'Invalid Signature' });
      }
    } else if (OFFERMARU_SECRET && !signatureHeader) {
      return res.status(403).json({ status: 'error', message: 'Missing Signature' });
    }

    const user = await resolveUser(connection, user_id);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    const internalId = user.id;

    if (await completionExists(connection, transaction_id)) {
      return res.send('OK');
    }

    await connection.beginTransaction();

    const reward = parseFloat(user_reward || 0);
    await connection.query(
      `INSERT INTO offer_completions (completion_id, user_id, offer_id, provider, payout_coins, status, raw_payload, offer_name, goal_name, gaid, ip_address)
       VALUES (?, ?, '0', 'offermaru', ?, 'COMPLETED', ?, ?, NULL, NULL, ?)`,
      [transaction_id, internalId, reward, JSON.stringify(req.query), offer_name, req.ip || 'unknown']
    );

    await connection.query('UPDATE users SET balance = balance + ? WHERE id = ?', [reward, internalId]);

    const transId = uuidv4();
    await connection.query(
      `INSERT INTO transactions (id, user_id, amount, type, source, description, reference_id, created_at)
       VALUES (?, ?, ?, 'CREDIT', 'OFFERMARU', ?, ?, NOW())`,
      [transId, internalId, reward, `Offermaru: ${offer_name}`, transaction_id]
    );

    await connection.commit();

    await sendBeautifulTelegramAlert('✅', 'Offermaru Completion', user, reward, {
      'Offer Name': offer_name,
      'Offer ID': offer_id || 'N/A',
      'Transaction ID': transaction_id
    });

    sendNotification(internalId, "Offermaru Reward! 💎", `You received ${reward} coins for completing '${offer_name}'`).catch(console.error);

    processReferralRewards(internalId, reward, '0').catch(err => console.error('Offermaru Referral Commission error:', err.message));

    return res.send('OK');
  } catch (error) {
    await connection.rollback();
    console.error('Offermaru error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  } finally {
    connection.release();
  }
};

// =========================================================================
// 7. GROWDECK PLAYTIME POSTBACK (GET)
// =========================================================================
export const handleGrowdeck = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const GROWDECK_SECRET_KEY = "30a11d6e8a666dd4bf5d6a4ab0a899";
    const { user_id, reward, transaction_id, signature, campaign = 'GrowDeck Playtime', offer_id = 0, click_ip = '', gaid = '' } = req.query;

    if (!user_id || !transaction_id || !signature) {
      return res.status(400).json({ status: 'error', message: 'Missing required parameters' });
    }

    // Signature HMAC-SHA256: secretKey . user_id . trunc(reward) . transaction_id
    const rewardTrunc = Math.trunc(parseFloat(reward || 0));
    const template = `${GROWDECK_SECRET_KEY}.${user_id}.${rewardTrunc}.${transaction_id}`;
    const calculatedSig = crypto.createHmac('sha256', GROWDECK_SECRET_KEY).update(template).digest('hex');

    if (!safeCompare(signature, calculatedSig)) {
      return res.status(403).json({ status: 'error', message: 'Invalid Signature' });
    }

    const user = await resolveUser(connection, user_id);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    const internalId = user.id;

    if (await completionExists(connection, transaction_id)) {
      return res.status(200).json({ status: 'success', message: 'Duplicate transaction ignored' });
    }

    await connection.beginTransaction();

    const payout = parseFloat(reward || 0);
    const clientIp = click_ip || req.ip || 'unknown';
    await connection.query(
      `INSERT INTO offer_completions (completion_id, user_id, offer_id, provider, payout_coins, status, raw_payload, offer_name, goal_name, gaid, ip_address)
       VALUES (?, ?, ?, 'growdeck', ?, 'COMPLETED', ?, ?, 'Playtime Reward', ?, ?)`,
      [transaction_id, internalId, offer_id, payout, JSON.stringify(req.query), campaign, gaid, clientIp]
    );

    await connection.query('UPDATE users SET balance = balance + ? WHERE id = ?', [payout, internalId]);

    const transId = uuidv4();
    await connection.query(
      `INSERT INTO transactions (id, user_id, amount, type, source, description, reference_id, created_at)
       VALUES (?, ?, ?, 'CREDIT', 'GROWDECK', ?, ?, NOW())`,
      [transId, internalId, payout, `GrowDeck: ${campaign}`, transaction_id]
    );

    await connection.commit();

    await sendBeautifulTelegramAlert('✅', 'Growdeck Completion', user, payout, {
      'Offer Name': campaign,
      'Offer ID': offer_id || 'N/A',
      'Transaction ID': transaction_id
    });

    sendNotification(internalId, "GrowDeck Reward Received! 🪙", `You received ${payout} coins from GrowDeck Playtime`).catch(console.error);

    processReferralRewards(internalId, payout, '0').catch(err => console.error('GrowDeck Referral Commission error:', err.message));

    return res.status(200).json({ status: 'success', message: 'User rewarded successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('GrowDeck error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  } finally {
    connection.release();
  }
};

// =========================================================================
// 8. OPINION UNIVERSE SURVEY POSTBACK (GET)
// =========================================================================
export const handleOpinionUniverse = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const OPINION_UNIVERSE_TOKEN = "edeb747df552564cf19058001f70a64d0f7c51347c1d6a5f2da3fb669995a2c5";

    console.log('📝 [OPINION_UNIVERSE] Incoming webhook request:', {
      ip: req.ip,
      query: req.query,
      headers: req.headers
    });

    const user_id = req.query.userid || req.query.SID || '';
    const payoutParam = req.query.PAYOUT || 0;
    const offer_id = req.query.OFFERID || '';
    const offer_name = req.query.offername || 'Opinion Universe Offer';
    let transaction_id = req.query.TransactionID || '';
    const status = req.query.STATUS || '1';
    const event_name = req.query.eventname || '';
    const ip_address = req.query.IP || '';
    const gaid = req.query.gaid || '';
    const signature = req.query.SIG || '';

    if (transaction_id.includes('{') || !transaction_id) {
      transaction_id = `OU_${user_id}_${offer_id}_${payoutParam}_${Date.now()}`;
      console.log(`ℹ️ [OPINION_UNIVERSE] Generated synthetic transaction ID: ${transaction_id}`);
    }

    if (!user_id || !transaction_id) {
      console.error('❌ [OPINION_UNIVERSE] Validation failed: missing userid or TransactionID');
      return res.status(400).send('0');
    }

    // Signature check
    if (signature) {
      const expectedHmac = crypto
        .createHmac('sha256', OPINION_UNIVERSE_TOKEN)
        .update(transaction_id)
        .digest('hex');

      const params = { ...req.query };
      delete params.SIG;
      delete params.sig;

      const sortedKeys = Object.keys(params).sort();

      // Try RFC 3986 (%20 for spaces)
      const queryPartsRFC3986 = sortedKeys.map(key => {
        return `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`;
      });
      const queryStringRFC3986 = queryPartsRFC3986.join('&');
      const expectedSig3986 = crypto
        .createHash('sha256')
        .update(queryStringRFC3986 + OPINION_UNIVERSE_TOKEN)
        .digest('hex');

      // Try RFC 1738 (+ for spaces)
      const queryStringRFC1738 = queryStringRFC3986.replace(/%20/g, '+');
      const expectedSig1738 = crypto
        .createHash('sha256')
        .update(queryStringRFC1738 + OPINION_UNIVERSE_TOKEN)
        .digest('hex');

      // Try raw values (unencoded)
      const queryPartsRaw = sortedKeys.map(key => `${key}=${params[key]}`);
      const queryStringRaw = queryPartsRaw.join('&');
      const expectedSigRaw = crypto
        .createHash('sha256')
        .update(queryStringRaw + OPINION_UNIVERSE_TOKEN)
        .digest('hex');

      console.log(`🔒 [OPINION_UNIVERSE] Verifying signature. Received: ${signature}`);
      console.log(`🔒 [OPINION_UNIVERSE] Expected (HMAC-SHA256 of TransactionID): ${expectedHmac}`);
      console.log(`🔒 [OPINION_UNIVERSE] Expected (RFC3986): ${expectedSig3986}`);

      const match = safeCompare(signature.toLowerCase(), expectedHmac.toLowerCase()) ||
        safeCompare(signature.toLowerCase(), expectedSig3986.toLowerCase()) ||
        safeCompare(signature.toLowerCase(), expectedSig1738.toLowerCase()) ||
        safeCompare(signature.toLowerCase(), expectedSigRaw.toLowerCase());

      if (!match) {
        console.warn('❌ [OPINION_UNIVERSE] Signature Mismatch! Rejecting request with "0"');
        return res.status(403).send('0');
      }
      console.log('✅ [OPINION_UNIVERSE] Signature verified successfully.');
    } else {
      console.log('ℹ️ [OPINION_UNIVERSE] No signature SIG provided. Skipping verification.');
    }

    // Check placeholder / test callback AFTER verifying the signature
    const isTestCallback = (user_id.includes('{') || String(payoutParam).includes('{'));
    if (isTestCallback) {
      console.log('⚠️ [OPINION_UNIVERSE] Test callback placeholder identified and validated. Sending test Telegram alert and returning "1"');
      const mockUser = {
        name: 'TestUser',
        email: 'test@rewardverse.com',
        user_id: 'RV_TEST_ID'
      };
      await sendBeautifulTelegramAlert('✅', 'Opinion Universe Completion (TEST)', mockUser, parseFloat(payoutParam || 100), {
        'Offer Name': offer_name,
        'Offer ID': offer_id || 'N/A',
        'Transaction ID': transaction_id
      }).catch(console.error);
      return res.send('1');
    }

    // Reversal case
    if (status === '2') {
      console.log(`🚨 [OPINION_UNIVERSE] Reversal status received for Transaction: ${transaction_id}`);
      const [origRows] = await connection.query('SELECT * FROM offer_completions WHERE completion_id = ? LIMIT 1', [transaction_id]);
      const user = await resolveUser(connection, origRows.length > 0 ? origRows[0].user_id : user_id);
      const deduction = origRows.length > 0 ? parseFloat(origRows[0].payout_coins || payoutParam || 0) : parseFloat(payoutParam || 0);

      if (!user) {
        console.warn(`⚠️ [OPINION_UNIVERSE] Reversal failed: User not found for identifier: ${user_id}`);
      }

      if (origRows.length > 0) {
        const orig = origRows[0];
        if (orig.status !== 'REVERSED') {
          console.log(`📉 [OPINION_UNIVERSE] Reversing ${deduction} coins for user: ${user?.name || user_id}`);
          await connection.beginTransaction();
          await connection.query('UPDATE offer_completions SET status = "REVERSED" WHERE completion_id = ?', [transaction_id]);
          await connection.query('UPDATE users SET balance = balance - ? WHERE id = ?', [deduction, orig.user_id]);

          const transId = uuidv4();
          await connection.query(
            `INSERT INTO transactions (id, user_id, amount, type, source, description, reference_id, created_at)
             VALUES (?, ?, ?, 'DEBIT', 'OPINION_UNIVERSE_REVERSAL', ?, ?, NOW())`,
            [transId, orig.user_id, deduction, `Chargeback: Opinion Universe (${offer_name})`, transaction_id]
          );
          await connection.commit();
          console.log('✅ [OPINION_UNIVERSE] Database balance deducted and debit ledger written.');

          sendNotification(orig.user_id, "Action Required: Points Reversed ❗", `Points for Opinion Universe '${offer_name}' were reversed.`).catch(console.error);
        } else {
          console.log('ℹ️ [OPINION_UNIVERSE] Transaction already reversed in database.');
        }
      } else {
        console.warn('⚠️ [OPINION_UNIVERSE] Original completion record not found for reversal.');
      }
      await sendBeautifulTelegramAlert('🚨', 'Opinion Universe Reversal', user, -deduction, {
        'Offer Name': offer_name,
        'Transaction ID': transaction_id
      });
      return res.send('1');
    }

    console.log(`👤 [OPINION_UNIVERSE] Resolving user identifier: ${user_id}`);
    const user = await resolveUser(connection, user_id);
    if (!user) {
      console.error(`❌ [OPINION_UNIVERSE] User not found for identifier: ${user_id}`);
      return res.status(404).send('0');
    }

    const internalId = user.id;
    console.log(`✅ [OPINION_UNIVERSE] Resolved user: ${user.name} (UUID: ${internalId})`);

    if (await completionExists(connection, transaction_id)) {
      console.log(`ℹ️ [OPINION_UNIVERSE] Duplicate transaction ignored: ${transaction_id}`);
      return res.send('1');
    }

    await connection.beginTransaction();

    const reward = parseFloat(payoutParam || 0);
    const clientIp = ip_address || req.ip || 'unknown';

    console.log(`💰 [OPINION_UNIVERSE] Crediting ${reward} coins to user ${user.name}`);
    await connection.query(
      `INSERT INTO offer_completions (completion_id, user_id, offer_id, provider, payout_coins, status, raw_payload, offer_name, goal_name, gaid, ip_address)
       VALUES (?, ?, '0', 'opinionuniverse', ?, 'COMPLETED', ?, ?, ?, ?, ?)`,
      [transaction_id, internalId, reward, JSON.stringify(req.query), offer_name, event_name, gaid, clientIp]
    );

    await connection.query('UPDATE users SET balance = balance + ? WHERE id = ?', [reward, internalId]);

    const transId = uuidv4();
    await connection.query(
      `INSERT INTO transactions (id, user_id, amount, type, source, description, reference_id, created_at)
       VALUES (?, ?, ?, 'CREDIT', 'OPINION_UNIVERSE', ?, ?, NOW())`,
      [transId, internalId, reward, `Opinion Universe: ${offer_name}`, transaction_id]
    );

    await connection.commit();
    console.log('✅ [OPINION_UNIVERSE] Database balance credited and credit ledger written successfully.');

    await sendBeautifulTelegramAlert('✅', 'Opinion Universe Completion', user, reward, {
      'Offer Name': offer_name,
      'Offer ID': offer_id || 'N/A',
      'Transaction ID': transaction_id
    });

    sendNotification(internalId, "Opinion Universe Reward! 💎", `You received ${reward} coins for completing '${offer_name}'`).catch(console.error);

    processReferralRewards(internalId, reward, '0').catch(err => console.error('Opinion Universe Referral Commission error:', err.message));

    return res.send('1');
  } catch (error) {
    await connection.rollback();
    console.error('❌ [OPINION_UNIVERSE] Webhook Error:', error);
    return res.send('0');
  } finally {
    connection.release();
  }
};

// =========================================================================
// 9. PLAYTIME ADS MILESTONE POSTBACK (GET/POST)
// =========================================================================
export const handlePlaytimeAds = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const params = { ...req.query, ...req.body };

    // Log incoming Playtime Ads callback request
    console.log('🎮 [PLAYTIME_ADS] Incoming webhook request:', {
      ip: req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.ip,
      query: req.query,
      body: req.body,
      headers: req.headers
    });

    const { user_id, offer_id = '', offer_name = 'Playtime Offer', amount = 0, signature, task_id = '', task_name = '' } = params;

    const APPLICATION_KEY = process.env.PLAYTIME_APP_KEY || "59c2f0110111f993";
    const APPLICATION_SECRET_KEY = process.env.PLAYTIME_APP_SECRET || "3QDAWT60JYHQ2IWZ";

    if (!user_id || !amount || !signature) {
      console.warn('⚠️ [PLAYTIME_ADS] Missing required parameters:', { user_id, amount, signature });
      return res.status(400).json({ status: 'error', message: 'Missing required parameters' });
    }

    // Signature logic: sha1(user_id + offer_id + amount + app_key + app_secret)
    const rawString = `${user_id}${offer_id}${amount}${APPLICATION_KEY}${APPLICATION_SECRET_KEY}`;
    const calculatedSig = crypto.createHash('sha1').update(rawString).digest('hex');

    if (!safeCompare(signature, calculatedSig)) {
      console.warn('⚠️ [PLAYTIME_ADS] Signature verification failed!', {
        received: signature,
        calculated: calculatedSig,
        rawString: rawString,
        params: params
      });
      return res.status(403).json({ status: 'error', message: 'Signature verification failed' });
    }

    const transaction_id = `PLAYTIME_${crypto.createHash('md5').update(`${user_id}${offer_id}${task_id}${amount}${task_name}`).digest('hex')}`;

    const user = await resolveUser(connection, user_id);
    if (!user) {
      console.warn('⚠️ [PLAYTIME_ADS] User lookup failed! User not found for ID/UID/user_id:', user_id);
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    const internalId = user.id;

    if (await completionExists(connection, transaction_id)) {
      console.log('ℹ️ [PLAYTIME_ADS] Duplicate transaction ignored:', transaction_id);
      return res.status(200).json({ status: 'success', message: 'Duplicate transaction ignored' });
    }

    await connection.beginTransaction();

    const payout = parseFloat(amount || 0);
    const fullOfferName = task_name ? `${offer_name} - ${task_name}` : offer_name;

    await connection.query(
      `INSERT INTO offer_completions (completion_id, user_id, offer_id, provider, payout_coins, status, raw_payload, offer_name, goal_name, gaid, ip_address)
       VALUES (?, ?, ?, 'playtimeads', ?, 'COMPLETED', ?, ?, 'Playtime Milestone', '', ?)`,
      [transaction_id, internalId, offer_id, payout, JSON.stringify(params), fullOfferName, req.ip || 'unknown']
    );

    await connection.query('UPDATE users SET balance = balance + ? WHERE id = ?', [payout, internalId]);

    const transId = uuidv4();
    await connection.query(
      `INSERT INTO transactions (id, user_id, amount, type, source, description, reference_id, created_at)
       VALUES (?, ?, ?, 'CREDIT', 'PLAYTIME', ?, ?, NOW())`,
      [transId, internalId, payout, `Playtime: ${fullOfferName}`, transaction_id]
    );

    await connection.commit();

    await sendBeautifulTelegramAlert('✅', 'Playtime Ads Completion', user, payout, {
      'Offer Name': fullOfferName,
      'Offer ID': offer_id || 'N/A',
      'Transaction ID': transaction_id
    });

    sendNotification(internalId, "Playtime Reward Received! 🎮", `You received ${payout} coins for playing ${offer_name} (${task_name || 'Milestone'})`).catch(console.error);

    processReferralRewards(internalId, payout, '0').catch(err => console.error('Playtime Referral Commission error:', err.message));

    console.log('✅ [PLAYTIME_ADS] User credited successfully:', {
      user_id: user_id,
      internalId: internalId,
      payout: payout,
      transaction_id: transaction_id
    });

    return res.status(200).json({ status: 'success', message: 'User rewarded successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Playtime Ads Error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  } finally {
    connection.release();
  }
};

// =========================================================================
// 10. POCKETSFULL REWARD/CHARGEBACK POSTBACK (GET/POST)
// =========================================================================
export const handlePocketsfull = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const params = { ...req.query, ...req.body };
    const { status, trans_id, user_id, amount_local = 0, hash, offer_id = '', type = 'Offer' } = params;

    const POCKETSFULL_SECURE_HASH = "32bd6747585ce63889cc74de8bdc6b4e";

    if (!trans_id || !user_id || !status || !hash) {
      return res.status(400).json({ status: 'error', message: 'Missing required parameters' });
    }

    // Signature check: md5(trans_id - secure_hash)
    const expectedHash = crypto.createHash('md5').update(`${trans_id}-${POCKETSFULL_SECURE_HASH}`).digest('hex');

    if (!safeCompare(hash, expectedHash)) {
      return res.status(403).json({ status: 'error', message: 'Signature verification failed' });
    }

    const user = await resolveUser(connection, user_id);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    const internalId = user.id;

    // A: Approved/Completed Flow
    if (status.toLowerCase() === 'approved' || status.toLowerCase() === 'completed' || status === '1') {
      if (await completionExists(connection, trans_id)) {
        return res.status(200).json({ status: 'success', message: 'Duplicate transaction ignored' });
      }

      await connection.beginTransaction();

      const payout = parseFloat(amount_local || 0);
      const offerName = `Pocketsfull ${type}`;

      await connection.query(
        `INSERT INTO offer_completions (completion_id, user_id, offer_id, provider, payout_coins, status, raw_payload, offer_name, goal_name, gaid, ip_address)
         VALUES (?, ?, ?, 'pocketsfull', ?, 'COMPLETED', ?, ?, 'Offer Completion', '', ?)`,
        [trans_id, internalId, offer_id, payout, JSON.stringify(params), offerName, req.ip || 'unknown']
      );

      await connection.query('UPDATE users SET balance = balance + ? WHERE id = ?', [payout, internalId]);

      const transId = uuidv4();
      await connection.query(
        `INSERT INTO transactions (id, user_id, amount, type, source, description, reference_id, created_at)
         VALUES (?, ?, ?, 'CREDIT', 'POCKETSFULL', ?, ?, NOW())`,
        [transId, internalId, payout, `Pocketsfull: ${offerName}`, trans_id]
      );

      await connection.commit();

      await sendBeautifulTelegramAlert('✅', 'Pocketsfull Completion', user, payout, {
        'Offer Name': offerName,
        'Offer ID': offer_id || 'N/A',
        'Transaction ID': trans_id
      });

      sendNotification(internalId, "Pocketsfull Reward! 🎉", `You received ${payout} coins for completing a Pocketsfull ${type}!`).catch(console.error);

      processReferralRewards(internalId, payout, '0').catch(err => console.error('Pocketsfull Referral Commission error:', err.message));

      return res.status(200).json({ status: 'success', message: 'User rewarded successfully' });
    }

    // B: Chargeback/Rejected Flow
    if (status.toLowerCase() === 'rejected' || status.toLowerCase() === 'chargeback' || status === '2') {
      const [origRows] = await connection.query('SELECT * FROM offer_completions WHERE completion_id = ? LIMIT 1', [trans_id]);

      if (origRows.length === 0) {
        return res.status(200).json({ status: 'success', message: 'Original transaction not found, ignored' });
      }

      const orig = origRows[0];
      if (orig.status === 'REVERSED') {
        return res.status(200).json({ status: 'success', message: 'Already reversed' });
      }

      await connection.beginTransaction();

      await connection.query('UPDATE offer_completions SET status = "REVERSED" WHERE completion_id = ?', [trans_id]);

      const deduction = parseFloat(orig.payout_coins || amount_local || 0);
      await connection.query('UPDATE users SET balance = balance - ? WHERE id = ?', [deduction, internalId]);

      const transId = uuidv4();
      const finalOfferName = orig.offer_name || 'Pocketsfull Offer';
      await connection.query(
        `INSERT INTO transactions (id, user_id, amount, type, source, description, reference_id, created_at)
         VALUES (?, ?, ?, 'DEBIT', 'POCKETSFULL_REVERSAL', ?, ?, NOW())`,
        [transId, internalId, deduction, `Chargeback: ${finalOfferName}`, trans_id]
      );

      await connection.commit();

      await sendBeautifulTelegramAlert('🚨', 'Pocketsfull Chargeback', user, -deduction, {
        'Offer Name': finalOfferName,
        'Transaction ID': trans_id
      });

      sendNotification(internalId, "Action Required: Points Reversed ❗", `Points for '${finalOfferName}' were reversed due to rejection by the provider.`).catch(console.error);

      return res.status(200).json({ status: 'success', message: 'Chargeback processed successfully' });
    }

    // Default status fallback
    return res.status(200).json({ status: 'success', message: `Status ignored: ${status}` });
  } catch (error) {
    await connection.rollback();
    console.error('Pocketsfull Error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  } finally {
    connection.release();
  }
};

// =========================================================================
// 11. REAL OPINION JSON POSTBACK (POST)
// =========================================================================
export const handleRealOpinion = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { app_id = '', user_id = '', status = 0, trans_id = '', publisher_payout = 0, user_payout = 0, bonus_amount = 0 } = req.body;

    if (!user_id || !trans_id) {
      return res.status(400).json({ success: false, message: 'Missing required fields (user_id/trans_id)' });
    }

    if (parseInt(status) !== 1) {
      return res.status(200).json({ success: true, message: 'Status not success, ignored.' });
    }

    const user = await resolveUser(connection, user_id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const internalId = user.id;

    if (await completionExists(connection, trans_id)) {
      return res.status(200).json({ success: true, message: 'Duplicate transaction ignored' });
    }

    await connection.beginTransaction();

    const reward = parseFloat(user_payout || 0) + parseFloat(bonus_amount || 0);

    await connection.query(
      `INSERT INTO offer_completions (completion_id, user_id, offer_id, provider, payout_coins, status, raw_payload, offer_name, goal_name, gaid, ip_address)
       VALUES (?, ?, '0', 'realopinion', ?, 'COMPLETED', ?, 'Real Opinion Offer', 'Direct Payout', '', ?)`,
      [trans_id, internalId, reward, JSON.stringify(req.body), req.ip || 'unknown']
    );

    await connection.query('UPDATE users SET balance = balance + ? WHERE id = ?', [reward, internalId]);

    const transId = uuidv4();
    await connection.query(
      `INSERT INTO transactions (id, user_id, amount, type, source, description, reference_id, created_at)
       VALUES (?, ?, ?, 'CREDIT', 'REAL_OPINION', 'Real Opinion Offer', ?, NOW())`,
      [transId, internalId, reward, trans_id]
    );

    await connection.commit();

    await sendBeautifulTelegramAlert('✅', 'Real Opinion Completion', user, reward, {
      'Offer Name': 'Real Opinion Survey',
      'Transaction ID': trans_id
    });

    sendNotification(internalId, "Real Opinion Reward Received! 🪙", `You received ${reward} coins from Real Opinion`).catch(console.error);

    processReferralRewards(internalId, reward, '0').catch(err => console.error('Real Opinion Referral Commission error:', err.message));

    return res.status(200).json({ success: true, message: 'Callback received and processed successfully.' });
  } catch (error) {
    await connection.rollback();
    console.error('Real Opinion Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

// =========================================================================
// 12. GENERIC COMPLETED (PENDING VALIDATION) POSTBACK (POST)
// =========================================================================
export const handleOfferCompleted = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { completion_id, offer_id, payout, user_id, user_install_id, provider = 'unknown' } = req.body;

    if (!completion_id || !offer_id || !payout) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const userIdentifier = user_id || user_install_id;
    if (!userIdentifier) {
      return res.status(400).json({ message: 'Missing user identifier' });
    }

    const user = await resolveUser(connection, userIdentifier);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const internalId = user.id;

    if (await completionExists(connection, completion_id)) {
      return res.status(200).json({ success: true, message: 'Duplicate completion ignored' });
    }

    await connection.beginTransaction();

    const reward = parseFloat(payout || 0);

    // Save as PENDING_VALIDATION (will NOT credit balance immediately)
    await connection.query(
      `INSERT INTO offer_completions (completion_id, user_id, offer_id, provider, payout_coins, status, raw_payload, offer_name, goal_name, gaid, ip_address)
       VALUES (?, ?, ?, ?, ?, 'PENDING_VALIDATION', ?, 'Pending Offer Validation', 'S2S Validation', '', ?)`,
      [completion_id, internalId, offer_id, provider, reward, JSON.stringify(req.body), req.ip || 'unknown']
    );

    await connection.commit();

    await sendBeautifulTelegramAlert('⏳', 'Offer Validation Pending', user, reward, {
      'Offer ID': offer_id || 'N/A',
      'Provider': provider,
      'Transaction ID': completion_id,
      'Status': 'Pending Validation'
    });

    sendNotification(internalId, "Offer Recorded", "We've received your offer submission. It's currently pending validation.").catch(console.error);

    return res.status(200).json({ success: true, message: 'Offer recorded' });
  } catch (error) {
    await connection.rollback();
    console.error('Offer Completed Error:', error);
    return res.status(500).json({ message: error.message });
  } finally {
    connection.release();
  }
};

// =========================================================================
// =========================================================================
// HELPER: PROCESS REFERRAL REWARDS (Ledger Safe)
// Called on every offer/task completion postback
// =========================================================================
async function processReferralRewards(referredUserId, rewardAmount, offerId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [userRows] = await connection.query('SELECT referred_by, balance FROM users WHERE id = ? LIMIT 1', [referredUserId]);
    if (userRows.length === 0 || !userRows[0].referred_by) {
      await connection.rollback();
      return;
    }
    const referrerCode = userRows[0].referred_by;
    const userBalance = parseFloat(userRows[0].balance || 0);

    const [referrerRows] = await connection.query(
      'SELECT id, name FROM users WHERE LOWER(referral_code) = LOWER(?) OR user_id = ? OR id = ? OR uid = ? LIMIT 1',
      [referrerCode.trim(), referrerCode.trim(), referrerCode.trim(), referrerCode.trim()]
    );
    if (referrerRows.length === 0) {
      await connection.rollback();
      return;
    }
    const referrerId = referrerRows[0].id;

    const [settingsRows] = await connection.query('SELECT * FROM referral_settings LIMIT 1');
    const settings = settingsRows.length > 0
      ? settingsRows[0]
      : { bonus_coins: 10.00, commission_percent: 10, offers_required: 2, reward_trigger: 'offers_completed', coin_threshold: 500, referrer_coins: 100 };

    const trigger = settings.reward_trigger || 'offers_completed';
    const commissionEnabled = settings.commission_enabled !== 0 && settings.commission_enabled !== false;

    // If trigger is first_withdrawal, milestone bonus is handled in walletController — skip here
    if (trigger === 'first_withdrawal') {
      // Still give commission % on every offer completion if enabled
      const commPercent = parseInt(settings.commission_percent);
      if (commissionEnabled && commPercent > 0 && rewardAmount > 0) {
        const commissionAmount = rewardAmount * (commPercent / 100);
        if (commissionAmount > 0) {
          await connection.query('UPDATE users SET balance = balance + ? WHERE id = ?', [commissionAmount, referrerId]);
          const transId = uuidv4();
          await connection.query(
            `INSERT INTO transactions (id, user_id, amount, type, source, description, reference_id, created_at) 
             VALUES (?, ?, ?, 'CREDIT', 'REFERRAL', ?, ?, NOW())`,
            [transId, referrerId, commissionAmount, `Commission (${commPercent}% of friend task reward)`, offerId]
          );
          await sendNotification(referrerId, "Referral Commission Earned!", `You earned ${commissionAmount.toFixed(1)} coins commission from your referred friend's task completion!`);
        }
      }
      await connection.commit();
      return;
    }

    // Ensure referral_uses record exists and track progress
    const [useRows] = await connection.query(
      'SELECT * FROM referral_uses WHERE referred_user_id = ? LIMIT 1 FOR UPDATE',
      [referredUserId]
    );

    let refUse = null;
    if (useRows.length === 0) {
      const useId = uuidv4();
      await connection.query(
        `INSERT INTO referral_uses (id, referrer_id, referred_user_id, referral_code, status, offers_completed_count) 
         VALUES (?, ?, ?, ?, 'PENDING', 1)`,
        [useId, referrerId, referredUserId, referrerCode]
      );
      const [newUseRows] = await connection.query('SELECT * FROM referral_uses WHERE id = ? LIMIT 1', [useId]);
      refUse = newUseRows[0];
    } else {
      refUse = useRows[0];
      await connection.query(
        'UPDATE referral_uses SET offers_completed_count = offers_completed_count + 1 WHERE id = ?',
        [refUse.id]
      );
      refUse.offers_completed_count += 1;
    }

    // Only fire milestone reward if still PENDING
    if (refUse.status === 'PENDING') {
      let milestoneReached = false;
      let milestoneDescription = '';

      if (trigger === 'offers_completed') {
        const threshold = parseInt(settings.offers_required);
        if (refUse.offers_completed_count >= threshold) {
          milestoneReached = true;
          milestoneDescription = `Referral Milestone Bonus (Friend completed ${threshold} tasks)`;
        }
      } else if (trigger === 'coin_threshold') {
        // Recalculate total earnings of the referred user
        const [earnRows] = await connection.query(
          "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'CREDIT'",
          [referredUserId]
        );
        const totalEarned = parseFloat(earnRows[0].total || 0);
        const threshold = parseFloat(settings.coin_threshold || 500);
        if (totalEarned >= threshold) {
          milestoneReached = true;
          milestoneDescription = `Referral Milestone Bonus (Friend earned ${threshold} coins)`;
        }
      }

      if (milestoneReached) {
        await connection.query(
          'UPDATE referral_uses SET status = "REWARDED", rewarded_at = NOW() WHERE id = ?',
          [refUse.id]
        );

        const bonusCoins = parseFloat(settings.referrer_coins || settings.bonus_coins || 100);
        await connection.query('UPDATE users SET balance = balance + ? WHERE id = ?', [bonusCoins, referrerId]);

        const transId = uuidv4();
        await connection.query(
          `INSERT INTO transactions (id, user_id, amount, type, source, description, reference_id, created_at) 
           VALUES (?, ?, ?, 'CREDIT', 'REFERRAL_BONUS', ?, ?, NOW())`,
          [transId, referrerId, bonusCoins, milestoneDescription, refUse.id]
        );

        await sendNotification(
          referrerId,
          "Referral Bonus Claimed!",
          `You received ${bonusCoins.toFixed(0)} coins because ${milestoneDescription.toLowerCase()}!`
        );
      }
    }

    // Commission % on every offer completion regardless of trigger type
    const commPercent = parseInt(settings.commission_percent);
    if (commissionEnabled && commPercent > 0 && rewardAmount > 0) {
      const commissionAmount = rewardAmount * (commPercent / 100);
      if (commissionAmount > 0) {
        await connection.query('UPDATE users SET balance = balance + ? WHERE id = ?', [commissionAmount, referrerId]);
        const transId = uuidv4();
        await connection.query(
          `INSERT INTO transactions (id, user_id, amount, type, source, description, reference_id, created_at) 
           VALUES (?, ?, ?, 'CREDIT', 'REFERRAL', ?, ?, NOW())`,
          [transId, referrerId, commissionAmount, `Commission (${commPercent}% of friend task reward)`, offerId]
        );
        await sendNotification(referrerId, "Referral Commission Earned!", `You earned ${commissionAmount.toFixed(1)} coins commission from your referred friend's task completion!`);
      }
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    console.error('❌ Error processing referral rewards:', err.message);
  } finally {
    connection.release();
  }
}


// =========================================================================
// 13. TIMEWALL POSTBACK (GET/POST)
// =========================================================================
export const handleTimewall = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const TIMEWALL_SECRET = "e1bd718416cbd32f670bd4587a4f3313";
    const params = { ...req.query, ...req.body };
    const {
      user_id: user_id_param,
      transaction_id,
      revenue: revenueParam = '0',
      reward: rewardParam = '0',
      hash,
      ip = '',
      type = 'credit',
      withdraw_id = '',
      reason = '',
      offer_name = 'Timewall Withdrawal'
    } = params;

    const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.ip || ip || 'unknown';

    console.log('🔍 [TIMEWALL POSTBACK] Incoming Webhook Details:', {
      timestamp: new Date().toISOString(),
      method: req.method,
      resolvedIp: clientIp,
      headers: req.headers,
      queryParams: req.query,
      bodyParams: req.body,
      mergedParams: params
    });

    if (!user_id_param || !transaction_id) {
      console.error('❌ [TIMEWALL] Validation failed: missing user_id_param or transaction_id in request params', {
        user_id_param,
        transaction_id
      });
      return res.status(400).json({ status: 'error', message: 'Missing required parameters (user_id / transaction_id)' });
    }

    // Verify Hash/Signature: sha256(userID . revenue . SecretKey)
    if (hash) {
      const rawUserId = req.query.user_id || req.body.user_id || user_id_param;
      const rawRevenue = req.query.revenue || req.body.revenue || revenueParam;
      const payload = `${rawUserId}${rawRevenue}${TIMEWALL_SECRET}`;
      const calculatedHash = crypto.createHash('sha256').update(payload).digest('hex');

      console.log('🔒 [TIMEWALL] Verifying signature inputs:', {
        rawUserId,
        rawRevenue,
        secretLength: TIMEWALL_SECRET.length,
        payloadString: payload,
        hashReceived: hash,
        hashCalculated: calculatedHash
      });

      if (!safeCompare(hash.toLowerCase(), calculatedHash.toLowerCase())) {
        console.warn('❌ [TIMEWALL] Signature Mismatch! Rejecting postback request.', {
          received: hash.toLowerCase(),
          expected: calculatedHash.toLowerCase()
        });
        return res.status(403).json({ status: 'error', message: 'Invalid signature hash' });
      }
      console.log('✅ [TIMEWALL] Signature verified successfully.');
    } else {
      console.log('ℹ️ [TIMEWALL] No signature hash provided by provider. Skipping security hash verification.');
    }

    const user = await resolveUser(connection, user_id_param);
    if (!user) {
      console.error(`❌ [TIMEWALL] User not found for identifier: ${user_id_param}`);
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }
    const internalId = user.id;
    console.log(`✅ [TIMEWALL] Resolved user: ${user.name} (UUID: ${internalId})`);

    const reward = parseFloat(rewardParam || 0);
    const revenue = parseFloat(revenueParam || 0);

    // Reversal / Chargeback Case
    if (type.toLowerCase() === 'chargeback' || reward < 0 || revenue < 0) {
      console.log(`🚨 [TIMEWALL] Processing chargeback/reversal for Transaction: ${transaction_id}`);
      const [origRows] = await connection.query('SELECT * FROM offer_completions WHERE completion_id = ? LIMIT 1', [transaction_id]);
      const deduction = Math.abs(reward);

      if (origRows.length > 0 && origRows[0].status === 'REVERSED') {
        console.log('ℹ️ [TIMEWALL] Transaction already reversed in database.');
        return res.status(200).json({ status: 'success', message: 'Already reversed' });
      }

      await connection.beginTransaction();
      await connection.query('UPDATE offer_completions SET status = "REVERSED" WHERE completion_id = ?', [transaction_id]);
      await connection.query('UPDATE users SET balance = balance - ? WHERE id = ?', [deduction, internalId]);

      const transId = uuidv4();
      const description = `Chargeback: Timewall (${reason || offer_name})`;
      await connection.query(
        `INSERT INTO transactions (id, user_id, amount, type, source, description, reference_id, created_at)
         VALUES (?, ?, ?, 'DEBIT', 'TIMEWALL_REVERSAL', ?, ?, NOW())`,
        [transId, internalId, deduction, description, transaction_id]
      );
      await connection.commit();
      console.log('✅ [TIMEWALL] Chargeback executed successfully.');

      await sendBeautifulTelegramAlert('🚨', 'Timewall Chargeback', user, -deduction, {
        'Offer Name': offer_name,
        'Reason': reason || 'Reversal by provider',
        'Transaction ID': transaction_id
      });

      sendNotification(internalId, "Action Required: Points Reversed ❗", `Points for Timewall '${offer_name}' were reversed.`).catch(console.error);

      return res.status(200).json({ status: 'success', message: 'Chargeback processed successfully' });
    }

    // Hold Case
    if (type.toLowerCase() === 'hold') {
      console.log(`⏳ [TIMEWALL] Processing hold validation for Transaction: ${transaction_id}`);
      if (await completionExists(connection, transaction_id)) {
        console.log('ℹ️ [TIMEWALL] Hold transaction already exists, skipping.');
        return res.status(200).json({ status: 'success', message: 'Transaction already recorded' });
      }

      await connection.beginTransaction();
      await connection.query(
        `INSERT INTO offer_completions (completion_id, user_id, offer_id, provider, payout_coins, status, raw_payload, offer_name, goal_name, gaid, ip_address)
         VALUES (?, ?, '0', 'timewall', ?, 'PENDING_VALIDATION', ?, ?, 'Timewall Hold', '', ?)`,
        [transaction_id, internalId, reward, JSON.stringify(params), offer_name, ip]
      );
      await connection.commit();
      console.log('✅ [TIMEWALL] Hold recorded successfully.');

      await sendBeautifulTelegramAlert('⏳', 'Timewall Validation Pending', user, reward, {
        'Offer Name': offer_name,
        'Transaction ID': transaction_id,
        'Status': 'Pending Validation'
      });

      sendNotification(internalId, "Offer Recorded", "We've received your Timewall submission. It's currently pending validation.").catch(console.error);
      return res.status(200).json({ status: 'success', message: 'Hold recorded successfully' });
    }

    // Hold Cancelled Case
    if (type.toLowerCase() === 'hold_cancelled') {
      console.log(`❌ [TIMEWALL] Processing hold cancellation for Transaction: ${transaction_id}`);
      const [origRows] = await connection.query('SELECT * FROM offer_completions WHERE completion_id = ? LIMIT 1', [transaction_id]);
      if (origRows.length === 0) {
        return res.status(200).json({ status: 'success', message: 'Hold transaction not found' });
      }

      await connection.beginTransaction();
      await connection.query('UPDATE offer_completions SET status = "CANCELLED" WHERE completion_id = ?', [transaction_id]);
      await connection.commit();
      console.log('✅ [TIMEWALL] Hold cancelled successfully.');

      sendNotification(internalId, "Timewall Offer Cancelled ⚠️", `Your pending Timewall offer '${offer_name}' was cancelled.`).catch(console.error);
      return res.status(200).json({ status: 'success', message: 'Hold cancelled successfully' });
    }

    // Standard Approved/Credit Case
    if (await completionExists(connection, transaction_id)) {
      console.log(`ℹ️ [TIMEWALL] Duplicate credit transaction ignored: ${transaction_id}`);
      return res.status(200).json({ status: 'success', message: 'Duplicate transaction ignored' });
    }

    await connection.beginTransaction();

    await connection.query(
      `INSERT INTO offer_completions (completion_id, user_id, offer_id, provider, payout_coins, status, raw_payload, offer_name, goal_name, gaid, ip_address)
       VALUES (?, ?, '0', 'timewall', ?, 'COMPLETED', ?, ?, 'Offer Completion', '', ?)`,
      [transaction_id, internalId, reward, JSON.stringify(params), offer_name, ip]
    );

    await connection.query('UPDATE users SET balance = balance + ? WHERE id = ?', [reward, internalId]);

    const transId = uuidv4();
    await connection.query(
      `INSERT INTO transactions (id, user_id, amount, type, source, description, reference_id, created_at)
       VALUES (?, ?, ?, 'CREDIT', 'TIMEWALL', ?, ?, NOW())`,
      [transId, internalId, reward, `Timewall: ${offer_name}`, transaction_id]
    );

    await connection.commit();
    console.log('✅ [TIMEWALL] Credit successfully processed.');

    await sendBeautifulTelegramAlert('✅', 'Timewall Completion', user, reward, {
      'Offer Name': offer_name,
      'Transaction ID': transaction_id
    });

    sendNotification(internalId, "Timewall Reward Received! 🪙", `You received ${reward} coins for completing an offer on Timewall`).catch(console.error);

    processReferralRewards(internalId, reward, '0').catch(err => console.error('Timewall Referral Commission error:', err.message));

    return res.status(200).json({ status: 'success', message: 'User rewarded successfully' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('❌ [TIMEWALL] Webhook error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  } finally {
    connection.release();
  }
};
