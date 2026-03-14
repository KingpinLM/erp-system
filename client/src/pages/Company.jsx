import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../App';

const invoiceLayouts = [
  {
    key: 'klasicky',
    name: 'Klasický',
    desc: 'Standardní moderní layout s gradientovým pruhem a přehledným rozložením.',
    accent: '#6366f1',
    accentGrad: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
  },
  {
    key: 'minimalisticky',
    name: 'Minimalistický',
    desc: 'Čistý design s maximem bílého prostoru. Žádné barvy, pouze typografie.',
    accent: '#1e293b',
    accentGrad: null,
  },
  {
    key: 'korporatni',
    name: 'Korporátní',
    desc: 'Profesionální firemní styl s tmavou hlavičkou a výrazným logem.',
    accent: '#0f172a',
    accentGrad: null,
  },
  {
    key: 'elegantni',
    name: 'Elegantní',
    desc: 'Jemné barvy, zaoblené rohy a rafinovaná typografie pro prémiový dojem.',
    accent: '#8b5cf6',
    accentGrad: 'linear-gradient(90deg, #c4b5fd, #8b5cf6, #c4b5fd)',
  },
  {
    key: 'kompaktni',
    name: 'Kompaktní',
    desc: 'Úsporné rozložení pro maximum informací na jedné stránce.',
    accent: '#059669',
    accentGrad: null,
  },
];

