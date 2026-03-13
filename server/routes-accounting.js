const express = require('express');
const db = require('./database');
const { authenticate, authorize, tenantScope } = require('./auth');
const router = express.Router();
const tenanted = [authenticate, tenantScope];

// ─── CHART OF ACCOUNTS ──────────────────────────────────────
router.get('/api/accounts', ...tenanted, (req, res) => {
  res.json(db.prepare('SELECT * FROM chart_of_accounts WHERE tenant_id = ? ORDER BY account_number').all(req.tenant_id));
});

router.post('/api/accounts', ...tenanted, authorize('admin', 'accountant'), (req, res) => {
  const { account_number, name, type, parent_id, is_group } = req.body;
  if (!account_number || !name || !type) return res.status(400).json({ error: 'Vyplňte číslo účtu, název a typ' });
  try {
    const result = db.prepare('INSERT INTO chart_of_accounts (tenant_id, account_number, name, type, parent_id, is_group) VALUES (?,?,?,?,?,?)')
      .run(req.tenant_id, account_number, name, type, parent_id || null, is_group ? 1 : 0);
    res.json({ id: result.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: 'Účet s tímto číslem již existuje' });
  }
});

router.put('/api/accounts/:id', ...tenanted, authorize('admin', 'accountant'), (req, res) => {
  const { account_number, name, type, parent_id, is_group, active } = req.body;
  db.prepare('UPDATE chart_of_accounts SET account_number=?, name=?, type=?, parent_id=?, is_group=?, active=? WHERE id=? AND tenant_id=?')
    .run(account_number, name, type, parent_id || null, is_group ? 1 : 0, active ?? 1, req.params.id, req.tenant_id);
  res.json({ ok: true });
});

