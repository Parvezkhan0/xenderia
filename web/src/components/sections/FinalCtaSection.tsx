'use client';

import Link from 'next/link';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';

export default function FinalCtaSection() {
  const [user] = useAuthState(auth);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

        :root {
          --bg:       #11112b;
          --accent:   #7c83f5;
          --accent-2: #a78bfa;
          --text:     #e8e9f3;
          --muted:    rgba(232,233,243,0.45);
          --sans:     'Sora', sans-serif;
        }

        .final-cta {
          background: linear-gradient(135deg, rgba(124,131,245,0.08) 0%, rgba(167,139,250,0.04) 100%);
          border: 1px solid rgba(124,131,245,0.15);
          border-radius: 16px;
          padding: 60px 40px;
          text-align: center;
          margin: 80px 40px;
          position: relative;
          overflow: hidden;
          font-family: var(--sans);
        }

        .final-cta::before {
          content: '';
          position: absolute;
          inset: -100px;
          background: radial-gradient(ellipse, rgba(124,131,245,0.08) 0%, transparent 60%);
          pointer-events: none;
        }

        .final-cta-content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          gap: 20px;
          max-width: 640px;
          margin: 0 auto;
        }

        .final-cta h2 {
          font-size: clamp(32px, 4vw, 48px);
          font-weight: 800;
          color: var(--text);
          letter-spacing: -0.04em;
          line-height: 1.08;
        }

        .hl-gradient {
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .final-cta-sub {
          font-size: 15px;
          color: var(--muted);
          line-height: 1.75;
          letter-spacing: -0.01em;
        }

        .final-cta-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .btn-primary {
          padding: 12px 28px;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: #fff;
          font-family: var(--sans);
          font-size: 14px;
          font-weight: 600;
          letter-spacing: -0.02em;
          border-radius: 10px;
          text-decoration: none;
          border: none;
          cursor: pointer;
          box-shadow: 0 2px 16px rgba(124,131,245,0.3);
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
        }

        .btn-primary:hover {
          opacity: 0.9;
          transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(124,131,245,0.45);
        }

        .btn-secondary {
          padding: 12px 22px;
          border: 1px solid rgba(255,255,255,0.08);
          color: var(--muted);
          font-family: var(--sans);
          font-size: 14px;
          font-weight: 500;
          letter-spacing: -0.02em;
          border-radius: 10px;
          text-decoration: none;
          background: transparent;
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s, background 0.15s;
        }

        .btn-secondary:hover {
          border-color: rgba(255,255,255,0.18);
          color: var(--text);
          background: rgba(255,255,255,0.04);
        }

        @media (max-width: 768px) {
          .final-cta { margin: 60px 24px; padding: 40px 24px; }
        }

        @media (max-width: 480px) {
          .final-cta { margin: 40px 16px; padding: 32px 16px; }
          .final-cta-actions { flex-direction: column; }
          .btn-primary, .btn-secondary { width: 100%; }
        }
      `}</style>

      <section className="final-cta">
        <div className="final-cta-content">
          <h2>
            Your data,<br />
            <span className="hl-gradient">answered instantly.</span>
          </h2>
          <p className="final-cta-sub">
            Join the 6 finance teams already using Xenderia to replace dashboards, eliminate guessing, and cut AI costs by 90%.
          </p>
          <div className="final-cta-actions">
            {user ? (
              <Link href="/dashboard" className="btn-primary">Open Dashboard →</Link>
            ) : (
              <Link href="/signup" className="btn-primary">Start for free →</Link>
            )}
            <Link href="/docs" className="btn-secondary">See how it works</Link>
          </div>
        </div>
      </section>
    </>
  );
}
