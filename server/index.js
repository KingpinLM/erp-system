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
const notificationRoutes = require('./routes-notifications');
const getLoginPage = require('./login-page');

const cookieParser = require('cookie-parser');

const app = express();
app.disable('etag');
app.disable('x-powered-by');

// ─── CORS — restrict origins ─────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    // Allow same-origin requests (no Origin header)
    if (!origin) return cb(null, true);
    // Allow localhost for development
    if (origin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/)) return cb(null, true);
    // Allow configured origins via CORS_ORIGIN env var
    const allowed = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [];
    if (allowed.includes(origin)) return cb(null, true);
    cb(null, false);
  },
  credentials: true,
}));

app.use(cookieParser());

// ─── SECURITY HEADERS ────────────────────────────────────
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('X-XSS-Protection', '1; mode=block');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(express.json({ limit: '5mb' }));

// ─── RATE LIMITING (in-memory, per IP) ───────────────────
const loginAttempts = new Map();
function rateLimit(windowMs, maxAttempts) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const entry = loginAttempts.get(ip);
    if (entry) {
      // Clean expired entries
      entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);
      if (entry.timestamps.length >= maxAttempts) {
        return res.status(429).json({ error: 'Příliš mnoho pokusů. Zkuste to znovu za chvíli.' });
      }
      entry.timestamps.push(now);
    } else {
      loginAttempts.set(ip, { timestamps: [now] });
    }
    next();
  };
}
// Clean up old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts) {
    entry.timestamps = entry.timestamps.filter(t => now - t < 15 * 60 * 1000);
    if (entry.timestamps.length === 0) loginAttempts.delete(ip);
  }
}, 10 * 60 * 1000);

// ─── INPUT SANITIZATION ──────────────────────────────────
function sanitize(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  const clean = {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string') clean[key] = sanitize(val);
    else if (typeof val === 'object' && val !== null) clean[key] = sanitizeObject(val);
    else clean[key] = val;
  }
  return clean;
}
// Sanitize all incoming JSON bodies (except password fields)
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    const pw = req.body.password; // Preserve password as-is
    req.body = sanitizeObject(req.body);
    if (pw !== undefined) req.body.password = pw;
  }
  next();
});

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
app.use(notificationRoutes);

