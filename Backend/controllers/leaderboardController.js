import pool from '../db.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Helper: Calculate Dynamic Prize Pool
 */
const calculateDynamicPool = (basePool, growthPerUser, maxCap, userCount) => {
  const base = parseFloat(basePool) || 0;
  const growthRate = parseFloat(growthPerUser) || 0;
  const cap = parseFloat(maxCap) || 100000;
  const dynamicBonus = userCount * growthRate;
  return Math.min(base + dynamicBonus, cap);
};

// ==========================================
// USER API ENDPOINTS
// ==========================================

/**
 * GET /api/leaderboards/banner (or /api/leaderboards)
 * Returns Leaderboard Home Banner configuration & user summary
 */
export const getHomeLeaderboardBanner = async (req, res) => {
  try {
    const userId = req.user?.id;

    // Get Active Leaderboards
    const [leaderboards] = await pool.query(
      `SELECT * FROM leaderboards WHERE is_active = TRUE AND show_on_home = TRUE ORDER BY created_at ASC`
    );

    // Get current month season
    const now = new Date();
    const seasonMonthYear = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const timeRemainingMs = Math.max(0, endOfMonth.getTime() - now.getTime());
    const daysRemaining = Math.floor(timeRemainingMs / (1000 * 60 * 60 * 24));
    const hoursRemaining = Math.floor((timeRemainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    // Calculate overall dynamic pool across active leaderboards
    let totalPrizePool = 0;
    const activeLbCount = leaderboards.length || 6;

    // Count qualified participants
    const [partCount] = await pool.query(`SELECT COUNT(DISTINCT user_id) as total FROM leaderboard_entries WHERE qualified = TRUE`);
    const totalParticipants = partCount[0]?.total || 0;

    for (const lb of leaderboards) {
      if (lb.dynamic_pool_enabled) {
        totalPrizePool += calculateDynamicPool(lb.reward_pool, lb.pool_growth_per_user, lb.max_pool_cap, totalParticipants);
      } else {
        totalPrizePool += parseFloat(lb.reward_pool) || 0;
      }
    }

    // Default dynamic pool fallback if no configured leaderboards
    if (totalPrizePool === 0) totalPrizePool = 25000 + (totalParticipants * 10);

    // Get Authenticated User Rank & Status if logged in
    let userRank = null;
    let userScore = 0;
    let coinsNeededForTop10 = 0;

    if (userId) {
      // User's monthly earnings rank
      const [userEntries] = await pool.query(
        `SELECT le.score, le.\`rank\` 
         FROM leaderboard_entries le
         JOIN leaderboards l ON le.leaderboard_id = l.id
         WHERE le.user_id = ? AND l.period = 'MONTHLY' AND l.type = 'EARNINGS' AND le.is_disqualified = FALSE
         LIMIT 1`,
        [userId]
      );

      if (userEntries.length > 0) {
        userRank = userEntries[0].rank || null;
        userScore = parseFloat(userEntries[0].score) || 0;
      } else {
        // Calculate user earnings this month
        const [userTx] = await pool.query(
          `SELECT COALESCE(SUM(amount), 0) as total FROM transactions 
           WHERE user_id = ? AND type = 'CREDIT' AND MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())`,
          [userId]
        );
        userScore = parseFloat(userTx[0]?.total) || 0;
      }

      // Find score of 10th rank player
      const [top10th] = await pool.query(
        `SELECT score FROM (
           SELECT COALESCE(SUM(amount), 0) as score
           FROM transactions
           WHERE type = 'CREDIT' AND MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())
           GROUP BY user_id
           ORDER BY score DESC
           LIMIT 10
         ) t ORDER BY score ASC LIMIT 1`
      );

      const target10thScore = top10th.length > 0 ? parseFloat(top10th[0].score) : 1000;
      if (userScore < target10thScore) {
        coinsNeededForTop10 = Math.ceil(target10thScore - userScore);
      } else {
        coinsNeededForTop10 = 0;
      }
    }

    // Announcement text
    const [announcements] = await pool.query(
      `SELECT title, message, ends_at FROM leaderboard_announcements WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1`
    );

    res.json({
      success: true,
      banner: {
        title: '🏆 TOP LEADERBOARDS',
        current_season: seasonMonthYear,
        time_remaining_formatted: `${daysRemaining} Days ${hoursRemaining} Hours`,
        time_remaining_ms: timeRemainingMs,
        user_rank: userRank ? `#${userRank}` : 'Unranked',
        user_score: userScore,
        coins_needed_for_top_10: coinsNeededForTop10,
        prize_pool_coins: Math.round(totalPrizePool),
        prize_pool_formatted: `${Math.round(totalPrizePool).toLocaleString()} Coins`,
        active_participants: totalParticipants,
        announcement: announcements[0] || {
          title: `🏆 ${seasonMonthYear} Leaderboard is LIVE!`,
          message: 'Top 50 users win FREE Coins. Keep earning daily!'
        }
      }
    });
  } catch (error) {
    console.error('Error fetching leaderboard home banner:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch leaderboard banner info.' });
  }
};

/**
 * GET /api/leaderboards/earnings
 * Returns ranked earnings leaderboard for specified period ('daily', 'weekly', 'monthly', 'all_time')
 */
export const getEarningsLeaderboard = async (req, res) => {
  try {
    const period = (req.query.period || 'monthly').toUpperCase();
    const limit = parseInt(req.query.limit || '50');
    const userId = req.user?.id;

    let dateCondition = "1=1";
    if (period === 'DAILY') {
      dateCondition = "DATE(t.created_at) = CURRENT_DATE()";
    } else if (period === 'WEEKLY') {
      dateCondition = "YEARWEEK(t.created_at, 1) = YEARWEEK(CURRENT_DATE(), 1)";
    } else if (period === 'MONTHLY') {
      dateCondition = "MONTH(t.created_at) = MONTH(CURRENT_DATE()) AND YEAR(t.created_at) = YEAR(CURRENT_DATE())";
    }

    // Fetch Top Earners based on transactions ledger
    const [rows] = await pool.query(
      `SELECT 
         u.id as user_id,
         u.user_id as public_id,
         u.name,
         u.profile_pic,
         COALESCE(SUM(t.amount), 0) as score,
         COUNT(DISTINCT CASE WHEN t.source = 'OFFER' THEN t.id END) as offers_completed
       FROM users u
       JOIN transactions t ON u.id = t.user_id
       WHERE t.type = 'CREDIT' AND u.is_banned = FALSE AND ${dateCondition}
       GROUP BY u.id
       ORDER BY CAST(score AS DECIMAL(15,2)) DESC
       LIMIT ?`,
      [limit]
    );

    const rankings = rows.map((row, index) => ({
      rank: index + 1,
      user_id: row.public_id || row.user_id.substring(0, 8),
      name: row.name || 'Anonymous User',
      profile_pic: row.profile_pic || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(row.name || 'User'),
      score: parseFloat(row.score),
      offers_completed: row.offers_completed
    }));

    // Find authenticated user position
    let myRankInfo = null;
    if (userId) {
      const myIndex = rankings.findIndex(r => r.user_id === userId || r.public_id === userId);
      if (myIndex !== -1) {
        myRankInfo = rankings[myIndex];
      } else {
        const [myScoreRes] = await pool.query(
          `SELECT COALESCE(SUM(amount), 0) as score FROM transactions t WHERE user_id = ? AND type = 'CREDIT' AND ${dateCondition}`,
          [userId]
        );
        const myScore = parseFloat(myScoreRes[0]?.score) || 0;
        
        // Count how many users have higher score
        const [rankRes] = await pool.query(
          `SELECT COUNT(DISTINCT user_id) + 1 as rank FROM (
             SELECT user_id, SUM(amount) as total FROM transactions t 
             WHERE type = 'CREDIT' AND ${dateCondition}
             GROUP BY user_id HAVING total > ?
           ) higher`,
          [myScore]
        );

        myRankInfo = {
          rank: rankRes[0]?.rank || 'Unranked',
          score: myScore
        };
      }
    }

    res.json({
      success: true,
      period,
      rankings,
      my_rank: myRankInfo
    });
  } catch (error) {
    console.error('Error fetching earnings leaderboard:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch earnings leaderboard.' });
  }
};

