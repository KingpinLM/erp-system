import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { api } from '../api';

export default function Onboarding() {
  const [mode, setMode] = useState(null); // 'create' | 'join'
  const { setSession } = useAuth();
  const navigate = useNavigate();

  if (mode === 'create') return <CreateTenant onBack={() => setMode(null)} setSession={setSession} navigate={navigate} />;
  if (mode === 'join') return <JoinTenant onBack={() => setMode(null)} setSession={setSession} navigate={navigate} />;

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 480 }}>
        <h1 className="login-title">RFI ERP</h1>
        <p className="login-subtitle">Vítejte! Zvolte, jak chcete začít:</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
          <button className="btn btn-primary" onClick={() => setMode('create')} style={{ padding: '1rem', fontSize: '1rem' }}>
            Vytvořit novou firmu
          </button>
          <button className="btn" onClick={() => setMode('join')} style={{ padding: '1rem', fontSize: '1rem', background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0' }}>
            Připojit se k existující firmě
          </button>
        </div>
        <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: '#64748b', textAlign: 'center' }}>
          Pro připojení k existující firmě budete potřebovat kód pozvánky od administrátora.
        </div>
      </div>
    </div>
  );
}

function CreateTenant({ onBack, setSession, navigate }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleNameChange = (val) => {
    setName(val);
    // Auto-generate slug from name
    setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.createTenantOnboarding({ name, slug });
      setSession(data.token, data.user, data.tenant);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">RFI ERP</h1>
        <p className="login-subtitle">Vytvořit novou firmu</p>
        {error && <div className="login-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Název firmy *</label>
            <input className="form-input" value={name} onChange={e => handleNameChange(e.target.value)} placeholder="Moje firma s.r.o." required />
          </div>
          <div className="form-group">
            <label className="form-label">Identifikátor (slug) *</label>
            <input className="form-input" value={slug} onChange={e => setSlug(e.target.value)} placeholder="moje-firma" required
              style={{ fontFamily: 'monospace', letterSpacing: '0.5px' }} pattern="[a-z0-9-]+" title="Pouze malá písmena, čísla a pomlčky" />
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>Pouze malá písmena, čísla a pomlčky</div>
          </div>
          <button className="btn btn-primary login-btn" type="submit" disabled={loading}>
            {loading ? 'Vytvářím...' : 'Vytvořit firmu'}
          </button>
        </form>
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.9rem' }}>
            Zpět na výběr
          </button>
        </div>
      </div>
    </div>
  );
}

function JoinTenant({ onBack, setSession, navigate }) {
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.joinTenant(inviteCode.trim());
      if (data.pending) {
        setPending(true);
        setSession(data.token, data.user, data.tenant);
      } else {
        setSession(data.token, data.user, data.tenant);
        navigate('/');
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  if (pending) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1 className="login-title">RFI ERP</h1>
          <div style={{ background: '#fef3c7', color: '#92400e', padding: '1rem', borderRadius: 8, textAlign: 'center', marginBottom: '1rem' }}>
            <strong>Žádost odeslána!</strong><br />
            Váš účet čeká na schválení administrátorem firmy.<br />
            Po schválení se budete moci přihlásit a používat systém.
          </div>
          <button onClick={() => { localStorage.removeItem('erp_token'); localStorage.removeItem('erp_user'); localStorage.removeItem('erp_tenant'); window.location.href = '/login'; }}
            className="btn btn-primary" style={{ width: '100%' }}>
            Zpět na přihlášení
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">RFI ERP</h1>
        <p className="login-subtitle">Připojit se k firmě</p>
        {error && <div className="login-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Kód pozvánky *</label>
            <input className="form-input" value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="abc123def456" required
              style={{ fontFamily: 'monospace', letterSpacing: '1px', textAlign: 'center', fontSize: '1.1rem' }} />
          </div>
          <button className="btn btn-primary login-btn" type="submit" disabled={loading}>
            {loading ? 'Připojuji...' : 'Připojit se'}
          </button>
        </form>
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.9rem' }}>
            Zpět na výběr
          </button>
        </div>
      </div>
    </div>
  );
}
