const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const AdmZip = require('adm-zip');
const crypto = require('crypto');
const QRCode = require('qrcode');
const db = require('./database');
const bcrypt = require('bcryptjs');
const { generateToken, generateSuperadminToken, authenticate, authorize, tenantScope, requireSuperadmin } = require('./auth');
const { generateInvoicePDF } = require('./pdf-generator');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir, limits: { fileSize: 20 * 1024 * 1024 } });

// ─── CNB EXCHANGE RATES ─────────────────────────────────────
function fetchCnbRates() {
  return new Promise((resolve, reject) => {
    https.get('https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const lines = data.split('\n').slice(2);
        const rates = {};
        lines.forEach(line => {
          const parts = line.split('|');
          if (parts.length >= 5) {
            const code = parts[3];
            const amount = parseFloat(parts[2]);
            const rate = parseFloat(parts[4].replace(',', '.'));
            if (code && rate && amount) rates[code] = rate / amount;
          }
        });
        resolve(rates);
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function updateRates() {
  try {
    const rates = await fetchCnbRates();
    const update = db.prepare("UPDATE currencies SET rate_to_czk = ?, updated_at = datetime('now') WHERE code = ?");
    Object.entries(rates).forEach(([code, rate]) => update.run(rate, code));
    console.log('CNB exchange rates updated');
  } catch (e) {
    console.log('Failed to fetch CNB rates:', e.message);
  }
}
updateRates();
setInterval(updateRates, 6 * 60 * 60 * 1000);

const accountingRoutes = require('./routes-accounting');
const bankRoutes = require('./routes-bank');
const cashRoutes = require('./routes-cash');
const productRoutes = require('./routes-products');
const orderRoutes = require('./routes-orders');
const notificationRoutes = require('./routes-notifications');
const getLoginPage = require('./login-page');

const cookieParser = require('cookie-parser');

const app = express();
app.disable('etag');
app.use(cors());
app.use(cookieParser());
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '5mb' }));

// Server-side login page (NO React, NO JS bundles, pure HTML form)
app.get('/login', (req, res) => {
  res.type('html').send(getLoginPage(req.query.error));
});

app.use(express.static(path.join(__dirname, '..', 'client', 'dist'), {
  etag: false,
  index: false, // Don't auto-serve index.html
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
  }
}));

// Shorthand: authenticated + tenant-scoped
const tenanted = [authenticate, tenantScope];

// Mount new route modules
app.use(accountingRoutes);
app.use(bankRoutes);
app.use(cashRoutes);
app.use(productRoutes);
app.use(orderRoutes);
app.use(notificationRoutes);

// ─── SUPERADMIN AUTH ────────────────────────────────────────
app.post('/api/superadmin/login', (req, res) => {
  const { username, password } = req.body;
  const sa = db.prepare('SELECT * FROM superadmins WHERE username = ?').get(username);
  if (!sa || !bcrypt.compareSync(password, sa.password)) {
    return res.status(401).json({ error: 'Neplatné přihlašovací údaje' });
  }
  const token = generateSuperadminToken(sa);
  const { password: _, ...safe } = sa;
  res.json({ token, user: { ...safe, role: 'superadmin' } });
});

// ─── SUPERADMIN: TENANT MANAGEMENT ─────────────────────────
app.get('/api/superadmin/tenants', authenticate, requireSuperadmin, (req, res) => {
  const tenants = db.prepare('SELECT * FROM tenants ORDER BY id').all();
  // Enrich with user count
  const enriched = tenants.map(t => {
    const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users WHERE tenant_id = ?').get(t.id).cnt;
    const invoiceCount = db.prepare('SELECT COUNT(*) as cnt FROM invoices WHERE tenant_id = ?').get(t.id).cnt;
    return { ...t, user_count: userCount, invoice_count: invoiceCount };
  });
  res.json(enriched);
});

app.post('/api/superadmin/tenants', authenticate, requireSuperadmin, (req, res) => {
  const { name, slug, admin_username, admin_email, admin_password, admin_first_name, admin_last_name } = req.body;
  if (!name || !slug || !admin_username || !admin_email || !admin_password) {
    return res.status(400).json({ error: 'Vyplňte všechna povinná pole' });
  }
  // Validate slug
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ error: 'Slug může obsahovat pouze malá písmena, čísla a pomlčky' });
  }
  const existing = db.prepare('SELECT id FROM tenants WHERE slug = ?').get(slug);
  if (existing) return res.status(400).json({ error: 'Tenant s tímto slugem již existuje' });

  const tenantResult = db.prepare('INSERT INTO tenants (name, slug) VALUES (?, ?)').run(name, slug);
  const tenantId = tenantResult.lastInsertRowid;

  // Create company record for tenant
  db.prepare('INSERT INTO company (tenant_id, name) VALUES (?, ?)').run(tenantId, name);

  // Create admin user for tenant
  const hash = bcrypt.hashSync(admin_password, 10);
  const full_name = `${admin_first_name || ''} ${admin_last_name || ''}`.trim() || admin_username;
  db.prepare('INSERT INTO users (tenant_id, username, email, password, full_name, first_name, last_name, role) VALUES (?,?,?,?,?,?,?,?)')
    .run(tenantId, admin_username, admin_email, hash, full_name, admin_first_name || '', admin_last_name || '', 'admin');

  // Seed default currencies if needed (currencies are global)
  res.json({ id: tenantId });
});

app.put('/api/superadmin/tenants/:id', authenticate, requireSuperadmin, (req, res) => {
  const { name, active } = req.body;
  db.prepare('UPDATE tenants SET name = ?, active = ? WHERE id = ?').run(name, active ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

app.get('/api/superadmin/tenants/:id', authenticate, requireSuperadmin, (req, res) => {
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.params.id);
  if (!tenant) return res.status(404).json({ error: 'Tenant nenalezen' });
  const users = db.prepare('SELECT id, username, email, full_name, role, active, created_at FROM users WHERE tenant_id = ?').all(tenant.id);
  const company = db.prepare('SELECT * FROM company WHERE tenant_id = ?').get(tenant.id);
  res.json({ ...tenant, users, company });
});

app.delete('/api/superadmin/tenants/:id', authenticate, requireSuperadmin, (req, res) => {
  const tid = req.params.id;
  // Cascading delete all tenant data
  db.prepare('DELETE FROM category_rules WHERE tenant_id = ?').run(tid);
  db.prepare('DELETE FROM audit_log WHERE tenant_id = ?').run(tid);
  db.prepare('DELETE FROM evidence WHERE tenant_id = ?').run(tid);
  db.prepare('DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE tenant_id = ?)').run(tid);
  db.prepare('DELETE FROM invoices WHERE tenant_id = ?').run(tid);
  db.prepare('DELETE FROM clients WHERE tenant_id = ?').run(tid);
  db.prepare('DELETE FROM users WHERE tenant_id = ?').run(tid);
  db.prepare('DELETE FROM company WHERE tenant_id = ?').run(tid);
  db.prepare('DELETE FROM tenants WHERE id = ?').run(tid);
  res.json({ ok: true });
});

// ─── FORM-BASED LOGIN (no fetch, no JS - direct form POST + redirect) ──
app.post('/api/auth/form-login', express.urlencoded({ extended: false }), (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.redirect('/login?error=1');
  }
  const token = generateToken(user);
  res.cookie('erp_session', token, { httpOnly: true, maxAge: 8*60*60*1000, sameSite: 'lax', path: '/' });
  res.redirect('/');
});

// ─── AUTH (login without tenant slug — globally unique usernames) ──
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Neplatné přihlašovací údaje' });
  }
  const token = generateToken(user);
  const { password: _, ...safeUser } = user;
  let tenant = null;
  if (user.tenant_id) {
    tenant = db.prepare('SELECT id, name, slug FROM tenants WHERE id = ? AND active = 1').get(user.tenant_id);
  }
  res.json({ token, user: safeUser, tenant });
});

// ─── REGISTRATION (no tenant — user joins/creates tenant via onboarding) ──
app.post('/api/auth/register', (req, res) => {
  const { username, email, password, first_name, last_name } = req.body;
  if (!username || !email || !password || !first_name) {
    return res.status(400).json({ error: 'Vyplňte všechna povinná pole' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existing) return res.status(400).json({ error: 'Uživatel s tímto jménem nebo emailem již existuje' });

  const hash = bcrypt.hashSync(password, 10);
  const full_name = `${first_name} ${last_name || ''}`.trim();
  try {
    db.prepare('INSERT INTO users (username, email, password, full_name, first_name, last_name, role, active, status) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(username, email, hash, full_name, first_name, last_name || '', 'viewer', 1, 'active');
    // Auto-login after registration
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    const token = generateToken(user);
    const { password: _, ...safeUser } = user;
    res.json({ token, user: safeUser, tenant: null });
  } catch (e) {
    res.status(400).json({ error: 'Chyba při registraci' });
  }
});

// ─── PASSWORD RESET ───────────────────────────────────────────
app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!user) return res.json({ ok: true });
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 3600000).toISOString();
  db.prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?').run(token, expires, user.id);
  res.json({ ok: true });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Neplatný požadavek' });
  const user = db.prepare('SELECT id, reset_token_expires FROM users WHERE reset_token = ?').get(token);
  if (!user) return res.status(400).json({ error: 'Neplatný nebo expirovaný token' });
  if (new Date(user.reset_token_expires) < new Date()) {
    return res.status(400).json({ error: 'Token expiroval. Požádejte o nový.' });
  }
  const hash = bcrypt.hashSync(password, 10);
  db.prepare("UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL, updated_at = datetime('now') WHERE id = ?").run(hash, user.id);
  res.json({ ok: true });
});

