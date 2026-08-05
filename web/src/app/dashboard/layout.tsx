// 'use client';

// import { useEffect, useState } from 'react';
// import Link from 'next/link';
// import Image from 'next/image';
// import { usePathname, useRouter } from 'next/navigation';
// import { signOut, onAuthStateChanged } from 'firebase/auth';
// import { auth } from '@/lib/firebase';
// import { useAuthState } from 'react-firebase-hooks/auth';
// import { getHealth, getEntitlements, isAPIError, EntitlementsResponse } from '@/lib/api';
// import { Search, Settings, LogOut, Menu, X, ChevronRight, Zap } from 'lucide-react';

// export default function DashboardLayout({ children }: { children: React.ReactNode }) {
//   const pathname = usePathname();
//   const router = useRouter();
//   const [user, loading] = useAuthState(auth);
//   const [sidebarOpen, setSidebarOpen] = useState(false);
//   const [systemOnline, setSystemOnline] = useState<boolean | null>(null);
//   const [dbConnected, setDbConnected] = useState(false);
//   const [entitlements, setEntitlements] = useState<EntitlementsResponse | null>(null);

//   // Redirect if not logged in
//   useEffect(() => {
//     if (!loading && !user) router.push('/login');
//   }, [user, loading, router]);

//   // Cookie refresh: keep firebase-token cookie alive silently
//   useEffect(() => {
//     const unsub = onAuthStateChanged(auth, async (u) => {
//       if (u) {
//         const token = await u.getIdToken();
//         document.cookie = `firebase-token=${token}; path=/; SameSite=Strict; max-age=3600`;
//       } else {
//         document.cookie = 'firebase-token=; path=/; max-age=0';
//       }
//     });
//     return () => unsub();
//   }, []);

//   // Health check
//   useEffect(() => {
//     const check = async () => {
//       const res = await getHealth();
//       setSystemOnline(!isAPIError(res) && res.status === 'ok');
//     };
//     check();
//     const id = setInterval(check, 30_000);
//     return () => clearInterval(id);
//   }, []);

//   // DB connection status from localStorage
//   useEffect(() => {
//     const syncDbStatus = () => {
//       setDbConnected(localStorage.getItem('fact_db_connected') === 'true');
//     };
//     syncDbStatus();
//     window.addEventListener('storage', syncDbStatus);
//     return () => window.removeEventListener('storage', syncDbStatus);
//   }, [pathname]);

//   // ── Fetch entitlements (plan + usage) ─────────────────────────────────────
//   useEffect(() => {
//     if (!user) return;

//     const fetchEntitlements = async () => {
//       const res = await getEntitlements();
//       if (!isAPIError(res)) setEntitlements(res);
//     };

//     fetchEntitlements();

//     // Refresh every 5 min
//     const id = setInterval(fetchEntitlements, 5 * 60 * 1000);

//     // ── Real-time: re-fetch immediately after each query ──────────────────
//     window.addEventListener('zenntraa:query', fetchEntitlements);
//     // ─────────────────────────────────────────────────────────────────────

//     return () => {
//       clearInterval(id);
//       window.removeEventListener('zenntraa:query', fetchEntitlements);
//     };
//   }, [user]);
//   // ───────────────────────────────────────────────────────────────────────────

//   const handleSignOut = async () => {
//     await signOut(auth);
//     document.cookie = 'firebase-token=; path=/; max-age=0';
//     router.push('/');
//   };

//   if (loading || !user) {
//     return (
//       <div style={{
//         minHeight: '100vh', background: '#11112b',
//         display: 'flex', alignItems: 'center', justifyContent: 'center',
//         flexDirection: 'column', gap: '16px',
//       }}>
//         <style>{`
//           @keyframes spin { to { transform: rotate(360deg); } }
//           @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
//         `}</style>
//         <div style={{
//           width: 36, height: 36,
//           border: '2px solid rgba(124,131,245,0.15)',
//           borderTop: '2px solid #7c83f5',
//           borderRadius: '50%',
//           animation: 'spin 0.8s linear infinite',
//         }} />
//         <div style={{
//           fontFamily: 'sans-serif', fontSize: 13,
//           color: 'rgba(232,233,243,0.35)',
//           animation: 'fadeIn 0.5s ease',
//         }}>
//           Loading Zenntraa…
//         </div>
//       </div>
//     );
//   }

