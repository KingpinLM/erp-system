import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, LineChart, Line } from 'recharts';
import { api } from '../api';
import { useAuth } from '../App';

const fmt = (n) => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(n);
const fmtNum = (n) => new Intl.NumberFormat('cs-CZ').format(n);
const fmtDate = (d) => { if (!d) return '—'; const p = d.slice(0,10).split('-'); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : d; };
const MONTHS = ['Led','Úno','Bře','Dub','Kvě','Čvn','Čvc','Srp','Zář','Říj','Lis','Pro'];

// Rillion-inspired muted color palette
const CHART_COLORS = {
  income: '#2563eb',
  expense: '#dc2626',
  profit: '#059669',
  neutral: '#64748b',
  accent: '#7c3aed',
  muted: ['#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#64748b', '#0d9488', '#ea580c', '#be185d'],
};

// SVG Icons - clean, professional
const Icons = {
  revenue: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  expense: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
  profit: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  ),
  clients: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  cashflow: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
    </svg>
  ),
  clock: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  check: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  alert: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  arrowUp: '↑',
  arrowDown: '↓',
};

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
          <span className="dash-tooltip-dot" style={{ background: p.color || p.fill }} />
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
      <span>Načítání...</span>
    </div>
  );
  if (!data || data.error || !data.kpis) return <div className="dash-empty-hero"><span className="dash-empty-icon">{Icons.alert}</span><span>{data?.error || 'Nelze načíst data'}</span></div>;

  const { kpis, revenueByMonth, expensesByCategory, invoicesByStatus, recentInvoices, topClients, topSuppliers, currencyBreakdown, monthlyIssued, monthlyExpenses, pendingItems, chartYear } = data;

  const statusLabels = { draft: 'Koncept', sent: 'Odesláno', paid: 'Zaplaceno', overdue: 'Po splatnosti', cancelled: 'Zrušeno' };
  const statusColors = { draft: '#94a3b8', sent: '#2563eb', paid: '#059669', overdue: '#dc2626', cancelled: '#d97706' };
  const pieData = (invoicesByStatus || []).map(s => ({ name: statusLabels[s.status] || s.status, value: s.count, color: statusColors[s.status] || '#999' }));

  const monthlyData = MONTHS.map((name, i) => {
    const monthKey = String(i + 1).padStart(2, '0');
    const issued = monthlyIssued?.find(m => m.month === monthKey);
    const expense = monthlyExpenses?.find(m => m.month === monthKey);
    return { name, issued: issued?.total || 0, issuedTax: issued?.tax || 0, expenses: expense?.total || 0 };
  });

  const pendingCount = (pendingItems || []).length + (kpis.pendingUsers || 0);
  const profitMargin = kpis.totalRevenue > 0 ? ((kpis.profit / kpis.totalRevenue) * 100).toFixed(1) : 0;

  // Cash flow running total (Rillion-inspired)
  const cashFlowData = (() => {
    let cumulative = 0;
    return monthlyData.map(d => {
      cumulative += (d.issued - d.expenses);
      return { name: d.name, cashflow: cumulative, income: d.issued, expenses: d.expenses };
    });
  })();

  // Payment analytics (Rillion-inspired) - computed from invoice data
  const paidInvoices = (invoicesByStatus || []).find(s => s.status === 'paid');
  const overdueInvoices = (invoicesByStatus || []).find(s => s.status === 'overdue');
  const totalInvoices = (invoicesByStatus || []).reduce((sum, s) => sum + s.count, 0);
  const paidRate = totalInvoices > 0 ? ((paidInvoices?.count || 0) / totalInvoices * 100).toFixed(0) : 0;
  const overdueRate = totalInvoices > 0 ? ((overdueInvoices?.count || 0) / totalInvoices * 100).toFixed(0) : 0;

  const tabs = [
    { key: 'overview', label: 'Přehled' },
    { key: 'cashflow', label: 'Cash Flow' },
    { key: 'pending', label: 'K vyřízení', badge: pendingCount },
    { key: 'reports', label: 'Analytika' },
  ];

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
      {/* Header - Rillion sober style */}
      <div className="dash-header">
        <div className="dash-header-left">
          <h1 className="dash-title">Dashboard</h1>
          <span className="dash-subtitle">Finanční přehled a analytika</span>
        </div>
        <div className="dash-header-right">
          <div className="dash-live-indicator">
            <div className="dash-live-dot" />
            <span className="dash-live-text">Live</span>
          </div>
        </div>
      </div>

      {/* Period selector */}
      <div className="dash-period-bar" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div className="dash-period-pills">
          {categories.map(c => (
            <button key={c.key} className={`dash-period-pill ${periodCategory === c.key ? 'active' : ''}`} onClick={() => handleCategoryChange(c.key)}>
              {c.label}
            </button>
          ))}
        </div>

        {periodCategory === 'month' && (
          <div className="dash-period-pills" style={{ borderLeft: '1px solid var(--gray-200)', paddingLeft: '0.75rem' }}>
            <button className={`dash-period-pill ${period === 'month' ? 'active' : ''}`} onClick={() => setPeriod('month')}>Tento</button>
            <button className={`dash-period-pill ${period === 'last_month' ? 'active' : ''}`} onClick={() => setPeriod('last_month')}>Minulý</button>
          </div>
        )}
        {periodCategory === 'quarter' && (
          <div className="dash-period-pills" style={{ borderLeft: '1px solid var(--gray-200)', paddingLeft: '0.75rem' }}>
            {['q1', 'q2', 'q3', 'q4'].map(q => (
              <button key={q} className={`dash-period-pill ${period === q ? 'active' : ''}`} onClick={() => setPeriod(q)}>{q.toUpperCase()}</button>
            ))}
          </div>
        )}
        {periodCategory === 'half' && (
          <div className="dash-period-pills" style={{ borderLeft: '1px solid var(--gray-200)', paddingLeft: '0.75rem' }}>
            <button className={`dash-period-pill ${period === 'h1' ? 'active' : ''}`} onClick={() => setPeriod('h1')}>1. pol.</button>
            <button className={`dash-period-pill ${period === 'h2' ? 'active' : ''}`} onClick={() => setPeriod('h2')}>2. pol.</button>
          </div>
        )}
        {periodCategory === 'year' && (
          <div className="dash-period-pills" style={{ borderLeft: '1px solid var(--gray-200)', paddingLeft: '0.75rem' }}>
            <button className={`dash-period-pill ${period === 'year' ? 'active' : ''}`} onClick={() => setPeriod('year')}>{currentYear}</button>
            <button className={`dash-period-pill ${period === 'last_year' ? 'active' : ''}`} onClick={() => setPeriod('last_year')}>{currentYear - 1}</button>
          </div>
        )}
      </div>

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
            <span>{t.label}</span>
            {t.badge > 0 && <span className="dash-tab-badge">{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* === OVERVIEW === */}
      {tab === 'overview' && (
        <div className="dash-content dash-fade-in">
          {/* KPI Cards - Rillion sober style with SVG icons */}
          <div className="dash-kpi-grid">
            <div className="dash-kpi">
              <div className="dash-kpi-icon-wrap" style={{ color: '#059669', background: 'rgba(5, 150, 105, 0.08)' }}>
                {Icons.revenue}
              </div>
              <div className="dash-kpi-body">
                <span className="dash-kpi-label">Celkové příjmy</span>
                <span className="dash-kpi-value">{fmt(kpis.totalRevenue)}</span>
              </div>
              <div className="dash-kpi-accent" style={{ background: '#059669' }} />
            </div>

            <div className="dash-kpi">
              <div className="dash-kpi-icon-wrap" style={{ color: '#dc2626', background: 'rgba(220, 38, 38, 0.08)' }}>
                {Icons.expense}
              </div>
              <div className="dash-kpi-body">
                <span className="dash-kpi-label">Celkové výdaje</span>
                <span className="dash-kpi-value">{fmt(kpis.totalExpenses)}</span>
              </div>
              <div className="dash-kpi-accent" style={{ background: '#dc2626' }} />
            </div>

            <div className="dash-kpi">
              <div className="dash-kpi-icon-wrap" style={{ color: '#2563eb', background: 'rgba(37, 99, 235, 0.08)' }}>
                {Icons.profit}
              </div>
              <div className="dash-kpi-body">
                <span className="dash-kpi-label">Čistý zisk</span>
                <span className="dash-kpi-value">{fmt(kpis.profit)}</span>
                <span className={`dash-kpi-trend ${kpis.profit >= 0 ? 'up' : 'down'}`}>
                  {kpis.profit >= 0 ? Icons.arrowUp : Icons.arrowDown} {profitMargin}% marže
                </span>
              </div>
              <div className="dash-kpi-accent" style={{ background: '#2563eb' }} />
            </div>

            <div className="dash-kpi">
              <div className="dash-kpi-icon-wrap" style={{ color: '#7c3aed', background: 'rgba(124, 58, 237, 0.08)' }}>
                {Icons.clients}
              </div>
              <div className="dash-kpi-body">
                <span className="dash-kpi-label">Klienti</span>
                <span className="dash-kpi-value">{kpis.totalClients}</span>
              </div>
              <div className="dash-kpi-accent" style={{ background: '#7c3aed' }} />
            </div>
          </div>

          {/* Rillion-inspired: Payment Performance Strip */}
          <div className="dash-perf-strip">
            <div className="dash-perf-item">
              <div className="dash-perf-label">Celkem faktur</div>
              <div className="dash-perf-value">{totalInvoices}</div>
            </div>
            <div className="dash-perf-sep" />
            <div className="dash-perf-item">
              <div className="dash-perf-label">Míra zaplacení</div>
              <div className="dash-perf-value" style={{ color: '#059669' }}>{paidRate}%</div>
            </div>
            <div className="dash-perf-sep" />
            <div className="dash-perf-item">
              <div className="dash-perf-label">Po splatnosti</div>
              <div className="dash-perf-value" style={{ color: overdueRate > 0 ? '#dc2626' : '#059669' }}>{overdueRate}%</div>
            </div>
            <div className="dash-perf-sep" />
            <div className="dash-perf-item">
              <div className="dash-perf-label">Průměr faktura</div>
              <div className="dash-perf-value">{totalInvoices > 0 ? fmt(kpis.totalRevenue / totalInvoices) : '—'}</div>
            </div>
          </div>

          {/* Main chart */}
          <div className="dash-card dash-card-chart">
            <div className="dash-card-head">
              <div>
                <h3 className="dash-card-title">Příjmy a výdaje</h3>
                <span className="dash-card-desc">{chartYear ? `Rok ${chartYear}` : 'Celé období'}</span>
              </div>
              <div className="dash-legend">
                <span className="dash-legend-item"><span className="dash-legend-dot" style={{ background: CHART_COLORS.income }} /> Příjmy</span>
                <span className="dash-legend-item"><span className="dash-legend-dot" style={{ background: CHART_COLORS.expense }} /> Výdaje</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" fontSize={11} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis fontSize={11} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="issued" name="Příjmy" fill={CHART_COLORS.income} radius={[4, 4, 0, 0]} barSize={22} />
                <Bar dataKey="expenses" name="Výdaje" fill={CHART_COLORS.expense} radius={[4, 4, 0, 0]} barSize={22} opacity={0.75} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Second row */}
          <div className="dash-grid-2">
            <div className="dash-card">
              <div className="dash-card-head">
                <h3 className="dash-card-title">Poslední faktury</h3>
                <Link to="/invoices" className="dash-card-link">Zobrazit vše</Link>
              </div>
              <div className="dash-invoice-list">
                {recentInvoices.map(inv => (
                  <Link to={`/invoices/${inv.id}`} key={inv.id} className="dash-invoice-row">
                    <div className="dash-invoice-info">
                      <span className="dash-invoice-num">{inv.invoice_number}</span>
                      <span className="dash-invoice-client">{inv.client_name || '—'}</span>
                    </div>
                    <div className="dash-invoice-right">
                      <span className="dash-invoice-amount">{fmtNum(inv.total)} {inv.currency}</span>
                      <span className={`dash-status dash-status-${inv.status}`}>{statusLabels[inv.status]}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="dash-card">
              <h3 className="dash-card-title" style={{ marginBottom: '1rem' }}>Stav faktur</h3>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={72} innerRadius={46} dataKey="value" paddingAngle={2} strokeWidth={0}>
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

          {/* Third row */}
          <div className="dash-grid-2">
            {topClients.length > 0 && (
              <div className="dash-card">
                <h3 className="dash-card-title" style={{ marginBottom: '1rem' }}>Top klienti</h3>
                <div className="dash-rank-list">
                  {topClients.slice(0, 5).map((c, i) => {
                    const max = topClients[0]?.total || 1;
                    return (
                      <div key={c.name} className="dash-rank-item">
                        <span className="dash-rank-pos">{i + 1}</span>
                        <div className="dash-rank-info">
                          <div className="dash-rank-header">
                            <span className="dash-rank-name">{c.name}</span>
                            <span className="dash-rank-value">{fmt(c.total)}</span>
                          </div>
                          <div className="dash-rank-bar-bg">
                            <div className="dash-rank-bar" style={{ width: `${(c.total / max) * 100}%`, background: CHART_COLORS.muted[i % CHART_COLORS.muted.length] }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {(topSuppliers || []).length > 0 && (
              <div className="dash-card">
                <h3 className="dash-card-title" style={{ marginBottom: '1rem' }}>Dodavatelé</h3>
                <div className="dash-rank-list">
                  {(topSuppliers || []).slice(0, 5).map((s, i) => {
                    const max = topSuppliers[0]?.total || 1;
                    return (
                      <div key={s.name} className="dash-rank-item">
                        <span className="dash-rank-pos">{i + 1}</span>
                        <div className="dash-rank-info">
                          <div className="dash-rank-header">
                            <span className="dash-rank-name">{s.name}</span>
                            <span className="dash-rank-value">{fmt(s.total)}</span>
                          </div>
                          <div className="dash-rank-bar-bg">
                            <div className="dash-rank-bar" style={{ width: `${(s.total / max) * 100}%`, background: CHART_COLORS.muted[(i + 5) % CHART_COLORS.muted.length] }} />
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

      {/* === CASH FLOW (Rillion-inspired) === */}
      {tab === 'cashflow' && (
        <div className="dash-content dash-fade-in">
          {/* Cash flow KPIs */}
          <div className="dash-kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="dash-kpi">
              <div className="dash-kpi-icon-wrap" style={{ color: '#059669', background: 'rgba(5, 150, 105, 0.08)' }}>
                {Icons.cashflow}
              </div>
              <div className="dash-kpi-body">
                <span className="dash-kpi-label">Čistý cash flow</span>
                <span className="dash-kpi-value" style={{ color: kpis.profit >= 0 ? '#059669' : '#dc2626' }}>{fmt(kpis.profit)}</span>
              </div>
              <div className="dash-kpi-accent" style={{ background: kpis.profit >= 0 ? '#059669' : '#dc2626' }} />
            </div>
            <div className="dash-kpi">
              <div className="dash-kpi-icon-wrap" style={{ color: '#2563eb', background: 'rgba(37, 99, 235, 0.08)' }}>
                {Icons.revenue}
              </div>
              <div className="dash-kpi-body">
                <span className="dash-kpi-label">Příjmy celkem</span>
                <span className="dash-kpi-value">{fmt(kpis.totalRevenue)}</span>
              </div>
              <div className="dash-kpi-accent" style={{ background: '#2563eb' }} />
            </div>
            <div className="dash-kpi">
              <div className="dash-kpi-icon-wrap" style={{ color: '#dc2626', background: 'rgba(220, 38, 38, 0.08)' }}>
                {Icons.expense}
              </div>
              <div className="dash-kpi-body">
                <span className="dash-kpi-label">Výdaje celkem</span>
                <span className="dash-kpi-value">{fmt(kpis.totalExpenses)}</span>
              </div>
              <div className="dash-kpi-accent" style={{ background: '#dc2626' }} />
            </div>
          </div>

          {/* Cumulative Cash Flow Area Chart */}
          <div className="dash-card dash-card-chart">
            <div className="dash-card-head">
              <div>
                <h3 className="dash-card-title">Kumulativní cash flow</h3>
                <span className="dash-card-desc">Vývoj kumulovaného cash flow v průběhu roku</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={cashFlowData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradCashflow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#059669" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" fontSize={11} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis fontSize={11} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="cashflow" name="Cash flow" stroke="#059669" fill="url(#gradCashflow)" strokeWidth={2.5} dot={{ r: 3, fill: '#059669', strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly Income vs Expense comparison */}
          <div className="dash-card dash-card-chart">
            <div className="dash-card-head">
              <div>
                <h3 className="dash-card-title">Měsíční příjmy vs. výdaje</h3>
                <span className="dash-card-desc">Porovnání měsíčního cash flow</span>
              </div>
              <div className="dash-legend">
                <span className="dash-legend-item"><span className="dash-legend-dot" style={{ background: CHART_COLORS.income }} /> Příjmy</span>
                <span className="dash-legend-item"><span className="dash-legend-dot" style={{ background: CHART_COLORS.expense }} /> Výdaje</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={cashFlowData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" fontSize={11} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis fontSize={11} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="income" name="Příjmy" stroke={CHART_COLORS.income} strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS.income, strokeWidth: 0 }} />
                <Line type="monotone" dataKey="expenses" name="Výdaje" stroke={CHART_COLORS.expense} strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS.expense, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* === PENDING === */}
      {tab === 'pending' && (
        <div className="dash-content dash-fade-in">
          {(pendingItems || []).length === 0 && !kpis.pendingUsers ? (
            <div className="dash-empty-hero">
              <span className="dash-empty-icon" style={{ color: '#059669' }}>{Icons.check}</span>
              <span className="dash-empty-title">Vše vyřízeno</span>
              <span className="dash-empty-desc">Nemáte žádné nevyřízené položky.</span>
            </div>
          ) : (
            <div className="dash-pending-sections">
              {kpis.pendingUsers > 0 && can('admin') && (
                <div className="dash-alert dash-alert-warning">
                  <div className="dash-alert-icon" style={{ color: '#d97706' }}>{Icons.alert}</div>
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
                          <span className="dash-invoice-amount">{fmtNum(i.total)} {i.currency}</span>
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
                          <span className="dash-invoice-amount">{fmtNum(i.total)} {i.currency}</span>
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
                          <span className="dash-invoice-amount">{fmtNum(i.total)} {i.currency}</span>
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

      {/* === REPORTS / ANALYTICS (Rillion-inspired) === */}
      {tab === 'reports' && (
        <div className="dash-content dash-fade-in">
          {/* Revenue & Expenses bar chart with profit */}
          <div className="dash-card dash-card-chart">
            <div className="dash-card-head">
              <div>
                <h3 className="dash-card-title">Příjmy, výdaje a zisk</h3>
                <span className="dash-card-desc">{chartYear ? `Rok ${chartYear}` : 'Měsíční porovnání'}</span>
              </div>
              <div className="dash-legend">
                <span className="dash-legend-item"><span className="dash-legend-dot" style={{ background: CHART_COLORS.income }} /> Příjmy</span>
                <span className="dash-legend-item"><span className="dash-legend-dot" style={{ background: CHART_COLORS.expense }} /> Výdaje</span>
                <span className="dash-legend-item"><span className="dash-legend-dot" style={{ background: CHART_COLORS.profit }} /> Zisk</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData.map(d => ({ ...d, profit: d.issued - d.expenses }))} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={1}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" fontSize={11} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis fontSize={11} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="issued" name="Příjmy" fill={CHART_COLORS.income} radius={[3, 3, 0, 0]} barSize={16} />
                <Bar dataKey="expenses" name="Výdaje" fill={CHART_COLORS.expense} radius={[3, 3, 0, 0]} barSize={16} opacity={0.75} />
                <Bar dataKey="profit" name="Zisk" fill={CHART_COLORS.profit} radius={[3, 3, 0, 0]} barSize={16} />
              </BarChart>
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" fontSize={11} tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="category" fontSize={11} width={100} tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total" name="Výdaje" fill={CHART_COLORS.expense} radius={[0, 4, 4, 0]} barSize={18} opacity={0.8} />
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
                      <div className="dash-currency-icon-wrap">
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>{c.currency}</span>
                      </div>
                      <div className="dash-currency-info">
                        <span className="dash-currency-code">{c.currency === 'CZK' ? 'Česká koruna' : c.currency === 'EUR' ? 'Euro' : c.currency === 'USD' ? 'US Dolar' : c.currency}</span>
                        <span className="dash-currency-count">{c.count} faktur</span>
                      </div>
                      <span className="dash-currency-total">{fmtNum(c.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Top clients table */}
          <div className="dash-card">
            <h3 className="dash-card-title" style={{ marginBottom: '1rem' }}>Klienti dle příjmů</h3>
            {topClients.length === 0 ? (
              <div className="dash-empty-small">Žádná data</div>
            ) : (
              <div className="dash-rank-list">
                {topClients.map((c, i) => {
                  const max = topClients[0]?.total || 1;
                  return (
                    <div key={c.name} className="dash-rank-item">
                      <span className="dash-rank-pos">{i + 1}</span>
                      <div className="dash-rank-info">
                        <div className="dash-rank-header">
                          <span className="dash-rank-name">{c.name}</span>
                          <span className="dash-rank-value">{fmt(c.total)}</span>
                        </div>
                        <div className="dash-rank-bar-bg">
                          <div className="dash-rank-bar" style={{ width: `${(c.total / max) * 100}%`, background: CHART_COLORS.muted[i % CHART_COLORS.muted.length] }} />
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
