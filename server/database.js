const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'erp.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── TENANTS ──────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS superadmins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ─── TENANT DATA TABLES ──────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('admin','accountant','manager','viewer')),
    active INTEGER NOT NULL DEFAULT 1,
    signature TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(tenant_id, username),
    UNIQUE(tenant_id, email)
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
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
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
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    invoice_number TEXT NOT NULL,
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
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(tenant_id, invoice_number)
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
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
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
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id INTEGER,
    details TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS company (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER UNIQUE NOT NULL REFERENCES tenants(id),
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

  CREATE TABLE IF NOT EXISTS category_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    keyword TEXT NOT NULL,
    category TEXT NOT NULL,
    weight INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ─── MIGRATIONS ──────────────────────────────────────────
// Add columns that may not exist yet
const safeAlter = (sql) => { try { db.exec(sql); } catch (e) { /* already exists */ } };

// Users
safeAlter('ALTER TABLE users ADD COLUMN signature TEXT');
safeAlter('ALTER TABLE users ADD COLUMN first_name TEXT');
safeAlter('ALTER TABLE users ADD COLUMN last_name TEXT');
safeAlter("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'");
safeAlter('ALTER TABLE users ADD COLUMN reset_token TEXT');
safeAlter('ALTER TABLE users ADD COLUMN reset_token_expires TEXT');
safeAlter('ALTER TABLE users ADD COLUMN tenant_id INTEGER REFERENCES tenants(id)');

// Invoices
safeAlter('ALTER TABLE invoices ADD COLUMN supply_date TEXT');
safeAlter("ALTER TABLE invoices ADD COLUMN payment_method TEXT DEFAULT 'bank_transfer'");
safeAlter('ALTER TABLE invoices ADD COLUMN variable_symbol TEXT');
safeAlter('ALTER TABLE invoices ADD COLUMN tenant_id INTEGER REFERENCES tenants(id)');

// Invoice items
safeAlter('ALTER TABLE invoice_items ADD COLUMN tax_rate REAL DEFAULT 21');
safeAlter('ALTER TABLE invoice_items ADD COLUMN tax_amount REAL DEFAULT 0');
safeAlter('ALTER TABLE invoice_items ADD COLUMN total_with_tax REAL DEFAULT 0');

// Company
safeAlter('ALTER TABLE company ADD COLUMN default_due_days INTEGER DEFAULT 14');
safeAlter('ALTER TABLE company ADD COLUMN vat_payer INTEGER DEFAULT 0');
safeAlter("ALTER TABLE company ADD COLUMN invoice_format TEXT DEFAULT '{prefix}{sep}{year}{sep}{num}'");
safeAlter("ALTER TABLE company ADD COLUMN invoice_separator TEXT DEFAULT '-'");
safeAlter('ALTER TABLE company ADD COLUMN invoice_padding INTEGER DEFAULT 3');
safeAlter("ALTER TABLE company ADD COLUMN invoice_year_format TEXT DEFAULT 'full'");
safeAlter('ALTER TABLE company ADD COLUMN bank_code TEXT');
safeAlter('ALTER TABLE company ADD COLUMN tenant_id INTEGER REFERENCES tenants(id)');

// Evidence
safeAlter('ALTER TABLE evidence ADD COLUMN file_path TEXT');
safeAlter('ALTER TABLE evidence ADD COLUMN original_filename TEXT');
safeAlter('ALTER TABLE evidence ADD COLUMN tenant_id INTEGER REFERENCES tenants(id)');

// Clients
safeAlter('ALTER TABLE clients ADD COLUMN tenant_id INTEGER REFERENCES tenants(id)');

// Audit log
safeAlter('ALTER TABLE audit_log ADD COLUMN tenant_id INTEGER REFERENCES tenants(id)');

// Category rules
safeAlter('ALTER TABLE category_rules ADD COLUMN tenant_id INTEGER REFERENCES tenants(id)');

// Migrate full_name → first_name + last_name for existing data
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

// Migrate orphan data (only for upgrades from pre-multi-tenant DB)
try {
  const orphanUsers = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE tenant_id IS NULL").get().cnt;
  if (orphanUsers > 0) {
    let tenant = db.prepare("SELECT id FROM tenants WHERE slug = 'rfi'").get();
    if (!tenant) {
      db.prepare("INSERT INTO tenants (name, slug) VALUES ('Výchozí firma', 'rfi')").run();
      tenant = db.prepare("SELECT id FROM tenants WHERE slug = 'rfi'").get();
    }
    const tid = tenant.id;
    // Migrate orphan rows to default tenant
    db.prepare("UPDATE users SET tenant_id = ? WHERE tenant_id IS NULL").run(tid);
    db.prepare("UPDATE clients SET tenant_id = ? WHERE tenant_id IS NULL").run(tid);
    db.prepare("UPDATE invoices SET tenant_id = ? WHERE tenant_id IS NULL").run(tid);
    db.prepare("UPDATE evidence SET tenant_id = ? WHERE tenant_id IS NULL").run(tid);
    db.prepare("UPDATE audit_log SET tenant_id = ? WHERE tenant_id IS NULL").run(tid);
    db.prepare("UPDATE category_rules SET tenant_id = ? WHERE tenant_id IS NULL").run(tid);
    // Migrate company row
    const comp = db.prepare("SELECT id FROM company WHERE id = 1").get();
    if (comp) {
      db.prepare("UPDATE company SET tenant_id = ? WHERE tenant_id IS NULL").run(tid);
    }
  }
} catch (e) { /* ok */ }

// Set invoice counter based on existing invoices
try {
  const tenants = db.prepare("SELECT id FROM tenants").all();
  tenants.forEach(t => {
    const maxNum = db.prepare("SELECT COUNT(*) as cnt FROM invoices WHERE tenant_id = ?").get(t.id).cnt;
    const comp = db.prepare("SELECT invoice_counter FROM company WHERE tenant_id = ?").get(t.id);
    if (comp && comp.invoice_counter <= 1 && maxNum > 0) {
      db.prepare("UPDATE company SET invoice_counter = ? WHERE tenant_id = ?").run(maxNum + 1, t.id);
    }
  });
} catch (e) { /* ok */ }

module.exports = db;
