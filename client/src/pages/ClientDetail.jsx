import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { usePageTitle } from '../App';

const fmtDate = (d) => { if (!d) return '—'; const p = d.slice(0,10).split('-'); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : d; };
const fmt = (n, cur = 'CZK') => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(n);
const statusLabels = { draft: 'Koncept', sent: 'Odesláno', paid: 'Zaplaceno', overdue: 'Po splatnosti', cancelled: 'Zrušeno' };

export default function ClientDetail() {
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  usePageTitle(client ? client.name : undefined);

  useEffect(() => {
    Promise.all([api.getClient(id), api.getClientInvoices(id)])
      .then(([c, inv]) => { setClient(c); setInvoices(inv); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="loading">Načítání...</div>;
  if (!client) return <div className="empty-state">Klient nenalezen</div>;

  const totalInvoiced = invoices.reduce((s, i) => s + (i.total_czk || 0), 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total_czk || 0), 0);
  const totalUnpaid = invoices.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((s, i) => s + (i.total_czk || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <Link to="/clients" className="btn btn-outline btn-sm" style={{ marginBottom: '0.5rem' }}>← Zpět na klienty</Link>
          <h1 className="page-title">{client.name}</h1>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="card">
          <div className="card-title" style={{ marginBottom: '1rem' }}>Kontaktní údaje</div>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gray-500)', marginBottom: 4 }}>Název</div>
              <div style={{ fontSize: '1rem', fontWeight: 600 }}>{client.name}</div>
            </div>
            {client.ico && <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gray-500)', marginBottom: 4 }}>IČO</div>
              <div style={{ fontSize: '1rem', fontWeight: 600 }}>{client.ico}</div>
            </div>}
            {client.dic && <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gray-500)', marginBottom: 4 }}>DIČ</div>
              <div style={{ fontSize: '1rem', fontWeight: 600 }}>{client.dic}</div>
            </div>}
            {client.email && <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gray-500)', marginBottom: 4 }}>Email</div>
              <div style={{ fontSize: '1rem' }}>{client.email}</div>
            </div>}
            {client.phone && <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gray-500)', marginBottom: 4 }}>Telefon</div>
              <div style={{ fontSize: '1rem' }}>{client.phone}</div>
            </div>}
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: '1rem' }}>Adresa a statistiky</div>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {(client.address || client.city) && <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gray-500)', marginBottom: 4 }}>Adresa</div>
              <div style={{ fontSize: '1rem' }}>
                {client.address && <>{client.address}<br/></>}
                {client.city} {client.zip}
                {client.country && client.country !== 'CZ' && <>, {client.country}</>}
              </div>
            </div>}
            {client.note && <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gray-500)', marginBottom: 4 }}>Poznámka</div>
              <div style={{ fontSize: '1rem' }}>{client.note}</div>
            </div>}
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gray-500)', marginBottom: 4 }}>Vytvořen</div>
              <div style={{ fontSize: '1rem' }}>{fmtDate(client.created_at)}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gray-500)', marginBottom: 4 }}>Fakturováno</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{fmt(totalInvoiced)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gray-500)', marginBottom: 4 }}>Zaplaceno</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--success)' }}>{fmt(totalPaid)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gray-500)', marginBottom: 4 }}>Nezaplaceno</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--danger)' }}>{fmt(totalUnpaid)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-title" style={{ marginBottom: '1rem' }}>Faktury ({invoices.length})</div>
        {invoices.length === 0 ? <div className="empty-state">Žádné faktury</div> : (
          <div className="table-responsive">
            <table>
              <thead><tr><th>Číslo</th><th>Datum vystavení</th><th>Splatnost</th><th className="text-right">Částka</th><th>Měna</th><th>Stav</th></tr></thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td><Link to={`/invoices/${inv.id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>{inv.invoice_number}</Link></td>
                    <td>{fmtDate(inv.issue_date)}</td>
                    <td>{fmtDate(inv.due_date)}</td>
                    <td className="text-right">{fmt(inv.total, inv.currency)}</td>
                    <td>{inv.currency}</td>
                    <td><span className={`badge badge-${inv.status}`}>{statusLabels[inv.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
