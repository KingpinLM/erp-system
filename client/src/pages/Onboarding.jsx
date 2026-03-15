import React, { useState, useEffect, useRef } from 'react';
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

/* ─── Stepper dots ──────────────────────────────── */
function StepIndicator({ current, total }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: '1.5rem' }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width: i === current ? 24 : 8, height: 8, borderRadius: 4,
          background: i === current ? 'linear-gradient(135deg, #0d9488, #0891b2)' : 'rgba(255,255,255,0.12)',
          transition: 'all 0.3s ease',
        }} />
      ))}
    </div>
  );
}

/* ─── Main Onboarding ───────────────────────────── */
export default function Onboarding() {
  const [mode, setMode] = useState(null); // null | 'create' | 'join'
  const [pending, setPending] = useState(false);

  if (pending) return <PendingApproval />;
  if (mode === 'create') return <CreateTenant onBack={() => setMode(null)} />;
  if (mode === 'join') return <JoinTenant onBack={() => setMode(null)} onPending={() => setPending(true)} />;

  return (
    <div className="login-page-v2">
      <MeshBackground />
      <div className="login-container" style={{ maxWidth: 880 }}>
        <div className="login-brand">
          <div className="login-brand-content">
            <div className="login-logo-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>
              </svg>
            </div>
            <h1 className="login-brand-title">RFI ERP</h1>
            <p className="login-brand-desc">Vítejte v systému! Nastavte si svůj pracovní prostor za pár kroků.</p>
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

        <div className="login-form-panel">
          <div className="login-form-inner" style={{ maxWidth: 360 }}>
            <StepIndicator current={0} total={2} />
            <div className="login-form-header" style={{ textAlign: 'center' }}>
              <h2>Jak chcete začít?</h2>
              <p>Zvolte jednu z možností níže</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Create new company */}
              <button onClick={() => setMode('create')} className="onboarding-option-btn">
                <div className="onboarding-option-icon" style={{ background: 'linear-gradient(135deg, #0d9488, #0891b2)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div className="onboarding-option-title">Vytvořit novou firmu</div>
                  <div className="onboarding-option-desc">Stanete se administrátorem</div>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>

              {/* Join existing */}
              <button onClick={() => setMode('join')} className="onboarding-option-btn">
                <div className="onboarding-option-icon" style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div className="onboarding-option-title">Připojit se k firmě</div>
                  <div className="onboarding-option-desc">Potřebujete kód pozvánky</div>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>

            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <button onClick={() => { localStorage.clear(); window.location.href = '/login'; }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: '0.82rem', transition: 'color 0.15s' }}
                onMouseOver={e => e.currentTarget.style.color = '#2dd4bf'}
                onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}>
                Odhlásit se
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Create Tenant ─────────────────────────────── */
function CreateTenant({ onBack }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusField, setFocusField] = useState('');

  const handleNameChange = (val) => {
    setName(val);
    setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.createTenantOnboarding({ name, slug });
      localStorage.setItem('erp_token', data.token);
      localStorage.setItem('erp_user', JSON.stringify(data.user));
      localStorage.setItem('erp_tenant', JSON.stringify(data.tenant));
      window.location.href = '/';
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="login-page-v2">
      <MeshBackground />
      <div className="login-container" style={{ maxWidth: 880 }}>
        <div className="login-brand">
          <div className="login-brand-content">
            <div className="login-logo-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <h1 className="login-brand-title">Nová firma</h1>
            <p className="login-brand-desc">Vytvořte pracovní prostor pro svou firmu. Jako zakladatel budete mít roli administrátora.</p>
            <div className="login-brand-features">
              <div className="login-brand-feature">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <span>Plná kontrola nad nastavením</span>
              </div>
              <div className="login-brand-feature">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <span>Pozvěte členy týmu později</span>
              </div>
            </div>
          </div>
        </div>

        <div className="login-form-panel">
          <div className="login-form-inner" style={{ maxWidth: 360 }}>
            <StepIndicator current={1} total={2} />
            <div className="login-form-header">
              <h2>Vytvořit firmu</h2>
              <p>Zadejte základní údaje o vaší firmě</p>
            </div>

            {error && (
              <div className="login-error-v2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className={`login-field ${focusField === 'name' ? 'focused' : ''}`}>
                <label>Název firmy *</label>
                <div className="login-input-wrap">
                  <svg className="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  <input value={name} onChange={e => handleNameChange(e.target.value)} placeholder="Moje firma s.r.o." required autoFocus
                    onFocus={() => setFocusField('name')} onBlur={() => setFocusField('')} />
                </div>
              </div>

              <div className={`login-field ${focusField === 'slug' ? 'focused' : ''}`}>
                <label>Identifikátor (slug) *</label>
                <div className="login-input-wrap">
                  <svg className="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                  <input value={slug} onChange={e => setSlug(e.target.value)} placeholder="moje-firma" required
                    style={{ fontFamily: 'monospace', letterSpacing: '0.5px' }} pattern="[a-z0-9-]+" title="Pouze malá písmena, čísla a pomlčky"
                    onFocus={() => setFocusField('slug')} onBlur={() => setFocusField('')} />
                </div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Pouze malá písmena, čísla a pomlčky</div>
              </div>

              <button className="login-submit" type="submit" disabled={loading}>
                {loading ? 'Vytvářím...' : 'Vytvořit firmu'}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
            </form>

            <div className="login-links" style={{ justifyContent: 'center' }}>
              <button type="button" onClick={onBack}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '0.82rem', transition: 'color 0.15s' }}
                onMouseOver={e => e.currentTarget.style.color = '#2dd4bf'}
                onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}>
                Zpět na výběr
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Join Tenant ───────────────────────────────── */
function JoinTenant({ onBack, onPending }) {
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusField, setFocusField] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.joinTenant(inviteCode.trim());
      if (data.pending) {
        onPending();
      } else {
        localStorage.setItem('erp_token', data.token);
        localStorage.setItem('erp_user', JSON.stringify(data.user));
        localStorage.setItem('erp_tenant', JSON.stringify(data.tenant));
        window.location.href = '/';
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="login-page-v2">
      <MeshBackground />
      <div className="login-container" style={{ maxWidth: 880 }}>
        <div className="login-brand">
          <div className="login-brand-content">
            <div className="login-logo-icon" style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)', boxShadow: '0 8px 24px rgba(124,58,237,0.3)' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <h1 className="login-brand-title">Připojit se</h1>
            <p className="login-brand-desc">Připojte se k existující firmě pomocí kódu pozvánky, který jste obdrželi od administrátora.</p>
            <div className="login-brand-features">
              <div className="login-brand-feature">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <span>Zadejte kód od admina</span>
              </div>
              <div className="login-brand-feature">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <span>Admin schválí váš přístup</span>
              </div>
            </div>
          </div>
        </div>

        <div className="login-form-panel">
          <div className="login-form-inner" style={{ maxWidth: 360 }}>
            <StepIndicator current={1} total={2} />
            <div className="login-form-header">
              <h2>Kód pozvánky</h2>
              <p>Zadejte kód, který jste obdrželi</p>
            </div>

            {error && (
              <div className="login-error-v2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className={`login-field ${focusField === 'code' ? 'focused' : ''}`}>
                <label>Kód pozvánky *</label>
                <div className="login-input-wrap">
                  <svg className="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <input value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="abc123def456" required autoFocus
                    style={{ fontFamily: 'monospace', letterSpacing: '2px', fontSize: '1.05rem' }}
                    onFocus={() => setFocusField('code')} onBlur={() => setFocusField('')} />
                </div>
              </div>

              <button className="login-submit" type="submit" disabled={loading}>
                {loading ? 'Připojuji...' : 'Připojit se'}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
            </form>

            <div className="login-links" style={{ justifyContent: 'center' }}>
              <button type="button" onClick={onBack}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '0.82rem', transition: 'color 0.15s' }}
                onMouseOver={e => e.currentTarget.style.color = '#2dd4bf'}
                onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}>
                Zpět na výběr
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Pending Approval ──────────────────────────── */
function PendingApproval() {
  return (
    <div className="login-page-v2">
      <MeshBackground />
      <div className="login-container" style={{ maxWidth: 560, flexDirection: 'column' }}>
        <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
          {/* Animated pulsing icon */}
          <div className="pending-icon-wrap">
            <div className="pending-icon-pulse" />
            <div className="pending-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
            Čekáme na schválení
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, maxWidth: 360, margin: '0 auto 2rem' }}>
            Vaše žádost o připojení k firmě byla odeslána. Administrátor organizace ji brzy posoudí a schválí.
          </p>

          {/* Status steps */}
          <div className="pending-steps">
            <div className="pending-step done">
              <div className="pending-step-icon done">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div className="pending-step-text">
                <div className="pending-step-label">Účet vytvořen</div>
                <div className="pending-step-desc">Registrace proběhla úspěšně</div>
              </div>
            </div>
            <div className="pending-step-line done" />

            <div className="pending-step done">
              <div className="pending-step-icon done">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div className="pending-step-text">
                <div className="pending-step-label">Žádost odeslána</div>
                <div className="pending-step-desc">Admin byl informován</div>
              </div>
            </div>
            <div className="pending-step-line active" />

            <div className="pending-step active">
              <div className="pending-step-icon active">
                <div className="pending-spinner" />
              </div>
              <div className="pending-step-text">
                <div className="pending-step-label" style={{ color: '#2dd4bf' }}>Čeká na schválení</div>
                <div className="pending-step-desc">Administrátor posuzuje žádost</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <button onClick={() => { localStorage.clear(); window.location.href = '/login'; }}
              className="login-submit" style={{ maxWidth: 280, margin: '0 auto' }}>
              Zpět na přihlášení
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
