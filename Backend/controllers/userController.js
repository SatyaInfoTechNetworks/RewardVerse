import pool from '../db.js';
import { v4 as uuidv4 } from 'uuid';

// Helper: Seed-based deterministic random generator
function getSeededRandom(seedStr) {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  const seed = Math.abs(hash);
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Helper: Seed-based random range
function getSeededRange(min, max, seedStr) {
  const rand = getSeededRandom(seedStr);
  return Math.floor(rand * (max - min + 1)) + min;
}

// Helper: Get Config Value from DB
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

// ----------------------------------------------------
// USER PROFILE & STATS
// ----------------------------------------------------

export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = rows[0];

    // Query stats in parallel for high performance
    const [
      [earningsRow],
      [withdrawnRow],
      [completedRow],
      [referralsRow]
    ] = await Promise.all([
      pool.query('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = "CREDIT"', [userId]),
      pool.query('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = "DEBIT" AND source = "WITHDRAWAL"', [userId]),
      pool.query('SELECT COUNT(*) as count FROM user_offer_progress WHERE user_id = ? AND status = "COMPLETED"', [userId]),
      pool.query('SELECT COUNT(*) as count FROM referral_uses WHERE referrer_id = ?', [userId])
    ]);

    user.stats = {
      totalEarnings: parseFloat(earningsRow[0].total || 0),
      totalWithdrawn: parseFloat(withdrawnRow[0].total || 0),
      completedOffers: parseInt(completedRow[0].count || 0),
      totalReferrals: parseInt(referralsRow[0].count || 0)
    };

    res.json({ success: true, user });
  } catch (error) {
    console.error('Get Profile Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getUserStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Total Earned
    const [earnedRows] = await pool.query(
      'SELECT SUM(amount) as total FROM transactions WHERE user_id = ? AND type = "CREDIT"',
      [userId]
    );

    // 2. Total Withdrawn
    const [withdrawnRows] = await pool.query(
      `SELECT SUM(amount) as total FROM transactions 
       WHERE user_id = ? AND type = "DEBIT" AND source = "WITHDRAWAL"`,
      [userId]
    );

    res.json({
      success: true,
      stats: {
        total_earned: parseFloat(earnedRows[0].total || 0),
        total_withdrawn: parseFloat(withdrawnRows[0].total || 0)
      }
    });
  } catch (error) {
    console.error('Get Stats Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateFcmToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fcm_token } = req.body;

    if (!fcm_token) {
      return res.status(400).json({ success: false, message: 'FCM Token required' });
    }

    await pool.query('UPDATE users SET fcm_token = ? WHERE id = ?', [fcm_token, userId]);

    res.json({ success: true, message: 'FCM token updated successfully' });
  } catch (error) {
    console.error('Update FCM Token Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ----------------------------------------------------
// DAILY STREAK (CHECK-IN)
// ----------------------------------------------------

export const getStreakStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const [rows] = await pool.query('SELECT * FROM streaks WHERE user_id = ? LIMIT 1', [userId]);
    const configStr = await getConfig('streak_rewards', JSON.stringify({ 1: 30, 2: 40, 3: 50, 4: 60, 5: 70, 6: 80, 7: 200 }));
    const rewardsConfig = JSON.parse(configStr);

    if (rows.length > 0) {
      const streakRecord = rows[0];
      let lastDate = '';
      if (streakRecord.last_claim_date) {
        lastDate = new Date(streakRecord.last_claim_date).toISOString().split('T')[0];
      }
      const currentStreak = parseInt(streakRecord.current_streak || 0);
      const canClaim = lastDate !== today;

      // Check if streak is broken
      let displayStreak = currentStreak;
      if (lastDate !== today && lastDate !== yesterday) {
        displayStreak = 0;
      }

      const nextDay = (displayStreak % 7) + 1;
      const nextReward = rewardsConfig[nextDay] || 30;

      res.json({
        success: true,
        data: {
          current_streak: displayStreak,
          last_claim_date: lastDate,
          can_claim: canClaim,
          next_reward: nextReward,
          rewards_config: rewardsConfig
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          current_streak: 0,
          last_claim_date: null,
          can_claim: true,
          next_reward: rewardsConfig[1] || 30,
          rewards_config: rewardsConfig
        }
      });
    }
  } catch (error) {
    console.error('Get Streak Status Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const dailyCheckIn = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Load configs
    const configStr = await getConfig('streak_rewards', JSON.stringify({ 1: 30, 2: 40, 3: 50, 4: 60, 5: 70, 6: 80, 7: 200 }));
    const rewardsConfig = JSON.parse(configStr);

    // Get current status
    const [rows] = await connection.query('SELECT * FROM streaks WHERE user_id = ? LIMIT 1', [userId]);
    let currentStreak = 0;
    let lastDate = '';
    let isNewRecord = true;

    if (rows.length > 0) {
      isNewRecord = false;
      const record = rows[0];
      currentStreak = parseInt(record.current_streak || 0);
      if (record.last_claim_date) {
        lastDate = new Date(record.last_claim_date).toISOString().split('T')[0];
      }
    }

    if (lastDate === today) {
      return res.json({ success: false, message: 'Already claimed today.' });
    }

    let newStreak = 1;
    if (lastDate === yesterday) {
      newStreak = (currentStreak % 7) + 1;
    }

    const rewardAmount = parseFloat(rewardsConfig[newStreak] || 30);

    // Begin database transaction for atomic ledger operations
    await connection.beginTransaction();

    if (isNewRecord) {
      await connection.query(
        'INSERT INTO streaks (user_id, current_streak, last_claim_date, total_claims) VALUES (?, ?, ?, 1)',
        [userId, newStreak, today]
      );
    } else {
      await connection.query(
        'UPDATE streaks SET current_streak = ?, last_claim_date = ?, total_claims = total_claims + 1 WHERE user_id = ?',
        [newStreak, today, userId]
      );
    }

    // Insert CREDIT transaction
    const transId = uuidv4();
    await connection.query(
      `INSERT INTO transactions (id, user_id, amount, type, source, description, created_at) 
       VALUES (?, ?, ?, "CREDIT", "STREAK_REWARD", ?, NOW())`,
      [transId, userId, rewardAmount, `Day ${newStreak} Streak Reward`]
    );

    // Update User Balance
    await connection.query(
      'UPDATE users SET balance = balance + ?, last_streak_claim_date = ?, current_streak = ? WHERE id = ?',
      [rewardAmount, today, newStreak, userId]
    );

    await connection.commit();

    res.json({
      success: true,
      message: 'Streak claimed!',
      claimed_amount: rewardAmount,
      new_streak: newStreak
    });
  } catch (error) {
    await connection.rollback();
    console.error('Daily Check-in Error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  } finally {
    connection.release();
  }
};

// ----------------------------------------------------
// LUCKY SPIN
// ----------------------------------------------------

export const getSpinStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const [rows] = await pool.query('SELECT * FROM lucky_spins WHERE user_id = ? LIMIT 1', [userId]);
    const dailyLimit = parseInt(await getConfig('spin_daily_limit', '2'));
    const probStr = await getConfig('spin_probabilities', '[]');
    const probabilitiesConfig = JSON.parse(probStr);

    if (rows.length > 0) {
      const record = rows[0];
      const lastSpinDate = record.last_spin_date ? new Date(record.last_spin_date).toISOString().split('T')[0] : '';

      if (lastSpinDate !== today) {
        // Reset spins for a new day
        await pool.query('UPDATE lucky_spins SET spins_left = ?, last_spin_date = ? WHERE user_id = ?', [dailyLimit, today, userId]);
        return res.json({
          success: true,
          data: {
            spins_left: dailyLimit,
            daily_limit: dailyLimit,
            total_spins: parseInt(record.total_spins || 0),
            probabilities_config: probabilitiesConfig
          }
        });
      }

      res.json({
        success: true,
        data: {
          spins_left: parseInt(record.spins_left || 0),
          daily_limit: dailyLimit,
          total_spins: parseInt(record.total_spins || 0),
          probabilities_config: probabilitiesConfig
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          spins_left: dailyLimit,
          daily_limit: dailyLimit,
          total_spins: 0,
          probabilities_config: probabilitiesConfig
        }
      });
    }
  } catch (error) {
    console.error('Get Spin Status Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const performSpin = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    // Load configs
    const dailyLimit = parseInt(await getConfig('spin_daily_limit', '2'));
    const probStr = await getConfig('spin_probabilities', '[]');
    const probabilities = JSON.parse(probStr);

    // Get spin status
    const [rows] = await connection.query('SELECT * FROM lucky_spins WHERE user_id = ? LIMIT 1', [userId]);
    let spinsLeft = dailyLimit;
    let totalSpins = 0;
    let lastSpinDate = '';
    let isNewRecord = true;

    if (rows.length > 0) {
      isNewRecord = false;
      const record = rows[0];
      totalSpins = parseInt(record.total_spins || 0);
      lastSpinDate = record.last_spin_date ? new Date(record.last_spin_date).toISOString().split('T')[0] : '';
      spinsLeft = lastSpinDate !== today ? dailyLimit : parseInt(record.spins_left || 0);
    }

    if (spinsLeft <= 0) {
      return res.json({ success: false, message: 'No spins left for today! Try again tomorrow.' });
    }

    // Weighted random logic
    const rand = Math.floor(Math.random() * 100) + 1; // 1-100
    let cumulative = 0;
    let type = 'NONE';
    let minRange = 0;
    let maxRange = 0;

    for (const p of probabilities) {
      cumulative += p.prob;
      if (rand <= cumulative) {
        type = p.type;
        minRange = p.range[0];
        maxRange = p.range[1];
        break;
      }
    }

    // Generate random amount within category range
    const rewardAmount = Math.floor(Math.random() * (maxRange - minRange + 1)) + minRange;

    // Begin Transaction
    await connection.beginTransaction();

    const newSpinsLeft = spinsLeft - 1;

    if (isNewRecord) {
      await connection.query(
        'INSERT INTO lucky_spins (user_id, spins_left, last_spin_date, total_spins) VALUES (?, ?, ?, 1)',
        [userId, newSpinsLeft, today]
      );
    } else {
      await connection.query(
        'UPDATE lucky_spins SET spins_left = ?, last_spin_date = ?, total_spins = total_spins + 1 WHERE user_id = ?',
        [newSpinsLeft, today, userId]
      );
    }

    if (rewardAmount > 0) {
      // Insert transaction
      const transId = uuidv4();
      await connection.query(
        `INSERT INTO transactions (id, user_id, amount, type, source, description, created_at) 
         VALUES (?, ?, ?, "CREDIT", "LUCKY_SPIN", ?, NOW())`,
        [transId, userId, rewardAmount, `Won ${rewardAmount} coins from Lucky Spin`]
      );

      // Update balance
      await connection.query(
        'UPDATE users SET balance = balance + ?, daily_spins_count = daily_spins_count + 1, last_spin_date = ? WHERE id = ?',
        [rewardAmount, today, userId]
      );
    } else {
      await connection.query(
        'UPDATE users SET daily_spins_count = daily_spins_count + 1, last_spin_date = ? WHERE id = ?',
        [today, userId]
      );
    }

    await connection.commit();

    res.json({
      success: true,
      amount: rewardAmount,
      type: type,
      spins_left: newSpinsLeft,
      message: rewardAmount > 0 ? `You won ${rewardAmount} coins!` : 'Better luck next time!'
    });
  } catch (error) {
    await connection.rollback();
    console.error('Perform Spin Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    connection.release();
  }
};

// ----------------------------------------------------
// SCRATCH CARD
// ----------------------------------------------------

export const getScratchStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const dailyLimit = parseInt(await getConfig('scratch_card_daily_limit', '5'));
    const rewardMin = parseInt(await getConfig('scratch_card_reward_min', '5'));
    const rewardMax = parseInt(await getConfig('scratch_card_reward_max', '20'));

    // Count scratches today
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as count FROM transactions 
       WHERE user_id = ? AND source = "SCRATCH_CARD" AND DATE(created_at) = ?`,
      [userId, today]
    );

    const scratchesToday = countRows[0].count || 0;
    const scratchesLeft = Math.max(0, dailyLimit - scratchesToday);

    // Seed-based deterministic next reward
    const seedStr = `${userId}${today}${scratchesToday}`;
    const nextReward = getSeededRange(rewardMin, rewardMax, seedStr);

    res.json({
      success: true,
      data: {
        scratches_left: scratchesLeft,
        daily_limit: dailyLimit,
        scratches_today: scratchesToday,
        reward_min: rewardMin,
        reward_max: rewardMax,
        current_reward: nextReward
      }
    });
  } catch (error) {
    console.error('Get Scratch Status Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const performScratch = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const dailyLimit = parseInt(await getConfig('scratch_card_daily_limit', '5'));
    const rewardMin = parseInt(await getConfig('scratch_card_reward_min', '5'));
    const rewardMax = parseInt(await getConfig('scratch_card_reward_max', '20'));

    // Count scratches today
    const [countRows] = await connection.query(
      `SELECT COUNT(*) as count FROM transactions 
       WHERE user_id = ? AND source = "SCRATCH_CARD" AND DATE(created_at) = ?`,
      [userId, today]
    );

    const scratchesToday = countRows[0].count || 0;
    const scratchesLeft = Math.max(0, dailyLimit - scratchesToday);

    if (scratchesLeft <= 0) {
      return res.status(400).json({ success: false, message: 'No scratches left for today! Try again tomorrow.' });
    }

    // Seed-based deterministic reward
    const seedStr = `${userId}${today}${scratchesToday}`;
    const rewardAmount = getSeededRange(rewardMin, rewardMax, seedStr);

    // Begin Transaction
    await connection.beginTransaction();

    const transId = uuidv4();
    const description = rewardAmount > 0 ? `Won ${rewardAmount} coins from Scratch Card` : 'Scratched card (No reward)';
    await connection.query(
      `INSERT INTO transactions (id, user_id, amount, type, source, description, created_at) 
       VALUES (?, ?, ?, "CREDIT", "SCRATCH_CARD", ?, NOW())`,
      [transId, userId, rewardAmount, description]
    );

    if (rewardAmount > 0) {
      await connection.query('UPDATE users SET balance = balance + ? WHERE id = ?', [rewardAmount, userId]);
    }

    await connection.commit();

    res.json({
      success: true,
      amount: rewardAmount,
      type: rewardAmount > 0 ? 'REWARD' : 'NO_REWARD',
      scratches_left: scratchesLeft - 1,
      message: rewardAmount > 0 ? 'Reward Claimed Successfully' : 'Better luck next time!'
    });
  } catch (error) {
    await connection.rollback();
    console.error('Perform Scratch Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    connection.release();
  }
};

// ----------------------------------------------------
// WATCH VIDEO ADS
// ----------------------------------------------------

export const getVideoAdStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const dailyLimit = parseInt(await getConfig('watch_video_daily_limit', '5'));
    const rewardMin = parseInt(await getConfig('watch_video_reward_min', '5'));
    const rewardMax = parseInt(await getConfig('watch_video_reward_max', '10'));

    // Count views today
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as count FROM transactions 
       WHERE user_id = ? AND source = "WATCH_VIDEO" AND DATE(created_at) = ?`,
      [userId, today]
    );

    const viewsToday = countRows[0].count || 0;
    const viewsLeft = Math.max(0, dailyLimit - viewsToday);

    const seedStr = `${userId}${today}${viewsToday}`;
    const nextReward = getSeededRange(rewardMin, rewardMax, seedStr);

    res.json({
      success: true,
      data: {
        views_left: viewsLeft,
        daily_limit: dailyLimit,
        views_today: viewsToday,
        reward_min: rewardMin,
        reward_max: rewardMax,
        current_reward: nextReward
      }
    });
  } catch (error) {
    console.error('Get Video Ad Status Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const claimVideoAdReward = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const dailyLimit = parseInt(await getConfig('watch_video_daily_limit', '5'));
    const rewardMin = parseInt(await getConfig('watch_video_reward_min', '5'));
    const rewardMax = parseInt(await getConfig('watch_video_reward_max', '10'));

    // Count views today
    const [countRows] = await connection.query(
      `SELECT COUNT(*) as count FROM transactions 
       WHERE user_id = ? AND source = "WATCH_VIDEO" AND DATE(created_at) = ?`,
      [userId, today]
    );

    const viewsToday = countRows[0].count || 0;
    const viewsLeft = Math.max(0, dailyLimit - viewsToday);

    if (viewsLeft <= 0) {
      return res.status(400).json({ success: false, message: 'Daily limit reached. Try again tomorrow!' });
    }

    const seedStr = `${userId}${today}${viewsToday}`;
    const rewardAmount = getSeededRange(rewardMin, rewardMax, seedStr);

    // Begin Transaction
    await connection.beginTransaction();

    const transId = uuidv4();
    const description = rewardAmount > 0 ? `Won ${rewardAmount} coins from Watching a Video` : 'Watched video (No reward configured)';
    await connection.query(
      `INSERT INTO transactions (id, user_id, amount, type, source, description, created_at) 
       VALUES (?, ?, ?, "CREDIT", "WATCH_VIDEO", ?, NOW())`,
      [transId, userId, rewardAmount, description]
    );

    if (rewardAmount > 0) {
      await connection.query('UPDATE users SET balance = balance + ? WHERE id = ?', [rewardAmount, userId]);
    }

    await connection.commit();

    res.json({
      success: true,
      amount: rewardAmount,
      type: rewardAmount > 0 ? 'REWARD' : 'NO_REWARD',
      views_left: viewsLeft - 1,
      message: rewardAmount > 0 ? 'Reward Claimed Successfully' : 'Watched, but no reward configured.'
    });
  } catch (error) {
    await connection.rollback();
    console.error('Claim Video Reward Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    connection.release();
  }
};

// ----------------------------------------------------
// ACCOUNT DELETION
// ----------------------------------------------------

const renderDeleteAccountHTML = (message = '', messageType = '') => {
  let alertHtml = '';
  if (message) {
    const alertClass = messageType === 'success'
      ? 'bg-green-100 text-green-700'
      : (messageType === 'warning' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700');
    alertHtml = `
      <div class="mb-4 p-4 rounded ${alertClass}">
        ${message}
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Request Account Deletion - Rewardverse</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
</head>
<body class="bg-gray-100 min-h-screen flex items-center justify-center px-4">
    <div class="max-w-md w-full bg-white rounded-lg shadow-md overflow-hidden">
        <div class="bg-purple-600 px-6 py-4">
            <h2 class="text-xl font-bold text-white">Request Account Deletion</h2>
            <p class="text-purple-200 text-sm mt-1">Rewardverse</p>
        </div>
        
        <div class="p-6">
            ${alertHtml}
            
            <p class="text-gray-600 mb-6 text-sm">
                We are sorry to see you go. Please fill out the form below to request the deletion of your account and all associated data. This action is irreversible once processed.
            </p>
            
            <form method="POST" action="">
                <div class="mb-4">
                    <label class="block text-gray-700 text-sm font-bold mb-2" for="email">
                        Email Address
                    </label>
                    <input class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-purple-500" id="email" name="email" type="email" placeholder="user@example.com" required>
                </div>
                
                <div class="mb-6">
                    <label class="block text-gray-700 text-sm font-bold mb-2" for="reason">
                        Reason for Deletion (Optional)
                    </label>
                    <textarea class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-purple-500" id="reason" name="reason" rows="3" placeholder="Why are you leaving?"></textarea>
                </div>
                
                <div class="flex items-center justify-between">
                    <button class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full transition duration-150 ease-in-out" type="submit">
                        Submit Deletion Request
                    </button>
                </div>
            </form>
        </div>
        <div class="bg-gray-50 px-6 py-3 border-t border-gray-200">
            <p class="text-xs text-gray-500 text-center">
                Data deletion requests are typically processed within 24-48 hours.
            </p>
        </div>
    </div>
</body>
</html>`;
};

export const serveDeleteAccountHTML = (req, res) => {
  res.send(renderDeleteAccountHTML());
};

export const requestAccountDeletion = async (req, res) => {
  const wantsHtml = req.path.includes('delete_account.php') || (req.accepts('html') && !req.xhr);
  try {
    const { email, reason } = req.body;

    if (!email) {
      if (wantsHtml) {
        return res.send(renderDeleteAccountHTML('Email is required.', 'error'));
      }
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }

    // Check if user is linked (by matching email)
    const [userRows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    const userId = userRows.length > 0 ? userRows[0].id : null;

    // Check if request is already pending
    const [checkRows] = await pool.query(
      'SELECT id FROM deletion_requests WHERE email = ? AND status = "PENDING" LIMIT 1',
      [email]
    );

    if (checkRows.length > 0) {
      if (wantsHtml) {
        return res.send(renderDeleteAccountHTML('A deletion request for this email is already pending.', 'warning'));
      }
      return res.json({ success: false, message: 'A deletion request for this email is already pending.' });
    }

    // Insert request
    await pool.query(
      'INSERT INTO deletion_requests (user_id, email, reason) VALUES (?, ?, ?)',
      [userId, email, reason || '']
    );

    if (wantsHtml) {
      return res.send(renderDeleteAccountHTML('Your account deletion request has been submitted successfully. We will process it shortly.', 'success'));
    }

    res.json({
      success: true,
      message: 'Your account deletion request has been submitted successfully. We will process it shortly.'
    });
  } catch (error) {
    console.error('Account Deletion Request Error:', error);
    if (wantsHtml) {
      return res.send(renderDeleteAccountHTML('An error occurred. Please try again later.', 'error'));
    }
    res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
  }
};

// Get App Config details
export const getAppConfig = async (req, res) => {
  try {
    const latestVersion = await getConfig('latest_version', '1.1.2');
    const latestVersionCode = await getConfig('latest_version_code', '16');
    const forceUpdate = await getConfig('force_update', 'true');
    const updateUrl = await getConfig('update_url', 'https://play.google.com/store/apps/details?id=com.satyainfotechnetworks.rewardverse');
    const updateMessage = await getConfig('update_message', 'A critical update is available!');
    const isMaintenance = await getConfig('is_maintenance', 'false');
    const maintenanceMessage = await getConfig('maintenance_message', 'App is under maintenance. Please try again later.');

    const configPayload = {
      latest_version: latestVersion,
      latest_version_code: parseInt(latestVersionCode),
      force_update: forceUpdate === 'true',
      update_url: updateUrl,
      update_message: updateMessage,
      is_maintenance: isMaintenance === 'true',
      maintenance_mode: isMaintenance === 'true' ? "1" : "0",
      maintenance_message: maintenanceMessage
    };

    res.json({
      success: true,
      configs: configPayload, // Mapped to Android GSON AppUpdateResponse model
      data: configPayload    // Mapped to Web client structure
    });
  } catch (error) {
    console.error('Get App Config Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
