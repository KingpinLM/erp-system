import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../App';
import Pagination, { usePagination } from '../components/Pagination';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';

export default function Accounting() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState('accounts');
  const [accounts, setAccounts] = useState([]);
  const [journal, setJournal] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [showJournalForm, setShowJournalForm] = useState(false);
  const [filter, setFilter] = useState({ from: '', to: '', status: '' });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  useEffect(() => { setPage(1); load(); }, [tab]);

  const load = async () => {
    setLoading(true);
    try {
      if (tab === 'accounts') {
        setAccounts(await api.getAccounts());
      } else if (tab === 'journal') {
        setJournal(await api.getJournal(filter));
      } else if (tab === 'ledger') {
        setBalances(await api.getLedgerBalances(filter));
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const seedAccounts = async () => {
    try {
      await api.seedDefaultAccounts();
      setSuccess('Účtový rozvrh naplněn');
      load();
    } catch (e) { setError(e.message); }
  };

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    try {
      if (editItem) await api.updateAccount(editItem.id, data);
      else await api.createAccount(data);
      setShowForm(false); setEditItem(null); load();
    } catch (e) { setError(e.message); }
  };

  const deleteAccount = async (id) => {
    const ok = await confirm({ title: 'Smazat účet', message: 'Opravdu chcete smazat tento účet?', type: 'danger', confirmText: 'Smazat' }); if (!ok) return;
    try { await api.deleteAccount(id); toast.success('Účet smazán'); load(); } catch (e) { setError(e.message); }
  };

  const postEntry = async (id) => {
    try { await api.postJournalEntry(id); load(); } catch (e) { setError(e.message); }
  };

  const cancelEntry = async (id) => {
    try { await api.cancelJournalEntry(id); load(); } catch (e) { setError(e.message); }
  };

  const deleteEntry = async (id) => {
    const ok = await confirm({ title: 'Smazat zápis', message: 'Opravdu chcete smazat tento zápis?', type: 'danger', confirmText: 'Smazat' }); if (!ok) return;
    try { await api.deleteJournalEntry(id); toast.success('Zápis smazán'); load(); } catch (e) { setError(e.message); }
  };

  const typeLabels = { asset: 'Aktivum', liability: 'Pasivum', equity: 'Vlastní kapitál', revenue: 'Výnos', expense: 'Náklad' };
  const typeColors = { asset: '#3b82f6', liability: '#ef4444', equity: '#8b5cf6', revenue: '#22c55e', expense: '#f59e0b' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Účetnictví</h2>
      </div>
      {error && <div className="alert alert-error" onClick={() => setError('')}>{error}</div>}
      {success && <div className="alert alert-success" onClick={() => setSuccess('')}>{success}</div>}

      <div className="tabs" style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[['accounts', 'Účtový rozvrh'], ['journal', 'Účetní deník'], ['ledger', 'Předvaha']].map(([k, l]) => (
          <button key={k} className={`btn ${tab === k ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {/* ÚČTOVÝ ROZVRH */}
      {tab === 'accounts' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {can('admin', 'accountant') && (
              <>
                <button className="btn btn-primary" onClick={() => { setEditItem(null); setShowForm(true); }}>+ Nový účet</button>
                {accounts.length === 0 && <button className="btn btn-secondary" onClick={seedAccounts}>Naplnit český účtový rozvrh</button>}
              </>
            )}
          </div>

          {showForm && (
            <div className="modal-overlay" onClick={() => setShowForm(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <h3>{editItem ? 'Upravit účet' : 'Nový účet'}</h3>
                <form onSubmit={handleSaveAccount}>
                  <div className="form-row">
                    <label>Číslo účtu *<input name="account_number" className="form-input" defaultValue={editItem?.account_number} required /></label>
                    <label>Název *<input name="name" className="form-input" defaultValue={editItem?.name} required /></label>
                  </div>
                  <label>Typ *
                    <select name="type" className="form-input" defaultValue={editItem?.type || 'expense'} required>
                      {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </label>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button type="submit" className="btn btn-primary">Uložit</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Zrušit</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {loading ? <p>Načítání...</p> : (
            <table className="table">
              <thead><tr><th>Číslo</th><th>Název</th><th>Typ</th><th>Akce</th></tr></thead>
              <tbody>
                {accounts.slice((page - 1) * perPage, page * perPage).map(a => (
                  <tr key={a.id}>
                    <td><strong>{a.account_number}</strong></td>
                    <td>{a.name}</td>
                    <td><span style={{ color: typeColors[a.type], fontWeight: 600, fontSize: 12 }}>{typeLabels[a.type]}</span></td>
                    <td>
                      {can('admin', 'accountant') && <>
                        <button className="btn btn-sm" onClick={() => { setEditItem(a); setShowForm(true); }}>Upravit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => deleteAccount(a.id)} style={{ marginLeft: 4 }}>Smazat</button>
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Pagination total={accounts.length} page={page} perPage={perPage} onPageChange={setPage} onPerPageChange={v => { setPerPage(v); setPage(1); }} />
        </>
      )}

      {/* ÚČETNÍ DENÍK */}
      {tab === 'journal' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {can('admin', 'accountant') && <button className="btn btn-primary" onClick={() => setShowJournalForm(true)}>+ Nový zápis</button>}
            <input type="date" className="form-input" value={filter.from} onChange={e => setFilter(f => ({ ...f, from: e.target.value }))} placeholder="Od" />
            <input type="date" className="form-input" value={filter.to} onChange={e => setFilter(f => ({ ...f, to: e.target.value }))} placeholder="Do" />
            <select className="form-input" value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
              <option value="">Vše</option>
              <option value="draft">Koncept</option>
              <option value="posted">Zaúčtováno</option>
              <option value="cancelled">Stornováno</option>
            </select>
            <button className="btn btn-secondary" onClick={load}>Filtrovat</button>
          </div>

          {showJournalForm && <JournalEntryForm accounts={accounts.length ? accounts : null} onClose={() => setShowJournalForm(false)} onSave={() => { setShowJournalForm(false); load(); }} />}

          {loading ? <p>Načítání...</p> : (
            <table className="table">
              <thead><tr><th>Číslo</th><th>Datum</th><th>Popis</th><th className="hide-mobile">MD</th><th className="hide-mobile">D</th><th>Stav</th><th>Akce</th></tr></thead>
              <tbody>
                {journal.slice((page - 1) * perPage, page * perPage).map(j => {
                  const totalDebit = j.lines?.reduce((s, l) => s + l.debit, 0) || 0;
                  const totalCredit = j.lines?.reduce((s, l) => s + l.credit, 0) || 0;
                  return (
                    <tr key={j.id}>
                      <td><strong>{j.entry_number}</strong></td>
                      <td>{new Date(j.date).toLocaleDateString('cs')}</td>
                      <td>{j.description}</td>
                      <td className="hide-mobile" style={{ textAlign: 'right' }}>{totalDebit.toLocaleString('cs', { minimumFractionDigits: 2 })}</td>
                      <td className="hide-mobile" style={{ textAlign: 'right' }}>{totalCredit.toLocaleString('cs', { minimumFractionDigits: 2 })}</td>
                      <td><span className={`badge badge-${j.status === 'posted' ? 'paid' : j.status === 'cancelled' ? 'cancelled' : 'draft'}`}>
                        {j.status === 'posted' ? 'Zaúčtováno' : j.status === 'cancelled' ? 'Stornováno' : 'Koncept'}
                      </span></td>
                      <td>
                        {j.status === 'draft' && can('admin', 'accountant') && <>
                          <button className="btn btn-sm btn-primary" onClick={() => postEntry(j.id)}>Zaúčtovat</button>
                          <button className="btn btn-sm btn-danger" onClick={() => deleteEntry(j.id)} style={{ marginLeft: 4 }}>Smazat</button>
                        </>}
                        {j.status === 'posted' && can('admin') && <button className="btn btn-sm" onClick={() => cancelEntry(j.id)}>Storno</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <Pagination total={journal.length} page={page} perPage={perPage} onPageChange={setPage} onPerPageChange={v => { setPerPage(v); setPage(1); }} />
        </>
      )}

      {/* PŘEDVAHA */}
      {tab === 'ledger' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <input type="date" className="form-input" value={filter.from} onChange={e => setFilter(f => ({ ...f, from: e.target.value }))} />
            <input type="date" className="form-input" value={filter.to} onChange={e => setFilter(f => ({ ...f, to: e.target.value }))} />
            <button className="btn btn-secondary" onClick={load}>Zobrazit</button>
          </div>
          {loading ? <p>Načítání...</p> : (
            <table className="table">
              <thead><tr><th>Účet</th><th>Název</th><th>Typ</th><th style={{ textAlign: 'right' }}>Obraty MD</th><th style={{ textAlign: 'right' }}>Obraty D</th><th style={{ textAlign: 'right' }}>Saldo</th></tr></thead>
              <tbody>
                {balances.slice((page - 1) * perPage, page * perPage).map(b => (
                  <tr key={b.id}>
                    <td><strong>{b.account_number}</strong></td>
                    <td>{b.name}</td>
                    <td><span style={{ color: typeColors[b.type], fontSize: 12, fontWeight: 600 }}>{typeLabels[b.type]}</span></td>
                    <td style={{ textAlign: 'right' }}>{b.total_debit.toLocaleString('cs', { minimumFractionDigits: 2 })}</td>
                    <td style={{ textAlign: 'right' }}>{b.total_credit.toLocaleString('cs', { minimumFractionDigits: 2 })}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: b.balance < 0 ? '#ef4444' : '#22c55e' }}>{b.balance.toLocaleString('cs', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
                {balances.length > 0 && (
                  <tr style={{ fontWeight: 700, borderTop: '2px solid #e2e8f0' }}>
                    <td colSpan={3}>Celkem</td>
                    <td style={{ textAlign: 'right' }}>{balances.reduce((s, b) => s + b.total_debit, 0).toLocaleString('cs', { minimumFractionDigits: 2 })}</td>
                    <td style={{ textAlign: 'right' }}>{balances.reduce((s, b) => s + b.total_credit, 0).toLocaleString('cs', { minimumFractionDigits: 2 })}</td>
                    <td style={{ textAlign: 'right' }}>{balances.reduce((s, b) => s + b.balance, 0).toLocaleString('cs', { minimumFractionDigits: 2 })}</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          <Pagination total={balances.length} page={page} perPage={perPage} onPageChange={setPage} onPerPageChange={v => { setPerPage(v); setPage(1); }} />
        </>
      )}
    </div>
  );
}

function JournalEntryForm({ onClose, onSave }) {
  const [accounts, setAccounts] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState([{ account_id: '', debit: '', credit: '', description: '' }, { account_id: '', debit: '', credit: '', description: '' }]);
  const [error, setError] = useState('');

  useEffect(() => { api.getAccounts().then(setAccounts).catch(() => {}); }, []);

  const addLine = () => setLines([...lines, { account_id: '', debit: '', credit: '', description: '' }]);
  const removeLine = (i) => lines.length > 2 && setLines(lines.filter((_, j) => j !== i));
  const updateLine = (i, field, val) => setLines(lines.map((l, j) => j === i ? { ...l, [field]: val } : l));

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!balanced) { setError('Součet MD a D se nerovná'); return; }
    try {
      await api.createJournalEntry({
        date, description,
        lines: lines.map(l => ({ account_id: parseInt(l.account_id), debit: parseFloat(l.debit) || 0, credit: parseFloat(l.credit) || 0, description: l.description }))
      });
      onSave();
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 'min(700px, 95vw)' }}>
        <h3>Nový účetní zápis</h3>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Datum *<input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} required /></label>
            <label>Popis *<input className="form-input" value={description} onChange={e => setDescription(e.target.value)} required /></label>
          </div>
          <table className="table" style={{ marginTop: 12 }}>
            <thead><tr><th>Účet</th><th>MD (Kč)</th><th>D (Kč)</th><th>Popis</th><th></th></tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td>
                    <select className="form-input" value={l.account_id} onChange={e => updateLine(i, 'account_id', e.target.value)} required style={{ width: '100%', minWidth: 0 }}>
                      <option value="">Vyberte účet</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.account_number} – {a.name}</option>)}
                    </select>
                  </td>
                  <td><input type="number" step="0.01" className="form-input" value={l.debit} onChange={e => updateLine(i, 'debit', e.target.value)} style={{ width: 100 }} /></td>
                  <td><input type="number" step="0.01" className="form-input" value={l.credit} onChange={e => updateLine(i, 'credit', e.target.value)} style={{ width: 100 }} /></td>
                  <td><input className="form-input" value={l.description} onChange={e => updateLine(i, 'description', e.target.value)} /></td>
                  <td><button type="button" className="btn btn-sm btn-danger" onClick={() => removeLine(i)}>×</button></td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700 }}>
                <td>Celkem</td>
                <td style={{ color: balanced ? '#22c55e' : '#ef4444' }}>{totalDebit.toFixed(2)}</td>
                <td style={{ color: balanced ? '#22c55e' : '#ef4444' }}>{totalCredit.toFixed(2)}</td>
                <td colSpan={2}>{!balanced && <span style={{ color: '#ef4444', fontSize: 12 }}>Rozdíl: {(totalDebit - totalCredit).toFixed(2)}</span>}</td>
              </tr>
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={addLine}>+ Řádek</button>
            <div style={{ flex: 1 }} />
            <button type="submit" className="btn btn-primary" disabled={!balanced}>Uložit</button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Zrušit</button>
          </div>
        </form>
      </div>
    </div>
  );
}
