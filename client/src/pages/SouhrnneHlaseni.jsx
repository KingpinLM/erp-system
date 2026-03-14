import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../App';
import { Link } from 'react-router-dom';

export default function SouhrnneHlaseni() {
  const { can } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try { setData(await api.getSouhrnneHlaseni(year, quarter)); }
    catch (e) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [year, quarter]);

  const exportXml = () => {
    const token = localStorage.getItem('erp_token');
    window.open(`/api/vat/souhrnne-hlaseni-xml?year=${year}&quarter=${quarter}&token=${token}`, '_blank');
  };

  const fmt = (v) => v != null ? Number(v).toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

  const partners = data?.partners || [];
  const total = partners.reduce((s, p) => s + (p.total || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2>Souhrnné hlášení</h2>
        <Link to="/vat" className="btn btn-ghost" style={{ fontSize: 13 }}>← Zpět na DPH</Link>
      </div>
      {error && <div className="alert alert-error" onClick={() => setError('')}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="form-input" style={{ width: 100 }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="form-input" style={{ width: 140 }} value={quarter} onChange={e => setQuarter(parseInt(e.target.value))}>
          <option value={1}>Q1 (leden–březen)</option>
          <option value={2}>Q2 (duben–červen)</option>
          <option value={3}>Q3 (červenec–září)</option>
          <option value={4}>Q4 (říjen–prosinec)</option>
        </select>
        <button className="btn btn-primary" onClick={load} disabled={loading}>
          {loading ? 'Načítání...' : 'Načíst'}
        </button>
        <button className="btn btn-ghost" onClick={exportXml} title="Export XML pro EPO portál">
          📄 Export XML
        </button>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16, background: '#fefce8', border: '1px solid #fde68a' }}>
        <p style={{ margin: 0, fontSize: 13, color: '#92400e' }}>
          Souhrnné hlášení se podává čtvrtletně a obsahuje přehled plnění do jiných členských států EU.
          Podává se elektronicky přes portál EPO Finanční správy.
        </p>
      </div>

      {data && (
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ margin: '0 0 12px' }}>Plnění do EU – {quarter}. čtvrtletí {year}</h3>
          {partners.length === 0 ? (
            <p style={{ color: '#888' }}>Žádná plnění do EU v tomto období.</p>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>DIČ partnera</th>
                    <th>Název</th>
                    <th>Kód plnění</th>
                    <th>Počet dokladů</th>
                    <th style={{ textAlign: 'right' }}>Celkem (CZK)</th>
                  </tr>
                </thead>
                <tbody>
                  {partners.map((p, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: 'monospace' }}>{p.dic}</td>
                      <td>{p.name || '—'}</td>
                      <td>{p.code || '0'}</td>
                      <td>{p.count}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700 }}>
                    <td colSpan={4}>Celkem</td>
                    <td style={{ textAlign: 'right' }}>{fmt(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
