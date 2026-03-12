import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../App';

export default function Login() {
  const [tenantSlug, setTenantSlug] = useState(localStorage.getItem('erp_tenant_slug') || '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const { login, superadminLogin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSuperadmin) {
        await superadminLogin(username, password);
        navigate('/superadmin');
      } else {
        if (!tenantSlug.trim()) {
          setError('Zadejte identifikátor firmy');
          setLoading(false);
          return;
        }
        await login(username, password, tenantSlug.trim());
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Neplatné přihlašovací údaje');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">RFI ERP</h1>
        <p className="login-subtitle">
          {isSuperadmin ? 'Superadmin přihlášení' : 'Přihlaste se do systému'}
        </p>
        {error && <div className="login-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          {!isSuperadmin && (
            <div className="form-group">
              <label className="form-label">Firma (identifikátor)</label>
              <input
                className="form-input"
                value={tenantSlug}
                onChange={e => setTenantSlug(e.target.value)}
                placeholder="napr. moje-firma"
                required
                style={{ fontFamily: 'monospace', letterSpacing: '0.5px' }}
              />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Uživatelské jméno</label>
            <input className="form-input" value={username} onChange={e => setUsername(e.target.value)} placeholder="admin" required />
          </div>
          <div className="form-group">
            <label className="form-label">Heslo</label>
            <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" required />
          </div>
          <button className="btn btn-primary login-btn" type="submit" disabled={loading}>
            {loading ? 'Přihlašování...' : 'Přihlásit se'}
          </button>
        </form>
        {!isSuperadmin && (
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <Link to="/forgot-password" style={{ color: 'var(--primary)' }}>Zapomenuté heslo?</Link>
            <Link to="/register" style={{ color: 'var(--primary)' }}>Zaregistrovat se</Link>
          </div>
        )}
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => { setIsSuperadmin(!isSuperadmin); setError(''); }}
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {isSuperadmin ? 'Zpět na firemní přihlášení' : 'Superadmin přihlášení'}
          </button>
        </div>
        {!isSuperadmin && (
          <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: '#64748b' }}>
            <strong>Demo:</strong> Firma: <code>rfi</code> nebo <code>demo</code><br />
            admin / admin123 | ucetni / ucetni123<br />
            manager / manager123 | viewer / viewer123
          </div>
        )}
        {isSuperadmin && (
          <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: '#64748b' }}>
            <strong>Demo:</strong> superadmin / super123
          </div>
        )}
      </div>
    </div>
  );
}
