'use client';

import { useEffect, useRef, useState } from 'react';

const COMPANIES = [
  { name: 'Meridian Capital',    abbr: 'MC', color: '#7c83f5' },
  { name: 'Stackline Data',      abbr: 'SD', color: '#34d399' },
  { name: 'Novafront Labs',      abbr: 'NL', color: '#a78bfa' },
  { name: 'Aurelian Group',      abbr: 'AG', color: '#fbbf24' },
  { name: 'Crestview Analytics', abbr: 'CA', color: '#f472b6' },
  { name: 'Pinebrook Ventures',  abbr: 'PV', color: '#38bdf8' },
];

const TESTIMONIALS = [
  {
    quote: "We replaced our entire RAG pipeline with Zenntraa in a week. Query accuracy went from 'close enough' to exact. Our analysts stopped second-guessing the numbers.",
    name: 'James Whitfield',
    role: 'Head of Data Engineering',
    company: 'Meridian Capital',
    abbr: 'MC',
    color: '#7c83f5',
  },
  {
    quote: "The cache-first approach is genuinely clever. Repeated queries come back instantly for us. The AI cost reduction alone paid for the switch in the first month.",
    name: 'Priya Nandakumar',
    role: 'Senior Data Scientist',
    company: 'Stackline Data',
    abbr: 'SD',
    color: '#34d399',
  },
];

const STATS = [
  { value: 6,    suffix: '',   label: 'companies in beta',   color: '#7c83f5' },
  { value: 83,   suffix: '%',  label: 'avg cache hit rate',  color: '#34d399' },
  { value: 90,   suffix: '%',  label: 'avg cost reduction',  color: '#a78bfa' },
];

