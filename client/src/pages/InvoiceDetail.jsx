import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();

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

  if (loading) return <div className="loading">Načítání...</div>;
  if (!invoice) return <div className="empty-state">Faktura nenalezena</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <Link to="/invoices" className="btn btn-outline btn-sm mb-1" style={{ marginBottom: '0.5rem' }}>← Zpět na seznam</Link>
          <h1 className="page-title">{invoice.invoice_number}</h1>
        </div>
        <div className="btn-group">
          {can('admin', 'accountant') && (
            <Link to={`/invoices/${id}/edit`} className="btn btn-primary">Upravit</Link>
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

      <div className="card">
        <div className="invoice-header">
          <div>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '0.25rem' }}>{invoice.invoice_number}</h2>
            <span className={`badge badge-${invoice.status}`}>{statusLabels[invoice.status]}</span>
            <span className="badge" style={{ marginLeft: '0.5rem', background: '#f1f5f9' }}>
              {invoice.type === 'issued' ? 'Vydaná' : 'Přijatá'}
            </span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{fmt(invoice.total, invoice.currency)}</div>
            {invoice.currency !== 'CZK' && (
              <div className="text-muted">{fmt(invoice.total_czk, 'CZK')}</div>
            )}
          </div>
        </div>

        <div className="invoice-meta">
          <div><dt>Dodavatel</dt><dd><strong>{company?.name || 'Rainbow Family Investment'}</strong>{company?.ico && <><br/>IČO: {company.ico}</>}{company?.dic && <><br/>DIČ: {company.dic}</>}{company?.address && <><br/>{company.address}, {company.city} {company.zip}</>}</dd></div>
          <div><dt>Odběratel</dt><dd>{invoice.client_name || '—'}</dd></div>
          <div><dt>Měna</dt><dd>{invoice.currency}</dd></div>
          <div><dt>Datum vystavení</dt><dd>{invoice.issue_date}</dd></div>
          <div><dt>Datum splatnosti</dt><dd>{invoice.due_date}</dd></div>
          {invoice.paid_date && <div><dt>Datum zaplacení</dt><dd>{invoice.paid_date}</dd></div>}
          <div><dt>Sazba DPH</dt><dd>{invoice.tax_rate}%</dd></div>
        </div>

        {invoice.note && (
          <div style={{ marginBottom: '1rem' }}>
            <strong>Poznámka:</strong> {invoice.note}
          </div>
        )}

        <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Položky</h3>
        <div className="table-responsive">
          <table>
            <thead>
              <tr><th>Popis</th><th className="text-right">Množství</th><th>Jednotka</th><th className="text-right">Cena/ks</th><th className="text-right">Celkem</th></tr>
            </thead>
            <tbody>
              {(invoice.items || []).map((item, i) => (
                <tr key={i}>
                  <td>{item.description}</td>
                  <td className="text-right">{item.quantity}</td>
                  <td>{item.unit}</td>
                  <td className="text-right">{fmt(item.unit_price, invoice.currency)}</td>
                  <td className="text-right">{fmt(item.total, invoice.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="invoice-totals">
          <div className="row"><span>Základ:</span><span>{fmt(invoice.subtotal, invoice.currency)}</span></div>
          <div className="row"><span>DPH ({invoice.tax_rate}%):</span><span>{fmt(invoice.tax_amount, invoice.currency)}</span></div>
          <div className="row total"><span>Celkem:</span><span>{fmt(invoice.total, invoice.currency)}</span></div>
          {invoice.currency !== 'CZK' && (
            <div className="row" style={{ color: 'var(--gray-500)', fontSize: '0.9rem' }}>
              <span>Celkem v CZK:</span><span>{fmt(invoice.total_czk, 'CZK')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
