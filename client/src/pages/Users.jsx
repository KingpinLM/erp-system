import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import SignaturePad from '../components/SignaturePad';

const roleLabels = { admin: 'Administrátor', accountant: 'Účetní', manager: 'Manažer', viewer: 'Náhled' };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ username: '', email: '', password: '', full_name: '', role: 'viewer', active: 1 });
  const [error, setError] = useState('');
  const [signature, setSignature] = useState(null);
  const [sigMode, setSigMode] = useState(null);
  const [sigMsg, setSigMsg] = useState('');
  const fileRef = useRef();

  const load = () => { setLoading(true); api.getUsers().then(setUsers).finally(() => setLoading(false)); };
  useEffect(load, []);

  const openNew = () => { setEditing(null); setForm({ username: '', email: '', password: '', full_name: '', role: 'viewer', active: 1 }); setSignature(null); setSigMode(null); setSigMsg(''); setError(''); setShowModal(true); };
  const openEdit = (u) => {
    setEditing(u); setForm({ username: u.username, email: u.email, password: '', full_name: u.full_name, role: u.role, active: u.active });
    setSignature(null); setSigMode(null); setSigMsg(''); setError(''); setShowModal(true);
    api.getUserSignature(u.id).then(r => setSignature(r.signature)).catch(() => {});
  };

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
              {editing && (
                <div className="form-group" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>Podpis</label>
                  {sigMsg && <div style={{ padding: '6px 12px', background: '#d1fae5', borderRadius: 8, color: '#059669', fontSize: 13, marginBottom: 8 }}>{sigMsg}</div>}
                  {signature && !sigMode && (
                    <div>
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, background: '#fff', textAlign: 'center', marginBottom: 8 }}>
                        <img src={signature} alt="Podpis" style={{ maxWidth: '100%', maxHeight: 100 }} />
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setSigMode('draw')}>Překreslit</button>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setSigMode('upload')}>Nahrát nový</button>
                        <button type="button" className="btn btn-sm" style={{ background: '#fee2e2', color: '#dc2626' }} onClick={async () => {
                          await api.updateUserSignature(editing.id, null);
                          setSignature(null); setSigMsg('Podpis odstraněn'); setTimeout(() => setSigMsg(''), 3000);
                        }}>Odstranit</button>
                      </div>
                    </div>
                  )}
                  {!signature && !sigMode && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => setSigMode('draw')}>Nakreslit podpis</button>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setSigMode('upload')}>Nahrát obrázek</button>
                    </div>
                  )}
                  {sigMode === 'draw' && (
                    <div>
                      <SignaturePad onSave={async (dataUrl) => {
                        await api.updateUserSignature(editing.id, dataUrl);
                        setSignature(dataUrl); setSigMode(null); setSigMsg('Podpis uložen!'); setTimeout(() => setSigMsg(''), 3000);
                      }} />
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setSigMode(null)} style={{ marginTop: 6 }}>Zrušit</button>
                    </div>
                  )}
                  {sigMode === 'upload' && (
                    <div>
                      <input type="file" accept="image/*" ref={fileRef} onChange={async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        if (file.size > 2 * 1024 * 1024) { setSigMsg('Max 2 MB'); return; }
                        const reader = new FileReader();
                        reader.onload = async (ev) => {
                          await api.updateUserSignature(editing.id, ev.target.result);
                          setSignature(ev.target.result); setSigMode(null); setSigMsg('Podpis uložen!'); setTimeout(() => setSigMsg(''), 3000);
                        };
                        reader.readAsDataURL(file);
                      }} style={{ marginBottom: 6 }} />
                      <br />
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setSigMode(null)}>Zrušit</button>
                    </div>
                  )}
                </div>
              )}
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
