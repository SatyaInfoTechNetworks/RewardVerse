import pool from '../db.js';
import { v4 as uuidv4 } from 'uuid';

// ----------------------------------------------------
// GET LIFAFA DETAILS
// ----------------------------------------------------
export const getLifafaDetail = async (req, res) => {
  try {
    const lifafaId = req.query.id || req.params.id;

    if (!lifafaId) {
      return res.status(400).json({ success: false, message: 'Lifafa ID is required' });
    }

    const [rows] = await pool.query('SELECT * FROM lifafas WHERE lifafa_id = ? LIMIT 1', [lifafaId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invalid Lifafa ID' });
    }

    const lifafa = rows[0];

    if (!lifafa.is_active) {
      return res.json({ success: false, message: 'This Lifafa is inactive' });
    }

    if (lifafa.expires_at && new Date(lifafa.expires_at).getTime() < Date.now()) {
      return res.json({ success: false, message: 'This Lifafa has expired' });
    }

    if (parseInt(lifafa.claimed_count || 0) >= parseInt(lifafa.total_limit || 0)) {
      return res.json({ success: false, message: 'This Lifafa has been fully claimed' });
    }

    res.json({
      success: true,
      data: {
        id: lifafa.lifafa_id,
        amount: parseFloat(lifafa.bonus_amount),
        message: 'Congratulations! You found a surprise bonus.'
      }
    });
  } catch (error) {
    console.error('Get Lifafa Detail Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ----------------------------------------------------
// CLAIM LIFAFA
// ----------------------------------------------------
export const claimLifafaReward = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { lifafa_id, user_id } = req.body;

    // Support both standard internal ID and external UID
    let targetUserId = req.user ? req.user.id : user_id;

    if (!lifafa_id || !targetUserId) {
      return res.status(400).json({ success: false, message: 'Lifafa ID and User ID are required' });
    }

    // Resolve userId if UID is passed
    if (targetUserId.length !== 36) {
      const [uRows] = await connection.query('SELECT id FROM users WHERE uid = ? LIMIT 1', [targetUserId]);
      if (uRows.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      targetUserId = uRows[0].id;
    }

    // Begin transaction for safety
    await connection.beginTransaction();

    // 1. Check Lifafa validity (lock row for update)
    const [lifafas] = await connection.query('SELECT * FROM lifafas WHERE lifafa_id = ? FOR UPDATE', [lifafa_id]);

    if (lifafas.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Invalid Lifafa ID' });
    }

    const lifafa = lifafas[0];

    if (!lifafa.is_active) {
      await connection.rollback();
      return res.json({ success: false, message: 'This Lifafa is inactive' });
    }

    if (lifafa.expires_at && new Date(lifafa.expires_at).getTime() < Date.now()) {
      await connection.rollback();
      return res.json({ success: false, message: 'This Lifafa has expired' });
    }

    if (parseInt(lifafa.claimed_count || 0) >= parseInt(lifafa.total_limit || 0)) {
      await connection.rollback();
      return res.json({ success: false, message: 'This Lifafa has been fully claimed' });
    }

    // 1.1 Condition Checks
    // Condition A: Required Offer ID
    if (lifafa.required_offer_id) {
      const [offerRows] = await connection.query(
        'SELECT id FROM user_offer_progress WHERE user_id = ? AND offer_id = ? AND status = "COMPLETED" LIMIT 1',
        [targetUserId, lifafa.required_offer_id]
      );
      if (offerRows.length === 0) {
        await connection.rollback();
        return res.json({ success: false, message: 'You must complete the required offer to claim this bonus' });
      }
    }

    // Condition B: Minimum Offers Completed Count
    if (lifafa.required_offers_count && parseInt(lifafa.required_offers_count) > 0) {
      const [countRows] = await connection.query(
        'SELECT COUNT(*) as total FROM user_offer_progress WHERE user_id = ? AND status = "COMPLETED"',
        [targetUserId]
      );
      const completedCount = parseInt(countRows[0].total || 0);
      if (completedCount < parseInt(lifafa.required_offers_count)) {
        await connection.rollback();
        return res.json({
          success: false,
          message: `You must complete at least ${lifafa.required_offers_count} offers to claim this bonus`
        });
      }
    }

    // 2. Check if user already claimed
    const [checkClaims] = await connection.query(
      'SELECT id FROM lifafa_claims WHERE lifafa_id = ? AND user_id = ? LIMIT 1',
      [lifafa_id, targetUserId]
    );

    if (checkClaims.length > 0) {
      await connection.rollback();
      return res.json({ success: false, message: 'You have already claimed this bonus' });
    }

    // 3. Record claim
    const claimId = uuidv4();
    await connection.query(
      'INSERT INTO lifafa_claims (id, lifafa_id, user_id, amount) VALUES (?, ?, ?, ?)',
      [claimId, lifafa_id, targetUserId, parseFloat(lifafa.bonus_amount)]
    );

    // 4. Update Lifafa count
    await connection.query('UPDATE lifafas SET claimed_count = claimed_count + 1 WHERE id = ?', [lifafa.id]);

    // 5. Credit User Balance
    await connection.query('UPDATE users SET balance = balance + ? WHERE id = ?', [parseFloat(lifafa.bonus_amount), targetUserId]);

    // 6. Log Transaction
    const transId = uuidv4();
    await connection.query(
      `INSERT INTO transactions (id, user_id, amount, type, source, reference_id, description, created_at) 
       VALUES (?, ?, ?, "CREDIT", "LIFAFA_BONUS", ?, ?, NOW())`,
      [transId, targetUserId, parseFloat(lifafa.bonus_amount), lifafa_id, `Surprise bonus claim: ${lifafa_id}`]
    );

    await connection.commit();

    res.json({
      success: true,
      message: 'Bonus claimed successfully!',
      amount: parseFloat(lifafa.bonus_amount)
    });
  } catch (error) {
    await connection.rollback();
    console.error('Claim Lifafa Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    connection.release();
  }
};
