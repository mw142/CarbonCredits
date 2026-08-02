const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'carbon-credit-marketplace-local-prototype-secret';

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing or invalid Authorization header.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, role, name, email }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: `This action requires role: ${roles.join(' or ')}.` });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, JWT_SECRET };
