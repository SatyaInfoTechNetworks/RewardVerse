import React, { useState, useEffect } from 'react';
import { 
  Trophy, Award, Users, DollarSign, Settings, RefreshCw, 
  Send, CheckCircle, AlertCircle, Calendar, Filter, Save, Layers, Search
} from 'lucide-react';
import { API_BASE } from '../../config';

const AdminLeaderboard = ({ apiBase, getHeaders, showNotice }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPeriod, setSelectedPeriod] = useState('DAILY');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    active_leaderboards: 3,
    participants: 0,
    prize_pool_coins: 70000,
    rewards_distributed: 0,
    total_reward_coins_given: 0
  });

  const [leaderboardConfigs, setLeaderboardConfigs] = useState([
    {
      id: 'lb_daily_earnings',
      name: 'Daily Earnings Leaderboard',
      period: 'DAILY',
      minimum_score: 50,
      reward_pool: 5000,
      max_winners: 100,
      status: 'ACTIVE',
      tiers: [
        { start_rank: 1, end_rank: 1, reward_coins: 1500 },
        { start_rank: 2, end_rank: 2, reward_coins: 1000 },
        { start_rank: 3, end_rank: 3, reward_coins: 500 },
        { start_rank: 4, end_rank: 10, reward_coins: 140 },
        { start_rank: 11, end_rank: 100, reward_coins: 10 }
      ]
    },
    {
      id: 'lb_weekly_earnings',
      name: 'Weekly Earnings Leaderboard',
      period: 'WEEKLY',
      minimum_score: 200,
      reward_pool: 15000,
      max_winners: 100,
      status: 'ACTIVE',
      tiers: [
        { start_rank: 1, end_rank: 1, reward_coins: 4500 },
        { start_rank: 2, end_rank: 2, reward_coins: 3000 },
        { start_rank: 3, end_rank: 3, reward_coins: 1500 },
        { start_rank: 4, end_rank: 10, reward_coins: 500 },
        { start_rank: 11, end_rank: 100, reward_coins: 30 }
      ]
    },
    {
      id: 'lb_monthly_earnings',
      name: 'Monthly Earnings Leaderboard',
      period: 'MONTHLY',
      minimum_score: 500,
      reward_pool: 50000,
      max_winners: 100,
      status: 'ACTIVE',
      tiers: [
        { start_rank: 1, end_rank: 1, reward_coins: 15000 },
        { start_rank: 2, end_rank: 2, reward_coins: 10000 },
        { start_rank: 3, end_rank: 3, reward_coins: 5000 },
        { start_rank: 4, end_rank: 10, reward_coins: 1500 },
        { start_rank: 11, end_rank: 100, reward_coins: 100 }
      ]
    }
  ]);

  const [players, setPlayers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationMsg, setNotificationMsg] = useState(null);

  const resolveBaseUrl = () => apiBase || API_BASE || '';
  const resolveHeaders = () => {
    if (typeof getHeaders === 'function') return getHeaders();
    const token = localStorage.getItem('adminToken');
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    };
  };

  const notify = (type, text) => {
    if (typeof showNotice === 'function') {
      showNotice(text, type);
    }
    setNotificationMsg({ type, text });
  };

  useEffect(() => {
    fetchDashboardStats();
    fetchLeaderboardConfigs();
    fetchTopPlayers(selectedPeriod);
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const res = await fetch(`${resolveBaseUrl()}/api/admin/leaderboard/dashboard`, {
        headers: resolveHeaders()
      });
      const data = await res.json();
      if (data.success && data.stats) {
        setStats(data.stats);
      }
    } catch (e) {
      console.error('Error fetching admin leaderboard stats:', e);
    }
  };

  const fetchLeaderboardConfigs = async () => {
    try {
      const res = await fetch(`${resolveBaseUrl()}/api/admin/leaderboard/list`, {
        headers: resolveHeaders()
      });
      const data = await res.json();
      if (data.success && data.leaderboards && data.leaderboards.length > 0) {
        setLeaderboardConfigs(data.leaderboards);
      }
    } catch (e) {
      console.error('Error fetching leaderboard configs:', e);
    }
  };

  const fetchTopPlayers = async (period) => {
    setLoading(true);
    try {
      const res = await fetch(`${resolveBaseUrl()}/api/admin/leaderboard/participants?period=${period}`, {
        headers: resolveHeaders()
      });
      const data = await res.json();
      if (data.success && data.players) {
        setPlayers(data.players);
      } else {
        setPlayers([]);
      }
    } catch (e) {
      console.error('Error fetching top players:', e);
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (period) => {
    setSelectedPeriod(period);
    fetchTopPlayers(period);
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
        notify('success', `Saved configuration for ${config.period} Leaderboard!`);
        fetchLeaderboardConfigs();
      } else {
        notify('error', data.message || 'Failed to save config.');
      }
    } catch (e) {
      console.error('Error saving config:', e);
      notify('error', 'Error connecting to server.');
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
        notify('success', data.message);
        fetchDashboardStats();
      } else {
        notify('error', data.message || 'Failed to distribute rewards.');
      }
    } catch (e) {
      console.error('Error distributing rewards:', e);
      notify('error', 'Error executing payout transaction.');
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
    <div className="p-6 bg-slate-900 text-white min-h-screen">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-gradient-to-r from-purple-900/60 via-indigo-900/60 to-slate-800 p-6 rounded-2xl border border-purple-500/20 shadow-xl">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-8 h-8 text-yellow-400 animate-bounce" />
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-yellow-300 via-amber-200 to-white bg-clip-text text-transparent">
              Leaderboard Management
            </h1>
          </div>
          <p className="text-slate-300 text-sm">
            Manage Daily, Weekly, and Monthly Leaderboards, coin qualification thresholds, reward tiers, and automated payouts.
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => { fetchDashboardStats(); fetchTopPlayers(selectedPeriod); }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium border border-slate-700 transition"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Notifications */}
      {notificationMsg && (
        <div className={`p-4 rounded-xl mb-6 flex items-center justify-between ${notificationMsg.type === 'success' ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-200' : 'bg-red-950/80 border border-red-500/40 text-red-200'}`}>
          <div className="flex items-center gap-2">
            {notificationMsg.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-red-400" />}
            <span className="text-sm font-medium">{notificationMsg.text}</span>
          </div>
          <button onClick={() => setNotificationMsg(null)} className="text-xs underline hover:opacity-80">Dismiss</button>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        <div className="bg-slate-800/80 border border-slate-700/80 p-5 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Active Timeframes</span>
            <div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg"><Layers className="w-5 h-5" /></div>
          </div>
          <div className="text-3xl font-extrabold text-white">Daily / Wk / Mo</div>
          <div className="text-xs text-emerald-400 mt-2 flex items-center gap-1 font-medium">3 Active Pools</div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 p-5 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Qualified Players</span>
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg"><Users className="w-5 h-5" /></div>
          </div>
          <div className="text-3xl font-extrabold text-white">{players.length} Users</div>
          <div className="text-xs text-slate-400 mt-2">Top 100 Per Timeframe</div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 p-5 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Active Prize Pool</span>
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg"><DollarSign className="w-5 h-5" /></div>
          </div>
          <div className="text-3xl font-extrabold text-amber-300">
            {stats.prize_pool_coins ? stats.prize_pool_coins.toLocaleString() : '70,000'} Coins
          </div>
          <div className="text-xs text-amber-400/80 mt-2 font-medium">Global Dynamic Allocation</div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 p-5 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Rewards Paid</span>
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg"><Award className="w-5 h-5" /></div>
          </div>
          <div className="text-3xl font-extrabold text-emerald-400">{stats.rewards_distributed || 0} Payouts</div>
          <div className="text-xs text-emerald-400/80 mt-2">Distributed to winners</div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex border-b border-slate-800 gap-2 mb-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-5 py-3 font-semibold text-sm rounded-t-xl transition border-b-2 ${activeTab === 'overview' ? 'bg-purple-900/30 text-purple-300 border-purple-500' : 'text-slate-400 border-transparent hover:text-slate-200'}`}
        >
          <div className="flex items-center gap-2"><Layers className="w-4 h-4" /> Overview & Quick Payout</div>
        </button>
        <button
          onClick={() => setActiveTab('builder')}
          className={`px-5 py-3 font-semibold text-sm rounded-t-xl transition border-b-2 ${activeTab === 'builder' ? 'bg-purple-900/30 text-purple-300 border-purple-500' : 'text-slate-400 border-transparent hover:text-slate-200'}`}
        >
          <div className="flex items-center gap-2"><Settings className="w-4 h-4" /> Period & Tier Configurator</div>
        </button>
        <button
          onClick={() => setActiveTab('players')}
          className={`px-5 py-3 font-semibold text-sm rounded-t-xl transition border-b-2 ${activeTab === 'players' ? 'bg-purple-900/30 text-purple-300 border-purple-500' : 'text-slate-400 border-transparent hover:text-slate-200'}`}
        >
          <div className="flex items-center gap-2"><Users className="w-4 h-4" /> Live Top 100 Players</div>
        </button>
      </div>

      {/* Tab 1: Overview & Quick Payout */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="bg-slate-800/60 border border-slate-700/80 p-6 rounded-2xl">
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-400" /> Leaderboard Timeframes & Manual Distribute
            </h2>
            <p className="text-slate-400 text-sm mb-6">
              Select a period below to distribute rewards to Top 100 players based on configured reward tiers.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {['DAILY', 'WEEKLY', 'MONTHLY'].map((periodKey) => {
                const config = leaderboardConfigs.find(c => c.period === periodKey) || {};
                return (
                  <div key={periodKey} className="bg-slate-900/80 border border-slate-700/90 p-5 rounded-2xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full uppercase tracking-wider">
                          {periodKey}
                        </span>
                        <span className="text-xs text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                          Active
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-white mb-1">{config.name || `${periodKey} Leaderboard`}</h3>
                      <div className="space-y-1 my-3 text-xs text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Min Coin Threshold:</span>
                          <span className="font-semibold text-amber-300">{config.minimum_score || 0} Coins</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Total Prize Pool:</span>
                          <span className="font-semibold text-emerald-400">{(config.reward_pool || 0).toLocaleString()} Coins</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Max Winners:</span>
                          <span className="font-semibold text-slate-200">{config.max_winners || 100} Players</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDistributeRewards(periodKey)}
                      disabled={loading}
                      className="w-full mt-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" /> Distribute {periodKey} Rewards
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Period & Tier Configurator */}
      {activeTab === 'builder' && (
        <div className="space-y-6">
          <div className="bg-slate-800/60 border border-slate-700/80 p-6 rounded-2xl">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-purple-400" /> Threshold & Global Tier Builder
            </h2>

            <div className="space-y-6">
              {leaderboardConfigs.map((config, index) => (
                <div key={config.period || index} className="bg-slate-900/90 border border-slate-700/90 p-5 rounded-2xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                    <h3 className="text-lg font-bold text-amber-300 flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-amber-400" /> {config.name || `${config.period} Leaderboard`}
                    </h3>
                    <button
                      onClick={() => handleSaveConfig(config)}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" /> Save {config.period} Config
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Minimum Coin Threshold</label>
                      <input
                        type="number"
                        value={config.minimum_score}
                        onChange={(e) => {
                          const updated = [...leaderboardConfigs];
                          updated[index].minimum_score = parseFloat(e.target.value) || 0;
                          setLeaderboardConfigs(updated);
                        }}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                        placeholder="e.g. 50"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">Users need min this many coins to appear</span>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Total Prize Pool (Coins)</label>
                      <input
                        type="number"
                        value={config.reward_pool}
                        onChange={(e) => {
                          const updated = [...leaderboardConfigs];
                          updated[index].reward_pool = parseFloat(e.target.value) || 0;
                          setLeaderboardConfigs(updated);
                        }}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                        placeholder="e.g. 5000"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Max Winners Limit</label>
                      <input
                        type="number"
                        value={config.max_winners || 100}
                        onChange={(e) => {
                          const updated = [...leaderboardConfigs];
                          updated[index].max_winners = parseInt(e.target.value) || 100;
                          setLeaderboardConfigs(updated);
                        }}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>

                  {/* Tiers Breakdown */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Reward Tiers Breakdown</h4>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      {(config.tiers || []).map((tier, tierIdx) => (
                        <div key={tierIdx} className="bg-slate-800/90 p-3 rounded-xl border border-slate-700/60">
                          <span className="text-[11px] font-bold text-indigo-300 block mb-1">
                            Rank {tier.start_rank} {tier.end_rank > tier.start_rank ? `- ${tier.end_rank}` : ''}
                          </span>
                          <input
                            type="number"
                            value={tier.reward_coins}
                            onChange={(e) => {
                              const updated = [...leaderboardConfigs];
                              updated[index].tiers[tierIdx].reward_coins = parseFloat(e.target.value) || 0;
                              setLeaderboardConfigs(updated);
                            }}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-emerald-400 font-semibold focus:outline-none"
                          />
                          <span className="text-[10px] text-slate-500 mt-1 block">Coins / winner</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Live Top 100 Players */}
      {activeTab === 'players' && (
        <div className="space-y-6">
          <div className="bg-slate-800/60 border border-slate-700/80 p-6 rounded-2xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" /> Qualified Top 100 Players
                </h2>
                <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700">
                  {['DAILY', 'WEEKLY', 'MONTHLY'].map(p => (
                    <button
                      key={p}
                      onClick={() => handlePeriodChange(p)}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition ${selectedPeriod === p ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search user..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12 text-slate-400 text-sm">Loading players...</div>
            ) : filteredPlayers.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                No qualified players found for {selectedPeriod} period meeting the minimum coin threshold.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-700">
                    <tr>
                      <th className="p-3">Rank</th>
                      <th className="p-3">User</th>
                      <th className="p-3">Public Hex ID</th>
                      <th className="p-3">Email</th>
                      <th className="p-3 text-right">Period Earnings</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredPlayers.map((player) => (
                      <tr key={player.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-3 font-bold">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] ${player.rank === 1 ? 'bg-amber-400/20 text-amber-300 border border-amber-500/40' : player.rank === 2 ? 'bg-slate-300/20 text-slate-200 border border-slate-400/40' : player.rank === 3 ? 'bg-amber-700/20 text-amber-400 border border-amber-700/40' : 'bg-slate-800 text-slate-300'}`}>
                            #{player.rank}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={player.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(player.name || 'User')}`}
                              alt=""
                              className="w-7 h-7 rounded-full border border-slate-700"
                            />
                            <span className="font-semibold text-white">{player.name || 'User'}</span>
                          </div>
                        </td>
                        <td className="p-3 font-mono text-indigo-300">{player.public_id || player.id.substring(0, 8)}</td>
                        <td className="p-3 text-slate-400">{player.email || 'N/A'}</td>
                        <td className="p-3 text-right font-extrabold text-emerald-400">
                          {player.score.toLocaleString()} Coins
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 text-[10px] bg-emerald-950 text-emerald-300 rounded border border-emerald-500/30">
                            Qualified
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLeaderboard;
