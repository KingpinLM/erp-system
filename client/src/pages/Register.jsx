import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function Register() {
  const [form, setForm] = useState({ username: '', email: '', password: '', password2: '', first_name: '', last_name: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.password2) { setError('Hesla se neshodují'); return; }
    if (form.password.length < 6) { setError('Heslo musí mít alespoň 6 znaků'); return; }
    setLoading(true);
    try {
      await api.register({ username: form.username, email: form.email, password: form.password, first_name: form.first_name, last_name: form.last_name });
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1 className="login-title">RFI ERP</h1>
          <div style={{ background: '#d1fae5', color: '#059669', padding: '1rem', borderRadius: 8, marginBottom: '1rem', textAlign: 'center' }}>
            <strong>Registrace úspěšná!</strong><br />
            Váš účet čeká na schválení administrátorem.<br />
            Po schválení se budete moci přihlásit.
          </div>
          <Link to="/login" className="btn btn-primary" style={{ display: 'block', textAlign: 'center' }}>Zpět na přihlášení</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">RFI ERP</h1>
        <p className="login-subtitle">Vytvořte si účet</p>
        {error && <div className="login-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Jméno *</label>
              <input className="form-input" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Příjmení</label>
              <input className="form-input" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Uživatelské jméno *</label>
            <input className="form-input" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Email *</label>
            <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Heslo *</label>
            <input className="form-input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={6} />
          </div>
          <div className="form-group">
            <label className="form-label">Potvrzení hesla *</label>
            <input className="form-input" type="password" value={form.password2} onChange={e => setForm(f => ({ ...f, password2: e.target.value }))} required />
          </div>
          <button className="btn btn-primary login-btn" type="submit" disabled={loading}>
            {loading ? 'Registruji...' : 'Zaregistrovat se'}
          </button>
        </form>
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <Link to="/login" style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>Už máte účet? Přihlaste se</Link>
        </div>
      </div>
    </div>
  );
}
