const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const SCOPES = ['projects:read', 'projects:write', 'market:read', 'market:write'];

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/** Create a key. The plain key is returned once and never stored. */
function createApiKey({ name, scopes, adminId }) {
  const cleanScopes = [...new Set((scopes || []).filter((scope) => SCOPES.includes(scope)))];
  if (!name || !String(name).trim()) throw Object.assign(new Error('A key name is required.'), { status: 400 });
  if (!cleanScopes.length) throw Object.assign(new Error(`Choose at least one scope: ${SCOPES.join(', ')}.`), { status: 400 });
  const key = `rc_live_${crypto.randomBytes(24).toString('base64url')}`;
  const result = db.prepare(`
    INSERT INTO api_keys (name, key_prefix, key_hash, scopes, created_by_admin_id) VALUES (?, ?, ?, ?, ?)
  `).run(String(name).trim().slice(0, 80), key.slice(0, 14), hashKey(key), JSON.stringify(cleanScopes), adminId || null);
  return { ...listKey(Number(result.lastInsertRowid)), key };
}

function listKey(id) {
  const row = db.prepare('SELECT id, name, key_prefix, scopes, created_at, last_used_at, revoked_at FROM api_keys WHERE id = ?').get(id);
  return row ? { ...row, scopes: JSON.parse(row.scopes) } : null;
}

function listApiKeys() {
  return db.prepare('SELECT id FROM api_keys ORDER BY created_at DESC').all().map((row) => listKey(row.id));
}

function revokeApiKey(id) {
  return db.prepare('UPDATE api_keys SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND revoked_at IS NULL').run(id).changes > 0;
}

/**
 * Authenticate an integration request. Accepts either an API key
 * (`X-API-Key: rc_live_…` or `Authorization: Bearer rc_live_…`) or an admin JWT,
 * which is allowed every scope.
 */
function requireApiScope(scope) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    const key = req.headers['x-api-key'] || (bearer?.startsWith('rc_') ? bearer : null);

    if (key) {
      const row = db.prepare('SELECT id, name, scopes, revoked_at FROM api_keys WHERE key_hash = ?').get(hashKey(String(key)));
      if (!row || row.revoked_at) return res.status(401).json({ error: 'Invalid or revoked API key.' });
      const scopes = JSON.parse(row.scopes);
      if (!scopes.includes(scope)) return res.status(403).json({ error: `This API key is missing the ${scope} scope.` });
      db.prepare('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?').run(row.id);
      req.apiClient = { type: 'api_key', id: row.id, name: row.name };
      return next();
    }

    if (bearer) {
      try {
        const payload = jwt.verify(bearer, JWT_SECRET);
        if (payload.role === 'admin') {
          req.user = payload;
          req.apiClient = { type: 'admin', id: payload.id, name: payload.name };
          return next();
        }
      } catch { /* fall through */ }
    }
    return res.status(401).json({ error: 'Send an API key in the X-API-Key header.' });
  };
}

module.exports = { SCOPES, createApiKey, listApiKeys, revokeApiKey, requireApiScope };
