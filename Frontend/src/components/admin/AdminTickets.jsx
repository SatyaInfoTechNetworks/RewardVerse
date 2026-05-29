import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, X, Clock, CheckCircle, AlertCircle, Search, ChevronLeft, Lock } from 'lucide-react';

export default function AdminTickets({ getHeaders, showNotice, API_BASE }) {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [thread, setThread] = useState([]);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyText, setReplyText] = useState('');
  const [closeOnSend, setCloseOnSend] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const statusParam = filterStatus !== 'ALL' ? `?status=${filterStatus}` : '';
      const res = await fetch(`${API_BASE}/api/admin/tickets${statusParam}`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) setTickets(data.tickets || []);
    } catch (err) {
      console.error(err);
      showNotice('error', 'Failed to fetch tickets');
    }
    setLoading(false);
  };

  const fetchThread = async (ticketId) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/tickets/${ticketId}`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) setThread(data.replies || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { fetchTickets(); }, [filterStatus]);

  const openTicket = (ticket) => {
    setSelectedTicket(ticket);
    setReplyText('');
    fetchThread(ticket.id);
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/tickets/${selectedTicket.id}/reply`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ message: replyText })
      });
      const data = await res.json();
      if (data.success) {
        if (closeOnSend) {
          await fetch(`${API_BASE}/api/admin/tickets/${selectedTicket.id}/close`, {
            method: 'POST', headers: getHeaders()
          });
          setSelectedTicket({ ...selectedTicket, status: 'CLOSED' });
        } else {
          setSelectedTicket({ ...selectedTicket, status: 'REPLIED' });
        }
        setReplyText('');
        fetchThread(selectedTicket.id);
        fetchTickets();
        showNotice('success', closeOnSend ? 'Replied and ticket closed.' : 'Reply sent.');
      } else {
        showNotice('error', data.message);
      }
    } catch (err) {
      showNotice('error', 'Failed to send reply');
    }
    setSending(false);
  };

  const filtered = tickets.filter(t =>
    t.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.user_public_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statusColor = (s) => {
    if (s === 'OPEN') return 'text-warning';
    if (s === 'REPLIED') return 'text-primary';
    if (s === 'CLOSED') return 'text-muted';
    return 'text-secondary';
  };

  const statusIcon = (s) => {
    if (s === 'OPEN') return <AlertCircle size={14} className="mr-1 d-inline" />;
    if (s === 'REPLIED') return <CheckCircle size={14} className="mr-1 d-inline" />;
    if (s === 'CLOSED') return <Lock size={14} className="mr-1 d-inline" />;
    return <Clock size={14} className="mr-1 d-inline" />;
  };

  return (
    <div className="container-fluid pt-2">
      <div className="row">
        {/* Ticket List Column */}
        <div className={selectedTicket ? 'col-md-4' : 'col-md-12'}>
          <div className="card card-outline card-primary shadow-sm mb-4">
            <div className="card-header">
              <h3 className="card-title text-primary font-weight-bold" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={18} className="text-primary" /> Support Tickets
              </h3>
            </div>
            
            <div className="card-body">
              {/* Search */}
              <div className="input-group mb-3">
                <input
                  className="form-control"
                  placeholder="Search subject, email, or User ID..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                <div className="input-group-append">
                  <span className="input-group-text"><Search size={16} /></span>
                </div>
              </div>

              {/* Filters */}
              <div className="d-flex mb-3" style={{ gap: '6px', flexWrap: 'wrap' }}>
                {['ALL', 'OPEN', 'REPLIED', 'CLOSED'].map(s => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`btn btn-xs ${filterStatus === s ? 'btn-primary' : 'btn-default'}`}
                    style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {loading ? (
                <p className="text-muted text-center py-4">Loading tickets...</p>
              ) : filtered.length === 0 ? (
                <p className="text-muted text-center py-4">No tickets found.</p>
              ) : (
                <div className="list-group" style={{ maxHeight: '520px', overflowY: 'auto' }}>
                  {filtered.map(t => (
                    <button
                      key={t.id}
                      onClick={() => openTicket(t)}
                      className={`list-group-item list-group-item-action ${selectedTicket?.id === t.id ? 'active' : ''}`}
                      style={{ borderRadius: '6px', marginBottom: '6px', textAlign: 'left' }}
                    >
                      <div className="d-flex w-100 justify-content-between align-items-start">
                        <h6 className="mb-1 font-weight-bold" style={{ color: selectedTicket?.id === t.id ? '#fff' : '#212529', fontSize: '0.9rem' }}>{t.subject || 'No Subject'}</h6>
                        <span className={`text-xs ${selectedTicket?.id === t.id ? 'text-white' : statusColor(t.status)}`} style={{ fontWeight: 600 }}>
                          {t.status}
                        </span>
                      </div>
                      <p className="mb-1 text-xs" style={{ color: selectedTicket?.id === t.id ? 'rgba(255,255,255,0.85)' : '#6c757d' }}>{t.user_email || 'Unknown User'}</p>
                      <div className="d-flex justify-content-between text-xs" style={{ color: selectedTicket?.id === t.id ? 'rgba(255,255,255,0.7)' : '#adb5bd' }}>
                        <span>ID: {t.user_public_id || 'N/A'}</span>
                        <span>{new Date(t.created_at).toLocaleDateString()}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Selected Ticket Thread Column */}
        {selectedTicket && (
          <div className="col-md-8">
            <div className="card card-outline card-primary shadow-sm mb-4">
              <div className="card-header d-flex align-items-center justify-content-between" style={{ width: '100%' }}>
                <div className="d-flex align-items-center" style={{ gap: '8px' }}>
                  <button className="btn btn-default btn-xs" onClick={() => setSelectedTicket(null)}>
                    <ChevronLeft size={14} className="mr-1" /> Back
                  </button>
                  <h4 className="card-title text-dark font-weight-bold m-0 ml-2" style={{ fontSize: '1rem' }}>{selectedTicket.subject}</h4>
                </div>
                
                {selectedTicket.status !== 'CLOSED' && (
                  <button className="btn btn-danger btn-xs ml-auto" onClick={async () => {
                    if (!window.confirm("Are you sure you want to close this support ticket?")) return;
                    try {
                      const res = await fetch(`${API_BASE}/api/admin/tickets/${selectedTicket.id}/close`, {
                        method: 'POST', headers: getHeaders()
                      });
                      const data = await res.json();
                      if (data.success) {
                        setSelectedTicket({ ...selectedTicket, status: 'CLOSED' });
                        fetchTickets();
                        showNotice('success', 'Ticket closed successfully.');
                      } else {
                        showNotice('error', data.message);
                      }
                    } catch (err) {
                      showNotice('error', 'Failed to close ticket');
                    }
                  }}>
                    🔒 Close Ticket
                  </button>
                )}
              </div>
              
              <div className="card-body">
                <div className="mb-3 p-2 bg-light rounded border text-xs text-muted">
                  👤 <strong>{selectedTicket.user_email}</strong> &bull; Public ID: <strong>{selectedTicket.user_public_id || 'N/A'}</strong> &mdash; Status: <span className={`font-weight-bold ${statusColor(selectedTicket.status)}`}>{selectedTicket.status}</span>
                </div>

                {/* Messages List */}
                <div className="d-flex flex-column" style={{ gap: '14px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px', paddingBottom: '10px' }}>
                  {/* Original Inquiry */}
                  <div className="p-3 bg-light rounded border align-self-start" style={{ maxWidth: '85%' }}>
                    <p className="text-xs text-muted mb-2 font-weight-bold">
                      📩 User &bull; {new Date(selectedTicket.created_at).toLocaleString()}
                    </p>
                    <p className="text-sm m-0 text-dark" style={{ lineHeight: 1.5 }}>{selectedTicket.message}</p>
                  </div>

                  {/* replies */}
                  {thread.map(r => {
                    const isAdmin = r.sender_type === 'ADMIN';
                    return (
                      <div key={r.id} className={`p-3 rounded border align-self-${isAdmin ? 'end' : 'start'}`} style={{ maxWidth: '85%', background: isAdmin ? '#f1f3f9' : '#f8f9fa', borderLeft: isAdmin ? '3px solid var(--primary)' : '1px solid #dee2e6' }}>
                        <p className="text-xs text-muted mb-2 font-weight-bold">
                          {isAdmin ? '⚡ Admin' : '📩 User'} &bull; {new Date(r.created_at).toLocaleString()}
                        </p>
                        <p className="text-sm m-0 text-dark" style={{ lineHeight: 1.5 }}>{r.message}</p>
                      </div>
                    );
                  })}

                  {thread.length === 0 && (
                    <p className="text-muted text-xs text-center py-2">No replies in this thread yet.</p>
                  )}
                </div>

                {/* Reply Form */}
                {selectedTicket.status !== 'CLOSED' && (
                  <form onSubmit={handleReply} className="border-top pt-3 mt-3">
                    <div className="form-group">
                      <textarea
                        className="form-control"
                        rows={3}
                        placeholder="Write your admin response here..."
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        required
                      />
                    </div>
                    <div className="d-flex justify-content-between align-items-center">
                      <label className="d-flex align-items-center m-0 text-sm" style={{ cursor: 'pointer', gap: '8px' }}>
                        <input type="checkbox" checked={closeOnSend} onChange={e => setCloseOnSend(e.target.checked)} />
                        Close ticket after sending
                      </label>
                      <button type="submit" className="btn btn-primary btn-sm" disabled={sending}>
                        <Send size={13} className="mr-1" /> {sending ? 'Sending...' : 'Send Reply'}
                      </button>
                    </div>
                  </form>
                )}
                
                {selectedTicket.status === 'CLOSED' && (
                  <div className="alert alert-secondary text-center text-sm m-0 mt-3">
                    <Lock size={14} className="mr-1 d-inline" /> This ticket is closed. No further replies can be added.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
