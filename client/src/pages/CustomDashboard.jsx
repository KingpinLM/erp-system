import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { api } from '../api';
import { useAuth } from '../App';

// ─── Formatting helpers ───────────────────────────────────
const fmt = (n) => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(n);
const fmtNum = (n) => new Intl.NumberFormat('cs-CZ').format(n);
const fmtDate = (d) => { if (!d) return '—'; const p = d.slice(0,10).split('-'); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : d; };
const MONTHS = ['Led','Úno','Bře','Dub','Kvě','Čvn','Čvc','Srp','Zář','Říj','Lis','Pro'];
const COLORS = { income: '#0d9488', expense: '#e11d48', profit: '#059669', accent: '#0891b2', muted: ['#0d9488','#0891b2','#059669','#d97706','#e11d48','#7c3aed','#64748b'] };
const statusLabels = { draft: 'Koncept', sent: 'Odesláno', paid: 'Zaplaceno', overdue: 'Po splatnosti', cancelled: 'Zrušeno' };
const statusColors = { draft: '#94a3b8', sent: '#0891b2', paid: '#0d9488', overdue: '#e11d48', cancelled: '#d97706' };

const ChartTooltip = ({ active, payload, label }) => {
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

// ─── Widget Registry ──────────────────────────────────────
// Each widget: { id, label, icon, defaultSize, minW, minH, component }
// Sizes: 1=quarter, 2=half, 4=full width; h in grid rows

const WIDGET_REGISTRY = {
  kpi_revenue: {
    label: 'Příjmy', icon: '💰', category: 'KPI',
    defaultW: 1, defaultH: 1, minW: 1, minH: 1,
    render: (data) => (
      <div className="cdb-kpi">
        <div className="cdb-kpi-icon" style={{ color: '#0d9488', background: 'rgba(13,148,136,0.08)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <span className="cdb-kpi-label">Celkové příjmy</span>
        <span className="cdb-kpi-value">{fmt(data?.kpis?.totalRevenue || 0)}</span>
      </div>
    ),
  },
  kpi_expenses: {
    label: 'Výdaje', icon: '📉', category: 'KPI',
    defaultW: 1, defaultH: 1, minW: 1, minH: 1,
    render: (data) => (
      <div className="cdb-kpi">
        <div className="cdb-kpi-icon" style={{ color: '#e11d48', background: 'rgba(225,29,72,0.08)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
        </div>
        <span className="cdb-kpi-label">Celkové výdaje</span>
        <span className="cdb-kpi-value">{fmt(data?.kpis?.totalExpenses || 0)}</span>
      </div>
    ),
  },
  kpi_profit: {
    label: 'Zisk', icon: '📈', category: 'KPI',
    defaultW: 1, defaultH: 1, minW: 1, minH: 1,
    render: (data) => {
      const profit = data?.kpis?.profit || 0;
      const margin = data?.kpis?.totalRevenue > 0 ? ((profit / data.kpis.totalRevenue) * 100).toFixed(1) : 0;
      return (
        <div className="cdb-kpi">
          <div className="cdb-kpi-icon" style={{ color: '#0891b2', background: 'rgba(8,145,178,0.08)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <span className="cdb-kpi-label">Čistý zisk</span>
          <span className="cdb-kpi-value">{fmt(profit)}</span>
          <span className="cdb-kpi-sub">{margin}% marže</span>
        </div>
      );
    },
  },
  kpi_clients: {
    label: 'Klienti', icon: '👤', category: 'KPI',
    defaultW: 1, defaultH: 1, minW: 1, minH: 1,
    render: (data) => (
      <div className="cdb-kpi">
        <div className="cdb-kpi-icon" style={{ color: '#0f766e', background: 'rgba(15,118,110,0.08)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        </div>
        <span className="cdb-kpi-label">Klienti</span>
        <span className="cdb-kpi-value">{data?.kpis?.totalClients || 0}</span>
      </div>
    ),
  },
  kpi_invoices: {
    label: 'Fakturační metriky', icon: '📊', category: 'KPI',
    defaultW: 2, defaultH: 1, minW: 1, minH: 1,
    render: (data) => {
      const byStatus = data?.invoicesByStatus || [];
      const total = byStatus.reduce((s, x) => s + x.count, 0);
      const paid = byStatus.find(s => s.status === 'paid')?.count || 0;
      const overdue = byStatus.find(s => s.status === 'overdue')?.count || 0;
      return (
        <div className="cdb-perf-strip">
          <div className="cdb-perf-item"><span className="cdb-perf-label">Celkem faktur</span><span className="cdb-perf-value">{total}</span></div>
          <div className="cdb-perf-item"><span className="cdb-perf-label">Zaplaceno</span><span className="cdb-perf-value" style={{ color: '#0d9488' }}>{total > 0 ? Math.round(paid / total * 100) : 0}%</span></div>
          <div className="cdb-perf-item"><span className="cdb-perf-label">Po splatnosti</span><span className="cdb-perf-value" style={{ color: overdue > 0 ? '#e11d48' : '#0d9488' }}>{total > 0 ? Math.round(overdue / total * 100) : 0}%</span></div>
          <div className="cdb-perf-item"><span className="cdb-perf-label">Ø faktura</span><span className="cdb-perf-value">{total > 0 ? fmt((data?.kpis?.totalRevenue || 0) / total) : '—'}</span></div>
        </div>
      );
    },
  },

  chart_revenue: {
    label: 'Příjmy a výdaje (graf)', icon: '📊', category: 'Grafy',
    defaultW: 4, defaultH: 2, minW: 2, minH: 2,
    render: (data) => {
      const monthly = MONTHS.map((name, i) => {
        const mk = String(i + 1).padStart(2, '0');
        const iss = data?.monthlyIssued?.find(m => m.month === mk);
        const exp = data?.monthlyExpenses?.find(m => m.month === mk);
        return { name, issued: iss?.total || 0, expenses: exp?.total || 0 };
      });
      return (
        <div style={{ width: '100%', height: '100%', minHeight: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" fontSize={11} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis fontSize={11} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="issued" name="Příjmy" fill={COLORS.income} radius={[4,4,0,0]} barSize={18} />
              <Bar dataKey="expenses" name="Výdaje" fill={COLORS.expense} radius={[4,4,0,0]} barSize={18} opacity={0.75} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    },
  },

  chart_cashflow: {
    label: 'Cash flow (graf)', icon: '💹', category: 'Grafy',
    defaultW: 4, defaultH: 2, minW: 2, minH: 2,
    render: (data) => {
      let cum = 0;
      const cfData = MONTHS.map((name, i) => {
        const mk = String(i + 1).padStart(2, '0');
        const inc = data?.monthlyIssued?.find(m => m.month === mk)?.total || 0;
        const exp = data?.monthlyExpenses?.find(m => m.month === mk)?.total || 0;
        cum += (inc - exp);
        return { name, cashflow: cum };
      });
      return (
        <div style={{ width: '100%', height: '100%', minHeight: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cfData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradCF" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0d9488" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#0d9488" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" fontSize={11} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis fontSize={11} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="cashflow" name="Cash flow" stroke="#0d9488" fill="url(#gradCF)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );
    },
  },

  chart_pie: {
    label: 'Stav faktur (koláč)', icon: '🥧', category: 'Grafy',
    defaultW: 2, defaultH: 2, minW: 2, minH: 2,
    render: (data) => {
      const pieData = (data?.invoicesByStatus || []).map(s => ({
        name: statusLabels[s.status] || s.status, value: s.count, color: statusColors[s.status] || '#999',
      }));
      const total = pieData.reduce((s, d) => s + d.value, 0);
      return (
        <div style={{ width: '100%', height: '100%', minHeight: 220, position: 'relative' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} innerRadius={50} dataKey="value" paddingAngle={3} strokeWidth={0}>
                {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gray-900)' }}>{total}</div>
            <div style={{ fontSize: 10, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: 1 }}>faktur</div>
          </div>
        </div>
      );
    },
  },

  list_recent_invoices: {
    label: 'Poslední faktury', icon: '📄', category: 'Seznamy',
    defaultW: 2, defaultH: 2, minW: 2, minH: 1,
    render: (data) => (
      <div className="cdb-list">
        {(data?.recentInvoices || []).slice(0, 8).map(inv => (
          <Link to={`/invoices/${inv.id}`} key={inv.id} className="cdb-list-row">
            <div>
              <span className="cdb-list-primary">{inv.invoice_number}</span>
              <span className="cdb-list-secondary">{inv.client_name || '—'}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="cdb-list-primary">{fmtNum(inv.total)} {inv.currency}</span>
              <span className={`dash-status dash-status-${inv.status}`} style={{ fontSize: 10 }}>{statusLabels[inv.status]}</span>
            </div>
          </Link>
        ))}
        {(!data?.recentInvoices || data.recentInvoices.length === 0) && (
          <div className="cdb-empty">Žádné faktury</div>
        )}
      </div>
    ),
  },

  list_top_clients: {
    label: 'Top klienti', icon: '🏆', category: 'Seznamy',
    defaultW: 2, defaultH: 2, minW: 1, minH: 1,
    render: (data) => {
      const clients = (data?.topClients || []).slice(0, 5);
      const max = clients[0]?.total || 1;
      return (
        <div className="cdb-rank-list">
          {clients.map((c, i) => (
            <Link to={`/clients/${c.id}`} key={c.id} className="cdb-rank-item">
              <span className="cdb-rank-pos">{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                  <span style={{ color: '#0d9488', fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>{fmt(c.total)}</span>
                </div>
                <div style={{ height: 4, background: 'var(--gray-100)', borderRadius: 2, marginTop: 4 }}>
                  <div style={{ height: '100%', width: `${(c.total / max) * 100}%`, background: COLORS.muted[i % 7], borderRadius: 2 }} />
                </div>
              </div>
            </Link>
          ))}
          {clients.length === 0 && <div className="cdb-empty">Žádní klienti</div>}
        </div>
      );
    },
  },

  list_top_suppliers: {
    label: 'Dodavatelé', icon: '🚚', category: 'Seznamy',
    defaultW: 2, defaultH: 2, minW: 1, minH: 1,
    render: (data) => {
      const suppliers = (data?.topSuppliers || []).slice(0, 5);
      const max = suppliers[0]?.total || 1;
      return (
        <div className="cdb-rank-list">
          {suppliers.map((s, i) => (
            <Link to={`/clients/${s.id}`} key={s.id} className="cdb-rank-item">
              <span className="cdb-rank-pos">{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  <span style={{ color: '#e11d48', fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>{fmt(s.total)}</span>
                </div>
                <div style={{ height: 4, background: 'var(--gray-100)', borderRadius: 2, marginTop: 4 }}>
                  <div style={{ height: '100%', width: `${(s.total / max) * 100}%`, background: COLORS.muted[(i + 4) % 7], borderRadius: 2 }} />
                </div>
              </div>
            </Link>
          ))}
          {suppliers.length === 0 && <div className="cdb-empty">Žádní dodavatelé</div>}
        </div>
      );
    },
  },

  list_pending: {
    label: 'K vyřízení', icon: '⏰', category: 'Seznamy',
    defaultW: 2, defaultH: 2, minW: 1, minH: 1,
    render: (data) => {
      const items = data?.pendingItems || [];
      return (
        <div className="cdb-list">
          {items.slice(0, 8).map((item, i) => (
            <Link to={`/invoices/${item.id}`} key={i} className="cdb-list-row">
              <div>
                <span className="cdb-list-primary">{item.invoice_number}</span>
                <span className="cdb-list-secondary">{item.client_name || '—'}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="cdb-list-primary">{fmt(item.total_czk)}</span>
                <span style={{ fontSize: 10, color: '#e11d48' }}>{item.days_overdue > 0 ? `${item.days_overdue}d po splatnosti` : fmtDate(item.due_date)}</span>
              </div>
            </Link>
          ))}
          {items.length === 0 && <div className="cdb-empty">Vše vyřízeno ✓</div>}
        </div>
      );
    },
  },

  currencies: {
    label: 'Měny', icon: '💱', category: 'KPI',
    defaultW: 2, defaultH: 1, minW: 1, minH: 1,
    render: (data) => {
      const curr = data?.currencyBreakdown || [];
      return (
        <div className="cdb-perf-strip">
          {curr.slice(0, 4).map(c => (
            <div className="cdb-perf-item" key={c.currency}>
              <span className="cdb-perf-label">{c.currency}</span>
              <span className="cdb-perf-value">{fmtNum(c.total)} {c.currency === 'CZK' ? 'Kč' : ''}</span>
            </div>
          ))}
          {curr.length === 0 && <div className="cdb-empty" style={{ padding: 8 }}>—</div>}
        </div>
      );
    },
  },
};

const DEFAULT_LAYOUT = [
  { id: 'kpi_revenue', x: 0, y: 0, w: 1, h: 1 },
  { id: 'kpi_expenses', x: 1, y: 0, w: 1, h: 1 },
  { id: 'kpi_profit', x: 2, y: 0, w: 1, h: 1 },
  { id: 'kpi_clients', x: 3, y: 0, w: 1, h: 1 },
  { id: 'kpi_invoices', x: 0, y: 1, w: 2, h: 1 },
  { id: 'currencies', x: 2, y: 1, w: 2, h: 1 },
  { id: 'chart_revenue', x: 0, y: 2, w: 4, h: 2 },
  { id: 'list_recent_invoices', x: 0, y: 4, w: 2, h: 2 },
  { id: 'chart_pie', x: 2, y: 4, w: 2, h: 2 },
  { id: 'list_top_clients', x: 0, y: 6, w: 2, h: 2 },
  { id: 'list_top_suppliers', x: 2, y: 6, w: 2, h: 2 },
];

const GRID_COLS = 4;
const CELL_H = 140; // px per grid row
const GAP = 12;

export default function CustomDashboard() {
  const [layout, setLayout] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [catalog, setCatalog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragItem, setDragItem] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragPos, setDragPos] = useState(null);
  const [resizing, setResizing] = useState(null);
  const gridRef = useRef(null);
  const { user } = useAuth();

  // Load layout + dashboard data
  useEffect(() => {
    Promise.all([
      api.getDashboardLayout(),
      api.dashboard(),
    ]).then(([layoutRes, dashData]) => {
      setLayout(layoutRes.layout || DEFAULT_LAYOUT);
      setData(dashData);
    }).finally(() => setLoading(false));
  }, []);

  const saveLayout = useCallback(async (newLayout) => {
    setSaving(true);
    try {
      await api.saveDashboardLayout(newLayout);
    } finally {
      setSaving(false);
    }
  }, []);

  const handleToggleEdit = () => {
    if (editing) {
      // Save on exit
      saveLayout(layout);
    }
    setEditing(!editing);
    setCatalog(false);
  };

  const handleResetLayout = () => {
    setLayout([...DEFAULT_LAYOUT]);
    saveLayout(DEFAULT_LAYOUT);
  };

  const addWidget = (widgetId) => {
    if (layout.find(l => l.id === widgetId)) return; // already on grid
    const reg = WIDGET_REGISTRY[widgetId];
    // Find first free spot
    const maxY = layout.reduce((m, l) => Math.max(m, l.y + l.h), 0);
    setLayout(prev => [...prev, {
      id: widgetId,
      x: 0, y: maxY,
      w: reg.defaultW, h: reg.defaultH,
    }]);
  };

  const removeWidget = (widgetId) => {
    setLayout(prev => prev.filter(l => l.id !== widgetId));
  };

  // ─── Drag and Drop ──────────────────────────────────────
  const getGridCoords = (clientX, clientY) => {
    if (!gridRef.current) return { gx: 0, gy: 0 };
    const rect = gridRef.current.getBoundingClientRect();
    const cellW = (rect.width - GAP * (GRID_COLS - 1)) / GRID_COLS;
    const gx = Math.max(0, Math.min(GRID_COLS - 1, Math.floor((clientX - rect.left) / (cellW + GAP))));
    const gy = Math.max(0, Math.floor((clientY - rect.top) / (CELL_H + GAP)));
    return { gx, gy };
  };

  const handleDragStart = (e, item) => {
    if (!editing) return;
    e.preventDefault();
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    setDragItem(item.id);
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setDragPos({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    if (!dragItem) return;
    const onMove = (e) => {
      setDragPos({ x: e.clientX, y: e.clientY });
    };
    const onUp = (e) => {
      const { gx, gy } = getGridCoords(e.clientX, e.clientY);
      const item = layout.find(l => l.id === dragItem);
      if (item) {
        const clampedX = Math.min(gx, GRID_COLS - item.w);
        setLayout(prev => prev.map(l => l.id === dragItem ? { ...l, x: clampedX, y: gy } : l));
      }
      setDragItem(null);
      setDragPos(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragItem, layout]);

  // ─── Resize ─────────────────────────────────────────────
  const handleResizeStart = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({ id: item.id, startX: e.clientX, startY: e.clientY, startW: item.w, startH: item.h });
  };

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e) => {
      const cellW = gridRef.current ? (gridRef.current.getBoundingClientRect().width - GAP * (GRID_COLS - 1)) / GRID_COLS : 200;
      const dw = Math.round((e.clientX - resizing.startX) / (cellW + GAP));
      const dh = Math.round((e.clientY - resizing.startY) / (CELL_H + GAP));
      const item = layout.find(l => l.id === resizing.id);
      const reg = WIDGET_REGISTRY[resizing.id];
      if (item && reg) {
        const newW = Math.max(reg.minW, Math.min(GRID_COLS - item.x, resizing.startW + dw));
        const newH = Math.max(reg.minH, resizing.startH + dh);
        setLayout(prev => prev.map(l => l.id === resizing.id ? { ...l, w: newW, h: newH } : l));
      }
    };
    const onUp = () => setResizing(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [resizing, layout]);

  if (loading) return (
    <div className="dash-loading">
      <div className="dash-loading-spinner" />
      <span>Načítání...</span>
    </div>
  );

  if (!layout) return null;

  const gridHeight = layout.reduce((m, l) => Math.max(m, l.y + l.h), 0);
  const usedIds = new Set(layout.map(l => l.id));
  const categories = {};
  Object.entries(WIDGET_REGISTRY).forEach(([id, reg]) => {
    const cat = reg.category || 'Ostatní';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push({ id, ...reg, used: usedIds.has(id) });
  });

  return (
    <div className="cdb">
      {/* Toolbar */}
      <div className="cdb-toolbar">
        <div className="cdb-toolbar-left">
          <h2 className="cdb-toolbar-title">Můj dashboard</h2>
          {saving && <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>Ukládání...</span>}
        </div>
        <div className="cdb-toolbar-actions">
          {editing && (
            <>
              <button className="btn btn-sm" onClick={() => setCatalog(!catalog)}>
                {catalog ? '✕ Zavřít katalog' : '+ Přidat widget'}
              </button>
              <button className="btn btn-sm" onClick={handleResetLayout}>
                Výchozí rozložení
              </button>
            </>
          )}
          <button className={`btn btn-sm ${editing ? 'btn-primary' : ''}`} onClick={handleToggleEdit}>
            {editing ? '✓ Uložit' : '✎ Upravit'}
          </button>
        </div>
      </div>

      {/* Widget catalog panel */}
      {catalog && editing && (
        <div className="cdb-catalog">
          <div className="cdb-catalog-inner">
            {Object.entries(categories).map(([cat, widgets]) => (
              <div key={cat} className="cdb-catalog-section">
                <div className="cdb-catalog-cat">{cat}</div>
                <div className="cdb-catalog-grid">
                  {widgets.map(w => (
                    <button
                      key={w.id}
                      className={`cdb-catalog-item ${w.used ? 'used' : ''}`}
                      onClick={() => !w.used && addWidget(w.id)}
                      disabled={w.used}
                    >
                      <span className="cdb-catalog-item-icon">{w.icon}</span>
                      <span className="cdb-catalog-item-label">{w.label}</span>
                      {w.used && <span className="cdb-catalog-item-check">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      <div
        className="cdb-grid"
        ref={gridRef}
        style={{
          position: 'relative',
          minHeight: gridHeight * (CELL_H + GAP) + GAP,
        }}
      >
        {layout.map(item => {
          const reg = WIDGET_REGISTRY[item.id];
          if (!reg) return null;

          const isDragging = dragItem === item.id;
          const cellW = gridRef.current
            ? (gridRef.current.getBoundingClientRect().width - GAP * (GRID_COLS - 1)) / GRID_COLS
            : 250;

          const style = isDragging && dragPos
            ? {
                position: 'fixed',
                left: dragPos.x - dragOffset.x,
                top: dragPos.y - dragOffset.y,
                width: item.w * cellW + (item.w - 1) * GAP,
                height: item.h * CELL_H + (item.h - 1) * GAP,
                zIndex: 1000,
                opacity: 0.85,
                pointerEvents: 'none',
              }
            : {
                position: 'absolute',
                left: item.x * (cellW + GAP),
                top: item.y * (CELL_H + GAP),
                width: item.w * cellW + (item.w - 1) * GAP,
                height: item.h * CELL_H + (item.h - 1) * GAP,
                transition: dragItem ? 'none' : 'all 0.2s ease',
              };

          return (
            <div
              key={item.id}
              className={`cdb-widget ${editing ? 'cdb-widget-edit' : ''} ${isDragging ? 'cdb-widget-dragging' : ''}`}
              style={style}
              onMouseDown={(e) => editing && handleDragStart(e, item)}
            >
              {editing && (
                <div className="cdb-widget-toolbar">
                  <span className="cdb-widget-drag-handle">⠿</span>
                  <span className="cdb-widget-title">{reg.icon} {reg.label}</span>
                  <button className="cdb-widget-remove" onClick={(e) => { e.stopPropagation(); removeWidget(item.id); }}>✕</button>
                </div>
              )}
              <div className="cdb-widget-content">
                {reg.render(data)}
              </div>
              {editing && (
                <div
                  className="cdb-widget-resize"
                  onMouseDown={(e) => handleResizeStart(e, item)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
