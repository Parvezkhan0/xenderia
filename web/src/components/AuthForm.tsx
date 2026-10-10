'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

interface AuthFormProps {
  mode: 'login' | 'signup';
}

// ---------------------------------------------------------------------------
// Stores Firebase ID token in a cookie so middleware.ts can read it.
// Called after every successful sign-in (email or Google).
// ---------------------------------------------------------------------------
async function persistAuthCookie(user: { getIdToken: () => Promise<string> }) {
  const token = await user.getIdToken();
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `firebase-token=${token}; path=/; SameSite=Lax; max-age=3600${secure}`;
}

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  const isLogin = mode === 'login';


  const plan = searchParams.get('plan'); // "pro" or null

  const getPostAuthDestination = (_uid: string): string => {
    // Pro: go back to pricing — user is now logged in so Razorpay modal opens directly
    if (plan === 'pro') return '/pricing';
    return '/dashboard';
  };

  const parseFirebaseError = (code: string): string => {
    switch (code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential': return 'Invalid email or password.';
      case 'auth/email-already-in-use': return 'An account with this email already exists.';
      case 'auth/weak-password': return 'Password must be at least 8 characters.';
      case 'auth/invalid-email': return 'Please enter a valid email address.';
      case 'auth/too-many-requests': return 'Too many attempts. Please try again later.';
      case 'auth/popup-closed-by-user': return 'Google sign-in was cancelled.';
      case 'auth/network-request-failed': return 'Network error. Check your connection.';
      default: return 'Something went wrong. Please try again.';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      let user;
      if (isLogin) {
        const cred = await signInWithEmailAndPassword(auth, form.email, form.password);
        user = cred.user;
      } else {
        const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
        user = cred.user;
        if (form.name) await updateProfile(user, { displayName: form.name });
      }
      await persistAuthCookie(user);
      router.push(getPostAuthDestination(user.uid));
    } catch (err: any) {
      setError(parseFirebaseError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(''); setGoogleLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await persistAuthCookie(cred.user);
      router.push(getPostAuthDestination(cred.user.uid));
    } catch (err: any) {
      setError(parseFirebaseError(err.code));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

        :root {
          --bg:       #11112b;
          --bg-card:  #0d0d22;
          --border:   rgba(255,255,255,0.08);
          --border-f: rgba(124,131,245,0.4);
          --text:     #e8e9f3;
          --muted:    rgba(232,233,243,0.45);
          --dim:      rgba(232,233,243,0.25);
          --accent:   #7c83f5;
          --accent-2: #a78bfa;
          --as:       rgba(124,131,245,0.1);
          --green:    #34d399;
          --mono:     'JetBrains Mono', monospace;
          --sans:     'Sora', sans-serif;
        }

        .za-root {
          min-height: 100vh;
          background: var(--bg);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--sans);
          position: relative;
          overflow: hidden;
          padding: 40px 20px;
        }

        .za-orb {
          position: absolute; top: -100px; left: 50%;
          transform: translateX(-50%);
          width: 700px; height: 500px;
          background: radial-gradient(ellipse, rgba(124,131,245,0.1) 0%, transparent 65%);
          pointer-events: none;
        }

        .za-orb-2 {
          position: absolute; bottom: -60px; right: -60px;
          width: 400px; height: 400px;
          background: radial-gradient(ellipse, rgba(167,139,250,0.06) 0%, transparent 65%);
          pointer-events: none;
        }

        .za-wrap {
          position: relative; z-index: 1;
          width: 100%; max-width: 400px;
          display: flex; flex-direction: column;
          align-items: center; gap: 24px;
        }

        .za-logo {
          display: flex; align-items: center; gap: 9px;
          text-decoration: none;
        }

        .za-logo-img {
          width: 28px; height: 28px;
          object-fit: contain; border-radius: 7px;
        }

        .za-logo-word {
          font-size: 16px; font-weight: 700;
          color: var(--text); letter-spacing: -0.03em;
        }

        .za-card {
          width: 100%;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 32px 28px;
          display: flex; flex-direction: column; gap: 22px;
        }

        .za-card-hdr { display: flex; flex-direction: column; gap: 5px; }

        .za-title {
          font-size: 22px; font-weight: 800;
          color: var(--text); letter-spacing: -0.04em;
          line-height: 1.1;
        }

        .za-sub {
          font-size: 13.5px; color: var(--muted);
          line-height: 1.5; letter-spacing: -0.01em;
        }

        /* Pro intent banner — shown when ?plan=pro */
        .za-pro-banner {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 14px;
          background: rgba(124,131,245,0.08);
          border: 1px solid rgba(124,131,245,0.2);
          border-radius: 10px;
          font-size: 12.5px; color: var(--accent);
          letter-spacing: -0.01em; line-height: 1.4;
        }

        .za-google {
          width: 100%;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          padding: 11px;
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--border);
          border-radius: 10px;
          font-family: var(--sans);
          font-size: 13.5px; font-weight: 500;
          color: var(--muted); cursor: pointer;
          transition: border-color 0.15s, color 0.15s, background 0.15s;
          letter-spacing: -0.01em;
        }

        .za-google:hover:not(:disabled) {
          border-color: rgba(255,255,255,0.16);
          color: var(--text);
          background: rgba(255,255,255,0.07);
        }

        .za-google:disabled { opacity: 0.45; cursor: not-allowed; }

        .za-divider {
          display: flex; align-items: center; gap: 12px;
        }

        .za-div-line { flex: 1; height: 1px; background: var(--border); }

        .za-div-label {
          font-family: var(--mono);
          font-size: 10px; letter-spacing: 0.1em;
          text-transform: uppercase; color: var(--dim);
        }

        .za-form { display: flex; flex-direction: column; gap: 14px; }

        .za-field { display: flex; flex-direction: column; gap: 6px; }

        .za-label-row {
          display: flex; align-items: center; justify-content: space-between;
        }

        .za-label {
          font-family: var(--mono);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--dim);
        }

        .za-forgot {
          font-family: var(--mono);
          font-size: 10px; color: var(--accent);
          text-decoration: none; letter-spacing: 0.04em;
          transition: opacity 0.15s;
        }

        .za-forgot:hover { opacity: 0.75; }

        .za-input-wrap { position: relative; }

        .za-input {
          width: 100%;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 10px 14px;
          font-family: var(--sans);
          font-size: 13.5px; color: var(--text);
          outline: none;
          transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
          letter-spacing: -0.01em;
        }

        .za-input::placeholder { color: var(--dim); }

        .za-input:focus {
          border-color: var(--border-f);
          box-shadow: 0 0 0 3px rgba(124,131,245,0.07);
          background: rgba(124,131,245,0.04);
        }

        .za-input-pw { padding-right: 42px; }

        .za-pw-toggle {
          position: absolute; right: 12px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none; padding: 0;
          color: var(--dim); cursor: pointer;
          display: flex; align-items: center;
          transition: color 0.15s;
        }

        .za-pw-toggle:hover { color: var(--muted); }

        .za-error {
          display: flex; align-items: flex-start; gap: 9px;
          padding: 10px 12px;
          background: rgba(239,68,68,0.07);
          border: 1px solid rgba(239,68,68,0.18);
          border-radius: 10px;
          font-size: 12.5px; color: #f87171;
          line-height: 1.5; letter-spacing: -0.01em;
        }

        .za-error-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: #f87171; flex-shrink: 0; margin-top: 5px;
        }

        .za-submit {
          width: 100%;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 12px;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: #fff; font-family: var(--sans);
          font-size: 14px; font-weight: 600; letter-spacing: -0.02em;
          border: none; border-radius: 10px;
          cursor: pointer; margin-top: 2px;
          box-shadow: 0 2px 14px rgba(124,131,245,0.3);
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
        }

        .za-submit:hover:not(:disabled) {
          opacity: 0.9; transform: translateY(-1px);
          box-shadow: 0 4px 20px rgba(124,131,245,0.45);
        }

        .za-submit:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

        .za-switch {
          text-align: center;
          font-size: 13px; color: var(--muted);
          letter-spacing: -0.01em;
        }

        .za-switch a {
          color: var(--accent); text-decoration: none; font-weight: 600;
          transition: opacity 0.15s;
        }

        .za-switch a:hover { opacity: 0.8; }

        .za-terms {
          text-align: center;
          font-family: var(--mono);
          font-size: 10px; letter-spacing: 0.03em;
          color: var(--dim); line-height: 1.65;
        }

        .za-terms a {
          color: var(--muted); text-decoration: underline;
          text-underline-offset: 2px; transition: color 0.15s;
        }

        .za-terms a:hover { color: var(--text); }

        @keyframes spin { to { transform: rotate(360deg); } }
        .za-spin { animation: spin 0.8s linear infinite; }
      `}</style>

      <div className="za-root">
        <div className="za-orb" />
        <div className="za-orb-2" />

        <div className="za-wrap">

          <Link href="/" className="za-logo">
            <Image src="/logo.png" alt="Xenderia" width={28} height={28} className="za-logo-img" />
            <span className="za-logo-word">Xenderia</span>
          </Link>

          <div className="za-card">

            <div className="za-card-hdr">
              <h1 className="za-title">
                {isLogin ? 'Welcome back.' : 'Get started.'}
              </h1>
              <p className="za-sub">
                {isLogin
                  ? 'Sign in to your Xenderia workspace.'
                  : 'Create your account. Free forever on Starter.'}
              </p>
            </div>

            {/* Show when user clicked "Get Pro" on pricing page */}
            {plan === 'pro' && (
              <div className="za-pro-banner">
                ⚡ {isLogin ? 'Sign in' : 'Sign up'} to continue to Pro checkout
              </div>
            )}

            <button type="button" className="za-google" onClick={handleGoogle} disabled={googleLoading || loading}>
              {googleLoading ? (
                <Loader2 size={15} className="za-spin" />
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              Continue with Google
            </button>

            <div className="za-divider">
              <div className="za-div-line" />
              <span className="za-div-label">or</span>
              <div className="za-div-line" />
            </div>

            <form className="za-form" onSubmit={handleSubmit}>

              {!isLogin && (
                <div className="za-field">
                  <label className="za-label">Full name</label>
                  <div className="za-input-wrap">
                    <input
                      type="text" className="za-input"
                      placeholder="Jane Smith"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required autoComplete="name"
                    />
                  </div>
                </div>
              )}

              <div className="za-field">
                <label className="za-label">Email</label>
                <div className="za-input-wrap">
                  <input
                    type="email" className="za-input"
                    placeholder="you@company.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required autoComplete="email"
                  />
                </div>
              </div>

              <div className="za-field">
                <div className="za-label-row">
                  <label className="za-label">Password</label>
                  {isLogin && <a href="/forgot-password" className="za-forgot">Forgot?</a>}
                </div>
                <div className="za-input-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="za-input za-input-pw"
                    placeholder={isLogin ? '••••••••' : 'Min. 8 characters'}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required minLength={8}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                  />
                  <button type="button" className="za-pw-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password">
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="za-error">
                  <div className="za-error-dot" />
                  {error}
                </div>
              )}

              <button type="submit" className="za-submit" disabled={loading || googleLoading}>
                {loading ? (
                  <Loader2 size={15} className="za-spin" />
                ) : (
                  <>
                    {isLogin ? 'Sign in' : 'Create account'}
                    <ArrowRight size={14} />
                  </>
                )}
              </button>

            </form>

            <p className="za-switch">
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <Link href={isLogin ? `/signup${plan ? `?plan=${plan}` : ''}` : `/login${plan ? `?plan=${plan}` : ''}`}>
                {isLogin ? 'Sign up free' : 'Sign in'}
              </Link>
            </p>

          </div>

          {!isLogin && (
            <p className="za-terms">
              By creating an account you agree to our{' '}
              <a href="/terms">Terms of Service</a> and{' '}
              <a href="/privacy">Privacy Policy</a>.
            </p>
          )}

        </div>
      </div>
    </>
  );
}