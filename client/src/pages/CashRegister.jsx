import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../App';
import Pagination, { usePagination } from '../components/Pagination';

export default function CashRegister() {
  const { can } = useAuth();
  const [registers, setRegisters] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showRegForm, setShowRegForm] = useState(false);
  const [showDocForm, setShowDocForm] = useState(false);
  const [selectedRegister, setSelectedRegister] = useState('');
  const [editDoc, setEditDoc] = useState(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  useEffect(() => { loadRegisters(); }, []);
  useEffect(() => { if (selectedRegister) { setPage(1); loadDocuments(); } }, [selectedRegister]);

  const loadRegisters = async () => {
    try { setRegisters(await api.getCashRegisters()); }
    catch (e) { setError(e.message); }
    setLoading(false);
  };

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const params = selectedRegister ? { register_id: selectedRegister } : {};
      setDocuments(await api.getCashDocuments(params));
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const handleSaveRegister = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    data.initial_balance = parseFloat(data.initial_balance) || 0;
    try {
      await api.createCashRegister(data);
      setShowRegForm(false); loadRegisters();
    } catch (e) { setError(e.message); }
  };

  const handleSaveDocument = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    data.amount = parseFloat(data.amount);
    data.register_id = parseInt(data.register_id);
    try {
      if (editDoc) await api.updateCashDocument(editDoc.id, data);
      else {
        const r = await api.createCashDocument(data);
        setSuccess(`Vytvořen doklad ${r.document_number}`);
      }
      setShowDocForm(false); setEditDoc(null); loadDocuments(); loadRegisters();
    } catch (e) { setError(e.message); }
  };

  const deleteDoc = async (id) => {
    if (!confirm('Smazat doklad?')) return;
    try { await api.deleteCashDocument(id); loadDocuments(); loadRegisters(); }
    catch (e) { setError(e.message); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Pokladna</h2>
        {can('admin', 'accountant', 'manager') && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setShowRegForm(true)}>+ Pokladna</button>
            <button className="btn btn-primary" onClick={() => { setEditDoc(null); setShowDocForm(true); }}>+ Doklad</button>
          </div>
        )}
      </div>
      {error && <div className="alert alert-error" onClick={() => setError('')}>{error}</div>}
      {success && <div className="alert alert-success" onClick={() => setSuccess('')}>{success}</div>}

      {/* Registers summary */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginBottom: 20 }}>
        {registers.map(r => (
          <div key={r.id} className="card" style={{ cursor: 'pointer', border: selectedRegister == r.id ? '2px solid #3b82f6' : undefined }}
            onClick={() => setSelectedRegister(r.id)}>
            <h3 style={{ fontSize: 14 }}>{r.name}</h3>
            <div style={{ fontSize: 22, fontWeight: 700, color: r.balance >= 0 ? '#22c55e' : '#ef4444', marginTop: 4 }}>
              {r.balance.toLocaleString('cs', { minimumFractionDigits: 2 })} {r.currency}
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#64748b', marginTop: 4 }}>
              <span>Příjmy: {r.total_income.toLocaleString('cs', { minimumFractionDigits: 0 })}</span>
              <span>Výdaje: {r.total_expense.toLocaleString('cs', { minimumFractionDigits: 0 })}</span>
            </div>
          </div>
        ))}
        {registers.length === 0 && !loading && <div className="card"><p>Žádné pokladny. Vytvořte první.</p></div>}
      </div>

      {/* Register form modal */}
      {showRegForm && (
        <div className="modal-overlay" onClick={() => setShowRegForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Nová pokladna</h3>
            <form onSubmit={handleSaveRegister}>
              <label>Název *<input name="name" className="form-input" required /></label>
              <div className="form-row">
                <label>Měna<select name="currency" className="form-input" defaultValue="CZK"><option value="CZK">CZK</option><option value="EUR">EUR</option><option value="USD">USD</option></select></label>
                <label>Počáteční stav<input name="initial_balance" type="number" step="0.01" className="form-input" defaultValue="0" /></label>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button type="submit" className="btn btn-primary">Vytvořit</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowRegForm(false)}>Zrušit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document form modal */}
      {showDocForm && (
        <div className="modal-overlay" onClick={() => setShowDocForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{editDoc ? 'Upravit doklad' : 'Nový pokladní doklad'}</h3>
            <form onSubmit={handleSaveDocument}>
              <div className="form-row">
                <label>Pokladna *
                  <select name="register_id" className="form-input" defaultValue={editDoc?.register_id || selectedRegister} required>
                    <option value="">Vyberte</option>
                    {registers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </label>
                <label>Typ *
                  <select name="type" className="form-input" defaultValue={editDoc?.type || 'income'} required>
                    <option value="income">Příjem</option>
                    <option value="expense">Výdaj</option>
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label>Částka *<input name="amount" type="number" step="0.01" min="0.01" className="form-input" defaultValue={editDoc?.amount} required /></label>
                <label>Datum *<input name="date" type="date" className="form-input" defaultValue={editDoc?.date || new Date().toISOString().slice(0, 10)} required /></label>
              </div>
              <label>Popis<input name="description" className="form-input" defaultValue={editDoc?.description} /></label>
              <label>Kategorie<input name="category" className="form-input" defaultValue={editDoc?.category} /></label>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button type="submit" className="btn btn-primary">Uložit</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowDocForm(false)}>Zrušit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Documents list */}
      {selectedRegister && (
        <>
          <h3 style={{ marginBottom: 8 }}>Pokladní doklady</h3>
          {loading ? <p>Načítání...</p> : (
            <table className="table">
              <thead><tr><th>Číslo</th><th>Datum</th><th>Typ</th><th style={{ textAlign: 'right' }}>Částka</th><th>Popis</th><th>Kategorie</th><th>Vytvořil</th><th>Akce</th></tr></thead>
              <tbody>
                {documents.slice((page - 1) * perPage, page * perPage).map(d => (
                  <tr key={d.id}>
                    <td><strong>{d.document_number}</strong></td>
                    <td>{new Date(d.date).toLocaleDateString('cs')}</td>
                    <td><span className={`badge badge-${d.type === 'income' ? 'paid' : 'overdue'}`}>{d.type === 'income' ? 'Příjem' : 'Výdaj'}</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: d.type === 'income' ? '#22c55e' : '#ef4444' }}>
                      {d.type === 'income' ? '+' : '-'}{d.amount.toLocaleString('cs', { minimumFractionDigits: 2 })}
                    </td>
                    <td>{d.description || '—'}</td>
                    <td>{d.category || '—'}</td>
                    <td style={{ fontSize: 12 }}>{d.created_by_name || '—'}</td>
                    <td>
                      {can('admin', 'accountant') && <>
                        <button className="btn btn-sm" onClick={() => { setEditDoc(d); setShowDocForm(true); }}>Upravit</button>
                        {can('admin') && <button className="btn btn-sm btn-danger" onClick={() => deleteDoc(d.id)} style={{ marginLeft: 4 }}>Smazat</button>}
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Pagination total={documents.length} page={page} perPage={perPage} onPageChange={setPage} onPerPageChange={v => { setPerPage(v); setPage(1); }} />
        </>
      )}
    </div>
  );
}
