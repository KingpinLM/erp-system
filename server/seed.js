const db = require('./database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const hash = (pw) => bcrypt.hashSync(pw, 10);

// ─── SUPERADMIN ─────────────────────────────────────────────
db.prepare(`INSERT OR IGNORE INTO superadmins (username, email, password, full_name) VALUES (?, ?, ?, ?)`)
  .run('superadmin', 'superadmin@erp.cz', hash('super123'), 'Super Admin');

// ─── DEFAULT TENANT (RFI) ───────────────────────────────────
const existingTenant = db.prepare("SELECT id FROM tenants WHERE slug = 'rfi'").get();
let tenantId;
if (!existingTenant) {
  const inviteCode = crypto.randomBytes(6).toString('hex');
  const r = db.prepare("INSERT INTO tenants (name, slug, invite_code) VALUES ('Rainbow Family Investment s.r.o.', 'rfi', ?)").run(inviteCode);
  tenantId = r.lastInsertRowid;
} else {
  tenantId = existingTenant.id;
  // Ensure invite_code exists
  const t = db.prepare("SELECT invite_code FROM tenants WHERE id = ?").get(tenantId);
  if (!t.invite_code) {
    const inviteCode = crypto.randomBytes(6).toString('hex');
    db.prepare("UPDATE tenants SET invite_code = ? WHERE id = ?").run(inviteCode, tenantId);
  }
}

// ─── USERS (globally unique usernames) ──────────────────────
const insertUser = db.prepare(`INSERT OR IGNORE INTO users (tenant_id, username, email, password, full_name, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
insertUser.run(tenantId, 'admin', 'admin@firma.cz', hash('admin123'), 'Jan Novák', 'Jan', 'Novák', 'admin');
insertUser.run(tenantId, 'ucetni', 'ucetni@firma.cz', hash('ucetni123'), 'Marie Dvořáková', 'Marie', 'Dvořáková', 'accountant');
insertUser.run(tenantId, 'manager', 'manager@firma.cz', hash('manager123'), 'Petr Svoboda', 'Petr', 'Svoboda', 'manager');
insertUser.run(tenantId, 'viewer', 'viewer@firma.cz', hash('viewer123'), 'Eva Černá', 'Eva', 'Černá', 'viewer');

// ─── CURRENCIES (global) ────────────────────────────────────
const insertCurrency = db.prepare(`INSERT OR IGNORE INTO currencies (code, name, symbol, rate_to_czk) VALUES (?, ?, ?, ?)`);
insertCurrency.run('CZK', 'Česká koruna', 'Kč', 1.0);
insertCurrency.run('EUR', 'Euro', '€', 25.20);
insertCurrency.run('USD', 'US Dollar', '$', 23.50);
insertCurrency.run('GBP', 'British Pound', '£', 29.80);
insertCurrency.run('PLN', 'Polský zlotý', 'zł', 5.85);

// ─── CLIENTS (tenant-scoped) ────────────────────────────────
const insertClient = db.prepare(`INSERT OR IGNORE INTO clients (tenant_id, name, ico, dic, email, phone, address, city, zip, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const clients = [
  ['TechSoft s.r.o.', '12345678', 'CZ12345678', 'info@techsoft.cz', '+420 111 222 333', 'Vinohradská 10', 'Praha', '12000', 'CZ'],
  ['DataPro a.s.', '87654321', 'CZ87654321', 'kontakt@datapro.cz', '+420 444 555 666', 'Masarykova 5', 'Brno', '60200', 'CZ'],
  ['EuroTrade GmbH', 'DE123456', 'DE123456789', 'office@eurotrade.de', '+49 30 12345', 'Berliner Str. 42', 'Berlin', '10115', 'DE'],
  ['WebDesign Studio', '11223344', 'CZ11223344', 'studio@webdesign.cz', '+420 777 888 999', 'Dlouhá 15', 'Ostrava', '70200', 'CZ'],
  ['Nordic Solutions ApS', 'DK556677', 'DK55667788', 'hello@nordic.dk', '+45 12 34 56 78', 'Nørregade 8', 'København', '1165', 'DK'],
];
clients.forEach(c => insertClient.run(tenantId, ...c));

// ─── INVOICES (tenant-scoped) ───────────────────────────────
const adminUser = db.prepare("SELECT id FROM users WHERE username = 'admin' AND tenant_id = ?").get(tenantId);
const ucetniUser = db.prepare("SELECT id FROM users WHERE username = 'ucetni' AND tenant_id = ?").get(tenantId);
const adminId = adminUser?.id || 1;
const ucetniId = ucetniUser?.id || 2;

const insertInvoice = db.prepare(`
  INSERT OR IGNORE INTO invoices (tenant_id, invoice_number, type, client_id, issue_date, due_date, paid_date, status, currency, subtotal, tax_rate, tax_amount, total, total_czk, note, created_by)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertItem = db.prepare(`INSERT INTO invoice_items (invoice_id, description, quantity, unit, unit_price, total) VALUES (?, ?, ?, ?, ?, ?)`);

const getClientId = (name) => {
  const c = db.prepare("SELECT id FROM clients WHERE name = ? AND tenant_id = ?").get(name, tenantId);
  return c?.id;
};

const invoices = [
  ['FV-2026-001', 'issued', 'TechSoft s.r.o.', '2026-01-15', '2026-02-14', '2026-02-10', 'paid', 'CZK', 50000, 21, 10500, 60500, 60500, 'Vývoj webové aplikace', adminId],
  ['FV-2026-002', 'issued', 'DataPro a.s.', '2026-01-20', '2026-02-19', null, 'overdue', 'CZK', 35000, 21, 7350, 42350, 42350, 'Konzultace a analýza', adminId],
  ['FV-2026-003', 'issued', 'EuroTrade GmbH', '2026-02-01', '2026-03-03', '2026-02-28', 'paid', 'EUR', 2000, 21, 420, 2420, 60984, 'Software development', adminId],
  ['FV-2026-004', 'issued', 'WebDesign Studio', '2026-02-10', '2026-03-12', null, 'sent', 'CZK', 18000, 21, 3780, 21780, 21780, 'Grafický návrh', ucetniId],
  ['FV-2026-005', 'issued', 'TechSoft s.r.o.', '2026-02-15', '2026-03-17', null, 'draft', 'CZK', 75000, 21, 15750, 90750, 90750, 'Údržba systému Q1', adminId],
  ['FV-2026-006', 'issued', 'Nordic Solutions ApS', '2026-03-01', '2026-03-31', null, 'sent', 'EUR', 5000, 0, 0, 5000, 126000, 'Consulting services', adminId],
  ['FP-2026-001', 'received', 'DataPro a.s.', '2026-01-05', '2026-01-19', '2026-01-18', 'paid', 'CZK', 12000, 21, 2520, 14520, 14520, 'Licence software', adminId],
  ['FP-2026-002', 'received', 'EuroTrade GmbH', '2026-02-01', '2026-02-28', null, 'overdue', 'EUR', 800, 19, 152, 952, 23990, 'Cloud hosting', adminId],
  ['FV-2026-007', 'issued', 'DataPro a.s.', '2026-03-05', '2026-04-04', null, 'draft', 'CZK', 45000, 21, 9450, 54450, 54450, 'API integrace', ucetniId],
  ['FV-2026-008', 'issued', 'WebDesign Studio', '2026-03-10', '2026-04-09', null, 'sent', 'USD', 3000, 21, 630, 3630, 85305, 'Mobile app development', adminId],
];
invoices.forEach(inv => {
  const clientId = getClientId(inv[2]);
  const info = insertInvoice.run(tenantId, inv[0], inv[1], clientId, inv[3], inv[4], inv[5], inv[6], inv[7], inv[8], inv[9], inv[10], inv[11], inv[12], inv[13], inv[14]);
  if (info.changes > 0) {
    const invId = info.lastInsertRowid;
    insertItem.run(invId, inv[13] || 'Služba', 1, 'ks', inv[8], inv[8]);
  }
});

// ─── EVIDENCE (tenant-scoped) ───────────────────────────────
const insertEvidence = db.prepare(`INSERT OR IGNORE INTO evidence (tenant_id, type, title, description, amount, currency, date, category, invoice_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const evidenceData = [
  ['income', 'Platba za FV-2026-001', 'Přijatá platba za vývoj', 60500, 'CZK', '2026-02-10', 'Služby', 1, adminId],
  ['income', 'Platba za FV-2026-003', 'Payment received', 2420, 'EUR', '2026-02-28', 'Služby', 3, adminId],
  ['expense', 'Licence software', 'Roční licence', 14520, 'CZK', '2026-01-18', 'Software', 7, adminId],
  ['expense', 'Kancelářské potřeby', 'Papír, tonery', 3500, 'CZK', '2026-01-25', 'Kancelář', null, ucetniId],
  ['expense', 'Hosting serveru', 'Měsíční hosting', 2500, 'CZK', '2026-02-01', 'IT', null, adminId],
  ['asset', 'MacBook Pro', 'Nový notebook pro vývojáře', 65000, 'CZK', '2026-01-10', 'Hardware', null, adminId],
  ['document', 'Smlouva TechSoft', 'Rámcová smlouva 2026', null, 'CZK', '2026-01-01', 'Smlouvy', null, adminId],
  ['income', 'Platba za FP-2026-001', 'Uhrazená faktura', 14520, 'CZK', '2026-01-18', 'Software', 7, adminId],
  ['expense', 'Cestovné Brno', 'Služební cesta', 1850, 'CZK', '2026-02-15', 'Cestovné', null, ucetniId],
  ['expense', 'Školení React', 'Online kurz', 8900, 'CZK', '2026-03-01', 'Vzdělávání', null, adminId],
];
evidenceData.forEach(e => insertEvidence.run(tenantId, ...e));

// ─── COMPANY (tenant-scoped) ────────────────────────────────
const existingCompany = db.prepare('SELECT id FROM company WHERE tenant_id = ?').get(tenantId);
if (!existingCompany) {
  db.prepare(`INSERT INTO company (tenant_id, name, ico, dic, invoice_prefix, invoice_counter) VALUES (?, 'Rainbow Family Investment s.r.o.', '23486899', 'CZ23486899', 'FV', 11)`).run(tenantId);
}

// ─── DEMO TENANT 2 (globally unique usernames!) ─────────────
const existingDemo = db.prepare("SELECT id FROM tenants WHERE slug = 'demo'").get();
let demoTenantId;
if (!existingDemo) {
  const demoInviteCode = crypto.randomBytes(6).toString('hex');
  const r = db.prepare("INSERT INTO tenants (name, slug, invite_code) VALUES ('Demo firma s.r.o.', 'demo', ?)").run(demoInviteCode);
  demoTenantId = r.lastInsertRowid;
  // Unique username: demo-admin (not 'admin' — that's taken by RFI tenant)
  db.prepare('INSERT INTO users (tenant_id, username, email, password, full_name, first_name, last_name, role) VALUES (?,?,?,?,?,?,?,?)')
    .run(demoTenantId, 'demo-admin', 'admin@demo.cz', hash('admin123'), 'Demo Admin', 'Demo', 'Admin', 'admin');
  db.prepare("INSERT INTO company (tenant_id, name, ico, dic, invoice_prefix, invoice_counter) VALUES (?, 'Demo firma s.r.o.', '99887766', 'CZ99887766', 'DF', 1)").run(demoTenantId);
}

// Print invite codes
const rfiTenant = db.prepare("SELECT invite_code FROM tenants WHERE slug = 'rfi'").get();
const demoTenant = db.prepare("SELECT invite_code FROM tenants WHERE slug = 'demo'").get();

console.log('Database seeded successfully!');
console.log('Superadmin: superadmin / super123');
console.log('Tenant "rfi": admin/admin123, ucetni/ucetni123, manager/manager123, viewer/viewer123');
console.log(`  Invite code: ${rfiTenant?.invite_code || 'N/A'}`);
console.log('Tenant "demo": demo-admin/admin123');
console.log(`  Invite code: ${demoTenant?.invite_code || 'N/A'}`);
