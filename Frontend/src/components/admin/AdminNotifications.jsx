import React, { useState, useEffect } from 'react';
import { Bell, Send, History, Users, Clock, Image, Layers } from 'lucide-react';

export default function AdminNotifications({ getHeaders, showNotice, API_BASE }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [targetType, setTargetType] = useState('broadcast'); // broadcast, specific, topic
  const [targetUserId, setTargetUserId] = useState('');
  const [topic, setTopic] = useState('offers'); // offers, games, wallet, vip
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/notifications?page=${page}&limit=${PER_PAGE}`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) setHistory(data.notifications || []);
    } catch (err) {
      console.error(err);
    }
    setLoadingHistory(false);
  };

  useEffect(() => { fetchHistory(); }, [page]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!title || !body) return;
    setSending(true);
    setSendStatus('sending');
    try {
      const res = await fetch(`${API_BASE}/api/admin/push`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          title,
          body,
          image_url: imageUrl.trim() || undefined,
          target_type: targetType,
          user_id: targetType === 'specific' ? targetUserId.trim() : undefined,
          topic: targetType === 'topic' ? topic : undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        setSendStatus('success');
        setTitle('');
        setBody('');
        setImageUrl('');
        setTargetUserId('');
        fetchHistory();
        setTimeout(() => setSendStatus(null), 4000);
      } else {
        setSendStatus('error');
        showNotice('error', data.message || 'Failed to send notification');
      }
    } catch (err) {
      setSendStatus('error');
      showNotice('error', 'FCM transmission error');
    }
    setSending(false);
  };

  return (
    <div className="container-fluid pt-2">
      <div className="row">
        {/* Compose Notification Column */}
        <div className="col-md-6 mb-4">
          <div className="card card-outline card-primary shadow-sm h-100">
            <div className="card-header">
              <h3 className="card-title text-primary font-weight-bold" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bell size={18} className="text-primary" /> FCM Notification Engine
              </h3>
            </div>
            
            <div className="card-body">
              <p className="text-muted text-xs mb-3">
                Compose high-fidelity push notifications, configure dynamic targeting and attach banners.
              </p>

              {sendStatus && (
                <div className={`alert text-sm ${sendStatus === 'success' ? 'alert-success' : sendStatus === 'sending' ? 'alert-warning' : 'alert-danger'} mb-3`}>
                  {sendStatus === 'sending' && '📡 Broadcasting signal via FCM...'}
                  {sendStatus === 'success' && '✅ Push notification processed and delivered successfully.'}
                  {sendStatus === 'error' && '❌ Transaction failed. Ensure Firebase parameters are validated.'}
                </div>
              )}

              <form onSubmit={handleSend} className="d-flex flex-column" style={{ gap: '14px' }}>
                {/* Target Type Selector */}
                <div className="form-group mb-0">
                  <label className="text-sm font-weight-bold d-flex align-items-center gap-1">
                    <Layers size={13} className="mr-1" /> Targeting Audience
                  </label>
                  <select className="form-control" value={targetType} onChange={e => setTargetType(e.target.value)}>
                    <option value="broadcast">Broadcast (All Active Users)</option>
                    <option value="specific">Specific User (10-Digit ID)</option>
                    <option value="topic">Topic-Based Channel</option>
                  </select>
                </div>

                {/* Conditional Target UI */}
                {targetType === 'specific' && (
                  <div className="form-group mb-0">
                    <label className="text-sm font-weight-bold d-flex align-items-center gap-1">
                      <Users size={13} className="mr-1" /> Target User ID (10-char Hex ID)
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. SE1A2B3C"
                      value={targetUserId}
                      onChange={e => setTargetUserId(e.target.value)}
                      required
                    />
                  </div>
                )}

                {targetType === 'topic' && (
                  <div className="form-group mb-0">
                    <label className="text-sm font-weight-bold d-flex align-items-center gap-1">
                      <Layers size={13} className="mr-1" /> Selective Channel Topic
                    </label>
                    <select className="form-control" value={topic} onChange={e => setTopic(e.target.value)}>
                      <option value="offers">Offers & Survey Completion Alerts</option>
                      <option value="games">Lucky Spins & Games Rewards</option>
                      <option value="wallet">Wallet Balance & Deductions</option>
                      <option value="vip">VIP Status & Elite Bonus Rewards</option>
                    </select>
                  </div>
                )}

                <div className="form-group mb-0">
                  <label className="text-sm font-weight-bold">Notification Title</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 🎉 Earn 3x coins this weekend!"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group mb-0">
                  <label className="text-sm font-weight-bold">Message Body</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Short description or alert message..."
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    required
                  />
                </div>

                {/* Banner URL Input with Preview */}
                <div className="form-group mb-0">
                  <label className="text-sm font-weight-bold d-flex align-items-center gap-1">
                    <Image size={13} className="mr-1" /> Banner / Image URL <span className="text-muted font-weight-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. https://example.com/banner.png"
                    value={imageUrl}
                    onChange={e => setImageUrl(e.target.value)}
                  />
                  {imageUrl && (
                    <div className="mt-2 p-2 bg-light rounded border text-center">
                      <img
                        src={imageUrl}
                        style={{ width: '100%', maxHeight: '100px', objectFit: 'cover', borderRadius: '4px' }}
                        alt="Banner Preview"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                  )}
                </div>

                <button type="submit" className="btn btn-primary btn-block btn-sm mt-2" disabled={sending}>
                  <Send size={14} className="mr-1" /> {sending ? 'Transmitting FCM Signals...' : 'Dispatch Push Alert'}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Notification History Column */}
        <div className="col-md-6 mb-4">
          <div className="card card-outline card-success shadow-sm h-100">
            <div className="card-header">
              <h3 className="card-title text-success font-weight-bold" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={18} className="text-success" /> Notification History Database
              </h3>
            </div>
            
            <div className="card-body d-flex flex-column justify-content-between">
              <div>
                {loadingHistory ? (
                  <p className="text-muted text-center py-5">Loading...</p>
                ) : history.length === 0 ? (
                  <p className="text-muted text-center py-5">No notifications sent yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '520px', overflowY: 'auto' }}>
                    {history.map(n => (
                      <div key={n.id} className="p-3 bg-light rounded border text-left">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <h6 className="font-weight-bold text-dark m-0" style={{ fontSize: '0.9rem' }}>{n.title}</h6>
                          {n.sent_count !== undefined && (
                            <span className="badge badge-success px-2 py-1" style={{ fontSize: '0.68rem' }}>
                              {n.sent_count} sent
                            </span>
                          )}
                        </div>
                        
                        <p className="text-muted text-xs mb-2">{n.message}</p>

                        {/* Banner Log Preview */}
                        {n.image_url && (
                          <div className="mb-2 rounded border overflow-hidden" style={{ maxHeight: '80px' }}>
                            <img src={n.image_url} style={{ width: '100%', height: '80px', objectFit: 'cover' }} alt="Log Preview" onError={(e) => { e.target.style.display = 'none'; }} />
                          </div>
                        )}

                        <div className="d-flex justify-content-between align-items-center text-xs text-muted">
                          <span>
                            <Clock size={11} className="mr-1 d-inline" /> {new Date(n.created_at).toLocaleString()}
                          </span>
                          
                          {/* Targeting details */}
                          <span className="font-weight-bold text-uppercase" style={{ fontSize: '0.65rem' }}>
                            {n.target_type === 'broadcast' && '📢 Global'}
                            {n.target_type === 'specific' && `👤 ID: ${n.target_user_id || 'N/A'}`}
                            {n.target_type === 'topic' && `🏷️ Topic: ${n.target_topic || 'general'}`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pagination */}
              <div className="d-flex justify-content-center align-items-center mt-3" style={{ gap: '10px' }}>
                <button className="btn btn-default btn-xs" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</button>
                <span className="text-xs text-muted font-weight-bold">Page {page}</span>
                <button className="btn btn-default btn-xs" onClick={() => setPage(p => p + 1)} disabled={history.length < PER_PAGE}>Next →</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
