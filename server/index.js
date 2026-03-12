const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const db = require('./database');
const bcrypt = require('bcryptjs');
const { generateToken, authenticate, authorize } = require('./auth');

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

app.get('/api/auth/me', authenticate, (req, res) => {
  const user = db.prepare('SELECT id, username, email, full_name, first_name, last_name, role, active, signature, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// ─── PROFILE / SIGNATURE ───────────────────────────────────
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

  res.json({
    kpis: { totalRevenue, totalExpenses, profit: totalRevenue - totalExpenses, unpaidInvoices, overdueInvoices, totalClients, draftInvoices },
    revenueByMonth, expensesByCategory, invoicesByStatus, recentInvoices, topClients, currencyBreakdown
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

app.delete('/api/clients/:id', authenticate, authorize('admin'), (req, res) => {
  db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─── INVOICES ────────────────────────────────────────────────
app.get('/api/invoices/next-number', authenticate, (req, res) => {
  const comp = db.prepare('SELECT invoice_prefix, invoice_counter FROM company WHERE id = 1').get();
  const prefix = comp?.invoice_prefix || 'FV';
  const counter = comp?.invoice_counter || 1;
  const year = new Date().getFullYear();
  const number = `${prefix}-${year}-${String(counter).padStart(3, '0')}`;
  res.json({ number });
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
  const { invoice_number, client_id, issue_date, due_date, supply_date, payment_method, status, currency, note, items } = req.body;
  const curr = db.prepare('SELECT rate_to_czk FROM currencies WHERE code = ?').get(currency || 'CZK');
  const rate = curr ? curr.rate_to_czk : 1;

  // Auto-generate invoice number if not provided
  let finalNumber = invoice_number;
  if (!finalNumber) {
    const comp = db.prepare('SELECT invoice_prefix, invoice_counter FROM company WHERE id = 1').get();
    const prefix = comp?.invoice_prefix || 'FV';
    const counter = comp?.invoice_counter || 1;
    const year = new Date().getFullYear();
    finalNumber = `${prefix}-${year}-${String(counter).padStart(3, '0')}`;
    db.prepare('UPDATE company SET invoice_counter = ? WHERE id = 1').run(counter + 1);
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
    INSERT INTO invoices (invoice_number, type, client_id, issue_date, due_date, supply_date, payment_method, status, currency, subtotal, tax_rate, tax_amount, total, total_czk, note, created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(finalNumber, 'issued', client_id, issue_date, due_date, supply_date || issue_date, payment_method || 'bank_transfer', status || 'draft', currency || 'CZK', subtotal, 0, totalTax, total, totalCzk, note || null, req.user.id);

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
  const { type, title, description, amount, currency, date, category, invoice_id } = req.body;
  const result = db.prepare('INSERT INTO evidence (type, title, description, amount, currency, date, category, invoice_id, created_by) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(type, title, description || null, amount || null, currency || 'CZK', date, category || null, invoice_id || null, req.user.id);
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/evidence/:id', authenticate, authorize('admin', 'accountant'), (req, res) => {
  const { type, title, description, amount, currency, date, category, invoice_id } = req.body;
  db.prepare('UPDATE evidence SET type=?, title=?, description=?, amount=?, currency=?, date=?, category=?, invoice_id=? WHERE id=?')
    .run(type, title, description, amount, currency, date, category, invoice_id || null, req.params.id);
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
  const { name, ico, dic, email, phone, address, city, zip, country, bank_account, iban, swift, invoice_prefix, invoice_counter, default_due_days, vat_payer } = req.body;
  db.prepare('INSERT OR REPLACE INTO company (id,name,ico,dic,email,phone,address,city,zip,country,bank_account,iban,swift,invoice_prefix,invoice_counter,default_due_days,vat_payer) VALUES (1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(name,ico||null,dic||null,email||null,phone||null,address||null,city||null,zip||null,country||'CZ',bank_account||null,iban||null,swift||null,invoice_prefix||'FV',invoice_counter||1,default_due_days||14,vat_payer?1:0);
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

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`ERP server running on http://localhost:${PORT}`));
