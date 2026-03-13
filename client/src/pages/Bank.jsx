import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../App';

export default function Bank() {
  const { can } = useAuth();
  const [tab, setTab] = useState('accounts');
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [filter, setFilter] = useState({ status: '', from: '', to: '' });
  const [editAccount, setEditAccount] = useState(null);

  useEffect(() => { loadAccounts(); }, []);
  useEffect(() => { if (tab === 'transactions') loadTransactions(); }, [tab, selectedAccount]);

  const loadAccounts = async () => {
    try { setAccounts(await api.getBankAccounts()); }
    catch (e) { setError(e.message); }
    setLoading(false);
  };

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const params = { ...filter };
      if (selectedAccount) params.bank_account_id = selectedAccount;
      setTransactions(await api.getBankTransactions(params));
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    data.initial_balance = parseFloat(data.initial_balance) || 0;
    try {
      if (editAccount) await api.updateBankAccount(editAccount.id, data);
      else await api.createBankAccount(data);
      setShowForm(false); setEditAccount(null); loadAccounts();
    } catch (e) { setError(e.message); }
  };

  const autoMatch = async () => {
    try {
      const r = await api.autoMatchTransactions();
      setSuccess(`Automaticky spárováno ${r.matched} transakcí`);
      loadTransactions();
    } catch (e) { setError(e.message); }
  };

  const matchManually = async (txnId, invoiceId) => {
    try {
      await api.matchTransaction(txnId, invoiceId || null);
      loadTransactions();
    } catch (e) { setError(e.message); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Banka</h2>
      </div>
      {error && <div className="alert alert-error" onClick={() => setError('')}>{error}</div>}
      {success && <div className="alert alert-success" onClick={() => setSuccess('')}>{success}</div>}

      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[['accounts', 'Bankovní účty'], ['transactions', 'Transakce']].map(([k, l]) => (
          <button key={k} className={`btn ${tab === k ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'accounts' && (
        <>
          {can('admin', 'accountant') && <button className="btn btn-primary" style={{ marginBottom: 12 }} onClick={() => { setEditAccount(null); setShowForm(true); }}>+ Nový účet</button>}

          {showForm && (
            <div className="modal-overlay" onClick={() => setShowForm(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <h3>{editAccount ? 'Upravit účet' : 'Nový bankovní účet'}</h3>
                <form onSubmit={handleSaveAccount}>
                  <label>Název *<input name="name" className="form-input" defaultValue={editAccount?.name} required /></label>
                  <div className="form-row">
                    <label>Číslo účtu<input name="account_number" className="form-input" defaultValue={editAccount?.account_number} /></label>
                    <label>IBAN<input name="iban" className="form-input" defaultValue={editAccount?.iban} /></label>
                  </div>
                  <div className="form-row">
                    <label>Měna<select name="currency" className="form-input" defaultValue={editAccount?.currency || 'CZK'}><option value="CZK">CZK</option><option value="EUR">EUR</option><option value="USD">USD</option></select></label>
                    <label>Počáteční stav<input name="initial_balance" type="number" step="0.01" className="form-input" defaultValue={editAccount?.initial_balance || 0} /></label>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button type="submit" className="btn btn-primary">Uložit</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Zrušit</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {accounts.map(a => (
              <div key={a.id} className="card" style={{ cursor: 'pointer' }} onClick={() => { setSelectedAccount(a.id); setTab('transactions'); }}>
                <h3>{a.name}</h3>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{a.account_number || a.iban || '—'}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: a.balance >= 0 ? '#22c55e' : '#ef4444' }}>
                  {a.balance.toLocaleString('cs', { minimumFractionDigits: 2 })} {a.currency}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{a.transaction_count} transakcí</div>
                {can('admin', 'accountant') && (
                  <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={(e) => { e.stopPropagation(); setEditAccount(a); setShowForm(true); }}>Upravit</button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'transactions' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {can('admin', 'accountant') && <>
              <button className="btn btn-primary" onClick={() => setShowImport(true)}>Import výpisu</button>
              <button className="btn btn-secondary" onClick={autoMatch}>Auto-párování</button>
            </>}
            <select className="form-input" style={{ width: 180 }} value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)}>
              <option value="">Všechny účty</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select className="form-input" style={{ width: 130 }} value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
              <option value="">Vše</option>
              <option value="unmatched">Nespárované</option>
              <option value="matched">Spárované</option>
              <option value="ignored">Ignorované</option>
            </select>
            <button className="btn btn-secondary" onClick={loadTransactions}>Filtrovat</button>
          </div>

          {showImport && <ImportForm accounts={accounts} onClose={() => setShowImport(false)} onDone={(msg) => { setShowImport(false); setSuccess(msg); loadTransactions(); }} onError={setError} />}

          {loading ? <p>Načítání...</p> : (
            <table className="table">
              <thead><tr><th>Datum</th><th>Částka</th><th>Protiúčet</th><th>VS</th><th>Popis</th><th>Stav</th><th>Faktura</th><th>Akce</th></tr></thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t.id}>
                    <td>{new Date(t.date).toLocaleDateString('cs')}</td>
                    <td style={{ fontWeight: 600, color: t.amount >= 0 ? '#22c55e' : '#ef4444', textAlign: 'right' }}>
                      {t.amount.toLocaleString('cs', { minimumFractionDigits: 2 })} {t.currency}
                    </td>
                    <td style={{ fontSize: 12 }}>{t.counterparty_name || t.counterparty_account || '—'}</td>
                    <td>{t.variable_symbol || '—'}</td>
                    <td style={{ fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.description || '—'}</td>
                    <td><span className={`badge badge-${t.status === 'matched' ? 'paid' : t.status === 'ignored' ? 'cancelled' : 'draft'}`}>
                      {t.status === 'matched' ? 'Spárováno' : t.status === 'ignored' ? 'Ignorováno' : 'Nespárováno'}
                    </span></td>
                    <td>{t.matched_invoice_number || '—'}</td>
                    <td>
                      {t.status === 'unmatched' && can('admin', 'accountant') && (
                        <button className="btn btn-sm" onClick={() => matchManually(t.id)}>Ignorovat</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

function ImportForm({ accounts, onClose, onDone, onError }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [format, setFormat] = useState('csv');
  const [data, setData] = useState('');

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setData(ev.target.result);
    reader.readAsText(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const r = await api.importBankTransactions({ bank_account_id: accountId, format, data });
      onDone(`Importováno ${r.imported} transakcí`);
    } catch (e) { onError(e.message); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Import bankovního výpisu</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Bankovní účet
              <select className="form-input" value={accountId} onChange={e => setAccountId(e.target.value)} required>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label>Formát
              <select className="form-input" value={format} onChange={e => setFormat(e.target.value)}>
                <option value="csv">CSV (datum;částka;název;účet;VS;popis)</option>
                <option value="abo">ABO (Multicash)</option>
              </select>
            </label>
          </div>
          <label>Soubor<input type="file" className="form-input" accept=".csv,.txt,.abo" onChange={handleFile} /></label>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="submit" className="btn btn-primary" disabled={!data}>Importovat</button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Zrušit</button>
          </div>
        </form>
      </div>
    </div>
  );
}
