import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, Coins, CreditCard, RefreshCw, Layers, DollarSign, Calendar, ArrowUpRight } from 'lucide-react';

export default function AdminReports({ getHeaders, showNotice, API_BASE }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    user_growth: [],
    revenue: [],
    coins_issued: [],
    top_offers: [],
    withdrawal_by_method: []
  });

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/reports`, { headers: getHeaders() });
      const resData = await res.json();
      if (resData.success) {
        setData(resData.reports || {
          user_growth: [],
          revenue: [],
          coins_issued: [],
          top_offers: [],
          withdrawal_by_method: []
        });
      } else {
        showNotice('error', resData.message || 'Failed to load report data');
      }
    } catch (err) {
      console.error(err);
      showNotice('error', 'Connection error while fetching reports.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // Compute aggregated overview metrics for last 30 days
  const totalNewUsers = data.user_growth.reduce((sum, item) => sum + (item.count || 0), 0);
  const totalSettledPayout = data.revenue.reduce((sum, item) => sum + parseFloat(item.total || 0), 0);
  const totalCoinsIssued = data.coins_issued.reduce((sum, item) => sum + parseFloat(item.total || 0), 0);

  // Helper to draw a custom SVG Area Chart
  const renderSVGChart = (chartData, valueKey, labelKey, strokeColor, fillColor, prefix = '') => {
    if (!chartData || chartData.length === 0) {
      return (
        <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          No trend data recorded.
        </div>
      );
    }

    const width = 500;
    const height = 180;
    const paddingLeft = 40;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const values = chartData.map(d => parseFloat(d[valueKey] || 0));
    const maxVal = Math.max(...values, 10);
    const minVal = 0;
    const range = maxVal - minVal;

    // Build coordinates for each point
    const points = chartData.map((d, i) => {
      const x = paddingLeft + (i / (chartData.length - 1)) * chartWidth;
      const val = parseFloat(d[valueKey] || 0);
      const y = paddingTop + chartHeight - ((val - minVal) / range) * chartHeight;
      return { x, y, value: val, label: d[labelKey] };
    });

    // Build SVG path
    let strokePath = '';
    let areaPath = '';

    if (points.length > 0) {
      strokePath = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
      areaPath = `${strokePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;
    }

    // Grid lines (y-axis steps)
    const yGridSteps = [0, 0.25, 0.5, 0.75, 1];

    const formatDateLabel = (dateStr) => {
      try {
        const d = new Date(dateStr);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      } catch (e) {
        return dateStr;
      }
    };

    return (
      <div style={{ position: 'relative', width: '100%' }}>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id={`gradient-${valueKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fillColor} stopOpacity="0.4" />
              <stop offset="100%" stopColor={fillColor} stopOpacity="0.0" />
            </linearGradient>
            <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor={strokeColor} floodOpacity="0.25" />
            </filter>
          </defs>

          {/* Grid lines & Y Axis text */}
          {yGridSteps.map((step, idx) => {
            const yVal = paddingTop + chartHeight * (1 - step);
            const gridVal = minVal + step * range;
            return (
              <g key={idx}>
                <line 
                  x1={paddingLeft} 
                  y1={yVal} 
                  x2={width - paddingRight} 
                  y2={yVal} 
                  stroke="rgba(255,255,255,0.04)" 
                  strokeDasharray="4" 
                />
                <text 
                  x={paddingLeft - 8} 
                  y={yVal + 4} 
                  fill="var(--text-muted)" 
                  fontSize="9px" 
                  textAnchor="end"
                >
                  {prefix}{gridVal >= 1000 ? `${(gridVal / 1000).toFixed(1)}k` : gridVal.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* Area under the line */}
          {areaPath && (
            <path d={areaPath} fill={`url(#gradient-${valueKey})`} />
          )}

          {/* Glowing Stroke Path */}
          {strokePath && (
            <path 
              d={strokePath} 
              fill="none" 
              stroke={strokeColor} 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              filter="url(#shadow)"
            />
          )}

          {/* Axis borders */}
          <line 
            x1={paddingLeft} 
            y1={paddingTop} 
            x2={paddingLeft} 
            y2={paddingTop + chartHeight} 
            stroke="rgba(255,255,255,0.06)" 
          />
          <line 
            x1={paddingLeft} 
            y1={paddingTop + chartHeight} 
            x2={width - paddingRight} 
            y2={paddingTop + chartHeight} 
            stroke="rgba(255,255,255,0.06)" 
          />

          {/* X Axis Labels (Sample every few items) */}
          {points.map((p, idx) => {
            // Render labels for start, middle, and end to avoid clutter
            const isStart = idx === 0;
            const isEnd = idx === points.length - 1;
            const isMid = idx === Math.floor(points.length / 2);
            
            if (isStart || isEnd || isMid) {
              return (
                <text 
                  key={idx}
                  x={p.x} 
                  y={paddingTop + chartHeight + 18} 
                  fill="var(--text-secondary)" 
                  fontSize="9px" 
                  textAnchor={isStart ? 'start' : isEnd ? 'end' : 'middle'}
                >
                  {formatDateLabel(p.label)}
                </text>
              );
            }
            return null;
          })}
        </svg>
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={20} style={{ color: 'var(--primary)' }} /> Financial & Growth Analytics
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Historical performance indicators, user registration growth, coin distributions, and payout settles.
          </p>
        </div>
        
        <button className="btn btn-secondary" style={{ padding: '8px 14px', gap: '6px' }} onClick={fetchReports} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> {loading ? 'Fetching...' : 'Reload Data'}
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '16px' }}>
          <RefreshCw size={32} className="spin" style={{ color: 'var(--primary)' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Compiling dashboard datasets...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          {/* Analytics Overview Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-hover)' }}>
                <Users size={22} />
              </div>
              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>New Registrations (30d)</p>
                <h4 style={{ fontSize: '1.75rem', marginTop: '4px' }}>{totalNewUsers}</h4>
              </div>
              <div style={{ position: 'absolute', right: '16px', top: '16px', color: 'rgba(255,255,255,0.03)' }}>
                <Calendar size={60} />
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--secondary)' }}>
                <Coins size={22} />
              </div>
              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Coins Issued (30d)</p>
                <h4 style={{ fontSize: '1.75rem', marginTop: '4px', color: 'var(--secondary)' }}>{totalCoinsIssued.toFixed(1)}</h4>
              </div>
              <div style={{ position: 'absolute', right: '16px', top: '16px', color: 'rgba(255,255,255,0.03)' }}>
                <Coins size={60} />
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(20, 184, 166, 0.1)', border: '1px solid rgba(20, 184, 166, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                <CreditCard size={22} />
              </div>
              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Cash Settled Payouts (30d)</p>
                <h4 style={{ fontSize: '1.75rem', marginTop: '4px', color: 'var(--accent)' }}>₹{totalSettledPayout.toFixed(2)}</h4>
              </div>
              <div style={{ position: 'absolute', right: '16px', top: '16px', color: 'rgba(255,255,255,0.03)' }}>
                <DollarSign size={60} />
              </div>
            </div>

          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px' }}>
            
            {/* User Growth Chart */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={16} style={{ color: 'var(--primary)' }} /> Daily User Sign-ups
                </h4>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Last 30 Days</span>
              </div>
              {renderSVGChart(data.user_growth, 'count', 'date', 'var(--primary)', 'var(--primary)')}
            </div>

            {/* Coins Issued & Cash Payout Trend */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CreditCard size={16} style={{ color: 'var(--accent)' }} /> Settled Payouts Trend (INR)
                </h4>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Last 30 Days</span>
              </div>
              {renderSVGChart(data.revenue, 'total', 'date', 'var(--accent)', 'var(--accent)', '₹')}
            </div>

          </div>

          {/* Third Row: Top Offers & Payout Breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px', alignItems: 'start' }}>
            
            {/* Top Performing Tasks */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={16} style={{ color: 'var(--secondary)' }} /> High-Performing Tasks
              </h4>
              <div className="table-container">
                <table className="glass-table" style={{ minWidth: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '12px' }}>Offer / Category</th>
                      <th style={{ padding: '12px', textAlign: 'center' }}>Milestones Filled</th>
                      <th style={{ padding: '12px', textAlign: 'right' }}>Total Issued</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_offers.slice(0, 5).map((offer, idx) => {
                      const maxCompletions = data.top_offers[0]?.completions || 1;
                      const percent = ((offer.completions || 0) / maxCompletions) * 100;
                      return (
                        <tr key={idx}>
                          <td style={{ padding: '12px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <strong style={{ fontSize: '0.88rem' }}>{offer.title}</strong>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{offer.category || 'General'}</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{offer.completions}</span>
                              <div style={{ width: '80px', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ width: `${percent}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--secondary))' }} />
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>
                            <strong style={{ color: 'var(--accent)', fontSize: '0.88rem' }}>
                              {parseFloat(offer.coins_paid || 0).toFixed(0)} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>coins</span>
                            </strong>
                          </td>
                        </tr>
                      );
                    })}
                    {data.top_offers.length === 0 && (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                          No offer completion analytics available yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payout Channels Distribution */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={16} style={{ color: 'var(--warning)' }} /> Payout Channel Volumes
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {data.withdrawal_by_method.map((item, idx) => {
                  const maxVal = Math.max(...data.withdrawal_by_method.map(w => parseFloat(w.total || 0)), 1);
                  const val = parseFloat(item.total || 0);
                  const fillPercent = (val / maxVal) * 100;
                  
                  return (
                    <div key={idx} style={{ 
                      background: 'rgba(255,255,255,0.01)', 
                      border: '1px solid rgba(255,255,255,0.04)', 
                      borderRadius: '12px', 
                      padding: '12px 16px' 
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div>
                          <strong style={{ fontSize: '0.88rem', textTransform: 'uppercase' }}>{item.method}</strong>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                            ({item.count} items, {item.status})
                          </span>
                        </div>
                        <strong style={{ fontSize: '0.88rem', color: item.status === 'APPROVED' ? 'var(--success)' : 'var(--warning)' }}>
                          ₹{val.toFixed(2)}
                        </strong>
                      </div>
                      
                      {/* Custom Horizontal Progress Bar */}
                      <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${fillPercent}%`, 
                          height: '100%', 
                          background: item.status === 'APPROVED' 
                            ? 'linear-gradient(90deg, var(--success), #2dd4bf)' 
                            : 'linear-gradient(90deg, var(--warning), #fcd34d)' 
                        }} />
                      </div>
                    </div>
                  );
                })}

                {data.withdrawal_by_method.length === 0 && (
                  <p style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    No payout volume requests compiled yet.
                  </p>
                )}
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}
