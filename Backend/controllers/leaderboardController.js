/**
 * Leaderboard Controller (Clean Starter Stubs)
 * Ready for fresh implementation.
 */

// ==========================================
// USER API ENDPOINTS
// ==========================================

/**
 * GET /api/leaderboards/banner
 */
export const getHomeLeaderboardBanner = async (req, res) => {
  res.json({
    success: true,
    banner: {
      title: '🏆 LEADERBOARD',
      current_season: 'Active',
      time_remaining_formatted: '0 Days',
      time_remaining_ms: 0,
      user_rank: 'Unranked',
      user_score: 0,
      coins_needed_for_top_10: 0,
      prize_pool_coins: 0,
      prize_pool_formatted: '0 Coins',
      active_participants: 0,
      announcement: {
        title: '🏆 Leaderboard System',
        message: 'Leaderboard is ready for fresh setup.'
      }
    }
  });
};

/**
 * GET /api/leaderboards/earnings
 */
export const getEarningsLeaderboard = async (req, res) => {
  const period = (req.query.period || 'monthly').toUpperCase();
  res.json({
    success: true,
    period,
    leaderboard: {
      name: 'Earnings Leaderboard',
      type: 'EARNINGS',
      period,
      prize_pool_coins: 0,
      max_winners: 10
    },
    reward_tiers: [],
    rankings: [],
    my_rank: null
  });
};

/**
 * GET /api/leaderboards/referrals
 */
export const getReferralLeaderboard = async (req, res) => {
  const period = (req.query.period || 'monthly').toUpperCase();
  res.json({
    success: true,
    period,
    leaderboard: {
      name: 'Referral Leaderboard',
      type: 'REFERRAL',
      period,
      prize_pool_coins: 0,
      max_winners: 10
    },
    reward_tiers: [],
    rankings: [],
    my_rank: null
  });
};

/**
 * GET /api/leaderboards/me
 */
export const getUserLeaderboardProfile = async (req, res) => {
  res.json({
    success: true,
    profile: {
      uid: req.user?.id || 'user',
      name: req.user?.name || 'User',
      email: req.user?.email || '',
      profile_pic: null,
      current_coins: 0,
      lifetime_coins: 0,
      earnings: { daily: 0, weekly: 0, monthly: 0 },
      referral_count: 0,
      offers_completed: 0
    }
  });
};

/**
 * GET /api/leaderboards/history
 */
export const getLeaderboardHistory = async (req, res) => {
  res.json({
    success: true,
    history: []
  });
};

// ==========================================
// ADMINISTRATIVE API ENDPOINTS
// ==========================================

export const getAdminLeaderboardDashboard = async (req, res) => {
  res.json({
    success: true,
    stats: {
      active_leaderboards: 0,
      participants: 0,
      prize_pool_coins: 0,
      rewards_pending: 0,
      rewards_distributed: 0,
      total_reward_coins_given: 0,
      current_season: 'New Season'
    }
  });
};

export const listAdminLeaderboards = async (req, res) => {
  res.json({
    success: true,
    leaderboards: []
  });
};

export const saveLeaderboardConfigAdmin = async (req, res) => {
  res.json({
    success: true,
    message: 'Leaderboard configuration stub saved successfully.'
  });
};

export const getLeaderboardParticipantsAdmin = async (req, res) => {
  res.json({
    success: true,
    players: [],
    participant_stats: {
      qualified_users: 0,
      not_qualified: 0,
      average_coins: 0,
      highest_coins: 0,
      lowest_qualified: 0
    },
    pagination: { page: 1, pages: 1 }
  });
};

export const getAntiCheatDataAdmin = async (req, res) => {
  res.json({
    success: true,
    anti_cheat_summary: {
      duplicate_device_flags: 0,
      emulator_flags: 0,
      rapid_offer_spam_flags: 0,
      vpn_proxy_flags: 0,
      click_farm_detection_flags: 0
    },
    duplicate_devices: []
  });
};

export const getLeaderboardLogsAdmin = async (req, res) => {
  res.json({
    success: true,
    logs: []
  });
};

export const adjustPlayerScoreAdmin = async (req, res) => {
  res.json({
    success: true,
    message: 'Player score adjustment stub executed.'
  });
};

export const saveAnnouncementAdmin = async (req, res) => {
  res.json({
    success: true,
    message: 'Leaderboard announcement updated stub.'
  });
};

export const sendFcmPushAdmin = async (req, res) => {
  res.json({
    success: true,
    message: 'FCM push notification stub executed.'
  });
};

export const distributeRewardsAdmin = async (req, res) => {
  res.json({
    success: true,
    message: 'Reward distribution stub executed.'
  });
};

export const archiveSeasonSnapshotAdmin = async (req, res) => {
  res.json({
    success: true,
    message: 'Season snapshot archived stub.'
  });
};

export const getLeaderboardSeasonsAdmin = async (req, res) => {
  res.json({
    success: true,
    seasons: []
  });
};

export const deleteLeaderboardAdmin = async (req, res) => {
  res.json({
    success: true,
    message: 'Leaderboard contest deleted stub.'
  });
};