//   const userInitial = (user.displayName ?? user.email ?? '?')[0].toUpperCase();
//   const userName = user.displayName ?? user.email ?? 'User';
//   const isPro = entitlements?.plan === 'pro';

//   const used  = entitlements?.queries_this_month ?? 0;
//   const limit = entitlements?.queries_limit ?? 50;
//   const pct   = Math.min((used / limit) * 100, 100);
//   const nearLimit = pct >= 80;

//   const NAV_ITEMS = [
//     {
//       href: '/dashboard/query',
//       icon: Search,
//       label: 'Query',
//       desc: 'Ask your data',
//       active: pathname.startsWith('/dashboard/query'),
//     },
//     {
//       href: '/dashboard/settings',
//       icon: Settings,
//       label: 'Settings',
//       desc: dbConnected ? 'Connected' : 'Connect database',
//       active: pathname.startsWith('/dashboard/settings'),
//     },
//   ];

//   const currentPage = NAV_ITEMS.find(n => n.active)?.label ?? 'Dashboard';

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

//         *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

//         :root {
//           --bg:       #11112b;
//           --bg-panel: #0d0d22;
//           --bg-card:  rgba(255,255,255,0.03);
//           --border:   rgba(255,255,255,0.08);
//           --border-s: rgba(255,255,255,0.05);
//           --text:     #e8e9f3;
//           --muted:    rgba(232,233,243,0.45);
//           --dim:      rgba(232,233,243,0.25);
//           --accent:   #7c83f5;
//           --accent-2: #a78bfa;
//           --as:       rgba(124,131,245,0.1);
//           --green:    #34d399;
//           --gs:       rgba(52,211,153,0.1);
//           --warn:     #f59e0b;
//           --mono:     'JetBrains Mono', monospace;
//           --sans:     'Sora', sans-serif;
//           --sw:       220px;
//           --th:       60px;
//         }

//         .zdl-root { display: flex; min-height: 100vh; background: var(--bg); font-family: var(--sans); }

//         .zdl-sidebar {
//           width: var(--sw); height: 100vh;
//           position: fixed; top: 0; left: 0;
//           background: var(--bg-panel);
//           border-right: 1px solid var(--border);
//           display: flex; flex-direction: column;
//           z-index: 40; transition: transform 0.25s ease;
//         }

//         .zdl-logo {
//           height: var(--th);
//           display: flex; align-items: center; gap: 10px;
//           padding: 0 18px; border-bottom: 1px solid var(--border);
//           text-decoration: none; flex-shrink: 0;
//         }

//         .zdl-logo-img { width: 28px; height: 28px; object-fit: contain; border-radius: 7px; display: block; }
//         .zdl-logo-word { font-size: 16px; font-weight: 700; color: var(--text); letter-spacing: -0.03em; }

//         .zdl-nav { flex: 1; padding: 20px 10px; display: flex; flex-direction: column; gap: 3px; overflow-y: auto; }

//         .zdl-nav-label {
//           font-family: var(--mono); font-size: 9.5px; font-weight: 700;
//           letter-spacing: 0.14em; text-transform: uppercase; color: var(--dim);
//           padding: 0 10px; margin-bottom: 8px;
//         }

//         .zdl-nav-link {
//           display: flex; align-items: center; gap: 11px;
//           padding: 10px 12px; border-radius: 10px;
//           text-decoration: none; position: relative; transition: background 0.15s;
//         }

//         .zdl-nav-link.active { background: var(--as); border: 1px solid rgba(124,131,245,0.15); }
//         .zdl-nav-link.idle:hover { background: rgba(255,255,255,0.04); }

//         .zdl-nav-icon-wrap {
//           width: 30px; height: 30px; border-radius: 8px;
//           display: flex; align-items: center; justify-content: center;
//           flex-shrink: 0; transition: background 0.15s;
//         }

//         .zdl-nav-link.active .zdl-nav-icon-wrap { background: rgba(124,131,245,0.15); }
//         .zdl-nav-link.idle .zdl-nav-icon-wrap   { background: rgba(255,255,255,0.04); }
//         .zdl-nav-link.active .zdl-nav-icon { color: var(--accent); }
//         .zdl-nav-link.idle .zdl-nav-icon   { color: var(--muted); }

//         .zdl-nav-name { font-size: 13px; font-weight: 600; letter-spacing: -0.02em; transition: color 0.15s; }
//         .zdl-nav-link.active .zdl-nav-name { color: var(--text); }
//         .zdl-nav-link.idle .zdl-nav-name   { color: var(--muted); }
//         .zdl-nav-desc { font-size: 11px; color: var(--dim); margin-top: 1px; }

