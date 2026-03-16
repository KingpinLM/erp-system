import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { usePageTitle, useAuth } from '../App';
import { useToast } from '../components/Toast';

const fmtDate = (d) => { if (!d) return '—'; const p = d.slice(0,10).split('-'); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : d; };
const fmt = (n, cur = 'CZK') => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(n);
const statusLabels = { draft: 'Koncept', sent: 'Odesláno', paid: 'Zaplaceno', overdue: 'Po splatnosti', cancelled: 'Zrušeno' };

const labelStyle = { fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gray-500)', marginBottom: 4 };

function InfoField({ label, children }) {
  if (!children) return null;
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontSize: '1rem' }}>{children}</div>
    </div>
  );
}

export default function ClientDetail() {
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [touched, setTouched] = useState({});
  const { can } = useAuth();
  const toast = useToast();
  const dupTimerRef = useRef(null);
  const [duplicateWarnings, setDuplicateWarnings] = useState([]);
  usePageTitle(client ? client.name : undefined);

  const load = () => {
    Promise.all([api.getClient(id), api.getClientInvoices(id)])
      .then(([c, inv]) => { setClient(c); setInvoices(inv); })
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const startEdit = () => {
    setForm({
      name: client.name || '', ico: client.ico || '', dic: client.dic || '',
      email: client.email || '', phone: client.phone || '',
      address: client.address || '', city: client.city || '',
      zip: client.zip || '', country: client.country || 'CZ',
      note: client.note || '',
    });
    setError('');
    setFormErrors({});
    setTouched({});
    setDuplicateWarnings([]);
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setError(''); };

  const validate = () => {
    const e = {};
    if (!form.name?.trim()) e.name = 'Název je povinný';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Neplatný formát e-mailu';
    if (form.ico && !/^\d{7,8}$/.test(form.ico)) e.ico = 'IČO musí mít 7-8 číslic';
    return e;
  };

  const currentErrors = validate();
  const markTouched = (f) => setTouched(t => ({ ...t, [f]: true }));

  const checkDuplicates = (formData) => {
    clearTimeout(dupTimerRef.current);
    dupTimerRef.current = setTimeout(async () => {
      const params = { name: formData.name, ico: formData.ico, dic: formData.dic, email: formData.email, exclude_id: id };
      if (!params.name && !params.ico && !params.dic && !params.email) { setDuplicateWarnings([]); return; }
      try {
        const matches = await api.checkDuplicateClient(params);
        setDuplicateWarnings(matches);
      } catch { setDuplicateWarnings([]); }
    }, 400);
  };

  const updateForm = (updates) => {
    setForm(f => {
      const next = { ...f, ...updates };
      checkDuplicates(next);
      return next;
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setTouched(Object.fromEntries(Object.keys(errs).map(k => [k, true])));
      setFormErrors(errs);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.updateClient(id, form);
      toast.success('Klient byl uložen');
      setEditing(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAres = async () => {
    if (!form.ico) return;
    try {
      const data = await api.aresLookup(form.ico);
      updateForm({
        name: data.name || form.name,
        dic: data.dic || form.dic,
        address: data.address || form.address,
        city: data.city || form.city,
        zip: data.zip || form.zip,
        country: data.country || form.country,
      });
    } catch (e) { toast.error(e.message); }
  };

  if (loading) return <div className="loading">Načítání...</div>;
  if (!client) return <div className="empty-state">Klient nenalezen</div>;

  const totalInvoiced = invoices.reduce((s, i) => s + (i.total_czk || 0), 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total_czk || 0), 0);
  const totalUnpaid = invoices.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((s, i) => s + (i.total_czk || 0), 0);

  return (
    <div>
      {/* Edit / view toggle button */}
      {can('admin', 'accountant', 'manager') && !editing && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button className="btn btn-primary" onClick={startEdit}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Upravit klienta
          </button>
        </div>
      )}

      {editing ? (
        /* ─── EDIT MODE ────────────────────────────────── */
        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="card">
              <div className="card-title" style={{ marginBottom: '1rem' }}>Kontaktní údaje</div>

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

              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Název firmy *</label>
                  <input className={`form-input ${touched.name && currentErrors.name ? 'is-invalid' : ''}`}
                    value={form.name} onChange={e => updateForm({ name: e.target.value })} onBlur={() => markTouched('name')} required />
                  {touched.name && currentErrors.name && <div className="field-error">{currentErrors.name}</div>}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">IČO</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input className={`form-input ${touched.ico && currentErrors.ico ? 'is-invalid' : ''}`}
                        value={form.ico} onChange={e => updateForm({ ico: e.target.value })} onBlur={() => markTouched('ico')} />
                      <button type="button" className="btn btn-outline btn-sm" style={{ whiteSpace: 'nowrap' }} onClick={handleAres}>ARES</button>
                    </div>
                    {touched.ico && currentErrors.ico && <div className="field-error">{currentErrors.ico}</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">DIČ</label>
                    <input className="form-input" value={form.dic} onChange={e => updateForm({ dic: e.target.value })} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input className={`form-input ${touched.email && currentErrors.email ? 'is-invalid' : ''}`}
                      type="email" value={form.email} onChange={e => updateForm({ email: e.target.value })} onBlur={() => markTouched('email')} />
                    {touched.email && currentErrors.email && <div className="field-error">{currentErrors.email}</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Telefon</label>
                    <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-title" style={{ marginBottom: '1rem' }}>Adresa a poznámka</div>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Adresa</label>
                  <input className="form-input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Město</label>
                    <input className="form-input" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">PSČ</label>
                    <input className="form-input" value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Země</label>
                    <input className="form-input" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Poznámka</label>
                  <textarea className="form-input" rows={3} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                    style={{ resize: 'vertical', minHeight: 60 }} />
                </div>
              </div>

              <div className="btn-group" style={{ marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Ukládám...' : 'Uložit změny'}
                </button>
                <button type="button" className="btn btn-outline" onClick={cancelEdit} disabled={saving}>Zrušit</button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        /* ─── VIEW MODE ────────────────────────────────── */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div className="card">
            <div className="card-title" style={{ marginBottom: '1rem' }}>Kontaktní údaje</div>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <InfoField label="Název"><span style={{ fontWeight: 600 }}>{client.name}</span></InfoField>
              {client.ico && <InfoField label="IČO"><span style={{ fontWeight: 600 }}>{client.ico}</span></InfoField>}
              {client.dic && <InfoField label="DIČ"><span style={{ fontWeight: 600 }}>{client.dic}</span></InfoField>}
              {client.email && <InfoField label="Email">{client.email}</InfoField>}
              {client.phone && <InfoField label="Telefon">{client.phone}</InfoField>}
            </div>
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: '1rem' }}>Adresa a statistiky</div>
            <div style={{ display: 'grid', gap: '1rem' }}>
              {(client.address || client.city) && (
                <InfoField label="Adresa">
                  {client.address && <>{client.address}<br/></>}
                  {client.city} {client.zip}
                  {client.country && client.country !== 'CZ' && <>, {client.country}</>}
                </InfoField>
              )}
              {client.note && <InfoField label="Poznámka">{client.note}</InfoField>}
              <InfoField label="Vytvořen">{fmtDate(client.created_at)}</InfoField>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <div style={labelStyle}>Fakturováno</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{fmt(totalInvoiced)}</div>
                </div>
                <div>
                  <div style={labelStyle}>Zaplaceno</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--success)' }}>{fmt(totalPaid)}</div>
                </div>
                <div>
                  <div style={labelStyle}>Nezaplaceno</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--danger)' }}>{fmt(totalUnpaid)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-title" style={{ marginBottom: '1rem' }}>Faktury ({invoices.length})</div>
        {invoices.length === 0 ? <div className="empty-state">Žádné faktury</div> : (
          <div className="table-responsive">
            <table>
              <thead><tr><th>Číslo</th><th>Datum vystavení</th><th>Splatnost</th><th className="text-right">Částka</th><th>Měna</th><th>Stav</th></tr></thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td><Link to={`/invoices/${inv.id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>{inv.invoice_number}</Link></td>
                    <td>{fmtDate(inv.issue_date)}</td>
                    <td>{fmtDate(inv.due_date)}</td>
                    <td className="text-right">{fmt(inv.total, inv.currency)}</td>
                    <td>{inv.currency}</td>
                    <td><span className={`badge badge-${inv.status}`}>{statusLabels[inv.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