function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setInView(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function useCountUp(target: number, duration: number, active: boolean) {
  // Static: show the final value immediately, no count-up animation.
  void duration; void active;
  return target;
}

function StatItem({ s, active }: { s: typeof STATS[0]; active: boolean }) {
  const val = useCountUp(s.value, 1600, active);
  return (
    <div className="zsp-stat">
      <div className="zsp-stat-num" style={{ color: s.color }}>
        {val}{s.suffix}
      </div>
      <div className="zsp-stat-label">{s.label}</div>
      <div className="zsp-stat-bar" style={{ background: `linear-gradient(90deg, ${s.color}33, transparent)` }} />
    </div>
  );
}

function TCard({ t }: { t: typeof TESTIMONIALS[0] }) {
  return (
    <div
      className="zsp-tcard"
      style={{
        '--card-color': t.color,
      } as React.CSSProperties}
    >
      {/* Left accent bar */}
      <div className="zsp-tcard-bar" style={{ background: t.color }} />

      <div className="zsp-tcard-inner">
        {/* Quote */}
        <p className="zsp-quote">"{t.quote}"</p>

        {/* Author */}
        <div className="zsp-author">
          <div className="zsp-avatar" style={{
            background: `${t.color}18`,
            borderColor: `${t.color}35`,
            color: t.color,
          }}>
            {t.abbr}
          </div>
          <div>
            <div className="zsp-name">{t.name}</div>
            <div className="zsp-role">{t.role} · {t.company}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SocialProofSection() {
  const { ref: headRef, inView: headIn } = useInView(0.2);
  const { ref: statsRef, inView: statsIn } = useInView(0.2);


  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

        .zsp-section {
          background: #11112b;
          padding: 110px 24px 130px;
          position: relative;
          overflow: hidden;
          font-family: 'Sora', sans-serif;
        }

        .zsp-section::before {
          content: '';
          position: absolute; top: 0; left: 50%;
          transform: translateX(-50%);
          width: 480px; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(124,131,245,0.35), transparent);
        }

        .zsp-orb-a {
          position: absolute; top: -60px; right: -100px;
          width: 500px; height: 500px;
          background: radial-gradient(ellipse, rgba(124,131,245,0.07) 0%, transparent 65%);
          pointer-events: none;
        }
        .zsp-orb-b {
          position: absolute; bottom: 0; left: -80px;
          width: 400px; height: 400px;
          background: radial-gradient(ellipse, rgba(52,211,153,0.05) 0%, transparent 65%);
          pointer-events: none;
        }

        .zsp-inner {
          max-width: 1100px;
          margin: 0 auto;
          position: relative; z-index: 1;
        }

        /* ── Header ── */
        .zsp-head {
          margin-bottom: 64px;
          display: flex; flex-direction: column; gap: 16px;
          max-width: 560px;
        }

        .zsp-eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px; font-weight: 600; letter-spacing: 0.1em;
          text-transform: uppercase; color: rgba(124,131,245,0.8);
          opacity: 1; transform: none;
          transition: opacity 0.5s, transform 0.5s;
        }
        .zsp-eyebrow.vis { opacity: 1; transform: translateY(0); }
        .zsp-ey-dot {
          width: 5px; height: 5px; background: #7c83f5;
          border-radius: 50%; box-shadow: 0 0 6px rgba(124,131,245,0.6);
        }

        .zsp-h2 {
          font-size: clamp(30px, 4vw, 46px); font-weight: 800;
          color: #e8e9f3; letter-spacing: -0.04em; line-height: 1.1;
          opacity: 1; transform: none;
          transition: opacity 0.5s 0.07s, transform 0.5s 0.07s;
        }
        .zsp-h2.vis { opacity: 1; transform: translateY(0); }
        .zsp-h2 .hl {
          background: linear-gradient(135deg, #7c83f5, #a78bfa);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }

        .zsp-sub {
          font-size: 15px; color: rgba(232,233,243,0.45);
          line-height: 1.75; letter-spacing: -0.01em;
          opacity: 1; transform: none;
          transition: opacity 0.5s 0.14s, transform 0.5s 0.14s;
        }
        .zsp-sub.vis { opacity: 1; transform: translateY(0); }

        /* ── Testimonials grid (2 columns) ── */
        .zsp-masonry-2col {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 80px;
        }

        /* ── Testimonial card ── */
        .zsp-tcard {
          position: relative;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          overflow: hidden;
          transition: border-color 0.25s, background 0.25s, transform 0.25s;
          cursor: default;
        }

        .zsp-tcard:hover {
          border-color: color-mix(in srgb, var(--card-color) 25%, transparent);
          background: rgba(255,255,255,0.05);
          transform: translateY(-3px);
        }

        .zsp-tcard-bar {
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
          border-radius: 3px 0 0 3px;
        }

        .zsp-tcard-inner {
          padding: 24px 22px 22px 26px;
          display: flex; flex-direction: column; gap: 14px;
        }


        .zsp-quote {
          font-size: 13.5px; color: rgba(232,233,243,0.6);
          line-height: 1.75; letter-spacing: -0.01em;
          flex: 1;
        }

        .zsp-author {
          display: flex; align-items: center; gap: 10px;
          padding-top: 14px;
          border-top: 1px solid rgba(255,255,255,0.06);
        }

        .zsp-avatar {
          width: 34px; height: 34px; border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10.5px; font-weight: 700;
          border: 1px solid; flex-shrink: 0;
        }

        .zsp-name {
          font-size: 13px; font-weight: 600;
          color: #e8e9f3; letter-spacing: -0.02em;
        }

        .zsp-role {
          font-size: 11px; color: rgba(232,233,243,0.35);
          margin-top: 2px;
        }

        /* ── Stats ── */
        .zsp-stats-wrap {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2px;
          border-radius: 16px;
          overflow: hidden;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
        }

        .zsp-stat {
          position: relative;
          padding: 36px 28px 32px;
          display: flex; flex-direction: column; gap: 8px;
          background: rgba(17,17,43,0.8);
          transition: background 0.2s;
          overflow: hidden;
        }

        .zsp-stat:hover { background: rgba(255,255,255,0.03); }

        .zsp-stat-bar {
          position: absolute;
          top: 0; left: 0; right: 0; height: 3px;
          border-radius: 0;
        }

        .zsp-stat-num {
          font-family: 'JetBrains Mono', monospace;
          font-size: clamp(32px, 3.5vw, 48px);
          font-weight: 700; letter-spacing: -0.04em; line-height: 1;
        }

        .zsp-stat-label {
          font-size: 13px; color: rgba(232,233,243,0.4);
          letter-spacing: -0.01em;
        }

        /* Glow behind stat number */
        .zsp-stat::after {
          content: '';
          position: absolute;
          bottom: -20px; left: -20px;
          width: 100px; height: 100px;
          background: radial-gradient(ellipse, currentColor 0%, transparent 70%);
          opacity: 0.04;
          pointer-events: none;
        }

        /* ── Footer divider ── */
        .zsp-footer {
          margin-top: 60px; display: flex;
          align-items: center; justify-content: center; gap: 16px;
        }
        .zsp-footer-line {
          flex: 1; max-width: 200px; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07));
        }
        .zsp-footer-line:last-child {
          background: linear-gradient(270deg, transparent, rgba(255,255,255,0.07));
        }
        .zsp-footer-text {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px; color: rgba(232,233,243,0.25);
          letter-spacing: 0.06em; text-transform: uppercase;
        }

        /* ── Responsive ── */
        @media (max-width: 900px) {
          .zsp-masonry { grid-template-columns: repeat(2, 1fr); }
          .zsp-col:last-child { display: none; }
          .zsp-stats-wrap { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 580px) {
          .zsp-masonry { grid-template-columns: 1fr; }
          .zsp-col:last-child { display: flex; }
          .zsp-stats-wrap { grid-template-columns: repeat(2, 1fr); }
          .zsp-section { padding: 80px 16px 90px; }
          .zsp-head { margin-bottom: 48px; }
        }
      `}</style>

      <section className="zsp-section">
        <div className="zsp-orb-a" />
        <div className="zsp-orb-b" />

        <div className="zsp-inner">

          {/* Header */}
          <div className="zsp-head" ref={headRef}>
            <span className={`zsp-eyebrow ${headIn ? 'vis' : ''}`}>
              <span className="zsp-ey-dot" />
              Early Access
            </span>
            <h2 className={`zsp-h2 ${headIn ? 'vis' : ''}`}>
              Teams that ran on guesses.<br />
              <span className="hl">Now don't.</span>
            </h2>
            <p className={`zsp-sub ${headIn ? 'vis' : ''}`}>
              A small group of data and finance teams helped us shape Zenntraa in beta.
              Here's what they said.
            </p>
          </div>

          {/* Testimonials (2 only) */}
          <div className="zsp-masonry-2col">
            {TESTIMONIALS.map((t) => <TCard key={t.name} t={t} />)}
          </div>

          {/* Stats */}
          <div
            className="zsp-stats-wrap"
            ref={statsRef}
            style={{
              opacity: 1,
              transform: 'none',
              transition: 'opacity 0.6s ease, transform 0.6s ease',
            }}
          >
            {STATS.map((s) => (
              <StatItem key={s.label} s={s} active={statsIn} />
            ))}
          </div>

          <div className="zsp-footer">
            <div className="zsp-footer-line" />
            <span className="zsp-footer-text">Trusted by early finance teams</span>
            <div className="zsp-footer-line" />
          </div>

        </div>
      </section>
    </>
  );
}