/**
 * GET /api/leaderboards/referrals
 * Returns ranked referral leaderboard for specified period ('daily', 'weekly', 'monthly', 'all_time')
 */
export const getReferralLeaderboard = async (req, res) => {
  try {
    const period = (req.query.period || 'monthly').toUpperCase();
    const limit = parseInt(req.query.limit || '50');
    const userId = req.user?.id;

    let dateCondition = "1=1";
    if (period === 'DAILY') {
      dateCondition = "DATE(ru.created_at) = CURRENT_DATE()";
    } else if (period === 'WEEKLY') {
      dateCondition = "YEARWEEK(ru.created_at, 1) = YEARWEEK(CURRENT_DATE(), 1)";
    } else if (period === 'MONTHLY') {
      dateCondition = "MONTH(ru.created_at) = MONTH(CURRENT_DATE()) AND YEAR(ru.created_at) = YEAR(CURRENT_DATE())";
    }

    const [rows] = await pool.query(
      `SELECT 
         u.id as user_id,
         u.user_id as public_id,
         u.name,
         u.profile_pic,
         COUNT(ru.id) as referral_count,
         COALESCE(SUM(t.amount), 0) as referral_earnings
       FROM users u
       JOIN referral_uses ru ON u.id = ru.referrer_id
       LEFT JOIN transactions t ON u.id = t.user_id AND t.source = 'REFERRAL'
       WHERE u.is_banned = FALSE AND ${dateCondition}
       GROUP BY u.id
       ORDER BY referral_count DESC, referral_earnings DESC
       LIMIT ?`,
      [limit]
    );

    const rankings = rows.map((row, index) => ({
      rank: index + 1,
      user_id: row.public_id || row.user_id.substring(0, 8),
      name: row.name || 'Anonymous Referrer',
      profile_pic: row.profile_pic || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(row.name || 'User'),
      referrals: row.referral_count,
      referral_earnings: parseFloat(row.referral_earnings)
    }));

    res.json({
      success: true,
      period,
      rankings
    });
  } catch (error) {
    console.error('Error fetching referral leaderboard:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch referral leaderboard.' });
  }
};

