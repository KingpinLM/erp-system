import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

function MeshBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let time = 0;

    const blobs = [
      { x: 0.2, y: 0.3, r: 0.35, color: [13, 148, 136], speed: 0.0004, phase: 0 },
      { x: 0.8, y: 0.2, r: 0.3, color: [8, 145, 178], speed: 0.0003, phase: 2 },
      { x: 0.5, y: 0.8, r: 0.32, color: [15, 118, 110], speed: 0.00035, phase: 4 },
      { x: 0.3, y: 0.7, r: 0.28, color: [45, 212, 191], speed: 0.00025, phase: 1 },
      { x: 0.7, y: 0.6, r: 0.25, color: [124, 58, 237], speed: 0.00045, phase: 3 },
    ];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      time++;
      const w = canvas.width;
      const h = canvas.height;

      ctx.fillStyle = '#0a0f1e';
      ctx.fillRect(0, 0, w, h);

      blobs.forEach(blob => {
        const cx = w * (blob.x + 0.12 * Math.sin(time * blob.speed + blob.phase));
        const cy = h * (blob.y + 0.10 * Math.cos(time * blob.speed * 1.3 + blob.phase));
        const r = Math.min(w, h) * blob.r;

        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        const [cr, cg, cb] = blob.color;
        gradient.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, 0.18)`);
        gradient.addColorStop(0.5, `rgba(${cr}, ${cg}, ${cb}, 0.06)`);
        gradient.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
      });

      // subtle noise grain overlay
      ctx.fillStyle = 'rgba(255,255,255,0.012)';
      for (let i = 0; i < 60; i++) {
        const nx = Math.random() * w;
        const ny = Math.random() * h;
        ctx.fillRect(nx, ny, 1.5, 1.5);
      }

      animId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0 }} />;
}

function EyeToggle({ visible, onClick }) {
  return (
    <button type="button" onClick={onClick} tabIndex={-1}
      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 2, display: 'flex' }}>
      {visible ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
      )}
    </button>
  );
}

export default function Login() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [focusField, setFocusField] = useState('');

  useEffect(() => {
    const err = searchParams.get('error');
    if (err === 'deactivated') {
      setError('Váš účet byl deaktivován. Kontaktujte administrátora vaší organizace.');
    } else if (err) {
      setError('Neplatné přihlašovací údaje');
    }
  }, [searchParams]);

  return (
    <div className="login-page-v2">
      <MeshBackground />

      <div className="login-container">
        {/* Left branding panel */}
        <div className="login-brand">
          <div className="login-brand-content">
            <div className="login-logo-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>
              </svg>
            </div>
            <h1 className="login-brand-title">RFI ERP</h1>
            <p className="login-brand-desc">Moderní systém pro správu faktur, klientů a účetnictví vaší firmy.</p>
            <div className="login-brand-features">
              <div className="login-brand-feature">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <span>Fakturace a evidence</span>
              </div>
              <div className="login-brand-feature">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <span>Správa klientů</span>
              </div>
              <div className="login-brand-feature">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <span>Bankovní integrace</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right form panel */}
        <div className="login-form-panel">
          <div className="login-form-inner">
            <div className="login-form-header">
              <h2>Vítejte zpět</h2>
              <p>Přihlaste se ke svému účtu</p>
            </div>

            {error && (
              <div className="login-error-v2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                {error}
              </div>
            )}

            <form method="POST" action="/api/auth/form-login">
              <div className={`login-field ${focusField === 'user' ? 'focused' : ''}`}>
                <label>Uživatelské jméno</label>
                <div className="login-input-wrap">
                  <svg className="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                  <input name="username" placeholder="Zadejte uživatelské jméno" required autoComplete="username" autoFocus
                    onFocus={() => setFocusField('user')} onBlur={() => setFocusField('')} />
                </div>
              </div>

              <div className={`login-field ${focusField === 'pw' ? 'focused' : ''}`}>
                <label>Heslo</label>
                <div className="login-input-wrap">
                  <svg className="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <input name="password" type={showPw ? 'text' : 'password'} placeholder="Zadejte heslo" required autoComplete="current-password"
                    onFocus={() => setFocusField('pw')} onBlur={() => setFocusField('')} />
                  <EyeToggle visible={showPw} onClick={() => setShowPw(v => !v)} />
                </div>
              </div>

              <button className="login-submit" type="submit">
                Přihlásit se
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
            </form>

            <div className="login-links">
              <Link to="/forgot-password">Zapomenuté heslo?</Link>
              <Link to="/register">Vytvořit účet</Link>
            </div>

            <div className="login-demo">
              <div className="login-demo-label">Demo přístupy</div>
              <div className="login-demo-grid">
                <span><strong>admin</strong> / admin123</span>
                <span><strong>ucetni</strong> / ucetni123</span>
                <span><strong>manager</strong> / manager123</span>
                <span><strong>viewer</strong> / viewer123</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
