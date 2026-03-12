import React, { useState, useEffect, createContext, useContext } from 'react';
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

// Clear stale sessions from old auth flow
(function clearStaleStorage() {
  const slug = localStorage.getItem('erp_tenant_slug');
  if (slug) {
    localStorage.removeItem('erp_token');
    localStorage.removeItem('erp_user');
    localStorage.removeItem('erp_tenant');
    localStorage.removeItem('erp_tenant_slug');
  }
})();

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('erp_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('erp_token'));
  const [tenant, setTenant] = useState(() => {
    const saved = localStorage.getItem('erp_tenant');
    return saved ? JSON.parse(saved) : null;
  });

  const setSession = (newToken, newUser, newTenant) => {
    localStorage.setItem('erp_token', newToken);
    localStorage.setItem('erp_user', JSON.stringify(newUser));
    if (newTenant) {
      localStorage.setItem('erp_tenant', JSON.stringify(newTenant));
    } else {
      localStorage.removeItem('erp_tenant');
    }
    setToken(newToken);
    setUser(newUser);
    setTenant(newTenant);
  };

  const login = async (username, password) => {
    const data = await api.login(username, password);
    setSession(data.token, data.user, data.tenant);
    return data;
  };

  const superadminLogin = async (username, password) => {
    const data = await api.superadminLogin(username, password);
    localStorage.setItem('erp_token', data.token);
    localStorage.setItem('erp_user', JSON.stringify(data.user));
    localStorage.removeItem('erp_tenant');
    setToken(data.token);
    setUser(data.user);
    setTenant(null);
    return data;
  };

  const registerAndLogin = async (form) => {
    const data = await api.register(form);
    setSession(data.token, data.user, data.tenant);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('erp_token');
    localStorage.removeItem('erp_user');
    localStorage.removeItem('erp_tenant');
    setToken(null);
    setUser(null);
    setTenant(null);
  };

  const can = (...roles) => user && roles.includes(user.role);
  const isSuperadmin = user?.role === 'superadmin';

  return (
    <AuthContext.Provider value={{ user, token, tenant, login, superadminLogin, registerAndLogin, logout, can, isSuperadmin, setSession }}>
      {children}
    </AuthContext.Provider>
  );
}

function ProtectedRoute({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function SuperadminRoute({ children }) {
  const { token, isSuperadmin } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (!isSuperadmin) return <Navigate to="/" replace />;
  return children;
}

function TenantRoute({ children }) {
  const { token, user, isSuperadmin, tenant } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (isSuperadmin) return <Navigate to="/superadmin" replace />;
  // If user has no tenant, redirect to onboarding
  if (!user?.tenant_id) return <Navigate to="/onboarding" replace />;
  return children;
}

function OnboardingRoute({ children }) {
  const { token, user, isSuperadmin } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (isSuperadmin) return <Navigate to="/superadmin" replace />;
  // If user already has a tenant, go to dashboard
  if (user?.tenant_id) return <Navigate to="/" replace />;
  return children;
}

function Sidebar({ open, onClose }) {
  const { user, tenant, logout, can } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

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
        <button className="sidebar-logout" onClick={() => { logout(); navigate('/login'); }}>
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
