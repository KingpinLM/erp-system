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
// Rainbow Family Investment brand logo (Prismatic Spectrum, white background)
const brandLogoSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="80" viewBox="0 0 300 80"><rect width="300" height="80" fill="white"/><defs><linearGradient id="sp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1E2A3A"/><stop offset="20%" stop-color="#2D5A1E"/><stop offset="40%" stop-color="#7C8C6E"/><stop offset="60%" stop-color="#C4A265"/><stop offset="80%" stop-color="#C47D5A"/><stop offset="100%" stop-color="#8B5A6B"/></linearGradient></defs><rect x="12" y="12" width="4" height="56" rx="2" fill="url(#sp)"/><text x="26" y="44" font-family="Georgia,serif" font-size="30" font-weight="700" fill="#1E2A3A">Rainbow Family</text><text x="27" y="62" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="500" fill="#1E2A3A" letter-spacing="4" opacity="0.45">INVESTMENT</text></svg>';
const brandLogo = 'data:image/svg+xml;base64,' + Buffer.from(brandLogoSvg).toString('base64');

const existingCompany = db.prepare('SELECT id FROM company WHERE tenant_id = ?').get(tenantId);
if (!existingCompany) {
  db.prepare(`INSERT INTO company (tenant_id, name, ico, dic, bank_account, bank_code, iban, invoice_prefix, invoice_counter, logo) VALUES (?, 'Rainbow Family Investment s.r.o.', '23486899', 'CZ23486899', '1234567890', '0100', 'CZ6501000000001234567890', 'FV', 11, ?)`).run(tenantId, brandLogo);
} else {
  // Ensure bank details and logo exist for existing records
  const comp = db.prepare('SELECT bank_account, logo FROM company WHERE tenant_id = ?').get(tenantId);
  if (!comp.bank_account) {
    db.prepare("UPDATE company SET bank_account='1234567890', bank_code='0100', iban='CZ6501000000001234567890' WHERE tenant_id=?").run(tenantId);
  }
  // Update logo to brand version
  db.prepare("UPDATE company SET logo = ? WHERE tenant_id = ?").run(brandLogo, tenantId);
}

