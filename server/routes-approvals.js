const express = require('express');
const router = express.Router();
const db = require('./database');
const { authenticateToken } = require('./auth');

router.use(authenticateToken);

// ── Get all approval workflows ──
router.get('/workflows', (req, res) => {
  const rows = db.prepare('SELECT * FROM approval_workflows WHERE tenant_id = ? ORDER BY created_at DESC').all(req.user.tenant_id);
  res.json(rows.map(r => ({ ...r, steps: JSON.parse(r.steps || '[]') })));
});

// ── Create workflow ──
router.post('/workflows', (req, res) => {
  const { name, entity_type, min_amount, max_amount, steps } = req.body;
  if (!name) return res.status(400).json({ error: 'Název je povinný' });
  const result = db.prepare(
    'INSERT INTO approval_workflows (tenant_id, name, entity_type, min_amount, max_amount, steps) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.user.tenant_id, name, entity_type || 'invoice', min_amount || 0, max_amount || null, JSON.stringify(steps || []));
  res.json({ id: result.lastInsertRowid });
});

// ── Update workflow ──
router.put('/workflows/:id', (req, res) => {
  const wf = db.prepare('SELECT * FROM approval_workflows WHERE id = ? AND tenant_id = ?').get(req.params.id, req.user.tenant_id);
  if (!wf) return res.status(404).json({ error: 'Nenalezeno' });
  const { name, entity_type, min_amount, max_amount, steps, active } = req.body;
  db.prepare(
    'UPDATE approval_workflows SET name = ?, entity_type = ?, min_amount = ?, max_amount = ?, steps = ?, active = ? WHERE id = ?'
  ).run(name || wf.name, entity_type || wf.entity_type, min_amount ?? wf.min_amount, max_amount ?? wf.max_amount, JSON.stringify(steps || JSON.parse(wf.steps)), active ?? wf.active, wf.id);
  res.json({ ok: true });
});

// ── Delete workflow ──
router.delete('/workflows/:id', (req, res) => {
  db.prepare('DELETE FROM approval_workflows WHERE id = ? AND tenant_id = ?').run(req.params.id, req.user.tenant_id);
  res.json({ ok: true });
});

// ── Get approval requests ──
router.get('/requests', (req, res) => {
  const { status, entity_type } = req.query;
  let sql = 'SELECT ar.*, u.full_name as requester_name FROM approval_requests ar LEFT JOIN users u ON ar.requested_by = u.id WHERE ar.tenant_id = ?';
  const params = [req.user.tenant_id];
  if (status) { sql += ' AND ar.status = ?'; params.push(status); }
  if (entity_type) { sql += ' AND ar.entity_type = ?'; params.push(entity_type); }
  sql += ' ORDER BY ar.created_at DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// ── Get my pending approvals ──
router.get('/my-pending', (req, res) => {
  const rows = db.prepare(`
    SELECT ar.*, u.full_name as requester_name
    FROM approval_requests ar
    LEFT JOIN users u ON ar.requested_by = u.id
    WHERE ar.tenant_id = ? AND ar.status = 'pending'
    ORDER BY ar.created_at DESC
  `).all(req.user.tenant_id);
  res.json(rows);
});

// ── Create approval request ──
router.post('/requests', (req, res) => {
  const { entity_type, entity_id, entity_number, entity_amount, entity_currency } = req.body;
  if (!entity_type || !entity_id) return res.status(400).json({ error: 'Chybí údaje' });

  // Find matching workflow
  let workflow = db.prepare(
    'SELECT * FROM approval_workflows WHERE tenant_id = ? AND entity_type = ? AND active = 1 AND min_amount <= ? AND (max_amount IS NULL OR max_amount >= ?) ORDER BY min_amount DESC LIMIT 1'
  ).get(req.user.tenant_id, entity_type, entity_amount || 0, entity_amount || 0);

  const steps = workflow ? JSON.parse(workflow.steps || '[]') : [];
  const totalSteps = Math.max(steps.length, 1);

  const result = db.prepare(
    'INSERT INTO approval_requests (tenant_id, workflow_id, entity_type, entity_id, entity_number, entity_amount, entity_currency, total_steps, requested_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user.tenant_id, workflow?.id || null, entity_type, entity_id, entity_number || '', entity_amount || 0, entity_currency || 'CZK', totalSteps, req.user.id);

  // Log to audit
  db.prepare('INSERT INTO audit_log (tenant_id, user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)').run(
    req.user.tenant_id, req.user.id, 'approval_requested', entity_type, entity_id, JSON.stringify({ request_id: result.lastInsertRowid })
  );

  res.json({ id: result.lastInsertRowid });
});

// ── Approve / Reject ──
router.post('/requests/:id/action', (req, res) => {
  const { action, comment } = req.body;
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'Neplatná akce' });

  const ar = db.prepare('SELECT * FROM approval_requests WHERE id = ? AND tenant_id = ?').get(req.params.id, req.user.tenant_id);
  if (!ar) return res.status(404).json({ error: 'Nenalezeno' });
  if (ar.status !== 'pending') return res.status(400).json({ error: 'Již vyřízeno' });

  // Record the action
  db.prepare('INSERT INTO approval_actions (request_id, step, user_id, action, comment) VALUES (?, ?, ?, ?, ?)').run(
    ar.id, ar.current_step, req.user.id, action, comment || null
  );

  if (action === 'reject') {
    db.prepare("UPDATE approval_requests SET status = 'rejected', updated_at = datetime('now') WHERE id = ?").run(ar.id);
  } else {
    const nextStep = ar.current_step + 1;
    if (nextStep >= ar.total_steps) {
      db.prepare("UPDATE approval_requests SET status = 'approved', current_step = ?, updated_at = datetime('now') WHERE id = ?").run(nextStep, ar.id);
    } else {
      db.prepare("UPDATE approval_requests SET current_step = ?, updated_at = datetime('now') WHERE id = ?").run(nextStep, ar.id);
    }
  }

  // Audit log
  db.prepare('INSERT INTO audit_log (tenant_id, user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)').run(
    req.user.tenant_id, req.user.id, `approval_${action}`, ar.entity_type, ar.entity_id, JSON.stringify({ request_id: ar.id, comment })
  );

  res.json({ ok: true });
});

// ── Get approval actions/history for a request ──
router.get('/requests/:id/actions', (req, res) => {
  const actions = db.prepare(`
    SELECT aa.*, u.full_name as user_name
    FROM approval_actions aa
    LEFT JOIN users u ON aa.user_id = u.id
    WHERE aa.request_id = ?
    ORDER BY aa.created_at ASC
  `).all(req.params.id);
  res.json(actions);
});

// ── Dashboard stats for approvals ──
router.get('/stats', (req, res) => {
  const pending = db.prepare("SELECT COUNT(*) as count FROM approval_requests WHERE tenant_id = ? AND status = 'pending'").get(req.user.tenant_id);
  const approved = db.prepare("SELECT COUNT(*) as count FROM approval_requests WHERE tenant_id = ? AND status = 'approved'").get(req.user.tenant_id);
  const rejected = db.prepare("SELECT COUNT(*) as count FROM approval_requests WHERE tenant_id = ? AND status = 'rejected'").get(req.user.tenant_id);
  const recent = db.prepare("SELECT * FROM approval_requests WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 5").all(req.user.tenant_id);
  res.json({ pending: pending.count, approved: approved.count, rejected: rejected.count, recent });
});

module.exports = router;
