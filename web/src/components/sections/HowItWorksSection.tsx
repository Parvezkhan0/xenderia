'use client';

import { useEffect, useRef, useState } from 'react';

function useInView(threshold = 0.15) {
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

// ── Step 1 Preview: Natural language input ──────────
function PreviewAsk() {
  const [typed, setTyped] = useState('');
  const full = 'What was the net margin for healthcare companies in Q2 2024?';
  useEffect(() => {
    let i = 0;
    const t = setInterval(() => {
      setTyped(full.slice(0, i + 1));
      i++;
      if (i >= full.length) clearInterval(t);
    }, 38);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="preview-card">
      <div className="preview-topbar">
        <div className="preview-dots">
          <span className="pd pd-r"/><span className="pd pd-y"/><span className="pd pd-g"/>
        </div>
        <span className="preview-bar-label">Zenntraa · Ask anything</span>
      </div>
      <div className="preview-body">
        <div className="ask-input-row">
          <div className="ask-avatar">Z</div>
          <div className="ask-input-box">
            <span className="ask-typed">{typed}</span>
            {typed.length < full.length && <span className="ask-cursor"/>}
          </div>
        </div>
        <div className="ask-hints">
          <span className="ask-hint">Revenue</span>
          <span className="ask-hint">Margins</span>
          <span className="ask-hint">YoY growth</span>
          <span className="ask-hint">Rankings</span>
        </div>
      </div>
    </div>
  );
}

// ── Step 2 Preview: Cache lookup (simplified) ────────────────────
function PreviewCache() {
  return (
    <div className="preview-card">
      <div className="preview-topbar">
        <div className="preview-dots">
          <span className="pd pd-r"/><span className="pd pd-y"/><span className="pd pd-g"/>
        </div>
        <span className="preview-bar-label">Cache Check</span>
      </div>
      <div className="preview-body">
        <div style={{ padding: '12px 14px', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.15)', borderRadius: '8px', fontSize: '13px', color: 'rgba(232,233,243,0.7)', lineHeight: 1.6 }}>
          ⚡ <strong>Cache HIT</strong> — This question was answered 2 days ago. Returning result from memory in 18ms. Zero AI tokens used.
        </div>
      </div>
    </div>
  );
}

// ── Step 3 Preview: SQL execution (simplified) ───────────────────
function PreviewSQL() {
  return (
    <div className="preview-card">
      <div className="preview-topbar">
        <div className="preview-dots">
          <span className="pd pd-r"/><span className="pd pd-y"/><span className="pd pd-g"/>
        </div>
        <span className="preview-bar-label">SQL Execution</span>
      </div>
      <div className="preview-body">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '14px' }}>
          <div style={{ fontSize: '13px', color: 'rgba(232,233,243,0.6)', flex: 1, fontStyle: 'italic' }}>
            "What was TechCorp's Q1 revenue?"
          </div>
          <div style={{ fontSize: '16px', color: 'rgba(124,131,245,0.4)', flexShrink: 0 }}>→</div>
          <div style={{ fontSize: '13px', color: 'rgba(232,233,243,0.6)', flex: 1, textAlign: 'right' }}>
            Exact SQL generated and run in read-only sandbox
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 4 Preview: Results table ───────────────────
function PreviewResult() {
  const rows = [
    { company: 'MedCore Inc.',  margin: '31.4%', bar: 95 },
    { company: 'HealthBridge',  margin: '27.9%', bar: 84 },
    { company: 'CareAxis',      margin: '22.1%', bar: 67 },
    { company: 'PharmaOne',     margin: '19.6%', bar: 59 },
  ];

  return (
    <div className="preview-card">
      <div className="preview-topbar">
        <div className="preview-dots">
          <span className="pd pd-r"/><span className="pd pd-y"/><span className="pd pd-g"/>
        </div>
        <span className="preview-bar-label">Results · 4 rows</span>
        <span className="preview-bar-badge green">Exact · Cached</span>
      </div>
      <div className="preview-body" style={{ padding: '0' }}>
        <div className="result-table-head">
          <span>Company</span>
          <span>Net Margin</span>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="result-table-row" style={{ animationDelay: `${i * 0.1}s` }}>
            <div className="result-table-left">
              <span className="result-rank">#{i + 1}</span>
              <span className="result-co">{r.company}</span>
            </div>
            <div className="result-table-right">
              <div className="result-bar-track">
                <div className="result-bar-fill" style={{ width: `${r.bar}%` }} />
              </div>
              <span className="result-val">{r.margin}</span>
            </div>
          </div>
        ))}
        <div className="result-table-footer">
          <span>Pulled directly from DB · Not inferred</span>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  {
    number: '01',
    tag: 'Input',
    color: '#7c83f5',
    title: 'Ask in plain English',
    description: 'No SQL. No dashboards. No waiting on a data team. Just type your question the way you\'d ask a colleague, and Zenntraa figures out the rest.',
    Preview: PreviewAsk,
  },
  {
    number: '02',
    tag: 'Cache Check',
    color: '#34d399',
    title: 'Memory checked first',
    description: 'Before touching the AI or your database, Zenntraa checks if this question has already been answered. If yes — you get the result in under 50ms. Zero AI cost.',
    Preview: PreviewCache,
  },
  {
    number: '03',
    tag: 'SQL Execution',
    color: '#fbbf24',
    title: 'Exact SQL, not a guess',
    description: 'On a cache miss, the AI translates your question into a precise SQL query and runs it in a sandboxed, read-only environment. Every action is logged.',
    Preview: PreviewSQL,
  },
  {
    number: '04',
    tag: 'Response',
    color: '#a78bfa',
    title: 'Exact data, instantly',
    description: 'Results come back formatted and ready. The answer is also cached for next time, so the second ask is always near-instant.',
    Preview: PreviewResult,
  },
];

function StepRow({ step, index }: { step: typeof STEPS[0]; index: number }) {
  const { ref, inView } = useInView(0.1);
  const { Preview } = step;

  return (
    <div
      ref={ref}
      className="step-row"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(36px)',
        transition: `opacity 0.6s ${index * 0.08}s ease, transform 0.6s ${index * 0.08}s ease`,
      }}
    >
      {/* Left: text */}
      <div className="step-left">
        <div className="step-num-row">
          <span className="step-num" style={{ color: step.color }}>{step.number}</span>
          <span className="step-tag-pill">{step.tag}</span>
        </div>
        <h3 className="step-title">{step.title}</h3>
        <p className="step-desc">{step.description}</p>

        {/* Connector to next step */}
        {index < STEPS.length - 1 && (
          <div className="step-connector">
            <div className="step-conn-line" style={{ background: `linear-gradient(to bottom, ${step.color}55, transparent)` }} />
          </div>
        )}
      </div>

      {/* Right: preview */}
      <div className="step-right">
        <div className="step-preview-wrap" style={{ '--card-accent': step.color } as React.CSSProperties}>
          {inView && <Preview />}
        </div>
      </div>
    </div>
  );
}

