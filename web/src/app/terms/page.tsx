export default function TermsPage() {
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
      `}</style>

      <div className="legal-root">
        <div className="legal-wrap">
          <div className="legal-eyebrow">Legal</div>
          <h1 className="legal-title">Terms of Service</h1>
          <p className="legal-meta">Last updated: May 15, 2026 · Effective immediately</p>

          <div className="legal-section">
            <h2 className="legal-h2">1. Acceptance of Terms</h2>
            <p className="legal-p">
              By accessing or using Xenderia ("the Service", "we", "us"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service. These terms apply to all visitors, users, and others who access or use Xenderia.
            </p>
          </div>

          <div className="legal-section">
            <h2 className="legal-h2">2. Description of Service</h2>
            <p className="legal-p">
              Xenderia is an AI-powered financial data query platform that allows users to interact with databases using natural language. The Service includes a query engine, caching layer, dashboard, and associated APIs. We offer a free tier and paid subscription plans.
            </p>
          </div>

          <div className="legal-section">
            <h2 className="legal-h2">3. Account Registration</h2>
            <p className="legal-p">
              To use Xenderia you must create an account using a valid email address or Google Sign-In. You are responsible for:
            </p>
            <ul className="legal-ul">
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activity that occurs under your account</li>
              <li>Notifying us immediately of any unauthorized access</li>
            </ul>
            <p className="legal-p">
              You must be at least 18 years old or have parental consent to use the Service. Accounts are non-transferable.
            </p>
          </div>

          <div className="legal-section">
            <h2 className="legal-h2">4. Subscription Plans & Billing</h2>
            <p className="legal-p">
              Xenderia offers a Free plan (50 queries/month) and a Pro plan (1,000 queries/month) with additional features including custom PostgreSQL connections. Billing is handled via Razorpay. By subscribing to a paid plan you authorize us to charge your payment method on a recurring basis.
            </p>
            <p className="legal-p">
              All fees are non-refundable except where required by applicable law. We reserve the right to change pricing with 30 days' notice. Downgrading mid-cycle does not entitle you to a partial refund. Cache hits do not count against your monthly quota.
            </p>
          </div>

          <div className="legal-section">
            <h2 className="legal-h2">5. Acceptable Use</h2>
            <p className="legal-p">You agree not to use the Service to:</p>
            <ul className="legal-ul">
              <li>Violate any applicable law or regulation</li>
              <li>Attempt to reverse-engineer, scrape, or abuse the API beyond documented rate limits</li>
              <li>Upload malicious files or attempt SQL injection through the database connection feature</li>
              <li>Impersonate any person or entity, or misrepresent your affiliation</li>
              <li>Interfere with or disrupt the integrity or performance of the Service</li>
              <li>Share your account or API access with unauthorized third parties</li>
            </ul>
            <p className="legal-p">
              We reserve the right to suspend or terminate accounts that violate these terms without prior notice.
            </p>
          </div>

          <div className="legal-section">
            <h2 className="legal-h2">6. Data You Submit</h2>
            <p className="legal-p">
              When you connect a database or upload files, you retain full ownership of your data. By submitting data to Xenderia you grant us a limited, non-exclusive licence to process it solely for the purpose of providing the Service to you. We do not use your proprietary data to train AI models or share it with third parties.
            </p>
            <p className="legal-p">
              You are responsible for ensuring you have the right to submit any data you provide, including database contents and uploaded files.
            </p>
          </div>

          <div className="legal-section">
            <h2 className="legal-h2">7. Intellectual Property</h2>
            <p className="legal-p">
              The Xenderia name, logo, software, and all associated content are the intellectual property of Xenderia and its licensors. Nothing in these Terms grants you the right to use our trademarks or branding without prior written permission.
            </p>
          </div>

          <div className="legal-section">
            <h2 className="legal-h2">8. Disclaimer of Warranties</h2>
            <p className="legal-p">
              The Service is provided "as is" and "as available" without warranties of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement. We do not guarantee that the Service will be uninterrupted, error-free, or that AI-generated query results will be accurate or complete.
            </p>
            <p className="legal-p">
              Financial data queries are provided for informational purposes only and should not be treated as financial advice.
            </p>
          </div>

          <div className="legal-section">
            <h2 className="legal-h2">9. Limitation of Liability</h2>
            <p className="legal-p">
              To the maximum extent permitted by law, Xenderia and its team shall not be liable for any indirect, incidental, special, consequential, or punitive damages — including loss of profits, data, or business — arising from your use of the Service, even if we have been advised of the possibility of such damages.
            </p>
            <p className="legal-p">
              Our total liability to you for any claim arising from these Terms or your use of the Service shall not exceed the amount you paid us in the 12 months preceding the claim.
            </p>
          </div>

          <div className="legal-section">
            <h2 className="legal-h2">10. Termination</h2>
            <p className="legal-p">
              You may close your account at any time by contacting us. We may suspend or terminate your access if you breach these Terms, fail to pay outstanding fees, or if we discontinue the Service. Upon termination, your right to use the Service ceases immediately. Sections 7–9 and 12 survive termination.
            </p>
          </div>

          <div className="legal-section">
            <h2 className="legal-h2">11. Changes to Terms</h2>
            <p className="legal-p">
              We may update these Terms from time to time. When we do, we will update the "Last updated" date at the top of this page. For material changes we will notify you by email or via an in-app notice. Your continued use of the Service after changes take effect constitutes acceptance of the updated Terms.
            </p>
          </div>

          <div className="legal-section">
            <h2 className="legal-h2">12. Governing Law</h2>
            <p className="legal-p">
              These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts located in India. If any provision of these Terms is found to be unenforceable, the remaining provisions will remain in full force and effect.
            </p>
          </div>

          <hr className="legal-divider" />

          <div className="legal-section">
            <h2 className="legal-h2">Contact</h2>
            <p className="legal-p">
              If you have questions about these Terms, please reach out via our{' '}
              <a href="/contact" className="legal-link">contact form</a>.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
