import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../App';

const statusLabels = { draft: 'Koncept', sent: 'Odesláno', paid: 'Zaplaceno', overdue: 'Po splatnosti', cancelled: 'Zrušeno' };
const fmt = (n, cur = 'CZK') => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(n);
const fmtDate = (d) => { if (!d) return '—'; const p = d.slice(0,10).split('-'); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : d; };

const typeLabels = { regular: 'Faktura', proforma: 'Proforma', credit_note: 'Dobropis' };

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', currency: '' });
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [selected, setSelected] = useState(new Set());
  const { can } = useAuth();

  const load = () => {
    setLoading(true);
    const params = {};
    if (filters.status) params.status = filters.status;
    if (filters.currency) params.currency = filters.currency;
    api.getInvoices(params).then(setInvoices).finally(() => setLoading(false));
  };

  useEffect(load, [filters]);

  const sorted = useMemo(() => {
    const arr = [...invoices];
    arr.sort((a, b) => {
      let va, vb;
      if (sortBy === 'invoice_number') { va = a.invoice_number || ''; vb = b.invoice_number || ''; }
      else if (sortBy === 'client_name') { va = (a.client_name || '').toLowerCase(); vb = (b.client_name || '').toLowerCase(); }
      else if (sortBy === 'issue_date') { va = a.issue_date || ''; vb = b.issue_date || ''; }
      else if (sortBy === 'due_date') { va = a.due_date || ''; vb = b.due_date || ''; }
      else if (sortBy === 'total') { va = a.total || 0; vb = b.total || 0; }
      else if (sortBy === 'total_czk') { va = a.total_czk || 0; vb = b.total_czk || 0; }
      else if (sortBy === 'status') { va = a.status || ''; vb = b.status || ''; }
      else { va = a.created_at || ''; vb = b.created_at || ''; }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [invoices, sortBy, sortDir]);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <span style={{ opacity: 0.3 }}> ↕</span>;
    return <span> {sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const handleDelete = async (id) => {
    if (!confirm('Opravdu smazat tuto fakturu?')) return;
    await api.deleteInvoice(id);
    load();
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Faktury</h1>
        <div className="btn-group">
          <a href="/api/export/invoices" className="btn btn-outline btn-sm" download>CSV Export</a>
          {can('admin', 'accountant') && (
            <Link to="/invoices/new" className="btn btn-primary">+ Nová faktura</Link>
          )}
        </div>
      </div>

      {selected.size > 0 && can('admin', 'accountant', 'manager') && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center', background: '#eff6ff', padding: '0.5rem 1rem', borderRadius: 'var(--radius)' }}>
          <strong style={{ fontSize: '0.85rem' }}>{selected.size} vybráno</strong>
          <button className="btn btn-sm btn-outline" onClick={async () => { await api.bulkStatus([...selected], 'sent'); setSelected(new Set()); load(); }}>Odeslat</button>
          <button className="btn btn-sm btn-success" onClick={async () => { await api.bulkStatus([...selected], 'paid'); setSelected(new Set()); load(); }}>Zaplaceno</button>
          <button className="btn btn-sm btn-warning" onClick={async () => { await api.bulkStatus([...selected], 'cancelled'); setSelected(new Set()); load(); }}>Zrušit</button>
          <button className="btn btn-sm btn-outline" onClick={() => setSelected(new Set())}>Zrušit výběr</button>
        </div>
      )}

      <div className="filters" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="form-select" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
          <option value="">Všechny stavy</option>
          <option value="draft">Koncept</option>
          <option value="sent">Odesláno</option>
          <option value="paid">Zaplaceno</option>
          <option value="overdue">Po splatnosti</option>
          <option value="cancelled">Zrušeno</option>
        </select>
        <select className="form-select" value={filters.currency} onChange={e => setFilters(f => ({ ...f, currency: e.target.value }))}>
          <option value="">Všechny měny</option>
          <option value="CZK">CZK</option>
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
          <option value="GBP">GBP</option>
        </select>
        <select className="form-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="created_at">Řadit dle vytvoření</option>
          <option value="issue_date">Řadit dle vystavení</option>
          <option value="due_date">Řadit dle splatnosti</option>
          <option value="total">Řadit dle částky</option>
          <option value="total_czk">Řadit dle CZK</option>
          <option value="client_name">Řadit dle klienta</option>
          <option value="status">Řadit dle stavu</option>
        </select>
        <button className="btn btn-outline btn-sm" onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
          {sortDir === 'desc' ? '↓ Sestupně' : '↑ Vzestupně'}
        </button>
      </div>

      <div className="card">
        {loading ? <div className="loading">Načítání...</div> : sorted.length === 0 ? <div className="empty-state">Žádné faktury</div> : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 32 }}><input type="checkbox" onChange={e => { if (e.target.checked) setSelected(new Set(sorted.map(i => i.id))); else setSelected(new Set()); }} checked={selected.size === sorted.length && sorted.length > 0} /></th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('invoice_number')}>Číslo<SortIcon col="invoice_number" /></th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('client_name')}>Klient<SortIcon col="client_name" /></th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('issue_date')}>Datum vystavení<SortIcon col="issue_date" /></th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('due_date')}>Splatnost<SortIcon col="due_date" /></th>
                  <th className="text-right" style={{ cursor: 'pointer' }} onClick={() => toggleSort('total')}>Částka<SortIcon col="total" /></th>
                  <th>Měna</th>
                  <th className="text-right" style={{ cursor: 'pointer' }} onClick={() => toggleSort('total_czk')}>CZK<SortIcon col="total_czk" /></th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('status')}>Stav<SortIcon col="status" /></th>
                  <th>Akce</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(inv => (
                  <tr key={inv.id} style={{ background: selected.has(inv.id) ? '#eff6ff' : '' }}>
                    <td><input type="checkbox" checked={selected.has(inv.id)} onChange={e => { const s = new Set(selected); if (e.target.checked) s.add(inv.id); else s.delete(inv.id); setSelected(s); }} /></td>
                    <td><Link to={`/invoices/${inv.id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>{inv.invoice_number}</Link>{inv.invoice_type && inv.invoice_type !== 'regular' && <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 4 }}>({typeLabels[inv.invoice_type]})</span>}</td>
                    <td>{inv.client_name}</td>
                    <td>{fmtDate(inv.issue_date)}</td>
                    <td>{fmtDate(inv.due_date)}</td>
                    <td className="text-right">{fmt(inv.total, inv.currency)}</td>
                    <td>{inv.currency}</td>
                    <td className="text-right">{fmt(inv.total_czk, 'CZK')}</td>
                    <td><span className={`badge badge-${inv.status}`}>{statusLabels[inv.status]}</span></td>
                    <td>
                      <div className="btn-group">
                        <Link to={`/invoices/${inv.id}`} className="btn btn-outline btn-sm">Detail</Link>
                        {can('admin', 'accountant') && <Link to={`/invoices/${inv.id}/edit`} className="btn btn-outline btn-sm">Upravit</Link>}
                        {can('admin', 'manager') && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(inv.id)}>Smazat</button>}
                      </div>
                    </td>
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
