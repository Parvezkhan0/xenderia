'use client';

import { useEffect, useRef, useState } from 'react';

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function useCountUp(target: number, duration: number, active: boolean) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const prog = Math.min((ts - start) / duration, 1);
      setVal(Math.floor(prog * target));
      if (prog < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [active, target, duration]);
  return val;
}

// ── Speed Card (large) ──────────────────────────────
function SpeedCard({ inView }: { inView: boolean }) {
  const queries = [
    { label: 'TechCorp Q1 revenue', ms: 23, hit: true },
    { label: 'Net margin comparison', ms: 31, hit: true },
    { label: 'Top 5 by EBITDA', ms: 19, hit: true },
    { label: 'YoY growth analysis', ms: 140, hit: false },
  ];
  const [active, setActive] = useState(-1);
  useEffect(() => {
    if (!inView) return;
    let i = 0;
    const tick = () => { setActive(i); i++; if (i < queries.length) setTimeout(tick, 420); };
    setTimeout(tick, 300);
  }, [inView]);

  return (
    <div className="bento-card bento-speed">
      <div className="bento-label">⚡ Speed</div>
      <h3 className="bento-title">Sub-50ms<br />responses</h3>
      <p className="bento-desc">Cache-first architecture. Repeated queries skip the AI entirely and return from memory in milliseconds.</p>
      <div className="speed-query-list">
        {queries.map((q, i) => (
          <div key={i} className={`speed-row ${active >= i ? 'speed-row-in' : ''}`}
            style={{ transitionDelay: `${i * 0.08}s` }}>
            <div className="speed-row-left">
              <span className={`speed-dot ${q.hit ? 'hit' : 'miss'}`} />
              <span className="speed-qtext">{q.label}</span>
            </div>
            <div className="speed-row-right">
              <span className={`speed-badge ${q.hit ? 'hit' : 'miss'}`}>
                {q.hit ? `${q.ms}ms` : `${q.ms}ms`}
              </span>
              <span className="speed-type">{q.hit ? 'cache' : 'live'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Accuracy Card ──────────────────────────────────
function AccuracyCard({ inView }: { inView: boolean }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const t1 = setTimeout(() => setStep(1), 400);
    const t2 = setTimeout(() => setStep(2), 1100);
    const t3 = setTimeout(() => setStep(3), 1800);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, [inView]);

  return (
    <div className="bento-card bento-accuracy">
      <div className="bento-label">🎯 Accuracy</div>
      <h3 className="bento-title">Exact numbers,<br />every time</h3>
      <div className="accuracy-flow">
        <div className={`acc-step ${step >= 1 ? 'acc-step-in' : ''}`}>
          <div className="acc-bubble acc-query">"What was TechCorp's Q1 revenue?"</div>
        </div>
        {step >= 1 && <div className="acc-arrow acc-arrow-in">↓</div>}
        <div className={`acc-step ${step >= 2 ? 'acc-step-in' : ''}`}>
          <div className="acc-bubble acc-sql">SELECT revenue FROM financials<br/>WHERE company = 'TechCorp'<br/>AND quarter = 'Q1'</div>
        </div>
        {step >= 2 && <div className="acc-arrow acc-arrow-in">↓</div>}
        <div className={`acc-step ${step >= 3 ? 'acc-step-in' : ''}`}>
          <div className="acc-bubble acc-result">
            <span className="acc-val">$1.24B</span>
            <span className="acc-tag">exact · from DB</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Cost Card ──────────────────────────────────────
function CostCard({ inView }: { inView: boolean }) {
  const saved = useCountUp(90, 1400, inView);
  return (
    <div className="bento-card bento-cost">
      <div className="bento-label">💸 Cost</div>
      <h3 className="bento-title">90% cost<br />reduction</h3>
      <div className="cost-meter">
        <div className="cost-bar-wrap">
          <span className="cost-bar-label">Without Zenntraa</span>
          <div className="cost-bar-track">
            <div className="cost-bar-fill cost-bar-before" style={{ width: inView ? '100%' : '0%' }} />
          </div>
          <span className="cost-bar-val cost-expensive">100% tokens</span>
        </div>
        <div className="cost-bar-wrap">
          <span className="cost-bar-label">With Zenntraa</span>
          <div className="cost-bar-track">
            <div className="cost-bar-fill cost-bar-after" style={{ width: inView ? '10%' : '0%' }} />
          </div>
          <span className="cost-bar-val cost-cheap">10% tokens</span>
        </div>
      </div>
      <div className="cost-big-num">
        <span className="cost-pct">{saved}<span style={{fontSize:'1.8rem'}}>%</span></span>
        <span className="cost-pct-label">avg. token savings</span>
      </div>
    </div>
  );
}

// ── Security Card ──────────────────────────────────
function SecurityCard() {
  const logs = [
    { time: '09:41:02', action: 'SELECT executed', status: 'ok' },
    { time: '09:41:05', action: 'INSERT blocked', status: 'blocked' },
    { time: '09:41:09', action: 'SELECT executed', status: 'ok' },
    { time: '09:41:14', action: 'DROP TABLE blocked', status: 'blocked' },
  ];
  return (
    <div className="bento-card bento-security">
      <div className="bento-label">🔒 Security</div>
      <h3 className="bento-title">Read-only.<br />Sandboxed.</h3>
      <div className="sec-log">
        {logs.map((l, i) => (
          <div key={i} className="sec-row" style={{ animationDelay: `${i * 0.12}s` }}>
            <span className="sec-time">{l.time}</span>
            <span className="sec-action">{l.action}</span>
            <span className={`sec-status ${l.status}`}>{l.status === 'ok' ? '✓' : '✗'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Simplicity Card (large) ────────────────────────
function SimplicityCard() {
  const examples = [
    'What was our highest revenue quarter?',
    'Compare Q1 vs Q2 net margins',
    'Which companies had negative growth?',
    'Show me EBITDA for all healthcare companies',
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(p => (p + 1) % examples.length), 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="bento-card bento-simplicity">
      <div className="bento-label">💬 Simplicity</div>
      <h3 className="bento-title">Just ask.<br />In plain English.</h3>
      <p className="bento-desc">No SQL knowledge, no dashboards, no waiting on a data team. Ask like you'd ask a colleague.</p>
      <div className="simp-input-wrap">
        <div className="simp-avatar">Z</div>
        <div className="simp-bubble">
          <span key={idx} className="simp-text">{examples[idx]}</span>
          <span className="simp-cursor" />
        </div>
      </div>
      <div className="simp-tags">
        {['Revenue queries', 'Margin analysis', 'YoY comparisons', 'Rankings'].map(t => (
          <span key={t} className="simp-tag">{t}</span>
        ))}
      </div>
    </div>
  );
}

// ── Reliability Card ───────────────────────────────
function ReliabilityCard() {
  return (
    <div className="bento-card bento-reliability">
      <div className="bento-label">🔄 Reliability</div>
      <h3 className="bento-title">Self-healing<br />circuit breaker</h3>
      <div className="rel-states">
        <div className="rel-state rel-closed">
          <span className="rel-dot green" />
          <div>
            <div className="rel-state-name">CLOSED</div>
            <div className="rel-state-sub">Cache active · Full speed</div>
          </div>
        </div>
        <div className="rel-arrow-h">→</div>
        <div className="rel-state rel-open">
          <span className="rel-dot amber" />
          <div>
            <div className="rel-state-name">OPEN</div>
            <div className="rel-state-sub">Degraded · Fallback active</div>
          </div>
        </div>
        <div className="rel-arrow-h">→</div>
        <div className="rel-state rel-half">
          <span className="rel-dot violet" />
          <div>
            <div className="rel-state-name">HALF-OPEN</div>
            <div className="rel-state-sub">Recovering · Auto-heal</div>
          </div>
        </div>
      </div>
      <p className="bento-desc" style={{marginTop:'12px'}}>No crashes. No manual restarts. The system keeps serving answers while it heals itself.</p>
    </div>
  );
}

// ── Main export ────────────────────────────────────
export default function FeaturesSection() {
  const { ref: secRef, inView: secIn } = useInView(0.1);
  const { ref: headRef, inView: headIn } = useInView(0.2);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

        .zf-section {
          background: #11112b;
          padding: 110px 24px 130px;
          position: relative;
          font-family: 'Sora', sans-serif;
          overflow: hidden;
        }

        .zf-section::before {
          content: '';
          position: absolute;
          top: 0; left: 50%;
          transform: translateX(-50%);
          width: 480px; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(124,131,245,0.4), transparent);
        }

        .zf-orb-a {
          position: absolute; top: -100px; left: -80px;
          width: 500px; height: 500px;
          background: radial-gradient(ellipse, rgba(124,131,245,0.08) 0%, transparent 65%);
          pointer-events: none;
        }
        .zf-orb-b {
          position: absolute; bottom: -60px; right: -80px;
          width: 420px; height: 420px;
          background: radial-gradient(ellipse, rgba(167,139,250,0.06) 0%, transparent 65%);
          pointer-events: none;
        }

        .zf-inner {
          max-width: 1100px;
          margin: 0 auto;
          position: relative;
          z-index: 1;
        }

        /* ── Header ── */
        .zf-head {
          margin-bottom: 64px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .zf-eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px; font-weight: 600; letter-spacing: 0.1em;
          text-transform: uppercase; color: rgba(124,131,245,0.8);
          opacity: 0; transform: translateY(10px);
          transition: opacity 0.5s, transform 0.5s;
        }
        .zf-eyebrow.vis { opacity: 1; transform: translateY(0); }
        .zf-eyebrow-dot {
          width: 5px; height: 5px; background: #7c83f5;
          border-radius: 50%; box-shadow: 0 0 6px rgba(124,131,245,0.6);
        }

        .zf-h2 {
          font-size: clamp(30px, 4vw, 48px); font-weight: 800;
          color: #e8e9f3; letter-spacing: -0.04em; line-height: 1.08;
          opacity: 0; transform: translateY(10px);
          transition: opacity 0.5s 0.07s, transform 0.5s 0.07s;
        }
        .zf-h2.vis { opacity: 1; transform: translateY(0); }
        .zf-h2 .hl {
          background: linear-gradient(135deg, #7c83f5, #a78bfa);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }

        .zf-sub {
          font-size: 15px; color: rgba(232,233,243,0.45);
          line-height: 1.75; max-width: 480px; letter-spacing: -0.01em;
          opacity: 0; transform: translateY(10px);
          transition: opacity 0.5s 0.14s, transform 0.5s 0.14s;
        }
        .zf-sub.vis { opacity: 1; transform: translateY(0); }

        /* ── Bento grid ── */
        .bento-grid {
          display: grid;
          grid-template-columns: repeat(12, 1fr);
          grid-template-rows: auto auto;
          gap: 14px;
        }

        /* Card base */
        .bento-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          position: relative;
          overflow: hidden;
          transition: border-color 0.25s, background 0.25s, transform 0.25s;
        }
        .bento-card::after {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
        }
        .bento-card:hover {
          border-color: rgba(124,131,245,0.25);
          background: rgba(124,131,245,0.04);
          transform: translateY(-3px);
        }

        /* Grid placement */
        .bento-speed      { grid-column: span 5; }
        .bento-accuracy   { grid-column: span 4; }
        .bento-cost       { grid-column: span 3; }
        .bento-security   { grid-column: span 3; }
        .bento-reliability{ grid-column: span 4; }
        .bento-simplicity { grid-column: span 5; }

        /* Shared card text */
        .bento-label {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10.5px; font-weight: 600;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: rgba(124,131,245,0.7);
        }
        .bento-title {
          font-size: 21px; font-weight: 700;
          color: #e8e9f3; letter-spacing: -0.03em; line-height: 1.2;
        }
        .bento-desc {
          font-size: 13px; color: rgba(232,233,243,0.45);
          line-height: 1.7; letter-spacing: -0.005em;
        }

        /* ── Speed card internals ── */
        .speed-query-list {
          display: flex; flex-direction: column; gap: 6px;
          background: rgba(0,0,0,0.2);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px; padding: 12px;
          margin-top: 4px;
        }
        .speed-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 7px 8px; border-radius: 7px;
          opacity: 0; transform: translateX(-8px);
          transition: opacity 0.35s, transform 0.35s, background 0.2s;
        }
        .speed-row-in { opacity: 1; transform: translateX(0); }
        .speed-row:hover { background: rgba(255,255,255,0.04); }
        .speed-row-left { display: flex; align-items: center; gap: 8px; }
        .speed-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .speed-dot.hit { background: #34d399; box-shadow: 0 0 5px rgba(52,211,153,0.5); }
        .speed-dot.miss { background: #7c83f5; }
        .speed-qtext { font-size: 12.5px; color: rgba(232,233,243,0.6); }
        .speed-row-right { display: flex; align-items: center; gap: 8px; }
        .speed-badge {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11.5px; font-weight: 600;
          padding: 2px 8px; border-radius: 5px;
        }
        .speed-badge.hit { background: rgba(52,211,153,0.1); color: #34d399; }
        .speed-badge.miss { background: rgba(124,131,245,0.1); color: #7c83f5; }
        .speed-type {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px; color: rgba(232,233,243,0.25);
        }

        /* ── Accuracy card internals ── */
        .accuracy-flow {
          display: flex; flex-direction: column; gap: 6px; margin-top: 4px;
        }
        .acc-step { opacity: 0; transform: translateY(6px); transition: opacity 0.4s, transform 0.4s; }
        .acc-step-in { opacity: 1; transform: translateY(0); }
        .acc-arrow {
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px; color: rgba(124,131,245,0.4);
          text-align: center;
          opacity: 0; animation: fadeIn 0.3s ease forwards;
        }
        .acc-arrow-in { opacity: 1; }
        .acc-bubble {
          border-radius: 8px; padding: 9px 12px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11.5px; line-height: 1.6;
          border: 1px solid;
        }
        .acc-query {
          background: rgba(124,131,245,0.08); color: rgba(232,233,243,0.7);
          border-color: rgba(124,131,245,0.18);
        }
        .acc-sql {
          background: rgba(0,0,0,0.25); color: rgba(232,233,243,0.45);
          border-color: rgba(255,255,255,0.07);
        }
        .acc-result {
          background: rgba(52,211,153,0.08); border-color: rgba(52,211,153,0.2);
          display: flex; align-items: center; justify-content: space-between;
        }
        .acc-val { font-size: 18px; font-weight: 700; color: #34d399; }
        .acc-tag {
          font-size: 10px; background: rgba(52,211,153,0.12);
          color: #34d399; padding: 3px 8px; border-radius: 5px;
        }

        /* ── Cost card internals ── */
        .cost-meter { display: flex; flex-direction: column; gap: 10px; }
        .cost-bar-wrap { display: flex; flex-direction: column; gap: 5px; }
        .cost-bar-label { font-size: 11px; color: rgba(232,233,243,0.35); }
        .cost-bar-track {
          height: 8px; background: rgba(255,255,255,0.06);
          border-radius: 100px; overflow: hidden;
        }
        .cost-bar-fill {
          height: 100%; border-radius: 100px;
          transition: width 1.2s cubic-bezier(0.4,0,0.2,1);
        }
        .cost-bar-before { background: rgba(232,233,243,0.2); }
        .cost-bar-after  { background: linear-gradient(90deg, #7c83f5, #34d399); }
        .cost-bar-val { font-family: 'JetBrains Mono', monospace; font-size: 11px; }
        .cost-expensive { color: rgba(232,233,243,0.3); }
        .cost-cheap { color: #34d399; }
        .cost-big-num {
          display: flex; align-items: baseline; gap: 8px;
          margin-top: 4px;
        }
        .cost-pct {
          font-family: 'JetBrains Mono', monospace;
          font-size: 3rem; font-weight: 700;
          background: linear-gradient(135deg, #7c83f5, #34d399);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          line-height: 1;
        }
        .cost-pct-label { font-size: 12px; color: rgba(232,233,243,0.35); }

        /* ── Security card internals ── */
        .sec-log {
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px; padding: 10px;
          display: flex; flex-direction: column; gap: 4px;
          margin-top: 4px;
        }
        .sec-row {
          display: flex; align-items: center; gap: 8px;
          padding: 6px 8px; border-radius: 6px;
          animation: fadeInRow 0.4s ease both;
        }
        .sec-row:hover { background: rgba(255,255,255,0.03); }
        @keyframes fadeInRow {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .sec-time {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px; color: rgba(232,233,243,0.25); flex-shrink: 0;
        }
        .sec-action { font-size: 11.5px; color: rgba(232,233,243,0.55); flex: 1; }
        .sec-status {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px; font-weight: 700; flex-shrink: 0;
        }
        .sec-status.ok      { color: #34d399; }
        .sec-status.blocked { color: #f87171; }

        /* ── Simplicity card internals ── */
        .simp-input-wrap {
          display: flex; align-items: flex-start; gap: 10px;
          background: rgba(0,0,0,0.2);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px; padding: 14px;
          margin-top: 4px; min-height: 60px;
        }
        .simp-avatar {
          width: 30px; height: 30px;
          background: linear-gradient(135deg, #7c83f5, #a78bfa);
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 700; color: white; flex-shrink: 0;
        }
        .simp-bubble {
          flex: 1; display: flex; align-items: center; gap: 2px;
        }
        .simp-text {
          font-size: 13.5px; color: rgba(232,233,243,0.7);
          letter-spacing: -0.01em;
          animation: slideInText 0.35s ease;
        }
        @keyframes slideInText {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .simp-cursor {
          display: inline-block; width: 2px; height: 15px;
          background: #7c83f5; border-radius: 1px;
          animation: blink 1s step-end infinite; flex-shrink: 0;
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .simp-tags { display: flex; flex-wrap: wrap; gap: 7px; }
        .simp-tag {
          font-size: 11.5px; color: rgba(232,233,243,0.4);
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          padding: 4px 11px; border-radius: 100px;
          transition: color 0.2s, border-color 0.2s, background 0.2s;
          cursor: default;
        }
        .simp-tag:hover {
          color: #a78bfa; border-color: rgba(167,139,250,0.3);
          background: rgba(167,139,250,0.08);
        }

        /* ── Reliability card internals ── */
        .rel-states {
          display: flex; align-items: center; gap: 8px;
          flex-wrap: wrap; margin-top: 4px;
        }
        .rel-state {
          display: flex; align-items: center; gap: 9px;
          background: rgba(0,0,0,0.2);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px; padding: 10px 12px; flex: 1; min-width: 0;
        }
        .rel-dot {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
        }
        .rel-dot.green  { background: #34d399; box-shadow: 0 0 6px rgba(52,211,153,0.5); }
        .rel-dot.amber  { background: #fbbf24; box-shadow: 0 0 6px rgba(251,191,36,0.4); }
        .rel-dot.violet { background: #a78bfa; box-shadow: 0 0 6px rgba(167,139,250,0.4); }
        .rel-arrow-h {
          font-size: 14px; color: rgba(232,233,243,0.2); flex-shrink: 0;
        }
        .rel-state-name {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10.5px; font-weight: 700; color: rgba(232,233,243,0.7);
          letter-spacing: 0.05em;
        }
        .rel-state-sub { font-size: 10px; color: rgba(232,233,243,0.3); margin-top: 2px; }

        /* ── Footer ── */
        .zf-footer {
          margin-top: 60px; display: flex; align-items: center;
          justify-content: center; gap: 16px;
        }
        .zf-footer-line {
          flex: 1; max-width: 200px; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07));
        }
        .zf-footer-line:last-child {
          background: linear-gradient(270deg, transparent, rgba(255,255,255,0.07));
        }
        .zf-footer-text {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px; color: rgba(232,233,243,0.25);
          letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap;
        }

        /* ── Responsive ── */
        @media (max-width: 1000px) {
          .bento-speed      { grid-column: span 6; }
          .bento-accuracy   { grid-column: span 6; }
          .bento-cost       { grid-column: span 4; }
          .bento-security   { grid-column: span 4; }
          .bento-reliability{ grid-column: span 4; }
          .bento-simplicity { grid-column: span 12; }
          .simp-input-wrap  { max-width: 480px; }
        }

        @media (max-width: 680px) {
          .bento-grid { grid-template-columns: 1fr; gap: 12px; }
          .bento-speed, .bento-accuracy, .bento-cost,
          .bento-security, .bento-reliability, .bento-simplicity {
            grid-column: span 1;
          }
          .zf-section { padding: 80px 16px 90px; }
          .zf-head { margin-bottom: 44px; }
          .rel-states { flex-direction: column; }
          .rel-arrow-h { transform: rotate(90deg); }
        }
      `}</style>

      <section className="zf-section">
        <div className="zf-orb-a" />
        <div className="zf-orb-b" />

        <div className="zf-inner">

          {/* Header */}
          <div className="zf-head" ref={headRef}>
            <span className={`zf-eyebrow ${headIn ? 'vis' : ''}`}>
              <span className="zf-eyebrow-dot" />
              Why Zenntraa
            </span>
            <h2 className={`zf-h2 ${headIn ? 'vis' : ''}`}>
              Built for <span className="hl">precision</span>,<br />not approximation.
            </h2>
            <p className={`zf-sub ${headIn ? 'vis' : ''}`}>
              Every design decision optimizes for one thing — getting your finance team
              the exact right answer as fast as possible, without burning tokens to get there.
            </p>
          </div>

          {/* Bento grid */}
          <div className="bento-grid" ref={secRef}>
            <SpeedCard inView={secIn} />
            <AccuracyCard inView={secIn} />
            <CostCard inView={secIn} />
            <SecurityCard />
            <ReliabilityCard />
            <SimplicityCard />
          </div>

          <div className="zf-footer">
            <div className="zf-footer-line" />
            <span className="zf-footer-text">No vector search · No guessing · No fluff</span>
            <div className="zf-footer-line" />
          </div>

        </div>
      </section>
    </>
  );
}