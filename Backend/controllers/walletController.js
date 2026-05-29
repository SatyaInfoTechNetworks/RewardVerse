import pool from '../db.js';
import { v4 as uuidv4 } from 'uuid';

// 1. Get Wallet Balance and summary stats
export const getWalletBalance = async (req, res) => {
  try {
    const userId = req.user.id;

    // A. Current Balance
    const [userRows] = await pool.query('SELECT balance FROM users WHERE id = ? LIMIT 1', [userId]);
    if (userRows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const balance = parseFloat(userRows[0].balance || 0);

    // B. Total Earnings (Sum of CREDIT transactions)
    const [earningsRows] = await pool.query(
      "SELECT SUM(amount) as total FROM transactions WHERE user_id = ? AND type = 'CREDIT'",
      [userId]
    );
    const totalEarnings = parseFloat(earningsRows[0].total || 0);

    // C. Total Withdrawn (Sum of APPROVED withdrawals)
    const [withdrawnRows] = await pool.query(
      "SELECT SUM(amount) as total FROM withdrawals WHERE user_id = ? AND status = 'APPROVED'",
      [userId]
    );
    const totalWithdrawn = parseFloat(withdrawnRows[0].total || 0);

    // D. Pending Withdrawals (Sum of PENDING withdrawals)
    const [pendingRows] = await pool.query(
      "SELECT SUM(amount) as total FROM withdrawals WHERE user_id = ? AND status = 'PENDING'",
      [userId]
    );
    const pendingWithdrawals = parseFloat(pendingRows[0].total || 0);

    res.json({
      success: true,
      balance,
      totalEarnings,
      totalWithdrawn,
      pendingWithdrawals
    });
  } catch (error) {
    console.error('Get Wallet Balance Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 2. Get Earning Transactions (CREDIT or Reversal)
export const getEarnings = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Count query
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM transactions 
       WHERE user_id = ? AND (type = 'CREDIT' OR source LIKE '%REVERSAL%')`,
      [userId]
    );
    const totalCount = countRows[0].total;

    // Fetch transactions
    const [rows] = await pool.query(
      `SELECT t.id, t.amount, t.type, t.source, t.reference_id, t.description, t.created_at,
              o.title as offer_title, o.icon_url as offer_icon,
              oc.offer_name as completion_offer_name
       FROM transactions t
       LEFT JOIN user_offer_progress uop ON t.reference_id = uop.click_id AND t.source = 'OFFER'
       LEFT JOIN offers o ON uop.offer_id = o.id
       LEFT JOIN offer_completions oc ON t.reference_id = oc.completion_id
       WHERE t.user_id = ? AND (t.type = 'CREDIT' OR t.source LIKE '%REVERSAL%')
       ORDER BY t.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    // Fetch dynamic icons config from DB
    const [configRows] = await pool.query("SELECT config_value FROM app_configs WHERE config_key = 'earning_icons' LIMIT 1").catch(() => [[]]);
    let earningIcons = {};
    if (configRows && configRows.length > 0) {
      try {
        const parsed = JSON.parse(configRows[0].config_value);
        if (parsed && typeof parsed === 'object') {
          // Normalize all config keys to uppercase to prevent casing mismatches
          Object.keys(parsed).forEach(k => {
            earningIcons[k.trim().toUpperCase()] = parsed[k];
          });
        }
      } catch (e) {
        console.error('Failed to parse earning_icons config:', e);
      }
    }

    const transactions = rows.map(r => {
      let description = r.description;
      if (!description) {
        if (r.source === 'OFFER') {
          description = r.offer_title || 'Offer Reward';
        } else if (r.source === 'PUBSCALE') {
          description = r.completion_offer_name || 'PubScale Offer';
        } else if (r.source === 'PUBSCALE_REVERSAL') {
          description = 'Reversed: ' + (r.completion_offer_name || 'PubScale Offer');
        } else if (r.source === 'OFFERMARU') {
          description = r.completion_offer_name || 'Offermaru Offer';
        } else if (r.source === 'OPINION_UNIVERSE') {
          description = r.completion_offer_name || 'Opinion Universe Offer';
        } else if (r.source === 'CPX_RESEARCH') {
          description = r.completion_offer_name || 'CPX Survey Reward';
        } else if (r.source === 'CPX_RESEARCH_REVERSAL') {
          description = 'Reversed: ' + (r.completion_offer_name || 'CPX Survey');
        } else if (r.source === 'GROWDECK') {
          description = r.completion_offer_name || 'GrowDeck Offer';
        } else if (r.source === 'ADJUMP') {
          description = r.completion_offer_name || 'AdJump Offer';
        } else if (r.source === 'REAL_OPINION') {
          description = r.completion_offer_name || 'Real Opinion Offer';
        } else if (r.source === 'PLAYTIME') {
          description = r.completion_offer_name || 'Playtime Ads';
        } else if (r.source === 'POCKETSFULL') {
          description = r.completion_offer_name || 'Pocketsfull Offer';
        } else if (r.source === 'POCKETSFULL_REVERSAL') {
          description = 'Reversed: ' + (r.completion_offer_name || 'Pocketsfull Offer');
        } else if (r.source === 'REFERRAL' || r.source === 'REFERRAL_BONUS') {
          description = 'Referral Bonus';
        } else if (r.source === 'COMMISSION') {
          description = 'Offer Commission';
        } else if (r.source === 'LIFAFA_BONUS') {
          description = 'Lifafa Bonus';
        } else if (r.source === 'STREAK_REWARD') {
          description = 'Daily Streak Bonus';
        } else if (r.source === 'LUCKY_SPIN') {
          description = 'Lucky Spin Reward';
        } else if (r.source === 'DAILY_BONUS') {
          description = 'Daily Reward';
        } else if (r.source === 'WATCH_VIDEO') {
          description = 'Video Reward';
        } else if (r.source === 'SCRATCH_CARD') {
          description = 'Scratch Card Win';
        } else {
          description = r.source || 'Earning';
        }
      }

      // Dynamic icon resolution: check offer icon first, then admin config by source key,
      // then fall back to hardcoded defaults. Handles key aliases (e.g. STREAK_REWARD -> DAILY_BONUS).
      const sourceKey = (r.source || '').toUpperCase();

      // Full alias map: maps every DB source name to its canonical earning_icons config key.
      // Sources that ARE in earning_icons => map directly.
      // Sources that are aliased (reversal variants, legacy names) => map to their parent key.
      const iconKeyAlias = {
        // Streak / Daily
        'STREAK_REWARD':          'DAILY_BONUS',
        // Reversal variants — use same icon as the original network
        'PUBSCALE_REVERSAL':      'PUBSCALE',
        'CPX_RESEARCH_REVERSAL':  'CPX_RESEARCH',
        'POCKETSFULL_REVERSAL':   'POCKETSFULL',
        // Referral aliases
        'REFERRAL_BONUS':         'REFERRAL',
        'COMMISSION':             'REFERRAL',
        // Legacy offer alias
        'OFFER':                  'OFFLINE_OFFER',
        // Visit & Earn — map to a generic gift icon (no admin key yet)
        'VISIT_EARN':             'OFFLINE_OFFER',
        // Telegram join — map to referral icon (social action)
        'TELEGRAM_JOIN':          'REFERRAL',
        // Admin manual credit/debit — use admin icon
        'MANUAL_ADJUSTMENT':      'ADMIN_CREDIT',
        // Withdrawal debit
        'WITHDRAWAL':             'DEBIT_WITHDRAWAL'
      };
      const resolvedKey = iconKeyAlias[sourceKey] || sourceKey;

      // Prioritize exact match in app config first (e.g. "WITHDRAWAL"), then fallback to resolved alias config
      let iconUrl = r.offer_icon || earningIcons[sourceKey] || earningIcons[resolvedKey] || '';

      if (!iconUrl) {
        switch (sourceKey) {
          // ---- Ad Networks ----
          case 'PUBSCALE':
          case 'PUBSCALE_REVERSAL':
            iconUrl = 'https://i.ibb.co/68gPz3Y/pubscale.png';
            break;
          case 'OFFERMARU':
            iconUrl = 'https://i.ibb.co/1fWfN9k/offermaru.png';
            break;
          case 'OPINION_UNIVERSE':
            iconUrl = 'https://i.ibb.co/zXgYqKB/opinionuniverse.png';
            break;
          case 'CPX_RESEARCH':
          case 'CPX_RESEARCH_REVERSAL':
            iconUrl = 'https://i.ibb.co/LdQyJt8/cpx.png';
            break;
          case 'GROWDECK':
            iconUrl = 'https://i.ibb.co/YyYgX4C/growdeck.png';
            break;
          case 'ADJUMP':
            iconUrl = 'https://i.ibb.co/v4SgYqK/adjump.png';
            break;
          case 'REAL_OPINION':
            iconUrl = 'https://i.ibb.co/9pyqK8H/realopinion.png';
            break;
          case 'PLAYTIME':
            iconUrl = 'https://i.ibb.co/RpyqK8H/playtime.png';
            break;
          case 'POCKETSFULL':
          case 'POCKETSFULL_REVERSAL':
            iconUrl = 'https://i.ibb.co/rpnYqKB/pocketsfull.png';
            break;
          case 'TIMEWALL':
            iconUrl = 'https://i.ibb.co/twLPSHST/giftbox-1139982.png';
            break;
          // ---- In-House / Manual Offers ----
          case 'OFFER':
          case 'OFFLINE_OFFER':
            iconUrl = 'https://i.ibb.co/twLPSHST/giftbox-1139982.png';
            break;
          // ---- Bonus / Gamification ----
          case 'LIFAFA_BONUS':
            iconUrl = 'https://i.ibb.co/vvHv7WTx/envelope.png';
            break;
          case 'STREAK_REWARD':
          case 'DAILY_BONUS':
            iconUrl = 'https://img.icons8.com/color/96/calendar.png';
            break;
          case 'LUCKY_SPIN':
            iconUrl = 'https://www.vhv.rs/dpng/d/574-5746224_spin-the-wheel-png-png-download-spin-the.png';
            break;
          case 'SCRATCH_CARD':
            iconUrl = 'https://i.ibb.co/5X03C8wq/scratchcard-1.png';
            break;
          case 'WATCH_VIDEO':
            iconUrl = 'https://img.icons8.com/color/96/youtube-play.png';
            break;
          case 'VISIT_EARN':
            iconUrl = 'https://img.icons8.com/color/96/internet.png';
            break;
          // ---- Social / Referral ----
          case 'REFERRAL':
          case 'REFERRAL_BONUS':
          case 'COMMISSION':
            iconUrl = 'https://img.icons8.com/color/96/conference-call.png';
            break;
          case 'TELEGRAM_JOIN':
            iconUrl = 'https://img.icons8.com/color/96/telegram-app.png';
            break;
          // ---- Admin & System ----
          case 'MANUAL_ADJUSTMENT':
            iconUrl = 'https://img.icons8.com/color/96/admin-settings-male.png';
            break;
          case 'WITHDRAWAL':
          case 'DEBIT_WITHDRAWAL':
            iconUrl = 'https://img.icons8.com/color/96/wallet--v1.png';
            break;
          default:
            iconUrl = 'https://i.ibb.co/twLPSHST/giftbox-1139982.png';
            break;
        }
      }

      return {
        id: String(r.id),
        amount: parseFloat(r.amount),
        type: r.type || 'CREDIT',
        source: r.source,
        description: description,
        iconUrl: iconUrl,
        date: r.created_at,
        referenceId: r.reference_id || ''
      };
    });

    res.json({
      success: true,
      transactions,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit) || 1,
        totalCount,
        limit
      }
    });
  } catch (error) {
    console.error('Get Earnings Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 3. Get Withdrawal Transactions (DEBIT)
export const getRedeems = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Count query
    const [countRows] = await pool.query(
      'SELECT COUNT(*) as total FROM withdrawals WHERE user_id = ?',
      [userId]
    );
    const totalCount = countRows[0].total;

    // Fetch withdrawals with payout method details
    const [rows] = await pool.query(
      `SELECT w.id, w.amount, w.amount_coins, w.amount_currency, w.details, w.status, w.created_at,
              pm.name as method_name, pm.icon_url as method_logo, w.method_id
       FROM withdrawals w
       LEFT JOIN payout_methods pm ON w.method_id = pm.id
       WHERE w.user_id = ?
       ORDER BY w.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    const withdrawals = rows.map(r => {
      let details = r.details;
      try {
        if (typeof details === 'string' && (details.startsWith('{') || details.startsWith('['))) {
          details = JSON.parse(details);
        }
      } catch (e) {
        // Keep as string
      }

      return {
        id: String(r.id),
        amount: parseFloat(r.amount),
        amountCoins: parseInt(r.amount_coins || r.amount),
        amountCurrency: parseFloat(r.amount_currency || 0),
        method: r.method_name || r.method_id || 'Unknown',
        methodId: r.method_id,
        // Return empty string if no method logo is configured to let frontend trigger premium CDN/Vector fallback
        methodLogo: r.method_logo || '',
        details: details,
        status: r.status,
        statusText: r.status ? (r.status.charAt(0) + r.status.slice(1).toLowerCase()) : 'Pending',
        date: r.created_at
      };
    });

    res.json({
      success: true,
      withdrawals,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit) || 1,
        totalCount,
        limit
      }
    });
  } catch (error) {
    console.error('Get Redeems Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 4. Get Payout Methods with reward/monetary tiers
export const getPayoutMethods = async (req, res) => {
  try {
    const [methods] = await pool.query(
      'SELECT * FROM payout_methods WHERE is_active = 1 ORDER BY min_coins ASC'
    );

    const [tiers] = await pool.query(
      'SELECT id, method_id, coin_cost, monetary_value, currency_symbol FROM payout_tiers ORDER BY coin_cost ASC'
    );

    // Group tiers by method_id
    const tiersByMethod = {};
    tiers.forEach(t => {
      if (!tiersByMethod[t.method_id]) {
        tiersByMethod[t.method_id] = [];
      }
      tiersByMethod[t.method_id].push({
        id: String(t.id),
        coinCost: parseInt(t.coin_cost),
        monetaryValue: parseFloat(t.monetary_value),
        currencySymbol: t.currency_symbol || '₹'
      });
    });

    const formattedMethods = methods.map(m => ({
      id: String(m.id),
      name: m.name,
      description: m.description,
      iconUrl: m.icon_url,
      minCoins: parseInt(m.min_coins || 0),
      conversionRate: parseFloat(m.conversion_rate || 0),
      currencySymbol: m.currency_symbol || '₹',
      processingTime: m.processing_time || '24 Hours',
      inputType: m.input_type || 'text',
      inputLabel: m.input_label || 'Details',
      inputPlaceholder: m.input_placeholder || 'Enter details',
      isActive: Boolean(m.is_active),
      tiers: tiersByMethod[m.id] || []
    }));

    res.json({
      success: true,
      methods: formattedMethods
    });
  } catch (error) {
    console.error('Get Payout Methods Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 5. Request Payout / Withdrawal
export const requestWithdrawal = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.user.id;
    const { amount, method, method_id, details } = req.body;

    const methodId = method_id || method;
    if (!amount || !methodId || !details) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const withdrawCoins = Number(amount);
    if (isNaN(withdrawCoins) || withdrawCoins <= 0 || !Number.isInteger(withdrawCoins)) {
      return res.status(400).json({ success: false, message: 'Invalid withdrawal amount. Only whole integers are accepted. Fractional (float or double) coin values are not allowed.' });
    }

    // Begin database transaction for atomic ledger operations
    await connection.beginTransaction();

    // A. FETCH PAYOUT METHOD
    const [methodRows] = await connection.query(
      'SELECT * FROM payout_methods WHERE (id = ? OR name = ?) AND is_active = 1 LIMIT 1',
      [methodId, methodId]
    );

    if (methodRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: `Invalid or inactive payout method: ${methodId}` });
    }
    const selectedMethod = methodRows[0];

    // B. VERIFY AMOUNT IS A VALID TIER
    const [tierRows] = await connection.query(
      'SELECT monetary_value, currency_symbol FROM payout_tiers WHERE method_id = ? AND coin_cost = ? LIMIT 1',
      [selectedMethod.id, withdrawCoins]
    );

    let monetaryValue = withdrawCoins * parseFloat(selectedMethod.conversion_rate || 0.01);
    let currencySymbol = selectedMethod.currency_symbol || '₹';

    if (tierRows.length > 0) {
      monetaryValue = parseFloat(tierRows[0].monetary_value);
      currencySymbol = tierRows[0].currency_symbol || currencySymbol;
    } else {
      // Fallback: If no tiers table exists or no matching tier is defined, check min coins
      if (withdrawCoins < parseInt(selectedMethod.min_coins || 0)) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Minimum withdrawal for ${selectedMethod.name} is ${selectedMethod.min_coins} coins.`
        });
      }
    }

    // C. CHECK USER BALANCE
    const [userRows] = await connection.query(
      'SELECT balance FROM users WHERE id = ? LIMIT 1 FOR UPDATE',
      [userId]
    );

    if (userRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const currentBalance = parseFloat(userRows[0].balance);
    if (currentBalance < withdrawCoins) {
      await connection.rollback();
      return res.json({ success: false, code: 'INSUFFICIENT_BALANCE', message: 'Insufficient balance' });
    }

    // D. CHECK DAILY WITHDRAWAL COUNT LIMIT
    const [cfgRows] = await connection.query(
      "SELECT config_value FROM app_configs WHERE config_key = 'daily_withdraw_limit' LIMIT 1"
    );
    const dailyLimit = cfgRows.length > 0 ? parseInt(cfgRows[0].config_value) : 0;

    if (dailyLimit > 0) {
      const today = new Date().toISOString().split('T')[0];
      const [todayWithdrawals] = await connection.query(
        "SELECT COUNT(*) as count FROM withdrawals WHERE user_id = ? AND DATE(created_at) = ? AND status != 'REJECTED'",
        [userId, today]
      );
      if (parseInt(todayWithdrawals[0].count) >= dailyLimit) {
        await connection.rollback();
        return res.json({
          success: false,
          message: `Daily withdrawal limit of ${dailyLimit} times reached. Please try again tomorrow.`
        });
      }
    }

    // E. LOG WITHDRAWAL
    const withdrawalId = uuidv4();
    const detailsStr = typeof details === 'object' ? JSON.stringify(details) : String(details);
    
    await connection.query(
      `INSERT INTO withdrawals 
        (id, user_id, method, method_id, amount, amount_coins, amount_currency, details, status, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NOW())`,
      [
        withdrawalId,
        userId,
        selectedMethod.name,
        selectedMethod.id,
        withdrawCoins, // legacy amount column represents coins
        withdrawCoins,
        monetaryValue,
        detailsStr,
        'PENDING'
      ]
    );

    // F. INSERT DEBIT LEDGER TRANSACTION IMMEDIATELY
    const transId = uuidv4();
    await connection.query(
      `INSERT INTO transactions (id, user_id, amount, type, source, description, reference_id, created_at) 
       VALUES (?, ?, ?, 'DEBIT', 'WITHDRAWAL', ?, ?, NOW())`,
      [
        transId,
        userId,
        withdrawCoins,
        `Withdrawal request (${selectedMethod.name})`,
        withdrawalId
      ]
    );

    // G. DEDUCT USER BALANCE IN DB
    await connection.query(
      'UPDATE users SET balance = balance - ? WHERE id = ?',
      [withdrawCoins, userId]
    );

    await connection.commit();

    res.json({
      success: true,
      message: 'Withdrawal submitted successfully!',
      transactionId: withdrawalId
    });
  } catch (error) {
    await connection.rollback();
    console.error('Request Withdrawal Error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  } finally {
    connection.release();
  }
};

