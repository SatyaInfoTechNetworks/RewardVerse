import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export default function Privacy() {
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
                background: 'rgba(20, 184, 166, 0.1)', 
                color: 'var(--accent)', 
                width: '50px', 
                height: '50px', 
                borderRadius: '12px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center'
              }}>
                <ShieldCheck size={24} />
              </div>
              <div>
                <h1 style={{ fontSize: '1.8rem', margin: 0 }}>Privacy Policy</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>Effective date: November 1, 2025</p>
              </div>
            </div>

            <div style={{ color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.75, display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              <section>
                <p style={{ color: 'var(--text-secondary)' }}>
                  <strong>Rewardverse</strong> built the Rewardverse app as an ad-supported platform. This SERVICE is provided by Rewardverse at no cost and is intended for use "as is." This page informs visitors about our policies regarding the collection, use, and disclosure of Personal Information for anyone choosing to use our Service.
                </p>
              </section>

              <section>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#fff' }}>Acceptance</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                  By using our Service, you agree to the collection and use of information in accordance with this Privacy Policy. The Personal Information we collect is used to provide and improve the Service. We will not use or share your information except as described in this policy.
                </p>
              </section>

              <section>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#fff' }}>Information Collection and Use</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  For a better experience while using our Service, we may request certain personally identifiable information, including but not limited to:
                </p>
                <ul style={{ color: 'var(--text-secondary)', paddingLeft: '22px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  <li>Name</li>
                  <li>Email address</li>
                  <li>Phone number</li>
                  <li>Google Account ID</li>
                  <li>Device ID (including Advertising ID)</li>
                  <li>Referral data and usage activity</li>
                  <li><strong>Precise and/or Approximate location</strong> (for verification of region-specific offers and fraud prevention)</li>
                  <li>User-uploaded screenshots or files for task verification</li>
                </ul>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  The information we request may be stored on our secure servers for account creation, rewards processing, fraud prevention, and improving user experience.
                </p>
                <p style={{ color: 'var(--text-secondary)' }}>
                  <strong>Referral Information:</strong> If you registered via a referral link, we may share your Username (but not your name, email, or phone number) with the person who referred you. This is strictly to allow the referrer to track their referral rewards and statistics.
                </p>
              </section>

              <section>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#fff' }}>Third-party Services</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  The app uses third-party services and SDKs that may collect information used to identify you. These services include (but are not limited to):
                </p>
                <ul style={{ color: 'var(--text-secondary)', paddingLeft: '22px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <li><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-hover)', textDecoration: 'underline' }}>Google Play Services</a></li>
                  <li><a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-hover)', textDecoration: 'underline' }}>Google Analytics for Firebase</a></li>
                  <li><a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-hover)', textDecoration: 'underline' }}>Firebase Crashlytics</a></li>
                  <li><a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-hover)', textDecoration: 'underline' }}>Firebase Authentication</a></li>
                  <li><a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-hover)', textDecoration: 'underline' }}>Google AdMob</a></li>
                  <li>Third-party Offerwalls and Survey Providers (e.g., PubScale, CPX Research, BitLabs, Opinion Universe) – these services may independently collect your Device ID and other metrics to maximize survey/offer matching.</li>
                </ul>
              </section>

              <section>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#fff' }}>Log Data</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  When you use our Service, in the event of an error or crash we collect data (through third-party systems) called Log Data. Log Data may include:
                </p>
                <ul style={{ color: 'var(--text-secondary)', paddingLeft: '22px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <li>IP address</li>
                  <li>Device name</li>
                  <li>Operating system version</li>
                  <li>App configuration at time of use</li>
                  <li>Time and date of usage</li>
                  <li>Other diagnostic statistics</li>
                </ul>
              </section>

              <section>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#fff' }}>Cookies</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Cookies are small files used as anonymous unique identifiers. Our app does not explicitly use cookies, but third-party libraries or SDKs included in the app may use cookies to collect information and improve services. You can choose to accept or refuse cookies, but refusing may affect certain features of the Service.
                </p>
              </section>

              <section>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#fff' }}>Service Providers</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  We may employ third-party companies and individuals to:
                </p>
                <ul style={{ color: 'var(--text-secondary)', paddingLeft: '22px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  <li>Facilitate our Service</li>
                  <li>Provide the Service on our behalf</li>
                  <li>Perform Service-related tasks</li>
                  <li>Assist in analyzing how the Service is used</li>
                </ul>
                <p style={{ color: 'var(--text-secondary)' }}>
                  These third parties have access to Personal Information only to perform tasks on our behalf and are obligated not to disclose or use it for other purposes.
                </p>
              </section>

              <section>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#fff' }}>Use of Location & Targeting</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  We may store user location (Precise or Approximate) in our database and use it to:
                </p>
                <ul style={{ color: 'var(--text-secondary)', paddingLeft: '22px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  <li>Verify eligibility for region-specific tasks/offers</li>
                  <li>Limit or show geo-targeted offers</li>
                  <li>Prevent fraud based on suspicious location patterns</li>
                </ul>
                <p style={{ color: 'var(--text-secondary)' }}>
                  If you choose to enable location-based features, we will disclose the collection of that location data in the Data Safety section of the Google Play Store and list it under the appropriate categories.
                </p>
              </section>

              <section>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#fff' }}>Advertising, Analytics and Device IDs</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                  We share device identifiers (like the Advertising ID) with advertising partners and offer providers to serve relevant offers, track conversions, and measure ad performance. If you interact with offerwalls, those interactions are also subject to the privacy policies of the respective offerwall providers.
                </p>
              </section>

              <section>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#fff' }}>Data Deletion</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  We respect your right to control your data. You may request the deletion of your account and all associated personal information at any time.
                </p>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  To request data deletion:
                </p>
                <ul style={{ color: 'var(--text-secondary)', paddingLeft: '22px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  <li>Contact us via email at <a href="mailto:support@satyainfotechnetworks.com" style={{ color: 'var(--primary-hover)', textDecoration: 'underline' }}>support@satyainfotechnetworks.com</a> with the subject line "Account Deletion Request".</li>
                </ul>
                <p style={{ color: 'var(--text-secondary)' }}>
                  We will verify your identity and permanently delete your account and data within 30 days of receiving a verified request, except where we are required to retain data for legal or fraud prevention purposes.
                </p>
              </section>

              <section>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#fff' }}>Children's Privacy</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Our Services are not directed to children under the age of 13. We do not knowingly collect personally identifiable information from children under 13. If we discover that a child under 13 has provided us with personal information, we will delete it immediately. If you are a parent or guardian and believe your child has shared personal information with us, please contact us so we can take appropriate action.
                </p>
              </section>

              <section>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#fff' }}>Changes to This Privacy Policy</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                  We may update this Privacy Policy occasionally. You are advised to review this page periodically for changes. We will notify you of material changes by posting the revised Privacy Policy on this page.
                </p>
              </section>

              <section>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#fff' }}>Contact Us</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 0 }}>
                  If you have any questions or suggestions about our Privacy Policy, please contact us at:<br />
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
