const express = require('express');
const db = require('./database');
const { authenticate, authorize, tenantScope } = require('./auth');
const router = express.Router();
const tenanted = [authenticate, tenantScope];

// ─── CASH REGISTERS ─────────────────────────────────────────
router.get('/api/cash-registers', ...tenanted, (req, res) => {
  const registers = db.prepare('SELECT * FROM cash_registers WHERE tenant_id = ? ORDER BY name').all(req.tenant_id);
  registers.forEach(r => {
    const docs = db.prepare(`SELECT
      COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0) as total_income,
      COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) as total_expense
      FROM cash_documents WHERE register_id = ? AND tenant_id = ?`).get(r.id, req.tenant_id);
    r.balance = r.initial_balance + docs.total_income - docs.total_expense;
    r.total_income = docs.total_income;
    r.total_expense = docs.total_expense;
  });
  res.json(registers);
});

router.post('/api/cash-registers', ...tenanted, authorize('admin', 'accountant'), (req, res) => {
  const { name, currency, initial_balance } = req.body;
  if (!name) return res.status(400).json({ error: 'Zadejte název pokladny' });
  const result = db.prepare('INSERT INTO cash_registers (tenant_id, name, currency, initial_balance) VALUES (?,?,?,?)')
    .run(req.tenant_id, name, currency || 'CZK', initial_balance || 0);
  res.json({ id: result.lastInsertRowid });
});

router.put('/api/cash-registers/:id', ...tenanted, authorize('admin', 'accountant'), (req, res) => {
  const { name, currency, initial_balance, active } = req.body;
  db.prepare('UPDATE cash_registers SET name=?, currency=?, initial_balance=?, active=? WHERE id=? AND tenant_id=?')
    .run(name, currency || 'CZK', initial_balance || 0, active ?? 1, req.params.id, req.tenant_id);
  res.json({ ok: true });
});

// ─── CASH DOCUMENTS ─────────────────────────────────────────
function generateCashNumber(comp, type) {
  const prefix = type === 'income' ? (comp?.cash_prefix || 'PPD') : 'VPD';
  const counter = comp?.cash_counter || 1;
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(counter).padStart(4, '0')}`;
}

router.get('/api/cash-documents', ...tenanted, (req, res) => {
  const { register_id, type, from, to } = req.query;
  let sql = `SELECT cd.*, cr.name as register_name, u.full_name as created_by_name
    FROM cash_documents cd
    LEFT JOIN cash_registers cr ON cd.register_id = cr.id
    LEFT JOIN users u ON cd.created_by = u.id
    WHERE cd.tenant_id = ?`;
  const params = [req.tenant_id];
  if (register_id) { sql += ' AND cd.register_id = ?'; params.push(register_id); }
  if (type) { sql += ' AND cd.type = ?'; params.push(type); }
  if (from) { sql += ' AND cd.date >= ?'; params.push(from); }
  if (to) { sql += ' AND cd.date <= ?'; params.push(to); }
  sql += ' ORDER BY cd.date DESC, cd.id DESC';
  res.json(db.prepare(sql).all(...params));
});

router.post('/api/cash-documents', ...tenanted, authorize('admin', 'accountant', 'manager'), (req, res) => {
  const { register_id, type, amount, date, description, category, invoice_id } = req.body;
  if (!register_id || !type || !amount || !date) return res.status(400).json({ error: 'Vyplňte povinná pole' });

  const comp = db.prepare('SELECT * FROM company WHERE tenant_id = ?').get(req.tenant_id);
  const docNumber = generateCashNumber(comp, type);
  db.prepare('UPDATE company SET cash_counter = ? WHERE tenant_id = ?').run((comp?.cash_counter || 1) + 1, req.tenant_id);

  const result = db.prepare('INSERT INTO cash_documents (tenant_id, register_id, document_number, type, amount, date, description, category, invoice_id, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(req.tenant_id, register_id, docNumber, type, amount, date, description || null, category || null, invoice_id || null, req.user.id);
  res.json({ id: result.lastInsertRowid, document_number: docNumber });
});

router.put('/api/cash-documents/:id', ...tenanted, authorize('admin', 'accountant'), (req, res) => {
  const { type, amount, date, description, category, invoice_id } = req.body;
  db.prepare('UPDATE cash_documents SET type=?, amount=?, date=?, description=?, category=?, invoice_id=? WHERE id=? AND tenant_id=?')
    .run(type, amount, date, description, category, invoice_id || null, req.params.id, req.tenant_id);
  res.json({ ok: true });
});

router.delete('/api/cash-documents/:id', ...tenanted, authorize('admin'), (req, res) => {
  db.prepare('DELETE FROM cash_documents WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenant_id);
  res.json({ ok: true });
});

// Cash register report
router.get('/api/cash-registers/:id/report', ...tenanted, (req, res) => {
  const { from, to } = req.query;
  const register = db.prepare('SELECT * FROM cash_registers WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id);
  if (!register) return res.status(404).json({ error: 'Pokladna nenalezena' });

  let sql = 'SELECT * FROM cash_documents WHERE register_id = ? AND tenant_id = ?';
  const params = [req.params.id, req.tenant_id];
  if (from) { sql += ' AND date >= ?'; params.push(from); }
  if (to) { sql += ' AND date <= ?'; params.push(to); }
  sql += ' ORDER BY date, id';

  const documents = db.prepare(sql).all(...params);
  let balance = register.initial_balance;
  const entries = documents.map(d => {
    balance += d.type === 'income' ? d.amount : -d.amount;
    return { ...d, running_balance: balance };
  });

  res.json({ register, entries, final_balance: balance });
});

module.exports = router;
