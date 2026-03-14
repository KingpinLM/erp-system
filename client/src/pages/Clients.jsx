import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../App';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', ico: '', dic: '', email: '', phone: '', address: '', city: '', zip: '', country: 'CZ' });
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [duplicateWarnings, setDuplicateWarnings] = useState([]);
  const [error, setError] = useState('');
  const dupTimerRef = React.useRef(null);
  const { can } = useAuth();

  const load = () => { setLoading(true); api.getClients().then(setClients).finally(() => setLoading(false)); };
  useEffect(load, []);

  const sorted = useMemo(() => {
    const arr = [...clients];
    arr.sort((a, b) => {
      let va, vb;
      if (sortBy === 'name') { va = (a.name || '').toLowerCase(); vb = (b.name || '').toLowerCase(); }
      else if (sortBy === 'ico') { va = a.ico || ''; vb = b.ico || ''; }
      else if (sortBy === 'email') { va = (a.email || '').toLowerCase(); vb = (b.email || '').toLowerCase(); }
      else if (sortBy === 'city') { va = (a.city || '').toLowerCase(); vb = (b.city || '').toLowerCase(); }
      else if (sortBy === 'country') { va = a.country || ''; vb = b.country || ''; }
      else { va = a.created_at || ''; vb = b.created_at || ''; }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [clients, sortBy, sortDir]);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <span style={{ opacity: 0.3 }}> ↕</span>;
    return <span> {sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const checkDuplicates = (formData, excludeId) => {
    clearTimeout(dupTimerRef.current);
    dupTimerRef.current = setTimeout(async () => {
      const params = { name: formData.name, ico: formData.ico, dic: formData.dic, email: formData.email };
      if (excludeId) params.exclude_id = excludeId;
      if (!params.name && !params.ico && !params.dic && !params.email) { setDuplicateWarnings([]); return; }
      try {
        const matches = await api.checkDuplicateClient(params);
        setDuplicateWarnings(matches);
      } catch { setDuplicateWarnings([]); }
    }, 400);
  };

  const updateForm = (updates, excludeId) => {
    setForm(f => {
      const next = { ...f, ...updates };
      checkDuplicates(next, excludeId);
      return next;
    });
  };

  const openNew = () => { setEditing(null); setForm({ name: '', ico: '', dic: '', email: '', phone: '', address: '', city: '', zip: '', country: 'CZ' }); setDuplicateWarnings([]); setError(''); setShowModal(true); };
  const openEdit = (c) => { setEditing(c); setForm({ name: c.name, ico: c.ico || '', dic: c.dic || '', email: c.email || '', phone: c.phone || '', address: c.address || '', city: c.city || '', zip: c.zip || '', country: c.country || 'CZ' }); setDuplicateWarnings([]); setError(''); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) { await api.updateClient(editing.id, form); } else { await api.createClient(form); }
      setShowModal(false);
      load();
    } catch (err) { setError(err.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Opravdu smazat tohoto klienta?')) return;
    await api.deleteClient(id);
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '1rem' }}>
        <a href="/api/export/clients" className="btn btn-outline btn-sm" download>CSV Export</a>
        {can('admin', 'accountant', 'manager') && <button className="btn btn-primary" onClick={openNew}>+ Nový klient</button>}
      </div>

      <div className="filters" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="form-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="name">Řadit dle názvu</option>
          <option value="ico">Řadit dle IČO</option>
          <option value="email">Řadit dle emailu</option>
          <option value="city">Řadit dle města</option>
          <option value="country">Řadit dle země</option>
          <option value="created_at">Řadit dle vytvoření</option>
        </select>
        <button className="btn btn-outline btn-sm" onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
          {sortDir === 'desc' ? '↓ Sestupně' : '↑ Vzestupně'}
        </button>
      </div>

      <div className="card">
        {loading ? <div className="loading">Načítání...</div> : sorted.length === 0 ? <div className="empty-state">Žádní klienti</div> : (
          <div className="table-responsive">
            <table>
              <thead><tr>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('name')}>Název<SortIcon col="name" /></th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('ico')}>IČO<SortIcon col="ico" /></th>
                <th>DIČ</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('email')}>Email<SortIcon col="email" /></th>
                <th>Telefon</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('city')}>Město<SortIcon col="city" /></th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('country')}>Země<SortIcon col="country" /></th>
                <th>Akce</th>
              </tr></thead>
              <tbody>
                {sorted.map(c => (
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
              {error && (
                <div className="alert alert-error" style={{ marginBottom: '0.75rem' }} onClick={() => setError('')}>{error}</div>
              )}
              {duplicateWarnings.length > 0 && (
                <div style={{ marginBottom: '0.75rem', padding: '0.6rem 0.75rem', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 'var(--radius)', fontSize: '0.82rem', color: '#92400e' }}>
                  <strong style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    Možný duplicitní klient
                  </strong>
                  {duplicateWarnings.map(d => {
                    const matchLabels = { name: 'název', ico: 'IČO', dic: 'DIČ', email: 'email' };
                    return <div key={d.id}>Shoda v poli <strong>{matchLabels[d.match] || d.match}</strong>: {d.name}{d.ico ? ` (IČO: ${d.ico})` : ''}</div>;
                  })}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Název firmy *</label>
                <input className="form-input" value={form.name} onChange={e => updateForm({ name: e.target.value }, editing?.id)} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">IČO</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input className="form-input" value={form.ico} onChange={e => updateForm({ ico: e.target.value }, editing?.id)} />
                    <button type="button" className="btn btn-outline btn-sm" style={{ whiteSpace: 'nowrap' }} onClick={async () => {
                      if (!form.ico) return;
                      try {
                        const data = await api.aresLookup(form.ico);
                        const updates = { name: data.name || form.name, dic: data.dic || form.dic, address: data.address || form.address, city: data.city || form.city, zip: data.zip || form.zip, country: data.country || form.country };
                        updateForm(updates, editing?.id);
                      } catch (e) { alert(e.message); }
                    }}>ARES</button>
                  </div>
                </div>
                <div className="form-group"><label className="form-label">DIČ</label><input className="form-input" value={form.dic} onChange={e => updateForm({ dic: e.target.value }, editing?.id)} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email} onChange={e => updateForm({ email: e.target.value }, editing?.id)} /></div>
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
