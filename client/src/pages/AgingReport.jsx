import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

const fmt = (n) => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(n);

export default function AgingReport() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.getAgingReport().then(setData).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="loading">Načítání...</div>;
  if (!data) return <div className="empty-state">Nelze načíst data</div>;

  const { buckets, totals } = data;
  const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0);

  const bucketLabels = {
    current: 'Před splatností',
    '1_30': '1–30 dní po splatnosti',
    '31_60': '31–60 dní',
    '61_90': '61–90 dní',
    '90_plus': '90+ dní'
  };
  const bucketColors = { current: '#10b981', '1_30': '#f59e0b', '31_60': '#f97316', '61_90': '#ef4444', '90_plus': '#991b1b' };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Stárnutí pohledávek</h1>
        <a href="/api/export/invoices" className="btn btn-outline btn-sm" download>CSV Export</a>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: '1.5rem' }}>
        {Object.entries(bucketLabels).map(([key, label]) => (
          <div key={key} className="kpi-card" style={{ borderTop: `3px solid ${bucketColors[key]}` }}>
            <div className="kpi-label">{label}</div>
            <div className="kpi-value" style={{ color: bucketColors[key] }}>{fmt(totals[key] || 0)}</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{(buckets[key] || []).length} faktur</div>
          </div>
        ))}
      </div>

      <div className="kpi-card" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <div className="kpi-label">Celkem nezaplaceno</div>
        <div className="kpi-value primary" style={{ fontSize: '1.5rem' }}>{fmt(grandTotal)}</div>
      </div>

      {Object.entries(bucketLabels).map(([key, label]) => {
        const items = buckets[key] || [];
        if (items.length === 0) return null;
        return (
          <div key={key} className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-title" style={{ color: bucketColors[key], marginBottom: '0.75rem' }}>{label} ({items.length})</div>
            <div className="table-responsive">
              <table>
                <thead><tr><th>Faktura</th><th>Klient</th><th>Splatnost</th><th>Dní po</th><th className="text-right">Celkem</th><th className="text-right">Zbývá</th><th></th></tr></thead>
                <tbody>
                  {items.map(inv => (
                    <tr key={inv.id}>
                      <td><Link to={`/invoices/${inv.id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>{inv.invoice_number}</Link></td>
                      <td>{inv.client_name || '—'}</td>
                      <td>{inv.due_date}</td>
                      <td style={{ color: inv.daysPast > 0 ? bucketColors[key] : '#10b981', fontWeight: 600 }}>{inv.daysPast > 0 ? `${inv.daysPast}d` : 'OK'}</td>
                      <td className="text-right">{fmt(inv.total_czk || inv.total)}</td>
                      <td className="text-right" style={{ fontWeight: 600 }}>{fmt(inv.remaining)}</td>
                      <td><Link to={`/invoices/${inv.id}`} className="btn btn-outline btn-sm">Detail</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