router.delete('/api/accounts/:id', ...tenanted, authorize('admin'), (req, res) => {
  const used = db.prepare('SELECT COUNT(*) as cnt FROM journal_lines WHERE account_id = ?').get(req.params.id).cnt;
  if (used > 0) return res.status(400).json({ error: 'Účet nelze smazat, je použit v účetních zápisech' });
  db.prepare('DELETE FROM chart_of_accounts WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenant_id);
  res.json({ ok: true });
});

// Seed default Czech chart of accounts for tenant
router.post('/api/accounts/seed-default', ...tenanted, authorize('admin'), (req, res) => {
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM chart_of_accounts WHERE tenant_id = ?').get(req.tenant_id).cnt;
  if (existing > 0) return res.status(400).json({ error: 'Účtový rozvrh již obsahuje účty' });

  const accounts = [
    // Třída 0 - Dlouhodobý majetek
    ['011', 'Zřizovací výdaje', 'asset'], ['013', 'Software', 'asset'], ['021', 'Stavby', 'asset'],
    ['022', 'Hmotné movité věci', 'asset'], ['031', 'Pozemky', 'asset'], ['042', 'Pořízení DHM', 'asset'],
    ['052', 'Oprávky k samostatným movitým věcem', 'asset'],
    // Třída 1 - Zásoby
    ['112', 'Materiál na skladě', 'asset'], ['132', 'Zboží na skladě', 'asset'],
    // Třída 2 - Krátkodobý finanční majetek
    ['211', 'Pokladna', 'asset'], ['221', 'Bankovní účty', 'asset'],
    ['231', 'Krátkodobé úvěry', 'liability'], ['261', 'Peníze na cestě', 'asset'],
    // Třída 3 - Zúčtovací vztahy
    ['311', 'Pohledávky z obchodních vztahů', 'asset'], ['314', 'Poskytnuté zálohy', 'asset'],
    ['321', 'Závazky z obchodních vztahů', 'liability'], ['324', 'Přijaté zálohy', 'liability'],
    ['331', 'Zaměstnanci', 'liability'], ['336', 'Sociální a zdravotní pojištění', 'liability'],
    ['341', 'Daň z příjmů', 'liability'], ['342', 'Ostatní přímé daně', 'liability'],
    ['343', 'Daň z přidané hodnoty', 'liability'],
    // Třída 4 - Kapitálové účty
    ['411', 'Základní kapitál', 'equity'], ['421', 'Rezervní fond', 'equity'],
    ['428', 'Nerozdělený zisk minulých let', 'equity'], ['429', 'Neuhrazená ztráta minulých let', 'equity'],
    ['431', 'Výsledek hospodaření ve schvalovacím řízení', 'equity'],
    // Třída 5 - Náklady
    ['501', 'Spotřeba materiálu', 'expense'], ['502', 'Spotřeba energie', 'expense'],
    ['504', 'Prodané zboží', 'expense'], ['511', 'Opravy a udržování', 'expense'],
    ['512', 'Cestovné', 'expense'], ['513', 'Náklady na reprezentaci', 'expense'],
    ['518', 'Ostatní služby', 'expense'], ['521', 'Mzdové náklady', 'expense'],
    ['524', 'Zákonné sociální pojištění', 'expense'], ['527', 'Zákonné sociální náklady', 'expense'],
    ['531', 'Daň silniční', 'expense'], ['532', 'Daň z nemovitostí', 'expense'],
    ['538', 'Ostatní daně a poplatky', 'expense'], ['541', 'Zůstatková cena prodaného DHM', 'expense'],
    ['543', 'Dary', 'expense'], ['544', 'Smluvní pokuty a úroky z prodlení', 'expense'],
    ['545', 'Ostatní pokuty a penále', 'expense'], ['546', 'Odpis pohledávky', 'expense'],
    ['548', 'Ostatní provozní náklady', 'expense'], ['551', 'Odpisy DHM a DNM', 'expense'],
    ['562', 'Úroky', 'expense'], ['563', 'Kurzové ztráty', 'expense'],
    ['568', 'Ostatní finanční náklady', 'expense'],
    ['591', 'Daň z příjmů z běžné činnosti - splatná', 'expense'],
    // Třída 6 - Výnosy
    ['601', 'Tržby za vlastní výrobky', 'revenue'], ['602', 'Tržby z prodeje služeb', 'revenue'],
    ['604', 'Tržby za zboží', 'revenue'], ['641', 'Tržby z prodeje DHM', 'revenue'],
    ['642', 'Tržby z prodeje materiálu', 'revenue'], ['644', 'Smluvní pokuty a úroky z prodlení', 'revenue'],
    ['648', 'Ostatní provozní výnosy', 'revenue'], ['662', 'Úroky', 'revenue'],
    ['663', 'Kurzové zisky', 'revenue'], ['668', 'Ostatní finanční výnosy', 'revenue'],
  ];
  const ins = db.prepare('INSERT INTO chart_of_accounts (tenant_id, account_number, name, type) VALUES (?,?,?,?)');
  const insertMany = db.transaction(() => { accounts.forEach(a => ins.run(req.tenant_id, ...a)); });
  insertMany();
  res.json({ ok: true, count: accounts.length });
});

// ─── JOURNAL ENTRIES ────────────────────────────────────────
function generateJournalNumber(comp) {
  const prefix = comp?.journal_prefix || 'UD';
  const counter = comp?.journal_counter || 1;
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(counter).padStart(4, '0')}`;
}

router.get('/api/journal', ...tenanted, (req, res) => {
  const { status, from, to } = req.query;
  let sql = 'SELECT * FROM journal_entries WHERE tenant_id = ?';
  const params = [req.tenant_id];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (from) { sql += ' AND date >= ?'; params.push(from); }
  if (to) { sql += ' AND date <= ?'; params.push(to); }
  sql += ' ORDER BY date DESC, id DESC';
  const entries = db.prepare(sql).all(...params);
  entries.forEach(e => {
    e.lines = db.prepare(`SELECT jl.*, ca.account_number, ca.name as account_name FROM journal_lines jl JOIN chart_of_accounts ca ON jl.account_id = ca.id WHERE jl.journal_entry_id = ?`).all(e.id);
  });
  res.json(entries);
});

router.get('/api/journal/:id', ...tenanted, (req, res) => {
  const entry = db.prepare('SELECT * FROM journal_entries WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id);
  if (!entry) return res.status(404).json({ error: 'Zápis nenalezen' });
  entry.lines = db.prepare(`SELECT jl.*, ca.account_number, ca.name as account_name FROM journal_lines jl JOIN chart_of_accounts ca ON jl.account_id = ca.id WHERE jl.journal_entry_id = ?`).all(entry.id);
  res.json(entry);
});

router.post('/api/journal', ...tenanted, authorize('admin', 'accountant'), (req, res) => {
  const { date, description, lines, document_type, document_id } = req.body;
  if (!date || !description || !lines || lines.length < 2) {
    return res.status(400).json({ error: 'Zadejte datum, popis a alespoň 2 řádky' });
  }
  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return res.status(400).json({ error: `Součet MD (${totalDebit.toFixed(2)}) a D (${totalCredit.toFixed(2)}) se nerovná` });
  }

  const comp = db.prepare('SELECT * FROM company WHERE tenant_id = ?').get(req.tenant_id);
  const entryNumber = generateJournalNumber(comp);
  db.prepare('UPDATE company SET journal_counter = ? WHERE tenant_id = ?').run((comp?.journal_counter || 1) + 1, req.tenant_id);

  const result = db.prepare('INSERT INTO journal_entries (tenant_id, entry_number, date, description, document_type, document_id, created_by) VALUES (?,?,?,?,?,?,?)')
    .run(req.tenant_id, entryNumber, date, description, document_type || null, document_id || null, req.user.id);
  const entryId = result.lastInsertRowid;

  const ins = db.prepare('INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description) VALUES (?,?,?,?,?)');
  lines.forEach(l => ins.run(entryId, l.account_id, l.debit || 0, l.credit || 0, l.description || null));

  db.prepare("INSERT INTO audit_log (tenant_id, user_id, action, entity, entity_id, details) VALUES (?, ?, 'create', 'journal_entry', ?, ?)")
    .run(req.tenant_id, req.user.id, entryId, `Vytvořen účetní zápis ${entryNumber}`);
  res.json({ id: entryId });
});

router.put('/api/journal/:id', ...tenanted, authorize('admin', 'accountant'), (req, res) => {
  const entry = db.prepare("SELECT * FROM journal_entries WHERE id = ? AND tenant_id = ? AND status = 'draft'").get(req.params.id, req.tenant_id);
  if (!entry) return res.status(404).json({ error: 'Zápis nenalezen nebo je již zaúčtován' });
  const { date, description, lines } = req.body;
  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return res.status(400).json({ error: `Součet MD a D se nerovná` });
  }
  db.prepare("UPDATE journal_entries SET date=?, description=?, updated_at=datetime('now') WHERE id=?").run(date, description, req.params.id);
  db.prepare('DELETE FROM journal_lines WHERE journal_entry_id = ?').run(req.params.id);
  const ins = db.prepare('INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description) VALUES (?,?,?,?,?)');
  lines.forEach(l => ins.run(req.params.id, l.account_id, l.debit || 0, l.credit || 0, l.description || null));
  res.json({ ok: true });
});

router.patch('/api/journal/:id/post', ...tenanted, authorize('admin', 'accountant'), (req, res) => {
  db.prepare("UPDATE journal_entries SET status='posted', updated_at=datetime('now') WHERE id=? AND tenant_id=? AND status='draft'").run(req.params.id, req.tenant_id);
  res.json({ ok: true });
});

router.patch('/api/journal/:id/cancel', ...tenanted, authorize('admin'), (req, res) => {
  db.prepare("UPDATE journal_entries SET status='cancelled', updated_at=datetime('now') WHERE id=? AND tenant_id=?").run(req.params.id, req.tenant_id);
  res.json({ ok: true });
});

router.delete('/api/journal/:id', ...tenanted, authorize('admin'), (req, res) => {
  const entry = db.prepare("SELECT status FROM journal_entries WHERE id = ? AND tenant_id = ?").get(req.params.id, req.tenant_id);
  if (entry?.status === 'posted') return res.status(400).json({ error: 'Zaúčtovaný zápis nelze smazat' });
  db.prepare('DELETE FROM journal_entries WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenant_id);
  res.json({ ok: true });
});

// ─── GENERAL LEDGER (hlavní kniha) ──────────────────────────
router.get('/api/ledger', ...tenanted, (req, res) => {
  const { account_id, from, to } = req.query;
  let sql = `SELECT jl.*, je.entry_number, je.date, je.description as entry_description, je.status,
    ca.account_number, ca.name as account_name
    FROM journal_lines jl
    JOIN journal_entries je ON jl.journal_entry_id = je.id
    JOIN chart_of_accounts ca ON jl.account_id = ca.id
    WHERE je.tenant_id = ? AND je.status = 'posted'`;
  const params = [req.tenant_id];
  if (account_id) { sql += ' AND jl.account_id = ?'; params.push(account_id); }
  if (from) { sql += ' AND je.date >= ?'; params.push(from); }
  if (to) { sql += ' AND je.date <= ?'; params.push(to); }
  sql += ' ORDER BY je.date, je.id, jl.id';
  res.json(db.prepare(sql).all(...params));
});

// Account balances (obratová předvaha)
router.get('/api/ledger/balances', ...tenanted, (req, res) => {
  const { from, to } = req.query;
  let dateFilter = '';
  const params = [req.tenant_id];
  if (from) { dateFilter += ' AND je.date >= ?'; params.push(from); }
  if (to) { dateFilter += ' AND je.date <= ?'; params.push(to); }

  const balances = db.prepare(`
    SELECT ca.id, ca.account_number, ca.name, ca.type,
      COALESCE(SUM(jl.debit), 0) as total_debit,
      COALESCE(SUM(jl.credit), 0) as total_credit,
      COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) as balance
    FROM chart_of_accounts ca
    LEFT JOIN journal_lines jl ON ca.id = jl.account_id
    LEFT JOIN journal_entries je ON jl.journal_entry_id = je.id AND je.status = 'posted'${dateFilter}
    WHERE ca.tenant_id = ? AND ca.active = 1
    GROUP BY ca.id
    HAVING total_debit > 0 OR total_credit > 0
    ORDER BY ca.account_number
  `).all(...params, req.tenant_id);
  res.json(balances);
});

// ─── VAT REPORT (DPH přiznání) ──────────────────────────────
router.get('/api/vat/records', ...tenanted, (req, res) => {
  const { from, to } = req.query;
  let sql = 'SELECT v.*, i.invoice_number, c.name as client_name FROM vat_records v LEFT JOIN invoices i ON v.invoice_id = i.id LEFT JOIN clients c ON i.client_id = c.id WHERE v.tenant_id = ?';
  const params = [req.tenant_id];
  if (from) { sql += ' AND v.date >= ?'; params.push(from); }
  if (to) { sql += ' AND v.date <= ?'; params.push(to); }
  sql += ' ORDER BY v.date';
  res.json(db.prepare(sql).all(...params));
});

router.get('/api/vat/report', ...tenanted, (req, res) => {
  const { year, month } = req.query;
  if (!year || !month) return res.status(400).json({ error: 'Zadejte rok a měsíc' });
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

  // Output VAT (DPH na výstupu) from issued invoices
  const outputByRate = db.prepare(`
    SELECT vat_rate, SUM(tax_base) as base, SUM(tax_amount) as tax
    FROM vat_records WHERE tenant_id = ? AND type = 'output' AND date >= ? AND date <= ?
    GROUP BY vat_rate ORDER BY vat_rate
  `).all(req.tenant_id, from, to);

  // Input VAT (DPH na vstupu) from received invoices
  const inputByRate = db.prepare(`
    SELECT vat_rate, SUM(tax_base) as base, SUM(tax_amount) as tax
    FROM vat_records WHERE tenant_id = ? AND type = 'input' AND date >= ? AND date <= ?
    GROUP BY vat_rate ORDER BY vat_rate
  `).all(req.tenant_id, from, to);

  const totalOutput = outputByRate.reduce((s, r) => s + r.tax, 0);
  const totalInput = inputByRate.reduce((s, r) => s + r.tax, 0);

  res.json({
    period: { year: parseInt(year), month: parseInt(month), from, to },
    output: outputByRate,
    input: inputByRate,
    totalOutput,
    totalInput,
    liability: totalOutput - totalInput,
  });
});

// Auto-generate VAT records from invoices
router.post('/api/vat/generate', ...tenanted, authorize('admin', 'accountant'), (req, res) => {
  const { year, month } = req.body;
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

  // Clear existing records for this period
  db.prepare('DELETE FROM vat_records WHERE tenant_id = ? AND date >= ? AND date <= ?').run(req.tenant_id, from, to);

  // Generate from issued invoices (output VAT)
  const issued = db.prepare(`SELECT i.id, i.supply_date, i.issue_date, ii.total as item_total, ii.tax_rate, ii.tax_amount
    FROM invoices i JOIN invoice_items ii ON i.id = ii.invoice_id
    WHERE i.tenant_id = ? AND i.type = 'issued' AND i.status != 'cancelled'
    AND COALESCE(i.supply_date, i.issue_date) >= ? AND COALESCE(i.supply_date, i.issue_date) <= ?
  `).all(req.tenant_id, from, to);

  const ins = db.prepare('INSERT INTO vat_records (tenant_id, invoice_id, type, tax_base, tax_amount, vat_rate, date, section) VALUES (?,?,?,?,?,?,?,?)');
  issued.forEach(r => {
    const section = r.tax_rate >= 21 ? 'A1' : r.tax_rate >= 12 ? 'A2' : 'A5';
    ins.run(req.tenant_id, r.id, 'output', r.item_total, r.tax_amount, r.tax_rate, r.supply_date || r.issue_date, section);
  });

  // Generate from received invoices (input VAT)
  const received = db.prepare(`SELECT i.id, i.supply_date, i.issue_date, ii.total as item_total, ii.tax_rate, ii.tax_amount
    FROM invoices i JOIN invoice_items ii ON i.id = ii.invoice_id
    WHERE i.tenant_id = ? AND i.type = 'received' AND i.status != 'cancelled'
    AND COALESCE(i.supply_date, i.issue_date) >= ? AND COALESCE(i.supply_date, i.issue_date) <= ?
  `).all(req.tenant_id, from, to);
  received.forEach(r => {
    const section = r.tax_rate >= 21 ? 'B1' : r.tax_rate >= 12 ? 'B2' : 'B3';
    ins.run(req.tenant_id, r.id, 'input', Math.abs(r.item_total), Math.abs(r.tax_amount), r.tax_rate, r.supply_date || r.issue_date, section);
  });

  res.json({ ok: true, generated: issued.length + received.length });
});

// VAT XML export (simplified for Czech tax authority)
router.get('/api/vat/export-xml', ...tenanted, authorize('admin', 'accountant'), (req, res) => {
  const { year, month } = req.query;
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
  const company = db.prepare('SELECT * FROM company WHERE tenant_id = ?').get(req.tenant_id);
  const co = company || {};

  const outputByRate = db.prepare(`SELECT vat_rate, SUM(tax_base) as base, SUM(tax_amount) as tax FROM vat_records WHERE tenant_id = ? AND type = 'output' AND date >= ? AND date <= ? GROUP BY vat_rate`).all(req.tenant_id, from, to);
  const inputByRate = db.prepare(`SELECT vat_rate, SUM(tax_base) as base, SUM(tax_amount) as tax FROM vat_records WHERE tenant_id = ? AND type = 'input' AND date >= ? AND date <= ? GROUP BY vat_rate`).all(req.tenant_id, from, to);

  const totalOutput = outputByRate.reduce((s, r) => s + r.tax, 0);
  const totalInput = inputByRate.reduce((s, r) => s + r.tax, 0);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Pisemnost nazevSW="RFI ERP" verzeSW="1.0">
<DPHKH1 verzePis="02.01">
  <VetaD daession="${year}${String(month).padStart(2,'0')}" k_uladis="DPH" dokession="${year}-${String(month).padStart(2,'0')}"
    ic="${co.ico || ''}" dic="${co.dic || ''}" />
  <VetaA obession21="${(outputByRate.find(r=>r.vat_rate>=21)?.base||0).toFixed(0)}"
    dan21="${(outputByRate.find(r=>r.vat_rate>=21)?.tax||0).toFixed(0)}"
    obession12="${(outputByRate.find(r=>r.vat_rate>=12&&r.vat_rate<21)?.base||0).toFixed(0)}"
    dan12="${(outputByRate.find(r=>r.vat_rate>=12&&r.vat_rate<21)?.tax||0).toFixed(0)}" />
  <VetaB odpocet_zd21="${(inputByRate.find(r=>r.vat_rate>=21)?.base||0).toFixed(0)}"
    odpocet_dan21="${(inputByRate.find(r=>r.vat_rate>=21)?.tax||0).toFixed(0)}"
    odpocet_zd12="${(inputByRate.find(r=>r.vat_rate>=12&&r.vat_rate<21)?.base||0).toFixed(0)}"
    odpocet_dan12="${(inputByRate.find(r=>r.vat_rate>=12&&r.vat_rate<21)?.tax||0).toFixed(0)}" />
  <VetaC dan_zocelkem="${totalOutput.toFixed(0)}" odp_zocelkem="${totalInput.toFixed(0)}"
    dano="${(totalOutput - totalInput).toFixed(0)}" />
</DPHKH1>
</Pisemnost>`;
  res.set({ 'Content-Type': 'application/xml; charset=utf-8', 'Content-Disposition': `attachment; filename=dph-${year}-${String(month).padStart(2,'0')}.xml` });
  res.send(xml);
});

module.exports = router;
