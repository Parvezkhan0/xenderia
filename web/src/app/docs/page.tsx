"use client";

import { useEffect, useRef, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface NavItem {
  href: string;
  label: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

// ─── Data ────────────────────────────────────────────────────────────────────

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Getting Started",
    items: [
      { href: "what-is-zenntraa", label: "What is Zenntraa?" },
      { href: "how-it-works", label: "How It Works" },
      { href: "connect-database", label: "Connect Your Database" },
      { href: "first-query", label: "Your First Query" },
    ],
  },
  {
    label: "Using Zenntraa",
    items: [
      { href: "writing-queries", label: "Writing Good Queries" },
      { href: "query-examples", label: "Query Examples" },
      { href: "reading-results", label: "Reading Results" },
      { href: "cache-indicator", label: "Cache & Speed" },
    ],
  },
  {
    label: "Reference",
    items: [
      { href: "api-reference", label: "API Reference" },
      { href: "troubleshooting", label: "Troubleshooting" },
      { href: "faq", label: "FAQ" },
    ],
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTag({ children }: { children: string }) {
  return (
    <p style={{
      fontFamily: "'DM Mono', monospace",
      fontSize: 11,
      color: "var(--z-accent)",
      textTransform: "uppercase",
      letterSpacing: "0.12em",
      marginBottom: 10,
    }}>
      {children}
    </p>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "rgba(0,229,160,0.05)",
      border: "1px solid rgba(0,229,160,0.2)",
      borderRadius: 8,
      padding: "14px 18px",
      margin: "16px 0",
      fontSize: 14,
      color: "#b0e8d0",
    }}>
      {children}
    </div>
  );
}

function WarnTip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "rgba(245,158,11,0.05)",
      border: "1px solid rgba(245,158,11,0.2)",
      borderRadius: 8,
      padding: "14px 18px",
      margin: "16px 0",
      fontSize: 14,
      color: "#fcd28a",
    }}>
      {children}
    </div>
  );
}

function Badge({ variant, children }: { variant: "green" | "blue" | "gray"; children: string }) {
  const colors = {
    green: { background: "rgba(0,229,160,0.12)", color: "var(--z-accent)" },
    blue:  { background: "rgba(0,148,255,0.12)",  color: "var(--z-accent2)" },
    gray:  { background: "rgba(107,114,128,0.15)", color: "var(--z-muted)" },
  };
  return (
    <span style={{
      display: "inline-block",
      fontFamily: "'DM Mono', monospace",
      fontSize: 10,
      padding: "2px 8px",
      borderRadius: 4,
      marginRight: 6,
      verticalAlign: "middle",
      ...colors[variant],
    }}>
      {children}
    </span>
  );
}

function Card({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{
      background: "var(--z-surface)",
      border: "1px solid var(--z-border)",
      borderRadius: 10,
      padding: 20,
    }}>
      <div style={{ fontSize: 22, marginBottom: 10 }}>{icon}</div>
      <h3 style={{
        fontFamily: "'Syne', sans-serif", fontWeight: 600,
        fontSize: 14, marginBottom: 6, color: "var(--z-text)",
      }}>
        {title}
      </h3>
      <p style={{ fontSize: 13, color: "var(--z-muted)", margin: 0 }}>{desc}</p>
    </div>
  );
}

function Step({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 18, marginBottom: 20 }}>
      <div style={{
        width: 28, height: 28, minWidth: 28,
        background: "rgba(0,229,160,0.1)",
        border: "1px solid rgba(0,229,160,0.3)",
        borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'DM Mono', monospace",
        fontSize: 12, color: "var(--z-accent)", marginTop: 2,
      }}>
        {num}
      </div>
      <div>
        <h3 style={{
          fontFamily: "'Syne', sans-serif", fontWeight: 600,
          fontSize: 15, marginBottom: 4, color: "var(--z-text)",
        }}>
          {title}
        </h3>
        <div style={{ fontSize: 14, color: "#9ca3af" }}>{children}</div>
      </div>
    </div>
  );
}

