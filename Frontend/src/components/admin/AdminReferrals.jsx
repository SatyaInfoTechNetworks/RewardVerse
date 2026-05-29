import React, { useState, useEffect } from 'react';
import { Percent, Save, RefreshCw, Users, Gift, Coins, ShieldCheck, ArrowRightLeft, HelpCircle } from 'lucide-react';

export default function AdminReferrals({ getHeaders, showNotice, API_BASE }) {
  const [settings, setSettings] = useState({
    bonus_coins: '', // legacy
    commission_percent: '',
    offers_required: '', // legacy
    description_text: '',
    referee_signup_bonus: '',
    referrer_reward_coins: '',
    referral_condition_type: 'MIN_TASKS',
    referral_condition_threshold: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/referral-settings`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings({
          bonus_coins: data.settings.bonus_coins ?? '',
          commission_percent: data.settings.commission_percent ?? '',
          offers_required: data.settings.offers_required ?? '',
          description_text: data.settings.description_text ?? '',
          referee_signup_bonus: data.settings.referee_signup_bonus ?? '',
          referrer_reward_coins: data.settings.referrer_reward_coins ?? '',
          referral_condition_type: data.settings.referral_condition_type ?? 'MIN_TASKS',
          referral_condition_threshold: data.settings.referral_condition_threshold ?? ''
        });
      }
    } catch (err) {
      console.error(err);
      showNotice('error', 'Failed to fetch referral settings');
    }
    setLoading(false);
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/referral-settings`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          bonus_coins: parseFloat(settings.referrer_reward_coins || 0), // backward compatibility
          commission_percent: parseFloat(settings.commission_percent || 0),
          offers_required: parseInt(settings.referral_condition_threshold || 2), // backward compatibility
          description_text: settings.description_text,
          referee_signup_bonus: parseFloat(settings.referee_signup_bonus || 0),
          referrer_reward_coins: parseFloat(settings.referrer_reward_coins || 0),
          referral_condition_type: settings.referral_condition_type,
          referral_condition_threshold: parseFloat(settings.referral_condition_threshold || 0)
        })
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', 'Referral program configurations saved successfully!');
        fetchSettings(); // Refresh preview metrics
      } else {
        showNotice('error', data.message);
      }
    } catch (err) {
      showNotice('error', 'Failed to save referral settings');
    }
    setSaving(false);
  };

  const field = (key) => ({
    value: settings[key],
    onChange: (e) => setSettings({ ...settings, [key]: e.target.value })
  });

  const getConditionLabel = () => {
    switch (settings.referral_condition_type) {
      case 'MIN_TASKS':
        return `${settings.referral_condition_threshold || 0} Tasks Completed`;
      case 'FIRST_REDEEM':
        return 'First Withdrawal Made';
      case 'LIFETIME_COINS':
        return `${parseFloat(settings.referral_condition_threshold || 0).toFixed(0)} Coins Earned`;
      default:
        return '—';
    }
  };

  const metrics = [
    { 
      icon: <Gift size={20} style={{ color: '#ec4899' }} />, 
      label: 'Referee Welcome Coins', 
      value: settings.referee_signup_bonus || '0', 
      unit: 'coins', 
      gradient: 'linear-gradient(135deg, rgba(236,72,153,0.1) 0%, rgba(236,72,153,0.02) 100%)',
      border: 'rgba(236,72,153,0.2)'
    },
    { 
      icon: <Coins size={20} style={{ color: '#3b82f6' }} />, 
      label: 'Referrer Milestone Reward', 
      value: settings.referrer_reward_coins || '0', 
      unit: 'coins', 
      gradient: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(59,130,246,0.02) 100%)',
      border: 'rgba(59,130,246,0.2)'
    },
    { 
      icon: <ShieldCheck size={20} style={{ color: '#10b981' }} />, 
      label: 'Milestone Unlock Trigger', 
      value: getConditionLabel(), 
      unit: '', 
      gradient: 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(16,185,129,0.02) 100%)',
      border: 'rgba(16,185,129,0.2)'
    },
    { 
      icon: <Percent size={20} style={{ color: '#f59e0b' }} />, 
      label: 'Commission (Lifetime)', 
      value: settings.commission_percent || '0', 
      unit: '%', 
      gradient: 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(245,158,11,0.02) 100%)',
      border: 'rgba(245,158,11,0.2)'
    },
  ];

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)' }}>
            <Percent size={20} style={{ color: 'var(--primary)' }} /> Referral System Configurator
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
            Set dynamic entry parameters, sign-up welcome bonuses, and custom milestone reward triggers.
          </p>
        </div>
        <button 
          className="btn btn-secondary" 
          style={{ 
            padding: '10px 18px', 
            fontSize: '0.82rem', 
            borderRadius: '10px', 
            background: 'rgba(255,255,255,0.05)', 
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }} 
          onClick={fetchSettings}
        >
          <RefreshCw size={14} /> Refresh System
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }}></div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading dynamic rules configurations...</p>
        </div>
      ) : (
        <>
          {/* Metrics Panel - Visual Grids */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
            {metrics.map((m, i) => (
              <div 
                key={i} 
                className="glass-panel" 
                style={{ 
                  padding: '24px 20px', 
                  position: 'relative', 
                  overflow: 'hidden', 
                  background: m.gradient, 
                  border: `1px solid ${m.border}`,
                  borderRadius: '16px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.2)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.12)'; }}
              >
                <div style={{ position: 'absolute', top: '20px', right: '20px', opacity: 0.1 }}>{React.cloneElement(m.icon, { size: 52 })}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '6px' }}>{m.icon}</div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{m.label}</span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  {m.value}
                  {m.unit && <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>{m.unit}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Configuration Form */}
          <div className="glass-panel" style={{ padding: '32px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowRightLeft size={16} style={{ color: 'var(--primary)' }} /> Edit Referral Rewards & Rules
            </h4>
            
            <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              
              {/* Referee signup bonus */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                  <Gift size={14} style={{ color: '#ec4899' }} /> Referee Welcome Bonus (Coins)
                </label>
                <input
                  type="number"
                  className="glass-input"
                  placeholder="e.g. 50"
                  step="0.01"
                  min="0"
                  style={{ borderRadius: '10px', padding: '12px 14px' }}
                  {...field('referee_signup_bonus')}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', lineHeight: '1.3' }}>
                  Credited to the <strong>referred friend</strong> immediately upon signup. Set to 0 to disable.
                </p>
              </div>

              {/* Referrer Milestone Reward */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                  <Coins size={14} style={{ color: '#3b82f6' }} /> Referrer Milestone Reward (Coins)
                </label>
                <input
                  type="number"
                  className="glass-input"
                  placeholder="e.g. 100"
                  step="0.01"
                  min="0"
                  style={{ borderRadius: '10px', padding: '12px 14px' }}
                  {...field('referrer_reward_coins')}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', lineHeight: '1.3' }}>
                  Credited to the <strong>referrer</strong> when their friend satisfies the dynamic milestone condition below.
                </p>
              </div>

              {/* Dynamic condition selector */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                  <ShieldCheck size={14} style={{ color: '#10b981' }} /> Dynamic Milestone Condition Trigger
                </label>
                <select
                  className="glass-input"
                  style={{ 
                    borderRadius: '10px', 
                    padding: '12px 14px', 
                    background: 'rgba(10,10,12,0.9)', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    outline: 'none',
                    width: '100%'
                  }}
                  {...field('referral_condition_type')}
                >
                  <option value="MIN_TASKS">Friend Completes Minimum Tasks/Offers</option>
                  <option value="FIRST_REDEEM">Friend Submits/Completes First Redeem Request</option>
                  <option value="LIFETIME_COINS">Friend Earning Reaches Lifetime Coin Threshold</option>
                </select>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', lineHeight: '1.3' }}>
                  Decide the dynamic milestone rules the referred user must meet to unlock referrer bonus coins.
                </p>
              </div>

              {/* Threshold input (conditional visibility styling based on trigger type) */}
              <div className="form-group" style={{ marginBottom: 0, opacity: settings.referral_condition_type === 'FIRST_REDEEM' ? 0.4 : 1, transition: 'all 0.3s ease' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                  <HelpCircle size={14} style={{ color: 'var(--primary)' }} /> Condition Threshold Value
                </label>
                <input
                  type="number"
                  className="glass-input"
                  placeholder={settings.referral_condition_type === 'LIFETIME_COINS' ? 'e.g. 1000' : 'e.g. 2'}
                  min="1"
                  disabled={settings.referral_condition_type === 'FIRST_REDEEM'}
                  style={{ borderRadius: '10px', padding: '12px 14px' }}
                  {...field('referral_condition_threshold')}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', lineHeight: '1.3' }}>
                  {settings.referral_condition_type === 'FIRST_REDEEM' 
                    ? 'No threshold parameter required for this condition (Always triggers on first redeem).'
                    : settings.referral_condition_type === 'LIFETIME_COINS'
                      ? 'Required lifetime coins earned by the referred friend before unlocking referrer coins (e.g. 1000).'
                      : 'Required count of tasks/offers completions required before unlocking referrer coins (e.g. 2).'}
                </p>
              </div>

              {/* Lifetime commission */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                  <Percent size={14} style={{ color: '#f59e0b' }} /> Lifetime Commission Percent (%)
                </label>
                <input
                  type="number"
                  className="glass-input"
                  placeholder="e.g. 10"
                  step="0.1"
                  min="0"
                  max="100"
                  style={{ borderRadius: '10px', padding: '12px 14px' }}
                  {...field('commission_percent')}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', lineHeight: '1.3' }}>
                  The percentage ofreferred friend's task earnings credited to the referrer <strong>forever</strong>. Set to 0 to disable.
                </p>
              </div>

              {/* Display text in app */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Referral Marketing Description (shown in mobile app)</label>
                <textarea
                  className="glass-input"
                  rows={3}
                  placeholder="e.g. Invite friends and earn 100 coins + 10% commission on all their earnings forever!"
                  style={{ borderRadius: '10px', padding: '12px 14px', resize: 'none' }}
                  {...field('description_text')}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', lineHeight: '1.3' }}>
                  Promotional summary displayed directly to mobile users on the Referral & Share screen in the Android app.
                </p>
              </div>

              {/* Submit Buttons */}
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ 
                    padding: '12px 32px', 
                    fontSize: '0.88rem', 
                    fontWeight: 700, 
                    borderRadius: '12px',
                    boxShadow: '0 4px 15px rgba(59,130,246,0.3)',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }} 
                  disabled={saving}
                >
                  <Save size={16} /> {saving ? 'Saving Config...' : 'Apply Referral Configurations'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