// Realistic invoice preview renderer
function InvoicePreview({ layout, companyName }) {
  const name = companyName || 'Firma s.r.o.';
  const items = [
    { desc: 'Webový design — kompletní redesign', qty: 1, price: 25000 },
    { desc: 'SEO optimalizace', qty: 1, price: 8500 },
    { desc: 'Hosting 12 měs.', qty: 12, price: 300 },
  ];
  const subtotal = 37100;
  const vat = 7791;
  const total = 44891;
  const fmtN = n => n.toLocaleString('cs-CZ');

  const isKorp = layout.key === 'korporatni';
  const isMin = layout.key === 'minimalisticky';
  const isEleg = layout.key === 'elegantni';
  const isComp = layout.key === 'kompaktni';

  const fs = isComp ? 0.85 : 1;
  const pad = isComp ? 14 : 20;
  const bg = 'white';
  const text = '#1e293b';
  const muted = '#94a3b8';
  const border = isEleg ? '#e9d5ff' : isMin ? '#e2e8f0' : '#e2e8f0';

  return (
    <div style={{ padding: pad, background: bg, fontSize: 10 * fs, color: text, fontFamily: "'Inter', sans-serif", lineHeight: 1.5 }}>
      {/* Top accent */}
      {layout.accentGrad && !isKorp && (
        <div style={{ height: isEleg ? 1.5 : 3, background: layout.accentGrad, borderRadius: 2, marginBottom: 14 }} />
      )}
      {isComp && (
        <div style={{ height: 2, background: layout.accent, marginBottom: 10 }} />
      )}

      {/* Corporate dark header */}
      {isKorp && (
        <div style={{ background: '#0f172a', margin: `-${pad}px -${pad}px 12px`, padding: `14px ${pad}px 10px` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 7, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Faktura</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>FV-2026-001</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ width: 40, height: 12, background: 'rgba(255,255,255,0.12)', borderRadius: 3, marginBottom: 4, marginLeft: 'auto' }} />
              <div style={{ fontSize: 8, color: '#94a3b8', fontWeight: 500 }}>{name}</div>
            </div>
          </div>
        </div>
      )}

      {/* Elegant centered header */}
      {isEleg && (
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 7, fontWeight: 600, color: layout.accent, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Faktura</div>
          <div style={{ fontSize: 20, fontWeight: 300, color: '#1e1b4b', letterSpacing: '-0.01em' }}>FV-2026-001</div>
          <div style={{ fontSize: 7, color: muted, marginTop: 2 }}>{name}</div>
        </div>
      )}

      {/* Standard / Minimal / Compact header */}
      {!isKorp && !isEleg && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: isComp ? 8 : 14 }}>
          <div>
            <div style={{ fontSize: isMin ? 6 : 7, fontWeight: isMin ? 600 : 800, color: isMin ? text : layout.accent, textTransform: 'uppercase', letterSpacing: isMin ? '0.15em' : '0.08em' }}>Faktura</div>
            <div style={{ fontSize: isComp ? 14 : 17, fontWeight: isMin ? 400 : 800, color: text, letterSpacing: '-0.02em' }}>FV-2026-001</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9 * fs, fontWeight: 700, color: text }}>{name}</div>
            <div style={{ fontSize: 7 * fs, color: muted }}>IČ: 12345678</div>
          </div>
        </div>
      )}

      {/* Parties */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, marginBottom: isComp ? 8 : 12,
        border: `1px solid ${border}`, borderRadius: isEleg ? 8 : isComp ? 4 : 6, overflow: 'hidden',
        ...(isMin ? { borderLeft: 'none', borderRight: 'none', borderRadius: 0 } : {}),
      }}>
        <div style={{ padding: isComp ? '5px 8px' : '8px 10px', borderRight: `1px solid ${border}` }}>
          <div style={{ fontSize: 6, fontWeight: 700, color: isEleg ? layout.accent : muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Dodavatel</div>
          <div style={{ fontSize: 8 * fs, fontWeight: 700, color: text }}>{name}</div>
          <div style={{ fontSize: 6, color: muted }}>Ulice 123, Praha</div>
          <div style={{ fontSize: 6, color: muted }}>IČ: 12345678</div>
        </div>
        <div style={{ padding: isComp ? '5px 8px' : '8px 10px' }}>
          <div style={{ fontSize: 6, fontWeight: 700, color: isEleg ? layout.accent : muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Odběratel</div>
          <div style={{ fontSize: 8 * fs, fontWeight: 700, color: text }}>Klient a.s.</div>
          <div style={{ fontSize: 6, color: muted }}>Firemní 456, Brno</div>
          <div style={{ fontSize: 6, color: muted }}>IČ: 87654321</div>
        </div>
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', gap: isComp ? 6 : 10, marginBottom: isComp ? 6 : 10, padding: isComp ? '4px 6px' : '6px 8px', background: '#f8fafc', borderRadius: 4, border: '1px solid #f1f5f9' }}>
        {[{ l: 'Vystaveno', v: '01.03.2026' }, { l: 'Splatnost', v: '15.03.2026' }, { l: 'Způsob', v: 'Převodem' }].map((m, i) => (
          <div key={i} style={{ flex: 1 }}>
            <div style={{ fontSize: 5, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.l}</div>
            <div style={{ fontSize: 7 * fs, fontWeight: 600, color: text }}>{m.v}</div>
          </div>
        ))}
      </div>

      {/* Items table */}
      <div style={{ marginBottom: isComp ? 6 : 10 }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 32px 50px 55px', gap: 0, padding: '3px 6px', fontSize: 6,
          fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
          background: isKorp ? '#0f172a' : isEleg ? '#faf5ff' : isComp ? '#ecfdf5' : '#f8fafc',
          color: isKorp ? '#e2e8f0' : isEleg ? '#7c3aed' : isComp ? '#059669' : muted,
          borderBottom: isMin ? '1.5px solid #1e293b' : `1px solid ${border}`,
        }}>
          <span>Popis</span><span style={{ textAlign: 'right' }}>Ks</span><span style={{ textAlign: 'right' }}>Cena</span><span style={{ textAlign: 'right' }}>Celkem</span>
        </div>
        {items.map((item, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '1fr 32px 50px 55px', gap: 0, padding: '3px 6px', fontSize: 7 * fs,
            color: '#475569', borderBottom: `1px solid ${isEleg ? '#f3e8ff' : isKorp ? '#1e293b' : '#f1f5f9'}`,
          }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.desc}</span>
            <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{item.qty}</span>
            <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtN(item.price)}</span>
            <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmtN(item.qty * item.price)}</span>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: '55%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7 * fs, color: muted, marginBottom: 2 }}>
            <span>Základ</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtN(subtotal)} Kč</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7 * fs, color: muted, marginBottom: 3 }}>
            <span>DPH 21%</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtN(vat)} Kč</span>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', fontSize: isComp ? 10 : 12, fontWeight: 800,
            color: isEleg ? '#1e1b4b' : text,
            borderTop: `2px solid ${isEleg ? '#7c3aed' : isMin ? '#1e293b' : isKorp ? '#475569' : text}`,
            paddingTop: 4, marginTop: 2,
          }}>
            <span>Celkem</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtN(total)} Kč</span>
          </div>
        </div>
      </div>

      {/* QR / payment info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: isComp ? 8 : 12, padding: '6px 8px', background: '#f8fafc', borderRadius: 4, border: '1px solid #f1f5f9' }}>
        <div style={{ width: 28, height: 28, background: '#e2e8f0', borderRadius: 3, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/></svg>
        </div>
        <div>
          <div style={{ fontSize: 6, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Platební údaje</div>
          <div style={{ fontSize: 7, color: text }}>123456789/0800</div>
        </div>
      </div>

      {/* Bottom accent */}
      {layout.accentGrad && !isKorp && (
        <div style={{ height: isEleg ? 1 : 2, background: layout.accentGrad, borderRadius: 1, marginTop: isComp ? 8 : 12, opacity: 0.4 }} />
      )}
    </div>
  );
}

