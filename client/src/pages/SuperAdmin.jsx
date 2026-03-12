import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../App';

export default function SuperAdmin() {
  const { logout } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [detailTenant, setDetailTenant] = useState(null);
  const [form, setForm] = useState({
    name: '', slug: '',
    admin_username: 'admin', admin_email: '', admin_password: '',
    admin_first_name: '', admin_last_name: ''
  });
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.getTenants().then(setTenants).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openNew = () => {
    setForm({ name: '', slug: '', admin_username: 'admin', admin_email: '', admin_password: '', admin_first_name: '', admin_last_name: '' });
    setError('');
    setShowModal(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.createTenant(form);
      setShowModal(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleActive = async (t) => {
    await api.updateTenant(t.id, { name: t.name, active: !t.active });
    load();
  };

  const deleteTenant = async (t) => {
    if (!confirm(`Opravdu smazat tenant "${t.name}" a VŠECHNA jeho data? Tato akce je nevratná!`)) return;
    await api.deleteTenant(t.id);
    load();
  };

  const showDetail = async (t) => {
    const data = await api.getTenant(t.id);
    setDetailTenant(data);
  };

  const slugify = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
      <header style={{ background: '#1e293b', color: '#fff', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>RFI ERP</h1>
          <span style={{ background: '#7c3aed', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>SUPERADMIN</span>
        </div>
        <button onClick={() => { logout(); window.location.href = '/login'; }} style={{ background: 'none', border: '1px solid #475569', color: '#94a3b8', padding: '6px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
          Odhlásit se
        </button>
      </header>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Správa tenantů</h2>
          <button className="btn btn-primary" onClick={openNew}>+ Nový tenant</button>
        </div>

        {loading ? <div className="loading">Načítání...</div> : (
          <div className="card">
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Název</th>
                    <th>Slug</th>
                    <th>Uživatelé</th>
                    <th>Faktury</th>
                    <th>Status</th>
                    <th>Vytvořen</th>
                    <th>Akce</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map(t => (
                    <tr key={t.id}>
                      <td>{t.id}</td>
                      <td><strong>{t.name}</strong></td>
                      <td><code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontSize: 13 }}>{t.slug}</code></td>
                      <td>{t.user_count}</td>
                      <td>{t.invoice_count}</td>
                      <td>
                        <span className={`badge ${t.active ? 'badge-paid' : 'badge-cancelled'}`}>
                          {t.active ? 'Aktivní' : 'Neaktivní'}
                        </span>
                      </td>
                      <td>{t.created_at?.slice(0, 10)}</td>
                      <td>
                        <div className="btn-group">
                          <button className="btn btn-outline btn-sm" onClick={() => showDetail(t)}>Detail</button>
                          <button className="btn btn-outline btn-sm" onClick={() => toggleActive(t)}>
                            {t.active ? 'Deaktivovat' : 'Aktivovat'}
                          </button>
                          <button className="btn btn-sm" style={{ background: '#fee2e2', color: '#dc2626' }} onClick={() => deleteTenant(t)}>
                            Smazat
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {detailTenant && (
        <div className="modal-overlay" onClick={() => setDetailTenant(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3 className="modal-title">Tenant: {detailTenant.name}</h3>
              <button className="modal-close" onClick={() => setDetailTenant(null)}>&times;</button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <strong>Slug:</strong> <code>{detailTenant.slug}</code><br />
              <strong>Status:</strong> {detailTenant.active ? 'Aktivní' : 'Neaktivní'}<br />
              <strong>Vytvořen:</strong> {detailTenant.created_at?.slice(0, 10)}
            </div>
            {detailTenant.company && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ marginBottom: 8 }}>Společnost</h4>
                <div style={{ fontSize: 13, color: '#64748b' }}>
                  {detailTenant.company.name} | IČO: {detailTenant.company.ico || '-'} | DIČ: {detailTenant.company.dic || '-'}
                </div>
              </div>
            )}
            <h4 style={{ marginBottom: 8 }}>Uživatelé ({detailTenant.users?.length || 0})</h4>
            <div className="table-responsive">
              <table>
                <thead><tr><th>Uživatel</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
                <tbody>
                  {detailTenant.users?.map(u => (
                    <tr key={u.id}>
                      <td>{u.username} <small style={{ color: '#94a3b8' }}>({u.full_name})</small></td>
                      <td>{u.email}</td>
                      <td>{u.role}</td>
                      <td><span className={`badge ${u.active ? 'badge-paid' : 'badge-cancelled'}`}>{u.active ? 'Aktivní' : 'Neaktivní'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Nový tenant</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            {error && <div className="login-error">{error}</div>}
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Název firmy *</label>
                <input className="form-input" value={form.name} onChange={e => {
                  const name = e.target.value;
                  setForm(f => ({ ...f, name, slug: f.slug || slugify(name) }));
                }} required />
              </div>
              <div className="form-group">
                <label className="form-label">Slug (identifikátor pro přihlášení) *</label>
                <input className="form-input" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} required
                  pattern="[a-z0-9-]+" title="Pouze malá písmena, čísla a pomlčky"
                  style={{ fontFamily: 'monospace' }} />
              </div>
              <div style={{ borderTop: '1px solid #e2e8f0', margin: '16px 0', paddingTop: 16 }}>
                <h4 style={{ fontSize: 14, marginBottom: 12, color: '#64748b' }}>Admin účet pro nového tenanta</h4>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Jméno *</label>
                  <input className="form-input" value={form.admin_first_name} onChange={e => setForm(f => ({ ...f, admin_first_name: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Příjmení</label>
                  <input className="form-input" value={form.admin_last_name} onChange={e => setForm(f => ({ ...f, admin_last_name: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Admin uživatel *</label>
                <input className="form-input" value={form.admin_username} onChange={e => setForm(f => ({ ...f, admin_username: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Admin email *</label>
                <input className="form-input" type="email" value={form.admin_email} onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Admin heslo *</label>
                <input className="form-input" type="password" value={form.admin_password} onChange={e => setForm(f => ({ ...f, admin_password: e.target.value }))} required minLength={6} />
              </div>
              <div className="btn-group" style={{ marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn-primary">Vytvořit tenanta</button>
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Zrušit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
