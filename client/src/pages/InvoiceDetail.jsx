import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth, usePageTitle } from '../App';

const statusLabels = { draft: 'Koncept', sent: 'Odesláno', paid: 'Zaplaceno', overdue: 'Po splatnosti', cancelled: 'Zrušeno' };
const paymentLabels = { bank_transfer: 'Bankovní převod', cash: 'Hotově', card: 'Kartou', other: 'Jiný' };
const fmt = (n, cur = 'CZK') => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(n);

const layoutStyles = {
  klasicky: '', // default styles, no overrides needed
  minimalisticky: `
.inv-accent { display: none; }
.inv-accent-bottom { display: none; }
.inv-head-left h1 { color: #1e293b; font-size: 11px; letter-spacing: 0.15em; }
.inv-head-left .inv-num { font-size: 24px; font-weight: 400; letter-spacing: 0.02em; color: #1e293b; }
.inv-pay { border-color: #cbd5e1; border-width: 1px; border-radius: 4px; }
.inv-pay-title { color: #475569; }
.inv-pay-table .inv-pay-total td:last-child { color: #1e293b; }
.inv-parties { border-radius: 0; border-left: none; border-right: none; }
.inv-party:first-child { border-right: none; padding-right: 40px; }
.inv-dates { background: transparent; border: none; border-top: 1px solid var(--gray-200); border-bottom: 1px solid var(--gray-200); border-radius: 0; }
.inv-items thead { background: transparent; }
.inv-items thead th { border-top: none; border-bottom: 1px solid #1e293b; color: #1e293b; font-weight: 600; }
.inv-sum-total { border-top-color: #1e293b; }
.inv .inv-note { background: transparent; border: 1px solid var(--gray-200); border-radius: 4px; }
.inv-bottom { border-top: 1px solid #1e293b; }
.inv-badge-sent { background: #f1f5f9; color: #475569; }
`,
  korporatni: `
.inv-accent { height: 0; }
.inv-accent-bottom { display: none; }
.inv-head { background: #0f172a; margin: 0 -48px; padding: 24px 48px 20px; margin-bottom: 28px; }
.inv-head-left h1 { color: #e2e8f0; }
.inv-head-left .inv-num { color: #ffffff; }
.inv-head-right .inv-company { color: #ffffff; }
.inv-head-right .inv-company-info { color: #94a3b8; }
.inv-head-right img { filter: brightness(0) invert(1); }
.inv-badge-draft { background: rgba(255,255,255,0.15); color: #e2e8f0; }
.inv-badge-sent { background: rgba(99,102,241,0.3); color: #c7d2fe; }
.inv-badge-paid { background: rgba(16,185,129,0.3); color: #a7f3d0; }
.inv-badge-overdue { background: rgba(239,68,68,0.3); color: #fecaca; }
.inv-pay { border-color: #0f172a; }
.inv-pay-title { color: #0f172a; }
.inv-pay-table .inv-pay-total td:last-child { color: #0f172a; }
.inv-parties { border-color: #1e293b; border-radius: 4px; }
.inv-party:first-child { border-right-color: #1e293b; }
.inv-items thead { background: #0f172a; }
.inv-items thead th { color: #e2e8f0; border-bottom-color: #0f172a; border-top-color: #0f172a; }
.inv-sum-total { border-top-color: #0f172a; }
`,
  elegantni: `
.inv-accent { height: 2px; background: linear-gradient(90deg, #c4b5fd 0%, #8b5cf6 50%, #c4b5fd 100%); }
.inv-accent-bottom { height: 2px; background: linear-gradient(90deg, #c4b5fd 0%, #8b5cf6 50%, #c4b5fd 100%); opacity: 0.6; }
.inv-head-left h1 { color: #7c3aed; font-weight: 600; letter-spacing: 0.12em; }
.inv-head-left .inv-num { font-weight: 300; font-size: 32px; color: #1e1b4b; }
.inv-pay { border-color: #a78bfa; border-width: 1px; border-radius: 16px; }
.inv-pay-title { color: #7c3aed; }
.inv-pay-table .inv-pay-total td:last-child { color: #7c3aed; }
.inv-parties { border-radius: 16px; border-color: #e9d5ff; }
.inv-party:first-child { border-right-color: #e9d5ff; }
.inv-party-tag { color: #7c3aed; }
.inv-dates { border-radius: 16px; border-color: #e9d5ff; background: #faf5ff; }
.inv-date { border-right-color: #e9d5ff; }
.inv-date-label { color: #7c3aed; }
.inv-items thead { background: #faf5ff; }
.inv-items thead th { color: #7c3aed; border-bottom-color: #e9d5ff; border-top-color: #e9d5ff; }
.inv-items tbody td { border-bottom-color: #f3e8ff; }
.inv-items tbody tr:last-child td { border-bottom-color: #e9d5ff; }
.inv-sum-total { border-top-color: #7c3aed; color: #1e1b4b; }
.inv .inv-note { background: #faf5ff; border-color: #e9d5ff; border-radius: 16px; }
.inv-bottom { border-top-color: #e9d5ff; }
.inv-badge-sent { background: #ede9fe; color: #6d28d9; }
`,
  kompaktni: `
.inv-accent { height: 3px; background: #059669; border-radius: 0; }
.inv-accent-bottom { height: 2px; background: #059669; border-radius: 0; opacity: 0.4; }
.inv { padding: 32px 36px 24px; font-size: 12px; }
.inv-head { margin: 16px 0 20px; }
.inv-head-left h1 { color: #059669; font-size: 10px; }
.inv-head-left .inv-num { font-size: 22px; }
.inv-head-right .inv-company { font-size: 15px; }
.inv-pay { border-color: #059669; border-radius: 6px; }
.inv-pay-title { color: #059669; }
.inv-pay-table .inv-pay-total td:last-child { color: #059669; }
.inv-parties { margin-bottom: 16px; border-radius: 6px; }
.inv-party { padding: 12px 14px; }
.inv-dates { margin-bottom: 16px; border-radius: 6px; }
.inv-date { padding: 8px 12px; }
.inv-items tbody td { padding: 7px 10px; font-size: 11.5px; }
.inv-items thead th { padding: 7px 10px; }
.inv-sum { padding: 10px 0 16px; }
.inv .inv-note { padding: 10px 14px; border-radius: 6px; }
.inv-bottom { padding-top: 14px; }
.inv-badge-sent { background: #ecfdf5; color: #059669; }
`,
};
const fmtDate = (d) => {
  if (!d) return '—';
  const parts = d.slice(0, 10).split('-');
  if (parts.length !== 3) return d;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
};

const CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; padding: 0; font-size: 13px; line-height: 1.5; }
.inv { max-width: 780px; margin: 0 auto; padding: 48px 48px 32px; }

/* ── Accent bar ── */
.inv-accent { height: 4px; background: linear-gradient(90deg, #4361ee 0%, #7c3aed 100%); border-radius: 2px; }

/* ── Header ── */
.inv-head { display: flex; justify-content: space-between; align-items: flex-start; margin: 28px 0 32px; }
.inv-head-left h1 { font-size: 13px; font-weight: 800; color: #4361ee; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px; }
.inv-head-left .inv-num { font-size: 28px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; line-height: 1.1; }
.inv-head-right { text-align: right; }
.inv-head-right .inv-company { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
.inv-head-right .inv-company-info { font-size: 11.5px; color: #64748b; line-height: 1.6; }
.inv-badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 6px; }
.inv-badge-draft { background: #f1f5f9; color: #475569; }
.inv-badge-sent { background: #eff6ff; color: #2563eb; }
.inv-badge-paid { background: #f0fdf4; color: #16a34a; }
.inv-badge-overdue { background: #fef2f2; color: #dc2626; }
.inv-badge-cancelled { background: #fffbeb; color: #d97706; }

/* ── Parties ── */
.inv-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
.inv-party { padding: 18px 20px; }
.inv-party:first-child { border-right: 1px solid #e2e8f0; }
.inv-party-tag { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 8px; }
.inv-party-name { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
.inv-party-detail { font-size: 11.5px; color: #475569; line-height: 1.7; }
.inv-party-detail strong { color: #334155; font-weight: 600; }

/* ── Payment box ── */
.inv-pay { display: grid; grid-template-columns: 1fr auto; gap: 0; margin-bottom: 24px; border: 1.5px solid #4361ee; border-radius: 8px; overflow: hidden; }
.inv-pay-details { padding: 16px 20px; }
.inv-pay-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #4361ee; margin-bottom: 10px; }
.inv-pay-table { width: 100%; }
.inv-pay-table td { padding: 3px 0; vertical-align: top; }
.inv-pay-table td:first-child { color: #64748b; font-size: 11.5px; width: 120px; white-space: nowrap; padding-right: 12px; }
.inv-pay-table td:last-child { font-weight: 600; color: #0f172a; font-size: 12.5px; }
.inv-pay-table .inv-pay-total td:last-child { font-size: 16px; font-weight: 800; color: #4361ee; }
.inv-pay-table .inv-pay-vs td:last-child { font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; letter-spacing: 1.5px; font-size: 13px; }
.inv-pay-qr { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px 16px; background: #f8fafc; border-left: 1px solid #e2e8f0; min-width: 100px; }
.inv-pay-qr img { width: 88px; height: 88px; }
.inv-pay-qr span { font-size: 8px; color: #94a3b8; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600; }

/* ── Dates strip ── */
.inv-dates { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 0; margin-bottom: 24px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; }
.inv-date { padding: 12px 16px; border-right: 1px solid #e2e8f0; }
.inv-date:last-child { border-right: none; }
.inv-date-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 3px; }
.inv-date-val { font-size: 13px; font-weight: 600; color: #0f172a; }

/* ── Items table ── */
.inv-items { width: 100%; border-collapse: collapse; margin-bottom: 0; }
.inv-items thead { background: #f8fafc; }
.inv-items thead th { padding: 10px 14px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; text-align: left; border-bottom: 2px solid #e2e8f0; border-top: 1px solid #e2e8f0; }
.inv-items thead th.r { text-align: right; }
.inv-items tbody td { padding: 11px 14px; font-size: 12.5px; color: #334155; border-bottom: 1px solid #f1f5f9; }
.inv-items tbody td.r { text-align: right; font-variant-numeric: tabular-nums; }
.inv-items tbody tr:last-child td { border-bottom: 2px solid #e2e8f0; }

/* ── Totals ── */
.inv-sum { display: flex; justify-content: flex-end; padding: 16px 0 24px; }
.inv-sum-box { width: 260px; }
.inv-sum-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; color: #64748b; }
.inv-sum-row span:last-child { font-variant-numeric: tabular-nums; font-weight: 500; }
.inv-sum-total { display: flex; justify-content: space-between; padding: 10px 0 4px; font-size: 18px; font-weight: 800; color: #0f172a; border-top: 2px solid #0f172a; margin-top: 6px; }
.inv-sum-czk { display: flex; justify-content: space-between; padding: 2px 0; font-size: 11px; color: #94a3b8; }

/* ── Note ── */
.inv-note { padding: 14px 18px; background: #f8fafc; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e2e8f0; }
.inv-note-tag { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 4px; }
.inv-note-text { font-size: 12px; color: #475569; line-height: 1.5; }

/* ── Issuer + Footer ── */
.inv-bottom { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 20px; border-top: 1px solid #e2e8f0; margin-top: 8px; }
.inv-issuer-tag { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 3px; }
.inv-issuer-name { font-size: 13px; font-weight: 600; color: #0f172a; }
.inv-sig { max-width: 140px; max-height: 60px; margin-top: 6px; }
.inv-foot { font-size: 10px; color: #94a3b8; text-align: right; }
.inv-accent-bottom { height: 3px; background: linear-gradient(90deg, #4361ee 0%, #7c3aed 100%); border-radius: 1.5px; margin-top: 20px; }
@media print { body { padding: 0; } .inv { padding: 24px; } }
`;

const layoutPrintCSS = {
  klasicky: '',
  minimalisticky: `.inv-accent,.inv-accent-bottom{display:none}.inv-head-left h1{color:#1e293b}.inv-head-left .inv-num{font-size:24px;font-weight:400}.inv-pay{border-color:#cbd5e1}.inv-pay-title{color:#475569}.inv-pay-table .inv-pay-total td:last-child{color:#1e293b}.inv-items thead th{border-top:none;border-bottom:1px solid #1e293b;color:#1e293b}`,
  korporatni: `.inv-accent,.inv-accent-bottom{display:none}.inv-head{background:#0f172a;margin:0 -48px;padding:24px 48px 20px;margin-bottom:28px}.inv-head-left h1{color:#e2e8f0}.inv-head-left .inv-num{color:#fff}.inv-head-right .inv-company{color:#fff}.inv-head-right .inv-company-info{color:#94a3b8}.inv-items thead{background:#0f172a}.inv-items thead th{color:#e2e8f0}`,
  elegantni: `.inv-accent{height:2px;background:linear-gradient(90deg,#c4b5fd,#8b5cf6,#c4b5fd)}.inv-head-left h1{color:#7c3aed}.inv-head-left .inv-num{font-weight:300;font-size:32px}.inv-pay{border-color:#a78bfa}.inv-pay-title{color:#7c3aed}.inv-items thead{background:#faf5ff}.inv-items thead th{color:#7c3aed}`,
  kompaktni: `.inv-accent{height:3px;background:#059669;border-radius:0}.inv{padding:32px 36px 24px}.inv-head-left h1{color:#059669}.inv-pay{border-color:#059669}.inv-pay-title{color:#059669}`,
};

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [company, setCompany] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [showPayment, setShowPayment] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', date: new Date().toISOString().slice(0, 10), note: '' });
  const { can } = useAuth();
  const invoiceRef = useRef();
  usePageTitle(invoice ? `Faktura ${invoice.invoice_number}` : undefined);

  useEffect(() => {
    Promise.all([api.getInvoice(id), api.getCompany()])
      .then(([inv, comp]) => {
        setInvoice(inv); setCompany(comp);
        api.getInvoiceQR(id).then(setQrData).catch(() => {});
        api.getInvoicePayments(id).then(setPayments).catch(() => {});
      })
      .finally(() => setLoading(false));
  }, [id]);

  const changeStatus = async (status) => {
    const paid_date = status === 'paid' ? new Date().toISOString().slice(0, 10) : undefined;
    await api.updateInvoiceStatus(id, status, paid_date);
    setInvoice(prev => ({ ...prev, status, paid_date: paid_date || prev.paid_date }));
  };

  const downloadPDF = async () => {
    try {
      const blob = await api.downloadInvoicePDF(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${invoice.invoice_number}.pdf`;
      a.click(); URL.revokeObjectURL(url);
    } catch {
      // Fallback to print
      const content = invoiceRef.current;
      const win = window.open('', '_blank');
      const pLayout = layoutPrintCSS[co?.invoice_layout] || '';
      win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${invoice.invoice_number}</title><style>${CSS}${pLayout}</style></head><body>${content.innerHTML}<script>window.onload=function(){window.print();}<\/script></body></html>`);
      win.document.close();
    }
  };

  if (loading) return <div className="loading">Načítání...</div>;
  if (!invoice) return <div className="empty-state">Faktura nenalezena</div>;

  const co = company || {};
  const isVatPayer = !!co.vat_payer;
  const bankFull = co.bank_account ? (co.bank_code ? `${co.bank_account}/${co.bank_code}` : co.bank_account) : null;

  const taxByRate = {};
  (invoice.items || []).forEach(item => {
    const rate = item.tax_rate ?? 21;
    const base = item.total || (item.quantity * item.unit_price);
    const tax = item.tax_amount || (base * rate / 100);
    if (!taxByRate[rate]) taxByRate[rate] = { base: 0, tax: 0 };
    taxByRate[rate].base += base;
    taxByRate[rate].tax += tax;
  });

  const hasBankDetails = bankFull || co.iban;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <button className="btn btn-primary" onClick={downloadPDF}>PDF</button>
        <a href={`/api/invoices/${id}/isdoc`} className="btn btn-outline" download>ISDOC</a>
        {can('admin', 'accountant') && <>
          <Link to={`/invoices/${id}/edit`} className="btn btn-outline">Upravit</Link>
          <button className="btn btn-outline" onClick={async () => {
            try { await api.sendInvoiceEmail(id, {}); alert('Email odeslán'); } catch (e) { alert(e.message); }
          }}>Odeslat emailem</button>
          {(invoice.status === 'overdue' || invoice.status === 'sent') && (
            <button className="btn btn-outline" style={{ color: '#ef4444' }} onClick={async () => {
              try { await api.sendInvoiceReminder(id); alert('Upomínka odeslána'); } catch (e) { alert(e.message); }
            }}>Upomínka</button>
          )}
        </>}
        {can('admin', 'accountant') && (
          <button className="btn btn-outline" onClick={async () => { const r = await api.duplicateInvoice(id); navigate(`/invoices/${r.id}`); }}>Duplikovat</button>
        )}
        {can('admin', 'accountant') && invoice.status !== 'cancelled' && invoice.invoice_type !== 'credit_note' && (
          <button className="btn btn-outline" onClick={async () => { const r = await api.createCreditNote(id); navigate(`/invoices/${r.id}`); }}>Dobropis</button>
        )}
        {can('admin', 'accountant') && invoice.invoice_type === 'proforma' && invoice.status !== 'paid' && (
          <button className="btn btn-success" onClick={async () => { const r = await api.convertProforma(id); navigate(`/invoices/${r.id}`); }}>Převést na fakturu</button>
        )}
        {can('admin', 'accountant', 'manager') && invoice.status === 'draft' && (
          <button className="btn btn-success" onClick={() => changeStatus('sent')}>Odeslat</button>
        )}
        {can('admin', 'accountant', 'manager') && ['sent', 'overdue'].includes(invoice.status) && (
          <button className="btn btn-outline" onClick={() => setShowPayment(true)}>Zaznamenat platbu</button>
        )}
        {can('admin', 'accountant', 'manager') && invoice.status === 'sent' && (
          <button className="btn btn-success" onClick={() => changeStatus('paid')}>Zaplaceno</button>
        )}
        {can('admin', 'accountant', 'manager') && ['sent', 'overdue'].includes(invoice.status) && (
          <button className="btn btn-warning" onClick={() => changeStatus('cancelled')}>Zrušit</button>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
.inv { max-width: 780px; margin: 0 auto; padding: 48px 48px 32px; background: white; border-radius: 16px; border: 1px solid var(--gray-200); box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
.inv-accent { height: 4px; background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%); border-radius: 2px; }
.inv-head { display: flex; justify-content: space-between; align-items: flex-start; margin: 28px 0 32px; }
.inv-head-left h1 { font-size: 13px; font-weight: 800; color: #6366f1; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px; }
.inv-head-left .inv-num { font-size: 28px; font-weight: 800; color: var(--gray-900); letter-spacing: -0.5px; line-height: 1.1; }
.inv-head-right { text-align: right; }
.inv-head-right .inv-company { font-size: 18px; font-weight: 700; color: var(--gray-900); margin-bottom: 4px; }
.inv-head-right .inv-company-info { font-size: 11.5px; color: var(--gray-500); line-height: 1.6; }
.inv-badge { display: inline-block; padding: 3px 10px; border-radius: 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 6px; }
.inv-badge-draft { background: var(--gray-100); color: var(--gray-600); }
.inv-badge-sent { background: #eef2ff; color: #4f46e5; }
.inv-badge-paid { background: #ecfdf5; color: #059669; }
.inv-badge-overdue { background: #fef2f2; color: #dc2626; }
.inv-badge-cancelled { background: #fffbeb; color: #d97706; }
.inv-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin-bottom: 24px; border: 1px solid var(--gray-200); border-radius: 12px; overflow: hidden; }
.inv-party { padding: 18px 20px; }
.inv-party:first-child { border-right: 1px solid var(--gray-200); }
.inv-party-tag { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--gray-400); margin-bottom: 8px; }
.inv-party-name { font-size: 14px; font-weight: 700; color: var(--gray-900); margin-bottom: 6px; }
.inv-party-detail { font-size: 11.5px; color: var(--gray-600); line-height: 1.7; }
.inv-party-detail strong { color: var(--gray-700); font-weight: 600; }
.inv-pay { display: grid; grid-template-columns: 1fr auto; gap: 0; margin-bottom: 24px; border: 1.5px solid #6366f1; border-radius: 12px; overflow: hidden; }
.inv-pay-details { padding: 16px 20px; }
.inv-pay-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #6366f1; margin-bottom: 10px; }
.inv-pay-table { width: 100%; }
.inv-pay-table td { padding: 3px 0; vertical-align: top; }
.inv-pay-table td:first-child { color: var(--gray-500); font-size: 11.5px; width: 120px; white-space: nowrap; padding-right: 12px; }
.inv-pay-table td:last-child { font-weight: 600; color: var(--gray-900); font-size: 12.5px; }
.inv-pay-table .inv-pay-total td:last-child { font-size: 16px; font-weight: 800; color: #6366f1; }
.inv-pay-table .inv-pay-vs td:last-child { font-family: 'SF Mono', 'Fira Code', monospace; letter-spacing: 1.5px; font-size: 13px; }
.inv-pay-qr { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px 16px; background: var(--gray-50); border-left: 1px solid var(--gray-200); min-width: 100px; }
.inv-pay-qr img { width: 88px; height: 88px; }
.inv-pay-qr span { font-size: 8px; color: var(--gray-400); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600; }
.inv-dates { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 0; margin-bottom: 24px; background: var(--gray-50); border-radius: 12px; border: 1px solid var(--gray-200); overflow: hidden; }
.inv-date { padding: 12px 16px; border-right: 1px solid var(--gray-200); }
.inv-date:last-child { border-right: none; }
.inv-date-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--gray-400); margin-bottom: 3px; }
.inv-date-val { font-size: 13px; font-weight: 600; color: var(--gray-900); }
.inv-items { width: 100%; border-collapse: collapse; margin-bottom: 0; }
.inv-items thead { background: var(--gray-50); }
.inv-items thead th { padding: 10px 14px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--gray-400); text-align: left; border-bottom: 2px solid var(--gray-200); border-top: 1px solid var(--gray-200); }
.inv-items thead th.r { text-align: right; }
.inv-items tbody td { padding: 11px 14px; font-size: 12.5px; color: var(--gray-700); border-bottom: 1px solid var(--gray-100); }
.inv-items tbody td.r { text-align: right; font-variant-numeric: tabular-nums; }
.inv-items tbody tr:last-child td { border-bottom: 2px solid var(--gray-200); }
.inv-sum { display: flex; justify-content: flex-end; padding: 16px 0 24px; }
.inv-sum-box { width: 260px; }
.inv-sum-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; color: var(--gray-500); }
.inv-sum-row span:last-child { font-variant-numeric: tabular-nums; font-weight: 500; }
.inv-sum-total { display: flex; justify-content: space-between; padding: 10px 0 4px; font-size: 18px; font-weight: 800; color: var(--gray-900); border-top: 2px solid var(--gray-900); margin-top: 6px; letter-spacing: -0.02em; }
.inv-sum-czk { display: flex; justify-content: space-between; padding: 2px 0; font-size: 11px; color: var(--gray-400); }
.inv .inv-note { padding: 14px 18px; background: var(--gray-50); border-radius: 10px; margin-bottom: 20px; border: 1px solid var(--gray-200); }
.inv .inv-note-tag { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--gray-400); margin-bottom: 4px; }
.inv .inv-note-text { font-size: 12px; color: var(--gray-600); line-height: 1.5; }
.inv-bottom { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 20px; border-top: 1px solid var(--gray-200); margin-top: 8px; }
.inv-issuer-tag { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--gray-400); margin-bottom: 3px; }
.inv-issuer-name { font-size: 13px; font-weight: 600; color: var(--gray-900); }
.inv-sig { max-width: 140px; max-height: 60px; margin-top: 6px; }
.inv-foot { font-size: 10px; color: var(--gray-400); text-align: right; }
.inv-accent-bottom { height: 3px; background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%); border-radius: 1.5px; margin-top: 20px; opacity: 0.5; }
${layoutStyles[co?.invoice_layout] || ''}
      ` }} />
      <div ref={invoiceRef}>
        <div className="inv">
          {/* Accent bar */}
          <div className="inv-accent"></div>

          {/* Header: Invoice number left, Company right */}
          <div className="inv-head">
            <div className="inv-head-left">
              <h1>{invoice.invoice_type === 'proforma' ? 'Proforma faktura' : invoice.invoice_type === 'credit_note' ? 'Dobropis' : 'Faktura'}</h1>
              <div className="inv-num">{invoice.invoice_number}</div>
              <span className={`inv-badge inv-badge-${invoice.status}`}>{statusLabels[invoice.status]}</span>
            </div>
            <div className="inv-head-right">
              {co.logo && <img src={co.logo} alt="Logo" style={{ maxWidth: 150, maxHeight: 50, objectFit: 'contain', marginBottom: 8, display: 'block', marginLeft: 'auto' }} />}
              <div className="inv-company">{co.name || 'Rainbow Family Investment'}</div>
              <div className="inv-company-info">
                {co.ico && <>IČO: {co.ico}<br/></>}
                {co.dic && <>DIČ: {co.dic}<br/></>}
                {co.address && <>{co.address}<br/></>}
                {co.city && <>{co.city} {co.zip}</>}
              </div>
            </div>
          </div>

          {/* Two-column: Dodavatel | Odběratel */}
          <div className="inv-parties">
            <div className="inv-party">
              <div className="inv-party-tag">Dodavatel</div>
              <div className="inv-party-name">{co.name || '—'}</div>
              <div className="inv-party-detail">
                {co.ico && <><strong>IČ:</strong> {co.ico}<br/></>}
                {co.dic && <><strong>DIČ:</strong> {co.dic}<br/></>}
                {co.address && <>{co.address}<br/></>}
                {co.city && <>{co.city} {co.zip}<br/></>}
                {co.email && <>{co.email}<br/></>}
                {co.phone && <>{co.phone}</>}
              </div>
            </div>
            <div className="inv-party">
              <div className="inv-party-tag">Odběratel</div>
              <div className="inv-party-name">{invoice.client_name || '—'}</div>
              <div className="inv-party-detail">
                {invoice.client_ico && <><strong>IČ:</strong> {invoice.client_ico}<br/></>}
                {invoice.client_dic && <><strong>DIČ:</strong> {invoice.client_dic}<br/></>}
                {invoice.client_address && <>{invoice.client_address}<br/></>}
                {invoice.client_city && <>{invoice.client_city} {invoice.client_zip}<br/></>}
                {invoice.client_email && <>{invoice.client_email}</>}
              </div>
            </div>
          </div>

          {/* Payment box with QR */}
          {hasBankDetails && (
            <div className="inv-pay">
              <div className="inv-pay-details">
                <div className="inv-pay-title">Platební údaje</div>
                <table className="inv-pay-table">
                  <tbody>
                    {bankFull && <tr><td>Číslo účtu</td><td>{bankFull}</td></tr>}
                    {co.iban && <tr><td>IBAN</td><td>{co.iban}</td></tr>}
                    {co.swift && <tr><td>SWIFT</td><td>{co.swift}</td></tr>}
                    {invoice.variable_symbol && <tr className="inv-pay-vs"><td>Variabilní symbol</td><td>{invoice.variable_symbol}</td></tr>}
                    <tr><td>Způsob úhrady</td><td>{paymentLabels[invoice.payment_method] || 'Bankovní převod'}</td></tr>
                    <tr className="inv-pay-total"><td>K úhradě</td><td>{fmt(invoice.total, invoice.currency)}</td></tr>
                  </tbody>
                </table>
              </div>
              {qrData?.qr && (
                <div className="inv-pay-qr">
                  <img src={qrData.qr} alt="QR Platba" />
                  <span>QR Platba</span>
                </div>
              )}
            </div>
          )}

          {/* Dates strip */}
          <div className="inv-dates">
            <div className="inv-date">
              <div className="inv-date-label">Datum vystavení</div>
              <div className="inv-date-val">{fmtDate(invoice.issue_date)}</div>
            </div>
            {isVatPayer && (
              <div className="inv-date">
                <div className="inv-date-label">DÚZP</div>
                <div className="inv-date-val">{fmtDate(invoice.supply_date || invoice.issue_date)}</div>
              </div>
            )}
            <div className="inv-date">
              <div className="inv-date-label">Datum splatnosti</div>
              <div className="inv-date-val">{fmtDate(invoice.due_date)}</div>
            </div>
            {invoice.paid_date && (
              <div className="inv-date">
                <div className="inv-date-label">Datum úhrady</div>
                <div className="inv-date-val">{fmtDate(invoice.paid_date)}</div>
              </div>
            )}
            <div className="inv-date">
              <div className="inv-date-label">Měna</div>
              <div className="inv-date-val">{invoice.currency}</div>
            </div>
          </div>

          {/* Items table */}
          <table className="inv-items">
            <thead>
              <tr>
                <th style={{ width: '40%' }}>Popis</th>
                <th className="r">Množství</th>
                <th>Jedn.</th>
                <th className="r">Cena/ks</th>
                {isVatPayer && <th className="r">DPH</th>}
                <th className="r">Celkem{isVatPayer ? ' bez DPH' : ''}</th>
                {isVatPayer && <th className="r">S DPH</th>}
              </tr>
            </thead>
            <tbody>
              {(invoice.items || []).map((item, i) => {
                const lineBase = item.total || (item.quantity * item.unit_price);
                const lineTax = item.tax_amount || (lineBase * (item.tax_rate ?? 21) / 100);
                return (
                  <tr key={i}>
                    <td>{item.description}</td>
                    <td className="r">{item.quantity}</td>
                    <td>{item.unit}</td>
                    <td className="r">{fmt(item.unit_price, invoice.currency)}</td>
                    {isVatPayer && <td className="r">{item.tax_rate ?? 21}%</td>}
                    <td className="r">{fmt(lineBase, invoice.currency)}</td>
                    {isVatPayer && <td className="r">{fmt(lineBase + lineTax, invoice.currency)}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totals */}
          <div className="inv-sum">
            <div className="inv-sum-box">
              {isVatPayer && <div className="inv-sum-row"><span>Základ</span><span>{fmt(invoice.subtotal, invoice.currency)}</span></div>}
              {isVatPayer && Object.entries(taxByRate).map(([rate, vals]) => (
                <div className="inv-sum-row" key={rate}><span>DPH {rate}%</span><span>{fmt(vals.tax, invoice.currency)}</span></div>
              ))}
              <div className="inv-sum-total"><span>Celkem</span><span>{fmt(invoice.total, invoice.currency)}</span></div>
              {invoice.currency !== 'CZK' && (
                <div className="inv-sum-czk"><span>V CZK</span><span>{fmt(invoice.total_czk, 'CZK')}</span></div>
              )}
            </div>
          </div>

          {/* Note */}
          {invoice.note && (
            <div className="inv-note">
              <div className="inv-note-tag">Poznámka</div>
              <div className="inv-note-text">{invoice.note}</div>
            </div>
          )}

          {!isVatPayer && (
            <div className="inv-note">
              <div className="inv-note-text">Dodavatel není plátcem DPH.</div>
            </div>
          )}

          {/* Footer: Issuer + Company info */}
          <div className="inv-bottom">
            <div>
              {invoice.created_by_name && (
                <>
                  <div className="inv-issuer-tag">Vystavil/a</div>
                  <div className="inv-issuer-name">{invoice.created_by_name}</div>
                  {invoice.created_by_signature && (
                    <img src={invoice.created_by_signature} alt="Podpis" className="inv-sig" />
                  )}
                </>
              )}
            </div>
            <div className="inv-foot">
              {co.name}{co.ico && ` · IČ ${co.ico}`}{co.dic && ` · DIČ ${co.dic}`}
            </div>
          </div>

          <div className="inv-accent-bottom"></div>
        </div>
      </div>

      {/* Partial payments */}
      {payments.length > 0 && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div className="card-title" style={{ marginBottom: '0.75rem' }}>Platby ({payments.length})</div>
          <div className="table-responsive">
            <table>
              <thead><tr><th>Datum</th><th className="text-right">Částka</th><th>Poznámka</th><th>Zapsal</th></tr></thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td>{fmtDate(p.date)}</td>
                    <td className="text-right" style={{ fontWeight: 600 }}>{fmt(p.amount, p.currency)}</td>
                    <td>{p.note || '—'}</td>
                    <td>{p.created_by_name || '—'}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700, borderTop: '2px solid #e2e8f0' }}>
                  <td>Zaplaceno celkem</td>
                  <td className="text-right">{fmt(payments.reduce((s, p) => s + p.amount, 0), invoice.currency)}</td>
                  <td colSpan={2} className="text-right">Zbývá: {fmt(invoice.total - payments.reduce((s, p) => s + p.amount, 0), invoice.currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Related invoices */}
      {invoice.invoice_type === 'credit_note' && invoice.related_invoice_id && (
        <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#fef2f2', borderRadius: 'var(--radius)', border: '1px solid #fecaca' }}>
          Dobropis k faktuře: <Link to={`/invoices/${invoice.related_invoice_id}`} style={{ fontWeight: 600 }}>Zobrazit původní fakturu</Link>
        </div>
      )}

      {/* Payment modal */}
      {showPayment && (
        <div className="modal-overlay" onClick={() => setShowPayment(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3 className="modal-title">Zaznamenat platbu</h3>
              <button className="modal-close" onClick={() => setShowPayment(false)}>&times;</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              await api.addInvoicePayment(id, { amount: parseFloat(payForm.amount), date: payForm.date, note: payForm.note });
              setShowPayment(false);
              const [inv, pays] = await Promise.all([api.getInvoice(id), api.getInvoicePayments(id)]);
              setInvoice(inv); setPayments(pays);
            }}>
              <div className="form-group">
                <label className="form-label">Částka *</label>
                <input className="form-input" type="number" step="0.01" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Datum *</label>
                <input className="form-input" type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Poznámka</label>
                <input className="form-input" value={payForm.note} onChange={e => setPayForm(f => ({ ...f, note: e.target.value }))} />
              </div>
              <div className="btn-group">
                <button type="submit" className="btn btn-primary">Uložit platbu</button>
                <button type="button" className="btn btn-outline" onClick={() => setShowPayment(false)}>Zrušit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
