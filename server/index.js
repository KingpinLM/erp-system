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
const { generateToken, authenticate, authorize } = require('./auth');

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
        const lines = data.split('\n').slice(2); // skip header lines
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

// Update rates on startup and every 6 hours
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

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Serve static frontend in production
app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));

// ─── AUTH ────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Neplatné přihlašovací údaje' });
  }
  const token = generateToken(user);
  const { password: _, ...safeUser } = user;
  res.json({ token, user: safeUser });
});

// ─── REGISTRATION ─────────────────────────────────────────────
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
      .run(username, email, hash, full_name, first_name, last_name || '', 'viewer', 0, 'pending');
    res.json({ ok: true, message: 'Registrace úspěšná. Vyčkejte na schválení administrátorem.' });
  } catch (e) {
    res.status(400).json({ error: 'Chyba při registraci' });
  }
});

// ─── PASSWORD RESET ───────────────────────────────────────────
app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!user) return res.json({ ok: true }); // Don't reveal if email exists
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 3600000).toISOString(); // 1 hour
  db.prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?').run(token, expires, user.id);
  // In production, send email. For now, store token and allow admin to see it.
  res.json({ ok: true, message: 'Pokud existuje účet s tímto emailem, byl zaslán odkaz pro reset hesla.' });
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

// ─── PENDING USERS (admin approval) ──────────────────────────
app.get('/api/users/pending', authenticate, authorize('admin'), (req, res) => {
  res.json(db.prepare("SELECT id, username, email, full_name, first_name, last_name, created_at FROM users WHERE status = 'pending'").all());
});

app.post('/api/users/:id/approve', authenticate, authorize('admin'), (req, res) => {
  const { role } = req.body;
  db.prepare("UPDATE users SET active = 1, status = 'active', role = ?, updated_at = datetime('now') WHERE id = ?").run(role || 'viewer', req.params.id);
  res.json({ ok: true });
});

