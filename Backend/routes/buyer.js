const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { serializeProject } = require('./projects');

const router = express.Router();

router.use(requireAuth, requireRole('buyer'));

// GET /api/buyer/dashboard
router.get('/dashboard', (req, res) => {
  const profile = db.prepare('SELECT * FROM buyer_profiles WHERE user_id = ?').get(req.user.id);

  const purchaseTotals = db.prepare(`
    SELECT COALESCE(SUM(credits_purchased), 0) AS total_credits_purchased,
           COALESCE(SUM(total_price), 0) AS total_spent,
           COUNT(DISTINCT project_id) AS active_projects,
           COUNT(*) AS purchase_count
    FROM purchases WHERE buyer_id = ?
  `).get(req.user.id);

  const recentActivity = db.prepare(`
    SELECT pu.id, pu.credits_purchased, pu.price_per_credit, pu.total_price, pu.created_at,
           p.id AS project_id, p.name AS project_name, p.location
    FROM purchases pu JOIN projects p ON p.id = pu.project_id
    WHERE pu.buyer_id = ? ORDER BY pu.created_at DESC LIMIT 10
  `).all(req.user.id);

  const saved = db.prepare(`
    SELECT p.* FROM saved_projects s JOIN projects p ON p.id = s.project_id
    WHERE s.buyer_id = ? ORDER BY s.created_at DESC
  `).all(req.user.id);

  const suggested = db.prepare(`
    SELECT p.* FROM projects p
    WHERE p.is_listed = 1 AND p.is_verified = 1
      AND p.id NOT IN (SELECT project_id FROM purchases WHERE buyer_id = ?)
      AND p.id NOT IN (SELECT project_id FROM saved_projects WHERE buyer_id = ?)
    ORDER BY p.created_at DESC LIMIT 4
  `).all(req.user.id, req.user.id);

  const emissionsReduced = Math.min(profile ? profile.total_emissions : 0, purchaseTotals.total_credits_purchased);

  res.json({
    profile: profile
      ? {
          total_emissions: profile.total_emissions,
          annual_offset_goal: profile.annual_offset_goal,
          carbon_credit_balance: profile.carbon_credit_balance,
        }
      : null,
    total_credits_purchased: purchaseTotals.total_credits_purchased,
    total_spent: purchaseTotals.total_spent,
    active_projects: purchaseTotals.active_projects,
    purchase_count: purchaseTotals.purchase_count,
    emissions_reduced: emissionsReduced,
    recent_activity: recentActivity,
    saved_projects: saved.map((p) => serializeProject(p)),
    suggested_projects: suggested.map((p) => serializeProject(p)),
  });
});

// GET /api/buyer/purchases
router.get('/purchases', (req, res) => {
  const rows = db.prepare(`
    SELECT pu.*, p.name AS project_name, p.location, p.project_type
    FROM purchases pu JOIN projects p ON p.id = pu.project_id
    WHERE pu.buyer_id = ? ORDER BY pu.created_at DESC
  `).all(req.user.id);
  res.json(rows);
});

// POST /api/buyer/purchase  { project_id, credits }
router.post('/purchase', (req, res) => {
  const { project_id, credits } = req.body || {};
  const qty = Number(credits);
  if (!project_id || !qty || qty <= 0) {
    return res.status(400).json({ error: 'project_id and a positive credits amount are required.' });
  }

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(project_id);
  if (!project || !project.is_listed) return res.status(404).json({ error: 'Listing not found.' });
  if (qty > project.available_credits) {
    return res.status(400).json({ error: `Only ${project.available_credits} credits are currently available.` });
  }

  const totalPrice = qty * project.price_per_credit;

  db.prepare(
    `INSERT INTO purchases (buyer_id, project_id, credits_purchased, price_per_credit, total_price) VALUES (?, ?, ?, ?, ?)`
  ).run(req.user.id, project_id, qty, project.price_per_credit, totalPrice);

  db.prepare('UPDATE projects SET available_credits = available_credits - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(qty, project_id);
  db.prepare('UPDATE buyer_profiles SET carbon_credit_balance = carbon_credit_balance + ? WHERE user_id = ?').run(qty, req.user.id);

  const updatedProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(project_id);
  res.status(201).json({
    message: 'Purchase recorded. This is a simulated transaction — no real payment was processed.',
    credits_purchased: qty,
    total_price: totalPrice,
    project: serializeProject(updatedProject),
  });
});

// POST /api/buyer/save/:projectId
router.post('/save/:projectId', (req, res) => {
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  db.prepare('INSERT OR IGNORE INTO saved_projects (buyer_id, project_id) VALUES (?, ?)').run(req.user.id, req.params.projectId);
  res.status(201).json({ saved: true });
});

// DELETE /api/buyer/save/:projectId
router.delete('/save/:projectId', (req, res) => {
  db.prepare('DELETE FROM saved_projects WHERE buyer_id = ? AND project_id = ?').run(req.user.id, req.params.projectId);
  res.json({ saved: false });
});

module.exports = router;
