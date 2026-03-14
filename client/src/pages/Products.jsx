import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../App';
import Pagination, { usePagination } from '../components/Pagination';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';

export default function Products() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState('list');
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [stockReport, setStockReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showMovement, setShowMovement] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  useEffect(() => { setPage(1); load(); }, [tab]);

  const load = async () => {
    setLoading(true);
    try {
      if (tab === 'list') setProducts(await api.getProducts(typeFilter ? { type: typeFilter } : {}));
      else if (tab === 'movements') setMovements(await api.getStockMovements());
      else if (tab === 'report') setStockReport(await api.getStockReport());
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    data.unit_price = parseFloat(data.unit_price) || 0;
    data.purchase_price = parseFloat(data.purchase_price) || 0;
    data.vat_rate = parseFloat(data.vat_rate) || 21;
    data.stock_quantity = parseFloat(data.stock_quantity) || 0;
    data.min_stock = parseFloat(data.min_stock) || 0;
    try {
      if (editItem) await api.updateProduct(editItem.id, data);
      else await api.createProduct(data);
      setShowForm(false); setEditItem(null); load();
    } catch (e) { setError(e.message); }
  };

  const handleMovement = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    data.product_id = parseInt(data.product_id);
    data.quantity = parseFloat(data.quantity);
    data.unit_price = parseFloat(data.unit_price) || 0;
    try {
      await api.createStockMovement(data);
      setShowMovement(false); load();
    } catch (e) { setError(e.message); }
  };

  const deleteProduct = async (id) => {
    const ok = await confirm({ title: 'Smazat produkt', message: 'Opravdu chcete smazat tento produkt?', type: 'danger', confirmText: 'Smazat' }); if (!ok) return;
    try { await api.deleteProduct(id); toast.success('Produkt smazán'); load(); } catch (e) { setError(e.message); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Produkty a služby</h2>
        {can('admin', 'accountant', 'manager') && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setShowMovement(true)}>+ Pohyb</button>
            <button className="btn btn-primary" onClick={() => { setEditItem(null); setShowForm(true); }}>+ Nový</button>
          </div>
        )}
      </div>
      {error && <div className="alert alert-error" onClick={() => setError('')}>{error}</div>}

      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[['list', 'Ceník'], ['movements', 'Pohyby'], ['report', 'Sklad']].map(([k, l]) => (
          <button key={k} className={`btn ${tab === k ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {/* Product form */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{editItem ? 'Upravit' : 'Nový produkt/služba'}</h3>
            <form onSubmit={handleSave}>
              <label>Název *<input name="name" className="form-input" defaultValue={editItem?.name} required /></label>
              <div className="form-row">
                <label>SKU<input name="sku" className="form-input" defaultValue={editItem?.sku} /></label>
                <label>Typ
                  <select name="type" className="form-input" defaultValue={editItem?.type || 'service'}>
                    <option value="service">Služba</option>
                    <option value="product">Produkt</option>
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label>Jednotka<input name="unit" className="form-input" defaultValue={editItem?.unit || 'ks'} /></label>
                <label>DPH %<select name="vat_rate" className="form-input" defaultValue={editItem?.vat_rate ?? 21}><option value="21">21%</option><option value="12">12%</option><option value="0">0%</option></select></label>
              </div>
              <div className="form-row">
                <label>Prodejní cena<input name="unit_price" type="number" step="0.01" className="form-input" defaultValue={editItem?.unit_price || 0} /></label>
                <label>Nákupní cena<input name="purchase_price" type="number" step="0.01" className="form-input" defaultValue={editItem?.purchase_price || 0} /></label>
              </div>
              <div className="form-row">
                <label>Skladem<input name="stock_quantity" type="number" step="0.01" className="form-input" defaultValue={editItem?.stock_quantity || 0} /></label>
                <label>Min. zásoba<input name="min_stock" type="number" step="0.01" className="form-input" defaultValue={editItem?.min_stock || 0} /></label>
              </div>
              <label>Popis<textarea name="description" className="form-input" rows={2} defaultValue={editItem?.description} /></label>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button type="submit" className="btn btn-primary">Uložit</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Zrušit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Movement form */}
      {showMovement && (
        <div className="modal-overlay" onClick={() => setShowMovement(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Skladový pohyb</h3>
            <form onSubmit={handleMovement}>
              <label>Produkt *
                <select name="product_id" className="form-input" required>
                  <option value="">Vyberte</option>
                  {products.filter(p => p.type === 'product').map(p => <option key={p.id} value={p.id}>{p.name} ({p.stock_quantity} {p.unit})</option>)}
                </select>
              </label>
              <div className="form-row">
                <label>Typ *
                  <select name="type" className="form-input" required>
                    <option value="in">Příjem</option>
                    <option value="out">Výdej</option>
                    <option value="adjustment">Inventura</option>
                  </select>
                </label>
                <label>Množství *<input name="quantity" type="number" step="0.01" min="0.01" className="form-input" required /></label>
              </div>
              <div className="form-row">
                <label>Jednotková cena<input name="unit_price" type="number" step="0.01" className="form-input" defaultValue="0" /></label>
                <label>Datum *<input name="date" type="date" className="form-input" defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
              </div>
              <label>Poznámka<input name="note" className="form-input" /></label>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button type="submit" className="btn btn-primary">Uložit</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowMovement(false)}>Zrušit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Products list */}
      {tab === 'list' && (
        <>
          <div style={{ marginBottom: 8 }}>
            <select className="form-input" style={{ width: 120 }} value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setTimeout(load, 0); }}>
              <option value="">Vše</option>
              <option value="product">Produkty</option>
              <option value="service">Služby</option>
            </select>
          </div>
          {loading ? <p>Načítání...</p> : (
            <table className="table">
              <thead><tr><th>Název</th><th>SKU</th><th>Typ</th><th>Jednotka</th><th style={{ textAlign: 'right' }}>Cena</th><th style={{ textAlign: 'right' }}>DPH</th><th style={{ textAlign: 'right' }}>Skladem</th><th>Akce</th></tr></thead>
              <tbody>
                {products.slice((page - 1) * perPage, page * perPage).map(p => (
                  <tr key={p.id} style={{ opacity: p.active ? 1 : 0.5 }}>
                    <td><strong>{p.name}</strong>{p.description && <div style={{ fontSize: 11, color: '#64748b' }}>{p.description.slice(0, 50)}</div>}</td>
                    <td>{p.sku || '—'}</td>
                    <td><span className={`badge badge-${p.type === 'product' ? 'sent' : 'draft'}`}>{p.type === 'product' ? 'Produkt' : 'Služba'}</span></td>
                    <td>{p.unit}</td>
                    <td style={{ textAlign: 'right' }}>{p.unit_price.toLocaleString('cs', { minimumFractionDigits: 2 })} Kč</td>
                    <td style={{ textAlign: 'right' }}>{p.vat_rate}%</td>
                    <td style={{ textAlign: 'right', fontWeight: p.type === 'product' ? 600 : 400, color: p.type === 'product' && p.stock_quantity <= p.min_stock ? '#ef4444' : undefined }}>
                      {p.type === 'product' ? `${p.stock_quantity} ${p.unit}` : '—'}
                    </td>
                    <td>
                      {can('admin', 'accountant', 'manager') && <>
                        <button className="btn btn-sm" onClick={() => { setEditItem(p); setShowForm(true); }}>Upravit</button>
                        {can('admin') && <button className="btn btn-sm btn-danger" onClick={() => deleteProduct(p.id)} style={{ marginLeft: 4 }}>Smazat</button>}
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Pagination total={products.length} page={page} perPage={perPage} onPageChange={setPage} onPerPageChange={v => { setPerPage(v); setPage(1); }} />
        </>
      )}

      {/* Movements */}
      {tab === 'movements' && (
        loading ? <p>Načítání...</p> : (
          <table className="table">
            <thead><tr><th>Datum</th><th>Produkt</th><th>Typ</th><th style={{ textAlign: 'right' }}>Množství</th><th style={{ textAlign: 'right' }}>Cena/ks</th><th>Poznámka</th><th>Vytvořil</th></tr></thead>
            <tbody>
              {movements.slice((page - 1) * perPage, page * perPage).map(m => (
                <tr key={m.id}>
                  <td>{new Date(m.date).toLocaleDateString('cs')}</td>
                  <td><strong>{m.product_name}</strong>{m.sku && <span style={{ fontSize: 11, color: '#64748b' }}> ({m.sku})</span>}</td>
                  <td><span className={`badge badge-${m.type === 'in' ? 'paid' : m.type === 'out' ? 'overdue' : 'draft'}`}>
                    {m.type === 'in' ? 'Příjem' : m.type === 'out' ? 'Výdej' : 'Inventura'}
                  </span></td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: m.type === 'in' ? '#22c55e' : m.type === 'out' ? '#ef4444' : '#64748b' }}>
                    {m.type === 'in' ? '+' : m.type === 'out' ? '-' : ''}{m.quantity}
                  </td>
                  <td style={{ textAlign: 'right' }}>{m.unit_price > 0 ? m.unit_price.toLocaleString('cs', { minimumFractionDigits: 2 }) : '—'}</td>
                  <td style={{ fontSize: 12 }}>{m.note || '—'}</td>
                  <td style={{ fontSize: 12 }}>{m.created_by_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination total={movements.length} page={page} perPage={perPage} onPageChange={setPage} onPerPageChange={v => { setPerPage(v); setPage(1); }} />
      )}

      {/* Stock report */}
      {tab === 'report' && stockReport && (
        <>
          <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            <div className="kpi-card"><div className="kpi-label">Celková hodnota skladu</div><div className="kpi-value">{stockReport.totalValue.toLocaleString('cs', { minimumFractionDigits: 2 })} Kč</div></div>
            <div className="kpi-card"><div className="kpi-label">Produktů celkem</div><div className="kpi-value">{stockReport.products.length}</div></div>
            <div className="kpi-card"><div className="kpi-label" style={{ color: '#ef4444' }}>Pod minimem</div><div className="kpi-value" style={{ color: '#ef4444' }}>{stockReport.lowStock.length}</div></div>
          </div>
          {stockReport.lowStock.length > 0 && (
            <>
              <h3 style={{ color: '#ef4444', marginBottom: 8 }}>Nízké zásoby</h3>
              <table className="table">
                <thead><tr><th>Produkt</th><th>SKU</th><th style={{ textAlign: 'right' }}>Skladem</th><th style={{ textAlign: 'right' }}>Minimum</th><th style={{ textAlign: 'right' }}>Chybí</th></tr></thead>
                <tbody>
                  {stockReport.lowStock.map(p => (
                    <tr key={p.id}>
                      <td><strong>{p.name}</strong></td>
                      <td>{p.sku || '—'}</td>
                      <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{p.stock_quantity} {p.unit}</td>
                      <td style={{ textAlign: 'right' }}>{p.min_stock} {p.unit}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{(p.min_stock - p.stock_quantity).toFixed(1)} {p.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </div>
  );
}
