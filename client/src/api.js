const API = '/api';

function getToken() {
  return localStorage.getItem('erp_token');
}

function getTenantSlug() {
  return localStorage.getItem('erp_tenant_slug') || '';
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('erp_token');
    localStorage.removeItem('erp_user');
    localStorage.removeItem('erp_tenant');
    localStorage.removeItem('erp_tenant_slug');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Chyba serveru');
  return data;
}

export const api = {
  // Auth (tenant-scoped)
  login: (username, password, tenant_slug) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password, tenant_slug }) }),
  me: () => request('/auth/me'),
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify({ ...data, tenant_slug: getTenantSlug() }) }),
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email, tenant_slug: getTenantSlug() }) }),
  resetPassword: (token, password) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
  resolveTenant: (slug) => request(`/tenants/resolve/${encodeURIComponent(slug)}`),

  // Dashboard
  dashboard: () => request('/dashboard'),

  // Currencies
  getCurrencies: () => request('/currencies'),
  updateCurrency: (code, rate) => request(`/currencies/${code}`, { method: 'PUT', body: JSON.stringify({ rate_to_czk: rate }) }),
  refreshCurrencies: () => request('/currencies/refresh', { method: 'POST' }),

  // Clients
  getClients: () => request('/clients'),
  createClient: (data) => request('/clients', { method: 'POST', body: JSON.stringify(data) }),
  updateClient: (id, data) => request(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getClient: (id) => request(`/clients/${id}`),
  getClientInvoices: (id) => request(`/clients/${id}/invoices`),
  deleteClient: (id) => request(`/clients/${id}`, { method: 'DELETE' }),

  // Invoices
  getNextInvoiceNumber: () => request('/invoices/next-number'),
  getInvoices: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/invoices${qs ? '?' + qs : ''}`);
  },
  getInvoice: (id) => request(`/invoices/${id}`),
  createInvoice: (data) => request('/invoices', { method: 'POST', body: JSON.stringify(data) }),
  updateInvoice: (id, data) => request(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateInvoiceStatus: (id, status, paid_date) => request(`/invoices/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, paid_date }) }),
  deleteInvoice: (id) => request(`/invoices/${id}`, { method: 'DELETE' }),
  getInvoiceQR: (id) => request(`/invoices/${id}/qr`),

  // Evidence
  getEvidence: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/evidence${qs ? '?' + qs : ''}`);
  },
  createEvidence: (data) => request('/evidence', { method: 'POST', body: JSON.stringify(data) }),
  updateEvidence: (id, data) => request(`/evidence/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEvidence: (id) => request(`/evidence/${id}`, { method: 'DELETE' }),
  uploadEvidence: async (file) => {
    const token = getToken();
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API}/evidence/upload`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Chyba serveru');
    return data;
  },

  // Users
  getUsers: () => request('/users'),
  getUser: (id) => request(`/users/${id}`),
  createUser: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id, data) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getPendingUsers: () => request('/users/pending'),
  approveUser: (id, role) => request(`/users/${id}/approve`, { method: 'POST', body: JSON.stringify({ role }) }),
  rejectUser: (id) => request(`/users/${id}/reject`, { method: 'POST' }),

  // Company
  getCompany: () => request('/company'),
  updateCompany: (data) => request('/company', { method: 'PUT', body: JSON.stringify(data) }),

  // Profile
  updateProfile: (data) => request('/profile', { method: 'PUT', body: JSON.stringify(data) }),
  updateSignature: (signature) => request('/profile/signature', { method: 'PUT', body: JSON.stringify({ signature }) }),
  getUserSignature: (id) => request(`/users/${id}/signature`),
  updateUserSignature: (id, signature) => request(`/users/${id}/signature`, { method: 'PUT', body: JSON.stringify({ signature }) }),

  // Audit & Categories
  getAuditLog: () => request('/audit-log'),
  getCategories: () => request('/categories'),
  getCategoryRules: () => request('/category-rules'),
  deleteCategoryRule: (id) => request(`/category-rules/${id}`, { method: 'DELETE' }),

  // ─── SUPERADMIN ─────────────────────────────────────────
  superadminLogin: (username, password) => request('/superadmin/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  getTenants: () => request('/superadmin/tenants'),
  getTenant: (id) => request(`/superadmin/tenants/${id}`),
  createTenant: (data) => request('/superadmin/tenants', { method: 'POST', body: JSON.stringify(data) }),
  updateTenant: (id, data) => request(`/superadmin/tenants/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTenant: (id) => request(`/superadmin/tenants/${id}`, { method: 'DELETE' }),
};
