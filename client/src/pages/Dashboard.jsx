import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { api } from '../api';
import { useAuth } from '../App';

const fmt = (n) => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(n);
const fmtDate = (d) => { if (!d) return '—'; const p = d.slice(0,10).split('-'); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : d; };
const COLORS = ['#6366f1', '#06b6d4', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b', '#14b8a6', '#f97316', '#84cc16', '#ec4899'];
const MONTHS = ['Led','Úno','Bře','Dub','Kvě','Čvn','Čvc','Srp','Zář','Říj','Lis','Pro'];

function getDateRange(period) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (period) {
    case 'year': return { from: `${y}-01-01`, to: `${y}-12-31` };
    case 'last_year': return { from: `${y-1}-01-01`, to: `${y-1}-12-31` };
    case 'q1': return { from: `${y}-01-01`, to: `${y}-03-31` };
    case 'q2': return { from: `${y}-04-01`, to: `${y}-06-30` };
    case 'q3': return { from: `${y}-07-01`, to: `${y}-09-30` };
    case 'q4': return { from: `${y}-10-01`, to: `${y}-12-31` };
    case 'h1': return { from: `${y}-01-01`, to: `${y}-06-30` };
    case 'h2': return { from: `${y}-07-01`, to: `${y}-12-31` };
    case 'month': {
      const ms = String(m + 1).padStart(2, '0');
      const lastDay = new Date(y, m + 1, 0).getDate();
      return { from: `${y}-${ms}-01`, to: `${y}-${ms}-${lastDay}` };
    }
    case 'last_month': {
      const d = new Date(y, m - 1, 1);
      const ms = String(d.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      return { from: `${d.getFullYear()}-${ms}-01`, to: `${d.getFullYear()}-${ms}-${lastDay}` };
    }
    default: return {};
  }
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="dash-tooltip">
      <div className="dash-tooltip-label">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="dash-tooltip-row">
          <span className="dash-tooltip-dot" style={{ background: p.color }} />
          <span className="dash-tooltip-name">{p.name}</span>
          <span className="dash-tooltip-value">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="dash-tooltip">
      <div className="dash-tooltip-row">
        <span className="dash-tooltip-dot" style={{ background: d.payload.color || d.payload.fill }} />
        <span className="dash-tooltip-name">{d.name}</span>
        <span className="dash-tooltip-value">{typeof d.value === 'number' && d.value > 100 ? fmt(d.value) : d.value}</span>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [period, setPeriod] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const { can } = useAuth();

  const loadData = () => {
    setLoading(true);
    let params = {};
    if (period === 'custom') {
      if (customFrom) params.from = customFrom;
      if (customTo) params.to = customTo;
    } else if (period !== 'all') {
      const range = getDateRange(period);
      params = range;
    }
    api.dashboard(params).then(setData).finally(() => setLoading(false));
  };

  useEffect(loadData, [period, customFrom, customTo]);

  if (loading) return (
    <div className="dash-loading">
      <div className="dash-loading-spinner" />
      <span>Načítání dashboardu...</span>
    </div>
  );
  if (!data) return <div className="dash-empty-hero"><span className="dash-empty-icon">📊</span><span>Nelze načíst data</span></div>;

  const { kpis, revenueByMonth, expensesByCategory, invoicesByStatus, recentInvoices, topClients, topSuppliers, currencyBreakdown, monthlyIssued, monthlyExpenses, pendingItems, chartYear } = data;

  const statusLabels = { draft: 'Koncept', sent: 'Odesláno', paid: 'Zaplaceno', overdue: 'Po splatnosti', cancelled: 'Zrušeno' };
  const statusColors = { draft: '#94a3b8', sent: '#6366f1', paid: '#10b981', overdue: '#ef4444', cancelled: '#f59e0b' };
  const pieData = invoicesByStatus.map(s => ({ name: statusLabels[s.status] || s.status, value: s.count, color: statusColors[s.status] || '#999' }));

  const supplierPieData = (topSuppliers || []).map((s, i) => ({ name: s.name, value: s.total, color: COLORS[i % COLORS.length] }));

  const monthlyData = MONTHS.map((name, i) => {
    const monthKey = String(i + 1).padStart(2, '0');
    const issued = monthlyIssued?.find(m => m.month === monthKey);
    const expense = monthlyExpenses?.find(m => m.month === monthKey);
    return { name, issued: issued?.total || 0, issuedTax: issued?.tax || 0, expenses: expense?.total || 0 };
  });

  const pendingCount = (pendingItems || []).length + (kpis.pendingUsers || 0);

  const profitMargin = kpis.totalRevenue > 0 ? ((kpis.profit / kpis.totalRevenue) * 100).toFixed(1) : 0;

  const tabs = [
    { key: 'overview', label: 'Přehled', icon: '📊' },
    { key: 'pending', label: 'K vyřízení', icon: '⏳', badge: pendingCount },
    { key: 'reports', label: 'Reporty', icon: '📈' },
  ];

  // Period category logic
  const periodCategory = (() => {
    if (period === 'all') return 'all';
    if (['month', 'last_month'].includes(period)) return 'month';
    if (['q1', 'q2', 'q3', 'q4'].includes(period)) return 'quarter';
    if (['h1', 'h2'].includes(period)) return 'half';
    if (['year', 'last_year'].includes(period)) return 'year';
    if (period === 'custom') return 'custom';
    return 'all';
  })();

  const handleCategoryChange = (cat) => {
    if (cat === 'all') setPeriod('all');
    else if (cat === 'month') setPeriod('month');
    else if (cat === 'quarter') setPeriod('q1');
    else if (cat === 'half') setPeriod('h1');
    else if (cat === 'year') setPeriod('year');
    else if (cat === 'custom') setPeriod('custom');
  };

  const categories = [
    { key: 'all', label: 'Vše' },
    { key: 'month', label: 'Měsíc' },
    { key: 'quarter', label: 'Kvartál' },
    { key: 'half', label: 'Pololetí' },
    { key: 'year', label: 'Rok' },
    { key: 'custom', label: 'Vlastní' },
  ];

  const currentYear = new Date().getFullYear();

  return (
    <div className="dash">
      {/* Header */}
      <div className="dash-header">
        <div className="dash-header-left">
          <h1 className="dash-title">Dashboard</h1>
          <span className="dash-subtitle">Finanční přehled vašeho podnikání</span>
        </div>
        <div className="dash-header-right">
          <div className="dash-live-dot" />
          <span className="dash-live-text">Aktuální data</span>
        </div>
      </div>

      {/* Period selector - compact segmented control */}
      <div className="dash-period-bar" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div className="dash-period-pills">
          {categories.map(c => (
            <button key={c.key} className={`dash-period-pill ${periodCategory === c.key ? 'active' : ''}`} onClick={() => handleCategoryChange(c.key)}>
              {c.label}
            </button>
          ))}
        </div>

        {/* Sub-selector for month */}
        {periodCategory === 'month' && (
          <div className="dash-period-pills" style={{ borderLeft: '1px solid var(--gray-200)', paddingLeft: '0.75rem' }}>
            <button className={`dash-period-pill ${period === 'month' ? 'active' : ''}`} onClick={() => setPeriod('month')}>Tento</button>
            <button className={`dash-period-pill ${period === 'last_month' ? 'active' : ''}`} onClick={() => setPeriod('last_month')}>Minulý</button>
          </div>
        )}

        {/* Sub-selector for quarter */}
        {periodCategory === 'quarter' && (
          <div className="dash-period-pills" style={{ borderLeft: '1px solid var(--gray-200)', paddingLeft: '0.75rem' }}>
            {['q1', 'q2', 'q3', 'q4'].map(q => (
              <button key={q} className={`dash-period-pill ${period === q ? 'active' : ''}`} onClick={() => setPeriod(q)}>{q.toUpperCase()}</button>
            ))}
          </div>
        )}

        {/* Sub-selector for half */}
        {periodCategory === 'half' && (
          <div className="dash-period-pills" style={{ borderLeft: '1px solid var(--gray-200)', paddingLeft: '0.75rem' }}>
            <button className={`dash-period-pill ${period === 'h1' ? 'active' : ''}`} onClick={() => setPeriod('h1')}>1. pololetí</button>
            <button className={`dash-period-pill ${period === 'h2' ? 'active' : ''}`} onClick={() => setPeriod('h2')}>2. pololetí</button>
          </div>
        )}

        {/* Sub-selector for year */}
        {periodCategory === 'year' && (
          <div className="dash-period-pills" style={{ borderLeft: '1px solid var(--gray-200)', paddingLeft: '0.75rem' }}>
            <button className={`dash-period-pill ${period === 'year' ? 'active' : ''}`} onClick={() => setPeriod('year')}>{currentYear}</button>
            <button className={`dash-period-pill ${period === 'last_year' ? 'active' : ''}`} onClick={() => setPeriod('last_year')}>{currentYear - 1}</button>
          </div>
        )}
      </div>

      {/* Custom date range */}
      {periodCategory === 'custom' && (
        <div className="dash-custom-range">
          <div className="dash-range-field">
            <label>Od</label>
            <input type="date" className="form-input" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
          </div>
          <span className="dash-range-sep">—</span>
          <div className="dash-range-field">
            <label>Do</label>
            <input type="date" className="form-input" value={customTo} onChange={e => setCustomTo(e.target.value)} />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="dash-tabs">
        {tabs.map(t => (
          <button key={t.key} className={`dash-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            <span className="dash-tab-icon">{t.icon}</span>
            <span>{t.label}</span>
            {t.badge > 0 && <span className="dash-tab-badge">{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* === OVERVIEW === */}
      {tab === 'overview' && (
        <div className="dash-content dash-fade-in">
          {/* KPI Cards */}
          <div className="dash-kpi-grid">
            <div className="dash-kpi dash-kpi-revenue">
              <div className="dash-kpi-icon-wrap dash-kpi-icon-green">
                <span>💰</span>
              </div>
              <div className="dash-kpi-body">
                <span className="dash-kpi-label">Celkové příjmy</span>
                <span className="dash-kpi-value">{fmt(kpis.totalRevenue)}</span>
              </div>
              <div className="dash-kpi-accent dash-accent-green" />
            </div>

            <div className="dash-kpi dash-kpi-expense">
              <div className="dash-kpi-icon-wrap dash-kpi-icon-red">
                <span>📉</span>
              </div>
              <div className="dash-kpi-body">
                <span className="dash-kpi-label">Celkové výdaje</span>
                <span className="dash-kpi-value">{fmt(kpis.totalExpenses)}</span>
              </div>
              <div className="dash-kpi-accent dash-accent-red" />
            </div>

            <div className="dash-kpi dash-kpi-profit">
              <div className="dash-kpi-icon-wrap dash-kpi-icon-blue">
                <span>📊</span>
              </div>
              <div className="dash-kpi-body">
                <span className="dash-kpi-label">Čistý zisk</span>
                <span className="dash-kpi-value">{fmt(kpis.profit)}</span>
                <span className={`dash-kpi-trend ${kpis.profit >= 0 ? 'up' : 'down'}`}>
                  {kpis.profit >= 0 ? '↑' : '↓'} {profitMargin}% marže
                </span>
              </div>
              <div className="dash-kpi-accent dash-accent-blue" />
            </div>

            <div className="dash-kpi dash-kpi-clients">
              <div className="dash-kpi-icon-wrap dash-kpi-icon-purple">
                <span>👥</span>
              </div>
              <div className="dash-kpi-body">
                <span className="dash-kpi-label">Klienti</span>
                <span className="dash-kpi-value">{kpis.totalClients}</span>
              </div>
              <div className="dash-kpi-accent dash-accent-purple" />
            </div>
          </div>

          {/* Main chart */}
          <div className="dash-card dash-card-chart">
            <div className="dash-card-head">
              <div>
                <h3 className="dash-card-title">Přehled příjmů a výdajů</h3>
                <span className="dash-card-desc">{chartYear ? `Rok ${chartYear}` : 'Celé období'}</span>
              </div>
              <div className="dash-legend">
                <span className="dash-legend-item"><span className="dash-legend-dot" style={{ background: '#6366f1' }} /> Příjmy</span>
                <span className="dash-legend-item"><span className="dash-legend-dot" style={{ background: '#f43f5e' }} /> Výdaje</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={340}>
              <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" vertical={false} />
                <XAxis dataKey="name" fontSize={12} tick={{ fill: 'var(--gray-500)' }} axisLine={false} tickLine={false} />
                <YAxis fontSize={12} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} tick={{ fill: 'var(--gray-500)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="issued" name="Příjmy" stroke="#6366f1" strokeWidth={2.5} fill="url(#gradIncome)" dot={false} activeDot={{ r: 6, strokeWidth: 2, fill: '#fff', stroke: '#6366f1' }} />
                <Area type="monotone" dataKey="expenses" name="Výdaje" stroke="#f43f5e" strokeWidth={2.5} fill="url(#gradExpense)" dot={false} activeDot={{ r: 6, strokeWidth: 2, fill: '#fff', stroke: '#f43f5e' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Second row: Recent invoices + Status pie */}
          <div className="dash-grid-2">
            <div className="dash-card">
              <div className="dash-card-head">
                <h3 className="dash-card-title">Poslední faktury</h3>
                <Link to="/invoices" className="dash-card-link">Zobrazit vše →</Link>
              </div>
              <div className="dash-invoice-list">
                {recentInvoices.map(inv => (
                  <Link to={`/invoices/${inv.id}`} key={inv.id} className="dash-invoice-row">
                    <div className="dash-invoice-info">
                      <span className="dash-invoice-num">{inv.invoice_number}</span>
                      <span className="dash-invoice-client">{inv.client_name || '—'}</span>
                    </div>
                    <div className="dash-invoice-right">
                      <span className="dash-invoice-amount">{new Intl.NumberFormat('cs-CZ').format(inv.total)} {inv.currency}</span>
                      <span className={`dash-status dash-status-${inv.status}`}>{statusLabels[inv.status]}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="dash-card">
              <h3 className="dash-card-title" style={{ marginBottom: '1rem' }}>Faktury dle stavu</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} innerRadius={50} dataKey="value" paddingAngle={3} strokeWidth={0}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="dash-pie-legend">
                {pieData.map(p => (
                  <div key={p.name} className="dash-pie-legend-item">
                    <span className="dash-pie-legend-dot" style={{ background: p.color }} />
                    <span className="dash-pie-legend-label">{p.name}</span>
                    <span className="dash-pie-legend-value">{p.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Third row: Top clients + suppliers */}
          <div className="dash-grid-2">
            {topClients.length > 0 && (
              <div className="dash-card">
                <h3 className="dash-card-title" style={{ marginBottom: '1rem' }}>Top klienti</h3>
                <div className="dash-rank-list">
                  {topClients.slice(0, 5).map((c, i) => {
                    const max = topClients[0]?.total || 1;
                    return (
                      <div key={c.name} className="dash-rank-item">
                        <span className="dash-rank-pos">#{i + 1}</span>
                        <div className="dash-rank-info">
                          <div className="dash-rank-header">
                            <span className="dash-rank-name">{c.name}</span>
                            <span className="dash-rank-value">{fmt(c.total)}</span>
                          </div>
                          <div className="dash-rank-bar-bg">
                            <div className="dash-rank-bar" style={{ width: `${(c.total / max) * 100}%`, background: COLORS[i % COLORS.length] }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {supplierPieData.length > 0 && (
              <div className="dash-card">
                <h3 className="dash-card-title" style={{ marginBottom: '1rem' }}>Největší dodavatelé</h3>
                <div className="dash-rank-list">
                  {(topSuppliers || []).slice(0, 5).map((s, i) => {
                    const max = topSuppliers[0]?.total || 1;
                    return (
                      <div key={s.name} className="dash-rank-item">
                        <span className="dash-rank-pos">#{i + 1}</span>
                        <div className="dash-rank-info">
                          <div className="dash-rank-header">
                            <span className="dash-rank-name">{s.name}</span>
                            <span className="dash-rank-value">{fmt(s.total)}</span>
                          </div>
                          <div className="dash-rank-bar-bg">
                            <div className="dash-rank-bar" style={{ width: `${(s.total / max) * 100}%`, background: COLORS[(i + 5) % COLORS.length] }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === PENDING === */}
      {tab === 'pending' && (
        <div className="dash-content dash-fade-in">
          {(pendingItems || []).length === 0 && !kpis.pendingUsers ? (
            <div className="dash-empty-hero">
              <span className="dash-empty-icon">✅</span>
              <span className="dash-empty-title">Vše vyřízeno!</span>
              <span className="dash-empty-desc">Nemáte žádné nevyřízené položky.</span>
            </div>
          ) : (
            <div className="dash-pending-sections">
              {kpis.pendingUsers > 0 && can('admin') && (
                <div className="dash-alert dash-alert-warning">
                  <div className="dash-alert-icon">👤</div>
                  <div className="dash-alert-body">
                    <strong>{kpis.pendingUsers} uživatel(ů) čeká na schválení</strong>
                    <span>Noví registrovaní uživatelé potřebují vaše schválení.</span>
                  </div>
                  <Link to="/users" className="btn btn-primary btn-sm">Spravovat</Link>
                </div>
              )}

              {(pendingItems || []).filter(i => i.type === 'overdue').length > 0 && (
                <div className="dash-card">
                  <div className="dash-card-head">
                    <div className="dash-pending-title">
                      <span className="dash-pending-dot dash-dot-red" />
                      <h3 className="dash-card-title">Po splatnosti</h3>
                      <span className="dash-pending-count">{(pendingItems || []).filter(i => i.type === 'overdue').length}</span>
                    </div>
                  </div>
                  <div className="dash-invoice-list">
                    {(pendingItems || []).filter(i => i.type === 'overdue').map(i => (
                      <Link to={`/invoices/${i.id}`} key={i.id} className="dash-invoice-row">
                        <div className="dash-invoice-info">
                          <span className="dash-invoice-num">{i.invoice_number}</span>
                          <span className="dash-invoice-client">{i.client_name || '—'}</span>
                        </div>
                        <div className="dash-invoice-right">
                          <span className="dash-invoice-amount">{new Intl.NumberFormat('cs-CZ').format(i.total)} {i.currency}</span>
                          <span className="dash-invoice-due overdue">{fmtDate(i.due_date)}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {(pendingItems || []).filter(i => i.type === 'unpaid').length > 0 && (
                <div className="dash-card">
                  <div className="dash-card-head">
                    <div className="dash-pending-title">
                      <span className="dash-pending-dot dash-dot-yellow" />
                      <h3 className="dash-card-title">Nezaplacené</h3>
                      <span className="dash-pending-count">{(pendingItems || []).filter(i => i.type === 'unpaid').length}</span>
                    </div>
                  </div>
                  <div className="dash-invoice-list">
                    {(pendingItems || []).filter(i => i.type === 'unpaid').map(i => (
                      <Link to={`/invoices/${i.id}`} key={i.id} className="dash-invoice-row">
                        <div className="dash-invoice-info">
                          <span className="dash-invoice-num">{i.invoice_number}</span>
                          <span className="dash-invoice-client">{i.client_name || '—'}</span>
                        </div>
                        <div className="dash-invoice-right">
                          <span className="dash-invoice-amount">{new Intl.NumberFormat('cs-CZ').format(i.total)} {i.currency}</span>
                          <span className="dash-invoice-due">{fmtDate(i.due_date)}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {(pendingItems || []).filter(i => i.type === 'draft').length > 0 && (
                <div className="dash-card">
                  <div className="dash-card-head">
                    <div className="dash-pending-title">
                      <span className="dash-pending-dot dash-dot-gray" />
                      <h3 className="dash-card-title">Koncepty</h3>
                      <span className="dash-pending-count">{(pendingItems || []).filter(i => i.type === 'draft').length}</span>
                    </div>
                  </div>
                  <div className="dash-invoice-list">
                    {(pendingItems || []).filter(i => i.type === 'draft').map(i => (
                      <Link to={`/invoices/${i.id}`} key={i.id} className="dash-invoice-row">
                        <div className="dash-invoice-info">
                          <span className="dash-invoice-num">{i.invoice_number}</span>
                          <span className="dash-invoice-client">{i.client_name || '—'}</span>
                        </div>
                        <div className="dash-invoice-right">
                          <span className="dash-invoice-amount">{new Intl.NumberFormat('cs-CZ').format(i.total)} {i.currency}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* === REPORTS === */}
      {tab === 'reports' && (
        <div className="dash-content dash-fade-in">
          {/* Revenue & Expenses area chart */}
          <div className="dash-card dash-card-chart">
            <div className="dash-card-head">
              <div>
                <h3 className="dash-card-title">Příjmy vs. Výdaje</h3>
                <span className="dash-card-desc">{chartYear ? `Rok ${chartYear}` : 'Měsíční porovnání'}</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" vertical={false} />
                <XAxis dataKey="name" fontSize={12} tick={{ fill: 'var(--gray-500)' }} axisLine={false} tickLine={false} />
                <YAxis fontSize={12} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} tick={{ fill: 'var(--gray-500)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="issued" name="Příjmy" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: '#fff', stroke: '#6366f1', strokeWidth: 2 }} activeDot={{ r: 7 }} />
                <Line type="monotone" dataKey="expenses" name="Výdaje" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 4, fill: '#fff', stroke: '#f43f5e', strokeWidth: 2 }} activeDot={{ r: 7 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="dash-grid-2">
            {/* Expenses by category */}
            <div className="dash-card">
              <h3 className="dash-card-title" style={{ marginBottom: '1rem' }}>Výdaje dle kategorie</h3>
              {expensesByCategory.length === 0 ? (
                <div className="dash-empty-small">Žádná data</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={expensesByCategory} layout="vertical" margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" horizontal={false} />
                    <XAxis type="number" fontSize={12} tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fill: 'var(--gray-500)' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="category" fontSize={12} width={100} tick={{ fill: 'var(--gray-500)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total" name="Výdaje" fill="#f43f5e" radius={[0, 6, 6, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Currency breakdown */}
            <div className="dash-card">
              <h3 className="dash-card-title" style={{ marginBottom: '1rem' }}>Měny</h3>
              {currencyBreakdown.length === 0 ? (
                <div className="dash-empty-small">Žádná data</div>
              ) : (
                <div className="dash-currency-list">
                  {currencyBreakdown.map((c, i) => (
                    <div key={i} className="dash-currency-item">
                      <div className="dash-currency-icon">{c.currency === 'CZK' ? '🇨🇿' : c.currency === 'EUR' ? '🇪🇺' : c.currency === 'USD' ? '🇺🇸' : '💱'}</div>
                      <div className="dash-currency-info">
                        <span className="dash-currency-code">{c.currency}</span>
                        <span className="dash-currency-count">{c.count} faktur</span>
                      </div>
                      <span className="dash-currency-total">{new Intl.NumberFormat('cs-CZ').format(c.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Top clients table */}
          <div className="dash-card">
            <h3 className="dash-card-title" style={{ marginBottom: '1rem' }}>Top klienti dle příjmů</h3>
            {topClients.length === 0 ? (
              <div className="dash-empty-small">Žádná data</div>
            ) : (
              <div className="dash-rank-list">
                {topClients.map((c, i) => {
                  const max = topClients[0]?.total || 1;
                  return (
                    <div key={c.name} className="dash-rank-item">
                      <span className="dash-rank-pos">#{i + 1}</span>
                      <div className="dash-rank-info">
                        <div className="dash-rank-header">
                          <span className="dash-rank-name">{c.name}</span>
                          <span className="dash-rank-value">{fmt(c.total)}</span>
                        </div>
                        <div className="dash-rank-bar-bg">
                          <div className="dash-rank-bar" style={{ width: `${(c.total / max) * 100}%`, background: COLORS[i % COLORS.length] }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