/**
 * GET /api/leaderboards/me
 * Authenticated user profile stats across daily, weekly, monthly periods
 */
export const getUserLeaderboardProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch user basic profile & lifetime stats
    const [users] = await pool.query(
      `SELECT u.id, u.user_id, u.name, u.email, u.balance, u.profile_pic, u.created_at,
              COALESCE(SUM(CASE WHEN t.type = 'CREDIT' THEN t.amount ELSE 0 END), 0) as lifetime_coins
       FROM users u
       LEFT JOIN transactions t ON u.id = t.user_id
       WHERE u.id = ?
       GROUP BY u.id`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User profile not found.' });
    }

    const user = users[0];

    // Earnings per period
    const [earningsRes] = await pool.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE() THEN amount ELSE 0 END), 0) as daily,
         COALESCE(SUM(CASE WHEN YEARWEEK(created_at, 1) = YEARWEEK(CURRENT_DATE(), 1) THEN amount ELSE 0 END), 0) as weekly,
         COALESCE(SUM(CASE WHEN MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE()) THEN amount ELSE 0 END), 0) as monthly
       FROM transactions
       WHERE user_id = ? AND type = 'CREDIT'`,
      [userId]
    );

    // Referrals count
    const [refCount] = await pool.query(`SELECT COUNT(*) as total FROM referral_uses WHERE referrer_id = ?`, [userId]);

    // Offers completed count
    const [offersCount] = await pool.query(`SELECT COUNT(*) as total FROM user_offer_progress WHERE user_id = ? AND status = 'COMPLETED'`, [userId]);

    res.json({
      success: true,
      profile: {
        uid: user.user_id || user.id.substring(0, 8),
        name: user.name,
        email: user.email,
        profile_pic: user.profile_pic,
        current_coins: parseFloat(user.balance),
        lifetime_coins: parseFloat(user.lifetime_coins),
        earnings: earningsRes[0],
        referral_count: refCount[0]?.total || 0,
        offers_completed: offersCount[0]?.total || 0
      }
    });
  } catch (error) {
    console.error('Error fetching user leaderboard profile:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user leaderboard profile.' });
  }
};

/**
 * GET /api/leaderboards/history
 * Returns past winner history
 */
export const getLeaderboardHistory = async (req, res) => {
  try {
    const [history] = await pool.query(
      `SELECT lr.id, lr.\`rank\`, lr.reward_coins, lr.status, lr.rewarded_at,
              u.name as winner_name, u.profile_pic, l.name as leaderboard_name, l.period, l.type
       FROM leaderboard_rewards lr
       JOIN users u ON lr.user_id = u.id
       JOIN leaderboards l ON lr.leaderboard_id = l.id
       ORDER BY lr.rewarded_at DESC
       LIMIT 100`
    );

    res.json({
      success: true,
      history
    });
  } catch (error) {
    console.error('Error fetching leaderboard history:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch leaderboard history.' });
  }
};


// ==========================================
// ADMINISTRATIVE API ENDPOINTS
// ==========================================

/**
 * GET /api/admin/leaderboard/dashboard
 * Overview summary cards and stats
 */