//         .zdl-nav-dot {
//           width: 5px; height: 5px; border-radius: 50%; background: var(--accent);
//           position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
//         }

//         /* Usage meter */
//         .zdl-usage {
//           margin: 0 10px 4px; padding: 12px 12px 10px;
//           background: var(--bg-card); border: 1px solid var(--border-s); border-radius: 10px;
//         }

//         .zdl-usage-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; }

//         .zdl-usage-label {
//           font-family: var(--mono); font-size: 9px; font-weight: 700;
//           letter-spacing: 0.12em; text-transform: uppercase; color: var(--dim);
//         }

//         .zdl-usage-count { font-family: var(--mono); font-size: 9.5px; font-weight: 600; color: var(--muted); }
//         .zdl-usage-count.warn { color: var(--warn); }

//         .zdl-bar-track { height: 3px; background: rgba(255,255,255,0.06); border-radius: 100px; overflow: hidden; margin-bottom: 8px; }

//         .zdl-bar-fill {
//           height: 100%; border-radius: 100px;
//           background: linear-gradient(90deg, var(--accent), var(--accent-2));
//           transition: width 0.4s ease;
//         }

//         .zdl-bar-fill.warn { background: linear-gradient(90deg, var(--warn), #ef4444); }

//         .zdl-upgrade-btn {
//           display: flex; align-items: center; justify-content: center; gap: 5px;
//           width: 100%; padding: 6px;
//           background: linear-gradient(135deg, var(--accent), var(--accent-2));
//           border: none; border-radius: 7px;
//           font-family: var(--sans); font-size: 11px; font-weight: 600; color: #fff;
//           cursor: pointer; text-decoration: none;
//           transition: opacity 0.15s, transform 0.15s; letter-spacing: -0.01em;
//         }

//         .zdl-upgrade-btn:hover { opacity: 0.9; transform: translateY(-1px); }

//         .zdl-footer { border-top: 1px solid var(--border); padding: 14px 10px; display: flex; flex-direction: column; gap: 4px; }

//         .zdl-user {
//           display: flex; align-items: center; gap: 10px; padding: 10px 12px;
//           border-radius: 10px; background: var(--bg-card); border: 1px solid var(--border-s);
//         }

//         .zdl-avatar {
//           width: 30px; height: 30px;
//           background: linear-gradient(135deg, var(--accent), var(--accent-2));
//           border-radius: 9px; display: flex; align-items: center; justify-content: center;
//           font-family: var(--mono); font-size: 12px; font-weight: 700; color: #fff;
//           flex-shrink: 0; box-shadow: 0 2px 8px rgba(124,131,245,0.3);
//         }

//         .zdl-user-name {
//           font-size: 12.5px; font-weight: 600; color: var(--text); letter-spacing: -0.02em;
//           white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
//         }

//         .zdl-user-plan { font-family: var(--mono); font-size: 9.5px; color: var(--accent); letter-spacing: 0.06em; text-transform: uppercase; margin-top: 1px; }

//         .zdl-signout {
//           display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 8px;
//           background: none; border: none; cursor: pointer; width: 100%; color: var(--dim);
//           transition: background 0.15s, color 0.15s; font-family: var(--sans);
//         }

//         .zdl-signout:hover { background: rgba(239,68,68,0.06); color: #f87171; }
//         .zdl-signout span { font-size: 12.5px; font-weight: 500; letter-spacing: -0.01em; }

//         .zdl-topbar {
//           position: fixed; top: 0; left: var(--sw); right: 0; height: var(--th);
//           background: rgba(13,13,34,0.92); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
//           border-bottom: 1px solid var(--border);
//           display: flex; align-items: center; justify-content: space-between;
//           padding: 0 24px; z-index: 30;
//         }

//         .zdl-topbar-left { display: flex; align-items: center; gap: 8px; }

//         .zdl-bc-home { font-family: var(--mono); font-size: 11.5px; color: var(--dim); text-decoration: none; letter-spacing: 0.02em; transition: color 0.15s; }
//         .zdl-bc-home:hover { color: var(--muted); }
//         .zdl-bc-sep { color: var(--dim); }
//         .zdl-bc-cur { font-family: var(--mono); font-size: 11.5px; font-weight: 600; color: var(--text); letter-spacing: 0.02em; }

