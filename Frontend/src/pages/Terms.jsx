import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Scale } from 'lucide-react';

export default function Terms() {
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
      <main style={{ flex: 1, padding: '60px 0 100px' }}>
        <div className="container" style={{ maxWidth: '850px' }}>
          <div className="glass-panel" style={{ padding: '40px 30px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
              <div style={{ 
                background: 'rgba(99, 102, 241, 0.1)', 
                color: 'var(--primary)', 
                width: '50px', 
                height: '50px', 
                borderRadius: '12px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center'
              }}>
                <Scale size={24} />
              </div>
              <div>
                <h1 style={{ fontSize: '1.8rem', margin: 0 }}>Terms & Conditions</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>Effective date: November 1, 2025</p>
              </div>
            </div>

            <div style={{ color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.75, display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              <section>
                <p style={{ color: 'var(--text-secondary)' }}>
                  By downloading or using the Rewardverse app, these terms will automatically apply to you. Please read them carefully before using the app. You are not permitted to copy or modify the app, any part of the app, or our trademarks in any way. You may not attempt to extract the source code of the app, translate it, or create derivative versions. The app and all associated intellectual property rights belong to <strong>Rewardverse</strong>.
                </p>
                <p style={{ color: 'var(--text-secondary)', marginTop: '12px' }}>
                  Rewardverse is committed to making the app as useful and efficient as possible. We reserve the right to modify the app or charge for certain features or services at any time. We will never charge for the app or its core services without clearly explaining the cost to you beforehand.
                </p>
                <p style={{ color: 'var(--text-secondary)', marginTop: '12px' }}>
                  The Rewardverse app stores and processes personal data that you provide to us for the purpose of delivering the Service. You are responsible for keeping your device secure. We strongly advise against rooting or jailbreaking your device, as this removes essential security protections and may cause the Rewardverse app to malfunction or stop working entirely.
                </p>
              </section>

              <section>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#fff' }}>Account Suspension & Fraud Policy</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  To ensure fair usage, we strictly prohibit fraudulent activities. Your account may be suspended or permanently banned without notice for:
                </p>
                <ul style={{ color: 'var(--text-secondary)', paddingLeft: '22px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <li>Using multiple accounts on a single device.</li>
                  <li>Using VPNs, proxies, or emulators to complete offers.</li>
                  <li>Creating fake referrals or using automated scripts.</li>
                  <li>Submitting fake proofs for tasks (e.g., uploading unrelated screenshots).</li>
                </ul>
                <p style={{ color: 'var(--text-secondary)', marginTop: '12px' }}>
                  We reserve the right to forfeit any earnings obtained through such fraudulent methods.
                </p>
              </section>

              <section>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#fff' }}>Third-Party Services</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  The app uses third-party services that have their own Terms & Conditions. These include, but are not limited to:
                </p>
                <ul style={{ color: 'var(--text-secondary)', paddingLeft: '22px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <li><a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-hover)', textDecoration: 'underline' }}>Google Play Services</a></li>
                  <li><a href="https://firebase.google.com/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-hover)', textDecoration: 'underline' }}>Google Analytics for Firebase</a></li>
                  <li><a href="https://firebase.google.com/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-hover)', textDecoration: 'underline' }}>Firebase Crashlytics</a></li>
                  <li><a href="https://firebase.google.com/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-hover)', textDecoration: 'underline' }}>Firebase Authentication</a></li>
                  <li>Advertising partners such as:
                    <ul style={{ paddingLeft: '18px', marginTop: '6px' }}>
                      <li><a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-hover)', textDecoration: 'underline' }}>Google AdMob</a></li>
                    </ul>
                  </li>
                </ul>
              </section>

              <section>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#fff' }}>Internet Usage & Data Charges</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Certain features require an active internet connection. Rewardverse is not responsible if the app does not function fully due to lack of internet access or insufficient mobile data. If you use the app outside a Wi-Fi zone, you may incur charges from your mobile network provider. By using the app, you accept responsibility for such charges, including roaming data charges.
                </p>
                <p style={{ color: 'var(--text-secondary)', marginTop: '12px' }}>
                  If you are not the bill payer for your device, you confirm that you have obtained permission from the bill payer before using the app.
                </p>
              </section>

              <section>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#fff' }}>Device Responsibilities</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Rewardverse is not responsible for issues arising from your device, such as:
                </p>
                <ul style={{ color: 'var(--text-secondary)', paddingLeft: '22px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <li>Battery depletion preventing the app from running</li>
                  <li>Outdated software or unsupported Android versions</li>
                  <li>Device hardware malfunctions</li>
                  <li>Rooted or modified devices</li>
                </ul>
              </section>

              <section>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#fff' }}>Accuracy & Liability</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                  We aim to keep the app accurate and updated, but we rely on third-party services and data providers. Rewardverse is not liable for any direct or indirect loss caused by relying solely on the app’s features, earnings information, or external offerwalls.
                </p>
              </section>

              <section>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#fff' }}>App Updates & Termination</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  We may update the app periodically. System requirements may change, and you may need to install updates to continue using the app. Rewardverse does not guarantee compatibility with all Android versions.
                </p>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  We may discontinue the app at any time without notice. Upon termination:
                </p>
                <ul style={{ color: 'var(--text-secondary)', paddingLeft: '22px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <li>Your rights to use the app end</li>
                  <li>You must stop using the app</li>
                  <li>You may be required to uninstall the app</li>
                </ul>
              </section>

              <section>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#fff' }}>Changes to These Terms & Conditions</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                  We may update these Terms & Conditions from time to time. You are encouraged to review this page periodically. We will notify users by posting updated terms on this page.
                </p>
              </section>

              <section>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#fff' }}>Contact Us</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 0 }}>
                  If you have any questions or suggestions regarding these Terms & Conditions, please contact us at:<br />
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
