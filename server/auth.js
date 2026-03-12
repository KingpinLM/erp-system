const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'erp-system-secret-key-2026';

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, tenant_id: user.tenant_id },
    SECRET,
    { expiresIn: '8h' }
  );
}

function generateSuperadminToken(sa) {
  return jwt.sign(
    { id: sa.id, username: sa.username, role: 'superadmin' },
    SECRET,
    { expiresIn: '8h' }
  );
}

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Přístup odepřen' });
  }
  try {
    req.user = jwt.verify(header.slice(7), SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Neplatný token' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Nedostatečná oprávnění' });
    }
    next();
  };
}

// Middleware: extract tenant_id from authenticated user token
function tenantScope(req, res, next) {
  if (!req.user.tenant_id) {
    return res.status(403).json({ error: 'Chybí tenant kontext' });
  }
  req.tenant_id = req.user.tenant_id;
  next();
}

// Middleware: require superadmin role
function requireSuperadmin(req, res, next) {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Vyžadován superadmin přístup' });
  }
  next();
}

module.exports = { generateToken, generateSuperadminToken, authenticate, authorize, tenantScope, requireSuperadmin, SECRET };
