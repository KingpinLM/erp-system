import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

export default function Login() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    // Check for error from form-login redirect
    if (searchParams.get('error')) {
      setError('Neplatné přihlašovací údaje');
    }
    // Check for cookies set by form-login (after redirect to /?loggedin=1)
    // This is handled in App.jsx
  }, [searchParams]);

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">RFI ERP</h1>
        <p className="login-subtitle">Přihlaste se do systému</p>
        {error && <div className="login-error">{error}</div>}
        <form method="POST" action="/api/auth/form-login">
          <div className="form-group">
            <label className="form-label">Uživatelské jméno</label>
            <input className="form-input" name="username" placeholder="uzivatel" required autoComplete="username" />
          </div>
          <div className="form-group">
            <label className="form-label">Heslo</label>
            <input className="form-input" type="password" name="password" placeholder="••••••" required autoComplete="current-password" />
          </div>
          <button className="btn btn-primary login-btn" type="submit">
            Přihlásit se
          </button>
        </form>
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
          <Link to="/forgot-password" style={{ color: 'var(--primary)' }}>Zapomenuté heslo?</Link>
          <Link to="/register" style={{ color: 'var(--primary)' }}>Zaregistrovat se</Link>
        </div>
        <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: '#64748b' }}>
          <strong>Demo:</strong> admin / admin123 | ucetni / ucetni123<br />
          manager / manager123 | viewer / viewer123
        </div>
      </div>
    </div>
  );
}
