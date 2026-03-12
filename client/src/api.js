const API = '/api';

function getToken() {
  return localStorage.getItem('erp_token');
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
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Chyba serveru');
  return data;
}

export const api = {
  login: (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => request('/auth/me'),
  dashboard: () => request('/dashboard'),
  getCurrencies: () => request('/currencies'),
  updateCurrency: (code, rate) => request(`/currencies/${code}`, { method: 'PUT', body: JSON.stringify({ rate_to_czk: rate }) }),
  getClients: () => request('/clients'),
  createClient: (data) => request('/clients', { method: 'POST', body: JSON.stringify(data) }),
  updateClient: (id, data) => request(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteClient: (id) => request(`/clients/${id}`, { method: 'DELETE' }),
  getInvoices: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/invoices${qs ? '?' + qs : ''}`);
  },
  getInvoice: (id) => request(`/invoices/${id}`),
  createInvoice: (data) => request('/invoices', { method: 'POST', body: JSON.stringify(data) }),
  updateInvoice: (id, data) => request(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateInvoiceStatus: (id, status, paid_date) => request(`/invoices/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, paid_date }) }),
  deleteInvoice: (id) => request(`/invoices/${id}`, { method: 'DELETE' }),
  getEvidence: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/evidence${qs ? '?' + qs : ''}`);
  },
  createEvidence: (data) => request('/evidence', { method: 'POST', body: JSON.stringify(data) }),
  updateEvidence: (id, data) => request(`/evidence/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEvidence: (id) => request(`/evidence/${id}`, { method: 'DELETE' }),
  getUsers: () => request('/users'),
  createUser: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id, data) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getAuditLog: () => request('/audit-log'),
  getCompany: () => request('/company'),
  updateCompany: (data) => request('/company', { method: 'PUT', body: JSON.stringify(data) }),
  updateSignature: (signature) => request('/profile/signature', { method: 'PUT', body: JSON.stringify({ signature }) }),
  getUserSignature: (id) => request(`/users/${id}/signature`),
};
