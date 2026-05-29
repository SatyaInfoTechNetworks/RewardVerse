import pool from '../db.js';
import { v4 as uuidv4 } from 'uuid';

// List all active offers, optionally filtering by user completion, category, or search
export const listOffers = async (req, res) => {
  try {
    const { category, search, user_id, country } = req.query;

    let query = `
      SELECT id, external_id, title, description, category, icon_url, tracking_url, 
             total_reward, is_active, type, input_type, input_instruction, 
             reward_type, extra_label, estimated_time, difficulty, likes_count, is_hot, created_at,
             daily_completion_cap, country_targeting
      FROM offers 
      WHERE is_active = 1
    `;
    const params = [];

    // Exclude completed offers if user_id is provided
    if (user_id) {
      query += ` AND id NOT IN (SELECT offer_id FROM user_offer_progress WHERE user_id = ? AND status = 'COMPLETED')`;
      params.push(user_id);
    }

    if (category) {
      query += ` AND LOWER(category) = LOWER(?)`;
      params.push(category.trim());
    }

    if (search) {
      query += ` AND (LOWER(title) LIKE ? OR LOWER(description) LIKE ?)`;
      const searchWild = `%${search.trim().toLowerCase()}%`;
      params.push(searchWild, searchWild);
    }

    query += ' ORDER BY created_at DESC';

    const [offers] = await pool.query(query, params);

    if (offers.length === 0) {
      return res.json({ success: true, offers: [] });
    }

    // Fetch all tiers for these offers
    const offerIds = offers.map(o => o.id);
    const [tiers] = await pool.query(
      'SELECT id, offer_id, tier_title, app_tier_title, reward, status, steps FROM offer_tiers WHERE offer_id IN (?) ORDER BY id ASC',
      [offerIds]
    );

    // Fetch completions today for these offers to enforce caps
    const [completionsTodayRows] = await pool.query(
      `SELECT offer_id, COUNT(*) as count 
       FROM user_offer_progress 
       WHERE status = 'COMPLETED' 
         AND DATE(last_updated) = CURDATE() 
       GROUP BY offer_id`
    );
    const completionsMap = {};
    completionsTodayRows.forEach(r => {
      completionsMap[r.offer_id] = r.count;
    });

    // Group tiers by offer_id
    const tiersByOffer = {};
    tiers.forEach(t => {
      let steps = [];
      if (t.steps) {
        try {
          steps = typeof t.steps === 'string' ? JSON.parse(t.steps) : t.steps;
        } catch (e) {
          steps = t.steps.split('\n').map(s => s.trim()).filter(Boolean);
        }
      }

      if (!tiersByOffer[t.offer_id]) {
        tiersByOffer[t.offer_id] = [];
      }

      tiersByOffer[t.offer_id].push({
        id: t.id,
        title: t.app_tier_title || t.tier_title,
        backend_title: t.tier_title,
        reward: String(t.reward),
        status: t.status,
        steps: steps
      });
    });

    // Map into final output format
    const formattedOffers = offers.map(o => {
      const completionsToday = completionsMap[o.id] || 0;
      const dailyCompletionCap = parseInt(o.daily_completion_cap || 0);
      return {
        id: String(o.id),
        external_id: o.external_id,
        title: o.title,
        description: o.description,
        category: o.category,
        iconUrl: o.icon_url,
        trackingUrl: o.tracking_url,
        totalReward: parseFloat(o.total_reward || 0),
        type: o.type || 'online',
        inputType: o.input_type || null,
        inputInstruction: o.input_instruction || null,
        isCompleted: false,
        rewardType: o.reward_type || 'Multi Reward',
        extraLabel: o.extra_label || null,
        estimatedTime: o.estimated_time || null,
        difficulty: o.difficulty || 'Medium',
        likesCount: parseInt(o.likes_count || 0),
        isHot: Boolean(o.is_hot),
        dailyCompletionCap: dailyCompletionCap,
        countryTargeting: o.country_targeting || null,
        completionsToday: completionsToday,
        isCapped: dailyCompletionCap > 0 && completionsToday >= dailyCompletionCap,
        tiers: tiersByOffer[o.id] || []
      };
    });

    // Dynamic Country Filtering
    let filteredOffers = formattedOffers;
    if (country) {
      const userCountry = country.trim().toUpperCase();
      filteredOffers = formattedOffers.filter(o => {
        if (!o.countryTargeting) return true; // No targeting bounds
        const allowedCountries = o.countryTargeting.split(',').map(c => c.trim().toUpperCase());
        return allowedCountries.includes(userCountry) || allowedCountries.includes('*');
      });
    }

    res.json({ success: true, offers: filteredOffers });
  } catch (error) {
    console.error('List Offers Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get offer details by ID (including user progress)
export const getOfferById = async (req, res) => {
  try {
    const offerId = req.params.id;
    const userId = req.query.user_id || (req.user ? req.user.id : null);

    const [offerRows] = await pool.query('SELECT * FROM offers WHERE id = ? LIMIT 1', [offerId]);
    if (offerRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }
    const o = offerRows[0];

    // Fetch tiers
    const [tiers] = await pool.query(
      'SELECT id, tier_title, app_tier_title, reward, status, steps FROM offer_tiers WHERE offer_id = ? ORDER BY id ASC',
      [offerId]
    );

    const formattedTiers = tiers.map(t => {
      let steps = [];
      if (t.steps) {
        try {
          steps = typeof t.steps === 'string' ? JSON.parse(t.steps) : t.steps;
        } catch (e) {
          steps = t.steps.split('\n').map(s => s.trim()).filter(Boolean);
        }
      }
      return {
        id: t.id,
        title: t.app_tier_title || t.tier_title,
        backend_title: t.tier_title,
        reward: String(t.reward),
        status: t.status,
        steps: steps,
        is_completed: false // Default
      };
    });

    let isCompleted = false;
    let clickId = null;
    let userInput = null;
    let adminStatus = null;
    let rejectionReason = null;

    // Check user progress if user_id is provided
    if (userId) {
      const [uRows] = await pool.query(
        'SELECT id FROM users WHERE id = ? OR uid = ? OR user_id = ? LIMIT 1',
        [userId, userId, userId]
      );
      const resolvedUserId = uRows.length > 0 ? uRows[0].id : userId;

      const [progressRows] = await pool.query(
        'SELECT * FROM user_offer_progress WHERE user_id = ? AND offer_id = ? LIMIT 1',
        [resolvedUserId, offerId]
      );

      if (progressRows.length > 0) {
        const p = progressRows[0];
        clickId = p.click_id;
        isCompleted = p.status === 'COMPLETED';
        userInput = p.user_input ? (typeof p.user_input === 'string' ? JSON.parse(p.user_input) : p.user_input) : null;
        adminStatus = p.admin_status;
        rejectionReason = p.rejection_reason;

        // Map completed tiers
        let completedTiersList = [];
        if (p.completed_tiers) {
          try {
            completedTiersList = typeof p.completed_tiers === 'string' ? JSON.parse(p.completed_tiers) : p.completed_tiers;
          } catch (e) {
            completedTiersList = [];
          }
        }

        formattedTiers.forEach(t => {
          t.is_completed = completedTiersList.some(ct => 
            ct.title.toLowerCase().trim() === t.backend_title.toLowerCase().trim()
          );
        });
      }
    }

    // Fetch completions today for this offer to enforce caps
    const [completionsTodayRows] = await pool.query(
      `SELECT COUNT(*) as count 
       FROM user_offer_progress 
       WHERE offer_id = ? 
         AND status = 'COMPLETED' 
         AND DATE(last_updated) = CURDATE()`,
      [offerId]
    );
    const completionsToday = completionsTodayRows[0].count;
    const dailyCompletionCap = parseInt(o.daily_completion_cap || 0);

    res.json({
      success: true,
      offer: {
        id: String(o.id),
        external_id: o.external_id,
        title: o.title,
        description: o.description,
        category: o.category,
        iconUrl: o.icon_url,
        trackingUrl: o.tracking_url,
        totalReward: parseFloat(o.total_reward || 0),
        type: o.type || 'online',
        inputType: o.input_type || null,
        inputInstruction: o.input_instruction || null,
        isCompleted: isCompleted,
        rewardType: o.reward_type || 'Multi Reward',
        extraLabel: o.extra_label || null,
        estimatedTime: o.estimated_time || null,
        difficulty: o.difficulty || 'Medium',
        likesCount: parseInt(o.likes_count || 0),
        isHot: Boolean(o.is_hot),
        click_id: clickId,
        userInput: userInput,
        adminStatus: adminStatus,
        rejectionReason: rejectionReason,
        dailyCompletionCap: dailyCompletionCap,
        countryTargeting: o.country_targeting || null,
        completionsToday: completionsToday,
        isCapped: dailyCompletionCap > 0 && completionsToday >= dailyCompletionCap,
        tiers: formattedTiers
      }
    });
  } catch (error) {
    console.error('Get Offer Details Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
// Start Offer (Click logging)
export const startOffer = async (req, res) => {
  try {
    const userId = req.body.user_id || (req.user ? req.user.id : null);
    const { offer_id } = req.body || req.params;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }
    if (!offer_id) {
      return res.status(400).json({ success: false, message: 'Offer ID is required' });
    }

    // Resolve user_id (public hex, UUID, or Firebase UID) to primary UUID and location
    const [uRows] = await pool.query(
      'SELECT id, location FROM users WHERE id = ? OR uid = ? OR user_id = ? LIMIT 1',
      [userId, userId, userId]
    );
    if (uRows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const resolvedUserId = uRows[0].id;
    const userLocation = uRows[0].location;

    // 1. Fetch the offer to verify caps and targeting
    const [offerRows] = await pool.query('SELECT daily_completion_cap, country_targeting FROM offers WHERE id = ? LIMIT 1', [offer_id]);
    if (offerRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }
    const offer = offerRows[0];

    // Check completion cap
    const cap = parseInt(offer.daily_completion_cap || 0);
    if (cap > 0) {
      const [completions] = await pool.query(
        `SELECT COUNT(*) as count FROM user_offer_progress 
         WHERE offer_id = ? AND status = 'COMPLETED' AND DATE(last_updated) = CURDATE()`,
        [offer_id]
      );
      if (completions[0].count >= cap) {
        return res.status(400).json({ success: false, message: 'Daily completion limit reached for this offer' });
      }
    }

    // Country targeting check
    if (offer.country_targeting && offer.country_targeting !== '*' && offer.country_targeting !== 'IN') {
      if (userLocation) {
        const userLoc = userLocation.trim().toUpperCase();
        const allowed = offer.country_targeting.split(',').map(c => c.trim().toUpperCase());
        const matchesTarget = allowed.some(c => 
          userLoc.includes(c) || 
          (c === 'IN' && (userLoc.includes('INDIA') || userLoc === 'IN'))
        );
        if (!matchesTarget) {
          return res.status(400).json({ success: false, message: 'This offer is not available in your region' });
        }
      }
    }

    // 2. Check if already started
    const [progressRows] = await pool.query(
      'SELECT click_id FROM user_offer_progress WHERE user_id = ? AND offer_id = ? LIMIT 1',
      [resolvedUserId, offer_id]
    );

    if (progressRows.length > 0) {
      return res.json({ success: true, click_id: progressRows[0].click_id });
    }

    // 3. Generate new UUID for click_id
    const clickId = uuidv4();

    // Ensure database table fields match
    await pool.query(
      `INSERT INTO user_offer_progress (id, click_id, user_id, offer_id, status, completed_tiers, last_updated) 
       VALUES (?, ?, ?, ?, 'STARTED', '[]', NOW())`,
      [uuidv4(), clickId, resolvedUserId, offer_id]
    );

    res.json({ success: true, click_id: clickId });
  } catch (error) {
    console.error('Start Offer Error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};

// Like Offer
export const likeOffer = async (req, res) => {
  try {
    const userId = req.user.id;
    const offerId = req.params.id;

    // Ensure offer_likes table exists
    await pool.query(
      `CREATE TABLE IF NOT EXISTS offer_likes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        offer_id CHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_offer (user_id, offer_id)
      )`
    );

    // 1. Check if already liked
    const [likeRows] = await pool.query(
      'SELECT id FROM offer_likes WHERE user_id = ? AND offer_id = ? LIMIT 1',
      [userId, offerId]
    );

    if (likeRows.length > 0) {
      return res.json({ success: false, message: 'Already liked' });
    }

    // 2. Log like and increment count
    await pool.query('INSERT INTO offer_likes (user_id, offer_id) VALUES (?, ?)', [userId, offerId]);
    await pool.query('UPDATE offers SET likes_count = likes_count + 1 WHERE id = ?', [offerId]);

    res.json({ success: true, message: 'Offer liked successfully' });
  } catch (error) {
    console.error('Like Offer Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Submit Proof for Offline/Manual Tasks
export const submitProof = async (req, res) => {
  try {
    const { click_id, input_data } = req.body;

    if (!click_id || !input_data) {
      return res.status(400).json({ success: false, message: 'Missing click_id or input_data' });
    }

    const inputDataStr = typeof input_data === 'object' ? JSON.stringify(input_data) : input_data;

    // Update user_offer_progress submission
    const [result] = await pool.query(
      `UPDATE user_offer_progress 
       SET user_input = ?, admin_status = 'PENDING', last_updated = NOW() 
       WHERE click_id = ?`,
      [inputDataStr, click_id]
    );

    if (result.affectedRows > 0) {
      res.json({ success: true, message: 'Proof submitted successfully' });
    } else {
      res.json({ success: false, message: 'Failed to submit proof. Invalid Click ID or already completed.' });
    }
  } catch (error) {
    console.error('Submit Proof Error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};

// Get Hot Offers (where is_hot = 1)
export const getHotOffers = async (req, res) => {
  try {
    const { user_id, country } = req.query;

    let query = `
      SELECT id, external_id, title, description, category, icon_url, tracking_url, 
             total_reward, is_active, type, input_type, input_instruction, 
             reward_type, extra_label, estimated_time, difficulty, likes_count, is_hot, created_at,
             daily_completion_cap, country_targeting
      FROM offers 
      WHERE is_active = 1 AND is_hot = 1
    `;
    const params = [];

    if (user_id) {
      query += " AND id NOT IN (SELECT offer_id FROM user_offer_progress WHERE user_id = ? AND status = 'COMPLETED')";
      params.push(user_id);
    }

    query += ' ORDER BY created_at DESC LIMIT 20';

    const [offers] = await pool.query(query, params);

    if (offers.length === 0) {
      return res.json({ success: true, offers: [] });
    }

    // Fetch all tiers for these offers
    const offerIds = offers.map(o => o.id);
    const [tiers] = await pool.query(
      'SELECT id, offer_id, tier_title, app_tier_title, reward, status, steps FROM offer_tiers WHERE offer_id IN (?) ORDER BY id ASC',
      [offerIds]
    );

    // Fetch completions today for these offers to enforce caps
    const [completionsTodayRows] = await pool.query(
      `SELECT offer_id, COUNT(*) as count 
       FROM user_offer_progress 
       WHERE status = 'COMPLETED' 
         AND DATE(last_updated) = CURDATE() 
       GROUP BY offer_id`
    );
    const completionsMap = {};
    completionsTodayRows.forEach(r => {
      completionsMap[r.offer_id] = r.count;
    });

    // Group tiers by offer_id
    const tiersByOffer = {};
    tiers.forEach(t => {
      let steps = [];
      if (t.steps) {
        try {
          steps = typeof t.steps === 'string' ? JSON.parse(t.steps) : t.steps;
        } catch (e) {
          steps = t.steps.split('\n').map(s => s.trim()).filter(Boolean);
        }
      }

      if (!tiersByOffer[t.offer_id]) {
        tiersByOffer[t.offer_id] = [];
      }

      tiersByOffer[t.offer_id].push({
        id: t.id,
        title: t.app_tier_title || t.tier_title,
        backend_title: t.tier_title,
        reward: String(t.reward),
        status: t.status,
        steps: steps
      });
    });

    const formattedOffers = offers.map(o => {
      const completionsToday = completionsMap[o.id] || 0;
      const dailyCompletionCap = parseInt(o.daily_completion_cap || 0);
      return {
        id: String(o.id),
        external_id: o.external_id,
        title: o.title,
        description: o.description,
        category: o.category,
        iconUrl: o.icon_url,
        trackingUrl: o.tracking_url,
        totalReward: parseFloat(o.total_reward || 0),
        type: o.type || 'online',
        inputType: o.input_type || null,
        inputInstruction: o.input_instruction || null,
        isCompleted: false,
        rewardType: o.reward_type || 'Multi Reward',
        extraLabel: o.extra_label || null,
        estimatedTime: o.estimated_time || null,
        difficulty: o.difficulty || 'Medium',
        likesCount: parseInt(o.likes_count || 0),
        isHot: Boolean(o.is_hot),
        dailyCompletionCap: dailyCompletionCap,
        countryTargeting: o.country_targeting || null,
        completionsToday: completionsToday,
        isCapped: dailyCompletionCap > 0 && completionsToday >= dailyCompletionCap,
        tiers: tiersByOffer[o.id] || []
      };
    });

    // Dynamic Country Filtering
    let filteredOffers = formattedOffers;
    if (country) {
      const userCountry = country.trim().toUpperCase();
      filteredOffers = formattedOffers.filter(o => {
        if (!o.countryTargeting) return true; // No targeting bounds
        const allowedCountries = o.countryTargeting.split(',').map(c => c.trim().toUpperCase());
        return allowedCountries.includes(userCountry) || allowedCountries.includes('*');
      });
    }

    res.json({ success: true, offers: filteredOffers });
  } catch (error) {
    console.error('Get Hot Offers Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get user's completed or in-progress offer history
export const getOfferHistory = async (req, res) => {
  try {
    const userId = req.query.user_id || (req.user ? req.user.id : null);
    if (!userId) {
      return res.status(400).json({ success: false, message: 'Missing user_id' });
    }

    // Resolve real user UUID if UID or hex ID is passed
    let realUserId = userId;
    const [uRows] = await pool.query(
      'SELECT id FROM users WHERE id = ? OR uid = ? OR user_id = ? LIMIT 1',
      [userId, userId, userId]
    );
    if (uRows.length > 0) {
      realUserId = uRows[0].id;
    }

    const query = `
      SELECT uop.click_id, uop.status, uop.completed_tiers, uop.last_updated,
             o.id as offer_id, o.title, o.icon_url, o.total_reward, o.category
      FROM user_offer_progress uop
      JOIN offers o ON uop.offer_id = o.id
      WHERE uop.user_id = ?
      ORDER BY uop.last_updated DESC
    `;

    const [rows] = await pool.query(query, [realUserId]);

    // Gather all offer ids to fetch tier mappings for friendly names
    const offerIds = rows.map(r => r.offer_id);
    let tierMap = {};

    if (offerIds.length > 0) {
      const [tiers] = await pool.query(
        'SELECT offer_id, tier_title, app_tier_title FROM offer_tiers WHERE offer_id IN (?)',
        [offerIds]
      );
      tiers.forEach(t => {
        if (!tierMap[t.offer_id]) {
          tierMap[t.offer_id] = {};
        }
        tierMap[t.offer_id][t.tier_title] = t.app_tier_title || t.tier_title;
      });
    }

    const history = rows.map(row => {
      let completedTiers = [];
      if (row.completed_tiers) {
        try {
          completedTiers = typeof row.completed_tiers === 'string' ? JSON.parse(row.completed_tiers) : row.completed_tiers;
        } catch (e) {
          completedTiers = [];
        }
      }

      // Map completed tiers to app friendly title if available
      const mappedCompletedTiers = completedTiers.map(ct => {
        const title = ct.title;
        const appTitle = (tierMap[row.offer_id] && tierMap[row.offer_id][title]) ? tierMap[row.offer_id][title] : title;
        return {
          title: appTitle,
          reward: parseFloat(ct.reward || 0),
          completed_at: ct.completed_at || row.last_updated
        };
      });

      let iconUrl = row.icon_url;
      if (!iconUrl) {
        iconUrl = 'https://i.ibb.co/twLPSHST/giftbox-1139982.png';
      }

      return {
        clickId: row.click_id || '',
        offerId: String(row.offer_id),
        title: row.title,
        iconUrl: iconUrl,
        totalReward: parseFloat(row.total_reward || 0),
        category: row.category || '',
        status: row.status,
        statusText: row.status ? (row.status.charAt(0) + row.status.slice(1).toLowerCase()) : 'Started',
        completedTiersCount: mappedCompletedTiers.length,
        completedTiers: mappedCompletedTiers,
        lastUpdated: row.last_updated
      };
    });

    res.json({
      success: true,
      history: history
    });
  } catch (error) {
    console.error('Get Offer History Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
