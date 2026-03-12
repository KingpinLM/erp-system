import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../App';

export default function Currencies() {
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingCode, setEditingCode] = useState(null);
  const [newRate, setNewRate] = useState('');
  const { can } = useAuth();

  const load = () => { setLoading(true); api.getCurrencies().then(setCurrencies).finally(() => setLoading(false)); };
  useEffect(load, []);

  const saveRate = async (code) => {
    await api.updateCurrency(code, parseFloat(newRate));
    setEditingCode(null);
    load();
  };

  const refreshRates = async () => {
    setRefreshing(true);
    try {
      const updated = await api.refreshCurrencies();
      setCurrencies(updated);
    } catch (e) { /* ignore */ }
    setRefreshing(false);
  };

  const fmtDate = (d) => {
    if (!d) return '—';
    const parts = d.slice(0, 10).split('-');
    if (parts.length !== 3) return d;
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Správa měn</h1>
        {can('admin') && (
          <button className="btn btn-primary" onClick={refreshRates} disabled={refreshing}>
            {refreshing ? 'Aktualizuji...' : 'Aktualizovat z ČNB'}
          </button>
        )}
      </div>

      <div className="card">
        <p style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--gray-500)' }}>
          Kurzy jsou vztaženy k CZK (Česká koruna). Např. 1 EUR = 25.20 CZK. Kurzy se automaticky aktualizují z ČNB.
        </p>
        {loading ? <div className="loading">Načítání...</div> : (
          <div className="table-responsive">
            <table>
              <thead><tr><th>Kód</th><th>Název</th><th>Symbol</th><th className="text-right">Kurz k CZK</th><th>Poslední změna</th><th>Akce</th></tr></thead>
              <tbody>
                {currencies.map(c => (
                  <tr key={c.code}>
                    <td><strong>{c.code}</strong></td>
                    <td>{c.name}</td>
                    <td style={{ fontSize: '1.2rem' }}>{c.symbol}</td>
                    <td className="text-right">
                      {editingCode === c.code ? (
                        <input className="form-input" type="number" step="0.01" value={newRate} onChange={e => setNewRate(e.target.value)}
                          style={{ width: '120px', display: 'inline-block' }} autoFocus />
                      ) : (
                        <strong>{c.rate_to_czk.toFixed(2)}</strong>
                      )}
                    </td>
                    <td>{fmtDate(c.updated_at)}</td>
                    <td>
                      {can('admin', 'accountant') && c.code !== 'CZK' && (
                        editingCode === c.code ? (
                          <div className="btn-group">
                            <button className="btn btn-success btn-sm" onClick={() => saveRate(c.code)}>Uložit</button>
                            <button className="btn btn-outline btn-sm" onClick={() => setEditingCode(null)}>Zrušit</button>
                          </div>
                        ) : (
                          <button className="btn btn-outline btn-sm" onClick={() => { setEditingCode(c.code); setNewRate(c.rate_to_czk.toString()); }}>Upravit kurz</button>
                        )
                      )}
                    </td>
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
