import pool from './db.js';

async function addColumnIfNotExists(connection, tableName, columnName, columnDefinition) {
  try {
    const [rows] = await connection.query(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
    if (rows.length === 0) {
      console.log(`➕ Adding column [${columnName}] to table [${tableName}]...`);
      await connection.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
    }
  } catch (error) {
    console.error(`❌ Error adding column [${columnName}] to [${tableName}]:`, error);
  }
}

async function migrateColumnToVarcharIfNumeric(connection, tableName, columnName, size = 100) {
  try {
    const [rows] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [columnName]);
    if (rows.length > 0 && rows[0].Type) {
      const type = rows[0].Type.toLowerCase();
      if (type.includes('int') || type.includes('decimal') || type.includes('double') || type.includes('float')) {
        console.log(`⚡ Legacy numeric column detected: [${tableName}.${columnName}] (${type}). Migrating to VARCHAR(${size})...`);

        if (rows[0].Extra && rows[0].Extra.toLowerCase().includes('auto_increment')) {
          console.log(`  🔧 Removing AUTO_INCREMENT from [${tableName}.${columnName}]...`);
          await connection.query(`ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${columnName}\` ${rows[0].Type} NOT NULL`).catch(err => {
            console.warn(`  ⚠️ Warning during auto_increment removal:`, err.message);
          });
        }

        const dbName = (await connection.query('SELECT DATABASE() as db'))[0][0].db;
        const [fkRows] = await connection.query(`
          SELECT kcu.TABLE_NAME, kcu.CONSTRAINT_NAME, kcu.COLUMN_NAME
          FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
          JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
            ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME AND kcu.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
          WHERE rc.REFERENCED_TABLE_NAME = ?
            AND kcu.REFERENCED_COLUMN_NAME = ?
            AND kcu.TABLE_SCHEMA = ?
        `, [tableName, columnName, dbName]);

        for (const fk of fkRows) {
          console.log(`  🔧 Dropping FK [${fk.CONSTRAINT_NAME}] on [${fk.TABLE_NAME}.${fk.COLUMN_NAME}]...`);
          await connection.query(`ALTER TABLE \`${fk.TABLE_NAME}\` DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``).catch(() => { });
          await connection.query(`ALTER TABLE \`${fk.TABLE_NAME}\` MODIFY COLUMN \`${fk.COLUMN_NAME}\` VARCHAR(${size}) NOT NULL`).catch((e) => {
            console.warn(`  ⚠️ Could not modify referencing column ${fk.TABLE_NAME}.${fk.COLUMN_NAME}:`, e.message);
          });
        }

        await connection.query(`ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${columnName}\` VARCHAR(${size}) NOT NULL`);
        console.log(`✅ [${tableName}.${columnName}] migrated to VARCHAR(${size}).`);
      }
    }
  } catch (error) {
    console.error(`❌ Error migrating [${tableName}.${columnName}] to VARCHAR:`, error);
  }
}

async function sweepLegacyColumnsForDefaults(connection, tableName) {
  try {
    const dbName = (await connection.query('SELECT DATABASE() as db'))[0][0].db;
    const [cols] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        AND IS_NULLABLE = 'NO' AND COLUMN_DEFAULT IS NULL AND COLUMN_KEY != 'PRI'
        AND EXTRA NOT LIKE '%auto_increment%'
    `, [dbName, tableName]);

    for (const col of cols) {
      const dt = col.DATA_TYPE.toLowerCase();
      let def = (dt.includes('int') || dt.includes('decimal') || dt.includes('float') || dt.includes('double') || dt.includes('bit')) ? '0'
        : (dt.includes('timestamp') || dt.includes('datetime') ? 'CURRENT_TIMESTAMP' : "''");
      console.log(`  🔧 Setting default for legacy ${tableName} column [${col.COLUMN_NAME}] → DEFAULT ${def}`);
      await connection.query(`ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${col.COLUMN_NAME}\` ${col.COLUMN_TYPE} NOT NULL DEFAULT ${def}`).catch(e => {
        console.warn(`  ⚠️ Could not set default for ${tableName}.[${col.COLUMN_NAME}]:`, e.message);
      });
    }
  } catch (error) {
    console.error(`❌ Error sweeping defaults for ${tableName}:`, error);
  }
}

