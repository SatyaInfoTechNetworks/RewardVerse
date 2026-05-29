import crypto from 'crypto';
import pool from '../db.js';

// Character set: 10-character hexadecimal (0-9, a-f)
const CHARS = '0123456789abcdef';

/**
 * Generates a cryptographically random 10-character hexadecimal user ID.
 * Format example: "3f7a2d9b6c"
 */
export function generateUserId() {
  const bytes = crypto.randomBytes(10);
  let id = '';
  for (let i = 0; i < 10; i++) {
    id += CHARS[bytes[i] % CHARS.length];
  }
  return id;
}

/**
 * Generates a unique user ID that doesn't already exist in the DB.
 * Retries up to 10 times on collision (practically impossible but safe).
 */
export async function generateUniqueUserId() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const id = generateUserId();
    const [rows] = await pool.query('SELECT 1 FROM users WHERE user_id = ? LIMIT 1', [id]);
    if (rows.length === 0) return id;
  }
  throw new Error('Failed to generate unique user_id after 10 attempts');
}
