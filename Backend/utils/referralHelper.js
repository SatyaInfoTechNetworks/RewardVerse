import pool from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import { sendNotification } from './notifications.js';

/**
 * Centrally checks if a referee has met the configured referral condition
 * and awards the dynamic bonus to the referrer atomically.
 * 
 * @param {object} connection - MySQL Connection (to run inside existing transaction)
 * @param {number} referredUserId - The user ID of the referred user (referee)
 * @param {string} triggerType - The event that triggered this check ('MIN_TASKS', 'LIFETIME_COINS', 'FIRST_REDEEM')
 * @param {object} additionalData - Extra info (e.g. incrementTasks, incomingCoins)
 */
export async function checkAndRewardReferrer(connection, referredUserId, triggerType, additionalData = {}) {
  try {
    // 1. Fetch referral settings
    const [settingsRows] = await connection.query('SELECT * FROM referral_settings LIMIT 1');
    if (settingsRows.length === 0) return;
    const settings = settingsRows[0];

    // Read dynamic settings with robust backward-compatibility fallbacks
    const conditionType = settings.referral_condition_type || 'MIN_TASKS';
    const conditionThreshold = parseFloat(
      settings.referral_condition_threshold !== undefined 
        ? settings.referral_condition_threshold 
        : (settings.offers_required || 2)
    );
    const referrerRewardCoins = parseFloat(
      settings.referrer_reward_coins !== undefined 
        ? settings.referrer_reward_coins 
        : (settings.bonus_coins || 10.00)
    );

    // If this trigger does not match the active setting, we do not award milestone bonuses
    if (conditionType !== triggerType) return;

    // 2. Locate active referral relationship
    const [useRows] = await connection.query(
      'SELECT * FROM referral_uses WHERE referred_user_id = ? LIMIT 1 FOR UPDATE',
      [referredUserId]
    );
    if (useRows.length === 0) return;
    const refUse = useRows[0];

    // Only process if currently PENDING
    if (refUse.status !== 'PENDING') return;

    let conditionMet = false;
    let descriptionText = '';

    if (conditionType === 'MIN_TASKS') {
      const increment = parseInt(additionalData.incrementTasks || 0);
      const newCount = parseInt(refUse.offers_completed_count || 0) + increment;
      
      // Update completion count in DB
      await connection.query(
        'UPDATE referral_uses SET offers_completed_count = ? WHERE id = ?',
        [newCount, refUse.id]
      );
      
      if (newCount >= conditionThreshold) {
        conditionMet = true;
        descriptionText = `Referral Milestone (Friend completed ${conditionThreshold} tasks)`;
      }
    } 
    else if (conditionType === 'FIRST_REDEEM') {
      // First withdrawal request trigger
      const [withdrawalRows] = await connection.query(
        'SELECT COUNT(*) as count FROM withdrawals WHERE user_id = ?',
        [referredUserId]
      );
      const withdrawalCount = parseInt(withdrawalRows[0]?.count || 0);
      
      // If this is their first registered withdrawal in ledger, milestone is unlocked!
      if (withdrawalCount <= 1) {
        conditionMet = true;
        descriptionText = `Referral Milestone (Friend made their first redeem)`;
      }
    } 
    else if (conditionType === 'LIFETIME_COINS') {
      // Lifetime coins is total earned CREDIT transactions
      const [transRows] = await connection.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'CREDIT'",
        [referredUserId]
      );
      const incoming = parseFloat(additionalData.incomingCoins || 0);
      const lifetimeCoins = parseFloat(transRows[0]?.total || 0) + incoming;

      if (lifetimeCoins >= conditionThreshold) {
        conditionMet = true;
        descriptionText = `Referral Milestone (Friend earned ${conditionThreshold} lifetime coins)`;
      }
    }

    // 3. Atomically Credit Referrer
    if (conditionMet) {
      // Mark as rewarded
      await connection.query(
        'UPDATE referral_uses SET status = "REWARDED", rewarded_at = NOW() WHERE id = ?',
        [refUse.id]
      );

      // Increment referrer's balance
      await connection.query(
        'UPDATE users SET balance = balance + ? WHERE id = ?',
        [referrerRewardCoins, refUse.referrer_id]
      );

      // Log transaction double-entry ledger for referrer
      const transId = uuidv4();
      await connection.query(
        `INSERT INTO transactions (id, user_id, amount, type, source, description, reference_id, created_at) 
         VALUES (?, ?, ?, 'CREDIT', 'REFERRAL_BONUS', ?, ?, NOW())`,
        [transId, refUse.referrer_id, referrerRewardCoins, descriptionText, refUse.id]
      );

      // Push notify referrer
      sendNotification(
        refUse.referrer_id,
        "Referral Milestone Completed! 🏆",
        `Congratulations! You earned ${referrerRewardCoins.toFixed(0)} coins because your referred friend completed their referral milestone.`
      ).catch(err => console.error('Referrer push error:', err));
    }
  } catch (error) {
    console.error('Error in checkAndRewardReferrer:', error.message);
  }
}
