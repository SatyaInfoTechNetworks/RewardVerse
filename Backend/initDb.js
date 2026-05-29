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

export async function initializeDatabase() {
  console.log('🔄 Checking and initializing database tables...');
  let connection;
  try {
    connection = await pool.getConnection();

    // 1. users Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        uid VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone_number VARCHAR(20),
        name VARCHAR(255),
        profile_pic TEXT,
        location VARCHAR(255),
        balance DECIMAL(10, 2) DEFAULT 0.00,
        referral_code VARCHAR(50) UNIQUE,
        referred_by BIGINT,
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

    await addColumnIfNotExists(connection, 'offer_tiers', 'tier_title', 'VARCHAR(255) NULL');
    await addColumnIfNotExists(connection, 'offer_tiers', 'app_tier_title', 'VARCHAR(255) NULL');
    await addColumnIfNotExists(connection, 'offer_tiers', 'status', 'VARCHAR(50) DEFAULT \'ACTIVE\'');

    // 4. user_offer_progress Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_offer_progress (
        id CHAR(36) PRIMARY KEY,
        user_id BIGINT NOT NULL,
        offer_id CHAR(36) NOT NULL,
        click_id VARCHAR(255) UNIQUE NULL,
        status ENUM('STARTED', 'COMPLETED') DEFAULT 'STARTED',
        completed_tiers JSON,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await addColumnIfNotExists(connection, 'user_offer_progress', 'click_id', 'VARCHAR(255) UNIQUE NULL');
    await addColumnIfNotExists(connection, 'user_offer_progress', 'user_input', 'TEXT NULL');
    await addColumnIfNotExists(connection, 'user_offer_progress', 'admin_status', 'VARCHAR(50) DEFAULT \'PENDING\'');
    await addColumnIfNotExists(connection, 'user_offer_progress', 'admin_remark', 'TEXT NULL');

    // 5. transactions Table
    // Let's modify the ENUM values safely or use simple VARCHAR for source/type to be flexible.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id CHAR(36) PRIMARY KEY,
        user_id BIGINT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        type VARCHAR(20) NOT NULL,
        source VARCHAR(50) NOT NULL,
        reference_id VARCHAR(255),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await addColumnIfNotExists(connection, 'transactions', 'description', 'TEXT NULL');
    // ⚠️ Legacy tables may not have these columns — ensure they exist
    await addColumnIfNotExists(connection, 'transactions', 'reference_id', 'VARCHAR(255) NULL');
    await addColumnIfNotExists(connection, 'transactions', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

    // 6. withdrawals Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id CHAR(36) PRIMARY KEY,
        user_id BIGINT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        method VARCHAR(50) NOT NULL,
        details TEXT,
        status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Dynamically expand withdrawals table if missing columns from legacy PHP
    await addColumnIfNotExists(connection, 'withdrawals', 'method_id', 'VARCHAR(100) NULL');
    await addColumnIfNotExists(connection, 'withdrawals', 'amount_coins', 'INT DEFAULT 0');
    await addColumnIfNotExists(connection, 'withdrawals', 'amount_currency', 'DECIMAL(10, 2) DEFAULT 0.00');

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

    // 7. app_configs Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS app_configs (
        config_key VARCHAR(100) PRIMARY KEY,
        config_value TEXT NOT NULL,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 8. streaks Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS streaks (
        user_id BIGINT PRIMARY KEY,
        current_streak INT DEFAULT 0,
        last_claim_date DATE NULL,
        total_claims INT DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 9. lucky_spins Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS lucky_spins (
        user_id BIGINT PRIMARY KEY,
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
    // ⚠️ Legacy banners table may not have created_at — ensure it exists
    await addColumnIfNotExists(connection, 'banners', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    // ⚠️ Legacy PHP banners table may have 'active' column without a default — fix it
    try {
      await connection.query("ALTER TABLE banners MODIFY COLUMN active TINYINT(1) NOT NULL DEFAULT 1");
    } catch (e) { /* column doesn't exist, safe to ignore */ }
    // Ensure is_active exists and has correct type
    try {
      await connection.query("ALTER TABLE banners MODIFY COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1");
    } catch (e) { /* safe to ignore */ }

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

    // 12. lifafa_claims Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS lifafa_claims (
        id CHAR(36) PRIMARY KEY,
        lifafa_id VARCHAR(100) NOT NULL,
        user_id BIGINT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 13. telegram_verification Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS telegram_verification (
        id CHAR(36) PRIMARY KEY,
        user_id BIGINT NULL,
        verify_token VARCHAR(255) UNIQUE NULL,
        telegram_user_id VARCHAR(255) NULL,
        click_id VARCHAR(255) UNIQUE NULL,
        status VARCHAR(20) DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 14. tickets Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id CHAR(36) PRIMARY KEY,
        user_id BIGINT NOT NULL,
        subject VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        status ENUM('OPEN', 'REPLIED', 'CLOSED') DEFAULT 'OPEN',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 15. ticket_replies Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS ticket_replies (
        id CHAR(36) PRIMARY KEY,
        ticket_id CHAR(36) NOT NULL,
        user_id BIGINT NULL,
        sender_type ENUM('USER', 'ADMIN') NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 16. offer_likes Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS offer_likes (
        id CHAR(36) PRIMARY KEY,
        user_id BIGINT NOT NULL,
        offer_id CHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_like (user_id, offer_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 17. deletion_requests Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS deletion_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT NULL,
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

    // 19. referral_uses Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS referral_uses (
        id CHAR(36) PRIMARY KEY,
        referrer_id BIGINT NOT NULL,
        referred_user_id BIGINT NOT NULL,
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

    // 22. referral_settings: ensure description_text column exists
    await addColumnIfNotExists(connection, 'referral_settings', 'description_text', 'TEXT NULL');
    await addColumnIfNotExists(connection, 'referral_settings', 'referee_signup_bonus', 'DECIMAL(10, 2) DEFAULT 0.00');
    await addColumnIfNotExists(connection, 'referral_settings', 'referrer_reward_coins', 'DECIMAL(10, 2) DEFAULT 10.00');
    await addColumnIfNotExists(connection, 'referral_settings', 'referral_condition_type', "VARCHAR(50) DEFAULT 'MIN_TASKS'");
    await addColumnIfNotExists(connection, 'referral_settings', 'referral_condition_threshold', 'DECIMAL(10, 2) DEFAULT 2.00');

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

    // 26. user_visit_progress Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_visit_progress (
        id CHAR(36) PRIMARY KEY,
        user_id BIGINT NOT NULL,
        task_id CHAR(36) NOT NULL,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES visit_earn_tasks(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 21. offer_completions Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS offer_completions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        completion_id VARCHAR(255) UNIQUE NOT NULL,
        user_id BIGINT NOT NULL,
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

    // 23. device_fingerprints Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS device_fingerprints (
        id CHAR(36) PRIMARY KEY,
        user_id BIGINT NOT NULL,
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

    // 24. admin_audit_logs Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id CHAR(36) PRIMARY KEY,
        admin_id BIGINT NOT NULL,
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
        type ENUM('LUCKY_DRAW', 'REFERRAL', 'EARNINGS') NOT NULL,
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

    // 29. contest_entries Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS contest_entries (
        id CHAR(36) PRIMARY KEY,
        user_id BIGINT NOT NULL,
        contest_id CHAR(36) NOT NULL,
        entry_source ENUM('AD', 'REFERRAL', 'EARNINGS', 'FREE') NOT NULL,
        entries_count INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_contest_source (user_id, contest_id, entry_source),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 30. contest_winners Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS contest_winners (
        id CHAR(36) PRIMARY KEY,
        contest_id CHAR(36) NOT NULL,
        user_id BIGINT NOT NULL,
        reward_position INT NOT NULL,
        reward_type ENUM('COINS', 'CASH', 'GIFTCARD') NOT NULL,
        reward_value DECIMAL(10, 2) NOT NULL,
        reward_given BOOLEAN DEFAULT FALSE,
        selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 31. contest_participants Table (New: v2.5 Architecture)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS contest_participants (
        id CHAR(36) PRIMARY KEY,
        user_id BIGINT NOT NULL,
        contest_id CHAR(36) NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_contest_participation (user_id, contest_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE
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

    await addColumnIfNotExists(connection, 'transactions', 'opening_balance', 'DECIMAL(10, 2) DEFAULT NULL');
    await addColumnIfNotExists(connection, 'transactions', 'closing_balance', 'DECIMAL(10, 2) DEFAULT NULL');
    await addColumnIfNotExists(connection, 'transactions', 'tamper_signature', 'VARCHAR(64) DEFAULT NULL');

    // Ensure transactions and withdrawals column types are flexible (legacy ENUM to VARCHAR)
    try {
      console.log('⚡ Ensuring column types are flexible (legacy ENUM to VARCHAR)...');
      await connection.query('ALTER TABLE transactions MODIFY COLUMN type VARCHAR(20) NOT NULL');
      await connection.query('ALTER TABLE transactions MODIFY COLUMN source VARCHAR(50) NOT NULL');
      await connection.query('ALTER TABLE transactions MODIFY COLUMN reference_id VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL').catch(() => {});
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
      await connection.query('CREATE INDEX idx_user_offer_status ON user_offer_progress (user_id, offer_id, status)').catch(() => {});
      await connection.query('CREATE INDEX idx_offer_type_status ON user_offer_progress (admin_status, last_updated DESC)').catch(() => {});
      await connection.query('CREATE INDEX idx_user_trans_date ON transactions (user_id, created_at DESC)').catch(() => {});
      await connection.query('CREATE INDEX idx_offer_active_hot ON offers (is_active, is_hot)').catch(() => {});
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

    console.log('✅ All database tables checked/created successfully.');
  } catch (error) {
    console.error('❌ Error initializing database tables:', error);
    throw error;
  } finally {
    if (connection) connection.release();
  }
}
