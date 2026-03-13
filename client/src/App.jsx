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
import AgingReport from './pages/AgingReport';
import Accounting from './pages/Accounting';
import VatReport from './pages/VatReport';
import Bank from './pages/Bank';
import CashRegister from './pages/CashRegister';
import Products from './pages/Products';
import Orders from './pages/Orders';
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

function Sidebar({ open, onClose }) {
  const { user, tenant, logout, can } = useAuth();
  const location = useLocation();

  const links = [
    { to: '/', label: 'Dashboard', icon: '📊' },
    { to: '/invoices', label: 'Faktury', icon: '📄' },
    { to: '/orders', label: 'Objednávky', icon: '📦' },
    { to: '/clients', label: 'Klienti', icon: '👥' },
    { to: '/products', label: 'Ceník', icon: '🏷️' },
    { to: '/evidence', label: 'Evidence', icon: '📋' },
    { to: '/bank', label: 'Banka', icon: '🏦' },
    { to: '/cash', label: 'Pokladna', icon: '💵' },
    { to: '/accounting', label: 'Účetnictví', icon: '📒' },
    { to: '/vat', label: 'DPH', icon: '🧾' },
    { to: '/currencies', label: 'Měny', icon: '💱' },
    { to: '/recurring', label: 'Opakované', icon: '🔄' },
    { to: '/aging', label: 'Pohledávky', icon: '📅' },
  ];
  if (can('admin')) {
    links.push({ to: '/company', label: 'Společnost', icon: '🏢' });
    links.push({ to: '/users', label: 'Uživatelé', icon: '⚙️' });
  }

  const roleLabels = { admin: 'Administrátor', accountant: 'Účetní', manager: 'Manažer', viewer: 'Náhled' };

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-header">
          <Link to="/" onClick={onClose} style={{ textDecoration: 'none' }}>
            <h2>RFI ERP</h2>
            {tenant && <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400, marginTop: -4 }}>{tenant.name}</div>}
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
          {links.map(l => (
            <Link
              key={l.to}
              to={l.to}
              className={`sidebar-link ${location.pathname === l.to ? 'active' : ''}`}
              onClick={onClose}
            >
              <span className="sidebar-icon">{l.icon}</span>
              {l.label}
            </Link>
          ))}
        </nav>
        <Link to="/profile" className="sidebar-link sidebar-profile-link" onClick={onClose} style={{ marginTop: 'auto' }}>
          <span className="sidebar-icon">👤</span> Můj profil
        </Link>
        <button className="sidebar-logout" onClick={logout}>
          Odhlásit se
        </button>
      </aside>
    </>
  );
}

function GlobalSearch() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = React.useRef();

  React.useEffect(() => {
    if (!q || q.length < 2) { setResults(null); return; }
    const t = setTimeout(() => { api.search(q).then(setResults).catch(() => {}); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const go = (path) => { navigate(path); setOpen(false); setQ(''); setResults(null); };
  const hasResults = results && (results.invoices?.length || results.clients?.length || results.evidence?.length);

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
      <input className="form-input" placeholder="Hledat faktury, klienty..." value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        style={{ fontSize: 13, padding: '6px 12px', background: '#f1f5f9', border: 'none', borderRadius: 8 }}
      />
      {open && hasResults && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 8px 30px rgba(0,0,0,0.12)', zIndex: 1000, maxHeight: 400, overflow: 'auto', marginTop: 4 }}>
          {results.invoices?.length > 0 && (<>
            <div style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Faktury</div>
            {results.invoices.map(i => (
              <div key={'i'+i.id} onClick={() => go(`/invoices/${i.id}`)} style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9' }} onMouseOver={e => e.currentTarget.style.background='#f8fafc'} onMouseOut={e => e.currentTarget.style.background=''}>
                <span><strong>{i.invoice_number}</strong> {i.client_name && <span style={{ color: '#64748b' }}>— {i.client_name}</span>}</span>
                <span className={`badge badge-${i.status}`} style={{ fontSize: 10 }}>{i.status}</span>
              </div>
            ))}
          </>)}
          {results.clients?.length > 0 && (<>
            <div style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Klienti</div>
            {results.clients.map(c => (
              <div key={'c'+c.id} onClick={() => go(`/clients/${c.id}`)} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }} onMouseOver={e => e.currentTarget.style.background='#f8fafc'} onMouseOut={e => e.currentTarget.style.background=''}>
                <strong>{c.name}</strong> {c.ico && <span style={{ color: '#64748b' }}>IČ: {c.ico}</span>}
              </div>
            ))}
          </>)}
          {results.evidence?.length > 0 && (<>
            <div style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Evidence</div>
            {results.evidence.map(e => (
              <div key={'e'+e.id} onClick={() => go('/evidence')} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }} onMouseOver={ev => ev.currentTarget.style.background='#f8fafc'} onMouseOut={ev => ev.currentTarget.style.background=''}>
                <strong>{e.title}</strong> {e.amount && <span style={{ color: '#64748b' }}>{e.amount} {e.currency}</span>}
              </div>
            ))}
          </>)}
        </div>
      )}
    </div>
  );
}

function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { tenant } = useAuth();
  return (
    <div className="layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-area">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)}>☰</button>
          <Link to="/" style={{ textDecoration: 'none' }}><h1 className="topbar-title">RFI ERP</h1></Link>
          {tenant && <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>{tenant.name}</span>}
          <div style={{ flex: 1 }} />
          <GlobalSearch />
          <button className="dark-toggle" onClick={() => {
            const html = document.documentElement;
            const next = html.getAttribute('data-theme') === 'dark' ? '' : 'dark';
            html.setAttribute('data-theme', next);
            localStorage.setItem('erp_theme', next);
          }} title="Tmavý/světlý režim">
            🌓
          </button>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
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
                  <Route path="/invoices" element={<Invoices />} />
                  <Route path="/invoices/new" element={<InvoiceForm />} />
                  <Route path="/invoices/:id" element={<InvoiceDetail />} />
                  <Route path="/invoices/:id/edit" element={<InvoiceForm />} />
                  <Route path="/evidence" element={<Evidence />} />
                  <Route path="/clients" element={<Clients />} />
                  <Route path="/clients/:id" element={<ClientDetail />} />
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/bank" element={<Bank />} />
                  <Route path="/cash" element={<CashRegister />} />
                  <Route path="/accounting" element={<Accounting />} />
                  <Route path="/vat" element={<VatReport />} />
                  <Route path="/currencies" element={<Currencies />} />
                  <Route path="/recurring" element={<RecurringInvoices />} />
                  <Route path="/aging" element={<AgingReport />} />
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
