import React, { useState, useEffect } from 'react';
import { Percent, Save, RefreshCw, Users, Gift, Coins, Target, ArrowDownCircle, TrendingUp, CheckCircle2 } from 'lucide-react';

const TRIGGER_OPTIONS = [
  {
    value: 'offers_completed',
    label: 'Offers Completed',
    icon: <CheckCircle2 size={16} />,
    description: 'Referrer gets bonus after the referred friend completes X number of offers/tasks.',
    color: '#a855f7'
  },
  {
    value: 'first_withdrawal',
    label: 'First Withdrawal',
    icon: <ArrowDownCircle size={16} />,
    description: 'Referrer gets bonus when the referred friend makes their very first withdrawal.',
    color: '#14b8a6'
  },
  {
    value: 'coin_threshold',
    label: 'Coin Threshold',
    icon: <TrendingUp size={16} />,
    description: "Referrer gets bonus when the referred friend's total earnings reach X coins.",
    color: '#f59e0b'
  }
];

export default function AdminReferrals({ getHeaders, showNotice, API_BASE }) {
  const [settings, setSettings] = useState({
    bonus_coins: '',
    commission_percent: '',
    offers_required: '',
    description_text: '',
    reward_trigger: 'offers_completed',
    coin_threshold: '',
    referrer_coins: '',
    commission_enabled: true
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
          reward_trigger: data.settings.reward_trigger || 'offers_completed',
          coin_threshold: data.settings.coin_threshold ?? '',
          referrer_coins: data.settings.referrer_coins ?? '',
          commission_enabled: data.settings.commission_enabled !== false && data.settings.commission_enabled !== 0
        });
      }
    } catch (err) {
      console.error(err);
      showNotice('error', 'Failed to load referral settings');
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
          bonus_coins: parseFloat(settings.bonus_coins || 0),
          commission_percent: parseFloat(settings.commission_percent || 0),
          commission_enabled: settings.commission_enabled ? 1 : 0,
          offers_required: parseInt(settings.offers_required || 0),
          description_text: settings.description_text,
          reward_trigger: settings.reward_trigger,
          coin_threshold: parseFloat(settings.coin_threshold || 0),
          referrer_coins: parseFloat(settings.referrer_coins || 0)
        })
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', 'Referral settings saved successfully!');
        fetchSettings(); // Reload to confirm persisted values
      } else {
        showNotice('error', data.message || 'Failed to save');
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

  const activeTrigger = TRIGGER_OPTIONS.find(t => t.value === settings.reward_trigger) || TRIGGER_OPTIONS[0];

  const metrics = [
    {
      icon: <Gift size={20} />,
      label: 'Signup Bonus (New User)',
      value: settings.bonus_coins || '—',
      unit: 'coins',
      color: '#a855f7'
    },
    {
      icon: <Percent size={20} />,
      label: 'Commission %',
      value: settings.commission_percent || '—',
      unit: '%',
      color: '#6366f1'
    },
    {
      icon: activeTrigger.icon,
      label: 'Active Trigger',
      value: activeTrigger.label,
      unit: '',
      color: activeTrigger.color
    },
    {
      icon: <Coins size={20} />,
      label: 'Referrer Bonus',
      value: settings.referrer_coins || '—',
      unit: 'coins',
      color: '#14b8a6'
    }
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Target size={18} style={{ color: 'var(--primary)' }} /> Referral Reward Engine
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Configure how and when the referral system rewards referrers — choose your trigger mode.
          </p>
        </div>
        <button className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.82rem' }} onClick={fetchSettings}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>Loading referral settings...</p>
      ) : (
        <>
          {/* Metrics Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '28px' }}>
            {metrics.map((m, i) => (
              <div key={i} className="glass-panel" style={{ padding: '18px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '12px', right: '12px', opacity: 0.07 }}>
                  {React.cloneElement(m.icon, { size: 40 })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: m.color }}>
                  {m.icon}
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{m.label}</span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: m.color }}>
                  {m.value}
                  {m.unit && <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '4px' }}>{m.unit}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Settings Form */}
          <div className="glass-panel" style={{ padding: '28px' }}>
            <h4 style={{ fontSize: '1rem', marginBottom: '24px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
              Update Referral Parameters
            </h4>
            <form onSubmit={handleSave}>

              {/* ---- TRIGGER MODE SELECTOR ---- */}
              <div style={{ marginBottom: '28px' }}>
                <label className="form-label" style={{ marginBottom: '12px', display: 'block' }}>
                  🎯 Referrer Reward Trigger — Choose when the referrer gets their bonus
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  {TRIGGER_OPTIONS.map(opt => {
                    const isActive = settings.reward_trigger === opt.value;
                    return (
                      <div
                        key={opt.value}
                        onClick={() => setSettings({ ...settings, reward_trigger: opt.value })}
                        style={{
                          padding: '16px',
                          borderRadius: '12px',
                          border: `2px solid ${isActive ? opt.color : 'var(--border-glass)'}`,
                          background: isActive ? `${opt.color}15` : 'rgba(255,255,255,0.02)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          userSelect: 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: isActive ? opt.color : 'var(--text-secondary)' }}>
                          {opt.icon}
                          <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{opt.label}</span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                          {opt.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ---- MAIN FIELDS GRID ---- */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>

                {/* Signup Bonus */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Gift size={13} /> Signup Bonus Coins (New User)
                  </label>
                  <input type="number" className="glass-input" placeholder="e.g. 500" step="1" min="0" {...field('bonus_coins')} />
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                    Coins awarded to the NEW user when they sign up using a referral code.
                  </p>
                </div>

                {/* Referrer Bonus */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Coins size={13} /> Referrer Bonus Coins (on milestone)
                  </label>
                  <input type="number" className="glass-input" placeholder="e.g. 100" step="1" min="0" {...field('referrer_coins')} />
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                    Fixed coins credited to the referrer when the trigger milestone is achieved.
                  </p>
                </div>

                {/* Commission % with Enable/Disable Toggle */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Percent size={13} /> Referrer Commission (% per offer)
                    </label>
                    {/* Toggle switch */}
                    <div
                      onClick={() => setSettings({ ...settings, commission_enabled: !settings.commission_enabled })}
                      style={{
                        position: 'relative',
                        width: '44px',
                        height: '24px',
                        borderRadius: '12px',
                        background: settings.commission_enabled ? '#a855f7' : 'rgba(255,255,255,0.12)',
                        cursor: 'pointer',
                        transition: 'background 0.25s ease',
                        flexShrink: 0
                      }}
                    >
                      <div style={{
                        position: 'absolute',
                        top: '3px',
                        left: settings.commission_enabled ? '23px' : '3px',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: '#fff',
                        transition: 'left 0.25s ease',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.3)'
                      }} />
                    </div>
                  </div>
                  <input
                    type="number"
                    className="glass-input"
                    placeholder="e.g. 10"
                    step="0.01"
                    min="0"
                    max="100"
                    disabled={!settings.commission_enabled}
                    style={{ opacity: settings.commission_enabled ? 1 : 0.4, cursor: settings.commission_enabled ? 'text' : 'not-allowed' }}
                    {...field('commission_percent')}
                  />
                  <p style={{ fontSize: '0.72rem', color: settings.commission_enabled ? 'var(--text-muted)' : 'var(--danger)', marginTop: '6px' }}>
                    {settings.commission_enabled
                      ? '% of every offer reward earned by the referred friend, credited to referrer continuously.'
                      : '⛔ Commission is disabled — referrers will not earn % on friend\'s offers.'}
                  </p>
                </div>

                {/* Conditional field based on trigger */}
                {settings.reward_trigger === 'offers_completed' && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Users size={13} /> Min. Offers to Trigger Bonus
                    </label>
                    <input type="number" className="glass-input" placeholder="e.g. 3" min="1" {...field('offers_required')} />
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                      Referred friend must complete this many offers for the referrer to get the bonus.
                    </p>
                  </div>
                )}

                {settings.reward_trigger === 'coin_threshold' && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <TrendingUp size={13} /> Coin Earnings Threshold
                    </label>
                    <input type="number" className="glass-input" placeholder="e.g. 500" step="1" min="1" {...field('coin_threshold')} />
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                      Referred friend must earn at least this many coins total to trigger the referrer's bonus.
                    </p>
                  </div>
                )}

                {settings.reward_trigger === 'first_withdrawal' && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <div style={{
                      padding: '16px',
                      borderRadius: '10px',
                      background: 'rgba(20, 184, 166, 0.08)',
                      border: '1px solid rgba(20, 184, 166, 0.2)'
                    }}>
                      <p style={{ fontSize: '0.82rem', color: '#14b8a6', margin: 0, fontWeight: 600 }}>
                        ⚡ Auto Trigger on First Withdrawal
                      </p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px', marginBottom: 0 }}>
                        The referrer will automatically receive the <strong>Referrer Bonus Coins</strong> the moment their referred friend makes their very first withdrawal request.
                      </p>
                    </div>
                  </div>
                )}

              </div>

              {/* Description Text */}
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label">Referral Description Text (shown in app)</label>
                <textarea
                  className="glass-input"
                  rows={3}
                  placeholder="e.g. Refer friends and earn 100 coins when they complete 3 offers!"
                  {...field('description_text')}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-primary" style={{ padding: '11px 28px' }} disabled={saving}>
                  <Save size={15} /> {saving ? 'Saving...' : 'Save Referral Settings'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
