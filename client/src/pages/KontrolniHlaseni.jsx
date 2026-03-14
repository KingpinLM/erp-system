import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../App';
import { Link } from 'react-router-dom';

export default function KontrolniHlaseni() {
  const { can } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const months = ['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec'];

  const load = async () => {
    setLoading(true); setError('');
    try { setData(await api.getKontrolniHlaseni(year, month)); }
    catch (e) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [year, month]);

  const exportXml = () => {
    const token = localStorage.getItem('erp_token');
    window.open(`/api/vat/kontrolni-hlaseni-xml?year=${year}&month=${month}&token=${token}`, '_blank');
  };

  const fmt = (v) => v != null ? Number(v).toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

  const renderSection = (title, records) => {
    if (!records || records.length === 0) return (
      <div style={{ marginBottom: 16 }}>
        <h4 style={{ margin: '8px 0' }}>{title}</h4>
        <p style={{ color: '#888', fontSize: 13 }}>Žádné záznamy</p>
      </div>
    );
    return (
      <div style={{ marginBottom: 16 }}>
        <h4 style={{ margin: '8px 0' }}>{title} ({records.length})</h4>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>DIČ odběratele</th>
                <th>Číslo dokladu</th>
                <th>Datum</th>
                <th style={{ textAlign: 'right' }}>Základ</th>
                <th style={{ textAlign: 'right' }}>DPH</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={i}>
                  <td>{r.dic || r.client_dic || '—'}</td>
                  <td>{r.invoice_number || r.evidence_number || '—'}</td>
                  <td>{r.date || r.issue_date || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(r.base)}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(r.vat)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2>Kontrolní hlášení DPH</h2>
        <Link to="/vat" className="btn btn-ghost" style={{ fontSize: 13 }}>← Zpět na DPH</Link>
      </div>
      {error && <div className="alert alert-error" onClick={() => setError('')}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="form-input" style={{ width: 100 }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="form-input" style={{ width: 140 }} value={month} onChange={e => setMonth(parseInt(e.target.value))}>
          {months.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <button className="btn btn-primary" onClick={load} disabled={loading}>
          {loading ? 'Načítání...' : 'Načíst'}
        </button>
        <button className="btn btn-ghost" onClick={exportXml} title="Export XML pro EPO portál">
          📄 Export XML
        </button>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16, background: '#f0f9ff', border: '1px solid #bae6fd' }}>
        <p style={{ margin: 0, fontSize: 13, color: '#0369a1' }}>
          Kontrolní hlášení se podává měsíčně na Finanční správu přes portál EPO.
          Obsahuje přijatá a uskutečněná zdanitelná plnění nad/pod 10 000 Kč.
        </p>
      </div>

      {data && (
        <>
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 12px' }}>Oddíl A – Uskutečněná plnění (výstup)</h3>
            {renderSection('A.4 – Plnění nad 10 000 Kč', data.sectionA?.A4)}
            {renderSection('A.5 – Plnění do 10 000 Kč', data.sectionA?.A5)}
          </div>
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ margin: '0 0 12px' }}>Oddíl B – Přijatá plnění (vstup)</h3>
            {renderSection('B.2 – Plnění nad 10 000 Kč', data.sectionB?.B2)}
            {renderSection('B.3 – Plnění do 10 000 Kč', data.sectionB?.B3)}
          </div>
        </>
      )}
    </div>
  );
}
