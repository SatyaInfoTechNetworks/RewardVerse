import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

/**
 * Transactionally records a wallet balance update and appends a tamper-evident double-entry log in transactions table.
 * 
 * @param {Object} connection - MySQL pool connection running inside a transaction session.
 * @param {Object} params - Ledger transaction parameters.
 * @param {string} params.userId - Internal UUID of the target user.
 * @param {number} params.amount - Coin amount to add/subtract.
 * @param {string} params.type - 'CREDIT' or 'DEBIT'.
 * @param {string} params.source - Transaction origin source (e.g. 'OFFLINE_OFFER', 'DAILY_CHECKIN').
 * @param {string} [params.referenceId] - Optional external tracking ID (e.g. click_id, postback_id).
 * @param {string} [params.description] - Human readable memo description.
 */
export async function recordLedgerTransaction(connection, { userId, amount, type, source, referenceId = null, description = '' }) {
  if (!connection) {
    throw new Error('Connection with an active transaction is required');
  }
  if (!userId || amount === undefined || !type || !source) {
    throw new Error('Missing required transaction parameters');
  }

  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount < 0) {
    throw new Error('Amount must be a non-negative number');
  }

  // 1. Lock and fetch current balance (Strict thread safety)
  const [userRows] = await connection.query(
    'SELECT balance FROM users WHERE id = ? FOR UPDATE',
    [userId]
  );

  if (userRows.length === 0) {
    throw new Error(`User with ID ${userId} not found for ledger logging`);
  }

  const openingBalance = parseFloat(userRows[0].balance || 0);
  let closingBalance = openingBalance;

  if (type === 'CREDIT') {
    closingBalance = openingBalance + numericAmount;
  } else if (type === 'DEBIT') {
    closingBalance = openingBalance - numericAmount;
    if (closingBalance < 0) {
      throw new Error(`Insufficient funds: transaction of debit ${numericAmount} rejected for opening balance ${openingBalance}`);
    }
  } else {
    throw new Error(`Invalid transaction type: ${type}`);
  }

  // 2. Generate secure cryptographic signature to prevent manual database tampering
  const ledgerSecret = process.env.LEDGER_SECRET || 'rewardverse_super_secret_ledger_key_2026';
  const signString = `${userId}:${numericAmount.toFixed(2)}:${type}:${openingBalance.toFixed(2)}:${closingBalance.toFixed(2)}:${source}:${referenceId || 'null'}`;
  const tamperSignature = crypto
    .createHmac('sha256', ledgerSecret)
    .update(signString)
    .digest('hex');

  // 3. Write transaction log complete with audit parameters
  const transId = uuidv4();
  await connection.query(
    `INSERT INTO transactions (id, user_id, amount, type, source, reference_id, description, opening_balance, closing_balance, tamper_signature, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      transId,
      userId,
      numericAmount,
      type,
      source,
      referenceId,
      description,
      openingBalance,
      closingBalance,
      tamperSignature
    ]
  );

  // 4. Commit actual balance write back to users table
  await connection.query(
    'UPDATE users SET balance = ? WHERE id = ?',
    [closingBalance, userId]
  );

  return {
    transactionId: transId,
    openingBalance,
    closingBalance,
    tamperSignature
  };
}
