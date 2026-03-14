import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../App';
import Pagination, { usePagination } from '../components/Pagination';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { SkeletonTable } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

const isTouchDevice = () => window.matchMedia('(hover: none) and (pointer: coarse)').matches;

const fmt = (n, cur = 'CZK') => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(n);
const fmtDate = (d) => { if (!d) return '—'; const p = d.slice(0,10).split('-'); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : d; };
const statusLabels = { draft: 'Koncept', sent: 'Odesláno', paid: 'Zaplaceno', overdue: 'Po splatnosti', cancelled: 'Zrušeno' };
const statusColors = { draft: '#64748b', sent: '#4f46e5', paid: '#059669', overdue: '#dc2626', cancelled: '#d97706' };
const statusBg = { draft: '#f1f5f9', sent: '#eef2ff', paid: '#ecfdf5', overdue: '#fef2f2', cancelled: '#fffbeb' };

function ClientHoverPreview({ client, invoices, style }) {
  if (!client) return null;
  const totalInvoiced = (invoices || []).reduce((s, i) => s + (i.total_czk || 0), 0);
  const totalPaid = (invoices || []).filter(i => i.status === 'paid').reduce((s, i) => s + (i.total_czk || 0), 0);
  const unpaidCount = (invoices || []).filter(i => ['sent', 'overdue'].includes(i.status)).length;
  return (
    <div className="hover-preview-mobile-hide" style={{
      position: 'fixed', zIndex: 9999, pointerEvents: 'none',
      width: Math.min(300, window.innerWidth - 32), background: 'white', borderRadius: 12,
      border: '1px solid #e2e8f0', boxShadow: '0 20px 50px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.08)',
      overflow: 'hidden', animation: 'fadeIn 0.12s ease-out',
      ...style,
    }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Klient</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>{client.name}</div>
      </div>

      <div style={{ padding: '10px 16px' }}>
        {/* IČO / DIČ */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
          {client.ico && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>IČO</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', fontFamily: 'monospace' }}>{client.ico}</div>
            </div>
          )}
          {client.dic && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>DIČ</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', fontFamily: 'monospace' }}>{client.dic}</div>
            </div>
          )}
        </div>

        {/* Contact */}
        {(client.email || client.phone) && (
          <div style={{ marginBottom: 8, fontSize: 12, color: '#64748b' }}>
            {client.email && <div>{client.email}</div>}
            {client.phone && <div>{client.phone}</div>}
          </div>
        )}

        {/* Address */}
        {(client.address || client.city) && (
          <div style={{ marginBottom: 10, fontSize: 12, color: '#64748b' }}>
            {client.address}{client.address && client.city ? ', ' : ''}{client.city}{client.zip ? ` ${client.zip}` : ''}
          </div>
        )}

        {/* Stats */}
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Fakturováno</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{fmt(totalInvoiced)}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Zaplaceno</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#059669' }}>{fmt(totalPaid)}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Faktur celkem</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{(invoices || []).length}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Neuhrazené</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: unpaidCount > 0 ? '#dc2626' : '#0f172a' }}>{unpaidCount}</div>
          </div>
        </div>

        {/* Recent invoices */}
        {(invoices || []).length > 0 && (
          <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 8, paddingTop: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Poslední faktury</div>
            {(invoices || []).slice(0, 3).map(inv => (
              <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{inv.invoice_number}</span>
                <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: statusBg[inv.status], color: statusColors[inv.status] }}>
                  {statusLabels[inv.status]}
                </span>
                <span style={{ color: '#64748b', fontWeight: 600 }}>{fmt(inv.total || 0, inv.currency || 'CZK')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', ico: '', dic: '', email: '', phone: '', address: '', city: '', zip: '', country: 'CZ' });
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [duplicateWarnings, setDuplicateWarnings] = useState([]);
  const [error, setError] = useState('');
  const [clientTouched, setClientTouched] = useState({});
  const dupTimerRef = React.useRef(null);
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const markClientTouched = (f) => setClientTouched(t => ({ ...t, [f]: true }));
  const clientErrors = {};
  if (!form.name?.trim()) clientErrors.name = 'Název je povinný';
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) clientErrors.email = 'Neplatný formát e-mailu';
  if (form.ico && !/^\d{7,8}$/.test(form.ico)) clientErrors.ico = 'IČO musí mít 7-8 číslic';
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [tapPreview, setTapPreview] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Hover preview state
  const [hoveredId, setHoveredId] = useState(null);
  const [hoverPos, setHoverPos] = useState({ top: 0, left: 0 });
  const [hoverDetail, setHoverDetail] = useState(null);
  const hoverTimer = useRef(null);
  const hoverCache = useRef({});
  const abortRef = useRef(null);
  const moveThrottle = useRef(0);

  const calcPreviewPos = useCallback((clientX, clientY) => {
    const pw = 300, ph = 360, gap = 16;
    let left = clientX + gap;
    if (left + pw > window.innerWidth - 8) left = clientX - pw - gap;
    if (left < 8) left = 8;
    let top = clientY - 20;
    if (top + ph > window.innerHeight - 8) top = window.innerHeight - ph - 8;
    if (top < 8) top = 8;
    return { top, left };
  }, []);

  const handleRowMouseEnter = useCallback((c, e) => {
    setHoverPos(calcPreviewPos(e.clientX, e.clientY));
    setHoveredId(c.id);
    if (hoverCache.current[c.id]) {
      setHoverDetail(hoverCache.current[c.id]);
      return;
    }
    // Use client data already in memory, only fetch invoices
    clearTimeout(hoverTimer.current);
    abortRef.current?.abort();
    hoverTimer.current = setTimeout(() => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      api.getClientInvoices(c.id)
        .then(invoices => {
          if (!ctrl.signal.aborted) {
            const detail = { client: c, invoices };
            hoverCache.current[c.id] = detail;
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
    setHoveredId(null);
    setHoverDetail(null);
  }, []);

  const handleRowTap = useCallback((c) => {
    if (!isTouchDevice()) return;
    if (hoverCache.current[c.id]) {
      setTapPreview(hoverCache.current[c.id]);
      return;
    }
    api.getClientInvoices(c.id)
      .then(invoices => {
        const detail = { client: c, invoices };
        hoverCache.current[c.id] = detail;
        setTapPreview(detail);
      }).catch(() => {});
  }, []);

  const load = () => { setLoading(true); api.getClients().then(setClients).finally(() => setLoading(false)); };
  useEffect(load, []);

  const sorted = useMemo(() => {
    const arr = [...clients];
    arr.sort((a, b) => {
      let va, vb;
      if (sortBy === 'name') { va = (a.name || '').toLowerCase(); vb = (b.name || '').toLowerCase(); }
      else if (sortBy === 'ico') { va = a.ico || ''; vb = b.ico || ''; }
      else if (sortBy === 'email') { va = (a.email || '').toLowerCase(); vb = (b.email || '').toLowerCase(); }
      else if (sortBy === 'city') { va = (a.city || '').toLowerCase(); vb = (b.city || '').toLowerCase(); }
      else if (sortBy === 'country') { va = a.country || ''; vb = b.country || ''; }
      else { va = a.created_at || ''; vb = b.created_at || ''; }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [clients, sortBy, sortDir]);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <span style={{ opacity: 0.3 }}> ↕</span>;
    return <span> {sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const checkDuplicates = (formData, excludeId) => {
    clearTimeout(dupTimerRef.current);
    dupTimerRef.current = setTimeout(async () => {
      const params = { name: formData.name, ico: formData.ico, dic: formData.dic, email: formData.email };
      if (excludeId) params.exclude_id = excludeId;
      if (!params.name && !params.ico && !params.dic && !params.email) { setDuplicateWarnings([]); return; }
      try {
        const matches = await api.checkDuplicateClient(params);
        setDuplicateWarnings(matches);
      } catch { setDuplicateWarnings([]); }
    }, 400);
  };

  const updateForm = (updates, excludeId) => {
    setForm(f => {
      const next = { ...f, ...updates };
      checkDuplicates(next, excludeId);
      return next;
    });
  };

  const openNew = () => { setEditing(null); setForm({ name: '', ico: '', dic: '', email: '', phone: '', address: '', city: '', zip: '', country: 'CZ' }); setDuplicateWarnings([]); setError(''); setClientTouched({}); setShowModal(true); };
  const openEdit = (c) => { setEditing(c); setForm({ name: c.name, ico: c.ico || '', dic: c.dic || '', email: c.email || '', phone: c.phone || '', address: c.address || '', city: c.city || '', zip: c.zip || '', country: c.country || 'CZ' }); setDuplicateWarnings([]); setError(''); setClientTouched({}); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) { await api.updateClient(editing.id, form); toast.success('Klient byl upraven'); } else { await api.createClient(form); toast.success('Klient byl vytvořen'); }
      setShowModal(false);
      load();
    } catch (err) { setError(err.message); toast.error(err.message); }
  };

  const handleDelete = async (id) => {
    const ok = await confirm({ title: 'Smazat klienta', message: 'Opravdu chcete smazat tohoto klienta? Všechny jeho faktury zůstanou zachovány.', type: 'danger', confirmText: 'Smazat' });
    if (!ok) return;
    const prev = clients;
    setClients(c => c.filter(cl => cl.id !== id));
    toast.success('Klient byl smazán');
    try { await api.deleteClient(id); }
    catch (e) { setClients(prev); toast.error('Smazání selhalo: ' + e.message); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '1rem' }}>
        <a href="/api/export/clients" className="btn btn-outline btn-sm" download>CSV Export</a>
        {can('admin', 'accountant', 'manager') && <button className="btn btn-primary" onClick={openNew}>+ Nový klient</button>}
      </div>

      <button className="mobile-filter-toggle" onClick={() => setFiltersOpen(f => !f)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
        Řazení
        <span style={{ marginLeft: 'auto' }}>{filtersOpen ? '▲' : '▼'}</span>
      </button>
      <div className={`filters filters-collapsible ${filtersOpen ? 'filters-open' : ''}`} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="form-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="name">Řadit dle názvu</option>
          <option value="ico">Řadit dle IČO</option>
          <option value="email">Řadit dle emailu</option>
          <option value="city">Řadit dle města</option>
          <option value="country">Řadit dle země</option>
          <option value="created_at">Řadit dle vytvoření</option>
        </select>
        <button className="btn btn-outline btn-sm" onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
          {sortDir === 'desc' ? '↓ Sestupně' : '↑ Vzestupně'}
        </button>
      </div>

      <div className="card">
        {loading ? <SkeletonTable rows={5} cols={7} /> : sorted.length === 0 ? <EmptyState type="clients" title="Žádní klienti" description="Přidejte prvního klienta pro začátek fakturace." action={can('admin', 'accountant', 'manager') ? openNew : undefined} actionLabel="+ Nový klient" /> : (
          <div className="table-responsive">
            <table>
              <thead><tr>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('name')}>Název<SortIcon col="name" /></th>
                <th className="hide-mobile" style={{ cursor: 'pointer' }} onClick={() => toggleSort('ico')}>IČO<SortIcon col="ico" /></th>
                <th className="hide-mobile">DIČ</th>
                <th className="hide-mobile" style={{ cursor: 'pointer' }} onClick={() => toggleSort('email')}>Email<SortIcon col="email" /></th>
                <th className="hide-mobile">Telefon</th>
                <th className="hide-mobile" style={{ cursor: 'pointer' }} onClick={() => toggleSort('city')}>Město<SortIcon col="city" /></th>
                <th className="hide-mobile" style={{ cursor: 'pointer' }} onClick={() => toggleSort('country')}>Země<SortIcon col="country" /></th>
                <th>Akce</th>
              </tr></thead>
              <tbody>
                {sorted.slice((page - 1) * perPage, page * perPage).map(c => (
                  <tr key={c.id}
                    onMouseEnter={(e) => handleRowMouseEnter(c, e)}
                    onMouseMove={handleRowMouseMove}
                    onMouseLeave={handleRowMouseLeave}
                    onTouchEnd={(e) => { if (e.target.closest('a, button, input')) return; handleRowTap(c); }}
                  >
                    <td><Link to={`/clients/${c.id}`} style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>{c.name}</Link></td>
                    <td className="hide-mobile">{c.ico || '—'}</td>
                    <td className="hide-mobile">{c.dic || '—'}</td>
                    <td className="hide-mobile">{c.email || '—'}</td>
                    <td className="hide-mobile">{c.phone || '—'}</td>
                    <td className="hide-mobile">{c.city || '—'}</td>
                    <td className="hide-mobile">{c.country}</td>
                    <td>
                      <div className="btn-group">
                        {can('admin', 'accountant', 'manager') && <button className="btn btn-outline btn-sm" onClick={() => openEdit(c)}>Upravit</button>}
                        {can('admin') && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>Smazat</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination total={sorted.length} page={page} perPage={perPage} onPageChange={setPage} onPerPageChange={v => { setPerPage(v); setPage(1); }} />
      </div>

      {/* Hover preview */}
      {hoveredId && hoverDetail && hoverDetail.client?.id === hoveredId && (
        <ClientHoverPreview client={hoverDetail.client} invoices={hoverDetail.invoices} style={{ top: hoverPos.top, left: hoverPos.left }} />
      )}

      {/* Tap preview (mobile bottom sheet) */}
      {tapPreview && (
        <div className="tap-preview-overlay" onClick={() => setTapPreview(null)}>
          <div className="tap-preview-sheet" onClick={e => e.stopPropagation()}>
            <div className="tap-preview-handle" />
            <div style={{ padding: '0 16px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Klient</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>{tapPreview.client?.name}</div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                {tapPreview.client?.ico && <div><div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>IČO</div><div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'monospace' }}>{tapPreview.client.ico}</div></div>}
                {tapPreview.client?.dic && <div><div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>DIČ</div><div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'monospace' }}>{tapPreview.client.dic}</div></div>}
              </div>
              {(tapPreview.client?.email || tapPreview.client?.phone) && (
                <div style={{ marginBottom: 10, fontSize: 13, color: '#64748b' }}>
                  {tapPreview.client.email && <div>{tapPreview.client.email}</div>}
                  {tapPreview.client.phone && <div>{tapPreview.client.phone}</div>}
                </div>
              )}
              {(tapPreview.client?.address || tapPreview.client?.city) && (
                <div style={{ marginBottom: 12, fontSize: 13, color: '#64748b' }}>
                  {tapPreview.client.address}{tapPreview.client.address && tapPreview.client.city ? ', ' : ''}{tapPreview.client.city}{tapPreview.client.zip ? ` ${tapPreview.client.zip}` : ''}
                </div>
              )}
              {(tapPreview.invoices || []).length > 0 && (
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                    <div><div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Fakturováno</div><div style={{ fontSize: 15, fontWeight: 700 }}>{fmt((tapPreview.invoices || []).reduce((s, i) => s + (i.total_czk || 0), 0))}</div></div>
                    <div><div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Zaplaceno</div><div style={{ fontSize: 15, fontWeight: 700, color: '#059669' }}>{fmt((tapPreview.invoices || []).filter(i => i.status === 'paid').reduce((s, i) => s + (i.total_czk || 0), 0))}</div></div>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Poslední faktury</div>
                  {(tapPreview.invoices || []).slice(0, 3).map(inv => (
                    <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 13 }}>
                      <span style={{ fontWeight: 600 }}>{inv.invoice_number}</span>
                      <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: statusBg[inv.status], color: statusColors[inv.status] }}>{statusLabels[inv.status]}</span>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>{fmt(inv.total || 0, inv.currency || 'CZK')}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <Link to={`/clients/${tapPreview.client?.id}`} className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setTapPreview(null)}>Detail</Link>
                <button className="btn btn-outline btn-sm" style={{ flex: 0 }} onClick={() => setTapPreview(null)}>Zavřít</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editing ? 'Upravit klienta' : 'Nový klient'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              {error && (
                <div className="alert alert-error" style={{ marginBottom: '0.75rem' }} onClick={() => setError('')}>{error}</div>
              )}
              {duplicateWarnings.length > 0 && (
                <div style={{ marginBottom: '0.75rem', padding: '0.6rem 0.75rem', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 'var(--radius)', fontSize: '0.82rem', color: '#92400e' }}>
                  <strong style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    Možný duplicitní klient
                  </strong>
                  {duplicateWarnings.map(d => {
                    const matchLabels = { name: 'název', ico: 'IČO', dic: 'DIČ', email: 'email' };
                    return <div key={d.id}>Shoda v poli <strong>{matchLabels[d.match] || d.match}</strong>: {d.name}{d.ico ? ` (IČO: ${d.ico})` : ''}</div>;
                  })}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Název firmy *</label>
                <input className={`form-input ${clientTouched.name && clientErrors.name ? 'is-invalid' : ''}`} value={form.name} onChange={e => updateForm({ name: e.target.value }, editing?.id)} onBlur={() => markClientTouched('name')} required />
                {clientTouched.name && clientErrors.name && <div className="field-error">{clientErrors.name}</div>}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">IČO</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input className={`form-input ${clientTouched.ico && clientErrors.ico ? 'is-invalid' : ''}`} value={form.ico} onChange={e => updateForm({ ico: e.target.value }, editing?.id)} onBlur={() => markClientTouched('ico')} />
                    <button type="button" className="btn btn-outline btn-sm" style={{ whiteSpace: 'nowrap' }} onClick={async () => {
                      if (!form.ico) return;
                      try {
                        const data = await api.aresLookup(form.ico);
                        const updates = { name: data.name || form.name, dic: data.dic || form.dic, address: data.address || form.address, city: data.city || form.city, zip: data.zip || form.zip, country: data.country || form.country };
                        updateForm(updates, editing?.id);
                      } catch (e) { toast.error(e.message); }
                    }}>ARES</button>
                  </div>
                  {clientTouched.ico && clientErrors.ico && <div className="field-error">{clientErrors.ico}</div>}
                </div>
                <div className="form-group"><label className="form-label">DIČ</label><input className="form-input" value={form.dic} onChange={e => updateForm({ dic: e.target.value }, editing?.id)} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Email</label><input className={`form-input ${clientTouched.email && clientErrors.email ? 'is-invalid' : ''}`} type="email" value={form.email} onChange={e => updateForm({ email: e.target.value }, editing?.id)} onBlur={() => markClientTouched('email')} />{clientTouched.email && clientErrors.email && <div className="field-error">{clientErrors.email}</div>}</div>
                <div className="form-group"><label className="form-label">Telefon</label><input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              </div>
              <div className="form-group"><label className="form-label">Adresa</label><input className="form-input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Město</label><input className="form-input" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">PSČ</label><input className="form-input" value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Země</label><input className="form-input" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} /></div>
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
