import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function Company() {
  const [form, setForm] = useState({ name: 'Rainbow Family Investment', ico: '', dic: '', email: '', phone: '', address: '', city: '', zip: '', country: 'CZ', bank_account: '', iban: '', swift: '' });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getCompany().then(data => {
      if (data && data.name) setForm(f => ({ ...f, ...data }));
    }).finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await api.updateCompany(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading) return <div className="loading">Načítání...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Nastavení společnosti</h1>
      </div>
      {saved && <div style={{ background: '#d1fae5', color: '#059669', padding: '0.75rem', borderRadius: 'var(--radius)', marginBottom: '1rem' }}>Uloženo!</div>}
      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="card-title" style={{ marginBottom: '1rem' }}>Fakturační údaje</div>
          <div className="form-group">
            <label className="form-label">Název společnosti *</label>
            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">IČO</label><input className="form-input" value={form.ico || ''} onChange={e => setForm(f => ({ ...f, ico: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">DIČ</label><input className="form-input" value={form.dic || ''} onChange={e => setForm(f => ({ ...f, dic: e.target.value }))} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Telefon</label><input className="form-input" value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
          </div>
          <div className="form-group"><label className="form-label">Adresa</label><input className="form-input" value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Město</label><input className="form-input" value={form.city || ''} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">PSČ</label><input className="form-input" value={form.zip || ''} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Země</label><input className="form-input" value={form.country || ''} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} /></div>
          </div>
        </div>
        <div className="card">
          <div className="card-title" style={{ marginBottom: '1rem' }}>Bankovní údaje</div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Číslo účtu</label><input className="form-input" value={form.bank_account || ''} onChange={e => setForm(f => ({ ...f, bank_account: e.target.value }))} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">IBAN</label><input className="form-input" value={form.iban || ''} onChange={e => setForm(f => ({ ...f, iban: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">SWIFT/BIC</label><input className="form-input" value={form.swift || ''} onChange={e => setForm(f => ({ ...f, swift: e.target.value }))} /></div>
          </div>
        </div>
        <button type="submit" className="btn btn-primary">Uložit nastavení</button>
      </form>
    </div>
  );
}
