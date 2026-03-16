import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const statusLabels = { draft: 'Koncept', sent: 'Odesláno', paid: 'Zaplaceno', overdue: 'Po splatnosti', cancelled: 'Zrušeno' };

const quickNav = [
  { label: 'Dashboard', desc: 'Finanční přehled', path: '/', icon: '📊' },
  { label: 'Faktury', desc: 'Přehled faktur', path: '/invoices', icon: '📄' },
  { label: 'Nová faktura', desc: 'Vytvořit fakturu', path: '/invoices/new', icon: '➕' },
  { label: 'Klienti', desc: 'Správa klientů', path: '/clients', icon: '👤' },
  { label: 'Evidence', desc: 'Přijaté doklady', path: '/evidence', icon: '📋' },
  { label: 'Banka', desc: 'Bankovní transakce', path: '/bank', icon: '🏦' },
];

function Highlight({ text, query }) {
  if (!text || !query) return <>{text}</>;
  const str = String(text);
  const idx = str.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{str}</>;
  return <>{str.slice(0, idx)}<mark style={{ background: '#fef08a', padding: 0, borderRadius: 2 }}>{str.slice(idx, idx + query.length)}</mark>{str.slice(idx + query.length)}</>;
}

const CommandPalette = forwardRef(function CommandPalette(_, ref) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const wrapRef = useRef(null);
  const searchTimer = useRef(null);
  const navigate = useNavigate();

  useImperativeHandle(ref, () => ({
    focus: () => { inputRef.current?.focus(); },
  }));

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Ctrl+K focuses the input
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
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

  // Build items
  const items = [];

  if (q.length < 2) {
    // Show quick nav when no real query
    quickNav.forEach(n => items.push({ type: 'nav', ...n }));
  } else {
    // Filter nav by query
    const filtered = quickNav.filter(n =>
      n.label.toLowerCase().includes(q.toLowerCase()) ||
      n.desc.toLowerCase().includes(q.toLowerCase())
    );
    filtered.forEach(n => items.push({ type: 'nav', ...n }));

    // API results
    if (searchResults) {
      (searchResults.invoices || []).slice(0, 4).forEach(inv =>
        items.push({
          type: 'invoice', label: inv.invoice_number,
          desc: `${inv.client_name || ''} — ${inv.total || 0} ${inv.currency || 'CZK'}`,
          status: inv.status,
          path: `/invoices/${inv.id}`, icon: '📄',
        })
      );
      (searchResults.clients || []).slice(0, 3).forEach(c =>
        items.push({
          type: 'client', label: c.name,
          desc: c.ico ? `IČ: ${c.ico}` : c.email || '',
          path: `/clients/${c.id}`, icon: '👤',
        })
      );
      (searchResults.evidence || []).slice(0, 3).forEach(e =>
        items.push({
          type: 'evidence', label: e.title,
          desc: `${e.amount || ''} ${e.currency || ''}`.trim(),
          path: '/evidence', icon: '📋',
        })
      );
    }
  }

  const go = useCallback((path) => {
    setOpen(false);
    setQ('');
    navigate(path);
  }, [navigate]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIdx(prev => Math.min(prev + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[activeIdx]) {
        go(items[activeIdx].path);
      } else if (q.length >= 2) {
        go(`/search?q=${encodeURIComponent(q)}`);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  useEffect(() => { setActiveIdx(0); }, [q, searchResults]);

  // Scroll active into view
  useEffect(() => {
    if (dropdownRef.current) {
      const el = dropdownRef.current.querySelector(`[data-idx="${activeIdx}"]`);
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIdx]);

  const hasApiResults = searchResults && (
    (searchResults.invoices?.length || 0) + (searchResults.clients?.length || 0) + (searchResults.evidence?.length || 0)
  ) > 0;

  return (
    <div className="search-typeahead" ref={wrapRef}>
      <div className="search-typeahead-input-wrap">
        <svg className="search-typeahead-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          ref={inputRef}
          className="search-typeahead-input"
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Hledat..."
          autoComplete="off"
        />
        {searching && <span className="search-typeahead-spinner" />}
        <kbd className="search-typeahead-kbd">⌘K</kbd>
      </div>

      {open && (
        <div className="search-typeahead-dropdown" ref={dropdownRef}>
          {items.length === 0 && q.length >= 2 && !searching && (
            <div className="search-typeahead-empty">
              Žádné výsledky pro „{q}"
            </div>
          )}

          {items.map((item, idx) => (
            <div
              key={idx}
              data-idx={idx}
              className={`search-typeahead-item ${activeIdx === idx ? 'active' : ''}`}
              onClick={() => go(item.path)}
              onMouseEnter={() => setActiveIdx(idx)}
            >
              <span className="search-typeahead-item-icon">{item.icon}</span>
              <div className="search-typeahead-item-text">
                <span className="search-typeahead-item-label">
                  <Highlight text={item.label} query={q} />
                </span>
                <span className="search-typeahead-item-desc">
                  <Highlight text={item.desc} query={q} />
                </span>
              </div>
              {item.status && (
                <span className={`badge badge-${item.status}`} style={{ fontSize: 10, flexShrink: 0 }}>
                  {statusLabels[item.status] || item.status}
                </span>
              )}
              {activeIdx === idx && <span className="search-typeahead-enter">↵</span>}
            </div>
          ))}

          {q.length >= 2 && hasApiResults && (
            <div
              className="search-typeahead-all"
              onClick={() => go(`/search?q=${encodeURIComponent(q)}`)}
            >
              Zobrazit všechny výsledky →
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default CommandPalette;
