import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../App';
import Pagination, { usePagination } from '../components/Pagination';

export default function Orders() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editOrder, setEditOrder] = useState(null);
  const [filter, setFilter] = useState({ type: '', status: '' });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);

  useEffect(() => { load(); loadClients(); loadProducts(); }, []);

  const load = async () => {
    setLoading(true);
    try { setOrders(await api.getOrders(filter)); }
    catch (e) { setError(e.message); }
    setLoading(false);
  };

  const loadClients = async () => { try { setClients(await api.getClients()); } catch {} };
  const loadProducts = async () => { try { setProducts(await api.getProducts()); } catch {} };

  useEffect(() => { setPage(1); load(); }, [filter.type, filter.status]);

  const updateStatus = async (id, status) => {
    try { await api.updateOrderStatus(id, status); load(); }
    catch (e) { setError(e.message); }
  };

  const convertToInvoice = async (id) => {
    try {
      const r = await api.convertOrderToInvoice(id);
      setSuccess('Faktura vytvořena');
      navigate(`/invoices/${r.id}`);
    } catch (e) { setError(e.message); }
  };

  const deleteOrder = async (id) => {
    if (!confirm('Smazat objednávku?')) return;
    try { await api.deleteOrder(id); load(); } catch (e) { setError(e.message); }
  };

  const statusLabels = { draft: 'Koncept', confirmed: 'Potvrzeno', in_progress: 'V realizaci', completed: 'Dokončeno', cancelled: 'Stornováno', invoiced: 'Fakturováno' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Objednávky</h2>
        {can('admin', 'accountant', 'manager') && (
          <button className="btn btn-primary" onClick={() => { setEditOrder(null); setShowForm(true); }}>+ Nová objednávka</button>
        )}
      </div>
      {error && <div className="alert alert-error" onClick={() => setError('')}>{error}</div>}
      {success && <div className="alert alert-success" onClick={() => setSuccess('')}>{success}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <select className="form-input" style={{ width: 130 }} value={filter.type} onChange={e => setFilter(f => ({ ...f, type: e.target.value }))}>
          <option value="">Všechny typy</option>
          <option value="received">Přijaté</option>
          <option value="issued">Vydané</option>
        </select>
        <select className="form-input" style={{ width: 140 }} value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
          <option value="">Všechny stavy</option>
          {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {showForm && (
        <OrderForm
          clients={clients} products={products} order={editOrder}
          onClose={() => { setShowForm(false); setEditOrder(null); }}
          onSave={() => { setShowForm(false); setEditOrder(null); load(); }}
          onError={setError}
        />
      )}

      {loading ? <p>Načítání...</p> : (
        <table className="table">
          <thead><tr><th>Číslo</th><th>Typ</th><th>Klient</th><th>Datum</th><th style={{ textAlign: 'right' }}>Celkem</th><th>Stav</th><th>Akce</th></tr></thead>
          <tbody>
            {orders.slice((page - 1) * perPage, page * perPage).map(o => (
              <tr key={o.id}>
                <td><strong>{o.order_number}</strong></td>
                <td><span className={`badge badge-${o.type === 'received' ? 'paid' : 'sent'}`}>{o.type === 'received' ? 'Přijatá' : 'Vydaná'}</span></td>
                <td>{o.client_name || '—'}</td>
                <td>{new Date(o.date).toLocaleDateString('cs')}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{o.total.toLocaleString('cs', { minimumFractionDigits: 2 })} {o.currency}</td>
                <td><span className={`badge badge-${o.status === 'completed' || o.status === 'invoiced' ? 'paid' : o.status === 'cancelled' ? 'cancelled' : o.status === 'confirmed' ? 'sent' : 'draft'}`}>
                  {statusLabels[o.status] || o.status}
                </span></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {can('admin', 'accountant', 'manager') && <>
                    {o.status === 'draft' && <button className="btn btn-sm btn-primary" onClick={() => updateStatus(o.id, 'confirmed')}>Potvrdit</button>}
                    {o.status === 'confirmed' && <button className="btn btn-sm" onClick={() => updateStatus(o.id, 'in_progress')}>Realizovat</button>}
                    {(o.status === 'confirmed' || o.status === 'in_progress' || o.status === 'completed') && can('admin', 'accountant') && (
                      <button className="btn btn-sm btn-primary" onClick={() => convertToInvoice(o.id)} style={{ marginLeft: 4 }}>Fakturovat</button>
                    )}
                    {o.status === 'in_progress' && <button className="btn btn-sm" onClick={() => updateStatus(o.id, 'completed')} style={{ marginLeft: 4 }}>Dokončit</button>}
                    {o.status === 'draft' && <>
                      <button className="btn btn-sm" onClick={() => { setEditOrder(o); setShowForm(true); }} style={{ marginLeft: 4 }}>Upravit</button>
                      {can('admin') && <button className="btn btn-sm btn-danger" onClick={() => deleteOrder(o.id)} style={{ marginLeft: 4 }}>Smazat</button>}
                    </>}
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Pagination total={orders.length} page={page} perPage={perPage} onPageChange={setPage} onPerPageChange={v => { setPerPage(v); setPage(1); }} />
    </div>
  );
}

function OrderForm({ clients, products, order, onClose, onSave, onError }) {
  const [type, setType] = useState(order?.type || 'received');
  const [clientId, setClientId] = useState(order?.client_id || '');
  const [date, setDate] = useState(order?.date || new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(order?.due_date || '');
  const [currency, setCurrency] = useState(order?.currency || 'CZK');
  const [note, setNote] = useState(order?.note || '');
  const [items, setItems] = useState(order?.items?.length ? order.items.map(i => ({ ...i })) : [{ product_id: '', description: '', quantity: 1, unit: 'ks', unit_price: 0, tax_rate: 21 }]);

  const addItem = () => setItems([...items, { product_id: '', description: '', quantity: 1, unit: 'ks', unit_price: 0, tax_rate: 21 }]);
  const removeItem = (i) => items.length > 1 && setItems(items.filter((_, j) => j !== i));
  const updateItem = (i, field, val) => setItems(items.map((it, j) => j === i ? { ...it, [field]: val } : it));

  const selectProduct = (i, productId) => {
    const p = products.find(pr => pr.id == productId);
    if (p) {
      updateItem(i, 'product_id', p.id);
      setItems(prev => prev.map((it, j) => j === i ? { ...it, product_id: p.id, description: p.name, unit: p.unit, unit_price: p.unit_price, tax_rate: p.vat_rate } : it));
    } else {
      updateItem(i, 'product_id', '');
    }
  };

  const subtotal = items.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0);
  const tax = items.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0) * ((i.tax_rate || 0) / 100), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (order) await api.updateOrder(order.id, { client_id: clientId || null, date, due_date: dueDate || null, status: order.status, currency, note, items });
      else await api.createOrder({ type, client_id: clientId || null, date, due_date: dueDate || null, currency, note, items });
      onSave();
    } catch (e) { onError(e.message); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 750 }}>
        <h3>{order ? 'Upravit objednávku' : 'Nová objednávka'}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Typ
              <select className="form-input" value={type} onChange={e => setType(e.target.value)} disabled={!!order}>
                <option value="received">Přijatá</option>
                <option value="issued">Vydaná</option>
              </select>
            </label>
            <label>Klient
              <select className="form-input" value={clientId} onChange={e => setClientId(e.target.value)}>
                <option value="">— bez klienta —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>Datum *<input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} required /></label>
            <label>Požadované dodání<input type="date" className="form-input" value={dueDate} onChange={e => setDueDate(e.target.value)} /></label>
            <label>Měna
              <select className="form-input" value={currency} onChange={e => setCurrency(e.target.value)}>
                <option>CZK</option><option>EUR</option><option>USD</option>
              </select>
            </label>
          </div>

          <h4 style={{ marginTop: 12, marginBottom: 4 }}>Položky</h4>
          <table className="table" style={{ fontSize: 13 }}>
            <thead><tr><th>Produkt</th><th>Popis</th><th>Mn.</th><th>Jed.</th><th>Cena/ks</th><th>DPH %</th><th>Celkem</th><th></th></tr></thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td>
                    <select className="form-input" value={it.product_id || ''} onChange={e => selectProduct(i, e.target.value)} style={{ minWidth: 100 }}>
                      <option value="">—</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </td>
                  <td><input className="form-input" value={it.description} onChange={e => updateItem(i, 'description', e.target.value)} required /></td>
                  <td><input type="number" step="0.01" className="form-input" value={it.quantity} onChange={e => updateItem(i, 'quantity', parseFloat(e.target.value) || 0)} style={{ width: 60 }} /></td>
                  <td><input className="form-input" value={it.unit} onChange={e => updateItem(i, 'unit', e.target.value)} style={{ width: 50 }} /></td>
                  <td><input type="number" step="0.01" className="form-input" value={it.unit_price} onChange={e => updateItem(i, 'unit_price', parseFloat(e.target.value) || 0)} style={{ width: 90 }} /></td>
                  <td><select className="form-input" value={it.tax_rate} onChange={e => updateItem(i, 'tax_rate', parseFloat(e.target.value))} style={{ width: 60 }}><option value={21}>21</option><option value={12}>12</option><option value={0}>0</option></select></td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{((it.quantity || 0) * (it.unit_price || 0)).toLocaleString('cs', { minimumFractionDigits: 2 })}</td>
                  <td><button type="button" className="btn btn-sm btn-danger" onClick={() => removeItem(i)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addItem} style={{ marginTop: 4 }}>+ Položka</button>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 12, fontSize: 14 }}>
            <span>Základ: <strong>{subtotal.toLocaleString('cs', { minimumFractionDigits: 2 })}</strong></span>
            <span>DPH: <strong>{tax.toLocaleString('cs', { minimumFractionDigits: 2 })}</strong></span>
            <span style={{ fontSize: 16 }}>Celkem: <strong>{(subtotal + tax).toLocaleString('cs', { minimumFractionDigits: 2 })} {currency}</strong></span>
          </div>

          <label style={{ marginTop: 8 }}>Poznámka<textarea className="form-input" rows={2} value={note} onChange={e => setNote(e.target.value)} /></label>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="submit" className="btn btn-primary">Uložit</button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Zrušit</button>
          </div>
        </form>
      </div>
    </div>
  );
}