//         .zdl-mobile-btn { display: none; background: none; border: none; color: var(--muted); cursor: pointer; padding: 6px; border-radius: 6px; transition: background 0.15s; }
//         .zdl-mobile-btn:hover { background: rgba(255,255,255,0.05); }

//         .zdl-status {
//           display: flex; align-items: center; gap: 7px; padding: 6px 13px;
//           border: 1px solid var(--border); border-radius: 100px;
//           font-family: var(--mono); font-size: 10.5px; font-weight: 600;
//           color: var(--muted); letter-spacing: 0.03em; background: rgba(255,255,255,0.02); transition: border-color 0.3s;
//         }

//         .zdl-status.online  { color: var(--green); border-color: rgba(52,211,153,0.2); background: var(--gs); }
//         .zdl-status.offline { color: #f87171; border-color: rgba(239,68,68,0.2); background: rgba(239,68,68,0.06); }

//         .zdl-status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; animation: zpulse 2s ease infinite; }

//         @keyframes zpulse { 0%,100%{opacity:1} 50%{opacity:.3} }

//         .zdl-main { margin-left: var(--sw); margin-top: var(--th); flex: 1; min-height: calc(100vh - var(--th)); background: var(--bg); }

//         .zdl-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 35; backdrop-filter: blur(2px); }

//         @media (max-width: 768px) {
//           .zdl-sidebar { transform: translateX(-100%); }
//           .zdl-sidebar.open { transform: translateX(0); box-shadow: 4px 0 32px rgba(0,0,0,0.5); }
//           .zdl-topbar { left: 0; }
//           .zdl-main { margin-left: 0; }
//           .zdl-mobile-btn { display: flex; }
//           .zdl-overlay.open { display: block; }
//         }
//       `}</style>

//       <div className="zdl-root">
//         <div className={`zdl-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />

//         <aside className={`zdl-sidebar ${sidebarOpen ? 'open' : ''}`}>

//           <Link href="/" className="zdl-logo">
//             <Image src="/logo.png" alt="Zenntraa" width={28} height={28} className="zdl-logo-img" priority />
//             <span className="zdl-logo-word">Zenntraa</span>
//           </Link>

//           <nav className="zdl-nav">
//             <div className="zdl-nav-label">Menu</div>
//             {NAV_ITEMS.map((item) => {
//               const Icon = item.icon;
//               return (
//                 <Link
//                   key={item.href}
//                   href={item.href}
//                   onClick={() => setSidebarOpen(false)}
//                   className={`zdl-nav-link ${item.active ? 'active' : 'idle'}`}
//                 >
//                   <div className="zdl-nav-icon-wrap">
//                     <Icon size={14} className="zdl-nav-icon" />
//                   </div>
//                   <div className="zdl-nav-text">
//                     <div className="zdl-nav-name">{item.label}</div>
//                     <div className="zdl-nav-desc">{item.desc}</div>
//                   </div>
//                   {item.active && <div className="zdl-nav-dot" />}
//                 </Link>
//               );
//             })}

//             {/* Usage meter */}
//             {entitlements && (
//               <div className="zdl-usage" style={{ marginTop: 12 }}>
//                 <div className="zdl-usage-row">
//                   <span className="zdl-usage-label">Queries</span>
//                   <span className={`zdl-usage-count ${nearLimit ? 'warn' : ''}`}>
//                     {used} / {limit === -1 ? '∞' : limit}
//                   </span>
//                 </div>
//                 <div className="zdl-bar-track">
//                   <div
//                     className={`zdl-bar-fill ${nearLimit ? 'warn' : ''}`}
//                     style={{ width: `${pct}%` }}
//                   />
//                 </div>
//                 {!isPro && (
//                   <Link href="/pricing" className="zdl-upgrade-btn">
//                     <Zap size={10} />
//                     Upgrade to Pro
//                   </Link>
//                 )}
//               </div>
//             )}
//           </nav>

//           <div className="zdl-footer">
//             <div className="zdl-user">
//               <div className="zdl-avatar">{userInitial}</div>
//               <div style={{ flex: 1, minWidth: 0 }}>
//                 <div className="zdl-user-name">{userName}</div>
//                 <div className="zdl-user-plan">{isPro ? 'Pro plan' : 'Starter'}</div>
//               </div>
//             </div>
//             <button className="zdl-signout" onClick={handleSignOut}>
//               <LogOut size={13} />
//               <span>Sign out</span>
//             </button>
//           </div>
//         </aside>

