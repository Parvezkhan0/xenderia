'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Send,
  Loader2,
  Database,
  Clock,
  History,
  BarChart2,
  Zap,
} from 'lucide-react';
import {
  postQuery,
  isAPIError,
  getEntitlements,
  getDatabaseStatus,
  getQueryHistory,
} from '@/lib/api';
import type {
  QueryResponse,
  QueryHistoryItem,
} from '@/lib/api';

interface HistoryItem {
  id: string;
  query: string;
  response: QueryResponse;
  timestamp: Date;
}

const DEMO_SUGGESTIONS = [
  { icon: '📈', text: 'What was the highest revenue quarter?' },
  { icon: '🏢', text: "What is TechCorp's latest revenue?" },
  { icon: '🔍', text: 'Show me all Technology sector companies' },
  { icon: '📊', text: 'Compare Q1 and Q2 2024 profits' },
  { icon: '🏆', text: 'Top 5 companies by market cap' },
];

const CONNECTED_SUGGESTIONS = [
  { icon: '🗂️', text: 'Show me all tables in this database' },
  { icon: '🏢', text: 'What companies are in this database?' },
  { icon: '📈', text: 'Which company has the highest revenue?' },
  { icon: '📉', text: 'Show revenue trends for the last year' },
  { icon: '📊', text: 'Compare quarterly profits' },
];

const CSV_SUGGESTIONS = [
  { icon: '📋', text: 'What columns are in my data?' },
  { icon: '🔢', text: 'How many rows are there in total?' },
  { icon: '📊', text: 'Summarize the key numbers' },
  { icon: '🏆', text: 'Show the top 10 rows by the largest value' },
  { icon: '🔎', text: 'Find duplicates or outliers' },
];

function CacheBadge({ hit, latency }: { hit: boolean; latency: number }) {
  return (
    <span className={`cb ${hit ? 'cb-hit' : 'cb-miss'}`}>
      <span className="cb-dot" />
      {hit ? 'Cache hit' : 'Cache miss'}
      <span className="cb-sep">·</span>
      {latency}ms
    </span>
  );
}

function formatFinancialNumbers(text: string): string {
  return text.replace(/\$[\d,]+(\.\d+)?/g, (match) => {
    const num = parseFloat(match.replace(/[$,]/g, ''));
    if (isNaN(num)) return match;
    if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`;
    if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  });
}

// Parse a server timestamp into a Date. If the string has no timezone marker
// (older rows saved before the UTC fix), treat it as UTC so it isn't misread as
// local time. The browser then localizes it to the viewer's own timezone.
function parseServerDate(s?: string): Date {
  if (!s) return new Date();
  const hasTz = /([zZ])$|[+-]\d{2}:?\d{2}$/.test(s);
  return new Date(hasTz ? s : s + 'Z');
}

// Friendly, non-technical time. Always in the viewer's own local timezone
// (toLocale* reads the browser's timezone automatically — no library needed).
//   < 1 min   → "Just now"
//   < 60 min  → "5 min ago"
//   today     → "Today, 2:30 PM"
//   yesterday → "Yesterday, 2:30 PM"
//   older     → "Aug 15, 2:30 PM"  (adds year if different year)
function formatFriendlyTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayDiff = Math.floor(
    (startOfToday.getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime())
    / 86400000
  );

  if (dayDiff <= 0) return `Today, ${time}`;
  if (dayDiff === 1) return `Yesterday, ${time}`;

  const sameYear = date.getFullYear() === now.getFullYear();
  const day = date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  return `${day}, ${time}`;
}

// Inline markdown within a single line: `code`, **bold**, *italic* / _italic_.
// Order matters — bold (**) is matched before italic (*).
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g);
  return parts.map((part, pi) => {
    const key = `${keyBase}-${pi}`;
    if (!part) return null;
    if (part.length >= 2 && part.startsWith('`') && part.endsWith('`')) {
      return <code key={key} className="ans-code">{part.slice(1, -1)}</code>;
    }
    if (part.length >= 4 && part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.length >= 2 && part.startsWith('*') && part.endsWith('*')) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    if (part.length >= 2 && part.startsWith('_') && part.endsWith('_')) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function renderAnswer(text: string) {
  text = formatFinancialNumbers(text);
  const lines = text.split('\n');
  const output: React.ReactNode[] = [];
  let i = 0;
  let elementKey = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Table ──
    if (line.includes('|') && lines[i + 1] && /^\|?[\s\-:|]+\|/.test(lines[i + 1])) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i]);
        i++;
      }

      const parseRow = (row: string) =>
        row.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());

      const headers = parseRow(tableLines[0]);
      const bodyRows = tableLines.slice(2);
      const tk = elementKey++;

      output.push(
        <div key={`table-${tk}`} className="ans-table-wrap">
          <table className="ans-table">
            <thead>
              <tr>{headers.map((h, ci) => <th key={`th-${ci}`}>{renderInline(h, `th-${tk}-${ci}`)}</th>)}</tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={`tr-${ri}`}>
                  {parseRow(row).map((cell, ci) => <td key={`td-${ri}-${ci}`}>{renderInline(cell, `td-${tk}-${ri}-${ci}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // ── Heading (# … ######) ──
    const hMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (hMatch) {
      const level = hMatch[1].length;
      const cls = `ans-h ans-h${Math.min(level, 3)}`;
      const hk = elementKey++;
      const inner = renderInline(hMatch[2], `h-${hk}`);
      if (level <= 2) output.push(<h3 key={`h-${hk}`} className={cls}>{inner}</h3>);
      else if (level === 3) output.push(<h4 key={`h-${hk}`} className={cls}>{inner}</h4>);
      else output.push(<h5 key={`h-${hk}`} className={cls}>{inner}</h5>);
      i++;
      continue;
    }

    // ── Unordered list ──
    if (/^\s*[-*]\s+/.test(line)) {
      const lk = elementKey++;
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        const content = lines[i].replace(/^\s*[-*]\s+/, '');
        items.push(<li key={`uli-${lk}-${items.length}`}>{renderInline(content, `uli-${lk}-${items.length}`)}</li>);
        i++;
      }
      output.push(<ul key={`ul-${lk}`} className="ans-list">{items}</ul>);
      continue;
    }

    // ── Ordered list ──
    if (/^\s*\d+\.\s+/.test(line)) {
      const lk = elementKey++;
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        const content = lines[i].replace(/^\s*\d+\.\s+/, '');
        items.push(<li key={`oli-${lk}-${items.length}`}>{renderInline(content, `oli-${lk}-${items.length}`)}</li>);
        i++;
      }
      output.push(<ol key={`ol-${lk}`} className="ans-list">{items}</ol>);
      continue;
    }

    // ── Blank line ──
    if (line.trim() === '') {
      output.push(<br key={`br-${elementKey++}`} />);
      i++;
      continue;
    }

    // ── Paragraph ──
    const pk = elementKey++;
    output.push(<p key={`p-${pk}`} className="ans-text">{renderInline(line, `p-${pk}`)}</p>);
    i++;
  }

  return <div className="ans-content">{output}</div>;
}

