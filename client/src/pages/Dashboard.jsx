import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { api } from '../api';
import { useAuth } from '../App';

const fmt = (n) => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(n);
const fmtDate = (d) => { if (!d) return '—'; const p = d.slice(0,10).split('-'); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : d; };
const COLORS = ['#4361ee', '#2ec4b6', '#ff9f1c', '#e63946', '#9333ea', '#64748b'];
const MONTHS = ['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec'];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const { can } = useAuth();

  useEffect(() => { api.dashboard().then(setData).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="loading">Načítání dashboardu...</div>;
  if (!data) return <div className="empty-state">Nelze načíst data</div>;

  const { kpis, revenueByMonth, expensesByCategory, invoicesByStatus, recentInvoices, topClients, currencyBreakdown, monthlyIssued, monthlyExpenses, pendingItems } = data;

  const statusLabels = { draft: 'Koncept', sent: 'Odesláno', paid: 'Zaplaceno', overdue: 'Po splatnosti', cancelled: 'Zrušeno' };
  const statusColors = { draft: '#94a3b8', sent: '#3b82f6', paid: '#10b981', overdue: '#ef4444', cancelled: '#f59e0b' };
  const pieData = invoicesByStatus.map(s => ({ name: statusLabels[s.status] || s.status, value: s.count, color: statusColors[s.status] || '#999' }));

  // Build monthly chart data (12 months)
  const monthlyData = MONTHS.map((name, i) => {
    const monthKey = String(i + 1).padStart(2, '0');
    const issued = monthlyIssued?.find(m => m.month === monthKey);
    const expense = monthlyExpenses?.find(m => m.month === monthKey);
    return { name, issued: issued?.total || 0, issuedTax: issued?.tax || 0, expenses: expense?.total || 0 };
  });

  const pendingCount = (pendingItems || []).length + (kpis.pendingUsers || 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--gray-200)', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setTab('overview')}
          style={{
            padding: '0.75rem 2rem', fontWeight: 600, fontSize: '1rem', border: 'none', cursor: 'pointer',
            background: 'none', color: tab === 'overview' ? 'var(--primary)' : 'var(--gray-500)',
            borderBottom: tab === 'overview' ? '3px solid var(--primary)' : '3px solid transparent',
            marginBottom: -2
          }}
        >Přehled</button>
        <button
          onClick={() => setTab('pending')}
          style={{
            padding: '0.75rem 2rem', fontWeight: 600, fontSize: '1rem', border: 'none', cursor: 'pointer',
            background: 'none', color: tab === 'pending' ? 'var(--primary)' : 'var(--gray-500)',
            borderBottom: tab === 'pending' ? '3px solid var(--primary)' : '3px solid transparent',
            marginBottom: -2, display: 'flex', alignItems: 'center', gap: '0.5rem'
          }}
        >
          K vyřízení
          {pendingCount > 0 && (
            <span style={{ background: 'var(--danger)', color: '#fff', borderRadius: '50%', width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>{pendingCount}</span>
          )}
        </button>
        <button
          onClick={() => setTab('reports')}
          style={{
            padding: '0.75rem 2rem', fontWeight: 600, fontSize: '1rem', border: 'none', cursor: 'pointer',
            background: 'none', color: tab === 'reports' ? 'var(--primary)' : 'var(--gray-500)',
            borderBottom: tab === 'reports' ? '3px solid var(--primary)' : '3px solid transparent',
            marginBottom: -2
          }}
        >Reporty</button>
      </div>

      {tab === 'overview' && (
        <>
          <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
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
              <div className="kpi-label">Klienti</div>
              <div className="kpi-value primary">{kpis.totalClients}</div>
            </div>
          </div>

          {/* Monthly chart */}
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <div className="card-title" style={{ marginBottom: '1rem' }}>Přehled prodejních a nákupních dokladů</div>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 2, background: '#4361ee', display: 'inline-block' }}></span> Prodejní faktury</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 2, background: '#e63946', display: 'inline-block' }}></span> Nákupní/výdaje</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 2, background: '#2ec4b6', display: 'inline-block' }}></span> Rozdíl</span>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={monthlyData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" fontSize={11} tick={{ fill: '#64748b' }} />
                <YAxis fontSize={11} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} tick={{ fill: '#64748b' }} />
                <Tooltip formatter={v => fmt(v)} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="issued" name="Prodejní faktury" fill="#4361ee" radius={[4,4,0,0]} />
                <Bar dataKey="expenses" name="Výdaje" fill="#e63946" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Recent invoices + Top clients */}
          <div className="charts-grid" style={{ marginTop: '1.5rem' }}>
            <div className="card">
              <div className="card-header">
                <div className="card-title">Poslední faktury</div>
                <Link to="/invoices" className="btn btn-outline btn-sm">Zobrazit vše</Link>
              </div>
              <div className="table-responsive">
                <table>
                  <thead><tr><th>Číslo</th><th>Klient</th><th>Částka</th><th>Stav</th></tr></thead>
                  <tbody>
                    {recentInvoices.map(inv => (
                      <tr key={inv.id}>
                        <td><Link to={`/invoices/${inv.id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>{inv.invoice_number}</Link></td>
                        <td>{inv.client_name || '—'}</td>
                        <td className="text-right">{new Intl.NumberFormat('cs-CZ').format(inv.total)} {inv.currency}</td>
                        <td><span className={`badge badge-${inv.status}`}>{statusLabels[inv.status]}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Faktury dle stavu</div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={75} innerRadius={40} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', marginTop: '0.5rem' }}>
                {pieData.map(p => (
                  <span key={p.name} style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }}></span>{p.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'pending' && (
        <div>
          {(pendingItems || []).length === 0 && !kpis.pendingUsers ? (
            <div className="card"><div className="empty-state">Vše vyřízeno!</div></div>
          ) : (
            <>
              {kpis.pendingUsers > 0 && can('admin') && (
                <div className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid var(--warning)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <strong>{kpis.pendingUsers} uživatel(ů) čeká na schválení</strong>
                      <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>Noví registrovaní uživatelé potřebují vaše schválení.</div>
                    </div>
                    <Link to="/users" className="btn btn-primary btn-sm">Spravovat</Link>
                  </div>
                </div>
              )}

              {(pendingItems || []).filter(i => i.type === 'overdue').length > 0 && (
                <div className="card" style={{ marginBottom: '1rem' }}>
                  <div className="card-title" style={{ color: 'var(--danger)', marginBottom: '0.75rem' }}>Po splatnosti ({(pendingItems || []).filter(i => i.type === 'overdue').length})</div>
                  <div className="table-responsive"><table>
                    <thead><tr><th>Faktura</th><th>Klient</th><th>Splatnost</th><th className="text-right">Částka</th><th></th></tr></thead>
                    <tbody>
                      {(pendingItems || []).filter(i => i.type === 'overdue').map(i => (
                        <tr key={i.id}>
                          <td><strong>{i.invoice_number}</strong></td>
                          <td>{i.client_name || '—'}</td>
                          <td style={{ color: 'var(--danger)' }}>{fmtDate(i.due_date)}</td>
                          <td className="text-right">{new Intl.NumberFormat('cs-CZ').format(i.total)} {i.currency}</td>
                          <td><Link to={`/invoices/${i.id}`} className="btn btn-outline btn-sm">Detail</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                </div>
              )}

              {(pendingItems || []).filter(i => i.type === 'unpaid').length > 0 && (
                <div className="card" style={{ marginBottom: '1rem' }}>
                  <div className="card-title" style={{ color: 'var(--warning)', marginBottom: '0.75rem' }}>Nezaplacené ({(pendingItems || []).filter(i => i.type === 'unpaid').length})</div>
                  <div className="table-responsive"><table>
                    <thead><tr><th>Faktura</th><th>Klient</th><th>Splatnost</th><th className="text-right">Částka</th><th></th></tr></thead>
                    <tbody>
                      {(pendingItems || []).filter(i => i.type === 'unpaid').map(i => (
                        <tr key={i.id}>
                          <td><strong>{i.invoice_number}</strong></td>
                          <td>{i.client_name || '—'}</td>
                          <td>{fmtDate(i.due_date)}</td>
                          <td className="text-right">{new Intl.NumberFormat('cs-CZ').format(i.total)} {i.currency}</td>
                          <td><Link to={`/invoices/${i.id}`} className="btn btn-outline btn-sm">Detail</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                </div>
              )}

              {(pendingItems || []).filter(i => i.type === 'draft').length > 0 && (
                <div className="card">
                  <div className="card-title" style={{ marginBottom: '0.75rem' }}>Koncepty ({(pendingItems || []).filter(i => i.type === 'draft').length})</div>
                  <div className="table-responsive"><table>
                    <thead><tr><th>Faktura</th><th>Klient</th><th className="text-right">Částka</th><th></th></tr></thead>
                    <tbody>
                      {(pendingItems || []).filter(i => i.type === 'draft').map(i => (
                        <tr key={i.id}>
                          <td><strong>{i.invoice_number}</strong></td>
                          <td>{i.client_name || '—'}</td>
                          <td className="text-right">{new Intl.NumberFormat('cs-CZ').format(i.total)} {i.currency}</td>
                          <td><Link to={`/invoices/${i.id}`} className="btn btn-outline btn-sm">Detail</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'reports' && (
        <div>
          <div className="charts-grid">
            <div className="card">
              <div className="card-title">Příjmy dle měsíce (CZK)</div>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip formatter={v => fmt(v)} />
                  <Line type="monotone" dataKey="issued" name="Příjmy" stroke="#4361ee" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="expenses" name="Výdaje" stroke="#e63946" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
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

            <div className="card">
              <div className="card-title">Měny</div>
              {currencyBreakdown.length === 0 ? <div className="empty-state">Žádná data</div> : (
                <table>
                  <thead><tr><th>Měna</th><th className="text-right">Počet faktur</th><th className="text-right">Celkem</th></tr></thead>
                  <tbody>
                    {currencyBreakdown.map((c, i) => (
                      <tr key={i}><td>{c.currency}</td><td className="text-right">{c.count}</td><td className="text-right">{new Intl.NumberFormat('cs-CZ').format(c.total)}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