//         <header className="zdl-topbar">
//           <div className="zdl-topbar-left">
//             <button className="zdl-mobile-btn" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle sidebar">
//               {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
//             </button>
//             <Link href="/dashboard" className="zdl-bc-home">Dashboard</Link>
//             <ChevronRight size={12} className="zdl-bc-sep" />
//             <span className="zdl-bc-cur">{currentPage}</span>
//           </div>

//           <div className={`zdl-status ${systemOnline === null ? '' : systemOnline ? 'online' : 'offline'}`}>
//             <div className="zdl-status-dot" />
//             {systemOnline === null ? 'Checking…' : systemOnline ? 'System online' : 'System offline'}
//           </div>
//         </header>

//         <main className="zdl-main">{children}</main>
//       </div>
//     </>
//   );
// }

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { getHealth, getEntitlements, getDatabaseStatus, isAPIError, EntitlementsResponse } from '@/lib/api';
import { Search, Settings, LogOut, Menu, X, ChevronRight, Zap } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, loading] = useAuthState(auth);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [systemOnline, setSystemOnline] = useState<boolean | null>(null);
  const [dbConnected, setDbConnected] = useState(false);
  const [entitlements, setEntitlements] = useState<EntitlementsResponse | null>(null);
  const [showEmail, setShowEmail] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close the email drop-up when clicking outside it
  useEffect(() => {
    if (!showEmail) return;
    const onDown = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowEmail(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showEmail]);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  // Cookie refresh: keep firebase-token cookie alive silently
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const token = await u.getIdToken();
        document.cookie = `firebase-token=${token}; path=/; SameSite=Strict; max-age=3600`;
      } else {
        document.cookie = 'firebase-token=; path=/; max-age=0';
      }
    });
    return () => unsub();
  }, []);

  // Health check
  useEffect(() => {
    const check = async () => {
      const res = await getHealth();
      setSystemOnline(!isAPIError(res) && res.status === 'ok');
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);

  // DB connection status from backend
  useEffect(() => {
    if (!user) return;
    const syncDbStatus = async () => {
      const res = await getDatabaseStatus();
      setDbConnected(!isAPIError(res) && res.connected === true);
    };
    syncDbStatus();
    window.addEventListener('zenntraa:query', syncDbStatus);
    return () => window.removeEventListener('zenntraa:query', syncDbStatus);
  }, [user]);

  // ── Fetch entitlements (plan + usage) ─────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const fetchEntitlements = async () => {
      const res = await getEntitlements();
      if (!isAPIError(res)) setEntitlements(res);
    };

    fetchEntitlements();

    // Refresh every 5 min
    const id = setInterval(fetchEntitlements, 5 * 60 * 1000);

    // ── Real-time: re-fetch immediately after each query ──────────────────
    window.addEventListener('zenntraa:query', fetchEntitlements);
    // ─────────────────────────────────────────────────────────────────────

    return () => {
      clearInterval(id);
      window.removeEventListener('zenntraa:query', fetchEntitlements);
    };
  }, [user]);
  // ───────────────────────────────────────────────────────────────────────────

  const handleSignOut = async () => {
    await signOut(auth);
    document.cookie = 'firebase-token=; path=/; max-age=0';
    router.push('/');
  };

  if (loading || !user) {
    return (
      <div style={{
        minHeight: '100vh', background: '#11112b',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '16px',
      }}>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        `}</style>
        <div style={{
          width: 36, height: 36,
          border: '2px solid rgba(124,131,245,0.15)',
          borderTop: '2px solid #7c83f5',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <div style={{
          fontFamily: 'sans-serif', fontSize: 13,
          color: 'rgba(232,233,243,0.35)',
          animation: 'fadeIn 0.5s ease',
        }}>
          Loading Zenntraa…
        </div>
      </div>
    );
  }

  const userInitial = (user.displayName ?? user.email ?? '?')[0].toUpperCase();
  const userName = user.displayName ?? user.email ?? 'User';
  const isPro = entitlements?.plan === 'pro';

  const used  = entitlements?.queries_this_month ?? 0;
  const limit = entitlements?.queries_limit ?? 50;
  const pct   = Math.min((used / limit) * 100, 100);
  const nearLimit = pct >= 80;

  const NAV_ITEMS = [
    {
      href: '/dashboard/query',
      icon: Search,
      label: 'Query',
      desc: 'Ask your data',
      active: pathname.startsWith('/dashboard/query'),
    },
    {
      href: '/dashboard/settings',
      icon: Settings,
      label: 'Settings',
      desc: dbConnected ? 'Connected' : 'Connect database',
      active: pathname.startsWith('/dashboard/settings'),
    },
  ];

  const currentPage = NAV_ITEMS.find(n => n.active)?.label ?? 'Dashboard';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg:       #11112b;
          --bg-panel: #0d0d22;
          --bg-card:  rgba(255,255,255,0.03);
          --border:   rgba(255,255,255,0.08);
          --border-s: rgba(255,255,255,0.05);
          --text:     #e8e9f3;
          --muted:    rgba(232,233,243,0.45);
          --dim:      rgba(232,233,243,0.25);
          --accent:   #7c83f5;
          --accent-2: #a78bfa;
          --as:       rgba(124,131,245,0.1);
          --green:    #34d399;
          --gs:       rgba(52,211,153,0.1);
          --warn:     #f59e0b;
          --mono:     'JetBrains Mono', monospace;
          --sans:     'Sora', sans-serif;
          --sw:       220px;
          --th:       60px;
        }

        .zdl-root { display: flex; min-height: 100vh; background: var(--bg); font-family: var(--sans); }

        .zdl-sidebar {
          width: var(--sw); height: 100vh;
          position: fixed; top: 0; left: 0;
          background: var(--bg-panel);
          border-right: 1px solid var(--border);
          display: flex; flex-direction: column;
          z-index: 40; transition: transform 0.25s ease;
        }

        .zdl-logo {
          height: var(--th);
          display: flex; align-items: center; gap: 10px;
          padding: 0 18px; border-bottom: 1px solid var(--border);
          text-decoration: none; flex-shrink: 0;
        }

        .zdl-logo-img { width: 28px; height: 28px; object-fit: contain; border-radius: 7px; display: block; }
        .zdl-logo-word { font-size: 16px; font-weight: 700; color: var(--text); letter-spacing: -0.03em; }

        .zdl-nav { flex: 1; padding: 20px 10px; display: flex; flex-direction: column; gap: 3px; overflow-y: auto; }

        .zdl-nav-label {
          font-family: var(--mono); font-size: 9.5px; font-weight: 700;
          letter-spacing: 0.14em; text-transform: uppercase; color: var(--dim);
          padding: 0 10px; margin-bottom: 8px;
        }

        .zdl-nav-link {
          display: flex; align-items: center; gap: 11px;
          padding: 10px 12px; border-radius: 10px;
          text-decoration: none; position: relative; transition: background 0.15s;
        }

        .zdl-nav-link.active { background: var(--as); border: 1px solid rgba(124,131,245,0.15); }
        .zdl-nav-link.idle:hover { background: rgba(255,255,255,0.04); }

        .zdl-nav-icon-wrap {
          width: 30px; height: 30px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: background 0.15s;
        }

        .zdl-nav-link.active .zdl-nav-icon-wrap { background: rgba(124,131,245,0.15); }
        .zdl-nav-link.idle .zdl-nav-icon-wrap   { background: rgba(255,255,255,0.04); }
        .zdl-nav-link.active .zdl-nav-icon { color: var(--accent); }
        .zdl-nav-link.idle .zdl-nav-icon   { color: var(--muted); }

        .zdl-nav-name { font-size: 13px; font-weight: 600; letter-spacing: -0.02em; transition: color 0.15s; }
        .zdl-nav-link.active .zdl-nav-name { color: var(--text); }
        .zdl-nav-link.idle .zdl-nav-name   { color: var(--muted); }
        .zdl-nav-desc { font-size: 11px; color: var(--dim); margin-top: 1px; }

        .zdl-nav-dot {
          width: 5px; height: 5px; border-radius: 50%; background: var(--accent);
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
        }

        /* Usage meter */
        .zdl-usage {
          margin: 0 10px 4px; padding: 12px 12px 10px;
          background: var(--bg-card); border: 1px solid var(--border-s); border-radius: 10px;
        }

        .zdl-usage-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; }

        .zdl-usage-label {
          font-family: var(--mono); font-size: 9px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase; color: var(--dim);
        }

        .zdl-usage-count { font-family: var(--mono); font-size: 9.5px; font-weight: 600; color: var(--muted); }
        .zdl-usage-count.warn { color: var(--warn); }

        .zdl-bar-track { height: 3px; background: rgba(255,255,255,0.06); border-radius: 100px; overflow: hidden; margin-bottom: 8px; }

        .zdl-bar-fill {
          height: 100%; border-radius: 100px;
          background: linear-gradient(90deg, var(--accent), var(--accent-2));
          transition: width 0.4s ease;
        }

        .zdl-bar-fill.warn { background: linear-gradient(90deg, var(--warn), #ef4444); }

        .zdl-upgrade-btn {
          display: flex; align-items: center; justify-content: center; gap: 5px;
          width: 100%; padding: 6px;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          border: none; border-radius: 7px;
          font-family: var(--sans); font-size: 11px; font-weight: 600; color: #fff;
          cursor: pointer; text-decoration: none;
          transition: opacity 0.15s, transform 0.15s; letter-spacing: -0.01em;
        }

        .zdl-upgrade-btn:hover { opacity: 0.9; transform: translateY(-1px); }

        .zdl-footer { border-top: 1px solid var(--border); padding: 14px 10px; display: flex; flex-direction: column; gap: 4px; }

        .zdl-user {
          display: flex; align-items: center; gap: 10px; padding: 10px 12px;
          border-radius: 10px; background: var(--bg-card); border: 1px solid var(--border-s);
        }

        .zdl-avatar {
          width: 30px; height: 30px;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          border-radius: 9px; display: flex; align-items: center; justify-content: center;
          font-family: var(--mono); font-size: 12px; font-weight: 700; color: #fff;
          flex-shrink: 0; box-shadow: 0 2px 8px rgba(124,131,245,0.3);
        }

        .zdl-user-name {
          font-size: 12.5px; font-weight: 600; color: var(--text); letter-spacing: -0.02em;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        .zdl-user-plan { font-family: var(--mono); font-size: 9.5px; color: var(--accent); letter-spacing: 0.06em; text-transform: uppercase; margin-top: 1px; }

        .zdl-signout {
          display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 8px;
          background: none; border: none; cursor: pointer; width: 100%; color: var(--dim);
          transition: background 0.15s, color 0.15s; font-family: var(--sans);
        }

        .zdl-signout:hover { background: rgba(239,68,68,0.06); color: #f87171; }
        .zdl-signout span { font-size: 12.5px; font-weight: 500; letter-spacing: -0.01em; }

        .zdl-topbar {
          position: fixed; top: 0; left: var(--sw); right: 0; height: var(--th);
          background: rgba(13,13,34,0.92); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--border);
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 24px; z-index: 30;
        }

        .zdl-topbar-left { display: flex; align-items: center; gap: 8px; }

        .zdl-bc-home { font-family: var(--mono); font-size: 11.5px; color: var(--dim); text-decoration: none; letter-spacing: 0.02em; transition: color 0.15s; }
        .zdl-bc-home:hover { color: var(--muted); }
        .zdl-bc-sep { color: var(--dim); }
        .zdl-bc-cur { font-family: var(--mono); font-size: 11.5px; font-weight: 600; color: var(--text); letter-spacing: 0.02em; }

        .zdl-mobile-btn { display: none; background: none; border: none; color: var(--muted); cursor: pointer; padding: 6px; border-radius: 6px; transition: background 0.15s; }
        .zdl-mobile-btn:hover { background: rgba(255,255,255,0.05); }

        .zdl-status {
          display: flex; align-items: center; gap: 7px; padding: 6px 13px;
          border: 1px solid var(--border); border-radius: 100px;
          font-family: var(--mono); font-size: 10.5px; font-weight: 600;
          color: var(--muted); letter-spacing: 0.03em; background: rgba(255,255,255,0.02); transition: border-color 0.3s;
        }

        .zdl-status.online  { color: var(--green); border-color: rgba(52,211,153,0.2); background: var(--gs); }
        .zdl-status.offline { color: #f87171; border-color: rgba(239,68,68,0.2); background: rgba(239,68,68,0.06); }

        .zdl-status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; animation: zpulse 2s ease infinite; }

        @keyframes zpulse { 0%,100%{opacity:1} 50%{opacity:.3} }

        .zdl-main { margin-left: var(--sw); margin-top: var(--th); flex: 1; min-height: calc(100vh - var(--th)); background: var(--bg); }

        .zdl-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 35; backdrop-filter: blur(2px); }

        @media (max-width: 768px) {
          .zdl-sidebar { transform: translateX(-100%); }
          .zdl-sidebar.open { transform: translateX(0); box-shadow: 4px 0 32px rgba(0,0,0,0.5); }
          .zdl-topbar { left: 0; }
          .zdl-main { margin-left: 0; }
          .zdl-mobile-btn { display: flex; }
          .zdl-overlay.open { display: block; }
        }
      `}</style>

      <div className="zdl-root">
        <div className={`zdl-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />

        <aside className={`zdl-sidebar ${sidebarOpen ? 'open' : ''}`}>

          <Link href="/" className="zdl-logo">
            <Image src="/logo.png" alt="Zenntraa" width={28} height={28} className="zdl-logo-img" priority />
            <span className="zdl-logo-word">Zenntraa</span>
          </Link>

          <nav className="zdl-nav">
            <div className="zdl-nav-label">Menu</div>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`zdl-nav-link ${item.active ? 'active' : 'idle'}`}
                >
                  <div className="zdl-nav-icon-wrap">
                    <Icon size={14} className="zdl-nav-icon" />
                  </div>
                  <div className="zdl-nav-text">
                    <div className="zdl-nav-name">{item.label}</div>
                    <div className="zdl-nav-desc">{item.desc}</div>
                  </div>
                  {item.active && <div className="zdl-nav-dot" />}
                </Link>
              );
            })}

            {/* Usage meter */}
            {entitlements && (
              <div className="zdl-usage" style={{ marginTop: 12 }}>
                <div className="zdl-usage-row">
                  <span className="zdl-usage-label">Queries</span>
                  <span className={`zdl-usage-count ${nearLimit ? 'warn' : ''}`}>
                    {used} / {limit === -1 ? '∞' : limit}
                  </span>
                </div>
                <div className="zdl-bar-track">
                  <div
                    className={`zdl-bar-fill ${nearLimit ? 'warn' : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {!isPro && (
                  <Link href="/pricing" className="zdl-upgrade-btn">
                    <Zap size={10} />
                    Upgrade to Pro
                  </Link>
                )}
              </div>
            )}
          </nav>

          <div className="zdl-footer">
            <div ref={userMenuRef} style={{ position: 'relative' }}>
              {showEmail && user.email && (
                <div
                  role="menu"
                  style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 6px)',
                    left: 0,
                    right: 0,
                    background: 'var(--card, #14161c)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    boxShadow: '0 12px 28px rgba(0,0,0,0.45)',
                    zIndex: 50,
                  }}
                >
                  <div style={{
                    fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4,
                  }}>
                    Signed in as
                  </div>
                  <div style={{
                    fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--fg, #e7e9ee)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {user.email}
                  </div>
                </div>
              )}
              <div
                className="zdl-user"
                onClick={() => setShowEmail((v) => !v)}
                style={{ cursor: 'pointer' }}
                title={showEmail ? 'Hide email' : 'Show email'}
                aria-haspopup="menu"
                aria-expanded={showEmail}
              >
                <div className="zdl-avatar">{userInitial}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="zdl-user-name">{userName}</div>
                  <div className="zdl-user-plan">{isPro ? 'Pro plan' : 'Starter'}</div>
                </div>
                <ChevronRight
                  size={14}
                  style={{
                    color: 'var(--muted)',
                    transform: showEmail ? 'rotate(-90deg)' : 'rotate(90deg)',
                    transition: 'transform 0.15s ease',
                    flexShrink: 0,
                  }}
                />
              </div>
            </div>
            <button className="zdl-signout" onClick={handleSignOut}>
              <LogOut size={13} />
              <span>Sign out</span>
            </button>
          </div>
        </aside>

        <header className="zdl-topbar">
          <div className="zdl-topbar-left">
            <button className="zdl-mobile-btn" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle sidebar">
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <Link href="/dashboard" className="zdl-bc-home">Dashboard</Link>
            <ChevronRight size={12} className="zdl-bc-sep" />
            <span className="zdl-bc-cur">{currentPage}</span>
          </div>

          <div className={`zdl-status ${systemOnline === null ? '' : systemOnline ? 'online' : 'offline'}`}>
            <div className="zdl-status-dot" />
            {systemOnline === null ? 'Checking…' : systemOnline ? 'System online' : 'System offline'}
          </div>
        </header>

        <main className="zdl-main">{children}</main>
      </div>
    </>
  );
}