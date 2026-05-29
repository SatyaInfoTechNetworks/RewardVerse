import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { API_BASE } from '../config';

export default function DeleteAccount() {
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setResponse(null);

    try {
      const res = await fetch(`${API_BASE}/api/user/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ email, reason })
      });
      const data = await res.json();
      
      if (data.success) {
        setResponse({ type: 'success', message: data.message });
        setEmail('');
        setReason('');
      } else {
        setResponse({ type: 'error', message: data.message || 'Something went wrong.' });
      }
    } catch (error) {
      setResponse({ type: 'error', message: 'Failed to connect to the server. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ 
        position: 'sticky', 
        top: 0, 
        zIndex: 100, 
        background: 'rgba(10, 11, 16, 0.7)', 
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-glass)' 
      }}>
        <div className="container" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          height: '70px' 
        }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <div style={{ 
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              color: '#fff',
              fontSize: '1.2rem'
            }}>R</div>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>
              Reward<span style={{ color: 'var(--primary)' }}>verse</span>
            </span>
          </Link>
          <Link to="/" className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
            <ArrowLeft size={16} /> Back to Home
          </Link>
        </div>
      </header>

      {/* Content */}
      <main style={{ flex: 1, padding: '60px 0 100px', display: 'flex', alignItems: 'center' }}>
        <div className="container" style={{ maxWidth: '600px', width: '100%' }}>
          <div className="glass-panel" style={{ padding: '40px 30px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
              <div style={{ 
                background: 'rgba(239, 68, 68, 0.1)', 
                color: 'var(--danger)', 
                width: '50px', 
                height: '50px', 
                borderRadius: '12px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center'
              }}>
                <Trash2 size={24} />
              </div>
              <div>
                <h1 style={{ fontSize: '1.6rem', margin: 0 }}>Delete Account Request</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>Request permanent erasure of your data</p>
              </div>
            </div>

            <div style={{ 
              background: 'rgba(245, 158, 11, 0.05)',
              border: '1px solid rgba(245, 158, 11, 0.15)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '24px',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start'
            }}>
              <AlertTriangle size={20} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: '2px' }} />
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                <strong>WARNING:</strong> Requesting account deletion is permanent and irreversible. Once approved by our administrative team, all your profile data, transaction histories, wallet balances, active tasks progress, and referral connections will be permanently expunged from the system. You will lose all accumulated coins.
              </p>
            </div>

            {response && (
              <div style={{ 
                background: response.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: response.type === 'success' ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '24px',
                color: response.type === 'success' ? 'var(--success)' : 'var(--danger)',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                {response.type === 'success' && <CheckCircle2 size={18} style={{ flexShrink: 0 }} />}
                <span>{response.message}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Registered Google Email Address</label>
                <input 
                  type="email" 
                  className="glass-input" 
                  placeholder="name@example.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Reason for Deletion (Optional)</label>
                <textarea 
                  className="glass-input" 
                  rows={4}
                  placeholder="Please share your feedback..." 
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={loading}
                  style={{ resize: 'vertical', minHeight: '100px' }}
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-danger" 
                style={{ width: '100%', padding: '14px', fontSize: '1rem', marginTop: '10px' }}
                disabled={loading || !email}
              >
                {loading ? 'Submitting Request...' : 'Submit Deletion Request'}
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ 
        background: '#07080c', 
        borderTop: '1px solid var(--border-glass)', 
        padding: '30px 0',
        textAlign: 'center',
        fontSize: '0.8rem',
        color: 'var(--text-muted)'
      }}>
        &copy; 2026 Rewardverse. All rights reserved.
      </footer>
    </div>
  );
}
