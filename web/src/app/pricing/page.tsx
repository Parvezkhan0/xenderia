'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------
const PLANS = [
  {
    name: 'Starter',
    price: 'Free',
    period: '',
    pitch: 'Try Xenderia with no commitment. Perfect for solo analysts and personal projects.',
    cta: 'Get started free',
    hot: false,
    features: [
      '50 queries / month',
      'Connect your own PostgreSQL database',
      'Upload CSV files',
      'Structured table output',
      'Session query history',
    ],
    missing: ['Cache warming', 'Email support'],
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/ mo',
    pitch: 'For analysts who need reliable, fast, exact answers from their own database — every day.',
    cta: 'Get Pro',
    hot: true,
    badge: 'Most popular',
    features: [
      '1,000 queries / month',
      'Custom PostgreSQL database',
      'Upload CSV files',
      'Structured table output',
      'Session query history',
      'Intelligent cache warming',
      'User-isolated cache keys',
      'Email support',
    ],
    missing: [],
  },
];

const COMPARE_ROWS = [
  ['Monthly queries',            '50',        '1,000'],
  ['Cache hits billed',          'Never',     'Never'],
  ['Session query history',      '✓',         '✓'],
  ['Connect your own PostgreSQL', '✓',        '✓'],
  ['Upload CSV files',           '✓',         '✓'],
  ['Structured table output',    '✓',         '✓'],
  ['Cache warming',              '—',         '✓'],
  ['User-isolated cache keys',   '—',         '✓'],
  ['Rate limit',                 '10 / min',  '60 / min'],
  ['Support',                    'Community', 'Email'],
];

const FAQS = [
  {
    q: 'What counts as a query?',
    a: 'Any call to Xenderia that reaches the AI or the database. Cache hits are always free and do not count against your quota — you only spend queries on cache misses.',
  },
  {
    q: 'What data sources does Xenderia support?',
    a: 'Both plans let you connect your own live PostgreSQL database with secure, read-only access, or upload a CSV file to query it in plain English — one data source is active at a time. The free plan includes 50 queries per month; Pro raises that to 1,000 and adds cache warming and user-isolated cache keys.',
  },
  {
    q: 'How does caching reduce my costs?',
    a: 'Xenderia caches the system prompt, schema definitions, and query results. Repeated queries are served from memory — zero AI tokens billed, returned very fast. On average teams see a 90% reduction in token costs within the first week.',
  },
  {
    q: 'What is cache warming?',
    a: 'Pro users can pre-load their most frequent queries into the cache. This ensures even the first query of the day returns instantly rather than waiting for a cold cache miss.',
  },
  {
    q: 'How do I pay for Pro?',
    a: 'We accept UPI, Google Pay, credit/debit cards, and net banking via Razorpay — no special setup required.',
  },
  {
    q: 'Can I switch plans?',
    a: 'Yes, at any time. Upgrades take effect immediately. Downgrades take effect at your next billing cycle.',
  },
];