// ─── CHATBOT KNOWLEDGE BASE ──────────────────────────────────
const insertKnowledge = db.prepare(`INSERT OR IGNORE INTO chatbot_knowledge (tenant_id, keywords, question_cs, question_en, answer_cs, answer_en, link, category, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const knowledge = [
  // Navigation
  ['dashboard,přehled,hlavní stránka,home,domů,úvod', 'Kde najdu přehled?', 'Where is the dashboard?', 'Dashboard najdete na hlavní stránce po přihlášení. Zobrazuje finanční přehled, grafy a statistiky.', 'The dashboard is on the main page after login. It shows financial overview, charts and statistics.', '/', 'navigation', 10],
  ['faktura,faktury,invoice,invoices,vystavit,nová faktura', 'Jak vytvořím fakturu?', 'How do I create an invoice?', 'Přejděte do sekce Faktury a klikněte na tlačítko "+ Nová faktura". Vyplňte údaje klienta, položky a uložte.', 'Go to the Invoices section and click "+ New invoice". Fill in client details, items and save.', '/invoices', 'navigation', 10],
  ['klient,klienti,clients,zákazník,odběratel,kontakt', 'Kde spravuji klienty?', 'Where do I manage clients?', 'Klienty najdete v sekci Finance → Klienti. Zde můžete přidávat, upravovat a mazat klienty.', 'Clients are in the Finance → Clients section. Here you can add, edit and delete clients.', '/clients', 'navigation', 10],
  ['evidence,doklady,náklady,příjmy,výdaje', 'Co je evidence?', 'What is evidence?', 'Evidence slouží k záznamu přijatých dokladů, nákladů a dalších finančních dokumentů.', 'Evidence is used to record received documents, expenses and other financial documents.', '/evidence', 'navigation', 8],
  ['opakované,recurring,automatické,pravidelné', 'Jak nastavím opakovanou fakturu?', 'How to set up recurring invoices?', 'V sekci Finance → Opakované můžete vytvořit šablony faktur, které se automaticky generují v zadaném intervalu (týdně, měsíčně, čtvrtletně, ročně).', 'In the Finance → Recurring section you can create invoice templates that are automatically generated at set intervals (weekly, monthly, quarterly, yearly).', '/recurring', 'navigation', 8],
  ['banka,bankovní,účet,transakce,párování', 'Kde najdu bankovní transakce?', 'Where are bank transactions?', 'Bankovní transakce najdete v sekci Účetnictví → Banka. Zde můžete importovat výpisy a párovat platby s fakturami.', 'Bank transactions are in the Accounting → Bank section. Here you can import statements and match payments with invoices.', '/bank', 'navigation', 8],
  ['účetnictví,accounting,účtová osnova,předkontace,deník', 'Kde je účetnictví?', 'Where is accounting?', 'Účetnictví najdete v sekci Účetnictví → Účetnictví. Obsahuje účtovou osnovu, účetní deník a hlavní knihu.', 'Accounting is in the Accounting section. It contains the chart of accounts, journal and general ledger.', '/accounting', 'navigation', 8],
  ['dph,daň,vat,přiznání', 'Kde najdu přiznání k DPH?', 'Where is the VAT report?', 'Přiznání k DPH najdete v sekci Účetnictví → DPH. Zde můžete generovat a kontrolovat záznamy DPH.', 'VAT reports are in the Accounting → VAT section. Here you can generate and review VAT records.', '/vat', 'navigation', 8],
  ['měna,měny,kurz,currencies,exchange', 'Kde nastavím měny a kurzy?', 'Where to set currencies?', 'Správu měn najdete v sekci Účetnictví → Měny. Kurzy se automaticky aktualizují z ČNB.', 'Currency management is in the Accounting → Currencies section. Rates are automatically updated from CNB.', '/currencies', 'navigation', 7],
  ['společnost,firma,nastavení,company,settings,ičo,dič,logo', 'Kde nastavím údaje firmy?', 'Where to set company details?', 'Nastavení společnosti najdete v sekci Správa → Společnost. Zde můžete upravit název, IČO, DIČ, logo a bankovní spojení.', 'Company settings are in the Admin → Company section. Here you can edit name, ID, VAT ID, logo and bank details.', '/company', 'navigation', 9],
  ['uživatel,uživatelé,users,role,oprávnění,přidat uživatele', 'Kde spravuji uživatele?', 'Where to manage users?', 'Správu uživatelů najdete v sekci Správa → Uživatelé. Můžete přidávat uživatele, měnit role a oprávnění (pouze administrátor).', 'User management is in the Admin → Users section. You can add users, change roles and permissions (admin only).', '/users', 'navigation', 9],
  ['profil,heslo,podpis,profile,password,signature', 'Kde změním své údaje?', 'Where to change my profile?', 'Svůj profil najdete kliknutím na své jméno v postranním panelu nebo přes sekci Můj profil. Můžete změnit heslo a nastavit podpis.', 'Your profile is accessible by clicking your name in the sidebar or via My Profile. You can change your password and set a signature.', '/profile', 'navigation', 7],
  // Features
  ['pdf,stáhnout,export,tisk,print', 'Jak stáhnu fakturu jako PDF?', 'How to download invoice as PDF?', 'Otevřete detail faktury a klikněte na tlačítko "Stáhnout PDF". PDF se automaticky vygeneruje a stáhne.', 'Open the invoice detail and click "Download PDF". The PDF will be automatically generated and downloaded.', '/invoices', 'feature', 7],
  ['email,odeslat,poslat,send', 'Jak odešlu fakturu emailem?', 'How to send invoice by email?', 'V detailu faktury klikněte na "Odeslat emailem". Zadejte email příjemce a zprávu.', 'In the invoice detail click "Send by email". Enter the recipient email and message.', '/invoices', 'feature', 7],
  ['hledat,vyhledat,search,najít,find', 'Jak vyhledávám?', 'How to search?', 'Použijte vyhledávací pole v horní liště (zkratka Ctrl+K). Můžete hledat faktury, klienty a doklady.', 'Use the search field in the top bar (shortcut Ctrl+K). You can search invoices, clients and documents.', null, 'feature', 8],
  ['tmavý,dark,theme,režim,vzhled', 'Jak zapnu tmavý režim?', 'How to enable dark mode?', 'Klikněte na ikonu měsíce v pravém horním rohu pro přepnutí mezi světlým a tmavým režimem.', 'Click the moon icon in the top right corner to toggle between light and dark mode.', null, 'feature', 6],
  ['qr,platba,qr kód', 'Kde najdu QR kód pro platbu?', 'Where is the payment QR code?', 'QR kód pro platbu najdete v detailu vydané faktury. Kód obsahuje platební údaje pro snadné zaplacení.', 'The payment QR code is in the issued invoice detail. The code contains payment details for easy payment.', '/invoices', 'feature', 6],
  ['stárnutí,aging,splatnost,po splatnosti,dluh', 'Kde vidím přehled pohledávek?', 'Where is the aging report?', 'Přehled stárnutí pohledávek najdete na Dashboardu v sekci analytiky. Zobrazuje faktury po splatnosti rozdělené podle stáří.', 'The aging report is on the Dashboard in the analytics section. It shows overdue invoices grouped by age.', '/', 'feature', 6],
  // Help
  ['pomoc,help,nápověda,jak,how,co,what,nevím', 'Potřebuji pomoct', 'I need help', 'Jsem Hyňa, váš asistent pro navigaci v ERP systému. Zeptejte se mě na cokoliv ohledně funkcí aplikace, a já vám poradím!', 'I am Hyňa, your ERP system navigation assistant. Ask me anything about the application features and I will help!', null, 'help', 5],
  ['přihlášení,login,přihlásit,odhlásit,logout', 'Jak se přihlásím?', 'How to log in?', 'Na přihlašovací stránce zadejte své uživatelské jméno a heslo. Po přihlášení budete přesměrováni na Dashboard.', 'On the login page enter your username and password. After login you will be redirected to the Dashboard.', '/login', 'feature', 5],
  ['registrace,register,nový účet', 'Jak se zaregistruji?', 'How to register?', 'Na přihlašovací stránce klikněte na odkaz pro registraci. Po registraci vás administrátor musí schválit.', 'On the login page click the registration link. After registration, an admin must approve you.', '/register', 'feature', 5],
];
knowledge.forEach(k => insertKnowledge.run(tenantId, ...k));

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
