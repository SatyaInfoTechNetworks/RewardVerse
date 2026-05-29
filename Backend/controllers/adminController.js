import pool from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import { sendNotification, broadcastNotification, sendTopicNotification } from '../utils/notifications.js';
import { recordLedgerTransaction } from '../utils/ledger.js';

// ==========================================
// CORE AUDITING HELPER
// ==========================================
async function logAdminAction(connection, { adminId, actionType, targetId = null, payload = null, req = null }) {
  try {
    let parsedAdminId = parseInt(adminId);
    if (isNaN(parsedAdminId)) {
      parsedAdminId = 0; // Default system admin ID
    }
    const ipAddress = req ? (req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1') : '127.0.0.1';
    const userAgent = req ? req.headers['user-agent'] : null;
    const payloadStr = payload ? JSON.stringify(payload) : null;
    const logId = uuidv4();
    await connection.query(
      `INSERT INTO admin_audit_logs (id, admin_id, action_type, target_id, payload, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [logId, parsedAdminId, actionType, targetId, payloadStr, ipAddress, userAgent]
    );
  } catch (err) {
    console.error('❌ Failed to log admin action:', err);
  }
}

// ==========================================
// OVERVIEW STATS
// ==========================================
export const getAdminStats = async (req, res) => {
  try {
    const [userCount]         = await pool.query('SELECT COUNT(*) as c FROM users WHERE is_banned = 0 OR is_banned IS NULL');
    const [bannedCount]       = await pool.query('SELECT COUNT(*) as c FROM users WHERE is_banned = 1');
    const [todayUsers]        = await pool.query('SELECT COUNT(*) as c FROM users WHERE DATE(created_at) = CURDATE()');
    const [offerCount]        = await pool.query('SELECT COUNT(*) as c FROM offers WHERE is_active = 1');
    const [pendingWdCount]    = await pool.query('SELECT COUNT(*) as c FROM withdrawals WHERE status = "PENDING"');
    const [pendingWdVal]      = await pool.query('SELECT COALESCE(SUM(COALESCE(amount_currency, amount * 0.01)),0) as t FROM withdrawals WHERE status = "PENDING"');
    const [settledWdVal]      = await pool.query('SELECT COALESCE(SUM(COALESCE(amount_currency, amount * 0.01)),0) as t FROM withdrawals WHERE status = "APPROVED"');
    const [coinsIssued]       = await pool.query('SELECT COALESCE(SUM(amount),0) as t FROM transactions WHERE type = "CREDIT"');
    const [coinsSpent]        = await pool.query('SELECT COALESCE(SUM(amount),0) as t FROM transactions WHERE type = "DEBIT"');
    const [completions]       = await pool.query('SELECT COUNT(*) as c FROM offer_completions');
    const [openTickets]       = await pool.query('SELECT COUNT(*) as c FROM tickets WHERE status != "CLOSED"');
    const [pendingErasures]   = await pool.query('SELECT COUNT(*) as c FROM deletion_requests WHERE status = "PENDING"').catch(() => [[{c:0}]]);
    const [pendingProofs]     = await pool.query('SELECT COUNT(*) as c FROM user_offer_progress WHERE admin_status = "PENDING"');

    res.json({
      success: true,
      stats: {
        total_users: userCount[0].c,
        banned_users: bannedCount[0].c,
        new_users_today: todayUsers[0].c,
        active_offers: offerCount[0].c,
        pending_withdrawals: pendingWdCount[0].c,
        pending_withdrawals_value: parseFloat(pendingWdVal[0].t),
        settled_payouts_value: parseFloat(settledWdVal[0].t),
        total_coins_issued: parseFloat(coinsIssued[0].t),
        total_coins_spent: parseFloat(coinsSpent[0].t),
        total_completions: completions[0].c,
        open_tickets: openTickets[0].c,
        pending_erasures: pendingErasures[0].c,
        pending_proofs: pendingProofs[0].c
      }
    });
  } catch (error) {
    console.error('Admin Stats Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==========================================
// USER MANAGEMENT
// ==========================================
export const listUsers = async (req, res) => {
  try {
    const { search, page = 1, limit = 50, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = [];
    const params = [];

    if (search) {
      where.push('(u.name LIKE ? OR u.email LIKE ? OR u.referral_code LIKE ? OR u.user_id LIKE ?)');
      const sw = `%${search.trim()}%`;
      params.push(sw, sw, sw, sw);
    }
    if (status === 'banned') { where.push('u.is_banned = 1'); }
    else if (status === 'active') { where.push('(u.is_banned = 0 OR u.is_banned IS NULL)'); }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM users u ${whereClause}`, params
    );

    const [users] = await pool.query(
      `SELECT u.*,
              (SELECT COUNT(*) FROM referral_uses WHERE referrer_id = u.id) as referral_count
       FROM users u ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      success: true,
      users,
      pagination: {
        total: countRows[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(countRows[0].total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Admin List Users Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getUserTransactionsAdmin = async (req, res) => {
  try {
    const userId = req.params.id;
    const [user] = await pool.query(
      'SELECT * FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    const [rows] = await pool.query(
      'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 200',
      [userId]
    );
    res.json({ success: true, transactions: rows, user: user[0] || null });
  } catch (error) {
    console.error('Admin Get User Ledger Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateUserBalance = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.params.id;
    const { amount, type, description } = req.body;

    if (!amount || !type) return res.status(400).json({ success: false, message: 'Amount and type are required' });
    const adjustVal = parseFloat(amount);
    if (isNaN(adjustVal) || adjustVal <= 0) return res.status(400).json({ success: false, message: 'Amount must be positive' });

    await connection.beginTransaction();
    const [userRows] = await connection.query('SELECT id, balance, name FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (userRows.length === 0) { await connection.rollback(); return res.status(404).json({ success: false, message: 'User not found' }); }

    const user = userRows[0];
    const transType = type.toUpperCase() === 'CREDIT' ? 'CREDIT' : 'DEBIT';

    // Guard against negative balance on debit
    if (transType === 'DEBIT' && parseFloat(user.balance) < adjustVal) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: `Insufficient balance. User has ${user.balance} coins.` });
    }

    // Use high-fidelity ledger wrapper
    await recordLedgerTransaction(connection, {
      userId,
      amount: adjustVal,
      type: transType,
      source: 'MANUAL_ADJUSTMENT',
      description: description || `Admin manual ${transType.toLowerCase()} adjustment`
    });

    // Audit Log admin action
    const adminId = req.admin && req.admin.id ? req.admin.id : 'admin';
    await logAdminAction(connection, {
      adminId,
      actionType: 'MANUAL_ADJUSTMENT',
      targetId: userId,
      payload: { amount: adjustVal, type: transType, description },
      req
    });

    await connection.commit();

    await sendNotification(userId, 'Wallet Updated', `Your balance was adjusted by admin: ${transType === 'CREDIT' ? '+' : '-'}${adjustVal} coins.`);
    res.json({ success: true, message: 'User balance adjusted successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Update Balance Error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  } finally { connection.release(); }
};

export const updateUser = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.params.id;
    const { 
      name, email, phone_number, location, referral_code, balance,
      android_id, fcm_token, daily_spins_count, current_streak,
      referred_by, user_id, uid
    } = req.body;

    await connection.beginTransaction();

    // Fetch existing user info
    const [userRows] = await connection.query('SELECT * FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (userRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const user = userRows[0];

    // Check if new email is already taken by another user
    if (email && email !== user.email) {
      const [emailRows] = await connection.query('SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1', [email, userId]);
      if (emailRows.length > 0) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Email already taken by another user' });
      }
    }

    // Check if new referral_code is already taken
    if (referral_code && referral_code !== user.referral_code) {
      const [refRows] = await connection.query('SELECT id FROM users WHERE referral_code = ? AND id != ? LIMIT 1', [referral_code, userId]);
      if (refRows.length > 0) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Referral code already taken' });
      }
    }

    // Calculate balance difference if balance is edited
    if (balance !== undefined && parseFloat(balance) !== parseFloat(user.balance)) {
      const oldBalance = parseFloat(user.balance);
      const newBalance = parseFloat(balance);
      const diff = newBalance - oldBalance;
      const transType = diff > 0 ? 'CREDIT' : 'DEBIT';
      const absDiff = Math.abs(diff);

      await recordLedgerTransaction(connection, {
        userId,
        amount: absDiff,
        type: transType,
        source: 'MANUAL_ADJUSTMENT',
        description: `Admin updated balance from ${oldBalance} to ${newBalance}`
      });
    }

    // Update user row
    await connection.query(
      `UPDATE users SET 
        name = ?, 
        email = ?, 
        phone_number = ?, 
        location = ?, 
        referral_code = ?, 
        balance = ?,
        android_id = ?,
        fcm_token = ?,
        daily_spins_count = ?,
        current_streak = ?,
        referred_by = ?,
        user_id = ?,
        uid = ?
       WHERE id = ?`,
      [
        name !== undefined ? name : user.name,
        email !== undefined ? email : user.email,
        phone_number !== undefined ? phone_number : user.phone_number,
        location !== undefined ? location : user.location,
        referral_code !== undefined ? referral_code : user.referral_code,
        balance !== undefined ? parseFloat(balance) : user.balance,
        android_id !== undefined ? android_id : user.android_id,
        fcm_token !== undefined ? fcm_token : user.fcm_token,
        daily_spins_count !== undefined ? parseInt(daily_spins_count || 0) : user.daily_spins_count,
        current_streak !== undefined ? parseInt(current_streak || 0) : user.current_streak,
        referred_by !== undefined ? referred_by : user.referred_by,
        user_id !== undefined ? user_id : user.user_id,
        uid !== undefined ? uid : user.uid,
        userId
      ]
    );

    // Audit Log admin action
    const adminId = req.admin && req.admin.id ? req.admin.id : 'admin';
    await logAdminAction(connection, {
      adminId,
      actionType: 'UPDATE_USER_INFO',
      targetId: userId,
      payload: { name, email, phone_number, location, referral_code, balance, android_id, fcm_token, daily_spins_count, current_streak, referred_by, user_id, uid },
      req
    });

    await connection.commit();
    res.json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Admin Update User Error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  } finally {
    connection.release();
  }
};

export const banUser = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.params.id;
    const { reason } = req.body;
    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT id, name FROM users WHERE id = ? LIMIT 1 FOR UPDATE', [userId]);
    if (rows.length === 0) { await connection.rollback(); return res.status(404).json({ success: false, message: 'User not found' }); }

    await connection.query('UPDATE users SET is_banned = 1, ban_reason = ? WHERE id = ?', [reason || 'Violated terms of service', userId]);

    // Audit Log admin action
    const adminId = req.admin && req.admin.id ? req.admin.id : 'admin';
    await logAdminAction(connection, {
      adminId,
      actionType: 'BAN_USER',
      targetId: userId,
      payload: { reason: reason || 'Violated terms of service' },
      req
    });

    await connection.commit();
    res.json({ success: true, message: `User ${rows[0].name} banned successfully` });
  } catch (error) {
    await connection.rollback();
    console.error('Ban User Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally { connection.release(); }
};

export const unbanUser = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.params.id;
    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT id, name FROM users WHERE id = ? LIMIT 1 FOR UPDATE', [userId]);
    if (rows.length === 0) { await connection.rollback(); return res.status(404).json({ success: false, message: 'User not found' }); }

    await connection.query('UPDATE users SET is_banned = 0, ban_reason = NULL WHERE id = ?', [userId]);

    // Audit Log admin action
    const adminId = req.admin && req.admin.id ? req.admin.id : 'admin';
    await logAdminAction(connection, {
      adminId,
      actionType: 'UNBAN_USER',
      targetId: userId,
      payload: {},
      req
    });

    await connection.commit();
    res.json({ success: true, message: `User ${rows[0].name} unbanned successfully` });
  } catch (error) {
    await connection.rollback();
    console.error('Unban User Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally { connection.release(); }
};

export const deleteUser = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.params.id;
    await connection.beginTransaction();

    const [rows] = await connection.query('SELECT id, name FROM users WHERE id = ? LIMIT 1 FOR UPDATE', [userId]);
    if (rows.length === 0) { 
      await connection.rollback(); 
      return res.status(404).json({ success: false, message: 'User not found' }); 
    }

    const ignoreErrorQuery = async (queryStr, params) => {
      try { await connection.query(queryStr, params); } catch (e) {}
    };

    await ignoreErrorQuery('DELETE FROM user_spin_stats WHERE user_id = ?', [userId]);
    await ignoreErrorQuery('DELETE FROM user_streak_stats WHERE user_id = ?', [userId]);
    await ignoreErrorQuery('DELETE FROM user_data_entry_stats WHERE user_id = ?', [userId]);
    await ignoreErrorQuery('DELETE FROM streaks WHERE user_id = ?', [userId]);
    await ignoreErrorQuery('DELETE FROM lucky_spins WHERE user_id = ?', [userId]);
    await ignoreErrorQuery('DELETE FROM lifafa_claims WHERE user_id = ?', [userId]);
    await ignoreErrorQuery('DELETE FROM telegram_verification WHERE user_id = ?', [userId]);
    await ignoreErrorQuery('DELETE FROM device_fingerprints WHERE user_id = ?', [userId]);
    await ignoreErrorQuery('DELETE FROM contest_entries WHERE user_id = ?', [userId]);
    await ignoreErrorQuery('DELETE FROM contest_participants WHERE user_id = ?', [userId]);
    await ignoreErrorQuery('DELETE FROM contest_winners WHERE user_id = ?', [userId]);
    await ignoreErrorQuery('DELETE FROM offer_completions WHERE user_id = ?', [userId]);
    await ignoreErrorQuery('DELETE FROM user_visit_progress WHERE user_id = ?', [userId]);

    await connection.query('DELETE FROM transactions WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM withdrawals WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM user_offer_progress WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM referral_uses WHERE referrer_id = ? OR referred_user_id = ?', [userId, userId]);
    await connection.query('DELETE FROM offer_likes WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM tickets WHERE user_id = ?', [userId]);
    await connection.query('DELETE FROM users WHERE id = ?', [userId]);

    // Audit Log admin action
    const adminId = req.admin && req.admin.id ? req.admin.id : 'admin';
    await logAdminAction(connection, {
      adminId,
      actionType: 'DELETE_USER',
      targetId: userId,
      payload: { name: rows[0].name },
      req
    });

    await connection.commit();
    res.json({ success: true, message: `User ${rows[0].name} deleted successfully` });
  } catch (error) {
    await connection.rollback();
    console.error('Delete User Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally { connection.release(); }
};

// ==========================================
// OFFER MANAGEMENT
// ==========================================
export const createOffer = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { 
      external_id, title, description, category, icon_url, tracking_url, 
      total_reward, actual_price, is_active, type, reward_type, 
      estimated_time, difficulty, is_hot, extra_label, input_type, 
      input_instruction, tiers, daily_completion_cap, country_targeting 
    } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

    await connection.beginTransaction();
    if (is_hot) await connection.query('UPDATE offers SET is_hot = 0');

    const offerId = uuidv4();
    await connection.query(
      `INSERT INTO offers (id, external_id, title, description, category, icon_url, tracking_url, total_reward, actual_price, is_active, type, reward_type, estimated_time, difficulty, is_hot, extra_label, input_type, input_instruction, daily_completion_cap, country_targeting, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [offerId, external_id || null, title, description || '', category || 'General', icon_url || '', tracking_url || '',
       parseFloat(total_reward || 0), parseFloat(actual_price || 0), is_active !== undefined ? (is_active ? 1 : 0) : 1,
       type || 'online', reward_type || 'Multi Reward', estimated_time || '', difficulty || 'Medium', is_hot ? 1 : 0,
       extra_label || null, input_type || null, typeof input_instruction === 'object' ? JSON.stringify(input_instruction) : (input_instruction || null),
       parseInt(daily_completion_cap || 0), country_targeting || 'IN']
    );

    if (Array.isArray(tiers)) {
      for (const t of tiers) {
        await connection.query(
          `INSERT INTO offer_tiers (id, offer_id, tier_title, app_tier_title, reward, steps, sequence) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), offerId, t.backend_title || t.title, t.title, parseFloat(t.reward || 0), JSON.stringify(t.steps || []), parseInt(t.sequence || 1)]
        );
      }
    }

    // Audit Log admin action
    const adminId = req.admin && req.admin.id ? req.admin.id : 'admin';
    await logAdminAction(connection, {
      adminId,
      actionType: 'CREATE_OFFER',
      targetId: offerId,
      payload: { title, external_id, total_reward, daily_completion_cap, country_targeting },
      req
    });

    await connection.commit();
    res.json({ success: true, message: 'Offer created successfully', offer_id: offerId });
  } catch (error) {
    await connection.rollback();
    console.error('Admin Create Offer Error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  } finally { connection.release(); }
};

export const updateOffer = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const offerId = req.params.id;
    const { 
      external_id, title, description, category, icon_url, tracking_url, 
      total_reward, actual_price, is_active, type, reward_type, 
      estimated_time, difficulty, is_hot, extra_label, input_type, 
      input_instruction, tiers, daily_completion_cap, country_targeting 
    } = req.body;

    await connection.beginTransaction();
    const [offerRows] = await connection.query('SELECT id FROM offers WHERE id = ?', [offerId]);
    if (offerRows.length === 0) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Offer not found' }); }

    if (is_hot) await connection.query('UPDATE offers SET is_hot = 0');
    await connection.query(
      `UPDATE offers SET external_id=?, title=?, description=?, category=?, icon_url=?, tracking_url=?, total_reward=?, actual_price=?, is_active=?, type=?, reward_type=?, estimated_time=?, difficulty=?, is_hot=?, extra_label=?, input_type=?, input_instruction=?, daily_completion_cap=?, country_targeting=? WHERE id=?`,
      [external_id || null, title, description || '', category || 'General', icon_url || '', tracking_url || '',
       parseFloat(total_reward || 0), parseFloat(actual_price || 0), is_active ? 1 : 0, type || 'online', reward_type || 'Multi Reward', estimated_time || '', difficulty || 'Medium', is_hot ? 1 : 0,
       extra_label || null, input_type || null, typeof input_instruction === 'object' ? JSON.stringify(input_instruction) : (input_instruction || null),
       parseInt(daily_completion_cap || 0), country_targeting || 'IN', offerId]
    );

    if (tiers !== undefined && Array.isArray(tiers)) {
      await connection.query('DELETE FROM offer_tiers WHERE offer_id = ?', [offerId]);
      for (const t of tiers) {
        await connection.query(
          `INSERT INTO offer_tiers (id, offer_id, tier_title, app_tier_title, reward, steps, sequence) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), offerId, t.backend_title || t.title, t.title, parseFloat(t.reward || 0), JSON.stringify(t.steps || []), parseInt(t.sequence || 1)]
        );
      }
    }

    // Audit Log admin action
    const adminId = req.admin && req.admin.id ? req.admin.id : 'admin';
    await logAdminAction(connection, {
      adminId,
      actionType: 'UPDATE_OFFER',
      targetId: offerId,
      payload: { title, external_id, total_reward, daily_completion_cap, country_targeting },
      req
    });

    await connection.commit();
    res.json({ success: true, message: 'Offer updated successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Admin Update Offer Error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  } finally { connection.release(); }
};

export const deleteOffer = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const offerId = req.params.id;
    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT id, title FROM offers WHERE id = ? FOR UPDATE', [offerId]);
    if (rows.length === 0) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Offer not found' }); }

    await connection.query('DELETE FROM offer_tiers WHERE offer_id = ?', [offerId]);
    await connection.query('DELETE FROM offers WHERE id = ?', [offerId]);

    // Audit Log admin action
    const adminId = req.admin && req.admin.id ? req.admin.id : 'admin';
    await logAdminAction(connection, {
      adminId,
      actionType: 'DELETE_OFFER',
      targetId: offerId,
      payload: { title: rows[0].title },
      req
    });

    await connection.commit();
    res.json({ success: true, message: 'Offer deleted successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Admin Delete Offer Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally { connection.release(); }
};

// Admin list offers with extra details (completion count)
export const listAdminOffers = async (req, res) => {
  try {
    const [offers] = await pool.query(`
      SELECT o.*,
             (SELECT COUNT(*) FROM offer_completions WHERE offer_id = o.external_id OR offer_id = o.id) as completion_count,
             (SELECT COUNT(*) FROM offer_tiers WHERE offer_id = o.id) as tier_count
      FROM offers o
      ORDER BY o.created_at DESC
    `);
    res.json({ success: true, offers });
  } catch (error) {
    console.error('Admin List Offers Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==========================================
// WITHDRAWAL MANAGEMENT
// ==========================================
export const listWithdrawals = async (req, res) => {
  try {
    const { status = 'PENDING', page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = '';
    const params = [];
    if (status && status !== 'ALL') {
      whereClause = 'WHERE w.status = ?';
      params.push(status);
    }

    const [rows] = await pool.query(
      `SELECT w.id, w.user_id, w.amount, 
              COALESCE(w.amount_coins, w.amount) as amount_coins, 
              COALESCE(w.amount_currency, w.amount * 0.01) as amount_currency, 
              w.method, w.details, w.status, w.created_at,
              u.name as user_name, u.email as user_email, u.user_id as user_public_id
       FROM withdrawals w JOIN users u ON w.user_id = u.id
       ${whereClause}
       ORDER BY w.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM withdrawals w ${whereClause}`, params);

    res.json({ success: true, withdrawals: rows, total: countRows[0].total });
  } catch (error) {
    console.error('Admin List Withdrawals Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const approveWithdrawal = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const withdrawalId = req.params.id;
    await connection.beginTransaction();

    const [rows] = await connection.query('SELECT * FROM withdrawals WHERE id = ? FOR UPDATE', [withdrawalId]);
    if (rows.length === 0) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Withdrawal not found' }); }
    if (rows[0].status !== 'PENDING') { await connection.rollback(); return res.status(400).json({ success: false, message: 'Already processed' }); }

    await connection.query('UPDATE withdrawals SET status = "APPROVED" WHERE id = ?', [withdrawalId]);
    await connection.commit();

    const displayVal = parseFloat(rows[0].amount_currency || (rows[0].amount * 0.01)).toFixed(2);
    await sendNotification(rows[0].user_id, 'Withdrawal Settled', `Your payout of ₹${displayVal} has been processed!`);
    res.json({ success: true, message: 'Withdrawal approved' });
  } catch (error) {
    await connection.rollback();
    console.error('Approve Withdrawal Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally { connection.release(); }
};

export const rejectWithdrawal = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const withdrawalId = req.params.id;
    const { reason } = req.body;

    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT * FROM withdrawals WHERE id = ? FOR UPDATE', [withdrawalId]);
    if (rows.length === 0) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Withdrawal not found' }); }
    if (rows[0].status !== 'PENDING') { await connection.rollback(); return res.status(400).json({ success: false, message: 'Already processed' }); }

    const withdrawal = rows[0];
    await connection.query('UPDATE withdrawals SET status = "REJECTED" WHERE id = ?', [withdrawalId]);

    const refundAmt = parseFloat(withdrawal.amount);
    await connection.query(
      `INSERT INTO transactions (id, user_id, amount, type, source, description, reference_id, created_at) VALUES (?, ?, ?, 'CREDIT', 'WITHDRAWAL', ?, ?, NOW())`,
      [uuidv4(), withdrawal.user_id, refundAmt, `Refund: ${reason || 'Payout rejected'}`, withdrawalId]
    );
    await connection.query('UPDATE users SET balance = balance + ? WHERE id = ?', [refundAmt, withdrawal.user_id]);
    await connection.commit();

    await sendNotification(withdrawal.user_id, 'Withdrawal Rejected', `Your withdrawal was rejected and ${refundAmt.toFixed(0)} Coins refunded to your wallet.`);
    res.json({ success: true, message: 'Withdrawal rejected and balance refunded' });
  } catch (error) {
    await connection.rollback();
    console.error('Reject Withdrawal Error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  } finally { connection.release(); }
};

// ==========================================
// ERASURE / GDPR
// ==========================================
export const listErasureRequests = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM deletion_requests ORDER BY created_at DESC');
    res.json({ success: true, requests: rows });
  } catch (error) {
    console.error('Admin List Deletion Requests Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const approveErasureRequest = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const requestId = req.params.id;
    const [reqRows] = await connection.query('SELECT * FROM deletion_requests WHERE id = ? LIMIT 1', [requestId]);
    if (reqRows.length === 0) return res.status(404).json({ success: false, message: 'Erasure request not found' });
    if (reqRows[0].status !== 'PENDING') return res.status(400).json({ success: false, message: 'Request already processed' });

    const request = reqRows[0];
    await connection.beginTransaction();

    let userId = request.user_id;
    if (!userId) {
      const [uRows] = await connection.query('SELECT id FROM users WHERE email = ? LIMIT 1', [request.email]);
      if (uRows.length > 0) userId = uRows[0].id;
    }

    if (userId) {
      const ignoreErrorQuery = async (queryStr, params) => {
        try { await connection.query(queryStr, params); } catch (e) {}
      };

      await ignoreErrorQuery('DELETE FROM user_spin_stats WHERE user_id = ?', [userId]);
      await ignoreErrorQuery('DELETE FROM user_streak_stats WHERE user_id = ?', [userId]);
      await ignoreErrorQuery('DELETE FROM user_data_entry_stats WHERE user_id = ?', [userId]);
      await ignoreErrorQuery('DELETE FROM streaks WHERE user_id = ?', [userId]);
      await ignoreErrorQuery('DELETE FROM lucky_spins WHERE user_id = ?', [userId]);
      await ignoreErrorQuery('DELETE FROM lifafa_claims WHERE user_id = ?', [userId]);
      await ignoreErrorQuery('DELETE FROM telegram_verification WHERE user_id = ?', [userId]);
      await ignoreErrorQuery('DELETE FROM device_fingerprints WHERE user_id = ?', [userId]);
      await ignoreErrorQuery('DELETE FROM contest_entries WHERE user_id = ?', [userId]);
      await ignoreErrorQuery('DELETE FROM contest_participants WHERE user_id = ?', [userId]);
      await ignoreErrorQuery('DELETE FROM contest_winners WHERE user_id = ?', [userId]);
      await ignoreErrorQuery('DELETE FROM offer_completions WHERE user_id = ?', [userId]);
      await ignoreErrorQuery('DELETE FROM user_visit_progress WHERE user_id = ?', [userId]);

      await connection.query('DELETE FROM transactions WHERE user_id = ?', [userId]);
      await connection.query('DELETE FROM withdrawals WHERE user_id = ?', [userId]);
      await connection.query('DELETE FROM user_offer_progress WHERE user_id = ?', [userId]);
      await connection.query('DELETE FROM referral_uses WHERE referrer_id = ? OR referred_user_id = ?', [userId, userId]);
      await connection.query('DELETE FROM offer_likes WHERE user_id = ?', [userId]);
      await connection.query('DELETE FROM tickets WHERE user_id = ?', [userId]);
      await connection.query('DELETE FROM users WHERE id = ?', [userId]);
    }

    await connection.query('UPDATE deletion_requests SET status = "APPROVED" WHERE id = ?', [requestId]);
    await connection.commit();
    res.json({ success: true, message: 'User account purged successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Admin Approve Erasure Error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  } finally { connection.release(); }
};

export const rejectErasureRequest = async (req, res) => {
  try {
    await pool.query('UPDATE deletion_requests SET status = "REJECTED" WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Deletion request dismissed' });
  } catch (error) {
    console.error('Admin Reject Erasure Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==========================================
// PUSH NOTIFICATIONS + HISTORY
// ==========================================
export const triggerPushNotification = async (req, res) => {
  try {
    const { title, body, image_url, target_type, user_id, topic } = req.body;
    if (!title || !body) return res.status(400).json({ success: false, message: 'Title and body are required' });

    const targetType = target_type || (user_id ? 'specific' : 'broadcast');
    let sentCount = 0;

    if (targetType === 'specific') {
      if (!user_id) return res.status(400).json({ success: false, message: 'User ID is required for specific targeting' });
      // Find internal ID by public user_id, internal UUID, or Firebase UID
      const [userRows] = await pool.query('SELECT id FROM users WHERE user_id = ? OR id = ? OR uid = ? LIMIT 1', [user_id, user_id, user_id]);
      if (userRows.length === 0) return res.status(404).json({ success: false, message: 'Target user not found' });
      const success = await sendNotification(userRows[0].id, title, body, image_url);
      sentCount = success ? 1 : 0;
    } else if (targetType === 'topic') {
      if (!topic) return res.status(400).json({ success: false, message: 'Topic name is required' });
      const success = await sendTopicNotification(topic, title, body, image_url);
      sentCount = success ? 1 : 0;
    } else {
      const success = await broadcastNotification(title, body, image_url);
      const [cnt] = await pool.query('SELECT COUNT(*) as c FROM users WHERE fcm_token IS NOT NULL AND fcm_token != ""');
      sentCount = success ? cnt[0].c : 0;
    }

    res.json({ success: true, message: `Notification sent successfully`, sent_count: sentCount });
  } catch (error) {
    console.error('Admin Push Notification Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const listNotificationHistory = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [rows] = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT ? OFFSET ?', [parseInt(limit), offset]);
    const [cnt] = await pool.query('SELECT COUNT(*) as total FROM notifications');
    res.json({ success: true, notifications: rows, total: cnt[0].total });
  } catch (error) {
    console.error('Notification History Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==========================================
// BANNER MANAGEMENT
// ==========================================
export const listAdminBanners = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM banners ORDER BY display_order ASC, created_at DESC');
    res.json({ success: true, banners: rows });
  } catch (error) {
    console.error('Admin List Banners Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const createBanner = async (req, res) => {
  try {
    const { title, description, image_url, action_url, display_order, is_active } = req.body;
    if (!image_url) return res.status(400).json({ success: false, message: 'Image URL is required' });

    const id = uuidv4();
    await pool.query(
      `INSERT INTO banners (id, title, description, image_url, action_url, display_order, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [id, title || '', description || '', image_url, action_url || '', parseInt(display_order || 0), is_active !== false ? 1 : 0]
    );
    res.json({ success: true, message: 'Banner created', id });
  } catch (error) {
    console.error('Create Banner Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateBanner = async (req, res) => {
  try {
    const bannerId = req.params.id;
    const { title, description, image_url, action_url, display_order, is_active } = req.body;
    await pool.query(
      `UPDATE banners SET title=?, description=?, image_url=?, action_url=?, display_order=?, is_active=? WHERE id=?`,
      [title || '', description || '', image_url || '', action_url || '', parseInt(display_order || 0), is_active ? 1 : 0, bannerId]
    );
    res.json({ success: true, message: 'Banner updated' });
  } catch (error) {
    console.error('Update Banner Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deleteBanner = async (req, res) => {
  try {
    await pool.query('DELETE FROM banners WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Banner deleted' });
  } catch (error) {
    console.error('Delete Banner Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==========================================
// APP CONFIG MANAGEMENT
// ==========================================
export const listAppConfigs = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM app_configs ORDER BY config_key ASC');
    res.json({ success: true, configs: rows });
  } catch (error) {
    console.error('List App Configs Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateAppConfig = async (req, res) => {
  try {
    const { config_key, config_value } = req.body;
    if (!config_key) return res.status(400).json({ success: false, message: 'config_key is required' });

    await pool.query(
      `INSERT INTO app_configs (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)`,
      [config_key, config_value]
    );
    res.json({ success: true, message: 'Config updated' });
  } catch (error) {
    console.error('Update App Config Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==========================================
// PAYOUT METHODS MANAGEMENT
// ==========================================
export const listPayoutMethods = async (req, res) => {
  try {
    const [methods] = await pool.query('SELECT * FROM payout_methods ORDER BY is_active DESC, name ASC');
    const [tiers] = await pool.query('SELECT * FROM payout_tiers ORDER BY method_id, coin_cost ASC');
    res.json({ success: true, methods, tiers });
  } catch (error) {
    console.error('List Payout Methods Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const createPayoutMethod = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id, name, description, icon_url, min_coins, conversion_rate, processing_time, is_active, input_type, input_label, input_placeholder, tiers } = req.body;

    if (!id || !name) {
      return res.status(400).json({ success: false, message: 'ID and Name are required' });
    }

    await connection.beginTransaction();

    await connection.query(
      `INSERT INTO payout_methods (id, name, description, icon_url, min_coins, conversion_rate, processing_time, is_active, input_type, input_label, input_placeholder)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id.toLowerCase().trim(),
        name,
        description || '',
        icon_url || '',
        parseInt(min_coins || 0),
        parseFloat(conversion_rate || 0),
        processing_time || 'Instant',
        is_active ? 1 : 0,
        input_type || 'text',
        input_label || 'Details',
        input_placeholder || 'Enter details'
      ]
    );

    // Sync payout tiers if provided
    if (Array.isArray(tiers)) {
      for (const tier of tiers) {
        const coinCost = parseInt(tier.coin_cost || tier.coinCost || 0);
        const val = parseFloat(tier.monetary_value || tier.monetaryValue || 0);
        const sym = tier.currency_symbol || tier.currencySymbol || '₹';
        if (coinCost > 0 && val > 0) {
          const tierId = `${id}_${coinCost}`;
          await connection.query(
            'INSERT INTO payout_tiers (id, method_id, coin_cost, monetary_value, currency_symbol) VALUES (?, ?, ?, ?, ?)',
            [tierId, id, coinCost, val, sym]
          );
        }
      }
    }

    await connection.commit();
    res.json({ success: true, message: 'Payout method created successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Create Payout Method Error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  } finally {
    connection.release();
  }
};

export const updatePayoutMethod = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const methodId = req.params.id;
    const { name, description, icon_url, min_coins, conversion_rate, processing_time, is_active, input_type, input_label, input_placeholder, tiers } = req.body;
    
    await connection.beginTransaction();

    await connection.query(
      `UPDATE payout_methods SET name=?, description=?, icon_url=?, min_coins=?, conversion_rate=?, processing_time=?, is_active=?, input_type=?, input_label=?, input_placeholder=? WHERE id=?`,
      [name, description, icon_url, parseInt(min_coins || 0), parseFloat(conversion_rate || 0), processing_time, is_active ? 1 : 0, input_type || 'text', input_label || 'Details', input_placeholder || 'Enter details', methodId]
    );

    // Sync payout tiers atomically
    if (Array.isArray(tiers)) {
      await connection.query('DELETE FROM payout_tiers WHERE method_id = ?', [methodId]);
      for (const tier of tiers) {
        const coinCost = parseInt(tier.coin_cost || tier.coinCost || 0);
        const val = parseFloat(tier.monetary_value || tier.monetaryValue || 0);
        const sym = tier.currency_symbol || tier.currencySymbol || '₹';
        if (coinCost > 0 && val > 0) {
          const tierId = `${methodId}_${coinCost}`;
          await connection.query(
            'INSERT INTO payout_tiers (id, method_id, coin_cost, monetary_value, currency_symbol) VALUES (?, ?, ?, ?, ?)',
            [tierId, methodId, coinCost, val, sym]
          );
        }
      }
    }

    await connection.commit();
    res.json({ success: true, message: 'Payout method and tiers updated successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Update Payout Method Error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  } finally {
    connection.release();
  }
};

// ==========================================
// REFERRAL SETTINGS
// ==========================================
export const getReferralSettings = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM referral_settings LIMIT 1');
    const defaultSettings = {
      bonus_coins: 10,
      commission_percent: 10,
      offers_required: 2,
      description_text: '',
      referee_signup_bonus: 0,
      referrer_reward_coins: 10,
      referral_condition_type: 'MIN_TASKS',
      referral_condition_threshold: 2
    };
    
    if (rows.length > 0) {
      const s = rows[0];
      res.json({ 
        success: true, 
        settings: {
          ...defaultSettings,
          ...s,
          referee_signup_bonus: s.referee_signup_bonus ?? 0,
          referrer_reward_coins: s.referrer_reward_coins ?? s.bonus_coins ?? 10,
          referral_condition_type: s.referral_condition_type || 'MIN_TASKS',
          referral_condition_threshold: s.referral_condition_threshold ?? s.offers_required ?? 2
        } 
      });
    } else {
      res.json({ success: true, settings: defaultSettings });
    }
  } catch (error) {
    console.error('Get Referral Settings Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateReferralSettings = async (req, res) => {
  try {
    const { 
      bonus_coins, 
      commission_percent, 
      offers_required, 
      description_text,
      referee_signup_bonus,
      referrer_reward_coins,
      referral_condition_type,
      referral_condition_threshold
    } = req.body;

    const [existing] = await pool.query('SELECT id FROM referral_settings LIMIT 1');

    const cleanRefereeSignupBonus = parseFloat(referee_signup_bonus !== undefined ? referee_signup_bonus : 0);
    const cleanReferrerRewardCoins = parseFloat(referrer_reward_coins !== undefined ? referrer_reward_coins : (bonus_coins || 10));
    const cleanConditionType = referral_condition_type || 'MIN_TASKS';
    const cleanConditionThreshold = parseFloat(referral_condition_threshold !== undefined ? referral_condition_threshold : (offers_required || 2));
    const cleanCommPercent = parseInt(commission_percent || 10);
    const cleanDescription = description_text || '';

    if (existing.length > 0) {
      await pool.query(
        `UPDATE referral_settings 
         SET bonus_coins=?, commission_percent=?, offers_required=?, description_text=?,
             referee_signup_bonus=?, referrer_reward_coins=?, referral_condition_type=?, referral_condition_threshold=? 
         WHERE id=?`,
        [
          cleanReferrerRewardCoins, cleanCommPercent, Math.round(cleanConditionThreshold), cleanDescription,
          cleanRefereeSignupBonus, cleanReferrerRewardCoins, cleanConditionType, cleanConditionThreshold,
          existing[0].id
        ]
      );
    } else {
      await pool.query(
        `INSERT INTO referral_settings 
          (bonus_coins, commission_percent, offers_required, description_text, referee_signup_bonus, referrer_reward_coins, referral_condition_type, referral_condition_threshold) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cleanReferrerRewardCoins, cleanCommPercent, Math.round(cleanConditionThreshold), cleanDescription,
          cleanRefereeSignupBonus, cleanReferrerRewardCoins, cleanConditionType, cleanConditionThreshold
        ]
      );
    }
    res.json({ success: true, message: 'Referral settings updated successfully' });
  } catch (error) {
    console.error('Update Referral Settings Error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};

// ==========================================
// LIFAFA (SURPRISE ENVELOPE) MANAGEMENT
// ==========================================
export const listLifafas = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT l.*, 
             (SELECT COUNT(*) FROM lifafa_claims WHERE lifafa_id = l.lifafa_id) as actual_claims
      FROM lifafas l ORDER BY l.created_at DESC
    `);
    res.json({ success: true, lifafas: rows });
  } catch (error) {
    console.error('List Lifafas Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const createLifafa = async (req, res) => {
  try {
    const { lifafa_id, bonus_amount, total_limit, required_offers_count, expires_at, is_active } = req.body;
    if (!lifafa_id || !bonus_amount || !total_limit) {
      return res.status(400).json({ success: false, message: 'lifafa_id, bonus_amount, total_limit are required' });
    }

    await pool.query(
      `INSERT INTO lifafas (id, lifafa_id, bonus_amount, total_limit, required_offers_count, expires_at, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [uuidv4(), lifafa_id, parseFloat(bonus_amount), parseInt(total_limit), parseInt(required_offers_count || 0), expires_at || null, is_active !== false ? 1 : 0]
    );
    res.json({ success: true, message: 'Lifafa created' });
  } catch (error) {
    console.error('Create Lifafa Error:', error);
    res.status(500).json({ success: false, message: error.message.includes('Duplicate') ? 'Lifafa ID already exists' : 'Server error' });
  }
};

export const updateLifafa = async (req, res) => {
  try {
    const lifafaId = req.params.id;
    const { bonus_amount, total_limit, required_offers_count, expires_at, is_active } = req.body;
    await pool.query(
      'UPDATE lifafas SET bonus_amount=?, total_limit=?, required_offers_count=?, expires_at=?, is_active=? WHERE id=?',
      [parseFloat(bonus_amount), parseInt(total_limit), parseInt(required_offers_count || 0), expires_at || null, is_active ? 1 : 0, lifafaId]
    );
    res.json({ success: true, message: 'Lifafa updated' });
  } catch (error) {
    console.error('Update Lifafa Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deleteLifafa = async (req, res) => {
  try {
    await pool.query('DELETE FROM lifafas WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Lifafa deleted' });
  } catch (error) {
    console.error('Delete Lifafa Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==========================================
// SUPPORT TICKETS
// ==========================================
export const listAdminTickets = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = '';
    const params = [];
    if (status && status !== 'ALL') {
      whereClause = 'WHERE t.status = ?';
      params.push(status);
    }

    const [rows] = await pool.query(
      `SELECT t.id, t.subject, t.status, t.created_at,
              u.name as user_name, u.email as user_email, u.user_id as user_public_id,
              (SELECT COUNT(*) FROM ticket_replies WHERE ticket_id = t.id) as reply_count,
              (SELECT message FROM ticket_replies WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) as last_message
       FROM tickets t JOIN users u ON t.user_id = u.id
       ${whereClause}
       ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [cnt] = await pool.query(`SELECT COUNT(*) as total FROM tickets t ${whereClause}`, params);
    res.json({ success: true, tickets: rows, total: cnt[0].total });
  } catch (error) {
    console.error('Admin List Tickets Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getAdminTicketDetail = async (req, res) => {
  try {
    const ticketId = req.params.id;
    const [ticketRows] = await pool.query(
      `SELECT t.*, u.name as user_name, u.email as user_email, u.user_id as user_public_id
       FROM tickets t JOIN users u ON t.user_id = u.id WHERE t.id = ? LIMIT 1`,
      [ticketId]
    );
    if (ticketRows.length === 0) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const [replies] = await pool.query(
      'SELECT * FROM ticket_replies WHERE ticket_id = ? ORDER BY created_at ASC',
      [ticketId]
    );

    res.json({ success: true, ticket: ticketRows[0], replies });
  } catch (error) {
    console.error('Admin Get Ticket Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const replyAdminTicket = async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { message, close } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message is required' });

    const [ticketRows] = await pool.query('SELECT * FROM tickets WHERE id = ? LIMIT 1', [ticketId]);
    if (ticketRows.length === 0) return res.status(404).json({ success: false, message: 'Ticket not found' });

    await pool.query(
      `INSERT INTO ticket_replies (id, ticket_id, sender_type, message, created_at) VALUES (?, ?, 'ADMIN', ?, NOW())`,
      [uuidv4(), ticketId, message]
    );

    const newStatus = close ? 'CLOSED' : 'REPLIED';
    await pool.query('UPDATE tickets SET status = ? WHERE id = ?', [newStatus, ticketId]);

    // Notify user
    await sendNotification(ticketRows[0].user_id, 'Support Reply', 'Admin replied to your support ticket. Tap to view.');
    res.json({ success: true, message: 'Reply sent successfully' });
  } catch (error) {
    console.error('Admin Reply Ticket Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const closeAdminTicket = async (req, res) => {
  try {
    await pool.query('UPDATE tickets SET status = "CLOSED" WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Ticket closed' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==========================================
// REPORTS
// ==========================================
export const getAdminReports = async (req, res) => {
  try {
    // Users joined per day (last 30 days)
    const [userGrowth] = await pool.query(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at) ORDER BY date ASC
    `);

    // Revenue per day (last 30 days) — from settled withdrawals
    const [revenue] = await pool.query(`
      SELECT DATE(created_at) as date, SUM(amount) as total
      FROM withdrawals WHERE status = 'APPROVED' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at) ORDER BY date ASC
    `);

    // Coins issued per day (last 30 days)
    const [coinsIssued] = await pool.query(`
      SELECT DATE(created_at) as date, SUM(amount) as total
      FROM transactions WHERE type = 'CREDIT' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at) ORDER BY date ASC
    `);

    // Top offers by completion count
    const [topOffers] = await pool.query(`
      SELECT o.title, o.category, COUNT(oc.id) as completions, SUM(oc.payout_coins) as coins_paid
      FROM offers o LEFT JOIN offer_completions oc ON (oc.offer_id = o.external_id OR oc.offer_id = o.id)
      GROUP BY o.id, o.title, o.category
      ORDER BY completions DESC LIMIT 10
    `);

    // Withdrawal breakdown by method
    const [withdrawalByMethod] = await pool.query(`
      SELECT method, status, COUNT(*) as count, SUM(amount) as total
      FROM withdrawals GROUP BY method, status ORDER BY total DESC
    `);

    res.json({ success: true, reports: { user_growth: userGrowth, revenue, coins_issued: coinsIssued, top_offers: topOffers, withdrawal_by_method: withdrawalByMethod } });
  } catch (error) {
    console.error('Admin Reports Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==========================================
// OFFLINE PROOF VERIFICATION
// ==========================================
export const getPendingProofs = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.id, p.click_id, p.user_input, p.admin_status, p.last_updated,
             u.id as user_internal_id, u.email as user_email, u.user_id as user_public_id, u.name as user_name, u.balance as user_balance,
             o.id as offer_internal_id, o.title as offer_title, o.total_reward as offer_reward, o.input_type, o.input_instruction
      FROM user_offer_progress p
      JOIN offers o ON p.offer_id = o.id
      JOIN users u ON p.user_id = u.id
      WHERE o.type = 'offline' AND p.admin_status = 'PENDING'
      ORDER BY p.last_updated DESC
    `);
    res.json({ success: true, proofs: rows });
  } catch (error) {
    console.error('Admin Get Pending Proofs Error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};

export const approveProof = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { clickId } = req.params;
    if (!clickId) return res.status(400).json({ success: false, message: 'Click ID is required' });

    await connection.beginTransaction();

    // 1. Fetch the progress record and reward amount
    const [rows] = await connection.query(`
      SELECT p.*, o.total_reward, o.title as offer_title, u.id as user_internal_id
      FROM user_offer_progress p
      JOIN offers o ON p.offer_id = o.id
      JOIN users u ON p.user_id = u.id
      WHERE p.click_id = ? FOR UPDATE
    `, [clickId]);

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    const submission = rows[0];
    if (submission.admin_status === 'APPROVED') {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Submission already approved' });
    }

    const uid = submission.user_internal_id;
    const reward = parseFloat(submission.total_reward || 0);
    const offerTitle = submission.offer_title;

    // 2. Update user balance and log double-entry cryptographic transaction log
    const ledgerResult = await recordLedgerTransaction(connection, {
      userId: uid,
      amount: reward,
      type: 'CREDIT',
      source: 'OFFLINE_OFFER',
      referenceId: clickId,
      description: `Completed offline task: ${offerTitle}`
    });

    // 3. Update user progress status
    await connection.query(
      `UPDATE user_offer_progress 
       SET admin_status = 'APPROVED', status = 'COMPLETED', admin_remark = 'Approved by Admin' 
       WHERE click_id = ?`,
      [clickId]
    );

    // 4. Insert into offer_completions so it registers for leaderboard & top_offers count
    await connection.query(
      `INSERT INTO offer_completions (completion_id, user_id, offer_id, provider, payout_coins, status, offer_name, created_at)
       VALUES (?, ?, ?, 'manual', ?, 'COMPLETED', ?, NOW())`,
      [clickId, uid, submission.offer_id, reward, offerTitle]
    );

    // 5. Audit Log admin action
    const adminId = req.admin && req.admin.id ? req.admin.id : 'admin';
    await logAdminAction(connection, {
      adminId,
      actionType: 'APPROVE_PROOF',
      targetId: clickId,
      payload: { userId: uid, reward, offerTitle },
      req
    });

    await connection.commit();

    // 6. Send push notification to user asynchronously
    try {
      await sendNotification(uid, 'Task Approved! 🎉', `Your proof for "${offerTitle}" was approved. +${reward} coins credited to your wallet.`);
    } catch (notifErr) {
      console.error('Failed to send task approval notification:', notifErr);
    }

    res.json({ success: true, message: `Submission approved. ${reward} coins credited.` });
  } catch (error) {
    await connection.rollback();
    console.error('Admin Approve Proof Error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  } finally {
    connection.release();
  }
};

export const rejectProof = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { clickId } = req.params;
    const { reason } = req.body;
    if (!clickId) return res.status(400).json({ success: false, message: 'Click ID is required' });

    await connection.beginTransaction();

    const [rows] = await connection.query(`
      SELECT p.*, o.title as offer_title, u.id as user_internal_id
      FROM user_offer_progress p
      JOIN offers o ON p.offer_id = o.id
      JOIN users u ON p.user_id = u.id
      WHERE p.click_id = ? FOR UPDATE
    `, [clickId]);

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    const submission = rows[0];
    const uid = submission.user_internal_id;
    const offerTitle = submission.offer_title;
    const remark = reason || 'No reason provided';

    // Update progress status to REJECTED
    await connection.query(
      `UPDATE user_offer_progress 
       SET admin_status = 'REJECTED', admin_remark = ? 
       WHERE click_id = ?`,
      [remark, clickId]
    );

    // Audit Log admin action
    const adminId = req.admin && req.admin.id ? req.admin.id : 'admin';
    await logAdminAction(connection, {
      adminId,
      actionType: 'REJECT_PROOF',
      targetId: clickId,
      payload: { userId: uid, offerTitle, reason: remark },
      req
    });

    await connection.commit();

    // Send push notification to user asynchronously
    try {
      await sendNotification(uid, 'Task Proof Rejected ⚠️', `Your proof for "${offerTitle}" was rejected: ${remark}`);
    } catch (notifErr) {
      console.error('Failed to send task rejection notification:', notifErr);
    }

    res.json({ success: true, message: 'Submission rejected.' });
  } catch (error) {
    await connection.rollback();
    console.error('Admin Reject Proof Error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  } finally {
    connection.release();
  }
};

export const resetAllDailySpins = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    // 1. Reset spins count in users table
    await connection.query('UPDATE users SET daily_spins_count = 0');
    // 2. Fetch configured default daily spins count
    const [configRows] = await connection.query('SELECT config_value FROM app_configs WHERE config_key = "spin_daily_limit" LIMIT 1');
    const defaultSpins = configRows.length > 0 ? parseInt(configRows[0].config_value || 2) : 2;
    // 3. Reset spins count in lucky_spins table
    await connection.query('UPDATE lucky_spins SET spins_left = ?', [defaultSpins]);
    
    // Log admin action
    const adminId = req.admin && req.admin.id ? req.admin.id : 'admin';
    await logAdminAction(connection, {
      adminId,
      actionType: 'RESET_ALL_DAILY_SPINS',
      targetId: 'ALL_USERS',
      payload: { defaultSpins },
      req
    });

    await connection.commit();
    res.json({ success: true, message: 'All users daily spins count successfully reset.' });
  } catch (error) {
    await connection.rollback();
    console.error('Reset Daily Spins Error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  } finally {
    connection.release();
  }
};

export const getAllTransactionsAdmin = async (req, res) => {
  try {
    const { search, type, source, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereParts = [];
    const params = [];

    if (search) {
      whereParts.push('(u.name LIKE ? OR u.email LIKE ? OR u.user_id LIKE ? OR t.description LIKE ? OR t.source LIKE ?)');
      const searchWildcard = `%${search.trim()}%`;
      params.push(searchWildcard, searchWildcard, searchWildcard, searchWildcard, searchWildcard);
    }

    if (type && type !== 'ALL') {
      whereParts.push('t.type = ?');
      params.push(type);
    }

    if (source && source !== 'ALL') {
      whereParts.push('t.source = ?');
      params.push(source);
    }

    const whereClause = whereParts.length > 0 ? 'WHERE ' + whereParts.join(' AND ') : '';

    const query = `
      SELECT t.id, t.user_id, t.amount, t.type, t.source, t.description, t.created_at,
             u.name as user_name, u.email as user_email, u.user_id as user_public_id
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      ${whereClause}
    `;

    const [rows] = await pool.query(query, [...params, parseInt(limit), offset]);
    const [countRows] = await pool.query(countQuery, params);

    res.json({
      success: true,
      transactions: rows,
      total: countRows[0].total,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(countRows[0].total / parseInt(limit)) || 1,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Admin Get All Transactions Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deleteTransactionAdmin = async (req, res) => {
  const transactionId = req.params.id;
  const revertBalance = req.query.revertBalance === 'true' || req.body.revertBalance === true;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Fetch transaction details first
    const [txRows] = await connection.query('SELECT * FROM transactions WHERE id = ? LIMIT 1', [transactionId]);
    if (txRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }
    const tx = txRows[0];

    // 2. Revert user balance if requested
    if (revertBalance) {
      const txAmount = parseFloat(tx.amount || 0);
      if (tx.type === 'CREDIT') {
        // Subtract the credited amount
        await connection.query('UPDATE users SET balance = balance - ? WHERE id = ?', [txAmount, tx.user_id]);
      } else if (tx.type === 'DEBIT') {
        // Add back the debited amount
        await connection.query('UPDATE users SET balance = balance + ? WHERE id = ?', [txAmount, tx.user_id]);
      }
    }

    // 3. If there is a reference ID, delete from offer_completions (e.g. to clear duplicate locks for testing webhooks)
    if (tx.reference_id) {
      await connection.query('DELETE FROM offer_completions WHERE completion_id = ?', [tx.reference_id]);
    }

    // Also try deleting by completion_id = transactionId just in case
    await connection.query('DELETE FROM offer_completions WHERE completion_id = ?', [transactionId]);

    // 4. Delete the transaction itself
    await connection.query('DELETE FROM transactions WHERE id = ?', [transactionId]);

    // Log admin audit action using the standard helper
    await logAdminAction(connection, {
      adminId: req.admin?.id || 'admin',
      actionType: 'DELETE_TRANSACTION',
      targetId: tx.user_id,
      payload: { transactionId, revertBalance, txDetails: tx },
      req
    });

    await connection.commit();
    res.json({
      success: true,
      message: 'Transaction successfully deleted. Associated offer completion locks cleared.'
    });
  } catch (error) {
    await connection.rollback();
    console.error('Admin Delete Transaction Error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  } finally {
    connection.release();
  }
};