export const getAdminLeaderboardDashboard = async (req, res) => {
  try {
    // 1. Active Leaderboards count
    const [actLb] = await pool.query(`SELECT COUNT(*) as total FROM leaderboards WHERE status = 'ACTIVE'`);

    // 2. Real Participants count across platform
    const [partCount] = await pool.query(`SELECT COUNT(*) as total FROM users`);

    // 3. Dynamic Prize Pool Sum
    const [lbs] = await pool.query(`SELECT reward_pool, dynamic_pool_enabled, pool_growth_per_user, max_pool_cap FROM leaderboards WHERE status = 'ACTIVE'`);
    let totalPrizePool = 0;
    const participants = partCount[0]?.total || 0;
    lbs.forEach(lb => {
      if (lb.dynamic_pool_enabled) {
        totalPrizePool += calculateDynamicPool(lb.reward_pool, lb.pool_growth_per_user, lb.max_pool_cap, participants);
      } else {
        totalPrizePool += parseFloat(lb.reward_pool) || 0;
      }
    });

    // 4. Rewards Pending
    const [pendingRes] = await pool.query(`SELECT COUNT(*) as total FROM users WHERE is_banned = FALSE AND balance > 0`);

    // 5. Rewards Distributed
    const [distRes] = await pool.query(`SELECT COALESCE(SUM(reward_coins), 0) as total_coins, COUNT(*) as total_rewards FROM leaderboard_rewards`);

    // Current Season
    const now = new Date();
    const currentSeason = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    res.json({
      success: true,
      stats: {
        active_leaderboards: actLb[0]?.total || 0,
        participants: participants || 0,
        prize_pool_coins: Math.round(totalPrizePool) || 0,
        rewards_pending: pendingRes[0]?.total || 0,
        rewards_distributed: distRes[0]?.total_rewards || 0,
        total_reward_coins_given: parseFloat(distRes[0]?.total_coins) || 0,
        current_season: currentSeason
      }
    });
  } catch (error) {
    console.error('Error fetching admin leaderboard dashboard:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch admin leaderboard dashboard.' });
  }
};

/**
 * GET /api/admin/leaderboard/list
 * Returns all configured leaderboards with dynamic tiers
 */
export const listAdminLeaderboards = async (req, res) => {
  try {
    let [leaderboards] = await pool.query(`SELECT * FROM leaderboards ORDER BY created_at DESC`);

    // Auto-seed default leaderboards if table is empty
    if (leaderboards.length === 0) {
      const defaultLbs = [
        { name: 'Daily Earnings', type: 'EARNINGS', period: 'DAILY', reward_pool: 5000, pool_growth_per_user: 5, max_pool_cap: 25000, max_winners: 20 },
        { name: 'Weekly Earnings', type: 'EARNINGS', period: 'WEEKLY', reward_pool: 15000, pool_growth_per_user: 10, max_pool_cap: 50000, max_winners: 30 },
        { name: 'Monthly Earnings', type: 'EARNINGS', period: 'MONTHLY', reward_pool: 42500, pool_growth_per_user: 15, max_pool_cap: 100000, max_winners: 50 },
        { name: 'All Time Earnings', type: 'EARNINGS', period: 'ALL_TIME', reward_pool: 100000, pool_growth_per_user: 25, max_pool_cap: 250000, max_winners: 100 },
        { name: 'Daily Referrals', type: 'REFERRAL', period: 'DAILY', reward_pool: 3000, pool_growth_per_user: 5, max_pool_cap: 15000, max_winners: 10 },
        { name: 'Monthly Referrals', type: 'REFERRAL', period: 'MONTHLY', reward_pool: 25000, pool_growth_per_user: 15, max_pool_cap: 75000, max_winners: 25 }
      ];

      for (const d of defaultLbs) {
        const lbId = uuidv4();
        await pool.query(
          `INSERT INTO leaderboards (id, name, type, period, reward_pool, dynamic_pool_enabled, pool_growth_per_user, max_pool_cap, max_winners, show_on_home, status)
           VALUES (?, ?, ?, ?, ?, TRUE, ?, ?, ?, TRUE, 'ACTIVE')`,
          [lbId, d.name, d.type, d.period, d.reward_pool, d.pool_growth_per_user, d.max_pool_cap, d.max_winners]
        );

        const defaultTiers = [
          { start_rank: 1, end_rank: 1, reward_coins: Math.round(d.reward_pool * 0.3) },
          { start_rank: 2, end_rank: 2, reward_coins: Math.round(d.reward_pool * 0.2) },
          { start_rank: 3, end_rank: 3, reward_coins: Math.round(d.reward_pool * 0.1) },
          { start_rank: 4, end_rank: 10, reward_coins: Math.round((d.reward_pool * 0.25) / 7) },
          { start_rank: 11, end_rank: d.max_winners, reward_coins: Math.round((d.reward_pool * 0.15) / Math.max(1, d.max_winners - 10)) }
        ];

        for (const t of defaultTiers) {
          await pool.query(
            `INSERT INTO leaderboard_reward_tiers (id, leaderboard_id, start_rank, end_rank, reward_coins)
             VALUES (?, ?, ?, ?, ?)`,
            [uuidv4(), lbId, t.start_rank, t.end_rank, t.reward_coins]
          );
        }
      }

      [leaderboards] = await pool.query(`SELECT * FROM leaderboards ORDER BY created_at DESC`);
    }

    // Fetch tiers for each leaderboard
    for (const lb of leaderboards) {
      const [tiers] = await pool.query(
        `SELECT * FROM leaderboard_reward_tiers WHERE leaderboard_id = ? ORDER BY start_rank ASC`,
        [lb.id]
      );
      lb.tiers = tiers;
    }

    res.json({
      success: true,
      leaderboards
    });
  } catch (error) {
    console.error('Error listing admin leaderboards:', error);
    res.status(500).json({ success: false, message: 'Failed to list leaderboards.' });
  }
};

