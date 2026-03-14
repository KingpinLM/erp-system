import React, { useState, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from './api';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Invoices from './pages/Invoices';
import InvoiceDetail from './pages/InvoiceDetail';
import InvoiceForm from './pages/InvoiceForm';
import Evidence from './pages/Evidence';
import Clients from './pages/Clients';
import Users from './pages/Users';
import Currencies from './pages/Currencies';
import Company from './pages/Company';
import Profile from './pages/Profile';
import UserDetail from './pages/UserDetail';
import ClientDetail from './pages/ClientDetail';
import SuperAdmin from './pages/SuperAdmin';
import RecurringInvoices from './pages/RecurringInvoices';
import Accounting from './pages/Accounting';
import VatReport from './pages/VatReport';
import Bank from './pages/Bank';
import SearchResults from './pages/SearchResults';
import './styles.css';

export const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }) {
  const [user] = useState(() => {
    if (window.__AUTH__?.user) {
      localStorage.setItem('erp_user', JSON.stringify(window.__AUTH__.user));
      return window.__AUTH__.user;
    }
    try { return JSON.parse(localStorage.getItem('erp_user')); } catch { return null; }
  });
  const [token] = useState(() => {
    if (window.__AUTH__?.token) {
      localStorage.setItem('erp_token', window.__AUTH__.token);
      return window.__AUTH__.token;
    }
    return localStorage.getItem('erp_token');
  });
  const [tenant] = useState(() => {
    if (window.__AUTH__?.tenant) {
      localStorage.setItem('erp_tenant', JSON.stringify(window.__AUTH__.tenant));
      return window.__AUTH__.tenant;
    }
    try { return JSON.parse(localStorage.getItem('erp_tenant')); } catch { return null; }
  });

  const logout = () => {
    localStorage.removeItem('erp_token');
    localStorage.removeItem('erp_user');
    localStorage.removeItem('erp_tenant');
    window.location.href = '/login';
  };

  const can = (...roles) => user && roles.includes(user.role);
  const isSuperadmin = user?.role === 'superadmin';

  return (
    <AuthContext.Provider value={{ user, token, tenant, logout, can, isSuperadmin }}>
      {children}
    </AuthContext.Provider>
  );
}

function SuperadminRoute({ children }) {
  const { token, isSuperadmin } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (!isSuperadmin) return <Navigate to="/" replace />;
  return children;
}

function TenantRoute({ children }) {
  const { token, user, isSuperadmin } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (isSuperadmin) return <Navigate to="/superadmin" replace />;
  if (!user?.tenant_id) return <Navigate to="/onboarding" replace />;
  return children;
}

function OnboardingRoute({ children }) {
  const { token, user, isSuperadmin } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (isSuperadmin) return <Navigate to="/superadmin" replace />;
  if (user?.tenant_id) return <Navigate to="/" replace />;
  return children;
}

const NavIcon = ({ name, size = 18 }) => {
  const icons = {
    dashboard: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    invoice: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>,
    orders: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>,
    clients: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    products: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
    evidence: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 12l2 2 4-4"/></svg>,
    bank: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>,
    cash: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="12" cy="12" r="4"/><path d="M2 10h2"/><path d="M20 10h2"/><path d="M2 14h2"/><path d="M20 14h2"/></svg>,
    accounting: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/></svg>,
    vat: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>,
    currencies: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8"/><line x1="3" y1="3" x2="6" y2="6"/><line x1="21" y1="3" x2="18" y2="6"/><line x1="3" y1="21" x2="6" y2="18"/><line x1="21" y1="21" x2="18" y2="18"/></svg>,
    recurring: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>,
    aging: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    company: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M9 8h1"/><path d="M9 12h1"/><path d="M9 16h1"/><path d="M14 8h1"/><path d="M14 12h1"/><path d="M14 16h1"/><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/></svg>,
    users: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>,
    profile: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    logout: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    search: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  };
  return icons[name] || null;
};

