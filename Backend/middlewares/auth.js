import jwt from 'jsonwebtoken';
import pool from '../db.js';

// Decodes legacy token in format Base64(userId:timestamp)
export function parseLegacyToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64').toString('ascii');
    const [userId, timestamp] = decoded.split(':');
    if (userId && timestamp) {
      return userId;
    }
  } catch (err) {
    // Suppress error and return null
  }
  return null;
}

// User Authentication Middleware
export async function authenticateUser(req, res, next) {
  try {
    let token = null;

    // 1. Check Authorization Header
    if (req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        token = parts[1];
      } else {
        token = req.headers.authorization;
      }
    }

    // 2. Check Query Params or Body for user_id/token (Legacy support)
    if (!token) {
      token = req.query.token || req.query.user_id || req.body.user_id;
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication token required' });
    }

    let userId = null;

    // Try parsing as JWT first
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'rewardverse_super_secret_jwt_key_2026');
      userId = decoded.id;
    } catch (err) {
      // If JWT fails, try parsing as legacy token
      userId = parseLegacyToken(token);
    }

    // If both failed, check if token itself is the raw User ID
    if (!userId && token.length === 36) {
      userId = token; // Direct UUID support
    }

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Invalid authentication token' });
    }

    // Fetch user from DB by id or uid
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ? OR uid = ? LIMIT 1', [userId, userId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    req.user = rows[0];
    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}

// Admin Authentication Middleware
export async function authenticateAdmin(req, res, next) {
  try {
    let token = null;
    if (req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        token = parts[1];
      }
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Admin authentication token required' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'rewardverse_super_secret_jwt_key_2026');
      if (decoded.role === 'admin') {
        req.admin = decoded;
        return next();
      }
    } catch (err) {
      // Fallback/direct key match
      if (token === process.env.ADMIN_PASSWORD || token === 'admin_rewardverse_secure_pass') {
        req.admin = { role: 'admin' };
        return next();
      }
    }

    res.status(403).json({ success: false, message: 'Admin access denied' });
  } catch (error) {
    console.error('Admin Auth Middleware Error:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}

// App Check verification placeholder (Optional/Non-blocking in dev)
export function verifyAppCheck(req, res, next) {
  const token = req.headers['x-firebase-app-check'];
  
  if (process.env.NODE_ENV === 'production' && !token) {
    return res.status(401).json({ success: false, message: 'Missing App Check Token' });
  }
  
  // Log token or pass
  next();
}
