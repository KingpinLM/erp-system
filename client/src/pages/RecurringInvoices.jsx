import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../App';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';

const intervalLabels = { weekly: 'Týdně', monthly: 'Měsíčně', quarterly: 'Čtvrtletně', yearly: 'Ročně' };
const fmtDate = (d) => { if (!d) return '—'; const p = d.slice(0,10).split('-'); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : d; };

export default function RecurringInvoices() {
  const [items, setItems] = useState([]);
  const [clients, setClients] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const emptyForm = { client_id: '', currency: 'CZK', payment_method: 'bank_transfer', note: '', interval: 'monthly', next_date: new Date().toISOString().slice(0, 10), end_date: '', items: [{ description: '', quantity: 1, unit: 'ks', unit_price: 0, tax_rate: 0 }] };
  const [form, setForm] = useState(emptyForm);

  const load = () => { setLoading(true); Promise.all([api.getRecurring(), api.getClients(), api.getCurrencies()]).then(([r, c, cur]) => { setItems(r); setClients(c); setCurrencies(cur); }).finally(() => setLoading(false)); };
  useEffect(load, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (r) => { setEditing(r); setForm({ client_id: r.client_id || '', currency: r.currency, payment_method: r.payment_method || 'bank_transfer', note: r.note || '', interval: r.interval, next_date: r.next_date, end_date: r.end_date || '', items: r.items?.length ? r.items : emptyForm.items }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editing) { await api.updateRecurring(editing.id, { ...form, active: editing.active }); }
    else { await api.createRecurring(form); }
    setShowModal(false); load();
  };

  const toggleActive = async (r) => {
    await api.updateRecurring(r.id, { ...r, items: r.items, active: r.active ? 0 : 1 });
    load();
  };

  const handleDelete = async (id) => {
    const ok = await confirm({ title: 'Smazat opakovanou fakturu', message: 'Opravdu chcete smazat tuto opakovanou fakturu?', type: 'danger', confirmText: 'Smazat' }); if (!ok) return;
    await api.deleteRecurring(id); toast.success('Opakovaná faktura smazána'); load();
  };

  const updateItem = (idx, field, value) => setForm(f => {
    const items = [...f.items]; items[idx] = { ...items[idx], [field]: value }; return { ...f, items };
  });
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { description: '', quantity: 1, unit: 'ks', unit_price: 0, tax_rate: 0 }] }));
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const total = form.items.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0);

  return (
    <div>
      {can('admin', 'accountant') && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button className="btn btn-primary" onClick={openNew}>+ Nová opakovaná</button>
        </div>
      )}

      <div className="card">
        {loading ? <div className="loading">Načítání...</div> : items.length === 0 ? <div className="empty-state">Žádné opakované faktury</div> : (
          <div className="table-responsive">
            <table>
              <thead><tr><th>Klient</th><th>Interval</th><th className="hide-mobile">Další datum</th><th className="hide-mobile">Konec</th><th className="hide-mobile">Měna</th><th>Stav</th><th>Akce</th></tr></thead>
              <tbody>
                {items.map(r => (
                  <tr key={r.id} style={{ opacity: r.active ? 1 : 0.5 }}>
                    <td style={{ fontWeight: 600 }}>{r.client_name || '—'}</td>
                    <td>{intervalLabels[r.interval]}</td>
                    <td className="hide-mobile">{fmtDate(r.next_date)}</td>
                    <td className="hide-mobile">{fmtDate(r.end_date)}</td>
                    <td className="hide-mobile">{r.currency}</td>
                    <td><span className={`badge ${r.active ? 'badge-paid' : 'badge-cancelled'}`}>{r.active ? 'Aktivní' : 'Pozastaveno'}</span></td>
                    <td>
                      <div className="btn-group">
                        <button className="btn btn-outline btn-sm" onClick={() => toggleActive(r)}>{r.active ? 'Pozastavit' : 'Aktivovat'}</button>
                        {can('admin', 'accountant') && <button className="btn btn-outline btn-sm" onClick={() => openEdit(r)}>Upravit</button>}
                        {can('admin') && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>Smazat</button>}
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
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 'min(700px, 95vw)' }}>
            <div className="modal-header">
              <h3 className="modal-title">{editing ? 'Upravit opakovanou fakturu' : 'Nová opakovaná faktura'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Klient</label>
                  <select className="form-select" value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}>
                    <option value="">— Vyberte —</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Interval</label>
                  <select className="form-select" value={form.interval} onChange={e => setForm(f => ({ ...f, interval: e.target.value }))}>
                    <option value="weekly">Týdně</option>
                    <option value="monthly">Měsíčně</option>
                    <option value="quarterly">Čtvrtletně</option>
                    <option value="yearly">Ročně</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Další datum *</label>
                  <input className="form-input" type="date" value={form.next_date} onChange={e => setForm(f => ({ ...f, next_date: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Konec (volitelné)</label>
                  <input className="form-input" type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Měna</label>
                  <select className="form-select" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                    {currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Poznámka</label>
                <input className="form-input" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>
              <div style={{ fontWeight: 600, margin: '0.5rem 0' }}>Položky</div>
              {form.items.map((item, idx) => (
                <div key={idx} className="form-row" style={{ alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ flex: 3 }}><input className="form-input" placeholder="Popis" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} /></div>
                  <div className="form-group" style={{ flex: 1 }}><input className="form-input" type="number" step="0.01" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} /></div>
                  <div className="form-group" style={{ flex: 1 }}><input className="form-input" type="number" step="0.01" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} /></div>
                  {form.items.length > 1 && <button type="button" className="btn btn-danger btn-sm" onClick={() => removeItem(idx)}>×</button>}
                </div>
              ))}
              <button type="button" className="btn btn-outline btn-sm" onClick={addItem} style={{ marginBottom: '0.5rem' }}>+ Položka</button>
              <div style={{ fontWeight: 700, textAlign: 'right', margin: '0.5rem 0' }}>Celkem: {new Intl.NumberFormat('cs-CZ').format(total)} {form.currency}</div>
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