// ─── ONBOARDING (create or join tenant) ──────────────────────
app.post('/api/onboarding/create-tenant', authenticate, (req, res) => {
  const { name, slug } = req.body;
  if (!name || !slug) return res.status(400).json({ error: 'Vyplňte název a identifikátor firmy' });
  if (!/^[a-z0-9-]+$/.test(slug)) return res.status(400).json({ error: 'Identifikátor může obsahovat pouze malá písmena, čísla a pomlčky' });
  if (req.user.tenant_id) return res.status(400).json({ error: 'Již jste členem firmy' });

  const existing = db.prepare('SELECT id FROM tenants WHERE slug = ?').get(slug);
  if (existing) return res.status(400).json({ error: 'Firma s tímto identifikátorem již existuje' });

  const inviteCode = crypto.randomBytes(6).toString('hex');
  const tenantResult = db.prepare('INSERT INTO tenants (name, slug, invite_code) VALUES (?, ?, ?)').run(name, slug, inviteCode);
  const tenantId = tenantResult.lastInsertRowid;

  // Create company record
  db.prepare('INSERT INTO company (tenant_id, name) VALUES (?, ?)').run(tenantId, name);

  // Assign user as admin of new tenant
  db.prepare("UPDATE users SET tenant_id = ?, role = 'admin', updated_at = datetime('now') WHERE id = ?").run(tenantId, req.user.id);

  // Return new token with tenant_id
  const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const token = generateToken(updatedUser);
  const { password: _, ...safeUser } = updatedUser;
  const tenant = { id: tenantId, name, slug };
  res.json({ token, user: safeUser, tenant });
});

app.post('/api/onboarding/join-tenant', authenticate, (req, res) => {
  const { invite_code } = req.body;
  if (!invite_code) return res.status(400).json({ error: 'Zadejte kód pozvánky' });
  if (req.user.tenant_id) return res.status(400).json({ error: 'Již jste členem firmy' });

  const tenant = db.prepare('SELECT * FROM tenants WHERE invite_code = ? AND active = 1').get(invite_code);
  if (!tenant) return res.status(400).json({ error: 'Neplatný kód pozvánky' });

  // Assign user to tenant as viewer (pending approval)
  db.prepare("UPDATE users SET tenant_id = ?, role = 'viewer', status = 'pending', active = 0, updated_at = datetime('now') WHERE id = ?").run(tenant.id, req.user.id);

  const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const token = generateToken(updatedUser);
  const { password: _, ...safeUser } = updatedUser;
  res.json({ token, user: safeUser, tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug }, pending: true });
});

// ─── PENDING USERS (admin approval, tenant-scoped) ──────────
app.get('/api/users/pending', ...tenanted, authorize('admin'), (req, res) => {
  res.json(db.prepare("SELECT id, username, email, full_name, first_name, last_name, created_at FROM users WHERE status = 'pending' AND tenant_id = ?").all(req.tenant_id));
});

app.post('/api/users/:id/approve', ...tenanted, authorize('admin'), (req, res) => {
  const { role } = req.body;
  db.prepare("UPDATE users SET active = 1, status = 'active', role = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?").run(role || 'viewer', req.params.id, req.tenant_id);
  res.json({ ok: true });
});

