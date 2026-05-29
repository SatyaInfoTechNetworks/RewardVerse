import React, { useState, useEffect } from 'react';
import { Trophy, Plus, Calendar, Users, Award, Gift, Coins, Trash, Edit, RefreshCw, CheckCircle, Clock } from 'lucide-react';

export default function AdminContests({ getHeaders, showNotice, API_BASE }) {
  const [loading, setLoading] = useState(true);
  const [contests, setContests] = useState([]);
  const [activeView, setActiveView] = useState('list'); // list, create, edit, entries, winners
  const [selectedContest, setSelectedContest] = useState(null);
  
  // Contest entries & winners states
  const [entries, setEntries] = useState([]);
  const [winners, setWinners] = useState([]);
  const [giftcardCodes, setGiftcardCodes] = useState({});

  // Contest Form State
  const [contestForm, setContestForm] = useState({
    title: '',
    description: '',
    type: 'LUCKY_DRAW',
    start_time: '',
    end_time: '',
    max_entries_per_day: 3,
    total_winners: 1,
    rewards: [
      { reward_position: 1, reward_type: 'COINS', reward_value: 500 }
    ],
    slug: '',
    banner_image: '',
    prize_text: '',
    allow_free_entry: true,
    allow_ad_entry: true,
    max_ad_entries_per_day: 3,
    allow_coins_entry: false,
    ticket_coins_cost: 0,
    max_tickets_per_user: 10
  });

  const fetchContests = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/contests`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        setContests(data.contests || []);
      }
    } catch (err) {
      console.error(err);
      showNotice('error', 'Failed to load contests database');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchContests();
  }, []);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/admin/contests`, {
        method: 'POST',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(contestForm)
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', 'Contest event created and published successfully!');
        resetForm();
        fetchContests();
        setActiveView('list');
      } else {
        showNotice('error', data.message || 'Failed to publish contest');
      }
    } catch (err) {
      console.error(err);
      showNotice('error', 'Network error during contest creation');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/admin/contests/${selectedContest.id}`, {
        method: 'PUT',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(contestForm)
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', 'Contest details updated successfully.');
        resetForm();
        fetchContests();
        setActiveView('list');
      } else {
        showNotice('error', data.message || 'Failed to update contest');
      }
    } catch (err) {
      console.error(err);
      showNotice('error', 'Network error during contest update');
    }
  };

  const handleDeleteContest = async (id) => {
    if (!window.confirm("Are you sure you want to permanently delete/cancel this contest? All entry and winner logs will be purged.")) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/contests/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', 'Contest deleted successfully.');
        fetchContests();
      } else {
        showNotice('error', data.message);
      }
    } catch (err) {
      showNotice('error', 'Network error during contest deletion');
    }
  };

  const handleViewEntries = async (contest) => {
    setSelectedContest(contest);
    setEntries([]);
    setActiveView('entries');
    try {
      const res = await fetch(`${API_BASE}/api/admin/contests/${contest.id}/entries`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        setEntries(data.entries || []);
      }
    } catch (err) {
      showNotice('error', 'Failed to load entries audit');
    }
  };

  const handleViewWinners = async (contest) => {
    setSelectedContest(contest);
    setWinners([]);
    setActiveView('winners');
    try {
      const res = await fetch(`${API_BASE}/api/admin/contests/${contest.id}/winners`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        setWinners(data.winners || []);
      }
    } catch (err) {
      showNotice('error', 'Failed to load winners log');
    }
  };

  const handleDrawWinners = async (contest) => {
    if (!window.confirm(`Are you ready to perform the weighted raffle draw for "${contest.title}"? This will instantly credit Coins/Cash winners and finalize positions.`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/contests/${contest.id}/draw`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', data.message);
        fetchContests();
        handleViewWinners(contest);
      } else {
        showNotice('error', data.message);
      }
    } catch (err) {
      showNotice('error', 'Error drawing contest winners');
    }
  };

  const handleDeliverGiftcard = async (winnerId) => {
    const code = giftcardCodes[winnerId];
    if (!code || !code.trim()) {
      showNotice('error', 'Please enter a valid gift card voucher code / transaction reference');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/contests/winners/${winnerId}/give-reward`, {
        method: 'POST',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ remark: code })
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', 'Gift card voucher delivered and sent to the user!');
        // Refresh winners view
        handleViewWinners(selectedContest);
      } else {
        showNotice('error', data.message);
      }
    } catch (err) {
      showNotice('error', 'Network error during reward delivery');
    }
  };

  const resetForm = () => {
    setContestForm({
      title: '',
      description: '',
      type: 'LUCKY_DRAW',
      start_time: '',
      end_time: '',
      max_entries_per_day: 3,
      total_winners: 1,
      rewards: [
        { reward_position: 1, reward_type: 'COINS', reward_value: 500 }
      ],
      slug: '',
      banner_image: '',
      prize_text: '',
      allow_free_entry: true,
      allow_ad_entry: true,
      max_ad_entries_per_day: 3,
      allow_coins_entry: false,
      ticket_coins_cost: 0,
      max_tickets_per_user: 10
    });
    setSelectedContest(null);
  };

  const handleEditClick = (contest) => {
    setSelectedContest(contest);
    
    // Format dates for datetime-local inputs
    const startFormatted = contest.start_time ? new Date(contest.start_time).toISOString().slice(0, 16) : '';
    const endFormatted = contest.end_time ? new Date(contest.end_time).toISOString().slice(0, 16) : '';

    setContestForm({
      title: contest.title,
      description: contest.description,
      type: contest.type,
      start_time: startFormatted,
      end_time: endFormatted,
      max_entries_per_day: contest.max_entries_per_day,
      total_winners: contest.total_winners,
      rewards: contest.rewards && contest.rewards.length > 0 ? contest.rewards.map(r => ({
        reward_position: r.reward_position,
        reward_type: r.reward_type,
        reward_value: r.reward_value
      })) : [{ reward_position: 1, reward_type: 'COINS', reward_value: 500 }],
      slug: contest.slug || '',
      banner_image: contest.banner_image || '',
      prize_text: contest.prize_text || '',
      allow_free_entry: contest.allow_free_entry !== undefined ? Boolean(contest.allow_free_entry) : true,
      allow_ad_entry: contest.allow_ad_entry !== undefined ? Boolean(contest.allow_ad_entry) : true,
      max_ad_entries_per_day: contest.max_ad_entries_per_day !== undefined ? contest.max_ad_entries_per_day : 3,
      allow_coins_entry: contest.allow_coins_entry !== undefined ? Boolean(contest.allow_coins_entry) : false,
      ticket_coins_cost: contest.ticket_coins_cost !== undefined ? contest.ticket_coins_cost : 0,
      max_tickets_per_user: contest.max_tickets_per_user !== undefined ? contest.max_tickets_per_user : 10
    });
    setActiveView('edit');
  };

  const addRewardRow = () => {
    const nextPos = contestForm.rewards.length + 1;
    setContestForm({
      ...contestForm,
      total_winners: nextPos,
      rewards: [
        ...contestForm.rewards,
        { reward_position: nextPos, reward_type: 'COINS', reward_value: 100 }
      ]
    });
  };

  const removeRewardRow = (idx) => {
    const updated = contestForm.rewards.filter((_, i) => i !== idx).map((r, i) => ({
      ...r,
      reward_position: i + 1
    }));
    setContestForm({
      ...contestForm,
      total_winners: updated.length,
      rewards: updated.length > 0 ? updated : [{ reward_position: 1, reward_type: 'COINS', reward_value: 500 }]
    });
  };

  const handleRewardRowChange = (idx, field, val) => {
    const updated = [...contestForm.rewards];
    updated[idx][field] = val;
    setContestForm({
      ...contestForm,
      rewards: updated
    });
  };

  if (loading && activeView === 'list') {
    return <p className="text-center text-muted p-5">Synchronizing contest engine...</p>;
  }

  return (
    <div className="container-fluid p-0">
      
      {/* HEADER CONTROLS */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="font-weight-black text-dark d-flex align-items-center gap-2 mb-1">
            <Trophy className="text-warning" size={24} /> Promotional Contest Engine
          </h4>
          <p className="text-muted text-xs mb-0">Manage community raffles, ticket entries, referral lists, and audit winner dispatches securely.</p>
        </div>
        <div>
          {activeView === 'list' ? (
            <button className="btn btn-primary rounded-pill font-weight-bold px-4 shadow-sm" onClick={() => { resetForm(); setActiveView('create'); }}>
              <Plus size={16} className="mr-1" /> Launch Contest
            </button>
          ) : (
            <button className="btn btn-outline-secondary rounded-pill font-weight-bold px-4" onClick={() => { resetForm(); setActiveView('list'); fetchContests(); }}>
              Cancel & Return
            </button>
          )}
        </div>
      </div>

      {/* VIEW A: CONTEST LIST TABLE */}
      {activeView === 'list' && (
        <div className="card card-white shadow-none border rounded-lg">
          <div className="card-header border-0 bg-transparent d-flex justify-content-between align-items-center">
            <h3 className="card-title font-weight-bold text-dark mb-0">Contests Database</h3>
            <button className="btn btn-xs btn-outline-secondary rounded-pill px-3" onClick={fetchContests}><RefreshCw size={12} className="mr-1" /> Sync</button>
          </div>
          <div className="card-body p-0 table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="bg-light">
                <tr className="text-xs text-muted uppercase">
                  <th className="pl-4">Contest Title</th>
                  <th>Type</th>
                  <th className="text-center">Active Entries</th>
                  <th className="text-center">Total Winners</th>
                  <th>Time Range</th>
                  <th className="text-center">Status</th>
                  <th className="text-right pr-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {contests.map(c => (
                  <tr key={c.id} className="text-sm">
                    <td className="pl-4">
                      <div className="font-weight-bold text-dark">{c.title}</div>
                      <div className="text-xs text-muted" style={{ maxWidth: '280px', whiteSpace: 'normal' }}>{c.description || 'No description provided.'}</div>
                    </td>
                    <td>
                      <span className={`badge badge-${c.type === 'LUCKY_DRAW' ? 'primary' : c.type === 'REFERRAL_CONTEST' ? 'warning' : 'success'} px-2 py-1`}>
                        {c.type === 'LUCKY_DRAW' ? '🎟️ Lucky Draw' : c.type === 'REFERRAL_CONTEST' ? '👥 Referral' : '⚔️ Earnings Battle'}
                      </span>
                    </td>
                    <td className="text-center font-weight-bold">
                      <span className="badge badge-light border p-2">{c.total_entries} <span className="text-xs font-normal text-muted">tickets</span></span>
                    </td>
                    <td className="text-center font-weight-black text-warning">
                      {c.total_winners} Winners
                    </td>
                    <td className="text-xs text-muted">
                      <div><Clock size={10} className="mr-1" /> {new Date(c.start_time).toLocaleDateString()} {new Date(c.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      <div className="mt-1 text-danger font-weight-bold"><Clock size={10} className="mr-1" /> {new Date(c.end_time).toLocaleDateString()} {new Date(c.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td className="text-center">
                      <span className={`badge badge-${c.status === 'ACTIVE' ? 'success' : 'secondary'} px-2 py-1`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="text-right pr-4">
                      <div className="btn-group">
                        <button className="btn btn-outline-primary btn-xs font-weight-bold mr-2 px-3 rounded-pill" onClick={() => handleEditClick(c)}>Edit</button>
                        <button className="btn btn-outline-info btn-xs font-weight-bold mr-2 px-3 rounded-pill" onClick={() => handleViewEntries(c)}>Tickets ({c.total_participants})</button>
                        {c.status === 'ACTIVE' ? (
                          <button className="btn btn-warning btn-xs font-weight-bold text-dark mr-2 px-3 rounded-pill" onClick={() => handleDrawWinners(c)}>Draw Matrix</button>
                        ) : (
                          <button className="btn btn-success btn-xs font-weight-bold mr-2 px-3 rounded-pill" onClick={() => handleViewWinners(c)}>Winners Log</button>
                        )}
                        <button className="btn btn-outline-danger btn-xs font-weight-bold px-3 rounded-pill" onClick={() => handleDeleteContest(c.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {contests.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted p-5">No published promotional contests found. Launch one above!</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW B: CREATE / EDIT FORM */}
      {(activeView === 'create' || activeView === 'edit') && (
        <form onSubmit={activeView === 'create' ? handleCreateSubmit : handleEditSubmit}>
          <div className="row">
            {/* Left Configuration Card */}
            <div className="col-lg-7">
              <div className="card card-white shadow-none border rounded-lg">
                <div className="card-header border-bottom-0 bg-transparent"><h3 className="card-title font-weight-bold text-dark">Contest Configuration Details</h3></div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-6 form-group mb-3">
                      <label className="text-muted text-xs font-weight-bold mb-1">Sweepstakes Campaign Title</label>
                      <input type="text" className="form-control" placeholder="e.g. 🎁 Daily Free Draw" value={contestForm.title} onChange={e => setContestForm({ ...contestForm, title: e.target.value })} required />
                    </div>
                    <div className="col-6 form-group mb-3">
                      <label className="text-muted text-xs font-weight-bold mb-1">URL Slug Parameter</label>
                      <input type="text" className="form-control" placeholder="e.g. daily-free-draw" value={contestForm.slug} onChange={e => setContestForm({ ...contestForm, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} required />
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-6 form-group mb-3">
                      <label className="text-muted text-xs font-weight-bold mb-1">Sweepstakes Event Type</label>
                      <select className="form-control" value={contestForm.type} onChange={e => {
                        const newType = e.target.value;
                        if (newType === 'LUCKY_DRAW') {
                          setContestForm({
                            ...contestForm,
                            type: newType,
                            max_tickets_per_user: 10,
                            max_entries_per_day: 3,
                            allow_free_entry: true,
                            allow_ad_entry: true,
                            allow_coins_entry: false
                          });
                        } else {
                          setContestForm({
                            ...contestForm,
                            type: newType,
                            max_tickets_per_user: 1,
                            max_entries_per_day: 0,
                            allow_free_entry: false,
                            allow_ad_entry: false,
                            allow_coins_entry: false
                          });
                        }
                      }} required>
                        <option value="LUCKY_DRAW">🎟️ Lucky Ticket Draw</option>
                        <option value="REFERRAL_CONTEST">👥 Referral Contest</option>
                        <option value="EARNINGS_CONTEST">⚔️ Earnings Battle</option>
                      </select>
                    </div>
                    <div className="col-6 form-group mb-3">
                      <label className="text-muted text-xs font-weight-bold mb-1">Banner Display Image URL</label>
                      <input type="text" className="form-control" placeholder="https://images.unsplash.com/..." value={contestForm.banner_image} onChange={e => setContestForm({ ...contestForm, banner_image: e.target.value })} />
                    </div>
                  </div>
                  
                  <div className="form-group mb-3">
                    <label className="text-muted text-xs font-weight-bold mb-1">Event Short Description & Rules</label>
                    <textarea rows={3} className="form-control" placeholder="Rules, requirements, or terms for this draw..." value={contestForm.description} onChange={e => setContestForm({ ...contestForm, description: e.target.value })} />
                  </div>

                  <div className="row">
                    <div className={contestForm.type === 'LUCKY_DRAW' ? "col-6 form-group mb-3" : "col-12 form-group mb-3"}>
                      <label className="text-muted text-xs font-weight-bold mb-1">Prize Text Label</label>
                      <input type="text" className="form-control" placeholder="e.g. ₹500 Paytm Cash" value={contestForm.prize_text} onChange={e => setContestForm({ ...contestForm, prize_text: e.target.value })} />
                    </div>
                    {contestForm.type === 'LUCKY_DRAW' && (
                      <div className="col-6 form-group mb-3">
                        <label className="text-muted text-xs font-weight-bold mb-1">Max Tickets Allowed Per User (Total)</label>
                        <input type="number" className="form-control" value={contestForm.max_tickets_per_user} onChange={e => setContestForm({ ...contestForm, max_tickets_per_user: parseInt(e.target.value || 10) })} required />
                      </div>
                    )}
                  </div>

                  <div className="row">
                    <div className={contestForm.type === 'LUCKY_DRAW' ? "col-6 form-group mb-3" : "col-12 form-group mb-3"}>
                      <label className="text-muted text-xs font-weight-bold mb-1">Winners Slot Count</label>
                      <input type="number" className="form-control" value={contestForm.total_winners} onChange={e => setContestForm({ ...contestForm, total_winners: parseInt(e.target.value || 1) })} required />
                    </div>
                    {contestForm.type === 'LUCKY_DRAW' && (
                      <div className="col-6 form-group mb-3">
                        <label className="text-muted text-xs font-weight-bold mb-1">Daily Limit (Total Tickets)</label>
                        <input type="number" className="form-control" value={contestForm.max_entries_per_day} onChange={e => setContestForm({ ...contestForm, max_entries_per_day: parseInt(e.target.value || 3) })} required />
                      </div>
                    )}
                  </div>

                  <div className="row">
                    <div className="col-6 form-group mb-3">
                      <label className="text-muted text-xs font-weight-bold mb-1">Event Commences (Start)</label>
                      <input type="datetime-local" className="form-control" value={contestForm.start_time} onChange={e => setContestForm({ ...contestForm, start_time: e.target.value })} required />
                    </div>
                    <div className="col-6 form-group mb-3">
                      <label className="text-muted text-xs font-weight-bold mb-1">Event Concludes (End)</label>
                      <input type="datetime-local" className="form-control" value={contestForm.end_time} onChange={e => setContestForm({ ...contestForm, end_time: e.target.value })} required />
                    </div>
                  </div>

                  {activeView === 'edit' && (
                    <div className="form-group mb-3">
                      <label className="text-muted text-xs font-weight-bold mb-1">Draw Status Mode</label>
                      <select className="form-control" value={contestForm.status} onChange={e => setContestForm({ ...contestForm, status: e.target.value })}>
                        <option value="ACTIVE">Active (Running / Accepting entries)</option>
                        <option value="COMPLETED">Completed (Drawn / Concluded)</option>
                        <option value="CANCELLED">Cancelled (Suspended / Deactivated)</option>
                      </select>
                    </div>
                  )}

                  {/* ENTRY METHODS CONFIGURATION SECTION */}
                  {contestForm.type === 'LUCKY_DRAW' ? (
                    <div className="mt-4 border-top pt-3">
                      <h5 className="font-weight-bold text-dark text-sm mb-3">Entry Methods Configuration</h5>
                      
                      <div className="row mb-2">
                        <div className="col-6 d-flex align-items-center mb-3">
                          <div className="custom-control custom-checkbox d-flex align-items-center">
                            <input type="checkbox" className="custom-control-input" id="allow_free_entry" checked={contestForm.allow_free_entry} onChange={e => setContestForm({ ...contestForm, allow_free_entry: e.target.checked })} />
                            <label className="custom-control-label text-muted text-xs font-weight-bold ml-2 cursor-pointer mb-0" htmlFor="allow_free_entry">Allow Daily Free Ticket Entry</label>
                          </div>
                        </div>
                        <div className="col-6 d-flex align-items-center mb-3">
                          <div className="custom-control custom-checkbox d-flex align-items-center">
                            <input type="checkbox" className="custom-control-input" id="allow_ad_entry" checked={contestForm.allow_ad_entry} onChange={e => setContestForm({ ...contestForm, allow_ad_entry: e.target.checked })} />
                            <label className="custom-control-label text-muted text-xs font-weight-bold ml-2 cursor-pointer mb-0" htmlFor="allow_ad_entry">Enable Ad Ticket Entries</label>
                          </div>
                        </div>
                      </div>

                      <div className="row">
                        {contestForm.allow_ad_entry && (
                          <div className="col-6 form-group mb-3">
                            <label className="text-muted text-xs font-weight-bold mb-1">Maximum Ad Tickets Allowed Per Day</label>
                            <input type="number" className="form-control" value={contestForm.max_ad_entries_per_day} onChange={e => setContestForm({ ...contestForm, max_ad_entries_per_day: parseInt(e.target.value || 3) })} />
                          </div>
                        )}
                        
                        <div className="col-6 d-flex flex-column mb-3">
                          <div className="custom-control custom-checkbox d-flex align-items-center mt-2">
                            <input type="checkbox" className="custom-control-input" id="allow_coins_entry" checked={contestForm.allow_coins_entry} onChange={e => setContestForm({ ...contestForm, allow_coins_entry: e.target.checked })} />
                            <label className="custom-control-label text-muted text-xs font-weight-bold ml-2 cursor-pointer mb-0" htmlFor="allow_coins_entry">Enable Coins Purchased Tickets</label>
                          </div>
                          {contestForm.allow_coins_entry && (
                            <div className="mt-2">
                              <label className="text-muted text-xs font-weight-bold mb-1">Ticket Cost in Coins</label>
                              <input type="number" className="form-control form-control-sm" placeholder="e.g. 50" value={contestForm.ticket_coins_cost} onChange={e => setContestForm({ ...contestForm, ticket_coins_cost: parseFloat(e.target.value || 0) })} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 border-top pt-3">
                      <div className="alert alert-info rounded-lg border-0 shadow-sm d-flex align-items-start gap-3 p-3 bg-light">
                        <div className="p-2 rounded-circle bg-white shadow-sm d-flex align-items-center justify-content-center text-primary" style={{ minWidth: '36px', height: '36px' }}>
                          {contestForm.type === 'REFERRAL_CONTEST' ? (
                            <Users className="text-primary" size={20} />
                          ) : (
                            <Coins className="text-success" size={20} />
                          )}
                        </div>
                        <div>
                          <h6 className="font-weight-bold text-dark text-sm mb-1">
                            {contestForm.type === 'REFERRAL_CONTEST' ? '👥 Referral Leaderboard System' : '⚔️ Earnings Battle System'}
                          </h6>
                          <p className="text-muted text-xs mb-0" style={{ lineHeight: '1.5' }}>
                            {contestForm.type === 'REFERRAL_CONTEST' 
                              ? 'This contest works as a pure leaderboard. Users register once ("Join Contest"). The system automatically tracks and ranks users by the number of successful referrals made strictly after their join time.'
                              : 'This contest works as a performance competition. Users register once ("Join Contest"). The system automatically tracks and ranks users by the amount of coins earned from verified tasks/offers completed strictly after their join time.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <button type="submit" className="btn btn-primary btn-block py-3 font-weight-bold rounded-lg mt-4 shadow-sm">
                    {activeView === 'create' ? "PUBLISH CONTEST" : "SAVE CONTEST UPDATES"}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Reward Tiering Card */}
            <div className="col-lg-5">
              <div className="card card-white shadow-none border rounded-lg">
                <div className="card-header border-bottom-0 bg-transparent d-flex justify-content-between align-items-center">
                  <h3 className="card-title font-weight-bold text-dark mb-0">Reward Allocation Tiers</h3>
                  <button type="button" className="btn btn-xs btn-outline-primary rounded-pill px-3" onClick={addRewardRow}>＋ Add Tier</button>
                </div>
                <div className="card-body">
                  <div style={{ maxHeight: '420px', overflowY: 'auto' }} className="pr-1">
                    {contestForm.rewards.map((row, idx) => (
                      <div key={idx} className="p-3 border rounded-lg mb-3 bg-light position-relative">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="badge badge-indigo text-xs font-weight-black">Rank Position #{row.reward_position}</span>
                          {contestForm.rewards.length > 1 && (
                            <button type="button" className="close text-danger" onClick={() => removeRewardRow(idx)}>&times;</button>
                          )}
                        </div>
                        <div className="row">
                          <div className="col-6 form-group mb-0">
                            <label className="text-muted text-xs font-weight-bold mb-1">Reward Type</label>
                            <select className="form-control form-control-sm" value={row.reward_type} onChange={e => handleRewardRowChange(idx, 'reward_type', e.target.value)}>
                              <option value="COINS">🪙 Wallet Coins</option>
                              <option value="CASH">₹ UPI Cash Payout</option>
                              <option value="GIFTCARD">🎁 Voucher Code</option>
                            </select>
                          </div>
                          <div className="col-6 form-group mb-0">
                            <label className="text-muted text-xs font-weight-bold mb-1">Value Amount</label>
                            <input type="number" className="form-control form-control-sm" value={row.reward_value} onChange={e => handleRewardRowChange(idx, 'reward_value', parseFloat(e.target.value || 0))} required />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <span className="text-xs text-muted display-block mt-2">
                    Rankings will be drawn in descending order. Coins/Cash will auto-disburse, Voucher Codes will require admin approval.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* VIEW C: ENTRIES LIST */}
      {activeView === 'entries' && (
        <div className="card card-white shadow-none border rounded-lg">
          <div className="card-header border-0 bg-transparent d-flex justify-content-between align-items-center">
            <div>
              <h3 className="card-title font-weight-bold text-dark mb-0">Entries Audit: {selectedContest.title}</h3>
              <p className="text-xs text-muted mb-0">Raffle chances scale directly based on total ticket entries.</p>
            </div>
            <button className="btn btn-xs btn-outline-secondary rounded-pill px-3" onClick={() => handleViewEntries(selectedContest)}><RefreshCw size={12} className="mr-1" /> Refresh</button>
          </div>
          <div className="card-body p-0 table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="bg-light">
                <tr className="text-xs text-muted uppercase">
                  <th className="pl-4">Participant Details</th>
                  <th>Entry Method</th>
                  <th className="text-center">Tickets Earned</th>
                  <th className="text-center">Raffle Probability Weight</th>
                  <th>Submitted Date</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(e => {
                  const totalTickets = entries.reduce((sum, item) => sum + parseInt(item.entries_count || 0), 0);
                  const probability = totalTickets > 0 ? ((parseInt(e.entries_count) / totalTickets) * 100).toFixed(1) : 0;
                  
                  return (
                    <tr key={e.id} className="text-sm">
                      <td className="pl-4">
                        <div className="font-weight-bold text-dark">{e.user_name || 'Anonymous'}</div>
                        <div className="text-xs text-muted">ID: {e.user_public_id} | Email: {e.user_email}</div>
                      </td>
                      <td>
                        <span className="badge badge-light border px-2 py-1">{e.entry_source}</span>
                      </td>
                      <td className="text-center font-weight-bold text-success">
                        {e.entries_count} Tickets
                      </td>
                      <td className="text-center">
                        <strong className="text-primary">{probability}% Chance</strong>
                      </td>
                      <td className="text-xs text-muted">
                        {new Date(e.created_at).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-muted p-5">No tickets have been entered into this giveaway battle yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW D: WINNERS LOG & DISPATCHES */}
      {activeView === 'winners' && (
        <div className="card card-white shadow-none border rounded-lg">
          <div className="card-header border-0 bg-transparent">
            <h3 className="card-title font-weight-bold text-dark mb-0">Contest Winners & Dispatches: {selectedContest.title}</h3>
            <p className="text-xs text-muted mb-0">Manage pending vouchers and monitor ledger auto-disbursements.</p>
          </div>
          <div className="card-body p-0 table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="bg-light">
                <tr className="text-xs text-muted uppercase">
                  <th className="pl-4">Reward Rank</th>
                  <th>Winner Details</th>
                  <th>Type</th>
                  <th>Value</th>
                  <th className="text-center">Delivery Status</th>
                  <th className="text-right pr-4">Action Dispatch</th>
                </tr>
              </thead>
              <tbody>
                {winners.map(w => (
                  <tr key={w.id} className="text-sm">
                    <td className="pl-4 font-weight-bold">
                      <span className="badge badge-indigo px-3 py-2 text-xs">Rank Position #{w.reward_position}</span>
                    </td>
                    <td>
                      <div className="font-weight-bold text-dark">{w.user_name}</div>
                      <div className="text-xs text-muted">Public ID: {w.user_public_id} | {w.user_email}</div>
                    </td>
                    <td>
                      <span className={`badge badge-${w.reward_type === 'COINS' ? 'success' : w.reward_type === 'CASH' ? 'warning' : 'info'} px-2 py-1`}>
                        {w.reward_type}
                      </span>
                    </td>
                    <td className="font-weight-black text-dark">
                      {w.reward_type === 'COINS' ? `${parseFloat(w.reward_value).toFixed(0)} Coins` : `₹${parseFloat(w.reward_value).toFixed(2)}`}
                    </td>
                    <td className="text-center">
                      <span className={`badge badge-${w.reward_given ? 'success' : 'danger'} px-3 py-1 font-weight-bold`}>
                        {w.reward_given ? 'Delivered' : 'Pending Review'}
                      </span>
                    </td>
                    <td className="text-right pr-4">
                      {w.reward_given ? (
                        <span className="text-xs text-success font-weight-bold"><CheckCircle size={12} className="mr-1" /> Dispatched</span>
                      ) : (
                        <div className="d-flex align-items-center justify-content-end gap-2" style={{ maxWidth: '320px', marginLeft: 'auto' }}>
                          <input 
                            type="text" 
                            className="form-control form-control-sm" 
                            placeholder="Paste Google Play/Amazon Voucher Code" 
                            value={giftcardCodes[w.id] || ''}
                            onChange={(e) => setGiftcardCodes({ ...giftcardCodes, [w.id]: e.target.value })}
                          />
                          <button className="btn btn-success btn-xs font-weight-bold px-3 py-2 rounded-pill" onClick={() => handleDeliverGiftcard(w.id)}>Dispatch</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {winners.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted p-5">Winners list is currently empty. Run Draw Matrix first.</td>
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
