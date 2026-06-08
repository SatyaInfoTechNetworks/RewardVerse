import pool from '../db.js';
import { v4 as uuidv4 } from 'uuid';

// Helper: Convert UUID string to integer deterministically to avoid Kotlin Client crash
function uuidToId(uuid) {
  if (!uuid) return 0;
  let hash = 0;
  for (let i = 0; i < uuid.length; i++) {
    hash = uuid.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 10000000;
}

// 1. Get referral details for the logged-in user (web or profile view)
export const getReferralInfo = async (req, res) => {
  try {
    const userId = req.user.id;
    const referralCode = req.user.referral_code;

    // Ensure referral_settings exists and has at least one row
    await pool.query(
      `CREATE TABLE IF NOT EXISTS referral_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bonus_coins DECIMAL(10, 2) DEFAULT 10.00,
        commission_percent INT DEFAULT 10,
        offers_required INT DEFAULT 2,
        description_text TEXT NULL
      )`
    );

    const [settingsRows] = await pool.query('SELECT * FROM referral_settings LIMIT 1');
    let settings = { bonus_coins: 1000, commission_percent: 10, offers_required: 2, description_text: "Refer friends to earn more!" };
    
    if (settingsRows.length === 0) {
      await pool.query(
        "INSERT INTO referral_settings (bonus_coins, commission_percent, offers_required, description_text) VALUES (1000, 10, 2, 'Refer friends to earn more!')"
      );
    } else {
      settings = {
        bonus_coins: Math.round(parseFloat(settingsRows[0].bonus_coins)),
        commission_percent: parseInt(settingsRows[0].commission_percent),
        offers_required: parseInt(settingsRows[0].offers_required),
        description_text: settingsRows[0].description_text || "Refer friends to earn more!"
      };
    }

    // Sync referrals (self-healing)
    if (referralCode) {
      await syncUserReferrals(userId, referralCode);
    }

    // Fetch list of referred users
    const [referrals] = await pool.query(
      `SELECT r.id, r.status, r.offers_completed_count, r.created_at, 
              u.name as referred_user_name, u.profile_pic as referred_user_pic 
       FROM referral_uses r
       JOIN users u ON r.referred_user_id = u.id
       WHERE r.referrer_id = ?
       ORDER BY r.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      referral_code: referralCode,
      settings: settings,
      referrals: referrals.map(r => ({
        id: String(r.id),
        status: r.status,
        offers_completed_count: parseInt(r.offers_completed_count || 0),
        created_at: r.created_at,
        referred_user_name: r.referred_user_name,
        referred_user_pic: r.referred_user_pic
      }))
    });
  } catch (error) {
    console.error('Get Referral Info Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 2. Generate referral code
export const generateReferralCode = async (req, res) => {
  try {
    const userId = req.body.user_id || (req.user ? req.user.id : null);
    if (!userId) {
      return res.status(400).json({ success: false, message: 'Missing user_id' });
    }

    // Find user
    const [userRows] = await pool.query('SELECT * FROM users WHERE id = ? OR uid = ? LIMIT 1', [userId, userId]);
    if (userRows.length === 0) {
      return res.json({ success: false, message: 'User not found' });
    }
    const user = userRows[0];

    let referralCode = user.referral_code;
    if (!referralCode) {
      referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      await pool.query('UPDATE users SET referral_code = ? WHERE id = ?', [referralCode, user.id]);
    }

    res.json({
      success: true,
      referral_code: referralCode,
      invite_link: `https://rewardverse.com/invite/${referralCode}`,
      created_at: user.created_at,
      message: 'Referral code generated successfully'
    });
  } catch (error) {
    console.error('Generate Referral Code Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 3. Get Referral Status (for referred user to see their own status)
export const getReferralStatus = async (req, res) => {
  try {
    const userId = req.query.user_id || (req.user ? req.user.id : null);
    if (!userId) {
      return res.status(400).json({ success: false, message: 'user_id required to check status' });
    }

    // Resolve real user UUID
    const [userRows] = await pool.query('SELECT id FROM users WHERE id = ? OR uid = ? LIMIT 1', [userId, userId]);
    if (userRows.length === 0) {
      return res.json({ success: false, message: 'User not found' });
    }
    const realUserId = userRows[0].id;

    // Fetch referral settings
    const [settingsRows] = await pool.query('SELECT offers_required FROM referral_settings LIMIT 1');
    const offersNeeded = settingsRows.length > 0 ? parseInt(settingsRows[0].offers_required) : 2;

    const [refRows] = await pool.query(
      'SELECT * FROM referral_uses WHERE referred_user_id = ? LIMIT 1',
      [realUserId]
    );

    if (refRows.length > 0) {
      const refUse = refRows[0];
      const completed = parseInt(refUse.offers_completed_count || 0);
      const remaining = Math.max(0, offersNeeded - completed);

      let msg = `Completed ${completed}/${offersNeeded} offers`;
      if (remaining > 0) {
        msg = `${remaining} more offer needed`;
      } else {
        msg = "Qualified!";
      }

      res.json({
        success: true,
        status: refUse.status,
        offers_completed_count: completed,
        offers_needed: offersNeeded,
        message: msg
      });
    } else {
      res.json({
        success: false,
        message: 'No referral usage found for this user'
      });
    }
  } catch (error) {
    console.error('Get Referral Status Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 4. Get Referral Summary
export const getReferralSummary = async (req, res) => {
  try {
    const userId = req.query.user_id || (req.user ? req.user.id : null);
    if (!userId) {
      return res.status(400).json({ success: false, message: 'Missing user_id' });
    }

    // Resolve real user UUID
    const [userRows] = await pool.query('SELECT id, referral_code FROM users WHERE id = ? OR uid = ? LIMIT 1', [userId, userId]);
    if (userRows.length === 0) {
      return res.json({ success: false, message: 'User not found' });
    }
    const realUserId = userRows[0].id;
    const referralCode = userRows[0].referral_code;

    // Sync first
    if (referralCode) {
      await syncUserReferrals(realUserId, referralCode);
    }

    // Total Referrals
    const [totalRows] = await pool.query('SELECT COUNT(*) as count FROM referral_uses WHERE referrer_id = ?', [realUserId]);
    const total = totalRows[0].count;

    // Pending Referrals
    const [pendingRows] = await pool.query("SELECT COUNT(*) as count FROM referral_uses WHERE referrer_id = ? AND status = 'PENDING'", [realUserId]);
    const pending = pendingRows[0].count;

    // Earned Referrals
    const [earnedRows] = await pool.query("SELECT COUNT(*) as count FROM referral_uses WHERE referrer_id = ? AND status = 'REWARDED'", [realUserId]);
    const earned = earnedRows[0].count;

    res.json({
      success: true,
      data: {
        total_referrals: parseInt(total),
        pending_referrals: parseInt(pending),
        earned_referrals: parseInt(earned)
      }
    });
  } catch (error) {
    console.error('Get Referral Summary Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 5. Get Referral Config
export const getReferralConfig = async (req, res) => {
  try {
    const [settingsRows] = await pool.query('SELECT * FROM referral_settings LIMIT 1');
    let settings = {
      bonus_coins: 1000,
      commission_percent: 10,
      offers_required: 2,
      description_text: "Refer friends to earn more!",
      reward_trigger: 'offers_completed',
      coin_threshold: 500,
      referrer_coins: 100
    };

    if (settingsRows.length === 0) {
      await pool.query(
        "INSERT INTO referral_settings (bonus_coins, commission_percent, offers_required, description_text) VALUES (1000, 10, 2, 'Refer friends to earn more!')"
      );
    } else {
      settings = {
        bonus_coins: Math.round(parseFloat(settingsRows[0].bonus_coins)),
        commission_percent: parseFloat(settingsRows[0].commission_percent),
        offers_required: parseInt(settingsRows[0].offers_required),
        description_text: settingsRows[0].description_text || "Refer friends to earn more!",
        reward_trigger: settingsRows[0].reward_trigger || 'offers_completed',
        coin_threshold: parseFloat(settingsRows[0].coin_threshold || 500),
        referrer_coins: parseFloat(settingsRows[0].referrer_coins || 100)
      };
    }

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Get Referral Config Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 6. Get Referral History
export const getReferralHistory = async (req, res) => {
  try {
    const userId = req.query.user_id || (req.user ? req.user.id : null);
    if (!userId) {
      return res.status(400).json({ success: false, message: 'Missing user_id' });
    }

    // Resolve real user UUID
    const [userRows] = await pool.query('SELECT id, referral_code FROM users WHERE id = ? OR uid = ? LIMIT 1', [userId, userId]);
    if (userRows.length === 0) {
      return res.json({ success: false, message: 'User not found' });
    }
    const realUserId = userRows[0].id;
    const referralCode = userRows[0].referral_code;

    // Sync first
    if (referralCode) {
      await syncUserReferrals(realUserId, referralCode);
    }

    // Fetch list of referred users
    const [referrals] = await pool.query(
      `SELECT r.id, r.referred_user_id, r.status, r.offers_completed_count, r.created_at, 
              u.name as referred_user_name, u.profile_pic as referred_user_pic 
       FROM referral_uses r
       JOIN users u ON r.referred_user_id = u.id
       WHERE r.referrer_id = ?
       ORDER BY r.created_at DESC`,
      [realUserId]
    );

    const formattedReferrals = referrals.map(r => ({
      // Hash string UUIDs deterministically to Integers to avoid Kotlin crash
      id: uuidToId(r.id),
      referred_user_id: uuidToId(r.referred_user_id),
      referred_user_name: r.referred_user_name || 'Anonymous User',
      referred_user_pic: r.referred_user_pic || '',
      status: r.status,
      offers_completed_count: parseInt(r.offers_completed_count || 0),
      created_at: r.created_at
    }));

    res.json({
      success: true,
      count: formattedReferrals.length,
      data: formattedReferrals,
      message: 'Success'
    });
  } catch (error) {
    console.error('Get Referral History Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Internal Helper: Sync user referrals from database
async function syncUserReferrals(referrerId, code) {
  try {
    // Get all identifiers of the referrer to match potential referrals
    const [referrerRows] = await pool.query(
      'SELECT id, referral_code, user_id, uid FROM users WHERE id = ? LIMIT 1',
      [referrerId]
    );
    if (referrerRows.length === 0) return;
    const ref = referrerRows[0];
    const cleanReferralCode = ref.referral_code || code;
    const cleanUserHexId = ref.user_id;
    const cleanUid = ref.uid;

    // Find all users who signed up using any of these codes/identifiers
    const [referredUsers] = await pool.query(
      'SELECT id FROM users WHERE referred_by = ? OR referred_by = ? OR referred_by = ? OR referred_by = ?',
      [ref.id, cleanReferralCode, cleanUserHexId, cleanUid]
    );

    for (const u of referredUsers) {
      // Calculate their completed offer counts
      const [progressRows] = await pool.query(
        'SELECT completed_tiers FROM user_offer_progress WHERE user_id = ?',
        [u.id]
      );

      let actualCount = 0;
      progressRows.forEach(pr => {
        if (pr.completed_tiers) {
          try {
            const tiers = typeof pr.completed_tiers === 'string' ? JSON.parse(pr.completed_tiers) : pr.completed_tiers;
            actualCount += Array.isArray(tiers) ? tiers.length : 0;
          } catch (e) {
            // Ignore decoding errors
          }
        }
      });

      // Ensure record exists in referral_uses
      const [existRows] = await pool.query(
        'SELECT id, status, offers_completed_count FROM referral_uses WHERE referred_user_id = ? LIMIT 1',
        [u.id]
      );

      if (existRows.length === 0) {
        await pool.query(
          `INSERT INTO referral_uses (id, referrer_id, referred_user_id, referral_code, status, offers_completed_count) 
           VALUES (?, ?, ?, ?, 'PENDING', ?)`,
          [uuidv4(), referrerId, u.id, code, actualCount]
        );
      } else {
        const ru = existRows[0];
        if (ru.status === 'PENDING' && parseInt(ru.offers_completed_count || 0) < actualCount) {
          await pool.query(
            'UPDATE referral_uses SET offers_completed_count = ? WHERE id = ?',
            [actualCount, ru.id]
          );
        }
      }
    }
  } catch (err) {
    console.error('Error in syncUserReferrals:', err.message);
  }
}
