import React, { useState, useEffect } from 'react';
import { CreditCard, Edit3, Save, X, RefreshCw, Trash2, Plus, Info, Image, Clock } from 'lucide-react';

export default function AdminPayouts({ getHeaders, showNotice, API_BASE }) {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  // New Creation State
  const [isCreating, setIsCreating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    id: '',
    name: '',
    description: '',
    icon_url: '',
    min_coins: 1000,
    conversion_rate: 0.01,
    processing_time: 'Instant',
    is_active: true,
    fields: [{ label: 'UPI ID', placeholder: 'e.g. paytm@upi', type: 'text' }],
    tiers: []
  });

  const parseFields = (labelStr, placeholderStr, typeStr) => {
    if (!labelStr && !placeholderStr && !typeStr) return [];
    const labels = (labelStr || 'Details').split(',').map(s => s.trim());
    const placeholders = (placeholderStr || 'Enter details').split(',').map(s => s.trim());
    const types = (typeStr || 'text').split(',').map(s => s.trim());
    const maxLength = Math.max(labels.length, placeholders.length, types.length);
    const fields = [];
    for (let i = 0; i < maxLength; i++) {
      fields.push({
        label: labels[i] || 'Details',
        placeholder: placeholders[i] || 'Enter details',
        type: types[i] || 'text'
      });
    }
    return fields;
  };

  const fetchMethods = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/payout-methods`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        const rawMethods = data.methods || [];
        const rawTiers = data.tiers || [];
        const mapped = rawMethods.map(m => ({
          ...m,
          tiers: rawTiers.filter(t => t.method_id === m.id)
        }));
        setMethods(mapped);
      }
    } catch (err) {
      console.error(err);
      showNotice('error', 'Failed to retrieve payout methods');
    }
    setLoading(false);
  };

  useEffect(() => { fetchMethods(); }, []);

  const startEdit = (m) => {
    setEditingId(m.id);
    const parsedFields = parseFields(
      m.input_label || m.inputLabel || 'Details',
      m.input_placeholder || m.inputPlaceholder || 'Enter details',
      m.input_type || m.inputType || 'text'
    );
    setEditForm({
      name: m.name || '',
      description: m.description || '',
      icon_url: m.icon_url || '',
      min_coins: m.min_coins ?? 0,
      conversion_rate: m.conversion_rate ?? 1,
      processing_time: m.processing_time || 'Instant',
      is_active: !!m.is_active,
      fields: parsedFields,
      tiers: m.tiers ? m.tiers.map(t => ({ coin_cost: t.coin_cost, monetary_value: t.monetary_value, currency_symbol: t.currency_symbol || '₹' })) : []
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async () => {
    if (!editForm.name.trim()) {
      showNotice('error', 'Display name is required');
      return;
    }
    setSaving(true);
    try {
      const labels = editForm.fields.map(f => f.label.replace(/,/g, '').trim()).join(',');
      const placeholders = editForm.fields.map(f => f.placeholder.replace(/,/g, '').trim()).join(',');
      const types = editForm.fields.map(f => f.type.replace(/,/g, '').trim()).join(',');

      const payload = {
        name: editForm.name,
        description: editForm.description,
        icon_url: editForm.icon_url,
        min_coins: editForm.min_coins,
        conversion_rate: editForm.conversion_rate,
        processing_time: editForm.processing_time,
        is_active: editForm.is_active,
        input_label: labels,
        input_placeholder: placeholders,
        input_type: types,
        tiers: editForm.tiers
      };

      const res = await fetch(`${API_BASE}/api/admin/payout-methods/${editingId}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', 'Payout method updated successfully!');
        setEditingId(null);
        fetchMethods();
      } else {
        showNotice('error', data.message);
      }
    } catch (err) {
      showNotice('error', 'Failed to update payout method');
    }
    setSaving(false);
  };

  const handleCreate = async () => {
    if (!createForm.id.trim() || !createForm.name.trim()) {
      showNotice('error', 'ID/Slug and Display Name are required');
      return;
    }
    setCreating(true);
    try {
      const labels = createForm.fields.map(f => f.label.replace(/,/g, '').trim()).join(',');
      const placeholders = createForm.fields.map(f => f.placeholder.replace(/,/g, '').trim()).join(',');
      const types = createForm.fields.map(f => f.type.replace(/,/g, '').trim()).join(',');

      const payload = {
        id: createForm.id.toLowerCase().trim(),
        name: createForm.name,
        description: createForm.description,
        icon_url: createForm.icon_url,
        min_coins: createForm.min_coins,
        conversion_rate: createForm.conversion_rate,
        processing_time: createForm.processing_time,
        is_active: createForm.is_active,
        input_label: labels,
        input_placeholder: placeholders,
        input_type: types,
        tiers: createForm.tiers
      };

      const res = await fetch(`${API_BASE}/api/admin/payout-methods`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', 'New payout method created successfully!');
        setIsCreating(false);
        setCreateForm({
          id: '',
          name: '',
          description: '',
          icon_url: '',
          min_coins: 1000,
          conversion_rate: 0.01,
          processing_time: 'Instant',
          is_active: true,
          fields: [{ label: 'UPI ID', placeholder: 'e.g. paytm@upi', type: 'text' }],
          tiers: []
        });
        fetchMethods();
      } else {
        showNotice('error', data.message);
      }
    } catch (err) {
      showNotice('error', 'Failed to create payout method');
    }
    setCreating(false);
  };

  // Multiple Inputs Editor Helpers
  const addField = (isEdit) => {
    const newField = { label: 'New Field', placeholder: 'Enter details', type: 'text' };
    if (isEdit) {
      setEditForm({ ...editForm, fields: [...editForm.fields, newField] });
    } else {
      setCreateForm({ ...createForm, fields: [...createForm.fields, newField] });
    }
  };

  const removeField = (isEdit, index) => {
    if (isEdit) {
      const updated = [...editForm.fields];
      updated.splice(index, 1);
      setEditForm({ ...editForm, fields: updated });
    } else {
      const updated = [...createForm.fields];
      updated.splice(index, 1);
      setCreateForm({ ...createForm, fields: updated });
    }
  };

  const updateFieldProperty = (isEdit, index, prop, val) => {
    if (isEdit) {
      const updated = [...editForm.fields];
      updated[index][prop] = val;
      setEditForm({ ...editForm, fields: updated });
    } else {
      const updated = [...createForm.fields];
      updated[index][prop] = val;
      setCreateForm({ ...createForm, fields: updated });
    }
  };

  return (
    <div className="container-fluid pt-2">
      {/* Top Banner and Navigation Actions */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="m-0 font-weight-bold text-dark text-capitalize" style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard size={18} className="text-primary" /> Payout Methods Suite
          </h3>
          <p className="text-muted text-sm m-0 mt-1">
            Manage active payment gateways, user detail field configurations, and fixed cash redemption tiers.
          </p>
        </div>
        <div className="d-flex gap-2" style={{ gap: '8px' }}>
          <button className="btn btn-default btn-sm" onClick={fetchMethods}>
            <RefreshCw size={14} className="mr-1" /> Refresh
          </button>
          {!isCreating && (
            <button className="btn btn-primary btn-sm" onClick={() => setIsCreating(true)}>
              <Plus size={14} className="mr-1" /> Add Payout Method
            </button>
          )}
        </div>
      </div>

      {/* Creation Mode Drawer */}
      {isCreating && (
        <div className="card card-primary card-outline shadow-sm mb-4">
          <div className="card-header d-flex justify-content-between align-items-center" style={{ width: '100%' }}>
            <h4 className="card-title text-primary font-weight-bold m-0" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={16} /> Register New Payout Method
            </h4>
            <button className="btn btn-tool ml-auto" onClick={() => setIsCreating(false)}><X size={16} /></button>
          </div>
          
          <div className="card-body">
            <div className="row">
              {/* Left Column - Credentials */}
              <div className="col-md-6">
                <div className="row">
                  <div className="col-md-6 form-group">
                    <label className="text-sm font-weight-bold">ID/Slug (Unique Key)</label>
                    <input className="form-control" placeholder="e.g. upi, paytm" value={createForm.id} onChange={e => setCreateForm({ ...createForm, id: e.target.value })} />
                  </div>
                  <div className="col-md-6 form-group">
                    <label className="text-sm font-weight-bold">Display Name</label>
                    <input className="form-control" placeholder="e.g. UPI Transfer" value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="text-sm font-weight-bold">Description</label>
                  <textarea className="form-control" rows={2} placeholder="Explain processing terms or minimum thresholds..." value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })} />
                </div>

                <div className="row">
                  <div className="col-md-4 form-group">
                    <label className="text-sm font-weight-bold">Min Coins</label>
                    <input type="number" className="form-control" value={createForm.min_coins} onChange={e => setCreateForm({ ...createForm, min_coins: parseInt(e.target.value || 0) })} />
                  </div>
                  <div className="col-md-4 form-group">
                    <label className="text-sm font-weight-bold">Conversion Rate</label>
                    <input type="number" step="0.001" className="form-control" value={createForm.conversion_rate} onChange={e => setCreateForm({ ...createForm, conversion_rate: parseFloat(e.target.value || 0) })} />
                  </div>
                  <div className="col-md-4 form-group">
                    <label className="text-sm font-weight-bold">Processing Time</label>
                    <input className="form-control" placeholder="e.g. Instant" value={createForm.processing_time} onChange={e => setCreateForm({ ...createForm, processing_time: e.target.value })} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="text-sm font-weight-bold d-flex align-items-center gap-1"><Image size={13} className="mr-1" /> Logo / Icon Asset URL</label>
                  <input className="form-control" placeholder="e.g. https://img.icons8.com/color/48/paytm.png" value={createForm.icon_url} onChange={e => setCreateForm({ ...createForm, icon_url: e.target.value })} />
                  {createForm.icon_url && (
                    <div className="d-flex align-items-center gap-2 mt-2 p-2 bg-light rounded border">
                      <img src={createForm.icon_url} style={{ width: '28px', height: '28px', objectFit: 'contain' }} alt="Preview" onError={(e) => { e.target.style.display = 'none'; }} />
                      <span className="text-xs text-muted ml-2">Branding preview active</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column - Fields & Tiers */}
              <div className="col-md-6">
                {/* Dynamic Inputs */}
                <div className="card card-outline card-secondary p-3 mb-3 bg-light rounded border shadow-none" style={{ background: '#f8f9fa' }}>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <label className="text-sm font-weight-bold m-0">Required User Details</label>
                    <button type="button" className="btn btn-default btn-xs" onClick={() => addField(false)}>
                      <Plus size={11} className="mr-1" /> Add Field
                    </button>
                  </div>
                  {createForm.fields.length === 0 ? (
                    <p className="text-muted text-xs mb-0">No input fields. Users can withdraw without entering details.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                      {createForm.fields.map((f, idx) => (
                        <div key={idx} className="d-flex align-items-center p-2 rounded bg-white border" style={{ gap: '6px' }}>
                          <input className="form-control form-control-sm" style={{ flex: 1.5 }} placeholder="Label (e.g. UPI ID)" value={f.label} onChange={e => updateFieldProperty(false, idx, 'label', e.target.value)} />
                          <input className="form-control form-control-sm" style={{ flex: 1.5 }} placeholder="Placeholder" value={f.placeholder} onChange={e => updateFieldProperty(false, idx, 'placeholder', e.target.value)} />
                          <select className="form-control form-control-sm" style={{ flex: 1 }} value={f.type} onChange={e => updateFieldProperty(false, idx, 'type', e.target.value)}>
                            <option value="text">Text</option>
                            <option value="email">Email</option>
                            <option value="number">Number</option>
                          </select>
                          <button type="button" className="btn btn-default btn-sm text-danger border-0" onClick={() => removeField(false, idx)}><Trash2 size={13} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tiers */}
                <div className="card card-outline card-secondary p-3 bg-light rounded border shadow-none" style={{ background: '#f8f9fa' }}>
                  <label className="text-sm font-weight-bold mb-2">Fixed Exchange Tiers</label>
                  {createForm.tiers.length === 0 ? (
                    <p className="text-muted text-xs mb-2">No fixed tiers configured. Uses conversion rate calculation.</p>
                  ) : (
                    <div className="d-flex flex-wrap mb-2" style={{ gap: '6px', maxHeight: '80px', overflowY: 'auto' }}>
                      {createForm.tiers.map((t, idx) => (
                        <span key={idx} className="badge badge-info p-2 d-inline-flex align-items-center" style={{ gap: '6px', fontSize: '0.75rem' }}>
                          🪙 {t.coin_cost} = ₹{t.monetary_value}
                          <X size={11} style={{ cursor: 'pointer' }} onClick={() => {
                            const updated = [...createForm.tiers];
                            updated.splice(idx, 1);
                            setCreateForm({ ...createForm, tiers: updated });
                          }} />
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="d-flex align-items-end" style={{ gap: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <input type="number" id="new_create_coins" className="form-control form-control-sm" placeholder="Coins (e.g. 1000)" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <input type="number" id="new_create_val" className="form-control form-control-sm" placeholder="Value (₹10)" />
                    </div>
                    <button type="button" className="btn btn-default btn-sm" onClick={() => {
                      const cEl = document.getElementById('new_create_coins');
                      const vEl = document.getElementById('new_create_val');
                      const coin_cost = parseInt(cEl?.value || 0);
                      const monetary_value = parseFloat(vEl?.value || 0);
                      if (coin_cost > 0 && monetary_value > 0) {
                        setCreateForm({ ...createForm, tiers: [...createForm.tiers, { coin_cost, monetary_value, currency_symbol: '₹' }] });
                        if (cEl) cEl.value = '';
                        if (vEl) vEl.value = '';
                      } else {
                        showNotice('error', 'Please enter valid coins cost and INR monetary value.');
                      }
                    }}>Add</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card-footer d-flex justify-content-between align-items-center">
            <label className="d-flex align-items-center m-0 text-sm" style={{ cursor: 'pointer', gap: '8px' }}>
              <input type="checkbox" checked={createForm.is_active} onChange={e => setCreateForm({ ...createForm, is_active: e.target.checked })} />
              Enable this payout gateway immediately
            </label>
            <div className="d-flex gap-2" style={{ gap: '8px' }}>
              <button className="btn btn-default btn-sm" onClick={() => setIsCreating(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={creating}>
                {creating ? 'Saving Gateway...' : 'Save & Publish Payout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Methods Display and Edit Panel */}
      {loading ? (
        <p className="text-muted text-center py-5">Loading payout methods...</p>
      ) : methods.length === 0 ? (
        <div className="card shadow-sm p-5 text-center">
          <CreditCard size={40} className="text-muted mb-3" />
          <p className="text-muted mb-0">No payout methods configured yet.</p>
        </div>
      ) : (
        <div className="row">
          {methods.map(m => {
            const isEditing = editingId === m.id;
            return (
              <div key={m.id} className="col-md-6 col-lg-4 mb-4">
                <div className={`card shadow-sm h-100 ${isEditing ? 'card-primary card-outline' : ''}`}>
                  {isEditing ? (
                    /* Edit Mode */
                    <div className="card-body d-flex flex-column" style={{ gap: '14px' }}>
                      <div className="d-flex justify-content-between align-items-center border-bottom pb-2">
                        <h5 className="font-weight-bold text-primary m-0" style={{ fontSize: '0.95rem' }}>Editing: {m.id}</h5>
                        <button className="btn btn-tool" onClick={cancelEdit}><X size={14} /></button>
                      </div>
                      
                      <div className="form-group mb-0">
                        <label className="text-xs font-weight-bold">Name</label>
                        <input className="form-control" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                      </div>
                      
                      <div className="form-group mb-0">
                        <label className="text-xs font-weight-bold">Description</label>
                        <textarea className="form-control" rows={2} value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
                      </div>
                      
                      <div className="row">
                        <div className="col-4 form-group mb-0">
                          <label className="text-xs font-weight-bold">Min Coins</label>
                          <input type="number" className="form-control" value={editForm.min_coins} onChange={e => setEditForm({ ...editForm, min_coins: parseFloat(e.target.value || 0) })} />
                        </div>
                        <div className="col-4 form-group mb-0">
                          <label className="text-xs font-weight-bold">Rate (1 Coin)</label>
                          <input type="number" step="0.001" className="form-control" value={editForm.conversion_rate} onChange={e => setEditForm({ ...editForm, conversion_rate: parseFloat(e.target.value || 0) })} />
                        </div>
                        <div className="col-4 form-group mb-0">
                          <label className="text-xs font-weight-bold">Processing</label>
                          <input className="form-control" value={editForm.processing_time} onChange={e => setEditForm({ ...editForm, processing_time: e.target.value })} />
                        </div>
                      </div>

                      <div className="form-group mb-0">
                        <label className="text-xs font-weight-bold">Logo / Icon URL</label>
                        <input className="form-control" value={editForm.icon_url} onChange={e => setEditForm({ ...editForm, icon_url: e.target.value })} />
                      </div>

                      {/* Custom Multiple Inputs Editor */}
                      <div className="p-3 mb-2 bg-light rounded border">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <label className="text-xs font-weight-bold m-0">Required Inputs</label>
                          <button type="button" className="btn btn-default btn-xs" onClick={() => addField(true)}>
                            <Plus size={10} className="mr-1" /> Add
                          </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '120px', overflowY: 'auto' }}>
                          {editForm.fields.map((f, idx) => (
                            <div key={idx} className="d-flex align-items-center gap-1">
                              <input className="form-control form-control-sm" style={{ flex: 1.2 }} placeholder="Label" value={f.label} onChange={e => updateFieldProperty(true, idx, 'label', e.target.value)} />
                              <input className="form-control form-control-sm" style={{ flex: 1.2 }} placeholder="Placeholder" value={f.placeholder} onChange={e => updateFieldProperty(true, idx, 'placeholder', e.target.value)} />
                              <select className="form-control form-control-sm" style={{ flex: 0.8 }} value={f.type} onChange={e => updateFieldProperty(true, idx, 'type', e.target.value)}>
                                <option value="text">Text</option>
                                <option value="email">Email</option>
                                <option value="number">Number</option>
                              </select>
                              <button type="button" className="btn btn-default btn-sm text-danger border-0" onClick={() => removeField(true, idx)}><Trash2 size={12} /></button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Fixed Payout Tiers Sub-Form */}
                      <div className="border-top pt-2">
                        <label className="text-xs font-weight-bold mb-2">Redeem Tiers</label>
                        {editForm.tiers.length === 0 ? (
                          <p className="text-muted text-xs mb-2">No fixed tiers configured.</p>
                        ) : (
                          <div className="d-flex flex-column mb-2" style={{ gap: '6px' }}>
                            {editForm.tiers.map((t, idx) => (
                              <div key={idx} className="d-flex justify-content-between align-items-center p-2 rounded bg-light border">
                                <span className="text-xs font-weight-bold">🪙 {t.coin_cost} Coins = ₹{t.monetary_value}</span>
                                <button type="button" className="btn btn-default btn-xs text-danger" onClick={() => {
                                  const newTiers = [...editForm.tiers];
                                  newTiers.splice(idx, 1);
                                  setEditForm({ ...editForm, tiers: newTiers });
                                }}>Remove</button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="d-flex" style={{ gap: '8px' }}>
                          <input type="number" id={`new_tier_coins_${m.id}`} className="form-control form-control-sm" placeholder="Coins" />
                          <input type="number" id={`new_tier_val_${m.id}`} className="form-control form-control-sm" placeholder="Value" />
                          <button type="button" className="btn btn-default btn-sm" onClick={() => {
                            const coinEl = document.getElementById(`new_tier_coins_${m.id}`);
                            const valEl = document.getElementById(`new_tier_val_${m.id}`);
                            const coin_cost = parseInt(coinEl?.value || 0);
                            const monetary_value = parseFloat(valEl?.value || 0);
                            if (coin_cost > 0 && monetary_value > 0) {
                              const newTiers = [...editForm.tiers, { coin_cost, monetary_value, currency_symbol: '₹' }];
                              setEditForm({ ...editForm, tiers: newTiers });
                              if (coinEl) coinEl.value = '';
                              if (valEl) valEl.value = '';
                            } else {
                              showNotice('error', 'Enter valid coins and value amount.');
                            }
                          }}>Add</button>
                        </div>
                      </div>

                      <div className="d-flex flex-column mb-2 mt-2" style={{ gap: '10px' }}>
                        <label className="d-flex align-items-center m-0 text-sm" style={{ cursor: 'pointer', gap: '8px' }}>
                          <input type="checkbox" checked={editForm.is_active} onChange={e => setEditForm({ ...editForm, is_active: e.target.checked })} />
                          Active (available to users)
                        </label>
                        <button className="btn btn-primary btn-block btn-sm" onClick={handleSave} disabled={saving}>
                          <Save size={14} className="mr-1" /> {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Display Mode */
                    <div className="card-body d-flex flex-column h-100 justify-content-between">
                      <div>
                        <div className="d-flex justify-content-between align-items-start mb-3">
                          <div className="d-flex align-items-center" style={{ gap: '12px' }}>
                            <div style={{
                              width: '46px', height: '46px', borderRadius: '12px',
                              background: m.is_active ? '#e8f0fe' : '#f8f9fa',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              border: '1px solid #dee2e6',
                              overflow: 'hidden'
                            }}>
                              {m.icon_url ? (
                                <img src={m.icon_url} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '6px' }} onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }} />
                              ) : (
                                <CreditCard size={20} className={m.is_active ? 'text-primary' : 'text-muted'} />
                              )}
                            </div>
                            <div>
                              <h5 className="font-weight-bold m-0 text-dark" style={{ fontSize: '1rem' }}>{m.name}</h5>
                              <p className="text-muted text-xs m-0 mt-1">{m.description || 'No description'}</p>
                            </div>
                          </div>
                          {m.is_active ? (
                            <span className="badge badge-success px-2 py-1">ACTIVE</span>
                          ) : (
                            <span className="badge badge-danger px-2 py-1">DISABLED</span>
                          )}
                        </div>

                        <div className="row text-center mb-3">
                          <div className="col-4">
                            <div className="p-2 bg-light border rounded">
                              <p className="text-muted text-xs mb-1">Min Coins</p>
                              <p className="font-weight-bold text-dark m-0">{m.min_coins ?? '—'}</p>
                            </div>
                          </div>
                          <div className="col-4">
                            <div className="p-2 bg-light border rounded">
                              <p className="text-muted text-xs mb-1">Conversion</p>
                              <p className="font-weight-bold text-primary m-0">{m.conversion_rate ?? '—'}×</p>
                            </div>
                          </div>
                          <div className="col-4">
                            <div className="p-2 bg-light border rounded">
                              <p className="text-muted text-xs mb-1">Processing</p>
                              <p className="font-weight-bold text-dark m-0" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}><Clock size={11} className="text-muted" /> {m.processing_time || 'Instant'}</p>
                            </div>
                          </div>
                        </div>

                        {/* Display Custom Inputs */}
                        <div className="p-3 mb-3 bg-light rounded border shadow-none" style={{ background: '#f8f9fa' }}>
                          <p className="text-muted font-weight-bold text-xs mb-2 text-uppercase" style={{ letterSpacing: '0.03em' }}>Required User Inputs</p>
                          <div className="d-flex flex-column" style={{ gap: '6px' }}>
                            {parseFields(m.input_label, m.input_placeholder, m.input_type).map((f, idx) => (
                              <div key={idx} className="d-flex justify-content-between align-items-center bg-white p-2 border rounded" style={{ fontSize: '0.8rem' }}>
                                <span className="font-weight-bold text-dark">{f.label}</span>
                                <span className="text-muted text-xs">({f.type})</span>
                                <span className="text-muted text-xs font-italic">{f.placeholder}</span>
                              </div>
                            ))}
                            {(!m.input_label && !m.input_type) && (
                              <p className="text-muted text-xs font-italic mb-0">No input fields required</p>
                            )}
                          </div>
                        </div>

                        {/* Display Payout Tiers */}
                        <div className="p-3 mb-3 bg-light rounded border shadow-none" style={{ background: '#f8f9fa' }}>
                          <p className="text-muted font-weight-bold text-xs mb-2 text-uppercase" style={{ letterSpacing: '0.03em' }}>Configured Tiers</p>
                          {(!m.tiers || m.tiers.length === 0) ? (
                            <p className="text-muted text-xs font-italic mb-0">No fixed tiers (Uses dynamic rate)</p>
                          ) : (
                            <div className="d-flex flex-wrap" style={{ gap: '6px' }}>
                              {m.tiers.map((t, idx) => (
                                <span key={idx} className="badge badge-light border px-2 py-1 font-weight-bold" style={{ fontSize: '0.72rem' }}>
                                  🪙 {t.coin_cost} = {t.currency_symbol || '₹'}{t.monetary_value}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <button className="btn btn-default btn-block btn-sm" onClick={() => startEdit(m)}>
                        <Edit3 size={13} className="mr-1" /> Edit Method
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