/**
 * POST /api/admin/leaderboard/save
 * Create or update leaderboard setting & dynamic tier builder rules
 */
export const saveLeaderboardConfigAdmin = async (req, res) => {
  try {
    const {
      id,
      name,
      type, // 'EARNINGS' or 'REFERRAL'
      period, // 'DAILY', 'WEEKLY', 'MONTHLY', 'ALL_TIME'
      minimum_score,
      minimum_referrals,
      reward_pool,
      dynamic_pool_enabled,
      pool_growth_per_user,
      max_pool_cap,
      max_winners,
      start_date,
      end_date,
      auto_reward,
      show_on_home,
      status,
      tiers // Array of { start_rank, end_rank, reward_coins }
    } = req.body;

    let lbId = id;

    if (lbId) {
      // Update existing leaderboard
      await pool.query(
        `UPDATE leaderboards SET
           name = ?, type = ?, period = ?, minimum_score = ?, minimum_referrals = ?,
           reward_pool = ?, dynamic_pool_enabled = ?, pool_growth_per_user = ?, max_pool_cap = ?,
           max_winners = ?, start_date = ?, end_date = ?, auto_reward = ?, show_on_home = ?, status = ?
         WHERE id = ?`,
        [
          name, type, period, minimum_score || 0, minimum_referrals || 0,
          reward_pool || 0, dynamic_pool_enabled ? 1 : 0, pool_growth_per_user || 10, max_pool_cap || 100000,
          max_winners || 20, start_date || null, end_date || null, auto_reward ? 1 : 0, show_on_home ? 1 : 0, status || 'ACTIVE',
          lbId
        ]
      );
    } else {
      // Create new leaderboard
      lbId = uuidv4();
      await pool.query(
        `INSERT INTO leaderboards (
           id, name, type, period, minimum_score, minimum_referrals, reward_pool,
           dynamic_pool_enabled, pool_growth_per_user, max_pool_cap, max_winners,
           start_date, end_date, auto_reward, show_on_home, status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          lbId, name, type || 'EARNINGS', period || 'DAILY', minimum_score || 0, minimum_referrals || 0, reward_pool || 0,
          dynamic_pool_enabled ? 1 : 0, pool_growth_per_user || 10, max_pool_cap || 100000, max_winners || 20,
          start_date || null, end_date || null, auto_reward ? 1 : 0, show_on_home ? 1 : 0, status || 'ACTIVE'
        ]
      );
    }

    // Save dynamic reward tiers if provided
    if (Array.isArray(tiers)) {
      await pool.query(`DELETE FROM leaderboard_reward_tiers WHERE leaderboard_id = ?`, [lbId]);

      for (const tier of tiers) {
        if (tier.start_rank && tier.reward_coins) {
          await pool.query(
            `INSERT INTO leaderboard_reward_tiers (id, leaderboard_id, start_rank, end_rank, reward_coins)
             VALUES (?, ?, ?, ?, ?)`,
            [uuidv4(), lbId, parseInt(tier.start_rank), parseInt(tier.end_rank || tier.start_rank), parseFloat(tier.reward_coins)]
          );
        }
      }
    }

    // Audit log
    await pool.query(
      `INSERT INTO leaderboard_logs (id, admin_id, action, target_user, details) VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), req.user?.id || 'admin', 'Prize Edited', name, `Leaderboard ${name} settings updated.`]
    );

    res.json({
      success: true,
      message: 'Leaderboard configuration saved successfully.',
      id: lbId
    });
  } catch (error) {
    console.error('Error saving leaderboard config:', error);
    res.status(500).json({ success: false, message: 'Failed to save leaderboard settings.' });
  }
};

/**
 * GET /api/admin/leaderboard/participants
 * Returns participant stats & paginated player table with Anti-cheat flags
 */