// ─── SUPERADMIN AUTH ────────────────────────────────────────
app.post('/api/superadmin/login', rateLimit(15 * 60 * 1000, 10), (req, res) => {
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
app.post('/api/auth/form-login', rateLimit(15 * 60 * 1000, 10), express.urlencoded({ extended: false }), (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.redirect('/login?error=1');
  }
  if (!user.active) {
    return res.redirect('/login?error=deactivated');
  }
  const token = generateToken(user);
  res.cookie('erp_session', token, { httpOnly: true, maxAge: 8*60*60*1000, sameSite: 'lax', path: '/' });
  res.redirect('/');
});

// ─── AUTH (login without tenant slug — globally unique usernames) ──
app.post('/api/auth/login', rateLimit(15 * 60 * 1000, 10), (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Neplatné přihlašovací údaje' });
  }
  if (!user.active) {
    return res.status(403).json({ error: 'Váš účet byl deaktivován. Kontaktujte administrátora.' });
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

// ─── SYSTEM ROLE OVERRIDES ──────────────────────────────────
app.get('/api/role-overrides', ...tenanted, authorize('admin'), (req, res) => {
  const comp = db.prepare('SELECT role_overrides FROM company WHERE tenant_id = ?').get(req.tenant_id);
  res.json(JSON.parse((comp && comp.role_overrides) || '{}'));
});

app.put('/api/role-overrides', ...tenanted, authorize('admin'), (req, res) => {
  const { overrides } = req.body;
  db.prepare('UPDATE company SET role_overrides = ? WHERE tenant_id = ?').run(JSON.stringify(overrides || {}), req.tenant_id);
  res.json({ ok: true });
});

// ─── ROLES & PERMISSIONS (admin only) ──────────────────────
// Get all custom roles for tenant
app.get('/api/roles', ...tenanted, authorize('admin'), (req, res) => {
  const roles = db.prepare('SELECT * FROM custom_roles WHERE tenant_id = ? ORDER BY name').all(req.tenant_id);
  res.json(roles.map(r => ({ ...r, permissions: JSON.parse(r.permissions || '[]') })));
});

// Create custom role
app.post('/api/roles', ...tenanted, authorize('admin'), (req, res) => {
  const { name, description, permissions, base_role } = req.body;
  if (!name) return res.status(400).json({ error: 'Název role je povinný' });
  const existing = db.prepare('SELECT id FROM custom_roles WHERE tenant_id = ? AND name = ?').get(req.tenant_id, name);
  if (existing) return res.status(400).json({ error: 'Role s tímto názvem již existuje' });
  const result = db.prepare('INSERT INTO custom_roles (tenant_id, name, description, permissions, base_role) VALUES (?,?,?,?,?)').run(
    req.tenant_id, name, description || '', JSON.stringify(permissions || []), base_role || 'viewer'
  );
  res.json({ id: result.lastInsertRowid, name, description, permissions: permissions || [], base_role: base_role || 'viewer' });
});

// Update custom role
app.put('/api/roles/:id', ...tenanted, authorize('admin'), (req, res) => {
  const { name, description, permissions, base_role } = req.body;
  db.prepare('UPDATE custom_roles SET name=?, description=?, permissions=?, base_role=? WHERE id=? AND tenant_id=?').run(
    name, description || '', JSON.stringify(permissions || []), base_role || 'viewer', req.params.id, req.tenant_id
  );
  res.json({ ok: true });
});

// Delete custom role
app.delete('/api/roles/:id', ...tenanted, authorize('admin'), (req, res) => {
  db.prepare('DELETE FROM custom_roles WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenant_id);
  res.json({ ok: true });
});

// Update user role (admin assigning permissions)
app.patch('/api/users/:id/role', ...tenanted, authorize('admin'), (req, res) => {
  const { role } = req.body;
  if (!['admin', 'accountant', 'manager', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Neplatná role' });
  }
  db.prepare("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?").run(role, req.params.id, req.tenant_id);
  db.prepare("INSERT INTO audit_log (tenant_id, user_id, action, entity, entity_id, details) VALUES (?,?,'role_change','user',?,?)").run(
    req.tenant_id, req.user.id, req.params.id, `Role změněna na ${role}`
  );
  res.json({ ok: true });
});

// ─── USER GROUPS (admin only) ────────────────────────────
app.get('/api/user-groups', ...tenanted, authorize('admin'), (req, res) => {
  const groups = db.prepare('SELECT * FROM user_groups WHERE tenant_id = ? ORDER BY name').all(req.tenant_id);
  const members = db.prepare(`
    SELECT ugm.group_id, ugm.user_id, u.full_name, u.username, u.role
    FROM user_group_members ugm
    JOIN users u ON u.id = ugm.user_id
    WHERE u.tenant_id = ?
  `).all(req.tenant_id);
  res.json(groups.map(g => ({
    ...g,
    permissions: JSON.parse(g.permissions || '[]'),
    members: members.filter(m => m.group_id === g.id),
  })));
});

app.post('/api/user-groups', ...tenanted, authorize('admin'), (req, res) => {
  const { name, description, permissions, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Název skupiny je povinný' });
  const existing = db.prepare('SELECT id FROM user_groups WHERE tenant_id = ? AND name = ?').get(req.tenant_id, name);
  if (existing) return res.status(400).json({ error: 'Skupina s tímto názvem již existuje' });
  const result = db.prepare('INSERT INTO user_groups (tenant_id, name, description, permissions, color) VALUES (?,?,?,?,?)').run(
    req.tenant_id, name, description || '', JSON.stringify(permissions || []), color || '#6366f1'
  );
  res.json({ id: result.lastInsertRowid, name, description, permissions: permissions || [], color: color || '#6366f1', members: [] });
});

app.put('/api/user-groups/:id', ...tenanted, authorize('admin'), (req, res) => {
  const { name, description, permissions, color } = req.body;
  db.prepare('UPDATE user_groups SET name=?, description=?, permissions=?, color=? WHERE id=? AND tenant_id=?').run(
    name, description || '', JSON.stringify(permissions || []), color || '#6366f1', req.params.id, req.tenant_id
  );
  res.json({ ok: true });
});

app.delete('/api/user-groups/:id', ...tenanted, authorize('admin'), (req, res) => {
  db.prepare('DELETE FROM user_groups WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenant_id);
  res.json({ ok: true });
});

app.post('/api/user-groups/:id/members', ...tenanted, authorize('admin'), (req, res) => {
  const { user_ids } = req.body;
  const del = db.prepare('DELETE FROM user_group_members WHERE group_id = ?');
  const ins = db.prepare('INSERT OR IGNORE INTO user_group_members (group_id, user_id) VALUES (?, ?)');
  const txn = db.transaction(() => {
    del.run(req.params.id);
    (user_ids || []).forEach(uid => ins.run(req.params.id, uid));
  });
  txn();
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

  // Quarterly data (last 2 years) for quarter view
  const qYear = new Date().getFullYear();
  const quarterlyIssued = db.prepare(`
    SELECT strftime('%Y', issue_date) as year,
      CASE WHEN CAST(strftime('%m', issue_date) AS INTEGER) <= 3 THEN 'Q1'
           WHEN CAST(strftime('%m', issue_date) AS INTEGER) <= 6 THEN 'Q2'
           WHEN CAST(strftime('%m', issue_date) AS INTEGER) <= 9 THEN 'Q3'
           ELSE 'Q4' END as quarter,
      SUM(total_czk) as total, SUM(tax_amount) as tax
    FROM invoices WHERE type='issued' AND tenant_id=?
      AND issue_date >= '${qYear - 1}-01-01'
    GROUP BY year, quarter ORDER BY year, quarter
  `).all(tid);

  const quarterlyExpenses = db.prepare(`
    SELECT strftime('%Y', date) as year,
      CASE WHEN CAST(strftime('%m', date) AS INTEGER) <= 3 THEN 'Q1'
           WHEN CAST(strftime('%m', date) AS INTEGER) <= 6 THEN 'Q2'
           WHEN CAST(strftime('%m', date) AS INTEGER) <= 9 THEN 'Q3'
           ELSE 'Q4' END as quarter,
      SUM(amount) as total
    FROM evidence WHERE type='expense' AND tenant_id=?
      AND date >= '${qYear - 1}-01-01'
    GROUP BY year, quarter ORDER BY year, quarter
  `).all(tid);

  // Yearly data (all history) for year view
  const yearlyIssued = db.prepare(`
    SELECT strftime('%Y', issue_date) as year, SUM(total_czk) as total, SUM(tax_amount) as tax
    FROM invoices WHERE type='issued' AND tenant_id=?
    GROUP BY year ORDER BY year
  `).all(tid);

  const yearlyExpenses = db.prepare(`
    SELECT strftime('%Y', date) as year, SUM(amount) as total
    FROM evidence WHERE type='expense' AND tenant_id=?
    GROUP BY year ORDER BY year
  `).all(tid);

  // Client performance for selected period
  const clientPerformance = db.prepare(`
    SELECT c.id, c.name, c.ico, c.dic, c.email, c.phone, c.city, c.country,
      COUNT(CASE WHEN i.type='issued' THEN 1 END) as issued_count,
      COUNT(CASE WHEN i.type='received' THEN 1 END) as received_count,
      COALESCE(SUM(CASE WHEN i.type='issued' THEN i.total_czk ELSE 0 END), 0) as issued_total,
      COALESCE(SUM(CASE WHEN i.type='received' THEN i.total_czk ELSE 0 END), 0) as received_total,
      COALESCE(SUM(CASE WHEN i.type='issued' AND i.status='paid' THEN i.total_czk ELSE 0 END), 0) as paid_total,
      COALESCE(SUM(CASE WHEN i.type='issued' AND i.status IN ('sent','overdue') THEN i.total_czk ELSE 0 END), 0) as unpaid_total,
      COUNT(CASE WHEN i.status='overdue' THEN 1 END) as overdue_count,
      COUNT(CASE WHEN i.status='paid' THEN 1 END) as paid_count
    FROM clients c
    JOIN invoices i ON i.client_id = c.id AND i.tenant_id = c.tenant_id
    WHERE c.tenant_id = ?${dateFilter('i.issue_date')}
    GROUP BY c.id
    ORDER BY issued_total DESC
  `).all(tid, ...dateParams());

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
    monthlyIssued, monthlyExpenses, quarterlyIssued, quarterlyExpenses, yearlyIssued, yearlyExpenses, pendingItems, chartYear, clientPerformance
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
  if (!name || !name.trim()) return res.status(400).json({ error: 'Název klienta je povinný' });
  const existingName = db.prepare('SELECT id, name FROM clients WHERE tenant_id = ? AND name = ?').get(req.tenant_id, name.trim());
  if (existingName) return res.status(400).json({ error: `Klient s názvem "${name}" již existuje.` });
  if (ico) {
    const existingIco = db.prepare('SELECT id, name FROM clients WHERE tenant_id = ? AND ico = ?').get(req.tenant_id, ico);
    if (existingIco) return res.status(400).json({ error: `Klient s IČO "${ico}" již existuje (${existingIco.name}).` });
  }
  const result = db.prepare('INSERT INTO clients (tenant_id, name, ico, dic, email, phone, address, city, zip, country) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(req.tenant_id, name.trim(), ico || null, dic || null, email || null, phone || null, address || null, city || null, zip || null, country || 'CZ');
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/clients/:id', ...tenanted, authorize('admin', 'accountant', 'manager'), (req, res) => {
  const { name, ico, dic, email, phone, address, city, zip, country } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Název klienta je povinný' });
  const existingName = db.prepare('SELECT id, name FROM clients WHERE tenant_id = ? AND name = ? AND id != ?').get(req.tenant_id, name.trim(), req.params.id);
  if (existingName) return res.status(400).json({ error: `Klient s názvem "${name}" již existuje.` });
  if (ico) {
    const existingIco = db.prepare('SELECT id, name FROM clients WHERE tenant_id = ? AND ico = ? AND id != ?').get(req.tenant_id, ico, req.params.id);
    if (existingIco) return res.status(400).json({ error: `Klient s IČO "${ico}" již existuje (${existingIco.name}).` });
  }
  db.prepare('UPDATE clients SET name=?, ico=?, dic=?, email=?, phone=?, address=?, city=?, zip=?, country=? WHERE id=? AND tenant_id=?')
    .run(name.trim(), ico, dic, email, phone, address, city, zip, country, req.params.id, req.tenant_id);
  res.json({ ok: true });
});

// Duplicate check for clients (used by frontend for live warnings)
app.get('/api/clients/check-duplicate', ...tenanted, (req, res) => {
  const { name, ico, dic, email, exclude_id } = req.query;
  const matches = [];
  if (name && name.trim()) {
    const byName = db.prepare('SELECT id, name, ico FROM clients WHERE tenant_id = ? AND name = ?' + (exclude_id ? ' AND id != ?' : ''))
      .all(...[req.tenant_id, name.trim(), ...(exclude_id ? [exclude_id] : [])]);
    byName.forEach(c => matches.push({ ...c, match: 'name' }));
  }
  if (ico && ico.trim()) {
    const byIco = db.prepare('SELECT id, name, ico FROM clients WHERE tenant_id = ? AND ico = ?' + (exclude_id ? ' AND id != ?' : ''))
      .all(...[req.tenant_id, ico.trim(), ...(exclude_id ? [exclude_id] : [])]);
    byIco.forEach(c => { if (!matches.find(m => m.id === c.id)) matches.push({ ...c, match: 'ico' }); });
  }
  if (dic && dic.trim()) {
    const byDic = db.prepare('SELECT id, name, ico FROM clients WHERE tenant_id = ? AND dic = ?' + (exclude_id ? ' AND id != ?' : ''))
      .all(...[req.tenant_id, dic.trim(), ...(exclude_id ? [exclude_id] : [])]);
    byDic.forEach(c => { if (!matches.find(m => m.id === c.id)) matches.push({ ...c, match: 'dic' }); });
  }
  if (email && email.trim()) {
    const byEmail = db.prepare('SELECT id, name, ico FROM clients WHERE tenant_id = ? AND email = ?' + (exclude_id ? ' AND id != ?' : ''))
      .all(...[req.tenant_id, email.trim(), ...(exclude_id ? [exclude_id] : [])]);
    byEmail.forEach(c => { if (!matches.find(m => m.id === c.id)) matches.push({ ...c, match: 'email' }); });
  }
  res.json(matches);
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

app.delete('/api/invoices/:id', ...tenanted, authorize('admin', 'manager'), (req, res) => {
  db.prepare('DELETE FROM invoices WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenant_id);
  db.prepare("INSERT INTO audit_log (tenant_id, user_id, action, entity, entity_id, details) VALUES (?, ?, 'delete', 'invoice', ?, 'Faktura smazána')").run(req.tenant_id, req.user.id, req.params.id);
  res.json({ ok: true });
});

// ─── EVIDENCE ────────────────────────────────────────────────
app.get('/api/evidence', ...tenanted, (req, res) => {
  const { type, category, from, to } = req.query;
  let sql = 'SELECT e.*, u.full_name as created_by_name FROM evidence e LEFT JOIN users u ON e.created_by = u.id WHERE e.tenant_id = ?';
  const params = [req.tenant_id];
  if (type) { sql += ' AND e.type = ?'; params.push(type); }
  if (category) { sql += ' AND e.category = ?'; params.push(category); }
  if (from) { sql += ' AND e.date >= ?'; params.push(from); }
  if (to) { sql += ' AND e.date <= ?'; params.push(to); }
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
    // Get bank account matching invoice currency (falls back to company fields)
    const bankAccount = db.prepare('SELECT * FROM bank_accounts WHERE tenant_id = ? AND currency = ? AND active = 1').get(req.tenant_id, invoice.currency || 'CZK');
    if (bankAccount) {
      company.bank_account = bankAccount.account_number;
      company.iban = bankAccount.iban;
    }
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

// ─── CHATBOT AI ENGINE ────────────────────────────────────────
// Czech stemming — strip common suffixes for fuzzy matching
// Strip Czech diacritics: á→a, č→c, ď→d, é→e, ě→e, í→i, ň→n, ó→o, ř→r, š→s, ť→t, ú→u, ů→u, ý→y, ž→z
const diacMap = { 'á':'a','č':'c','ď':'d','é':'e','ě':'e','í':'i','ň':'n','ó':'o','ř':'r','š':'s','ť':'t','ú':'u','ů':'u','ý':'y','ž':'z','Á':'A','Č':'C','Ď':'D','É':'E','Ě':'E','Í':'I','Ň':'N','Ó':'O','Ř':'R','Š':'S','Ť':'T','Ú':'U','Ů':'U','Ý':'Y','Ž':'Z' };
function noDiac(str) { return str.replace(/[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/g, c => diacMap[c] || c); }

function czStem(word) {
  if (word.length < 5) return word;
  let w = word;
  w = w.replace(/(ování|ností|ovými|ovým|ových|ovani|nosti|ovymi|ovym|ovych)$/i, '')
    .replace(/(ová|ové|ový|ově|ova|ove|ovy)$/i, '')
    .replace(/(nost|nosti|nostem)$/i, '')
    .replace(/(ení|ání|ění|eni|ani)$/i, '')
    .replace(/(ách|ata|aty|ími|emi|ach|imi)$/i, '')
    .replace(/(ami|ích|ech|ům|ich|um)$/i, '')
    .replace(/(kám|kách|kami|ků|kam|kach|ku)$/i, '')
    .replace(/(ných|ným|nými|nych|nym|nymi)$/i, '')
    .replace(/(ní|ně|ný|ná|né|ni|ne|ny|na)$/i, '')
    .replace(/(ky|ce|ku|ek|ka|ko)$/i, '')
    .replace(/(uje|ují|uji)$/i, '')
    .replace(/(ovat|ít|ět|out|it|et)$/i, '')
    .replace(/(ovi|ou|em)$/i, '');
  // Ensure stem is at least 3 chars to avoid false positives
  return w.length >= 3 ? w : word;
}

// Dynamic AI queries — real-time system data analysis
function getDynamicAnswer(q, tenantId, userId, isEn) {
  const qNorm = noDiac(q); // diacritics-free version
  const stems = q.split(/\s+/).map(w => czStem(noDiac(w).replace(/[?.!,;:]/g, '')));
  const has = (...words) => words.some(w => {
    const wNorm = noDiac(w);
    if (q.includes(w) || qNorm.includes(wNorm)) return true;
    // Skip stem matching for multi-word phrases — only substring match
    if (w.includes(' ')) return false;
    const ws = czStem(wNorm);
    if (ws.length < 3) return false;
    return stems.some(s => s.length >= 3 && (s === ws || (s.length >= 4 && ws.length >= 4 && (s.startsWith(ws) || ws.startsWith(s)))));
  });

  // === REAL-TIME DATA QUERIES ===

  // Draft invoices (must come before general invoice count)
  if (has('koncept', 'draft', 'rozpracovan', 'nedokončen', 'rozepsán')) {
    const drafts = db.prepare(`SELECT i.invoice_number, i.total, i.currency, c.name as client_name FROM invoices i LEFT JOIN clients c ON i.client_id = c.id WHERE i.tenant_id = ? AND i.status = 'draft' ORDER BY i.created_at DESC LIMIT 5`).all(tenantId);
    if (drafts.length === 0) return { answer: isEn ? 'You have no draft invoices.' : 'Nemáte žádné rozpracované faktury.', link: '/invoices' };
    const list = drafts.map(d => `• ${d.invoice_number} — ${d.client_name || '?'} (${Math.round(d.total)} ${d.currency})`).join('\n');
    return {
      answer: isEn ? `Draft invoices:\n${list}` : `Rozpracované faktury:\n${list}`,
      link: '/invoices'
    };
  }

  // Evidence / expenses summary (before invoice count — 'doklad' can match both)
  if (has('kolik', 'počet', 'celk') && (has('evidence', 'evidenc') || (has('výdaj', 'náklad', 'expense') && !has('faktur', 'invoice')))) {
    const stats = db.prepare(`SELECT type, COUNT(*) as c, SUM(amount) as total FROM evidence WHERE tenant_id = ? GROUP BY type`).all(tenantId);
    const fmt = (n) => Math.round(n || 0).toLocaleString('cs-CZ');
    const lines = stats.map(s => {
      const labels = { income: 'příjmy', expense: 'výdaje', asset: 'majetek', document: 'dokumenty' };
      return `• ${isEn ? s.type : labels[s.type] || s.type}: ${s.c}x (${fmt(s.total)} Kč)`;
    }).join('\n');
    return {
      answer: isEn ? `Evidence summary:\n${lines}` : `Přehled evidence:\n${lines}`,
      link: '/evidence'
    };
  }

  // "Kde najdu opakované faktury?" — recurring invoices navigation (must come before general invoice handlers)
  if (has('kde', 'where', 'najdu', 'najít') && has('opakovan', 'recurring', 'automatick', 'pravidelné', 'pravidelne')) {
    return {
      answer: isEn
        ? 'Recurring invoices are in Finance → Recurring. Create an invoice template with interval (weekly/monthly/quarterly/yearly) and the system generates them automatically.'
        : 'Opakované faktury najdete v sekci Finance → Opakované. Vytvořte šablonu faktury s intervalem (týdně/měsíčně/čtvrtletně/ročně) a systém je bude automaticky generovat.',
      link: '/recurring'
    };
  }

  // "Kde najdu evidenci?" — evidence navigation (must come before invoice count to avoid false KB match)
  if (has('kde', 'where', 'najdu', 'najít') && has('evidenc', 'evidence') && !has('faktur', 'invoice')) {
    return {
      answer: isEn
        ? 'Evidence is in Finance → Evidence. You can record received documents, income, expenses, assets and documents there.'
        : 'Evidenci najdete v sekci Finance → Evidence. Můžete zde zaznamenávat přijaté doklady, příjmy, výdaje, majetek a dokumenty.',
      link: '/evidence'
    };
  }

  // Paid invoices summary (must come before general invoice count)
  if (has('zaplacen', 'uhrazen', 'paid') && has('faktur', 'invoice', 'celk', 'kolik', 'how many', 'count')) {
    const paid = db.prepare(`SELECT COUNT(*) as c, COALESCE(SUM(total_czk),0) as total FROM invoices WHERE tenant_id = ? AND status = 'paid'`).get(tenantId);
    const fmt = (n) => Math.round(n || 0).toLocaleString('cs-CZ');
    return {
      answer: isEn ? `You have ${paid.c} paid invoices totaling ${fmt(paid.total)} CZK.` : `Máte ${paid.c} zaplacených faktur v celkové hodnotě ${fmt(paid.total)} Kč.`,
      link: '/invoices'
    };
  }

  // "How many invoices?" / "Kolik mám faktur?"
  if (has('kolik', 'počet', 'count', 'how many', 'celkem') && has('faktur', 'invoice', 'faktura', 'doklad')) {
    const stats = db.prepare(`SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN status='draft' THEN 1 ELSE 0 END),0) as drafts, COALESCE(SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END),0) as sent, COALESCE(SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END),0) as paid, COALESCE(SUM(CASE WHEN status='overdue' THEN 1 ELSE 0 END),0) as overdue FROM invoices WHERE tenant_id = ?`).get(tenantId);
    return {
      answer: isEn
        ? `You have ${stats.total} invoices in total: ${stats.drafts} drafts, ${stats.sent} sent, ${stats.paid} paid, ${stats.overdue} overdue.`
        : `Máte celkem ${stats.total} faktur: ${stats.drafts} konceptů, ${stats.sent} odeslaných, ${stats.paid} zaplacených, ${stats.overdue} po splatnosti.`,
      link: '/invoices'
    };
  }

  // "How many clients?" / "Kolik mám klientů?"
  if (has('kolik', 'počet', 'count', 'how many') && has('klient', 'client', 'zákazník', 'odběratel', 'customer')) {
    const cnt = db.prepare('SELECT COUNT(*) as c FROM clients WHERE tenant_id = ?').get(tenantId).c;
    return {
      answer: isEn ? `You have ${cnt} clients registered.` : `Máte registrováno ${cnt} klientů.`,
      link: '/clients'
    };
  }

  // Revenue / total / obrat
  if (has('obrat', 'revenue', 'tržby') || (has('příjem', 'celkov') && has('faktur', 'invoice', 'měsíc', 'rok', 'year', 'month', 'total'))) {
    const totals = db.prepare(`SELECT COALESCE(SUM(total_czk),0) as total_all, COALESCE(SUM(CASE WHEN status='paid' THEN total_czk ELSE 0 END),0) as paid FROM invoices WHERE tenant_id = ? AND type='issued'`).get(tenantId);
    const fmt = (n) => Math.round(n || 0).toLocaleString('cs-CZ');
    return {
      answer: isEn
        ? `Total issued invoices: ${fmt(totals.total_all)} CZK. Of which paid: ${fmt(totals.paid)} CZK.`
        : `Celková hodnota vydaných faktur: ${fmt(totals.total_all)} Kč. Z toho uhrazeno: ${fmt(totals.paid)} Kč.`,
      link: '/'
    };
  }

  // Overdue / po splatnosti / nezaplacené
  if (has('po splatnosti', 'overdue', 'nezaplacen', 'dluh', 'pohledávk', 'neuhrazen', 'nesplacen')) {
    const overdue = db.prepare(`SELECT i.invoice_number, i.total, i.currency, c.name as client_name, i.due_date FROM invoices i LEFT JOIN clients c ON i.client_id = c.id WHERE i.tenant_id = ? AND i.status = 'overdue' ORDER BY i.due_date ASC LIMIT 5`).all(tenantId);
    if (overdue.length === 0) {
      return { answer: isEn ? 'Great news! You have no overdue invoices.' : 'Skvělá zpráva! Nemáte žádné faktury po splatnosti.', link: '/invoices' };
    }
    const list = overdue.map(o => `• ${o.invoice_number} — ${o.client_name || '?'} (${Math.round(o.total)} ${o.currency})`).join('\n');
    return {
      answer: isEn
        ? `You have ${overdue.length} overdue invoice(s):\n${list}`
        : `Máte ${overdue.length} faktur po splatnosti:\n${list}`,
      link: '/invoices'
    };
  }

  // Unpaid / k zaplacení
  if (has('zaplatit', 'uhradit', 'k úhradě', 'unpaid', 'nezaplacen', 'čeká na platbu', 'splatnost', 'owe', 'dlužím')) {
    const unpaid = db.prepare(`SELECT COUNT(*) as c, COALESCE(SUM(total_czk),0) as total FROM invoices WHERE tenant_id = ? AND status IN ('sent','overdue') AND type='issued'`).get(tenantId);
    const fmt = (n) => Math.round(n || 0).toLocaleString('cs-CZ');
    return {
      answer: isEn
        ? `You have ${unpaid.c} unpaid invoices totaling ${fmt(unpaid.total)} CZK.`
        : `Máte ${unpaid.c} nezaplacených faktur v celkové hodnotě ${fmt(unpaid.total)} Kč.`,
      link: '/invoices'
    };
  }

  // Company info / údaje firmy
  if (has('údaje', 'info', 'ičo', 'dič', 'information') && has('firm', 'společnost', 'company', 'naše')) {
    const comp = db.prepare('SELECT * FROM company WHERE tenant_id = ?').get(tenantId);
    if (comp) {
      return {
        answer: isEn
          ? `Company: ${comp.name}, ID: ${comp.ico || '—'}, VAT: ${comp.dic || '—'}, Bank: ${comp.bank_account ? comp.bank_account + '/' + (comp.bank_code || '') : '—'}, IBAN: ${comp.iban || '—'}`
          : `Společnost: ${comp.name}, IČO: ${comp.ico || '—'}, DIČ: ${comp.dic || '—'}, Účet: ${comp.bank_account ? comp.bank_account + '/' + (comp.bank_code || '') : '—'}, IBAN: ${comp.iban || '—'}`,
        link: '/company'
      };
    }
  }

  // Current user info / můj účet
  if (has('kdo jsem', 'who am i', 'můj účet', 'můj profil', 'my account', 'my profile') || (has('můj', 'my') && has('role', 'oprávnění', 'jméno', 'email'))) {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    const roleLabels = { admin: 'Administrátor', accountant: 'Účetní', manager: 'Manažer', viewer: 'Náhled' };
    if (user) {
      return {
        answer: isEn
          ? `You are logged in as ${user.full_name} (${user.username}), role: ${user.role}, email: ${user.email}.`
          : `Jste přihlášen/a jako ${user.full_name} (${user.username}), role: ${roleLabels[user.role] || user.role}, email: ${user.email}.`,
        link: '/profile'
      };
    }
  }

  // How many users?
  if (has('kolik', 'počet', 'count', 'how many') && has('uživatel', 'user', 'lidí', 'zaměstnanc')) {
    const cnt = db.prepare('SELECT COUNT(*) as c FROM users WHERE tenant_id = ? AND active = 1').get(tenantId).c;
    return {
      answer: isEn ? `There are ${cnt} active users in the system.` : `V systému je ${cnt} aktivních uživatelů.`,
      link: '/users'
    };
  }

  // Recent invoices
  if (has('poslední', 'nedávn', 'recent', 'latest', 'nové') && has('faktur', 'invoice')) {
    const recent = db.prepare(`SELECT i.invoice_number, i.total, i.currency, i.status, c.name as client_name FROM invoices i LEFT JOIN clients c ON i.client_id = c.id WHERE i.tenant_id = ? ORDER BY i.created_at DESC LIMIT 5`).all(tenantId);
    if (recent.length === 0) return { answer: isEn ? 'No invoices found.' : 'Žádné faktury nenalezeny.', link: '/invoices' };
    const statusLabels = { draft: 'koncept', sent: 'odeslaná', paid: 'zaplacená', overdue: 'po splatnosti', cancelled: 'stornovaná' };
    const list = recent.map(r => `• ${r.invoice_number} — ${r.client_name || '?'} — ${Math.round(r.total)} ${r.currency} (${isEn ? r.status : statusLabels[r.status] || r.status})`).join('\n');
    return {
      answer: isEn ? `Last 5 invoices:\n${list}` : `Posledních 5 faktur:\n${list}`,
      link: '/invoices'
    };
  }

  // Today's date / current date
  if (has('datum', 'dnes', 'today', 'jaký je den') || (q.includes('kolikátého') || q.includes('kolikateho'))) {
    const today = new Date().toLocaleDateString(isEn ? 'en-GB' : 'cs-CZ');
    return {
      answer: isEn ? `Today's date is ${today}.` : `Dnešní datum je ${today}.`,
      link: null
    };
  }

  // Currencies / exchange rates
  if ((has('kurz', 'rate', 'exchange', 'převod') || (has('kolik', 'stojí', 'cena') && has('euro', 'eura', 'eur', 'dolar', 'usd', 'gbp'))) && has('euro', 'eura', 'eur', 'dolar', 'dolaru', 'usd', 'gbp', 'měn', 'librami', 'libra', 'libr')) {
    const rates = db.prepare('SELECT code, name, rate_to_czk FROM currencies ORDER BY code').all();
    const list = rates.map(r => `• ${r.code} (${r.name}): ${r.rate_to_czk.toFixed(2)} Kč`).join('\n');
    return {
      answer: isEn ? `Current exchange rates:\n${list}` : `Aktuální kurzy:\n${list}`,
      link: '/currencies'
    };
  }

  // Top clients by revenue
  if (has('top', 'nejlepší', 'nejvíce', 'největší', 'best') && has('klient', 'client', 'zákazník', 'odběratel', 'customer')) {
    const top = db.prepare(`SELECT c.name, COUNT(i.id) as cnt, COALESCE(SUM(i.total_czk),0) as total FROM clients c LEFT JOIN invoices i ON i.client_id = c.id AND i.tenant_id = c.tenant_id WHERE c.tenant_id = ? GROUP BY c.id ORDER BY total DESC LIMIT 5`).all(tenantId);
    if (top.length === 0) return { answer: isEn ? 'No clients found.' : 'Žádní klienti nenalezeni.', link: '/clients' };
    const fmt = (n) => Math.round(n || 0).toLocaleString('cs-CZ');
    const list = top.map(t => `• ${t.name} — ${t.cnt} faktur, ${fmt(t.total)} Kč`).join('\n');
    return {
      answer: isEn ? `Top 5 clients by revenue:\n${list}` : `Top 5 klientů podle obratu:\n${list}`,
      link: '/clients'
    };
  }

  // Largest invoice
  if (has('největší', 'highest', 'maximum', 'max', 'nejdražší', 'biggest') && has('faktur', 'invoice')) {
    const biggest = db.prepare(`SELECT i.invoice_number, i.total, i.currency, i.status, c.name as client_name FROM invoices i LEFT JOIN clients c ON i.client_id = c.id WHERE i.tenant_id = ? ORDER BY i.total_czk DESC LIMIT 1`).get(tenantId);
    if (!biggest) return { answer: isEn ? 'No invoices found.' : 'Žádné faktury nenalezeny.', link: '/invoices' };
    const statusLabels = { draft: 'koncept', sent: 'odeslaná', paid: 'zaplacená', overdue: 'po splatnosti', cancelled: 'stornovaná' };
    return {
      answer: isEn
        ? `Largest invoice: ${biggest.invoice_number} — ${biggest.client_name || '?'} — ${Math.round(biggest.total)} ${biggest.currency} (${biggest.status})`
        : `Největší faktura: ${biggest.invoice_number} — ${biggest.client_name || '?'} — ${Math.round(biggest.total)} ${biggest.currency} (${statusLabels[biggest.status] || biggest.status})`,
      link: '/invoices'
    };
  }

  // Monthly invoices / this month
  if (has('tento měsíc', 'this month', 'měsíční', 'aktuální měsíc', 'letos') && has('faktur', 'invoice', 'příjem', 'obrat')) {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const stats = db.prepare(`SELECT COUNT(*) as c, COALESCE(SUM(total_czk),0) as total FROM invoices WHERE tenant_id = ? AND issue_date LIKE ?`).get(tenantId, yearMonth + '%');
    const fmt = (n) => Math.round(n || 0).toLocaleString('cs-CZ');
    return {
      answer: isEn
        ? `This month: ${stats.c} invoices totaling ${fmt(stats.total)} CZK.`
        : `Tento měsíc: ${stats.c} faktur v celkové hodnotě ${fmt(stats.total)} Kč.`,
      link: '/invoices'
    };
  }

  // Products/services count
  if (has('kolik', 'počet', 'count', 'how many') && has('produkt', 'product', 'služb', 'služeb', 'service', 'zboží', 'polož')) {
    const cnt = db.prepare('SELECT COUNT(*) as c FROM products WHERE tenant_id = ?').get(tenantId);
    return {
      answer: isEn ? `You have ${cnt.c} products/services in your catalog.` : `V katalogu máte ${cnt.c} produktů/služeb.`,
      link: '/bank'
    };
  }

  // Bank accounts summary
  if (has('kolik', 'jaké', 'účet', 'account') && has('bank', 'bankovní') && !has('spojení', 'nastavit', 'kde')) {
    const accounts = db.prepare('SELECT name, currency, COALESCE(initial_balance,0) as balance FROM bank_accounts WHERE tenant_id = ?').all(tenantId);
    if (accounts.length === 0) return { answer: isEn ? 'No bank accounts found.' : 'Žádné bankovní účty nenalezeny.', link: '/bank' };
    const fmt = (n) => Math.round(n || 0).toLocaleString('cs-CZ');
    const list = accounts.map(a => `• ${a.name}: ${fmt(a.balance)} ${a.currency}`).join('\n');
    return {
      answer: isEn ? `Your bank accounts:\n${list}` : `Vaše bankovní účty:\n${list}`,
      link: '/bank'
    };
  }

  // No dynamic match
  return null;
}

// ─── LOCAL AI REASONING ENGINE ──────────────────────────────
// TF-IDF semantic matching + intent classification + entity extraction + contextual answer generation
// A real local AI agent that reasons about queries instead of just matching keywords

class LocalAIEngine {
  constructor() {
    this.documents = [];
    this.idf = {};
    this.docVectors = [];
    this.vocabulary = new Set();
    this.indexTenantId = null;
    // Czech stop words to filter during tokenization
    this.stopWords = new Set([
      'a','i','k','o','s','u','v','z','do','na','od','po','se','si','ze','to','je','co','za','ne',
      'pro','pri','jak','ale','ani','ten','tam','ted','pak','jiz','jen','tak','aby','kdo','kde',
      'mam','muj','moje','moji','sve','svuj','jsem','jsou','bude','bylo','bych','neni','nase',
      'jako','taky','take','jeste','ktere','ktery','ktere','jejich','proto','protoze','nebo',
      'the','a','an','is','are','was','were','be','been','has','have','had','do','does','did',
      'in','on','at','to','for','of','with','by','from','it','this','that','my','your','our'
    ]);
  }

  // Tokenize text into stemmed terms (shared tokenizer for queries and documents)
  tokenize(text) {
    return noDiac(text).toLowerCase()
      .split(/[\s,;.!?:()\"\'\/\-]+/)
      .map(w => w.replace(/[^a-z0-9]/g, ''))
      .filter(w => w.length > 1 && !this.stopWords.has(w))
      .map(w => czStem(w));
  }

  // Build TF-IDF index from knowledge base
  buildIndex(tenantId) {
    if (this.indexTenantId === tenantId && this.documents.length > 0) return;
    const allKB = db.prepare('SELECT * FROM chatbot_knowledge WHERE (tenant_id = ? OR tenant_id IS NULL) AND active = 1').all(tenantId);
    this.documents = allKB;
    // Create document texts combining all searchable fields
    const docTexts = allKB.map(kb =>
      `${kb.keywords} ${kb.question_cs} ${kb.question_en || ''} ${kb.answer_cs} ${kb.answer_en || ''}`
    );
    const docTokenSets = docTexts.map(t => this.tokenize(t));
    // Build vocabulary
    this.vocabulary = new Set();
    docTokenSets.forEach(tokens => tokens.forEach(t => this.vocabulary.add(t)));
    // Compute IDF: log((N+1)/(df+1)) + 1 (smoothed)
    const N = docTokenSets.length || 1;
    this.idf = {};
    for (const term of this.vocabulary) {
      const df = docTokenSets.filter(tokens => tokens.includes(term)).length;
      this.idf[term] = Math.log((N + 1) / (df + 1)) + 1;
    }
    // Compute TF-IDF vectors for each document
    this.docVectors = docTokenSets.map(tokens => this._tfidf(tokens));
    this.indexTenantId = tenantId;
  }

  // Compute TF-IDF vector from token array
  _tfidf(tokens) {
    const tf = {};
    tokens.forEach(t => { tf[t] = (tf[t] || 0) + 1; });
    const maxTf = Math.max(...Object.values(tf), 1);
    const vec = {};
    for (const [term, count] of Object.entries(tf)) {
      vec[term] = (0.5 + 0.5 * count / maxTf) * (this.idf[term] || 1);
    }
    return vec;
  }

  // Cosine similarity between two TF-IDF vectors
  _cosine(v1, v2) {
    let dot = 0, m1 = 0, m2 = 0;
    // Iterate over smaller vector for efficiency
    const [small, big] = Object.keys(v1).length <= Object.keys(v2).length ? [v1, v2] : [v2, v1];
    for (const t of Object.keys(small)) {
      if (big[t]) dot += small[t] * big[t];
    }
    for (const v of Object.values(v1)) m1 += v * v;
    for (const v of Object.values(v2)) m2 += v * v;
    if (m1 === 0 || m2 === 0) return 0;
    return dot / (Math.sqrt(m1) * Math.sqrt(m2));
  }

  // Find best KB matches using TF-IDF cosine similarity
  semanticSearch(query, topN = 3) {
    const qTokens = this.tokenize(query);
    const qVec = this._tfidf(qTokens);
    const scored = this.docVectors.map((dv, i) => ({
      doc: this.documents[i],
      score: this._cosine(qVec, dv)
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topN);
  }

  // ── Intent classification ──
  classifyIntent(qNorm) {
    const intentDefs = [
      { name: 'count',    patterns: ['kolik', 'pocet', 'celkem', 'how many', 'count', 'total', 'mnozstv', 'pocit'] },
      { name: 'navigate', patterns: ['kde', 'where', 'najdu', 'najit', 'sekce', 'section', 'odkaz'] },
      { name: 'howto',    patterns: ['jak', 'how', 'postup', 'navod', 'vytvor', 'create', 'pridat', 'add', 'nastav', 'nastavim', 'udelam'] },
      { name: 'info',     patterns: ['co je', 'what is', 'vysvetli', 'explain', 'definic', 'vyznam', 'pojem', 'udaje', 'info'] },
      { name: 'status',   patterns: ['stav', 'status', 'prehled', 'overview', 'summary', 'shrn', 'souhrnne'] },
      { name: 'list',     patterns: ['vypis', 'ukaz', 'zobraz', 'list', 'show', 'kteri', 'ktere', 'jmenuj', 'vyjmenuj'] },
      { name: 'compare',  patterns: ['rozdil', 'difference', 'porovn', 'compare', 'versus'] },
      { name: 'problem',  patterns: ['nefunguj', 'chyba', 'error', 'problem', 'nejde', 'nemohu', 'broken', 'nemuzu'] },
      { name: 'date',     patterns: ['datum', 'dnes', 'today', 'date'] },
      { name: 'who',      patterns: ['kdo', 'who', 'komu', 'jmenu'] },
      { name: 'value',    patterns: ['obrat', 'revenue', 'trzb', 'hodnot', 'suma', 'castk', 'celkov', 'cena'] },
    ];
    for (const { name, patterns } of intentDefs) {
      if (patterns.some(p => qNorm.includes(p))) return name;
    }
    return 'general';
  }

  // ── Entity extraction ──
  extractEntities(qNorm) {
    const entityDefs = [
      { name: 'invoice',    patterns: ['faktur', 'invoice', 'doklad', 'vydan', 'prijat'] },
      { name: 'client',     patterns: ['klient', 'client', 'zakaznik', 'odberatel', 'customer', 'kontakt', 'dodavatel'] },
      { name: 'product',    patterns: ['produkt', 'product', 'sluzb', 'zbozi', 'poloz', 'service', 'katalog'] },
      { name: 'evidence',   patterns: ['evidenc', 'vydaj', 'naklad', 'expense', 'income'] },
      { name: 'user',       patterns: ['uzivatel', 'user', 'role', 'opravnen', 'pristup'] },
      { name: 'company',    patterns: ['firma', 'spolecnost', 'company', 'ico', 'dic'] },
      { name: 'bank',       patterns: ['banka', 'bank', 'transakc', 'vypis', 'parov'] },
      { name: 'vat',        patterns: ['dph', 'vat', 'dan', 'tax', 'sazb'] },
      { name: 'currency',   patterns: ['mena', 'men', 'currency', 'kurz', 'rate', 'euro', 'dollar', 'koruna'] },
      { name: 'accounting', patterns: ['ucetnic', 'account', 'denik', 'journal', 'kniha', 'ledger', 'osnov'] },
      { name: 'payment',    patterns: ['platb', 'payment', 'uhrad', 'zaplac'] },
      { name: 'receivable', patterns: ['pohledav', 'receivabl', 'dluz', 'owe', 'splatnost', 'overdue'] },
      { name: 'profile',    patterns: ['profil', 'profile', 'heslo', 'password', 'podpis'] },
      { name: 'recurring',  patterns: ['opakovane', 'recurring', 'pravideln', 'automatick', 'sablon'] },
      { name: 'dashboard',  patterns: ['dashboard', 'nastenk', 'prehled', 'home'] },
      { name: 'pdf',        patterns: ['pdf', 'tisk', 'print', 'stahnout'] },
      { name: 'email',      patterns: ['email', 'odeslat', 'poslat'] },
    ];
    const found = [];
    for (const { name, patterns } of entityDefs) {
      if (patterns.some(p => qNorm.includes(p))) found.push(name);
    }
    return found;
  }

  // ── DB-powered reasoning: answer from live data based on intent + entities ──
  reasonFromDB(intent, entities, qNorm, tenantId, userId, isEn) {
    const fmt = (n) => Math.round(n || 0).toLocaleString('cs-CZ');
    const about = (...terms) => terms.some(t => qNorm.includes(t));

    // Count intent
    if (intent === 'count' || about('kolik', 'pocet', 'celkem', 'how many', 'count', 'total')) {
      if (entities.includes('invoice') || about('faktur', 'invoice', 'doklad')) {
        const s = db.prepare(`SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN status='draft' THEN 1 ELSE 0 END),0) as drafts, COALESCE(SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END),0) as sent, COALESCE(SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END),0) as paid, COALESCE(SUM(CASE WHEN status='overdue' THEN 1 ELSE 0 END),0) as overdue FROM invoices WHERE tenant_id = ?`).get(tenantId);
        return { answer: isEn ? `You have ${s.total} invoices: ${s.drafts} drafts, ${s.sent} sent, ${s.paid} paid, ${s.overdue} overdue.` : `Máte celkem ${s.total} faktur: ${s.drafts} konceptů, ${s.sent} odeslaných, ${s.paid} zaplacených, ${s.overdue} po splatnosti.`, link: '/invoices' };
      }
      if (entities.includes('client') || about('klient', 'client', 'zakaznik', 'odberatel', 'customer', 'kontakt')) {
        const c = db.prepare('SELECT COUNT(*) as c FROM clients WHERE tenant_id = ?').get(tenantId).c;
        return { answer: isEn ? `You have ${c} clients.` : `Máte ${c} klientů.`, link: '/clients' };
      }
      if (entities.includes('user') || about('uzivatel', 'user', 'lidi', 'zamestnan', 'osob', 'people')) {
        const c = db.prepare('SELECT COUNT(*) as c FROM users WHERE tenant_id = ? AND active = 1').get(tenantId).c;
        return { answer: isEn ? `There are ${c} active users.` : `V systému je ${c} aktivních uživatelů.`, link: '/users' };
      }
      if (entities.includes('product') || about('produkt', 'product', 'sluzb', 'service', 'zbozi', 'poloz')) {
        const c = db.prepare('SELECT COUNT(*) as c FROM products WHERE tenant_id = ?').get(tenantId).c;
        return { answer: isEn ? `You have ${c} products/services.` : `Máte ${c} produktů/služeb.`, link: '/bank' };
      }
      if (entities.includes('evidence') || about('evidenc', 'doklad', 'vydaj', 'naklad', 'prijem', 'expense', 'income')) {
        const s = db.prepare('SELECT COUNT(*) as c, COALESCE(SUM(amount),0) as total FROM evidence WHERE tenant_id = ?').get(tenantId);
        return { answer: isEn ? `You have ${s.c} evidence records totaling ${fmt(s.total)} CZK.` : `Máte ${s.c} záznamů v evidenci v celkové hodnotě ${fmt(s.total)} Kč.`, link: '/evidence' };
      }
    }

    // Receivables
    if (entities.includes('receivable') || about('pohledav', 'receivabl', 'dluz', 'owe')) {
      const o = db.prepare(`SELECT COUNT(*) as c, COALESCE(SUM(total_czk),0) as total FROM invoices WHERE tenant_id = ? AND status IN ('sent','overdue') AND type='issued'`).get(tenantId);
      return { answer: isEn ? `You have ${o.c} outstanding receivables totaling ${fmt(o.total)} CZK.` : `Máte ${o.c} neuhrazených pohledávek v celkové hodnotě ${fmt(o.total)} Kč.`, link: '/invoices' };
    }

    // List / show intent — show recent items
    if (intent === 'list' || about('ukaz', 'zobraz', 'vypis', 'show', 'list')) {
      if (entities.includes('invoice') || about('faktur', 'invoice', 'doklad')) {
        const recent = db.prepare(`SELECT i.invoice_number, i.total, i.currency, i.status, c.name as client_name FROM invoices i LEFT JOIN clients c ON i.client_id = c.id WHERE i.tenant_id = ? ORDER BY i.created_at DESC LIMIT 5`).all(tenantId);
        if (recent.length === 0) return { answer: isEn ? 'No invoices found.' : 'Žádné faktury nenalezeny.', link: '/invoices' };
        const statusLabels = { draft: 'koncept', sent: 'odeslaná', paid: 'zaplacená', overdue: 'po splatnosti', cancelled: 'stornovaná' };
        const list = recent.map(r => `• ${r.invoice_number} — ${r.client_name || '?'} — ${Math.round(r.total)} ${r.currency} (${isEn ? r.status : statusLabels[r.status] || r.status})`).join('\n');
        return { answer: isEn ? `Recent invoices:\n${list}` : `Poslední faktury:\n${list}`, link: '/invoices' };
      }
      if (entities.includes('client') || about('klient', 'client', 'zakaznik')) {
        const clients = db.prepare('SELECT name, email, phone FROM clients WHERE tenant_id = ? ORDER BY id DESC LIMIT 5').all(tenantId);
        if (clients.length === 0) return { answer: isEn ? 'No clients found.' : 'Žádní klienti nenalezeni.', link: '/clients' };
        const list = clients.map(c => `• ${c.name} — ${c.email || '—'}`).join('\n');
        return { answer: isEn ? `Clients:\n${list}` : `Klienti:\n${list}`, link: '/clients' };
      }
      if (entities.includes('product') || about('produkt', 'product', 'sluzb')) {
        const prods = db.prepare('SELECT name, unit_price, unit, type FROM products WHERE tenant_id = ? AND active = 1 ORDER BY id DESC LIMIT 5').all(tenantId);
        if (prods.length === 0) return { answer: isEn ? 'No products found.' : 'Žádné produkty nenalezeny.', link: '/bank' };
        const list = prods.map(p => `• ${p.name} — ${Math.round(p.unit_price || 0)} Kč/${p.unit || 'ks'} (${p.type === 'service' ? (isEn ? 'service' : 'služba') : (isEn ? 'product' : 'produkt')})`).join('\n');
        return { answer: isEn ? `Products/services:\n${list}` : `Produkty/služby:\n${list}`, link: '/bank' };
      }
      if (entities.includes('user') || about('uzivatel', 'user')) {
        const users = db.prepare('SELECT full_name, role, email FROM users WHERE tenant_id = ? AND active = 1').all(tenantId);
        const list = users.map(u => `• ${u.full_name} (${u.role}) — ${u.email}`).join('\n');
        return { answer: isEn ? `Users:\n${list}` : `Uživatelé:\n${list}`, link: '/users' };
      }
    }

    // Navigation intent
    if (intent === 'navigate') {
      // Order matters: longer/more specific patterns first, short ambiguous ones (vat, men, dan) last
      const navMap = [
        [['uzivatel', 'user', 'role', 'opravnen'], 'Uživatele najdete v Správa → Uživatelé.', 'Users are in Admin → Users.', '/users'],
        [['dashboard', 'nastenk', 'prehled', 'home page'], 'Dashboard najdete na hlavní stránce po přihlášení.', 'Dashboard is on the main page after login.', '/'],
        [['faktur', 'invoice', 'doklad'], 'Faktury najdete v sekci Finance → Faktury.', 'Invoices are in Finance → Invoices.', '/invoices'],
        [['klient', 'client', 'zakaznik', 'odberatel', 'customer'], 'Klienty najdete v Finance → Klienti.', 'Clients are in Finance → Clients.', '/clients'],
        [['evidenc', 'prijem', 'vydaj'], 'Evidenci najdete v Finance → Evidence.', 'Evidence is in Finance → Evidence.', '/evidence'],
        [['ucetnic', 'account', 'denik', 'journal', 'kniha', 'ledger'], 'Účetnictví najdete v Účetnictví → Účetnictví.', 'Accounting is in the Accounting section.', '/accounting'],
        [['banka', 'bank', 'transak'], 'Banku najdete v Účetnictví → Banka.', 'Bank is in Accounting → Bank.', '/bank'],
        [['nastav', 'setting', 'firma', 'spolecnost', 'company'], 'Nastavení najdete v Správa → Společnost.', 'Settings are in Admin → Company.', '/company'],
        [['profil', 'profile', 'heslo', 'password'], 'Profil najdete kliknutím na své jméno v postranním panelu.', 'Profile is accessible by clicking your name in the sidebar.', '/profile'],
        [['dph', 'vat', 'dan', 'tax'], 'DPH najdete v Účetnictví → DPH.', 'VAT is in Accounting → VAT.', '/vat'],
        [['meny', 'currency', 'kurz', 'rate'], 'Měny najdete v Účetnictví → Měny.', 'Currencies are in Accounting → Currencies.', '/currencies'],
      ];
      for (const [terms, cs, en, lnk] of navMap) {
        if (terms.some(t => qNorm.includes(t))) return { answer: isEn ? en : cs, link: lnk };
      }
    }

    // How-to intent
    if (intent === 'howto') {
      if (entities.includes('invoice') || about('faktur', 'invoice')) {
        return { answer: isEn ? 'Go to Invoices → click "+ New invoice". Select a client, add items and save.' : 'Přejděte do Faktury → klikněte "+ Nová faktura". Vyberte klienta, přidejte položky a uložte.', link: '/invoices/new' };
      }
      if (entities.includes('client') || about('klient', 'client', 'zakaznik', 'customer')) {
        return { answer: isEn ? 'Go to Clients → click "+ New client". Fill in the details and save.' : 'Přejděte do Klienti → klikněte "+ Nový klient". Vyplňte údaje a uložte.', link: '/clients' };
      }
    }

    // Company info
    if ((about('info', 'udaje', 'data') && about('firm', 'spolecnost', 'company', 'nase', 'our')) || (intent === 'info' && entities.includes('company'))) {
      const comp = db.prepare('SELECT * FROM company WHERE tenant_id = ?').get(tenantId);
      if (comp) {
        return { answer: isEn ? `Company: ${comp.name}, ID: ${comp.ico || '—'}, VAT: ${comp.dic || '—'}` : `Společnost: ${comp.name}, IČO: ${comp.ico || '—'}, DIČ: ${comp.dic || '—'}`, link: '/company' };
      }
    }

    // Status / overview
    if (intent === 'status') {
      const s = db.prepare(`SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END),0) as paid, COALESCE(SUM(CASE WHEN status='overdue' THEN 1 ELSE 0 END),0) as overdue, COALESCE(SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END),0) as sent FROM invoices WHERE tenant_id = ?`).get(tenantId);
      const cl = db.prepare('SELECT COUNT(*) as c FROM clients WHERE tenant_id = ?').get(tenantId).c;
      return { answer: isEn ? `Quick overview: ${s.total} invoices (${s.paid} paid, ${s.sent} sent, ${s.overdue} overdue), ${cl} clients.` : `Rychlý přehled: ${s.total} faktur (${s.paid} zaplacených, ${s.sent} odeslaných, ${s.overdue} po splatnosti), ${cl} klientů.`, link: '/' };
    }

    // Date
    if (intent === 'date') {
      const today = new Date().toLocaleDateString(isEn ? 'en-GB' : 'cs-CZ');
      return { answer: isEn ? `Today is ${today}.` : `Dnes je ${today}.`, link: null };
    }

    return null;
  }

  // ── Contextual answer generation: synthesize an answer when no exact match exists ──
  generateAnswer(query, qNorm, intent, entities, semanticResults, tenantId, isEn) {
    const fmt = (n) => Math.round(n || 0).toLocaleString('cs-CZ');

    // If we have a good semantic match (score > 0.15), use it as the knowledge source
    // but enrich with live data and contextual reasoning
    if (semanticResults.length > 0 && semanticResults[0].score > 0.15) {
      const best = semanticResults[0].doc;
      const baseAnswer = isEn ? (best.answer_en || best.answer_cs) : best.answer_cs;

      // If there are multiple relevant results, combine insights
      if (semanticResults.length > 1 && semanticResults[1].score > 0.12) {
        const second = semanticResults[1].doc;
        const addendum = isEn ? (second.answer_en || second.answer_cs) : second.answer_cs;
        // Only append if from a different category/topic
        if (best.category !== second.category || best.link !== second.link) {
          return { answer: baseAnswer + '\n\n' + (isEn ? 'Related: ' : 'Souvisí: ') + addendum, link: best.link };
        }
      }
      return { answer: baseAnswer, link: best.link };
    }

    // ── Autonomous answer generation using system knowledge ──
    // The AI reasons about what it knows about the ERP system

    // Entity-based contextual knowledge map — the AI's "understanding" of the system
    const knowledgeMap = {
      invoice: {
        cs: 'Faktury jsou hlavní součástí ERP systému. Spravujte je v sekci Finance → Faktury. Můžete vytvářet, odesílat, platit a exportovat faktury.',
        en: 'Invoices are a core part of the ERP system. Manage them in Finance → Invoices. You can create, send, pay and export invoices.',
        link: '/invoices'
      },
      client: {
        cs: 'Klienty najdete v sekci Finance → Klienti. Obsahují kontaktní údaje, historii faktur a možnost načtení dat z ARES.',
        en: 'Clients are in Finance → Clients. They contain contact details, invoice history and ARES data lookup.',
        link: '/clients'
      },
      product: {
        cs: 'Produkty a služby jsou v katalogu. Každý má název, SKU, cenu a sazbu DPH. Používají se při vytváření faktur.',
        en: 'Products and services are in the catalog. Each has name, SKU, price and VAT rate. They are used when creating invoices.',
        link: '/bank'
      },
      evidence: {
        cs: 'Evidence slouží k záznamu příjmů, výdajů, majetku a dokumentů. Najdete ji v Finance → Evidence.',
        en: 'Evidence records income, expenses, assets and documents. Find it in Finance → Evidence.',
        link: '/evidence'
      },
      user: {
        cs: 'Správa uživatelů je v Správa → Uživatelé. Systém má 4 role: administrátor, účetní, manažer a náhled.',
        en: 'User management is in Admin → Users. The system has 4 roles: admin, accountant, manager and viewer.',
        link: '/users'
      },
      company: {
        cs: 'Nastavení společnosti najdete v Správa → Společnost. Nastavte IČO, DIČ, logo, bankovní spojení a vzhled faktur.',
        en: 'Company settings are in Admin → Company. Set ID, VAT ID, logo, bank details and invoice layout.',
        link: '/company'
      },
      bank: {
        cs: 'Bankovní operace najdete v Účetnictví → Banka. Import výpisů, párování transakcí s fakturami.',
        en: 'Banking operations are in Accounting → Bank. Import statements, match transactions with invoices.',
        link: '/bank'
      },
      vat: {
        cs: 'DPH najdete v Účetnictví → DPH. Generujte přiznání k DPH, kontrolujte vstupy a výstupy. Sazby: 0%, 12%, 21%.',
        en: 'VAT is in Accounting → VAT. Generate VAT returns, check inputs and outputs. Rates: 0%, 12%, 21%.',
        link: '/vat'
      },
      currency: {
        cs: 'Měny najdete v Účetnictví → Měny. Kurzy se automaticky aktualizují z ČNB. Podporujeme CZK, EUR, USD, GBP, PLN.',
        en: 'Currencies are in Accounting → Currencies. Rates auto-update from CNB. We support CZK, EUR, USD, GBP, PLN.',
        link: '/currencies'
      },
      accounting: {
        cs: 'Účetnictví zahrnuje účtovou osnovu, účetní deník a hlavní knihu. Najdete ho v sekci Účetnictví.',
        en: 'Accounting includes chart of accounts, journal and general ledger. Find it in the Accounting section.',
        link: '/accounting'
      },
      payment: {
        cs: 'Platby zaznamenáte v detailu faktury. Systém podporuje částečné platby a automatické párování přes variabilní symbol.',
        en: 'Record payments in invoice detail. The system supports partial payments and auto-matching via variable symbol.',
        link: '/invoices'
      },
      receivable: {
        cs: 'Pohledávky jsou neuhrazené vydané faktury. Na dashboardu vidíte přehled stárnutí pohledávek.',
        en: 'Receivables are unpaid issued invoices. The dashboard shows an aging report.',
        link: '/invoices'
      },
      profile: {
        cs: 'Profil najdete kliknutím na své jméno v postranním panelu. Změňte heslo, jméno a elektronický podpis.',
        en: 'Profile is accessible by clicking your name in the sidebar. Change password, name and electronic signature.',
        link: '/profile'
      },
      recurring: {
        cs: 'Opakované faktury nastavíte v Finance → Opakované. Intervaly: týdně, měsíčně, čtvrtletně, ročně.',
        en: 'Recurring invoices are in Finance → Recurring. Intervals: weekly, monthly, quarterly, yearly.',
        link: '/recurring'
      },
      dashboard: {
        cs: 'Dashboard je hlavní stránka po přihlášení. Zobrazuje graf příjmů/výdajů, stav faktur, top klienty a stárnutí pohledávek.',
        en: 'Dashboard is the main page after login. It shows revenue/expense charts, invoice status, top clients and aging report.',
        link: '/'
      },
      pdf: {
        cs: 'PDF faktur stáhnete v detailu faktury tlačítkem "Stáhnout PDF". Na výběr je 5 layoutů s logem a QR kódem.',
        en: 'Download invoice PDF in invoice detail with "Download PDF" button. Choose from 5 layouts with logo and QR code.',
        link: '/invoices'
      },
      email: {
        cs: 'Faktury odešlete emailem z detailu faktury. Faktura se odešle jako PDF příloha.',
        en: 'Send invoices by email from invoice detail. The invoice is sent as a PDF attachment.',
        link: '/invoices'
      },
    };

    // Combine knowledge for all detected entities
    if (entities.length > 0) {
      const primaryEntity = entities[0];
      const knowledge = knowledgeMap[primaryEntity];
      if (knowledge) {
        let answer = isEn ? knowledge.en : knowledge.cs;

        // Enrich with live data if available
        try {
          if (primaryEntity === 'invoice') {
            const s = db.prepare('SELECT COUNT(*) as c FROM invoices WHERE tenant_id = ?').get(tenantId);
            answer += isEn ? ` You currently have ${s.c} invoices.` : ` Aktuálně máte ${s.c} faktur.`;
          } else if (primaryEntity === 'client') {
            const s = db.prepare('SELECT COUNT(*) as c FROM clients WHERE tenant_id = ?').get(tenantId);
            answer += isEn ? ` You currently have ${s.c} clients.` : ` Aktuálně máte ${s.c} klientů.`;
          } else if (primaryEntity === 'product') {
            const s = db.prepare('SELECT COUNT(*) as c FROM products WHERE tenant_id = ?').get(tenantId);
            answer += isEn ? ` You currently have ${s.c} products.` : ` Aktuálně máte ${s.c} produktů.`;
          } else if (primaryEntity === 'user') {
            const s = db.prepare('SELECT COUNT(*) as c FROM users WHERE tenant_id = ? AND active = 1').get(tenantId);
            answer += isEn ? ` There are ${s.c} active users.` : ` V systému je ${s.c} aktivních uživatelů.`;
          }
        } catch (e) { /* ignore enrichment errors */ }

        // If multiple entities, add secondary info
        if (entities.length > 1 && knowledgeMap[entities[1]]) {
          const secondary = knowledgeMap[entities[1]];
          answer += '\n\n' + (isEn ? secondary.en : secondary.cs);
        }

        return { answer, link: knowledge.link };
      }
    }

    // ── Intent-based generation without specific entity ──
    if (intent === 'navigate') {
      return {
        answer: isEn
          ? 'The ERP system has these main sections:\n• Finance: Invoices, Clients, Evidence, Recurring\n• Accounting: Accounting, VAT, Bank, Currencies\n• Admin: Company, Users\nWhat are you looking for?'
          : 'ERP systém má tyto hlavní sekce:\n• Finance: Faktury, Klienti, Evidence, Opakované\n• Účetnictví: Účetnictví, DPH, Banka, Měny\n• Správa: Společnost, Uživatelé\nCo hledáte?',
        link: '/'
      };
    }

    if (intent === 'problem') {
      return {
        answer: isEn
          ? 'If you encounter a problem:\n1. Refresh the page (F5)\n2. Check your permissions\n3. Verify all required fields\n4. Try logging out and back in\nIf the issue persists, contact the administrator.'
          : 'Pokud narazíte na problém:\n1. Obnovte stránku (F5)\n2. Zkontrolujte svá oprávnění\n3. Ověřte vyplnění povinných polí\n4. Zkuste se odhlásit a přihlásit\nPokud problém přetrvá, kontaktujte administrátora.',
        link: null
      };
    }

    if (intent === 'howto') {
      return {
        answer: isEn
          ? 'I can help you with how-to guides! Try asking specifically:\n• "How to create an invoice?"\n• "How to add a client?"\n• "How to import bank statements?"\n• "How to generate a VAT return?"'
          : 'Pomohu vám s návody! Zkuste se zeptat konkrétně:\n• "Jak vytvořím fakturu?"\n• "Jak přidám klienta?"\n• "Jak importuji bankovní výpis?"\n• "Jak vytvořím přiznání k DPH?"',
        link: null
      };
    }

    // Weak semantic match — still better than nothing
    if (semanticResults.length > 0 && semanticResults[0].score > 0.08) {
      const best = semanticResults[0].doc;
      return {
        answer: isEn ? (best.answer_en || best.answer_cs) : best.answer_cs,
        link: best.link
      };
    }

    return null;
  }

  // Strip common Czech/English prefixes that don't carry semantic meaning
  stripPrefixes(q) {
    return q.replace(/^(prosim\s+|prosím\s+|potrebuji\s+|potřebuji\s+|zajima\s+me\s+|zajímá\s+mě\s+|rad\s+bych\s+vedel\s+|rád\s+bych\s+věděl\s+|chtel\s+bych\s+|chtěl\s+bych\s+|potrebuji\s+vedet\s+|potřebuji\s+vědět\s+|please\s+|i\s+need\s+|i\s+want\s+)/i, '').trim();
  }

  // Detect help / capability questions
  isHelpQuery(qNorm) {
    const stripped = this.stripPrefixes(qNorm);
    return /\b(pomoc|pomoct|napoved|co umis|what can you|schopnost|funkce chatbot|co znas|co doved|co zvlad)\b/i.test(stripped) ||
           /^help\b/i.test(stripped) ||
           /\bjak\b.*\b(pomoc|pomoct|pomuz|help)\b/i.test(stripped) ||
           /\b(what can|how can).*\b(you|do|help)\b/i.test(stripped) ||
           /^help$/i.test(stripped);
  }

  // ── Main reasoning entry point ──
  reason(query, tenantId, userId, isEn) {
    this.buildIndex(tenantId);
    const qNorm = noDiac(query).toLowerCase();

    // Pre-check: strip prefixes and check if remaining content is meaningful
    const stripped = this.stripPrefixes(qNorm);
    const isGarbage = stripped.length < 3 || /^[.!?,;:\s?]+$/.test(stripped);

    // If query is essentially empty/garbage after prefix stripping → return null (let fallback handle it)
    if (isGarbage) return null;

    // If stripped content has no recognizable words (no known entity/intent), don't let TF-IDF match gibberish
    const strippedIntent = this.classifyIntent(stripped);
    const strippedEntities = this.extractEntities(stripped);
    if (strippedIntent === 'general' && strippedEntities.length === 0) {
      // Check if stripped content has any known Czech/English ERP-related word
      const hasKnownWord = /\b(faktur|klient|produkt|evidenc|uzivatel|firma|bank|dph|ucetnic|platb|kurz|mena|profil|nastav|dashboard|invoice|client|product|user|company|payment|vat|accounting|currency|help|pomoc|kde|jak|kolik|stav|datum|dnes|tenant|timeout|session|role|export|import|pdf|email|qr|isdoc|ares)\b/i.test(stripped);
      // Also allow "co je/co to je/what is" pattern — definition queries about any term
      const isDefinitionQ = /\b(co je|co to je|what is|vysvetli|explain|definic)\b/i.test(stripped);
      if (!hasKnownWord && !isDefinitionQ) return null; // let the fallback handle truly unknown queries
    }

    // Confused / lost user — handle before help to distinguish "ztracený pomoc" from "pomoc"
    const strippedForConfused = this.stripPrefixes(qNorm);
    if (/\b(confused|lost|nevim co|pomoo+c|simple|jednoduch|zjednoduse|navigate me|make it)\b/i.test(strippedForConfused) ||
        (/\bztracen/i.test(strippedForConfused) && strippedForConfused.length > 8)) {
      return {
        answer: isEn
          ? "No worries! Try asking a specific question like:\n• \"How to create an invoice?\"\n• \"Where are clients?\"\n• \"How many invoices do I have?\"\nI'm here to help!"
          : 'Žádný problém! Zkuste se zeptat konkrétně, například:\n• "Jak vytvořím fakturu?"\n• "Kde najdu klienty?"\n• "Kolik mám faktur?"\nJsem tu, abych pomohl!',
        link: null
      };
    }

    // Help / capability queries — handle before general AI matching
    if (this.isHelpQuery(qNorm)) {
      return {
        answer: isEn
          ? "I can help you with:\n• Navigation — where to find things in the system\n• Invoices — create, send, pay\n• Clients — contact management\n• Accounting — VAT, journal, ledger\n• Settings — company, users, roles\n• Live data — invoice counts, revenue, overdue\nJust ask in your own words!"
          : 'Pomohu vám s:\n• Navigací — kde co najdete v systému\n• Fakturami — vytvoření, odeslání, platba\n• Klienty — správa kontaktů\n• Účetnictvím — DPH, deník, hlavní kniha\n• Nastavením — firma, uživatelé, role\n• Živými daty — počty faktur, obraty, po splatnosti\nPtejte se vlastními slovy!',
        link: null
      };
    }

    const intent = this.classifyIntent(qNorm);
    const entities = this.extractEntities(qNorm);
    const semanticResults = this.semanticSearch(query);

    // 1) Try DB-powered reasoning (live data answers)
    const dbAnswer = this.reasonFromDB(intent, entities, qNorm, tenantId, userId, isEn);
    if (dbAnswer) return dbAnswer;

    // 2) Try semantic KB match + contextual generation
    const generated = this.generateAnswer(query, qNorm, intent, entities, semanticResults, tenantId, isEn);
    if (generated) return generated;

    // No answer possible
    return null;
  }
}

// Singleton AI engine instance
const aiEngine = new LocalAIEngine();

// ─── CONVERSATION CONTEXT ─────────────────────────────────────
// Detects follow-up questions and enriches them with context from previous exchange
function resolveFollowUp(q, conversationId, tenantId) {
  if (!conversationId) return q;

  const conv = db.prepare('SELECT messages FROM chatbot_conversations WHERE id = ? AND tenant_id = ?').get(conversationId, tenantId);
  if (!conv) return q;

  const msgs = JSON.parse(conv.messages);
  if (msgs.length < 2) return q;

  // Get the last bot answer and last user question
  const lastBot = [...msgs].reverse().find(m => m.role === 'bot');
  const lastUser = [...msgs].reverse().find(m => m.role === 'user');
  if (!lastBot || !lastUser) return q;

  const qNorm = noDiac(q);
  const qWords = qNorm.split(/\s+/).filter(w => w.length > 1);

  // Exclude greetings, thanks, bye — these are never follow-ups
  const greetBye = /^(ahoj|cau|cus|nazdar|zdar|dobry den|dobre rano|dobry vecer|zdravim|hello|hi|hey|hej|dekuji|diky|dik|thanks|thank you|diky moc|na shledanou|nashledanou|nashle|bye|sbohem|goodbye|zatim|mej se|good morning|good afternoon|good evening)(?:\b|$)/i;
  if (greetBye.test(qNorm)) return q;

  // Detect follow-up patterns
  const isFollowUp = (
    // Starts with conjunction / connector
    /^(a |ale |tak |takze |no |no a |hmm |ok |dobre |fajn |super |jo |ano |ne )/i.test(qNorm + ' ') ||
    // Contains back-reference pronouns (Czech: nich, jim, toho, tomu, tom, tím, těch, těm, těmi, jich, nimi)
    // Note: 'je' excluded (too common — means "is"), 'to' excluded (too common), 'ty' excluded
    /\b(z nich|o nich|na ne|o tom|k tomu|nich|jim|jej|toho|tomu|tech|tem|temi|jich|nimi)\b/i.test(qNorm) ||
    // English back-references
    /\b(them|those|these|this one|the same|which one)\b/i.test(qNorm) ||
    // Very short question likely referencing context (under 4 words)
    (qWords.length <= 3) ||
    // "co dál" / "a dál" / "tell me more" / "více" / "detail" / superlatives referencing context
    /\b(co dal|a dal|vice|detail|podrob|rozsir|upresni|tell me more|more detail|elaborate|go on|rekni mi vic|the best|nejlep|top|nejvets|nejvic|kteri jsou|who are the)\b/i.test(qNorm) ||
    // "ukaž mi je" / "zobraz" / "vypiš" without clear topic
    (/\b(ukaz|zobraz|vypis|list|show)\b/i.test(qNorm) && qWords.length <= 4)
  );

  if (!isFollowUp) return q;

  // Extract topic keywords from previous exchange (both user question and bot answer)
  const prevContext = noDiac((lastUser.text + ' ' + lastBot.text).toLowerCase());

  // Identify the topic from previous context
  const topicMap = [
    { patterns: ['faktur', 'invoice', 'doklad'], topic: 'faktury' },
    { patterns: ['klient', 'client', 'zakaznik', 'odberatel'], topic: 'klienty' },
    { patterns: ['produkt', 'product', 'sluzb', 'zbozi', 'poloz'], topic: 'produkty' },
    { patterns: ['evidenc', 'vydaj', 'naklad', 'prijem', 'expense'], topic: 'evidenci' },
    { patterns: ['uzivatel', 'user', 'ucet', 'account'], topic: 'uživatele' },
    { patterns: ['platb', 'payment', 'uhrad', 'zaplac'], topic: 'platby' },
    { patterns: ['splatnost', 'overdue', 'po splatnosti', 'dluz'], topic: 'faktury po splatnosti' },
    { patterns: ['bank', 'ucet', 'account'], topic: 'bankovní účty' },
    { patterns: ['nastav', 'setting', 'konfigurac'], topic: 'nastavení' },
    { patterns: ['obrat', 'revenue', 'trzb', 'prijem'], topic: 'obrat' },
    { patterns: ['kurz', 'exchange', 'men', 'euro', 'dollar'], topic: 'kurzy' },
  ];

  let detectedTopic = '';
  for (const { patterns, topic } of topicMap) {
    if (patterns.some(p => prevContext.includes(p))) {
      detectedTopic = topic;
      break;
    }
  }

  if (!detectedTopic) {
    // Fallback: extract significant words from previous user question
    const prevWords = noDiac(lastUser.text.toLowerCase()).split(/\s+/).filter(w => w.length > 3);
    const stopWords = new Set(['kolik','kdyz','jake','jaky','jakou','proc','ktere','ktery','moje','moji','mohu','muzu','chci','prosim','porad','treba','jeste','taky','take','potom','potaz','odpoved','otazk']);
    const significant = prevWords.filter(w => !stopWords.has(w)).slice(0, 3);
    if (significant.length > 0) detectedTopic = significant.join(' ');
  }

  if (!detectedTopic) return q;

  // Check if the follow-up query already has its own distinct topic
  // If so, don't pollute it with previous context
  for (const { patterns, topic } of topicMap) {
    if (topic === detectedTopic) continue; // skip same topic
    if (patterns.some(p => qNorm.includes(p))) {
      // Query has its own different topic — treat as independent question
      return q;
    }
  }

  // If the follow-up already contains the detected topic, don't duplicate
  const qHasTopic = noDiac(detectedTopic).split(/\s+/).some(tw => tw.length > 3 && qNorm.includes(tw));
  if (qHasTopic) return q;

  // Append topic context to the query
  return q + ' ' + detectedTopic;
}

// ─── CHATBOT API ──────────────────────────────────────────────
app.post('/api/chatbot/message', ...tenanted, (req, res) => {
  const { message, conversation_id, lang } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'Zpráva je povinná' });

  const rawQ = message.trim().toLowerCase();
  const isEn = lang === 'en' || /^(how|where|what|can|do|i need|help me|show me|my |the |thanks|thank you|bye|goodbye|good morning|good afternoon|good evening|hi |hey |hello|who |i'm |i am )/i.test(message.trim());

  // Resolve follow-up: enrich query with conversation context if needed
  const q = resolveFollowUp(rawQ, conversation_id, req.tenant_id);

  // 0) Early intercept: greetings, thanks, bye (before any KB matching to avoid false positives)
  // Strip common prefixes before testing greetings (e.g., "Prosím Hello" → "Hello")
  const qTestEarly = noDiac(q).replace(/^(prosim|prosím|potrebuji|potřebuji|zajima me|zajímá mě|chtel bych|chtěl bych|rad bych|rád bych)\s+/i, '').trim();
  const earlyGreetings = /^(ahoj|cau|cus|nazdar|zdar|dobry den|dobre rano|dobry vecer|zdravim|hello|hi|hey|hej|good morning|good afternoon|good evening)(?:\b|$)/i;
  const earlyThanks = /^(dekuji|diky|dik|thanks|thank you|diky moc)(?:\b|$)/i;
  const earlyBye = /^(na shledanou|nashledanou|bye|sbohem|nashle|goodbye|cau|zatim|mej se)(?:\b|$)/i;

  if (earlyGreetings.test(qTestEarly)) {
    const greetAnswer = isEn
      ? 'Hello! I am Hyňa, your smart ERP assistant. How can I help you today?'
      : 'Ahoj! Jsem Hyňa, váš chytrý asistent. Jak vám mohu dnes pomoci?';
    // Save and return
    let convId = conversation_id;
    if (convId) {
      const conv = db.prepare('SELECT * FROM chatbot_conversations WHERE id = ? AND tenant_id = ?').get(convId, req.tenant_id);
      if (conv) { const msgs = JSON.parse(conv.messages); msgs.push({ role: 'user', text: message.trim(), ts: new Date().toISOString() }); msgs.push({ role: 'bot', text: greetAnswer, link: null, ts: new Date().toISOString() }); db.prepare("UPDATE chatbot_conversations SET messages = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(msgs), convId); }
    } else {
      const msgs = [{ role: 'user', text: message.trim(), ts: new Date().toISOString() }, { role: 'bot', text: greetAnswer, link: null, ts: new Date().toISOString() }];
      const r = db.prepare('INSERT INTO chatbot_conversations (tenant_id, user_id, messages) VALUES (?, ?, ?)').run(req.tenant_id, req.user.id, JSON.stringify(msgs));
      convId = r.lastInsertRowid;
    }
    return res.json({ answer: greetAnswer, link: null, conversation_id: convId });
  }
  if (earlyThanks.test(qTestEarly)) {
    const thanksAnswer = isEn ? "You're welcome! Anything else I can help with?" : 'Nemáte zač! Mohu ještě s něčím pomoct?';
    let convId = conversation_id;
    if (convId) { const conv = db.prepare('SELECT * FROM chatbot_conversations WHERE id = ? AND tenant_id = ?').get(convId, req.tenant_id); if (conv) { const msgs = JSON.parse(conv.messages); msgs.push({ role: 'user', text: message.trim(), ts: new Date().toISOString() }); msgs.push({ role: 'bot', text: thanksAnswer, link: null, ts: new Date().toISOString() }); db.prepare("UPDATE chatbot_conversations SET messages = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(msgs), convId); } }
    else { const msgs = [{ role: 'user', text: message.trim(), ts: new Date().toISOString() }, { role: 'bot', text: thanksAnswer, link: null, ts: new Date().toISOString() }]; const r = db.prepare('INSERT INTO chatbot_conversations (tenant_id, user_id, messages) VALUES (?, ?, ?)').run(req.tenant_id, req.user.id, JSON.stringify(msgs)); convId = r.lastInsertRowid; }
    return res.json({ answer: thanksAnswer, link: null, conversation_id: convId });
  }
  if (earlyBye.test(qTestEarly)) {
    const byeAnswer = isEn ? 'Goodbye! I am here whenever you need help.' : 'Na shledanou! Jsem tu, kdykoliv budete potřebovat.';
    let convId = conversation_id;
    if (convId) { const conv = db.prepare('SELECT * FROM chatbot_conversations WHERE id = ? AND tenant_id = ?').get(convId, req.tenant_id); if (conv) { const msgs = JSON.parse(conv.messages); msgs.push({ role: 'user', text: message.trim(), ts: new Date().toISOString() }); msgs.push({ role: 'bot', text: byeAnswer, link: null, ts: new Date().toISOString() }); db.prepare("UPDATE chatbot_conversations SET messages = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(msgs), convId); } }
    else { const msgs = [{ role: 'user', text: message.trim(), ts: new Date().toISOString() }, { role: 'bot', text: byeAnswer, link: null, ts: new Date().toISOString() }]; const r = db.prepare('INSERT INTO chatbot_conversations (tenant_id, user_id, messages) VALUES (?, ?, ?)').run(req.tenant_id, req.user.id, JSON.stringify(msgs)); convId = r.lastInsertRowid; }
    return res.json({ answer: byeAnswer, link: null, conversation_id: convId });
  }

  // 1) Try dynamic handlers first (real-time data queries with specific patterns)
  const dynamicResult = getDynamicAnswer(q, req.tenant_id, req.user.id, isEn);

  let answer, link, suggestions;
  if (dynamicResult) {
    answer = dynamicResult.answer;
    link = dynamicResult.link;
  } else {
    // 2) LOCAL AI ENGINE — TF-IDF semantic matching + intent classification + entity extraction + contextual reasoning
    const aiResult = aiEngine.reason(q, req.tenant_id, req.user.id, isEn);
    if (aiResult) {
      answer = aiResult.answer;
      link = aiResult.link;
    } else {
      // 3) Fallback: confused user, too short, or truly unknown
      const qTest = noDiac(q);
      if (q.length < 3 || /^[.!?,;:\s]+$/.test(q)) {
        answer = isEn ? 'Could you please be more specific? Try asking about invoices, clients, or navigation.' : 'Můžete být konkrétnější? Zkuste se zeptat na faktury, klienty nebo navigaci.';
      } else if (/\b(confused|lost|ztracen|nevim co|pomoo+c|simple|jednoduch|zjednoduse|navigate me|make it)\b/i.test(qTest)) {
        answer = isEn
          ? "No worries! Try asking a specific question like:\n• \"How to create an invoice?\"\n• \"Where are clients?\"\n• \"How many invoices do I have?\"\nI'm here to help!"
          : 'Žádný problém! Zkuste se zeptat konkrétně, například:\n• "Jak vytvořím fakturu?"\n• "Kde najdu klienty?"\n• "Kolik mám faktur?"\nJsem tu, abych pomohl!';
      } else {
        // Log unanswered question for self-learning
        db.prepare('INSERT INTO chatbot_unanswered (tenant_id, user_id, question) VALUES (?, ?, ?)').run(req.tenant_id, req.user.id, message.trim());
        answer = isEn
          ? "I'm sorry, I don't know the answer to that yet. Your question has been logged and an administrator will add an answer soon!\n\nHere are some topics I can help you with:"
          : 'Omlouvám se, na tuto otázku zatím neznám odpověď. Váš dotaz byl zaznamenán a administrátor brzy doplní odpověď!\n\nZde jsou témata, se kterými vám mohu pomoci:';
        suggestions = isEn
          ? [
              { label: 'How to create an invoice?', icon: '📄' },
              { label: 'Where are my clients?', icon: '👥' },
              { label: 'Overdue invoices', icon: '⏰' },
              { label: 'How many invoices do I have?', icon: '📊' },
              { label: 'Where is accounting?', icon: '💰' },
              { label: 'What can you do?', icon: '🤖' },
            ]
          : [
              { label: 'Jak vytvořím fakturu?', icon: '📄' },
              { label: 'Kde najdu klienty?', icon: '👥' },
              { label: 'Faktury po splatnosti', icon: '⏰' },
              { label: 'Kolik mám faktur?', icon: '📊' },
              { label: 'Kde je účetnictví?', icon: '💰' },
              { label: 'Co umíš?', icon: '🤖' },
            ];
      }
      link = null;
    }
  }

  // Save conversation
  let convId = conversation_id;
  if (convId) {
    const conv = db.prepare('SELECT * FROM chatbot_conversations WHERE id = ? AND tenant_id = ?').get(convId, req.tenant_id);
    if (conv) {
      const msgs = JSON.parse(conv.messages);
      msgs.push({ role: 'user', text: message.trim(), ts: new Date().toISOString() });
      msgs.push({ role: 'bot', text: answer, link, ts: new Date().toISOString() });
      db.prepare("UPDATE chatbot_conversations SET messages = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(msgs), convId);
    }
  } else {
    const msgs = [
      { role: 'user', text: message.trim(), ts: new Date().toISOString() },
      { role: 'bot', text: answer, link, ts: new Date().toISOString() }
    ];
    const r = db.prepare('INSERT INTO chatbot_conversations (tenant_id, user_id, messages) VALUES (?, ?, ?)').run(req.tenant_id, req.user.id, JSON.stringify(msgs));
    convId = r.lastInsertRowid;
  }

  res.json({ answer, link, conversation_id: convId, ...(suggestions ? { suggestions } : {}) });
});

// Admin: get knowledge base
app.get('/api/chatbot/knowledge', ...tenanted, authorize('admin'), (req, res) => {
  const items = db.prepare('SELECT * FROM chatbot_knowledge WHERE tenant_id = ? OR tenant_id IS NULL ORDER BY priority DESC, category, id').all(req.tenant_id);
  res.json(items);
});

// Admin: create knowledge entry
app.post('/api/chatbot/knowledge', ...tenanted, authorize('admin'), (req, res) => {
  const { keywords, question_cs, question_en, answer_cs, answer_en, link, category, priority } = req.body;
  if (!keywords || !question_cs || !answer_cs) return res.status(400).json({ error: 'keywords, question_cs a answer_cs jsou povinné' });
  const r = db.prepare('INSERT INTO chatbot_knowledge (tenant_id, keywords, question_cs, question_en, answer_cs, answer_en, link, category, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(req.tenant_id, keywords, question_cs, question_en || '', answer_cs, answer_en || '', link || '', category || 'navigation', priority || 0);
  res.json({ id: r.lastInsertRowid });
});

// Admin: update knowledge entry
app.put('/api/chatbot/knowledge/:id', ...tenanted, authorize('admin'), (req, res) => {
  const { keywords, question_cs, question_en, answer_cs, answer_en, link, category, priority, active } = req.body;
  db.prepare('UPDATE chatbot_knowledge SET keywords=?, question_cs=?, question_en=?, answer_cs=?, answer_en=?, link=?, category=?, priority=?, active=? WHERE id=? AND tenant_id=?')
    .run(keywords, question_cs, question_en || '', answer_cs, answer_en || '', link || '', category || 'navigation', priority || 0, active ?? 1, req.params.id, req.tenant_id);
  res.json({ ok: true });
});

// Admin: delete knowledge entry
app.delete('/api/chatbot/knowledge/:id', ...tenanted, authorize('admin'), (req, res) => {
  db.prepare('DELETE FROM chatbot_knowledge WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenant_id);
  res.json({ ok: true });
});

// Admin: get unanswered questions
app.get('/api/chatbot/unanswered', ...tenanted, authorize('admin'), (req, res) => {
  const items = db.prepare(`SELECT u.*, usr.full_name as user_name FROM chatbot_unanswered u LEFT JOIN users usr ON u.user_id = usr.id WHERE u.tenant_id = ? ORDER BY u.resolved ASC, u.created_at DESC`).all(req.tenant_id);
  res.json(items);
});

// Admin: resolve unanswered question (create knowledge entry from it)
app.post('/api/chatbot/unanswered/:id/resolve', ...tenanted, authorize('admin'), (req, res) => {
  const { keywords, answer_cs, answer_en, link, category } = req.body;
  const item = db.prepare('SELECT * FROM chatbot_unanswered WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id);
  if (!item) return res.status(404).json({ error: 'Nenalezeno' });
  if (keywords && answer_cs) {
    db.prepare('INSERT INTO chatbot_knowledge (tenant_id, keywords, question_cs, question_en, answer_cs, answer_en, link, category, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(req.tenant_id, keywords, item.question, '', answer_cs, answer_en || '', link || '', category || 'custom', 5);
  }
  db.prepare('UPDATE chatbot_unanswered SET resolved = 1, answer = ? WHERE id = ?').run(answer_cs || 'Vyřešeno', req.params.id);
  res.json({ ok: true });
});

// Admin: delete unanswered question
app.delete('/api/chatbot/unanswered/:id', ...tenanted, authorize('admin'), (req, res) => {
  db.prepare('DELETE FROM chatbot_unanswered WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenant_id);
  res.json({ ok: true });
});

// GET-based login (bypasses POST issues with port forwarding)
app.get('/api/auth/get-login', (req, res) => {
  const { username, password } = req.query;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Neplatné přihlašovací údaje' });
  }
  if (!user.active) {
    return res.status(403).json({ error: 'Váš účet byl deaktivován. Kontaktujte administrátora.' });
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

// ─── GLOBAL ERROR HANDLER — no stack traces in production ─────
app.use((err, req, res, _next) => {
  // Log full error server-side for debugging
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}:`, err.message);
  // Return generic error to client — no stack traces
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Neplatný formát požadavku' });
  }
  res.status(err.status || 500).json({ error: 'Interní chyba serveru' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => console.log(`ERP server running on http://0.0.0.0:${PORT}`));