export default function HowItWorksSection() {
  const { ref: headRef, inView: headIn } = useInView(0.2);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

        .hiw-section {
          background: #0d0d22;
          padding: 110px 24px 130px;
          position: relative;
          overflow: hidden;
          font-family: 'Sora', sans-serif;
        }

        /* Top separator */
        .hiw-section::before {
          content: '';
          position: absolute; top: 0; left: 50%;
          transform: translateX(-50%);
          width: 480px; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(124,131,245,0.35), transparent);
        }

        .hiw-orb {
          position: absolute; top: 10%; right: -120px;
          width: 500px; height: 500px;
          background: radial-gradient(ellipse, rgba(124,131,245,0.07) 0%, transparent 65%);
          pointer-events: none;
        }

        .hiw-inner {
          max-width: 1060px;
          margin: 0 auto;
          position: relative; z-index: 1;
        }

        /* ── Header ── */
        .hiw-head {
          margin-bottom: 80px;
          display: flex; flex-direction: column; gap: 16px;
          max-width: 540px;
        }

        .hiw-eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px; font-weight: 600; letter-spacing: 0.1em;
          text-transform: uppercase; color: rgba(124,131,245,0.8);
          opacity: 0; transform: translateY(10px);
          transition: opacity 0.5s, transform 0.5s;
        }
        .hiw-eyebrow.vis { opacity: 1; transform: translateY(0); }
        .hiw-ey-dot {
          width: 5px; height: 5px; background: #7c83f5;
          border-radius: 50%; box-shadow: 0 0 6px rgba(124,131,245,0.6);
        }

        .hiw-h2 {
          font-size: clamp(30px, 4vw, 46px); font-weight: 800;
          color: #e8e9f3; letter-spacing: -0.04em; line-height: 1.1;
          opacity: 0; transform: translateY(10px);
          transition: opacity 0.5s 0.07s, transform 0.5s 0.07s;
        }
        .hiw-h2.vis { opacity: 1; transform: translateY(0); }
        .hiw-h2 .hl {
          background: linear-gradient(135deg, #7c83f5, #a78bfa);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }

        .hiw-sub {
          font-size: 15px; color: rgba(232,233,243,0.45);
          line-height: 1.75; letter-spacing: -0.01em;
          opacity: 0; transform: translateY(10px);
          transition: opacity 0.5s 0.14s, transform 0.5s 0.14s;
        }
        .hiw-sub.vis { opacity: 1; transform: translateY(0); }

        /* ── Step rows ── */
        .steps-list {
          display: flex; flex-direction: column; gap: 0;
        }

        .step-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 48px;
          align-items: start;
          padding-bottom: 72px;
        }

        .step-row:last-child { padding-bottom: 0; }

        /* Alternate layout: odd steps = text left, even = text right */
        .step-row:nth-child(even) .step-left  { order: 2; }
        .step-row:nth-child(even) .step-right { order: 1; }

        /* ── Step left (text) ── */
        .step-left {
          display: flex; flex-direction: column; gap: 14px;
          padding-top: 8px;
        }

        .step-num-row {
          display: flex; align-items: center; gap: 10px;
        }

        .step-num {
          font-family: 'JetBrains Mono', monospace;
          font-size: 28px; font-weight: 700; letter-spacing: -0.03em;
          line-height: 1;
        }

        .step-tag-pill {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px; font-weight: 600; letter-spacing: 0.1em;
          text-transform: uppercase; color: rgba(232,233,243,0.35);
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          padding: 4px 10px; border-radius: 100px;
        }

        .step-title {
          font-size: 22px; font-weight: 700;
          color: #e8e9f3; letter-spacing: -0.03em; line-height: 1.25;
        }

        .step-desc {
          font-size: 14px; color: rgba(232,233,243,0.45);
          line-height: 1.75; letter-spacing: -0.01em;
          max-width: 380px;
        }

        .step-connector {
          padding-top: 8px;
        }

        .step-conn-line {
          width: 2px; height: 64px; border-radius: 2px;
          margin-left: 13px;
        }

        /* ── Step right (preview) ── */
        .step-right {
          position: relative;
        }

        .step-preview-wrap {
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.03),
            0 24px 56px rgba(0,0,0,0.5);
          background: rgba(255,255,255,0.02);
          transition: border-color 0.3s;
        }

        .step-preview-wrap:hover {
          border-color: color-mix(in srgb, var(--card-accent) 30%, transparent);
        }

        /* ── Shared preview card ── */
        .preview-card {
          display: flex; flex-direction: column;
        }

        .preview-topbar {
          display: flex; align-items: center; gap: 10px;
          padding: 11px 16px;
          background: rgba(0,0,0,0.25);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        .preview-dots { display: flex; gap: 5px; }
        .pd {
          width: 9px; height: 9px; border-radius: 50%;
        }
        .pd-r { background: #ff5f57; opacity: 0.7; }
        .pd-y { background: #febc2e; opacity: 0.7; }
        .pd-g { background: #28c840; opacity: 0.7; }

        .preview-bar-label {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px; color: rgba(232,233,243,0.35);
          flex: 1;
        }

        .mono-label { font-family: 'JetBrains Mono', monospace; }

        .preview-bar-badge {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px; font-weight: 600; letter-spacing: 0.06em;
          padding: 2px 8px; border-radius: 5px;
        }
        .preview-bar-badge.green {
          background: rgba(52,211,153,0.1); color: #34d399;
          border: 1px solid rgba(52,211,153,0.2);
        }
        .preview-bar-badge.amber {
          background: rgba(251,191,36,0.1); color: #fbbf24;
          border: 1px solid rgba(251,191,36,0.2);
        }

        .preview-body {
          padding: 18px;
          display: flex; flex-direction: column; gap: 10px;
        }

        /* ── Step 1: Ask ── */
        .ask-input-row {
          display: flex; align-items: flex-start; gap: 10px;
          background: rgba(0,0,0,0.2);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px; padding: 12px 14px;
        }

        .ask-avatar {
          width: 28px; height: 28px; border-radius: 8px;
          background: linear-gradient(135deg, #7c83f5, #a78bfa);
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; color: #fff; flex-shrink: 0;
        }

        .ask-input-box {
          flex: 1; display: flex; align-items: center; gap: 2px; flex-wrap: wrap;
        }

        .ask-typed {
          font-size: 13px; color: rgba(232,233,243,0.75);
          letter-spacing: -0.01em; line-height: 1.5;
        }

        .ask-cursor {
          display: inline-block; width: 2px; height: 14px;
          background: #7c83f5; border-radius: 1px; flex-shrink: 0;
          animation: blink 1s step-end infinite;
        }

        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }

        .ask-hints {
          display: flex; flex-wrap: wrap; gap: 7px;
        }

        .ask-hint {
          font-size: 11.5px; color: rgba(232,233,243,0.3);
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          padding: 4px 11px; border-radius: 100px;
          cursor: default;
          transition: color 0.2s, border-color 0.2s;
        }
        .ask-hint:hover { color: #a78bfa; border-color: rgba(167,139,250,0.3); }

        /* ── Step 2: Cache ── */
        .cache-lookup-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .cache-lookup-row:last-of-type { border-bottom: none; }

        .cache-lookup-label {
          font-size: 12.5px; color: rgba(232,233,243,0.4);
        }

        .cache-lookup-val {
          font-size: 12.5px; color: rgba(232,233,243,0.7);
        }

        .cache-lookup-val.mono {
          font-family: 'JetBrains Mono', monospace; font-size: 11.5px;
        }

        .cache-status-chip {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11.5px; font-weight: 600;
          padding: 3px 10px; border-radius: 6px;
          transition: all 0.3s ease;
        }
        .cache-status-chip.idle    { color: rgba(232,233,243,0.25); background: transparent; }
        .cache-status-chip.checking { color: #7c83f5; background: rgba(124,131,245,0.1); border: 1px solid rgba(124,131,245,0.2); }
        .cache-status-chip.hit     { color: #34d399; background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.2); }

        .cache-hit-banner {
          background: rgba(52,211,153,0.07);
          border: 1px solid rgba(52,211,153,0.18);
          border-radius: 8px; padding: 9px 12px;
          font-size: 12px; color: #34d399;
          animation: fadeSlide 0.4s ease both;
        }

        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Step 3: SQL ── */
        .sql-block {
          margin: 0; padding: 18px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px; line-height: 1.8;
          color: rgba(232,233,243,0.5);
          background: rgba(0,0,0,0.2);
          overflow-x: auto; white-space: pre;
        }

        .sql-footer {
          display: flex; gap: 14px; padding: 10px 18px;
          border-top: 1px solid rgba(255,255,255,0.05);
          background: rgba(0,0,0,0.1);
        }

        .sql-footer-item {
          font-size: 11px; color: rgba(232,233,243,0.3);
        }

        /* ── Step 4: Results ── */
        .result-table-head {
          display: flex; justify-content: space-between;
          padding: 8px 18px;
          background: rgba(0,0,0,0.2);
          border-bottom: 1px solid rgba(255,255,255,0.05);
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase;
          color: rgba(232,233,243,0.3);
        }

        .result-table-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 11px 18px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          animation: fadeSlide 0.35s ease both;
        }
        .result-table-row:last-of-type { border-bottom: none; }

        .result-table-left {
          display: flex; align-items: center; gap: 10px;
        }

        .result-rank {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px; color: rgba(232,233,243,0.25); width: 20px;
        }

        .result-co {
          font-size: 13px; color: rgba(232,233,243,0.7);
        }

        .result-table-right {
          display: flex; align-items: center; gap: 10px;
        }

        .result-bar-track {
          width: 70px; height: 4px;
          background: rgba(255,255,255,0.07);
          border-radius: 100px; overflow: hidden;
        }

        .result-bar-fill {
          height: 100%; border-radius: 100px;
          background: linear-gradient(90deg, #7c83f5, #34d399);
          animation: growBar 0.8s ease both;
        }

        @keyframes growBar {
          from { width: 0 !important; }
        }

        .result-val {
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px; font-weight: 600; color: #34d399;
          min-width: 44px; text-align: right;
        }

        .result-table-footer {
          padding: 9px 18px;
          background: rgba(52,211,153,0.04);
          border-top: 1px solid rgba(52,211,153,0.1);
          font-family: 'JetBrains Mono', monospace;
          font-size: 10.5px; color: rgba(52,211,153,0.45);
        }

        /* ── Footer ── */
        .hiw-footer {
          margin-top: 72px; display: flex;
          align-items: center; justify-content: center; gap: 16px;
        }
        .hiw-footer-line {
          flex: 1; max-width: 180px; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07));
        }
        .hiw-footer-line:last-child {
          background: linear-gradient(270deg, transparent, rgba(255,255,255,0.07));
        }
        .hiw-footer-text {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px; color: rgba(232,233,243,0.25);
          letter-spacing: 0.06em; text-transform: uppercase;
        }

        /* ── Responsive ── */
        @media (max-width: 800px) {
          .step-row {
            grid-template-columns: 1fr;
            gap: 28px; padding-bottom: 56px;
          }
          .step-row:nth-child(even) .step-left  { order: 1; }
          .step-row:nth-child(even) .step-right { order: 2; }
          .hiw-section { padding: 80px 20px 90px; }
          .hiw-head { margin-bottom: 56px; }
          .step-conn-line { height: 36px; }
        }
      `}</style>

      <section className="hiw-section">
        <div className="hiw-orb" />

        <div className="hiw-inner">

          {/* Header */}
          <div className="hiw-head" ref={headRef}>
            <span className={`hiw-eyebrow ${headIn ? 'vis' : ''}`}>
              <span className="hiw-ey-dot" />
              How it works
            </span>
            <h2 className={`hiw-h2 ${headIn ? 'vis' : ''}`}>
              Four steps.<br />
              <span className="hl">Zero ambiguity.</span>
            </h2>
            <p className={`hiw-sub ${headIn ? 'vis' : ''}`}>
              Every query follows the same deterministic path —
              cache check first, exact SQL second, answer always.
            </p>
          </div>

          {/* Steps */}
          <div className="steps-list">
            {STEPS.map((step, i) => (
              <StepRow key={step.number} step={step} index={i} />
            ))}
          </div>

          <div className="hiw-footer">
            <div className="hiw-footer-line" />
            <span className="hiw-footer-text">Deterministic · Fast · Exact</span>
            <div className="hiw-footer-line" />
          </div>

        </div>
      </section>
    </>
  );
}