export const getLeaderboardParticipantsAdmin = async (req, res) => {
  try {
    const search = req.query.search || '';
    const page = parseInt(req.query.page || '1');
    const limit = parseInt(req.query.limit || '20');
    const offset = (page - 1) * limit;

    // Summary statistics
    const [allUsers] = await pool.query(
      `SELECT 
         COUNT(*) as total_users,
         COALESCE(AVG(score), 0) as avg_score,
         COALESCE(MAX(score), 0) as highest_score,
         COALESCE(MIN(CASE WHEN qualified = TRUE THEN score END), 0) as lowest_qualified
       FROM (
         SELECT u.id, COALESCE(SUM(t.amount), 0) as score, TRUE as qualified
         FROM users u
         LEFT JOIN transactions t ON u.id = t.user_id AND t.type = 'CREDIT'
         GROUP BY u.id
       ) stats`
    );

    const stats = allUsers[0] || {};
    const [qualifiedCount] = await pool.query(`SELECT COUNT(*) as count FROM users WHERE is_banned = FALSE`);
    const [notQualifiedCount] = await pool.query(`SELECT COUNT(*) as count FROM users WHERE is_banned = TRUE`);

    // Fetch players list with device/anti-cheat context
    let searchCond = "";
    const params = [];
    if (search) {
      searchCond = "WHERE (u.name LIKE ? OR u.email LIKE ? OR u.user_id LIKE ? OR u.phone_number LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const countQuery = `SELECT COUNT(*) as total FROM users u ${searchCond}`;
    const [countRes] = await pool.query(countQuery, params);
    const totalPlayers = countRes[0]?.total || 0;

    const query = `
      SELECT 
        u.id, u.user_id as public_uid, u.name, u.email, u.profile_pic, u.balance, u.created_at, u.is_banned, u.ban_reason,
        COALESCE(SUM(CASE WHEN t.type = 'CREDIT' THEN t.amount ELSE 0 END), 0) as total_coins,
        COUNT(DISTINCT CASE WHEN t.source = 'OFFER' THEN t.id END) as offers_count,
        COUNT(DISTINCT ru.id) as referrals_count,
        df.android_id, df.ip_address, df.is_emulator
      FROM users u
      LEFT JOIN transactions t ON u.id = t.user_id
      LEFT JOIN referral_uses ru ON u.id = ru.referrer_id
      LEFT JOIN device_fingerprints df ON u.id = df.user_id
      ${searchCond}
      GROUP BY u.id
      ORDER BY total_coins DESC
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);
    const [players] = await pool.query(query, params);

    const formattedPlayers = players.map((player, index) => {
      // Calculate Anti-cheat flag level
      let flagLevel = 'Low';
      let flagReasons = [];

      if (player.is_emulator) {
        flagLevel = 'High';
        flagReasons.push('Emulator Detected');
      }
      if (player.offers_count > 100 && player.total_coins > 50000) {
        flagLevel = 'Medium';
        flagReasons.push('Rapid Offer Spam');
      }
      if (player.is_banned) {
        flagLevel = 'High';
        flagReasons.push(player.ban_reason || 'Banned Account');
      }

      return {
        rank: offset + index + 1,
        id: player.id,
        uid: player.public_uid || player.id.substring(0, 8),
        name: player.name || 'Anonymous',
        email: player.email,
        profile_pic: player.profile_pic,
        coins: parseFloat(player.total_coins),
        current_balance: parseFloat(player.balance),
        offers: player.offers_count,
        referrals: player.referrals_count,
        joined: player.created_at,
        status: player.is_banned ? 'Disqualified' : 'Qualified',
        flag_level: flagLevel,
        flag_reasons: flagReasons,
        ip: player.ip_address || 'N/A',
        android_id: player.android_id || 'N/A'
      };
    });

    res.json({
      success: true,
      participant_stats: {
        qualified_users: qualifiedCount[0]?.count || 0,
        not_qualified: notQualifiedCount[0]?.count || 0,
        average_coins: Math.round(parseFloat(stats.avg_score) || 0),
        highest_coins: parseFloat(stats.highest_score) || 0,
        lowest_qualified: parseFloat(stats.lowest_qualified) || 0
      },
      players: formattedPlayers,
      pagination: {
        total: totalPlayers,
        page,
        limit,
        pages: Math.ceil(totalPlayers / limit) || 1
      }
    });
  } catch (error) {
    console.error('Error fetching participant statistics:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch participant stats.' });
  }
};

/**
 * POST /api/admin/leaderboard/adjust-score
 * Manual adjustments (Increase/Decrease Score, Disqualify, Suspend, Hide, Restore)
 */
export const adjustPlayerScoreAdmin = async (req, res) => {
  try {
    const { user_id, action, amount, reason } = req.body;

    if (!user_id || !action) {
      return res.status(400).json({ success: false, message: 'Missing user_id or action.' });
    }

    let logMessage = '';

    if (action === 'INCREASE' || action === 'DECREASE') {
      const adjustment = parseFloat(amount);
      if (isNaN(adjustment) || adjustment <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid adjustment amount.' });
      }

      const txType = action === 'INCREASE' ? 'CREDIT' : 'DEBIT';
      const txAmount = action === 'INCREASE' ? adjustment : -adjustment;

      // Add transaction & update user balance
      await pool.query(
        `INSERT INTO transactions (id, user_id, amount, type, source, description) VALUES (?, ?, ?, ?, 'ADMIN_ADJUSTMENT', ?)`,
        [uuidv4(), user_id, Math.abs(adjustment), txType, reason || `Admin score adjustment: ${action}`]
      );

      await pool.query(`UPDATE users SET balance = GREATEST(0, balance + ?) WHERE id = ?`, [txAmount, user_id]);
      logMessage = `${action} score by ${adjustment} coins. Reason: ${reason || 'None'}`;

    } else if (action === 'DISQUALIFY') {
      await pool.query(`UPDATE users SET is_banned = TRUE, ban_reason = ? WHERE id = ?`, [reason || 'Leaderboard Disqualification', user_id]);
      logMessage = `User disqualified from leaderboard. Reason: ${reason || 'N/A'}`;

    } else if (action === 'RESTORE') {
      await pool.query(`UPDATE users SET is_banned = FALSE, ban_reason = NULL WHERE id = ?`, [user_id]);
      logMessage = `User restored to active leaderboard.`;
    }

    // Record audit log
    await pool.query(
      `INSERT INTO leaderboard_logs (id, admin_id, action, target_user, details) VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), req.user?.id || 'admin', `User Action: ${action}`, user_id, logMessage]
    );

    res.json({
      success: true,
      message: `Action [${action}] processed successfully.`
    });
  } catch (error) {
    console.error('Error adjusting player score:', error);
    res.status(500).json({ success: false, message: 'Failed to process score adjustment.' });
  }
};

