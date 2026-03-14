import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../App';

const fmt = (v) => v != null ? Number(v).toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
const months = ['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec'];

function KontrolniHlaseniTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
                <th className="hide-mobile">Číslo dokladu</th>
                <th className="hide-mobile">Datum</th>
                <th style={{ textAlign: 'right' }}>Základ</th>
                <th style={{ textAlign: 'right' }}>DPH</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={i}>
                  <td>{r.dic || r.client_dic || '—'}</td>
                  <td className="hide-mobile">{r.invoice_number || r.evidence_number || '—'}</td>
                  <td className="hide-mobile">{r.date || r.issue_date || '—'}</td>
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
      {error && <div className="alert alert-error" onClick={() => setError('')}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="form-input" style={{ minWidth: 80, maxWidth: 120, flex: '0 1 auto' }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="form-input" style={{ minWidth: 100, maxWidth: 160, flex: '0 1 auto' }} value={month} onChange={e => setMonth(parseInt(e.target.value))}>
          {months.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <button className="btn btn-primary" onClick={load} disabled={loading}>
          {loading ? 'Načítání...' : 'Načíst'}
        </button>
        <button className="btn btn-ghost" onClick={exportXml}>Export XML</button>
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

function SouhrnneHlaseniTab() {
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

  const partners = data?.partners || [];
  const total = partners.reduce((s, p) => s + (p.total || 0), 0);

  return (
    <div>
      {error && <div className="alert alert-error" onClick={() => setError('')}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="form-input" style={{ minWidth: 80, maxWidth: 120, flex: '0 1 auto' }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="form-input" style={{ minWidth: 100, maxWidth: 200, flex: '0 1 auto' }} value={quarter} onChange={e => setQuarter(parseInt(e.target.value))}>
          <option value={1}>Q1 (leden–březen)</option>
          <option value={2}>Q2 (duben–červen)</option>
          <option value={3}>Q3 (červenec–září)</option>
          <option value={4}>Q4 (říjen–prosinec)</option>
        </select>
        <button className="btn btn-primary" onClick={load} disabled={loading}>
          {loading ? 'Načítání...' : 'Načíst'}
        </button>
        <button className="btn btn-ghost" onClick={exportXml}>Export XML</button>
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
                    <th className="hide-mobile">Kód plnění</th>
                    <th className="hide-mobile">Počet dokladů</th>
                    <th style={{ textAlign: 'right' }}>Celkem (CZK)</th>
                  </tr>
                </thead>
                <tbody>
                  {partners.map((p, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: 'monospace' }}>{p.dic}</td>
                      <td>{p.name || '—'}</td>
                      <td className="hide-mobile">{p.code || '0'}</td>
                      <td className="hide-mobile">{p.count}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700 }}>
                    <td colSpan={2}>Celkem</td>
                    <td className="hide-mobile"></td>
                    <td className="hide-mobile"></td>
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

function DanovePriznaniTab() {
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

  const KpiCard = ({ label, value, color }) => (
    <div className="card" style={{ padding: 16, flex: '1 1 200px', minWidth: 180 }}>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || '#1e293b' }}>{value}</div>
    </div>
  );

  return (
    <div>
      {error && <div className="alert alert-error" onClick={() => setError('')}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="form-input" style={{ minWidth: 80, maxWidth: 120, flex: '0 1 auto' }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
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

const tabs = [
  { id: 'kh', label: 'Kontrolní hlášení DPH' },
  { id: 'sh', label: 'Souhrnné hlášení' },
  { id: 'dp', label: 'Daňové přiznání DPFO' },
];

export default function FinancniUrad() {
  const [tab, setTab] = useState('kh');

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Finanční úřad</h2>

      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e2e8f0', marginBottom: 20, flexWrap: 'wrap', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: tab === t.id ? 700 : 400,
              color: tab === t.id ? 'var(--primary, #4f46e5)' : '#64748b',
              borderBottom: tab === t.id ? '2px solid var(--primary, #4f46e5)' : '2px solid transparent',
              marginBottom: -2,
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'kh' && <KontrolniHlaseniTab />}
      {tab === 'sh' && <SouhrnneHlaseniTab />}
      {tab === 'dp' && <DanovePriznaniTab />}
    </div>
  );
}
