import React, { useState, useEffect } from 'react';
import { api } from '../api';

const roleLabels = { admin: 'Administrátor', accountant: 'Účetní', manager: 'Manažer', viewer: 'Náhled' };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ username: '', email: '', password: '', full_name: '', role: 'viewer', active: 1 });
  const [error, setError] = useState('');

  const load = () => { setLoading(true); api.getUsers().then(setUsers).finally(() => setLoading(false)); };
  useEffect(load, []);

  const openNew = () => { setEditing(null); setForm({ username: '', email: '', password: '', full_name: '', role: 'viewer', active: 1 }); setError(''); setShowModal(true); };
  const openEdit = (u) => { setEditing(u); setForm({ username: u.username, email: u.email, password: '', full_name: u.full_name, role: u.role, active: u.active }); setError(''); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) {
        const data = { email: form.email, full_name: form.full_name, role: form.role, active: form.active };
        if (form.password) data.password = form.password;
        await api.updateUser(editing.id, data);
      } else {
        await api.createUser(form);
      }
      setShowModal(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Správa uživatelů</h1>
        <button className="btn btn-primary" onClick={openNew}>+ Nový uživatel</button>
      </div>

      <div className="card">
        {loading ? <div className="loading">Načítání...</div> : (
          <div className="table-responsive">
            <table>
              <thead><tr><th>Jméno</th><th>Uživatel</th><th>Email</th><th>Role</th><th>Status</th><th>Vytvořen</th><th>Akce</th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td><strong>{u.full_name}</strong></td>
                    <td>{u.username}</td>
                    <td>{u.email}</td>
                    <td><span className={`badge badge-${u.role}`}>{roleLabels[u.role]}</span></td>
                    <td><span className={`badge ${u.active ? 'badge-paid' : 'badge-cancelled'}`}>{u.active ? 'Aktivní' : 'Neaktivní'}</span></td>
                    <td>{u.created_at?.slice(0, 10)}</td>
                    <td><button className="btn btn-outline btn-sm" onClick={() => openEdit(u)}>Upravit</button></td>
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
              <h3 className="modal-title">{editing ? 'Upravit uživatele' : 'Nový uživatel'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            {error && <div className="login-error">{error}</div>}
            <form onSubmit={handleSubmit}>
              {!editing && (
                <div className="form-group">
                  <label className="form-label">Uživatelské jméno *</label>
                  <input className="form-input" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Celé jméno *</label>
                <input className="form-input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">{editing ? 'Nové heslo (ponechte prázdné = beze změny)' : 'Heslo *'}</label>
                <input className="form-input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} {...(!editing && { required: true })} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    <option value="admin">Administrátor</option>
                    <option value="accountant">Účetní</option>
                    <option value="manager">Manažer</option>
                    <option value="viewer">Náhled</option>
                  </select>
                </div>
                {editing && (
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="form-select" value={form.active} onChange={e => setForm(f => ({ ...f, active: parseInt(e.target.value) }))}>
                      <option value={1}>Aktivní</option>
                      <option value={0}>Neaktivní</option>
                    </select>
                  </div>
                )}
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