// ---------------------------------------------------------------------------
// Razorpay types
// ---------------------------------------------------------------------------
declare global {
  interface Window { Razorpay: any; }
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';
// Razorpay hosted recurring-subscription checkout link.
// Falls back to the live link if the env var is not set.
const SUBSCRIPTION_URL =
  process.env.NEXT_PUBLIC_RAZORPAY_SUBSCRIPTION_URL ?? 'https://rzp.io/rzp/6gbx9BJy';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function PricingPage() {
  const router = useRouter();
  const [uid, setUid]           = useState<string | null>(null);
  const [email, setEmail]       = useState<string>('');
  const [authChecked, setAuthChecked] = useState(false);
  const [paying, setPaying]     = useState(false);
  const [payError, setPayError] = useState('');
  const [userPlan, setUserPlan] = useState<'free' | 'pro' | null>(null);

  // Check auth + fetch plan on mount
  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), async (user) => {
      setUid(user?.uid ?? null);
      setEmail(user?.email ?? '');
      setAuthChecked(true);

      if (user) {
        try {
          const token = await user.getIdToken();
          const res = await fetch(`${BASE_URL}/api/v1/user/entitlements`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            setUserPlan(data.plan ?? 'free');
          }
        } catch { setUserPlan('free'); }
      } else {
        setUserPlan(null);
      }
    });
    return () => unsub();
  }, []);

  // ── "Get started free" handler ──────────────────────────────────────────
  const handleGetFree = () => {
    if (uid) router.push('/dashboard');
    else router.push('/signup');
  };

  // ── "Get Pro" handler ────────────────────────────────────────────────────
  const handleGetPro = () => {
    setPayError('');

    // Must be signed in first: the hosted subscription link is static/shared
    // and cannot carry the Firebase UID, so the backend links the resulting
    // subscription to this account BY THE EMAIL the user pays with — which
    // must match their Xenderia account email. Force account creation first.
    if (!uid) {
      router.push('/signup?plan=pro');
      return;
    }

    // Redirect to Razorpay's hosted recurring-subscription checkout.
    // Pro is granted asynchronously by the subscription webhook once the
    // first charge succeeds (see backend billing.handle_razorpay_webhook).
    setPaying(true);
    window.location.href = SUBSCRIPTION_URL;
  };
  // ────────────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

        :root {
          --bg:       #11112b;
          --bg-card:  rgba(255,255,255,0.03);
          --bg-dark:  #0d0d22;
          --border:   rgba(255,255,255,0.08);
          --border-s: rgba(255,255,255,0.05);
          --text:     #e8e9f3;
          --muted:    rgba(232,233,243,0.45);
          --dim:      rgba(232,233,243,0.25);
          --accent:   #7c83f5;
          --accent-2: #a78bfa;
          --as:       rgba(124,131,245,0.12);
          --green:    #34d399;
          --gs:       rgba(52,211,153,0.1);
          --mono:     'JetBrains Mono', monospace;
          --sans:     'Sora', sans-serif;
        }

        .zp-main { background: var(--bg); min-height: 100vh; padding: 120px 24px 100px; font-family: var(--sans); }
        .zp-inner { max-width: 820px; margin: 0 auto; }
        .zp-main::before { content: none; }

        .zp-hero {
          text-align: center; margin-bottom: 80px;
          display: flex; flex-direction: column; align-items: center; gap: 20px; position: relative;
        }

        .zp-hero::before {
          content: ''; position: absolute; top: -80px; left: 50%; transform: translateX(-50%);
          width: 600px; height: 400px;
          background: radial-gradient(ellipse, rgba(124,131,245,0.1) 0%, transparent 65%);
          pointer-events: none; z-index: 0;
        }

        .zp-hero > * { position: relative; z-index: 1; }

        .zp-eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          font-family: var(--mono); font-size: 11px; font-weight: 600; letter-spacing: 0.1em;
          text-transform: uppercase; color: rgba(124,131,245,0.8);
          background: var(--as); border: 1px solid rgba(124,131,245,0.2);
          padding: 5px 14px; border-radius: 100px;
        }

        .zp-ey-dot {
          width: 5px; height: 5px; background: #7c83f5; border-radius: 50%;
          box-shadow: 0 0 6px rgba(124,131,245,0.6); animation: pulse 2.2s ease infinite;
        }

        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.8)} }

        .zp-title { font-size: clamp(34px, 5vw, 58px); font-weight: 800; color: var(--text); letter-spacing: -0.04em; line-height: 1.07; }

        .zp-title .hl {
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }

        .zp-sub { font-size: 16px; color: var(--muted); line-height: 1.75; max-width: 420px; letter-spacing: -0.01em; }

        .zp-cache-pill {
          display: inline-flex; align-items: center; gap: 8px; padding: 7px 16px;
          background: var(--gs); border: 1px solid rgba(52,211,153,0.2); border-radius: 100px;
          font-family: var(--mono); font-size: 11.5px; font-weight: 600; color: var(--green); letter-spacing: 0.03em;
        }

        .zp-plans { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 80px; }

        .zp-plan {
          background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px;
          padding: 32px 28px 28px; display: flex; flex-direction: column;
          position: relative; overflow: hidden; transition: border-color 0.25s, transform 0.25s;
        }

        .zp-plan:hover { transform: translateY(-3px); }
        .zp-plan-hot { border-color: rgba(124,131,245,0.3); background: rgba(124,131,245,0.04); }
        .zp-plan-hot:hover { border-color: rgba(124,131,245,0.5); }

        .zp-plan-hot::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent, var(--accent), var(--accent-2), transparent);
        }

        .zp-badge {
          position: absolute; top: 20px; right: 20px;
          font-family: var(--mono); font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
          text-transform: uppercase; color: var(--accent); background: var(--as);
          border: 1px solid rgba(124,131,245,0.25); padding: 4px 10px; border-radius: 100px;
        }

        .zp-plan-name { font-family: var(--mono); font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--dim); margin-bottom: 20px; }
        .zp-plan-hot .zp-plan-name { color: var(--accent); }

        .zp-price-row { display: flex; align-items: flex-end; gap: 6px; margin-bottom: 6px; }
        .zp-price { font-size: 52px; font-weight: 800; color: var(--text); letter-spacing: -0.05em; line-height: 1; }
        .zp-period { font-family: var(--mono); font-size: 14px; color: var(--muted); margin-bottom: 8px; }

        .zp-pitch { font-size: 13.5px; color: var(--muted); line-height: 1.7; margin-bottom: 28px; letter-spacing: -0.01em; min-height: 60px; }

        .zp-cta {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          text-align: center; padding: 12px; border-radius: 12px;
          font-family: var(--sans); font-size: 14px; font-weight: 600; letter-spacing: -0.02em;
          text-decoration: none; margin-bottom: 28px; cursor: pointer; border: none;
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
        }

        .zp-cta-hot {
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: #fff; box-shadow: 0 4px 18px rgba(124,131,245,0.3);
        }

        .zp-cta-hot:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 8px 28px rgba(124,131,245,0.45); }
        .zp-cta-hot:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }

        .zp-cta-default { border: 1px solid var(--border); color: var(--muted); background: transparent; }
        .zp-cta-default:hover { border-color: rgba(255,255,255,0.18); color: var(--text); background: rgba(255,255,255,0.04); }

        .zp-feat-label { font-family: var(--mono); font-size: 9.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--dim); margin-bottom: 14px; }
        .zp-feats { display: flex; flex-direction: column; gap: 10px; flex: 1; }
        .zp-feat { display: flex; align-items: flex-start; gap: 10px; }

        .zp-feat-icon { width: 18px; height: 18px; border-radius: 5px; display: flex; align-items: center; justify-content: center; font-size: 10px; flex-shrink: 0; margin-top: 1px; }
        .zp-feat-icon.yes { background: rgba(52,211,153,0.12); color: var(--green); font-weight: 700; }
        .zp-feat-icon.no  { background: rgba(255,255,255,0.04); color: var(--dim); }
        .zp-feat-text { font-size: 13px; color: var(--muted); letter-spacing: -0.01em; line-height: 1.45; }
        .zp-feat-text.dim { color: var(--dim); }
        .zp-feat-sep { height: 1px; background: var(--border-s); margin: 4px 0; }

        .zp-pay-note {
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
          margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border-s);
          font-family: var(--mono); font-size: 10px; color: var(--dim); letter-spacing: 0.04em;
        }

        .zp-pay-sep { width: 3px; height: 3px; background: var(--dim); border-radius: 50%; }

        /* Pay error */
        .zp-pay-error {
          margin-bottom: 20px; padding: 10px 14px;
          background: rgba(239,68,68,0.07); border: 1px solid rgba(239,68,68,0.2);
          border-radius: 10px; font-size: 12.5px; color: #f87171;
          text-align: center; letter-spacing: -0.01em;
        }

        .zp-section-label {
          font-family: var(--mono); font-size: 10px; font-weight: 700;
          letter-spacing: 0.14em; text-transform: uppercase; color: var(--dim); margin-bottom: 20px;
        }

        .zp-compare {
          margin-bottom: 72px; border: 1px solid var(--border); border-radius: 16px; overflow: hidden;
        }

        .zp-compare table { width: 100%; border-collapse: collapse; }

        .zp-compare th {
          padding: 14px 20px; text-align: left; font-family: var(--mono); font-size: 11px; font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase; color: var(--dim);
          background: rgba(0,0,0,0.2); border-bottom: 1px solid var(--border);
        }

        .zp-compare td {
          padding: 13px 20px; font-size: 13.5px; color: var(--muted); border-bottom: 1px solid var(--border-s);
        }

        .zp-compare tr:last-child td { border-bottom: none; }
        .zp-compare td:not(:first-child), .zp-compare th:not(:first-child) {
          text-align: center; border-left: 1px solid rgba(124,131,245,0.1);
        }

        .zp-compare th:last-child { color: var(--accent); }
        .cmp-yes { color: var(--green); font-weight: 600; }
        .cmp-no  { color: rgba(232,233,243,0.2); }
        .cmp-val { color: var(--text); font-weight: 500; }
        .cmp-free { color: var(--green); font-weight: 600; }

        .zp-faq { margin-bottom: 72px; display: flex; flex-direction: column; gap: 2px; }

        .zp-faq-item {
          background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px;
          padding: 24px 26px; display: grid; grid-template-columns: 2fr 3fr; gap: 28px;
          transition: background 0.2s, border-color 0.2s;
        }

        .zp-faq-item:hover { background: rgba(124,131,245,0.03); border-color: rgba(124,131,245,0.15); }
        .zp-faq-q { font-size: 15px; font-weight: 600; color: var(--text); letter-spacing: -0.02em; line-height: 1.35; }
        .zp-faq-a { font-size: 13.5px; color: var(--muted); line-height: 1.75; letter-spacing: -0.01em; }

        .zp-bottom {
          background: rgba(124,131,245,0.05); border: 1px solid rgba(124,131,245,0.18);
          border-radius: 20px; padding: 36px; display: flex; align-items: center;
          justify-content: space-between; gap: 24px; flex-wrap: wrap; position: relative; overflow: hidden;
        }

        .zp-bottom::before {
          content: ''; position: absolute; top: -60px; right: -60px; width: 250px; height: 250px;
          background: radial-gradient(ellipse, rgba(124,131,245,0.1) 0%, transparent 65%); pointer-events: none;
        }

        .zp-bottom-left { position: relative; z-index: 1; }
        .zp-bottom-title { font-size: 20px; font-weight: 700; color: var(--text); letter-spacing: -0.03em; margin-bottom: 6px; }
        .zp-bottom-sub { font-size: 13.5px; color: var(--muted); line-height: 1.6; }

        .zp-bottom-cta {
          position: relative; z-index: 1; padding: 12px 24px;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: #fff; font-family: var(--sans); font-size: 14px; font-weight: 600;
          letter-spacing: -0.02em; border-radius: 12px; text-decoration: none; white-space: nowrap;
          box-shadow: 0 4px 16px rgba(124,131,245,0.3); transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
        }

        .zp-bottom-cta:hover { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(124,131,245,0.45); }

        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 640px) {
          .zp-plans { grid-template-columns: 1fr; }
          .zp-faq-item { grid-template-columns: 1fr; gap: 10px; }
          .zp-compare { display: none; }
          .zp-main { padding: 100px 16px 80px; }
        }
      `}</style>

      <Navbar />

      <main className="zp-main">
        <div className="zp-inner">

          {/* Hero */}
          <div className="zp-hero">
            <span className="zp-eyebrow">
              <span className="zp-ey-dot" />
              Pricing
            </span>
            <h1 className="zp-title">
              Pay for compute.<br />
              <span className="hl">Not for cache hits.</span>
            </h1>
            <p className="zp-sub">
              Cache hits are always free. You only spend quota when Xenderia
              has to do real work — and it caches that too.
            </p>
            <div className="zp-cache-pill">
              ⚡ Avg. 90% of queries served from cache
            </div>
          </div>

          {/* Pay error banner */}
          {payError && (
            <div className="zp-pay-error">⚠ {payError}</div>
          )}

          {/* Plans */}
          <div className="zp-plans">
            {PLANS.map((plan) => (
              <div key={plan.name} className={`zp-plan ${plan.hot ? 'zp-plan-hot' : ''}`}>
                {plan.hot && plan.badge && (
                  <span className="zp-badge">{plan.badge}</span>
                )}

                <div className="zp-plan-name">{plan.name}</div>

                <div className="zp-price-row">
                  <span className="zp-price">{plan.price}</span>
                  {plan.period && <span className="zp-period">{plan.period}</span>}
                </div>

                <p className="zp-pitch">{plan.pitch}</p>

                {plan.hot ? (
                  // ── Pro CTA ──────────────────────────────────────────────
                  userPlan === 'pro' ? (
                    // Already Pro — go straight to dashboard
                    <button
                      className="zp-cta zp-cta-hot"
                      onClick={() => router.push('/dashboard')}
                    >
                      Go to Dashboard →
                    </button>
                  ) : (
                    // Not Pro — redirect to Razorpay hosted subscription
                    <>
                      <button
                        className="zp-cta zp-cta-hot"
                        onClick={handleGetPro}
                        disabled={!authChecked || paying}
                      >
                        {paying
                          ? <Loader2 size={14} style={{ animation: 'spin .8s linear infinite' }} />
                          : null}
                        {paying ? 'Opening checkout…' : plan.cta}
                      </button>
                      {email && (
                        <div style={{
                          marginTop: 10,
                          fontSize: 11,
                          lineHeight: 1.5,
                          color: 'var(--dim)',
                          fontFamily: 'var(--mono)',
                          textAlign: 'center',
                        }}>
                          Pay with{' '}
                          <strong style={{ color: 'var(--muted)' }}>{email}</strong>
                          {' '}to link your subscription.
                        </div>
                      )}
                    </>
                  )
                ) : (
                  <button className="zp-cta zp-cta-default" onClick={handleGetFree}>
                    {plan.cta}
                  </button>
                )}

                <div className="zp-feat-label">What's included</div>

                <div className="zp-feats">
                  {plan.features.map((f) => (
                    <div className="zp-feat" key={f}>
                      <div className="zp-feat-icon yes">✓</div>
                      <span className="zp-feat-text">{f}</span>
                    </div>
                  ))}

                  {plan.missing.length > 0 && (
                    <>
                      <div className="zp-feat-sep" />
                      {plan.missing.map((f) => (
                        <div className="zp-feat" key={f}>
                          <div className="zp-feat-icon no">—</div>
                          <span className="zp-feat-text dim">{f}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {plan.hot && (
                  <div className="zp-pay-note">
                    <span>UPI</span>
                    <span className="zp-pay-sep" />
                    <span>Google Pay</span>
                    <span className="zp-pay-sep" />
                    <span>Cards</span>
                    <span className="zp-pay-sep" />
                    <span>Net banking</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Compare table */}
          <div className="zp-section-label">Full comparison</div>
          <div className="zp-compare">
            <table>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Starter</th>
                  <th>Pro</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map(([feat, starter, pro]) => {
                  const cls = (v: string) => {
                    if (v === '✓') return 'cmp-yes';
                    if (v === '—') return 'cmp-no';
                    if (v === 'Never') return 'cmp-free';
                    return 'cmp-val';
                  };
                  return (
                    <tr key={feat}>
                      <td style={{ color: 'var(--text)', letterSpacing: '-0.01em' }}>{feat}</td>
                      <td className={cls(starter)}>{starter}</td>
                      <td className={cls(pro)}>{pro}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* FAQ */}
          <div className="zp-section-label">Common questions</div>
          <div className="zp-faq">
            {FAQS.map((faq) => (
              <div className="zp-faq-item" key={faq.q}>
                <div className="zp-faq-q">{faq.q}</div>
                <div className="zp-faq-a">{faq.a}</div>
              </div>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="zp-bottom">
            <div className="zp-bottom-left">
              <div className="zp-bottom-title">Questions about Pro?</div>
              <p className="zp-bottom-sub">
                Pay via UPI, Google Pay, cards, or net banking. Cancel any time.
              </p>
            </div>
            <a href="/contact" className="zp-bottom-cta">
              Talk to us →
            </a>
          </div>

        </div>
      </main>

      <Footer />
    </>
  );
}