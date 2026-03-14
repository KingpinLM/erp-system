import React, { useState, useCallback, useContext, createContext } from 'react';

const ConfirmContext = createContext(null);

export function useConfirm() {
  return useContext(ConfirmContext);
}

const typeStyles = {
  danger: { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', btnBg: '#dc2626', btnHover: '#b91c1c', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
  warning: { color: '#d97706', bg: '#fffbeb', border: '#fde68a', btnBg: '#d97706', btnHover: '#b45309', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> },
  info: { color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', btnBg: '#3b82f6', btnHover: '#2563eb', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> },
};

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setState({ ...options, resolve });
    });
  }, []);

  const handleConfirm = () => {
    state?.resolve(true);
    setState(null);
  };

  const handleCancel = () => {
    state?.resolve(false);
    setState(null);
  };

  const t = typeStyles[state?.type] || typeStyles.danger;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 10001,
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.15s ease-out',
            padding: 16,
          }}
          onClick={handleCancel}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--card-bg, white)', borderRadius: 14,
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              width: '100%', maxWidth: 400,
              animation: 'scaleIn 0.2s ease-out',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '20px 24px 0', display: 'flex', gap: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: t.bg, border: `1px solid ${t.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {t.icon}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--gray-900, #0f172a)', marginBottom: 4 }}>
                  {state.title || 'Potvrdit akci'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--gray-500, #64748b)', lineHeight: 1.5 }}>
                  {state.message}
                </div>
              </div>
            </div>
            <div style={{
              padding: '16px 24px 20px', display: 'flex', gap: 8,
              justifyContent: 'flex-end', marginTop: 8,
            }}>
              <button
                onClick={handleCancel}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: '1px solid var(--gray-200)',
                  background: 'var(--card-bg, white)', color: 'var(--gray-700, #334155)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--gray-50)'}
                onMouseOut={e => e.currentTarget.style.background = 'var(--card-bg, white)'}
              >
                {state.cancelText || 'Zrušit'}
              </button>
              <button
                onClick={handleConfirm}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none',
                  background: t.btnBg, color: 'white',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseOver={e => e.currentTarget.style.background = t.btnHover}
                onMouseOut={e => e.currentTarget.style.background = t.btnBg}
              >
                {state.confirmText || 'Potvrdit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
