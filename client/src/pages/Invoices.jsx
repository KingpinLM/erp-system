import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../App';
import Pagination, { usePagination } from '../components/Pagination';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { SkeletonTable } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

const isTouchDevice = () => window.matchMedia('(hover: none) and (pointer: coarse)').matches;

const statusLabels = { draft: 'Koncept', sent: 'Odesláno', paid: 'Zaplaceno', overdue: 'Po splatnosti', cancelled: 'Zrušeno' };
const statusColors = { draft: '#64748b', sent: '#4f46e5', paid: '#059669', overdue: '#dc2626', cancelled: '#d97706' };
const statusBg = { draft: '#f1f5f9', sent: '#eef2ff', paid: '#ecfdf5', overdue: '#fef2f2', cancelled: '#fffbeb' };
const fmt = (n, cur = 'CZK') => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(n);
const fmtDate = (d) => { if (!d) return '—'; const p = d.slice(0,10).split('-'); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : d; };

const typeLabels = { regular: 'Faktura', proforma: 'Proforma', credit_note: 'Dobropis' };

function InvoiceHoverPreview({ invoice, style }) {
  if (!invoice) return null;
  const items = invoice.items || [];
  return (
    <div className="hover-preview-mobile-hide" style={{
      position: 'fixed', zIndex: 9999, pointerEvents: 'none',
      width: Math.min(320, window.innerWidth - 32), background: 'white', borderRadius: 12,
      border: '1px solid #e2e8f0', boxShadow: '0 20px 50px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.08)',
      overflow: 'hidden', animation: 'fadeIn 0.12s ease-out',
      ...style,
    }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {invoice.invoice_type === 'credit_note' ? 'Dobropis' : invoice.invoice_type === 'proforma' ? 'Proforma' : 'Faktura'}
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>{invoice.invoice_number}</div>
        </div>
        <span style={{ padding: '3px 8px', borderRadius: 4, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', background: statusBg[invoice.status], color: statusColors[invoice.status] }}>
          {statusLabels[invoice.status]}
        </span>
      </div>

      <div style={{ padding: '12px 16px' }}>
        {/* Client */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Odběratel</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{invoice.client_name || '—'}</div>
        </div>

        {/* Dates row */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 11 }}>
          <div><span style={{ color: '#94a3b8' }}>Vystaveno: </span><span style={{ fontWeight: 600, color: '#334155' }}>{fmtDate(invoice.issue_date)}</span></div>
          <div><span style={{ color: '#94a3b8' }}>Splatnost: </span><span style={{ fontWeight: 600, color: invoice.status === 'overdue' ? '#dc2626' : '#334155' }}>{fmtDate(invoice.due_date)}</span></div>
        </div>

        {/* Items preview */}
        {items.length > 0 && (
          <div style={{ marginBottom: 10, borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
            {items.slice(0, 3).map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569', padding: '2px 0' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{item.description}</span>
                <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0, marginLeft: 8 }}>{fmt(item.total || (item.quantity * item.unit_price), invoice.currency)}</span>
              </div>
            ))}
            {items.length > 3 && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>+{items.length - 3} dalších položek</div>}
          </div>
        )}

        {/* Total */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 8, borderTop: '2px solid #0f172a' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>Celkem</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{fmt(invoice.total, invoice.currency)}</span>
        </div>
        {invoice.currency !== 'CZK' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
            {fmt(invoice.total_czk, 'CZK')}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', currency: '' });
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [selected, setSelected] = useState(new Set());
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [hoveredInv, setHoveredInv] = useState(null);
  const [hoverPos, setHoverPos] = useState({ top: 0, left: 0 });
  const [hoverDetail, setHoverDetail] = useState(null);
  const hoverTimer = useRef(null);
  const hoverCache = useRef({});
  const [tapPreview, setTapPreview] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const load = () => {
    setLoading(true);
    const params = {};
    if (filters.status) params.status = filters.status;
    if (filters.currency) params.currency = filters.currency;
    api.getInvoices(params).then(setInvoices).finally(() => setLoading(false));
  };

  useEffect(() => { setPage(1); load(); }, [filters]);

  const calcPreviewPos = useCallback((clientX, clientY) => {
    const previewW = 320;
    const previewH = 320;
    const gap = 16;
    let left = clientX + gap;
    if (left + previewW > window.innerWidth - 8) left = clientX - previewW - gap;
    if (left < 8) left = 8;
    let top = clientY - 20;
    if (top + previewH > window.innerHeight - 8) top = window.innerHeight - previewH - 8;
    if (top < 8) top = 8;
    return { top, left };
  }, []);

  const abortRef = useRef(null);
  const moveThrottle = useRef(0);

  const handleRowMouseEnter = useCallback((inv, e) => {
    setHoverPos(calcPreviewPos(e.clientX, e.clientY));
    setHoveredInv(inv.id);

    if (hoverCache.current[inv.id]) {
      setHoverDetail(hoverCache.current[inv.id]);
      return;
    }

    clearTimeout(hoverTimer.current);
    abortRef.current?.abort();
    hoverTimer.current = setTimeout(() => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      api.getInvoice(inv.id).then(detail => {
        if (!ctrl.signal.aborted) {
          hoverCache.current[inv.id] = detail;
          setHoverDetail(detail);
        }
      }).catch(() => {});
    }, 300);
  }, [calcPreviewPos]);

  const handleRowMouseMove = useCallback((e) => {
    const now = Date.now();
    if (now - moveThrottle.current < 32) return;
    moveThrottle.current = now;
    setHoverPos(calcPreviewPos(e.clientX, e.clientY));
  }, [calcPreviewPos]);

  const handleRowMouseLeave = useCallback(() => {
    clearTimeout(hoverTimer.current);
    abortRef.current?.abort();
    setHoveredInv(null);
    setHoverDetail(null);
  }, []);

  const handleRowTap = useCallback((inv) => {
    if (!isTouchDevice()) return;
    if (hoverCache.current[inv.id]) {
      setTapPreview(hoverCache.current[inv.id]);
      return;
    }
    api.getInvoice(inv.id).then(detail => {
      hoverCache.current[inv.id] = detail;
      setTapPreview(detail);
    }).catch(() => {});
  }, []);

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
    const ok = await confirm({ title: 'Smazat fakturu', message: 'Opravdu chcete smazat tuto fakturu? Tato akce je nevratná.', type: 'danger', confirmText: 'Smazat', cancelText: 'Zrušit' });
    if (!ok) return;
    const prev = invoices;
    setInvoices(inv => inv.filter(i => i.id !== id));
    toast.success('Faktura byla smazána');
    try {
      await api.deleteInvoice(id);
    } catch (e) { setInvoices(prev); toast.error('Smazání selhalo: ' + e.message); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '1rem' }}>
        <a href="/api/export/invoices" className="btn btn-outline btn-sm" download>CSV Export</a>
        {can('admin', 'accountant') && (
          <Link to="/invoices/new" className="btn btn-primary">+ Nová faktura</Link>
        )}
      </div>

      {selected.size > 0 && can('admin', 'accountant', 'manager') && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center', background: '#eff6ff', padding: '0.5rem 1rem', borderRadius: 'var(--radius)' }}>
          <strong style={{ fontSize: '0.85rem' }}>{selected.size} vybráno</strong>
          <button className="btn btn-sm btn-outline" onClick={async () => { const ids = [...selected]; const prev = invoices; setInvoices(inv => inv.map(i => ids.includes(i.id) ? { ...i, status: 'sent' } : i)); toast.success(`${ids.length} faktur označeno jako odesláno`); setSelected(new Set()); try { await api.bulkStatus(ids, 'sent'); } catch (e) { setInvoices(prev); toast.error(e.message); } }}>Odeslat</button>
          <button className="btn btn-sm btn-success" onClick={async () => { const ids = [...selected]; const prev = invoices; setInvoices(inv => inv.map(i => ids.includes(i.id) ? { ...i, status: 'paid' } : i)); toast.success(`${ids.length} faktur označeno jako zaplaceno`); setSelected(new Set()); try { await api.bulkStatus(ids, 'paid'); } catch (e) { setInvoices(prev); toast.error(e.message); } }}>Zaplaceno</button>
          <button className="btn btn-sm btn-warning" onClick={async () => { const ids = [...selected]; const prev = invoices; setInvoices(inv => inv.map(i => ids.includes(i.id) ? { ...i, status: 'cancelled' } : i)); setSelected(new Set()); try { await api.bulkStatus(ids, 'cancelled'); } catch (e) { setInvoices(prev); toast.error(e.message); } }}>Zrušit</button>
          <button className="btn btn-sm btn-outline" onClick={() => setSelected(new Set())}>Zrušit výběr</button>
        </div>
      )}

      <button className="mobile-filter-toggle" onClick={() => setFiltersOpen(f => !f)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
        Filtry a řazení {(filters.status || filters.currency) ? `(aktivní)` : ''}
        <span style={{ marginLeft: 'auto' }}>{filtersOpen ? '▲' : '▼'}</span>
      </button>
      <div className={`filters filters-collapsible ${filtersOpen ? 'filters-open' : ''}`} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
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

      {loading ? <SkeletonTable rows={6} cols={8} /> : sorted.length === 0 ? (
        <div className="card"><EmptyState type="invoices" title="Žádné faktury" description="Zatím nemáte žádné faktury. Vytvořte první fakturu a začněte fakturovat." action={can('admin', 'accountant') ? () => navigate('/invoices/new') : undefined} actionLabel="+ Nová faktura" /></div>
      ) : (
      <div className="card">
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 32 }}><input type="checkbox" onChange={e => { if (e.target.checked) setSelected(new Set(sorted.slice((page - 1) * perPage, page * perPage).map(i => i.id))); else setSelected(new Set()); }} checked={selected.size > 0 && sorted.slice((page - 1) * perPage, page * perPage).every(i => selected.has(i.id))} /></th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('invoice_number')}>Číslo<SortIcon col="invoice_number" /></th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('client_name')}>Klient<SortIcon col="client_name" /></th>
                  <th className="hide-mobile" style={{ cursor: 'pointer' }} onClick={() => toggleSort('issue_date')}>Datum vystavení<SortIcon col="issue_date" /></th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('due_date')}>Splatnost<SortIcon col="due_date" /></th>
                  <th className="text-right" style={{ cursor: 'pointer' }} onClick={() => toggleSort('total')}>Částka<SortIcon col="total" /></th>
                  <th className="hide-mobile">Měna</th>
                  <th className="text-right hide-mobile" style={{ cursor: 'pointer' }} onClick={() => toggleSort('total_czk')}>CZK<SortIcon col="total_czk" /></th>
                  <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('status')}>Stav<SortIcon col="status" /></th>
                  <th>Akce</th>
                </tr>
              </thead>
              <tbody>
                {sorted.slice((page - 1) * perPage, page * perPage).map(inv => (
                  <tr key={inv.id}
                    style={{ background: selected.has(inv.id) ? '#eff6ff' : '' }}
                    onMouseEnter={(e) => handleRowMouseEnter(inv, e)}
                    onMouseMove={handleRowMouseMove}
                    onMouseLeave={handleRowMouseLeave}
                    onTouchEnd={(e) => { if (e.target.closest('a, button, input')) return; handleRowTap(inv); }}
                  >
                    <td><input type="checkbox" checked={selected.has(inv.id)} onChange={e => { const s = new Set(selected); if (e.target.checked) s.add(inv.id); else s.delete(inv.id); setSelected(s); }} /></td>
                    <td><Link to={`/invoices/${inv.id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>{inv.invoice_number}</Link>{inv.invoice_type && inv.invoice_type !== 'regular' && <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 4 }}>({typeLabels[inv.invoice_type]})</span>}</td>
                    <td>{inv.client_name}</td>
                    <td className="hide-mobile">{fmtDate(inv.issue_date)}</td>
                    <td>{fmtDate(inv.due_date)}</td>
                    <td className="text-right">{fmt(inv.total, inv.currency)}</td>
                    <td className="hide-mobile">{inv.currency}</td>
                    <td className="text-right hide-mobile">{fmt(inv.total_czk, 'CZK')}</td>
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
        <Pagination total={sorted.length} page={page} perPage={perPage} onPageChange={setPage} onPerPageChange={v => { setPerPage(v); setPage(1); }} />
      </div>
      )}

      {/* Hover preview (desktop) */}
      {hoveredInv && hoverDetail && hoverDetail.id === hoveredInv && (
        <InvoiceHoverPreview invoice={hoverDetail} style={{ top: hoverPos.top, left: hoverPos.left }} />
      )}

      {/* Tap preview (mobile bottom sheet) */}
      {tapPreview && (
        <div className="tap-preview-overlay" onClick={() => setTapPreview(null)}>
          <div className="tap-preview-sheet" onClick={e => e.stopPropagation()}>
            <div className="tap-preview-handle" />
            <div style={{ padding: '0 16px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {tapPreview.invoice_type === 'credit_note' ? 'Dobropis' : tapPreview.invoice_type === 'proforma' ? 'Proforma' : 'Faktura'}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{tapPreview.invoice_number}</div>
                </div>
                <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', background: statusBg[tapPreview.status], color: statusColors[tapPreview.status] }}>
                  {statusLabels[tapPreview.status]}
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>{tapPreview.client_name || '—'}</div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 13, color: '#64748b' }}>
                <div><span>Vystaveno: </span><strong>{fmtDate(tapPreview.issue_date)}</strong></div>
                <div><span>Splatnost: </span><strong style={{ color: tapPreview.status === 'overdue' ? '#dc2626' : '#334155' }}>{fmtDate(tapPreview.due_date)}</strong></div>
              </div>
              {(tapPreview.items || []).length > 0 && (
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10, marginBottom: 10 }}>
                  {(tapPreview.items || []).slice(0, 5).map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#475569', padding: '3px 0' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>{item.description}</span>
                      <span style={{ fontWeight: 600, flexShrink: 0 }}>{fmt(item.total || (item.quantity * item.unit_price), tapPreview.currency)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 10, borderTop: '2px solid #0f172a' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#64748b' }}>Celkem</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{fmt(tapPreview.total, tapPreview.currency)}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <Link to={`/invoices/${tapPreview.id}`} className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setTapPreview(null)}>Detail</Link>
                <Link to={`/invoices/${tapPreview.id}/edit`} className="btn btn-outline btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setTapPreview(null)}>Upravit</Link>
                <button className="btn btn-outline btn-sm" style={{ flex: 0 }} onClick={() => setTapPreview(null)}>Zavřít</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
