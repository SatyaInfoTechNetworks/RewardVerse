import React, { useState, useEffect } from 'react';
import { Gift, Plus, Edit3, Trash2, X, RefreshCw, Save, CheckCircle, AlertCircle, Calendar } from 'lucide-react';

export default function AdminLifafas({ getHeaders, showNotice, API_BASE }) {
  const [lifafas, setLifafas] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form states
  const [editingLifafa, setEditingLifafa] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    lifafa_id: '',
    bonus_amount: 10,
    total_limit: 100,
    required_offers_count: 0,
    expires_at: '',
    is_active: true
  });

  const fetchLifafas = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/lifafas`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        setLifafas(data.lifafas || []);
      } else {
        showNotice('error', data.message || 'Failed to fetch lifafas');
      }
    } catch (err) {
      console.error(err);
      showNotice('error', 'Connection error while fetching lifafas');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLifafas();
  }, []);

  const resetForm = () => {
    setEditingLifafa(null);
    setShowForm(false);
    setFormData({
      lifafa_id: '',
      bonus_amount: 10,
      total_limit: 100,
      required_offers_count: 0,
      expires_at: '',
      is_active: true
    });
  };

  const startEdit = (lifafa) => {
    setEditingLifafa(lifafa);
    setShowForm(true);
    
    // Format date string for datetime-local input
    let formattedDate = '';
    if (lifafa.expires_at) {
      const date = new Date(lifafa.expires_at);
      // Adjust to local ISO format: YYYY-MM-DDTHH:MM
      const tzOffset = date.getTimezoneOffset() * 60000;
      formattedDate = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
    }

    setFormData({
      lifafa_id: lifafa.lifafa_id,
      bonus_amount: parseFloat(lifafa.bonus_amount || 0),
      total_limit: parseInt(lifafa.total_limit || 0),
      required_offers_count: parseInt(lifafa.required_offers_count || 0),
      expires_at: formattedDate,
      is_active: lifafa.is_active ? true : false
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.lifafa_id) return;

    try {
      const url = editingLifafa 
        ? `${API_BASE}/api/admin/lifafas/${editingLifafa.id}` 
        : `${API_BASE}/api/admin/lifafas`;
      const method = editingLifafa ? 'PUT' : 'POST';

      const payload = {
        lifafa_id: formData.lifafa_id,
        bonus_amount: parseFloat(formData.bonus_amount),
        total_limit: parseInt(formData.total_limit),
        required_offers_count: parseInt(formData.required_offers_count),
        expires_at: formData.expires_at || null,
        is_active: formData.is_active ? 1 : 0
      };

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        showNotice('success', editingLifafa ? 'Envelope updated successfully' : 'Envelope created successfully');
        resetForm();
        fetchLifafas();
      } else {
        showNotice('error', data.message);
      }
    } catch (err) {
      showNotice('error', 'Failed to save envelope configurations');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this Surprise Envelope (Lifafa)? Claim history will remain but users can no longer access it.')) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/lifafas/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', 'Envelope deleted successfully');
        fetchLifafas();
      } else {
        showNotice('error', data.message);
      }
    } catch (err) {
      showNotice('error', 'Failed to delete envelope');
    }
  };

  return (
    <div>
      {/* Header and controllers */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Gift size={18} style={{ color: 'var(--primary)' }} /> Surprise Envelopes (Lifafas)
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Create promo gift codes/envelopes (Lifafas) which users claim for surprise bonus cash.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.82rem' }} onClick={fetchLifafas}>
            <RefreshCw size={14} /> Refresh
          </button>
          {!showForm && (
            <button className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '0.82rem' }} onClick={() => setShowForm(true)}>
              <Plus size={14} /> Create Envelope
            </button>
          )}
        </div>
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <div className="glass-panel" style={{ padding: '28px', marginBottom: '30px', border: '1px solid rgba(168,85,247,0.15)', background: 'rgba(168,85,247,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
              {editingLifafa ? `Edit Envelope "${formData.lifafa_id}"` : 'Configure New Surprise Envelope'}
            </h4>
            <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={resetForm}>
              <X size={14} />
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
              
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Envelope Code / ID (Unique)</label>
                <input 
                  type="text" 
                  className="glass-input" 
                  placeholder="e.g. REWARDVERSE50" 
                  value={formData.lifafa_id} 
                  onChange={e => setFormData({ ...formData, lifafa_id: e.target.value })}
                  disabled={editingLifafa ? true : false}
                  required 
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Users enter this exact alphanumeric code in the mobile app.
                </span>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Bonus Coin Reward</label>
                <input 
                  type="number" 
                  className="glass-input" 
                  placeholder="e.g. 50" 
                  value={formData.bonus_amount} 
                  onChange={e => setFormData({ ...formData, bonus_amount: parseFloat(e.target.value || 0) })}
                  min="0.01"
                  step="0.01"
                  required 
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Max Claim Limit (Users Count)</label>
                <input 
                  type="number" 
                  className="glass-input" 
                  placeholder="e.g. 100" 
                  value={formData.total_limit} 
                  onChange={e => setFormData({ ...formData, total_limit: parseInt(e.target.value || 0) })}
                  min="1"
                  required 
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
              
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Required Offers Complete count</label>
                <input 
                  type="number" 
                  className="glass-input" 
                  placeholder="e.g. 2 (0 = none)" 
                  value={formData.required_offers_count} 
                  onChange={e => setFormData({ ...formData, required_offers_count: parseInt(e.target.value || 0) })}
                  min="0"
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Restricts claim to users who completed at least this many total offers.
                </span>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Expiration Date (Optional)</label>
                <input 
                  type="datetime-local" 
                  className="glass-input" 
                  value={formData.expires_at} 
                  onChange={e => setFormData({ ...formData, expires_at: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', marginTop: '30px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem' }}>
                  <input 
                    type="checkbox" 
                    checked={formData.is_active} 
                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  Envelope Active (Claims Open)
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px', fontSize: '0.85rem' }}>
                <Save size={14} /> {editingLifafa ? 'Update Settings' : 'Create Envelope'}
              </button>
              <button type="button" className="btn btn-secondary" style={{ padding: '10px 18px', fontSize: '0.85rem' }} onClick={resetForm}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lifafas Table List */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>Syncing Surprise Envelopes ledger...</p>
      ) : (
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <div className="table-container">
            <table className="glass-table">
              <thead>
                <tr>
                  <th>Envelope Code</th>
                  <th>Earning Bonus</th>
                  <th>Claim Progress</th>
                  <th>Pre-requisites</th>
                  <th>Expiry</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {lifafas.map(l => {
                  const claimsCount = parseInt(l.actual_claims || l.claimed_count || 0);
                  const maxLimit = parseInt(l.total_limit || 0);
                  const isExpired = l.expires_at && new Date(l.expires_at).getTime() < Date.now();
                  const isFull = claimsCount >= maxLimit;

                  return (
                    <tr key={l.id}>
                      <td>
                        <code style={{ background: 'rgba(99,102,241,0.12)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--primary-hover)' }}>
                          {l.lifafa_id}
                        </code>
                      </td>
                      <td>
                        <strong style={{ color: 'var(--accent)', fontSize: '0.95rem' }}>{parseFloat(l.bonus_amount).toFixed(2)} coins</strong>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '130px' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            <strong>{claimsCount}</strong> / {maxLimit} claimed
                          </span>
                          {/* Premium Micro Progress Bar */}
                          <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
                            <div style={{ 
                              height: '100%', 
                              width: `${Math.min(100, (claimsCount / maxLimit) * 100)}%`,
                              background: isFull ? 'var(--danger)' : 'linear-gradient(90deg, var(--primary) 0%, var(--accent) 100%)',
                              borderRadius: '99px'
                            }}></div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {parseInt(l.required_offers_count) > 0 ? (
                            <span className="badge badge-pending" style={{ fontSize: '0.72rem' }}>
                              ⚠️ Complete {l.required_offers_count} offers
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>None</span>
                          )}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>
                        {l.expires_at ? (
                          <span style={{ 
                            color: isExpired ? 'var(--danger)' : 'var(--text-secondary)',
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '4px' 
                          }}>
                            <Calendar size={12} /> {new Date(l.expires_at).toLocaleDateString()}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Never</span>
                        )}
                      </td>
                      <td>
                        {l.is_active ? (
                          isExpired ? (
                            <span className="badge badge-pending" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)' }}>Expired</span>
                          ) : isFull ? (
                            <span className="badge badge-pending" style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.2)' }}>Filled</span>
                          ) : (
                            <span className="badge badge-completed" style={{ display: 'flex', alignItems: 'center', gap: '4px', width: 'fit-content' }}>
                              <CheckCircle size={10} /> Active
                            </span>
                          )
                        ) : (
                          <span className="badge badge-pending" style={{ display: 'flex', alignItems: 'center', gap: '4px', width: 'fit-content', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <AlertCircle size={10} /> Paused
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.78rem' }} onClick={() => startEdit(l)}>
                            <Edit3 size={12} /> Edit
                          </button>
                          <button className="btn btn-danger" style={{ padding: '6px' }} onClick={() => handleDelete(l.id)}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {lifafas.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>
                      No Surprise Envelopes found in the active schema. Add one above!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
