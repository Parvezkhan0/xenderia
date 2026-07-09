export default function PrivacyPage() {
  return (
    <>
      <style>{`
        .legal-root {
          min-height: 100vh;
          background: #11112b;
          padding: 64px 24px 96px;
          font-family: 'Sora', system-ui, sans-serif;
          color: #e8e9f3;
        }
        .legal-wrap {
          max-width: 720px;
          margin: 0 auto;
        }
        .legal-eyebrow {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(124,131,245,0.7);
          margin-bottom: 12px;
        }
        .legal-title {
          font-size: 32px;
          font-weight: 800;
          letter-spacing: -0.04em;
          color: #e8e9f3;
          margin-bottom: 8px;
          line-height: 1.15;
        }
        .legal-meta {
          font-size: 13px;
          color: rgba(232,233,243,0.35);
          margin-bottom: 52px;
        }
        .legal-section {
          margin-bottom: 40px;
        }
        .legal-h2 {
          font-size: 15px;
          font-weight: 700;
          color: #e8e9f3;
          letter-spacing: -0.02em;
          margin-bottom: 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .legal-p {
          font-size: 14px;
          line-height: 1.8;
          color: rgba(232,233,243,0.6);
          margin-bottom: 12px;
        }
        .legal-p:last-child { margin-bottom: 0; }
        .legal-ul {
          margin: 8px 0 12px 0;
          padding-left: 20px;
          display: flex;
          flex-direction: column;
          gap: 7px;
        }
        .legal-ul li {
          font-size: 14px;
          line-height: 1.7;
          color: rgba(232,233,243,0.6);
        }
        .legal-link {
          color: rgba(124,131,245,0.9);
          text-decoration: none;
        }
        .legal-link:hover { text-decoration: underline; }
        .legal-divider {
          border: none;
          border-top: 1px solid rgba(255,255,255,0.06);
          margin: 48px 0;
        }
        .legal-table {
          width: 100%;
          border-collapse: collapse;
          margin: 12px 0;
          font-size: 13px;
        }
        .legal-table th {
          text-align: left;
          padding: 9px 14px;
          background: rgba(255,255,255,0.03);
          color: rgba(232,233,243,0.5);
          font-weight: 600;
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .legal-table td {
          padding: 10px 14px;
          color: rgba(232,233,243,0.6);
          border-bottom: 1px solid rgba(255,255,255,0.04);
          vertical-align: top;
          line-height: 1.6;
        }
        .legal-table tr:last-child td { border-bottom: none; }
      `}</style>

      <div className="legal-root">
        <div className="legal-wrap">
          <div className="legal-eyebrow">Legal</div>
          <h1 className="legal-title">Privacy Policy</h1>
          <p className="legal-meta">Last updated: May 15, 2026 · Effective immediately</p>

          <div className="legal-section">
            <h2 className="legal-h2">1. Who We Are</h2>
            <p className="legal-p">
              Zenntraa ("we", "us", "our") is an AI-powered financial data query platform. This Privacy Policy explains what personal data we collect, how we use it, and the choices you have. By using the Service you agree to the practices described here.
            </p>
          </div>

          <div className="legal-section">
            <h2 className="legal-h2">2. Information We Collect</h2>
            <p className="legal-p">
              We collect information in three ways:
            </p>

            <p className="legal-p"><strong style={{color:'rgba(232,233,243,0.85)'}}>Information you provide directly</strong></p>
            <ul className="legal-ul">
              <li>Account details — name, email address, and profile photo when you sign in via Google</li>
              <li>Database connection credentials you enter in Settings (stored encrypted in Firestore)</li>
              <li>Files you upload (Excel/CSV) for analysis</li>
              <li>Messages you send via the contact form</li>
            </ul>

            <p className="legal-p" style={{marginTop:'16px'}}><strong style={{color:'rgba(232,233,243,0.85)'}}>Information collected automatically</strong></p>
            <ul className="legal-ul">
              <li>Query text and responses, to power history and caching</li>
              <li>Usage metrics — query count, latency, cache hit rate</li>
              <li>Browser and device information for security and error diagnostics</li>
              <li>IP address and approximate location</li>
            </ul>

            <p className="legal-p" style={{marginTop:'16px'}}><strong style={{color:'rgba(232,233,243,0.85)'}}>Information from third parties</strong></p>
            <ul className="legal-ul">
              <li>Authentication data from Google via Firebase Auth</li>
              <li>Payment status (not card numbers) from Razorpay</li>
            </ul>
          </div>

          <div className="legal-section">
            <h2 className="legal-h2">3. How We Use Your Information</h2>
            <table className="legal-table">
              <thead>
                <tr>
                  <th>Purpose</th>
                  <th>Data used</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Provide and operate the Service</td>
                  <td>Account details, queries, database credentials</td>
                </tr>
                <tr>
                  <td>Billing and subscription management</td>
                  <td>Email, payment status from Razorpay</td>
                </tr>
                <tr>
                  <td>Query history and caching</td>
                  <td>Query text, responses, timestamps</td>
                </tr>
                <tr>
                  <td>Security and fraud prevention</td>
                  <td>IP address, device info, usage patterns</td>
                </tr>
                <tr>
                  <td>Product improvement</td>
                  <td>Aggregated, anonymised usage metrics</td>
                </tr>
                <tr>
                  <td>Customer support</td>
                  <td>Contact form messages, account info</td>
                </tr>
              </tbody>
            </table>
            <p className="legal-p">
              We do not use your queries or database contents to train AI models, and we do not sell your data to any third party.
            </p>
          </div>

          <div className="legal-section">
            <h2 className="legal-h2">4. Data Sharing</h2>
            <p className="legal-p">We share data only with the following third-party services, strictly to operate the platform:</p>
            <ul className="legal-ul">
              <li><strong style={{color:'rgba(232,233,243,0.8)'}}>Firebase / Google</strong> — authentication and data storage</li>
              <li><strong style={{color:'rgba(232,233,243,0.8)'}}>Anthropic</strong> — AI query processing (your queries are sent to Claude API)</li>
              <li><strong style={{color:'rgba(232,233,243,0.8)'}}>Razorpay</strong> — payment processing</li>
              <li><strong style={{color:'rgba(232,233,243,0.8)'}}>Render</strong> — backend hosting</li>
              <li><strong style={{color:'rgba(232,233,243,0.8)'}}>Vercel</strong> — frontend hosting</li>
              <li><strong style={{color:'rgba(232,233,243,0.8)'}}>Resend</strong> — transactional email delivery</li>
            </ul>
            <p className="legal-p">
              We may also disclose information if required by law, regulation, or valid legal process, or to protect the rights and safety of our users.
            </p>
          </div>

          <div className="legal-section">
            <h2 className="legal-h2">5. Data Retention</h2>
            <p className="legal-p">
              We retain your account data for as long as your account is active. Query history is retained for up to 12 months and can be cleared on request. Uploaded files (Excel/CSV) are stored only for the duration of your session and deleted thereafter. Database credentials are deleted immediately when you disconnect a database or close your account.
            </p>
            <p className="legal-p">
              Billing records are retained for 7 years as required by applicable financial regulations.
            </p>
          </div>

          <div className="legal-section">
            <h2 className="legal-h2">6. Security</h2>
            <p className="legal-p">
              We take security seriously. Measures we use include:
            </p>
            <ul className="legal-ul">
              <li>All data in transit is encrypted via TLS/HTTPS</li>
              <li>Database credentials are encrypted at rest in Firestore</li>
              <li>Authentication is handled by Firebase, which enforces industry-standard security</li>
              <li>API access requires valid Firebase ID tokens; all endpoints are rate-limited</li>
              <li>SQL queries run in read-only mode — we cannot modify your database</li>
            </ul>
            <p className="legal-p">
              No system is completely secure. If you believe your account has been compromised, contact us immediately.
            </p>
          </div>

          <div className="legal-section">
            <h2 className="legal-h2">7. Your Rights</h2>
            <p className="legal-p">Depending on where you are located, you may have the right to:</p>
            <ul className="legal-ul">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and associated data</li>
              <li>Object to or restrict certain processing</li>
              <li>Withdraw consent where processing is based on consent</li>
            </ul>
            <p className="legal-p">
              To exercise any of these rights, contact us via the{' '}
              <a href="/contact" className="legal-link">contact form</a>. We will respond within 30 days.
            </p>
          </div>

          <div className="legal-section">
            <h2 className="legal-h2">8. Cookies & Local Storage</h2>
            <p className="legal-p">
              We use a <code style={{fontFamily:'monospace', fontSize:'12px', background:'rgba(255,255,255,0.05)', padding:'1px 5px', borderRadius:'4px'}}>firebase-token</code> cookie to maintain your authenticated session. This is a strictly necessary cookie — the Service cannot function without it. We do not use tracking or advertising cookies. No third-party analytics scripts are loaded.
            </p>
          </div>

          <div className="legal-section">
            <h2 className="legal-h2">9. Children's Privacy</h2>
            <p className="legal-p">
              Zenntraa is not directed at children under 18. We do not knowingly collect personal data from minors. If you believe a minor has created an account, please contact us and we will delete the account promptly.
            </p>
          </div>

          <div className="legal-section">
            <h2 className="legal-h2">10. Changes to This Policy</h2>
            <p className="legal-p">
              We may update this Privacy Policy from time to time. We will notify you of material changes by email or via an in-app notice at least 7 days before they take effect. The "Last updated" date at the top of this page always reflects the most recent revision.
            </p>
          </div>

          <hr className="legal-divider" />

          <div className="legal-section">
            <h2 className="legal-h2">Contact</h2>
            <p className="legal-p">
              For privacy-related questions, data requests, or concerns, please use our{' '}
              <a href="/contact" className="legal-link">contact form</a>. We aim to respond to all privacy requests within 30 days.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