function Sidebar({ open, onClose }) {
  const { user, tenant, logout, can } = useAuth();
  const location = useLocation();

  const sections = [
    {
      items: [
        { to: '/', label: 'Dashboard', icon: 'dashboard' },
      ]
    },
    {
      title: 'Finance',
      items: [
        { to: '/invoices', label: 'Faktury', icon: 'invoice' },
        { to: '/clients', label: 'Klienti', icon: 'clients' },
        { to: '/evidence', label: 'Evidence', icon: 'evidence' },
        { to: '/recurring', label: 'Opakované', icon: 'recurring' },
      ]
    },
    {
      title: 'Účetnictví',
      items: [
        { to: '/bank', label: 'Banka', icon: 'bank' },
        { to: '/accounting', label: 'Účetnictví', icon: 'accounting' },
        { to: '/vat', label: 'DPH', icon: 'vat' },
        { to: '/currencies', label: 'Měny', icon: 'currencies' },
      ]
    },
  ];
  if (can('admin')) {
    sections.push({
      title: 'Správa',
      items: [
        { to: '/company', label: 'Společnost', icon: 'company' },
        { to: '/users', label: 'Uživatelé', icon: 'users' },
      ]
    });
  }

  const roleLabels = { admin: 'Administrátor', accountant: 'Účetní', manager: 'Manažer', viewer: 'Náhled' };

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-header">
          <Link to="/" onClick={onClose} style={{ textDecoration: 'none' }}>
            <div className="sidebar-brand">
              <svg width="155" height="40" viewBox="0 0 310 80" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="sidebar-spectrum" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1E2A3A"/>
                    <stop offset="20%" stopColor="#2D5A1E"/>
                    <stop offset="40%" stopColor="#7C8C6E"/>
                    <stop offset="60%" stopColor="#C4A265"/>
                    <stop offset="80%" stopColor="#C47D5A"/>
                    <stop offset="100%" stopColor="#8B5A6B"/>
                  </linearGradient>
                </defs>
                <rect x="0" y="10" width="4" height="60" rx="2" fill="url(#sidebar-spectrum)"/>
                <text x="16" y="42" fontFamily="'Playfair Display',Georgia,serif" fontSize="30" fontWeight="700" fill="currentColor">Rainbow Family</text>
                <text x="17" y="62" fontFamily="'Outfit',system-ui,sans-serif" fontSize="12" fontWeight="500" fill="currentColor" letterSpacing="4" opacity="0.5">INVESTMENT</text>
              </svg>
            </div>
          </Link>
          <button className="sidebar-close" onClick={onClose}>&times;</button>
        </div>
        <Link to="/profile" onClick={onClose} className="sidebar-user" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="avatar">{user?.full_name?.charAt(0)}</div>
          <div>
            <div className="sidebar-user-name">{user?.full_name}</div>
            <div className="sidebar-user-role">{roleLabels[user?.role] || user?.role}</div>
          </div>
        </Link>
        <nav className="sidebar-nav">
          {sections.map((sec, si) => (
            <div key={si} className="sidebar-section">
              {sec.title && <div className="sidebar-section-title">{sec.title}</div>}
              {sec.items.map(l => (
                <Link
                  key={l.to}
                  to={l.to}
                  className={`sidebar-link ${location.pathname === l.to ? 'active' : ''}`}
                  onClick={onClose}
                >
                  <span className="sidebar-icon"><NavIcon name={l.icon} size={17} /></span>
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <Link to="/profile" className="sidebar-link sidebar-profile-link" onClick={onClose} style={{ marginTop: 'auto' }}>
          <span className="sidebar-icon"><NavIcon name="profile" size={18} /></span> Můj profil
        </Link>
        <button className="sidebar-logout" onClick={logout} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <NavIcon name="logout" size={15} /> Odhlásit se
        </button>
      </aside>
    </>
  );
}

function HighlightMatch({ text, query }) {
  if (!text || !query) return <>{text}</>;
  const idx = String(text).toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  const str = String(text);
  return <>{str.slice(0, idx)}<mark style={{ background: '#fef08a', padding: 0, borderRadius: 2 }}>{str.slice(idx, idx + query.length)}</mark>{str.slice(idx + query.length)}</>;
}

function GlobalSearch() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const navigate = useNavigate();
  const ref = React.useRef();
  const inputRef = React.useRef();

  const flatItems = React.useMemo(() => {
    if (!results) return [];
    const items = [];
    (results.invoices || []).forEach(i => items.push({ type: 'invoice', data: i, path: `/invoices/${i.id}` }));
    (results.clients || []).forEach(c => items.push({ type: 'client', data: c, path: `/clients/${c.id}` }));
    (results.evidence || []).forEach(e => items.push({ type: 'evidence', data: e, path: `/evidence` }));
    return items;
  }, [results]);

  React.useEffect(() => {
    if (!q || q.length < 2) { setResults(null); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(() => {
      api.search(q).then(r => { setResults(r); setLoading(false); setActiveIdx(-1); }).catch(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  React.useEffect(() => {
    const handler = (e) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const go = (path) => { navigate(path); setOpen(false); setQ(''); setResults(null); setActiveIdx(-1); };
  const hasResults = results && (results.invoices?.length || results.clients?.length || results.evidence?.length);
  const searched = q.length >= 2 && results && !loading;

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); return; }
    if (e.key === 'Enter') {
      if (activeIdx >= 0 && activeIdx < flatItems.length) {
        go(flatItems[activeIdx].path);
      } else if (q.length >= 2) {
        go(`/search?q=${encodeURIComponent(q)}`);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(prev => prev < flatItems.length - 1 ? prev + 1 : 0);
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(prev => prev > 0 ? prev - 1 : flatItems.length - 1);
    }
  };

  let itemIndex = -1;
  const dropdownItemStyle = (idx) => ({
    padding: '8px 12px', cursor: 'pointer', borderRadius: 8, transition: 'background 0.1s',
    background: idx === activeIdx ? 'var(--primary-50)' : '',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
  });

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1, maxWidth: 420 }}>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}>
          {loading ? <span className="search-spinner" /> : <NavIcon name="search" size={16} />}
        </span>
        <input ref={inputRef} className="form-input" placeholder="Hledat faktury, klienty...  (Ctrl+K)" value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); setActiveIdx(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          style={{ fontSize: 13, padding: '8px 12px 8px 34px', background: 'var(--gray-100)', border: '1px solid var(--gray-200)', borderRadius: 10 }}
        />
        {q && (
          <button onClick={() => { setQ(''); setResults(null); setActiveIdx(-1); inputRef.current?.focus(); }}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px 4px', fontSize: 16, lineHeight: 1 }}
            title="Vymazat">&times;</button>
        )}
      </div>
      {open && q.length >= 2 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--card-bg, white)', border: '1px solid var(--gray-200)', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.12)', zIndex: 1000, maxHeight: 420, overflow: 'auto', marginTop: 6, padding: '4px' }}>
          {loading && (
            <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              <span className="search-spinner" style={{ marginRight: 8 }} />Hledám...
            </div>
          )}
          {searched && !hasResults && (
            <div style={{ padding: '20px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              Žádné výsledky pro „<strong>{q}</strong>"
            </div>
          )}
          {hasResults && (<>
            {results.invoices?.length > 0 && (<>
              <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Faktury</div>
              {results.invoices.map(i => {
                itemIndex++;
                const idx = itemIndex;
                return (
                  <div key={'i'+i.id} onClick={() => go(`/invoices/${i.id}`)} style={dropdownItemStyle(idx)}
                    onMouseEnter={() => setActiveIdx(idx)}>
                    <span><strong style={{ fontWeight: 600 }}><HighlightMatch text={i.invoice_number} query={q} /></strong> {i.client_name && <span style={{ color: '#64748b' }}>— <HighlightMatch text={i.client_name} query={q} /></span>}</span>
                    <span className={`badge badge-${i.status}`} style={{ fontSize: 10 }}>{i.status}</span>
                  </div>
                );
              })}
            </>)}
            {results.clients?.length > 0 && (<>
              <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Klienti</div>
              {results.clients.map(c => {
                itemIndex++;
                const idx = itemIndex;
                return (
                  <div key={'c'+c.id} onClick={() => go(`/clients/${c.id}`)} style={dropdownItemStyle(idx)}
                    onMouseEnter={() => setActiveIdx(idx)}>
                    <strong style={{ fontWeight: 600 }}><HighlightMatch text={c.name} query={q} /></strong> {c.ico && <span style={{ color: '#64748b' }}>IČ: <HighlightMatch text={c.ico} query={q} /></span>}
                  </div>
                );
              })}
            </>)}
            {results.evidence?.length > 0 && (<>
              <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Evidence</div>
              {results.evidence.map(e => {
                itemIndex++;
                const idx = itemIndex;
                return (
                  <div key={'e'+e.id} onClick={() => go('/evidence')} style={dropdownItemStyle(idx)}
                    onMouseEnter={() => setActiveIdx(idx)}>
                    <strong style={{ fontWeight: 600 }}><HighlightMatch text={e.title} query={q} /></strong> {e.amount && <span style={{ color: '#64748b' }}>{e.amount} {e.currency}</span>}
                  </div>
                );
              })}
            </>)}
            <div onClick={() => go(`/search?q=${encodeURIComponent(q)}`)}
              style={{ padding: '10px 12px', cursor: 'pointer', borderTop: '1px solid var(--gray-200)', marginTop: 4, textAlign: 'center', color: 'var(--primary)', fontSize: 13, fontWeight: 600, borderRadius: '0 0 8px 8px' }}
              onMouseOver={e => e.currentTarget.style.background='var(--primary-50)'} onMouseOut={e => e.currentTarget.style.background=''}>
              Zobrazit všechny výsledky pro „{q}"
            </div>
          </>)}
        </div>
      )}
    </div>
  );
}

// Page title context — pages can set subtitle via usePageTitle()
const PageTitleContext = React.createContext({ subtitle: '', setSubtitle: () => {} });
export function usePageTitle(subtitle) {
  const ctx = React.useContext(PageTitleContext);
  React.useEffect(() => { if (subtitle !== undefined) ctx.setSubtitle(subtitle); return () => ctx.setSubtitle(''); }, [subtitle]);
  return ctx;
}

// Route → section mapping
const routeSections = [
  { match: /^\/$/, title: 'Dashboard', sub: 'Finanční přehled a analytika', home: '/' },
  { match: /^\/invoices\/new/, title: 'Nová faktura', section: 'Faktury', home: '/invoices' },
  { match: /^\/invoices\/(\d+)\/edit/, title: 'Úprava faktury', section: 'Faktury', home: '/invoices' },
  { match: /^\/invoices\/(\d+)/, title: 'Detail faktury', section: 'Faktury', home: '/invoices' },
  { match: /^\/invoices/, title: 'Faktury', sub: 'Přehled vydaných faktur', home: '/invoices' },
  { match: /^\/clients\/(\d+)/, title: 'Detail klienta', section: 'Klienti', home: '/clients' },
  { match: /^\/clients/, title: 'Klienti', sub: 'Správa klientů a kontaktů', home: '/clients' },
  { match: /^\/evidence/, title: 'Evidence', sub: 'Přijaté doklady a náklady', home: '/evidence' },
  { match: /^\/recurring/, title: 'Opakované faktury', sub: 'Automaticky generované faktury', home: '/recurring' },
  { match: /^\/bank/, title: 'Banka', sub: 'Bankovní transakce a párování', home: '/bank' },
  { match: /^\/accounting/, title: 'Účetnictví', sub: 'Účtová osnova a předkontace', home: '/accounting' },
  { match: /^\/vat/, title: 'DPH', sub: 'Přiznání k DPH', home: '/vat' },
  { match: /^\/currencies/, title: 'Správa měn', sub: 'Kurzy a měnové páry', home: '/currencies' },
  { match: /^\/company/, title: 'Společnost', sub: 'Nastavení firmy a fakturace', home: '/company' },
  { match: /^\/users\/(\d+)/, title: 'Detail uživatele', section: 'Uživatelé', home: '/users' },
  { match: /^\/users/, title: 'Uživatelé', sub: 'Správa uživatelů a rolí', home: '/users' },
  { match: /^\/profile/, title: 'Můj profil', sub: 'Osobní nastavení', home: '/profile' },
  { match: /^\/search/, title: 'Výsledky hledání', home: '/' },
];

function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [subtitle, setSubtitle] = useState('');
  const { tenant } = useAuth();
  const location = useLocation();

  const section = routeSections.find(s => s.match.test(location.pathname)) || { title: '', home: '/' };

  return (
    <PageTitleContext.Provider value={{ subtitle, setSubtitle }}>
    <div className="layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-area">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div className="topbar-section-title">
            {section.section && (
              <Link to={section.home} className="topbar-section-link">{section.section}</Link>
            )}
            {section.section && <span className="topbar-sep">/</span>}
            <Link to={section.home} className="topbar-title-link">{subtitle || section.title}</Link>
            {section.sub && !subtitle && <span className="topbar-subtitle">{section.sub}</span>}
          </div>
          <div style={{ flex: 1 }} />
          <GlobalSearch />
          <button className="dark-toggle" onClick={() => {
            const html = document.documentElement;
            const next = html.getAttribute('data-theme') === 'dark' ? '' : 'dark';
            html.setAttribute('data-theme', next);
            localStorage.setItem('erp_theme', next);
          }} title="Tmavý/světlý režim">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </button>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
    </PageTitleContext.Provider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/onboarding" element={
            <OnboardingRoute><Onboarding /></OnboardingRoute>
          } />
          <Route path="/superadmin" element={
            <SuperadminRoute><SuperAdmin /></SuperadminRoute>
          } />
          <Route path="*" element={
            <TenantRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/search" element={<SearchResults />} />
                  <Route path="/invoices" element={<Invoices />} />
                  <Route path="/invoices/new" element={<InvoiceForm />} />
                  <Route path="/invoices/:id" element={<InvoiceDetail />} />
                  <Route path="/invoices/:id/edit" element={<InvoiceForm />} />
                  <Route path="/evidence" element={<Evidence />} />
                  <Route path="/clients" element={<Clients />} />
                  <Route path="/clients/:id" element={<ClientDetail />} />
                  <Route path="/bank" element={<Bank />} />
                  <Route path="/accounting" element={<Accounting />} />
                  <Route path="/vat" element={<VatReport />} />
                  <Route path="/currencies" element={<Currencies />} />
                  <Route path="/recurring" element={<RecurringInvoices />} />
                  <Route path="/company" element={<Company />} />
                  <Route path="/users" element={<Users />} />
                  <Route path="/users/:id" element={<UserDetail />} />
                  <Route path="/profile" element={<Profile />} />
                </Routes>
              </Layout>
            </TenantRoute>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
