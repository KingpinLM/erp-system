import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../App';

const paymentMethods = [
  { value: 'bank_transfer', label: 'Bankovní převod' },
  { value: 'cash', label: 'Hotově' },
  { value: 'card', label: 'Kartou' },
  { value: 'other', label: 'Jiný' },
];

const vatRates = [0, 12, 21];

export default function InvoiceForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const isEdit = !!id;

  const [clients, setClients] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [products, setProducts] = useState([]);
  const [defaultDueDays, setDefaultDueDays] = useState(14);
  const [vatPayer, setVatPayer] = useState(false);
  const [hasBankDetails, setHasBankDetails] = useState(true);
  const [form, setForm] = useState({
    invoice_number: '', variable_symbol: '', client_id: '', issue_date: new Date().toISOString().slice(0, 10),
    due_date: '', supply_date: '', status: 'draft', currency: 'CZK',
    payment_method: 'bank_transfer', note: '', invoice_type: 'regular',
    items: [{ description: '', quantity: 1, unit: 'ks', unit_price: 0, tax_rate: 21 }]
  });
  const [error, setError] = useState('');
  const [draftDialog, setDraftDialog] = useState(null); // { missing: string[] }
  const [isDirty, setIsDirty] = useState(false);
  const [leaveDialog, setLeaveDialog] = useState(false);
  const savedRef = useRef(false); // track if form was saved successfully

  // Intercept in-app link clicks when form is dirty
  const pendingHref = useRef(null);
  const isDirtyRef = useRef(false);
  isDirtyRef.current = isDirty;
  useEffect(() => {
    const handler = (e) => {
      if (!isDirtyRef.current || savedRef.current) return;
      const anchor = e.target.closest('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('mailto:')) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      pendingHref.current = href;
      setLeaveDialog(true);
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);

  // Browser beforeunload guard
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  useEffect(() => {
    const promises = [api.getClients(), api.getCurrencies(), api.getCompany()];
    api.getProducts().then(p => setProducts(p)).catch(() => {});
    if (isEdit) {
      promises.push(api.getInvoice(id));
    } else {
      promises.push(api.getNextInvoiceNumber());
    }
    Promise.all(promises).then(([c, cur, comp, data]) => {
      setClients(c);
      setCurrencies(cur);
      const dueDays = comp?.default_due_days || 14;
      const isVatPayer = !!comp?.vat_payer;
      setDefaultDueDays(dueDays);
      setVatPayer(isVatPayer);
      setHasBankDetails(!!(comp?.bank_account || comp?.iban));

      if (isEdit) {
        setForm({
          invoice_number: data.invoice_number, variable_symbol: data.variable_symbol || '',
          client_id: data.client_id || '',
          issue_date: data.issue_date, due_date: data.due_date,
          supply_date: data.supply_date || data.issue_date,
          status: data.status, currency: data.currency,
          payment_method: data.payment_method || 'bank_transfer',
          note: data.note || '',
          items: data.items?.length ? data.items.map(i => ({
            description: i.description, quantity: i.quantity, unit: i.unit,
            unit_price: i.unit_price, tax_rate: i.tax_rate ?? (isVatPayer ? 21 : 0)
          })) : [{ description: '', quantity: 1, unit: 'ks', unit_price: 0, tax_rate: isVatPayer ? 21 : 0 }]
        });
      } else {
        const issueDate = new Date().toISOString().slice(0, 10);
        const due = new Date();
        due.setDate(due.getDate() + dueDays);
        setForm(f => ({
          ...f,
          invoice_number: data.number,
          variable_symbol: data.variable_symbol || '',
          supply_date: issueDate,
          due_date: due.toISOString().slice(0, 10),
          items: [{ description: '', quantity: 1, unit: 'ks', unit_price: 0, tax_rate: isVatPayer ? 21 : 0 }]
        }));
      }
    });
  }, [id]);

  const updateField = (field, value) => {
    setIsDirty(true);
    setForm(f => {
      const updated = { ...f, [field]: value };
      if (field === 'issue_date' && !isEdit) {
        const d = new Date(value);
        d.setDate(d.getDate() + defaultDueDays);
        updated.due_date = d.toISOString().slice(0, 10);
        updated.supply_date = value;
      }
      return updated;
    });
  };

  const updateItem = (idx, field, value) => {
    setIsDirty(true);
    setForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...f, items };
    });
  };
  const addItem = () => { setIsDirty(true); setForm(f => ({ ...f, items: [...f.items, { description: '', quantity: 1, unit: 'ks', unit_price: 0, tax_rate: vatPayer ? 21 : 0 }] })); };
  const removeItem = (idx) => { setIsDirty(true); setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) })); };

  const itemTotals = form.items.map(i => {
    const base = (i.quantity || 0) * (i.unit_price || 0);
    const tax = base * ((i.tax_rate ?? 0) / 100);
    return { base, tax, total: base + tax };
  });
  const subtotal = itemTotals.reduce((s, t) => s + t.base, 0);
  const totalTax = itemTotals.reduce((s, t) => s + t.tax, 0);
  const total = subtotal + totalTax;

  // Validate required fields for issuing (not draft)
  const getIssueMissing = () => {
    const missing = [];
    if (!form.variable_symbol?.trim()) missing.push('Variabilní symbol');
    if (!form.client_id) missing.push('Příjemce (klient)');
    if (total <= 0) missing.push('Nenulová částka');
    if (!hasBankDetails) missing.push('Bankovní spojení');
    if (!form.currency?.trim()) missing.push('Měna');
    return missing;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Check if invoice is complete for issuing
    const missing = getIssueMissing();
    if (missing.length > 0 && form.status !== 'draft') {
      // Force draft dialog if trying to save non-draft with missing fields
      setDraftDialog({ missing });
      return;
    }
    if (missing.length > 0 && !draftDialog) {
      // Show dialog on first submit attempt
      setDraftDialog({ missing });
      return;
    }

    await saveInvoice(form);
  };

  const saveInvoice = async (formData) => {
    setError('');
    setDraftDialog(null);
    setLeaveDialog(false);
    try {
      const data = { ...formData, client_id: formData.client_id || null };
      if (isEdit) {
        await api.updateInvoice(id, data);
      } else {
        await api.createInvoice(data);
      }
      savedRef.current = true;
      setIsDirty(false);
      navigate('/invoices');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSaveAsDraft = async () => {
    await saveInvoice({ ...form, status: 'draft' });
  };

  const fmtCur = (n) => new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2 }).format(n);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{isEdit ? 'Upravit fakturu' : 'Nová faktura'}</h1>
      </div>

      {error && <div className="login-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {!hasBankDetails && (
        <div style={{ background: '#fef2f2', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: 'var(--radius)', marginBottom: '1rem', fontSize: '0.85rem', border: '1px solid #fecaca' }}>
          Nelze vystavit fakturu bez bankovního spojení. <a href="/settings" style={{ color: '#991b1b', fontWeight: 600 }}>Vyplňte údaje v nastavení firmy →</a>
        </div>
      )}

      {!vatPayer && (
        <div style={{ background: '#fef3c7', color: '#92400e', padding: '0.75rem 1rem', borderRadius: 'var(--radius)', marginBottom: '1rem', fontSize: '0.85rem' }}>
          Společnost není plátce DPH — faktury jsou vystavovány bez DPH.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="card-title" style={{ marginBottom: '1rem' }}>Základní údaje</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Číslo faktury</label>
              <input className="form-input" value={form.invoice_number} onChange={e => updateField('invoice_number', e.target.value)}
                disabled={!can('admin')}
                style={!can('admin') ? { background: '#f1f5f9', color: '#64748b' } : {}}
              />
              {!can('admin') && <small style={{ color: 'var(--gray-500)', fontSize: '0.75rem' }}>Generováno automaticky</small>}
            </div>
            <div className="form-group">
              <label className="form-label">Variabilní symbol</label>
              <input className="form-input" value={form.variable_symbol} onChange={e => updateField('variable_symbol', e.target.value)}
                style={{ fontFamily: 'monospace', letterSpacing: 1 }}
                placeholder="Generováno automaticky"
              />
              <small style={{ color: 'var(--gray-500)', fontSize: '0.75rem' }}>Unikátní identifikátor platby</small>
            </div>
            {can('admin') && isEdit && (
              <div className="form-group">
                <label className="form-label">Stav</label>
                <select className="form-select" value={form.status} onChange={e => updateField('status', e.target.value)}>
                  <option value="draft">Koncept</option>
                  <option value="sent">Odesláno</option>
                  <option value="paid">Zaplaceno</option>
                  <option value="overdue">Po splatnosti</option>
                  <option value="cancelled">Zrušeno</option>
                </select>
              </div>
            )}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Klient</label>
              <select className="form-select" value={form.client_id} onChange={e => updateField('client_id', e.target.value)}>
                <option value="">— Vyberte klienta —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Měna</label>
              <select className="form-select" value={form.currency} onChange={e => updateField('currency', e.target.value)}>
                {currencies.map(c => <option key={c.code} value={c.code}>{c.code} - {c.name} ({c.symbol})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Způsob úhrady</label>
              <select className="form-select" value={form.payment_method} onChange={e => updateField('payment_method', e.target.value)}>
                {paymentMethods.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            {!isEdit && (
              <div className="form-group">
                <label className="form-label">Typ dokladu</label>
                <select className="form-select" value={form.invoice_type} onChange={e => updateField('invoice_type', e.target.value)}>
                  <option value="regular">Faktura</option>
                  <option value="proforma">Proforma</option>
                </select>
              </div>
            )}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Datum vystavení *</label>
              <input className="form-input" type="date" value={form.issue_date} onChange={e => updateField('issue_date', e.target.value)} required />
            </div>
            {vatPayer && (
              <div className="form-group">
                <label className="form-label">DÚZP *</label>
                <input className="form-input" type="date" value={form.supply_date} onChange={e => updateField('supply_date', e.target.value)} required />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Datum splatnosti *</label>
              <input className="form-input" type="date" value={form.due_date} onChange={e => updateField('due_date', e.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Poznámka</label>
            <textarea className="form-textarea" value={form.note} onChange={e => updateField('note', e.target.value)} />
          </div>
        </div>

        <div className="card">
          <div className="flex-between" style={{ marginBottom: '1rem' }}>
            <div className="card-title">Položky</div>
            <button type="button" className="btn btn-outline btn-sm" onClick={addItem}>+ Přidat položku</button>
          </div>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Popis</th>
                  <th style={{width:80}}>Množství</th>
                  <th style={{width:80}}>Jednotka</th>
                  <th style={{width:120}}>Cena/ks</th>
                  {vatPayer && <th style={{width:90}}>DPH</th>}
                  <th style={{width:120}} className="text-right">Celkem</th>
                  {vatPayer && <th style={{width:120}} className="text-right">S DPH</th>}
                  <th style={{width:50}}></th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      {products.length > 0 && (
                        <select className="form-input" style={{ marginBottom: 4, fontSize: 11 }} value="" onChange={e => {
                          const p = products.find(pr => pr.id == e.target.value);
                          if (p) {
                            updateItem(idx, 'description', p.name);
                            updateItem(idx, 'unit', p.unit);
                            updateItem(idx, 'unit_price', p.unit_price);
                            if (vatPayer) updateItem(idx, 'tax_rate', p.vat_rate);
                          }
                        }}>
                          <option value="">Z ceníku...</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit_price} Kč)</option>)}
                        </select>
                      )}
                      <input className="form-input" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Popis položky" />
                    </td>
                    <td><input className="form-input" type="number" step="0.01" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} /></td>
                    <td><input className="form-input" value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} /></td>
                    <td><input className="form-input" type="number" step="0.01" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} /></td>
                    {vatPayer && (
                      <td>
                        <select className="form-select" value={item.tax_rate} onChange={e => updateItem(idx, 'tax_rate', parseFloat(e.target.value))}>
                          {vatRates.map(r => <option key={r} value={r}>{r}%</option>)}
                        </select>
                      </td>
                    )}
                    <td className="text-right" style={{ fontWeight: 600 }}>{fmtCur(itemTotals[idx].base)}</td>
                    {vatPayer && <td className="text-right" style={{ fontWeight: 600 }}>{fmtCur(itemTotals[idx].total)}</td>}
                    <td>
                      {form.items.length > 1 && (
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => removeItem(idx)}>×</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="invoice-totals" style={{ marginTop: '1rem' }}>
            <div className="row"><span>Základ:</span><span>{fmtCur(subtotal)} {form.currency}</span></div>
            {vatPayer && <div className="row"><span>DPH celkem:</span><span>{fmtCur(totalTax)} {form.currency}</span></div>}
            <div className="row total"><span>Celkem:</span><span>{fmtCur(total)} {form.currency}</span></div>
          </div>
        </div>

        <div className="btn-group">
          <button type="submit" className="btn btn-primary">{isEdit ? 'Uložit změny' : 'Vytvořit fakturu'}</button>
          <button type="button" className="btn btn-outline" onClick={() => {
            if (isDirty) { setLeaveDialog(true); } else { navigate('/invoices'); }
          }}>Zrušit</button>
        </div>
      </form>

      {/* Draft validation dialog */}
      {draftDialog && (
        <div className="modal-overlay" onClick={() => setDraftDialog(null)}>
          <div className="modal draft-dialog" onClick={e => e.stopPropagation()}>
            <div className="draft-dialog-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h3 className="draft-dialog-title">Faktura bude uložena jako koncept</h3>
            <p className="draft-dialog-desc">
              Pro vystavení faktury je třeba doplnit následující údaje:
            </p>
            <ul className="draft-dialog-list">
              {draftDialog.missing.map(m => (
                <li key={m}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  {m}
                </li>
              ))}
            </ul>
            <div className="draft-dialog-buttons">
              <button className="btn btn-primary" onClick={handleSaveAsDraft}>
                Uložit jako koncept
              </button>
              <button className="btn btn-outline" onClick={() => setDraftDialog(null)}>
                Pokračovat v úpravách
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Leave confirmation dialog */}
      {leaveDialog && (
        <div className="modal-overlay" onClick={() => { setLeaveDialog(false); pendingHref.current = null; }}>
          <div className="modal draft-dialog" onClick={e => e.stopPropagation()}>
            <div className="draft-dialog-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </div>
            <h3 className="draft-dialog-title">Neuložené změny</h3>
            <p className="draft-dialog-desc">
              Máte neuložené změny ve faktuře. Chcete práci zahodit, nebo uložit fakturu jako koncept?
            </p>
            <div className="draft-dialog-buttons">
              <button className="btn btn-primary" onClick={handleSaveAsDraft}>
                Uložit jako koncept
              </button>
              <button className="btn btn-danger" onClick={() => {
                savedRef.current = true;
                setIsDirty(false);
                setLeaveDialog(false);
                navigate(pendingHref.current || '/invoices');
                pendingHref.current = null;
              }}>
                Zahodit změny
              </button>
              <button className="btn btn-outline" onClick={() => {
                setLeaveDialog(false);
                pendingHref.current = null;
              }}>
                Pokračovat v úpravách
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
