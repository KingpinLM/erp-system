import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../App';

const fmtDate = (d) => { if (!d) return '—'; const p = d.slice(0,10).split('-'); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : d; };
const fmt = (n, cur = 'CZK') => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n || 0);

const statusLabels = { pending: 'Čeká na schválení', approved: 'Schváleno', rejected: 'Zamítnuto', cancelled: 'Zrušeno' };
const statusClasses = { pending: 'badge-sent', approved: 'badge-paid', rejected: 'badge-overdue', cancelled: 'badge-cancelled' };
const entityLabels = { invoice: 'Faktura', expense: 'Výdaj', order: 'Objednávka' };

export default function Approvals() {
  const [tab, setTab] = useState('pending');
  const [requests, setRequests] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState(null);
  const [comment, setComment] = useState('');
  const [wfModal, setWfModal] = useState(null);
  const [wfForm, setWfForm] = useState({ name: '', entity_type: 'invoice', min_amount: 0, max_amount: '', steps: [{ role: 'manager', label: 'Manažer' }] });
  const { can } = useAuth();

  const load = () => {
    setLoading(true);
    Promise.all([
      api.getApprovalRequests(tab === 'pending' ? { status: 'pending' } : {}),
      api.getApprovalWorkflows(),
      api.getApprovalStats(),
    ]).then(([reqs, wfs, st]) => {
      setRequests(reqs);
      setWorkflows(wfs);
      setStats(st);
    }).finally(() => setLoading(false));
  };

  useEffect(load, [tab]);

  const handleAction = async (action) => {
    if (!actionModal) return;
    await api.approvalAction(actionModal.id, action, comment);
    setActionModal(null);
    setComment('');
    load();
  };

  const handleSaveWorkflow = async () => {
    const data = { ...wfForm, max_amount: wfForm.max_amount ? Number(wfForm.max_amount) : null, min_amount: Number(wfForm.min_amount) || 0 };
    if (wfModal === 'new') {
      await api.createApprovalWorkflow(data);
    } else {
      await api.updateApprovalWorkflow(wfModal, data);
    }
    setWfModal(null);
    load();
  };

  const handleDeleteWorkflow = async (id) => {
    if (!confirm('Smazat workflow?')) return;
    await api.deleteApprovalWorkflow(id);
    load();
  };

  const tabs = [
    { key: 'pending', label: 'K schválení', count: stats.pending },
    { key: 'all', label: 'Všechny žádosti' },
    { key: 'workflows', label: 'Workflow nastavení' },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Schvalování</h1>
      </div>

      {/* Stats cards */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '1.5rem' }}>
        <div className="kpi-card">
          <div className="kpi-label">Čeká na schválení</div>
          <div className="kpi-value warning">{stats.pending || 0}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Schváleno</div>
          <div className="kpi-value success">{stats.approved || 0}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Zamítnuto</div>
          <div className="kpi-value danger">{stats.rejected || 0}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="dash-tabs">
        {tabs.map(t => (
          <button key={t.key} className={`dash-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            <span>{t.label}</span>
            {t.count > 0 && <span className="dash-tab-badge">{t.count}</span>}
          </button>
        ))}
      </div>

      {loading ? <div className="loading">Načítání...</div> : (
        <>
          {/* Pending & All requests */}
          {(tab === 'pending' || tab === 'all') && (
            <div className="card">
              {requests.length === 0 ? (
                <div className="empty-state">
                  {tab === 'pending' ? 'Žádné čekající žádosti o schválení.' : 'Žádné žádosti o schválení.'}
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Typ</th>
                      <th>Číslo</th>
                      <th>Částka</th>
                      <th>Žadatel</th>
                      <th>Krok</th>
                      <th>Stav</th>
                      <th>Datum</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map(r => (
                      <tr key={r.id}>
                        <td><span className="badge badge-document">{entityLabels[r.entity_type] || r.entity_type}</span></td>
                        <td style={{ fontWeight: 600 }}>{r.entity_number || `#${r.entity_id}`}</td>
                        <td style={{ fontWeight: 600 }}>{fmt(r.entity_amount, r.entity_currency)}</td>
                        <td>{r.requester_name || '—'}</td>
                        <td>{r.current_step + 1} / {r.total_steps}</td>
                        <td><span className={`badge ${statusClasses[r.status]}`}>{statusLabels[r.status]}</span></td>
                        <td>{fmtDate(r.created_at)}</td>
                        <td>
                          {r.status === 'pending' && (
                            <div className="btn-group">
                              <button className="btn btn-success btn-sm" onClick={() => { setActionModal(r); setComment(''); }}>Schválit</button>
                              <button className="btn btn-danger btn-sm" onClick={() => { setActionModal(r); setComment(''); }}>Zamítnout</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Workflows */}
          {tab === 'workflows' && can('admin') && (
            <div>
              <div style={{ marginBottom: '1rem' }}>
                <button className="btn btn-primary" onClick={() => { setWfForm({ name: '', entity_type: 'invoice', min_amount: 0, max_amount: '', steps: [{ role: 'manager', label: 'Manažer' }] }); setWfModal('new'); }}>
                  + Nový workflow
                </button>
              </div>
              {workflows.length === 0 ? (
                <div className="card"><div className="empty-state">Zatím nejsou definovány žádné schvalovací workflow.</div></div>
              ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {workflows.map(wf => (
                    <div key={wf.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.25rem' }}>{wf.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                          {entityLabels[wf.entity_type]} | {wf.min_amount > 0 ? `od ${fmt(wf.min_amount)}` : 'Bez minima'} {wf.max_amount ? `do ${fmt(wf.max_amount)}` : ''} | {wf.steps.length} krok(ů)
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                          {wf.steps.map((s, i) => (
                            <span key={i} className="badge badge-accountant" style={{ fontSize: '0.7rem' }}>
                              {i + 1}. {s.label || s.role}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="btn-group">
                        <button className="btn btn-outline btn-sm" onClick={() => {
                          setWfForm({ name: wf.name, entity_type: wf.entity_type, min_amount: wf.min_amount, max_amount: wf.max_amount || '', steps: wf.steps });
                          setWfModal(wf.id);
                        }}>Upravit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteWorkflow(wf.id)}>Smazat</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Action Modal */}
      {actionModal && (
        <div className="modal-overlay" onClick={() => setActionModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h3 className="modal-title">Schválení: {actionModal.entity_number || `#${actionModal.entity_id}`}</h3>
              <button className="modal-close" onClick={() => setActionModal(null)}>&times;</button>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: '0.5rem' }}>
                {entityLabels[actionModal.entity_type]} | {fmt(actionModal.entity_amount, actionModal.entity_currency)}
              </div>
              <div className="form-group">
                <label className="form-label">Komentář (volitelné)</label>
                <textarea className="form-textarea" rows={3} value={comment} onChange={e => setComment(e.target.value)} placeholder="Přidat komentář..." />
              </div>
            </div>
            <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setActionModal(null)}>Zrušit</button>
              <button className="btn btn-danger" onClick={() => handleAction('reject')}>Zamítnout</button>
              <button className="btn btn-success" onClick={() => handleAction('approve')}>Schválit</button>
            </div>
          </div>
        </div>
      )}

      {/* Workflow Modal */}
      {wfModal && (
        <div className="modal-overlay" onClick={() => setWfModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{wfModal === 'new' ? 'Nový workflow' : 'Upravit workflow'}</h3>
              <button className="modal-close" onClick={() => setWfModal(null)}>&times;</button>
            </div>
            <div className="form-group">
              <label className="form-label">Název</label>
              <input className="form-input" value={wfForm.name} onChange={e => setWfForm({ ...wfForm, name: e.target.value })} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Typ entity</label>
                <select className="form-select" value={wfForm.entity_type} onChange={e => setWfForm({ ...wfForm, entity_type: e.target.value })}>
                  <option value="invoice">Faktura</option>
                  <option value="expense">Výdaj</option>
                  <option value="order">Objednávka</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Min. částka</label>
                <input className="form-input" type="number" value={wfForm.min_amount} onChange={e => setWfForm({ ...wfForm, min_amount: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Max. částka</label>
                <input className="form-input" type="number" value={wfForm.max_amount} onChange={e => setWfForm({ ...wfForm, max_amount: e.target.value })} placeholder="Bez limitu" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Kroky schválení</label>
              {wfForm.steps.map((step, i) => (
                <div key={i} className="form-row" style={{ marginBottom: '0.5rem' }}>
                  <input className="form-input" placeholder="Název kroku" value={step.label} onChange={e => {
                    const steps = [...wfForm.steps]; steps[i] = { ...steps[i], label: e.target.value }; setWfForm({ ...wfForm, steps });
                  }} />
                  <select className="form-select" value={step.role} onChange={e => {
                    const steps = [...wfForm.steps]; steps[i] = { ...steps[i], role: e.target.value }; setWfForm({ ...wfForm, steps });
                  }}>
                    <option value="manager">Manažer</option>
                    <option value="accountant">Účetní</option>
                    <option value="admin">Admin</option>
                  </select>
                  {wfForm.steps.length > 1 && (
                    <button className="btn btn-danger btn-sm" onClick={() => {
                      const steps = wfForm.steps.filter((_, j) => j !== i); setWfForm({ ...wfForm, steps });
                    }}>-</button>
                  )}
                </div>
              ))}
              <button className="btn btn-outline btn-sm" onClick={() => setWfForm({ ...wfForm, steps: [...wfForm.steps, { role: 'admin', label: '' }] })}>+ Přidat krok</button>
            </div>
            <div className="btn-group" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button className="btn btn-outline" onClick={() => setWfModal(null)}>Zrušit</button>
              <button className="btn btn-primary" onClick={handleSaveWorkflow}>Uložit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
