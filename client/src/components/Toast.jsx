import React, { useState, useCallback, useContext, createContext, useRef, useEffect } from 'react';

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

const icons = {
  success: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  error: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  warning: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  info: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
};

const colors = {
  success: { bg: '#ecfdf5', border: '#a7f3d0', color: '#065f46', icon: '#059669' },
  error: { bg: '#fef2f2', border: '#fecaca', color: '#991b1b', icon: '#dc2626' },
  warning: { bg: '#fffbeb', border: '#fde68a', color: '#92400e', icon: '#d97706' },
  info: { bg: '#eff6ff', border: '#bfdbfe', color: '#1e40af', icon: '#3b82f6' },
};

function ToastItem({ toast, onRemove }) {
  const [exiting, setExiting] = useState(false);
  const c = colors[toast.type] || colors.info;

  useEffect(() => {
    const t = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onRemove(toast.id), 300);
    }, toast.duration || 4000);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    setExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  return (
    <div
      onClick={dismiss}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px',
        background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)',
        cursor: 'pointer', maxWidth: 380, width: '100%',
        animation: exiting ? 'toast-out 0.3s ease-in forwards' : 'toast-in 0.3s ease-out',
        pointerEvents: 'auto',
      }}
    >
      <span style={{ color: c.icon, flexShrink: 0, marginTop: 1 }}>{icons[toast.type]}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {toast.title && <div style={{ fontWeight: 700, fontSize: 13, color: c.color, marginBottom: 2 }}>{toast.title}</div>}
        <div style={{ fontSize: 13, color: c.color, lineHeight: 1.4 }}>{toast.message}</div>
      </div>
      <span style={{ color: c.color, opacity: 0.4, fontSize: 16, lineHeight: 1, flexShrink: 0 }}>&times;</span>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const addToast = useCallback((type, message, options = {}) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, type, message, ...options }]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback({
    success: (msg, opts) => addToast('success', msg, opts),
    error: (msg, opts) => addToast('error', msg, opts),
    warning: (msg, opts) => addToast('warning', msg, opts),
    info: (msg, opts) => addToast('info', msg, opts),
  }, [addToast]);

  // Make it callable as toast.success(), toast.error() etc.
  const api = useRef(toast);
  api.current = toast;

  return (
    <ToastContext.Provider value={api.current}>
      {children}
      <div style={{
        position: 'fixed', top: 16, right: 16, zIndex: 10000,
        display: 'flex', flexDirection: 'column', gap: 8,
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
