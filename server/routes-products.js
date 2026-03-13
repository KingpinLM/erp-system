const express = require('express');
const db = require('./database');
const { authenticate, authorize, tenantScope } = require('./auth');
const router = express.Router();
const tenanted = [authenticate, tenantScope];

// ─── PRODUCTS ───────────────────────────────────────────────
router.get('/api/products', ...tenanted, (req, res) => {
  const { type, active } = req.query;
  let sql = 'SELECT * FROM products WHERE tenant_id = ?';
  const params = [req.tenant_id];
  if (type) { sql += ' AND type = ?'; params.push(type); }
  if (active !== undefined) { sql += ' AND active = ?'; params.push(active === 'true' ? 1 : 0); }
  sql += ' ORDER BY name';
  res.json(db.prepare(sql).all(...params));
});

router.get('/api/products/:id', ...tenanted, (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id);
  if (!product) return res.status(404).json({ error: 'Produkt nenalezen' });
  product.movements = db.prepare('SELECT sm.*, u.full_name as created_by_name FROM stock_movements sm LEFT JOIN users u ON sm.created_by = u.id WHERE sm.product_id = ? AND sm.tenant_id = ? ORDER BY sm.date DESC LIMIT 50').all(req.params.id, req.tenant_id);
  res.json(product);
});

router.post('/api/products', ...tenanted, authorize('admin', 'accountant', 'manager'), (req, res) => {
  const { name, sku, description, unit, unit_price, purchase_price, vat_rate, type, stock_quantity, min_stock } = req.body;
  if (!name) return res.status(400).json({ error: 'Zadejte název produktu' });
  try {
    const result = db.prepare('INSERT INTO products (tenant_id, name, sku, description, unit, unit_price, purchase_price, vat_rate, type, stock_quantity, min_stock) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .run(req.tenant_id, name, sku || null, description || null, unit || 'ks', unit_price || 0, purchase_price || 0, vat_rate ?? 21, type || 'service', stock_quantity || 0, min_stock || 0);
    res.json({ id: result.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: 'Produkt s tímto SKU již existuje' });
  }
});

router.put('/api/products/:id', ...tenanted, authorize('admin', 'accountant', 'manager'), (req, res) => {
  const { name, sku, description, unit, unit_price, purchase_price, vat_rate, type, min_stock, active } = req.body;
  db.prepare('UPDATE products SET name=?, sku=?, description=?, unit=?, unit_price=?, purchase_price=?, vat_rate=?, type=?, min_stock=?, active=? WHERE id=? AND tenant_id=?')
    .run(name, sku || null, description || null, unit || 'ks', unit_price || 0, purchase_price || 0, vat_rate ?? 21, type || 'service', min_stock || 0, active ?? 1, req.params.id, req.tenant_id);
  res.json({ ok: true });
});

router.delete('/api/products/:id', ...tenanted, authorize('admin'), (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ? AND tenant_id = ?').run(req.params.id, req.tenant_id);
  res.json({ ok: true });
});

// ─── STOCK MOVEMENTS ────────────────────────────────────────
router.get('/api/stock-movements', ...tenanted, (req, res) => {
  const { product_id, type, from, to } = req.query;
  let sql = `SELECT sm.*, p.name as product_name, p.sku, u.full_name as created_by_name
    FROM stock_movements sm
    JOIN products p ON sm.product_id = p.id
    LEFT JOIN users u ON sm.created_by = u.id
    WHERE sm.tenant_id = ?`;
  const params = [req.tenant_id];
  if (product_id) { sql += ' AND sm.product_id = ?'; params.push(product_id); }
  if (type) { sql += ' AND sm.type = ?'; params.push(type); }
  if (from) { sql += ' AND sm.date >= ?'; params.push(from); }
  if (to) { sql += ' AND sm.date <= ?'; params.push(to); }
  sql += ' ORDER BY sm.date DESC, sm.id DESC';
  res.json(db.prepare(sql).all(...params));
});

router.post('/api/stock-movements', ...tenanted, authorize('admin', 'accountant', 'manager'), (req, res) => {
  const { product_id, type, quantity, unit_price, date, note } = req.body;
  if (!product_id || !type || !quantity || !date) return res.status(400).json({ error: 'Vyplňte povinná pole' });

  const product = db.prepare('SELECT * FROM products WHERE id = ? AND tenant_id = ?').get(product_id, req.tenant_id);
  if (!product) return res.status(404).json({ error: 'Produkt nenalezen' });

  const result = db.prepare('INSERT INTO stock_movements (tenant_id, product_id, type, quantity, unit_price, date, note, created_by) VALUES (?,?,?,?,?,?,?,?)')
    .run(req.tenant_id, product_id, type, quantity, unit_price || 0, date, note || null, req.user.id);

  // Update stock quantity
  const delta = type === 'in' ? quantity : type === 'out' ? -quantity : 0;
  if (type === 'adjustment') {
    db.prepare('UPDATE products SET stock_quantity = ? WHERE id = ?').run(quantity, product_id);
  } else {
    db.prepare('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?').run(delta, product_id);
  }

  res.json({ id: result.lastInsertRowid });
});

// Stock report (low stock warnings)
router.get('/api/stock/report', ...tenanted, (req, res) => {
  const products = db.prepare("SELECT * FROM products WHERE tenant_id = ? AND type = 'product' AND active = 1 ORDER BY name").all(req.tenant_id);
  const lowStock = products.filter(p => p.stock_quantity <= p.min_stock);
  const totalValue = products.reduce((s, p) => s + (p.stock_quantity * p.purchase_price), 0);
  res.json({ products, lowStock, totalValue });
});

module.exports = router;
