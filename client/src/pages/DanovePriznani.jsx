import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../App';
import { Link } from 'react-router-dom';

export default function DanovePriznani() {
  const { can } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear() - 1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try { setData(await api.getIncomeReport(year)); }
    catch (e) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [year]);

  const fmt = (v) => v != null ? Number(v).toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
  const fmtInt = (v) => v != null ? Math.round(Number(v)).toLocaleString('cs-CZ') : '—';

  const KpiCard = ({ label, value, sub, color }) => (
    <div className="card" style={{ padding: 16, flex: '1 1 200px', minWidth: 180 }}>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || '#1e293b' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2>Daňové přiznání – podklady DPFO</h2>
        <Link to="/vat" className="btn btn-ghost" style={{ fontSize: 13 }}>← Zpět na DPH</Link>
      </div>
      {error && <div className="alert alert-error" onClick={() => setError('')}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="form-input" style={{ width: 100 }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
          {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button className="btn btn-primary" onClick={load} disabled={loading}>
          {loading ? 'Načítání...' : 'Načíst podklady'}
        </button>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
        <p style={{ margin: 0, fontSize: 13, color: '#166534' }}>
          Podklady pro daňové přiznání k dani z příjmu fyzických osob (DPFO).
          Data vychází z uhrazených faktur a evidovaných nákladů za zvolený rok.
          Výpočet je orientační – pro finální přiznání konzultujte s daňovým poradcem.
        </p>
      </div>

      {data && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <KpiCard label="Příjmy (uhrazené faktury)" value={`${fmt(data.income)} Kč`} color="#059669" />
            <KpiCard label="Skutečné výdaje" value={`${fmt(data.expenses)} Kč`} color="#dc2626" />
            <KpiCard label="Zisk (příjmy − výdaje)" value={`${fmt(data.profit)} Kč`} color={data.profit >= 0 ? '#059669' : '#dc2626'} />
          </div>

          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 12px' }}>Paušální výdaje</h3>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
              Alternativní výpočet pomocí paušálních výdajů (bez nutnosti dokládat skutečné náklady).
            </p>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Sazba</th>
                    <th style={{ textAlign: 'right' }}>Paušální výdaje</th>
                    <th style={{ textAlign: 'right' }}>Základ daně</th>
                    <th>Poznámka</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>60 %</td>
                    <td style={{ textAlign: 'right' }}>{fmt(data.flat_rate_60)} Kč</td>
                    <td style={{ textAlign: 'right' }}>{fmt(data.income - data.flat_rate_60)} Kč</td>
                    <td style={{ fontSize: 12, color: '#888' }}>Většina živností, max 2 000 000 Kč</td>
                  </tr>
                  <tr>
                    <td>80 %</td>
                    <td style={{ textAlign: 'right' }}>{fmt(data.flat_rate_80)} Kč</td>
                    <td style={{ textAlign: 'right' }}>{fmt(data.income - data.flat_rate_80)} Kč</td>
                    <td style={{ fontSize: 12, color: '#888' }}>Řemeslné živnosti, max 1 600 000 Kč</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 12px' }}>Orientační výpočet daně</h3>
            <div className="table-responsive">
              <table className="table">
                <tbody>
                  {data.tax_base != null && (
                    <tr>
                      <td style={{ fontWeight: 600 }}>Základ daně (skutečné výdaje)</td>
                      <td style={{ textAlign: 'right' }}>{fmt(data.tax_base)} Kč</td>
                    </tr>
                  )}
                  {data.tax_15 != null && (
                    <tr>
                      <td>Daň 15 % (do 1 935 552 Kč)</td>
                      <td style={{ textAlign: 'right' }}>{fmt(data.tax_15)} Kč</td>
                    </tr>
                  )}
                  {data.tax_23 != null && data.tax_23 > 0 && (
                    <tr>
                      <td>Daň 23 % (nad 1 935 552 Kč)</td>
                      <td style={{ textAlign: 'right' }}>{fmt(data.tax_23)} Kč</td>
                    </tr>
                  )}
                  {data.tax_total != null && (
                    <tr style={{ fontWeight: 700, background: '#f8fafc' }}>
                      <td>Daň celkem (před slevami)</td>
                      <td style={{ textAlign: 'right' }}>{fmt(data.tax_total)} Kč</td>
                    </tr>
                  )}
                  {data.tax_after_discount != null && (
                    <tr style={{ fontWeight: 700, color: '#059669' }}>
                      <td>Daň po slevě na poplatníka (30 840 Kč)</td>
                      <td style={{ textAlign: 'right' }}>{fmt(Math.max(0, data.tax_after_discount))} Kč</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 12px' }}>Sociální a zdravotní pojištění</h3>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Pojištění</th>
                    <th style={{ textAlign: 'right' }}>Vyměřovací základ (50 %)</th>
                    <th style={{ textAlign: 'right' }}>Sazba</th>
                    <th style={{ textAlign: 'right' }}>Roční odvod</th>
                    <th style={{ textAlign: 'right' }}>Měsíční záloha</th>
                  </tr>
                </thead>
                <tbody>
                  {data.social && (
                    <tr>
                      <td>Sociální pojištění (ČSSZ)</td>
                      <td style={{ textAlign: 'right' }}>{fmt(data.social.base)} Kč</td>
                      <td style={{ textAlign: 'right' }}>29,2 %</td>
                      <td style={{ textAlign: 'right' }}>{fmt(data.social.yearly)} Kč</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(data.social.monthly)} Kč</td>
                    </tr>
                  )}
                  {data.health && (
                    <tr>
                      <td>Zdravotní pojištění (ZP)</td>
                      <td style={{ textAlign: 'right' }}>{fmt(data.health.base)} Kč</td>
                      <td style={{ textAlign: 'right' }}>13,5 %</td>
                      <td style={{ textAlign: 'right' }}>{fmt(data.health.yearly)} Kč</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(data.health.monthly)} Kč</td>
                    </tr>
                  )}
                </tbody>
                {data.social && data.health && (
                  <tfoot>
                    <tr style={{ fontWeight: 700 }}>
                      <td colSpan={3}>Celkem odvody ročně</td>
                      <td style={{ textAlign: 'right' }}>{fmt(data.social.yearly + data.health.yearly)} Kč</td>
                      <td style={{ textAlign: 'right' }}>{fmt(data.social.monthly + data.health.monthly)} Kč</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {data.vat_output != null && (
            <div className="card" style={{ padding: 16 }}>
              <h3 style={{ margin: '0 0 12px' }}>DPH za rok {year}</h3>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <KpiCard label="DPH na výstupu" value={`${fmt(data.vat_output)} Kč`} />
                <KpiCard label="DPH na vstupu" value={`${fmt(data.vat_input)} Kč`} />
                <KpiCard label="DPH k úhradě" value={`${fmt(data.vat_output - data.vat_input)} Kč`} color={(data.vat_output - data.vat_input) > 0 ? '#dc2626' : '#059669'} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
