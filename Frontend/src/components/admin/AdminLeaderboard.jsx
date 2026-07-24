import React, { useState, useEffect } from 'react';

export default function AdminLeaderboard({ apiBase, getHeaders, showNotice }) {
  const [subTab, setSubTab] = useState('overview'); // overview, settings, tier_builder, participants, anti_cheat, coin_stats, distribution, announcement, logs

  // Overview stats state (Purged all fake numbers - 100% realtime from DB)
  const [dashStats, setDashStats] = useState({
    active_leaderboards: 0,
    participants: 0,
    prize_pool_coins: 0,
    rewards_pending: 0,
    rewards_distributed: 0,
    total_reward_coins_given: 0,
    current_season: new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
  });

  // Leaderboards Config state
  const [leaderboardsList, setLeaderboardsList] = useState([]);
  const [editingLb, setEditingLb] = useState(null);
  const [lbForm, setLbForm] = useState({
    name: 'Daily Earnings',
    type: 'EARNINGS', // EARNINGS or REFERRAL
    period: 'DAILY', // DAILY, WEEKLY, MONTHLY, ALL_TIME
    minimum_score: 0,
    minimum_referrals: 0,
    reward_pool: 0,
    dynamic_pool_enabled: true,
    pool_growth_per_user: 10,
    max_pool_cap: 100000,
    max_winners: 20,
    start_date: '',
    end_date: '',
    auto_reward: false,
    show_on_home: true,
    status: 'ACTIVE',
    tiers: []
  });

  // Participant stats & player table state (Purged all fake numbers)
  const [participantStats, setParticipantStats] = useState({
    qualified_users: 0,
    not_qualified: 0,
    average_coins: 0,
    highest_coins: 0,
    lowest_qualified: 0
  });
  const [playersList, setPlayersList] = useState([]);
  const [playersSearch, setPlayersSearch] = useState('');
  const [playersPage, setPlayersPage] = useState(1);
  const [playersTotalPages, setPlayersTotalPages] = useState(1);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustAction, setAdjustAction] = useState('INCREASE'); // INCREASE, DECREASE, DISQUALIFY, RESTORE
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  // Anti-cheat state (Purged all fake numbers)
  const [antiCheatData, setAntiCheatData] = useState({
    anti_cheat_summary: {
      duplicate_device_flags: 0,
      emulator_flags: 0,
      rapid_offer_spam_flags: 0,
      vpn_proxy_flags: 0,
      click_farm_detection_flags: 0
    }
  });

  // Coin Statistics state (Purged all fake numbers)
  const [coinStats, setCoinStats] = useState({
    coins_earned_today: 0,
    coins_distributed: 0,
    leaderboard_rewards: 0,
    offer_rewards: 0,
    referral_rewards: 0,
    watch_ad_rewards: 0,
    current_coin_supply: 0
  });

  // Announcement & FCM Push state
  const [announcementForm, setAnnouncementForm] = useState({
    title: '🏆 April Leaderboard is LIVE!',
    message: 'Top 50 users win FREE Coins. Ends in 18 Days.',
    ends_at: '',
    is_active: true
  });

  const [fcmForm, setFcmForm] = useState({
    target_type: 'broadcast', // broadcast or specific
    target_user_id: '',
    title: '🏆 Leaderboard Winner Alert!',
    message: 'Congratulations! You placed in the Top Winners and received Coins!'
  });

  // Audit Logs state
  const [logsList, setLogsList] = useState([]);

  const refreshAllData = () => {
    fetchDashboardOverview();
    fetchLeaderboards();
    if (subTab === 'participants') fetchParticipants();
    if (subTab === 'anti_cheat') fetchAntiCheat();
    if (subTab === 'coin_stats') fetchCoinStats();
    if (subTab === 'logs') fetchLogs();
  };

  // Auto-refresh real-time data every 15 seconds
  useEffect(() => {
    refreshAllData();
    const interval = setInterval(refreshAllData, 15000);
    return () => clearInterval(interval);
  }, [subTab, playersPage, playersSearch]);

  const fetchDashboardOverview = async () => {
    try {
      const res = await fetch(`${apiBase}/api/admin/leaderboard/dashboard`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success && data.stats) setDashStats(data.stats);
    } catch (err) {
      console.error('Error fetching dashboard overview:', err);
    }
  };

  const selectLeaderboardForEdit = (lb) => {
    setEditingLb(lb);
    setLbForm({
      id: lb.id,
      name: lb.name || '',
      type: lb.type || 'EARNINGS',
      period: lb.period || 'DAILY',
      minimum_score: parseFloat(lb.minimum_score) || 0,
      minimum_referrals: parseInt(lb.minimum_referrals) || 0,
      reward_pool: parseFloat(lb.reward_pool) || 0,
      dynamic_pool_enabled: lb.dynamic_pool_enabled ? true : false,
      pool_growth_per_user: parseFloat(lb.pool_growth_per_user) || 10,
      max_pool_cap: parseFloat(lb.max_pool_cap) || 100000,
      max_winners: parseInt(lb.max_winners) || 20,
      start_date: lb.start_date || '',
      end_date: lb.end_date || '',
      auto_reward: lb.auto_reward ? true : false,
      show_on_home: lb.show_on_home ? true : false,
      status: lb.status || 'ACTIVE',
      tiers: Array.isArray(lb.tiers) && lb.tiers.length > 0 ? lb.tiers : [
        { start_rank: 1, end_rank: 1, reward_coins: 5000 },
        { start_rank: 2, end_rank: 2, reward_coins: 3000 },
        { start_rank: 3, end_rank: 3, reward_coins: 2000 },
        { start_rank: 4, end_rank: 10, reward_coins: 750 },
        { start_rank: 11, end_rank: 25, reward_coins: 300 }
      ]
    });
  };

  const fetchLeaderboards = async () => {
    try {
      const res = await fetch(`${apiBase}/api/admin/leaderboard/list`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success && data.leaderboards && data.leaderboards.length > 0) {
        setLeaderboardsList(data.leaderboards);
        if (!editingLb) {
          selectLeaderboardForEdit(data.leaderboards[0]);
        } else {
          const current = data.leaderboards.find(l => l.id === editingLb.id);
          if (current) selectLeaderboardForEdit(current);
        }
      }
    } catch (err) {
      console.error('Error fetching leaderboards:', err);
    }
  };

  const fetchParticipants = async () => {
    try {
      const res = await fetch(
        `${apiBase}/api/admin/leaderboard/participants?search=${encodeURIComponent(playersSearch)}&page=${playersPage}&limit=15`,
        { headers: getHeaders() }
      );
      const data = await res.json();
      if (data.success) {
        setPlayersList(data.players || []);
        if (data.participant_stats) setParticipantStats(data.participant_stats);
        if (data.pagination) setPlayersTotalPages(data.pagination.pages || 1);
      }
    } catch (err) {
      console.error('Error fetching participants:', err);
    }
  };

  const fetchAntiCheat = async () => {
    try {
      const res = await fetch(`${apiBase}/api/admin/leaderboard/anti-cheat`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) setAntiCheatData(data);
    } catch (err) {
      console.error('Error fetching anti cheat:', err);
    }
  };

  const fetchCoinStats = async () => {
    try {
      const res = await fetch(`${apiBase}/api/admin/leaderboard/coin-stats`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success && data.coin_stats) setCoinStats(data.coin_stats);
    } catch (err) {
      console.error('Error fetching coin stats:', err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${apiBase}/api/admin/leaderboard/logs`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) setLogsList(data.logs || []);
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  // Tier Builder handlers
  const addTierRow = () => {
    const lastTier = lbForm.tiers[lbForm.tiers.length - 1];
    const nextStart = lastTier ? lastTier.end_rank + 1 : 1;
    setLbForm({
      ...lbForm,
      tiers: [...lbForm.tiers, { start_rank: nextStart, end_rank: nextStart + 5, reward_coins: 100 }]
    });
  };

  const removeTierRow = (index) => {
    const updated = lbForm.tiers.filter((_, i) => i !== index);
    setLbForm({ ...lbForm, tiers: updated });
  };

  const handleTierChange = (index, field, value) => {
    const updated = [...lbForm.tiers];
    updated[index][field] = parseFloat(value) || 0;
    setLbForm({ ...lbForm, tiers: updated });
  };

  const handleSaveLeaderboard = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${apiBase}/api/admin/leaderboard/save`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(lbForm)
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', data.message || 'Leaderboard configuration saved successfully!');
        fetchLeaderboards();
        fetchDashboardOverview();
        setSubTab('overview');
      } else {
        showNotice('error', data.message);
      }
    } catch (err) {
      showNotice('error', 'Failed to save leaderboard settings.');
    }
  };

  const handleScoreAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPlayer) return;
    try {
      const res = await fetch(`${apiBase}/api/admin/leaderboard/adjust-score`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          user_id: selectedPlayer.id,
          action: adjustAction,
          amount: adjustAmount,
          reason: adjustReason
        })
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', data.message || 'Player adjustment executed successfully.');
        setAdjustModal(false);
        setAdjustAmount('');
        setAdjustReason('');
        fetchParticipants();
      } else {
        showNotice('error', data.message);
      }
    } catch (err) {
      showNotice('error', 'Failed to adjust player score.');
    }
  };

  const handleSaveAnnouncement = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${apiBase}/api/admin/leaderboard/announcement`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(announcementForm)
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', 'Announcement banner updated live!');
      } else {
        showNotice('error', data.message);
      }
    } catch (err) {
      showNotice('error', 'Failed to update announcement banner.');
    }
  };

  const handleSendFcmPush = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${apiBase}/api/admin/leaderboard/notify`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(fcmForm)
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', data.message || 'FCM Push Notification sent successfully!');
      } else {
        showNotice('error', data.message);
      }
    } catch (err) {
      showNotice('error', 'Failed to send FCM Push Notification.');
    }
  };

  const handleDistributeRewards = async () => {
    if (!window.confirm('Are you sure you want to approve & distribute leaderboard rewards to the top qualified winners? This will immediately credit user balances!')) return;
    try {
      // Build top 20 winners from playersList
      const winners = playersList.slice(0, 20).map((player, idx) => ({
        user_id: player.id,
        rank: idx + 1,
        reward_coins: idx === 0 ? 5000 : (idx === 1 ? 3000 : (idx === 2 ? 2000 : 500))
      }));

      const res = await fetch(`${apiBase}/api/admin/leaderboard/distribute`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ leaderboard_id: editingLb?.id || 'main', winners })
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', data.message || 'Rewards distributed successfully!');
        fetchDashboardOverview();
      } else {
        showNotice('error', data.message);
      }
    } catch (err) {
      showNotice('error', 'Failed to execute reward distribution.');
    }
  };

  return (
    <div className="container-fluid">
      {/* Top Header & Dynamic Navigation */}
      <div className="card shadow-sm border-0 mb-4 rounded-lg">
        <div className="card-body p-3">
          <div className="d-flex flex-wrap align-items-center justify-content-between">
            <div>
              <h4 className="font-weight-bold text-dark mb-0">
                <i className="fas fa-trophy text-warning mr-2"></i>Leaderboard Master Control
              </h4>
              <p className="text-muted text-xs mb-0">Manage Dynamic Prize Pools, Tier Builders, Anti-Cheat & Distribution</p>
            </div>
            
            {/* Dynamic Prize Pool Live Ticker Badge & Refresh Button */}
            <div className="d-flex align-items-center">
              <button onClick={refreshAllData} className="btn btn-sm btn-outline-primary font-weight-bold mr-2">
                <i className="fas fa-sync-alt mr-1"></i> Live Realtime Sync
              </button>
              <div className="bg-gradient-warning text-dark px-3 py-2 rounded-lg shadow-sm font-weight-bold text-sm">
                <i className="fas fa-coins mr-1"></i> Live Prize Pool: <strong>{dashStats.prize_pool_coins?.toLocaleString()} Coins</strong>
                <span className="badge badge-dark ml-2">Growing Dynamic</span>
              </div>
            </div>
          </div>

          <hr className="my-3" />

          {/* Subtabs Menu */}
          <ul className="nav nav-pills card-header-pills text-sm font-weight-bold">
            <li className="nav-item">
              <button onClick={() => setSubTab('overview')} className={`nav-link border-0 ${subTab === 'overview' ? 'active bg-primary' : 'text-dark'}`}>
                <i className="fas fa-chart-pie mr-1"></i> Dashboard Overview
              </button>
            </li>
            <li className="nav-item">
              <button onClick={() => setSubTab('settings')} className={`nav-link border-0 ${subTab === 'settings' ? 'active bg-primary' : 'text-dark'}`}>
                <i className="fas fa-cog mr-1"></i> Leaderboard Settings
              </button>
            </li>
            <li className="nav-item">
              <button onClick={() => setSubTab('tier_builder')} className={`nav-link border-0 ${subTab === 'tier_builder' ? 'active bg-primary' : 'text-dark'}`}>
                <i className="fas fa-layer-group mr-1"></i> Reward Tier Builder
              </button>
            </li>
            <li className="nav-item">
              <button onClick={() => setSubTab('participants')} className={`nav-link border-0 ${subTab === 'participants' ? 'active bg-primary' : 'text-dark'}`}>
                <i className="fas fa-users mr-1"></i> Participants & Players
              </button>
            </li>
            <li className="nav-item">
              <button onClick={() => setSubTab('anti_cheat')} className={`nav-link border-0 ${subTab === 'anti_cheat' ? 'active bg-primary' : 'text-dark'}`}>
                <i className="fas fa-user-shield mr-1"></i> Anti-Cheat Panel
              </button>
            </li>
            <li className="nav-item">
              <button onClick={() => setSubTab('coin_stats')} className={`nav-link border-0 ${subTab === 'coin_stats' ? 'active bg-primary' : 'text-dark'}`}>
                <i className="fas fa-coins mr-1"></i> Coin Statistics
              </button>
            </li>
            <li className="nav-item">
              <button onClick={() => setSubTab('distribution')} className={`nav-link border-0 ${subTab === 'distribution' ? 'active bg-primary' : 'text-dark'}`}>
                <i className="fas fa-gift mr-1"></i> Reward Distribution
              </button>
            </li>
            <li className="nav-item">
              <button onClick={() => setSubTab('announcement')} className={`nav-link border-0 ${subTab === 'announcement' ? 'active bg-primary' : 'text-dark'}`}>
                <i className="fas fa-bullhorn mr-1"></i> Announcement Panel
              </button>
            </li>
            <li className="nav-item">
              <button onClick={() => setSubTab('logs')} className={`nav-link border-0 ${subTab === 'logs' ? 'active bg-primary' : 'text-dark'}`}>
                <i className="fas fa-history mr-1"></i> Audit Logs
              </button>
            </li>
          </ul>
        </div>
      </div>

      {/* SUBTAB 1: DASHBOARD OVERVIEW */}
      {subTab === 'overview' && (
        <div>
          {/* 6 Overview KPI Cards */}
          <div className="row">
            <div className="col-lg-2 col-6">
              <div className="small-box bg-info elevation-2 rounded-lg">
                <div className="inner p-3">
                  <h3>{dashStats.active_leaderboards}</h3>
                  <p className="text-sm font-weight-bold mb-0">Active Leaderboards</p>
                </div>
                <div className="icon"><i className="fas fa-list-ol"></i></div>
              </div>
            </div>
            <div className="col-lg-2 col-6">
              <div className="small-box bg-success elevation-2 rounded-lg">
                <div className="inner p-3">
                  <h3>{dashStats.participants?.toLocaleString()}</h3>
                  <p className="text-sm font-weight-bold mb-0">Participants</p>
                </div>
                <div className="icon"><i className="fas fa-user-friends"></i></div>
              </div>
            </div>
            <div className="col-lg-3 col-6">
              <div className="small-box bg-warning elevation-2 rounded-lg">
                <div className="inner p-3 text-dark">
                  <h3>{dashStats.prize_pool_coins?.toLocaleString()}</h3>
                  <p className="text-sm font-weight-bold mb-0">Prize Pool (Coins)</p>
                </div>
                <div className="icon"><i className="fas fa-coins"></i></div>
              </div>
            </div>
            <div className="col-lg-2 col-6">
              <div className="small-box bg-danger elevation-2 rounded-lg">
                <div className="inner p-3">
                  <h3>{dashStats.rewards_pending}</h3>
                  <p className="text-sm font-weight-bold mb-0">Rewards Pending</p>
                </div>
                <div className="icon"><i className="fas fa-hourglass-half"></i></div>
              </div>
            </div>
            <div className="col-lg-3 col-12">
              <div className="small-box bg-secondary elevation-2 rounded-lg">
                <div className="inner p-3">
                  <h3>{dashStats.rewards_distributed?.toLocaleString()}</h3>
                  <p className="text-sm font-weight-bold mb-0">Rewards Distributed</p>
                </div>
                <div className="icon"><i className="fas fa-check-circle"></i></div>
              </div>
            </div>
          </div>

          {/* Active Season Info & Quick Leaderboard Overview */}
          <div className="card shadow-sm border-0 rounded-lg">
            <div className="card-header bg-white font-weight-bold">
              <i className="fas fa-calendar-alt text-primary mr-2"></i>Current Season: <span className="text-success">{dashStats.current_season}</span>
            </div>
            <div className="card-body">
              <h5 className="font-weight-bold text-dark mb-3">Configured Leaderboards Overview</h5>
              <div className="table-responsive">
                <table className="table table-hover table-striped align-middle">
                  <thead className="thead-light text-xs uppercase">
                    <tr>
                      <th>Leaderboard Name</th>
                      <th>Type</th>
                      <th>Period</th>
                      <th>Base Pool</th>
                      <th>Dynamic Growth</th>
                      <th>Max Winners</th>
                      <th>Home Display</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboardsList.length > 0 ? (
                      leaderboardsList.map((lb) => (
                        <tr key={lb.id}>
                          <td className="font-weight-bold">{lb.name}</td>
                          <td><span className={`badge ${lb.type === 'EARNINGS' ? 'badge-success' : 'badge-info'}`}>{lb.type}</span></td>
                          <td><span className="badge badge-light border">{lb.period}</span></td>
                          <td className="font-weight-bold text-warning">{parseFloat(lb.reward_pool).toLocaleString()} Coins</td>
                          <td>
                            {lb.dynamic_pool_enabled ? (
                              <span className="text-success text-xs font-weight-bold">+ {lb.pool_growth_per_user} coins/user (Max: {lb.max_pool_cap})</span>
                            ) : (
                              <span className="text-muted text-xs">Fixed Pool</span>
                            )}
                          </td>
                          <td>Top {lb.max_winners}</td>
                          <td>{lb.show_on_home ? <i className="fas fa-check-circle text-success"></i> : <i className="fas fa-times-circle text-muted"></i>}</td>
                          <td><span className={`badge ${lb.status === 'ACTIVE' ? 'badge-success' : 'badge-secondary'}`}>{lb.status}</span></td>
                          <td>
                            <button
                              onClick={() => {
                                selectLeaderboardForEdit(lb);
                                setSubTab('settings');
                              }}
                              className="btn btn-xs btn-outline-primary mr-1"
                            >
                              <i className="fas fa-cog"></i> Settings
                            </button>
                            <button
                              onClick={() => {
                                selectLeaderboardForEdit(lb);
                                setSubTab('tier_builder');
                              }}
                              className="btn btn-xs btn-primary font-weight-bold"
                            >
                              <i className="fas fa-layer-group"></i> Edit Tiers
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="9" className="text-center py-4 text-muted">
                          <i className="fas fa-info-circle mr-1"></i> Active default system leaderboards loaded. Configure custom parameters in Settings tab.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: LEADERBOARD SETTINGS */}
      {subTab === 'settings' && (
        <div className="card shadow-sm border-0 rounded-lg">
          <div className="card-header bg-white d-flex justify-content-between align-items-center">
            <div className="font-weight-bold">
              <i className="fas fa-sliders-h text-primary mr-2"></i>Configure Leaderboard Parameters
            </div>
            <button
              onClick={() => {
                setEditingLb(null);
                setLbForm({
                  id: '',
                  name: 'New Custom Leaderboard',
                  type: 'EARNINGS',
                  period: 'DAILY',
                  minimum_score: 100,
                  minimum_referrals: 0,
                  reward_pool: 5000,
                  dynamic_pool_enabled: true,
                  pool_growth_per_user: 10,
                  max_pool_cap: 50000,
                  max_winners: 20,
                  start_date: '',
                  end_date: '',
                  auto_reward: false,
                  show_on_home: true,
                  status: 'ACTIVE',
                  tiers: [
                    { start_rank: 1, end_rank: 1, reward_coins: 2000 },
                    { start_rank: 2, end_rank: 2, reward_coins: 1000 },
                    { start_rank: 3, end_rank: 5, reward_coins: 500 }
                  ]
                });
              }}
              className="btn btn-sm btn-outline-success font-weight-bold"
            >
              <i className="fas fa-plus mr-1"></i> Create New Leaderboard
            </button>
          </div>
          <div className="card-body">
            {/* Target Leaderboard Selection Bar */}
            <div className="bg-light border rounded-lg p-3 mb-4 d-flex flex-wrap align-items-center justify-content-between">
              <div className="d-flex align-items-center mb-2 mb-md-0">
                <label className="text-xs uppercase font-weight-bold mr-3 mb-0 text-dark">
                  <i className="fas fa-list-ul text-primary mr-1"></i> Select Leaderboard to Edit:
                </label>
                <select
                  className="form-control form-control-sm font-weight-bold text-dark border-primary"
                  style={{ width: '280px', height: '38px', borderRadius: '6px' }}
                  value={lbForm.id || ''}
                  onChange={(e) => {
                    const found = leaderboardsList.find(l => l.id === e.target.value);
                    if (found) selectLeaderboardForEdit(found);
                  }}
                >
                  {leaderboardsList.map((lb) => (
                    <option key={lb.id} value={lb.id}>
                      {lb.name} ({lb.type} - {lb.period})
                    </option>
                  ))}
                </select>
              </div>

              <div className="d-flex align-items-center">
                <span className="badge badge-primary px-3 py-2 font-weight-bold mr-2 text-sm">
                  <i className="fas fa-crown mr-1"></i> {lbForm.name || 'Editing Leaderboard'}
                </span>
                <span className={`badge ${lbForm.type === 'EARNINGS' ? 'badge-success' : 'badge-info'} px-3 py-2 font-weight-bold mr-2 text-sm`}>
                  {lbForm.type}
                </span>
                <span className="badge badge-dark px-3 py-2 font-weight-bold text-sm">
                  {lbForm.period}
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveLeaderboard}>
              <div className="row">
                <div className="col-md-6 form-group">
                  <label className="text-xs uppercase font-weight-bold">Leaderboard Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Daily Earnings Leaderboard"
                    value={lbForm.name}
                    onChange={(e) => setLbForm({ ...lbForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="col-md-3 form-group">
                  <label className="text-xs uppercase font-weight-bold">Leaderboard Type</label>
                  <select className="form-control" value={lbForm.type} onChange={(e) => setLbForm({ ...lbForm, type: e.target.value })}>
                    <option value="EARNINGS">💰 Earnings Leaderboard</option>
                    <option value="REFERRAL">👥 Referral Leaderboard</option>
                  </select>
                </div>
                <div className="col-md-3 form-group">
                  <label className="text-xs uppercase font-weight-bold">Period</label>
                  <select className="form-control" value={lbForm.period} onChange={(e) => setLbForm({ ...lbForm, period: e.target.value })}>
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="ALL_TIME">All Time</option>
                  </select>
                </div>
              </div>

              <div className="row">
                <div className="col-md-3 form-group">
                  <label className="text-xs uppercase font-weight-bold">Minimum Coins Required</label>
                  <input
                    type="number"
                    className="form-control"
                    value={lbForm.minimum_score}
                    onChange={(e) => setLbForm({ ...lbForm, minimum_score: parseFloat(e.target.value) })}
                  />
                </div>
                {lbForm.type === 'REFERRAL' && (
                  <div className="col-md-3 form-group">
                    <label className="text-xs uppercase font-weight-bold">Minimum Successful Referrals</label>
                    <input
                      type="number"
                      className="form-control"
                      value={lbForm.minimum_referrals}
                      onChange={(e) => setLbForm({ ...lbForm, minimum_referrals: parseInt(e.target.value) })}
                    />
                  </div>
                )}
                <div className="col-md-3 form-group">
                  <label className="text-xs uppercase font-weight-bold">Base Reward Pool (Coins)</label>
                  <input
                    type="number"
                    className="form-control font-weight-bold text-warning"
                    value={lbForm.reward_pool}
                    onChange={(e) => setLbForm({ ...lbForm, reward_pool: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="col-md-3 form-group">
                  <label className="text-xs uppercase font-weight-bold">Maximum Winners</label>
                  <input
                    type="number"
                    className="form-control"
                    value={lbForm.max_winners}
                    onChange={(e) => setLbForm({ ...lbForm, max_winners: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              {/* Contest Duration: Start Date & Time & End Date & Time */}
              <div className="card bg-white border p-3 my-3 rounded-lg shadow-sm">
                <h6 className="font-weight-bold text-primary mb-2">
                  <i className="fas fa-clock mr-1"></i> Contest Schedule & Coin Crediting Rules
                </h6>
                <p className="text-xs text-muted mb-3">
                  Specify when this leaderboard contest starts and ends. At the end of the contest duration, coin rewards are distributed to winners either automatically (if auto-reward is toggled ON) or manually via the Reward Distribution tab.
                </p>
                <div className="row">
                  <div className="col-md-6 form-group">
                    <label className="text-xs uppercase font-weight-bold">Contest Start Date & Time</label>
                    <input
                      type="datetime-local"
                      className="form-control font-weight-bold text-dark"
                      value={lbForm.start_date ? lbForm.start_date.substring(0, 16) : ''}
                      onChange={(e) => setLbForm({ ...lbForm, start_date: e.target.value })}
                    />
                  </div>
                  <div className="col-md-6 form-group">
                    <label className="text-xs uppercase font-weight-bold">Contest End Date & Time</label>
                    <input
                      type="datetime-local"
                      className="form-control font-weight-bold text-danger"
                      value={lbForm.end_date ? lbForm.end_date.substring(0, 16) : ''}
                      onChange={(e) => setLbForm({ ...lbForm, end_date: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic Growing Prize Pool Configuration */}
              <div className="card bg-light border p-3 my-3 rounded-lg">
                <h6 className="font-weight-bold text-dark mb-2">⭐ Dynamic Prize Pool Scaling (Recommended)</h6>
                <p className="text-xs text-muted">Allow the prize pool to grow automatically as more users participate in the app.</p>
                <div className="row">
                  <div className="col-md-4 form-group">
                    <div className="custom-control custom-switch mt-2">
                      <input
                        type="checkbox"
                        className="custom-control-input"
                        id="dynamicPoolSwitch"
                        checked={lbForm.dynamic_pool_enabled}
                        onChange={(e) => setLbForm({ ...lbForm, dynamic_pool_enabled: e.target.checked })}
                      />
                      <label className="custom-control-label font-weight-bold text-sm" htmlFor="dynamicPoolSwitch">
                        Enable Dynamic Pool Scaling
                      </label>
                    </div>
                  </div>
                  {lbForm.dynamic_pool_enabled && (
                    <>
                      <div className="col-md-4 form-group">
                        <label className="text-xs uppercase font-weight-bold">Pool Growth Per Participant (Coins)</label>
                        <input
                          type="number"
                          className="form-control"
                          value={lbForm.pool_growth_per_user}
                          onChange={(e) => setLbForm({ ...lbForm, pool_growth_per_user: parseFloat(e.target.value) })}
                        />
                      </div>
                      <div className="col-md-4 form-group">
                        <label className="text-xs uppercase font-weight-bold">Maximum Prize Pool Cap</label>
                        <input
                          type="number"
                          className="form-control"
                          value={lbForm.max_pool_cap}
                          onChange={(e) => setLbForm({ ...lbForm, max_pool_cap: parseFloat(e.target.value) })}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Display & Status Switches */}
              <div className="row my-2">
                <div className="col-md-4">
                  <div className="custom-control custom-switch">
                    <input
                      type="checkbox"
                      className="custom-control-input"
                      id="showHomeSwitch"
                      checked={lbForm.show_on_home}
                      onChange={(e) => setLbForm({ ...lbForm, show_on_home: e.target.checked })}
                    />
                    <label className="custom-control-label font-weight-bold text-sm" htmlFor="showHomeSwitch">Show Banner on Home Screen</label>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="custom-control custom-switch">
                    <input
                      type="checkbox"
                      className="custom-control-input"
                      id="autoRewardSwitch"
                      checked={lbForm.auto_reward}
                      onChange={(e) => setLbForm({ ...lbForm, auto_reward: e.target.checked })}
                    />
                    <label className="custom-control-label font-weight-bold text-sm" htmlFor="autoRewardSwitch">Auto Reward Distribution at Season End</label>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <button type="submit" className="btn btn-success px-4 font-weight-bold">
                  <i className="fas fa-save mr-1"></i> Save Leaderboard Settings
                </button>
                <button type="button" onClick={() => setSubTab('tier_builder')} className="btn btn-primary ml-2 px-4 font-weight-bold">
                  Configure Tier Builder →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUBTAB 3: REWARD TIER BUILDER */}
      {subTab === 'tier_builder' && (
        <div className="card shadow-sm border-0 rounded-lg">
          <div className="card-header bg-white d-flex justify-content-between align-items-center">
            <div>
              <h5 className="font-weight-bold mb-0"><i className="fas fa-layer-group text-primary mr-2"></i>Reward Tier Builder</h5>
              <span className="text-muted text-xs">Configure separate custom rank rewards for each leaderboard contest</span>
            </div>
            <button onClick={addTierRow} className="btn btn-sm btn-success font-weight-bold">
              <i className="fas fa-plus mr-1"></i> Add Rank Tier
            </button>
          </div>
          <div className="card-body">
            {/* Target Leaderboard Selection Bar */}
            <div className="bg-gradient-light border rounded-lg p-3 mb-4 d-flex flex-wrap align-items-center justify-content-between">
              <div className="d-flex align-items-center mb-2 mb-md-0">
                <label className="text-xs uppercase font-weight-bold mr-3 mb-0 text-dark">
                  <i className="fas fa-trophy text-warning mr-1"></i> Select Leaderboard Contest:
                </label>
                <select
                  className="form-control form-control-sm font-weight-bold text-dark border-primary"
                  style={{ width: '300px', height: '38px', borderRadius: '6px' }}
                  value={lbForm.id || ''}
                  onChange={(e) => {
                    const found = leaderboardsList.find(l => l.id === e.target.value);
                    if (found) selectLeaderboardForEdit(found);
                  }}
                >
                  {leaderboardsList.map((lb) => (
                    <option key={lb.id} value={lb.id}>
                      {lb.name} ({lb.type} - {lb.period})
                    </option>
                  ))}
                </select>
              </div>

              <div className="d-flex align-items-center">
                <span className="text-xs text-muted font-weight-bold mr-2">Configuring Tiers For:</span>
                <span className="badge badge-primary px-3 py-2 font-weight-bold mr-2 text-sm">
                  <i className="fas fa-crown mr-1"></i> {lbForm.name || 'Selected Contest'}
                </span>
                <span className={`badge ${lbForm.type === 'EARNINGS' ? 'badge-success' : 'badge-info'} px-3 py-2 font-weight-bold mr-2 text-sm`}>
                  {lbForm.type}
                </span>
                <span className="badge badge-dark px-3 py-2 font-weight-bold text-sm">
                  {lbForm.period}
                </span>
              </div>
            </div>
            <div className="table-responsive">
              <table className="table table-bordered table-striped align-middle">
                <thead className="thead-dark text-xs uppercase">
                  <tr>
                    <th>Start Rank</th>
                    <th>End Rank</th>
                    <th>Reward (Coins)</th>
                    <th>Display Label</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {lbForm.tiers.map((tier, idx) => (
                    <tr key={idx}>
                      <td style={{ width: '120px' }}>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          value={tier.start_rank}
                          onChange={(e) => handleTierChange(idx, 'start_rank', e.target.value)}
                        />
                      </td>
                      <td style={{ width: '120px' }}>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          value={tier.end_rank}
                          onChange={(e) => handleTierChange(idx, 'end_rank', e.target.value)}
                        />
                      </td>
                      <td style={{ width: '200px' }}>
                        <input
                          type="number"
                          className="form-control form-control-sm font-weight-bold text-warning"
                          value={tier.reward_coins}
                          onChange={(e) => handleTierChange(idx, 'reward_coins', e.target.value)}
                        />
                      </td>
                      <td className="font-weight-bold text-primary">
                        {tier.start_rank === tier.end_rank ? `Rank ${tier.start_rank}` : `Rank ${tier.start_rank}-${tier.end_rank}`}
                      </td>
                      <td>
                        <button onClick={() => removeTierRow(idx)} className="btn btn-xs btn-danger">
                          <i className="fas fa-trash"></i> Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3">
              <button onClick={handleSaveLeaderboard} className="btn btn-success px-4 font-weight-bold">
                <i className="fas fa-check-circle mr-1"></i> Save Tiers & Leaderboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: PARTICIPANTS & PLAYERS TABLE */}
      {subTab === 'participants' && (
        <div>
          {/* Participant Summary Cards */}
          <div className="row mb-3">
            <div className="col-md-3">
              <div className="card border-left-success p-3 shadow-sm">
                <span className="text-muted text-xs uppercase font-weight-bold">Qualified Users</span>
                <h4 className="font-weight-bold text-success mb-0">{participantStats.qualified_users}</h4>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card border-left-danger p-3 shadow-sm">
                <span className="text-muted text-xs uppercase font-weight-bold">Not Qualified</span>
                <h4 className="font-weight-bold text-danger mb-0">{participantStats.not_qualified}</h4>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card border-left-info p-3 shadow-sm">
                <span className="text-muted text-xs uppercase font-weight-bold">Average Coins</span>
                <h4 className="font-weight-bold text-info mb-0">{participantStats.average_coins?.toLocaleString()}</h4>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card border-left-warning p-3 shadow-sm">
                <span className="text-muted text-xs uppercase font-weight-bold">Highest Score</span>
                <h4 className="font-weight-bold text-warning mb-0">{participantStats.highest_coins?.toLocaleString()}</h4>
              </div>
            </div>
          </div>

          {/* Top Players Table */}
          <div className="card shadow-sm border-0 rounded-lg">
            <div className="card-header bg-white d-flex flex-wrap justify-content-between align-items-center">
              <h5 className="font-weight-bold mb-0"><i className="fas fa-users-cog text-primary mr-2"></i>Top Players Table</h5>
              <div className="form-inline">
                <input
                  type="text"
                  className="form-control form-control-sm mr-2"
                  placeholder="Search user name/UID/email..."
                  value={playersSearch}
                  onChange={(e) => setPlayersSearch(e.target.value)}
                />
                <button onClick={fetchParticipants} className="btn btn-sm btn-secondary">
                  <i className="fas fa-search"></i>
                </button>
              </div>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover table-striped mb-0 align-middle">
                  <thead className="thead-light text-xs uppercase">
                    <tr>
                      <th>Rank</th>
                      <th>User</th>
                      <th>Coins</th>
                      <th>Offers</th>
                      <th>Referrals</th>
                      <th>Anti-Cheat Flag</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playersList.map((player) => (
                      <tr key={player.id}>
                        <td className="font-weight-bold">#{player.rank}</td>
                        <td>
                          <div className="d-flex align-items-center">
                            <img src={player.profile_pic || 'https://ui-avatars.com/api/?name=User'} className="rounded-circle mr-2" style={{ width: '32px', height: '32px' }} alt="" />
                            <div>
                              <div className="font-weight-bold">{player.name}</div>
                              <span className="text-muted text-xs">UID: {player.uid}</span>
                            </div>
                          </div>
                        </td>
                        <td className="font-weight-bold text-warning">{player.coins.toLocaleString()}</td>
                        <td>{player.offers}</td>
                        <td>{player.referrals}</td>
                        <td>
                          <span className={`badge ${player.flag_level === 'High' ? 'badge-danger' : (player.flag_level === 'Medium' ? 'badge-warning' : 'badge-success')}`}>
                            {player.flag_level} Risk
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${player.status === 'Qualified' ? 'badge-success' : 'badge-danger'}`}>{player.status}</span>
                        </td>
                        <td>
                          <button onClick={() => setSelectedPlayer(player)} className="btn btn-xs btn-outline-info mr-1">
                            <i className="fas fa-eye"></i> View
                          </button>
                          <button
                            onClick={() => {
                              setSelectedPlayer(player);
                              setAdjustModal(true);
                            }}
                            className="btn btn-xs btn-outline-warning"
                          >
                            <i className="fas fa-sliders-h"></i> Adjust
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 5: ANTI-CHEAT PANEL */}
      {subTab === 'anti_cheat' && (
        <div className="card shadow-sm border-0 rounded-lg">
          <div className="card-header bg-white font-weight-bold">
            <i className="fas fa-user-shield text-danger mr-2"></i>Anti-Cheat Automated Flag Analysis
          </div>
          <div className="card-body">
            <div className="row">
              <div className="col-md-4">
                <div className="card bg-light p-3 mb-3 border-left-danger">
                  <span className="text-muted text-xs font-weight-bold">Duplicate Devices</span>
                  <h3 className="font-weight-bold text-danger">{antiCheatData.anti_cheat_summary?.duplicate_device_flags}</h3>
                </div>
              </div>
              <div className="col-md-4">
                <div className="card bg-light p-3 mb-3 border-left-warning">
                  <span className="text-muted text-xs font-weight-bold">Emulator Detections</span>
                  <h3 className="font-weight-bold text-warning">{antiCheatData.anti_cheat_summary?.emulator_flags}</h3>
                </div>
              </div>
              <div className="col-md-4">
                <div className="card bg-light p-3 mb-3 border-left-info">
                  <span className="text-muted text-xs font-weight-bold">Rapid Offer Spam</span>
                  <h3 className="font-weight-bold text-info">{antiCheatData.anti_cheat_summary?.rapid_offer_spam_flags}</h3>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 6: COIN STATISTICS */}
      {subTab === 'coin_stats' && (
        <div className="card shadow-sm border-0 rounded-lg">
          <div className="card-header bg-white font-weight-bold">
            <i className="fas fa-coins text-warning mr-2"></i>Coins Economics & Statistics
          </div>
          <div className="card-body">
            <div className="row">
              <div className="col-md-4 mb-3">
                <div className="card bg-primary text-white p-3">
                  <span className="text-xs uppercase">Coins Earned Today</span>
                  <h2>{coinStats.coins_earned_today?.toLocaleString()}</h2>
                </div>
              </div>
              <div className="col-md-4 mb-3">
                <div className="card bg-success text-white p-3">
                  <span className="text-xs uppercase">Coins Distributed</span>
                  <h2>{coinStats.coins_distributed?.toLocaleString()}</h2>
                </div>
              </div>
              <div className="col-md-4 mb-3">
                <div className="card bg-warning text-dark p-3">
                  <span className="text-xs uppercase font-weight-bold">Current Coin Supply</span>
                  <h2>{coinStats.current_coin_supply?.toLocaleString()}</h2>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 7: REWARD DISTRIBUTION MANAGER */}
      {subTab === 'distribution' && (
        <div className="card shadow-sm border-0 rounded-lg">
          <div className="card-header bg-white font-weight-bold">
            <i className="fas fa-gift text-success mr-2"></i>Reward Distribution Manager
          </div>
          <div className="card-body text-center py-5">
            <i className="fas fa-trophy fa-3x text-warning mb-3"></i>
            <h4>End-of-Season Winner Approval & Distribution</h4>
            <p className="text-muted max-w-md mx-auto">Click below to review top qualified players, approve rewards, and automatically dispatch coin transactions & push notifications.</p>
            <button onClick={handleDistributeRewards} className="btn btn-lg btn-success font-weight-bold px-4">
              <i className="fas fa-paper-plane mr-2"></i> Approve & Distribute Winner Rewards
            </button>
          </div>
        </div>
      )}

      {/* SUBTAB 8: ANNOUNCEMENT PANEL & FCM PUSH NOTIFICATIONS */}
      {subTab === 'announcement' && (
        <div className="row">
          <div className="col-md-6">
            <div className="card shadow-sm border-0 rounded-lg">
              <div className="card-header bg-white font-weight-bold">
                <i className="fas fa-bullhorn text-primary mr-2"></i>Leaderboard Home Announcement Banner
              </div>
              <div className="card-body">
                <form onSubmit={handleSaveAnnouncement}>
                  <div className="form-group">
                    <label className="text-xs uppercase font-weight-bold">Banner Title</label>
                    <input
                      type="text"
                      className="form-control"
                      value={announcementForm.title}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-xs uppercase font-weight-bold">Announcement Message</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={announcementForm.message}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, message: e.target.value })}
                      required
                    ></textarea>
                  </div>
                  <button type="submit" className="btn btn-primary font-weight-bold">
                    <i className="fas fa-broadcast-tower mr-1"></i> Update Live Banner
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="col-md-6">
            <div className="card shadow-sm border-0 rounded-lg">
              <div className="card-header bg-white font-weight-bold">
                <i className="fas fa-paper-plane text-success mr-2"></i>Dispatch Winner FCM Push Notifications
              </div>
              <div className="card-body">
                <form onSubmit={handleSendFcmPush}>
                  <div className="form-group">
                    <label className="text-xs uppercase font-weight-bold">Notification Target</label>
                    <select
                      className="form-control"
                      value={fcmForm.target_type}
                      onChange={(e) => setFcmForm({ ...fcmForm, target_type: e.target.value })}
                    >
                      <option value="broadcast">📢 Global Broadcast (All App Users)</option>
                      <option value="specific">🎯 Specific Winner User ID</option>
                    </select>
                  </div>

                  {fcmForm.target_type === 'specific' && (
                    <div className="form-group">
                      <label className="text-xs uppercase font-weight-bold">Target Winner User ID</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Paste user UUID or public UID"
                        value={fcmForm.target_user_id}
                        onChange={(e) => setFcmForm({ ...fcmForm, target_user_id: e.target.value })}
                        required
                      />
                    </div>
                  )}

                  <div className="form-group">
                    <label className="text-xs uppercase font-weight-bold">Push Notification Title</label>
                    <input
                      type="text"
                      className="form-control font-weight-bold"
                      value={fcmForm.title}
                      onChange={(e) => setFcmForm({ ...fcmForm, title: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="text-xs uppercase font-weight-bold">Push Message Body</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={fcmForm.message}
                      onChange={(e) => setFcmForm({ ...fcmForm, message: e.target.value })}
                      required
                    ></textarea>
                  </div>

                  <button type="submit" className="btn btn-success font-weight-bold">
                    <i className="fas fa-paper-plane mr-1"></i> Send FCM Push Notification
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 9: AUDIT LOGS */}
      {subTab === 'logs' && (
        <div className="card shadow-sm border-0 rounded-lg">
          <div className="card-header bg-white font-weight-bold">
            <i className="fas fa-history text-secondary mr-2"></i>Admin Leaderboard Audit Logs
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-striped table-hover mb-0">
                <thead className="thead-light text-xs uppercase">
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Target User / Item</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logsList.map((log) => (
                    <tr key={log.id}>
                      <td className="text-muted text-xs">{new Date(log.created_at).toLocaleString()}</td>
                      <td><span className="badge badge-info">{log.action}</span></td>
                      <td className="font-weight-bold">{log.target_user || 'System'}</td>
                      <td className="text-sm">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Score Adjustment Modal */}
      {adjustModal && selectedPlayer && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-lg shadow-lg">
              <div className="modal-header">
                <h5 className="modal-title font-weight-bold">Manual Player Adjustment</h5>
                <button type="button" className="close" onClick={() => setAdjustModal(false)}>&times;</button>
              </div>
              <form onSubmit={handleScoreAdjustSubmit}>
                <div className="modal-body">
                  <p className="text-sm">Adjusting player: <strong>{selectedPlayer.name}</strong> (UID: {selectedPlayer.uid})</p>
                  <div className="form-group">
                    <label className="text-xs uppercase font-weight-bold">Action Type</label>
                    <select className="form-control" value={adjustAction} onChange={(e) => setAdjustAction(e.target.value)}>
                      <option value="INCREASE">➕ Increase Score / Balance</option>
                      <option value="DECREASE">➖ Decrease Score / Balance</option>
                      <option value="DISQUALIFY">🚫 Disqualify Player</option>
                      <option value="RESTORE">✅ Restore Player</option>
                    </select>
                  </div>
                  {(adjustAction === 'INCREASE' || adjustAction === 'DECREASE') && (
                    <div className="form-group">
                      <label className="text-xs uppercase font-weight-bold">Amount (Coins)</label>
                      <input
                        type="number"
                        className="form-control"
                        placeholder="e.g. 500"
                        value={adjustAmount}
                        onChange={(e) => setAdjustAmount(e.target.value)}
                        required
                      />
                    </div>
                  )}
                  <div className="form-group">
                    <label className="text-xs uppercase font-weight-bold">Reason / Note</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Admin bonus adjustment"
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setAdjustModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary font-weight-bold">Confirm Adjustment</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
