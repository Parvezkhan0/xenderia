'use client';

import { useEffect, useState } from 'react';
import { Database, CheckCircle, XCircle, Loader2, Eye, EyeOff, Shield, Zap, Lock, Server } from 'lucide-react';

type TestStatus    = 'idle' | 'testing'    | 'success' | 'error';
type ConnectStatus = 'idle' | 'connecting' | 'connected' | 'error';

interface FormState {
  db_type: 'postgresql';
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
}

interface DatabaseStatusResponse {
  connected: boolean;
  uses_demo: boolean;
  db_type?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  message: string;
}

export default function SettingsPage() {
  const [form, setForm] = useState<FormState>({
    db_type: 'postgresql',
    host: '', port: '5432', database: '', username: '', password: '',
  });
  const [showPassword, setShowPassword]     = useState(false);
  const [testStatus, setTestStatus]         = useState<TestStatus>('idle');
  const [testMessage, setTestMessage]       = useState('');
  const [connectStatus, setConnectStatus]   = useState<ConnectStatus>('idle');
  const [connectMessage, setConnectMessage] = useState('');
  const [disconnecting, setDisconnecting]   = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { getAuth } = await import('firebase/auth');
        const token = await getAuth().currentUser?.getIdToken() ?? '';

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/database/status`, {
          method: 'GET',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        const data: DatabaseStatusResponse = await res.json();

        if (res.ok && data.connected) {
          setForm({
            db_type: 'postgresql',
            host: data.host || '',
            port: String(data.port || 5432),
            database: data.database || '',
            username: data.username || '',
            password: '', // never restore password into the UI
          });
          setConnectStatus('connected');
          setConnectMessage(data.message || 'Database connected successfully');
          return;
        }

        if (res.ok && data.uses_demo) {
          setConnectStatus('idle');
          setConnectMessage('');
          return;
        }

        setConnectStatus('idle');
        setConnectMessage('');
      } catch {
        setConnectStatus('idle');
        setConnectMessage('');
      }
    })();
  }, []);

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }));
      setTestStatus('idle');
      setConnectStatus('idle');
      setConnectMessage('');
    };

  const isFormValid = !!(form.host && form.port && form.database && form.username && form.password);

  const handleTest = async () => {
    if (!isFormValid || connected) return;
    setTestStatus('testing'); setTestMessage('');
    try {
      const res  = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/database/test`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok && data.success) { setTestStatus('success'); setTestMessage(data.message ?? 'Connection successful'); }
      else { setTestStatus('error'); setTestMessage(data.detail ?? data.message ?? 'Connection failed'); }
    } catch { setTestStatus('error'); setTestMessage('Cannot reach backend. Is it running?'); }
  };

  const handleConnect = async () => {
    if (!isFormValid || connected) return;
    setConnectStatus('connecting'); setConnectMessage('');
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken() ?? '';
      const res  = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/database/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setConnectStatus('connected');
        setConnectMessage(data.message ?? 'Database connected successfully');
      } else {
        setConnectStatus('error');
        const detail = data.detail;
        setConnectMessage(
          typeof detail === 'object' ? detail?.message ?? 'Failed to connect' : detail ?? 'Failed to connect'
        );
      }
    } catch {
      setConnectStatus('error');
      setConnectMessage('Cannot reach backend. Is it running?');
    }
  };

  const handleDisconnect = async () => {
    if (!connected || disconnecting) return;
    setDisconnecting(true);
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken() ?? '';
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/database/disconnect`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setConnectStatus('idle');
        setConnectMessage('');
        setTestStatus('idle');
        setTestMessage('');
        setForm({ db_type: 'postgresql', host: '', port: '5432', database: '', username: '', password: '' });
      } else {
        setConnectStatus('error');
        setConnectMessage(data.message ?? data.detail ?? 'Failed to disconnect');
      }
    } catch {
      setConnectStatus('error');
      setConnectMessage('Cannot reach backend. Is it running?');
    } finally {
      setDisconnecting(false);
    }
  };

  const connected = connectStatus === 'connected';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

        :root {
          --bg:       #11112b;
          --bg-panel: #0d0d22;
          --bg-card:  rgba(255,255,255,0.03);
          --bg-input: rgba(255,255,255,0.04);
          --border:   rgba(255,255,255,0.08);
          --border-s: rgba(255,255,255,0.05);
          --border-f: rgba(124,131,245,0.35);
          --text:     #e8e9f3;
          --muted:    rgba(232,233,243,0.45);
          --dim:      rgba(232,233,243,0.25);
          --accent:   #7c83f5;
          --accent-2: #a78bfa;
          --as:       rgba(124,131,245,0.1);
          --as2:      rgba(124,131,245,0.18);
          --green:    #34d399;
          --gs:       rgba(52,211,153,0.1);
          --mono:     'JetBrains Mono', monospace;
          --sans:     'Sora', sans-serif;
        }

        .zs-page {
          min-height: calc(100vh - 60px);
          background: var(--bg);
          font-family: var(--sans);
          padding: 36px 32px;
        }

        .zs-hdr { margin-bottom: 36px; }

        .zs-hdr-eye {
          font-family: var(--mono);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: rgba(124,131,245,0.7);
          margin-bottom: 6px;
        }

        .zs-hdr-title {
          font-size: 24px; font-weight: 800;
          color: var(--text); letter-spacing: -0.04em;
          margin-bottom: 8px;
        }

        .zs-hdr-sub {
          font-size: 14px; color: var(--muted);
          line-height: 1.7; max-width: 500px;
          letter-spacing: -0.01em;
        }

        .zs-layout {
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 24px;
          max-width: 900px;
          align-items: start;
        }

        .zs-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
        }

        .zs-card-hdr {
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-s);
          display: flex; align-items: center; gap: 14px;
          background: rgba(0,0,0,0.15);
        }

        .zs-card-icon {
          width: 38px; height: 38px;
          background: var(--as);
          border: 1px solid var(--as2);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          color: var(--accent); flex-shrink: 0;
        }

        .zs-card-title {
          font-size: 15px; font-weight: 700;
          color: var(--text); letter-spacing: -0.02em;
        }

        .zs-card-subtitle {
          font-size: 12px; color: var(--dim);
          margin-top: 2px;
          display: flex; align-items: center; gap: 6px;
        }

        .zs-card-subtitle-dot {
          width: 4px; height: 4px; border-radius: 50%;
          background: var(--dim);
        }

        .zs-connected-banner {
          margin: 16px 24px 0;
          padding: 12px 16px;
          background: var(--gs);
          border: 1px solid rgba(52,211,153,0.2);
          border-radius: 10px;
          display: flex; align-items: center; gap: 10px;
          animation: zsSlide 0.4s ease both;
        }

        .zs-connected-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: var(--green);
          box-shadow: 0 0 8px rgba(52,211,153,0.5);
          animation: zsPulse 2s ease infinite;
          flex-shrink: 0;
        }

        @keyframes zsPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.8)} }

        .zs-connected-text {
          font-size: 13px; font-weight: 600;
          color: var(--green);
        }

        .zs-connected-sub {
          font-size: 11.5px; color: rgba(52,211,153,0.6);
          margin-top: 1px;
        }

        .zs-upgrade-banner {
          margin: 16px 24px 0;
          padding: 16px 18px;
          background: rgba(124,131,245,0.07);
          border: 1px solid rgba(124,131,245,0.25);
          border-radius: 12px;
          display: flex; align-items: center; gap: 14px;
          animation: zsSlide 0.3s ease both;
        }

        .zs-upgrade-icon {
          width: 36px; height: 36px;
          background: rgba(124,131,245,0.12);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          color: var(--accent); flex-shrink: 0;
        }

        .zs-upgrade-body { flex: 1; }

        .zs-upgrade-title {
          font-size: 13.5px; font-weight: 700;
          color: var(--text); letter-spacing: -0.02em;
          margin-bottom: 3px;
        }

        .zs-upgrade-msg {
          font-size: 12px; color: var(--muted);
          line-height: 1.5; letter-spacing: -0.01em;
        }

        .zs-upgrade-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 9px 16px; white-space: nowrap;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: #fff; border: none; border-radius: 9px;
          font-family: var(--sans); font-size: 12.5px; font-weight: 600;
          cursor: pointer; flex-shrink: 0;
          transition: opacity 0.15s, transform 0.15s;
        }

        .zs-upgrade-btn:hover { opacity: 0.9; transform: translateY(-1px); }

        .zs-card-body {
          padding: 24px;
          display: flex; flex-direction: column; gap: 20px;
        }

        .zs-db-type {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 16px;
          background: var(--as);
          border: 1px solid var(--as2);
          border-radius: 10px;
          width: fit-content;
        }

        .zs-db-type-icon {
          width: 26px; height: 26px;
          background: rgba(124,131,245,0.15);
          border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
          color: var(--accent);
        }

        .zs-db-type-label {
          font-family: var(--mono);
          font-size: 12px; font-weight: 700;
          color: var(--accent); letter-spacing: 0.04em;
        }

        .zs-db-type-sub {
          font-size: 11px; color: rgba(124,131,245,0.5);
          margin-top: 1px;
        }

        .zs-section-label {
          font-family: var(--mono);
          font-size: 9.5px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--dim);
          display: flex; align-items: center; gap: 10px;
        }

        .zs-section-label::after {
          content: ''; flex: 1; height: 1px;
          background: var(--border-s);
        }

        .zs-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .zs-field { display: flex; flex-direction: column; gap: 7px; }
        .zs-field.full { grid-column: 1 / -1; }

        .zs-label {
          font-family: var(--mono);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--dim);
        }

        .zs-input-wrap { position: relative; }

        .zs-input {
          width: 100%;
          padding: 10px 14px;
          background: var(--bg-input);
          border: 1px solid var(--border);
          border-radius: 9px;
          font-family: var(--sans);
          font-size: 13.5px; color: var(--text);
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          letter-spacing: -0.01em;
        }

        .zs-input::placeholder { color: var(--dim); }

        .zs-input:focus {
          border-color: var(--border-f);
          box-shadow: 0 0 0 3px rgba(124,131,245,0.07);
          background: rgba(124,131,245,0.04);
        }

        .zs-input.has-eye { padding-right: 40px; }
        .zs-input:disabled { opacity: 0.7; cursor: not-allowed; }

        .zs-eye-btn {
          position: absolute; right: 12px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none;
          color: var(--dim); cursor: pointer;
          display: flex; align-items: center;
          transition: color 0.15s; padding: 2px;
        }

        .zs-eye-btn:hover { color: var(--muted); }
        .zs-eye-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .zs-security {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 14px 16px;
          background: rgba(52,211,153,0.05);
          border: 1px solid rgba(52,211,153,0.12);
          border-radius: 10px;
        }

        .zs-security-icon { color: var(--green); flex-shrink: 0; margin-top: 1px; }

        .zs-security-text {
          font-size: 12.5px; color: var(--muted); line-height: 1.65;
          letter-spacing: -0.01em;
        }

        .zs-security-text strong { color: var(--text); font-weight: 600; }

        .zs-status {
          display: flex; align-items: center; gap: 9px;
          padding: 11px 14px; border-radius: 10px;
          font-size: 12.5px; letter-spacing: -0.01em;
          animation: zsSlide 0.25s ease both;
        }

        @keyframes zsSlide {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .zs-status.success {
          background: var(--gs); border: 1px solid rgba(52,211,153,0.2);
          color: var(--green);
        }

        .zs-status.error {
          background: rgba(239,68,68,0.07); border: 1px solid rgba(239,68,68,0.18);
          color: #f87171;
        }

        .zs-actions { display: flex; gap: 10px; flex-wrap: wrap; }

        .zs-btn-test {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 20px;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 10px;
          font-family: var(--sans);
          font-size: 13.5px; font-weight: 600;
          color: var(--muted); cursor: pointer;
          transition: all 0.2s;
          letter-spacing: -0.01em;
        }

        .zs-btn-test:hover:not(:disabled) {
          border-color: rgba(124,131,245,0.35);
          color: var(--text);
          background: var(--as);
        }

        .zs-btn-disconnect {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 20px;
          background: transparent;
          border: 1px solid rgba(239,68,68,0.3);
          border-radius: 10px;
          font-family: var(--sans);
          font-size: 13.5px; font-weight: 600;
          color: #f87171; cursor: pointer;
          transition: all 0.2s;
          letter-spacing: -0.01em;
        }

        .zs-btn-disconnect:hover:not(:disabled) {
          border-color: rgba(239,68,68,0.5);
          background: rgba(239,68,68,0.06);
        }

        .zs-btn-test:disabled { opacity: 0.35; cursor: not-allowed; }
        .zs-btn-disconnect:disabled { opacity: 0.35; cursor: not-allowed; }

        .zs-btn-connect {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 22px;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          border: none; border-radius: 10px;
          font-family: var(--sans);
          font-size: 13.5px; font-weight: 600;
          color: #fff; cursor: pointer;
          box-shadow: 0 4px 16px rgba(124,131,245,0.3);
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
          letter-spacing: -0.01em;
        }

        .zs-btn-connect:hover:not(:disabled) {
          opacity: 0.9; transform: translateY(-1px);
          box-shadow: 0 6px 22px rgba(124,131,245,0.45);
        }

        .zs-btn-connect:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }

        .zs-btn-connect.connected {
          background: var(--gs);
          color: var(--green);
          border: 1px solid rgba(52,211,153,0.25);
          box-shadow: none;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .zs-info-col { display: flex; flex-direction: column; gap: 14px; }

        .zs-info-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 18px 18px;
        }

        .zs-info-card-title {
          font-size: 13px; font-weight: 700;
          color: var(--text); letter-spacing: -0.02em;
          margin-bottom: 12px;
          display: flex; align-items: center; gap: 8px;
        }

        .zs-info-card-icon {
          width: 22px; height: 22px;
          border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px;
        }

        .zs-info-rows { display: flex; flex-direction: column; gap: 9px; }

        .zs-info-row {
          display: flex; align-items: flex-start; gap: 9px;
          font-size: 12.5px; color: var(--muted); line-height: 1.5;
          letter-spacing: -0.01em;
        }

        .zs-info-row-dot {
          width: 5px; height: 5px; border-radius: 50%;
          flex-shrink: 0; margin-top: 6px;
        }

        .zs-steps { display: flex; flex-direction: column; gap: 11px; }

        .zs-step { display: flex; align-items: flex-start; gap: 10px; }

        .zs-step-num {
          width: 20px; height: 20px;
          background: var(--as);
          border: 1px solid var(--as2);
          border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          font-family: var(--mono);
          font-size: 10px; font-weight: 700; color: var(--accent);
          flex-shrink: 0;
        }

        .zs-step-text {
          font-size: 12.5px; color: var(--muted);
          line-height: 1.55; letter-spacing: -0.01em;
          padding-top: 2px;
        }

        @media (max-width: 800px) {
          .zs-layout { grid-template-columns: 1fr; }
          .zs-info-col { display: none; }
        }

        @media (max-width: 560px) {
          .zs-page { padding: 20px 16px; }
          .zs-row { grid-template-columns: 1fr; }
          .zs-actions { flex-direction: column; }
          .zs-btn-test, .zs-btn-connect { justify-content: center; }
        }
      `}</style>

      <div className="zs-page">

        <div className="zs-hdr">
          <div className="zs-hdr-eye">Settings</div>
          <h1 className="zs-hdr-title">Connect your database</h1>
          <p className="zs-hdr-sub">
            Give Zenntraa read-only access to your PostgreSQL database. It will translate
            plain English queries into SQL and return exact results.
          </p>
        </div>

        <div className="zs-layout">

          <div className="zs-card">
            <div className="zs-card-hdr">
              <div className="zs-card-icon">
                <Database size={17} />
              </div>
              <div>
                <div className="zs-card-title">PostgreSQL Connection</div>
                <div className="zs-card-subtitle">
                  <Lock size={10} />
                  Read-only access
                  <span className="zs-card-subtitle-dot" />
                  Encrypted in transit
                </div>
              </div>
            </div>

            {connected && (
              <div className="zs-connected-banner">
                <div className="zs-connected-dot" />
                <div>
                  <div className="zs-connected-text">Database connected</div>
                  <div className="zs-connected-sub">{form.database}</div>
                </div>
              </div>
            )}

            <div className="zs-card-body">

              <div>
                <div className="zs-section-label" style={{ marginBottom: 12 }}>Database type</div>
                <div className="zs-db-type">
                  <div className="zs-db-type-icon"><Server size={13} /></div>
                  <div>
                    <div className="zs-db-type-label">PostgreSQL</div>
                    <div className="zs-db-type-sub">Default port 5432</div>
                  </div>
                </div>
              </div>

              <div>
                <div className="zs-section-label" style={{ marginBottom: 14 }}>Connection details</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                  <div className="zs-row">
                    <div className="zs-field">
                      <label className="zs-label">Host</label>
                      <input
                        className="zs-input"
                        placeholder="db.example.com"
                        value={form.host}
                        onChange={set('host')}
                        autoComplete="off"
                        disabled={connected}
                      />
                    </div>
                    <div className="zs-field">
                      <label className="zs-label">Port</label>
                      <input
                        className="zs-input"
                        placeholder="5432"
                        value={form.port}
                        onChange={set('port')}
                        autoComplete="off"
                        disabled={connected}
                      />
                    </div>
                  </div>

                  <div className="zs-field full">
                    <label className="zs-label">Database Name</label>
                    <input
                      className="zs-input"
                      placeholder="my_database"
                      value={form.database}
                      onChange={set('database')}
                      autoComplete="off"
                      disabled={connected}
                    />
                  </div>

                  <div className="zs-row">
                    <div className="zs-field">
                      <label className="zs-label">Username</label>
                      <input
                        className="zs-input"
                        placeholder="db_user"
                        value={form.username}
                        onChange={set('username')}
                        autoComplete="off"
                        disabled={connected}
                      />
                    </div>
                    <div className="zs-field">
                      <label className="zs-label">Password</label>
                      <div className="zs-input-wrap">
                        <input
                          className="zs-input has-eye"
                          type={showPassword ? 'text' : 'password'}
                          placeholder={connected ? 'Saved on server' : '••••••••'}
                          value={form.password}
                          onChange={set('password')}
                          autoComplete="new-password"
                          disabled={connected}
                        />
                        <button
                          type="button"
                          className="zs-eye-btn"
                          onClick={() => setShowPassword(p => !p)}
                          tabIndex={-1}
                          aria-label="Toggle password"
                          disabled={connected}
                        >
                          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="zs-security">
                <Shield size={15} className="zs-security-icon" />
                <p className="zs-security-text">
                  <strong>Read-only access only.</strong> Zenntraa never writes to your database.
                  Credentials are used only to establish the connection and are stored for persistent reconnects during this MVP phase.
                </p>
              </div>

              {testStatus === 'success' && (
                <div className="zs-status success">
                  <CheckCircle size={14} /> {testMessage}
                </div>
              )}
              {testStatus === 'error' && (
                <div className="zs-status error">
                  <XCircle size={14} /> {testMessage}
                </div>
              )}
              {connectStatus === 'connected' && (
                <div className="zs-status success">
                  <CheckCircle size={14} /> {connectMessage}
                </div>
              )}
              {connectStatus === 'error' && (
                <div className="zs-status error">
                  <XCircle size={14} /> {connectMessage}
                </div>
              )}

              <div className="zs-actions">
                <button
                  className="zs-btn-test"
                  onClick={handleTest}
                  disabled={!isFormValid || testStatus === 'testing' || connectStatus === 'connecting' || connected}
                >
                  {testStatus === 'testing'
                    ? <Loader2 size={14} style={{ animation: 'spin .8s linear infinite' }} />
                    : <Zap size={14} />}
                  {testStatus === 'testing' ? 'Testing…' : 'Test connection'}
                </button>

                <button
                  className={`zs-btn-connect ${connected ? 'connected' : ''}`}
                  onClick={handleConnect}
                  disabled={!isFormValid || connectStatus === 'connecting' || connected}
                >
                  {connectStatus === 'connecting'
                    ? <Loader2 size={14} style={{ animation: 'spin .8s linear infinite' }} />
                    : connected
                    ? <CheckCircle size={14} />
                    : <Database size={14} />}
                  {connectStatus === 'connecting' ? 'Connecting…' : connected ? 'Connected' : 'Connect database'}
                </button>

                {connected && (
                  <button
                    className="zs-btn-disconnect"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                  >
                    {disconnecting
                      ? <Loader2 size={14} style={{ animation: 'spin .8s linear infinite' }} />
                      : <XCircle size={14} />}
                    {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                )}
              </div>

            </div>
          </div>

          <div className="zs-info-col">

            <div className="zs-info-card">
              <div className="zs-info-card-title">
                <div className="zs-info-card-icon" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>
                  <Shield size={12} />
                </div>
                Security
              </div>
              <div className="zs-info-rows">
                {[
                  { dot: '#34d399', text: 'Read-only — no writes ever' },
                  { dot: '#34d399', text: 'All queries sandboxed & logged' },
                  { dot: '#34d399', text: 'Credentials encrypted in transit' },
                  { dot: '#fbbf24', text: 'Persistent server-side storage enabled for MVP reconnects' },
                ].map((r, i) => (
                  <div className="zs-info-row" key={i}>
                    <div className="zs-info-row-dot" style={{ background: r.dot }} />
                    {r.text}
                  </div>
                ))}
              </div>
            </div>

            <div className="zs-info-card">
              <div className="zs-info-card-title">
                <div className="zs-info-card-icon" style={{ background: 'var(--as)', color: 'var(--accent)' }}>
                  <Zap size={12} />
                </div>
                How it works
              </div>
              <div className="zs-steps">
                {[
                  'Fill in your PostgreSQL credentials above',
                  'Test the connection to verify access',
                  'Click Connect to activate your database',
                  'Go to Query and start asking in plain English',
                ].map((text, i) => (
                  <div className="zs-step" key={i}>
                    <div className="zs-step-num">{String(i + 1).padStart(2, '0')}</div>
                    <div className="zs-step-text">{text}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      </div>
    </>
  );
}