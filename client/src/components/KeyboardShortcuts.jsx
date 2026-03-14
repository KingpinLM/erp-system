import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const shortcuts = [
  { key: 'n', label: 'Nová faktura', path: '/invoices/new', section: 'Navigace' },
  { key: 'f', label: 'Faktury', path: '/invoices', section: 'Navigace' },
  { key: 'k', label: 'Klienti', path: '/clients', section: 'Navigace' },
  { key: 'd', label: 'Dashboard', path: '/', section: 'Navigace' },
  { key: 'e', label: 'Evidence', path: '/evidence', section: 'Navigace' },
  { key: 'b', label: 'Banka', path: '/bank', section: 'Navigace' },
  { key: 'u', label: 'Účetnictví', path: '/accounting', section: 'Navigace' },
];

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      // Don't fire in inputs/textareas
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;
      // Ctrl+K is handled by GlobalSearch
      if (e.ctrlKey || e.metaKey) return;

      if (e.key === '?') {
        e.preventDefault();
        setShowHelp(v => !v);
        return;
      }
      if (e.key === 'Escape') {
        setShowHelp(false);
        return;
      }

      const shortcut = shortcuts.find(s => s.key === e.key.toLowerCase());
      if (shortcut) {
        e.preventDefault();
        navigate(shortcut.path);
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [navigate]);

  return { showHelp, setShowHelp };
}

export function ShortcutsHelp({ open, onClose }) {
  if (!open) return null;

  const sections = {};
  shortcuts.forEach(s => {
    if (!sections[s.section]) sections[s.section] = [];
    sections[s.section].push(s);
  });
  // Add special shortcuts
  sections['Systém'] = [
    { key: 'Ctrl+K', label: 'Hledání' },
    { key: '?', label: 'Zobrazit/skrýt nápovědu' },
    { key: 'Esc', label: 'Zavřít dialog' },
  ];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10002,
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn 0.15s ease-out',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card-bg, white)', borderRadius: 14,
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          width: '100%', maxWidth: 420,
          animation: 'scaleIn 0.2s ease-out',
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--gray-200)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--gray-900)' }}>Klávesové zkratky</div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', fontSize: 20, lineHeight: 1 }}
          >&times;</button>
        </div>
        <div style={{ padding: '12px 20px 20px' }}>
          {Object.entries(sections).map(([section, items]) => (
            <div key={section} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                {section}
              </div>
              {items.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
                  <span style={{ fontSize: 13, color: 'var(--gray-700)' }}>{s.label}</span>
                  <kbd style={{
                    padding: '2px 8px', borderRadius: 5, fontSize: 12, fontWeight: 600, fontFamily: 'monospace',
                    background: 'var(--gray-100)', border: '1px solid var(--gray-200)', color: 'var(--gray-600)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}>{s.key}</kbd>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
