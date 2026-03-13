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
    { to: '/evidence', label: 'Evidence', icon: '📋' },
    { to: '/clients', label: 'Klienti', icon: '👥' },
    { to: '/currencies', label: 'Měny', icon: '💱' },
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
                  <Route path="/currencies" element={<Currencies />} />
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
