import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth, usePageTitle } from '../App';

const statusLabels = { draft: 'Koncept', sent: 'Odesláno', paid: 'Zaplaceno', overdue: 'Po splatnosti', cancelled: 'Zrušeno' };
const paymentLabels = { bank_transfer: 'Bankovní převod', cash: 'Hotově', card: 'Kartou', other: 'Jiný' };
const fmt = (n, cur = 'CZK') => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(n);
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
.inv-accent { height: 4px; background: linear-gradient(90deg, #4361ee 0%, #7c3aed 100%); border-radius: 2px; }
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
.inv-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
.inv-party { padding: 18px 20px; }
.inv-party:first-child { border-right: 1px solid #e2e8f0; }
.inv-party-tag { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 8px; }
.inv-party-name { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
.inv-party-detail { font-size: 11.5px; color: #475569; line-height: 1.7; }
.inv-party-detail strong { color: #334155; font-weight: 600; }
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
.inv-dates { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 0; margin-bottom: 24px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; }
.inv-date { padding: 12px 16px; border-right: 1px solid #e2e8f0; }
.inv-date:last-child { border-right: none; }
.inv-date-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 3px; }
.inv-date-val { font-size: 13px; font-weight: 600; color: #0f172a; }
.inv-items { width: 100%; border-collapse: collapse; margin-bottom: 0; }
.inv-items thead { background: #f8fafc; }
.inv-items thead th { padding: 10px 14px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; text-align: left; border-bottom: 2px solid #e2e8f0; border-top: 1px solid #e2e8f0; }
.inv-items thead th.r { text-align: right; }
.inv-items tbody td { padding: 11px 14px; font-size: 12.5px; color: #334155; border-bottom: 1px solid #f1f5f9; }
.inv-items tbody td.r { text-align: right; font-variant-numeric: tabular-nums; }
.inv-items tbody tr:last-child td { border-bottom: 2px solid #e2e8f0; }
.inv-sum { display: flex; justify-content: flex-end; padding: 16px 0 24px; }
.inv-sum-box { width: 260px; }
.inv-sum-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; color: #64748b; }
.inv-sum-row span:last-child { font-variant-numeric: tabular-nums; font-weight: 500; }
.inv-sum-total { display: flex; justify-content: space-between; padding: 10px 0 4px; font-size: 18px; font-weight: 800; color: #0f172a; border-top: 2px solid #0f172a; margin-top: 6px; }
.inv-sum-czk { display: flex; justify-content: space-between; padding: 2px 0; font-size: 11px; color: #94a3b8; }
.inv-note { padding: 14px 18px; background: #f8fafc; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e2e8f0; }
.inv-note-tag { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 4px; }
.inv-note-text { font-size: 12px; color: #475569; line-height: 1.5; }
.inv-bottom { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 20px; border-top: 1px solid #e2e8f0; margin-top: 8px; }
.inv-issuer-tag { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 3px; }
.inv-issuer-name { font-size: 13px; font-weight: 600; color: #0f172a; }
.inv-sig { max-width: 140px; max-height: 60px; margin-top: 6px; }
.inv-foot { font-size: 10px; color: #94a3b8; text-align: right; }
.inv-accent-bottom { height: 3px; background: linear-gradient(90deg, #4361ee 0%, #7c3aed 100%); border-radius: 1.5px; margin-top: 20px; }
.inv-hr { border: none; border-top: 1px solid #cbd5e1; margin: 24px 0; }

/* Minimalisticky */
.inv-layout-minimalisticky { padding: 56px 56px 40px; }
.inv-layout-minimalisticky .inv-head { justify-content: center; text-align: center; display: block; margin: 0 0 32px; }
.inv-layout-minimalisticky .inv-head h1 { color: #64748b; font-weight: 600; font-size: 11px; letter-spacing: 0.18em; }
.inv-layout-minimalisticky .inv-head .inv-num { font-size: 36px; font-weight: 300; color: #1e293b; letter-spacing: 0.02em; }
.inv-layout-minimalisticky .inv-head .inv-company-sub { font-size: 12px; color: #94a3b8; margin-top: 8px; }
.inv-layout-minimalisticky .inv-parties { border: none; border-radius: 0; }
.inv-layout-minimalisticky .inv-party:first-child { border-right: none; padding-right: 40px; }
.inv-layout-minimalisticky .inv-pay { border-color: #cbd5e1; border-width: 1px; border-radius: 4px; }
.inv-layout-minimalisticky .inv-pay-title { color: #475569; }
.inv-layout-minimalisticky .inv-pay-table .inv-pay-total td:last-child { color: #1e293b; }
.inv-layout-minimalisticky .inv-dates { background: transparent; border: none; border-radius: 0; }
.inv-layout-minimalisticky .inv-date { border-right-color: #e2e8f0; }
.inv-layout-minimalisticky .inv-items thead { background: transparent; }
.inv-layout-minimalisticky .inv-items thead th { border-top: none; border-bottom: 1.5px solid #1e293b; color: #1e293b; font-weight: 600; }
.inv-layout-minimalisticky .inv-items tbody tr:last-child td { border-bottom: 1.5px solid #1e293b; }
.inv-layout-minimalisticky .inv-sum-total { border-top-color: #1e293b; }
.inv-layout-minimalisticky .inv-note { background: transparent; border: 1px solid #e2e8f0; border-radius: 4px; }
.inv-layout-minimalisticky .inv-bottom { border-top-color: #1e293b; }

/* Korporatni */
.inv-layout-korporatni .inv-dark-header { background: #0f172a; margin: 0 -48px; padding: 28px 48px 24px; margin-bottom: 28px; }
.inv-layout-korporatni .inv-dark-header h1 { color: #94a3b8; }
.inv-layout-korporatni .inv-dark-header .inv-num { color: #ffffff; font-size: 30px; }
.inv-layout-korporatni .inv-dark-header .inv-company { color: #ffffff; }
.inv-layout-korporatni .inv-dark-header .inv-company-info { color: #94a3b8; }
.inv-layout-korporatni .inv-dark-header img { filter: brightness(0) invert(1); }
.inv-layout-korporatni .inv-dark-header .inv-badge-draft { background: rgba(255,255,255,0.15); color: #e2e8f0; }
.inv-layout-korporatni .inv-dark-header .inv-badge-sent { background: rgba(99,102,241,0.3); color: #c7d2fe; }
.inv-layout-korporatni .inv-dark-header .inv-badge-paid { background: rgba(16,185,129,0.3); color: #a7f3d0; }
.inv-layout-korporatni .inv-dark-header .inv-badge-overdue { background: rgba(239,68,68,0.3); color: #fecaca; }
.inv-layout-korporatni .inv-pay { border-color: #0f172a; border-width: 2px; }
.inv-layout-korporatni .inv-pay-title { color: #0f172a; }
.inv-layout-korporatni .inv-pay-table .inv-pay-total td:last-child { color: #0f172a; }
.inv-layout-korporatni .inv-parties { border-color: #1e293b; border-radius: 4px; }
.inv-layout-korporatni .inv-party:first-child { border-right-color: #1e293b; }
.inv-layout-korporatni .inv-items thead { background: #0f172a; }
.inv-layout-korporatni .inv-items thead th { color: #e2e8f0; border-bottom-color: #0f172a; border-top-color: #0f172a; }
.inv-layout-korporatni .inv-sum-total { border-top-color: #0f172a; }
.inv-layout-korporatni .inv-bottom { border-top-color: #1e293b; }

/* Elegantni */
.inv-layout-elegantni .inv-accent { height: 2px; background: linear-gradient(90deg, #c4b5fd 0%, #8b5cf6 50%, #c4b5fd 100%); }
.inv-layout-elegantni .inv-accent-bottom { height: 2px; background: linear-gradient(90deg, #c4b5fd 0%, #8b5cf6 50%, #c4b5fd 100%); opacity: 0.6; }
.inv-layout-elegantni .inv-head { justify-content: center; text-align: center; display: block; margin: 24px 0 28px; }
.inv-layout-elegantni .inv-head h1 { color: #7c3aed; font-weight: 600; letter-spacing: 0.12em; }
.inv-layout-elegantni .inv-head .inv-num { font-weight: 300; font-size: 34px; color: #1e1b4b; }
.inv-layout-elegantni .inv-head .inv-company-sub { font-size: 12px; color: #a78bfa; margin-top: 6px; }
.inv-layout-elegantni .inv-parties { border-radius: 16px; border-color: #e9d5ff; }
.inv-layout-elegantni .inv-party { background: #faf5ff; }
.inv-layout-elegantni .inv-party:first-child { border-right-color: #e9d5ff; }
.inv-layout-elegantni .inv-party-tag { color: #7c3aed; }
.inv-layout-elegantni .inv-pay { border-color: #a78bfa; border-width: 1px; border-radius: 16px; }
.inv-layout-elegantni .inv-pay-title { color: #7c3aed; }
.inv-layout-elegantni .inv-pay-table .inv-pay-total td:last-child { color: #7c3aed; }
.inv-layout-elegantni .inv-dates { border-radius: 16px; border-color: #e9d5ff; background: #faf5ff; }
.inv-layout-elegantni .inv-date { border-right-color: #e9d5ff; }
.inv-layout-elegantni .inv-date-label { color: #7c3aed; }
.inv-layout-elegantni .inv-items thead { background: #faf5ff; }
.inv-layout-elegantni .inv-items thead th { color: #7c3aed; border-bottom-color: #e9d5ff; border-top-color: #e9d5ff; }
.inv-layout-elegantni .inv-items tbody td { border-bottom-color: #f3e8ff; }
.inv-layout-elegantni .inv-items tbody tr:last-child td { border-bottom-color: #e9d5ff; }
.inv-layout-elegantni .inv-sum { justify-content: center; }
.inv-layout-elegantni .inv-sum-total { border-top-color: #7c3aed; color: #1e1b4b; }
.inv-layout-elegantni .inv-note { background: #faf5ff; border-color: #e9d5ff; border-radius: 16px; }
.inv-layout-elegantni .inv-bottom { border-top-color: #e9d5ff; justify-content: center; text-align: center; display: block; }
.inv-layout-elegantni .inv-bottom .inv-foot { text-align: center; margin-top: 12px; }

/* Kompaktni */
.inv-layout-kompaktni { padding: 32px 36px 24px; font-size: 12px; }
.inv-layout-kompaktni .inv-accent { height: 3px; background: #059669; border-radius: 0; }
.inv-layout-kompaktni .inv-accent-bottom { height: 2px; background: #059669; border-radius: 0; opacity: 0.4; }
.inv-layout-kompaktni .inv-compact-top { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 16px; }
.inv-layout-kompaktni .inv-compact-top .inv-party { padding: 0; }
.inv-layout-kompaktni .inv-compact-top .inv-party-tag { margin-bottom: 4px; }
.inv-layout-kompaktni .inv-compact-top .inv-party-name { font-size: 13px; margin-bottom: 4px; }
.inv-layout-kompaktni .inv-compact-top .inv-party-detail { font-size: 10.5px; }
.inv-layout-kompaktni .inv-compact-top .inv-pay-details { padding: 0; }
.inv-layout-kompaktni .inv-compact-top .inv-pay-title { color: #059669; margin-bottom: 6px; }
.inv-layout-kompaktni .inv-compact-top .inv-pay-table td { font-size: 10.5px; padding: 2px 0; }
.inv-layout-kompaktni .inv-compact-top .inv-pay-table td:first-child { width: 90px; font-size: 10px; }
.inv-layout-kompaktni .inv-compact-top .inv-pay-table .inv-pay-total td:last-child { font-size: 14px; color: #059669; }
.inv-layout-kompaktni .inv-head { margin: 12px 0 16px; }
.inv-layout-kompaktni .inv-head-left h1 { color: #059669; font-size: 10px; }
.inv-layout-kompaktni .inv-head-left .inv-num { font-size: 22px; }
.inv-layout-kompaktni .inv-head-right .inv-company { font-size: 15px; }
.inv-layout-kompaktni .inv-dates-inline { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 14px; padding: 8px 12px; background: #f0fdf4; border: 1px solid #d1fae5; border-radius: 6px; }
.inv-layout-kompaktni .inv-dates-inline .inv-date { padding: 0; border-right: none; }
.inv-layout-kompaktni .inv-dates-inline .inv-date-label { color: #059669; font-size: 8px; }
.inv-layout-kompaktni .inv-dates-inline .inv-date-val { font-size: 12px; }
.inv-layout-kompaktni .inv-items tbody td { padding: 7px 10px; font-size: 11.5px; }
.inv-layout-kompaktni .inv-items thead th { padding: 7px 10px; }
.inv-layout-kompaktni .inv-sum { padding: 10px 0 16px; }
.inv-layout-kompaktni .inv-note { padding: 10px 14px; border-radius: 6px; }
.inv-layout-kompaktni .inv-bottom { padding-top: 14px; }
.inv-layout-kompaktni .inv-pay-standalone { border-color: #059669; border-radius: 6px; }
.inv-layout-kompaktni .inv-pay-standalone .inv-pay-title { color: #059669; }
.inv-layout-kompaktni .inv-pay-standalone .inv-pay-table .inv-pay-total td:last-child { color: #059669; }

@media print { body { padding: 0; } .inv { padding: 24px; } }
`;

const layoutPrintCSS = {
  klasicky: '',
  minimalisticky: `.inv-layout-minimalisticky{padding:56px 56px 40px}.inv-layout-minimalisticky .inv-head{text-align:center;display:block}.inv-layout-minimalisticky .inv-head h1{color:#64748b}.inv-layout-minimalisticky .inv-head .inv-num{font-size:36px;font-weight:300}.inv-layout-minimalisticky .inv-parties{border:none}.inv-layout-minimalisticky .inv-party:first-child{border-right:none}.inv-layout-minimalisticky .inv-items thead{background:transparent}.inv-layout-minimalisticky .inv-items thead th{border-top:none;border-bottom:1.5px solid #1e293b;color:#1e293b}`,
  korporatni: `.inv-layout-korporatni .inv-dark-header{background:#0f172a;margin:0 -48px;padding:28px 48px 24px;margin-bottom:28px}.inv-layout-korporatni .inv-dark-header h1{color:#94a3b8}.inv-layout-korporatni .inv-dark-header .inv-num{color:#fff}.inv-layout-korporatni .inv-dark-header .inv-company{color:#fff}.inv-layout-korporatni .inv-dark-header .inv-company-info{color:#94a3b8}.inv-layout-korporatni .inv-items thead{background:#0f172a}.inv-layout-korporatni .inv-items thead th{color:#e2e8f0}`,
  elegantni: `.inv-layout-elegantni .inv-accent{height:2px;background:linear-gradient(90deg,#c4b5fd,#8b5cf6,#c4b5fd)}.inv-layout-elegantni .inv-head{text-align:center;display:block}.inv-layout-elegantni .inv-head h1{color:#7c3aed}.inv-layout-elegantni .inv-head .inv-num{font-weight:300;font-size:34px}.inv-layout-elegantni .inv-parties{border-radius:16px;border-color:#e9d5ff}.inv-layout-elegantni .inv-party{background:#faf5ff}.inv-layout-elegantni .inv-items thead{background:#faf5ff}.inv-layout-elegantni .inv-items thead th{color:#7c3aed}.inv-layout-elegantni .inv-sum{justify-content:center}`,
  kompaktni: `.inv-layout-kompaktni{padding:32px 36px 24px;font-size:12px}.inv-layout-kompaktni .inv-accent{height:3px;background:#059669;border-radius:0}.inv-layout-kompaktni .inv-head-left h1{color:#059669}.inv-layout-kompaktni .inv-compact-top{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:16px}`,
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
  const layout = co.invoice_layout || 'klasicky';
  const isVatPayer = !!co.vat_payer;
  const bankFull = co.bank_account ? (co.bank_code ? `${co.bank_account}/${co.bank_code}` : co.bank_account) : null;
  const hasBankDetails = bankFull || co.iban;

  const taxByRate = {};
  (invoice.items || []).forEach(item => {
    const rate = item.tax_rate ?? 21;
    const base = item.total || (item.quantity * item.unit_price);
    const tax = item.tax_amount || (base * rate / 100);
    if (!taxByRate[rate]) taxByRate[rate] = { base: 0, tax: 0 };
    taxByRate[rate].base += base;
    taxByRate[rate].tax += tax;
  });

  // Shared content pieces
  const invTitle = invoice.invoice_type === 'proforma' ? 'Proforma faktura' : invoice.invoice_type === 'credit_note' ? 'Dobropis' : 'Faktura';
  const statusBadge = <span className={`inv-badge inv-badge-${invoice.status}`}>{statusLabels[invoice.status]}</span>;

  const supplierDetail = (
    <div className="inv-party-detail">
      {co.ico && <><strong>IČ:</strong> {co.ico}<br/></>}
      {co.dic && <><strong>DIČ:</strong> {co.dic}<br/></>}
      {co.address && <>{co.address}<br/></>}
      {co.city && <>{co.city} {co.zip}<br/></>}
      {co.email && <>{co.email}<br/></>}
      {co.phone && <>{co.phone}</>}
    </div>
  );

  const clientDetail = (
    <div className="inv-party-detail">
      {invoice.client_ico && <><strong>IČ:</strong> {invoice.client_ico}<br/></>}
      {invoice.client_dic && <><strong>DIČ:</strong> {invoice.client_dic}<br/></>}
      {invoice.client_address && <>{invoice.client_address}<br/></>}
      {invoice.client_city && <>{invoice.client_city} {invoice.client_zip}<br/></>}
      {invoice.client_email && <>{invoice.client_email}</>}
    </div>
  );

  const paymentRows = (
    <tbody>
      {bankFull && <tr><td>Číslo účtu</td><td>{bankFull}</td></tr>}
      {co.iban && <tr><td>IBAN</td><td>{co.iban}</td></tr>}
      {co.swift && <tr><td>SWIFT</td><td>{co.swift}</td></tr>}
      {invoice.variable_symbol && <tr className="inv-pay-vs"><td>Variabilní symbol</td><td>{invoice.variable_symbol}</td></tr>}
      <tr><td>Způsob úhrady</td><td>{paymentLabels[invoice.payment_method] || 'Bankovní převod'}</td></tr>
      <tr className="inv-pay-total"><td>K úhradě</td><td>{fmt(invoice.total, invoice.currency)}</td></tr>
    </tbody>
  );

  const itemsRows = (invoice.items || []).map((item, i) => {
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
  });

  const itemsHeader = (
    <tr>
      <th style={{ width: '40%' }}>Popis</th>
      <th className="r">Množství</th>
      <th>Jedn.</th>
      <th className="r">Cena/ks</th>
      {isVatPayer && <th className="r">DPH</th>}
      <th className="r">Celkem{isVatPayer ? ' bez DPH' : ''}</th>
      {isVatPayer && <th className="r">S DPH</th>}
    </tr>
  );

  const totalsContent = (
    <div className="inv-sum-box">
      {isVatPayer && <div className="inv-sum-row"><span>Základ</span><span>{fmt(invoice.subtotal, invoice.currency)}</span></div>}
      {isVatPayer && Object.entries(taxByRate).map(([rate, vals]) => (
        <div className="inv-sum-row" key={rate}><span>DPH {rate}%</span><span>{fmt(vals.tax, invoice.currency)}</span></div>
      ))}
      <div className="inv-sum-total"><span>Celkem</span><span>{fmt(invoice.total, invoice.currency)}</span></div>
      {invoice.currency !== 'CZK' && (
        <>
          <div className="inv-sum-czk"><span>Kurz {invoice.currency}/CZK</span><span>{(invoice.exchange_rate || (invoice.total ? invoice.total_czk / invoice.total : 1)).toFixed(4)}</span></div>
          <div className="inv-sum-czk"><span>V CZK</span><span>{fmt(invoice.total_czk, 'CZK')}</span></div>
        </>
      )}
    </div>
  );

  const datesContent = (
    <>
      <div className="inv-date"><div className="inv-date-label">Datum vystavení</div><div className="inv-date-val">{fmtDate(invoice.issue_date)}</div></div>
      {isVatPayer && <div className="inv-date"><div className="inv-date-label">DÚZP</div><div className="inv-date-val">{fmtDate(invoice.supply_date || invoice.issue_date)}</div></div>}
      <div className="inv-date"><div className="inv-date-label">Datum splatnosti</div><div className="inv-date-val">{fmtDate(invoice.due_date)}</div></div>
      {invoice.paid_date && <div className="inv-date"><div className="inv-date-label">Datum úhrady</div><div className="inv-date-val">{fmtDate(invoice.paid_date)}</div></div>}
      <div className="inv-date"><div className="inv-date-label">Měna</div><div className="inv-date-val">{invoice.currency}</div></div>
    </>
  );

  const noteContent = (
    <>
      {invoice.note && <div className="inv-note"><div className="inv-note-tag">Poznámka</div><div className="inv-note-text">{invoice.note}</div></div>}
      {!isVatPayer && <div className="inv-note"><div className="inv-note-text">Dodavatel není plátcem DPH.</div></div>}
    </>
  );

  const issuerContent = invoice.created_by_name && (
    <div>
      <div className="inv-issuer-tag">Vystavil/a</div>
      <div className="inv-issuer-name">{invoice.created_by_name}</div>
      {invoice.created_by_signature && <img src={invoice.created_by_signature} alt="Podpis" className="inv-sig" />}
    </div>
  );

  const footerInfo = <div className="inv-foot">{co.name}{co.ico && ` · IČ ${co.ico}`}{co.dic && ` · DIČ ${co.dic}`}</div>;

  // Layout-specific body renderers
  const renderKlasicky = () => (
    <>
      <div className="inv-accent"></div>
      <div className="inv-head">
        <div className="inv-head-left">
          <h1>{invTitle}</h1>
          <div className="inv-num">{invoice.invoice_number}</div>
          {statusBadge}
        </div>
        <div className="inv-head-right">
          {co.logo && <img src={co.logo} alt="Logo" style={{ maxWidth: 150, maxHeight: 50, objectFit: 'contain', marginBottom: 8, display: 'block', marginLeft: 'auto' }} />}
          <div className="inv-company">{co.name}</div>
          <div className="inv-company-info">
            {co.ico && <>IČO: {co.ico}<br/></>}{co.dic && <>DIČ: {co.dic}<br/></>}
            {co.address && <>{co.address}<br/></>}{co.city && <>{co.city} {co.zip}</>}
          </div>
        </div>
      </div>
      <div className="inv-parties">
        <div className="inv-party"><div className="inv-party-tag">Dodavatel</div><div className="inv-party-name">{co.name || '—'}</div>{supplierDetail}</div>
        <div className="inv-party"><div className="inv-party-tag">Odběratel</div><div className="inv-party-name">{invoice.client_name || '—'}</div>{clientDetail}</div>
      </div>
      {hasBankDetails && <div className="inv-pay"><div className="inv-pay-details"><div className="inv-pay-title">Platební údaje</div><table className="inv-pay-table">{paymentRows}</table></div>{qrData?.qr && <div className="inv-pay-qr"><img src={qrData.qr} alt="QR Platba" /><span>QR Platba</span></div>}</div>}
      <div className="inv-dates">{datesContent}</div>
      <table className="inv-items"><thead>{itemsHeader}</thead><tbody>{itemsRows}</tbody></table>
      <div className="inv-sum">{totalsContent}</div>
      {noteContent}
      <div className="inv-bottom">{issuerContent}<div />{footerInfo}</div>
      <div className="inv-accent-bottom"></div>
    </>
  );

  const renderMinimalisticky = () => (
    <>
      {/* Centered header - no accent bars, large light number */}
      <div className="inv-head">
        <h1>{invTitle}</h1>
        <div className="inv-num">{invoice.invoice_number}</div>
        {statusBadge}
        <div className="inv-company-sub">{co.name}{co.ico && ` · IČ ${co.ico}`}{co.dic && ` · DIČ ${co.dic}`}</div>
      </div>
      <hr className="inv-hr" />
      {/* Parties without borders */}
      <div className="inv-parties">
        <div className="inv-party"><div className="inv-party-tag">Dodavatel</div><div className="inv-party-name">{co.name || '—'}</div>{supplierDetail}</div>
        <div className="inv-party"><div className="inv-party-tag">Odběratel</div><div className="inv-party-name">{invoice.client_name || '—'}</div>{clientDetail}</div>
      </div>
      <hr className="inv-hr" />
      {/* Dates strip - transparent */}
      <div className="inv-dates">{datesContent}</div>
      {/* Payment - subtle border */}
      {hasBankDetails && <div className="inv-pay"><div className="inv-pay-details"><div className="inv-pay-title">Platební údaje</div><table className="inv-pay-table">{paymentRows}</table></div>{qrData?.qr && <div className="inv-pay-qr"><img src={qrData.qr} alt="QR Platba" /><span>QR Platba</span></div>}</div>}
      {/* Items - minimal header */}
      <table className="inv-items"><thead>{itemsHeader}</thead><tbody>{itemsRows}</tbody></table>
      <div className="inv-sum">{totalsContent}</div>
      {noteContent}
      <hr className="inv-hr" style={{ marginBottom: 0 }} />
      <div className="inv-bottom">{issuerContent}<div />{footerInfo}</div>
    </>
  );

  const renderKorporatni = () => (
    <>
      {/* Full-bleed dark header */}
      <div className="inv-dark-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div className="inv-head-left">
            <h1>{invTitle}</h1>
            <div className="inv-num">{invoice.invoice_number}</div>
            {statusBadge}
          </div>
          <div className="inv-head-right">
            {co.logo && <img src={co.logo} alt="Logo" style={{ maxWidth: 150, maxHeight: 50, objectFit: 'contain', marginBottom: 8, display: 'block', marginLeft: 'auto' }} />}
            <div className="inv-company">{co.name}</div>
            <div className="inv-company-info">
              {co.ico && <>IČO: {co.ico}<br/></>}{co.dic && <>DIČ: {co.dic}<br/></>}
              {co.address && <>{co.address}<br/></>}{co.city && <>{co.city} {co.zip}</>}
            </div>
          </div>
        </div>
      </div>
      {/* Payment first - prominent position */}
      {hasBankDetails && <div className="inv-pay"><div className="inv-pay-details"><div className="inv-pay-title">Platební údaje</div><table className="inv-pay-table">{paymentRows}</table></div>{qrData?.qr && <div className="inv-pay-qr"><img src={qrData.qr} alt="QR Platba" /><span>QR Platba</span></div>}</div>}
      {/* Parties */}
      <div className="inv-parties">
        <div className="inv-party"><div className="inv-party-tag">Dodavatel</div><div className="inv-party-name">{co.name || '—'}</div>{supplierDetail}</div>
        <div className="inv-party"><div className="inv-party-tag">Odběratel</div><div className="inv-party-name">{invoice.client_name || '—'}</div>{clientDetail}</div>
      </div>
      {/* Dates */}
      <div className="inv-dates">{datesContent}</div>
      {/* Items with dark header */}
      <table className="inv-items"><thead>{itemsHeader}</thead><tbody>{itemsRows}</tbody></table>
      <div className="inv-sum">{totalsContent}</div>
      {noteContent}
      <div className="inv-bottom">{issuerContent}<div />{footerInfo}</div>
    </>
  );

  const renderElegantni = () => (
    <>
      <div className="inv-accent"></div>
      {/* Centered header with logo */}
      <div className="inv-head">
        {co.logo && <img src={co.logo} alt="Logo" style={{ maxWidth: 120, maxHeight: 40, objectFit: 'contain', margin: '0 auto 12px', display: 'block' }} />}
        <h1>{invTitle}</h1>
        <div className="inv-num">{invoice.invoice_number}</div>
        {statusBadge}
        <div className="inv-company-sub">{co.name}</div>
      </div>
      {/* Parties with purple background */}
      <div className="inv-parties">
        <div className="inv-party"><div className="inv-party-tag">Dodavatel</div><div className="inv-party-name">{co.name || '—'}</div>{supplierDetail}</div>
        <div className="inv-party"><div className="inv-party-tag">Odběratel</div><div className="inv-party-name">{invoice.client_name || '—'}</div>{clientDetail}</div>
      </div>
      {/* Payment */}
      {hasBankDetails && <div className="inv-pay"><div className="inv-pay-details"><div className="inv-pay-title">Platební údaje</div><table className="inv-pay-table">{paymentRows}</table></div>{qrData?.qr && <div className="inv-pay-qr"><img src={qrData.qr} alt="QR Platba" /><span>QR Platba</span></div>}</div>}
      {/* Dates with purple */}
      <div className="inv-dates">{datesContent}</div>
      {/* Items */}
      <table className="inv-items"><thead>{itemsHeader}</thead><tbody>{itemsRows}</tbody></table>
      {/* Centered totals */}
      <div className="inv-sum">{totalsContent}</div>
      {noteContent}
      <div className="inv-bottom">
        <div style={{ textAlign: 'center', width: '100%' }}>
          {issuerContent}
          <div style={{ marginTop: 12 }}>{footerInfo}</div>
        </div>
      </div>
      <div className="inv-accent-bottom"></div>
    </>
  );

  const renderKompaktni = () => (
    <>
      <div className="inv-accent"></div>
      {/* Compact header */}
      <div className="inv-head">
        <div className="inv-head-left">
          <h1>{invTitle}</h1>
          <div className="inv-num">{invoice.invoice_number}</div>
          {statusBadge}
        </div>
        <div className="inv-head-right">
          {co.logo && <img src={co.logo} alt="Logo" style={{ maxWidth: 120, maxHeight: 40, objectFit: 'contain', marginBottom: 4, display: 'block', marginLeft: 'auto' }} />}
          <div className="inv-company">{co.name}</div>
          <div className="inv-company-info">{co.ico && <>IČ: {co.ico}</>}{co.dic && <> · DIČ: {co.dic}</>}</div>
        </div>
      </div>
      {/* 3-column: Supplier | Client | Payment */}
      <div className="inv-compact-top">
        <div className="inv-party"><div className="inv-party-tag">Dodavatel</div><div className="inv-party-name">{co.name || '—'}</div>{supplierDetail}</div>
        <div className="inv-party"><div className="inv-party-tag">Odběratel</div><div className="inv-party-name">{invoice.client_name || '—'}</div>{clientDetail}</div>
        {hasBankDetails ? (
          <div className="inv-pay-details"><div className="inv-pay-title">Platební údaje</div><table className="inv-pay-table">{paymentRows}</table></div>
        ) : <div />}
      </div>
      {/* Inline dates */}
      <div className="inv-dates-inline">{datesContent}</div>
      {/* Compact items */}
      <table className="inv-items"><thead>{itemsHeader}</thead><tbody>{itemsRows}</tbody></table>
      <div className="inv-sum">{totalsContent}</div>
      {noteContent}
      <div className="inv-bottom">{issuerContent}<div />{footerInfo}</div>
      <div className="inv-accent-bottom"></div>
    </>
  );

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
.inv-hr { border: none; border-top: 1px solid #cbd5e1; margin: 24px 0; }

/* Minimalisticky */
.inv-layout-minimalisticky { padding: 56px 56px 40px; }
.inv-layout-minimalisticky .inv-head { justify-content: center; text-align: center; display: block; margin: 0 0 0; }
.inv-layout-minimalisticky .inv-head h1 { color: #64748b; font-weight: 600; font-size: 11px; letter-spacing: 0.18em; }
.inv-layout-minimalisticky .inv-head .inv-num { font-size: 36px; font-weight: 300; color: var(--gray-900); letter-spacing: 0.02em; }
.inv-layout-minimalisticky .inv-head .inv-company-sub { font-size: 12px; color: var(--gray-400); margin-top: 8px; }
.inv-layout-minimalisticky .inv-parties { border: none; border-radius: 0; }
.inv-layout-minimalisticky .inv-party:first-child { border-right: none; padding-right: 40px; }
.inv-layout-minimalisticky .inv-pay { border-color: #cbd5e1; border-width: 1px; border-radius: 4px; }
.inv-layout-minimalisticky .inv-pay-title { color: #475569; }
.inv-layout-minimalisticky .inv-pay-table .inv-pay-total td:last-child { color: #1e293b; }
.inv-layout-minimalisticky .inv-dates { background: transparent; border: none; border-radius: 0; }
.inv-layout-minimalisticky .inv-date { border-right-color: var(--gray-200); }
.inv-layout-minimalisticky .inv-items thead { background: transparent; }
.inv-layout-minimalisticky .inv-items thead th { border-top: none; border-bottom: 1.5px solid #1e293b; color: #1e293b; font-weight: 600; }
.inv-layout-minimalisticky .inv-items tbody tr:last-child td { border-bottom: 1.5px solid #1e293b; }
.inv-layout-minimalisticky .inv-sum-total { border-top-color: #1e293b; }
.inv-layout-minimalisticky .inv-note { background: transparent; border: 1px solid var(--gray-200); border-radius: 4px; }
.inv-layout-minimalisticky .inv-bottom { border-top-color: #1e293b; }

/* Korporatni */
.inv-layout-korporatni .inv-dark-header { background: #0f172a; margin: 0 -48px; padding: 28px 48px 24px; margin-bottom: 28px; }
.inv-layout-korporatni .inv-dark-header h1 { color: #94a3b8; }
.inv-layout-korporatni .inv-dark-header .inv-num { color: #ffffff; font-size: 30px; }
.inv-layout-korporatni .inv-dark-header .inv-company { color: #ffffff; }
.inv-layout-korporatni .inv-dark-header .inv-company-info { color: #94a3b8; }
.inv-layout-korporatni .inv-dark-header img { filter: brightness(0) invert(1); }
.inv-layout-korporatni .inv-dark-header .inv-badge-draft { background: rgba(255,255,255,0.15); color: #e2e8f0; }
.inv-layout-korporatni .inv-dark-header .inv-badge-sent { background: rgba(99,102,241,0.3); color: #c7d2fe; }
.inv-layout-korporatni .inv-dark-header .inv-badge-paid { background: rgba(16,185,129,0.3); color: #a7f3d0; }
.inv-layout-korporatni .inv-dark-header .inv-badge-overdue { background: rgba(239,68,68,0.3); color: #fecaca; }
.inv-layout-korporatni .inv-pay { border-color: #0f172a; border-width: 2px; }
.inv-layout-korporatni .inv-pay-title { color: #0f172a; }
.inv-layout-korporatni .inv-pay-table .inv-pay-total td:last-child { color: #0f172a; }
.inv-layout-korporatni .inv-parties { border-color: #334155; border-radius: 4px; }
.inv-layout-korporatni .inv-party:first-child { border-right-color: #334155; }
.inv-layout-korporatni .inv-items thead { background: #0f172a; }
.inv-layout-korporatni .inv-items thead th { color: #e2e8f0; border-bottom-color: #0f172a; border-top-color: #0f172a; }
.inv-layout-korporatni .inv-sum-total { border-top-color: #0f172a; }
.inv-layout-korporatni .inv-bottom { border-top-color: #334155; }

/* Elegantni */
.inv-layout-elegantni .inv-accent { height: 2px; background: linear-gradient(90deg, #c4b5fd 0%, #8b5cf6 50%, #c4b5fd 100%); }
.inv-layout-elegantni .inv-accent-bottom { height: 2px; background: linear-gradient(90deg, #c4b5fd 0%, #8b5cf6 50%, #c4b5fd 100%); opacity: 0.6; }
.inv-layout-elegantni .inv-head { justify-content: center; text-align: center; display: block; margin: 24px 0 28px; }
.inv-layout-elegantni .inv-head h1 { color: #7c3aed; font-weight: 600; letter-spacing: 0.12em; }
.inv-layout-elegantni .inv-head .inv-num { font-weight: 300; font-size: 34px; color: #1e1b4b; }
.inv-layout-elegantni .inv-head .inv-company-sub { font-size: 12px; color: #a78bfa; margin-top: 6px; }
.inv-layout-elegantni .inv-parties { border-radius: 16px; border-color: #e9d5ff; }
.inv-layout-elegantni .inv-party { background: #faf5ff; }
.inv-layout-elegantni .inv-party:first-child { border-right-color: #e9d5ff; }
.inv-layout-elegantni .inv-party-tag { color: #7c3aed; }
.inv-layout-elegantni .inv-pay { border-color: #a78bfa; border-width: 1px; border-radius: 16px; }
.inv-layout-elegantni .inv-pay-title { color: #7c3aed; }
.inv-layout-elegantni .inv-pay-table .inv-pay-total td:last-child { color: #7c3aed; }
.inv-layout-elegantni .inv-dates { border-radius: 16px; border-color: #e9d5ff; background: #faf5ff; }
.inv-layout-elegantni .inv-date { border-right-color: #e9d5ff; }
.inv-layout-elegantni .inv-date-label { color: #7c3aed; }
.inv-layout-elegantni .inv-items thead { background: #faf5ff; }
.inv-layout-elegantni .inv-items thead th { color: #7c3aed; border-bottom-color: #e9d5ff; border-top-color: #e9d5ff; }
.inv-layout-elegantni .inv-items tbody td { border-bottom-color: #f3e8ff; }
.inv-layout-elegantni .inv-items tbody tr:last-child td { border-bottom-color: #e9d5ff; }
.inv-layout-elegantni .inv-sum { justify-content: center; }
.inv-layout-elegantni .inv-sum-total { border-top-color: #7c3aed; color: #1e1b4b; }
.inv-layout-elegantni .inv-note { background: #faf5ff; border-color: #e9d5ff; border-radius: 16px; }
.inv-layout-elegantni .inv-bottom { border-top-color: #e9d5ff; justify-content: center; text-align: center; display: block; }
.inv-layout-elegantni .inv-bottom .inv-foot { text-align: center; margin-top: 12px; }

/* Kompaktni */
.inv-layout-kompaktni { padding: 32px 36px 24px; font-size: 12px; }
.inv-layout-kompaktni .inv-accent { height: 3px; background: #059669; border-radius: 0; }
.inv-layout-kompaktni .inv-accent-bottom { height: 2px; background: #059669; border-radius: 0; opacity: 0.4; }
.inv-layout-kompaktni .inv-compact-top { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 16px; border: 1px solid var(--gray-200); border-radius: 8px; padding: 16px; }
.inv-layout-kompaktni .inv-compact-top .inv-party { padding: 0; }
.inv-layout-kompaktni .inv-compact-top .inv-party-tag { margin-bottom: 4px; }
.inv-layout-kompaktni .inv-compact-top .inv-party-name { font-size: 13px; margin-bottom: 4px; }
.inv-layout-kompaktni .inv-compact-top .inv-party-detail { font-size: 10.5px; }
.inv-layout-kompaktni .inv-compact-top .inv-pay-details { padding: 0; }
.inv-layout-kompaktni .inv-compact-top .inv-pay-title { color: #059669; margin-bottom: 6px; }
.inv-layout-kompaktni .inv-compact-top .inv-pay-table td { font-size: 10.5px; padding: 2px 0; }
.inv-layout-kompaktni .inv-compact-top .inv-pay-table td:first-child { width: 90px; font-size: 10px; }
.inv-layout-kompaktni .inv-compact-top .inv-pay-table .inv-pay-total td:last-child { font-size: 14px; color: #059669; }
.inv-layout-kompaktni .inv-head { margin: 12px 0 16px; }
.inv-layout-kompaktni .inv-head-left h1 { color: #059669; font-size: 10px; }
.inv-layout-kompaktni .inv-head-left .inv-num { font-size: 22px; }
.inv-layout-kompaktni .inv-head-right .inv-company { font-size: 15px; }
.inv-layout-kompaktni .inv-dates-inline { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 14px; padding: 8px 12px; background: #f0fdf4; border: 1px solid #d1fae5; border-radius: 6px; }
.inv-layout-kompaktni .inv-dates-inline .inv-date { padding: 0; border-right: none; }
.inv-layout-kompaktni .inv-dates-inline .inv-date-label { color: #059669; font-size: 8px; }
.inv-layout-kompaktni .inv-dates-inline .inv-date-val { font-size: 12px; }
.inv-layout-kompaktni .inv-items tbody td { padding: 7px 10px; font-size: 11.5px; }
.inv-layout-kompaktni .inv-items thead th { padding: 7px 10px; }
.inv-layout-kompaktni .inv-sum { padding: 10px 0 16px; }
.inv-layout-kompaktni .inv-note { padding: 10px 14px; border-radius: 6px; }
.inv-layout-kompaktni .inv-bottom { padding-top: 14px; }
      ` }} />

      <div ref={invoiceRef}>
        <div className={`inv inv-layout-${layout}`}>
          {layout === 'klasicky' && renderKlasicky()}
          {layout === 'minimalisticky' && renderMinimalisticky()}
          {layout === 'korporatni' && renderKorporatni()}
          {layout === 'elegantni' && renderElegantni()}
          {layout === 'kompaktni' && renderKompaktni()}
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

      {invoice.invoice_type === 'credit_note' && invoice.related_invoice_id && (
        <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#fef2f2', borderRadius: 'var(--radius)', border: '1px solid #fecaca' }}>
          Dobropis k faktuře: <Link to={`/invoices/${invoice.related_invoice_id}`} style={{ fontWeight: 600 }}>Zobrazit původní fakturu</Link>
        </div>
      )}

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
