import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', desc: 'Finanční přehled', path: '/', icon: '📊', section: 'Navigace' },
  { id: 'invoices', label: 'Faktury', desc: 'Přehled faktur', path: '/invoices', icon: '📄', section: 'Navigace' },
  { id: 'new-invoice', label: 'Nová faktura', desc: 'Vytvořit novou fakturu', path: '/invoices/new', icon: '➕', section: 'Akce' },
  { id: 'clients', label: 'Klienti', desc: 'Správa klientů', path: '/clients', icon: '👤', section: 'Navigace' },
  { id: 'evidence', label: 'Evidence', desc: 'Přijaté doklady', path: '/evidence', icon: '📋', section: 'Navigace' },
  { id: 'recurring', label: 'Opakované faktury', desc: 'Automatické faktury', path: '/recurring', icon: '🔄', section: 'Navigace' },
  { id: 'bank', label: 'Banka', desc: 'Bankovní transakce', path: '/bank', icon: '🏦', section: 'Navigace' },
  { id: 'accounting', label: 'Účetnictví', desc: 'Účtová osnova', path: '/accounting', icon: '📒', section: 'Navigace' },
  { id: 'vat', label: 'DPH', desc: 'Přiznání k DPH', path: '/vat', icon: '💰', section: 'Navigace' },
  { id: 'financni-urad', label: 'Finanční úřad', desc: 'KH, SH, DPFO', path: '/financni-urad', icon: '🏛️', section: 'Navigace' },
  { id: 'currencies', label: 'Měny', desc: 'Správa kurzů', path: '/currencies', icon: '💱', section: 'Navigace' },
  { id: 'company', label: 'Společnost', desc: 'Nastavení firmy', path: '/company', icon: '🏢', section: 'Správa' },
  { id: 'users', label: 'Uživatelé', desc: 'Správa uživatelů', path: '/users', icon: '👥', section: 'Správa' },
  { id: 'profile', label: 'Můj profil', desc: 'Osobní nastavení', path: '/profile', icon: '⚙️', section: 'Správa' },
];

const statusLabels = { draft: 'Koncept', sent: 'Odesláno', paid: 'Zaplaceno', overdue: 'Po splatnosti', cancelled: 'Zrušeno' };

