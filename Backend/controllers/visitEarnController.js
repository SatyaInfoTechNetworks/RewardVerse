import pool from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import { recordLedgerTransaction } from '../utils/ledger.js';

// ====================================================
// USER CLIENT APIS
// ====================================================

// 1. List active visit-earn tasks that the user hasn't completed today
export const listVisitTasks = async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch tasks that are active and not completed by this user today
    const [tasks] = await pool.query(
      `SELECT id, title, coins, visit_url, timer_seconds, is_ad 
       FROM visit_earn_tasks 
       WHERE is_active = 1 
         AND id NOT IN (
           SELECT task_id 
           FROM user_visit_progress 
           WHERE user_id = ? 
             AND DATE(completed_at) = CURDATE()
         )
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ success: true, tasks });
  } catch (error) {
    console.error('List Visit Tasks Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 2. Claim rewards after completing the visit link timer
export const claimVisitReward = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.user.id;
    const { task_id } = req.body;

    if (!task_id) {
      return res.status(400).json({ success: false, message: 'Task ID is required' });
    }

    // A. FETCH VISIT TASK
    const [taskRows] = await connection.query(
      'SELECT * FROM visit_earn_tasks WHERE id = ? AND is_active = 1 LIMIT 1',
      [task_id]
    );

    if (taskRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found or inactive.' });
    }
    const task = taskRows[0];

    // B. ANTI-FRAUD: CHECK IF ALREADY CLAIMED TODAY
    const [progressRows] = await connection.query(
      'SELECT id FROM user_visit_progress WHERE user_id = ? AND task_id = ? AND DATE(completed_at) = CURDATE() LIMIT 1',
      [userId, task_id]
    );

    if (progressRows.length > 0) {
      return res.status(400).json({ success: false, message: 'You have already completed this visit task today.' });
    }

    const rewardCoins = parseInt(task.coins || 0);

    // C. BEGIN TRANSACTION FOR WALLET WRAPPER
    await connection.beginTransaction();

    // Log completion progress
    const progressId = uuidv4();
    await connection.query(
      'INSERT INTO user_visit_progress (id, user_id, task_id, completed_at) VALUES (?, ?, ?, NOW())',
      [progressId, userId, task_id]
    );

    if (rewardCoins > 0) {
      // Record transaction ledger
      await recordLedgerTransaction(connection, {
        userId,
        amount: rewardCoins,
        type: 'CREDIT',
        source: 'VISIT_EARN',
        description: `Completed Visit & Earn task: ${task.title}`
      });

      // Update user wallet balance
      await connection.query(
        'UPDATE users SET balance = balance + ? WHERE id = ?',
        [rewardCoins, userId]
      );
    }

    await connection.commit();

    // Fetch updated balance to return to user
    const [userRows] = await pool.query('SELECT balance FROM users WHERE id = ? LIMIT 1', [userId]);
    const newBalance = userRows.length > 0 ? parseFloat(userRows[0].balance) : 0.0;

    res.json({
      success: true,
      message: `Reward claimed successfully! Added ${rewardCoins} coins to your wallet.`,
      reward: rewardCoins,
      new_balance: newBalance
    });
  } catch (error) {
    await connection.rollback();
    console.error('Claim Visit Reward Error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  } finally {
    connection.release();
  }
};

// ====================================================
// ADMINISTRATIVE APIS (CRUD)
// ====================================================

// 1. List all visit tasks for admin
export const adminListVisitTasks = async (req, res) => {
  try {
    const [tasks] = await pool.query('SELECT * FROM visit_earn_tasks ORDER BY created_at DESC');
    res.json({ success: true, tasks });
  } catch (error) {
    console.error('Admin List Visit Tasks Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 2. Create a new visit task
export const adminCreateVisitTask = async (req, res) => {
  try {
    const { title, coins, visit_url, timer_seconds, is_ad, is_active } = req.body;

    if (!title || !visit_url) {
      return res.status(400).json({ success: false, message: 'Title and Visit URL are required' });
    }

    const taskId = uuidv4();
    await pool.query(
      `INSERT INTO visit_earn_tasks (id, title, coins, visit_url, timer_seconds, is_ad, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        taskId,
        title,
        parseInt(coins || 0),
        visit_url,
        parseInt(timer_seconds || 30),
        is_ad ? 1 : 0,
        is_active !== false ? 1 : 0
      ]
    );

    res.json({ success: true, message: 'Visit & Earn task created successfully', id: taskId });
  } catch (error) {
    console.error('Admin Create Visit Task Error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};

// 3. Update an existing visit task
export const adminUpdateVisitTask = async (req, res) => {
  try {
    const taskId = req.params.id;
    const { title, coins, visit_url, timer_seconds, is_ad, is_active } = req.body;

    if (!title || !visit_url) {
      return res.status(400).json({ success: false, message: 'Title and Visit URL are required' });
    }

    const [check] = await pool.query('SELECT id FROM visit_earn_tasks WHERE id = ?', [taskId]);
    if (check.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    await pool.query(
      `UPDATE visit_earn_tasks 
       SET title = ?, coins = ?, visit_url = ?, timer_seconds = ?, is_ad = ?, is_active = ?
       WHERE id = ?`,
      [
        title,
        parseInt(coins || 0),
        visit_url,
        parseInt(timer_seconds || 30),
        is_ad ? 1 : 0,
        is_active ? 1 : 0,
        taskId
      ]
    );

    res.json({ success: true, message: 'Visit & Earn task updated successfully' });
  } catch (error) {
    console.error('Admin Update Visit Task Error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};

// 4. Delete an existing visit task
export const adminDeleteVisitTask = async (req, res) => {
  try {
    const taskId = req.params.id;

    const [check] = await pool.query('SELECT id FROM visit_earn_tasks WHERE id = ?', [taskId]);
    if (check.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Clean user progress entries associated with this task first
    await pool.query('DELETE FROM user_visit_progress WHERE task_id = ?', [taskId]);
    await pool.query('DELETE FROM visit_earn_tasks WHERE id = ?', [taskId]);

    res.json({ success: true, message: 'Visit & Earn task deleted successfully' });
  } catch (error) {
    console.error('Admin Delete Visit Task Error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};
