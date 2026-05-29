import React, { useState, useEffect } from 'react';
import { Percent, Save, RefreshCw, Users, Gift, Coins } from 'lucide-react';

export default function AdminReferrals({ getHeaders, showNotice, API_BASE }) {
  const [settings, setSettings] = useState({
    bonus_coins: '',
    commission_percent: '',
    offers_required: '',
    description_text: ''
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
          description_text: data.settings.description_text ?? ''
        });
      }
    } catch (err) {
      console.error(err);
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
          offers_required: parseInt(settings.offers_required || 0),
          description_text: settings.description_text
        })
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', 'Referral settings updated successfully!');
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

  const metrics = [
    { icon: <Gift size={20} style={{ color: 'var(--primary-hover)' }} />, label: 'Bonus Coins on Signup', value: settings.bonus_coins || '—', unit: 'coins', color: 'var(--primary-hover)' },
    { icon: <Percent size={20} style={{ color: 'var(--accent)' }} />, label: 'Commission Percent', value: settings.commission_percent || '—', unit: '%', color: 'var(--accent)' },
    { icon: <Users size={20} style={{ color: 'var(--warning)' }} />, label: 'Offers to Unlock Referral', value: settings.offers_required || '—', unit: 'tasks', color: 'var(--warning)' },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Percent size={18} style={{ color: 'var(--primary)' }} /> Referral Reward Settings
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Configure how the referral system rewards both referrers and new sign-ups.
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
          {/* Current Values Preview */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
            {metrics.map((m, i) => (
              <div key={i} className="glass-panel" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '16px', right: '16px', opacity: 0.07 }}>{React.cloneElement(m.icon, { size: 48 })}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  {m.icon}
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{m.label}</span>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: m.color }}>
                  {m.value}<span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '4px' }}>{m.unit}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Settings Form */}
          <div className="glass-panel" style={{ padding: '28px' }}>
            <h4 style={{ fontSize: '1rem', marginBottom: '20px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
              Update Referral Parameters
            </h4>
            <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Gift size={13} /> Signup Bonus Coins
                </label>
                <input
                  type="number"
                  className="glass-input"
                  placeholder="e.g. 50"
                  step="0.01"
                  min="0"
                  {...field('bonus_coins')}
                />
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Coins awarded to the NEW user when they sign up using a referral code.
                </p>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Percent size={13} /> Referrer Commission (%)
                </label>
                <input
                  type="number"
                  className="glass-input"
                  placeholder="e.g. 10"
                  step="0.01"
                  min="0"
                  max="100"
                  {...field('commission_percent')}
                />
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Percentage of referred user's earnings credited to the referrer.
                </p>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={13} /> Min. Tasks to Activate Referral
                </label>
                <input
                  type="number"
                  className="glass-input"
                  placeholder="e.g. 3"
                  min="0"
                  {...field('offers_required')}
                />
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Number of offer completions required before a user can start referring.
                </p>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Referral Description Text (shown in app)</label>
                <textarea
                  className="glass-input"
                  rows={3}
                  placeholder="e.g. Invite friends and earn 10% of their coins forever!"
                  {...field('description_text')}
                />
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
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
