const jwt = require('jsonwebtoken');

const DEV_SECRET = 'carbon-credits-local-development-secret-change-me';
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEV_SECRET)) {
  throw new Error('JWT_SECRET must be set to a long random value in production (Backend/.env).');
}
const JWT_SECRET = process.env.JWT_SECRET || DEV_SECRET;

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

/** Attach req.user when a valid token is present; otherwise continue as guest. */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch {
    // Ignore invalid/expired tokens for public chatbot access.
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: `This action requires role: ${roles.join(' or ')}.` });
    }
    next();
  };
}

module.exports = { requireAuth, optionalAuth, requireRole, JWT_SECRET };
