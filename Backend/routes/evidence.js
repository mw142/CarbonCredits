const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { marketChanged } = require('../lib/events');
const { saveUpload, filePath } = require('../lib/files');

const router = express.Router();
const DOCUMENT_TYPES = ['accu_certificate', 'holdings_export', 'registry_statement', 'account_evidence', 'other'];
const CATEGORIES = ['KACCU', 'NKACCU'];

function ownsListing(listingId, sellerId) {
  return db.prepare(`
    SELECT l.id FROM project_listings l JOIN project_claims c ON c.id = l.claim_id
    WHERE l.id = ? AND c.seller_id = ?
  `).get(listingId, sellerId);
}

router.post('/seller/listings/:id/evidence', requireAuth, requireRole('seller'), (req, res) => {
  const { document_type, original_file_name, mime_type, file_data, file_size_bytes, vintage, category } = req.body || {};
  if (!ownsListing(req.params.id, req.user.id)) return res.status(404).json({ error: 'Listing not found.' });
  if (!DOCUMENT_TYPES.includes(document_type)) return res.status(400).json({ error: 'Invalid evidence document type.' });
  if (category != null && !CATEGORIES.includes(category)) return res.status(400).json({ error: 'Invalid ACCU category.' });
  let file;
  try { file = saveUpload({ file_data, mime_type, original_file_name, file_size_bytes }); } catch (error) { return res.status(400).json({ error: error.message }); }
  const result = db.prepare(`
    INSERT INTO accu_evidence
      (listing_id, uploaded_by_seller_id, document_type, original_file_name, storage_key, mime_type, file_size_bytes, vintage, category)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, req.user.id, document_type, original_file_name, file.storage_key, mime_type, file.file_size_bytes, vintage || null, category || null);
  res.status(201).json(db.prepare(`
    SELECT id, document_type, original_file_name, mime_type, file_size_bytes, vintage, category,
           review_status, uploaded_at FROM accu_evidence WHERE id = ?
  `).get(Number(result.lastInsertRowid)));
});

router.get('/admin/evidence', requireAuth, requireRole('admin'), (req, res) => {
  const status = req.query.status;
  const rows = db.prepare(`
    SELECT e.id, e.listing_id, e.document_type, e.original_file_name, e.mime_type,
           e.file_size_bytes, e.vintage, e.category, e.verified_quantity,
           e.masked_reference, e.review_status, e.reviewed_at, e.verified_at,
           e.expires_at, e.review_notes, e.uploaded_at,
           p.name AS project_name, s.name AS seller_name, s.organisation_name
    FROM accu_evidence e
    JOIN project_listings l ON l.id = e.listing_id
    JOIN projects p ON p.id = l.project_id
    JOIN user_seller s ON s.id = e.uploaded_by_seller_id
    ${status ? 'WHERE e.review_status = ?' : ''}
    ORDER BY e.uploaded_at ASC
  `).all(...(status ? [status] : []));
  res.json(rows);
});

router.get('/seller/evidence/:id/download', requireAuth, requireRole('seller'), (req, res) => {
  const evidence = db.prepare(`
    SELECT e.storage_key FROM accu_evidence e
    JOIN project_listings l ON l.id = e.listing_id
    JOIN project_claims c ON c.id = l.claim_id
    WHERE e.id = ? AND c.seller_id = ?
  `).get(req.params.id, req.user.id);
  if (!evidence) return res.status(404).json({ error: 'Evidence not found.' });
  try { return res.sendFile(filePath(evidence.storage_key)); } catch { return res.status(400).json({ error: 'Invalid evidence key.' }); }
});

router.get('/admin/evidence/:id/download', requireAuth, requireRole('admin'), (req, res) => {
  const evidence = db.prepare('SELECT storage_key FROM accu_evidence WHERE id = ?').get(req.params.id);
  if (!evidence) return res.status(404).json({ error: 'Evidence not found.' });
  try { return res.sendFile(filePath(evidence.storage_key)); } catch { return res.status(400).json({ error: 'Invalid evidence key.' }); }
});

router.post('/admin/evidence/:id/review', requireAuth, requireRole('admin'), (req, res) => {
  const { decision, verified_quantity, masked_reference, expires_at, review_notes, vintage, category } = req.body || {};
  if (!['under_review', 'verified', 'rejected', 'expired'].includes(decision)) return res.status(400).json({ error: 'Invalid evidence decision.' });
  if (category != null && !CATEGORIES.includes(category)) return res.status(400).json({ error: 'Invalid ACCU category.' });
  const evidence = db.prepare('SELECT id FROM accu_evidence WHERE id = ?').get(req.params.id);
  if (!evidence) return res.status(404).json({ error: 'Evidence not found.' });
  try {
    db.exec('BEGIN');
    db.prepare(`
      UPDATE accu_evidence
      SET review_status = ?, verified_quantity = ?, masked_reference = ?, expires_at = ?,
          review_notes = ?, vintage = COALESCE(?, vintage), category = COALESCE(?, category),
          reviewed_by_admin_id = ?, reviewed_at = CURRENT_TIMESTAMP,
          verified_at = CASE WHEN ? = 'verified' THEN CURRENT_TIMESTAMP ELSE verified_at END
      WHERE id = ?
    `).run(decision, verified_quantity == null ? null : Number(verified_quantity), masked_reference || null, expires_at || null, review_notes || null, vintage || null, category || null, req.user.id, decision, req.params.id);
    if (decision === 'verified') {
      db.prepare(`
        UPDATE project_listings
        SET listing_status = 'published', updated_at = CURRENT_TIMESTAMP
        WHERE id = (SELECT listing_id FROM accu_evidence WHERE id = ?)
          AND listing_status = 'draft'
          AND EXISTS (
            SELECT 1 FROM project_claims
            WHERE project_claims.id = project_listings.claim_id
              AND project_claims.status = 'approved'
          )
      `).run(req.params.id);
    }
    db.prepare(`
      INSERT INTO verification_audit_log (subject_type, subject_id, admin_user_id, action, notes)
      VALUES ('accu_evidence', ?, ?, ?, ?)
    `).run(req.params.id, req.user.id, decision === 'verified' ? 'verified' : decision === 'rejected' ? 'rejected' : decision === 'expired' ? 'expired' : 'review_started', review_notes || null);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: error.message });
  }
  marketChanged('review');
  res.json({ ok: true });
});

router.post('/seller/listings/:id/images', requireAuth, requireRole('seller'), (req, res) => {
  const { original_file_name, mime_type, file_data, file_size_bytes, alt_text, caption, display_order = 0, is_primary = false } = req.body || {};
  if (!ownsListing(req.params.id, req.user.id)) return res.status(404).json({ error: 'Listing not found.' });
  if (!mime_type?.startsWith('image/')) return res.status(400).json({ error: 'An image file is required.' });
  let file;
  try { file = saveUpload({ file_data, mime_type, original_file_name, file_size_bytes }); } catch (error) { return res.status(400).json({ error: error.message }); }
  if (is_primary) db.prepare('UPDATE project_images SET is_primary = 0 WHERE listing_id = ?').run(req.params.id);
  const result = db.prepare(`
    INSERT INTO project_images
      (listing_id, uploaded_by_seller_id, original_file_name, storage_key, mime_type, file_size_bytes, alt_text, caption, display_order, is_primary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, req.user.id, original_file_name, file.storage_key, mime_type, file.file_size_bytes, alt_text || null, caption || null, Number(display_order), is_primary ? 1 : 0);
  res.status(201).json({ id: Number(result.lastInsertRowid), review_status: 'pending' });
});

router.get('/admin/images', requireAuth, requireRole('admin'), (req, res) => {
  const status = req.query.status;
  const rows = db.prepare(`
    SELECT i.id, i.listing_id, i.original_file_name, i.mime_type, i.file_size_bytes,
           i.alt_text, i.caption, i.display_order, i.is_primary, i.review_status,
           i.uploaded_at, p.name AS project_name, s.name AS seller_name
    FROM project_images i
    JOIN project_listings l ON l.id = i.listing_id
    JOIN projects p ON p.id = l.project_id
    JOIN user_seller s ON s.id = i.uploaded_by_seller_id
    ${status ? 'WHERE i.review_status = ?' : ''}
    ORDER BY i.uploaded_at ASC
  `).all(...(status ? [status] : []));
  res.json(rows);
});

router.post('/admin/images/:id/review', requireAuth, requireRole('admin'), (req, res) => {
  const { decision, notes } = req.body || {};
  if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ error: 'decision must be approved or rejected.' });
  const image = db.prepare('SELECT id FROM project_images WHERE id = ?').get(req.params.id);
  if (!image) return res.status(404).json({ error: 'Image not found.' });
  try {
    db.exec('BEGIN');
    db.prepare('UPDATE project_images SET review_status = ? WHERE id = ?').run(decision, req.params.id);
    if (decision === 'approved') {
      db.prepare(`
        UPDATE project_listings
        SET listing_status = 'published', updated_at = CURRENT_TIMESTAMP
        WHERE id = (SELECT listing_id FROM project_images WHERE id = ?)
          AND listing_status = 'draft'
          AND EXISTS (
            SELECT 1 FROM project_claims
            WHERE project_claims.id = project_listings.claim_id
              AND project_claims.status = 'approved'
          )
      `).run(req.params.id);
    }
    db.prepare(`
      INSERT INTO verification_audit_log (subject_type, subject_id, admin_user_id, action, notes)
      VALUES ('project_image', ?, ?, ?, ?)
    `).run(req.params.id, req.user.id, decision === 'approved' ? 'published' : decision, notes || null);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: error.message });
  }
  marketChanged('review');
  res.json({ ok: true });
});

module.exports = router;