function Highlight({ text, query }) {
  if (!text || !query) return <>{text}</>;
  const str = String(text);
  const idx = str.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{str}</>;
  return <>{str.slice(0, idx)}<mark style={{ background: '#fef08a', padding: 0, borderRadius: 2 }}>{str.slice(idx, idx + query.length)}</mark>{str.slice(idx + query.length)}</>;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const navigate = useNavigate();
  const searchTimer = useRef(null);

  // Ctrl+K / Cmd+K to toggle
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQ('');
      setActiveIdx(0);
      setSearchResults(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Search API when query changes
  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (q.length < 2) { setSearchResults(null); setSearching(false); return; }
    setSearching(true);
    searchTimer.current = setTimeout(() => {
      api.search(q).then(r => {
        setSearchResults(r);
        setSearching(false);
      }).catch(() => setSearching(false));
    }, 250);
    return () => clearTimeout(searchTimer.current);
  }, [q]);

  // Filter nav items by query
  const filteredNav = q.length > 0
    ? navItems.filter(item =>
        item.label.toLowerCase().includes(q.toLowerCase()) ||
        item.desc.toLowerCase().includes(q.toLowerCase())
      )
    : navItems;

  // Build combined result list
  const allItems = [];

  // When no query, show quick nav; when typing, show matching nav
  if (q.length === 0 || filteredNav.length > 0) {
    filteredNav.forEach(n => allItems.push({ type: 'nav', ...n }));
  }

  // Add API search results (invoices, clients, evidence)
  if (searchResults) {
    (searchResults.invoices || []).forEach(inv =>
      allItems.push({
        type: 'invoice', label: inv.invoice_number,
        desc: `${inv.client_name || ''} — ${inv.total || 0} ${inv.currency || 'CZK'}`,
        status: inv.status,
        path: `/invoices/${inv.id}`, icon: '📄', section: 'Faktury',
      })
    );
    (searchResults.clients || []).forEach(c =>
      allItems.push({
        type: 'client', label: c.name,
        desc: c.ico ? `IČ: ${c.ico}` : c.email || '',
        path: `/clients/${c.id}`, icon: '👤', section: 'Klienti',
      })
    );
    (searchResults.evidence || []).forEach(e =>
      allItems.push({
        type: 'evidence', label: e.title,
        desc: `${e.amount || ''} ${e.currency || ''}`.trim(),
        path: '/evidence', icon: '📋', section: 'Evidence',
      })
    );
  }

  const hasApiResults = searchResults && (
    (searchResults.invoices?.length || 0) + (searchResults.clients?.length || 0) + (searchResults.evidence?.length || 0)
  ) > 0;

  const go = useCallback((path) => {
    setOpen(false);
    navigate(path);
  }, [navigate]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(prev => Math.min(prev + 1, allItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allItems[activeIdx]) {
        go(allItems[activeIdx].path);
      } else if (q.length >= 2) {
        go(`/search?q=${encodeURIComponent(q)}`);
      }
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.querySelector(`[data-idx="${activeIdx}"]`);
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIdx]);

  useEffect(() => { setActiveIdx(0); }, [q, searchResults]);

  if (!open) return null;

  // Group items by section
  const sections = [];
  const sectionMap = {};
  allItems.forEach((item, idx) => {
    const s = item.section || 'Ostatní';
    if (!sectionMap[s]) { sectionMap[s] = []; sections.push(s); }
    sectionMap[s].push({ ...item, globalIdx: idx });
  });

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10002,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 'max(8vh, 32px)',
        animation: 'fadeIn 0.1s ease-out',
      }}
      onClick={() => setOpen(false)}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card-bg, white)', borderRadius: 16,
          boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
          width: '100%', maxWidth: 580, margin: '0 12px',
          overflow: 'hidden',
          animation: 'scaleIn 0.15s ease-out',
        }}
      >
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--gray-200, #e2e8f0)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400, #94a3b8)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Hledat stránky, faktury, klienty..."
            style={{
              flex: 1, border: 'none', outline: 'none', fontSize: 15,
              background: 'transparent', color: 'var(--gray-900, #0f172a)',
            }}
          />
          {searching && <span className="search-spinner" />}
          <kbd style={{
            padding: '2px 8px', borderRadius: 6,
            background: 'var(--gray-100, #f1f5f9)',
            border: '1px solid var(--gray-200, #e2e8f0)',
            fontSize: 11, fontWeight: 600, color: 'var(--gray-500, #64748b)',
            fontFamily: 'monospace',
          }}>ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ maxHeight: 420, overflowY: 'auto', padding: '8px 0' }}>
          {/* No results state */}
          {allItems.length === 0 && q.length >= 2 && !searching && (
            <div style={{ padding: '24px 18px', textAlign: 'center', color: 'var(--gray-400, #94a3b8)', fontSize: 14 }}>
              Žádné výsledky pro „{q}"
            </div>
          )}

          {/* Grouped results */}
          {sections.map(sec => (
            <div key={sec}>
              <div style={{
                padding: '8px 18px 4px', fontSize: 10, fontWeight: 700,
                color: 'var(--gray-400, #94a3b8)', textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}>{sec}</div>
              {sectionMap[sec].map(item => (
                <div
                  key={item.globalIdx}
                  data-idx={item.globalIdx}
                  onClick={() => go(item.path)}
                  onMouseEnter={() => setActiveIdx(item.globalIdx)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 18px', cursor: 'pointer',
                    background: activeIdx === item.globalIdx ? 'var(--primary-50, #eef2ff)' : 'transparent',
                    transition: 'background 0.08s',
                  }}
                >
                  <span style={{ fontSize: 18, width: 28, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-900, #0f172a)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <Highlight text={item.label} query={q} />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--gray-500, #64748b)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <Highlight text={item.desc} query={q} />
                    </div>
                  </div>
                  {/* Status badge for invoices */}
                  {item.status && (
                    <span className={`badge badge-${item.status}`} style={{ fontSize: 10, flexShrink: 0 }}>
                      {statusLabels[item.status] || item.status}
                    </span>
                  )}
                  {activeIdx === item.globalIdx && (
                    <span style={{ fontSize: 11, color: 'var(--gray-400, #94a3b8)', flexShrink: 0 }}>↵</span>
                  )}
                </div>
              ))}
            </div>
          ))}

          {/* Hint text when no query */}
          {q.length < 2 && (
            <div style={{ padding: '8px 18px', textAlign: 'center', color: 'var(--gray-400, #94a3b8)', fontSize: 12 }}>
              Zadejte text pro hledání faktur a klientů
            </div>
          )}
        </div>

        {/* Show all results link */}
        {q.length >= 2 && hasApiResults && (
          <div
            onClick={() => go(`/search?q=${encodeURIComponent(q)}`)}
            style={{
              padding: '10px 18px', cursor: 'pointer',
              borderTop: '1px solid var(--gray-200, #e2e8f0)',
              textAlign: 'center', color: 'var(--primary)', fontSize: 13, fontWeight: 600,
              transition: 'background 0.1s',
            }}
            onMouseOver={e => e.currentTarget.style.background = 'var(--primary-50, #eef2ff)'}
            onMouseOut={e => e.currentTarget.style.background = ''}
          >
            Zobrazit všechny výsledky pro „{q}"
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: '10px 18px', borderTop: '1px solid var(--gray-200, #e2e8f0)',
          display: 'flex', gap: 16, fontSize: 11, color: 'var(--gray-400, #94a3b8)',
        }}>
          <span><kbd style={{ padding: '1px 4px', background: 'var(--gray-100)', borderRadius: 3, fontFamily: 'monospace', fontSize: 10 }}>↑↓</kbd> navigace</span>
          <span><kbd style={{ padding: '1px 4px', background: 'var(--gray-100)', borderRadius: 3, fontFamily: 'monospace', fontSize: 10 }}>↵</kbd> otevřít</span>
          <span><kbd style={{ padding: '1px 4px', background: 'var(--gray-100)', borderRadius: 3, fontFamily: 'monospace', fontSize: 10 }}>esc</kbd> zavřít</span>
        </div>
      </div>
    </div>
  );
}