function QuotaBanner({ plan, onUpgrade, onDismiss }: {
  plan: 'free' | 'pro';
  onUpgrade: () => void;
  onDismiss: () => void;
}) {
  const isPro = plan === 'pro';

  return (
    <div className="quota-banner">
      <div className="quota-banner-icon">{isPro ? '📅' : '⚡'}</div>
      <div className="quota-banner-body">
        <div className="quota-banner-title">
          {isPro
            ? 'Monthly limit reached'
            : 'You\'ve used all 50 free queries'}
        </div>
        <div className="quota-banner-msg">
          {isPro
            ? 'You\'ve used all 1,000 queries for this month. Your quota resets on the 1st.'
            : 'Upgrade to Pro for 1,000 queries/month and connect your own PostgreSQL database.'}
        </div>
      </div>
      <div className="quota-banner-actions">
        {!isPro && (
          <button className="quota-upgrade-btn" onClick={onUpgrade}>
            <Zap size={12} />
            Upgrade to Pro
          </button>
        )}
        <button className="quota-dismiss-btn" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

export default function QueryPage() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [error, setError] = useState('');
  const [errorKind, setErrorKind] = useState<'error' | 'rate_limit'>('error');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [dbConnected, setDbConnected] = useState(false);
  const [dbSource, setDbSource] = useState<'demo' | 'postgres' | 'csv' | 'federated'>('demo');
  const [plan, setPlan] = useState<'free' | 'pro'>('free');
  const [quotaBanner, setQuotaBanner] = useState<{ plan: 'free' | 'pro' } | null>(null);
  const [checkoutStatus, setCheckoutStatus] =
    useState<'idle' | 'processing' | 'success' | 'timeout'>('idle');

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (history.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history]);

  useEffect(() => {
    const mapSavedHistoryToUI = (items: QueryHistoryItem[]): HistoryItem[] => {
      return [...items]
        .sort((a, b) => {
          const aTime = a.created_at ? parseServerDate(a.created_at).getTime() : 0;
          const bTime = b.created_at ? parseServerDate(b.created_at).getTime() : 0;
          return bTime - aTime;
        })
        .map((item) => ({
          id: item.query_id,
          query: item.query,
          response: {
            answer: item.answer,
            cache_hit: item.cache_hit,
            latency_ms: item.latency_ms,
            query_id: item.query_id,
          },
          timestamp: item.created_at ? parseServerDate(item.created_at) : new Date(),
        }));
    };

    const syncStateFromBackend = async () => {
      try {
        const [entitlements, dbStatus, savedHistory] = await Promise.all([
          getEntitlements(),
          getDatabaseStatus(),
          getQueryHistory(50),
        ]);

        if (!isAPIError(entitlements)) {
          setPlan(entitlements.plan);
        } else {
          setPlan('free');
        }

        if (!isAPIError(dbStatus)) {
          setDbConnected(Boolean(dbStatus.connected));
          setDbSource(dbStatus.source ?? (dbStatus.connected ? 'postgres' : 'demo'));
        } else {
          setDbConnected(false);
          setDbSource('demo');
        }

        if (!isAPIError(savedHistory)) {
          setHistory(mapSavedHistoryToUI(savedHistory.items));
        } else {
          setHistory([]);
        }
      } catch {
        setDbConnected(false);
        setHistory([]);
      } finally {
        setBootLoading(false);
      }
    };

    syncStateFromBackend();
    window.addEventListener('zenntraa:query', syncStateFromBackend);

    return () => {
      window.removeEventListener('zenntraa:query', syncStateFromBackend);
    };
  }, []);

  // Post-checkout polling: when the user returns from Razorpay with
  // ?checkout=processing, Pro is granted asynchronously by the subscription
  // webhook and may not be reflected yet. Poll entitlements until it flips to
  // 'pro' (or time out), so the user sees a clear status instead of appearing
  // as a free user during the webhook race.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') !== 'processing') return;

    // Strip the param so a manual refresh doesn't re-trigger the flow.
    window.history.replaceState(null, '', '/dashboard/query');

    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 10;   // ~30s total
    const INTERVAL_MS = 3000;

    setCheckoutStatus('processing');

    const poll = async () => {
      if (cancelled) return;
      attempts += 1;

      const ent = await getEntitlements();
      if (cancelled) return;

      if (!isAPIError(ent) && ent.plan === 'pro') {
        setPlan('pro');
        setCheckoutStatus('success');
        // Refresh db status / history now that Pro is active.
        window.dispatchEvent(new Event('zenntraa:query'));
        return;
      }

      if (attempts >= MAX_ATTEMPTS) {
        setCheckoutStatus('timeout');
        return;
      }
      setTimeout(poll, INTERVAL_MS);
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (q?: string) => {
    const query = (q ?? input).trim();
    if (!query || loading) return;

    setInput('');
    setError('');
    setQuotaBanner(null);
    setLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const result = await postQuery(query);

    if (isAPIError(result)) {
      if (result.status === 402) {
        const quotaPlan = result.plan === 'pro' ? 'pro' : plan;
        setQuotaBanner({ plan: quotaPlan });

        if (quotaPlan === 'free') {
          setTimeout(() => router.push('/pricing'), 2500);
        }
      } else if (result.status === 429) {
        setErrorKind('rate_limit');
        setError(result.message);
      } else {
        setErrorKind('error');
        setError(result.message);
      }
    } else {
      window.dispatchEvent(new Event('zenntraa:query'));
    }

    setLoading(false);
    textareaRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const suggestions =
    dbSource === 'csv' ? CSV_SUGGESTIONS : dbConnected ? CONNECTED_SUGGESTIONS : DEMO_SUGGESTIONS;
  const cacheHits = history.filter((h) => h.response.cache_hit).length;
  const avgLatency = history.length
    ? Math.round(history.reduce((a, h) => a + h.response.latency_ms, 0) / history.length)
    : 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

        :root {
          --bg:        #11112b;
          --bg-panel:  #0d0d22;
          --bg-card:   rgba(255,255,255,0.03);
          --bg-input:  rgba(255,255,255,0.04);
          --border:    rgba(255,255,255,0.08);
          --border-s:  rgba(255,255,255,0.05);
          --text:      #e8e9f3;
          --muted:     rgba(232,233,243,0.45);
          --dim:       rgba(232,233,243,0.25);
          --accent:    #7c83f5;
          --accent-2:  #a78bfa;
          --as:        rgba(124,131,245,0.1);
          --as2:       rgba(124,131,245,0.18);
          --green:     #34d399;
          --gs:        rgba(52,211,153,0.1);
          --amber:     #fbbf24;
          --mono:      'JetBrains Mono', monospace;
          --sans:      'Sora', sans-serif;
        }

        .zq-root {
          display: flex;
          height: calc(100vh - 64px);
          background: var(--bg);
          font-family: var(--sans);
          overflow: hidden;
        }

        .zq-sidebar {
          width: 240px;
          flex-shrink: 0;
          background: var(--bg-panel);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .zq-sidebar-hdr {
          padding: 20px 16px 14px;
          border-bottom: 1px solid var(--border-s);
        }

        .zq-sidebar-title {
          font-family: var(--mono);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--dim);
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 12px;
        }

        .zq-mini-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .zq-mini-stat {
          background: var(--bg-card);
          border: 1px solid var(--border-s);
          border-radius: 8px;
          padding: 10px 10px;
        }

        .zq-mini-stat-val {
          font-family: var(--mono);
          font-size: 18px;
          font-weight: 700;
          color: var(--text);
          letter-spacing: -0.03em;
          line-height: 1;
        }

        .zq-mini-stat-label {
          font-size: 10px;
          color: var(--dim);
          margin-top: 3px;
          letter-spacing: -0.01em;
        }

        .zq-hist-label {
          font-family: var(--mono);
          font-size: 9.5px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--dim);
          padding: 14px 16px 8px;
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .zq-hist-list {
          flex: 1;
          overflow-y: auto;
          padding: 0 8px 12px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .zq-hist-empty {
          padding: 20px 12px;
          text-align: center;
          font-size: 12px;
          color: var(--dim);
          line-height: 1.6;
        }

        .zq-hist-item {
          padding: 9px 10px;
          border-radius: 8px;
          border: none;
          background: none;
          text-align: left;
          width: 100%;
          cursor: pointer;
          transition: background 0.15s;
        }

        .zq-hist-item:hover { background: rgba(255,255,255,0.04); }

        .zq-hist-q {
          font-size: 12px;
          color: var(--muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: block;
          margin-bottom: 4px;
          letter-spacing: -0.01em;
        }

        .zq-hist-meta { display: flex; align-items: center; gap: 6px; }

        .zq-hist-badge {
          font-family: var(--mono);
          font-size: 9px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 4px;
          letter-spacing: 0.04em;
        }

        .zq-hist-badge.hit { background: var(--gs); color: var(--green); }
        .zq-hist-badge.miss { background: rgba(251,191,36,0.08); color: var(--amber); }

        .zq-hist-time { font-family: var(--mono); font-size: 9px; color: var(--dim); }

        .zq-main {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
        }

        .zq-topbar {
          flex-shrink: 0;
          padding: 18px 28px 0;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .zq-topbar-eye {
          font-family: var(--mono);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(124,131,245,0.7);
          margin-bottom: 4px;
        }

        .zq-topbar-title {
          font-size: 22px;
          font-weight: 800;
          color: var(--text);
          letter-spacing: -0.04em;
          line-height: 1.1;
        }

        .zq-topbar-title .hl {
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .zq-db-chip {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 6px 12px;
          border-radius: 100px;
          font-family: var(--mono);
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.04em;
          border: 1px solid;
          flex-shrink: 0;
        }

        .zq-db-chip.connected { background: var(--gs); color: var(--green); border-color: rgba(52,211,153,0.2); }
        .zq-db-chip.demo { background: var(--as); color: var(--accent); border-color: rgba(124,131,245,0.2); }

        .zq-db-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: currentColor; animation: pulse 2s ease infinite;
        }

        @keyframes pulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50%     { opacity: .4; transform: scale(.8); }
        }

        .zq-scroll {
          flex: 1;
          min-width: 0;
          overflow-y: auto;
          padding: 20px 28px;
          display: flex;
          flex-direction: column;
        }

        .zq-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 40px 16px;
          gap: 0;
        }

        .zq-empty-icon {
          width: 52px; height: 52px;
          background: var(--as);
          border: 1px solid rgba(124,131,245,0.2);
          border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          font-size: 22px; margin-bottom: 18px;
        }

        .zq-empty-title { font-size: 18px; font-weight: 700; color: var(--text); letter-spacing: -0.03em; margin-bottom: 10px; }

        .zq-empty-sub {
          font-size: 13.5px; color: var(--muted);
          max-width: 560px; line-height: 1.7; letter-spacing: -0.01em; margin-bottom: 24px;
        }

        .zq-nosource {
          display: flex; align-items: center; gap: 14px;
          width: 100%; max-width: 560px;
          background: var(--as); border: 1px solid rgba(124,131,245,0.25);
          border-radius: 12px; padding: 14px 16px; margin-bottom: 24px;
          text-align: left;
        }
        .zq-nosource-icon {
          width: 34px; height: 34px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: rgba(124,131,245,0.15); color: var(--accent);
          border-radius: 9px;
        }
        .zq-nosource-body { flex: 1; }
        .zq-nosource-title { font-size: 13px; font-weight: 700; color: var(--text); letter-spacing: -0.01em; }
        .zq-nosource-text { font-size: 12px; color: var(--muted); line-height: 1.6; margin-top: 3px; }
        .zq-nosource-btn {
          flex-shrink: 0; cursor: pointer;
          font-family: var(--sans); font-size: 12px; font-weight: 600;
          color: #fff; background: var(--accent); border: none;
          padding: 8px 14px; border-radius: 8px; white-space: nowrap;
          transition: opacity .15s ease, transform .15s ease;
        }
        .zq-nosource-btn:hover { opacity: 0.9; transform: translateY(-1px); }

        .zq-suggestions { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; width: 100%; max-width: 560px; }

        .zq-chip {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 14px; background: var(--bg-card);
          border: 1px solid var(--border); border-radius: 12px;
          font-size: 12.5px; color: var(--muted); cursor: pointer;
          text-align: left; transition: border-color 0.2s, color 0.2s, background 0.2s, transform 0.15s;
          letter-spacing: -0.01em;
        }

        .zq-chip:hover { border-color: rgba(124,131,245,0.3); color: var(--text); background: var(--as); transform: translateY(-2px); }

        .zq-chip-emoji {
          font-size: 16px; flex-shrink: 0; width: 28px; height: 28px;
          background: rgba(255,255,255,0.05); border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
        }

        .zq-chip:last-child:nth-child(odd) { grid-column: span 2; }

        .zq-messages { display: flex; flex-direction: column; gap: 0; }

        .zq-card {
          display: flex; flex-direction: column; gap: 16px;
          padding: 22px 0; border-bottom: 1px solid var(--border-s);
          animation: fadeUp 0.3s ease both;
        }

        .zq-card:last-child { border-bottom: none; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .zq-you { display: flex; justify-content: flex-end; }

        .zq-you-bubble {
          background: var(--as); border: 1px solid rgba(124,131,245,0.18);
          border-radius: 14px 14px 4px 14px; padding: 12px 16px; max-width: 65%;
        }

        .zq-you-label {
          font-family: var(--mono); font-size: 9px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: rgba(124,131,245,0.6); margin-bottom: 5px;
        }

        .zq-you-text { font-size: 13.5px; color: var(--text); line-height: 1.55; letter-spacing: -0.01em; margin: 0; }

        .zq-ans { display: flex; align-items: flex-start; gap: 12px; }

        .zq-ans-avatar {
          width: 30px; height: 30px;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          border-radius: 9px; display: flex; align-items: center; justify-content: center;
          font-family: var(--mono); font-size: 11px; font-weight: 700; color: #fff;
          flex-shrink: 0; margin-top: 2px; box-shadow: 0 2px 8px rgba(124,131,245,0.3);
        }

        .zq-ans-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }

        .zq-ans-hdr { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

        .zq-ans-name { font-size: 13px; font-weight: 700; color: var(--text); letter-spacing: -0.02em; }

        .cb {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 9px; border-radius: 100px;
          font-family: var(--mono); font-size: 10px; font-weight: 600; letter-spacing: 0.03em;
        }

        .cb-hit { background: var(--gs); border: 1px solid rgba(52,211,153,0.2); color: var(--green); }
        .cb-miss { background: rgba(251,191,36,0.08); border: 1px solid rgba(251,191,36,0.2); color: var(--amber); }
        .cb-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
        .cb-sep { opacity: 0.4; }

        .ans-content { display: flex; flex-direction: column; gap: 6px; }
        .ans-text { font-size: 14px; color: var(--muted); line-height: 1.75; margin: 0; letter-spacing: -0.01em; }

        .ans-h { color: var(--text); font-weight: 700; letter-spacing: -0.02em; line-height: 1.4; margin: 8px 0 2px; }
        .ans-h1 { font-size: 17px; }
        .ans-h2 { font-size: 15px; }
        .ans-h3 { font-size: 13.5px; }
        .ans-list { margin: 2px 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; }
        .ans-list li { font-size: 14px; color: var(--muted); line-height: 1.7; letter-spacing: -0.01em; }
        .ans-list li::marker { color: var(--accent); }
        .ans-code {
          font-family: var(--mono); font-size: 12.5px;
          background: rgba(255,255,255,0.06); color: var(--text);
          padding: 1px 6px; border-radius: 5px;
        }
        .ans-content em { font-style: italic; }

        .ans-table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 10px; margin: 4px 0; }

        .ans-table { width: 100%; border-collapse: collapse; font-family: var(--mono); font-size: 12px; }

        .ans-table thead tr { background: rgba(0,0,0,0.2); border-bottom: 1px solid var(--border); }

        .ans-table th {
          padding: 9px 16px; text-align: left; color: var(--accent);
          font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; font-size: 10px; white-space: nowrap;
        }

        .ans-table td { padding: 8px 16px; color: var(--muted); border-bottom: 1px solid rgba(255,255,255,0.04); white-space: nowrap; }
        .ans-table tbody tr:last-child td { border-bottom: none; }
        .ans-table tbody tr:hover td { background: rgba(255,255,255,0.02); color: var(--text); }

        .zq-ans-meta { display: flex; align-items: center; gap: 14px; }

        .zq-meta-item { display: flex; align-items: center; gap: 4px; font-family: var(--mono); font-size: 10px; color: var(--dim); }

        .zq-loading { display: flex; align-items: center; gap: 12px; padding: 20px 0; animation: fadeUp 0.2s ease; }

        .zq-loading-avatar {
          width: 30px; height: 30px;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          border-radius: 9px; display: flex; align-items: center; justify-content: center;
          font-family: var(--mono); font-size: 11px; font-weight: 700; color: #fff;
        }

        .zq-loading-text { font-size: 13px; color: var(--dim); display: flex; align-items: center; gap: 10px; }

        .zq-dots { display: flex; gap: 4px; align-items: center; }

        .zq-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); animation: dotb 1.2s ease infinite; }
        .zq-dot:nth-child(2) { animation-delay: 0.15s; }
        .zq-dot:nth-child(3) { animation-delay: 0.3s; }

        @keyframes dotb {
          0%,80%,100% { opacity: 0.2; transform: scale(0.8); }
          40%         { opacity: 1; transform: scale(1.1); }
        }

        .zq-error {
          margin: 0 28px 0; padding: 10px 14px;
          background: rgba(239,68,68,0.07); border: 1px solid rgba(239,68,68,0.18);
          border-radius: 10px; font-family: var(--mono); font-size: 11.5px; color: #f87171; flex-shrink: 0;
        }

        .zq-error-warn {
          background: rgba(251,191,36,0.07); border-color: rgba(251,191,36,0.18); color: var(--amber);
        }

        .quota-banner {
          margin: 0 28px 0;
          padding: 14px 16px;
          background: rgba(124,131,245,0.07);
          border: 1px solid rgba(124,131,245,0.25);
          border-radius: 12px;
          display: flex; align-items: flex-start; gap: 12px;
          flex-shrink: 0;
          animation: fadeUp 0.3s ease;
        }

        .quota-banner-icon { font-size: 20px; flex-shrink: 0; margin-top: 1px; }

        .quota-banner-body { flex: 1; }

        .quota-banner-title {
          font-size: 13.5px; font-weight: 700; color: var(--text);
          letter-spacing: -0.02em; margin-bottom: 4px;
        }

        .quota-banner-msg { font-size: 12.5px; color: var(--muted); line-height: 1.6; letter-spacing: -0.01em; }

        .quota-banner-actions { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }

        .quota-upgrade-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 14px; white-space: nowrap;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: #fff; border: none; border-radius: 8px;
          font-family: var(--sans); font-size: 12px; font-weight: 600;
          cursor: pointer; transition: opacity 0.15s, transform 0.15s;
        }

        .quota-upgrade-btn:hover { opacity: 0.9; transform: translateY(-1px); }

        .quota-dismiss-btn {
          background: none; border: none; color: var(--dim);
          font-family: var(--sans); font-size: 11px; cursor: pointer;
          text-align: center; transition: color 0.15s;
        }

        .quota-dismiss-btn:hover { color: var(--muted); }

        .zq-bar { flex-shrink: 0; padding: 14px 28px 20px; }

        .zq-bar-card {
          background: var(--bg-input); border: 1px solid var(--border);
          border-radius: 14px; padding: 12px 14px;
          display: flex; align-items: flex-end; gap: 10px;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-shadow: 0 4px 24px rgba(0,0,0,0.2);
        }

        .zq-bar-card:focus-within {
          border-color: rgba(124,131,245,0.35);
          box-shadow: 0 4px 24px rgba(0,0,0,0.2), 0 0 0 3px rgba(124,131,245,0.06);
        }

        .zq-textarea {
          flex: 1; background: none; border: none; outline: none; resize: none;
          font-family: var(--sans); font-size: 14px; color: var(--text);
          line-height: 1.55; min-height: 24px; max-height: 120px;
          overflow-y: auto; letter-spacing: -0.01em;
        }

        .zq-textarea::placeholder { color: var(--dim); }

        .zq-send {
          width: 34px; height: 34px;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          border: none; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: #fff; flex-shrink: 0;
          box-shadow: 0 2px 10px rgba(124,131,245,0.3);
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
        }

        .zq-send:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(124,131,245,0.45); }
        .zq-send:disabled { opacity: 0.3; cursor: not-allowed; transform: none; }

        .zq-bar-hint { margin-top: 8px; text-align: center; font-family: var(--mono); font-size: 10px; color: var(--dim); letter-spacing: 0.04em; }

        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 720px) {
          .zq-sidebar { display: none; }
          .zq-scroll, .zq-bar, .zq-topbar { padding-left: 16px; padding-right: 16px; }
          .zq-you-bubble { max-width: 88%; }
          .zq-suggestions { grid-template-columns: 1fr; }
          .zq-chip:last-child:nth-child(odd) { grid-column: span 1; }
          .quota-banner { flex-direction: column; }
          .quota-banner-actions { flex-direction: row; }
        }
      `}</style>

      <div className="zq-root">
        <aside className="zq-sidebar">
          <div className="zq-sidebar-hdr">
            <div className="zq-sidebar-title">
              <BarChart2 size={11} />
              Session Stats
            </div>
            <div className="zq-mini-stats">
              <div className="zq-mini-stat">
                <div className="zq-mini-stat-val">{history.length}</div>
                <div className="zq-mini-stat-label">Queries</div>
              </div>
              <div className="zq-mini-stat">
                <div className="zq-mini-stat-val">{cacheHits}</div>
                <div className="zq-mini-stat-label">Cache hits</div>
              </div>
              <div className="zq-mini-stat">
                <div className="zq-mini-stat-val">{avgLatency ? `${avgLatency}ms` : '—'}</div>
                <div className="zq-mini-stat-label">Avg latency</div>
              </div>
              <div className="zq-mini-stat">
                <div className="zq-mini-stat-val">
                  {history.length ? `${Math.round((cacheHits / history.length) * 100)}%` : '—'}
                </div>
                <div className="zq-mini-stat-label">Hit rate</div>
              </div>
            </div>
          </div>

          <div className="zq-hist-label">
            <History size={10} />
            Recent
          </div>

          <div className="zq-hist-list">
            {history.length === 0 ? (
              <div className="zq-hist-empty">Your queries<br />will appear here</div>
            ) : (
              history.map((item) => (
                <button
                  key={item.id}
                  className="zq-hist-item"
                  onClick={() => setInput(item.query)}
                  title={item.query}
                >
                  <span className="zq-hist-q">{item.query}</span>
                  <div className="zq-hist-meta">
                    <span className={`zq-hist-badge ${item.response.cache_hit ? 'hit' : 'miss'}`}>
                      {item.response.cache_hit ? 'HIT' : 'MISS'}
                    </span>
                    <span className="zq-hist-time">
                      {formatFriendlyTime(item.timestamp)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <div className="zq-main">
          {history.length === 0 && (
            <div className="zq-topbar">
              <div className="zq-topbar-left">
                <div className="zq-topbar-eye">Query Engine</div>
                <h1 className="zq-topbar-title">
                  Ask your <span className="hl">data</span> anything
                </h1>
              </div>

              {dbSource === 'federated' ? (
                <div className="zq-db-chip connected">
                  <span className="zq-db-dot" />
                  Database + CSV
                </div>
              ) : dbSource === 'csv' ? (
                <div className="zq-db-chip connected">
                  <span className="zq-db-dot" />
                  CSV data
                </div>
              ) : plan === 'free' && !dbConnected ? (
                <div className="zq-db-chip demo">
                  <span className="zq-db-dot" />
                  Demo database
                </div>
              ) : null}
            </div>
          )}

          <div className="zq-scroll">
            {bootLoading ? (
              <div className="zq-loading">
                <div className="zq-loading-avatar">Z</div>
                <div className="zq-loading-text">
                  <div className="zq-dots">
                    <div className="zq-dot" />
                    <div className="zq-dot" />
                    <div className="zq-dot" />
                  </div>
                  Loading saved workspace…
                </div>
              </div>
            ) : history.length === 0 && !loading ? (
              <div className="zq-empty">
                <div className="zq-empty-icon">⚡</div>
                <div className="zq-empty-title">
                  {dbSource === 'federated'
                    ? 'Your database + CSVs are ready'
                    : dbSource === 'csv'
                    ? 'Your CSV is ready'
                    : dbConnected ? 'Your database is ready' : 'Ask a question to get started'}
                </div>
                <p className="zq-empty-sub">
                  {dbSource === 'federated'
                    ? 'Type in plain English. Zenntraa queries your database and uploaded CSVs together and returns exact results.'
                    : dbSource === 'csv'
                    ? 'Type in plain English. Zenntraa queries your uploaded CSV and returns exact results.'
                    : dbConnected
                    ? 'Type in plain English. Zenntraa queries your PostgreSQL database and returns exact results.'
                    : 'Type in plain English. Zenntraa converts it to SQL and returns exact answers — no guessing.'}
                </p>

                {dbSource === 'demo' && !dbConnected && (
                  <div className="zq-nosource">
                    <div className="zq-nosource-icon"><Database size={16} /></div>
                    <div className="zq-nosource-body">
                      <div className="zq-nosource-title">No data source connected</div>
                      <div className="zq-nosource-text">
                        You&apos;re exploring the built-in demo dataset. To query your own data,
                        connect a PostgreSQL database or upload a CSV in Settings.
                      </div>
                    </div>
                    <button className="zq-nosource-btn" onClick={() => router.push('/dashboard/settings')}>
                      Connect a source
                    </button>
                  </div>
                )}

                <div className="zq-suggestions">
                  {suggestions.map((s) => (
                    <button key={s.text} className="zq-chip" onClick={() => submit(s.text)}>
                      <span className="zq-chip-emoji">{s.icon}</span>
                      {s.text}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="zq-messages">
                {history.map((item) => (
                  <div key={item.id} className="zq-card">
                    <div className="zq-you">
                      <div className="zq-you-bubble">
                        <div className="zq-you-label">You</div>
                        <p className="zq-you-text">{item.query}</p>
                      </div>
                    </div>
                    <div className="zq-ans">
                      <div className="zq-ans-avatar">Z</div>
                      <div className="zq-ans-body">
                        <div className="zq-ans-hdr">
                          <span className="zq-ans-name">Zenntraa</span>
                          <CacheBadge hit={item.response.cache_hit} latency={item.response.latency_ms} />
                        </div>
                        {renderAnswer(item.response.answer)}
                        <div className="zq-ans-meta">
                          <span className="zq-meta-item">
                            <Clock size={9} />
                            {formatFriendlyTime(item.timestamp)}
                          </span>
                          <span className="zq-meta-item">ID: {item.response.query_id}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="zq-loading">
                    <div className="zq-loading-avatar">Z</div>
                    <div className="zq-loading-text">
                      <div className="zq-dots">
                        <div className="zq-dot" />
                        <div className="zq-dot" />
                        <div className="zq-dot" />
                      </div>
                      Thinking…
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {error && (
            <div className={`zq-error ${errorKind === 'rate_limit' ? 'zq-error-warn' : ''}`}>
              {errorKind === 'rate_limit' ? '⏱' : '⚠'} {error}
            </div>
          )}

          {checkoutStatus !== 'idle' && (
            <div className="quota-banner">
              <div className="quota-banner-icon">
                {checkoutStatus === 'success' ? '🎉' : checkoutStatus === 'timeout' ? '⏳' : '⚡'}
              </div>
              <div className="quota-banner-body">
                <div className="quota-banner-title">
                  {checkoutStatus === 'processing' && 'Activating your Pro subscription…'}
                  {checkoutStatus === 'success' && "You're on Pro! 🎉"}
                  {checkoutStatus === 'timeout' && 'Still activating your subscription'}
                </div>
                <div className="quota-banner-msg">
                  {checkoutStatus === 'processing' &&
                    'Payment received. This usually takes a few seconds — hang tight.'}
                  {checkoutStatus === 'success' &&
                    'Your Pro features are now unlocked — 1,000 queries/month.'}
                  {checkoutStatus === 'timeout' &&
                    'Your payment went through, but Pro is taking a moment to activate. Refresh in a bit, or contact support if it doesn\'t update.'}
                </div>
              </div>
              <div className="quota-banner-actions">
                {checkoutStatus === 'processing' ? (
                  <Loader2
                    size={16}
                    style={{ animation: 'spin .8s linear infinite', color: 'var(--accent)' }}
                  />
                ) : (
                  <button className="quota-dismiss-btn" onClick={() => setCheckoutStatus('idle')}>
                    Dismiss
                  </button>
                )}
              </div>
            </div>
          )}

          {quotaBanner && (
            <QuotaBanner
              plan={quotaBanner.plan}
              onUpgrade={() => router.push('/pricing')}
              onDismiss={() => setQuotaBanner(null)}
            />
          )}

          <div className="zq-bar">
            <div className="zq-bar-card">
              <textarea
                ref={textareaRef}
                className="zq-textarea"
                placeholder="Ask a question about your data..."
                value={input}
                rows={1}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onKeyDown={onKeyDown}
                disabled={loading}
              />
              <button
                className="zq-send"
                onClick={() => submit()}
                disabled={loading || !input.trim()}
                aria-label="Send"
              >
                {loading
                  ? <Loader2 size={14} style={{ animation: 'spin .8s linear infinite' }} />
                  : <Send size={14} />}
              </button>
            </div>
            <div className="zq-bar-hint">Enter to send · Shift+Enter for new line</div>
          </div>
        </div>
      </div>
    </>
  );
}