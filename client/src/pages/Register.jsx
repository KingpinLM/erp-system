import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

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
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    const animate = () => {
      time++;
      const w = canvas.width, h = canvas.height;
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
      ctx.fillStyle = 'rgba(255,255,255,0.012)';
      for (let i = 0; i < 60; i++) { ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
      animId = requestAnimationFrame(animate);
    };
    animate();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
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

export default function Register() {
  const [form, setForm] = useState({ username: '', email: '', password: '', password2: '', first_name: '', last_name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [focusField, setFocusField] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.password2) { setError('Hesla se neshodují'); return; }
    if (form.password.length < 6) { setError('Heslo musí mít alespoň 6 znaků'); return; }
    setLoading(true);
    try {
      const data = await api.register(form);
      localStorage.setItem('erp_token', data.token);
      localStorage.setItem('erp_user', JSON.stringify(data.user));
      localStorage.removeItem('erp_tenant');
      window.location.href = '/onboarding';
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="login-page-v2">
      <MeshBackground />

      <div className="login-container" style={{ maxWidth: 920 }}>
        {/* Left branding panel */}
        <div className="login-brand">
          <div className="login-brand-content">
            <div className="login-logo-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
            </div>
            <h1 className="login-brand-title">Vytvořte si účet</h1>
            <p className="login-brand-desc">Začněte používat RFI ERP pro správu faktur, klientů a účetnictví vaší firmy.</p>
            <div className="login-brand-features">
              <div className="login-brand-feature">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <span>Registrace zdarma</span>
              </div>
              <div className="login-brand-feature">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <span>Vytvořte firmu nebo se připojte</span>
              </div>
              <div className="login-brand-feature">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <span>Bezpečné šifrované heslo</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right form panel */}
        <div className="login-form-panel">
          <div className="login-form-inner" style={{ maxWidth: 360 }}>
            <div className="login-form-header">
              <h2>Registrace</h2>
              <p>Vyplňte údaje pro vytvoření účtu</p>
            </div>

            {error && (
              <div className="login-error-v2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 0.75rem' }}>
                <div className={`login-field ${focusField === 'fname' ? 'focused' : ''}`}>
                  <label>Jméno *</label>
                  <div className="login-input-wrap">
                    <input style={{ paddingLeft: '0.75rem' }} value={form.first_name}
                      onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                      placeholder="Jan" required autoFocus
                      onFocus={() => setFocusField('fname')} onBlur={() => setFocusField('')} />
                  </div>
                </div>
                <div className={`login-field ${focusField === 'lname' ? 'focused' : ''}`}>
                  <label>Příjmení</label>
                  <div className="login-input-wrap">
                    <input style={{ paddingLeft: '0.75rem' }} value={form.last_name}
                      onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                      placeholder="Novák"
                      onFocus={() => setFocusField('lname')} onBlur={() => setFocusField('')} />
                  </div>
                </div>
              </div>

              <div className={`login-field ${focusField === 'user' ? 'focused' : ''}`}>
                <label>Uživatelské jméno *</label>
                <div className="login-input-wrap">
                  <svg className="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                  <input name="username" value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    placeholder="jan.novak" required autoComplete="username"
                    onFocus={() => setFocusField('user')} onBlur={() => setFocusField('')} />
                </div>
              </div>

              <div className={`login-field ${focusField === 'email' ? 'focused' : ''}`}>
                <label>Email *</label>
                <div className="login-input-wrap">
                  <svg className="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                  </svg>
                  <input type="email" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="jan@firma.cz" required autoComplete="email"
                    onFocus={() => setFocusField('email')} onBlur={() => setFocusField('')} />
                </div>
              </div>

              <div className={`login-field ${focusField === 'pw' ? 'focused' : ''}`}>
                <label>Heslo *</label>
                <div className="login-input-wrap">
                  <svg className="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <input type={showPw ? 'text' : 'password'} value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min. 6 znaků" required minLength={6} autoComplete="new-password"
                    onFocus={() => setFocusField('pw')} onBlur={() => setFocusField('')} />
                  <EyeToggle visible={showPw} onClick={() => setShowPw(v => !v)} />
                </div>
              </div>

              <div className={`login-field ${focusField === 'pw2' ? 'focused' : ''}`}>
                <label>Potvrzení hesla *</label>
                <div className="login-input-wrap">
                  <svg className="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <input type={showPw2 ? 'text' : 'password'} value={form.password2}
                    onChange={e => setForm(f => ({ ...f, password2: e.target.value }))}
                    placeholder="Zopakujte heslo" required autoComplete="new-password"
                    onFocus={() => setFocusField('pw2')} onBlur={() => setFocusField('')} />
                  <EyeToggle visible={showPw2} onClick={() => setShowPw2(v => !v)} />
                </div>
              </div>

              <button className="login-submit" type="submit" disabled={loading}>
                {loading ? 'Registruji...' : 'Zaregistrovat se'}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
            </form>

            <div className="login-links" style={{ justifyContent: 'center' }}>
              <Link to="/login">Už máte účet? Přihlaste se</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
