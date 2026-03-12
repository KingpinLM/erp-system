import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../App';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
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
        <p className="login-subtitle">Přihlaste se do systému</p>
        {error && <div className="login-error">{error}</div>}
        <form onSubmit={handleSubmit}>
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
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
          <Link to="/forgot-password" style={{ color: 'var(--primary)' }}>Zapomenuté heslo?</Link>
          <Link to="/register" style={{ color: 'var(--primary)' }}>Zaregistrovat se</Link>
        </div>
        <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: '#64748b' }}>
          <strong>Demo účty:</strong><br />
          admin / admin123 (Administrátor)<br />
          ucetni / ucetni123 (Účetní)<br />
          manager / manager123 (Manažer)<br />
          viewer / viewer123 (Náhled)
        </div>
      </div>
    </div>
  );
}