app.post('/api/users/:id/reject', ...tenanted, authorize('admin'), (req, res) => {
  db.prepare("DELETE FROM users WHERE id = ? AND status = 'pending' AND tenant_id = ?").run(req.params.id, req.tenant_id);
  res.json({ ok: true });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  if (req.user.role === 'superadmin') {
    const sa = db.prepare('SELECT id, username, email, full_name, created_at FROM superadmins WHERE id = ?').get(req.user.id);
    return res.json({ ...sa, role: 'superadmin' });
  }
  const user = db.prepare('SELECT id, username, email, full_name, first_name, last_name, role, active, signature, created_at, tenant_id FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// ─── PROFILE ──────────────────────────────────────────────
app.put('/api/profile', ...tenanted, (req, res) => {
  const { first_name, last_name, email, password } = req.body;
  const full_name = `${first_name || ''} ${last_name || ''}`.trim();
  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare("UPDATE users SET email=?, full_name=?, first_name=?, last_name=?, password=?, updated_at=datetime('now') WHERE id=? AND tenant_id=?")
      .run(email, full_name, first_name || '', last_name || '', hash, req.user.id, req.tenant_id);
  } else {
    db.prepare("UPDATE users SET email=?, full_name=?, first_name=?, last_name=?, updated_at=datetime('now') WHERE id=? AND tenant_id=?")
      .run(email, full_name, first_name || '', last_name || '', req.user.id, req.tenant_id);
  }
  const user = db.prepare('SELECT id, username, email, full_name, first_name, last_name, role, active, signature, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

app.put('/api/profile/signature', ...tenanted, (req, res) => {
  const { signature } = req.body;
  db.prepare("UPDATE users SET signature = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?").run(signature || null, req.user.id, req.tenant_id);
  res.json({ ok: true });
});

app.get('/api/users/:id/signature', ...tenanted, (req, res) => {
  const row = db.prepare('SELECT signature FROM users WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id);
  res.json({ signature: row?.signature || null });
});

// ─── DASHBOARD ───────────────────────────────────────────────
app.get('/api/dashboard', ...tenanted, (req, res) => {
  const tid = req.tenant_id;
  const { from, to } = req.query;
  const dateFilter = (col) => {
    if (from && to) return ` AND ${col} >= ? AND ${col} <= ?`;
    if (from) return ` AND ${col} >= ?`;
    if (to) return ` AND ${col} <= ?`;
    return '';
  };
  const dateParams = () => {
    const p = [];
    if (from) p.push(from);
    if (to) p.push(to);
    return p;
  };

  const totalRevenue = db.prepare(`SELECT COALESCE(SUM(total_czk),0) as val FROM invoices WHERE type='issued' AND status='paid' AND tenant_id=?${dateFilter('paid_date')}`).get(tid, ...dateParams()).val;
  const totalExpenses = db.prepare(`SELECT COALESCE(SUM(total_czk),0) as val FROM invoices WHERE type='received' AND status='paid' AND tenant_id=?${dateFilter('paid_date')}`).get(tid, ...dateParams()).val;
  const unpaidInvoices = db.prepare("SELECT COUNT(*) as val FROM invoices WHERE type='issued' AND status IN ('sent','overdue') AND tenant_id=?").get(tid).val;
  const overdueInvoices = db.prepare("SELECT COUNT(*) as val FROM invoices WHERE status='overdue' AND tenant_id=?").get(tid).val;
  const totalClients = db.prepare("SELECT COUNT(*) as val FROM clients WHERE tenant_id=?").get(tid).val;
  const draftInvoices = db.prepare("SELECT COUNT(*) as val FROM invoices WHERE status='draft' AND tenant_id=?").get(tid).val;

  const revenueByMonth = db.prepare(`
    SELECT strftime('%Y-%m', paid_date) as month, SUM(total_czk) as total
    FROM invoices WHERE type='issued' AND status='paid' AND paid_date IS NOT NULL AND tenant_id=?${dateFilter('paid_date')}
    GROUP BY month ORDER BY month
  `).all(tid, ...dateParams());

  const expensesByCategory = db.prepare(`
    SELECT category, SUM(amount) as total FROM evidence WHERE type='expense' AND tenant_id=?${dateFilter('date')}
    GROUP BY category ORDER BY total DESC
  `).all(tid, ...dateParams());

  const invoicesByStatus = db.prepare(`
    SELECT status, COUNT(*) as count FROM invoices WHERE tenant_id=?${dateFilter('issue_date')} GROUP BY status
  `).all(tid, ...dateParams());

  const recentInvoices = db.prepare(`
    SELECT i.*, c.name as client_name FROM invoices i
    LEFT JOIN clients c ON i.client_id = c.id
    WHERE i.tenant_id=? ORDER BY i.created_at DESC LIMIT 5
  `).all(tid);

  const topClients = db.prepare(`
    SELECT c.name, SUM(i.total_czk) as total FROM invoices i
    JOIN clients c ON i.client_id = c.id
    WHERE i.type='issued' AND i.status='paid' AND i.tenant_id=?${dateFilter('i.paid_date')}
    GROUP BY c.id ORDER BY total DESC LIMIT 5
  `).all(tid, ...dateParams());

  // Top suppliers (received invoices)
  const topSuppliers = db.prepare(`
    SELECT c.name, SUM(i.total_czk) as total FROM invoices i
    JOIN clients c ON i.client_id = c.id
    WHERE i.type='received' AND i.tenant_id=?${dateFilter('i.issue_date')}
    GROUP BY c.id ORDER BY total DESC LIMIT 10
  `).all(tid, ...dateParams());

  const currencyBreakdown = db.prepare(`
    SELECT currency, COUNT(*) as count, SUM(total) as total FROM invoices
    WHERE type='issued' AND tenant_id=?${dateFilter('issue_date')} GROUP BY currency
  `).all(tid, ...dateParams());

  // Determine year for monthly chart from date range or current year
  const chartYear = from ? from.slice(0, 4) : String(new Date().getFullYear());
  const monthlyIssued = db.prepare(`
    SELECT strftime('%m', issue_date) as month, SUM(total_czk) as total, SUM(tax_amount) as tax
    FROM invoices WHERE type='issued' AND strftime('%Y', issue_date) = ? AND tenant_id=?
    GROUP BY month ORDER BY month
  `).all(chartYear, tid);

  const monthlyExpenses = db.prepare(`
    SELECT strftime('%m', date) as month, SUM(amount) as total
    FROM evidence WHERE type='expense' AND strftime('%Y', date) = ? AND tenant_id=?
    GROUP BY month ORDER BY month
  `).all(chartYear, tid);

  const pendingItems = [];
  const overdueList = db.prepare(`
    SELECT i.id, i.invoice_number, i.total, i.currency, i.due_date, c.name as client_name
    FROM invoices i LEFT JOIN clients c ON i.client_id = c.id
    WHERE i.status = 'overdue' AND i.tenant_id=? ORDER BY i.due_date
  `).all(tid);
  overdueList.forEach(i => pendingItems.push({ type: 'overdue', ...i }));

  const draftList = db.prepare(`
    SELECT i.id, i.invoice_number, i.total, i.currency, c.name as client_name
    FROM invoices i LEFT JOIN clients c ON i.client_id = c.id
    WHERE i.status = 'draft' AND i.tenant_id=? ORDER BY i.created_at DESC
  `).all(tid);
  draftList.forEach(i => pendingItems.push({ type: 'draft', ...i }));

  const unpaidList = db.prepare(`
    SELECT i.id, i.invoice_number, i.total, i.currency, i.due_date, c.name as client_name
    FROM invoices i LEFT JOIN clients c ON i.client_id = c.id
    WHERE i.status = 'sent' AND i.tenant_id=? ORDER BY i.due_date
  `).all(tid);
  unpaidList.forEach(i => pendingItems.push({ type: 'unpaid', ...i }));

  const pendingUsers = db.prepare("SELECT COUNT(*) as val FROM users WHERE status = 'pending' AND tenant_id=?").get(tid).val;

  res.json({
    kpis: { totalRevenue, totalExpenses, profit: totalRevenue - totalExpenses, unpaidInvoices, overdueInvoices, totalClients, draftInvoices, pendingUsers },
    revenueByMonth, expensesByCategory, invoicesByStatus, recentInvoices, topClients, topSuppliers, currencyBreakdown,
    monthlyIssued, monthlyExpenses, pendingItems, chartYear
  });
});

// ─── CURRENCIES (global, not tenant-scoped) ──────────────────
app.get('/api/currencies', authenticate, (req, res) => {
  res.json(db.prepare('SELECT * FROM currencies ORDER BY code').all());
});

app.put('/api/currencies/:code', ...tenanted, authorize('admin', 'accountant'), (req, res) => {
  const { rate_to_czk } = req.body;
  db.prepare("UPDATE currencies SET rate_to_czk = ?, updated_at = datetime('now') WHERE code = ?").run(rate_to_czk, req.params.code);
  res.json({ ok: true });
});

// ─── CLIENTS ─────────────────────────────────────────────────
app.get('/api/clients', ...tenanted, (req, res) => {
  res.json(db.prepare('SELECT * FROM clients WHERE tenant_id = ? ORDER BY name').all(req.tenant_id));
});

app.post('/api/clients', ...tenanted, authorize('admin', 'accountant', 'manager'), (req, res) => {
  const { name, ico, dic, email, phone, address, city, zip, country } = req.body;
  const result = db.prepare('INSERT INTO clients (tenant_id, name, ico, dic, email, phone, address, city, zip, country) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(req.tenant_id, name, ico || null, dic || null, email || null, phone || null, address || null, city || null, zip || null, country || 'CZ');
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/clients/:id', ...tenanted, authorize('admin', 'accountant', 'manager'), (req, res) => {
  const { name, ico, dic, email, phone, address, city, zip, country } = req.body;
  db.prepare('UPDATE clients SET name=?, ico=?, dic=?, email=?, phone=?, address=?, city=?, zip=?, country=? WHERE id=? AND tenant_id=?')
    .run(name, ico, dic, email, phone, address, city, zip, country, req.params.id, req.tenant_id);
  res.json({ ok: true });
});

app.get('/api/clients/:id', ...tenanted, (req, res) => {
  const client = db.prepare('SELECT * FROM clients WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id);
  if (!client) return res.status(404).json({ error: 'Klient nenalezen' });
  res.json(client);
});

app.get('/api/clients/:id/invoices', ...tenanted, (req, res) => {
  res.json(db.prepare('SELECT * FROM invoices WHERE client_id = ? AND tenant_id = ? ORDER BY created_at DESC').all(req.params.id, req.tenant_id));
});

app.delete('/api/clients/:id', ...tenanted, authorize('admin'), (req, res) => {
  db.prepare('DELETE FROM clients WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenant_id);
  res.json({ ok: true });
});

// ─── INVOICES ────────────────────────────────────────────────
function generateInvoiceNumber(comp) {
  const prefix = comp?.invoice_prefix || 'FV';
  const counter = comp?.invoice_counter || 1;
  const sep = comp?.invoice_separator || '-';
  const padding = comp?.invoice_padding || 3;
  const yearFmt = comp?.invoice_year_format || 'full';
  const format = comp?.invoice_format || '{prefix}{sep}{year}{sep}{num}';
  const fullYear = new Date().getFullYear();
  const year = yearFmt === 'short' ? String(fullYear).slice(2) : String(fullYear);
  const num = String(counter).padStart(padding, '0');
  return format.replace(/\{prefix\}/g, prefix).replace(/\{sep\}/g, sep).replace(/\{year\}/g, year).replace(/\{num\}/g, num);
}

function generateVariableSymbol(comp) {
  const counter = comp?.invoice_counter || 1;
  const year = new Date().getFullYear() % 100;
  return String(year) + String(counter).padStart(6, '0');
}

app.get('/api/invoices/next-number', ...tenanted, (req, res) => {
  const comp = db.prepare('SELECT * FROM company WHERE tenant_id = ?').get(req.tenant_id);
  res.json({ number: generateInvoiceNumber(comp), variable_symbol: generateVariableSymbol(comp) });
});

app.get('/api/invoices/:id/qr', ...tenanted, async (req, res) => {
  try {
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id);
    if (!invoice) return res.status(404).json({ error: 'Faktura nenalezena' });
    const company = db.prepare('SELECT * FROM company WHERE tenant_id = ?').get(req.tenant_id);
    if (!company) return res.status(400).json({ error: 'Není nastavena společnost' });

    const parts = ['SPD*1.0'];
    if (company.iban) {
      parts.push(`ACC:${company.iban.replace(/\s/g, '')}`);
    } else if (company.bank_account) {
      parts.push(`ACC:${company.bank_account.replace(/\s/g, '')}`);
    }
    parts.push(`AM:${invoice.total.toFixed(2)}`);
    parts.push(`CC:${invoice.currency}`);
    if (invoice.variable_symbol) parts.push(`X-VS:${invoice.variable_symbol}`);
    if (company.name) parts.push(`RN:${company.name.slice(0, 35)}`);
    if (invoice.due_date) parts.push(`DT:${invoice.due_date.replace(/-/g, '')}`);

    const spdString = parts.join('*');
    const qrDataUrl = await QRCode.toDataURL(spdString, { width: 200, margin: 1, errorCorrectionLevel: 'M' });
    res.json({ qr: qrDataUrl, spd: spdString });
  } catch (e) {
    res.status(500).json({ error: 'Chyba při generování QR kódu' });
  }
});

app.get('/api/invoices', ...tenanted, (req, res) => {
  const { type, status, currency } = req.query;
  let sql = `SELECT i.*, c.name as client_name FROM invoices i LEFT JOIN clients c ON i.client_id = c.id WHERE i.tenant_id = ?`;
  const params = [req.tenant_id];
  if (type) { sql += ' AND i.type = ?'; params.push(type); }
  if (status) { sql += ' AND i.status = ?'; params.push(status); }
  if (currency) { sql += ' AND i.currency = ?'; params.push(currency); }
  sql += ' ORDER BY i.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/invoices/:id', ...tenanted, (req, res) => {
  const invoice = db.prepare(`
    SELECT i.*, c.name as client_name, c.ico as client_ico, c.dic as client_dic,
      c.address as client_address, c.city as client_city, c.zip as client_zip, c.email as client_email,
      u.full_name as created_by_name, u.signature as created_by_signature
    FROM invoices i
    LEFT JOIN clients c ON i.client_id = c.id
    LEFT JOIN users u ON i.created_by = u.id
    WHERE i.id = ? AND i.tenant_id = ?
  `).get(req.params.id, req.tenant_id);
  if (!invoice) return res.status(404).json({ error: 'Faktura nenalezena' });
  invoice.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(req.params.id);
  res.json(invoice);
});

app.post('/api/invoices', ...tenanted, authorize('admin', 'accountant'), (req, res) => {
  const { invoice_number, client_id, issue_date, due_date, supply_date, payment_method, status, currency, note, items, variable_symbol, invoice_type } = req.body;
  const curr = db.prepare('SELECT rate_to_czk FROM currencies WHERE code = ?').get(currency || 'CZK');
  const rate = curr ? curr.rate_to_czk : 1;

  let finalNumber = invoice_number;
  let finalVS = variable_symbol;
  const comp = db.prepare('SELECT * FROM company WHERE tenant_id = ?').get(req.tenant_id);
  if (!comp || (!comp.bank_account && !comp.iban)) {
    return res.status(400).json({ error: 'Nelze vystavit fakturu bez bankovního spojení. Vyplňte údaje v nastavení firmy.' });
  }
  if (!finalNumber) {
    finalNumber = generateInvoiceNumber(comp);
    db.prepare('UPDATE company SET invoice_counter = ? WHERE tenant_id = ?').run((comp?.invoice_counter || 1) + 1, req.tenant_id);
  }
  if (!finalVS) {
    finalVS = generateVariableSymbol(comp);
  }

  let subtotal = 0;
  let totalTax = 0;
  if (items) items.forEach(i => {
    const lineTotal = (i.quantity || 1) * (i.unit_price || 0);
    const lineTax = lineTotal * ((i.tax_rate ?? 21) / 100);
    subtotal += lineTotal;
    totalTax += lineTax;
  });
  const total = subtotal + totalTax;
  const totalCzk = total * rate;

  const result = db.prepare(`
    INSERT INTO invoices (tenant_id, invoice_number, type, client_id, issue_date, due_date, supply_date, payment_method, status, currency, subtotal, tax_rate, tax_amount, total, total_czk, note, created_by, variable_symbol, invoice_type)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(req.tenant_id, finalNumber, 'issued', client_id, issue_date, due_date, supply_date || issue_date, payment_method || 'bank_transfer', status || 'draft', currency || 'CZK', subtotal, 0, totalTax, total, totalCzk, note || null, req.user.id, finalVS, invoice_type || 'regular');

  const invoiceId = result.lastInsertRowid;
  const insertItem = db.prepare('INSERT INTO invoice_items (invoice_id, description, quantity, unit, unit_price, total, tax_rate, tax_amount, total_with_tax) VALUES (?,?,?,?,?,?,?,?,?)');
  if (items) {
    items.forEach(i => {
      const lineTotal = (i.quantity || 1) * (i.unit_price || 0);
      const lineTaxRate = i.tax_rate ?? 21;
      const lineTax = lineTotal * (lineTaxRate / 100);
      insertItem.run(invoiceId, i.description, i.quantity || 1, i.unit || 'ks', i.unit_price || 0, lineTotal, lineTaxRate, lineTax, lineTotal + lineTax);
    });
  }

  db.prepare("INSERT INTO audit_log (tenant_id, user_id, action, entity, entity_id, details) VALUES (?, ?, 'create', 'invoice', ?, ?)").run(req.tenant_id, req.user.id, invoiceId, `Vytvořena faktura ${finalNumber}`);
  res.json({ id: invoiceId });
});

app.put('/api/invoices/:id', ...tenanted, authorize('admin', 'accountant'), (req, res) => {
  const { invoice_number, client_id, issue_date, due_date, supply_date, payment_method, paid_date, status, currency, note, items } = req.body;
  const curr = db.prepare('SELECT rate_to_czk FROM currencies WHERE code = ?').get(currency || 'CZK');
  const rate = curr ? curr.rate_to_czk : 1;

  let subtotal = 0;
  let totalTax = 0;
  if (items) items.forEach(i => {
    const lineTotal = (i.quantity || 1) * (i.unit_price || 0);
    const lineTax = lineTotal * ((i.tax_rate ?? 21) / 100);
    subtotal += lineTotal;
    totalTax += lineTax;
  });
  const total = subtotal + totalTax;
  const totalCzk = total * rate;

  const baseFields = 'client_id=?, issue_date=?, due_date=?, supply_date=?, payment_method=?, paid_date=?, status=?, currency=?, subtotal=?, tax_rate=?, tax_amount=?, total=?, total_czk=?, note=?, updated_at=datetime(\'now\')';
  const baseParams = [client_id, issue_date, due_date, supply_date || issue_date, payment_method || 'bank_transfer', paid_date || null, status, currency || 'CZK', subtotal, 0, totalTax, total, totalCzk, note || null];

  if (invoice_number && req.user.role === 'admin') {
    db.prepare(`UPDATE invoices SET invoice_number=?, ${baseFields} WHERE id=? AND tenant_id=?`).run(invoice_number, ...baseParams, req.params.id, req.tenant_id);
  } else {
    db.prepare(`UPDATE invoices SET ${baseFields} WHERE id=? AND tenant_id=?`).run(...baseParams, req.params.id, req.tenant_id);
  }

  db.prepare('DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE id = ? AND tenant_id = ?)').run(req.params.id, req.tenant_id);
  const insertItem = db.prepare('INSERT INTO invoice_items (invoice_id, description, quantity, unit, unit_price, total, tax_rate, tax_amount, total_with_tax) VALUES (?,?,?,?,?,?,?,?,?)');
  if (items) {
    items.forEach(i => {
      const lineTotal = (i.quantity || 1) * (i.unit_price || 0);
      const lineTaxRate = i.tax_rate ?? 21;
      const lineTax = lineTotal * (lineTaxRate / 100);
      insertItem.run(req.params.id, i.description, i.quantity || 1, i.unit || 'ks', i.unit_price || 0, lineTotal, lineTaxRate, lineTax, lineTotal + lineTax);
    });
  }

  db.prepare("INSERT INTO audit_log (tenant_id, user_id, action, entity, entity_id, details) VALUES (?, ?, 'update', 'invoice', ?, ?)").run(req.tenant_id, req.user.id, req.params.id, `Upravena faktura`);
  res.json({ ok: true });
});

app.patch('/api/invoices/:id/status', ...tenanted, authorize('admin', 'accountant', 'manager'), (req, res) => {
  const { status, paid_date } = req.body;
  if (paid_date) {
    db.prepare("UPDATE invoices SET status=?, paid_date=?, updated_at=datetime('now') WHERE id=? AND tenant_id=?").run(status, paid_date, req.params.id, req.tenant_id);
  } else {
    db.prepare("UPDATE invoices SET status=?, updated_at=datetime('now') WHERE id=? AND tenant_id=?").run(status, req.params.id, req.tenant_id);
  }
  db.prepare("INSERT INTO audit_log (tenant_id, user_id, action, entity, entity_id, details) VALUES (?, ?, 'status_change', 'invoice', ?, ?)").run(req.tenant_id, req.user.id, req.params.id, `Status změněn na ${status}`);
  res.json({ ok: true });
});

app.delete('/api/invoices/:id', ...tenanted, authorize('admin'), (req, res) => {
  db.prepare('DELETE FROM invoices WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenant_id);
  res.json({ ok: true });
});

// ─── EVIDENCE ────────────────────────────────────────────────
app.get('/api/evidence', ...tenanted, (req, res) => {
  const { type, category } = req.query;
  let sql = 'SELECT e.*, u.full_name as created_by_name FROM evidence e LEFT JOIN users u ON e.created_by = u.id WHERE e.tenant_id = ?';
  const params = [req.tenant_id];
  if (type) { sql += ' AND e.type = ?'; params.push(type); }
  if (category) { sql += ' AND e.category = ?'; params.push(category); }
  sql += ' ORDER BY e.date DESC';
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/evidence', ...tenanted, authorize('admin', 'accountant', 'manager'), (req, res) => {
  const { type, title, description, amount, currency, date, category, invoice_id, file_path, original_filename } = req.body;
  const result = db.prepare('INSERT INTO evidence (tenant_id, type, title, description, amount, currency, date, category, invoice_id, created_by, file_path, original_filename) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(req.tenant_id, type, title, description || null, amount || null, currency || 'CZK', date, category || null, invoice_id || null, req.user.id, file_path || null, original_filename || null);
  if (category) learnCategory(req.tenant_id, title, description, category);
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/evidence/:id', ...tenanted, authorize('admin', 'accountant'), (req, res) => {
  const { type, title, description, amount, currency, date, category, invoice_id } = req.body;
  db.prepare('UPDATE evidence SET type=?, title=?, description=?, amount=?, currency=?, date=?, category=?, invoice_id=? WHERE id=? AND tenant_id=?')
    .run(type, title, description, amount, currency, date, category, invoice_id || null, req.params.id, req.tenant_id);
  if (category) learnCategory(req.tenant_id, title, description, category);
  res.json({ ok: true });
});

app.delete('/api/evidence/:id', ...tenanted, authorize('admin'), (req, res) => {
  db.prepare('DELETE FROM evidence WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenant_id);
  res.json({ ok: true });
});

// ─── USERS ───────────────────────────────────────────────────
app.get('/api/users', ...tenanted, authorize('admin'), (req, res) => {
  res.json(db.prepare('SELECT id, username, email, full_name, first_name, last_name, role, active, created_at, updated_at FROM users WHERE tenant_id = ? ORDER BY id').all(req.tenant_id));
});

app.get('/api/users/:id', ...tenanted, authorize('admin'), (req, res) => {
  const user = db.prepare('SELECT id, username, email, full_name, first_name, last_name, role, active, signature, created_at, updated_at FROM users WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id);
  if (!user) return res.status(404).json({ error: 'Uživatel nenalezen' });
  const invoiceCount = db.prepare("SELECT COUNT(*) as cnt FROM invoices WHERE created_by = ? AND tenant_id = ?").get(req.params.id, req.tenant_id).cnt;
  res.json({ ...user, invoice_count: invoiceCount });
});

app.post('/api/users', ...tenanted, authorize('admin'), (req, res) => {
  const { username, email, password, first_name, last_name, role } = req.body;
  const full_name = `${first_name || ''} ${last_name || ''}`.trim();
  const hash = bcrypt.hashSync(password, 10);
  try {
    const result = db.prepare('INSERT INTO users (tenant_id, username, email, password, full_name, first_name, last_name, role) VALUES (?,?,?,?,?,?,?,?)').run(req.tenant_id, username, email, hash, full_name, first_name || '', last_name || '', role || 'viewer');
    res.json({ id: result.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: 'Uživatel s tímto jménem nebo emailem již existuje' });
  }
});

app.put('/api/users/:id', ...tenanted, authorize('admin'), (req, res) => {
  const { email, first_name, last_name, role, active, password } = req.body;
  const full_name = `${first_name || ''} ${last_name || ''}`.trim();
  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare("UPDATE users SET email=?, full_name=?, first_name=?, last_name=?, role=?, active=?, password=?, updated_at=datetime('now') WHERE id=? AND tenant_id=?").run(email, full_name, first_name||'', last_name||'', role, active, hash, req.params.id, req.tenant_id);
  } else {
    db.prepare("UPDATE users SET email=?, full_name=?, first_name=?, last_name=?, role=?, active=?, updated_at=datetime('now') WHERE id=? AND tenant_id=?").run(email, full_name, first_name||'', last_name||'', role, active, req.params.id, req.tenant_id);
  }
  res.json({ ok: true });
});

app.delete('/api/users/:id', ...tenanted, authorize('admin'), (req, res) => {
  if (req.params.id == req.user.id) return res.status(400).json({ error: 'Nemůžete smazat sami sebe' });
  db.prepare('DELETE FROM users WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenant_id);
  res.json({ ok: true });
});

app.put('/api/users/:id/signature', ...tenanted, authorize('admin'), (req, res) => {
  const { signature } = req.body;
  db.prepare("UPDATE users SET signature = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?").run(signature || null, req.params.id, req.tenant_id);
  res.json({ ok: true });
});

// ─── COMPANY ─────────────────────────────────────────────────
app.get('/api/company', ...tenanted, (req, res) => {
  res.json(db.prepare('SELECT * FROM company WHERE tenant_id = ?').get(req.tenant_id) || {});
});

app.put('/api/company', ...tenanted, authorize('admin'), (req, res) => {
  const { name, ico, dic, email, phone, address, city, zip, country, bank_account, bank_code, iban, swift, invoice_prefix, invoice_counter, default_due_days, vat_payer, invoice_format, invoice_separator, invoice_padding, invoice_year_format, logo } = req.body;
  // Handle logo separately if provided
  if (logo !== undefined) {
    db.prepare('UPDATE company SET logo = ? WHERE tenant_id = ?').run(logo, req.tenant_id);
  }
  const existing = db.prepare('SELECT id FROM company WHERE tenant_id = ?').get(req.tenant_id);
  if (existing) {
    db.prepare('UPDATE company SET name=?,ico=?,dic=?,email=?,phone=?,address=?,city=?,zip=?,country=?,bank_account=?,bank_code=?,iban=?,swift=?,invoice_prefix=?,invoice_counter=?,default_due_days=?,vat_payer=?,invoice_format=?,invoice_separator=?,invoice_padding=?,invoice_year_format=? WHERE tenant_id=?')
      .run(name,ico||null,dic||null,email||null,phone||null,address||null,city||null,zip||null,country||'CZ',bank_account||null,bank_code||null,iban||null,swift||null,invoice_prefix||'FV',invoice_counter||1,default_due_days||14,vat_payer?1:0,invoice_format||'{prefix}{sep}{year}{sep}{num}',invoice_separator||'-',invoice_padding||3,invoice_year_format||'full',req.tenant_id);
  } else {
    db.prepare('INSERT INTO company (tenant_id,name,ico,dic,email,phone,address,city,zip,country,bank_account,bank_code,iban,swift,invoice_prefix,invoice_counter,default_due_days,vat_payer,invoice_format,invoice_separator,invoice_padding,invoice_year_format) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(req.tenant_id,name,ico||null,dic||null,email||null,phone||null,address||null,city||null,zip||null,country||'CZ',bank_account||null,bank_code||null,iban||null,swift||null,invoice_prefix||'FV',invoice_counter||1,default_due_days||14,vat_payer?1:0,invoice_format||'{prefix}{sep}{year}{sep}{num}',invoice_separator||'-',invoice_padding||3,invoice_year_format||'full');
  }
  res.json({ ok: true });
});

// ─── CNB RATES REFRESH ──────────────────────────────────────
app.post('/api/currencies/refresh', ...tenanted, authorize('admin'), async (req, res) => {
  try {
    await updateRates();
    const currencies = db.prepare('SELECT * FROM currencies ORDER BY code').all();
    res.json(currencies);
  } catch (e) {
    res.status(500).json({ error: 'Nepodařilo se aktualizovat kurzy' });
  }
});

// ─── AUDIT LOG ───────────────────────────────────────────────
app.get('/api/audit-log', ...tenanted, authorize('admin'), (req, res) => {
  res.json(db.prepare('SELECT a.*, u.full_name as user_name FROM audit_log a LEFT JOIN users u ON a.user_id = u.id WHERE a.tenant_id = ? ORDER BY a.created_at DESC LIMIT 100').all(req.tenant_id));
});

// ─── PDF/ZIP UPLOAD & EXPENSE EXTRACTION ────────────────────
function extractExpenseFromText(text) {
  const result = { title: '', amount: null, date: null, category: null };
  const amountMatch = text.match(/(?:celkem|total|k úhradě|částka|suma|amount)[:\s]*([0-9\s]+[.,]\d{2})/i)
    || text.match(/([0-9\s]{1,10}[.,]\d{2})\s*(?:Kč|CZK|EUR|USD)/i)
    || text.match(/(?:Kč|CZK|EUR|USD)\s*([0-9\s]{1,10}[.,]\d{2})/i);
  if (amountMatch) {
    result.amount = parseFloat(amountMatch[1].replace(/\s/g, '').replace(',', '.'));
  }
  const dateMatch = text.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/) || text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) {
    if (dateMatch[3] && dateMatch[3].length === 4) {
      result.date = `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
    } else if (dateMatch[1] && dateMatch[1].length === 4) {
      result.date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    }
  }
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3 && l.length < 100);
  result.title = lines[0] || 'Importovaný doklad';
  return result;
}

function suggestCategory(tenantId, text) {
  const rules = db.prepare('SELECT keyword, category, weight FROM category_rules WHERE tenant_id = ? ORDER BY weight DESC').all(tenantId);
  const lowerText = text.toLowerCase();
  for (const rule of rules) {
    if (lowerText.includes(rule.keyword.toLowerCase())) {
      return rule.category;
    }
  }
  return null;
}

function learnCategory(tenantId, title, description, category) {
  if (!category) return;
  const words = (title + ' ' + (description || '')).toLowerCase().split(/\s+/).filter(w => w.length > 3);
  words.forEach(word => {
    const existing = db.prepare('SELECT id, weight FROM category_rules WHERE keyword = ? AND category = ? AND tenant_id = ?').get(word, category, tenantId);
    if (existing) {
      db.prepare('UPDATE category_rules SET weight = weight + 1 WHERE id = ?').run(existing.id);
    } else {
      db.prepare('INSERT INTO category_rules (tenant_id, keyword, category) VALUES (?, ?, ?)').run(tenantId, word, category);
    }
  });
}

app.post('/api/evidence/upload', ...tenanted, authorize('admin', 'accountant', 'manager'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Žádný soubor' });
    const results = [];

    const processFile = async (filePath, originalName) => {
      if (originalName.toLowerCase().endsWith('.pdf')) {
        const buffer = fs.readFileSync(filePath);
        const data = await pdfParse(buffer);
        const extracted = extractExpenseFromText(data.text);
        const category = suggestCategory(req.tenant_id, data.text);
        results.push({
          title: extracted.title,
          amount: extracted.amount,
          date: extracted.date || new Date().toISOString().slice(0, 10),
          category: category,
          text_preview: data.text.slice(0, 500),
          original_filename: originalName,
          file_path: filePath
        });
      }
    };

    if (req.file.originalname.toLowerCase().endsWith('.zip')) {
      const zip = new AdmZip(req.file.path);
      const entries = zip.getEntries();
      for (const entry of entries) {
        if (entry.entryName.toLowerCase().endsWith('.pdf') && !entry.isDirectory) {
          const tempPath = path.join(uploadDir, `${Date.now()}_${entry.entryName.replace(/[/\\]/g, '_')}`);
          fs.writeFileSync(tempPath, entry.getData());
          await processFile(tempPath, entry.entryName);
        }
      }
      fs.unlinkSync(req.file.path);
    } else {
      await processFile(req.file.path, req.file.originalname);
    }

    res.json(results);
  } catch (e) {
    console.error('Upload error:', e);
    res.status(500).json({ error: 'Chyba při zpracování souboru: ' + e.message });
  }
});

// ─── CATEGORY RULES ─────────────────────────────────────────
app.get('/api/categories', ...tenanted, (req, res) => {
  const fromEvidence = db.prepare("SELECT DISTINCT category FROM evidence WHERE category IS NOT NULL AND category != '' AND tenant_id = ? ORDER BY category").all(req.tenant_id).map(r => r.category);
  const fromRules = db.prepare("SELECT DISTINCT category FROM category_rules WHERE tenant_id = ? ORDER BY category").all(req.tenant_id).map(r => r.category);
  const all = [...new Set([...fromEvidence, ...fromRules])].sort();
  res.json(all);
});

app.get('/api/category-rules', ...tenanted, authorize('admin'), (req, res) => {
  res.json(db.prepare('SELECT * FROM category_rules WHERE tenant_id = ? ORDER BY category, weight DESC').all(req.tenant_id));
});

app.delete('/api/category-rules/:id', ...tenanted, authorize('admin'), (req, res) => {
  db.prepare('DELETE FROM category_rules WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenant_id);
  res.json({ ok: true });
});

// ─── ARES LOOKUP ────────────────────────────────────────────
app.get('/api/ares/:ico', ...tenanted, (req, res) => {
  const ico = req.params.ico.replace(/\s/g, '');
  if (!/^\d{7,8}$/.test(ico)) return res.status(400).json({ error: 'Neplatné IČO' });
  https.get(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`, (resp) => {
    let data = '';
    resp.on('data', chunk => data += chunk);
    resp.on('end', () => {
      try {
        const j = JSON.parse(data);
        const addr = j.sidlo || {};
        const result = {
          name: j.obchodniJmeno || '',
          ico: j.ico || ico,
          dic: j.dic || '',
          address: [addr.nazevUlice, addr.cisloDomovni ? `${addr.cisloDomovni}${addr.cisloOrientacni ? '/' + addr.cisloOrientacni : ''}` : ''].filter(Boolean).join(' '),
          city: addr.nazevObce || '',
          zip: addr.psc ? String(addr.psc) : '',
          country: 'CZ'
        };
        res.json(result);
      } catch (e) {
        res.status(404).json({ error: 'Subjekt nenalezen v ARES' });
      }
    });
    resp.on('error', () => res.status(500).json({ error: 'Chyba při komunikaci s ARES' }));
  }).on('error', () => res.status(500).json({ error: 'Chyba při komunikaci s ARES' }));
});

// ─── GLOBAL SEARCH ──────────────────────────────────────────
app.get('/api/search', ...tenanted, (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q || q.length < 2) return res.json({ invoices: [], clients: [], evidence: [] });
  const like = `%${q}%`;
  const invoices = db.prepare(`SELECT i.id, i.invoice_number, i.total, i.currency, i.status, c.name as client_name
    FROM invoices i LEFT JOIN clients c ON i.client_id = c.id
    WHERE i.tenant_id = ? AND (i.invoice_number LIKE ? OR c.name LIKE ? OR i.variable_symbol LIKE ? OR i.note LIKE ?)
    ORDER BY i.created_at DESC LIMIT 10`).all(req.tenant_id, like, like, like, like);
  const clients = db.prepare(`SELECT id, name, ico, email, city FROM clients WHERE tenant_id = ? AND (name LIKE ? OR ico LIKE ? OR email LIKE ? OR dic LIKE ?) ORDER BY name LIMIT 10`).all(req.tenant_id, like, like, like, like);
  const evidence = db.prepare(`SELECT id, title, amount, currency, date, type FROM evidence WHERE tenant_id = ? AND (title LIKE ? OR description LIKE ? OR category LIKE ?) ORDER BY date DESC LIMIT 10`).all(req.tenant_id, like, like, like);
  res.json({ invoices, clients, evidence });
});

// ─── CSV EXPORT ─────────────────────────────────────────────
app.get('/api/export/invoices', ...tenanted, (req, res) => {
  const rows = db.prepare(`SELECT i.invoice_number, i.type, i.issue_date, i.due_date, i.paid_date, i.status, i.currency, i.subtotal, i.tax_amount, i.total, i.total_czk, i.variable_symbol, i.payment_method, i.note, c.name as client_name, c.ico as client_ico
    FROM invoices i LEFT JOIN clients c ON i.client_id = c.id WHERE i.tenant_id = ? ORDER BY i.created_at DESC`).all(req.tenant_id);
  const header = 'Číslo;Typ;Klient;IČO klienta;Datum vystavení;Splatnost;Datum úhrady;Stav;Měna;Základ;DPH;Celkem;CZK;VS;Způsob úhrady;Poznámka\n';
  const csv = header + rows.map(r => [r.invoice_number, r.type, r.client_name||'', r.client_ico||'', r.issue_date, r.due_date, r.paid_date||'', r.status, r.currency, r.subtotal, r.tax_amount, r.total, r.total_czk, r.variable_symbol||'', r.payment_method||'', (r.note||'').replace(/[\n;]/g,' ')].join(';')).join('\n');
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename=faktury.csv' });
  res.send('\uFEFF' + csv);
});

app.get('/api/export/clients', ...tenanted, (req, res) => {
  const rows = db.prepare('SELECT name, ico, dic, email, phone, address, city, zip, country FROM clients WHERE tenant_id = ? ORDER BY name').all(req.tenant_id);
  const header = 'Název;IČO;DIČ;Email;Telefon;Adresa;Město;PSČ;Země\n';
  const csv = header + rows.map(r => [r.name, r.ico||'', r.dic||'', r.email||'', r.phone||'', r.address||'', r.city||'', r.zip||'', r.country||''].join(';')).join('\n');
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename=klienti.csv' });
  res.send('\uFEFF' + csv);
});

app.get('/api/export/evidence', ...tenanted, (req, res) => {
  const rows = db.prepare('SELECT type, title, description, amount, currency, date, category FROM evidence WHERE tenant_id = ? ORDER BY date DESC').all(req.tenant_id);
  const header = 'Typ;Název;Popis;Částka;Měna;Datum;Kategorie\n';
  const csv = header + rows.map(r => [r.type, r.title, (r.description||'').replace(/[\n;]/g,' '), r.amount||'', r.currency||'', r.date, r.category||''].join(';')).join('\n');
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename=evidence.csv' });
  res.send('\uFEFF' + csv);
});

// ─── DUPLICATE INVOICE ──────────────────────────────────────
app.post('/api/invoices/:id/duplicate', ...tenanted, authorize('admin', 'accountant'), (req, res) => {
  const orig = db.prepare('SELECT * FROM invoices WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id);
  if (!orig) return res.status(404).json({ error: 'Faktura nenalezena' });
  const comp = db.prepare('SELECT * FROM company WHERE tenant_id = ?').get(req.tenant_id);
  const newNumber = generateInvoiceNumber(comp);
  const newVS = generateVariableSymbol(comp);
  db.prepare('UPDATE company SET invoice_counter = ? WHERE tenant_id = ?').run((comp?.invoice_counter || 1) + 1, req.tenant_id);
  const today = new Date().toISOString().slice(0, 10);
  const dueDays = comp?.default_due_days || 14;
  const due = new Date(); due.setDate(due.getDate() + dueDays);
  const dueDate = due.toISOString().slice(0, 10);
  const result = db.prepare(`INSERT INTO invoices (tenant_id, invoice_number, type, client_id, issue_date, due_date, supply_date, payment_method, status, currency, subtotal, tax_rate, tax_amount, total, total_czk, note, created_by, variable_symbol, invoice_type)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(req.tenant_id, newNumber, orig.type, orig.client_id, today, dueDate, today, orig.payment_method, 'draft', orig.currency, orig.subtotal, orig.tax_rate, orig.tax_amount, orig.total, orig.total_czk, orig.note, req.user.id, newVS, 'regular');
  const newId = result.lastInsertRowid;
  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(req.params.id);
  const ins = db.prepare('INSERT INTO invoice_items (invoice_id, description, quantity, unit, unit_price, total, tax_rate, tax_amount, total_with_tax) VALUES (?,?,?,?,?,?,?,?,?)');
  items.forEach(i => ins.run(newId, i.description, i.quantity, i.unit, i.unit_price, i.total, i.tax_rate, i.tax_amount, i.total_with_tax));
  db.prepare("INSERT INTO audit_log (tenant_id, user_id, action, entity, entity_id, details) VALUES (?, ?, 'create', 'invoice', ?, ?)").run(req.tenant_id, req.user.id, newId, `Duplikována faktura z ${orig.invoice_number}`);
  res.json({ id: newId });
});

// ─── CREDIT NOTE ────────────────────────────────────────────
app.post('/api/invoices/:id/credit-note', ...tenanted, authorize('admin', 'accountant'), (req, res) => {
  const orig = db.prepare('SELECT * FROM invoices WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id);
  if (!orig) return res.status(404).json({ error: 'Faktura nenalezena' });
  const comp = db.prepare('SELECT * FROM company WHERE tenant_id = ?').get(req.tenant_id);
  const newNumber = generateInvoiceNumber(comp);
  const newVS = generateVariableSymbol(comp);
  db.prepare('UPDATE company SET invoice_counter = ? WHERE tenant_id = ?').run((comp?.invoice_counter || 1) + 1, req.tenant_id);
  const today = new Date().toISOString().slice(0, 10);
  const result = db.prepare(`INSERT INTO invoices (tenant_id, invoice_number, type, client_id, issue_date, due_date, supply_date, payment_method, status, currency, subtotal, tax_rate, tax_amount, total, total_czk, note, created_by, variable_symbol, invoice_type, related_invoice_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(req.tenant_id, newNumber, orig.type, orig.client_id, today, today, today, orig.payment_method, 'draft', orig.currency, -orig.subtotal, orig.tax_rate, -orig.tax_amount, -orig.total, -orig.total_czk, `Dobropis k faktuře ${orig.invoice_number}`, req.user.id, newVS, 'credit_note', req.params.id);
  const newId = result.lastInsertRowid;
  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(req.params.id);
  const ins = db.prepare('INSERT INTO invoice_items (invoice_id, description, quantity, unit, unit_price, total, tax_rate, tax_amount, total_with_tax) VALUES (?,?,?,?,?,?,?,?,?)');
  items.forEach(i => ins.run(newId, i.description, -i.quantity, i.unit, i.unit_price, -i.total, i.tax_rate, -i.tax_amount, -(i.total_with_tax || i.total)));
  db.prepare("INSERT INTO audit_log (tenant_id, user_id, action, entity, entity_id, details) VALUES (?, ?, 'create', 'invoice', ?, ?)").run(req.tenant_id, req.user.id, newId, `Vytvořen dobropis k ${orig.invoice_number}`);
  res.json({ id: newId });
});

// ─── PROFORMA ───────────────────────────────────────────────
app.post('/api/invoices/:id/to-invoice', ...tenanted, authorize('admin', 'accountant'), (req, res) => {
  const proforma = db.prepare("SELECT * FROM invoices WHERE id = ? AND tenant_id = ? AND invoice_type = 'proforma'").get(req.params.id, req.tenant_id);
  if (!proforma) return res.status(404).json({ error: 'Proforma nenalezena' });
  const comp = db.prepare('SELECT * FROM company WHERE tenant_id = ?').get(req.tenant_id);
  const newNumber = generateInvoiceNumber(comp);
  const newVS = generateVariableSymbol(comp);
  db.prepare('UPDATE company SET invoice_counter = ? WHERE tenant_id = ?').run((comp?.invoice_counter || 1) + 1, req.tenant_id);
  const today = new Date().toISOString().slice(0, 10);
  const dueDays = comp?.default_due_days || 14;
  const due = new Date(); due.setDate(due.getDate() + dueDays);
  const result = db.prepare(`INSERT INTO invoices (tenant_id, invoice_number, type, client_id, issue_date, due_date, supply_date, payment_method, status, currency, subtotal, tax_rate, tax_amount, total, total_czk, note, created_by, variable_symbol, invoice_type, related_invoice_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(req.tenant_id, newNumber, proforma.type, proforma.client_id, today, due.toISOString().slice(0,10), today, proforma.payment_method, 'draft', proforma.currency, proforma.subtotal, proforma.tax_rate, proforma.tax_amount, proforma.total, proforma.total_czk, proforma.note, req.user.id, newVS, 'regular', req.params.id);
  const newId = result.lastInsertRowid;
  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(req.params.id);
  const ins = db.prepare('INSERT INTO invoice_items (invoice_id, description, quantity, unit, unit_price, total, tax_rate, tax_amount, total_with_tax) VALUES (?,?,?,?,?,?,?,?,?)');
  items.forEach(i => ins.run(newId, i.description, i.quantity, i.unit, i.unit_price, i.total, i.tax_rate, i.tax_amount, i.total_with_tax));
  db.prepare("UPDATE invoices SET status = 'paid', note = ? WHERE id = ? AND tenant_id = ?").run(`Převedeno na fakturu ${newNumber}`, req.params.id, req.tenant_id);
  res.json({ id: newId });
});

// ─── BULK STATUS CHANGE ─────────────────────────────────────
app.patch('/api/invoices/bulk-status', ...tenanted, authorize('admin', 'accountant', 'manager'), (req, res) => {
  const { ids, status } = req.body;
  if (!ids || !Array.isArray(ids) || !status) return res.status(400).json({ error: 'Chybí parametry' });
  const paid_date = status === 'paid' ? new Date().toISOString().slice(0, 10) : null;
  const stmt = paid_date
    ? db.prepare("UPDATE invoices SET status=?, paid_date=?, updated_at=datetime('now') WHERE id=? AND tenant_id=?")
    : db.prepare("UPDATE invoices SET status=?, updated_at=datetime('now') WHERE id=? AND tenant_id=?");
  ids.forEach(id => {
    if (paid_date) stmt.run(status, paid_date, id, req.tenant_id);
    else stmt.run(status, id, req.tenant_id);
  });
  res.json({ ok: true, count: ids.length });
});

// ─── PARTIAL PAYMENTS ───────────────────────────────────────
app.get('/api/invoices/:id/payments', ...tenanted, (req, res) => {
  const payments = db.prepare('SELECT p.*, u.full_name as created_by_name FROM invoice_payments p LEFT JOIN users u ON p.created_by = u.id WHERE p.invoice_id = ? ORDER BY p.date DESC').all(req.params.id);
  res.json(payments);
});

app.post('/api/invoices/:id/payments', ...tenanted, authorize('admin', 'accountant'), (req, res) => {
  const { amount, date, note } = req.body;
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id);
  if (!invoice) return res.status(404).json({ error: 'Faktura nenalezena' });
  db.prepare('INSERT INTO invoice_payments (invoice_id, amount, currency, date, note, created_by) VALUES (?,?,?,?,?,?)').run(req.params.id, amount, invoice.currency, date, note||null, req.user.id);
  const totalPaid = db.prepare('SELECT COALESCE(SUM(amount),0) as total FROM invoice_payments WHERE invoice_id = ?').get(req.params.id).total;
  db.prepare("UPDATE invoices SET paid_amount = ?, updated_at = datetime('now') WHERE id = ?").run(totalPaid, req.params.id);
  if (totalPaid >= invoice.total) {
    db.prepare("UPDATE invoices SET status = 'paid', paid_date = ?, updated_at = datetime('now') WHERE id = ?").run(date, req.params.id);
  }
  db.prepare("INSERT INTO audit_log (tenant_id, user_id, action, entity, entity_id, details) VALUES (?, ?, 'payment', 'invoice', ?, ?)").run(req.tenant_id, req.user.id, req.params.id, `Platba ${amount} ${invoice.currency}`);
  res.json({ ok: true, totalPaid });
});

// ─── RECURRING INVOICES ─────────────────────────────────────
app.get('/api/recurring', ...tenanted, (req, res) => {
  const rows = db.prepare(`SELECT r.*, c.name as client_name FROM recurring_invoices r LEFT JOIN clients c ON r.client_id = c.id WHERE r.tenant_id = ? ORDER BY r.next_date`).all(req.tenant_id);
  res.json(rows.map(r => ({ ...r, items: JSON.parse(r.items || '[]') })));
});

app.post('/api/recurring', ...tenanted, authorize('admin', 'accountant'), (req, res) => {
  const { client_id, currency, payment_method, note, items, interval, next_date, end_date } = req.body;
  const result = db.prepare('INSERT INTO recurring_invoices (tenant_id, client_id, currency, payment_method, note, items, interval, next_date, end_date, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)').run(req.tenant_id, client_id||null, currency||'CZK', payment_method||'bank_transfer', note||null, JSON.stringify(items||[]), interval||'monthly', next_date, end_date||null, req.user.id);
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/recurring/:id', ...tenanted, authorize('admin', 'accountant'), (req, res) => {
  const { client_id, currency, payment_method, note, items, interval, next_date, end_date, active } = req.body;
  db.prepare('UPDATE recurring_invoices SET client_id=?, currency=?, payment_method=?, note=?, items=?, interval=?, next_date=?, end_date=?, active=? WHERE id=? AND tenant_id=?').run(client_id||null, currency||'CZK', payment_method||'bank_transfer', note||null, JSON.stringify(items||[]), interval||'monthly', next_date, end_date||null, active??1, req.params.id, req.tenant_id);
  res.json({ ok: true });
});

app.delete('/api/recurring/:id', ...tenanted, authorize('admin', 'accountant'), (req, res) => {
  db.prepare('DELETE FROM recurring_invoices WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenant_id);
  res.json({ ok: true });
});

// ─── AGING REPORT ───────────────────────────────────────────
app.get('/api/reports/aging', ...tenanted, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const invoices = db.prepare(`SELECT i.id, i.invoice_number, i.due_date, i.total, i.total_czk, i.currency, i.status, i.paid_amount, c.name as client_name
    FROM invoices i LEFT JOIN clients c ON i.client_id = c.id
    WHERE i.tenant_id = ? AND i.status IN ('sent','overdue') AND i.type = 'issued'
    ORDER BY i.due_date`).all(req.tenant_id);
  const buckets = { current: [], '1_30': [], '31_60': [], '61_90': [], '90_plus': [] };
  invoices.forEach(inv => {
    const remaining = inv.total - (inv.paid_amount || 0);
    if (remaining <= 0) return;
    const daysPast = Math.floor((new Date(today) - new Date(inv.due_date)) / 86400000);
    const item = { ...inv, remaining, daysPast };
    if (daysPast <= 0) buckets.current.push(item);
    else if (daysPast <= 30) buckets['1_30'].push(item);
    else if (daysPast <= 60) buckets['31_60'].push(item);
    else if (daysPast <= 90) buckets['61_90'].push(item);
    else buckets['90_plus'].push(item);
  });
  const totals = {};
  Object.entries(buckets).forEach(([k, items]) => { totals[k] = items.reduce((s, i) => s + i.remaining, 0); });
  res.json({ buckets, totals });
});

// ─── ISDOC EXPORT ───────────────────────────────────────────
app.get('/api/invoices/:id/isdoc', ...tenanted, (req, res) => {
  const invoice = db.prepare('SELECT i.*, c.name as client_name, c.ico as client_ico, c.dic as client_dic, c.address as client_address, c.city as client_city, c.zip as client_zip, c.email as client_email FROM invoices i LEFT JOIN clients c ON i.client_id = c.id WHERE i.id = ? AND i.tenant_id = ?').get(req.params.id, req.tenant_id);
  if (!invoice) return res.status(404).json({ error: 'Faktura nenalezena' });
  const company = db.prepare('SELECT * FROM company WHERE tenant_id = ?').get(req.tenant_id);
  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(req.params.id);
  const co = company || {};
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="http://isdoc.cz/namespace/2013" version="6.0.1">
  <DocumentType>1</DocumentType>
  <ID>${invoice.invoice_number}</ID>
  <UUID>${invoice.id}</UUID>
  <IssueDate>${invoice.issue_date}</IssueDate>
  <TaxPointDate>${invoice.supply_date || invoice.issue_date}</TaxPointDate>
  <VATApplicable>${co.vat_payer ? 'true' : 'false'}</VATApplicable>
  <Note>${(invoice.note || '').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</Note>
  <LocalCurrencyCode>CZK</LocalCurrencyCode>
  <ForeignCurrencyCode>${invoice.currency}</ForeignCurrencyCode>
  <CurrRate>${invoice.total_czk && invoice.total ? (invoice.total_czk / invoice.total).toFixed(4) : '1.0000'}</CurrRate>
  <RefCurrRate>1</RefCurrRate>
  <AccountingSupplierParty>
    <Party>
      <PartyIdentification><ID>${co.ico || ''}</ID></PartyIdentification>
      <PartyName><Name>${(co.name || '').replace(/&/g,'&amp;')}</Name></PartyName>
      <PostalAddress><StreetName>${(co.address||'').replace(/&/g,'&amp;')}</StreetName><CityName>${co.city||''}</CityName><PostalZone>${co.zip||''}</PostalZone><Country><IdentificationCode>${co.country||'CZ'}</IdentificationCode></Country></PostalAddress>
    </Party>
  </AccountingSupplierParty>
  <AccountingCustomerParty>
    <Party>
      <PartyIdentification><ID>${invoice.client_ico || ''}</ID></PartyIdentification>
      <PartyName><Name>${(invoice.client_name || '').replace(/&/g,'&amp;')}</Name></PartyName>
      <PostalAddress><StreetName>${(invoice.client_address||'').replace(/&/g,'&amp;')}</StreetName><CityName>${invoice.client_city||''}</CityName><PostalZone>${invoice.client_zip||''}</PostalZone><Country><IdentificationCode>CZ</IdentificationCode></Country></PostalAddress>
    </Party>
  </AccountingCustomerParty>
  <InvoiceLines>
${items.map((it, i) => `    <InvoiceLine>
      <ID>${i+1}</ID>
      <InvoicedQuantity unitCode="${it.unit||'ks'}">${it.quantity}</InvoicedQuantity>
      <LineExtensionAmount>${it.total.toFixed(2)}</LineExtensionAmount>
      <LineExtensionAmountTaxInclusive>${(it.total_with_tax || it.total).toFixed(2)}</LineExtensionAmountTaxInclusive>
      <LineExtensionTaxAmount>${(it.tax_amount||0).toFixed(2)}</LineExtensionTaxAmount>
      <UnitPrice>${it.unit_price.toFixed(2)}</UnitPrice>
      <ClassifiedTaxCategory><Percent>${it.tax_rate||0}</Percent></ClassifiedTaxCategory>
      <Item><Description>${(it.description||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</Description></Item>
    </InvoiceLine>`).join('\n')}
  </InvoiceLines>
  <TaxTotal><TaxAmount>${invoice.tax_amount.toFixed(2)}</TaxAmount></TaxTotal>
  <LegalMonetaryTotal>
    <TaxExclusiveAmount>${invoice.subtotal.toFixed(2)}</TaxExclusiveAmount>
    <TaxInclusiveAmount>${invoice.total.toFixed(2)}</TaxInclusiveAmount>
    <PayableAmount>${invoice.total.toFixed(2)}</PayableAmount>
  </LegalMonetaryTotal>
  <PaymentMeans>
    <Payment><PaidAmount>${invoice.total.toFixed(2)}</PaidAmount><PaymentMeansCode>42</PaymentMeansCode><Details><PaymentDueDate>${invoice.due_date}</PaymentDueDate>${co.iban ? `<ID>${co.iban}</ID>` : ''}${invoice.variable_symbol ? `<VariableSymbol>${invoice.variable_symbol}</VariableSymbol>` : ''}</Details></Payment>
  </PaymentMeans>
</Invoice>`;
  res.set({ 'Content-Type': 'application/xml; charset=utf-8', 'Content-Disposition': `attachment; filename=${invoice.invoice_number}.isdoc` });
  res.send(xml);
});

// ─── PDF EXPORT ─────────────────────────────────────────────
app.get('/api/invoices/:id/pdf', ...tenanted, async (req, res) => {
  try {
    const invoice = db.prepare(`SELECT i.*, c.name as client_name, c.ico as client_ico, c.dic as client_dic,
      c.address as client_address, c.city as client_city, c.zip as client_zip, c.email as client_email
      FROM invoices i LEFT JOIN clients c ON i.client_id = c.id WHERE i.id = ? AND i.tenant_id = ?`).get(req.params.id, req.tenant_id);
    if (!invoice) return res.status(404).json({ error: 'Faktura nenalezena' });
    const company = db.prepare('SELECT * FROM company WHERE tenant_id = ?').get(req.tenant_id);
    const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(req.params.id);
    const pdfBuffer = await generateInvoicePDF(invoice, company, items);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename=${invoice.invoice_number}.pdf` });
    res.send(pdfBuffer);
  } catch (e) {
    console.error('PDF generation error:', e);
    res.status(500).json({ error: 'Chyba při generování PDF' });
  }
});

// ─── DB BACKUP ──────────────────────────────────────────────
app.get('/api/backup', ...tenanted, authorize('admin'), (req, res) => {
  const dbPath = path.join(__dirname, '..', 'erp.db');
  res.set({ 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename=erp-backup-${new Date().toISOString().slice(0,10)}.db` });
  res.sendFile(dbPath);
});

// ─── AUTO OVERDUE DETECTION ─────────────────────────────────
function checkOverdueInvoices() {
  const today = new Date().toISOString().slice(0, 10);
  const updated = db.prepare("UPDATE invoices SET status = 'overdue', updated_at = datetime('now') WHERE status = 'sent' AND due_date < ?").run(today);
  if (updated.changes > 0) console.log(`Auto-marked ${updated.changes} invoices as overdue`);
}
checkOverdueInvoices();
setInterval(checkOverdueInvoices, 60 * 60 * 1000); // Check every hour

// ─── RECURRING INVOICE PROCESSING ───────────────────────────
function processRecurringInvoices() {
  const today = new Date().toISOString().slice(0, 10);
  const due = db.prepare("SELECT r.*, c.name as client_name FROM recurring_invoices r LEFT JOIN clients c ON r.client_id = c.id WHERE r.active = 1 AND r.next_date <= ? AND (r.end_date IS NULL OR r.end_date >= ?)").all(today, today);
  due.forEach(rec => {
    const comp = db.prepare('SELECT * FROM company WHERE tenant_id = ?').get(rec.tenant_id);
    if (!comp || (!comp.bank_account && !comp.iban)) return;
    const items = JSON.parse(rec.items || '[]');
    const curr = db.prepare('SELECT rate_to_czk FROM currencies WHERE code = ?').get(rec.currency || 'CZK');
    const rate = curr ? curr.rate_to_czk : 1;
    let subtotal = 0, totalTax = 0;
    items.forEach(i => { const lt = (i.quantity||1)*(i.unit_price||0); const tx = lt*((i.tax_rate??0)/100); subtotal+=lt; totalTax+=tx; });
    const total = subtotal + totalTax;
    const newNumber = generateInvoiceNumber(comp);
    const newVS = generateVariableSymbol(comp);
    db.prepare('UPDATE company SET invoice_counter = ? WHERE tenant_id = ?').run((comp.invoice_counter||1)+1, rec.tenant_id);
    const dueDays = comp.default_due_days || 14;
    const dueDate = new Date(rec.next_date); dueDate.setDate(dueDate.getDate()+dueDays);
    const result = db.prepare(`INSERT INTO invoices (tenant_id, invoice_number, type, client_id, issue_date, due_date, supply_date, payment_method, status, currency, subtotal, tax_rate, tax_amount, total, total_czk, note, created_by, variable_symbol) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(rec.tenant_id, newNumber, 'issued', rec.client_id, rec.next_date, dueDate.toISOString().slice(0,10), rec.next_date, rec.payment_method, 'draft', rec.currency, subtotal, 0, totalTax, total, total*rate, rec.note, rec.created_by, newVS);
    const invoiceId = result.lastInsertRowid;
    const ins = db.prepare('INSERT INTO invoice_items (invoice_id, description, quantity, unit, unit_price, total, tax_rate, tax_amount, total_with_tax) VALUES (?,?,?,?,?,?,?,?,?)');
    items.forEach(i => { const lt=(i.quantity||1)*(i.unit_price||0); const tr=i.tax_rate??0; const tx=lt*(tr/100); ins.run(invoiceId,i.description,i.quantity||1,i.unit||'ks',i.unit_price||0,lt,tr,tx,lt+tx); });
    // Advance next_date
    const next = new Date(rec.next_date);
    if (rec.interval === 'weekly') next.setDate(next.getDate()+7);
    else if (rec.interval === 'monthly') next.setMonth(next.getMonth()+1);
    else if (rec.interval === 'quarterly') next.setMonth(next.getMonth()+3);
    else if (rec.interval === 'yearly') next.setFullYear(next.getFullYear()+1);
    db.prepare('UPDATE recurring_invoices SET next_date = ? WHERE id = ?').run(next.toISOString().slice(0,10), rec.id);
    console.log(`Generated recurring invoice ${newNumber} for tenant ${rec.tenant_id}`);
  });
}
processRecurringInvoices();
setInterval(processRecurringInvoices, 6 * 60 * 60 * 1000); // Every 6 hours

// GET-based login (bypasses POST issues with port forwarding)
app.get('/api/auth/get-login', (req, res) => {
  const { username, password } = req.query;
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Neplatné přihlašovací údaje' });
  }
  const token = generateToken(user);
  const { password: _, ...safeUser } = user;
  const tenant = user.tenant_id ? db.prepare('SELECT id, name, slug FROM tenants WHERE id = ? AND active = 1').get(user.tenant_id) : null;
  res.json({ token, user: safeUser, tenant });
});

// SPA fallback - serve index.html, inject auth from session cookie if present
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '..', 'client', 'dist', 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');

  // Check for session cookie
  const sessionToken = req.cookies?.erp_session;
  if (sessionToken) {
    try {
      const jwt = require('jsonwebtoken');
      const { SECRET } = require('./auth');
      const decoded = jwt.verify(sessionToken, SECRET);
      const user = db.prepare('SELECT id, username, email, full_name, first_name, last_name, role, active, signature, created_at, tenant_id FROM users WHERE id = ? AND active = 1').get(decoded.id);
      if (user) {
        const token = generateToken(user);
        const tenant = user.tenant_id ? db.prepare('SELECT id, name, slug FROM tenants WHERE id = ? AND active = 1').get(user.tenant_id) : null;
        const authScript = `<script>window.__AUTH__=${JSON.stringify({token, user, tenant}).replace(/</g,'\\u003c')};</script>`;
        return res.type('html').send(html.replace('</head>', authScript + '</head>'));
      }
    } catch (e) {
      // Invalid/expired cookie - clear it and serve plain HTML
      res.clearCookie('erp_session');
    }
  }

  res.type('html').send(html);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => console.log(`ERP server running on http://0.0.0.0:${PORT}`));
