import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../App';

const statusLabels = { draft: 'Koncept', sent: 'Odesláno', paid: 'Zaplaceno', overdue: 'Po splatnosti', cancelled: 'Zrušeno' };
const typeLabels = { issued: 'Vydaná', received: 'Přijatá' };
const fmt = (n, cur = 'CZK') => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(n);

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ type: '', status: '', currency: '' });
  const { can } = useAuth();

  const load = () => {
    setLoading(true);
    const params = {};
    if (filters.type) params.type = filters.type;
    if (filters.status) params.status = filters.status;
    if (filters.currency) params.currency = filters.currency;
    api.getInvoices(params).then(setInvoices).finally(() => setLoading(false));
  };

  useEffect(load, [filters]);

  const handleDelete = async (id) => {
    if (!confirm('Opravdu smazat tuto fakturu?')) return;
    await api.deleteInvoice(id);
    load();
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Faktury</h1>
        {can('admin', 'accountant') && (
          <Link to="/invoices/new" className="btn btn-primary">+ Nová faktura</Link>
        )}
      </div>

      <div className="filters">
        <select className="form-select" value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
          <option value="">Všechny typy</option>
          <option value="issued">Vydané</option>
          <option value="received">Přijaté</option>
        </select>
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
      </div>

      <div className="card">
        {loading ? <div className="loading">Načítání...</div> : invoices.length === 0 ? <div className="empty-state">Žádné faktury</div> : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Číslo</th><th>Typ</th><th>Klient</th><th>Datum vystavení</th>
                  <th>Splatnost</th><th className="text-right">Částka</th><th>Měna</th>
                  <th className="text-right">CZK</th><th>Stav</th><th>Akce</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td><Link to={`/invoices/${inv.id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>{inv.invoice_number}</Link></td>
                    <td>{typeLabels[inv.type]}</td>
                    <td>{inv.client_name}</td>
                    <td>{inv.issue_date}</td>
                    <td>{inv.due_date}</td>
                    <td className="text-right">{fmt(inv.total, inv.currency)}</td>
                    <td>{inv.currency}</td>
                    <td className="text-right">{fmt(inv.total_czk, 'CZK')}</td>
                    <td><span className={`badge badge-${inv.status}`}>{statusLabels[inv.status]}</span></td>
                    <td>
                      <div className="btn-group">
                        <Link to={`/invoices/${inv.id}`} className="btn btn-outline btn-sm">Detail</Link>
                        {can('admin', 'accountant') && (
                          <Link to={`/invoices/${inv.id}/edit`} className="btn btn-outline btn-sm">Upravit</Link>
                        )}
                        {can('admin') && (
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(inv.id)}>Smazat</button>
                        )}
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
