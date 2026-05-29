import React, { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw, AlertTriangle, Coins, Sparkles, Smartphone, Eye, EyeOff } from 'lucide-react';

export default function AdminConfigs({ getHeaders, showNotice, API_BASE }) {
  const [loading, setLoading] = useState(true);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [configsList, setConfigsList] = useState([]);
  const [isResettingSpins, setIsResettingSpins] = useState(false);

  // --- STATE FOR DETAILED CONFIG CARDS ---
  // A. Spin Probabilities
  const [spinProbabilities, setSpinProbabilities] = useState([
    { type: 'JACKPOT', range: [500, 500], prob: 1 },
    { type: 'BIG',     range: [200, 300], prob: 9 },
    { type: 'MEDIUM',  range: [50, 100],  prob: 20 },
    { type: 'SMALL',   range: [10, 30],   prob: 40 },
    { type: 'NONE',    range: [0, 0],     prob: 30 }
  ]);

  // B. Loyalty Streak Rewards
  const [streakRewards, setStreakRewards] = useState({
    1: 30, 2: 40, 3: 50, 4: 60, 5: 70, 6: 80, 7: 200
  });

  // C. Update Engine & Maintenance
  const [versionName, setVersionName] = useState('1.1.2');
  const [versionCode, setVersionCode] = useState('16');
  const [updateUrl, setUpdateUrl] = useState('https://play.google.com/store/apps/details?id=com.satyainfotechnetworks.rewardverse');
  const [updateMessage, setUpdateMessage] = useState('A critical update is available!');
  const [forceUpdate, setForceUpdate] = useState('true');
  const [isMaintenance, setIsMaintenance] = useState('false');

  // D. Daily Spin Grant
  const [spinDailyLimit, setSpinDailyLimit] = useState('2');

  // E. Watch & Earn Settings
  const [watchDailyLimit, setWatchDailyLimit] = useState('5');
  const [watchMinReward, setWatchMinReward] = useState('5');
  const [watchMaxReward, setWatchMaxReward] = useState('10');

  // F. Scratch & Win Settings
  const [scratchDailyLimit, setScratchDailyLimit] = useState('5');
  const [scratchMinReward, setScratchMinReward] = useState('5');
  const [scratchMaxReward, setScratchMaxReward] = useState('20');

  // G. Daily Withdrawal Limit
  const [dailyWithdrawLimit, setDailyWithdrawLimit] = useState('2');

  // H. Earning and Offerwall Icons
  const [earningIcons, setEarningIcons] = useState({
    "PUBSCALE": "https://i.ibb.co/68gPz3Y/pubscale.png",
    "OFFERMARU": "https://i.ibb.co/1fWfN9k/offermaru.png",
    "OPINION_UNIVERSE": "https://i.ibb.co/zXgYqKB/opinionuniverse.png",
    "CPX_RESEARCH": "https://i.ibb.co/LdQyJt8/cpx.png",
    "GROWDECK": "https://i.ibb.co/YyYgX4C/growdeck.png",
    "ADJUMP": "https://i.ibb.co/v4SgYqK/adjump.png",
    "REAL_OPINION": "https://i.ibb.co/9pyqK8H/realopinion.png",
    "PLAYTIME": "https://i.ibb.co/RpyqK8H/playtime.png",
    "POCKETSFULL": "https://i.ibb.co/rpnYqKB/pocketsfull.png",
    "LIFAFA_BONUS": "https://i.ibb.co/vvHv7WTx/envelope.png",
    "LUCKY_SPIN": "https://www.vhv.rs/dpng/d/574-5746224_spin-the-wheel-png-png-download-spin-the.png",
    "DAILY_BONUS": "https://img.icons8.com/color/96/calendar.png",
    "WATCH_VIDEO": "https://img.icons8.com/color/96/youtube-play.png",
    "SCRATCH_CARD": "https://i.ibb.co/5X03C8wq/scratchcard-1.png",
    "REFERRAL": "https://img.icons8.com/color/96/conference-call.png",
    "TIMEWALL": "https://i.ibb.co/twLPSHST/giftbox-1139982.png"
  });

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/configs`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        const list = data.configs || [];
        setConfigsList(list);

        // Map list values to localized card states
        list.forEach(cfg => {
          try {
            if (cfg.config_key === 'spin_probabilities') {
              const parsed = JSON.parse(cfg.config_value);
              if (Array.isArray(parsed)) setSpinProbabilities(parsed);
            } else if (cfg.config_key === 'streak_rewards') {
              const parsed = JSON.parse(cfg.config_value);
              if (parsed && typeof parsed === 'object') setStreakRewards(parsed);
            } else if (cfg.config_key === 'latest_version') {
              setVersionName(cfg.config_value);
            } else if (cfg.config_key === 'latest_version_code') {
              setVersionCode(cfg.config_value);
            } else if (cfg.config_key === 'update_url') {
              setUpdateUrl(cfg.config_value);
            } else if (cfg.config_key === 'update_message') {
              setUpdateMessage(cfg.config_value);
            } else if (cfg.config_key === 'force_update') {
              setForceUpdate(cfg.config_value);
            } else if (cfg.config_key === 'is_maintenance') {
              setIsMaintenance(cfg.config_value);
            } else if (cfg.config_key === 'spin_daily_limit') {
              setSpinDailyLimit(cfg.config_value);
            } else if (cfg.config_key === 'watch_video_daily_limit') {
              setWatchDailyLimit(cfg.config_value);
            } else if (cfg.config_key === 'watch_video_reward_min') {
              setWatchMinReward(cfg.config_value);
            } else if (cfg.config_key === 'watch_video_reward_max') {
              setWatchMaxReward(cfg.config_value);
            } else if (cfg.config_key === 'scratch_card_daily_limit') {
              setScratchDailyLimit(cfg.config_value);
            } else if (cfg.config_key === 'scratch_card_reward_min') {
              setScratchMinReward(cfg.config_value);
            } else if (cfg.config_key === 'scratch_card_reward_max') {
              setScratchMaxReward(cfg.config_value);
            } else if (cfg.config_key === 'daily_withdraw_limit') {
              setDailyWithdrawLimit(cfg.config_value);
            } else if (cfg.config_key === 'earning_icons') {
              const parsed = JSON.parse(cfg.config_value);
              if (parsed && typeof parsed === 'object') {
                setEarningIcons(prev => ({
                  ...prev,
                  ...parsed
                }));
              }
            }
          } catch (e) {
            console.error(`Error parsing key ${cfg.config_key}:`, e);
          }
        });
      }
    } catch (err) {
      console.error(err);
      showNotice('error', 'Failed to retrieve active configurations');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  // --- SAVE METHODS PER CARD ---
  const saveSingleConfig = async (key, value) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/configs`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ config_key: key, config_value: String(value) })
      });
      const data = await res.json();
      return data.success;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  // 1. Save Spin Probabilities
  const handleSaveSpinProbabilities = async () => {
    // Validate probabilities sum to 100
    const totalProb = spinProbabilities.reduce((sum, item) => sum + parseFloat(item.prob || 0), 0);
    if (totalProb !== 100) {
      showNotice('error', `Spin probabilities must sum up exactly to 100%. Currently: ${totalProb}%`);
      return;
    }

    const success = await saveSingleConfig('spin_probabilities', JSON.stringify(spinProbabilities));
    if (success) {
      showNotice('success', 'Master Spin Probabilities updated successfully.');
      fetchConfigs();
    } else {
      showNotice('error', 'Failed to save spin probabilities.');
    }
  };

  // 2. Reset All Users Spins Bulk Trigger
  const handleResetSpins = async () => {
    if (!window.confirm("Are you sure you want to reset daily spins for ALL active database users back to 0?")) return;
    setIsResettingSpins(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/reset-spins`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ limit: spinDailyLimit })
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', data.message || 'All user spins reset successfully.');
      } else {
        showNotice('error', data.message);
      }
    } catch (err) {
      showNotice('error', 'Network failure during spins reset.');
    }
    setIsResettingSpins(false);
  };

  // 3. Save Loyalty Streak Rewards
  const handleSaveStreakRewards = async () => {
    const success = await saveSingleConfig('streak_rewards', JSON.stringify(streakRewards));
    if (success) {
      showNotice('success', 'Daily Loyalty Streak Rewards updated successfully.');
      fetchConfigs();
    } else {
      showNotice('error', 'Failed to save streak rewards.');
    }
  };

  // 4. Save Update Engine & Maintenance
  const handleSaveUpdateEngine = async () => {
    const results = await Promise.all([
      saveSingleConfig('latest_version', versionName),
      saveSingleConfig('latest_version_code', versionCode),
      saveSingleConfig('update_url', updateUrl),
      saveSingleConfig('update_message', updateMessage),
      saveSingleConfig('force_update', forceUpdate),
      saveSingleConfig('is_maintenance', isMaintenance)
    ]);

    if (results.every(Boolean)) {
      showNotice('success', 'Update Engine & Maintenance settings updated.');
      fetchConfigs();
    } else {
      showNotice('error', 'One or more engine properties failed to update.');
    }
  };

  // 5. Save Spin daily Grant
  const handleSaveSpinGrant = async () => {
    const success = await saveSingleConfig('spin_daily_limit', spinDailyLimit);
    if (success) {
      showNotice('success', 'Daily Spin Grant updated.');
      fetchConfigs();
    } else {
      showNotice('error', 'Failed to update spin grant.');
    }
  };

  // 6. Save Watch & Earn Settings
  const handleSaveWatchSettings = async () => {
    const results = await Promise.all([
      saveSingleConfig('watch_video_daily_limit', watchDailyLimit),
      saveSingleConfig('watch_video_reward_min', watchMinReward),
      saveSingleConfig('watch_video_reward_max', watchMaxReward)
    ]);
    if (results.every(Boolean)) {
      showNotice('success', 'Watch & Earn settings updated.');
      fetchConfigs();
    } else {
      showNotice('error', 'Failed to save video settings.');
    }
  };

  // 7. Save Scratch & Win Settings
  const handleSaveScratchSettings = async () => {
    const results = await Promise.all([
      saveSingleConfig('scratch_card_daily_limit', scratchDailyLimit),
      saveSingleConfig('scratch_card_reward_min', scratchMinReward),
      saveSingleConfig('scratch_card_reward_max', scratchMaxReward)
    ]);
    if (results.every(Boolean)) {
      showNotice('success', 'Scratch & Win settings updated.');
      fetchConfigs();
    } else {
      showNotice('error', 'Failed to save scratch card settings.');
    }
  };

  // 8. Save Daily Withdrawal Limit
  const handleSaveWithdrawLimit = async () => {
    const success = await saveSingleConfig('daily_withdraw_limit', dailyWithdrawLimit);
    if (success) {
      showNotice('success', 'Daily Withdrawal limit updated.');
      fetchConfigs();
    } else {
      showNotice('error', 'Failed to update withdrawal limit.');
    }
  };

  // 9. Save Earning Icons
  const handleSaveEarningIcons = async () => {
    const success = await saveSingleConfig('earning_icons', JSON.stringify(earningIcons));
    if (success) {
      showNotice('success', 'Earning and Offerwall Icons updated.');
      fetchConfigs();
    } else {
      showNotice('error', 'Failed to update earning icons.');
    }
  };

  // Raw Advanced Key-Value Save
  const handleRawSave = async (key, val) => {
    const success = await saveSingleConfig(key, val);
    if (success) {
      showNotice('success', `Config ${key} saved.`);
      fetchConfigs();
    } else {
      showNotice('error', `Failed to save ${key}`);
    }
  };

  if (loading) {
    return <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>Loading system configurations...</p>;
  }

  return (
    <div>
      {/* Configuration Hub Navigation bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={20} style={{ color: 'var(--primary)' }} /> System Configuration Hub
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Modify live app probabilities, gamification coefficients, and app version metrics securely.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.82rem', gap: '6px' }} onClick={fetchConfigs}>
            <RefreshCw size={14} /> Refresh Configs
          </button>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '8px 14px', fontSize: '0.82rem', gap: '6px', border: advancedMode ? '1px solid var(--primary-hover)' : '1px solid var(--border-glass)' }}
            onClick={() => setAdvancedMode(!advancedMode)}
          >
            {advancedMode ? <EyeOff size={14} /> : <Eye size={14} />} 
            {advancedMode ? 'Standard Dashboard' : 'Advanced Mode (Table)'}
          </button>
        </div>
      </div>

      {/* RENDER MODE A: SYSTEM CONFIG DASHBOARD (PHP EXACT REPLICA) */}
      {!advancedMode ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', alignItems: 'start' }}>
          
          {/* LEFT COLUMN METRICS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            
            {/* 1. MASTER SPIN PROBABILITIES */}
            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ 
                background: 'rgba(168,85,247,0.06)', 
                borderBottom: '1px solid var(--border-glass)', 
                padding: '16px 24px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center' 
              }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={16} style={{ color: 'var(--accent)' }} /> Master Spin Probabilities
                </h4>
                <button 
                  className="btn btn-primary" 
                  style={{ padding: '6px 12px', fontSize: '0.75rem', gap: '4px' }} 
                  onClick={handleSaveSpinProbabilities}
                >
                  <Save size={12} /> Save Matrix
                </button>
              </div>

              <div style={{ padding: '24px' }}>
                <table className="glass-table" style={{ margin: '0 0 20px' }}>
                  <thead>
                    <tr>
                      <th>Identifier</th>
                      <th style={{ textAlign: 'center' }}>Min Extent</th>
                      <th style={{ textAlign: 'center' }}>Max Extent</th>
                      <th style={{ textAlign: 'center', width: '120px' }}>Probability %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spinProbabilities.map((row, idx) => (
                      <tr key={row.type}>
                        <td>
                          <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{row.type}</strong>
                        </td>
                        <td>
                          <input 
                            type="number" 
                            className="glass-input" 
                            style={{ padding: '6px 10px', fontSize: '0.8rem', textAlign: 'center' }} 
                            value={row.range[0]} 
                            onChange={(e) => {
                              const updated = [...spinProbabilities];
                              updated[idx].range[0] = parseInt(e.target.value || 0);
                              setSpinProbabilities(updated);
                            }}
                          />
                        </td>
                        <td>
                          <input 
                            type="number" 
                            className="glass-input" 
                            style={{ padding: '6px 10px', fontSize: '0.8rem', textAlign: 'center' }} 
                            value={row.range[1]} 
                            onChange={(e) => {
                              const updated = [...spinProbabilities];
                              updated[idx].range[1] = parseInt(e.target.value || 0);
                              setSpinProbabilities(updated);
                            }}
                          />
                        </td>
                        <td>
                          <input 
                            type="number" 
                            className="glass-input" 
                            style={{ padding: '6px 10px', fontSize: '0.8rem', textAlign: 'center', fontWeight: 800, color: 'var(--accent)' }} 
                            value={row.prob} 
                            onChange={(e) => {
                              const updated = [...spinProbabilities];
                              updated[idx].prob = parseFloat(e.target.value || 0);
                              setSpinProbabilities(updated);
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Bulk Reset Button */}
                <button 
                  type="button" 
                  className="btn" 
                  style={{ 
                    width: '100%', 
                    padding: '12px', 
                    background: '#eab308', 
                    color: '#000', 
                    fontWeight: 700, 
                    fontSize: '0.85rem',
                    border: 'none',
                    borderRadius: '8px'
                  }}
                  disabled={isResettingSpins}
                  onClick={handleResetSpins}
                >
                  Reset All Users' Daily Spins
                </button>
              </div>
            </div>

            {/* 2. DAILY LOYALTY STREAK REWARDS */}
            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ 
                background: 'rgba(168,85,247,0.06)', 
                borderBottom: '1px solid var(--border-glass)', 
                padding: '16px 24px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center' 
              }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Coins size={16} style={{ color: 'var(--success)' }} /> Daily Loyalty Streak Rewards
                </h4>
                <button 
                  className="btn btn-primary" 
                  style={{ padding: '6px 12px', fontSize: '0.75rem', gap: '4px' }} 
                  onClick={handleSaveStreakRewards}
                >
                  <Save size={12} /> Save Streak
                </button>
              </div>

              <div style={{ padding: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                  {[1, 2, 3, 4, 5, 6, 7].map(day => (
                    <div key={day} className="form-group" style={{ marginBottom: 0, gridColumn: day === 7 ? 'span 2' : 'span 1' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Day {day} {day === 7 && <Sparkles size={10} style={{ color: 'var(--accent)' }} />}
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input 
                          type="number" 
                          className="glass-input" 
                          style={{ paddingRight: '36px' }}
                          value={streakRewards[day] || 0}
                          onChange={(e) => {
                            setStreakRewards({
                              ...streakRewards,
                              [day]: parseInt(e.target.value || 0)
                            });
                          }}
                        />
                        <Coins size={14} style={{ position: 'absolute', right: '12px', top: '13px', color: '#eab308' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 8. MASTER EARNING ICONS */}
            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', marginBottom: '30px' }}>
              <div style={{ 
                background: 'rgba(168,85,247,0.06)', 
                borderBottom: '1px solid var(--border-glass)', 
                padding: '16px 24px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center' 
              }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={16} style={{ color: 'var(--accent)' }} /> Master Earning & Game Logos
                </h4>
                <button 
                  className="btn btn-primary" 
                  style={{ padding: '6px 12px', fontSize: '0.75rem', gap: '4px' }} 
                  onClick={handleSaveEarningIcons}
                >
                  <Save size={12} /> Save Logos
                </button>
              </div>

              <div style={{ padding: '24px', maxHeight: '450px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px' }}>
                  {Object.keys(earningIcons).map(key => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border-glass)' }}>
                        <img src={earningIcons[key]} alt={key} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { e.target.src = 'https://i.ibb.co/twLPSHST/giftbox-1139982.png'; }} />
                      </div>
                      <div style={{ flexGrow: 1 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 'bold' }}>{key.replace('_', ' ')}</label>
                        <input 
                          type="text" 
                          className="glass-input" 
                          style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                          value={earningIcons[key] || ''}
                          onChange={(e) => {
                            setEarningIcons({
                              ...earningIcons,
                              [key]: e.target.value
                            });
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN METRICS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            
            {/* 3. UPDATE ENGINE & MAINTENANCE */}
            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ 
                background: 'rgba(168,85,247,0.06)', 
                borderBottom: '1px solid var(--border-glass)', 
                padding: '16px 24px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center' 
              }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Smartphone size={16} style={{ color: 'var(--primary-hover)' }} /> Update Engine & Maintenance
                </h4>
                <button 
                  className="btn btn-primary" 
                  style={{ padding: '6px 12px', fontSize: '0.75rem', gap: '4px' }} 
                  onClick={handleSaveUpdateEngine}
                >
                  <Save size={12} /> Save Updates
                </button>
              </div>

              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Version Name</label>
                    <input type="text" className="glass-input" value={versionName} onChange={e => setVersionName(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Version Code</label>
                    <input type="text" className="glass-input" value={versionCode} onChange={e => setVersionCode(e.target.value)} />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Update URL</label>
                  <input type="text" className="glass-input" value={updateUrl} onChange={e => setUpdateUrl(e.target.value)} />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Update Message</label>
                  <textarea rows={2} className="glass-input" value={updateMessage} onChange={e => setUpdateMessage(e.target.value)} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Critical Force?</label>
                    <select className="glass-input" style={{ background: '#0a0b10', color: '#fff' }} value={forceUpdate} onChange={e => setForceUpdate(e.target.value)}>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Maintenance Mode?</label>
                    <select className="glass-input" style={{ background: '#0a0b10', color: '#fff' }} value={isMaintenance} onChange={e => setIsMaintenance(e.target.value)}>
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. DAILY SPIN GRANT */}
            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ 
                background: 'rgba(168,85,247,0.06)', 
                borderBottom: '1px solid var(--border-glass)', 
                padding: '16px 24px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center' 
              }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>Daily Spin Grant</h4>
                <button 
                  className="btn btn-primary" 
                  style={{ padding: '6px 12px', fontSize: '0.75rem', gap: '4px' }} 
                  onClick={handleSaveSpinGrant}
                >
                  <Save size={12} /> Save Spins
                </button>
              </div>
              <div style={{ padding: '24px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Daily Spins Allowed</label>
                  <input type="number" className="glass-input" value={spinDailyLimit} onChange={e => setSpinDailyLimit(e.target.value)} />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>Maximum spins allowed per user per day.</span>
                </div>
              </div>
            </div>

            {/* 5. WATCH & EARN SETTINGS */}
            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ 
                background: 'rgba(168,85,247,0.06)', 
                borderBottom: '1px solid var(--border-glass)', 
                padding: '16px 24px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center' 
              }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>Watch & Earn Settings</h4>
                <button 
                  className="btn btn-primary" 
                  style={{ padding: '6px 12px', fontSize: '0.75rem', gap: '4px' }} 
                  onClick={handleSaveWatchSettings}
                >
                  <Save size={12} /> Save Ads
                </button>
              </div>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Daily Ads Limit</label>
                  <input type="number" className="glass-input" value={watchDailyLimit} onChange={e => setWatchDailyLimit(e.target.value)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Min Reward</label>
                    <input type="number" className="glass-input" value={watchMinReward} onChange={e => setWatchMinReward(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Max Reward</label>
                    <input type="number" className="glass-input" value={watchMaxReward} onChange={e => setWatchMaxReward(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            {/* 6. SCRATCH & WIN SETTINGS */}
            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ 
                background: 'rgba(168,85,247,0.06)', 
                borderBottom: '1px solid var(--border-glass)', 
                padding: '16px 24px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center' 
              }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>Scratch & Win Settings</h4>
                <button 
                  className="btn btn-primary" 
                  style={{ padding: '6px 12px', fontSize: '0.75rem', gap: '4px' }} 
                  onClick={handleSaveScratchSettings}
                >
                  <Save size={12} /> Save Scratch
                </button>
              </div>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Daily Scratch Limit</label>
                  <input type="number" className="glass-input" value={scratchDailyLimit} onChange={e => setScratchDailyLimit(e.target.value)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Min Reward</label>
                    <input type="number" className="glass-input" value={scratchMinReward} onChange={e => setScratchMinReward(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Max Reward</label>
                    <input type="number" className="glass-input" value={scratchMaxReward} onChange={e => setScratchMaxReward(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            {/* 7. DAILY WITHDRAWAL LIMIT */}
            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ 
                background: 'rgba(168,85,247,0.06)', 
                borderBottom: '1px solid var(--border-glass)', 
                padding: '16px 24px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center' 
              }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>Daily Withdrawal Limit</h4>
                <button 
                  className="btn btn-primary" 
                  style={{ padding: '6px 12px', fontSize: '0.75rem', gap: '4px' }} 
                  onClick={handleSaveWithdrawLimit}
                >
                  <Save size={12} /> Save Limit
                </button>
              </div>
              <div style={{ padding: '24px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Max Withdrawals Per User Per Day</label>
                  <input type="number" className="glass-input" value={dailyWithdrawLimit} onChange={e => setDailyWithdrawLimit(e.target.value)} />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>Set to 0 for unlimited. e.g. Set to 2 to only allow 2 daily withdrawals.</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      ) : (
        /* RENDER MODE B: ADVANCED CONFIGS RAW TABLE LIST */
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <div className="table-container">
            <table className="glass-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Value</th>
                  <th>Description</th>
                  <th>Updated</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {configsList.map(cfg => {
                  const [editingValue, setEditingValue] = useState(cfg.config_value);
                  const [isSaving, setIsSaving] = useState(false);

                  return (
                    <tr key={cfg.config_key}>
                      <td>
                        <code style={{ background: 'rgba(168,85,247,0.1)', padding: '3px 8px', borderRadius: '5px', fontSize: '0.82rem', color: 'var(--primary-hover)' }}>
                          {cfg.config_key}
                        </code>
                      </td>
                      <td>
                        <textarea
                          className="glass-input"
                          style={{ padding: '7px 12px', fontSize: '0.85rem', fontFamily: 'monospace', width: '100%', resize: 'vertical' }}
                          value={editingValue}
                          rows={Math.min(5, Math.max(1, editingValue ? editingValue.split('\n').length : 1))}
                          onChange={e => setEditingValue(e.target.value)}
                        />
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{cfg.description || cfg.desc || '—'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        {cfg.updated_at ? new Date(cfg.updated_at).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <button 
                          className="btn btn-primary" 
                          style={{ padding: '8px 12px', fontSize: '0.78rem', gap: '4px' }} 
                          disabled={isSaving}
                          onClick={async () => {
                            setIsSaving(true);
                            await handleRawSave(cfg.config_key, editingValue);
                            setIsSaving(false);
                          }}
                        >
                          <Save size={12} /> {isSaving ? 'Saving' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
