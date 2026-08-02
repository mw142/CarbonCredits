const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

function publicUser(u) {
  return {
    id: u.id,
    role: u.role,
    name: u.name,
    email: u.email,
    phone_number: u.phone_number,
    organisation_name: u.organisation_name,
    organisation_type: u.organisation_type,
    country: u.country,
    account_status: u.account_status,
    created_at: u.created_at,
  };
}

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

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'An account with that email already exists.' });

  const password_hash = bcrypt.hashSync(password, 10);

  const info = db
    .prepare(
      `INSERT INTO users (role, name, email, password_hash, phone_number, organisation_name, organisation_type, country, account_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`
    )
    .run(role, name, email.toLowerCase(), password_hash, phone_number || null, organisation_name || null, organisation_type || null, country);

  const userId = Number(info.lastInsertRowid);

  if (role === 'buyer') {
    db.prepare(
      `INSERT INTO buyer_profiles (user_id, total_emissions, annual_offset_goal, carbon_credit_balance) VALUES (?, 0, ?, 0)`
    ).run(userId, annual_offset_goal || null);
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { email, password, role } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required.' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

  if (role && user.role !== role) {
    return res.status(401).json({ error: `That account is registered as a ${user.role}, not a ${role}. Choose the matching account type.` });
  }

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password.' });

  if (user.account_status === 'suspended') {
    return res.status(403).json({ error: 'This account has been suspended.' });
  }

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

module.exports = router;