function QueryItem({
  icon, text, label, labelStyle,
}: {
  icon: string;
  text: string;
  label?: string;
  labelStyle?: React.CSSProperties;
}) {
  return (
    <div style={{
      background: "var(--z-surface2)",
      border: "1px solid var(--z-border)",
      borderRadius: 8,
      padding: "12px 16px",
      marginBottom: 8,
      display: "flex",
      alignItems: "flex-start",
      gap: 12,
    }}>
      <span style={{ fontSize: 14, marginTop: 1, opacity: 0.7 }}>{icon}</span>
      <span style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: 13, color: "#a8d8ff", flex: 1,
      }}>
        {text}
      </span>
      {label && (
        <span style={{
          fontSize: 11, color: "var(--z-muted)",
          background: "var(--z-surface)",
          border: "1px solid var(--z-border)",
          borderRadius: 4, padding: "2px 8px", whiteSpace: "nowrap",
          ...labelStyle,
        }}>
          {label}
        </span>
      )}
    </div>
  );
}

function Endpoint({ method, path }: { method?: string; path: string }) {
  return (
    <div style={{
      background: "var(--z-surface2)",
      border: "1px solid var(--z-border)",
      borderRadius: 8,
      padding: "14px 18px",
      margin: "12px 0",
      fontFamily: "'DM Mono', monospace",
      fontSize: 13,
    }}>
      {method && (
        <span style={{ color: "var(--z-accent)", marginRight: 10, fontWeight: 500 }}>
          {method}
        </span>
      )}
      <span style={{ color: "var(--z-text)" }}>{path}</span>
    </div>
  );
}

function Divider() {
  return (
    <hr style={{ border: "none", borderTop: "1px solid var(--z-border)", margin: "48px 0" }} />
  );
}

