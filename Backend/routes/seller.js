const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { serializeProject } = require('./projects');

const router = express.Router();

router.use(requireAuth, requireRole('seller'));

// GET /api/seller/projects — all of the seller's own projects, any status
router.get('/projects', (req, res) => {
  const rows = db.prepare('SELECT * FROM projects WHERE seller_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(rows.map((p) => serializeProject(p, { withDocuments: true, withAudit: true })));
});

// GET /api/seller/stats — dashboard summary cards
router.get('/stats', (req, res) => {
  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(total_credits), 0) AS total_generated,
      COALESCE(SUM(total_credits - available_credits), 0) AS total_sold,
      COALESCE(SUM(available_credits), 0) AS total_unsold,
      COUNT(*) AS project_count,
      COALESCE(SUM(CASE WHEN is_verified = 1 THEN 1 ELSE 0 END), 0) AS verified_count,
      COALESCE(SUM(CASE WHEN review_status = 'waiting_review' THEN 1 ELSE 0 END), 0) AS pending_count
    FROM projects WHERE seller_id = ?
  `).get(req.user.id);

  const earnings = db.prepare(`
    SELECT COALESCE(SUM(pu.total_price), 0) AS estimated_earnings
    FROM purchases pu JOIN projects p ON p.id = pu.project_id
    WHERE p.seller_id = ?
  `).get(req.user.id);

  res.json({
    total_credits_generated: totals.total_generated,
    total_credits_sold: totals.total_sold,
    total_credits_unsold: totals.total_unsold,
    project_count: totals.project_count,
    verified_project_count: totals.verified_count,
    pending_project_count: totals.pending_count,
    estimated_earnings: earnings.estimated_earnings,
  });
});

module.exports = router;