const formatTemplates = [
  { value: '{prefix}{sep}{year}{sep}{num}', label: 'Prefix-Rok-Číslo', example: 'FV-2026-001' },
  { value: '{prefix}{sep}{num}{sep}{year}', label: 'Prefix-Číslo-Rok', example: 'FV-001-2026' },
  { value: '{year}{sep}{num}', label: 'Rok-Číslo (bez prefixu)', example: '2026-001' },
  { value: '{prefix}{year}{num}', label: 'PrefixRokČíslo (bez oddělovače)', example: 'FV2026001' },
  { value: '{prefix}{sep}{num}', label: 'Prefix-Číslo (bez roku)', example: 'FV-001' },
];

const separatorOptions = [
  { value: '-', label: 'Pomlčka (-)' },
  { value: '/', label: 'Lomítko (/)' },
  { value: '', label: 'Bez oddělovače' },
];

function ChatbotAdmin() {
  const [tab, setTab] = useState('knowledge');
  const [knowledge, setKnowledge] = useState([]);
  const [unanswered, setUnanswered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const emptyForm = { keywords: '', question_cs: '', question_en: '', answer_cs: '', answer_en: '', link: '', category: 'navigation', priority: 0 };
  const [form, setForm] = useState(emptyForm);
  const [resolveItem, setResolveItem] = useState(null);
  const [resolveForm, setResolveForm] = useState({ keywords: '', answer_cs: '', answer_en: '', link: '', category: 'custom' });

  const load = () => {
    setLoading(true);
    Promise.all([api.getChatbotKnowledge(), api.getChatbotUnanswered()])
      .then(([k, u]) => { setKnowledge(k); setUnanswered(u); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (editItem) {
      await api.updateChatbotKnowledge(editItem.id, { ...form, active: editItem.active ?? 1 });
    } else {
      await api.createChatbotKnowledge(form);
    }
    setShowForm(false); setEditItem(null); setForm(emptyForm); load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Smazat tuto položku znalostní báze?')) return;
    await api.deleteChatbotKnowledge(id); load();
  };

  const handleResolve = async (e) => {
    e.preventDefault();
    await api.resolveChatbotUnanswered(resolveItem.id, resolveForm);
    setResolveItem(null); setResolveForm({ keywords: '', answer_cs: '', answer_en: '', link: '', category: 'custom' }); load();
  };

  const handleDeleteUnanswered = async (id) => {
    await api.deleteChatbotUnanswered(id); load();
  };

  const catLabels = { navigation: 'Navigace', feature: 'Funkce', help: 'Nápověda', custom: 'Vlastní' };
  const unresolvedCount = unanswered.filter(u => !u.resolved).length;

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div className="card-title" style={{ margin: 0 }}>Chatbot Hyňa</div>
        <div className="btn-group">
          <button className={`btn btn-sm ${tab === 'knowledge' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('knowledge')}>Znalosti ({knowledge.length})</button>
          <button className={`btn btn-sm ${tab === 'unanswered' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('unanswered')}>
            Nezodpovězené {unresolvedCount > 0 && <span className="badge badge-overdue" style={{ marginLeft: 4, fontSize: 10 }}>{unresolvedCount}</span>}
          </button>
        </div>
      </div>

      {loading ? <div className="loading">Načítání...</div> : tab === 'knowledge' ? (
        <>
          <div style={{ marginBottom: '0.75rem' }}>
            <button className="btn btn-primary btn-sm" onClick={() => { setEditItem(null); setForm(emptyForm); setShowForm(true); }}>+ Přidat znalost</button>
          </div>
          {showForm && (
            <form onSubmit={handleSave} style={{ background: 'var(--gray-50)', padding: '1rem', borderRadius: 'var(--radius)', marginBottom: '1rem' }}>
              <div className="form-group"><label className="form-label">Klíčová slova (oddělená čárkou) *</label><input className="form-input" value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} required placeholder="faktura,invoice,vystavit" /></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Otázka CZ *</label><input className="form-input" value={form.question_cs} onChange={e => setForm(f => ({ ...f, question_cs: e.target.value }))} required /></div>
                <div className="form-group"><label className="form-label">Otázka EN</label><input className="form-input" value={form.question_en} onChange={e => setForm(f => ({ ...f, question_en: e.target.value }))} /></div>
              </div>
              <div className="form-group"><label className="form-label">Odpověď CZ *</label><textarea className="form-input" rows="2" value={form.answer_cs} onChange={e => setForm(f => ({ ...f, answer_cs: e.target.value }))} required /></div>
              <div className="form-group"><label className="form-label">Odpověď EN</label><textarea className="form-input" rows="2" value={form.answer_en} onChange={e => setForm(f => ({ ...f, answer_en: e.target.value }))} /></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Odkaz</label><input className="form-input" value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} placeholder="/invoices" /></div>
                <div className="form-group"><label className="form-label">Kategorie</label>
                  <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    <option value="navigation">Navigace</option><option value="feature">Funkce</option><option value="help">Nápověda</option><option value="custom">Vlastní</option>
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Priorita</label><input className="form-input" type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))} /></div>
              </div>
              <div className="btn-group"><button type="submit" className="btn btn-primary btn-sm">{editItem ? 'Uložit' : 'Přidat'}</button><button type="button" className="btn btn-outline btn-sm" onClick={() => { setShowForm(false); setEditItem(null); }}>Zrušit</button></div>
            </form>
          )}
          <div className="table-responsive">
            <table>
              <thead><tr><th>Otázka</th><th>Kategorie</th><th>Odkaz</th><th>Priorita</th><th>Akce</th></tr></thead>
              <tbody>
                {knowledge.map(k => (
                  <tr key={k.id} style={{ opacity: k.active ? 1 : 0.5 }}>
                    <td><strong style={{ fontSize: '0.85rem' }}>{k.question_cs}</strong><div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{k.keywords}</div></td>
                    <td><span className="badge badge-draft">{catLabels[k.category] || k.category}</span></td>
                    <td style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{k.link || '—'}</td>
                    <td>{k.priority}</td>
                    <td>
                      <div className="btn-group">
                        <button className="btn btn-outline btn-sm" onClick={() => { setEditItem(k); setForm({ keywords: k.keywords, question_cs: k.question_cs, question_en: k.question_en || '', answer_cs: k.answer_cs, answer_en: k.answer_en || '', link: k.link || '', category: k.category, priority: k.priority }); setShowForm(true); }}>Upravit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(k.id)}>Smazat</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {unanswered.length === 0 ? <div className="empty-state">Žádné nezodpovězené dotazy</div> : (
            <div className="table-responsive">
              <table>
                <thead><tr><th>Dotaz</th><th>Uživatel</th><th>Datum</th><th>Stav</th><th>Akce</th></tr></thead>
                <tbody>
                  {unanswered.map(u => (
                    <tr key={u.id} style={{ opacity: u.resolved ? 0.5 : 1 }}>
                      <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>{u.question}</td>
                      <td>{u.user_name || '—'}</td>
                      <td style={{ fontSize: '0.8rem' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString('cs-CZ') : '—'}</td>
                      <td><span className={`badge ${u.resolved ? 'badge-paid' : 'badge-overdue'}`}>{u.resolved ? 'Vyřešeno' : 'Čeká'}</span></td>
                      <td>
                        <div className="btn-group">
                          {!u.resolved && <button className="btn btn-primary btn-sm" onClick={() => { setResolveItem(u); setResolveForm({ keywords: '', answer_cs: '', answer_en: '', link: '', category: 'custom' }); }}>Zodpovědět</button>}
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteUnanswered(u.id)}>Smazat</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {resolveItem && (
            <div className="modal-overlay" onClick={() => setResolveItem(null)}>
              <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 550 }}>
                <div className="modal-header">
                  <h3 className="modal-title">Zodpovědět dotaz</h3>
                  <button className="modal-close" onClick={() => setResolveItem(null)}>&times;</button>
                </div>
                <div style={{ padding: '0 1.5rem', marginBottom: '0.75rem' }}>
                  <div style={{ background: 'var(--gray-50)', padding: '0.75rem', borderRadius: 'var(--radius)', fontSize: '0.9rem', fontWeight: 600 }}>„{resolveItem.question}"</div>
                </div>
                <form onSubmit={handleResolve} style={{ padding: '0 1.5rem 1.5rem' }}>
                  <div className="form-group"><label className="form-label">Klíčová slova *</label><input className="form-input" value={resolveForm.keywords} onChange={e => setResolveForm(f => ({ ...f, keywords: e.target.value }))} required placeholder="klíčové slovo1, slovo2" /></div>
                  <div className="form-group"><label className="form-label">Odpověď CZ *</label><textarea className="form-input" rows="3" value={resolveForm.answer_cs} onChange={e => setResolveForm(f => ({ ...f, answer_cs: e.target.value }))} required /></div>
                  <div className="form-group"><label className="form-label">Odpověď EN</label><textarea className="form-input" rows="2" value={resolveForm.answer_en} onChange={e => setResolveForm(f => ({ ...f, answer_en: e.target.value }))} /></div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Odkaz</label><input className="form-input" value={resolveForm.link} onChange={e => setResolveForm(f => ({ ...f, link: e.target.value }))} placeholder="/invoices" /></div>
                    <div className="form-group"><label className="form-label">Kategorie</label>
                      <select className="form-select" value={resolveForm.category} onChange={e => setResolveForm(f => ({ ...f, category: e.target.value }))}>
                        <option value="navigation">Navigace</option><option value="feature">Funkce</option><option value="help">Nápověda</option><option value="custom">Vlastní</option>
                      </select>
                    </div>
                  </div>
                  <div className="btn-group"><button type="submit" className="btn btn-primary">Uložit a přidat do znalostí</button><button type="button" className="btn btn-outline" onClick={() => setResolveItem(null)}>Zrušit</button></div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function Company() {
  const [form, setForm] = useState({
    name: 'Rainbow Family Investment', ico: '', dic: '', email: '', phone: '',
    address: '', city: '', zip: '', country: 'CZ', bank_account: '', bank_code: '', iban: '', swift: '',
    invoice_prefix: 'FV', invoice_counter: 1, default_due_days: 14, vat_payer: 0,
    invoice_format: '{prefix}{sep}{year}{sep}{num}', invoice_separator: '-',
    invoice_padding: 3, invoice_year_format: 'full'
  });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [hoveredLayout, setHoveredLayout] = useState(null);
  const hoverRef = useRef(null);

  useEffect(() => {
    api.getCompany().then(data => {
      if (data && data.name) setForm(f => ({ ...f, ...data }));
    }).finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await api.updateCompany(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  // Generate preview of invoice number
  const previewNumber = () => {
    const prefix = form.invoice_prefix || 'FV';
    const sep = form.invoice_separator || '-';
    const padding = form.invoice_padding || 3;
    const fullYear = new Date().getFullYear();
    const year = form.invoice_year_format === 'short' ? String(fullYear).slice(2) : String(fullYear);
    const num = String(form.invoice_counter || 1).padStart(padding, '0');
    const format = form.invoice_format || '{prefix}{sep}{year}{sep}{num}';
    return format.replace(/\{prefix\}/g, prefix).replace(/\{sep\}/g, sep).replace(/\{year\}/g, year).replace(/\{num\}/g, num);
  };

  if (loading) return <div className="loading">Načítání...</div>;

  return (
    <div>
      {saved && <div style={{ background: '#d1fae5', color: '#059669', padding: '0.75rem', borderRadius: 'var(--radius)', marginBottom: '1rem' }}>Uloženo!</div>}
      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="card-title" style={{ marginBottom: '1rem' }}>Fakturační údaje</div>
          <div className="form-group">
            <label className="form-label">Název společnosti *</label>
            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">IČO</label><input className="form-input" value={form.ico || ''} onChange={e => setForm(f => ({ ...f, ico: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">DIČ</label><input className="form-input" value={form.dic || ''} onChange={e => setForm(f => ({ ...f, dic: e.target.value }))} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Telefon</label><input className="form-input" value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
          </div>
          <div className="form-group"><label className="form-label">Adresa</label><input className="form-input" value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Město</label><input className="form-input" value={form.city || ''} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">PSČ</label><input className="form-input" value={form.zip || ''} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Země</label><input className="form-input" value={form.country || ''} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} /></div>
          </div>
        </div>
        <div className="card">
          <div className="card-title" style={{ marginBottom: '1rem' }}>Bankovní údaje</div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">Číslo účtu</label>
              <input className="form-input" value={form.bank_account || ''} onChange={e => setForm(f => ({ ...f, bank_account: e.target.value }))} placeholder="123456789" />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Kód banky</label>
              <select className="form-select" value={form.bank_code || ''} onChange={e => setForm(f => ({ ...f, bank_code: e.target.value }))}>
                <option value="">— Vyberte —</option>
                <option value="0100">0100 — Komerční banka</option>
                <option value="0300">0300 — ČSOB</option>
                <option value="0600">0600 — MONETA Money Bank</option>
                <option value="0710">0710 — Česká národní banka</option>
                <option value="0800">0800 — Česká spořitelna</option>
                <option value="2010">2010 — Fio banka</option>
                <option value="2020">2020 — BANCO</option>
                <option value="2060">2060 — Citfin</option>
                <option value="2070">2070 — Moravský Peněžní Ústav</option>
                <option value="2100">2100 — Hypoteční banka</option>
                <option value="2200">2200 — Creditas</option>
                <option value="2220">2220 — Artesa</option>
                <option value="2240">2240 — Poštová banka</option>
                <option value="2250">2250 — Banka CREDITAS</option>
                <option value="2260">2260 — NEY spořitelní družstvo</option>
                <option value="2275">2275 — Podnikatelská družstevní záložna</option>
                <option value="2600">2600 — Citibank Europe</option>
                <option value="2700">2700 — UniCredit Bank</option>
                <option value="3030">3030 — Air Bank</option>
                <option value="3050">3050 — BNP Paribas Personal Finance</option>
                <option value="3060">3060 — PKO BP S.A.</option>
                <option value="3500">3500 — ING Bank</option>
                <option value="4000">4000 — Expobank CZ</option>
                <option value="4300">4300 — Českomoravská záruční a rozvojová banka</option>
                <option value="5500">5500 — Raiffeisenbank</option>
                <option value="5800">5800 — J&T Banka</option>
                <option value="6000">6000 — PPF banka</option>
                <option value="6100">6100 — Equa bank (Raiffeisenbank)</option>
                <option value="6200">6200 — COMMERZBANK</option>
                <option value="6210">6210 — mBank</option>
                <option value="6300">6300 — BNP Paribas</option>
                <option value="6700">6700 — Všeobecná úverová banka</option>
                <option value="6800">6800 — Sberbank CZ (Česká spořitelna)</option>
                <option value="7910">7910 — Deutsche Bank</option>
                <option value="7940">7940 — Waldviertler Sparkasse Bank</option>
                <option value="7950">7950 — Raiffeisen stavební spořitelna</option>
                <option value="7960">7960 — Českomoravská stavební spořitelna</option>
                <option value="7970">7970 — Modrá pyramida stavební spořitelna</option>
                <option value="7990">7990 — Stavební spořitelna České spořitelny</option>
                <option value="8030">8030 — Volksbank Raiffeisenbank Nordoberpfalz</option>
                <option value="8040">8040 — Oberbank</option>
                <option value="8060">8060 — Stavební spořitelna HYPO</option>
                <option value="8090">8090 — Česká exportní banka</option>
                <option value="8150">8150 — HSBC Continental Europe</option>
                <option value="8200">8200 — PRIVAT BANK</option>
                <option value="8220">8220 — Payment Execution</option>
                <option value="8230">8230 — EEPAYS</option>
                <option value="8240">8240 — Družstevní záložna Kredit</option>
                <option value="8250">8250 — Bank of China</option>
                <option value="8255">8255 — Bank of Communications</option>
                <option value="8265">8265 — Industrial and Commercial Bank of China</option>
                <option value="8270">8270 — Fairplay Pay</option>
                <option value="8280">8280 — B-Efekt</option>
                <option value="8293">8293 — Revolut</option>
                <option value="8299">8299 — Partners banka</option>
              </select>
            </div>
          </div>
          {form.bank_account && form.bank_code && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--gray-500)' }}>
              Celé číslo účtu: <strong>{form.bank_account}/{form.bank_code}</strong>
            </div>
          )}
          <div className="form-row" style={{ marginTop: '1rem' }}>
            <div className="form-group"><label className="form-label">IBAN</label><input className="form-input" value={form.iban || ''} onChange={e => setForm(f => ({ ...f, iban: e.target.value }))} placeholder="CZ65 0800 0000 1920 0014 5399" /></div>
            <div className="form-group"><label className="form-label">SWIFT/BIC</label><input className="form-input" value={form.swift || ''} onChange={e => setForm(f => ({ ...f, swift: e.target.value }))} placeholder="GIBACZPX" /></div>
          </div>
        </div>
        <div className="card">
          <div className="card-title" style={{ marginBottom: '1rem' }}>DPH</div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!form.vat_payer} onChange={e => setForm(f => ({ ...f, vat_payer: e.target.checked ? 1 : 0 }))} style={{ width: 20, height: 20 }} />
              <div>
                <div style={{ fontWeight: 600 }}>Plátce DPH</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                  {form.vat_payer ? 'Nové faktury budou obsahovat DPH dle zákonných sazeb (0%, 12%, 21%)' : 'Nové faktury budou bez DPH (neplátce)'}
                </div>
              </div>
            </label>
          </div>
        </div>
        <div className="card">
          <div className="card-title" style={{ marginBottom: '1rem' }}>Fakturace</div>
          <div className="form-group">
            <label className="form-label">Výchozí splatnost (dnů)</label>
            <input className="form-input" type="number" min="1" max="365" value={form.default_due_days || 14}
              onChange={e => setForm(f => ({ ...f, default_due_days: parseInt(e.target.value) || 14 }))}
              style={{ maxWidth: 150 }}
            />
            <small style={{ color: 'var(--gray-500)', fontSize: '0.75rem' }}>Automaticky se nastaví datum splatnosti při vytvoření faktury</small>
          </div>
        </div>
        <div className="card">
          <div className="card-title" style={{ marginBottom: '1rem' }}>Číselná řada faktur</div>
          <div style={{ background: 'var(--gray-50)', border: '2px solid var(--primary)', borderRadius: 'var(--radius)', padding: '1rem', marginBottom: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gray-500)', marginBottom: 4 }}>Náhled další faktury</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace' }}>{previewNumber()}</div>
          </div>
          <div className="form-group">
            <label className="form-label">Formát číslování</label>
            <select className="form-select" value={form.invoice_format || '{prefix}{sep}{year}{sep}{num}'} onChange={e => setForm(f => ({ ...f, invoice_format: e.target.value }))}>
              {formatTemplates.map(t => <option key={t.value} value={t.value}>{t.label} ({t.example})</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Prefix</label>
              <input className="form-input" value={form.invoice_prefix || ''} onChange={e => setForm(f => ({ ...f, invoice_prefix: e.target.value }))} placeholder="FV" />
            </div>
            <div className="form-group">
              <label className="form-label">Oddělovač</label>
              <select className="form-select" value={form.invoice_separator ?? '-'} onChange={e => setForm(f => ({ ...f, invoice_separator: e.target.value }))}>
                {separatorOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Formát roku</label>
              <select className="form-select" value={form.invoice_year_format || 'full'} onChange={e => setForm(f => ({ ...f, invoice_year_format: e.target.value }))}>
                <option value="full">Celý rok (2026)</option>
                <option value="short">Krátký (26)</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Počet číslic</label>
              <select className="form-select" value={form.invoice_padding || 3} onChange={e => setForm(f => ({ ...f, invoice_padding: parseInt(e.target.value) }))}>
                <option value={2}>2 (01, 02...)</option>
                <option value={3}>3 (001, 002...)</option>
                <option value={4}>4 (0001, 0002...)</option>
                <option value={5}>5 (00001, 00002...)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Další číslo</label>
              <input className="form-input" type="number" min="1" value={form.invoice_counter || 1} onChange={e => setForm(f => ({ ...f, invoice_counter: parseInt(e.target.value) || 1 }))} />
            </div>
          </div>
        </div>
        <div className="card" style={{ position: 'relative' }}>
          <div className="card-title" style={{ marginBottom: '0.5rem' }}>Vzhled faktury</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginBottom: '1.25rem' }}>Zvolte layout, který se použije při zobrazení a tisku faktur. Najeďte myší pro realistický náhled.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {invoiceLayouts.map(layout => {
              const selected = (form.invoice_layout || 'klasicky') === layout.key;
              return (
                <div key={layout.key}
                  onClick={() => setForm(f => ({ ...f, invoice_layout: layout.key }))}
                  onMouseEnter={(e) => { setHoveredLayout(layout.key); hoverRef.current = e.currentTarget; }}
                  onMouseLeave={() => setHoveredLayout(null)}
                  style={{
                    border: selected ? `2px solid ${layout.accent}` : '2px solid var(--gray-200)',
                    borderRadius: 'var(--radius-lg)', padding: 0, cursor: 'pointer',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)', overflow: 'hidden',
                    boxShadow: selected ? `0 4px 16px ${layout.accent}20` : 'none',
                    transform: selected ? 'translateY(-2px)' : 'none',
                  }}
                >
                  {/* Mini realistic preview thumbnail — fixed height for grid alignment */}
                  <div style={{ height: 180, background: selected ? `${layout.accent}06` : '#fff', borderBottom: `1px solid ${selected ? layout.accent + '30' : 'var(--gray-200)'}`, padding: 6, overflow: 'hidden' }}>
                    <div style={{ transform: 'scale(0.52)', transformOrigin: 'top left', width: '192%', pointerEvents: 'none' }}>
                      <InvoicePreview layout={layout} companyName={form.name} />
                    </div>
                  </div>
                  {/* Label */}
                  <div style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 2 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: layout.accent, flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--gray-900)' }}>{layout.name}</span>
                      {selected && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill={layout.accent} style={{ marginLeft: 'auto' }}>
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                      )}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', lineHeight: 1.4 }}>{layout.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Large hover preview popup - realistic invoice */}
          {hoveredLayout && (() => {
            const layout = invoiceLayouts.find(l => l.key === hoveredLayout);
            if (!layout) return null;
            return (
              <div style={{
                position: 'fixed', right: 40, top: '50%', transform: 'translateY(-50%)',
                width: 380, maxHeight: '85vh', overflowY: 'auto',
                background: 'white', borderRadius: 'var(--radius-lg)',
                border: `2px solid ${layout.accent}30`,
                boxShadow: '0 25px 60px rgba(0,0,0,0.15), 0 8px 20px rgba(0,0,0,0.08)',
                zIndex: 1000, overflow: 'hidden', pointerEvents: 'none',
                animation: 'fadeIn 0.15s ease-out',
              }}>
                <div style={{ padding: '8px 16px', fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: layout.accent }} />
                  Náhled: {layout.name}
                </div>
                <InvoicePreview layout={layout} companyName={form.name} />
              </div>
            );
          })()}
        </div>
        <button type="submit" className="btn btn-primary">Uložit nastavení</button>
      </form>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-title" style={{ marginBottom: '1rem' }}>Logo společnosti</div>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{
            width: 200, height: 100, borderRadius: 'var(--radius)', border: '2px solid var(--gray-200)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            background: form.logo ? 'white' : 'var(--gray-50)', transition: 'all 0.2s ease'
          }}>
            {form.logo ? (
              <img src={form.logo} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--gray-400)' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                <div style={{ fontSize: '0.7rem', marginTop: 4 }}>Bez loga</div>
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div
              className="logo-upload-area"
              onClick={() => document.getElementById('logo-upload-input').click()}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--primary-50)'; }}
              onDragLeave={(e) => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.background = ''; }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = ''; e.currentTarget.style.background = '';
                const file = e.dataTransfer.files[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = async (ev) => {
                  const logo = ev.target.result;
                  setForm(f => ({ ...f, logo }));
                  await api.updateCompany({ ...form, logo });
                  setSaved(true); setTimeout(() => setSaved(false), 3000);
                };
                reader.readAsDataURL(file);
              }}
            >
              <input id="logo-upload-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                const file = e.target.files[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = async (ev) => {
                  const logo = ev.target.result;
                  setForm(f => ({ ...f, logo }));
                  await api.updateCompany({ ...form, logo });
                  setSaved(true); setTimeout(() => setSaved(false), 3000);
                };
                reader.readAsDataURL(file);
              }} />
              <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--gray-700)' }}>Nahrát logo</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: 2 }}>Přetáhněte soubor nebo klikněte</div>
            </div>
            {form.logo && (
              <button className="btn btn-outline btn-sm" style={{ marginTop: '0.75rem' }} onClick={async () => { await api.updateCompany({ ...form, logo: null }); setForm(f => ({ ...f, logo: null })); }}>
                Odstranit logo
              </button>
            )}
            <small style={{ color: 'var(--gray-500)', fontSize: '0.75rem', display: 'block', marginTop: '0.5rem' }}>PNG nebo JPG, max 200px šířka. Zobrazí se na fakturách.</small>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-title" style={{ marginBottom: '1rem' }}>Správa dat</div>
        <a href="/api/backup" className="btn btn-outline" download>Stáhnout zálohu databáze</a>
        <small style={{ color: 'var(--gray-500)', fontSize: '0.75rem', display: 'block', marginTop: '0.5rem' }}>Stáhne kompletní zálohu databáze (SQLite soubor)</small>
      </div>

      <ChatbotAdmin />
    </div>
  );
}