// 6. Get transactions list (flexible fallback)
export const getTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query(
      `SELECT t.id, t.user_id, t.amount, t.type, t.source, t.reference_id, t.description, t.created_at,
              o.icon_url as offer_icon
       FROM transactions t
       LEFT JOIN user_offer_progress uop ON t.reference_id = uop.click_id AND t.source = 'OFFER'
       LEFT JOIN offers o ON uop.offer_id = o.id
       WHERE t.user_id = ? 
       ORDER BY t.created_at DESC`,
      [userId]
    );

    // Fetch dynamic icons config from DB
    const [configRows] = await pool.query("SELECT config_value FROM app_configs WHERE config_key = 'earning_icons' LIMIT 1").catch(() => [[]]);
    let earningIcons = {};
    if (configRows && configRows.length > 0) {
      try {
        const parsed = JSON.parse(configRows[0].config_value);
        if (parsed && typeof parsed === 'object') {
          // Normalize all config keys to uppercase to prevent casing mismatches
          Object.keys(parsed).forEach(k => {
            earningIcons[k.trim().toUpperCase()] = parsed[k];
          });
        }
      } catch (e) {
        console.error('Failed to parse earning_icons config:', e);
      }
    }

    const transactions = rows.map(r => {
      const sourceKey = (r.source || '').toUpperCase();

      // Full alias map: maps every DB source name to its canonical earning_icons config key.
      const iconKeyAlias = {
        'STREAK_REWARD':          'DAILY_BONUS',
        'PUBSCALE_REVERSAL':      'PUBSCALE',
        'CPX_RESEARCH_REVERSAL':  'CPX_RESEARCH',
        'POCKETSFULL_REVERSAL':   'POCKETSFULL',
        'REFERRAL_BONUS':         'REFERRAL',
        'COMMISSION':             'REFERRAL',
        'OFFER':                  'OFFLINE_OFFER',
        'VISIT_EARN':             'OFFLINE_OFFER',
        'TELEGRAM_JOIN':          'REFERRAL',
        'MANUAL_ADJUSTMENT':      'ADMIN_CREDIT',
        'WITHDRAWAL':             'DEBIT_WITHDRAWAL'
      };
      const resolvedKey = iconKeyAlias[sourceKey] || sourceKey;

      // Prioritize exact match in app config first (e.g. "WITHDRAWAL"), then fallback to resolved alias config
      let iconUrl = r.offer_icon || earningIcons[sourceKey] || earningIcons[resolvedKey] || '';

      if (!iconUrl) {
        switch (sourceKey) {
          // ---- Ad Networks ----
          case 'PUBSCALE':
          case 'PUBSCALE_REVERSAL':
            iconUrl = 'https://i.ibb.co/68gPz3Y/pubscale.png';
            break;
          case 'OFFERMARU':
            iconUrl = 'https://i.ibb.co/1fWfN9k/offermaru.png';
            break;
          case 'OPINION_UNIVERSE':
            iconUrl = 'https://i.ibb.co/zXgYqKB/opinionuniverse.png';
            break;
          case 'CPX_RESEARCH':
          case 'CPX_RESEARCH_REVERSAL':
            iconUrl = 'https://i.ibb.co/LdQyJt8/cpx.png';
            break;
          case 'GROWDECK':
            iconUrl = 'https://i.ibb.co/YyYgX4C/growdeck.png';
            break;
          case 'ADJUMP':
            iconUrl = 'https://i.ibb.co/v4SgYqK/adjump.png';
            break;
          case 'REAL_OPINION':
            iconUrl = 'https://i.ibb.co/9pyqK8H/realopinion.png';
            break;
          case 'PLAYTIME':
            iconUrl = 'https://i.ibb.co/RpyqK8H/playtime.png';
            break;
          case 'POCKETSFULL':
          case 'POCKETSFULL_REVERSAL':
            iconUrl = 'https://i.ibb.co/rpnYqKB/pocketsfull.png';
            break;
          case 'TIMEWALL':
            iconUrl = 'https://i.ibb.co/twLPSHST/giftbox-1139982.png';
            break;
          // ---- In-House / Manual Offers ----
          case 'OFFER':
          case 'OFFLINE_OFFER':
            iconUrl = 'https://i.ibb.co/twLPSHST/giftbox-1139982.png';
            break;
          // ---- Bonus / Gamification ----
          case 'LIFAFA_BONUS':
            iconUrl = 'https://i.ibb.co/vvHv7WTx/envelope.png';
            break;
          case 'STREAK_REWARD':
          case 'DAILY_BONUS':
            iconUrl = 'https://img.icons8.com/color/96/calendar.png';
            break;
          case 'LUCKY_SPIN':
            iconUrl = 'https://www.vhv.rs/dpng/d/574-5746224_spin-the-wheel-png-png-download-spin-the.png';
            break;
          case 'SCRATCH_CARD':
            iconUrl = 'https://i.ibb.co/5X03C8wq/scratchcard-1.png';
            break;
          case 'WATCH_VIDEO':
            iconUrl = 'https://img.icons8.com/color/96/youtube-play.png';
            break;
          case 'VISIT_EARN':
            iconUrl = 'https://img.icons8.com/color/96/internet.png';
            break;
          // ---- Social / Referral ----
          case 'REFERRAL':
          case 'REFERRAL_BONUS':
          case 'COMMISSION':
            iconUrl = 'https://img.icons8.com/color/96/conference-call.png';
            break;
          case 'TELEGRAM_JOIN':
            iconUrl = 'https://img.icons8.com/color/96/telegram-app.png';
            break;
          // ---- Admin & System ----
          case 'MANUAL_ADJUSTMENT':
            iconUrl = 'https://img.icons8.com/color/96/admin-settings-male.png';
            break;
          case 'WITHDRAWAL':
          case 'DEBIT_WITHDRAWAL':
            iconUrl = 'https://img.icons8.com/color/96/wallet--v1.png';
            break;
          default:
            iconUrl = 'https://i.ibb.co/twLPSHST/giftbox-1139982.png';
            break;
        }
      }

      return {
        id: String(r.id),
        amount: parseFloat(r.amount),
        type: r.type,
        source: r.source,
        description: r.description || r.source,
        iconUrl: iconUrl,
        created_at: r.created_at,
        reference_id: r.reference_id || ''
      };
    });

    res.json({
      success: true,
      transactions
    });
  } catch (error) {
    console.error('Get Transactions Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
