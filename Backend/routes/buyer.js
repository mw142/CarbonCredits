const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { FACTOR_PRESETS, emissionsSummary, round } = require('../lib/emissions');
const { matchListings } = require('../lib/matching');
const { introduce } = require('../lib/introductions');
const { marketChanged } = require('../lib/events');

const router = express.Router();
router.use(requireAuth, requireRole('buyer'));

const CATEGORIES = ['KACCU', 'NKACCU'];

router.get('/dashboard', (req, res) => {
  const profile = db.prepare(`
    SELECT id, name, email, organisation_name, country, organisation_type,
           total_emissions, annual_offset_goal, project_interests, account_status, created_at
    FROM user_buyer WHERE id = ?
  `).get(req.user.id);
  const counts = db.prepare(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS new_requests
    FROM project_contact_requests WHERE buyer_id = ?
  `).get(req.user.id);
  const year = new Date().getUTCFullYear();
  const emissions = emissionsSummary(req.user.id, year);
  const introductions = db.prepare(`
    SELECT COUNT(*) AS n FROM buyer_introductions WHERE buyer_id = ? AND status IN ('new', 'matching', 'introduced')
  `).get(req.user.id).n;
  res.json({
    profile,
    contact_requests: { total: counts.total, new: counts.new_requests || 0 },
    emissions: { year, total_tco2e: emissions.total_tco2e, offsets_retired: emissions.offsets_retired, net_tco2e: emissions.net_tco2e, goal_progress_pct: emissions.goal_progress_pct },
    introductions_open: introductions,
  });
});

router.patch('/profile', (req, res) => {
  const { annual_offset_goal } = req.body || {};
  if (annual_offset_goal !== undefined) {
    const goal = annual_offset_goal === null || annual_offset_goal === '' ? null : Number(annual_offset_goal);
    if (goal != null && (!Number.isFinite(goal) || goal < 0)) return res.status(400).json({ error: 'Offset goal must be zero or more.' });
    db.prepare('UPDATE user_buyer SET annual_offset_goal = ? WHERE id = ?').run(goal, req.user.id);
  }
  res.json({ ok: true });
});

// ============================================================
// Emissions tracking
// ============================================================

router.get('/emission-factors', (req, res) => res.json(FACTOR_PRESETS));

router.get('/emissions/summary', (req, res) => {
  res.json(emissionsSummary(req.user.id, req.query.year ? Number(req.query.year) : null));
});

router.get('/emissions', (req, res) => {
  const year = req.query.year ? Number(req.query.year) : null;
  res.json(db.prepare(`
    SELECT * FROM emissions_records WHERE buyer_id = ? ${year ? 'AND period_year = ?' : ''}
    ORDER BY period_year DESC, COALESCE(period_month, 0) DESC, id DESC
  `).all(...(year ? [req.user.id, year] : [req.user.id])));
});

function validateEmission(body) {
  const year = Number(body.period_year);
  const month = body.period_month === '' || body.period_month == null ? null : Number(body.period_month);
  const scope = Number(body.scope);
  if (!Number.isInteger(year) || year < 1990 || year > 2100) throw new Error('Enter a valid year.');
  if (month != null && (!Number.isInteger(month) || month < 1 || month > 12)) throw new Error('Month must be 1–12.');
  if (![1, 2, 3].includes(scope)) throw new Error('Scope must be 1, 2 or 3.');
  const category = String(body.category || '').trim();
  if (!category) throw new Error('Choose an emission source.');

  const activity = body.activity_value === '' || body.activity_value == null ? null : Number(body.activity_value);
  const factor = body.emission_factor === '' || body.emission_factor == null ? null : Number(body.emission_factor);
  let tco2e = body.tco2e === '' || body.tco2e == null ? null : Number(body.tco2e);
  if (activity != null && (!Number.isFinite(activity) || activity < 0)) throw new Error('Activity must be zero or more.');
  if (factor != null && (!Number.isFinite(factor) || factor < 0)) throw new Error('Emission factor must be zero or more.');
  // Calculated: activity (unit) x factor (kg CO2-e / unit) / 1000 = tonnes.
  if (activity != null && factor != null) tco2e = round((activity * factor) / 1000, 4);
  if (tco2e == null || !Number.isFinite(tco2e) || tco2e < 0) throw new Error('Provide activity and factor, or enter t CO2-e directly.');

  return {
    period_year: year, period_month: month, scope, category: category.slice(0, 120),
    activity_value: activity, activity_unit: body.activity_unit ? String(body.activity_unit).slice(0, 20) : null,
    emission_factor: factor, factor_unit: factor != null ? `kg CO2-e/${body.activity_unit || 'unit'}` : null,
    tco2e, facility: body.facility ? String(body.facility).slice(0, 120) : null,
    notes: body.notes ? String(body.notes).slice(0, 1000) : null,
  };
}

router.post('/emissions', (req, res) => {
  let row;
  try { row = validateEmission(req.body || {}); } catch (error) { return res.status(400).json({ error: error.message }); }
  const cols = Object.keys(row);
  const result = db.prepare(`
    INSERT INTO emissions_records (buyer_id, ${cols.join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')})
  `).run(req.user.id, ...cols.map((c) => row[c]));
  res.status(201).json(db.prepare('SELECT * FROM emissions_records WHERE id = ?').get(Number(result.lastInsertRowid)));
});

/** Bulk entry (e.g. pasted from a spreadsheet). */
router.post('/emissions/bulk', (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows.slice(0, 1000) : [];
  if (!rows.length) return res.status(400).json({ error: 'rows must be a non-empty array.' });
  const errors = [];
  let saved = 0;
  db.exec('BEGIN');
  try {
    rows.forEach((raw, index) => {
      try {
        const row = validateEmission(raw);
        const cols = Object.keys(row);
        db.prepare(`INSERT INTO emissions_records (buyer_id, ${cols.join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')})`).run(req.user.id, ...cols.map((c) => row[c]));
        saved += 1;
      } catch (error) {
        errors.push({ row: index + 1, error: error.message });
      }
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: error.message });
  }
  res.status(saved ? 201 : 400).json({ saved, errors });
});

router.delete('/emissions/:id', (req, res) => {
  const changes = db.prepare('DELETE FROM emissions_records WHERE id = ? AND buyer_id = ?').run(req.params.id, req.user.id).changes;
  if (!changes) return res.status(404).json({ error: 'Record not found.' });
  res.json({ ok: true });
});

// ---------- Offsets retired ----------

router.get('/offsets', (req, res) => {
  res.json(db.prepare('SELECT * FROM offset_retirements WHERE buyer_id = ? ORDER BY retired_on DESC, id DESC').all(req.user.id));
});

router.post('/offsets', (req, res) => {
  const { retired_on, quantity, project_reference, vintage, category, masked_registry_reference, notes } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(retired_on || '')) return res.status(400).json({ error: 'retired_on must be a date (YYYY-MM-DD).' });
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty <= 0) return res.status(400).json({ error: 'Quantity must be a whole number above zero.' });
  if (category && !CATEGORIES.includes(category)) return res.status(400).json({ error: 'Invalid ACCU category.' });
  // Only a masked reference is kept — never full registry account numbers.
  const masked = masked_registry_reference ? String(masked_registry_reference).replace(/\s/g, '').replace(/.(?=.{4})/g, '•').slice(-16) : null;
  const result = db.prepare(`
    INSERT INTO offset_retirements (buyer_id, retired_on, quantity, project_reference, vintage, category, masked_registry_reference, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, retired_on, qty, project_reference || null, vintage || null, category || null, masked, notes || null);
  res.status(201).json(db.prepare('SELECT * FROM offset_retirements WHERE id = ?').get(Number(result.lastInsertRowid)));
});

router.delete('/offsets/:id', (req, res) => {
  const changes = db.prepare('DELETE FROM offset_retirements WHERE id = ? AND buyer_id = ?').run(req.params.id, req.user.id).changes;
  if (!changes) return res.status(404).json({ error: 'Record not found.' });
  res.json({ ok: true });
});

// ============================================================
// Buyer introductions
// ============================================================

function cleanList(value) {
  return JSON.stringify((Array.isArray(value) ? value : String(value || '').split(','))
    .map((v) => String(v).trim()).filter(Boolean).slice(0, 12));
}

function shapeIntro(row) {
  return {
    ...row,
    project_types: JSON.parse(row.project_types),
    states: JSON.parse(row.states),
    introductions: db.prepare(`
      SELECT m.id, m.listing_id, m.introduced_by, m.created_at, m.contact_request_id, r.status AS enquiry_status,
             COALESCE(l.listing_title, p.name) AS listing_title, p.project_reference
      FROM buyer_introduction_matches m
      JOIN project_listings l ON l.id = m.listing_id JOIN projects p ON p.id = l.project_id
      LEFT JOIN project_contact_requests r ON r.id = m.contact_request_id
      WHERE m.introduction_id = ? ORDER BY m.created_at
    `).all(row.id),
  };
}

router.get('/introductions', (req, res) => {
  res.json(db.prepare('SELECT * FROM buyer_introductions WHERE buyer_id = ? ORDER BY created_at DESC').all(req.user.id).map(shapeIntro));
});

router.post('/introductions', (req, res) => {
  const b = req.body || {};
  const qty = b.requested_quantity === '' || b.requested_quantity == null ? null : Number(b.requested_quantity);
  const price = b.max_price === '' || b.max_price == null ? null : Number(b.max_price);
  if (qty != null && (!Number.isInteger(qty) || qty <= 0)) return res.status(400).json({ error: 'Quantity must be a whole number above zero.' });
  if (price != null && (!Number.isFinite(price) || price < 0)) return res.status(400).json({ error: 'Budget must be zero or more.' });
  if (b.preferred_category && !CATEGORIES.includes(b.preferred_category)) return res.status(400).json({ error: 'Invalid ACCU category.' });
  const result = db.prepare(`
    INSERT INTO buyer_introductions
      (buyer_id, requested_quantity, max_price, project_types, states, preferred_vintage, preferred_category, timeframe, purpose, message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, qty, price, cleanList(b.project_types), cleanList(b.states), b.preferred_vintage || null,
    b.preferred_category || null, b.timeframe || null, b.purpose || null, b.message ? String(b.message).slice(0, 2000) : null);
  marketChanged('introduction');
  const row = db.prepare('SELECT * FROM buyer_introductions WHERE id = ?').get(Number(result.lastInsertRowid));
  res.status(201).json({ ...shapeIntro(row), matches: matchListings(row) });
});

router.get('/introductions/:id/matches', (req, res) => {
  const brief = db.prepare('SELECT * FROM buyer_introductions WHERE id = ? AND buyer_id = ?').get(req.params.id, req.user.id);
  if (!brief) return res.status(404).json({ error: 'Introduction not found.' });
  res.json(matchListings(brief));
});

router.post('/introductions/:id/request', (req, res) => {
  const brief = db.prepare('SELECT * FROM buyer_introductions WHERE id = ? AND buyer_id = ?').get(req.params.id, req.user.id);
  if (!brief) return res.status(404).json({ error: 'Introduction not found.' });
  try {
    res.status(201).json(introduce(brief, Number(req.body?.listing_id), 'buyer', req.body?.note));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.patch('/introductions/:id', (req, res) => {
  if (!['withdrawn', 'closed'].includes(req.body?.status)) return res.status(400).json({ error: 'Buyers can set status to withdrawn or closed.' });
  const changes = db.prepare(`
    UPDATE buyer_introductions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND buyer_id = ?
  `).run(req.body.status, req.params.id, req.user.id).changes;
  if (!changes) return res.status(404).json({ error: 'Introduction not found.' });
  marketChanged('introduction');
  res.json({ ok: true });
});

module.exports = router;
