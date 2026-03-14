import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../App';

export default function VatReport() {
  const { can } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadReport = async () => {
    setLoading(true); setError('');
    try { setReport(await api.getVatReport(year, month)); }
    catch (e) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { loadReport(); }, [year, month]);

  const generate = async () => {
    try {
      const r = await api.generateVatRecords(year, month);
      setSuccess(`Vygenerováno ${r.generated} záznamů DPH`);
      loadReport();
    } catch (e) { setError(e.message); }
  };

  const exportXml = () => {
    window.open(`/api/vat/export-xml?year=${year}&month=${month}`, '_blank');
  };

  const months = ['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec'];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>DPH přiznání</h2>
      </div>
      {error && <div className="alert alert-error" onClick={() => setError('')}>{error}</div>}
      {success && <div className="alert alert-success" onClick={() => setSuccess('')}>{success}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="form-input" style={{ width: 100 }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="form-input" style={{ width: 140 }} value={month} onChange={e => setMonth(parseInt(e.target.value))}>
          {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        {can('admin', 'accountant') && <>
          <button className="btn btn-primary" onClick={generate}>Generovat z faktur</button>
          <button className="btn btn-secondary" onClick={exportXml}>Export XML</button>
        </>}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Link to="/financni-urad" className="btn btn-ghost">Finanční úřad (KH, SH, DPFO)</Link>
      </div>

      {loading ? <p>Načítání...</p> : report && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>DPH na výstupu (vydané faktury)</h3>
            <table className="table">
              <thead><tr><th>Sazba</th><th style={{ textAlign: 'right' }}>Základ</th><th style={{ textAlign: 'right' }}>DPH</th></tr></thead>
              <tbody>
                {report.output.map((r, i) => (
                  <tr key={i}>
                    <td>{r.vat_rate}%</td>
                    <td style={{ textAlign: 'right' }}>{r.base.toLocaleString('cs', { minimumFractionDigits: 2 })} Kč</td>
                    <td style={{ textAlign: 'right' }}>{r.tax.toLocaleString('cs', { minimumFractionDigits: 2 })} Kč</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700, borderTop: '2px solid #e2e8f0' }}>
                  <td>Celkem</td>
                  <td style={{ textAlign: 'right' }}>{report.output.reduce((s, r) => s + r.base, 0).toLocaleString('cs', { minimumFractionDigits: 2 })} Kč</td>
                  <td style={{ textAlign: 'right' }}>{report.totalOutput.toLocaleString('cs', { minimumFractionDigits: 2 })} Kč</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 12 }}>DPH na vstupu (přijaté faktury)</h3>
            <table className="table">
              <thead><tr><th>Sazba</th><th style={{ textAlign: 'right' }}>Základ</th><th style={{ textAlign: 'right' }}>DPH</th></tr></thead>
              <tbody>
                {report.input.map((r, i) => (
                  <tr key={i}>
                    <td>{r.vat_rate}%</td>
                    <td style={{ textAlign: 'right' }}>{r.base.toLocaleString('cs', { minimumFractionDigits: 2 })} Kč</td>
                    <td style={{ textAlign: 'right' }}>{r.tax.toLocaleString('cs', { minimumFractionDigits: 2 })} Kč</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700, borderTop: '2px solid #e2e8f0' }}>
                  <td>Celkem</td>
                  <td style={{ textAlign: 'right' }}>{report.input.reduce((s, r) => s + r.base, 0).toLocaleString('cs', { minimumFractionDigits: 2 })} Kč</td>
                  <td style={{ textAlign: 'right' }}>{report.totalInput.toLocaleString('cs', { minimumFractionDigits: 2 })} Kč</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h3 style={{ marginBottom: 12 }}>Výsledek</h3>
            <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div className="kpi-card">
                <div className="kpi-label">DPH na výstupu</div>
                <div className="kpi-value" style={{ color: '#ef4444' }}>{report.totalOutput.toLocaleString('cs', { minimumFractionDigits: 2 })} Kč</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">DPH na vstupu (nárok)</div>
                <div className="kpi-value" style={{ color: '#22c55e' }}>{report.totalInput.toLocaleString('cs', { minimumFractionDigits: 2 })} Kč</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">{report.liability >= 0 ? 'Daňová povinnost' : 'Nadměrný odpočet'}</div>
                <div className="kpi-value" style={{ color: report.liability >= 0 ? '#ef4444' : '#22c55e', fontSize: 28 }}>
                  {Math.abs(report.liability).toLocaleString('cs', { minimumFractionDigits: 2 })} Kč
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
