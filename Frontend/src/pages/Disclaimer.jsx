import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';

export default function Disclaimer() {
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
            }}>S</div>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>
              Rewardverse<span style={{ color: 'var(--primary)' }}>India</span>
            </span>
          </Link>
          <Link to="/" className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
            <ArrowLeft size={16} /> Back to Home
          </Link>
        </div>
      </header>

      {/* Content */}
      <main style={{ flex: 1, padding: '60px 0 100px' }}>
        <div className="container" style={{ maxWidth: '850px' }}>
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
                <AlertCircle size={24} />
              </div>
              <div>
                <h1 style={{ fontSize: '1.8rem', margin: 0 }}>Disclaimer</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>Effective date: November 1, 2025</p>
              </div>
            </div>

            <div style={{ color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.75, display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              <section>
                <p style={{ color: 'var(--text-secondary)' }}>
                  The information provided by <strong>Rewardverse</strong> ("we", "us", or "our") on the Rewardverse mobile application (the "Service") is for general informational purposes only. All content, features, tools, and services provided through the Service are provided "as is" and "as available" without warranties of any kind—either express or implied.
                </p>
              </section>

              <section>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#fff' }}>No Professional or Financial Advice</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Nothing on the Service constitutes professional, financial, legal, tax, or investment advice. You should not rely on any information on the Service as a substitute for professional advice tailored to your situation. If you need such advice, consult a qualified professional.
                </p>
              </section>

              <section>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#fff' }}>No Guarantee of Earnings</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Any references to earnings, rewards, points, or potential income available through the Service are estimates or illustrations only. We do not guarantee that you will earn any specific amount. Your results may vary based on factors outside of our control, including but not limited to availability of offers, user eligibility, geographic location, device compatibility, and actions taken by advertisers or partners.
                </p>
              </section>

              <section>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#fff' }}>Third-Party Content, Links & Ads</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                  The Service may display content, ads, or provide links to third-party websites, offerwalls, or services. We do not control and are not responsible for the content, accuracy, or practices of these third parties. Inclusion of any third-party material does not imply our endorsement. You access third-party content and follow links at your own risk.
                </p>
              </section>

              <section>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#fff' }}>Advertising & Affiliate Relationships</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                  The app is ad-supported and may participate in affiliate or referral programs. We may receive compensation, referrals, or commissions for actions you take through the Service. This compensation does not change the price you pay for any third-party product or service. We aim to disclose material relationships when required, but you should assume that some links, offers, or ads may be monetized.
                </p>
              </section>

              <section>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#fff' }}>Accuracy of Information</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                  We strive to provide accurate and up-to-date information, but we do not warrant that the content on the Service is complete, reliable, or current. We reserve the right to modify, update, or remove any content at any time without notice.
                </p>
              </section>

              <section>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#fff' }}>Limitation of Liability</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                  To the fullest extent permitted by applicable law, Rewardverse and its affiliates, officers, employees, agents, partners, and licensors shall not be liable for any indirect, incidental, consequential, special, punitive, or exemplary damages arising from or related to your use of the Service, including but not limited to loss of profits, data, or goodwill.
                </p>
              </section>

              <section>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#fff' }}>Indemnification</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                  You agree to indemnify and hold harmless Rewardverse and its representatives from any claims, liabilities, damages, losses, or expenses (including reasonable attorneys’ fees) arising out of or related to your use of the Service or breach of these terms.
                </p>
              </section>

              <section>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#fff' }}>Changes to This Disclaimer</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                  We may update this Disclaimer from time to time. When we do, we will post the revised version on the Service with an updated effective date. Your continued use of the Service after any revision indicates your acceptance of the updated Disclaimer.
                </p>
              </section>

              <section>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#fff' }}>Contact Us</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 0 }}>
                  If you have questions about this Disclaimer, please contact us at:<br />
                  Email: <a href="mailto:support@satyainfotechnetworks.com" style={{ color: 'var(--primary-hover)', textDecoration: 'underline' }}>support@satyainfotechnetworks.com</a>
                </p>
              </section>

            </div>
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
