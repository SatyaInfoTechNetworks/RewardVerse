import React, { useState, useEffect, useRef } from 'react';
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

  const chatEndRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [thread]);

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
                <div className="list-group" style={{ maxHeight: '520px', overflowY: 'auto', paddingRight: '4px' }}>
                  {filtered.map(t => {
                    const isSelected = selectedTicket?.id === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => openTicket(t)}
                        className="list-group-item list-group-item-action border-0 shadow-sm"
                        style={{
                          borderRadius: '8px',
                          marginBottom: '8px',
                          textAlign: 'left',
                          borderLeft: isSelected ? '4px solid #4f46e5' : '4px solid transparent',
                          background: isSelected ? '#eff6ff' : '#f8fafc',
                          padding: '12px 16px',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div className="d-flex w-100 justify-content-between align-items-start">
                          <h6 className="mb-1 font-weight-bold" style={{ color: '#1e293b', fontSize: '0.9rem' }}>
                            {t.subject || 'No Subject'}
                          </h6>
                          <span 
                            className={`badge ${t.status === 'OPEN' ? 'badge-warning' : t.status === 'REPLIED' ? 'badge-primary' : 'badge-secondary'} text-xs`}
                            style={{ padding: '4px 8px', borderRadius: '4px' }}
                          >
                            {t.status}
                          </span>
                        </div>
                        <p className="mb-1 text-xs text-muted" style={{ fontWeight: 500 }}>
                          {t.user_email || 'Unknown User'}
                        </p>
                        <div className="d-flex justify-content-between text-xs text-muted" style={{ fontSize: '0.75rem' }}>
                          <span>ID: {t.user_public_id || 'N/A'}</span>
                          <span>{new Date(t.created_at).toLocaleDateString()}</span>
                        </div>
                      </button>
                    );
                  })}
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

                {/* Messages List Container with custom styling */}
                <div 
                  className="d-flex flex-column" 
                  style={{ 
                    gap: '14px', 
                    maxHeight: '420px', 
                    overflowY: 'auto', 
                    padding: '16px', 
                    backgroundColor: '#f8fafc', 
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.03)'
                  }}
                >
                  {/* Original Inquiry */}
                  <div 
                    className="p-3 align-self-start shadow-sm" 
                    style={{ 
                      maxWidth: '75%', 
                      background: '#ffffff', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '16px 16px 16px 4px'
                    }}
                  >
                    <div className="d-flex align-items-center mb-1 text-xs text-muted font-weight-bold">
                      <span className="badge badge-secondary mr-2">Client Inquiry</span>
                      <span>{new Date(selectedTicket.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm m-0 text-dark" style={{ lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {selectedTicket.message}
                    </p>
                  </div>

                  {/* replies */}
                  {thread.map(r => {
                    const isAdmin = r.sender_type === 'ADMIN';
                    return (
                      <div 
                        key={r.id} 
                        className={`p-3 shadow-sm align-self-${isAdmin ? 'end' : 'start'}`} 
                        style={{ 
                          maxWidth: '75%', 
                          background: isAdmin ? 'linear-gradient(135deg, #4f46e5, #3730a3)' : '#ffffff', 
                          border: isAdmin ? 'none' : '1px solid #e2e8f0',
                          color: isAdmin ? '#ffffff' : '#212529',
                          borderRadius: isAdmin ? '16px 16px 4px 16px' : '16px 16px 16px 4px'
                        }}
                      >
                        <div className="d-flex align-items-center mb-1 text-xs font-weight-bold" style={{ opacity: 0.85 }}>
                          {isAdmin ? (
                            <span className="badge mr-2" style={{ background: 'rgba(255, 255, 255, 0.2)', color: '#ffffff' }}>Admin Reply</span>
                          ) : (
                            <span className="badge badge-secondary mr-2">Client Reply</span>
                          )}
                          <span className={isAdmin ? 'text-white' : 'text-muted'}>{new Date(r.created_at).toLocaleString()}</span>
                        </div>
                        <p 
                          className="text-sm m-0" 
                          style={{ 
                            lineHeight: 1.5, 
                            whiteSpace: 'pre-wrap', 
                            wordBreak: 'break-word',
                            color: isAdmin ? '#ffffff' : '#1e293b'
                          }}
                        >
                          {r.message}
                        </p>
                      </div>
                    );
                  })}

                  {thread.length === 0 && (
                    <p className="text-muted text-xs text-center py-2">No replies in this thread yet.</p>
                  )}

                  <div ref={chatEndRef} />
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
