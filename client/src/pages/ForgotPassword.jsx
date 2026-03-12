import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';

export default function ForgotPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  // If token in URL → show reset form, otherwise show email form
  if (token) return <ResetForm token={token} />;
  return <RequestForm />;
}

function RequestForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">RFI ERP</h1>
        <p className="login-subtitle">Obnovení hesla</p>
        {sent ? (
          <div style={{ background: '#d1fae5', color: '#059669', padding: '1rem', borderRadius: 8, textAlign: 'center', marginBottom: '1rem' }}>
            Pokud existuje účet s emailem <strong>{email}</strong>, bude zaslán odkaz pro obnovení hesla.
            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
              V této demo verzi kontaktujte administrátora pro reset hesla.
            </div>
          </div>
        ) : (
          <>
            {error && <div className="login-error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Emailová adresa</label>
                <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vas@email.cz" required />
              </div>
              <button className="btn btn-primary login-btn" type="submit" disabled={loading}>
                {loading ? 'Odesílám...' : 'Odeslat odkaz pro obnovení'}
              </button>
            </form>
          </>
        )}
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <Link to="/login" style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>Zpět na přihlášení</Link>
        </div>
      </div>
    </div>
  );
}

function ResetForm({ token }) {
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== password2) { setError('Hesla se neshodují'); return; }
    if (password.length < 6) { setError('Heslo musí mít alespoň 6 znaků'); return; }
    setLoading(true);
    setError('');
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">RFI ERP</h1>
        <p className="login-subtitle">Nastavení nového hesla</p>
        {done ? (
          <div style={{ background: '#d1fae5', color: '#059669', padding: '1rem', borderRadius: 8, textAlign: 'center', marginBottom: '1rem' }}>
            Heslo bylo úspěšně změněno. Nyní se můžete přihlásit.
          </div>
        ) : (
          <>
            {error && <div className="login-error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nové heslo *</label>
                <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
              </div>
              <div className="form-group">
                <label className="form-label">Potvrzení hesla *</label>
                <input className="form-input" type="password" value={password2} onChange={e => setPassword2(e.target.value)} required />
              </div>
              <button className="btn btn-primary login-btn" type="submit" disabled={loading}>
                {loading ? 'Měním...' : 'Změnit heslo'}
              </button>
            </form>
          </>
        )}
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <Link to="/login" style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>Zpět na přihlášení</Link>
        </div>
      </div>
    </div>
  );
}