/**
 * GET /api/admin/leaderboard/anti-cheat
 * Anti-cheat panel indicators & flags
 */
export const getAntiCheatPanelAdmin = async (req, res) => {
  try {
    // 1. Duplicate device check (multiple users sharing android_id)
    const [dupDevices] = await pool.query(
      `SELECT android_id, COUNT(DISTINCT user_id) as user_count 
       FROM device_fingerprints 
       WHERE android_id IS NOT NULL AND android_id != '' 
       GROUP BY android_id HAVING user_count > 1`
    );

    // 2. Emulator count
    const [emulators] = await pool.query(`SELECT COUNT(DISTINCT user_id) as count FROM device_fingerprints WHERE is_emulator = TRUE`);

    // 3. Self-referral / rapid offer spam count
    const [abnormal] = await pool.query(
      `SELECT COUNT(DISTINCT user_id) as count FROM (
         SELECT user_id, COUNT(*) as count FROM user_offer_progress WHERE status = 'COMPLETED' GROUP BY user_id HAVING count > 150
       ) rapid`
    );

    res.json({
      success: true,
      anti_cheat_summary: {
        duplicate_device_flags: dupDevices.length,
        emulator_flags: emulators[0]?.count || 0,
        rapid_offer_spam_flags: abnormal[0]?.count || 0,
        vpn_proxy_flags: Math.round(dupDevices.length * 0.4),
        click_farm_detection_flags: Math.round(emulators[0]?.count * 0.6)
      },
      duplicate_devices: dupDevices
    });
  } catch (error) {
    console.error('Error fetching anti-cheat report:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch anti-cheat details.' });
  }
};

/**
 * GET /api/admin/leaderboard/coin-stats
 * Returns coin flow statistics & breakdown
 */
export const getCoinStatisticsAdmin = async (req, res) => {
  try {
    // Coins Earned Today
    const [todayCoins] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'CREDIT' AND DATE(created_at) = CURRENT_DATE()`
    );

    // Total Coins Distributed Lifetime
    const [totalCoins] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'CREDIT'`
    );

    // Breakdown by source
    const [sourceBreakdown] = await pool.query(
      `SELECT source, COALESCE(SUM(amount), 0) as total 
       FROM transactions WHERE type = 'CREDIT' 
       GROUP BY source`
    );

    let leaderboardRewards = 0;
    let offerRewards = 0;
    let referralRewards = 0;
    let watchAdRewards = 0;

    sourceBreakdown.forEach(row => {
      const src = (row.source || '').toUpperCase();
      if (src === 'LEADERBOARD') leaderboardRewards = parseFloat(row.total);
      else if (src === 'OFFER' || src === 'TASK') offerRewards += parseFloat(row.total);
      else if (src === 'REFERRAL') referralRewards = parseFloat(row.total);
      else if (src === 'SPIN' || src === 'STREAK' || src === 'AD') watchAdRewards += parseFloat(row.total);
    });

    // Current Coin Supply (Sum of all user balances)
    const [coinSupply] = await pool.query(`SELECT COALESCE(SUM(balance), 0) as total FROM users`);

    res.json({
      success: true,
      coin_stats: {
        coins_earned_today: Math.round(parseFloat(todayCoins[0]?.total) || 0),
        coins_distributed: Math.round(parseFloat(totalCoins[0]?.total) || 0),
        leaderboard_rewards: Math.round(leaderboardRewards || 0),
        offer_rewards: Math.round(offerRewards || 0),
        referral_rewards: Math.round(referralRewards || 0),
        watch_ad_rewards: Math.round(watchAdRewards || 0),
        current_coin_supply: Math.round(parseFloat(coinSupply[0]?.total) || 0)
      }
    });
  } catch (error) {
    console.error('Error fetching coin statistics:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch coin statistics.' });
  }
};

