const express = require('express');
const { db } = require('../db');

const router = express.Router();
const recent = new Map();

/** Public "Contact us" form on the landing page. Lightly rate-limited per IP. */
router.post('/site-enquiries', (req, res) => {
  const b = req.body || {};
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const hits = (recent.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (hits.length >= 5) return res.status(429).json({ error: 'Too many messages. Please try again later.' });

  const first = String(b.first_name || '').trim();
  const last = String(b.last_name || '').trim();
  const email = String(b.email || '').trim().toLowerCase();
  if (!first || !last) return res.status(400).json({ error: 'First and last name are required.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (b.website) return res.status(201).json({ ok: true }); // honeypot field

  db.prepare(`
    INSERT INTO site_enquiries (first_name, last_name, email, phone, company, location, interest, message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(first.slice(0, 80), last.slice(0, 80), email.slice(0, 160), b.phone ? String(b.phone).slice(0, 40) : null,
    b.company ? String(b.company).slice(0, 160) : null, b.location ? String(b.location).slice(0, 120) : null,
    b.interest ? String(b.interest).slice(0, 60) : null, b.message ? String(b.message).slice(0, 3000) : null);
  hits.push(now);
  recent.set(ip, hits);
  res.status(201).json({ ok: true });
});

module.exports = router;
