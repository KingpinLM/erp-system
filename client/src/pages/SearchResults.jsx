import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../api';

const typeLabels = { income: 'Příjem', expense: 'Výdaj' };
const statusLabels = { draft: 'Koncept', sent: 'Odesláno', paid: 'Zaplaceno', overdue: 'Po splatnosti', cancelled: 'Storno' };

function HighlightText({ text, query }) {
  if (!text || !query) return <>{text}</>;
  const str = String(text);
  const idx = str.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{str}</>;
  return <>{str.slice(0, idx)}<mark style={{ background: '#fef08a', padding: 0, borderRadius: 2 }}>{str.slice(idx, idx + query.length)}</mark>{str.slice(idx + query.length)}</>;
}

export default function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [q, setQ] = useState(query);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    setQ(query);
    if (!query || query.length < 2) { setResults(null); return; }
    setLoading(true);
    api.search(query).then(r => { setResults(r); setLoading(false); }).catch(() => setLoading(false));
  }, [query]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (q.trim().length >= 2) {
      setSearchParams({ q: q.trim() });
    }
  };

  const totalCount = results ? (results.invoices?.length || 0) + (results.clients?.length || 0) + (results.evidence?.length || 0) : 0;
  const invoiceCount = results?.invoices?.length || 0;
  const clientCount = results?.clients?.length || 0;
  const evidenceCount = results?.evidence?.length || 0;

  const tabs = [
    { key: 'all', label: 'Vše', count: totalCount },
    { key: 'invoices', label: 'Faktury', count: invoiceCount },
    { key: 'clients', label: 'Klienti', count: clientCount },
    { key: 'evidence', label: 'Evidence', count: evidenceCount },
  ];

  const showInvoices = (activeTab === 'all' || activeTab === 'invoices') && invoiceCount > 0;
  const showClients = (activeTab === 'all' || activeTab === 'clients') && clientCount > 0;
  const showEvidence = (activeTab === 'all' || activeTab === 'evidence') && evidenceCount > 0;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Výsledky vyhledávání</h1>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, maxWidth: 600 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input className="form-input" value={q} onChange={e => setQ(e.target.value)}
              placeholder="Hledat faktury, klienty, evidenci..."
              style={{ fontSize: 15, padding: '10px 14px 10px 38px', borderRadius: 10, width: '100%' }}
              autoFocus
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ borderRadius: 10, padding: '10px 20px' }}>Hledat</button>
        </form>
      </div>

      {loading && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8' }}>
          <span className="search-spinner" style={{ marginRight: 8 }} />Hledám „{query}"...
        </div>
      )}

      {!loading && results && totalCount === 0 && (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Žádné výsledky</div>
          <div style={{ color: '#94a3b8' }}>Pro dotaz „<strong>{query}</strong>" nebyly nalezeny žádné výsledky.</div>
          <div style={{ color: '#94a3b8', marginTop: 8, fontSize: 13 }}>Zkuste jiný výraz nebo zkontrolujte překlepy.</div>
        </div>
      )}

      {!loading && results && totalCount > 0 && (
        <>
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--gray-200)', paddingBottom: 0 }}>
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
                  fontWeight: activeTab === tab.key ? 700 : 500, fontSize: 13,
                  color: activeTab === tab.key ? 'var(--primary)' : '#64748b',
                  borderBottom: activeTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
                  marginBottom: -1, transition: 'all 0.15s'
                }}>
                {tab.label} <span style={{ background: activeTab === tab.key ? 'var(--primary-50)' : 'var(--gray-100)', padding: '1px 6px', borderRadius: 10, fontSize: 11, marginLeft: 4 }}>{tab.count}</span>
              </button>
            ))}
          </div>

          <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
            Nalezeno <strong>{totalCount}</strong> výsledků pro „<strong>{query}</strong>"
          </div>

          {showInvoices && (
            <div style={{ marginBottom: 24 }}>
              {activeTab === 'all' && <h3 style={{ fontSize: 14, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Faktury ({invoiceCount})</h3>}
              <div className="card" style={{ overflow: 'hidden' }}>
                <table className="table" style={{ marginBottom: 0 }}>
                  <thead>
                    <tr><th>Číslo faktury</th><th>Klient</th><th>Částka</th><th>Stav</th><th></th></tr>
                  </thead>
                  <tbody>
                    {results.invoices.map(i => (
                      <tr key={i.id}>
                        <td><strong><HighlightText text={i.invoice_number} query={query} /></strong></td>
                        <td><HighlightText text={i.client_name || '—'} query={query} /></td>
                        <td>{i.total?.toLocaleString('cs-CZ')} {i.currency}</td>
                        <td><span className={`badge badge-${i.status}`}>{statusLabels[i.status] || i.status}</span></td>
                        <td><Link to={`/invoices/${i.id}`} className="btn btn-sm" style={{ fontSize: 12 }}>Detail</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {showClients && (
            <div style={{ marginBottom: 24 }}>
              {activeTab === 'all' && <h3 style={{ fontSize: 14, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Klienti ({clientCount})</h3>}
              <div className="card" style={{ overflow: 'hidden' }}>
                <table className="table" style={{ marginBottom: 0 }}>
                  <thead>
                    <tr><th>Název</th><th>IČO</th><th>Email</th><th>Město</th><th></th></tr>
                  </thead>
                  <tbody>
                    {results.clients.map(c => (
                      <tr key={c.id}>
                        <td><strong><HighlightText text={c.name} query={query} /></strong></td>
                        <td><HighlightText text={c.ico || '—'} query={query} /></td>
                        <td><HighlightText text={c.email || '—'} query={query} /></td>
                        <td>{c.city || '—'}</td>
                        <td><Link to={`/clients/${c.id}`} className="btn btn-sm" style={{ fontSize: 12 }}>Detail</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {showEvidence && (
            <div style={{ marginBottom: 24 }}>
              {activeTab === 'all' && <h3 style={{ fontSize: 14, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Evidence ({evidenceCount})</h3>}
              <div className="card" style={{ overflow: 'hidden' }}>
                <table className="table" style={{ marginBottom: 0 }}>
                  <thead>
                    <tr><th>Název</th><th>Typ</th><th>Částka</th><th>Datum</th><th></th></tr>
                  </thead>
                  <tbody>
                    {results.evidence.map(e => (
                      <tr key={e.id}>
                        <td><strong><HighlightText text={e.title} query={query} /></strong></td>
                        <td>{typeLabels[e.type] || e.type}</td>
                        <td>{e.amount?.toLocaleString('cs-CZ')} {e.currency}</td>
                        <td>{e.date}</td>
                        <td><Link to="/evidence" className="btn btn-sm" style={{ fontSize: 12 }}>Přejít</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
