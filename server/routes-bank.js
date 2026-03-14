const express = require('express');
const db = require('./database');
const { authenticate, authorize, tenantScope } = require('./auth');
const router = express.Router();
const tenanted = [authenticate, tenantScope];

// ─── BANK ACCOUNTS ──────────────────────────────────────────
router.get('/api/bank-accounts', ...tenanted, (req, res) => {
  const accounts = db.prepare('SELECT * FROM bank_accounts WHERE tenant_id = ? ORDER BY name').all(req.tenant_id);
  accounts.forEach(a => {
    const txns = db.prepare('SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as income, COALESCE(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END), 0) as expense FROM bank_transactions WHERE bank_account_id = ? AND tenant_id = ?').get(a.id, req.tenant_id);
    a.balance = a.initial_balance + (txns.income + txns.expense);
    a.transaction_count = db.prepare('SELECT COUNT(*) as cnt FROM bank_transactions WHERE bank_account_id = ? AND tenant_id = ?').get(a.id, req.tenant_id).cnt;
  });
  res.json(accounts);
});

router.post('/api/bank-accounts', ...tenanted, authorize('admin', 'accountant'), (req, res) => {
  const { name, account_number, iban, currency, initial_balance } = req.body;
  const cur = currency || 'CZK';
  const existing = db.prepare('SELECT id FROM bank_accounts WHERE tenant_id = ? AND currency = ?').get(req.tenant_id, cur);
  if (existing) return res.status(400).json({ error: `Pro měnu ${cur} již existuje bankovní účet. Každá měna může mít pouze jeden účet.` });
  const result = db.prepare('INSERT INTO bank_accounts (tenant_id, name, account_number, iban, currency, initial_balance) VALUES (?,?,?,?,?,?)')
    .run(req.tenant_id, name, account_number || null, iban || null, cur, initial_balance || 0);
  res.json({ id: result.lastInsertRowid });
});

router.put('/api/bank-accounts/:id', ...tenanted, authorize('admin', 'accountant'), (req, res) => {
  const { name, account_number, iban, currency, initial_balance, active } = req.body;
  const cur = currency || 'CZK';
  const existing = db.prepare('SELECT id FROM bank_accounts WHERE tenant_id = ? AND currency = ? AND id != ?').get(req.tenant_id, cur, req.params.id);
  if (existing) return res.status(400).json({ error: `Pro měnu ${cur} již existuje jiný bankovní účet. Každá měna může mít pouze jeden účet.` });
  db.prepare('UPDATE bank_accounts SET name=?, account_number=?, iban=?, currency=?, initial_balance=?, active=? WHERE id=? AND tenant_id=?')
    .run(name, account_number || null, iban || null, cur, initial_balance || 0, active ?? 1, req.params.id, req.tenant_id);
  res.json({ ok: true });
});

// ─── BANK TRANSACTIONS ──────────────────────────────────────
router.get('/api/bank-transactions', ...tenanted, (req, res) => {
  const { bank_account_id, status, from, to } = req.query;
  let sql = `SELECT bt.*, ba.name as account_name, i.invoice_number as matched_invoice_number
    FROM bank_transactions bt
    LEFT JOIN bank_accounts ba ON bt.bank_account_id = ba.id
    LEFT JOIN invoices i ON bt.matched_invoice_id = i.id
    WHERE bt.tenant_id = ?`;
  const params = [req.tenant_id];
  if (bank_account_id) { sql += ' AND bt.bank_account_id = ?'; params.push(bank_account_id); }
  if (status) { sql += ' AND bt.status = ?'; params.push(status); }
  if (from) { sql += ' AND bt.date >= ?'; params.push(from); }
  if (to) { sql += ' AND bt.date <= ?'; params.push(to); }
  sql += ' ORDER BY bt.date DESC, bt.id DESC';
  res.json(db.prepare(sql).all(...params));
});

