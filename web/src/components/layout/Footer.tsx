'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

        .zfooter {
          background: #0d0d22;
          border-top: 1px solid rgba(255,255,255,0.07);
          padding: 28px 40px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-family: 'Sora', sans-serif;
          position: relative;
          overflow: hidden;
        }

        .zfooter::before {
          content: '';
          position: absolute;
          top: 0; left: 50%;
          transform: translateX(-50%);
          width: 320px; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(124,131,245,0.3), transparent);
        }

        .zfooter-logo {
          display: flex; align-items: center; gap: 8px;
          text-decoration: none;
          flex-shrink: 0;
        }

        .zfooter-logo-img {
          width: 26px; height: 26px;
          object-fit: contain;
          border-radius: 6px;
          display: block;
        }

        .zfooter-logo-name {
          font-size: 14px; font-weight: 700;
          color: rgba(232,233,243,0.6);
          letter-spacing: -0.02em;
        }

        .zfooter-copy {
          font-size: 12px;
          color: rgba(232,233,243,0.25);
          letter-spacing: -0.01em;
          position: absolute;
          left: 50%; transform: translateX(-50%);
        }

        .zfooter-links {
          display: flex; align-items: center; gap: 20px;
        }

        .zfooter-link {
          font-size: 12.5px; font-weight: 500;
          color: rgba(232,233,243,0.35);
          text-decoration: none;
          letter-spacing: -0.01em;
          transition: color 0.15s;
        }

        .zfooter-link:hover { color: rgba(232,233,243,0.75); }

        .zfooter-divider {
          width: 1px; height: 14px;
          background: rgba(255,255,255,0.08);
        }

        @media (max-width: 640px) {
          .zfooter {
            flex-direction: column;
            gap: 20px;
            padding: 28px 20px;
            text-align: center;
          }
          .zfooter-copy {
            position: static;
            transform: none;
          }
        }
      `}</style>

      <footer className="zfooter">

        {/* Left — logo */}
        <Link href="/" className="zfooter-logo">
          <Image
            src="/logo.png"
            alt="Zenntraa"
            width={26}
            height={26}
            className="zfooter-logo-img"
          />
          <span className="zfooter-logo-name">Zenntraa</span>
        </Link>

        {/* Centre — copyright */}
        <span className="zfooter-copy">© {new Date().getFullYear()} Zenntraa Systems, Inc.</span>

        {/* Right — links */}
        <div className="zfooter-links">
          <Link href="/terms"   className="zfooter-link">Terms</Link>
          <div className="zfooter-divider" />
          <Link href="/privacy" className="zfooter-link">Privacy</Link>
          <div className="zfooter-divider" />
          <Link href="/contact" className="zfooter-link">Contact</Link>
        </div>

      </footer>
    </>
  );
}