import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../App';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', ico: '', dic: '', email: '', phone: '', address: '', city: '', zip: '', country: 'CZ' });
  const { can } = useAuth();

  const load = () => { setLoading(true); api.getClients().then(setClients).finally(() => setLoading(false)); };
  useEffect(load, []);

  const openNew = () => { setEditing(null); setForm({ name: '', ico: '', dic: '', email: '', phone: '', address: '', city: '', zip: '', country: 'CZ' }); setShowModal(true); };
  const openEdit = (c) => { setEditing(c); setForm({ name: c.name, ico: c.ico || '', dic: c.dic || '', email: c.email || '', phone: c.phone || '', address: c.address || '', city: c.city || '', zip: c.zip || '', country: c.country || 'CZ' }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editing) { await api.updateClient(editing.id, form); } else { await api.createClient(form); }
    setShowModal(false);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Opravdu smazat tohoto klienta?')) return;
    await api.deleteClient(id);
    load();
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Klienti</h1>
        {can('admin', 'accountant', 'manager') && <button className="btn btn-primary" onClick={openNew}>+ Nový klient</button>}
      </div>
      <div className="card">
        {loading ? <div className="loading">Načítání...</div> : clients.length === 0 ? <div className="empty-state">Žádní klienti</div> : (
          <div className="table-responsive">
            <table>
              <thead><tr><th>Název</th><th>IČO</th><th>DIČ</th><th>Email</th><th>Telefon</th><th>Město</th><th>Země</th><th>Akce</th></tr></thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.id}>
                    <td><Link to={`/clients/${c.id}`} style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>{c.name}</Link></td>
                    <td>{c.ico || '—'}</td>
                    <td>{c.dic || '—'}</td>
                    <td>{c.email || '—'}</td>
                    <td>{c.phone || '—'}</td>
                    <td>{c.city || '—'}</td>
                    <td>{c.country}</td>
                    <td>
                      <div className="btn-group">
                        {can('admin', 'accountant', 'manager') && <button className="btn btn-outline btn-sm" onClick={() => openEdit(c)}>Upravit</button>}
                        {can('admin') && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>Smazat</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editing ? 'Upravit klienta' : 'Nový klient'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Název firmy *</label>
                <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">IČO</label><input className="form-input" value={form.ico} onChange={e => setForm(f => ({ ...f, ico: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">DIČ</label><input className="form-input" value={form.dic} onChange={e => setForm(f => ({ ...f, dic: e.target.value }))} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Telefon</label><input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              </div>
              <div className="form-group"><label className="form-label">Adresa</label><input className="form-input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Město</label><input className="form-input" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">PSČ</label><input className="form-input" value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Země</label><input className="form-input" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} /></div>
              </div>
              <div className="btn-group" style={{ marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn-primary">{editing ? 'Uložit' : 'Vytvořit'}</button>
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Zrušit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
