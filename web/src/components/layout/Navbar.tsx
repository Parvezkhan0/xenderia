'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import clsx from 'clsx';
import { auth } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/docs', label: 'Docs' },
  { href: '/pricing', label: 'Pricing' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [user] = useAuthState(auth);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

        :root {
          --bg-base: #11112b;
          --bg-surface: rgba(17, 17, 43, 0.92);
          --bg-surface-scrolled: rgba(17, 17, 43, 0.98);
          --border: rgba(255, 255, 255, 0.07);
          --border-hover: rgba(255, 255, 255, 0.14);
          --text-primary: #e8e9f3;
          --text-secondary: rgba(232, 233, 243, 0.45);
          --accent: #7c83f5;
          --accent-soft: rgba(124, 131, 245, 0.12);
          --accent-hover: rgba(124, 131, 245, 0.2);
        }

        .zn-navbar {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 50;
          font-family: 'Sora', sans-serif;
        }

        .zn-bar {
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          transition: box-shadow 0.3s ease, background 0.3s ease;
        }

        .zn-bar.scrolled {
          background: var(--bg-surface-scrolled);
          box-shadow: 0 1px 0 var(--border), 0 8px 32px rgba(0, 0, 0, 0.35);
        }

        .zn-inner {
          max-width: 1120px;
          margin: 0 auto;
          padding: 0 28px;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        /* ── Logo ── */
        .zn-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          flex-shrink: 0;
        }

        .zn-logo-img {
          width: 32px;
          height: 32px;
          object-fit: contain;
          border-radius: 8px;
          display: block;
        }

        .zn-wordmark {
          font-size: 17px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.03em;
        }

        /* ── Nav links ── */
        .zn-links {
          display: flex;
          align-items: center;
        }

        .zn-link {
          padding: 6px 16px;
          font-size: 13.5px;
          font-weight: 500;
          text-decoration: none;
          border-radius: 6px;
          transition: color 0.15s, background 0.15s;
          letter-spacing: -0.01em;
        }

        .zn-link-active {
          color: var(--accent);
          background: var(--accent-soft);
        }

        .zn-link-idle { color: var(--text-secondary); }

        .zn-link-idle:hover {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.05);
        }

        /* ── Auth ── */
        .zn-auth {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .zn-btn-login {
          padding: 7px 16px;
          font-size: 13.5px;
          font-weight: 500;
          font-family: 'Sora', sans-serif;
          color: var(--text-secondary);
          text-decoration: none;
          border-radius: 6px;
          transition: color 0.15s, background 0.15s;
        }

        .zn-btn-login:hover {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.05);
        }

        .zn-btn-cta {
          padding: 8px 18px;
          font-size: 13.5px;
          font-weight: 600;
          font-family: 'Sora', sans-serif;
          color: #ffffff;
          background: linear-gradient(135deg, #7c83f5 0%, #a78bfa 100%);
          text-decoration: none;
          border-radius: 8px;
          letter-spacing: -0.02em;
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 2px 12px rgba(124, 131, 245, 0.3);
        }

        .zn-btn-cta:hover {
          opacity: 0.9;
          transform: translateY(-1px);
          box-shadow: 0 4px 20px rgba(124, 131, 245, 0.45);
        }

        .zn-btn-cta:active { transform: translateY(0); }

        .zn-btn-dashboard {
          padding: 7px 16px;
          font-size: 13.5px;
          font-weight: 600;
          font-family: 'Sora', sans-serif;
          color: var(--accent);
          background: var(--accent-soft);
          border: 1px solid rgba(124, 131, 245, 0.2);
          text-decoration: none;
          border-radius: 8px;
          transition: background 0.15s, border-color 0.15s;
        }

        .zn-btn-dashboard:hover {
          background: var(--accent-hover);
          border-color: rgba(124, 131, 245, 0.35);
        }

        /* ── Mobile ── */
        .zn-mobile-toggle {
          display: none;
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
          transition: color 0.15s, background 0.15s;
        }

        .zn-mobile-toggle:hover {
          color: var(--text-primary);
          background: rgba(255,255,255,0.05);
        }

        .zn-mobile-menu {
          background: var(--bg-surface-scrolled);
          border-bottom: 1px solid var(--border);
          backdrop-filter: blur(20px);
          padding: 8px 20px 20px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          animation: slideDown 0.2s ease;
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .zn-mobile-link {
          padding: 11px 14px;
          font-size: 14px;
          font-weight: 500;
          text-decoration: none;
          border-radius: 8px;
          transition: color 0.15s, background 0.15s;
        }

        .zn-mobile-link-active {
          color: var(--accent);
          background: var(--accent-soft);
        }

        .zn-mobile-link-idle { color: var(--text-secondary); }

        .zn-mobile-link-idle:hover {
          color: var(--text-primary);
          background: rgba(255,255,255,0.05);
        }

        .zn-mobile-auth {
          display: flex;
          gap: 10px;
          margin-top: 10px;
          padding-top: 14px;
          border-top: 1px solid var(--border);
        }

        .zn-mobile-btn-login {
          flex: 1;
          padding: 10px;
          text-align: center;
          font-size: 13.5px;
          font-weight: 500;
          font-family: 'Sora', sans-serif;
          color: var(--text-secondary);
          border: 1px solid var(--border);
          border-radius: 8px;
          text-decoration: none;
          transition: border-color 0.15s, color 0.15s;
        }

        .zn-mobile-btn-login:hover {
          border-color: var(--border-hover);
          color: var(--text-primary);
        }

        .zn-mobile-btn-cta {
          flex: 1;
          padding: 10px;
          text-align: center;
          font-size: 13.5px;
          font-weight: 600;
          font-family: 'Sora', sans-serif;
          color: #ffffff;
          background: linear-gradient(135deg, #7c83f5 0%, #a78bfa 100%);
          border-radius: 8px;
          text-decoration: none;
          transition: opacity 0.15s;
        }

        .zn-mobile-btn-cta:hover { opacity: 0.88; }

        @media (max-width: 767px) {
          .zn-links, .zn-auth { display: none; }
          .zn-mobile-toggle { display: flex; }
          .zn-inner { height: 58px; padding: 0 20px; }
        }
      `}</style>

      <header className="zn-navbar">
        <div className={clsx('zn-bar', scrolled && 'scrolled')}>
          <nav className="zn-inner">

            {/* Logo — uses your actual logo.png from /public */}
            <Link href="/" className="zn-logo">
              <Image
                src="/logo.png"
                alt="Zenntraa"
                width={32}
                height={32}
                className="zn-logo-img"
                priority
              />
              <span className="zn-wordmark">Zenntraa</span>
            </Link>

            <div className="zn-links">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href}
                  className={clsx('zn-link', pathname === link.href ? 'zn-link-active' : 'zn-link-idle')}>
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="zn-auth">
              {user ? (
                <Link href="/dashboard" className="zn-btn-dashboard">Dashboard →</Link>
              ) : (
                <>
                  <Link href="/login" className="zn-btn-login">Log in</Link>
                  <Link href="/signup" className="zn-btn-cta">Get started</Link>
                </>
              )}
            </div>

            <button className="zn-mobile-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </nav>
        </div>

        {menuOpen && (
          <div className="zn-mobile-menu">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}
                className={clsx('zn-mobile-link', pathname === link.href ? 'zn-mobile-link-active' : 'zn-mobile-link-idle')}>
                {link.label}
              </Link>
            ))}
            <div className="zn-mobile-auth">
              {user ? (
                <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="zn-mobile-btn-cta" style={{ flex: 1 }}>
                  Dashboard →
                </Link>
              ) : (
                <>
                  <Link href="/login" onClick={() => setMenuOpen(false)} className="zn-mobile-btn-login">Log in</Link>
                  <Link href="/signup" onClick={() => setMenuOpen(false)} className="zn-mobile-btn-cta">Get started</Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}