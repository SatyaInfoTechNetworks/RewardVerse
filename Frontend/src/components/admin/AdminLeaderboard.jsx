import React from 'react';

export default function AdminLeaderboard({ apiBase, getHeaders, showNotice }) {
  return (
    <div className="container-fluid py-3">
      {/* EXECUTIVE HEADER CARD */}
      <div className="card border-0 shadow-sm rounded-lg bg-white mb-4">
        <div className="card-body p-4">
          <div className="d-flex align-items-center justify-content-between flex-wrap">
            <div className="d-flex align-items-center mb-2 mb-md-0">
              <div className="bg-primary text-white rounded-circle p-3 mr-3 shadow-sm">
                <i className="fas fa-trophy fa-2x"></i>
              </div>
              <div>
                <h3 className="font-weight-bold mb-1 text-dark">Leaderboard Admin Control</h3>
                <p className="text-muted text-sm mb-0">
                  Manage leaderboard contests, prize pools, dynamic tiers & moderation.
                </p>
              </div>
            </div>

            <button
              onClick={() => showNotice && showNotice('info', 'Leaderboard synced.')}
              className="btn btn-outline-primary font-weight-bold btn-sm shadow-sm"
            >
              <i className="fas fa-sync-alt mr-1"></i> Sync Realtime
            </button>
          </div>
        </div>
      </div>

      {/* STARTER CARD */}
      <div className="card border-0 shadow-sm rounded-lg text-center p-5 bg-white">
        <div className="my-4">
          <div className="bg-light text-primary rounded-circle d-inline-flex p-4 mb-3 shadow-sm">
            <i className="fas fa-layer-group fa-3x"></i>
          </div>
          <h4 className="font-weight-bold text-dark mb-2">Leaderboard Module Cleared</h4>
          <p className="text-muted mx-auto" style={{ maxWidth: '500px' }}>
            The previous leaderboard implementation has been cleared out. You can now build your new custom leaderboard system from scratch!
          </p>
        </div>
      </div>
    </div>
  );
}
