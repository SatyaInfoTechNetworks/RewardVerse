import React, { useState, useEffect } from 'react';
import { Image, Plus, Edit3, Trash2, Save, X, Eye, EyeOff, ArrowUpDown } from 'lucide-react';

const EMPTY_FORM = { title: '', description: '', image_url: '', action_url: '', display_order: 0, is_active: true };

export default function AdminBanners({ getHeaders, showNotice, API_BASE }) {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const fetchBanners = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/banners`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) setBanners(data.banners || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchBanners(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  };

  const openEdit = (banner) => {
    setEditingId(banner.id);
    setForm({
      title: banner.title || '',
      description: banner.description || '',
      image_url: banner.image_url || '',
      action_url: banner.action_url || '',
      display_order: banner.display_order || 0,
      is_active: !!banner.is_active
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingId
        ? `${API_BASE}/api/admin/banners/${editingId}`
        : `${API_BASE}/api/admin/banners`;
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', editingId ? 'Banner updated!' : 'Banner created!');
        setShowForm(false);
        fetchBanners();
      } else {
        showNotice('error', data.message);
      }
    } catch (err) {
      showNotice('error', 'Failed to save banner');
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this banner?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/banners/${id}`, { method: 'DELETE', headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        showNotice('success', 'Banner deleted');
        fetchBanners();
      } else {
        showNotice('error', data.message);
      }
    } catch (err) {
      showNotice('error', 'Failed to delete banner');
    }
  };

  return (
    <div>
      {/* Header + Create Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Image size={18} style={{ color: 'var(--primary)' }} /> App Banners
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Manage promotional banners displayed in the mobile app.
          </p>
        </div>
        <button className="btn btn-primary" style={{ padding: '9px 18px' }} onClick={openCreate}>
          <Plus size={15} /> New Banner
        </button>
      </div>

      {/* Banner Form */}
      {showForm && (
        <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px', border: '1px solid rgba(168,85,247,0.2)', background: 'rgba(168,85,247,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h4 style={{ margin: 0, fontSize: '1rem' }}>{editingId ? 'Edit Banner' : 'Create New Banner'}</h4>
            <button className="btn btn-secondary" style={{ padding: '5px 8px' }} onClick={() => setShowForm(false)}><X size={14} /></button>
          </div>

          <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Title</label>
              <input className="glass-input" placeholder="Banner headline" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Display Order</label>
              <input type="number" className="glass-input" value={form.display_order} onChange={e => setForm({ ...form, display_order: parseInt(e.target.value || 0) })} />
            </div>
            <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
              <label className="form-label">Description</label>
              <textarea className="glass-input" rows={2} placeholder="Short banner subtitle" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Image URL</label>
              <input className="glass-input" placeholder="https://..." value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Action URL (Deep link or URL)</label>
              <input className="glass-input" placeholder="https://... or app://screen" value={form.action_url} onChange={e => setForm({ ...form, action_url: e.target.value })} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                Active (visible in app)
              </label>
              <button type="submit" className="btn btn-primary" style={{ padding: '9px 20px' }} disabled={saving}>
                <Save size={14} /> {saving ? 'Saving...' : 'Save Banner'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Banners Grid */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>Loading banners...</p>
      ) : banners.length === 0 ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
          <Image size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No banners yet. Create your first one!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {banners.map(b => (
            <div key={b.id} className="glass-panel" style={{ overflow: 'hidden', border: b.is_active ? '1px solid rgba(168,85,247,0.15)' : '1px solid rgba(255,255,255,0.04)' }}>
              {b.image_url && (
                <img src={b.image_url} alt={b.title} style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }} onError={e => { e.target.style.display = 'none'; }} />
              )}
              {!b.image_url && (
                <div style={{ width: '100%', height: '100px', background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Image size={32} style={{ color: 'rgba(255,255,255,0.2)' }} />
                </div>
              )}
              <div style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '0.95rem', margin: 0, flex: 1 }}>{b.title}</h4>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginLeft: '8px', flexShrink: 0 }}>
                    {b.is_active ? <Eye size={14} style={{ color: 'var(--success)' }} /> : <EyeOff size={14} style={{ color: 'var(--text-muted)' }} />}
                    <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '6px', color: 'var(--text-secondary)' }}>#{b.display_order}</span>
                  </div>
                </div>
                {b.description && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>{b.description}</p>}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-secondary" style={{ flex: 1, padding: '7px', fontSize: '0.8rem' }} onClick={() => openEdit(b)}>
                    <Edit3 size={13} /> Edit
                  </button>
                  <button className="btn btn-danger" style={{ padding: '7px 12px' }} onClick={() => handleDelete(b.id)}>
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
