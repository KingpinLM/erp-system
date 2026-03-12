const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'erp.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('admin','accountant','manager','viewer')),
    active INTEGER NOT NULL DEFAULT 1,
    signature TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS currencies (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    rate_to_czk REAL NOT NULL DEFAULT 1.0,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    ico TEXT,
    dic TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    zip TEXT,
    country TEXT DEFAULT 'CZ',
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL DEFAULT 'issued' CHECK(type IN ('issued','received')),
    client_id INTEGER REFERENCES clients(id),
    issue_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    paid_date TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','paid','overdue','cancelled')),
    currency TEXT NOT NULL DEFAULT 'CZK' REFERENCES currencies(code),
    subtotal REAL NOT NULL DEFAULT 0,
    tax_rate REAL NOT NULL DEFAULT 21,
    tax_amount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    total_czk REAL NOT NULL DEFAULT 0,
    note TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    unit TEXT DEFAULT 'ks',
    unit_price REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS evidence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('income','expense','asset','document')),
    title TEXT NOT NULL,
    description TEXT,
    amount REAL,
    currency TEXT DEFAULT 'CZK' REFERENCES currencies(code),
    date TEXT NOT NULL,
    category TEXT,
    invoice_id INTEGER REFERENCES invoices(id),
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id INTEGER,
    details TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS company (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT NOT NULL,
    ico TEXT,
    dic TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    zip TEXT,
    country TEXT DEFAULT 'CZ',
    bank_account TEXT,
    iban TEXT,
    swift TEXT,
    invoice_prefix TEXT DEFAULT 'FV',
    invoice_counter INTEGER DEFAULT 1
  );
`);

// Migrations - add columns to existing tables
try { db.exec('ALTER TABLE users ADD COLUMN signature TEXT'); } catch (e) { /* already exists */ }
try { db.exec('ALTER TABLE users ADD COLUMN first_name TEXT'); } catch (e) { /* already exists */ }
try { db.exec('ALTER TABLE users ADD COLUMN last_name TEXT'); } catch (e) { /* already exists */ }
// Invoice: DUZP, payment_method
try { db.exec('ALTER TABLE invoices ADD COLUMN supply_date TEXT'); } catch (e) { /* already exists */ }
try { db.exec('ALTER TABLE invoices ADD COLUMN payment_method TEXT DEFAULT \'bank_transfer\''); } catch (e) { /* already exists */ }
// Invoice items: per-item VAT
try { db.exec('ALTER TABLE invoice_items ADD COLUMN tax_rate REAL DEFAULT 21'); } catch (e) { /* already exists */ }
try { db.exec('ALTER TABLE invoice_items ADD COLUMN tax_amount REAL DEFAULT 0'); } catch (e) { /* already exists */ }
try { db.exec('ALTER TABLE invoice_items ADD COLUMN total_with_tax REAL DEFAULT 0'); } catch (e) { /* already exists */ }
// Company: default due days
try { db.exec('ALTER TABLE company ADD COLUMN default_due_days INTEGER DEFAULT 14'); } catch (e) { /* already exists */ }
try { db.exec('ALTER TABLE company ADD COLUMN vat_payer INTEGER DEFAULT 0'); } catch (e) { /* already exists */ }
// Invoice numbering format options
try { db.exec("ALTER TABLE company ADD COLUMN invoice_format TEXT DEFAULT '{prefix}{sep}{year}{sep}{num}'"); } catch (e) { /* already exists */ }
try { db.exec("ALTER TABLE company ADD COLUMN invoice_separator TEXT DEFAULT '-'"); } catch (e) { /* already exists */ }
try { db.exec('ALTER TABLE company ADD COLUMN invoice_padding INTEGER DEFAULT 3'); } catch (e) { /* already exists */ }
try { db.exec("ALTER TABLE company ADD COLUMN invoice_year_format TEXT DEFAULT 'full'"); } catch (e) { /* already exists */ }
// Evidence: category_rules for auto-learning
try { db.exec("ALTER TABLE evidence ADD COLUMN file_path TEXT"); } catch (e) { /* already exists */ }
try { db.exec("ALTER TABLE evidence ADD COLUMN original_filename TEXT"); } catch (e) { /* already exists */ }
try { db.exec(`CREATE TABLE IF NOT EXISTS category_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL,
  category TEXT NOT NULL,
  weight INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
)`); } catch (e) { /* already exists */ }
// Migrate full_name → first_name + last_name
try {
  const users = db.prepare("SELECT id, full_name, first_name FROM users WHERE first_name IS NULL AND full_name IS NOT NULL").all();
  const upd = db.prepare("UPDATE users SET first_name = ?, last_name = ? WHERE id = ?");
  users.forEach(u => {
    const parts = u.full_name.trim().split(/\s+/);
    const first = parts[0] || '';
    const last = parts.slice(1).join(' ') || '';
    upd.run(first, last, u.id);
  });
} catch (e) { /* ok */ }
try { db.exec('ALTER TABLE company ADD COLUMN invoice_prefix TEXT DEFAULT \'FV\''); } catch (e) { /* already exists */ }
try { db.exec('ALTER TABLE company ADD COLUMN invoice_counter INTEGER DEFAULT 1'); } catch (e) { /* already exists */ }
// Set counter based on existing invoices
try {
  const maxNum = db.prepare("SELECT COUNT(*) as cnt FROM invoices").get().cnt;
  const comp = db.prepare("SELECT invoice_counter FROM company WHERE id = 1").get();
  if (comp && comp.invoice_counter <= 1 && maxNum > 0) {
    db.prepare("UPDATE company SET invoice_counter = ? WHERE id = 1").run(maxNum + 1);
  }
} catch (e) { /* ok */ }

module.exports = db;
