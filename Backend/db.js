import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = process.env.DB_URL
  ? mysql.createPool(process.env.DB_URL)
  : mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'rewardverse_user',
      password: process.env.DB_PASSWORD || 'Rewardverse@123',
      database: process.env.DB_NAME || 'rewardverse_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });

// Test connection and log statuses
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Connected to MySQL database successfully.');
    connection.release();
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
  }
})();

export default pool;
