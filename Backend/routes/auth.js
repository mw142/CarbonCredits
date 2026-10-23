const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const { tableForRole, publicUser } = require('../lib/users');

const router = express.Router();

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, name: user.name, email: user.email }, JWT_SECRET, {
    expiresIn: '12h',
  });
}

router.post('/register', (req, res) => {
  const {
    role, name, email, password, phone_number, organisation_name,
    organisation_type, country, annual_offset_goal,
  } = req.body || {};

  if (!role || !['buyer', 'seller'].includes(role)) {
    return res.status(400).json({ error: 'role must be "buyer" or "seller".' });
  }
  if (!name || !email || !password || !country) {
    return res.status(400).json({ error: 'name, email, password and country are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = ['buyer', 'seller', 'admin'].some((candidate) => (
    db.prepare(`SELECT id FROM ${tableForRole(candidate)} WHERE email = ?`).get(normalizedEmail)
  ));
  if (existing) return res.status(409).json({ error: 'An account with that email already exists.' });

  const password_hash = bcrypt.hashSync(password, 10);

  const table = tableForRole(role);
  const info = db.prepare(
    `INSERT INTO ${table} (name, email, phone_number, password_hash, organisation_name, country, organisation_type)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(name.trim(), normalizedEmail, phone_number || null, password_hash, organisation_name || null, country.trim(), organisation_type);

  const userId = Number(info.lastInsertRowid);
  if (role === 'buyer' && annual_offset_goal != null) {
    db.prepare(`UPDATE ${table} SET annual_offset_goal = ? WHERE id = ?`).run(Number(annual_offset_goal), userId);
  }
  const user = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(userId);
  const token = signToken({ ...user, role });
  res.status(201).json({ token, user: publicUser(user, role) });
});

router.post('/login', (req, res) => {
  const { email, password, role } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required.' });

  const roles = role ? [role] : ['buyer', 'seller', 'admin'];
  let user;
  let matchedRole;
  for (const candidate of roles) {
    if (!['buyer', 'seller', 'admin'].includes(candidate)) continue;
    const found = db.prepare(`SELECT * FROM ${tableForRole(candidate)} WHERE email = ?`).get(email.toLowerCase().trim());
    if (found) { user = found; matchedRole = candidate; break; }
  }
  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password.' });

  if (user.account_status === 'suspended') {
    return res.status(403).json({ error: 'This account has been suspended.' });
  }

  const token = signToken({ ...user, role: matchedRole });
  res.json({ token, user: publicUser(user, matchedRole) });
});

module.exports = router;
