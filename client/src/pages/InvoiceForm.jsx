import React, { useState, useEffect } from 'react';
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
  const [defaultDueDays, setDefaultDueDays] = useState(14);
  const [vatPayer, setVatPayer] = useState(false);
  const [hasBankDetails, setHasBankDetails] = useState(true);
  const [form, setForm] = useState({
    invoice_number: '', variable_symbol: '', client_id: '', issue_date: new Date().toISOString().slice(0, 10),
    due_date: '', supply_date: '', status: 'draft', currency: 'CZK',
    payment_method: 'bank_transfer', note: '',
    items: [{ description: '', quantity: 1, unit: 'ks', unit_price: 0, tax_rate: 21 }]
  });
  const [error, setError] = useState('');

  useEffect(() => {
    const promises = [api.getClients(), api.getCurrencies(), api.getCompany()];
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
    setForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...f, items };
    });
  };
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { description: '', quantity: 1, unit: 'ks', unit_price: 0, tax_rate: vatPayer ? 21 : 0 }] }));
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const itemTotals = form.items.map(i => {
    const base = (i.quantity || 0) * (i.unit_price || 0);
    const tax = base * ((i.tax_rate ?? 0) / 100);
    return { base, tax, total: base + tax };
  });
  const subtotal = itemTotals.reduce((s, t) => s + t.base, 0);
  const totalTax = itemTotals.reduce((s, t) => s + t.tax, 0);
  const total = subtotal + totalTax;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const data = { ...form, client_id: form.client_id || null };
      if (isEdit) {
        await api.updateInvoice(id, data);
      } else {
        await api.createInvoice(data);
      }
      navigate('/invoices');
    } catch (err) {
      setError(err.message);
    }
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
                    <td><input className="form-input" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Popis položky" /></td>
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
          <button type="submit" className="btn btn-primary" disabled={!hasBankDetails}>{isEdit ? 'Uložit změny' : 'Vytvořit fakturu'}</button>
          <button type="button" className="btn btn-outline" onClick={() => navigate('/invoices')}>Zrušit</button>
        </div>
      </form>
    </div>
  );
}
