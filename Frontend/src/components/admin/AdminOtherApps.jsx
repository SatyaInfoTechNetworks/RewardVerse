import React, { useState, useEffect } from 'react';
import { Smartphone, Plus, Edit3, Trash2, Save, X, Eye, EyeOff, Link } from 'lucide-react';

const EMPTY_FORM = { name: '', icon_url: '', description: '', app_url: '', display_order: 0, is_active: true };

export default function AdminOtherApps({ getHeaders, showNotice, API_BASE }) {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const fetchApps = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/other-apps`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) setApps(data.apps || []);
    } catch (err) {
      console.error(err);
      showNotice('error', 'Connection error while fetching other apps');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  };

  const openEdit = (app) => {
    setEditingId(app.id);
    setForm({
      name: app.name || '',
      icon_url: app.icon_url || '',
      description: app.description || '',
      app_url: app.app_url || '',
      display_order: app.display_order || 0,
      is_active: !!app.is_active
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingId
        ? `${API_BASE}/api/admin/other-apps/${editingId}`
        : `${API_BASE}/api/admin/other-apps`;
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', editingId ? 'App promotion updated!' : 'App promotion created!');
        setShowForm(false);
        fetchApps();
      } else {
        showNotice('error', data.message || 'Failed to save app');
      }
    } catch (err) {
      showNotice('error', 'Failed to save app');
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this app promotion?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/other-apps/${id}`, { method: 'DELETE', headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        showNotice('success', 'App promotion deleted');
        fetchApps();
      } else {
        showNotice('error', data.message || 'Failed to delete app');
      }
    } catch (err) {
      showNotice('error', 'Failed to delete app');
    }
  };

  return (
    <div>
      {/* Header + Create Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Smartphone size={18} style={{ color: 'var(--primary)' }} /> Other Apps Promotion
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Promote other utilities or partner apps in the mobile app.
          </p>
        </div>
        <button className="btn btn-primary" style={{ padding: '9px 18px' }} onClick={openCreate}>
          <Plus size={15} /> New App
        </button>
      </div>

      {/* App Form */}
      {showForm && (
        <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px', border: '1px solid rgba(168,85,247,0.2)', background: 'rgba(168,85,247,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h4 style={{ margin: 0, fontSize: '1rem' }}>{editingId ? 'Edit App Promotion' : 'Promote New App'}</h4>
            <button className="btn btn-secondary" style={{ padding: '5px 8px' }} onClick={() => setShowForm(false)}><X size={14} /></button>
          </div>

          <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">App Name</label>
              <input className="glass-input" placeholder="e.g. SpinVerse" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Display Order</label>
              <input type="number" className="glass-input" value={form.display_order} onChange={e => setForm({ ...form, display_order: parseInt(e.target.value || 0) })} />
            </div>
            <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
              <label className="form-label">Small Description</label>
              <textarea className="glass-input" rows={2} placeholder="Brief description of the app" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Icon URL</label>
              <input className="glass-input" placeholder="https://..." value={form.icon_url} onChange={e => setForm({ ...form, icon_url: e.target.value })} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">App Store / Link URL</label>
              <input className="glass-input" placeholder="https://play.google.com/..." value={form.app_url} onChange={e => setForm({ ...form, app_url: e.target.value })} required />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                Active (visible in app)
              </label>
              <button type="submit" className="btn btn-primary" style={{ padding: '9px 20px' }} disabled={saving}>
                <Save size={14} /> {saving ? 'Saving...' : 'Save App'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Apps Grid */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>Loading apps...</p>
      ) : apps.length === 0 ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
          <Smartphone size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No apps promoted yet. Add your first app!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {apps.map(app => (
            <div key={app.id} className="glass-panel" style={{ overflow: 'hidden', border: app.is_active ? '1px solid rgba(168,85,247,0.15)' : '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ display: 'flex', gap: '16px', padding: '16px', alignItems: 'center' }}>
                {app.icon_url && (
                  <img src={app.icon_url} alt={app.name} style={{ width: '64px', height: '64px', borderRadius: '14px', objectFit: 'cover', display: 'block', border: '1px solid rgba(255,255,255,0.08)' }} onError={e => { e.target.style.display = 'none'; }} />
                )}
                {!app.icon_url && (
                  <div style={{ width: '64px', height: '64px', borderRadius: '14px', background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Smartphone size={24} style={{ color: 'rgba(255,255,255,0.2)' }} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <h4 style={{ fontSize: '0.95rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.name}</h4>
                    <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '6px', color: 'var(--text-secondary)' }}>#{app.display_order}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {app.is_active ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}><Eye size={12} /> Active</span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><EyeOff size={12} /> Inactive</span>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ padding: '0 16px 16px 16px' }}>
                {app.description && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', minHeight: '32px' }}>{app.description}</p>}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-secondary" style={{ flex: 1, padding: '7px', fontSize: '0.8rem' }} onClick={() => openEdit(app)}>
                    <Edit3 size={13} /> Edit
                  </button>
                  {app.app_url && (
                    <a href={app.app_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '7px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Link size={13} />
                    </a>
                  )}
                  <button className="btn btn-danger" style={{ padding: '7px 12px' }} onClick={() => handleDelete(app.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