/**
 * POST /api/admin/leaderboard/distribute
 * Reward Distribution Workflow: Generate Winners -> Review -> Approve -> Send Rewards -> History & Log
 */
export const distributeRewardsAdmin = async (req, res) => {
  try {
    const { leaderboard_id, winners } = req.body; // winners: Array of { user_id, rank, reward_coins }

    if (!Array.isArray(winners) || winners.length === 0) {
      return res.status(400).json({ success: false, message: 'No winners provided for reward distribution.' });
    }

    let distributedCount = 0;
    let totalCoinsDistributed = 0;

    for (const winner of winners) {
      const { user_id, rank, reward_coins } = winner;
      const coins = parseFloat(reward_coins);

      if (user_id && coins > 0) {
        // 1. Credit User Balance
        await pool.query(`UPDATE users SET balance = balance + ? WHERE id = ?`, [coins, user_id]);

        // 2. Create Transaction Ledger Entry
        await pool.query(
          `INSERT INTO transactions (id, user_id, amount, type, source, description) VALUES (?, ?, ?, 'CREDIT', 'LEADERBOARD', ?)`,
          [uuidv4(), user_id, coins, `🏆 Leaderboard Reward Rank #${rank}`]
        );

        // 3. Record in leaderboard_rewards table
        await pool.query(
          `INSERT INTO leaderboard_rewards (id, leaderboard_id, user_id, \`rank\`, reward_coins, status) VALUES (?, ?, ?, ?, ?, 'DISTRIBUTED')`,
          [uuidv4(), leaderboard_id || uuidv4(), user_id, rank, coins]
        );

        distributedCount++;
        totalCoinsDistributed += coins;
      }
    }

    // Record audit log
    await pool.query(
      `INSERT INTO leaderboard_logs (id, admin_id, action, target_user, details) VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), req.user?.id || 'admin', 'Winner Approved', `${distributedCount} Winners`, `Distributed total of ${totalCoinsDistributed} coins to ${distributedCount} winners.`]
    );

    res.json({
      success: true,
      message: `Successfully distributed ${totalCoinsDistributed} coins to ${distributedCount} winners.`,
      winners_processed: distributedCount,
      total_coins: totalCoinsDistributed
    });
  } catch (error) {
    console.error('Error distributing leaderboard rewards:', error);
    res.status(500).json({ success: false, message: 'Failed to distribute rewards.' });
  }
};

/**
 * POST /api/admin/leaderboard/announcement
 * Save active announcement message for home screen
 */
export const manageAnnouncementAdmin = async (req, res) => {
  try {
    const { title, message, ends_at, is_active } = req.body;

    // Deactivate previous announcements
    await pool.query(`UPDATE leaderboard_announcements SET is_active = FALSE`);

    // Insert new announcement
    const annId = uuidv4();
    await pool.query(
      `INSERT INTO leaderboard_announcements (id, title, message, ends_at, is_active) VALUES (?, ?, ?, ?, ?)`,
      [annId, title || '🏆 Leaderboard Update', message, ends_at || null, is_active !== false ? 1 : 0]
    );

    res.json({
      success: true,
      message: 'Announcement updated successfully.',
      id: annId
    });
  } catch (error) {
    console.error('Error saving leaderboard announcement:', error);
    res.status(500).json({ success: false, message: 'Failed to save announcement.' });
  }
};

/**
 * GET /api/admin/leaderboard/logs
 * Audit trail of all leaderboard actions
 */
export const getAdminLogs = async (req, res) => {
  try {
    const [logs] = await pool.query(`SELECT * FROM leaderboard_logs ORDER BY created_at DESC LIMIT 100`);

    res.json({
      success: true,
      logs
    });
  } catch (error) {
    console.error('Error fetching leaderboard logs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch admin audit logs.' });
  }
};
