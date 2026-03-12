const db = require('./database');
const bcrypt = require('bcryptjs');

const hash = (pw) => bcrypt.hashSync(pw, 10);

// Users
const insertUser = db.prepare(`INSERT OR IGNORE INTO users (username, email, password, full_name, role) VALUES (?, ?, ?, ?, ?)`);
insertUser.run('admin', 'admin@firma.cz', hash('admin123'), 'Jan Novák', 'admin');
insertUser.run('ucetni', 'ucetni@firma.cz', hash('ucetni123'), 'Marie Dvořáková', 'accountant');
insertUser.run('manager', 'manager@firma.cz', hash('manager123'), 'Petr Svoboda', 'manager');
insertUser.run('viewer', 'viewer@firma.cz', hash('viewer123'), 'Eva Černá', 'viewer');

// Currencies
const insertCurrency = db.prepare(`INSERT OR IGNORE INTO currencies (code, name, symbol, rate_to_czk) VALUES (?, ?, ?, ?)`);
insertCurrency.run('CZK', 'Česká koruna', 'Kč', 1.0);
insertCurrency.run('EUR', 'Euro', '€', 25.20);
insertCurrency.run('USD', 'US Dollar', '$', 23.50);
insertCurrency.run('GBP', 'British Pound', '£', 29.80);
insertCurrency.run('PLN', 'Polský zlotý', 'zł', 5.85);

// Clients
const insertClient = db.prepare(`INSERT OR IGNORE INTO clients (name, ico, dic, email, phone, address, city, zip, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const clients = [
  ['TechSoft s.r.o.', '12345678', 'CZ12345678', 'info@techsoft.cz', '+420 111 222 333', 'Vinohradská 10', 'Praha', '12000', 'CZ'],
  ['DataPro a.s.', '87654321', 'CZ87654321', 'kontakt@datapro.cz', '+420 444 555 666', 'Masarykova 5', 'Brno', '60200', 'CZ'],
  ['EuroTrade GmbH', 'DE123456', 'DE123456789', 'office@eurotrade.de', '+49 30 12345', 'Berliner Str. 42', 'Berlin', '10115', 'DE'],
  ['WebDesign Studio', '11223344', 'CZ11223344', 'studio@webdesign.cz', '+420 777 888 999', 'Dlouhá 15', 'Ostrava', '70200', 'CZ'],
  ['Nordic Solutions ApS', 'DK556677', 'DK55667788', 'hello@nordic.dk', '+45 12 34 56 78', 'Nørregade 8', 'København', '1165', 'DK'],
];
clients.forEach(c => insertClient.run(...c));

// Invoices
const insertInvoice = db.prepare(`
  INSERT OR IGNORE INTO invoices (invoice_number, type, client_id, issue_date, due_date, paid_date, status, currency, subtotal, tax_rate, tax_amount, total, total_czk, note, created_by)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertItem = db.prepare(`INSERT INTO invoice_items (invoice_id, description, quantity, unit, unit_price, total) VALUES (?, ?, ?, ?, ?, ?)`);

const invoices = [
  ['FV-2026-001', 'issued', 1, '2026-01-15', '2026-02-14', '2026-02-10', 'paid', 'CZK', 50000, 21, 10500, 60500, 60500, 'Vývoj webové aplikace', 1],
  ['FV-2026-002', 'issued', 2, '2026-01-20', '2026-02-19', null, 'overdue', 'CZK', 35000, 21, 7350, 42350, 42350, 'Konzultace a analýza', 1],
  ['FV-2026-003', 'issued', 3, '2026-02-01', '2026-03-03', '2026-02-28', 'paid', 'EUR', 2000, 21, 420, 2420, 60984, 'Software development', 1],
  ['FV-2026-004', 'issued', 4, '2026-02-10', '2026-03-12', null, 'sent', 'CZK', 18000, 21, 3780, 21780, 21780, 'Grafický návrh', 2],
  ['FV-2026-005', 'issued', 1, '2026-02-15', '2026-03-17', null, 'draft', 'CZK', 75000, 21, 15750, 90750, 90750, 'Údržba systému Q1', 1],
  ['FV-2026-006', 'issued', 5, '2026-03-01', '2026-03-31', null, 'sent', 'EUR', 5000, 0, 0, 5000, 126000, 'Consulting services', 1],
  ['FP-2026-001', 'received', 2, '2026-01-05', '2026-01-19', '2026-01-18', 'paid', 'CZK', 12000, 21, 2520, 14520, 14520, 'Licence software', 1],
  ['FP-2026-002', 'received', 3, '2026-02-01', '2026-02-28', null, 'overdue', 'EUR', 800, 19, 152, 952, 23990, 'Cloud hosting', 1],
  ['FV-2026-007', 'issued', 2, '2026-03-05', '2026-04-04', null, 'draft', 'CZK', 45000, 21, 9450, 54450, 54450, 'API integrace', 2],
  ['FV-2026-008', 'issued', 4, '2026-03-10', '2026-04-09', null, 'sent', 'USD', 3000, 21, 630, 3630, 85305, 'Mobile app development', 1],
];
invoices.forEach(inv => {
  const info = insertInvoice.run(...inv);
  if (info.changes > 0) {
    const invId = info.lastInsertRowid;
    insertItem.run(invId, inv[13] || 'Služba', 1, 'ks', inv[8], inv[8]);
  }
});

// Evidence records
const insertEvidence = db.prepare(`INSERT OR IGNORE INTO evidence (type, title, description, amount, currency, date, category, invoice_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const evidenceData = [
  ['income', 'Platba za FV-2026-001', 'Přijatá platba za vývoj', 60500, 'CZK', '2026-02-10', 'Služby', 1, 1],
  ['income', 'Platba za FV-2026-003', 'Payment received', 2420, 'EUR', '2026-02-28', 'Služby', 3, 1],
  ['expense', 'Licence software', 'Roční licence', 14520, 'CZK', '2026-01-18', 'Software', 7, 1],
  ['expense', 'Kancelářské potřeby', 'Papír, tonery', 3500, 'CZK', '2026-01-25', 'Kancelář', null, 2],
  ['expense', 'Hosting serveru', 'Měsíční hosting', 2500, 'CZK', '2026-02-01', 'IT', null, 1],
  ['asset', 'MacBook Pro', 'Nový notebook pro vývojáře', 65000, 'CZK', '2026-01-10', 'Hardware', null, 1],
  ['document', 'Smlouva TechSoft', 'Rámcová smlouva 2026', null, 'CZK', '2026-01-01', 'Smlouvy', null, 1],
  ['income', 'Platba za FP-2026-001', 'Uhrazená faktura', 14520, 'CZK', '2026-01-18', 'Software', 7, 1],
  ['expense', 'Cestovné Brno', 'Služební cesta', 1850, 'CZK', '2026-02-15', 'Cestovné', null, 2],
  ['expense', 'Školení React', 'Online kurz', 8900, 'CZK', '2026-03-01', 'Vzdělávání', null, 1],
];
evidenceData.forEach(e => insertEvidence.run(...e));

// Company
db.prepare(`INSERT OR REPLACE INTO company (id, name, ico, dic, email, phone, address, city, zip, country) VALUES (1, 'Rainbow Family Investment s.r.o.', '23486899', 'CZ23486899', NULL, NULL, 'Krejčího 2279/6, Libeň', 'Praha 8', '180 00', 'CZ')`).run();

console.log('Database seeded successfully!');
console.log('Users: admin/admin123, ucetni/ucetni123, manager/manager123, viewer/viewer123');
