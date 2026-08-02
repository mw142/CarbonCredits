const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { serializeProject } = require('./projects');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

// GET /api/admin/stats
router.get('/stats', (req, res) => {
  const users = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  const activeProjects = db.prepare("SELECT COUNT(*) AS n FROM projects WHERE is_listed = 1").get().n;
  const pending = db.prepare("SELECT COUNT(*) AS n FROM projects WHERE review_status = 'waiting_review'").get().n;
  const transactions = db.prepare('SELECT COUNT(*) AS n FROM purchases').get().n;
  const totalCreditsTraded = db.prepare('SELECT COALESCE(SUM(credits_purchased),0) AS n FROM purchases').get().n;

  res.json({
    total_users: users,
    active_listings: activeProjects,
    pending_verifications: pending,
    completed_transactions: transactions,
    total_credits_traded: totalCreditsTraded,
  });
});

// GET /api/admin/projects?status=waiting_review
router.get('/projects', (req, res) => {
  const { status } = req.query;
  let rows;
  if (status) {
    rows = db.prepare('SELECT * FROM projects WHERE review_status = ? ORDER BY created_at ASC').all(status);
  } else {
    rows = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
  }
  res.json(rows.map((p) => serializeProject(p, { withDocuments: true, withAudit: true })));
});

// POST /api/admin/projects/:id/review  { decision: approved|rejected|needs_changes, notes }
router.post('/projects/:id/review', (req, res) => {
  const { decision, notes } = req.body || {};
  if (!['approved', 'rejected', 'needs_changes'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be approved, rejected or needs_changes.' });
  }
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found.' });

  const isVerified = decision === 'approved' ? 1 : 0;
  db.prepare(
    'UPDATE projects SET review_status = ?, is_verified = ?, review_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(decision, isVerified, notes || null, p.id);

  db.prepare(
    `INSERT INTO verification_audit_log (project_id, verifier_user_id, action, notes) VALUES (?, ?, ?, ?)`
  ).run(p.id, req.user.id, decision, notes || null);

  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(p.id);
  res.json(serializeProject(updated, { withDocuments: true, withAudit: true }));
});

// GET /api/admin/users
router.get('/users', (req, res) => {
  const rows = db.prepare('SELECT id, role, name, email, organisation_name, country, account_status, created_at FROM users ORDER BY created_at DESC').all();
  res.json(rows);
});

module.exports = router;
