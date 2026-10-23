const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { marketChanged } = require('../lib/events');

const router = express.Router();

function listingDetails(listingId, sellerId = null) {
  const listing = db.prepare(`
    SELECT l.*, c.seller_id, c.status AS claim_status, p.project_reference,
           p.name AS project_name, p.project_proponent
    FROM project_listings l
    JOIN project_claims c ON c.id = l.claim_id AND c.project_id = l.project_id
    JOIN projects p ON p.id = l.project_id
    WHERE l.id = ? ${sellerId == null ? '' : 'AND c.seller_id = ?'}
  `).get(...(sellerId == null ? [listingId] : [listingId, sellerId]));
  if (!listing) return null;
  return {
    ...listing,
    images: db.prepare(`
      SELECT id, original_file_name, mime_type, file_size_bytes, alt_text, caption,
             display_order, is_primary, review_status, uploaded_at,
             CASE WHEN review_status = 'approved' THEN '/api/media/' || storage_key END AS url
      FROM project_images WHERE listing_id = ? ORDER BY is_primary DESC, display_order, uploaded_at
    `).all(listingId),
    availability: db.prepare(`
      SELECT * FROM listing_availability WHERE listing_id = ? ORDER BY created_at DESC
    `).all(listingId),
    evidence: db.prepare(`
      SELECT id, document_type, original_file_name, mime_type, file_size_bytes, vintage,
             category, verified_quantity, masked_reference, review_status, reviewed_at,
             verified_at, expires_at, review_notes, uploaded_at
      FROM accu_evidence WHERE listing_id = ? ORDER BY uploaded_at DESC
    `).all(listingId),
  };
}

router.post('/projects/:id/listings', requireAuth, requireRole('seller'), (req, res) => {
  const { listing_title, seller_description, contact_available = true } = req.body || {};
  const claim = db.prepare(`
    SELECT id FROM project_claims
    WHERE project_id = ? AND seller_id = ? AND status = 'approved'
  `).get(req.params.id, req.user.id);
  if (!claim) return res.status(403).json({ error: 'An approved claim is required before creating a listing.' });
  const existing = db.prepare(`
    SELECT id FROM project_listings WHERE project_id = ? AND listing_status IN ('draft', 'published', 'paused')
  `).get(req.params.id);
  if (existing) return res.status(409).json({ error: 'This project already has an active listing.' });
  if (contact_available !== true && contact_available !== false && contact_available !== 0 && contact_available !== 1) {
    return res.status(400).json({ error: 'contact_available must be boolean.' });
  }
  const result = db.prepare(`
    INSERT INTO project_listings (project_id, claim_id, listing_title, seller_description, contact_available)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.params.id, claim.id, listing_title || null, seller_description || null, contact_available ? 1 : 0);
  res.status(201).json(listingDetails(Number(result.lastInsertRowid), req.user.id));
});

router.get('/seller/listings', requireAuth, requireRole('seller'), (req, res) => {
  const rows = db.prepare(`
    SELECT l.id, l.project_id, l.claim_id, l.listing_title, l.seller_description,
           l.contact_available, l.listing_status, l.created_at, l.updated_at,
           p.project_reference, p.name AS project_name
    FROM project_listings l
    JOIN project_claims c ON c.id = l.claim_id
    JOIN projects p ON p.id = l.project_id
    WHERE c.seller_id = ? ORDER BY l.updated_at DESC
  `).all(req.user.id);
  res.json(rows);
});

router.post('/seller/projects/:id/locations', requireAuth, requireRole('seller'), (req, res) => {
  const { location_name, state_or_territory, region, latitude, longitude, precision_level = 'approximate', geometry_geojson, seller_permission_to_display = false } = req.body || {};
  const claim = db.prepare(`SELECT id FROM project_claims WHERE project_id = ? AND seller_id = ? AND status = 'approved'`).get(req.params.id, req.user.id);
  if (!claim) return res.status(403).json({ error: 'An approved claim is required to add a seller location.' });
  if (!['state', 'region', 'approximate', 'exact'].includes(precision_level)) return res.status(400).json({ error: 'Invalid precision_level.' });
  const result = db.prepare(`
    INSERT INTO project_locations
      (project_id, location_name, state_or_territory, region, latitude, longitude, precision_level, geometry_geojson, location_source, seller_permission_to_display)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'seller', ?)
  `).run(req.params.id, location_name || null, state_or_territory || null, region || null, latitude == null ? null : Number(latitude), longitude == null ? null : Number(longitude), precision_level, geometry_geojson || null, seller_permission_to_display ? 1 : 0);
  res.status(201).json(db.prepare('SELECT * FROM project_locations WHERE id = ?').get(Number(result.lastInsertRowid)));
});

router.get('/seller/listings/:id', requireAuth, requireRole('seller'), (req, res) => {
  const listing = listingDetails(req.params.id, req.user.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found.' });
  res.json(listing);
});

router.patch('/seller/listings/:id', requireAuth, requireRole('seller'), (req, res) => {
  const listing = listingDetails(req.params.id, req.user.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found.' });
  const allowed = ['listing_title', 'seller_description', 'contact_available', 'listing_status'];
  const updates = [];
  const params = [];
  for (const field of allowed) {
    if (req.body?.[field] !== undefined) {
      if (field === 'listing_status' && !['draft', 'published', 'paused', 'archived'].includes(req.body[field])) return res.status(400).json({ error: 'Invalid listing status.' });
      updates.push(`${field} = ?`);
      params.push(field === 'contact_available' ? (req.body[field] ? 1 : 0) : req.body[field]);
    }
  }
  if (!updates.length) return res.status(400).json({ error: 'No editable listing fields provided.' });
  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(req.params.id);
  db.prepare(`UPDATE project_listings SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  marketChanged('listing');
  res.json(listingDetails(req.params.id, req.user.id));
});

module.exports = router;