function InlineCode({ children }: { children: string }) {
  return (
    <code style={{
      fontFamily: "'DM Mono', monospace",
      fontSize: 12.5,
      background: "var(--z-surface2)",
      border: "1px solid var(--z-border)",
      borderRadius: 4,
      padding: "1px 6px",
      color: "#a8d8ff",
    }}>
      {children}
    </code>
  );
}

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | React.ReactNode)[][];
}) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", margin: "20px 0", fontSize: 13.5 }}>
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h} style={{
              textAlign: "left", padding: "10px 14px",
              background: "var(--z-surface2)",
              border: "1px solid var(--z-border)",
              fontFamily: "'DM Mono', monospace", fontSize: 11,
              color: "var(--z-muted)", textTransform: "uppercase", letterSpacing: "0.06em",
            }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} style={{
                padding: "10px 14px",
                border: "1px solid var(--z-border)",
                color: "#c9cdd8",
                verticalAlign: "top",
                background: i % 2 === 1 ? "rgba(255,255,255,0.01)" : "transparent",
              }}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FaqItem({ q, a }: { q: string; a: React.ReactNode }) {
  return (
    <div style={{ borderBottom: "1px solid var(--z-border)", padding: "18px 0" }}>
      <p style={{
        fontFamily: "'Syne', sans-serif", fontWeight: 600,
        fontSize: 15, marginBottom: 8, color: "var(--z-text)",
      }}>
        {q}
      </p>
      <p style={{ fontSize: 14, color: "#9ca3af", margin: 0 }}>{a}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("what-is-zenntraa");
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const sections = main.querySelectorAll("section[id]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { root: main, rootMargin: "-20% 0px -70% 0px" }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const h2Style: React.CSSProperties = {
    fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 24,
    letterSpacing: "-0.5px", marginBottom: 12, paddingTop: 8, color: "var(--z-text)",
  };
  const h3Style: React.CSSProperties = {
    fontFamily: "'Syne', sans-serif", fontWeight: 600,
    fontSize: 16, marginBottom: 8, color: "var(--z-text)",
  };
  const pStyle: React.CSSProperties = { marginBottom: 14, color: "#c9cdd8", fontSize: 15 };
  const sectionStyle: React.CSSProperties = { marginBottom: 72, scrollMarginTop: 32 };
  const accentStrong: React.CSSProperties = { color: "var(--z-accent)" };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap');

        :root {
          --z-bg: #0c0e12;
          --z-surface: #13161c;
          --z-surface2: #1a1e27;
          --z-border: #252a35;
          --z-accent: #00e5a0;
          --z-accent2: #0094ff;
          --z-text: #e8eaf0;
          --z-muted: #6b7280;
          --z-warn: #f59e0b;
        }

        .z-nav-btn {
          display: block;
          padding: 7px 24px;
          font-size: 13.5px;
          color: #9ca3af;
          text-decoration: none;
          border-left: 2px solid transparent;
          border-right: none;
          border-top: none;
          border-bottom: none;
          transition: all 0.15s;
          font-weight: 400;
          cursor: pointer;
          background: transparent;
          width: 100%;
          text-align: left;
          font-family: 'DM Sans', sans-serif;
          line-height: 1.7;
        }
        .z-nav-btn:hover,
        .z-nav-btn.active {
          color: var(--z-text);
          border-left-color: var(--z-accent);
          background: rgba(0,229,160,0.04);
        }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--z-border); border-radius: 3px; }
      `}</style>

      <div style={{
        display: "flex",
        minHeight: "100vh",
        background: "var(--z-bg)",
        color: "var(--z-text)",
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 300,
        lineHeight: 1.7,
      }}>

        {/* ══ SIDEBAR ══ */}
        <nav style={{
          width: 260, minWidth: 260,
          background: "var(--z-surface)",
          borderRight: "1px solid var(--z-border)",
          padding: "32px 0",
          position: "sticky", top: 0,
          height: "100vh", overflowY: "auto",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{
            padding: "0 24px 28px",
            borderBottom: "1px solid var(--z-border)",
            marginBottom: 20,
          }}>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontWeight: 800,
              fontSize: 20, letterSpacing: "-0.5px", color: "var(--z-accent)",
            }}>
              Zenntraa
            </div>
            <div style={{
              fontSize: 11, color: "var(--z-muted)",
              letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 2,
            }}>
              Documentation
            </div>
          </div>

          {NAV_SECTIONS.map((sec) => (
            <div key={sec.label}>
              <div style={{
                fontSize: 10, textTransform: "uppercase",
                letterSpacing: "0.12em", color: "var(--z-muted)",
                padding: "16px 24px 6px", fontWeight: 500,
              }}>
                {sec.label}
              </div>
              {sec.items.map((item) => (
                <button
                  key={item.href}
                  className={`z-nav-btn${activeSection === item.href ? " active" : ""}`}
                  onClick={() => scrollTo(item.href)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* ══ MAIN ══ */}
        <main
          ref={mainRef}
          style={{ flex: 1, maxWidth: 860, padding: "64px 72px", overflowY: "auto" }}
        >

          {/* ── WHAT IS ZENNTRAA ── */}
          <section id="what-is-zenntraa" style={sectionStyle}>
            <SectionTag>Introduction</SectionTag>
            <h1 style={{
              fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 40,
              lineHeight: 1.15, letterSpacing: "-1px", marginBottom: 16, color: "var(--z-text)",
            }}>
              Zenntraa{" "}
              <span style={{
                background: "linear-gradient(90deg, var(--z-accent), var(--z-accent2))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                Documentation
              </span>
            </h1>
            <p style={{ fontSize: 17, color: "#b0b8c8", marginBottom: 32, lineHeight: 1.65 }}>
              Zenntraa lets you query your financial database using plain English — no SQL, no code, no waiting.
              Just ask a question and get an exact answer in milliseconds.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, margin: "24px 0" }}>
              <Card icon="⚡" title="Sub-50ms on repeat queries"
                desc="Zenntraa remembers answers it has given before and returns them instantly from cache — zero AI cost, zero database load." />
              <Card icon="🎯" title="Exact answers, not guesses"
                desc="Unlike fuzzy AI search, Zenntraa runs real SQL queries against your database. The number you get is the number in your data." />
              <Card icon="🔒" title="Read-only & secure"
                desc="Zenntraa can only read your data — never modify or delete it. All queries are validated before execution." />
              <Card icon="💬" title="Plain English interface"
                desc="No SQL knowledge required. Ask questions the way you'd ask a colleague — Zenntraa handles the technical translation." />
            </div>
          </section>

          <Divider />

          {/* ── HOW IT WORKS ── */}
          <section id="how-it-works" style={sectionStyle}>
            <SectionTag>Architecture</SectionTag>
            <h2 style={h2Style}>How It Works</h2>
            <p style={pStyle}>
              Every time you submit a query, Zenntraa follows one of two paths depending on whether it has seen your question before.
            </p>

            <div style={{ margin: "24px 0" }}>
              <Step num={1} title="You type a question in plain English">
                Example: <em>&quot;What was TechCorp&apos;s revenue in Q1 2025?&quot;</em>
              </Step>
              <Step num={2} title="Zenntraa checks its memory (cache)">
                <div style={{ marginBottom: 6 }}>
                  <Badge variant="green">Cache Hit</Badge>
                  If Zenntraa has answered this exact question before, it returns the stored answer instantly — usually under 50ms. No AI call made, no cost incurred.
                </div>
                <div>
                  <Badge variant="blue">Cache Miss</Badge>
                  If it&apos;s a new question, Zenntraa moves to step 3.
                </div>
              </Step>
              <Step num={3} title="AI converts your question to SQL">
                An AI model reads your question, understands your database schema, and generates the correct SQL —
                like <InlineCode>SELECT revenue FROM financials WHERE quarter = &apos;Q1 2025&apos;</InlineCode>.
              </Step>
              <Step num={4} title="SQL runs securely against your database">
                The query executes in a sandboxed environment. Only <InlineCode>SELECT</InlineCode> statements are permitted —
                your data is never at risk of modification.
              </Step>
              <Step num={5} title="Answer is returned and stored">
                You receive a clean, formatted answer. Zenntraa saves it to cache so the next time anyone asks the same question, it returns in milliseconds.
              </Step>
            </div>

            <Tip>
              <strong style={accentStrong}>Why this matters for finance:</strong> In financial analysis, you often ask the same
              questions repeatedly — quarter comparisons, KPI checks, sector summaries. Zenntraa&apos;s cache turns those repeated
              lookups into near-instant responses at zero additional cost.
            </Tip>
          </section>

          <Divider />

          {/* ── CONNECT DATABASE ── */}
          <section id="connect-database" style={sectionStyle}>
            <SectionTag>Setup</SectionTag>
            <h2 style={h2Style}>Connect Your Database</h2>
            <p style={pStyle}>
              Before running queries, connect Zenntraa to your database. Navigate to{" "}
              <strong>Settings → Connect Database</strong> in your dashboard.
            </p>

            <div style={{ margin: "24px 0" }}>
              <Step num={1} title="Open Settings">
                Click the <strong>Settings</strong> icon in the left sidebar of your dashboard.
              </Step>
              <Step num={2} title="Enter your database credentials">
                Fill in your <strong>Host</strong>, <strong>Port</strong>, <strong>Database Name</strong>,{" "}
                <strong>Username</strong>, and <strong>Password</strong>. Zenntraa supports PostgreSQL databases.
              </Step>
              <Step num={3} title="Test the connection">
                Click <strong>Test Connection</strong> to verify credentials before saving. Zenntraa will confirm
                whether it can reach your database.
              </Step>
              <Step num={4} title="Activate">
                Click <strong>Connect Database</strong>. All future queries will route to your live database.
                The demo data is no longer used once you connect.
              </Step>
            </div>

            <WarnTip>
              <strong style={{ color: "var(--z-warn)" }}>Note:</strong> Zenntraa only ever reads from your database —
              it cannot write, update, or delete any records. Your data is safe.
            </WarnTip>
          </section>

          <Divider />

          {/* ── FIRST QUERY ── */}
          <section id="first-query" style={sectionStyle}>
            <SectionTag>Getting Started</SectionTag>
            <h2 style={h2Style}>Your First Query</h2>
            <p style={pStyle}>
              Once your database is connected, go to the <strong>Query</strong> page from the sidebar.
              Type your question in the input box and press Enter or click <strong>Ask</strong>.
            </p>
            <p style={pStyle}>Start simple to confirm everything is working:</p>

            <div style={{ margin: "16px 0" }}>
              <QueryItem icon="→" text="What companies are in our database?" label="Good first query" />
              <QueryItem icon="→" text="Show me all tables and what data they contain" label="Schema check" />
            </div>

            <p style={pStyle}>
              You&apos;ll see the answer below the input box, along with two key indicators: whether the result
              came from <Badge variant="green">Cache Hit</Badge> or a fresh{" "}
              <Badge variant="blue">Cache Miss</Badge>, and the response latency in milliseconds.
            </p>
          </section>

          <Divider />

          {/* ── WRITING QUERIES ── */}
          <section id="writing-queries" style={sectionStyle}>
            <SectionTag>Best Practices</SectionTag>
            <h2 style={h2Style}>Writing Good Queries</h2>
            <p style={pStyle}>
              Zenntraa understands natural language, but the more specific your question, the more accurate
              and cache-friendly the answer.
            </p>

            <h3 style={{ ...h3Style, marginTop: 24, marginBottom: 12 }}>Be specific with names and time periods</h3>
            <div style={{ margin: "16px 0" }}>
              <QueryItem icon="✗" text="Show me the revenue" label="Too vague"
                labelStyle={{ color: "#f87171", borderColor: "#4b1c1c", background: "#1c0f0f" }} />
              <QueryItem icon="✓" text="What was TechCorp's revenue in Q1 2025?" label="Specific" />
              <QueryItem icon="✓" text="Compare Q1 2025 vs Q1 2024 revenue for all technology companies" label="Even better" />
            </div>

            <h3 style={{ ...h3Style, marginTop: 24, marginBottom: 8 }}>Use exact company names</h3>
            <p style={pStyle}>
              Zenntraa queries your database directly, so company names must match what&apos;s stored.
              If a query returns no results, try the exact spelling as it appears in your data.
            </p>

            <h3 style={{ ...h3Style, marginTop: 24, marginBottom: 8 }}>Specify time periods clearly</h3>
            <p style={pStyle}>
              Use formats like <InlineCode>Q1 2025</InlineCode>, <InlineCode>2024</InlineCode>,{" "}
              <InlineCode>January 2025</InlineCode> rather than relative terms like &quot;last quarter&quot; —
              your database stores data at fixed dates, not relative ones.
            </p>

            <h3 style={{ ...h3Style, marginTop: 24, marginBottom: 12 }}>Break complex questions into parts</h3>
            <div style={{ margin: "16px 0" }}>
              <QueryItem icon="✗" text="Give me everything about all companies including trends, ratios, and forecasts"
                label="Too broad" labelStyle={{ color: "#f87171", borderColor: "#4b1c1c", background: "#1c0f0f" }} />
              <QueryItem icon="✓" text="Which sector had the highest average profit margin in 2024?" label="Focused" />
            </div>

            <Tip>
              <strong style={accentStrong}>Cache tip:</strong> Repeated queries are free and instant. If you run
              reports regularly, ask questions the same way each time — Zenntraa will serve them from cache in under 50ms.
            </Tip>
          </section>

          <Divider />

          {/* ── QUERY EXAMPLES ── */}
          <section id="query-examples" style={sectionStyle}>
            <SectionTag>Reference</SectionTag>
            <h2 style={h2Style}>Query Examples</h2>

            <h3 style={{ ...h3Style, marginBottom: 12 }}>Company information</h3>
            <div style={{ margin: "16px 0" }}>
              <QueryItem icon="→" text="Show me all companies and their sectors" />
              <QueryItem icon="→" text="Which companies are in the healthcare sector?" />
              <QueryItem icon="→" text="Show me companies ranked by market cap" />
              <QueryItem icon="→" text="How many companies are in each sector?" />
            </div>

            <h3 style={{ ...h3Style, marginTop: 24, marginBottom: 12 }}>Revenue &amp; profitability</h3>
            <div style={{ margin: "16px 0" }}>
              <QueryItem icon="→" text="What was TechCorp's Q1 2025 revenue?" />
              <QueryItem icon="→" text="Compare Q1 2025 revenue across all companies" />
              <QueryItem icon="→" text="Which company had the highest profit margin in 2024?" />
              <QueryItem icon="→" text="Show me quarterly revenue trends for 2024" />
            </div>

            <h3 style={{ ...h3Style, marginTop: 24, marginBottom: 12 }}>Comparative analysis</h3>
            <div style={{ margin: "16px 0" }}>
              <QueryItem icon="→" text="Compare TechCorp and HealthPlus financial performance in 2024" />
              <QueryItem icon="→" text="Who are the top 3 companies by revenue in each sector?" />
              <QueryItem icon="→" text="Compare 2024 vs 2023 overall revenue" />
              <QueryItem icon="→" text="Which companies have the highest year-over-year growth?" />
            </div>

            <h3 style={{ ...h3Style, marginTop: 24, marginBottom: 12 }}>Financial KPIs</h3>
            <div style={{ margin: "16px 0" }}>
              <QueryItem icon="→" text="What is the average profit margin for technology companies?" />
              <QueryItem icon="→" text="Show me revenue growth rate for TechCorp" />
              <QueryItem icon="→" text="Which sector has the best financial performance?" />
              <QueryItem icon="→" text="Give me an executive summary of Q1 2025 performance" />
            </div>
          </section>

          <Divider />

          {/* ── READING RESULTS ── */}
          <section id="reading-results" style={sectionStyle}>
            <SectionTag>Dashboard Guide</SectionTag>
            <h2 style={h2Style}>Reading Your Results</h2>
            <p style={pStyle}>
              Every query response shows four pieces of information alongside the answer:
            </p>

            <Table
              headers={["Indicator", "What it means"]}
              rows={[
                [<Badge key="hit" variant="green">Cache Hit</Badge>,
                  "Answer was retrieved from memory — no AI cost, returned in under 50ms."],
                [<Badge key="miss" variant="blue">Cache Miss</Badge>,
                  "New question — AI was called, SQL was run, answer is now cached for future use."],
                ["Latency (ms)",
                  "Total time from your question to the displayed answer. Cache hits typically show 20–50ms. First-time queries show 500–7000ms depending on complexity."],
                ["Query ID",
                  "Unique identifier for this specific query — useful if you need to report an issue."],
              ]}
            />

            <p style={pStyle}>
              Your query history is available in the sidebar so you can revisit past answers without re-running them.
            </p>
          </section>

          <Divider />

          {/* ── CACHE & SPEED ── */}
          <section id="cache-indicator" style={sectionStyle}>
            <SectionTag>Performance</SectionTag>
            <h2 style={h2Style}>Cache &amp; Speed</h2>
            <p style={pStyle}>
              Zenntraa&apos;s cache is what makes it dramatically faster and cheaper than running AI queries every time.
            </p>

            <h3 style={{ ...h3Style, marginTop: 20, marginBottom: 8 }}>Why your first query is slower</h3>
            <p style={pStyle}>
              The first time you ask a question, Zenntraa calls the AI and queries your database. This typically takes
              1–7 seconds. Every subsequent time you ask the same question, it returns in under 50ms from cache.
            </p>

            <h3 style={{ ...h3Style, marginTop: 20, marginBottom: 8 }}>Why slightly different wording causes a miss</h3>
            <p style={pStyle}>
              <em>&quot;List all companies&quot;</em> and <em>&quot;Show me all companies&quot;</em> are treated as
              different questions. For reports you run regularly, use the same wording each time to guarantee a cache hit.
            </p>

            <h3 style={{ ...h3Style, marginTop: 20, marginBottom: 8 }}>Why cached answers don&apos;t last forever</h3>
            <p style={pStyle}>
              Your database data changes — new companies get added, financial records get updated. Zenntraa&apos;s cache
              has a limited lifetime to ensure you always see fresh data rather than stale results.
            </p>

            <Tip>
              <strong style={accentStrong}>Pro tip:</strong> Run your standard report queries at the start of each
              session. After the first run they&apos;ll be cached, and every subsequent query returns instantly.
            </Tip>
          </section>

          <Divider />

          {/* ── API REFERENCE ── */}
          <section id="api-reference" style={sectionStyle}>
            <SectionTag>Developers</SectionTag>
            <h2 style={h2Style}>API Reference</h2>
            <p style={pStyle}>
              If you&apos;re integrating Zenntraa into your own tools or scripts, use the REST API directly.
            </p>

            <h3 style={{ ...h3Style, marginTop: 24, marginBottom: 10 }}>Base URL</h3>
            <Endpoint path="https://your-domain.com/api/v1" />

            <h3 style={{ ...h3Style, marginTop: 24, marginBottom: 10 }}>Authentication</h3>
            <p style={pStyle}>All requests require a Firebase Bearer token:</p>
            <Endpoint path="Authorization: Bearer <your-firebase-token>" />

            <h3 style={{ ...h3Style, marginTop: 28, marginBottom: 10 }}>POST /query</h3>
            <p style={pStyle}>Submit a natural language question and receive an answer.</p>
            <Endpoint method="POST" path="/api/v1/query" />

            <p style={{ ...pStyle, marginTop: 14, marginBottom: 8 }}><strong>Request body:</strong></p>
            <Table
              headers={["Field", "Type", "Required", "Description"]}
              rows={[
                [<InlineCode key="q">query</InlineCode>, "string", "Yes", "Your natural language question"],
              ]}
            />

            <p style={{ ...pStyle, marginTop: 14, marginBottom: 8 }}><strong>Response:</strong></p>
            <Table
              headers={["Field", "Description"]}
              rows={[
                [<InlineCode key="a">answer</InlineCode>, "The formatted answer to your question"],
                [<InlineCode key="ch">cache_hit</InlineCode>, "true if served from cache, false if fresh AI call"],
                [<InlineCode key="l">latency_ms</InlineCode>, "Total response time in milliseconds"],
                [<InlineCode key="qi">query_id</InlineCode>, "Unique ID for this query"],
              ]}
            />

            <h3 style={{ ...h3Style, marginTop: 28, marginBottom: 10 }}>GET /health</h3>
            <p style={pStyle}>Check if the Zenntraa system is online.</p>
            <Endpoint method="GET" path="/api/v1/health" />

            <h3 style={{ ...h3Style, marginTop: 28, marginBottom: 10 }}>GET /metrics</h3>
            <p style={pStyle}>Returns total query count, cache hit rate, and average latency.</p>
            <Endpoint method="GET" path="/api/v1/metrics" />

            <h3 style={{ ...h3Style, marginTop: 28, marginBottom: 10 }}>GET /cache/status</h3>
            <p style={pStyle}>Returns cache health, hit count, and hit rate.</p>
            <Endpoint method="GET" path="/api/v1/cache/status" />

            <h3 style={{ ...h3Style, marginTop: 28, marginBottom: 10 }}>Rate limits</h3>
            <Table
              headers={["Limit", "Value"]}
              rows={[
                ["Requests per user per minute", "60"],
                ["Response when exceeded", "HTTP 429"],
              ]}
            />
          </section>

          <Divider />

          {/* ── TROUBLESHOOTING ── */}
          <section id="troubleshooting" style={sectionStyle}>
            <SectionTag>Support</SectionTag>
            <h2 style={h2Style}>Troubleshooting</h2>

            <h3 style={{ ...h3Style, marginTop: 8, marginBottom: 12 }}>Query returns no results</h3>
            <p style={pStyle}>
              This usually means the data doesn&apos;t exist in your database for the specified parameters.
              Try asking Zenntraa what data is available:
            </p>
            <div style={{ margin: "16px 0" }}>
              <QueryItem icon="→" text="What time periods do we have financial data for?" />
              <QueryItem icon="→" text="What companies are in the database?" />
            </div>

            <h3 style={{ ...h3Style, marginTop: 24, marginBottom: 12 }}>Query returns an error about a column not existing</h3>
            <p style={pStyle}>
              Zenntraa occasionally generates SQL using a column name that doesn&apos;t exactly match your schema.
              It will automatically retry with the correct schema. If errors persist, try rephrasing your question more specifically.
            </p>

            <h3 style={{ ...h3Style, marginTop: 24, marginBottom: 12 }}>Response is slow</h3>
            <p style={pStyle}>
              First-time queries (Cache Miss) can take 1–7 seconds while the AI generates and runs the SQL. This is normal.
              The same query will be near-instant on all future runs. If every query is slow, check your database connection under Settings.
            </p>

            <h3 style={{ ...h3Style, marginTop: 24, marginBottom: 12 }}>&quot;Service unavailable&quot; or error 503</h3>
            <p style={pStyle}>
              The system may be temporarily overloaded. Wait 30 seconds and try again. If the issue persists,
              contact support via email with your Query ID.
            </p>

            <h3 style={{ ...h3Style, marginTop: 24, marginBottom: 12 }}>Database won&apos;t connect</h3>
            <p style={pStyle}>
              Double-check that your host, port, database name, username, and password are all correct.
              Ensure your database server allows inbound connections from Zenntraa&apos;s IP.
              Use the <strong>Test Connection</strong> button in Settings to diagnose.
            </p>

            <h3 style={{ ...h3Style, marginTop: 24, marginBottom: 12 }}>Getting a 429 rate limit error</h3>
            <p style={pStyle}>
              You&apos;ve sent more than 60 queries in a minute. Wait a moment and resume.
              If you need higher limits, contact us to discuss your plan.
            </p>
          </section>

          <Divider />

          {/* ── FAQ ── */}
          <section id="faq" style={sectionStyle}>
            <SectionTag>FAQ</SectionTag>
            <h2 style={h2Style}>Frequently Asked Questions</h2>

            <FaqItem
              q="Do I need to know SQL to use Zenntraa?"
              a="No. Zenntraa converts your plain English questions into SQL automatically. You never write or see any SQL unless you specifically ask for it."
            />
            <FaqItem
              q="Can Zenntraa modify or delete my data?"
              a="No. Zenntraa is strictly read-only. Only SELECT queries are permitted — it cannot insert, update, or delete any records in your database."
            />
            <FaqItem
              q="Why does the same question sometimes get a Cache Miss?"
              a='Zenntraa caches by exact question text. Minor wording differences — "List all companies" vs "Show me all companies" — are treated as separate questions. Use consistent phrasing for queries you run regularly to always hit the cache.'
            />
            <FaqItem
              q="How long does Zenntraa keep cached answers?"
              a="Cache entries expire automatically to prevent stale data. Since financial databases update regularly, Zenntraa refreshes its cache on a short cycle to ensure you always see accurate results."
            />
            <FaqItem
              q="What databases does Zenntraa support?"
              a="Zenntraa currently supports PostgreSQL. If you're on the demo, it uses a built-in database with sample financial data. Connect your own PostgreSQL database under Settings."
            />
            <FaqItem
              q="What's a good cache hit rate?"
              a="Target 80% or higher. You can check your current cache hit rate on the Metrics page. A low hit rate typically means queries are being phrased differently each time — try standardizing your question wording."
            />
            <FaqItem
              q="Can I use Zenntraa programmatically via API?"
              a={
                <>
                  Yes. Zenntraa exposes a REST API at <InlineCode>POST /api/v1/query</InlineCode>. See the API
                  Reference section above for full details. Useful for building custom dashboards or automating
                  report generation.
                </>
              }
            />
            <FaqItem
              q="What if Zenntraa gives a wrong answer?"
              a="Zenntraa retrieves exact values from your database — it doesn't guess or estimate. If an answer looks wrong, verify the underlying data in your database first. If the data is correct but the answer is still wrong, contact support with the Query ID shown in the response."
            />
            <FaqItem
              q="How do I get support on the Free plan?"
              a="Free plan users can access all documentation pages. For additional help, use the email support link in the dashboard footer. Pro and Enterprise plans include priority email and live support."
            />
          </section>

        </main>
      </div>
    </>
  );
}