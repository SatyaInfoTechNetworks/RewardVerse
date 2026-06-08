import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  CheckCircle, 
  Wallet, 
  Layout, 
  Users, 
  Gift, 
  ArrowRight, 
  ChevronDown, 
  ChevronUp,
  ShieldCheck, 
  Coins, 
  Clock 
} from 'lucide-react';

export default function Landing() {
  const [activeFaq, setActiveFaq] = useState(null);

  const toggleFaq = (index) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const faqs = [
    {
      q: "How do I earn rewards?",
      a: "You earn rewards by exploring the app and completing tasks. Each task has specific instructions (e.g. following steps, liking social media, or uploading proof) that must be followed for successful completion."
    },
    {
      q: "Are rewards guaranteed?",
      a: "Rewards are earned only upon successful completion and verification of tasks. We do not promise fixed income or guaranteed earnings. Every submission undergoes human verification to maintain fairness."
    },
    {
      q: "When can I withdraw?",
      a: "You can request a withdrawal once you reach the minimum eligibility threshold and your completed tasks are fully verified by our team. Withdrawal options include UPI or Giftcards."
    },
    {
      q: "Why was my task rejected?",
      a: "Tasks are rejected if the instructions weren't followed correctly, the proof submitted was invalid, or if any duplicate/fraudulent activity was detected."
    }
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header / Nav */}
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
            }}>S</div>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>
              Rewardverse<span style={{ color: 'var(--primary)' }}>India</span>
            </span>
          </Link>
          <nav style={{ display: 'flex', gap: '30px' }} className="nav-menu">
            <a href="#how-it-works" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500, fontSize: '0.95rem' }}>How it Works</a>
            <a href="#ways-to-earn" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500, fontSize: '0.95rem' }}>Ways to Earn</a>
            <a href="#faq" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500, fontSize: '0.95rem' }}>FAQ</a>
          </nav>
          <div>
            <a href="https://play.google.com/store/apps/details?id=com.satyainfotechnetworks.rewardverse" target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              Download App
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, paddingBottom: '80px' }}>
        
        {/* Hero Section */}
        <section style={{ padding: '100px 0 60px', position: 'relative', textAlign: 'center' }}>
          <div className="container" style={{ maxWidth: '800px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(168, 85, 247, 0.1)',
              border: '1px solid rgba(168, 85, 247, 0.2)',
              borderRadius: '99px',
              padding: '6px 16px',
              marginBottom: '24px',
              color: 'var(--primary-hover)',
              fontWeight: 600,
              fontSize: '0.85rem'
            }}>
              <Coins size={14} /> Reimagined Student Rewards Platform
            </div>
            
            <h1 style={{ 
              fontSize: '3.5rem', 
              lineHeight: 1.1, 
              marginBottom: '24px',
              background: 'linear-gradient(to right, #ffffff, #d8b4fe)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Earn rewards by completing <span style={{ color: 'var(--primary)' }}>simple tasks</span>
            </h1>
            
            <p style={{ 
              color: 'var(--text-secondary)', 
              fontSize: '1.15rem', 
              lineHeight: 1.6, 
              marginBottom: '32px' 
            }}>
              Join Rewardverse to explore daily bonuses, like social posts, complete mini tasks, and earn real coins. Fully transparent verification, instant wallet tracking, and secure withdrawals tailored for Indian students.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
              <a href="https://play.google.com/store/apps/details?id=com.satyainfotechnetworks.rewardverse" target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ padding: '14px 28px', fontSize: '1.05rem' }}>
                Get Started Now <ArrowRight size={18} />
              </a>
              <a href="https://play.google.com/store/apps/details?id=com.satyainfotechnetworks.rewardverse" target="_blank" rel="noopener noreferrer">
                <img 
                  src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" 
                  alt="Get it on Google Play" 
                  style={{ height: '52px', transition: 'transform 0.2s' }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.03)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                />
              </a>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '24px' }}>
              * Rewards are subject to task verification and manual eligibility checks.
            </p>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" style={{ padding: '80px 0' }}>
          <div className="container">
            <div style={{ textAlign: 'center', marginBottom: '50px' }}>
              <h2 style={{ fontSize: '2.2rem', marginBottom: '12px' }}>
                How It <span style={{ color: 'var(--primary)' }}>Works</span>
              </h2>
              <p style={{ color: 'var(--text-secondary)' }}>Start your rewarding journey in three transparent steps.</p>
            </div>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
              gap: '30px' 
            }}>
              <div className="glass-panel glass-panel-interactive" style={{ padding: '40px 30px', textAlign: 'center' }}>
                <div style={{ 
                  background: 'rgba(168, 85, 247, 0.1)', 
                  color: 'var(--primary)', 
                  width: '60px', 
                  height: '60px', 
                  borderRadius: '16px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 24px'
                }}>
                  <Search size={28} />
                </div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '12px' }}>1. Explore Offers</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                  Explore dynamic offers, complete tier milestones, or simple tasks like likes and daily check-ins.
                </p>
              </div>

              <div className="glass-panel glass-panel-interactive" style={{ padding: '40px 30px', textAlign: 'center' }}>
                <div style={{ 
                  background: 'rgba(99, 102, 241, 0.1)', 
                  color: 'var(--secondary)', 
                  width: '60px', 
                  height: '60px', 
                  borderRadius: '16px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 24px'
                }}>
                  <CheckCircle size={28} />
                </div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '12px' }}>2. Verification</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                  Submit required screenshots or details inside the app. Our administrators manually review each task.
                </p>
              </div>

              <div className="glass-panel glass-panel-interactive" style={{ padding: '40px 30px', textAlign: 'center' }}>
                <div style={{ 
                  background: 'rgba(20, 184, 166, 0.1)', 
                  color: 'var(--accent)', 
                  width: '60px', 
                  height: '60px', 
                  borderRadius: '16px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 24px'
                }}>
                  <Wallet size={28} />
                </div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '12px' }}>3. Instant Payout</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                  Upon successful task approval, coins are immediately added to your ledger. Redeem them to UPI instantly.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Ways To Earn */}
        <section id="ways-to-earn" style={{ padding: '80px 0', background: 'rgba(255, 255, 255, 0.01)', borderTop: '1px solid rgba(255, 255, 255, 0.02)', borderBottom: '1px solid rgba(255, 255, 255, 0.02)' }}>
          <div className="container">
            <div style={{ textAlign: 'center', marginBottom: '50px' }}>
              <h2 style={{ fontSize: '2.2rem', marginBottom: '12px' }}>
                Ways to <span style={{ color: 'var(--primary)' }}>Earn</span>
              </h2>
              <p style={{ color: 'var(--text-secondary)' }}>Multiple opportunities to stack rewards through active participation.</p>
            </div>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
              gap: '30px' 
            }}>
              <div className="glass-panel" style={{ padding: '30px' }}>
                <div style={{ color: 'var(--primary)', marginBottom: '16px' }}><Layout size={32} /></div>
                <h4 style={{ fontSize: '1.2rem', marginBottom: '10px' }}>Task Completion</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Interact with diverse brands, complete step-by-step tier-based offers (e.g. signup, trial, play) to earn compounding rewards.
                </p>
              </div>

              <div className="glass-panel" style={{ padding: '30px' }}>
                <div style={{ color: 'var(--secondary)', marginBottom: '16px' }}><Users size={32} /></div>
                <h4 style={{ fontSize: '1.2rem', marginBottom: '10px' }}>Referral Commissions</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Earn a 10% commission on all coin tasks completed by referred friends, plus a milestone bonus when they reach task targets!
                </p>
              </div>

              <div className="glass-panel" style={{ padding: '30px' }}>
                <div style={{ color: 'var(--accent)', marginBottom: '16px' }}><Gift size={32} /></div>
                <h4 style={{ fontSize: '1.2rem', marginBottom: '10px' }}>Daily Rewards & Lifafa</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Claim your daily check-in streak reward instantly or participate in limited-time custom Lifafas launched by admins.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Transparency Feature Box */}
        <section style={{ padding: '80px 0' }}>
          <div className="container">
            <div className="glass-panel" style={{ 
              padding: '50px 40px',
              background: 'linear-gradient(135deg, rgba(18,20,29,0.85) 0%, rgba(99,102,241,0.05) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
                gap: '40px',
                alignItems: 'center'
              }}>
                <div>
                  <h2 style={{ fontSize: '2rem', marginBottom: '16px', lineHeight: 1.2 }}>
                    Transparent & Secure <span style={{ color: 'var(--primary)' }}>Withdrawals</span>
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '1rem' }}>
                    We believe in full integrity. All withdrawals are debited directly from your balance to represent pending funds. In case of rejection, the funds are safely credited back to your balance with comprehensive logs.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)' }}>
                      <ShieldCheck size={18} style={{ color: 'var(--accent)' }} />
                      <span>No deposit required - completely free earning</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)' }}>
                      <ShieldCheck size={18} style={{ color: 'var(--accent)' }} />
                      <span>Secure and anonymized data privacy standards</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)' }}>
                      <ShieldCheck size={18} style={{ color: 'var(--accent)' }} />
                      <span>Manual human audits to prevent bot spam and verify accuracy</span>
                    </div>
                  </div>
                </div>
                
                <div style={{ 
                  background: 'rgba(255,255,255,0.02)', 
                  border: '1px solid rgba(255,255,255,0.05)', 
                  borderRadius: '16px',
                  padding: '30px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px'
                }}>
                  <h4 style={{ fontSize: '1.1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
                    Real-time Ledger Security
                  </h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ padding: '8px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: '8px' }}>
                        <Wallet size={16} />
                      </div>
                      <div>
                        <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Withdrawal Requested</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>UPI Transfer Request</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--danger)' }}>- 500 Coins</p>
                      <span className="badge badge-pending">Pending</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ padding: '8px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: '8px' }}>
                        <Coins size={16} />
                      </div>
                      <div>
                        <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Daily Check-In Reward</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Continuous Streak</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--success)' }}>+ 50 Coins</p>
                      <span className="badge badge-completed">Credit</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section id="faq" style={{ padding: '80px 0' }}>
          <div className="container" style={{ maxWidth: '800px' }}>
            <div style={{ textAlign: 'center', marginBottom: '50px' }}>
              <h2 style={{ fontSize: '2.2rem' }}>Got <span style={{ color: 'var(--primary)' }}>Questions?</span></h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>Got queries about payouts, limits, and rules? We've got answers.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {faqs.map((faq, index) => {
                const isOpen = activeFaq === index;
                return (
                  <div 
                    key={index} 
                    className="glass-panel" 
                    style={{ 
                      padding: '20px 24px', 
                      cursor: 'pointer',
                      border: isOpen ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid var(--border-glass)',
                      background: isOpen ? 'rgba(18, 20, 29, 0.8)' : 'var(--bg-surface)'
                    }}
                    onClick={() => toggleFaq(index)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 600 }}>{faq.q}</h4>
                      {isOpen ? <ChevronUp size={18} style={{ color: 'var(--primary)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
                    </div>
                    {isOpen && (
                      <p style={{ 
                        color: 'var(--text-secondary)', 
                        fontSize: '0.925rem', 
                        marginTop: '12px', 
                        lineHeight: 1.5,
                        borderTop: '1px solid rgba(255,255,255,0.05)',
                        paddingTop: '12px'
                      }}>
                        {faq.a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Final Call to Action */}
        <section style={{ padding: '60px 0' }}>
          <div className="container">
            <div className="glass-panel" style={{ 
              padding: '60px 30px', 
              textAlign: 'center',
              background: 'linear-gradient(135deg, var(--bg-surface) 0%, rgba(168, 85, 247, 0.05) 100%)',
            }}>
              <h2 style={{ fontSize: '2.2rem', marginBottom: '16px' }}>Ready to Earn?</h2>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 32px', fontSize: '1.05rem' }}>
                Download our lightweight Android app today to access thousands of coins and highly lucrative task payouts.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <a href="https://play.google.com/store/apps/details?id=com.satyainfotechnetworks.rewardverse" target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ padding: '12px 28px' }}>
                  Get the Android App
                </a>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer style={{ 
        background: '#07080c', 
        borderTop: '1px solid var(--border-glass)', 
        padding: '60px 0 30px',
        color: 'var(--text-secondary)'
      }}>
        <div className="container">
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '40px',
            marginBottom: '40px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{ 
                  background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                  width: '30px',
                  height: '30px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  color: '#fff',
                  fontSize: '1rem'
                }}>S</div>
                <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>
                  Rewardverse<span style={{ color: 'var(--primary)' }}>India</span>
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                The leading rewards system designed exclusively for Indian students. Complete simple milestones and receive verified payouts instantly.
              </p>
            </div>
            
            <div>
              <h4 style={{ color: '#fff', fontSize: '1rem', marginBottom: '16px' }}>Navigation</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem' }}>
                <a href="#how-it-works" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>How it works</a>
                <a href="#ways-to-earn" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Ways to earn</a>
                <a href="#faq" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>FAQ</a>
              </div>
            </div>

            <div>
              <h4 style={{ color: '#fff', fontSize: '1rem', marginBottom: '16px' }}>Legal / Policy</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem' }}>
                <Link to="/privacy" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Privacy Policy</Link>
                <Link to="/terms" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Terms & Conditions</Link>
                <Link to="/delete-account" style={{ color: 'var(--danger)', textDecoration: 'none' }}>Delete Account</Link>
              </div>
            </div>

            <div>
              <h4 style={{ color: '#fff', fontSize: '1rem', marginBottom: '16px' }}>Community</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem' }}>
                <a href="https://t.me/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Telegram Channel</a>
                <a href="https://instagram.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Instagram Feed</a>
              </div>
            </div>
          </div>

          <div style={{ 
            borderTop: '1px solid rgba(255, 255, 255, 0.05)', 
            paddingTop: '20px', 
            textAlign: 'center', 
            fontSize: '0.8rem', 
            color: 'var(--text-muted)' 
          }}>
            &copy; 2026 Rewardverse. Made with ❤️ for Indian Students. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
