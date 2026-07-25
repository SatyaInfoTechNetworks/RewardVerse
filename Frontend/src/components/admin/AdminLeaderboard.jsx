import React, { useState, useEffect } from 'react';

export default function AdminLeaderboard({ apiBase, getHeaders, showNotice }) {
  const [subTab, setSubTab] = useState('overview'); // overview, builder, players, security, payouts

  // Dashboard KPI Overview state
  const [dashStats, setDashStats] = useState({
    active_leaderboards: 6,
    participants: 0,
    prize_pool_coins: 0,
    rewards_pending: 0,
    rewards_distributed: 0,
    total_reward_coins_given: 0,
    current_season: new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
  });

  // All Configured Contests state
  const [leaderboardsList, setLeaderboardsList] = useState([]);
  const [editingLb, setEditingLb] = useState(null);
  const [lbForm, setLbForm] = useState({
    id: '',
    name: 'Daily Earnings',
    type: 'EARNINGS', // EARNINGS or REFERRAL
    period: 'DAILY', // DAILY, WEEKLY, MONTHLY, ALL_TIME
    minimum_score: 0,
    minimum_referrals: 0,
    reward_pool: 5000,
    dynamic_pool_enabled: true,
    pool_growth_per_user: 5,
    max_pool_cap: 25000,
    max_winners: 20,
    start_date: '',
    end_date: '',
    auto_reward: false,
    show_on_home: true,
    status: 'ACTIVE',
    tiers: [
      { start_rank: 1, end_rank: 1, reward_coins: 1500 },
      { start_rank: 2, end_rank: 2, reward_coins: 1000 },
      { start_rank: 3, end_rank: 3, reward_coins: 500 },
      { start_rank: 4, end_rank: 10, reward_coins: 200 },
      { start_rank: 11, end_rank: 20, reward_coins: 60 }
    ]
  });

  // Participant stats & players list state
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

  // Anti-cheat state
  const [antiCheatData, setAntiCheatData] = useState({
    anti_cheat_summary: {
      duplicate_device_flags: 0,
      emulator_flags: 0,
      rapid_offer_spam_flags: 0,
      vpn_proxy_flags: 0,
      click_farm_detection_flags: 0
    },
    duplicate_devices: []
  });

  // Announcement & FCM Push state
  const [announcementForm, setAnnouncementForm] = useState({
    title: '🏆 Season Leaderboard is LIVE!',
    message: 'Top players win FREE Coins. Keep earning daily!',
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
    if (subTab === 'players') fetchParticipants();
    if (subTab === 'security') fetchAntiCheat();
    if (subTab === 'payouts') fetchLogs();
  };

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
      pool_growth_per_user: parseFloat(lb.pool_growth_per_user) || 5,
      max_pool_cap: parseFloat(lb.max_pool_cap) || 25000,
      max_winners: parseInt(lb.max_winners) || 20,
      start_date: lb.start_date ? new Date(lb.start_date).toISOString().slice(0, 16) : '',
      end_date: lb.end_date ? new Date(lb.end_date).toISOString().slice(0, 16) : '',
      auto_reward: lb.auto_reward ? true : false,
      show_on_home: lb.show_on_home ? true : false,
      status: lb.status || 'ACTIVE',
      tiers: Array.isArray(lb.tiers) && lb.tiers.length > 0 ? lb.tiers : [
        { start_rank: 1, end_rank: 1, reward_coins: Math.round((lb.reward_pool || 5000) * 0.3) },
        { start_rank: 2, end_rank: 2, reward_coins: Math.round((lb.reward_pool || 5000) * 0.2) },
        { start_rank: 3, end_rank: 3, reward_coins: Math.round((lb.reward_pool || 5000) * 0.1) },
        { start_rank: 4, end_rank: 10, reward_coins: Math.round(((lb.reward_pool || 5000) * 0.25) / 7) },
        { start_rank: 11, end_rank: lb.max_winners || 20, reward_coins: Math.round(((lb.reward_pool || 5000) * 0.15) / 10) }
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

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${apiBase}/api/admin/leaderboard/logs`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success && data.logs) setLogsList(data.logs);
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  const handleSaveLbConfig = async (e) => {
    if (e) e.preventDefault();
    try {
      const res = await fetch(`${apiBase}/api/admin/leaderboard/save`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(lbForm)
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', 'Leaderboard configuration & reward tiers saved successfully!');
        fetchLeaderboards();
        fetchDashboardOverview();
      } else {
        showNotice('error', data.message || 'Failed to save config.');
      }
    } catch (err) {
      showNotice('error', 'Network error saving leaderboard config.');
    }
  };

  const handleTierChange = (index, field, value) => {
    const newTiers = [...lbForm.tiers];
    newTiers[index] = { ...newTiers[index], [field]: parseFloat(value) || 0 };
    setLbForm({ ...lbForm, tiers: newTiers });
  };

  const handleDeleteLb = async (lbToDelete) => {
    const target = lbToDelete || editingLb;
    if (!target || !target.id) {
      showNotice('error', 'Select a valid leaderboard contest to delete.');
      return;
    }

    if (!window.confirm(`Are you sure you want to PERMANENTLY DELETE contest "${target.name}"? This action cannot be undone!`)) {
      return;
    }

    try {
      const res = await fetch(`${apiBase}/api/admin/leaderboard/delete/${target.id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', data.message || 'Contest deleted successfully!');
        if (editingLb?.id === target.id) setEditingLb(null);
        fetchLeaderboards();
        fetchDashboardOverview();
      } else {
        showNotice('error', data.message || 'Failed to delete contest.');
      }
    } catch (err) {
      showNotice('error', 'Error deleting leaderboard contest.');
    }
  };

  const addTierRow = () => {
    const lastEnd = lbForm.tiers.length > 0 ? lbForm.tiers[lbForm.tiers.length - 1].end_rank : 0;
    setLbForm({
      ...lbForm,
      tiers: [
        ...lbForm.tiers,
        { start_rank: lastEnd + 1, end_rank: lastEnd + 5, reward_coins: 100 }
      ]
    });
  };

  const removeTierRow = (index) => {
    const newTiers = lbForm.tiers.filter((_, idx) => idx !== index);
    setLbForm({ ...lbForm, tiers: newTiers });
  };

  const handleAdjustPlayerScore = async () => {
    if (!selectedPlayer) return;
    try {
      const res = await fetch(`${apiBase}/api/admin/leaderboard/adjust-score`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          user_id: selectedPlayer.id,
          leaderboard_id: editingLb?.id || 'main',
          action: adjustAction,
          amount: parseFloat(adjustAmount) || 0,
          reason: adjustReason
        })
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', data.message || 'Player score updated!');
        setAdjustModal(false);
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
      if (data.success) showNotice('success', 'Leaderboard announcement updated!');
      else showNotice('error', data.message);
    } catch (err) {
      showNotice('error', 'Failed to update announcement.');
    }
  };

  const handleSendFcmPush = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${apiBase}/api/admin/leaderboard/send-fcm`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(fcmForm)
      });
      const data = await res.json();
      if (data.success) showNotice('success', data.message || 'FCM Push Notification sent!');
      else showNotice('error', data.message);
    } catch (err) {
      showNotice('error', 'Failed to send FCM Push Notification.');
    }
  };

  const handleDistributeRewards = async (targetLb) => {
    const lbToDistribute = targetLb || editingLb;
    if (!window.confirm(`Are you sure you want to approve & distribute rewards for "${lbToDistribute?.name || 'Selected Contest'}"? This will immediately credit user balances & dispatch FCM notifications!`)) return;
    try {
      const winners = playersList.slice(0, lbToDistribute?.max_winners || 20).map((player, idx) => ({
        user_id: player.id,
        rank: idx + 1,
        reward_coins: idx === 0 ? 5000 : (idx === 1 ? 3000 : (idx === 2 ? 2000 : 500))
      }));

      const res = await fetch(`${apiBase}/api/admin/leaderboard/distribute`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ leaderboard_id: lbToDistribute?.id, winners })
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

  // Total allocated coins calculator across tiers
  const totalAllocatedCoins = lbForm.tiers.reduce((sum, t) => {
    const numWinners = Math.max(1, (t.end_rank - t.start_rank) + 1);
    return sum + (t.reward_coins * numWinners);
  }, 0);

  return (
    <div className="container-fluid py-2">
      {/* EXECUTIVE HEADER CARD */}
      <div className="card border shadow-sm mb-4 rounded-lg bg-white">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap align-items-center justify-content-between">
            <div className="mb-2 mb-md-0">
              <div className="d-flex align-items-center">
                <div className="bg-primary text-white rounded-circle p-3 mr-3 shadow-sm">
                  <i className="fas fa-trophy fa-2x"></i>
                </div>
                <div>
                  <h3 className="font-weight-bold mb-1 text-dark">Leaderboard Master Control</h3>
                  <p className="text-muted text-sm mb-0 font-weight-bold">
                    Manage Dynamic Prize Pools, Tier Builders, Anti-Cheat & FCM Winner Distributions
                  </p>
                </div>
              </div>
            </div>
            
            <div className="d-flex flex-wrap align-items-center">
              <button onClick={refreshAllData} className="btn btn-outline-primary btn-sm font-weight-bold mr-2 mb-2 mb-md-0 shadow-sm">
                <i className="fas fa-sync-alt mr-1"></i> Sync Realtime
              </button>
              <button
                onClick={() => {
                  setEditingLb(null);
                  setLbForm({
                    id: '',
                    name: 'New Custom Contest',
                    type: 'EARNINGS',
                    period: 'DAILY',
                    minimum_score: 100,
                    minimum_referrals: 0,
                    reward_pool: 5000,
                    dynamic_pool_enabled: true,
                    pool_growth_per_user: 5,
                    max_pool_cap: 25000,
                    max_winners: 20,
                    start_date: '',
                    end_date: '',
                    auto_reward: false,
                    show_on_home: true,
                    status: 'ACTIVE',
                    tiers: [
                      { start_rank: 1, end_rank: 1, reward_coins: 1500 },
                      { start_rank: 2, end_rank: 2, reward_coins: 1000 },
                      { start_rank: 3, end_rank: 3, reward_coins: 500 }
                    ]
                  });
                  setSubTab('builder');
                }}
                className="btn btn-primary btn-sm font-weight-bold mr-2 mb-2 mb-md-0 shadow-sm"
              >
                <i className="fas fa-plus-circle mr-1"></i> + Create Custom Contest
              </button>
              <div className="bg-warning text-dark border px-3 py-2 rounded-lg shadow-sm font-weight-bold text-sm">
                <i className="fas fa-coins mr-1"></i> Total Pool: <strong>{dashStats.prize_pool_coins?.toLocaleString()} Coins</strong>
              </div>
            </div>
          </div>

          <hr className="my-3" />

          {/* MAIN 5-TAB NAVIGATION SYSTEM */}
          <ul className="nav nav-pills font-weight-bold">
            <li className="nav-item mr-2 mb-2">
              <button
                onClick={() => setSubTab('overview')}
                className={`nav-link px-3 py-2 rounded-lg ${subTab === 'overview' ? 'active bg-primary text-white shadow-sm' : 'bg-light text-dark border'}`}
              >
                <i className="fas fa-chart-pie mr-2"></i> 📊 Contests Overview ({leaderboardsList.length})
              </button>
            </li>
            <li className="nav-item mr-2 mb-2">
              <button
                onClick={() => setSubTab('builder')}
                className={`nav-link px-3 py-2 rounded-lg ${subTab === 'builder' ? 'active bg-primary text-white shadow-sm' : 'bg-light text-dark border'}`}
              >
                <i className="fas fa-layer-group mr-2"></i> 🏆 Contest & Tier Builder
              </button>
            </li>
            <li className="nav-item mr-2 mb-2">
              <button
                onClick={() => setSubTab('players')}
                className={`nav-link px-3 py-2 rounded-lg ${subTab === 'players' ? 'active bg-primary text-white shadow-sm' : 'bg-light text-dark border'}`}
              >
                <i className="fas fa-users mr-2"></i> 👥 Players & Moderation
              </button>
            </li>
            <li className="nav-item mr-2 mb-2">
              <button
                onClick={() => setSubTab('security')}
                className={`nav-link px-3 py-2 rounded-lg ${subTab === 'security' ? 'active bg-primary text-white shadow-sm' : 'bg-light text-dark border'}`}
              >
                <i className="fas fa-user-shield mr-2"></i> 🛡️ Anti-Cheat Panel
              </button>
            </li>
            <li className="nav-item mr-2 mb-2">
              <button
                onClick={() => setSubTab('payouts')}
                className={`nav-link px-3 py-2 rounded-lg ${subTab === 'payouts' ? 'active bg-primary text-white shadow-sm' : 'bg-light text-dark border'}`}
              >
                <i className="fas fa-gift mr-2"></i> 💰 Payouts, FCM & Audit
              </button>
            </li>
          </ul>
        </div>
      </div>

      {/* TAB 1: CONTESTS OVERVIEW */}
      {subTab === 'overview' && (
        <div>
          {/* 5 KPI SUMMARY CARDS */}
          <div className="row mb-4">
            <div className="col-lg-2 col-md-4 col-6 mb-3">
              <div className="card border-0 shadow-sm rounded-lg bg-primary text-white h-100">
                <div className="card-body p-3">
                  <span className="text-xs font-weight-bold text-uppercase text-white-50">Active Contests</span>
                  <h2 className="font-weight-bold text-white mb-0 mt-1">{dashStats.active_leaderboards}</h2>
                </div>
              </div>
            </div>
            <div className="col-lg-2 col-md-4 col-6 mb-3">
              <div className="card border-0 shadow-sm rounded-lg bg-success text-white h-100">
                <div className="card-body p-3">
                  <span className="text-xs font-weight-bold text-uppercase text-white-50">Total Participants</span>
                  <h2 className="font-weight-bold text-white mb-0 mt-1">{dashStats.participants?.toLocaleString()}</h2>
                </div>
              </div>
            </div>
            <div className="col-lg-3 col-md-4 col-6 mb-3">
              <div className="card border-0 shadow-sm rounded-lg bg-warning text-dark h-100">
                <div className="card-body p-3">
                  <span className="text-xs font-weight-bold text-uppercase text-dark font-weight-bold">Dynamic Prize Pool</span>
                  <h2 className="font-weight-bold text-dark mb-0 mt-1">{dashStats.prize_pool_coins?.toLocaleString()} Coins</h2>
                </div>
              </div>
            </div>
            <div className="col-lg-2 col-md-6 col-6 mb-3">
              <div className="card border-0 shadow-sm rounded-lg bg-danger text-white h-100">
                <div className="card-body p-3">
                  <span className="text-xs font-weight-bold text-uppercase text-white-50">Rewards Pending</span>
                  <h2 className="font-weight-bold text-white mb-0 mt-1">{dashStats.rewards_pending}</h2>
                </div>
              </div>
            </div>
            <div className="col-lg-3 col-md-6 col-12 mb-3">
              <div className="card border-0 shadow-sm rounded-lg bg-dark text-white h-100">
                <div className="card-body p-3">
                  <span className="text-xs font-weight-bold text-uppercase text-warning">Rewards Distributed</span>
                  <h2 className="font-weight-bold text-warning mb-0 mt-1">{dashStats.rewards_distributed?.toLocaleString()} Winners</h2>
                </div>
              </div>
            </div>
          </div>

          {/* ALL CONTESTS GRID TABLE */}
          <div className="card border-0 shadow-sm rounded-lg">
            <div className="card-header bg-white py-3 d-flex flex-wrap justify-content-between align-items-center">
              <div>
                <h5 className="font-weight-bold text-dark mb-0">
                  <i className="fas fa-list text-primary mr-2"></i>Configured System Contests & Leaderboards
                </h5>
                <span className="text-muted text-xs">Active Season: <strong className="text-success">{dashStats.current_season}</strong></span>
              </div>
              <button
                onClick={() => {
                  setEditingLb(null);
                  setLbForm({
                    id: '',
                    name: 'New Custom Contest',
                    type: 'EARNINGS',
                    period: 'DAILY',
                    minimum_score: 100,
                    minimum_referrals: 0,
                    reward_pool: 5000,
                    dynamic_pool_enabled: true,
                    pool_growth_per_user: 5,
                    max_pool_cap: 25000,
                    max_winners: 20,
                    start_date: '',
                    end_date: '',
                    auto_reward: false,
                    show_on_home: true,
                    status: 'ACTIVE',
                    tiers: [
                      { start_rank: 1, end_rank: 1, reward_coins: 1500 },
                      { start_rank: 2, end_rank: 2, reward_coins: 1000 },
                      { start_rank: 3, end_rank: 3, reward_coins: 500 }
                    ]
                  });
                  setSubTab('builder');
                }}
                className="btn btn-sm btn-primary font-weight-bold"
              >
                <i className="fas fa-plus mr-1"></i> Add Custom Contest
              </button>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="bg-light text-xs font-weight-bold uppercase text-muted">
                    <tr>
                      <th className="py-3 px-4">Contest Name</th>
                      <th>Type</th>
                      <th>Period</th>
                      <th>Base Pool</th>
                      <th>Dynamic Growth</th>
                      <th>Max Winners</th>
                      <th>Home Banner</th>
                      <th>Status</th>
                      <th className="text-right px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboardsList.map((lb) => (
                      <tr key={lb.id}>
                        <td className="py-3 px-4 font-weight-bold text-dark">
                          <i className={`fas ${lb.type === 'EARNINGS' ? 'fa-coins text-warning' : 'fa-users text-info'} mr-2`}></i>
                          {lb.name}
                        </td>
                        <td>
                          <span className={`badge px-2 py-1 ${lb.type === 'EARNINGS' ? 'badge-success' : 'badge-info'}`}>
                            {lb.type === 'EARNINGS' ? '💰 Earnings' : '👥 Referral'}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-light border px-2 py-1 font-weight-bold">{lb.period}</span>
                        </td>
                        <td className="font-weight-bold text-warning">
                          {parseFloat(lb.reward_pool).toLocaleString()} Coins
                        </td>
                        <td>
                          {lb.dynamic_pool_enabled ? (
                            <span className="text-success text-xs font-weight-bold">
                              + {lb.pool_growth_per_user} / user (Cap: {parseFloat(lb.max_pool_cap).toLocaleString()})
                            </span>
                          ) : (
                            <span className="text-muted text-xs">Fixed Pool</span>
                          )}
                        </td>
                        <td className="font-weight-bold">Top {lb.max_winners}</td>
                        <td>
                          {lb.show_on_home ? (
                            <span className="badge badge-success-light text-success font-weight-bold"><i className="fas fa-check-circle mr-1"></i>Visible</span>
                          ) : (
                            <span className="badge badge-light text-muted"><i className="fas fa-eye-slash mr-1"></i>Hidden</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge px-2 py-1 ${lb.status === 'ACTIVE' ? 'badge-success' : 'badge-secondary'}`}>
                            {lb.status}
                          </span>
                        </td>
                        <td className="text-right px-4">
                          <button
                            onClick={() => {
                              selectLeaderboardForEdit(lb);
                              setSubTab('builder');
                            }}
                            className="btn btn-xs btn-outline-primary mr-1"
                            title="Edit Parameters & Tiers"
                          >
                            <i className="fas fa-cog mr-1"></i> Settings
                          </button>
                          <button
                            onClick={() => handleDistributeRewards(lb)}
                            className="btn btn-xs btn-success font-weight-bold mr-1"
                            title="Pay Winners Now"
                          >
                            <i className="fas fa-gift mr-1"></i> Pay
                          </button>
                          <button
                            onClick={() => handleDeleteLb(lb)}
                            className="btn btn-xs btn-outline-danger font-weight-bold"
                            title="Delete Contest"
                          >
                            <i className="fas fa-trash-alt mr-1"></i> Delete
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

      {/* TAB 2: CONTEST & TIER BUILDER */}
      {subTab === 'builder' && (
        <div>
          {/* CONTEST SELECTOR HEADER BAR */}
          <div className="card border-0 shadow-sm mb-4 rounded-lg bg-light">
            <div className="card-body p-3 d-flex flex-wrap align-items-center justify-content-between">
              <div className="d-flex align-items-center mb-2 mb-md-0">
                <span className="font-weight-bold text-dark mr-3">Select Contest to Edit:</span>
                <select
                  value={editingLb?.id || ''}
                  onChange={(e) => {
                    const selected = leaderboardsList.find(l => l.id === e.target.value);
                    if (selected) selectLeaderboardForEdit(selected);
                  }}
                  className="form-control form-control-sm font-weight-bold border-primary shadow-sm"
                  style={{ width: '280px' }}
                >
                  {leaderboardsList.map((lb) => (
                    <option key={lb.id} value={lb.id}>
                      {lb.name} ({lb.type} - {lb.period})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="badge badge-primary px-3 py-2 mr-2">
                  Editing: <strong>{lbForm.name}</strong>
                </span>
                <button
                  type="button"
                  onClick={handleSaveLbConfig}
                  className="btn btn-sm btn-success font-weight-bold shadow-sm"
                >
                  <i className="fas fa-save mr-1"></i> Save Changes
                </button>
              </div>
            </div>
          </div>

          <div className="row">
            {/* LEFT COLUMN: CONTEST PARAMETERS FORM */}
            <div className="col-lg-6 mb-4">
              <div className="card border-0 shadow-sm rounded-lg h-100">
                <div className="card-header bg-white font-weight-bold border-0">
                  <i className="fas fa-sliders-h text-primary mr-2"></i>Contest Settings & Scaling Rules
                </div>
                <div className="card-body">
                  <form onSubmit={handleSaveLbConfig}>
                    <div className="form-group mb-3">
                      <label className="text-xs font-weight-bold text-muted uppercase">Contest Name</label>
                      <input
                        type="text"
                        value={lbForm.name}
                        onChange={(e) => setLbForm({ ...lbForm, name: e.target.value })}
                        className="form-control font-weight-bold"
                        placeholder="e.g. Daily Earnings Leaderboard"
                        required
                      />
                    </div>

                    <div className="row">
                      <div className="col-md-6 form-group mb-3">
                        <label className="text-xs font-weight-bold text-muted uppercase">Contest Type</label>
                        <select
                          value={lbForm.type}
                          onChange={(e) => setLbForm({ ...lbForm, type: e.target.value })}
                          className="form-control font-weight-bold"
                        >
                          <option value="EARNINGS">💰 EARNINGS (Excludes Referrals)</option>
                          <option value="REFERRAL">👥 REFERRAL (Invite Count)</option>
                        </select>
                      </div>

                      <div className="col-md-6 form-group mb-3">
                        <label className="text-xs font-weight-bold text-muted uppercase">Period Reset Frequency</label>
                        <select
                          value={lbForm.period}
                          onChange={(e) => setLbForm({ ...lbForm, period: e.target.value })}
                          className="form-control font-weight-bold"
                        >
                          <option value="DAILY">DAILY (24 Hours Reset)</option>
                          <option value="WEEKLY">WEEKLY (7 Days Reset)</option>
                          <option value="MONTHLY">MONTHLY (Monthly Reset)</option>
                          <option value="ALL_TIME">ALL TIME (Lifetime Total)</option>
                        </select>
                      </div>
                    </div>

                    <div className="row">
                      <div className="col-md-6 form-group mb-3">
                        <label className="text-xs font-weight-bold text-muted uppercase">Base Reward Pool (Coins)</label>
                        <input
                          type="number"
                          value={lbForm.reward_pool}
                          onChange={(e) => setLbForm({ ...lbForm, reward_pool: parseFloat(e.target.value) || 0 })}
                          className="form-control font-weight-bold text-warning"
                          required
                        />
                      </div>

                      <div className="col-md-6 form-group mb-3">
                        <label className="text-xs font-weight-bold text-muted uppercase">Max Winners Count</label>
                        <input
                          type="number"
                          value={lbForm.max_winners}
                          onChange={(e) => setLbForm({ ...lbForm, max_winners: parseInt(e.target.value) || 10 })}
                          className="form-control font-weight-bold"
                          required
                        />
                      </div>
                    </div>

                    {/* DYNAMIC SCALING BOX */}
                    <div className="p-3 bg-light rounded-lg mb-3 border">
                      <div className="custom-control custom-switch mb-2">
                        <input
                          type="checkbox"
                          id="dynamicPoolSwitch"
                          checked={lbForm.dynamic_pool_enabled}
                          onChange={(e) => setLbForm({ ...lbForm, dynamic_pool_enabled: e.target.checked })}
                          className="custom-control-input"
                        />
                        <label htmlFor="dynamicPoolSwitch" className="custom-control-label font-weight-bold text-dark">
                          Enable Dynamic Scaling Prize Pool
                        </label>
                      </div>
                      <small className="text-muted d-block mb-3">
                        Automatically grows prize pool based on total app user registrations.
                      </small>

                      {lbForm.dynamic_pool_enabled && (
                        <div className="row">
                          <div className="col-6 form-group mb-0">
                            <label className="text-xs font-weight-bold">Growth Rate / User</label>
                            <input
                              type="number"
                              value={lbForm.pool_growth_per_user}
                              onChange={(e) => setLbForm({ ...lbForm, pool_growth_per_user: parseFloat(e.target.value) || 0 })}
                              className="form-control form-control-sm"
                            />
                          </div>
                          <div className="col-6 form-group mb-0">
                            <label className="text-xs font-weight-bold">Max Pool Cap</label>
                            <input
                              type="number"
                              value={lbForm.max_pool_cap}
                              onChange={(e) => setLbForm({ ...lbForm, max_pool_cap: parseFloat(e.target.value) || 0 })}
                              className="form-control form-control-sm"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="row">
                      <div className="col-md-6 form-group mb-3">
                        <label className="text-xs font-weight-bold text-muted uppercase">Start Date & Time (Optional)</label>
                        <input
                          type="datetime-local"
                          value={lbForm.start_date}
                          onChange={(e) => setLbForm({ ...lbForm, start_date: e.target.value })}
                          className="form-control form-control-sm"
                        />
                      </div>
                      <div className="col-md-6 form-group mb-3">
                        <label className="text-xs font-weight-bold text-muted uppercase">End Date & Time (Optional)</label>
                        <input
                          type="datetime-local"
                          value={lbForm.end_date}
                          onChange={(e) => setLbForm({ ...lbForm, end_date: e.target.value })}
                          className="form-control form-control-sm"
                        />
                      </div>
                    </div>

                    <div className="d-flex flex-wrap justify-content-between align-items-center mt-3 pt-3 border-top">
                      <div className="custom-control custom-switch">
                        <input
                          type="checkbox"
                          id="showHomeSwitch"
                          checked={lbForm.show_on_home}
                          onChange={(e) => setLbForm({ ...lbForm, show_on_home: e.target.checked })}
                          className="custom-control-input"
                        />
                        <label htmlFor="showHomeSwitch" className="custom-control-label text-sm font-weight-bold">
                          Show Banner on App Home Screen
                        </label>
                      </div>
                      <div>
                        <button type="submit" className="btn btn-primary font-weight-bold px-4 mr-2">
                          <i className="fas fa-save mr-1"></i> Save Contest
                        </button>
                        {editingLb && editingLb.id && (
                          <button
                            type="button"
                            onClick={() => handleDeleteLb(editingLb)}
                            className="btn btn-outline-danger font-weight-bold px-3"
                          >
                            <i className="fas fa-trash-alt mr-1"></i> Delete Contest
                          </button>
                        )}
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: REWARD TIER BUILDER */}
            <div className="col-lg-6 mb-4">
              <div className="card border-0 shadow-sm rounded-lg h-100">
                <div className="card-header bg-white font-weight-bold border-0 d-flex justify-content-between align-items-center">
                  <div>
                    <i className="fas fa-trophy text-warning mr-2"></i>Reward Tiers & Prize Allocation
                  </div>
                  <button onClick={addTierRow} className="btn btn-xs btn-outline-success font-weight-bold">
                    <i className="fas fa-plus mr-1"></i> Add Tier
                  </button>
                </div>
                <div className="card-body">
                  <div className="alert alert-info py-2 px-3 text-xs mb-3">
                    <i className="fas fa-info-circle mr-1"></i> Define rank brackets and prize coins for each position.
                  </div>

                  <div className="table-responsive">
                    <table className="table table-sm table-bordered align-middle">
                      <thead className="thead-light text-xs uppercase">
                        <tr>
                          <th>Start Rank</th>
                          <th>End Rank</th>
                          <th>Coins / Winner</th>
                          <th>Total Tier Coins</th>
                          <th style={{ width: '40px' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lbForm.tiers.map((tier, idx) => {
                          const winnerCount = Math.max(1, (tier.end_rank - tier.start_rank) + 1);
                          const subtotal = tier.reward_coins * winnerCount;

                          return (
                            <tr key={idx}>
                              <td>
                                <input
                                  type="number"
                                  value={tier.start_rank}
                                  onChange={(e) => handleTierChange(idx, 'start_rank', e.target.value)}
                                  className="form-control form-control-sm text-center font-weight-bold"
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  value={tier.end_rank}
                                  onChange={(e) => handleTierChange(idx, 'end_rank', e.target.value)}
                                  className="form-control form-control-sm text-center font-weight-bold"
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  value={tier.reward_coins}
                                  onChange={(e) => handleTierChange(idx, 'reward_coins', e.target.value)}
                                  className="form-control form-control-sm font-weight-bold text-warning"
                                />
                              </td>
                              <td className="font-weight-bold align-middle">
                                {subtotal.toLocaleString()} Coins
                              </td>
                              <td className="text-center align-middle">
                                <button
                                  type="button"
                                  onClick={() => removeTierRow(idx)}
                                  className="btn btn-xs btn-danger"
                                >
                                  <i className="fas fa-times"></i>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-3 bg-dark text-white rounded-lg mt-3 d-flex justify-content-between align-items-center">
                    <div>
                      <span className="text-xs text-muted uppercase d-block">Total Allocated Tiers</span>
                      <strong className="text-warning h4 mb-0">{totalAllocatedCoins.toLocaleString()} Coins</strong>
                    </div>
                    <button onClick={handleSaveLbConfig} className="btn btn-warning btn-sm text-dark font-weight-bold">
                      <i className="fas fa-check-circle mr-1"></i> Save Tiers
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PLAYERS & MODERATION */}
      {subTab === 'players' && (
        <div className="card border-0 shadow-sm rounded-lg">
          <div className="card-header bg-white py-3 d-flex flex-wrap justify-content-between align-items-center">
            <h5 className="font-weight-bold text-dark mb-0">
              <i className="fas fa-users text-primary mr-2"></i>Participant Standings & Anti-Cheat Moderation
            </h5>
            <div className="form-inline mt-2 mt-md-0">
              <input
                type="text"
                value={playersSearch}
                onChange={(e) => setPlayersSearch(e.target.value)}
                placeholder="Search player name, email, UID..."
                className="form-control form-control-sm mr-2"
                style={{ width: '250px' }}
              />
              <button onClick={fetchParticipants} className="btn btn-sm btn-primary">
                <i className="fas fa-search"></i>
              </button>
            </div>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="thead-light text-xs uppercase">
                  <tr>
                    <th>Rank</th>
                    <th>Player</th>
                    <th>Email</th>
                    <th>Total Coins</th>
                    <th>Balance</th>
                    <th>Offers</th>
                    <th>Referrals</th>
                    <th>Risk Flag</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {playersList.map((player) => (
                    <tr key={player.id}>
                      <td className="font-weight-bold">#{player.rank}</td>
                      <td>
                        <div className="d-flex align-items-center">
                          <img
                            src={player.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(player.name)}`}
                            alt="avatar"
                            className="rounded-circle mr-2"
                            style={{ width: '32px', height: '32px' }}
                          />
                          <div>
                            <span className="font-weight-bold text-dark d-block">{player.name}</span>
                            <small className="text-muted">UID: {player.uid}</small>
                          </div>
                        </div>
                      </td>
                      <td className="text-sm">{player.email}</td>
                      <td className="font-weight-bold text-warning">{player.coins?.toLocaleString()}</td>
                      <td className="font-weight-bold">{player.current_balance?.toLocaleString()}</td>
                      <td>{player.offers}</td>
                      <td>{player.referrals}</td>
                      <td>
                        <span className={`badge ${player.flag_level === 'High' ? 'badge-danger' : (player.flag_level === 'Medium' ? 'badge-warning' : 'badge-success')}`}>
                          {player.flag_level || 'Low'} Risk
                        </span>
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => {
                            setSelectedPlayer(player);
                            setAdjustModal(true);
                          }}
                          className="btn btn-xs btn-outline-primary"
                        >
                          <i className="fas fa-user-cog"></i> Moderate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ANTI-CHEAT PANEL */}
      {subTab === 'security' && (
        <div className="card border-0 shadow-sm rounded-lg">
          <div className="card-header bg-white font-weight-bold">
            <i className="fas fa-shield-alt text-danger mr-2"></i>Anti-Cheat Flags & Security Summary
          </div>
          <div className="card-body">
            <div className="row mb-4">
              <div className="col-md-3 col-6 mb-3">
                <div className="p-3 bg-light rounded-lg border">
                  <span className="text-xs text-muted font-weight-bold uppercase">Duplicate Device IDs</span>
                  <h3 className="font-weight-bold text-danger mb-0 mt-1">{antiCheatData.anti_cheat_summary?.duplicate_device_flags}</h3>
                </div>
              </div>
              <div className="col-md-3 col-6 mb-3">
                <div className="p-3 bg-light rounded-lg border">
                  <span className="text-xs text-muted font-weight-bold uppercase">Emulator Detected</span>
                  <h3 className="font-weight-bold text-danger mb-0 mt-1">{antiCheatData.anti_cheat_summary?.emulator_flags}</h3>
                </div>
              </div>
              <div className="col-md-3 col-6 mb-3">
                <div className="p-3 bg-light rounded-lg border">
                  <span className="text-xs text-muted font-weight-bold uppercase">Rapid Spam Flags</span>
                  <h3 className="font-weight-bold text-warning mb-0 mt-1">{antiCheatData.anti_cheat_summary?.rapid_offer_spam_flags}</h3>
                </div>
              </div>
              <div className="col-md-3 col-6 mb-3">
                <div className="p-3 bg-light rounded-lg border">
                  <span className="text-xs text-muted font-weight-bold uppercase">VPN / Proxy Flags</span>
                  <h3 className="font-weight-bold text-info mb-0 mt-1">{antiCheatData.anti_cheat_summary?.vpn_proxy_flags}</h3>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PAYOUTS, FCM & AUDIT */}
      {subTab === 'payouts' && (
        <div className="row">
          <div className="col-lg-6 mb-4">
            <div className="card border-0 shadow-sm rounded-lg mb-4">
              <div className="card-header bg-white font-weight-bold">
                <i className="fas fa-gift text-success mr-2"></i>Manual Winner Payout Execution
              </div>
              <div className="card-body">
                <p className="text-muted text-sm mb-3">
                  Approve and credit coins directly to top winners for the selected contest.
                </p>
                <button onClick={() => handleDistributeRewards(editingLb)} className="btn btn-success font-weight-bold btn-block">
                  <i className="fas fa-check-circle mr-1"></i> Approve & Pay Winners Now
                </button>
              </div>
            </div>

            <div className="card border-0 shadow-sm rounded-lg">
              <div className="card-header bg-white font-weight-bold">
                <i className="fas fa-paper-plane text-primary mr-2"></i>Dispatch Winner FCM Push Notification
              </div>
              <div className="card-body">
                <form onSubmit={handleSendFcmPush}>
                  <div className="form-group mb-2">
                    <label className="text-xs font-weight-bold">Push Title</label>
                    <input
                      type="text"
                      value={fcmForm.title}
                      onChange={(e) => setFcmForm({ ...fcmForm, title: e.target.value })}
                      className="form-control form-control-sm"
                      required
                    />
                  </div>
                  <div className="form-group mb-3">
                    <label className="text-xs font-weight-bold">Message</label>
                    <textarea
                      rows="2"
                      value={fcmForm.message}
                      onChange={(e) => setFcmForm({ ...fcmForm, message: e.target.value })}
                      className="form-control form-control-sm"
                      required
                    ></textarea>
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm font-weight-bold">
                    <i className="fas fa-paper-plane mr-1"></i> Send Push Notification
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="col-lg-6 mb-4">
            <div className="card border-0 shadow-sm rounded-lg h-100">
              <div className="card-header bg-white font-weight-bold">
                <i className="fas fa-bullhorn text-warning mr-2"></i>Home Screen Banner Announcement
              </div>
              <div className="card-body">
                <form onSubmit={handleSaveAnnouncement}>
                  <div className="form-group mb-2">
                    <label className="text-xs font-weight-bold">Banner Title</label>
                    <input
                      type="text"
                      value={announcementForm.title}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                      className="form-control form-control-sm"
                    />
                  </div>
                  <div className="form-group mb-3">
                    <label className="text-xs font-weight-bold">Banner Subtitle / Message</label>
                    <textarea
                      rows="3"
                      value={announcementForm.message}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, message: e.target.value })}
                      className="form-control form-control-sm"
                    ></textarea>
                  </div>
                  <button type="submit" className="btn btn-warning text-dark font-weight-bold btn-sm">
                    <i className="fas fa-save mr-1"></i> Update Home Banner
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODERATE PLAYER MODAL */}
      {adjustModal && selectedPlayer && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-lg">
              <div className="modal-header bg-dark text-white">
                <h5 className="modal-title font-weight-bold">Moderate Player: {selectedPlayer.name}</h5>
                <button onClick={() => setAdjustModal(false)} className="close text-white">&times;</button>
              </div>
              <div className="modal-body">
                <div className="form-group mb-3">
                  <label className="text-xs font-weight-bold">Action</label>
                  <select
                    value={adjustAction}
                    onChange={(e) => setAdjustAction(e.target.value)}
                    className="form-control font-weight-bold"
                  >
                    <option value="INCREASE">➕ Add Score Coins</option>
                    <option value="DECREASE">➖ Deduct Score Coins</option>
                    <option value="DISQUALIFY">🚫 Disqualify Player</option>
                    <option value="RESTORE">✅ Restore Player Eligibility</option>
                  </select>
                </div>
                {(adjustAction === 'INCREASE' || adjustAction === 'DECREASE') && (
                  <div className="form-group mb-3">
                    <label className="text-xs font-weight-bold">Coin Amount</label>
                    <input
                      type="number"
                      value={adjustAmount}
                      onChange={(e) => setAdjustAmount(e.target.value)}
                      className="form-control"
                      placeholder="e.g. 500"
                    />
                  </div>
                )}
                <div className="form-group mb-3">
                  <label className="text-xs font-weight-bold">Reason / Remark</label>
                  <input
                    type="text"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    className="form-control"
                    placeholder="Reason for audit log..."
                  />
                </div>
              </div>
              <div className="modal-footer bg-light">
                <button onClick={() => setAdjustModal(false)} className="btn btn-secondary btn-sm">Cancel</button>
                <button onClick={handleAdjustPlayerScore} className="btn btn-primary btn-sm font-weight-bold">
                  Submit Action
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
