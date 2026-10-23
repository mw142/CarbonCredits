const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('seller'));

router.get('/stats', (req, res) => {
  const claims = db.prepare(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
           SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved
    FROM project_claims WHERE seller_id = ?
  `).get(req.user.id);
  const listings = db.prepare(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN l.listing_status = 'published' THEN 1 ELSE 0 END) AS published
    FROM project_listings l JOIN project_claims c ON c.id = l.claim_id WHERE c.seller_id = ?
  `).get(req.user.id);
  const evidence = db.prepare(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN e.review_status = 'verified' THEN 1 ELSE 0 END) AS verified
    FROM accu_evidence e JOIN project_listings l ON l.id = e.listing_id
    JOIN project_claims c ON c.id = l.claim_id WHERE c.seller_id = ?
  `).get(req.user.id);
  res.json({
    claims: { total: claims.total, pending: claims.pending || 0, approved: claims.approved || 0 },
    listings: { total: listings.total, published: listings.published || 0 },
    evidence: { total: evidence.total, verified: evidence.verified || 0 },
  });
});

module.exports = router;
