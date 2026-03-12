import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../App';

const statusLabels = { draft: 'Koncept', sent: 'Odesláno', paid: 'Zaplaceno', overdue: 'Po splatnosti', cancelled: 'Zrušeno' };
const fmt = (n, cur = 'CZK') => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(n);

export default function InvoiceDetail() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const { can } = useAuth();
  const invoiceRef = useRef();

  useEffect(() => {
    Promise.all([api.getInvoice(id), api.getCompany()])
      .then(([inv, comp]) => { setInvoice(inv); setCompany(comp); })
      .finally(() => setLoading(false));
  }, [id]);

  const changeStatus = async (status) => {
    const paid_date = status === 'paid' ? new Date().toISOString().slice(0, 10) : undefined;
    await api.updateInvoiceStatus(id, status, paid_date);
    setInvoice(prev => ({ ...prev, status, paid_date: paid_date || prev.paid_date }));
  };

  const downloadPDF = () => {
    const content = invoiceRef.current;
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${invoice.invoice_number}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; padding: 0; }
      .invoice-pdf { max-width: 800px; margin: 0 auto; padding: 40px; }
      .inv-gradient-bar { height: 6px; background: linear-gradient(90deg, #ff6b6b, #ffa500, #ffd93d, #6bcb77, #4d96ff, #9b59b6); border-radius: 3px; margin-bottom: 32px; }
      .inv-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
      .inv-company-name { font-size: 24px; font-weight: 800; color: #1a1a2e; margin-bottom: 4px; }
      .inv-company-details { font-size: 12px; color: #64748b; line-height: 1.6; }
      .inv-title { font-size: 36px; font-weight: 800; color: #1a1a2e; text-align: right; letter-spacing: -1px; }
      .inv-number { font-size: 14px; color: #64748b; text-align: right; margin-top: 4px; }
      .inv-status { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-top: 8px; }
      .inv-status-draft { background: #e2e8f0; color: #475569; }
      .inv-status-sent { background: #dbeafe; color: #1d4ed8; }
      .inv-status-paid { background: #d1fae5; color: #059669; }
      .inv-status-overdue { background: #fee2e2; color: #dc2626; }
      .inv-status-cancelled { background: #fef3c7; color: #d97706; }
      .inv-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 32px; }
      .inv-party-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #9ca3af; font-weight: 700; margin-bottom: 8px; }
      .inv-party-name { font-size: 16px; font-weight: 700; color: #1a1a2e; margin-bottom: 4px; }
      .inv-party-info { font-size: 12px; color: #64748b; line-height: 1.6; }
      .inv-meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; padding: 20px; background: #f8f9fa; border-radius: 10px; }
      .inv-meta-item label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #9ca3af; font-weight: 700; margin-bottom: 4px; }
      .inv-meta-item span { font-size: 14px; font-weight: 600; color: #1a1a2e; }
      .inv-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
      .inv-table thead th { text-align: left; padding: 12px 16px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #9ca3af; font-weight: 700; border-bottom: 2px solid #e2e8f0; }
      .inv-table thead th.right { text-align: right; }
      .inv-table tbody td { padding: 14px 16px; font-size: 13px; color: #334155; border-bottom: 1px solid #f1f5f9; }
      .inv-table tbody td.right { text-align: right; font-variant-numeric: tabular-nums; }
      .inv-table tbody tr:last-child td { border-bottom: 2px solid #e2e8f0; }
      .inv-totals { display: flex; justify-content: flex-end; margin-bottom: 32px; }
      .inv-totals-box { width: 280px; }
      .inv-totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; color: #64748b; }
      .inv-totals-row span:last-child { font-variant-numeric: tabular-nums; }
      .inv-totals-total { display: flex; justify-content: space-between; padding: 14px 0; font-size: 20px; font-weight: 800; color: #1a1a2e; border-top: 3px solid #1a1a2e; margin-top: 4px; }
      .inv-totals-czk { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; color: #9ca3af; }
      .inv-note { padding: 16px 20px; background: #f8f9fa; border-radius: 10px; margin-bottom: 24px; }
      .inv-note-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #9ca3af; font-weight: 700; margin-bottom: 6px; }
      .inv-note-text { font-size: 13px; color: #64748b; line-height: 1.5; }
      .inv-footer { text-align: center; padding-top: 24px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #9ca3af; }
      .inv-gradient-bar-bottom { height: 4px; background: linear-gradient(90deg, #ff6b6b, #ffa500, #ffd93d, #6bcb77, #4d96ff, #9b59b6); border-radius: 2px; margin-top: 24px; }
      @media print { body { padding: 0; } .invoice-pdf { padding: 20px; } }
    </style>
    </head><body>${content.innerHTML}
    <script>window.onload=function(){window.print();}<\/script>
    </body></html>`);
    win.document.close();
  };

  if (loading) return <div className="loading">Načítání...</div>;
  if (!invoice) return <div className="empty-state">Faktura nenalezena</div>;

  const companyName = company?.name || 'Rainbow Family Investment';

  return (
    <div>
      <div className="page-header">
        <div>
          <Link to="/invoices" className="btn btn-outline btn-sm" style={{ marginBottom: '0.5rem' }}>← Zpět na seznam</Link>
          <h1 className="page-title">{invoice.invoice_number}</h1>
        </div>
        <div className="btn-group">
          <button className="btn btn-primary" onClick={downloadPDF}>⬇ Stáhnout PDF</button>
          {can('admin', 'accountant') && (
            <Link to={`/invoices/${id}/edit`} className="btn btn-outline">Upravit</Link>
          )}
          {can('admin', 'accountant', 'manager') && invoice.status === 'draft' && (
            <button className="btn btn-success" onClick={() => changeStatus('sent')}>Odeslat</button>
          )}
          {can('admin', 'accountant', 'manager') && invoice.status === 'sent' && (
            <button className="btn btn-success" onClick={() => changeStatus('paid')}>Zaplaceno</button>
          )}
          {can('admin', 'accountant', 'manager') && ['sent', 'overdue'].includes(invoice.status) && (
            <button className="btn btn-warning" onClick={() => changeStatus('cancelled')}>Zrušit</button>
          )}
        </div>
      </div>

      <div ref={invoiceRef}>
        <div className="invoice-pdf">
          <div className="inv-gradient-bar"></div>

          <div className="inv-header">
            <div>
              <div className="inv-company-name">{companyName}</div>
              <div className="inv-company-details">
                {company?.ico && <>IČO: {company.ico}<br/></>}
                {company?.dic && <>DIČ: {company.dic}<br/></>}
                {company?.address && <>{company.address}<br/></>}
                {company?.city && <>{company.city} {company?.zip}<br/></>}
                {company?.email && <>{company.email}<br/></>}
                {company?.phone && <>{company.phone}</>}
              </div>
            </div>
            <div>
              <div className="inv-title">FAKTURA</div>
              <div className="inv-number">{invoice.invoice_number}</div>
              <div style={{ textAlign: 'right' }}>
                <span className={`inv-status inv-status-${invoice.status}`}>
                  {statusLabels[invoice.status]}
                </span>
              </div>
            </div>
          </div>

          <div className="inv-parties">
            <div>
              <div className="inv-party-label">Dodavatel</div>
              <div className="inv-party-name">{companyName}</div>
              <div className="inv-party-info">
                {company?.ico && <>IČO: {company.ico}<br/></>}
                {company?.dic && <>DIČ: {company.dic}<br/></>}
                {company?.address && <>{company.address}<br/></>}
                {company?.city && <>{company.city} {company?.zip}</>}
                {company?.bank_account && <><br/>Účet: {company.bank_account}</>}
                {company?.iban && <><br/>IBAN: {company.iban}</>}
              </div>
            </div>
            <div>
              <div className="inv-party-label">Odběratel</div>
              <div className="inv-party-name">{invoice.client_name || '—'}</div>
              <div className="inv-party-info"></div>
            </div>
          </div>

          <div className="inv-meta">
            <div className="inv-meta-item">
              <label>Datum vystavení</label>
              <span>{invoice.issue_date}</span>
            </div>
            <div className="inv-meta-item">
              <label>Datum splatnosti</label>
              <span>{invoice.due_date}</span>
            </div>
            <div className="inv-meta-item">
              <label>Měna</label>
              <span>{invoice.currency}</span>
            </div>
            <div className="inv-meta-item">
              <label>{invoice.paid_date ? 'Zaplaceno' : 'Stav'}</label>
              <span>{invoice.paid_date || statusLabels[invoice.status]}</span>
            </div>
          </div>

          <table className="inv-table">
            <thead>
              <tr>
                <th>Popis</th>
                <th className="right">Množství</th>
                <th>Jednotka</th>
                <th className="right">Cena/ks</th>
                <th className="right">Celkem</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.items || []).map((item, i) => (
                <tr key={i}>
                  <td>{item.description}</td>
                  <td className="right">{item.quantity}</td>
                  <td>{item.unit}</td>
                  <td className="right">{fmt(item.unit_price, invoice.currency)}</td>
                  <td className="right">{fmt(item.total, invoice.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="inv-totals">
            <div className="inv-totals-box">
              <div className="inv-totals-row"><span>Základ</span><span>{fmt(invoice.subtotal, invoice.currency)}</span></div>
              <div className="inv-totals-row"><span>DPH {invoice.tax_rate}%</span><span>{fmt(invoice.tax_amount, invoice.currency)}</span></div>
              <div className="inv-totals-total"><span>Celkem</span><span>{fmt(invoice.total, invoice.currency)}</span></div>
              {invoice.currency !== 'CZK' && (
                <div className="inv-totals-czk"><span>Celkem v CZK</span><span>{fmt(invoice.total_czk, 'CZK')}</span></div>
              )}
            </div>
          </div>

          {invoice.note && (
            <div className="inv-note">
              <div className="inv-note-label">Poznámka</div>
              <div className="inv-note-text">{invoice.note}</div>
            </div>
          )}

          <div className="inv-footer">
            {companyName} {company?.ico && `· IČO: ${company.ico}`} {company?.dic && `· DIČ: ${company.dic}`}
          </div>
          <div className="inv-gradient-bar-bottom"></div>
        </div>
      </div>
    </div>
  );
}
