import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from './api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Invoices from './pages/Invoices';
import InvoiceDetail from './pages/InvoiceDetail';
import InvoiceForm from './pages/InvoiceForm';
import Evidence from './pages/Evidence';
import Clients from './pages/Clients';
import Users from './pages/Users';
import Currencies from './pages/Currencies';
import Company from './pages/Company';
import './styles.css';

export const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('erp_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('erp_token'));

  const login = async (username, password) => {
    const data = await api.login(username, password);
    localStorage.setItem('erp_token', data.token);
    localStorage.setItem('erp_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('erp_token');
    localStorage.removeItem('erp_user');
    setToken(null);
    setUser(null);
  };

  const can = (...roles) => user && roles.includes(user.role);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

function ProtectedRoute({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function Sidebar({ open, onClose }) {
  const { user, logout, can } = useAuth();
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
          <h2>RFI ERP</h2>
          <button className="sidebar-close" onClick={onClose}>&times;</button>
        </div>
        <div className="sidebar-user">
          <div className="avatar">{user?.full_name?.charAt(0)}</div>
          <div>
            <div className="sidebar-user-name">{user?.full_name}</div>
            <div className="sidebar-user-role">{roleLabels[user?.role] || user?.role}</div>
          </div>
        </div>
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
        <button className="sidebar-logout" onClick={() => { logout(); navigate('/login'); }}>
          Odhlásit se
        </button>
      </aside>
    </>
  );
}

function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-area">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)}>☰</button>
          <h1 className="topbar-title">RFI ERP</h1>
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
          <Route path="*" element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/invoices" element={<Invoices />} />
                  <Route path="/invoices/new" element={<InvoiceForm />} />
                  <Route path="/invoices/:id" element={<InvoiceDetail />} />
                  <Route path="/invoices/:id/edit" element={<InvoiceForm />} />
                  <Route path="/evidence" element={<Evidence />} />
                  <Route path="/clients" element={<Clients />} />
                  <Route path="/currencies" element={<Currencies />} />
                  <Route path="/company" element={<Company />} />
                  <Route path="/users" element={<Users />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