app.post('/api/users/:id/reject', authenticate, authorize('admin'), (req, res) => {
  db.prepare("DELETE FROM users WHERE id = ? AND status = 'pending'").run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  const user = db.prepare('SELECT id, username, email, full_name, first_name, last_name, role, active, signature, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// ─── PROFILE ──────────────────────────────────────────────
app.put('/api/profile', authenticate, (req, res) => {
  const { first_name, last_name, email, password } = req.body;
  const full_name = `${first_name || ''} ${last_name || ''}`.trim();
  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare("UPDATE users SET email=?, full_name=?, first_name=?, last_name=?, password=?, updated_at=datetime('now') WHERE id=?")
      .run(email, full_name, first_name || '', last_name || '', hash, req.user.id);
  } else {
    db.prepare("UPDATE users SET email=?, full_name=?, first_name=?, last_name=?, updated_at=datetime('now') WHERE id=?")
      .run(email, full_name, first_name || '', last_name || '', req.user.id);
  }
  const user = db.prepare('SELECT id, username, email, full_name, first_name, last_name, role, active, signature, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

app.put('/api/profile/signature', authenticate, (req, res) => {
  const { signature } = req.body;
  db.prepare("UPDATE users SET signature = ?, updated_at = datetime('now') WHERE id = ?").run(signature || null, req.user.id);
  res.json({ ok: true });
});

app.get('/api/users/:id/signature', authenticate, (req, res) => {
  const row = db.prepare('SELECT signature FROM users WHERE id = ?').get(req.params.id);
  res.json({ signature: row?.signature || null });
});

// ─── DASHBOARD ───────────────────────────────────────────────
app.get('/api/dashboard', authenticate, (req, res) => {
  const totalRevenue = db.prepare("SELECT COALESCE(SUM(total_czk),0) as val FROM invoices WHERE type='issued' AND status='paid'").get().val;
  const totalExpenses = db.prepare("SELECT COALESCE(SUM(total_czk),0) as val FROM invoices WHERE type='received' AND status='paid'").get().val;
  const unpaidInvoices = db.prepare("SELECT COUNT(*) as val FROM invoices WHERE type='issued' AND status IN ('sent','overdue')").get().val;
  const overdueInvoices = db.prepare("SELECT COUNT(*) as val FROM invoices WHERE status='overdue'").get().val;
  const totalClients = db.prepare("SELECT COUNT(*) as val FROM clients").get().val;
  const draftInvoices = db.prepare("SELECT COUNT(*) as val FROM invoices WHERE status='draft'").get().val;

  const revenueByMonth = db.prepare(`
    SELECT strftime('%Y-%m', paid_date) as month, SUM(total_czk) as total
    FROM invoices WHERE type='issued' AND status='paid' AND paid_date IS NOT NULL
    GROUP BY month ORDER BY month
  `).all();

  const expensesByCategory = db.prepare(`
    SELECT category, SUM(amount) as total FROM evidence WHERE type='expense'
    GROUP BY category ORDER BY total DESC
  `).all();

  const invoicesByStatus = db.prepare(`
    SELECT status, COUNT(*) as count FROM invoices GROUP BY status
  `).all();

  const recentInvoices = db.prepare(`
    SELECT i.*, c.name as client_name FROM invoices i
    LEFT JOIN clients c ON i.client_id = c.id
    ORDER BY i.created_at DESC LIMIT 5
  `).all();

  const topClients = db.prepare(`
    SELECT c.name, SUM(i.total_czk) as total FROM invoices i
    JOIN clients c ON i.client_id = c.id
    WHERE i.type='issued' AND i.status='paid'
    GROUP BY c.id ORDER BY total DESC LIMIT 5
  `).all();

  const currencyBreakdown = db.prepare(`
    SELECT currency, COUNT(*) as count, SUM(total) as total FROM invoices
    WHERE type='issued' GROUP BY currency
  `).all();

  // Monthly chart data - issued invoices by issue month (current year)
  const currentYear = new Date().getFullYear();
  const monthlyIssued = db.prepare(`
    SELECT strftime('%m', issue_date) as month, SUM(total_czk) as total, SUM(tax_amount) as tax
    FROM invoices WHERE type='issued' AND strftime('%Y', issue_date) = ?
    GROUP BY month ORDER BY month
  `).all(String(currentYear));

  const monthlyExpenses = db.prepare(`
    SELECT strftime('%m', date) as month, SUM(amount) as total
    FROM evidence WHERE type='expense' AND strftime('%Y', date) = ?
    GROUP BY month ORDER BY month
  `).all(String(currentYear));

  // Pending items (K vyřízení)
  const pendingItems = [];
  const overdueList = db.prepare(`
    SELECT i.id, i.invoice_number, i.total, i.currency, i.due_date, c.name as client_name
    FROM invoices i LEFT JOIN clients c ON i.client_id = c.id
    WHERE i.status = 'overdue' ORDER BY i.due_date
  `).all();
  overdueList.forEach(i => pendingItems.push({ type: 'overdue', ...i }));

  const draftList = db.prepare(`
    SELECT i.id, i.invoice_number, i.total, i.currency, c.name as client_name
    FROM invoices i LEFT JOIN clients c ON i.client_id = c.id
    WHERE i.status = 'draft' ORDER BY i.created_at DESC
  `).all();
  draftList.forEach(i => pendingItems.push({ type: 'draft', ...i }));

  const unpaidList = db.prepare(`
    SELECT i.id, i.invoice_number, i.total, i.currency, i.due_date, c.name as client_name
    FROM invoices i LEFT JOIN clients c ON i.client_id = c.id
    WHERE i.status = 'sent' ORDER BY i.due_date
  `).all();
  unpaidList.forEach(i => pendingItems.push({ type: 'unpaid', ...i }));

  const pendingUsers = db.prepare("SELECT COUNT(*) as val FROM users WHERE status = 'pending'").get().val;

  res.json({
    kpis: { totalRevenue, totalExpenses, profit: totalRevenue - totalExpenses, unpaidInvoices, overdueInvoices, totalClients, draftInvoices, pendingUsers },
    revenueByMonth, expensesByCategory, invoicesByStatus, recentInvoices, topClients, currencyBreakdown,
    monthlyIssued, monthlyExpenses, pendingItems
  });
});

// ─── CURRENCIES ──────────────────────────────────────────────
app.get('/api/currencies', authenticate, (req, res) => {
  res.json(db.prepare('SELECT * FROM currencies ORDER BY code').all());
});

app.put('/api/currencies/:code', authenticate, authorize('admin', 'accountant'), (req, res) => {
  const { rate_to_czk } = req.body;
  db.prepare("UPDATE currencies SET rate_to_czk = ?, updated_at = datetime('now') WHERE code = ?").run(rate_to_czk, req.params.code);
  res.json({ ok: true });
});

// ─── CLIENTS ─────────────────────────────────────────────────
app.get('/api/clients', authenticate, (req, res) => {
  res.json(db.prepare('SELECT * FROM clients ORDER BY name').all());
});

app.post('/api/clients', authenticate, authorize('admin', 'accountant', 'manager'), (req, res) => {
  const { name, ico, dic, email, phone, address, city, zip, country } = req.body;
  const result = db.prepare('INSERT INTO clients (name, ico, dic, email, phone, address, city, zip, country) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(name, ico || null, dic || null, email || null, phone || null, address || null, city || null, zip || null, country || 'CZ');
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/clients/:id', authenticate, authorize('admin', 'accountant', 'manager'), (req, res) => {
  const { name, ico, dic, email, phone, address, city, zip, country } = req.body;
  db.prepare('UPDATE clients SET name=?, ico=?, dic=?, email=?, phone=?, address=?, city=?, zip=?, country=? WHERE id=?')
    .run(name, ico, dic, email, phone, address, city, zip, country, req.params.id);
  res.json({ ok: true });
});

app.get('/api/clients/:id', authenticate, (req, res) => {
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Klient nenalezen' });
  res.json(client);
});

app.get('/api/clients/:id/invoices', authenticate, (req, res) => {
  res.json(db.prepare('SELECT * FROM invoices WHERE client_id = ? ORDER BY created_at DESC').all(req.params.id));
});

app.delete('/api/clients/:id', authenticate, authorize('admin'), (req, res) => {
  db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
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

// Variable symbol = year (last 2 digits) + counter padded to 8 digits total
function generateVariableSymbol(comp) {
  const counter = comp?.invoice_counter || 1;
  const year = new Date().getFullYear() % 100;
  return String(year) + String(counter).padStart(6, '0');
}

app.get('/api/invoices/next-number', authenticate, (req, res) => {
  const comp = db.prepare('SELECT * FROM company WHERE id = 1').get();
  res.json({ number: generateInvoiceNumber(comp), variable_symbol: generateVariableSymbol(comp) });
});

// QR payment code (SPD - Short Payment Descriptor, Czech standard)
app.get('/api/invoices/:id/qr', authenticate, async (req, res) => {
  try {
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Faktura nenalezena' });
    const company = db.prepare('SELECT * FROM company WHERE id = 1').get();
    if (!company) return res.status(400).json({ error: 'Není nastavena společnost' });

    // Build SPD string (Czech QR payment standard)
    const parts = ['SPD*1.0'];
    if (company.iban) {
      parts.push(`ACC:${company.iban.replace(/\s/g, '')}`);
    } else if (company.bank_account) {
      // Convert Czech account number to IBAN-like format or use directly
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

app.get('/api/invoices', authenticate, (req, res) => {
  const { type, status, currency } = req.query;
  let sql = `SELECT i.*, c.name as client_name FROM invoices i LEFT JOIN clients c ON i.client_id = c.id WHERE 1=1`;
  const params = [];
  if (type) { sql += ' AND i.type = ?'; params.push(type); }
  if (status) { sql += ' AND i.status = ?'; params.push(status); }
  if (currency) { sql += ' AND i.currency = ?'; params.push(currency); }
  sql += ' ORDER BY i.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/invoices/:id', authenticate, (req, res) => {
  const invoice = db.prepare(`
    SELECT i.*, c.name as client_name, c.ico as client_ico, c.dic as client_dic,
      c.address as client_address, c.city as client_city, c.zip as client_zip, c.email as client_email,
      u.full_name as created_by_name, u.signature as created_by_signature
    FROM invoices i
    LEFT JOIN clients c ON i.client_id = c.id
    LEFT JOIN users u ON i.created_by = u.id
    WHERE i.id = ?
  `).get(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Faktura nenalezena' });
  invoice.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(req.params.id);
  res.json(invoice);
});

app.post('/api/invoices', authenticate, authorize('admin', 'accountant'), (req, res) => {
  const { invoice_number, client_id, issue_date, due_date, supply_date, payment_method, status, currency, note, items, variable_symbol } = req.body;
  const curr = db.prepare('SELECT rate_to_czk FROM currencies WHERE code = ?').get(currency || 'CZK');
  const rate = curr ? curr.rate_to_czk : 1;

  // Auto-generate invoice number and variable symbol if not provided
  let finalNumber = invoice_number;
  let finalVS = variable_symbol;
  const comp = db.prepare('SELECT * FROM company WHERE id = 1').get();
  if (!finalNumber) {
    finalNumber = generateInvoiceNumber(comp);
    db.prepare('UPDATE company SET invoice_counter = ? WHERE id = 1').run((comp?.invoice_counter || 1) + 1);
  }
  if (!finalVS) {
    finalVS = generateVariableSymbol(comp);
  }

  // Calculate totals from per-item tax rates
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
    INSERT INTO invoices (invoice_number, type, client_id, issue_date, due_date, supply_date, payment_method, status, currency, subtotal, tax_rate, tax_amount, total, total_czk, note, created_by, variable_symbol)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(finalNumber, 'issued', client_id, issue_date, due_date, supply_date || issue_date, payment_method || 'bank_transfer', status || 'draft', currency || 'CZK', subtotal, 0, totalTax, total, totalCzk, note || null, req.user.id, finalVS);

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

  db.prepare("INSERT INTO audit_log (user_id, action, entity, entity_id, details) VALUES (?, 'create', 'invoice', ?, ?)").run(req.user.id, invoiceId, `Vytvořena faktura ${finalNumber}`);
  res.json({ id: invoiceId });
});

app.put('/api/invoices/:id', authenticate, authorize('admin', 'accountant'), (req, res) => {
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
    db.prepare(`UPDATE invoices SET invoice_number=?, ${baseFields} WHERE id=?`).run(invoice_number, ...baseParams, req.params.id);
  } else {
    db.prepare(`UPDATE invoices SET ${baseFields} WHERE id=?`).run(...baseParams, req.params.id);
  }

  db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(req.params.id);
  const insertItem = db.prepare('INSERT INTO invoice_items (invoice_id, description, quantity, unit, unit_price, total, tax_rate, tax_amount, total_with_tax) VALUES (?,?,?,?,?,?,?,?,?)');
  if (items) {
    items.forEach(i => {
      const lineTotal = (i.quantity || 1) * (i.unit_price || 0);
      const lineTaxRate = i.tax_rate ?? 21;
      const lineTax = lineTotal * (lineTaxRate / 100);
      insertItem.run(req.params.id, i.description, i.quantity || 1, i.unit || 'ks', i.unit_price || 0, lineTotal, lineTaxRate, lineTax, lineTotal + lineTax);
    });
  }

  db.prepare("INSERT INTO audit_log (user_id, action, entity, entity_id, details) VALUES (?, 'update', 'invoice', ?, ?)").run(req.user.id, req.params.id, `Upravena faktura`);
  res.json({ ok: true });
});

app.patch('/api/invoices/:id/status', authenticate, authorize('admin', 'accountant', 'manager'), (req, res) => {
  const { status, paid_date } = req.body;
  if (paid_date) {
    db.prepare("UPDATE invoices SET status=?, paid_date=?, updated_at=datetime('now') WHERE id=?").run(status, paid_date, req.params.id);
  } else {
    db.prepare("UPDATE invoices SET status=?, updated_at=datetime('now') WHERE id=?").run(status, req.params.id);
  }
  db.prepare("INSERT INTO audit_log (user_id, action, entity, entity_id, details) VALUES (?, 'status_change', 'invoice', ?, ?)").run(req.user.id, req.params.id, `Status změněn na ${status}`);
  res.json({ ok: true });
});

app.delete('/api/invoices/:id', authenticate, authorize('admin'), (req, res) => {
  db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─── EVIDENCE ────────────────────────────────────────────────
app.get('/api/evidence', authenticate, (req, res) => {
  const { type, category } = req.query;
  let sql = 'SELECT e.*, u.full_name as created_by_name FROM evidence e LEFT JOIN users u ON e.created_by = u.id WHERE 1=1';
  const params = [];
  if (type) { sql += ' AND e.type = ?'; params.push(type); }
  if (category) { sql += ' AND e.category = ?'; params.push(category); }
  sql += ' ORDER BY e.date DESC';
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/evidence', authenticate, authorize('admin', 'accountant', 'manager'), (req, res) => {
  const { type, title, description, amount, currency, date, category, invoice_id, file_path, original_filename } = req.body;
  const result = db.prepare('INSERT INTO evidence (type, title, description, amount, currency, date, category, invoice_id, created_by, file_path, original_filename) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(type, title, description || null, amount || null, currency || 'CZK', date, category || null, invoice_id || null, req.user.id, file_path || null, original_filename || null);
  if (category) learnCategory(title, description, category);
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/evidence/:id', authenticate, authorize('admin', 'accountant'), (req, res) => {
  const { type, title, description, amount, currency, date, category, invoice_id } = req.body;
  db.prepare('UPDATE evidence SET type=?, title=?, description=?, amount=?, currency=?, date=?, category=?, invoice_id=? WHERE id=?')
    .run(type, title, description, amount, currency, date, category, invoice_id || null, req.params.id);
  if (category) learnCategory(title, description, category);
  res.json({ ok: true });
});

app.delete('/api/evidence/:id', authenticate, authorize('admin'), (req, res) => {
  db.prepare('DELETE FROM evidence WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─── USERS ───────────────────────────────────────────────────
app.get('/api/users', authenticate, authorize('admin'), (req, res) => {
  res.json(db.prepare('SELECT id, username, email, full_name, first_name, last_name, role, active, created_at, updated_at FROM users ORDER BY id').all());
});

app.get('/api/users/:id', authenticate, authorize('admin'), (req, res) => {
  const user = db.prepare('SELECT id, username, email, full_name, first_name, last_name, role, active, signature, created_at, updated_at FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Uživatel nenalezen' });
  // Get user stats
  const invoiceCount = db.prepare("SELECT COUNT(*) as cnt FROM invoices WHERE created_by = ?").get(req.params.id).cnt;
  const lastLogin = user.updated_at;
  res.json({ ...user, invoice_count: invoiceCount });
});

app.post('/api/users', authenticate, authorize('admin'), (req, res) => {
  const { username, email, password, first_name, last_name, role } = req.body;
  const full_name = `${first_name || ''} ${last_name || ''}`.trim();
  const hash = bcrypt.hashSync(password, 10);
  try {
    const result = db.prepare('INSERT INTO users (username, email, password, full_name, first_name, last_name, role) VALUES (?,?,?,?,?,?,?)').run(username, email, hash, full_name, first_name || '', last_name || '', role || 'viewer');
    res.json({ id: result.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: 'Uživatel s tímto jménem nebo emailem již existuje' });
  }
});

app.put('/api/users/:id', authenticate, authorize('admin'), (req, res) => {
  const { email, first_name, last_name, role, active, password } = req.body;
  const full_name = `${first_name || ''} ${last_name || ''}`.trim();
  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare("UPDATE users SET email=?, full_name=?, first_name=?, last_name=?, role=?, active=?, password=?, updated_at=datetime('now') WHERE id=?").run(email, full_name, first_name||'', last_name||'', role, active, hash, req.params.id);
  } else {
    db.prepare("UPDATE users SET email=?, full_name=?, first_name=?, last_name=?, role=?, active=?, updated_at=datetime('now') WHERE id=?").run(email, full_name, first_name||'', last_name||'', role, active, req.params.id);
  }
  res.json({ ok: true });
});

app.put('/api/users/:id/signature', authenticate, authorize('admin'), (req, res) => {
  const { signature } = req.body;
  db.prepare("UPDATE users SET signature = ?, updated_at = datetime('now') WHERE id = ?").run(signature || null, req.params.id);
  res.json({ ok: true });
});

// ─── COMPANY ─────────────────────────────────────────────────
app.get('/api/company', authenticate, (req, res) => {
  res.json(db.prepare('SELECT * FROM company WHERE id = 1').get() || {});
});

app.put('/api/company', authenticate, authorize('admin'), (req, res) => {
  const { name, ico, dic, email, phone, address, city, zip, country, bank_account, bank_code, iban, swift, invoice_prefix, invoice_counter, default_due_days, vat_payer, invoice_format, invoice_separator, invoice_padding, invoice_year_format } = req.body;
  db.prepare('INSERT OR REPLACE INTO company (id,name,ico,dic,email,phone,address,city,zip,country,bank_account,bank_code,iban,swift,invoice_prefix,invoice_counter,default_due_days,vat_payer,invoice_format,invoice_separator,invoice_padding,invoice_year_format) VALUES (1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(name,ico||null,dic||null,email||null,phone||null,address||null,city||null,zip||null,country||'CZ',bank_account||null,bank_code||null,iban||null,swift||null,invoice_prefix||'FV',invoice_counter||1,default_due_days||14,vat_payer?1:0,invoice_format||'{prefix}{sep}{year}{sep}{num}',invoice_separator||'-',invoice_padding||3,invoice_year_format||'full');
  res.json({ ok: true });
});

// ─── CNB RATES REFRESH ──────────────────────────────────────
app.post('/api/currencies/refresh', authenticate, authorize('admin'), async (req, res) => {
  try {
    await updateRates();
    const currencies = db.prepare('SELECT * FROM currencies ORDER BY code').all();
    res.json(currencies);
  } catch (e) {
    res.status(500).json({ error: 'Nepodařilo se aktualizovat kurzy' });
  }
});

// ─── AUDIT LOG ───────────────────────────────────────────────
app.get('/api/audit-log', authenticate, authorize('admin'), (req, res) => {
  res.json(db.prepare('SELECT a.*, u.full_name as user_name FROM audit_log a LEFT JOIN users u ON a.user_id = u.id ORDER BY a.created_at DESC LIMIT 100').all());
});

// ─── PDF/ZIP UPLOAD & EXPENSE EXTRACTION ────────────────────
function extractExpenseFromText(text) {
  const result = { title: '', amount: null, date: null, category: null };
  // Try to extract amount (Czech format: 1 234,56 or 1234.56)
  const amountMatch = text.match(/(?:celkem|total|k úhradě|částka|suma|amount)[:\s]*([0-9\s]+[.,]\d{2})/i)
    || text.match(/([0-9\s]{1,10}[.,]\d{2})\s*(?:Kč|CZK|EUR|USD)/i)
    || text.match(/(?:Kč|CZK|EUR|USD)\s*([0-9\s]{1,10}[.,]\d{2})/i);
  if (amountMatch) {
    result.amount = parseFloat(amountMatch[1].replace(/\s/g, '').replace(',', '.'));
  }
  // Try to extract date (DD.MM.YYYY or YYYY-MM-DD)
  const dateMatch = text.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/) || text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) {
    if (dateMatch[3] && dateMatch[3].length === 4) {
      result.date = `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
    } else if (dateMatch[1] && dateMatch[1].length === 4) {
      result.date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    }
  }
  // Title from first meaningful line
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3 && l.length < 100);
  result.title = lines[0] || 'Importovaný doklad';
  return result;
}

function suggestCategory(text) {
  // First check learned rules
  const rules = db.prepare('SELECT keyword, category, weight FROM category_rules ORDER BY weight DESC').all();
  const lowerText = text.toLowerCase();
  for (const rule of rules) {
    if (lowerText.includes(rule.keyword.toLowerCase())) {
      return rule.category;
    }
  }
  return null;
}

function learnCategory(title, description, category) {
  if (!category) return;
  // Extract keywords from title
  const words = (title + ' ' + (description || '')).toLowerCase().split(/\s+/).filter(w => w.length > 3);
  words.forEach(word => {
    const existing = db.prepare('SELECT id, weight FROM category_rules WHERE keyword = ? AND category = ?').get(word, category);
    if (existing) {
      db.prepare('UPDATE category_rules SET weight = weight + 1 WHERE id = ?').run(existing.id);
    } else {
      db.prepare('INSERT INTO category_rules (keyword, category) VALUES (?, ?)').run(word, category);
    }
  });
}

app.post('/api/evidence/upload', authenticate, authorize('admin', 'accountant', 'manager'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Žádný soubor' });
    const results = [];

    const processFile = async (filePath, originalName) => {
      if (originalName.toLowerCase().endsWith('.pdf')) {
        const buffer = fs.readFileSync(filePath);
        const data = await pdfParse(buffer);
        const extracted = extractExpenseFromText(data.text);
        const category = suggestCategory(data.text);
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
      fs.unlinkSync(req.file.path); // remove zip
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
app.get('/api/categories', authenticate, (req, res) => {
  // Get distinct categories from evidence + rules
  const fromEvidence = db.prepare("SELECT DISTINCT category FROM evidence WHERE category IS NOT NULL AND category != '' ORDER BY category").all().map(r => r.category);
  const fromRules = db.prepare("SELECT DISTINCT category FROM category_rules ORDER BY category").all().map(r => r.category);
  const all = [...new Set([...fromEvidence, ...fromRules])].sort();
  res.json(all);
});

app.get('/api/category-rules', authenticate, authorize('admin'), (req, res) => {
  res.json(db.prepare('SELECT * FROM category_rules ORDER BY category, weight DESC').all());
});

app.delete('/api/category-rules/:id', authenticate, authorize('admin'), (req, res) => {
  db.prepare('DELETE FROM category_rules WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Override: when user sets/changes category on evidence, learn from it
const origEvidencePost = '/api/evidence';

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`ERP server running on http://localhost:${PORT}`));
