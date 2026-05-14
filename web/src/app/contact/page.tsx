'use client';

import { useState } from 'react';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/contact`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Something went wrong.');
      }

      setStatus('success');
      setForm({ name: '', email: '', message: '' });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.');
      setStatus('error');
    }
  };

  return (
    <>
      <style>{`
        .ct-root {
          min-height: 100vh;
          background: #11112b;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 16px;
          font-family: 'Sora', sans-serif;
        }
        .ct-card {
          width: 100%;
          max-width: 520px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          padding: 40px 36px;
        }
        .ct-eyebrow {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(124,131,245,0.7);
          margin-bottom: 8px;
        }
        .ct-title {
          font-size: 26px;
          font-weight: 800;
          color: #e8e9f3;
          letter-spacing: -0.04em;
          margin-bottom: 6px;
        }
        .ct-sub {
          font-size: 13.5px;
          color: rgba(232,233,243,0.45);
          margin-bottom: 32px;
          line-height: 1.6;
        }
        .ct-field { margin-bottom: 18px; }
        .ct-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: rgba(232,233,243,0.6);
          margin-bottom: 7px;
          letter-spacing: 0.02em;
        }
        .ct-input, .ct-textarea {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          padding: 11px 14px;
          font-size: 14px;
          color: #e8e9f3;
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
        }
        .ct-input::placeholder, .ct-textarea::placeholder { color: rgba(232,233,243,0.25); }
        .ct-input:focus, .ct-textarea:focus {
          border-color: rgba(124,131,245,0.4);
          box-shadow: 0 0 0 3px rgba(124,131,245,0.07);
        }
        .ct-textarea { resize: vertical; min-height: 120px; line-height: 1.6; }
        .ct-btn {
          width: 100%;
          padding: 13px;
          background: linear-gradient(135deg, #7c83f5, #a78bfa);
          border: none;
          border-radius: 10px;
          font-family: inherit;
          font-size: 14px;
          font-weight: 700;
          color: #fff;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s;
          margin-top: 4px;
        }
        .ct-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .ct-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .ct-success {
          text-align: center;
          padding: 24px 0 8px;
        }
        .ct-success-icon {
          font-size: 40px;
          margin-bottom: 14px;
        }
        .ct-success-title {
          font-size: 18px;
          font-weight: 700;
          color: #e8e9f3;
          letter-spacing: -0.03em;
          margin-bottom: 8px;
        }
        .ct-success-msg {
          font-size: 13.5px;
          color: rgba(232,233,243,0.5);
          line-height: 1.6;
        }
        .ct-error {
          background: rgba(239,68,68,0.07);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 12.5px;
          color: #f87171;
          margin-bottom: 16px;
        }
      `}</style>

      <div className="ct-root">
        <div className="ct-card">
          <div className="ct-eyebrow">Contact</div>
          <h1 className="ct-title">Get in touch</h1>
          <p className="ct-sub">
            Have questions, feedback, or need help? We&apos;ll get back to you within 24 hours.
          </p>

          {status === 'success' ? (
            <div className="ct-success">
              <div className="ct-success-icon">✅</div>
              <div className="ct-success-title">Message sent!</div>
              <p className="ct-success-msg">
                Thanks for reaching out. We&apos;ll reply to your email soon.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {status === 'error' && (
                <div className="ct-error">⚠ {errorMsg}</div>
              )}

              <div className="ct-field">
                <label className="ct-label" htmlFor="name">Name</label>
                <input
                  id="name"
                  className="ct-input"
                  type="text"
                  placeholder="Your name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="ct-field">
                <label className="ct-label" htmlFor="email">Email</label>
                <input
                  id="email"
                  className="ct-input"
                  type="email"
                  placeholder="you@example.com"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div className="ct-field">
                <label className="ct-label" htmlFor="message">Message</label>
                <textarea
                  id="message"
                  className="ct-textarea"
                  placeholder="How can we help?"
                  required
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                />
              </div>

              <button
                className="ct-btn"
                type="submit"
                disabled={status === 'loading'}
              >
                {status === 'loading' ? 'Sending…' : 'Send message'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
