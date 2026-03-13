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
    invite_code TEXT UNIQUE,
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

// ─── USERS (globally unique username/email, nullable tenant_id) ──
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER REFERENCES tenants(id),
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

  CREATE TABLE IF NOT EXISTS recurring_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    client_id INTEGER REFERENCES clients(id),
    currency TEXT NOT NULL DEFAULT 'CZK' REFERENCES currencies(code),
    payment_method TEXT DEFAULT 'bank_transfer',
    note TEXT,
    items TEXT NOT NULL,
    interval TEXT NOT NULL DEFAULT 'monthly' CHECK(interval IN ('weekly','monthly','quarterly','yearly')),
    next_date TEXT NOT NULL,
    end_date TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invoice_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CZK',
    date TEXT NOT NULL,
    note TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ─── ACCOUNTING (podvojné účetnictví) ────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    account_number TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('asset','liability','equity','revenue','expense')),
    parent_id INTEGER REFERENCES chart_of_accounts(id),
    is_group INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(tenant_id, account_number)
  );

  CREATE TABLE IF NOT EXISTS accounting_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    is_closed INTEGER DEFAULT 0,
    closed_at TEXT,
    closed_by INTEGER REFERENCES users(id),
    UNIQUE(tenant_id, year, month)
  );

  CREATE TABLE IF NOT EXISTS journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    entry_number TEXT NOT NULL,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    document_type TEXT,
    document_id INTEGER,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft','posted','cancelled')),
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(tenant_id, entry_number)
  );

  CREATE TABLE IF NOT EXISTS journal_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    journal_entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES chart_of_accounts(id),
    debit REAL DEFAULT 0,
    credit REAL DEFAULT 0,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS vat_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    invoice_id INTEGER REFERENCES invoices(id),
    type TEXT NOT NULL CHECK(type IN ('output','input')),
    tax_base REAL NOT NULL DEFAULT 0,
    tax_amount REAL NOT NULL DEFAULT 0,
    vat_rate REAL NOT NULL DEFAULT 21,
    date TEXT NOT NULL,
    section TEXT DEFAULT 'A1',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bank_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    name TEXT NOT NULL,
    account_number TEXT,
    iban TEXT,
    currency TEXT DEFAULT 'CZK',
    initial_balance REAL DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bank_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    bank_account_id INTEGER REFERENCES bank_accounts(id),
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'CZK',
    counterparty_name TEXT,
    counterparty_account TEXT,
    variable_symbol TEXT,
    constant_symbol TEXT,
    specific_symbol TEXT,
    description TEXT,
    matched_invoice_id INTEGER REFERENCES invoices(id),
    status TEXT DEFAULT 'unmatched' CHECK(status IN ('unmatched','matched','ignored')),
    imported_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cash_registers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    name TEXT NOT NULL,
    currency TEXT DEFAULT 'CZK',
    initial_balance REAL DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cash_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    register_id INTEGER NOT NULL REFERENCES cash_registers(id),
    document_number TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income','expense')),
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    description TEXT,
    category TEXT,
    invoice_id INTEGER REFERENCES invoices(id),
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(tenant_id, document_number)
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    name TEXT NOT NULL,
    sku TEXT,
    description TEXT,
    unit TEXT DEFAULT 'ks',
    unit_price REAL DEFAULT 0,
    purchase_price REAL DEFAULT 0,
    vat_rate REAL DEFAULT 21,
    type TEXT DEFAULT 'service' CHECK(type IN ('product','service')),
    stock_quantity REAL DEFAULT 0,
    min_stock REAL DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(tenant_id, sku)
  );

  CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    type TEXT NOT NULL CHECK(type IN ('in','out','adjustment')),
    quantity REAL NOT NULL,
    unit_price REAL DEFAULT 0,
    date TEXT NOT NULL,
    document_type TEXT,
    document_id INTEGER,
    note TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    order_number TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'received' CHECK(type IN ('received','issued')),
    client_id INTEGER REFERENCES clients(id),
    date TEXT NOT NULL,
    due_date TEXT,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft','confirmed','in_progress','completed','cancelled','invoiced')),
    currency TEXT DEFAULT 'CZK',
    subtotal REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    total REAL DEFAULT 0,
    note TEXT,
    invoice_id INTEGER REFERENCES invoices(id),
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(tenant_id, order_number)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    description TEXT NOT NULL,
    quantity REAL DEFAULT 1,
    unit TEXT DEFAULT 'ks',
    unit_price REAL DEFAULT 0,
    tax_rate REAL DEFAULT 21,
    total REAL DEFAULT 0
  );
