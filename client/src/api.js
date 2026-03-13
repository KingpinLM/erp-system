const API = '/api';

function getToken() {
  return localStorage.getItem('erp_token');
}

async function request(path, options = {}) {
  const isAuthEndpoint = path.startsWith('/auth/') || path.startsWith('/superadmin/login');
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(!isAuthEndpoint && token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('erp_token');
      localStorage.removeItem('erp_user');
      localStorage.removeItem('erp_tenant');
      window.location.href = '/login';
    }
    throw new Error(data.error || 'Chyba serveru');
  }
  return data;
}

export const api = {
  // Auth
  login: (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => request('/auth/me'),
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token, password) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),

  // Onboarding
  createTenantOnboarding: (data) => request('/onboarding/create-tenant', { method: 'POST', body: JSON.stringify(data) }),
  joinTenant: (invite_code) => request('/onboarding/join-tenant', { method: 'POST', body: JSON.stringify({ invite_code }) }),

  // Dashboard
  dashboard: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/dashboard${qs ? '?' + qs : ''}`);
  },

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
  duplicateInvoice: (id) => request(`/invoices/${id}/duplicate`, { method: 'POST' }),
  createCreditNote: (id) => request(`/invoices/${id}/credit-note`, { method: 'POST' }),
  convertProforma: (id) => request(`/invoices/${id}/to-invoice`, { method: 'POST' }),
  bulkStatus: (ids, status) => request('/invoices/bulk-status', { method: 'PATCH', body: JSON.stringify({ ids, status }) }),
  getInvoicePayments: (id) => request(`/invoices/${id}/payments`),
  addInvoicePayment: (id, data) => request(`/invoices/${id}/payments`, { method: 'POST', body: JSON.stringify(data) }),
  downloadInvoicePDF: (id) => {
    const token = getToken();
    return fetch(`${API}/invoices/${id}/pdf`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) throw new Error('PDF error'); return r.blob(); });
  },
  sendInvoiceEmail: (id, data) => request(`/invoices/${id}/send-email`, { method: 'POST', body: JSON.stringify(data) }),
  sendInvoiceReminder: (id) => request(`/invoices/${id}/send-reminder`, { method: 'POST' }),
  getEmailStatus: () => request('/email/status'),

  // Recurring
  getRecurring: () => request('/recurring'),
  createRecurring: (data) => request('/recurring', { method: 'POST', body: JSON.stringify(data) }),
  updateRecurring: (id, data) => request(`/recurring/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRecurring: (id) => request(`/recurring/${id}`, { method: 'DELETE' }),

  // Search & Reports
  search: (q) => request(`/search?q=${encodeURIComponent(q)}`),
  getAgingReport: () => request('/reports/aging'),
  aresLookup: (ico) => request(`/ares/${ico}`),

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
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  getPendingUsers: () => request('/users/pending'),
  approveUser: (id, role) => request(`/users/${id}/approve`, { method: 'POST', body: JSON.stringify({ role }) }),
  rejectUser: (id) => request(`/users/${id}/reject`, { method: 'POST' }),

  // Roles & Permissions
  getRoleOverrides: () => request('/role-overrides'),
  saveRoleOverrides: (overrides) => request('/role-overrides', { method: 'PUT', body: JSON.stringify({ overrides }) }),
  getRoles: () => request('/roles'),
  createRole: (data) => request('/roles', { method: 'POST', body: JSON.stringify(data) }),
  updateRole: (id, data) => request(`/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRole: (id) => request(`/roles/${id}`, { method: 'DELETE' }),
  updateUserRole: (id, role) => request(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),

  // User Groups
  getUserGroups: () => request('/user-groups'),
  createUserGroup: (data) => request('/user-groups', { method: 'POST', body: JSON.stringify(data) }),
  updateUserGroup: (id, data) => request(`/user-groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUserGroup: (id) => request(`/user-groups/${id}`, { method: 'DELETE' }),
  setGroupMembers: (id, user_ids) => request(`/user-groups/${id}/members`, { method: 'POST', body: JSON.stringify({ user_ids }) }),

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

  // Superadmin
  superadminLogin: (username, password) => request('/superadmin/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  getTenants: () => request('/superadmin/tenants'),
  getTenant: (id) => request(`/superadmin/tenants/${id}`),
  createTenant: (data) => request('/superadmin/tenants', { method: 'POST', body: JSON.stringify(data) }),
  updateTenant: (id, data) => request(`/superadmin/tenants/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTenant: (id) => request(`/superadmin/tenants/${id}`, { method: 'DELETE' }),

  // Accounting (Účetnictví)
  getAccounts: () => request('/accounts'),
  createAccount: (data) => request('/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateAccount: (id, data) => request(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAccount: (id) => request(`/accounts/${id}`, { method: 'DELETE' }),
  seedDefaultAccounts: () => request('/accounts/seed-default', { method: 'POST' }),

  // Journal entries (Účetní deník)
  getJournal: (params = {}) => { const qs = new URLSearchParams(params).toString(); return request(`/journal${qs ? '?' + qs : ''}`); },
  getJournalEntry: (id) => request(`/journal/${id}`),
  createJournalEntry: (data) => request('/journal', { method: 'POST', body: JSON.stringify(data) }),
  updateJournalEntry: (id, data) => request(`/journal/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  postJournalEntry: (id) => request(`/journal/${id}/post`, { method: 'PATCH' }),
  cancelJournalEntry: (id) => request(`/journal/${id}/cancel`, { method: 'PATCH' }),
  deleteJournalEntry: (id) => request(`/journal/${id}`, { method: 'DELETE' }),

  // Ledger (Hlavní kniha)
  getLedger: (params = {}) => { const qs = new URLSearchParams(params).toString(); return request(`/ledger${qs ? '?' + qs : ''}`); },
  getLedgerBalances: (params = {}) => { const qs = new URLSearchParams(params).toString(); return request(`/ledger/balances${qs ? '?' + qs : ''}`); },

  // VAT (DPH)
  getVatRecords: (params = {}) => { const qs = new URLSearchParams(params).toString(); return request(`/vat/records${qs ? '?' + qs : ''}`); },
  getVatReport: (year, month) => request(`/vat/report?year=${year}&month=${month}`),
  generateVatRecords: (year, month) => request('/vat/generate', { method: 'POST', body: JSON.stringify({ year, month }) }),

  // Bank
  getBankAccounts: () => request('/bank-accounts'),
  createBankAccount: (data) => request('/bank-accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateBankAccount: (id, data) => request(`/bank-accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getBankTransactions: (params = {}) => { const qs = new URLSearchParams(params).toString(); return request(`/bank-transactions${qs ? '?' + qs : ''}`); },
  createBankTransaction: (data) => request('/bank-transactions', { method: 'POST', body: JSON.stringify(data) }),
  importBankTransactions: (data) => request('/bank-transactions/import', { method: 'POST', body: JSON.stringify(data) }),
  autoMatchTransactions: () => request('/bank-transactions/auto-match', { method: 'POST' }),
  matchTransaction: (id, invoice_id) => request(`/bank-transactions/${id}/match`, { method: 'PATCH', body: JSON.stringify({ invoice_id }) }),
  deleteBankTransaction: (id) => request(`/bank-transactions/${id}`, { method: 'DELETE' }),

  // Cash register (Pokladna)
  getCashRegisters: () => request('/cash-registers'),
  createCashRegister: (data) => request('/cash-registers', { method: 'POST', body: JSON.stringify(data) }),
  updateCashRegister: (id, data) => request(`/cash-registers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getCashDocuments: (params = {}) => { const qs = new URLSearchParams(params).toString(); return request(`/cash-documents${qs ? '?' + qs : ''}`); },
  createCashDocument: (data) => request('/cash-documents', { method: 'POST', body: JSON.stringify(data) }),
  updateCashDocument: (id, data) => request(`/cash-documents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCashDocument: (id) => request(`/cash-documents/${id}`, { method: 'DELETE' }),
  getCashRegisterReport: (id, params = {}) => { const qs = new URLSearchParams(params).toString(); return request(`/cash-registers/${id}/report${qs ? '?' + qs : ''}`); },

  // Products (Produkty/Služby)
  getProducts: (params = {}) => { const qs = new URLSearchParams(params).toString(); return request(`/products${qs ? '?' + qs : ''}`); },
  getProduct: (id) => request(`/products/${id}`),
  createProduct: (data) => request('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id, data) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),
  getStockMovements: (params = {}) => { const qs = new URLSearchParams(params).toString(); return request(`/stock-movements${qs ? '?' + qs : ''}`); },
  createStockMovement: (data) => request('/stock-movements', { method: 'POST', body: JSON.stringify(data) }),
  getStockReport: () => request('/stock/report'),

};
