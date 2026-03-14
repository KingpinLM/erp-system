import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../api';
import { useAuth } from '../App';

const fmt = (n, cur = 'CZK') => n != null ? new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(n) : '—';
const fmtDate = (d) => { if (!d) return '—'; const p = d.slice(0,10).split('-'); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : d; };

export default function Evidence() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('expense');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [periodPreset, setPeriodPreset] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ type: 'expense', title: '', description: '', amount: '', currency: 'CZK', date: new Date().toISOString().slice(0, 10), category: '' });
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [categories, setCategories] = useState([]);
  const [showCategoryTab, setShowCategoryTab] = useState(false);
  const [categoryRules, setCategoryRules] = useState([]);
  const fileRef = useRef();
  const { can } = useAuth();

  const applyPeriodPreset = (preset) => {
    setPeriodPreset(preset);
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    switch (preset) {
      case 'today':
        { const d = now.toISOString().slice(0, 10); setDateFrom(d); setDateTo(d); break; }
      case 'week':
        { const start = new Date(now); start.setDate(now.getDate() - now.getDay() + 1); setDateFrom(start.toISOString().slice(0, 10)); setDateTo(now.toISOString().slice(0, 10)); break; }
      case 'month':
        setDateFrom(`${y}-${String(m + 1).padStart(2, '0')}-01`); setDateTo(now.toISOString().slice(0, 10)); break;
      case 'quarter':
        { const qm = Math.floor(m / 3) * 3; setDateFrom(`${y}-${String(qm + 1).padStart(2, '0')}-01`); setDateTo(now.toISOString().slice(0, 10)); break; }
      case 'year':
        setDateFrom(`${y}-01-01`); setDateTo(`${y}-12-31`); break;
      case 'last_month':
        { const lm = m === 0 ? 11 : m - 1; const ly = m === 0 ? y - 1 : y; const lastDay = new Date(ly, lm + 1, 0).getDate(); setDateFrom(`${ly}-${String(lm + 1).padStart(2, '0')}-01`); setDateTo(`${ly}-${String(lm + 1).padStart(2, '0')}-${lastDay}`); break; }
      case 'last_quarter':
        { const cq = Math.floor(m / 3); const pq = cq === 0 ? 3 : cq - 1; const pqy = cq === 0 ? y - 1 : y; const pqStart = pq * 3; const pqEnd = new Date(pqy, pqStart + 3, 0).getDate(); setDateFrom(`${pqy}-${String(pqStart + 1).padStart(2, '0')}-01`); setDateTo(`${pqy}-${String(pqStart + 3).padStart(2, '0')}-${pqEnd}`); break; }
      default:
        setDateFrom(''); setDateTo(''); break;
    }
  };

  const load = () => {
    setLoading(true);
    const params = { type: tab };
    if (categoryFilter) params.category = categoryFilter;
    if (dateFrom) params.from = dateFrom;
    if (dateTo) params.to = dateTo;
    api.getEvidence(params).then(setRecords).finally(() => setLoading(false));
    api.getCategories().then(setCategories).catch(() => {});
  };

  useEffect(load, [tab, categoryFilter, dateFrom, dateTo]);

  const loadCategoryRules = () => {
    api.getCategoryRules().then(setCategoryRules).catch(() => {});
  };

  const sorted = useMemo(() => {
    const arr = [...records];
    arr.sort((a, b) => {
      let va, vb;
      if (sortBy === 'date') { va = a.date || ''; vb = b.date || ''; }
      else if (sortBy === 'amount') { va = a.amount || 0; vb = b.amount || 0; }
      else if (sortBy === 'title') { va = (a.title || '').toLowerCase(); vb = (b.title || '').toLowerCase(); }
      else if (sortBy === 'category') { va = (a.category || '').toLowerCase(); vb = (b.category || '').toLowerCase(); }
      else if (sortBy === 'created_at') { va = a.created_at || ''; vb = b.created_at || ''; }
      else { va = a.date || ''; vb = b.date || ''; }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [records, sortBy, sortDir]);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <span style={{ opacity: 0.3 }}> ↕</span>;
    return <span> {sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const openNew = () => {
    setEditing(null);
    setForm({ type: tab, title: '', description: '', amount: '', currency: 'CZK', date: new Date().toISOString().slice(0, 10), category: '' });
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
    if (editing) await api.updateEvidence(editing.id, data);
    else await api.createEvidence(data);
    setShowModal(false);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Opravdu smazat tento záznam?')) return;
    await api.deleteEvidence(id);
    load();
  };

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadResults(null);
    try {
      const allResults = [];
      for (const file of files) {
        const results = await api.uploadEvidence(file);
        allResults.push(...results);
      }
      setUploadResults(allResults);
    } catch (e) {
      alert('Chyba: ' + e.message);
    }
    setUploading(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  };

  const saveUploadedExpense = async (item) => {
    await api.createEvidence({
      type: 'expense', title: item.title, description: '', amount: item.amount,
      currency: 'CZK', date: item.date, category: item.category || '',
      file_path: item.file_path, original_filename: item.original_filename
    });
    setUploadResults(prev => prev.filter(r => r !== item));
    load();
  };

  const deleteRule = async (id) => {
    await api.deleteCategoryRule(id);
    loadCategoryRules();
  };

  const total = records.reduce((s, r) => s + (r.amount || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '1rem' }}>
        <a href="/api/export/evidence" className="btn btn-outline btn-sm" download>CSV Export</a>
        {can('admin', 'accountant', 'manager') && (
          <button className="btn btn-primary" onClick={openNew}>+ Nový záznam</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button className={`btn ${tab === 'expense' ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setTab('expense'); setShowCategoryTab(false); }}>Výdaje</button>
        <button className={`btn ${tab === 'income' ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setTab('income'); setShowCategoryTab(false); }}>Příjmy</button>
        {tab === 'expense' && (
          <button className={`btn ${showCategoryTab ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setShowCategoryTab(!showCategoryTab); if (!showCategoryTab) loadCategoryRules(); }} style={{ marginLeft: 'auto' }}>Kategorie</button>
        )}
      </div>

      {showCategoryTab ? (
        <div className="card">
          <div className="card-title" style={{ marginBottom: '1rem' }}>Naučené kategorie</div>
          <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>
            Systém se učí kategorizovat výdaje podle klíčových slov z názvů. Čím vyšší váha, tím silnější pravidlo.
          </p>
          {categoryRules.length === 0 ? (
            <div className="empty-state">Zatím žádná pravidla. Přiřazujte kategorie k výdajům a systém se bude učit.</div>
          ) : (
            <div className="table-responsive">
              <table>
                <thead><tr><th>Klíčové slovo</th><th>Kategorie</th><th className="text-right">Váha</th><th>Akce</th></tr></thead>
                <tbody>
                  {categoryRules.map(r => (
                    <tr key={r.id}>
                      <td><code style={{ background: 'var(--gray-50)', padding: '2px 6px', borderRadius: 4 }}>{r.keyword}</code></td>
                      <td><span className="badge">{r.category}</span></td>
                      <td className="text-right">{r.weight}</td>
                      <td>{can('admin') && <button className="btn btn-danger btn-sm" onClick={() => deleteRule(r.id)}>Smazat</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <>
          {tab === 'expense' && can('admin', 'accountant', 'manager') && (
            <div className="card"
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              style={{
                border: dragOver ? '2px dashed var(--primary)' : '2px dashed var(--gray-300)',
                background: dragOver ? 'rgba(67,97,238,0.05)' : 'transparent',
                textAlign: 'center', padding: '2rem', cursor: 'pointer', transition: 'all 0.2s'
              }}
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept=".pdf,.zip" multiple style={{ display: 'none' }} onChange={(e) => handleUpload(e.target.files)} />
              {uploading ? <div className="loading">Zpracovávám soubory...</div> : (
                <>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Přetáhněte PDF nebo ZIP soubory sem</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>nebo klikněte pro výběr souborů</div>
                </>
              )}
            </div>
          )}

          {uploadResults && uploadResults.length > 0 && (
            <div className="card" style={{ marginTop: '1rem' }}>
              <div className="card-title" style={{ marginBottom: '1rem' }}>Extrahované výdaje ({uploadResults.length})</div>
              {uploadResults.map((item, idx) => (
                <div key={idx} style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', padding: '1rem', marginBottom: '0.75rem' }}>
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 2 }}>
                      <label className="form-label">Název</label>
                      <input className="form-input" value={item.title} onChange={e => { const u = [...uploadResults]; u[idx] = { ...u[idx], title: e.target.value }; setUploadResults(u); }} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Částka</label>
                      <input className="form-input" type="number" step="0.01" value={item.amount || ''} onChange={e => { const u = [...uploadResults]; u[idx] = { ...u[idx], amount: parseFloat(e.target.value) || null }; setUploadResults(u); }} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Datum</label>
                      <input className="form-input" type="date" value={item.date} onChange={e => { const u = [...uploadResults]; u[idx] = { ...u[idx], date: e.target.value }; setUploadResults(u); }} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Kategorie</label>
                      <input className="form-input" value={item.category || ''} onChange={e => { const u = [...uploadResults]; u[idx] = { ...u[idx], category: e.target.value }; setUploadResults(u); }} list="cat-list" />
                    </div>
                  </div>
                  {item.original_filename && <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginBottom: '0.5rem' }}>Soubor: {item.original_filename}</div>}
                  <div className="btn-group">
                    <button className="btn btn-success btn-sm" onClick={() => saveUploadedExpense(item)}>Uložit výdaj</button>
                    <button className="btn btn-outline btn-sm" onClick={() => setUploadResults(prev => prev.filter((_, i) => i !== idx))}>Zrušit</button>
                  </div>
                </div>
              ))}
              <datalist id="cat-list">{categories.map(c => <option key={c} value={c} />)}</datalist>
            </div>
          )}

          <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginTop: '1rem' }}>
            <div className="kpi-card">
              <div className="kpi-label">Celkem {tab === 'expense' ? 'výdajů' : 'příjmů'}</div>
              <div className={`kpi-value ${tab === 'expense' ? 'danger' : 'success'}`}>{fmt(total)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Počet záznamů</div>
              <div className="kpi-value">{records.length}</div>
            </div>
          </div>

          {/* Period filter */}
          <div className="card" style={{ marginTop: '1rem', padding: '0.75rem 1rem' }}>
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: dateFrom || dateTo ? '0.75rem' : 0 }}>
              {[
                { key: '', label: 'Vše' },
                { key: 'today', label: 'Dnes' },
                { key: 'week', label: 'Tento týden' },
                { key: 'month', label: 'Tento měsíc' },
                { key: 'last_month', label: 'Minulý měsíc' },
                { key: 'quarter', label: 'Toto čtvrtletí' },
                { key: 'last_quarter', label: 'Minulé čtvrtletí' },
                { key: 'year', label: 'Tento rok' },
                { key: 'custom', label: 'Vlastní' },
              ].map(p => (
                <button key={p.key} className={`btn btn-sm ${periodPreset === p.key || (p.key === '' && !periodPreset) ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => { if (p.key === 'custom') { setPeriodPreset('custom'); } else { applyPeriodPreset(p.key); } }}
                  style={{ transition: 'all 0.15s ease' }}
                >{p.label}</button>
              ))}
            </div>
            {(periodPreset === 'custom' || dateFrom || dateTo) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Od</label>
                  <input type="date" className="form-input" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPeriodPreset('custom'); }}
                    style={{ width: 'auto', fontSize: '0.8rem', padding: '0.35rem 0.5rem' }} />
                </div>
                <span style={{ color: 'var(--gray-300)', fontSize: '1rem' }}>—</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Do</label>
                  <input type="date" className="form-input" value={dateTo} onChange={e => { setDateTo(e.target.value); setPeriodPreset('custom'); }}
                    style={{ width: 'auto', fontSize: '0.8rem', padding: '0.35rem 0.5rem' }} />
                </div>
                {(dateFrom || dateTo) && (
                  <button className="btn btn-outline btn-sm" onClick={() => applyPeriodPreset('')} style={{ fontSize: '0.75rem' }}>Zrušit filtr</button>
                )}
              </div>
            )}
          </div>

          <div className="filters" style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="form-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="">Všechny kategorie</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="form-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="date">Řadit dle data</option>
              <option value="created_at">Řadit dle vytvoření</option>
              <option value="amount">Řadit dle částky</option>
              <option value="title">Řadit dle názvu</option>
              <option value="category">Řadit dle kategorie</option>
            </select>
            <button className="btn btn-outline btn-sm" onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
              {sortDir === 'desc' ? '↓ Sestupně' : '↑ Vzestupně'}
            </button>
          </div>

          <div className="card">
            {loading ? <div className="loading">Načítání...</div> : sorted.length === 0 ? <div className="empty-state">Žádné záznamy</div> : (
              <div className="table-responsive">
                <table>
                  <thead><tr>
                    <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('title')}>Název<SortIcon col="title" /></th>
                    <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('category')}>Kategorie<SortIcon col="category" /></th>
                    <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('date')}>Datum<SortIcon col="date" /></th>
                    <th className="text-right" style={{ cursor: 'pointer' }} onClick={() => toggleSort('amount')}>Částka<SortIcon col="amount" /></th>
                    <th>Měna</th><th>Vytvořil</th><th>Akce</th>
                  </tr></thead>
                  <tbody>
                    {sorted.map(r => (
                      <tr key={r.id}>
                        <td><strong>{r.title}</strong>{r.description && <div className="text-muted" style={{ fontSize: '0.8rem' }}>{r.description}</div>}</td>
                        <td>{r.category ? <span className="badge">{r.category}</span> : '—'}</td>
                        <td>{fmtDate(r.date)}</td>
                        <td className="text-right" style={{ fontWeight: 600, color: tab === 'income' ? 'var(--success)' : 'var(--danger)' }}>{fmt(r.amount, r.currency)}</td>
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
        </>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editing ? 'Upravit záznam' : `Nový ${tab === 'expense' ? 'výdaj' : 'příjem'}`}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
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
              <div className="form-group">
                <label className="form-label">Kategorie</label>
                <input className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="např. Služby, Materiál, Nájemné..." list="modal-cat-list" />
                <datalist id="modal-cat-list">{categories.map(c => <option key={c} value={c} />)}</datalist>
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
