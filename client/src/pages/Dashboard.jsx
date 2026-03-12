import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { api } from '../api';

const fmt = (n) => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(n);
const fmtDate = (d) => { if (!d) return '—'; const p = d.slice(0,10).split('-'); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : d; };
const COLORS = ['#4361ee', '#2ec4b6', '#ff9f1c', '#e63946', '#9333ea', '#64748b'];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.dashboard().then(setData).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="loading">Načítání dashboardu...</div>;
  if (!data) return <div className="empty-state">Nelze načíst data</div>;

  const { kpis, revenueByMonth, expensesByCategory, invoicesByStatus, recentInvoices, topClients, currencyBreakdown } = data;

  const statusLabels = { draft: 'Koncept', sent: 'Odesláno', paid: 'Zaplaceno', overdue: 'Po splatnosti', cancelled: 'Zrušeno' };
  const statusColors = { draft: '#94a3b8', sent: '#3b82f6', paid: '#10b981', overdue: '#ef4444', cancelled: '#f59e0b' };

  const pieData = invoicesByStatus.map(s => ({ name: statusLabels[s.status] || s.status, value: s.count, color: statusColors[s.status] || '#999' }));

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Celkové příjmy</div>
          <div className="kpi-value success">{fmt(kpis.totalRevenue)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Celkové výdaje</div>
          <div className="kpi-value danger">{fmt(kpis.totalExpenses)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Zisk</div>
          <div className="kpi-value primary">{fmt(kpis.profit)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Nezaplacené faktury</div>
          <div className="kpi-value warning">{kpis.unpaidInvoices}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Po splatnosti</div>
          <div className="kpi-value danger">{kpis.overdueInvoices}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Koncepty</div>
          <div className="kpi-value">{kpis.draftInvoices}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Klienti</div>
          <div className="kpi-value primary">{kpis.totalClients}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Měny</div>
          <div className="kpi-value">{currencyBreakdown.length}</div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="card">
          <div className="card-title">Příjmy dle měsíce (CZK)</div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={revenueByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v => fmt(v)} />
              <Bar dataKey="total" fill="#4361ee" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title">Faktury dle stavu</div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title">Výdaje dle kategorie</div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={expensesByCategory} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" fontSize={12} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="category" fontSize={12} width={100} />
              <Tooltip formatter={v => fmt(v)} />
              <Bar dataKey="total" fill="#e63946" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title">Top klienti</div>
          {topClients.length === 0 ? <div className="empty-state">Žádná data</div> : (
            <table>
              <thead><tr><th>Klient</th><th className="text-right">Příjem (CZK)</th></tr></thead>
              <tbody>
                {topClients.map((c, i) => (
                  <tr key={i}><td>{c.name}</td><td className="text-right">{fmt(c.total)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Poslední faktury</div>
          <Link to="/invoices" className="btn btn-outline btn-sm">Zobrazit vše</Link>
        </div>
        <div className="table-responsive">
          <table>
            <thead><tr><th>Číslo</th><th>Klient</th><th>Datum</th><th>Částka</th><th>Měna</th><th>Stav</th></tr></thead>
            <tbody>
              {recentInvoices.map(inv => (
                <tr key={inv.id}>
                  <td><Link to={`/invoices/${inv.id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>{inv.invoice_number}</Link></td>
                  <td>{inv.client_name}</td>
                  <td>{fmtDate(inv.issue_date)}</td>
                  <td className="text-right">{new Intl.NumberFormat('cs-CZ').format(inv.total)}</td>
                  <td>{inv.currency}</td>
                  <td><span className={`badge badge-${inv.status}`}>{statusLabels[inv.status] || inv.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
