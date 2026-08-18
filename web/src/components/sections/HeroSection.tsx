'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';

const STATS = [
  { value: 'Instant', label: 'cached responses' },
  { value: '90%',   label: 'avg cost reduction, beta users' },
  { value: '100%',  label: 'exact answers pulled directly from DB' },
];

export default function HeroSection() {
  const [user] = useAuthState(auth);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

        :root {
          --bg:       #11112b;
          --border:   rgba(255,255,255,0.08);
          --text:     #e8e9f3;
          --muted:    rgba(232,233,243,0.45);
          --dim:      rgba(232,233,243,0.28);
          --accent:   #7c83f5;
          --accent-2: #a78bfa;
          --green:    #34d399;
          --mono:     'JetBrains Mono', monospace;
          --sans:     'Sora', sans-serif;
        }

        .hero {
          min-height: 100vh;
          background: var(--bg);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 100px 40px 80px;
          position: relative;
          overflow: hidden;
          font-family: var(--sans);
        }

        .hero-orb-1 {
          position: absolute; top: -100px; left: 50%;
          transform: translateX(-30%);
          width: 900px; height: 700px;
          background: radial-gradient(ellipse, rgba(124,131,245,0.12) 0%, transparent 65%);
          pointer-events: none;
        }
        .hero-orb-2 {
          position: absolute; bottom: -60px; right: -80px;
          width: 500px; height: 500px;
          background: radial-gradient(ellipse, rgba(167,139,250,0.07) 0%, transparent 65%);
          pointer-events: none;
        }

        .hero-grid {
          position: absolute; inset: 0;
          background-image: radial-gradient(rgba(255,255,255,0.055) 1px, transparent 1px);
          background-size: 32px 32px;
          mask-image: radial-gradient(ellipse 80% 70% at 50% 40%, black 20%, transparent 100%);
          pointer-events: none;
        }

        /* ── Main grid: left text, right screenshot ── */
        .hero-content {
          position: relative; z-index: 1;
          max-width: 1160px; width: 100%;
          display: grid;
          grid-template-columns: 480px 1fr;
          gap: 56px;
          align-items: center;
        }

        /* ── Left ── */
        .hero-left {
          display: flex; flex-direction: column; gap: 28px;
        }

        .hero-badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 5px 14px 5px 8px;
          border: 1px solid rgba(124,131,245,0.25);
          background: rgba(124,131,245,0.08);
          border-radius: 100px; width: fit-content;
          font-family: var(--mono);
          font-size: 11px; font-weight: 500;
          color: var(--accent); letter-spacing: 0.04em;
          animation: fadeUp 0.5s ease both;
        }

        .badge-dot {
          width: 6px; height: 6px;
          background: var(--green); border-radius: 50%;
          box-shadow: 0 0 6px rgba(52,211,153,0.6);
          animation: pulse 2.2s ease infinite;
        }

        @keyframes pulse {
          0%,50%,100% { opacity:1; transform:none; }
        }

        .hero-headline {
          font-size: clamp(38px, 4vw, 54px);
          font-weight: 800; line-height: 1.08;
          color: var(--text); letter-spacing: -0.04em;
          animation: fadeUp 0.5s 0.08s ease both;
        }

        .hl-accent {
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }

        .hl-dim { color: rgba(232,233,243,0.3); font-weight: 300; }

        .hero-sub {
          font-size: 15px; color: var(--muted);
          line-height: 1.75; letter-spacing: -0.01em;
          animation: fadeUp 0.5s 0.14s ease both;
        }

        .hero-actions {
          display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
          animation: fadeUp 0.5s 0.2s ease both;
        }

        .btn-primary {
          padding: 11px 24px;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: #fff; font-family: var(--sans);
          font-size: 14px; font-weight: 600; letter-spacing: -0.02em;
          border-radius: 10px; text-decoration: none;
          box-shadow: 0 2px 16px rgba(124,131,245,0.3);
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
        }

        .btn-primary:hover {
          opacity: 0.9; transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(124,131,245,0.45);
        }

        .btn-secondary {
          padding: 11px 22px;
          border: 1px solid var(--border);
          color: var(--muted); font-family: var(--sans);
          font-size: 14px; font-weight: 500; letter-spacing: -0.02em;
          border-radius: 10px; text-decoration: none;
          transition: border-color 0.15s, color 0.15s, background 0.15s;
        }

        .btn-secondary:hover {
          border-color: rgba(255,255,255,0.18); color: var(--text);
          background: rgba(255,255,255,0.04);
        }

        .hero-stats {
          display: flex; gap: 0;
          padding-top: 4px;
          animation: fadeUp 0.5s 0.26s ease both;
        }

        .stat {
          display: flex; flex-direction: column; gap: 3px;
          padding-right: 24px;
        }

        .stat + .stat {
          padding-left: 24px;
          border-left: 1px solid var(--border);
        }

        .stat:last-child { padding-right: 0; }

        .stat-value {
          font-family: var(--mono);
          font-size: 22px; font-weight: 700;
          color: var(--text); letter-spacing: -0.03em;
        }

        .stat-label {
          font-size: 11px; color: var(--dim);
          letter-spacing: 0.02em; font-weight: 500;
        }

        /* ── Right: screenshot ── */
        .hero-right {
          position: relative;
          animation: fadeUp 0.5s 0.18s ease both;
        }

        /* Glow behind screenshot */
        .hero-right::before {
          content: '';
          position: absolute;
          inset: -30px;
          background: radial-gradient(ellipse, rgba(124,131,245,0.12) 0%, transparent 70%);
          pointer-events: none;
          border-radius: 24px;
        }

        .dashboard-preview-wrap {
          position: relative; z-index: 1;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow:
            0 0 0 1px rgba(124,131,245,0.08),
            0 24px 80px rgba(0,0,0,0.65),
            inset 0 1px 0 rgba(255,255,255,0.07);
        }

        .dashboard-chrome {
          background: rgba(10,10,26,0.98);
          border-bottom: 1px solid rgba(255,255,255,0.07);
          padding: 9px 14px;
          display: flex; align-items: center; gap: 10px;
        }

        .chrome-dots { display: flex; gap: 5px; }
        .chrome-dot { width: 9px; height: 9px; border-radius: 50%; }
        .chrome-dot-r { background: #ff5f57; opacity: 0.8; }
        .chrome-dot-y { background: #febc2e; opacity: 0.8; }
        .chrome-dot-g { background: #28c840; opacity: 0.8; }

        .chrome-url {
          flex: 1;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 5px;
          padding: 4px 12px;
          font-family: var(--mono);
          font-size: 10.5px; color: rgba(232,233,243,0.3);
        }

        .dashboard-img {
          display: block; width: 100%; height: auto;
        }

        /* Fade at bottom */
        .dashboard-fade {
          position: absolute;
          bottom: 0; left: 0; right: 0; height: 60px;
          background: linear-gradient(to bottom, transparent, rgba(17,17,43,0.5));
          pointer-events: none;
        }

        @keyframes fadeUp {
          from, to { opacity: 1; transform: none; }
        }

        /* Responsive */
        @media (max-width: 960px) {
          .hero-content {
            grid-template-columns: 1fr;
            gap: 40px;
          }
          .hero { padding: 100px 24px 60px; }
        }

        @media (max-width: 480px) {
          .stat + .stat { border-left: none; padding-left: 0; border-top: 1px solid var(--border); padding-top: 12px; margin-top: 12px; }
          .hero-stats { flex-direction: column; }
        }
      `}</style>

      <section className="hero">
        <div className="hero-grid" />
        <div className="hero-orb-1" />
        <div className="hero-orb-2" />

        <div className="hero-content">

          {/* ── Left ── */}
          <div className="hero-left">
            <div className="hero-badge">
              <span className="badge-dot" />
              Natural language · Exact numbers
            </div>

            <h1 className="hero-headline">
              Your data,<br />
              <span className="hl-accent">answered instantly.</span><br />
              <span className="hl-dim">Not approximated.</span>
            </h1>

            <p className="hero-sub">
              Zenntraa lets finance teams query revenue, margins, and transaction data
              in plain English — returning exact numbers very fast, not dashboards to dig through.
            </p>

            <div className="hero-actions">
              {user ? (
                <Link href="/dashboard" className="btn-primary">Open Dashboard →</Link>
              ) : (
                <Link href="/signup" className="btn-primary">Start for free →</Link>
              )}
              <Link href="/docs" className="btn-secondary">See how it works</Link>
            </div>

            <p style={{ fontSize: '12px', color: 'rgba(232,233,243,0.5)', lineHeight: 1.5, marginTop: '4px' }}>
              Used by 6 finance teams in beta · Read-only by default · No SQL required
            </p>

            <div className="hero-stats">
              {STATS.map((s, i) => (
                <div className="stat" key={i}>
                  <span className="stat-value">{s.value}</span>
                  <span className="stat-label">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: screenshot ── */}
          <div className="hero-right">
            <div className="dashboard-preview-wrap">
              <div className="dashboard-chrome">
                <div className="chrome-dots">
                  <div className="chrome-dot chrome-dot-r" />
                  <div className="chrome-dot chrome-dot-y" />
                  <div className="chrome-dot chrome-dot-g" />
                </div>
                <div className="chrome-url">app.zenntraa.dev/dashboard/query</div>
              </div>
              <Image
                src="/dashboard-preview.png"
                alt="Zenntraa dashboard"
                width={1200}
                height={780}
                className="dashboard-img"
                priority
              />
              <div className="dashboard-fade" />
            </div>
          </div>

        </div>
      </section>
    </>
  );
}