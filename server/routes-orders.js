const express = require('express');
const db = require('./database');
const { authenticate, authorize, tenantScope } = require('./auth');
const router = express.Router();
const tenanted = [authenticate, tenantScope];

function generateOrderNumber(comp) {
  const prefix = comp?.order_prefix || 'OBJ';
  const counter = comp?.order_counter || 1;
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(counter).padStart(4, '0')}`;
}

// ─── ORDERS ─────────────────────────────────────────────────
router.get('/api/orders', ...tenanted, (req, res) => {
  const { type, status } = req.query;
  let sql = `SELECT o.*, c.name as client_name FROM orders o LEFT JOIN clients c ON o.client_id = c.id WHERE o.tenant_id = ?`;
  const params = [req.tenant_id];
  if (type) { sql += ' AND o.type = ?'; params.push(type); }
  if (status) { sql += ' AND o.status = ?'; params.push(status); }
  sql += ' ORDER BY o.date DESC, o.id DESC';
  res.json(db.prepare(sql).all(...params));
});

router.get('/api/orders/:id', ...tenanted, (req, res) => {
  const order = db.prepare(`SELECT o.*, c.name as client_name, c.ico as client_ico, c.dic as client_dic,
    c.address as client_address, c.city as client_city, c.zip as client_zip
    FROM orders o LEFT JOIN clients c ON o.client_id = c.id WHERE o.id = ? AND o.tenant_id = ?`).get(req.params.id, req.tenant_id);
  if (!order) return res.status(404).json({ error: 'Objednávka nenalezena' });
  order.items = db.prepare(`SELECT oi.*, p.name as product_name, p.sku
    FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?`).all(req.params.id);
  res.json(order);
});

router.post('/api/orders', ...tenanted, authorize('admin', 'accountant', 'manager'), (req, res) => {
  const { type, client_id, date, due_date, currency, note, items } = req.body;
  if (!date) return res.status(400).json({ error: 'Zadejte datum objednávky' });

  const comp = db.prepare('SELECT * FROM company WHERE tenant_id = ?').get(req.tenant_id);
  const orderNumber = generateOrderNumber(comp);
  db.prepare('UPDATE company SET order_counter = ? WHERE tenant_id = ?').run((comp?.order_counter || 1) + 1, req.tenant_id);

  let subtotal = 0, taxAmount = 0;
  if (items) items.forEach(i => {
    const lineTotal = (i.quantity || 1) * (i.unit_price || 0);
    const lineTax = lineTotal * ((i.tax_rate ?? 21) / 100);
    subtotal += lineTotal;
    taxAmount += lineTax;
  });

  const result = db.prepare('INSERT INTO orders (tenant_id, order_number, type, client_id, date, due_date, currency, subtotal, tax_amount, total, note, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(req.tenant_id, orderNumber, type || 'received', client_id || null, date, due_date || null, currency || 'CZK', subtotal, taxAmount, subtotal + taxAmount, note || null, req.user.id);
  const orderId = result.lastInsertRowid;

  const ins = db.prepare('INSERT INTO order_items (order_id, product_id, description, quantity, unit, unit_price, tax_rate, total) VALUES (?,?,?,?,?,?,?,?)');
  if (items) items.forEach(i => {
    const lineTotal = (i.quantity || 1) * (i.unit_price || 0);
    ins.run(orderId, i.product_id || null, i.description, i.quantity || 1, i.unit || 'ks', i.unit_price || 0, i.tax_rate ?? 21, lineTotal);
  });

  db.prepare("INSERT INTO audit_log (tenant_id, user_id, action, entity, entity_id, details) VALUES (?, ?, 'create', 'order', ?, ?)")
    .run(req.tenant_id, req.user.id, orderId, `Vytvořena objednávka ${orderNumber}`);
  res.json({ id: orderId, order_number: orderNumber });
});

router.put('/api/orders/:id', ...tenanted, authorize('admin', 'accountant', 'manager'), (req, res) => {
  const { client_id, date, due_date, status, currency, note, items } = req.body;

  let subtotal = 0, taxAmount = 0;
  if (items) items.forEach(i => {
    const lineTotal = (i.quantity || 1) * (i.unit_price || 0);
    const lineTax = lineTotal * ((i.tax_rate ?? 21) / 100);
    subtotal += lineTotal;
    taxAmount += lineTax;
  });

  db.prepare("UPDATE orders SET client_id=?, date=?, due_date=?, status=?, currency=?, subtotal=?, tax_amount=?, total=?, note=?, updated_at=datetime('now') WHERE id=? AND tenant_id=?")
    .run(client_id || null, date, due_date || null, status || 'draft', currency || 'CZK', subtotal, taxAmount, subtotal + taxAmount, note || null, req.params.id, req.tenant_id);

  db.prepare('DELETE FROM order_items WHERE order_id = ?').run(req.params.id);
  const ins = db.prepare('INSERT INTO order_items (order_id, product_id, description, quantity, unit, unit_price, tax_rate, total) VALUES (?,?,?,?,?,?,?,?)');
  if (items) items.forEach(i => {
    const lineTotal = (i.quantity || 1) * (i.unit_price || 0);
    ins.run(req.params.id, i.product_id || null, i.description, i.quantity || 1, i.unit || 'ks', i.unit_price || 0, i.tax_rate ?? 21, lineTotal);
  });
  res.json({ ok: true });
});

router.patch('/api/orders/:id/status', ...tenanted, authorize('admin', 'accountant', 'manager'), (req, res) => {
  const { status } = req.body;
  db.prepare("UPDATE orders SET status=?, updated_at=datetime('now') WHERE id=? AND tenant_id=?").run(status, req.params.id, req.tenant_id);
  res.json({ ok: true });
});

// Convert order to invoice
router.post('/api/orders/:id/to-invoice', ...tenanted, authorize('admin', 'accountant'), (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ? AND tenant_id = ? AND status != 'invoiced'").get(req.params.id, req.tenant_id);
  if (!order) return res.status(404).json({ error: 'Objednávka nenalezena nebo již fakturována' });

  const comp = db.prepare('SELECT * FROM company WHERE tenant_id = ?').get(req.tenant_id);
  if (!comp || (!comp.bank_account && !comp.iban)) {
    return res.status(400).json({ error: 'Nastavte bankovní spojení v nastavení firmy' });
  }

  // Generate invoice number
  const prefix = comp?.invoice_prefix || 'FV';
  const counter = comp?.invoice_counter || 1;
  const sep = comp?.invoice_separator || '-';
  const padding = comp?.invoice_padding || 3;
  const yearFmt = comp?.invoice_year_format || 'full';
  const format = comp?.invoice_format || '{prefix}{sep}{year}{sep}{num}';
  const fullYear = new Date().getFullYear();
  const year = yearFmt === 'short' ? String(fullYear).slice(2) : String(fullYear);
  const num = String(counter).padStart(padding, '0');
  const invoiceNumber = format.replace(/\{prefix\}/g, prefix).replace(/\{sep\}/g, sep).replace(/\{year\}/g, year).replace(/\{num\}/g, num);
  const vs = String(fullYear % 100) + String(counter).padStart(6, '0');
  db.prepare('UPDATE company SET invoice_counter = ? WHERE tenant_id = ?').run(counter + 1, req.tenant_id);

  const today = new Date().toISOString().slice(0, 10);
  const dueDays = comp?.default_due_days || 14;
  const due = new Date(); due.setDate(due.getDate() + dueDays);
  const curr = db.prepare('SELECT rate_to_czk FROM currencies WHERE code = ?').get(order.currency || 'CZK');
  const rate = curr ? curr.rate_to_czk : 1;

  const result = db.prepare(`INSERT INTO invoices (tenant_id, invoice_number, type, client_id, issue_date, due_date, supply_date, payment_method, status, currency, subtotal, tax_rate, tax_amount, total, total_czk, note, created_by, variable_symbol)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(req.tenant_id, invoiceNumber, 'issued', order.client_id, today, due.toISOString().slice(0,10), today, 'bank_transfer', 'draft', order.currency, order.subtotal, 0, order.tax_amount, order.total, order.total * rate, order.note, req.user.id, vs);
  const invoiceId = result.lastInsertRowid;

  const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id);
  const ins = db.prepare('INSERT INTO invoice_items (invoice_id, description, quantity, unit, unit_price, total, tax_rate, tax_amount, total_with_tax) VALUES (?,?,?,?,?,?,?,?,?)');
  orderItems.forEach(i => {
    const lineTax = i.total * ((i.tax_rate ?? 21) / 100);
    ins.run(invoiceId, i.description, i.quantity, i.unit, i.unit_price, i.total, i.tax_rate, lineTax, i.total + lineTax);
  });

  // Update order status and link
  db.prepare("UPDATE orders SET status='invoiced', invoice_id=?, updated_at=datetime('now') WHERE id=?").run(invoiceId, req.params.id);

  // Update stock for products
  orderItems.forEach(i => {
    if (i.product_id) {
      const product = db.prepare("SELECT type FROM products WHERE id = ?").get(i.product_id);
      if (product?.type === 'product') {
        db.prepare('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?').run(i.quantity, i.product_id);
        db.prepare('INSERT INTO stock_movements (tenant_id, product_id, type, quantity, unit_price, date, document_type, document_id, note, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)')
          .run(req.tenant_id, i.product_id, 'out', i.quantity, i.unit_price, today, 'invoice', invoiceId, `Faktura ${invoiceNumber}`, req.user.id);
      }
    }
  });

  db.prepare("INSERT INTO audit_log (tenant_id, user_id, action, entity, entity_id, details) VALUES (?, ?, 'create', 'invoice', ?, ?)")
    .run(req.tenant_id, req.user.id, invoiceId, `Faktura z objednávky ${order.order_number}`);
  res.json({ id: invoiceId });
});

router.delete('/api/orders/:id', ...tenanted, authorize('admin'), (req, res) => {
  db.prepare('DELETE FROM orders WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenant_id);
  res.json({ ok: true });
});

module.exports = router;
