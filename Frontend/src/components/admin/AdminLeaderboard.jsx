import React, { useState, useEffect, useMemo } from 'react';
import { 
  Trophy, Award, Users, DollarSign, Settings, RefreshCw, 
  Send, CheckCircle, AlertCircle, Calendar, Save, Layers, Search,
  Folder, ArrowLeft, ChevronRight, Filter
} from 'lucide-react';

export default function AdminLeaderboard({ getHeaders, showNotice, API_BASE }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPeriod, setSelectedPeriod] = useState('DAILY');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    active_leaderboards: 0,
    participants: 0,
    prize_pool_coins: 0,
    rewards_distributed: 0,
    total_reward_coins_given: 0
  });

  const [leaderboardConfigs, setLeaderboardConfigs] = useState([]);

  const [players, setPlayers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const resolveBaseUrl = () => {
    if (typeof apiBase === 'string' && apiBase.trim() !== '' && apiBase !== 'undefined') return apiBase;
    if (typeof API_BASE === 'string' && API_BASE.trim() !== '' && API_BASE !== 'undefined') return API_BASE;
    return 'https://api-rewardverse.satyainfotechnetworks.com';
  };

  const resolveHeaders = () => {
    if (typeof getHeaders === 'function') return getHeaders();
    const token = localStorage.getItem('adminToken');
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    };
  };

  const fetchDashboardStats = async () => {
    try {
      const res = await fetch(`${resolveBaseUrl()}/api/admin/leaderboard/dashboard`, { headers: resolveHeaders() });
      const data = await res.json();
      if (data.success && data.stats) setStats(data.stats);
    } catch (e) {
      console.error('Error fetching dashboard stats:', e);
    }
  };

  const fetchLeaderboardConfigs = async () => {
    try {
      const res = await fetch(`${resolveBaseUrl()}/api/admin/leaderboard/list`, { headers: resolveHeaders() });
      const data = await res.json();
      if (data.success && data.leaderboards && data.leaderboards.length > 0) {
        setLeaderboardConfigs(data.leaderboards);
      }
    } catch (e) {
      console.error('Error fetching configs:', e);
    }
  };

  const [filters, setFilters] = useState({
    excludeSpin: true,
    excludeStreak: true,
    excludeContest: true,
    excludeBonus: true,
    excludeReferral: true,
    excludeLeaderboard: true
  });

  const fetchTopPlayers = async (period, customFilters = filters) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        period,
        exclude_spin: customFilters.excludeSpin,
        exclude_streak: customFilters.excludeStreak,
        exclude_contest: customFilters.excludeContest,
        exclude_bonus: customFilters.excludeBonus,
        exclude_referral: customFilters.excludeReferral,
        exclude_leaderboard: customFilters.excludeLeaderboard
      });
      const res = await fetch(`${resolveBaseUrl()}/api/admin/leaderboard/participants?${queryParams.toString()}`, { headers: resolveHeaders() });
      const data = await res.json();
      if (data.success && data.players) {
        setPlayers(data.players);
      } else {
        setPlayers([]);
      }
    } catch (e) {
      console.error('Error fetching players:', e);
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterToggle = (key, value) => {
    const updated = { ...filters, [key]: value };
    setFilters(updated);
    fetchTopPlayers(selectedPeriod, updated);
  };

  const [payoutLogs, setPayoutLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);

  const groupedBatches = useMemo(() => {
    const map = new Map();
    payoutLogs.forEach(log => {
      const d = new Date(log.created_at || Date.now());
      const dateStr = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const batchKey = `${dateStr}_${log.leaderboard_name || log.period}`;

      if (!map.has(batchKey)) {
        map.set(batchKey, {
          batch_id: batchKey,
          leaderboard_name: log.leaderboard_name || `${log.period} Leaderboard`,
          period: log.period,
          date_formatted: `${dateStr} (${timeStr})`,
          raw_date: dateStr,
          total_coins: 0,
          winners_count: 0,
          winners: []
        });
      }

      const batch = map.get(batchKey);
      batch.winners.push(log);
      batch.total_coins += parseFloat(log.reward_coins || 0);
      batch.winners_count += 1;
    });

    return Array.from(map.values());
  }, [payoutLogs]);

  const fetchRewardLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch(`${resolveBaseUrl()}/api/admin/leaderboard/logs`, { headers: resolveHeaders() });
      const data = await res.json();
      if (data.success && data.logs) {
        setPayoutLogs(data.logs);
      }
    } catch (e) {
      console.error('Error fetching reward logs:', e);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
    fetchLeaderboardConfigs();
    fetchTopPlayers(selectedPeriod);
    fetchRewardLogs();
  }, []);

  const handlePeriodChange = (period) => {
    setSelectedPeriod(period);
    fetchTopPlayers(period, filters);
  };

  const handleSaveConfig = async (config) => {
    try {
      const res = await fetch(`${resolveBaseUrl()}/api/admin/leaderboard/save`, {
        method: 'POST',
        headers: resolveHeaders(),
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (data.success) {
        if (typeof showNotice === 'function') showNotice('success', `Saved ${config.period} settings!`);
        fetchLeaderboardConfigs();
      } else {
        if (typeof showNotice === 'function') showNotice('error', data.message || 'Failed to save config.');
      }
    } catch (e) {
      if (typeof showNotice === 'function') showNotice('error', 'Error connecting to server.');
    }
  };

  const handleDistributeRewards = async (period) => {
    if (!window.confirm(`Are you sure you want to distribute rewards to Top 100 players for ${period} Leaderboard?`)) return;

    try {
      setLoading(true);
      const res = await fetch(`${resolveBaseUrl()}/api/admin/leaderboard/distribute`, {
        method: 'POST',
        headers: resolveHeaders(),
        body: JSON.stringify({ period })
      });
      const data = await res.json();
      if (data.success) {
        if (typeof showNotice === 'function') showNotice('success', data.message);
        fetchDashboardStats();
      } else {
        if (typeof showNotice === 'function') showNotice('error', data.message || 'Failed to distribute rewards.');
      }
    } catch (e) {
      if (typeof showNotice === 'function') showNotice('error', 'Error executing payout transaction.');
    } finally {
      setLoading(false);
    }
  };

  const filteredPlayers = players.filter(p => 
    (p.name && p.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p.public_id && p.public_id.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p.email && p.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary, #fff)' }}>
            <Trophy size={20} style={{ color: '#f59e0b' }} /> Leaderboard Management
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)', marginTop: '4px' }}>
            Manage Daily, Weekly, Monthly, and All Time Leaderboards, thresholds, and payouts.
          </p>
        </div>
        <button 
          className="btn btn-secondary"
          onClick={() => { fetchDashboardStats(); fetchTopPlayers(selectedPeriod); }}
          style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* KPI Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="glass-panel" style={{ padding: '18px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase', marginBottom: '6px' }}>Active Timeframes</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--text-primary, #fff)' }}>Daily / Wk / Mo</div>
          <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '4px' }}>3 Active Pools</div>
        </div>

        <div className="glass-panel" style={{ padding: '18px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase', marginBottom: '6px' }}>Qualified Players</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--text-primary, #fff)' }}>{players.length} Players</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)', marginTop: '4px' }}>Top 100 Per Timeframe</div>
        </div>

        <div className="glass-panel" style={{ padding: '18px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase', marginBottom: '6px' }}>Active Prize Pool</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#f59e0b' }}>
            {stats.prize_pool_coins ? stats.prize_pool_coins.toLocaleString() : '70,000'} Coins
          </div>
          <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '4px' }}>Global Dynamic Allocation</div>
        </div>

        <div className="glass-panel" style={{ padding: '18px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase', marginBottom: '6px' }}>Total Payouts Given</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#10b981' }}>{stats.rewards_distributed || 0} Rewards</div>
          <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '4px' }}>Distributed to winners</div>
        </div>
      </div>

      {/* Tab Controls */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', pb: '8px' }}>
        <button
          className={activeTab === 'overview' ? 'btn btn-primary' : 'btn btn-secondary'}
          onClick={() => setActiveTab('overview')}
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
        >
          Overview & Distribute
        </button>
        <button
          className={activeTab === 'builder' ? 'btn btn-primary' : 'btn btn-secondary'}
          onClick={() => setActiveTab('builder')}
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
        >
          Period & Tier Configurator
        </button>
        <button
          className={activeTab === 'players' ? 'btn btn-primary' : 'btn btn-secondary'}
          onClick={() => setActiveTab('players')}
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
        >
          Live Top 100 Players
        </button>
        <button
          className={activeTab === 'logs' ? 'btn btn-primary' : 'btn btn-secondary'}
          onClick={() => { setActiveTab('logs'); fetchRewardLogs(); }}
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
        >
          📜 Payout & Distribution History
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          {['DAILY', 'WEEKLY', 'MONTHLY'].map((periodKey) => {
            const config = leaderboardConfigs.find(c => c.period === periodKey) || {};
            return (
              <div key={periodKey} className="glass-panel" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', background: 'rgba(168,85,247,0.2)', color: '#c084fc', padding: '3px 10px', borderRadius: '12px' }}>
                    {periodKey}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '6px' }}>Active</span>
                </div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '1.05rem', color: 'var(--text-primary, #fff)' }}>{config.name || `${periodKey} Leaderboard`}</h4>
                
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #94a3b8)', lineHeight: '1.8' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Min Coin Threshold:</span>
                    <strong style={{ color: '#f59e0b' }}>{config.minimum_score || 0} Coins</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Total Prize Pool:</span>
                    <strong style={{ color: '#10b981' }}>{(config.reward_pool || 0).toLocaleString()} Coins</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Max Winners:</span>
                    <span>{config.max_winners || 100} Players</span>
                  </div>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={() => handleDistributeRewards(periodKey)}
                  disabled={loading}
                  style={{ width: '100%', marginTop: '16px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <Send size={14} /> Distribute {periodKey} Rewards
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Configurator */}
      {activeTab === 'builder' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {leaderboardConfigs.map((config, index) => (
            <div key={config.period || index} className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
                <h4 style={{ margin: 0, color: '#f59e0b', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Trophy size={16} /> {config.name || `${config.period} Leaderboard`}
                </h4>
                <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.8rem' }} onClick={() => handleSaveConfig(config)}>
                  <Save size={14} /> Save Config
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Min Coin Threshold</label>
                  <input
                    type="number"
                    className="glass-input"
                    value={config.minimum_score}
                    onChange={(e) => {
                      const updated = [...leaderboardConfigs];
                      updated[index].minimum_score = parseFloat(e.target.value) || 0;
                      setLeaderboardConfigs(updated);
                    }}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Prize Pool (Coins)</label>
                  <input
                    type="number"
                    className="glass-input"
                    value={config.reward_pool}
                    onChange={(e) => {
                      const updated = [...leaderboardConfigs];
                      updated[index].reward_pool = parseFloat(e.target.value) || 0;
                      setLeaderboardConfigs(updated);
                    }}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Max Winners Limit</label>
                  <input
                    type="number"
                    className="glass-input"
                    value={config.max_winners || 100}
                    onChange={(e) => {
                      const updated = [...leaderboardConfigs];
                      updated[index].max_winners = parseInt(e.target.value) || 100;
                      setLeaderboardConfigs(updated);
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Reward Tiers Breakdown</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
                  {(config.tiers || []).map((tier, tierIdx) => (
                    <div key={tierIdx} style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#a78bfa', display: 'block', marginBottom: '4px' }}>
                        Rank {tier.start_rank} {tier.end_rank > tier.start_rank ? `- ${tier.end_rank}` : ''}
                      </span>
                      <input
                        type="number"
                        className="glass-input"
                        style={{ padding: '4px 8px', fontSize: '0.8rem', color: '#10b981', fontWeight: 'bold' }}
                        value={tier.reward_coins}
                        onChange={(e) => {
                          const updated = [...leaderboardConfigs];
                          updated[index].tiers[tierIdx].reward_coins = parseFloat(e.target.value) || 0;
                          setLeaderboardConfigs(updated);
                        }}
                      />
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted, #64748b)', display: 'block', marginTop: '2px' }}>Coins / winner</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Players */}
      {activeTab === 'players' && (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              {['DAILY', 'WEEKLY', 'MONTHLY', 'ALLTIME'].map(p => (
                <button
                  key={p}
                  className={selectedPeriod === p ? 'btn btn-primary' : 'btn btn-secondary'}
                  style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                  onClick={() => handlePeriodChange(p)}
                >
                  {p}
                </button>
              ))}
            </div>

            <input
              type="text"
              className="glass-input"
              placeholder="Search user..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '220px', padding: '6px 12px', fontSize: '0.8rem' }}
            />
          </div>

          {selectedPeriod !== 'ALLTIME' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary, #94a3b8)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Filter size={14} /> Exclude Sources:
              </span>
              <label style={{ fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary, #cbd5e1)' }}>
                <input type="checkbox" checked={filters.excludeSpin} onChange={(e) => handleFilterToggle('excludeSpin', e.target.checked)} /> Spins
              </label>
              <label style={{ fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary, #cbd5e1)' }}>
                <input type="checkbox" checked={filters.excludeStreak} onChange={(e) => handleFilterToggle('excludeStreak', e.target.checked)} /> Streaks
              </label>
              <label style={{ fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary, #cbd5e1)' }}>
                <input type="checkbox" checked={filters.excludeContest} onChange={(e) => handleFilterToggle('excludeContest', e.target.checked)} /> Contests
              </label>
              <label style={{ fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary, #cbd5e1)' }}>
                <input type="checkbox" checked={filters.excludeBonus} onChange={(e) => handleFilterToggle('excludeBonus', e.target.checked)} /> Bonuses
              </label>
              <label style={{ fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary, #cbd5e1)' }}>
                <input type="checkbox" checked={filters.excludeReferral} onChange={(e) => handleFilterToggle('excludeReferral', e.target.checked)} /> Referrals
              </label>
              <label style={{ fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary, #cbd5e1)' }}>
                <input type="checkbox" checked={filters.excludeLeaderboard} onChange={(e) => handleFilterToggle('excludeLeaderboard', e.target.checked)} /> Leaderboard Prizes
              </label>
            </div>
          )}

          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>Loading players...</p>
          ) : filteredPlayers.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No players found for {selectedPeriod} period.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                    <th style={{ padding: '10px' }}>Rank</th>
                    <th style={{ padding: '10px' }}>User</th>
                    <th style={{ padding: '10px' }}>Public Hex ID</th>
                    <th style={{ padding: '10px' }}>Email</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Score / Earnings</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.map((player) => (
                    <tr key={player.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px', fontWeight: 'bold' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '0.75rem',
                          background: player.rank === 1 ? 'rgba(245,158,11,0.2)' : player.rank === 2 ? 'rgba(255,255,255,0.1)' : player.rank === 3 ? 'rgba(205,127,50,0.2)' : 'rgba(255,255,255,0.03)',
                          color: player.rank === 1 ? '#f59e0b' : player.rank === 2 ? '#e2e8f0' : player.rank === 3 ? '#cd7f32' : 'var(--text-secondary)'
                        }}>
                          #{player.rank}
                        </span>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <img
                            src={player.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(player.name || 'User')}`}
                            alt=""
                            style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                          <span style={{ color: 'var(--text-primary, #fff)', fontWeight: '500' }}>{player.name || 'User'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px', color: '#a78bfa', fontFamily: 'monospace' }}>{player.public_id || player.id.substring(0, 8)}</td>
                      <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{player.email || 'N/A'}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: '#10b981' }}>
                        {player.score.toLocaleString()} Coins
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Payout History & Audit Logs (Folder View) */}
      {activeTab === 'logs' && (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {selectedBatch && (
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setSelectedBatch(null)}
                  style={{ padding: '5px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <ArrowLeft size={14} /> Back to Folders
                </button>
              )}
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary, #fff)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Folder size={18} color="#c084fc" /> 
                {selectedBatch ? `${selectedBatch.leaderboard_name} — ${selectedBatch.date_formatted}` : 'Payout Distribution History Folders'}
              </h3>
            </div>
            
            <button className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: '0.78rem' }} onClick={fetchRewardLogs}>
              <RefreshCw size={14} /> Refresh Logs
            </button>
          </div>

          {loadingLogs ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>Loading distribution logs...</p>
          ) : payoutLogs.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No reward payout logs recorded yet. Click "Distribute Rewards" on any active contest to credit rewards & log transactions.</p>
          ) : !selectedBatch ? (
            /* Folder Batch Grid View */
            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '16px' }}>
                Click on any Leaderboard Distribution Folder to view detailed user payouts and rank breakdowns.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {groupedBatches.map((batch) => (
                  <div
                    key={batch.batch_id}
                    className="glass-panel"
                    onClick={() => setSelectedBatch(batch)}
                    style={{
                      padding: '16px',
                      cursor: 'pointer',
                      border: '1px solid rgba(168,85,247,0.25)',
                      background: 'rgba(168,85,247,0.04)',
                      borderRadius: '12px',
                      transition: 'all 0.2s ease-in-out'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(168,85,247,0.12)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(168,85,247,0.04)'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Folder size={20} color="#c084fc" />
                        <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary, #fff)' }}>{batch.leaderboard_name}</strong>
                      </div>
                      <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(16,185,129,0.2)', color: '#10b981', fontWeight: 'bold' }}>
                        {batch.winners_count} Winners
                      </span>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={13} /> {batch.date_formatted}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>Coins Distributed:</span>
                      <strong style={{ color: '#10b981', fontSize: '0.88rem' }}>+{batch.total_coins.toLocaleString()} Coins</strong>
                    </div>

                    <div style={{ fontSize: '0.72rem', color: '#c084fc', marginTop: '8px', textAlign: 'right', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px' }}>
                      Open Folder <ChevronRight size={12} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Folder Detail View */
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)', display: 'block' }}>Distribution Session</span>
                  <strong style={{ fontSize: '0.95rem', color: '#c084fc' }}>{selectedBatch.leaderboard_name} ({selectedBatch.period})</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)', display: 'block' }}>Total Payout</span>
                  <strong style={{ fontSize: '0.95rem', color: '#10b981' }}>+{selectedBatch.total_coins.toLocaleString()} Coins ({selectedBatch.winners_count} Winners)</strong>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                      <th style={{ padding: '10px' }}>Rank</th>
                      <th style={{ padding: '10px' }}>Winner Name</th>
                      <th style={{ padding: '10px' }}>Public Hex ID</th>
                      <th style={{ padding: '10px' }}>Email</th>
                      <th style={{ padding: '10px' }}>Coins Credited</th>
                      <th style={{ padding: '10px' }}>Status</th>
                      <th style={{ padding: '10px' }}>Date & Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBatch.winners.map((log) => (
                      <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '10px', fontWeight: 'bold' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', background: log.rank === 1 ? 'rgba(245,158,11,0.2)' : log.rank === 2 ? 'rgba(255,255,255,0.1)' : log.rank === 3 ? 'rgba(205,127,50,0.2)' : 'rgba(255,255,255,0.03)', color: log.rank === 1 ? '#f59e0b' : log.rank === 2 ? '#e2e8f0' : log.rank === 3 ? '#cd7f32' : 'var(--text-secondary)' }}>
                            Rank #{log.rank}
                          </span>
                        </td>
                        <td style={{ padding: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <img
                              src={log.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(log.user_name || 'User')}`}
                              alt=""
                              style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                            />
                            <span style={{ color: 'var(--text-primary, #fff)', fontWeight: '500' }}>{log.user_name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px', color: '#818cf8', fontFamily: 'monospace' }}>{log.public_id}</td>
                        <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{log.user_email}</td>
                        <td style={{ padding: '10px', color: '#10b981', fontWeight: 'bold' }}>+{log.reward_coins.toLocaleString()} Coins</td>
                        <td style={{ padding: '10px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                            {log.status}
                          </span>
                        </td>
                        <td style={{ padding: '10px', color: 'var(--text-muted, #64748b)', fontSize: '0.78rem' }}>
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
