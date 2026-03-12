import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../App';

const typeLabels = { income: 'Příjem', expense: 'Výdaj', asset: 'Majetek', document: 'Dokument' };
const fmt = (n, cur = 'CZK') => n != null ? new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(n) : '—';

export default function Evidence() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ type: '', category: '' });
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ type: 'income', title: '', description: '', amount: '', currency: 'CZK', date: new Date().toISOString().slice(0, 10), category: '' });
  const { can } = useAuth();

  const load = () => {
    setLoading(true);
    const params = {};
    if (filter.type) params.type = filter.type;
    if (filter.category) params.category = filter.category;
    api.getEvidence(params).then(setRecords).finally(() => setLoading(false));
  };

  useEffect(load, [filter]);

  const categories = [...new Set(records.map(r => r.category).filter(Boolean))];

  const openNew = () => {
    setEditing(null);
    setForm({ type: 'income', title: '', description: '', amount: '', currency: 'CZK', date: new Date().toISOString().slice(0, 10), category: '' });
    setShowModal(true);
  };

  const openEdit = (rec) => {
    setEditing(rec);
    setForm({ type: rec.type, title: rec.title, description: rec.description || '', amount: rec.amount || '', currency: rec.currency, date: rec.date, category: rec.category || '' });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = { ...form, amount: form.amount ? parseFloat(form.amount) : null };
    if (editing) {
      await api.updateEvidence(editing.id, data);
    } else {
      await api.createEvidence(data);
    }
    setShowModal(false);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Opravdu smazat tento záznam?')) return;
    await api.deleteEvidence(id);
    load();
  };

  const totalIncome = records.filter(r => r.type === 'income').reduce((s, r) => s + (r.amount || 0), 0);
  const totalExpense = records.filter(r => r.type === 'expense').reduce((s, r) => s + (r.amount || 0), 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Evidence</h1>
        {can('admin', 'accountant', 'manager') && (
          <button className="btn btn-primary" onClick={openNew}>+ Nový záznam</button>
        )}
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="kpi-card"><div className="kpi-label">Příjmy</div><div className="kpi-value success">{fmt(totalIncome)}</div></div>
        <div className="kpi-card"><div className="kpi-label">Výdaje</div><div className="kpi-value danger">{fmt(totalExpense)}</div></div>
        <div className="kpi-card"><div className="kpi-label">Bilance</div><div className="kpi-value primary">{fmt(totalIncome - totalExpense)}</div></div>
      </div>

      <div className="filters">
        <select className="form-select" value={filter.type} onChange={e => setFilter(f => ({ ...f, type: e.target.value }))}>
          <option value="">Všechny typy</option>
          {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="form-select" value={filter.category} onChange={e => setFilter(f => ({ ...f, category: e.target.value }))}>
          <option value="">Všechny kategorie</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="card">
        {loading ? <div className="loading">Načítání...</div> : records.length === 0 ? <div className="empty-state">Žádné záznamy</div> : (
          <div className="table-responsive">
            <table>
              <thead><tr><th>Typ</th><th>Název</th><th>Kategorie</th><th>Datum</th><th className="text-right">Částka</th><th>Měna</th><th>Vytvořil</th><th>Akce</th></tr></thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td><span className={`badge badge-${r.type}`}>{typeLabels[r.type]}</span></td>
                    <td><strong>{r.title}</strong>{r.description && <div className="text-muted" style={{ fontSize: '0.8rem' }}>{r.description}</div>}</td>
                    <td>{r.category || '—'}</td>
                    <td>{r.date}</td>
                    <td className="text-right" style={{ fontWeight: 600, color: r.type === 'income' ? 'var(--success)' : r.type === 'expense' ? 'var(--danger)' : 'inherit' }}>{fmt(r.amount, r.currency)}</td>
                    <td>{r.currency}</td>
                    <td>{r.created_by_name}</td>
                    <td>
                      <div className="btn-group">
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
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editing ? 'Upravit záznam' : 'Nový záznam'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Typ *</label>
                  <select className="form-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Kategorie</label>
                  <input className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="např. Služby" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Název *</label>
                <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Popis</label>
                <textarea className="form-textarea" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Částka</label>
                  <input className="form-input" type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Měna</label>
                  <select className="form-select" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                    <option value="CZK">CZK</option><option value="EUR">EUR</option><option value="USD">USD</option><option value="GBP">GBP</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Datum *</label>
                  <input className="form-input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
                </div>
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