`);

// ─── MIGRATIONS ──────────────────────────────────────────
const safeAlter = (sql) => { try { db.exec(sql); } catch (e) { /* already exists */ } };

safeAlter('ALTER TABLE users ADD COLUMN signature TEXT');
safeAlter('ALTER TABLE users ADD COLUMN first_name TEXT');
safeAlter('ALTER TABLE users ADD COLUMN last_name TEXT');
safeAlter("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'");
safeAlter('ALTER TABLE users ADD COLUMN reset_token TEXT');
safeAlter('ALTER TABLE users ADD COLUMN reset_token_expires TEXT');
safeAlter('ALTER TABLE users ADD COLUMN tenant_id INTEGER REFERENCES tenants(id)');
safeAlter('ALTER TABLE tenants ADD COLUMN invite_code TEXT');

safeAlter('ALTER TABLE invoices ADD COLUMN supply_date TEXT');
safeAlter("ALTER TABLE invoices ADD COLUMN payment_method TEXT DEFAULT 'bank_transfer'");
safeAlter('ALTER TABLE invoices ADD COLUMN variable_symbol TEXT');
safeAlter('ALTER TABLE invoices ADD COLUMN tenant_id INTEGER REFERENCES tenants(id)');

safeAlter('ALTER TABLE invoice_items ADD COLUMN tax_rate REAL DEFAULT 21');
safeAlter('ALTER TABLE invoice_items ADD COLUMN tax_amount REAL DEFAULT 0');
safeAlter('ALTER TABLE invoice_items ADD COLUMN total_with_tax REAL DEFAULT 0');

safeAlter('ALTER TABLE company ADD COLUMN default_due_days INTEGER DEFAULT 14');
safeAlter('ALTER TABLE company ADD COLUMN vat_payer INTEGER DEFAULT 0');
safeAlter("ALTER TABLE company ADD COLUMN invoice_format TEXT DEFAULT '{prefix}{sep}{year}{sep}{num}'");
safeAlter("ALTER TABLE company ADD COLUMN invoice_separator TEXT DEFAULT '-'");
safeAlter('ALTER TABLE company ADD COLUMN invoice_padding INTEGER DEFAULT 3');
safeAlter("ALTER TABLE company ADD COLUMN invoice_year_format TEXT DEFAULT 'full'");
safeAlter('ALTER TABLE company ADD COLUMN bank_code TEXT');
safeAlter('ALTER TABLE company ADD COLUMN tenant_id INTEGER REFERENCES tenants(id)');

safeAlter('ALTER TABLE evidence ADD COLUMN file_path TEXT');
safeAlter('ALTER TABLE evidence ADD COLUMN original_filename TEXT');
safeAlter('ALTER TABLE evidence ADD COLUMN tenant_id INTEGER REFERENCES tenants(id)');
safeAlter('ALTER TABLE clients ADD COLUMN tenant_id INTEGER REFERENCES tenants(id)');
safeAlter('ALTER TABLE audit_log ADD COLUMN tenant_id INTEGER REFERENCES tenants(id)');
safeAlter('ALTER TABLE category_rules ADD COLUMN tenant_id INTEGER REFERENCES tenants(id)');

// New feature migrations
safeAlter("ALTER TABLE invoices ADD COLUMN invoice_type TEXT DEFAULT 'regular'"); // regular, proforma, credit_note
safeAlter('ALTER TABLE invoices ADD COLUMN related_invoice_id INTEGER REFERENCES invoices(id)');
safeAlter('ALTER TABLE invoices ADD COLUMN paid_amount REAL DEFAULT 0');
safeAlter('ALTER TABLE company ADD COLUMN logo TEXT'); // base64 logo
safeAlter('ALTER TABLE company ADD COLUMN reminder_days TEXT'); // JSON array e.g. [3,7,14]

safeAlter('ALTER TABLE company ADD COLUMN order_prefix TEXT DEFAULT \'OBJ\'');
safeAlter('ALTER TABLE company ADD COLUMN order_counter INTEGER DEFAULT 1');
safeAlter('ALTER TABLE company ADD COLUMN cash_prefix TEXT DEFAULT \'PPD\'');
safeAlter('ALTER TABLE company ADD COLUMN cash_counter INTEGER DEFAULT 1');
safeAlter('ALTER TABLE company ADD COLUMN journal_prefix TEXT DEFAULT \'UD\'');
safeAlter('ALTER TABLE company ADD COLUMN journal_counter INTEGER DEFAULT 1');

// Migrate full_name → first_name + last_name
try {
  const users = db.prepare("SELECT id, full_name, first_name FROM users WHERE first_name IS NULL AND full_name IS NOT NULL").all();
  const upd = db.prepare("UPDATE users SET first_name = ?, last_name = ? WHERE id = ?");
  users.forEach(u => {
    const parts = u.full_name.trim().split(/\s+/);
    upd.run(parts[0] || '', parts.slice(1).join(' ') || '', u.id);
  });
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