router.post('/api/bank-transactions', ...tenanted, authorize('admin', 'accountant'), (req, res) => {
  const { bank_account_id, date, amount, currency, counterparty_name, counterparty_account, variable_symbol, constant_symbol, specific_symbol, description } = req.body;
  const result = db.prepare('INSERT INTO bank_transactions (tenant_id, bank_account_id, date, amount, currency, counterparty_name, counterparty_account, variable_symbol, constant_symbol, specific_symbol, description) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(req.tenant_id, bank_account_id, date, amount, currency || 'CZK', counterparty_name || null, counterparty_account || null, variable_symbol || null, constant_symbol || null, specific_symbol || null, description || null);
  res.json({ id: result.lastInsertRowid });
});

// Import bank statement (CSV/ABO)
router.post('/api/bank-transactions/import', ...tenanted, authorize('admin', 'accountant'), (req, res) => {
  const { bank_account_id, format, data } = req.body;
  if (!bank_account_id || !data) return res.status(400).json({ error: 'Chybí data' });

  const transactions = [];
  if (format === 'csv') {
    const lines = data.split('\n').filter(l => l.trim());
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(';').map(c => c.trim().replace(/^"|"$/g, ''));
      if (cols.length >= 4) {
        transactions.push({
          date: cols[0], // YYYY-MM-DD or DD.MM.YYYY
          amount: parseFloat((cols[1] || '0').replace(/\s/g, '').replace(',', '.')),
          counterparty_name: cols[2] || null,
          counterparty_account: cols[3] || null,
          variable_symbol: cols[4] || null,
          description: cols[5] || null,
        });
      }
    }
  } else if (format === 'abo') {
    // ABO format (Czech bank standard)
    const lines = data.split('\n');
    for (const line of lines) {
      if (line.startsWith('075')) {
        const amount = parseInt(line.substring(48, 60)) / 100;
        const sign = line.substring(60, 61);
        const vs = line.substring(61, 71).replace(/^0+/, '');
        const date = `20${line.substring(28, 30)}-${line.substring(30, 32)}-${line.substring(32, 34)}`;
        const counterAccount = line.substring(80, 96).replace(/^0+/, '');
        transactions.push({
          date,
          amount: sign === '1' ? amount : -amount,
          variable_symbol: vs || null,
          counterparty_account: counterAccount || null,
          counterparty_name: null,
          description: null,
        });
      }
    }
  }

  // Parse dates and insert
  const ins = db.prepare('INSERT INTO bank_transactions (tenant_id, bank_account_id, date, amount, currency, counterparty_name, counterparty_account, variable_symbol, description) VALUES (?,?,?,?,?,?,?,?,?)');
  const account = db.prepare('SELECT currency FROM bank_accounts WHERE id = ? AND tenant_id = ?').get(bank_account_id, req.tenant_id);
  const currency = account?.currency || 'CZK';

  let imported = 0;
  transactions.forEach(t => {
    let date = t.date;
    // Convert DD.MM.YYYY to YYYY-MM-DD
    const m = date.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (m) date = `${m[3]}-${m[2]}-${m[1]}`;
    if (date && t.amount) {
      ins.run(req.tenant_id, bank_account_id, date, t.amount, currency, t.counterparty_name, t.counterparty_account, t.variable_symbol, t.description);
      imported++;
    }
  });

  res.json({ ok: true, imported });
});

// Auto-match bank transactions with invoices
router.post('/api/bank-transactions/auto-match', ...tenanted, authorize('admin', 'accountant'), (req, res) => {
  const unmatched = db.prepare("SELECT * FROM bank_transactions WHERE tenant_id = ? AND status = 'unmatched' AND amount > 0").all(req.tenant_id);
  let matched = 0;

  unmatched.forEach(txn => {
    let invoice = null;
    // Match by variable symbol
    if (txn.variable_symbol) {
      invoice = db.prepare("SELECT * FROM invoices WHERE tenant_id = ? AND variable_symbol = ? AND status IN ('sent','overdue')").get(req.tenant_id, txn.variable_symbol);
    }
    // Match by amount if no VS match
    if (!invoice && txn.amount > 0) {
      invoice = db.prepare("SELECT * FROM invoices WHERE tenant_id = ? AND total = ? AND status IN ('sent','overdue') AND type = 'issued'").get(req.tenant_id, txn.amount);
    }
    if (invoice) {
      db.prepare("UPDATE bank_transactions SET matched_invoice_id = ?, status = 'matched' WHERE id = ?").run(invoice.id, txn.id);
      // Mark invoice as paid
      db.prepare("UPDATE invoices SET status = 'paid', paid_date = ?, paid_amount = total, updated_at = datetime('now') WHERE id = ?").run(txn.date, invoice.id);
      // Add payment record
      db.prepare('INSERT INTO invoice_payments (invoice_id, amount, currency, date, note) VALUES (?,?,?,?,?)').run(invoice.id, txn.amount, txn.currency, txn.date, 'Automaticky spárováno z bankovního výpisu');
      matched++;
    }
  });
  res.json({ ok: true, matched });
});

// Manual match
router.patch('/api/bank-transactions/:id/match', ...tenanted, authorize('admin', 'accountant'), (req, res) => {
  const { invoice_id } = req.body;
  const txn = db.prepare('SELECT * FROM bank_transactions WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id);
  if (!txn) return res.status(404).json({ error: 'Transakce nenalezena' });

  if (invoice_id) {
    db.prepare("UPDATE bank_transactions SET matched_invoice_id = ?, status = 'matched' WHERE id = ?").run(invoice_id, req.params.id);
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ? AND tenant_id = ?').get(invoice_id, req.tenant_id);
    if (invoice) {
      db.prepare("UPDATE invoices SET status = 'paid', paid_date = ?, paid_amount = total, updated_at = datetime('now') WHERE id = ?").run(txn.date, invoice_id);
      db.prepare('INSERT INTO invoice_payments (invoice_id, amount, currency, date, note) VALUES (?,?,?,?,?)').run(invoice_id, Math.abs(txn.amount), txn.currency, txn.date, 'Ručně spárováno');
    }
  } else {
    db.prepare("UPDATE bank_transactions SET status = 'ignored' WHERE id = ?").run(req.params.id);
  }
  res.json({ ok: true });
});

router.delete('/api/bank-transactions/:id', ...tenanted, authorize('admin'), (req, res) => {
  db.prepare('DELETE FROM bank_transactions WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenant_id);
  res.json({ ok: true });
});

module.exports = router;