export async function initializeDatabase() {
  console.log('🔄 Checking and initializing database tables...');
  let connection;
  try {
    connection = await pool.getConnection();

    // 1. users Table (CHAR(36) UUID aligned)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id CHAR(36) PRIMARY KEY,
        uid VARCHAR(255) UNIQUE NOT NULL,
        phone_number VARCHAR(20),
        name VARCHAR(255),
        profile_pic TEXT,
        location VARCHAR(255),
        balance DECIMAL(10, 2) DEFAULT 0.00,
        referral_code VARCHAR(50) UNIQUE,
        referred_by CHAR(36),
        android_id VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (referred_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Add extra user columns for new features
    await addColumnIfNotExists(connection, 'users', 'fcm_token', 'TEXT NULL');
    await addColumnIfNotExists(connection, 'users', 'daily_spins_count', 'INT DEFAULT 0');
    await addColumnIfNotExists(connection, 'users', 'last_spin_date', 'DATE NULL');
    await addColumnIfNotExists(connection, 'users', 'current_streak', 'INT DEFAULT 0');
    await addColumnIfNotExists(connection, 'users', 'last_streak_claim_date', 'DATE NULL');
    await addColumnIfNotExists(connection, 'users', 'is_banned', 'BOOLEAN DEFAULT FALSE');
    await addColumnIfNotExists(connection, 'users', 'ban_reason', 'TEXT NULL');
    await addColumnIfNotExists(connection, 'users', 'android_id', 'VARCHAR(255) NULL');
    await addColumnIfNotExists(connection, 'users', 'profile_pic', 'TEXT NULL');
    // Custom 10-char hexadecimal public user ID (safe to share, not Firebase UID)
    await addColumnIfNotExists(connection, 'users', 'user_id', 'VARCHAR(10) UNIQUE');

    // ⚠️ Auto-sweep all NOT NULL/no-default columns in users
    await sweepLegacyColumnsForDefaults(connection, 'users');

    // 2. offers Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS offers (
        id CHAR(36) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        icon_url TEXT,
        total_reward DECIMAL(10, 2) DEFAULT 0.00,
        category VARCHAR(100),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await migrateColumnToVarcharIfNumeric(connection, 'offers', 'id', 100);

    // Add extra offer columns for new features
    await addColumnIfNotExists(connection, 'offers', 'likes_count', 'INT DEFAULT 0');
    await addColumnIfNotExists(connection, 'offers', 'is_hot', 'BOOLEAN DEFAULT FALSE');
    await addColumnIfNotExists(connection, 'offers', 'external_id', 'VARCHAR(255) NULL');
    await addColumnIfNotExists(connection, 'offers', 'tracking_url', 'TEXT NULL');
    await addColumnIfNotExists(connection, 'offers', 'type', 'VARCHAR(50) DEFAULT \'online\'');
    await addColumnIfNotExists(connection, 'offers', 'input_type', 'VARCHAR(50) NULL');
    await addColumnIfNotExists(connection, 'offers', 'input_instruction', 'TEXT NULL');
    await addColumnIfNotExists(connection, 'offers', 'reward_type', 'VARCHAR(50) DEFAULT \'Single Reward\'');
    await addColumnIfNotExists(connection, 'offers', 'extra_label', 'VARCHAR(100) NULL');
    await addColumnIfNotExists(connection, 'offers', 'estimated_time', 'VARCHAR(100) NULL');
    await addColumnIfNotExists(connection, 'offers', 'difficulty', 'VARCHAR(50) DEFAULT \'Medium\'');
    await addColumnIfNotExists(connection, 'offers', 'actual_price', 'DECIMAL(10, 2) DEFAULT 0.00');

    // ⚠️ Auto-sweep all NOT NULL/no-default columns in offers
    await sweepLegacyColumnsForDefaults(connection, 'offers');

    // 3. offer_tiers Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS offer_tiers (
        id CHAR(36) PRIMARY KEY,
        offer_id CHAR(36) NOT NULL,
        title VARCHAR(255),
        reward DECIMAL(10, 2) DEFAULT 0.00,
        steps JSON,
        sequence INT DEFAULT 1,
        FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await migrateColumnToVarcharIfNumeric(connection, 'offer_tiers', 'id', 100);

    await addColumnIfNotExists(connection, 'offer_tiers', 'tier_title', 'VARCHAR(255) NULL');
    await addColumnIfNotExists(connection, 'offer_tiers', 'app_tier_title', 'VARCHAR(255) NULL');
    await addColumnIfNotExists(connection, 'offer_tiers', 'status', 'VARCHAR(50) DEFAULT \'ACTIVE\'');

    // ⚠️ Auto-sweep all NOT NULL/no-default columns in offer_tiers
    await sweepLegacyColumnsForDefaults(connection, 'offer_tiers');

    // 4. user_offer_progress Table (CHAR(36) UUID aligned)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_offer_progress (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        offer_id CHAR(36) NOT NULL,
        click_id VARCHAR(255) UNIQUE NULL,
        status ENUM('STARTED', 'COMPLETED') DEFAULT 'STARTED',
        completed_tiers JSON,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await migrateColumnToVarcharIfNumeric(connection, 'user_offer_progress', 'id', 100);
    await addColumnIfNotExists(connection, 'user_offer_progress', 'click_id', 'VARCHAR(255) UNIQUE NULL');
    await addColumnIfNotExists(connection, 'user_offer_progress', 'user_input', 'TEXT NULL');
    await addColumnIfNotExists(connection, 'user_offer_progress', 'admin_status', 'VARCHAR(50) DEFAULT \'PENDING\'');
    await addColumnIfNotExists(connection, 'user_offer_progress', 'admin_remark', 'TEXT NULL');

    // ⚠️ Auto-sweep all NOT NULL/no-default columns in user_offer_progress
    await sweepLegacyColumnsForDefaults(connection, 'user_offer_progress');

    // 5. transactions Table (CHAR(36) UUID aligned)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        type VARCHAR(20) NOT NULL,
        source VARCHAR(50) NOT NULL,
        reference_id VARCHAR(255),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await migrateColumnToVarcharIfNumeric(connection, 'transactions', 'id', 100);
    await addColumnIfNotExists(connection, 'transactions', 'description', 'TEXT NULL');
    await addColumnIfNotExists(connection, 'transactions', 'reference_id', 'VARCHAR(255) NULL');
    await addColumnIfNotExists(connection, 'transactions', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

    // ⚠️ Auto-sweep all NOT NULL/no-default columns in transactions
    await sweepLegacyColumnsForDefaults(connection, 'transactions');

    // 6. withdrawals Table (CHAR(36) UUID aligned)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        method VARCHAR(50) NOT NULL,
        details TEXT,
        status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await migrateColumnToVarcharIfNumeric(connection, 'withdrawals', 'id', 100);

    // Dynamically expand withdrawals table if missing columns from legacy PHP
    await addColumnIfNotExists(connection, 'withdrawals', 'method_id', 'VARCHAR(100) NULL');
    await addColumnIfNotExists(connection, 'withdrawals', 'amount_coins', 'INT DEFAULT 0');
    await addColumnIfNotExists(connection, 'withdrawals', 'amount_currency', 'DECIMAL(10, 2) DEFAULT 0.00');

    // ⚠️ Auto-sweep all NOT NULL/no-default columns in withdrawals
    await sweepLegacyColumnsForDefaults(connection, 'withdrawals');

    // 6a. payout_methods Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS payout_methods (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT NULL,
        icon_url TEXT NULL,
        min_coins INT DEFAULT 0,
        conversion_rate DECIMAL(10, 4) DEFAULT 0.0000,
        currency_symbol VARCHAR(10) DEFAULT '₹',
        processing_time VARCHAR(100) NULL,
        input_type VARCHAR(50) DEFAULT 'text',
        input_label VARCHAR(100) NULL,
        input_placeholder VARCHAR(255) NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // ⚠️ Legacy PHP payout_methods.id may be INT — migrate to VARCHAR(100)
    await migrateColumnToVarcharIfNumeric(connection, 'payout_methods', 'id', 100);

    await addColumnIfNotExists(connection, 'payout_methods', 'description', 'TEXT NULL');
    await addColumnIfNotExists(connection, 'payout_methods', 'icon_url', 'TEXT NULL');
    await addColumnIfNotExists(connection, 'payout_methods', 'min_coins', 'INT DEFAULT 0');
    await addColumnIfNotExists(connection, 'payout_methods', 'conversion_rate', 'DECIMAL(10, 4) DEFAULT 0.0000');
    await addColumnIfNotExists(connection, 'payout_methods', 'currency_symbol', "VARCHAR(10) DEFAULT '₹'");
    await addColumnIfNotExists(connection, 'payout_methods', 'processing_time', 'VARCHAR(100) NULL');
    await addColumnIfNotExists(connection, 'payout_methods', 'input_type', "VARCHAR(50) DEFAULT 'text'");
    await addColumnIfNotExists(connection, 'payout_methods', 'input_label', 'VARCHAR(100) NULL');
    await addColumnIfNotExists(connection, 'payout_methods', 'input_placeholder', 'VARCHAR(255) NULL');
    await addColumnIfNotExists(connection, 'payout_methods', 'is_active', 'BOOLEAN DEFAULT TRUE');
    await addColumnIfNotExists(connection, 'payout_methods', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

    // ⚠️ Auto-sweep all NOT NULL/no-default columns in payout_methods
    await sweepLegacyColumnsForDefaults(connection, 'payout_methods');

    // 6b. payout_tiers Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS payout_tiers (
        id VARCHAR(100) PRIMARY KEY,
        method_id VARCHAR(100) NOT NULL,
        coin_cost INT NOT NULL,
        monetary_value DECIMAL(10, 2) NOT NULL,
        currency_symbol VARCHAR(10) DEFAULT '₹',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (method_id) REFERENCES payout_methods(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // ⚠️ Legacy PHP payout_tiers.id may be INT — migrate to VARCHAR(100)
    await migrateColumnToVarcharIfNumeric(connection, 'payout_tiers', 'id', 100);

    // ⚠️ Legacy PHP payout_tiers uses 'payout_method_id' instead of 'method_id' — rename it
    try {
      const [pmCol] = await connection.query(`SHOW COLUMNS FROM payout_tiers LIKE 'payout_method_id'`);
      if (pmCol.length > 0) {
        console.log('⚡ Renaming payout_tiers.payout_method_id → method_id...');
        // Drop any FK on payout_method_id first
        const dbNameT = (await connection.query('SELECT DATABASE() as db'))[0][0].db;
        const [fkT] = await connection.query(`
          SELECT kcu.CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
          JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
            ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME AND kcu.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
          WHERE kcu.TABLE_SCHEMA = ? AND kcu.TABLE_NAME = 'payout_tiers' AND kcu.COLUMN_NAME = 'payout_method_id'
        `, [dbNameT]);
        for (const fk of fkT) {
          await connection.query(`ALTER TABLE payout_tiers DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``).catch(() => { });
        }
        await connection.query(`ALTER TABLE payout_tiers CHANGE COLUMN payout_method_id method_id VARCHAR(100) NOT NULL`);
        console.log('✅ payout_tiers.payout_method_id renamed to method_id.');
      }
    } catch (e) {
      console.warn('⚠️ payout_tiers column rename note:', e.message);
    }

    // ⚠️ Ensure payout_tiers missing columns exist
    await addColumnIfNotExists(connection, 'payout_tiers', 'method_id', 'VARCHAR(100) NOT NULL DEFAULT \'\'');
    await addColumnIfNotExists(connection, 'payout_tiers', 'coin_cost', 'INT NOT NULL DEFAULT 0');
    await addColumnIfNotExists(connection, 'payout_tiers', 'monetary_value', 'DECIMAL(10,2) NOT NULL DEFAULT 0.00');
    await addColumnIfNotExists(connection, 'payout_tiers', 'currency_symbol', "VARCHAR(10) DEFAULT '₹'");
    await addColumnIfNotExists(connection, 'payout_tiers', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

    // ⚠️ Auto-sweep all NOT NULL/no-default columns in payout_tiers
    await sweepLegacyColumnsForDefaults(connection, 'payout_tiers');

    // 7. app_configs Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS app_configs (
        config_key VARCHAR(100) PRIMARY KEY,
        config_value TEXT NOT NULL,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 8. streaks Table (CHAR(36) UUID aligned)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS streaks (
        user_id CHAR(36) PRIMARY KEY,
        current_streak INT DEFAULT 0,
        last_claim_date DATE NULL,
        total_claims INT DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 9. lucky_spins Table (CHAR(36) UUID aligned)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS lucky_spins (
        user_id CHAR(36) PRIMARY KEY,
        spins_left INT DEFAULT 2,
        last_spin_date DATE NULL,
        total_spins INT DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 10. banners Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS banners (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NULL,
        description TEXT NULL,
        image_url TEXT NOT NULL,
        action_url TEXT NULL,
        display_order INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await addColumnIfNotExists(connection, 'banners', 'title', 'VARCHAR(255) NULL');
    await addColumnIfNotExists(connection, 'banners', 'description', 'TEXT NULL');
    await addColumnIfNotExists(connection, 'banners', 'action_url', 'TEXT NULL');
    await addColumnIfNotExists(connection, 'banners', 'display_order', 'INT DEFAULT 0');
    await addColumnIfNotExists(connection, 'banners', 'is_active', 'BOOLEAN DEFAULT TRUE');
    await addColumnIfNotExists(connection, 'banners', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

    // Fix legacy fields in banners if necessary
    try {
      await connection.query("ALTER TABLE banners MODIFY COLUMN active TINYINT(1) NOT NULL DEFAULT 1");
    } catch (e) { /* safe to ignore */ }
    try {
      await connection.query("ALTER TABLE banners MODIFY COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1");
    } catch (e) { /* safe to ignore */ }
    try {
      await connection.query("ALTER TABLE banners MODIFY COLUMN order_index INT NOT NULL DEFAULT 0");
    } catch (e) { /* safe to ignore */ }
    await addColumnIfNotExists(connection, 'banners', 'order_index', 'INT NOT NULL DEFAULT 0');

    // 11. lifafas Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS lifafas (
        id CHAR(36) PRIMARY KEY,
        lifafa_id VARCHAR(100) UNIQUE NOT NULL,
        bonus_amount DECIMAL(10, 2) NOT NULL,
        total_limit INT NOT NULL,
        claimed_count INT DEFAULT 0,
        required_offer_id CHAR(36) NULL,
        required_offers_count INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        expires_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 12. lifafa_claims Table (CHAR(36) UUID aligned)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS lifafa_claims (
        id CHAR(36) PRIMARY KEY,
        lifafa_id VARCHAR(100) NOT NULL,
        user_id CHAR(36) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 13. telegram_verification Table (CHAR(36) UUID aligned)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS telegram_verification (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NULL,
        verify_token VARCHAR(255) UNIQUE NULL,
        telegram_user_id VARCHAR(255) NULL,
        click_id VARCHAR(255) UNIQUE NULL,
        status VARCHAR(20) DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 14. tickets Table (CHAR(36) UUID aligned)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        status ENUM('OPEN', 'REPLIED', 'CLOSED') DEFAULT 'OPEN',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 15. ticket_replies Table (CHAR(36) UUID aligned)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS ticket_replies (
        id CHAR(36) PRIMARY KEY,
        ticket_id CHAR(36) NOT NULL,
        user_id CHAR(36) NULL,
        sender_type ENUM('USER', 'ADMIN') NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 16. offer_likes Table (CHAR(36) UUID aligned)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS offer_likes (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        offer_id CHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_like (user_id, offer_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 17. deletion_requests Table (CHAR(36) UUID aligned)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS deletion_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id CHAR(36) NULL,
        email VARCHAR(255) NOT NULL,
        reason TEXT NULL,
        status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 18. referral_settings Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS referral_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bonus_coins DECIMAL(10, 2) DEFAULT 10.00,
        commission_percent INT DEFAULT 10,
        offers_required INT DEFAULT 2
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 19. referral_uses Table (CHAR(36) UUID aligned)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS referral_uses (
        id CHAR(36) PRIMARY KEY,
        referrer_id CHAR(36) NOT NULL,
        referred_user_id CHAR(36) NOT NULL,
        referral_code VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'PENDING',
        offers_completed_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (referred_user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 20. notifications (Push History) Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id CHAR(36) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        target_type VARCHAR(50) NOT NULL DEFAULT 'broadcast',
        target_user_id VARCHAR(255) NULL,
        sent_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await addColumnIfNotExists(connection, 'notifications', 'target_user_id', 'VARCHAR(255) NULL');
    await addColumnIfNotExists(connection, 'notifications', 'sent_count', 'INT DEFAULT 0');
    await addColumnIfNotExists(connection, 'notifications', 'image_url', 'VARCHAR(255) NULL');
    await addColumnIfNotExists(connection, 'notifications', 'target_topic', 'VARCHAR(50) NULL');
    await addColumnIfNotExists(connection, 'notifications', 'status', 'VARCHAR(20) DEFAULT "sent"');
    await addColumnIfNotExists(connection, 'notifications', 'success_count', 'INT DEFAULT 0');
    await addColumnIfNotExists(connection, 'notifications', 'failure_count', 'INT DEFAULT 0');

    // referral_settings migrations
    await addColumnIfNotExists(connection, 'referral_settings', 'description_text', 'TEXT NULL');
    await addColumnIfNotExists(connection, 'referral_settings', 'referee_signup_bonus', 'DECIMAL(10, 2) DEFAULT 0.00');
    await addColumnIfNotExists(connection, 'referral_settings', 'referrer_reward_coins', 'DECIMAL(10, 2) DEFAULT 10.00');
    await addColumnIfNotExists(connection, 'referral_settings', 'referral_condition_type', "VARCHAR(50) DEFAULT 'MIN_TASKS'");
    await addColumnIfNotExists(connection, 'referral_settings', 'referral_condition_threshold', 'DECIMAL(10, 2) DEFAULT 2.00');
    await addColumnIfNotExists(connection, 'referral_settings', 'is_commission_active', 'BOOLEAN DEFAULT TRUE');
    await addColumnIfNotExists(connection, 'referral_settings', 'commission_enabled', 'TINYINT(1) DEFAULT 1');
    await addColumnIfNotExists(connection, 'referral_settings', 'reward_trigger', "VARCHAR(50) DEFAULT 'offers_completed'");
    await addColumnIfNotExists(connection, 'referral_settings', 'coin_threshold', 'DECIMAL(10, 2) DEFAULT 500.00');
    await addColumnIfNotExists(connection, 'referral_settings', 'referrer_coins', 'DECIMAL(10, 2) DEFAULT 100.00');

    // 25. visit_earn_tasks Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS visit_earn_tasks (
        id CHAR(36) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        coins INT NOT NULL DEFAULT 0,
        visit_url TEXT NOT NULL,
        timer_seconds INT DEFAULT 30,
        is_ad BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 26. user_visit_progress Table (CHAR(36) UUID aligned)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_visit_progress (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        task_id CHAR(36) NOT NULL,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES visit_earn_tasks(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 21. offer_completions Table (CHAR(36) UUID aligned)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS offer_completions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        completion_id VARCHAR(255) UNIQUE NOT NULL,
        user_id CHAR(36) NOT NULL,
        offer_id VARCHAR(100) NULL,
        provider VARCHAR(100) NULL,
        payout_coins DECIMAL(10, 2) DEFAULT 0.00,
        status VARCHAR(50) DEFAULT 'COMPLETED',
        raw_payload TEXT NULL,
        offer_name VARCHAR(255) NULL,
        goal_name VARCHAR(255) NULL,
        gaid VARCHAR(255) NULL,
        ip_address VARCHAR(255) NULL,
        validated_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 23. device_fingerprints Table (CHAR(36) UUID aligned)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS device_fingerprints (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        android_id VARCHAR(255) NOT NULL,
        device_model VARCHAR(100) NULL,
        os_version VARCHAR(50) NULL,
        app_version VARCHAR(20) NULL,
        ip_address VARCHAR(45) NOT NULL,
        is_emulator BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_device_user (android_id, user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 24. admin_audit_logs Table (CHAR(36) UUID aligned)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id CHAR(36) PRIMARY KEY,
        admin_id CHAR(36) NOT NULL,
        action_type VARCHAR(50) NOT NULL,
        target_id VARCHAR(255) NULL,
        payload JSON NULL,
        ip_address VARCHAR(45) NOT NULL,
        user_agent TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 27. contests Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS contests (
        id CHAR(36) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NULL,
        type VARCHAR(50) NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        max_entries_per_day INT DEFAULT 3,
        total_winners INT DEFAULT 1,
        status ENUM('ACTIVE', 'COMPLETED', 'CANCELLED') DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 28. contest_rewards Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS contest_rewards (
        id CHAR(36) PRIMARY KEY,
        contest_id CHAR(36) NOT NULL,
        reward_position INT NOT NULL,
        reward_type ENUM('COINS', 'CASH', 'GIFTCARD') NOT NULL,
        reward_value DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 29. contest_entries Table (CHAR(36) UUID aligned)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS contest_entries (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        contest_id CHAR(36) NOT NULL,
        entry_source VARCHAR(50) NOT NULL,
        entries_count INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 30. contest_winners Table (CHAR(36) UUID aligned)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS contest_winners (
        id CHAR(36) PRIMARY KEY,
        contest_id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        reward_position INT NOT NULL,
        reward_type ENUM('COINS', 'CASH', 'GIFTCARD') NOT NULL,
        reward_value DECIMAL(10, 2) NOT NULL,
        reward_given BOOLEAN DEFAULT FALSE,
        selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 31. contest_participants Table (CHAR(36) UUID aligned)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS contest_participants (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        contest_id CHAR(36) NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_contest_participation (user_id, contest_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 32. other_apps Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS other_apps (
        id CHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        icon_url TEXT NOT NULL,
        description TEXT NULL,
        app_url TEXT NOT NULL,
        display_order INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Extra Columns Migrations
    await addColumnIfNotExists(connection, 'offers', 'daily_completion_cap', 'INT DEFAULT 0');
    await addColumnIfNotExists(connection, 'offers', 'country_targeting', 'VARCHAR(255) DEFAULT \'IN\'');

    // Sweepstakes / Contests Configuration Migrations
    await addColumnIfNotExists(connection, 'contests', 'slug', 'VARCHAR(255) NULL');
    await addColumnIfNotExists(connection, 'contests', 'banner_image', 'TEXT NULL');
    await addColumnIfNotExists(connection, 'contests', 'prize_text', 'VARCHAR(255) NULL');
    await addColumnIfNotExists(connection, 'contests', 'allow_free_entry', 'BOOLEAN DEFAULT TRUE');
    await addColumnIfNotExists(connection, 'contests', 'allow_ad_entry', 'BOOLEAN DEFAULT TRUE');
    await addColumnIfNotExists(connection, 'contests', 'max_ad_entries_per_day', 'INT DEFAULT 3');
    await addColumnIfNotExists(connection, 'contests', 'allow_coins_entry', 'BOOLEAN DEFAULT FALSE');
    await addColumnIfNotExists(connection, 'contests', 'ticket_coins_cost', 'DECIMAL(10, 2) DEFAULT 0.00');
    await addColumnIfNotExists(connection, 'contests', 'max_tickets_per_user', 'INT DEFAULT 10');
    await addColumnIfNotExists(connection, 'contests', 'ad_entry_cooldown', 'INT DEFAULT 0');

    // Payout and Withdrawals Migrations (Added missing columns)
    await addColumnIfNotExists(connection, 'payout_methods', 'requires_redeem_code', 'BOOLEAN DEFAULT FALSE');
    await addColumnIfNotExists(connection, 'withdrawals', 'redeem_code', 'VARCHAR(255) NULL');

    await addColumnIfNotExists(connection, 'transactions', 'opening_balance', 'DECIMAL(10, 2) DEFAULT NULL');
    await addColumnIfNotExists(connection, 'transactions', 'closing_balance', 'DECIMAL(10, 2) DEFAULT NULL');
    await addColumnIfNotExists(connection, 'transactions', 'tamper_signature', 'VARCHAR(64) DEFAULT NULL');
    await addColumnIfNotExists(connection, 'referral_uses', 'rewarded_at', 'TIMESTAMP NULL');

    // Ensure transactions and withdrawals column types are flexible (legacy ENUM to VARCHAR)
    try {
      console.log('⚡ Ensuring column types are flexible (legacy ENUM to VARCHAR)...');
      await connection.query('ALTER TABLE transactions MODIFY COLUMN type VARCHAR(20) NOT NULL');
      await connection.query('ALTER TABLE transactions MODIFY COLUMN source VARCHAR(50) NOT NULL');
      await connection.query('ALTER TABLE transactions MODIFY COLUMN reference_id VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL').catch(() => { });
      await connection.query('ALTER TABLE withdrawals MODIFY COLUMN method VARCHAR(50) NOT NULL');
      await connection.query('ALTER TABLE withdrawals MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT \'PENDING\'');
      await connection.query('ALTER TABLE contest_entries MODIFY COLUMN entry_source VARCHAR(50) NOT NULL');
      await connection.query('ALTER TABLE contests MODIFY COLUMN type VARCHAR(50) NOT NULL');
      console.log('✅ Column type flexibility optimized successfully.');
    } catch (alterErr) {
      console.warn('⚠️ Warning during column type alterations:', alterErr.message);
    }

    // Index Optimizations
    try {
      console.log('⚡ Ensuring index optimizations...');
      await connection.query('CREATE INDEX idx_user_offer_status ON user_offer_progress (user_id, offer_id, status)').catch(() => { });
      await connection.query('CREATE INDEX idx_offer_type_status ON user_offer_progress (admin_status, last_updated DESC)').catch(() => { });
      await connection.query('CREATE INDEX idx_user_trans_date ON transactions (user_id, created_at DESC)').catch(() => { });
      await connection.query('CREATE INDEX idx_offer_active_hot ON offers (is_active, is_hot)').catch(() => { });
      
      // Drop unique index from contest_entries to allow multiple daily tracking rows
      await connection.query('CREATE INDEX idx_contest_entries_user_id ON contest_entries (user_id)').catch(() => { });
      await connection.query('ALTER TABLE contest_entries DROP INDEX unique_user_contest_source').catch(() => { });
      console.log('✅ Checked and dropped unique_user_contest_source from contest_entries if existed.');
    } catch (idxErr) {
      console.log('⚠️ Index creation info:', idxErr.message);
    }

    // Migrate legacy profile pic data
    try {
      await connection.query('UPDATE users SET profile_pic = photo_url WHERE (profile_pic IS NULL OR profile_pic = "") AND photo_url IS NOT NULL AND photo_url != ""');
    } catch (migErr) {
      console.log('⚠️ Legacy profile_pic migration note:', migErr.message);
    }

    // Migrate legacy transaction_id → reference_id for old PHP records
    try {
      await connection.query(
        'UPDATE transactions SET reference_id = transaction_id WHERE (reference_id IS NULL OR reference_id = "") AND transaction_id IS NOT NULL AND transaction_id != ""'
      );
    } catch (txMigErr) {
      console.log('⚠️ Legacy transaction_id migration note (safe to ignore if column does not exist):', txMigErr.message);
    }

    // Seed default configurations (Branded to Rewardverse)
    try {
      console.log('⚡ Seeding default configurations...');
      await connection.query(
        `INSERT INTO app_configs (config_key, config_value, description) 
         VALUES ('telegram_channel_username', '@Rewardverse', 'Telegram channel username for task verification')
         ON DUPLICATE KEY UPDATE config_value = IF(config_value = '@stuearn' OR config_value = 'stuearn' OR config_value = '@SatyainfotechNetworks', '@Rewardverse', config_value)`
      );
      await connection.query(
        `INSERT INTO app_configs (config_key, config_value, description) 
         VALUES ('telegram_bot_username', 'rewardverse_verification_bot', 'Telegram bot username for task verification')
         ON DUPLICATE KEY UPDATE config_value = IF(config_value = 'stuearn_bot' OR config_value = 'sit_verification_bot', 'rewardverse_verification_bot', config_value)`
      );
    } catch (confErr) {
      console.log('⚠️ Error seeding default configurations:', confErr.message);
    }

    console.log('✅ All database tables checked/created successfully.');
  } catch (error) {
    console.error('❌ Error initializing database tables:', error);
    throw error;
  } finally {
    if (connection) connection.release();
  }
}
