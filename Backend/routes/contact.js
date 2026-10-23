const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { marketChanged } = require('../lib/events');

const router = express.Router();
const CATEGORIES = ['KACCU', 'NKACCU'];
const STATUSES = ['new', 'viewed', 'responded', 'closed', 'withdrawn'];

function expireAvailability() {
  db.prepare(`
    UPDATE listing_availability SET status = 'expired'
    WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP
  `).run();
}

function ownsListing(listingId, sellerId) {
  return db.prepare(`
    SELECT l.id FROM project_listings l JOIN project_claims c ON c.id = l.claim_id
    WHERE l.id = ? AND c.seller_id = ?
  `).get(listingId, sellerId);
}

router.post('/seller/listings/:id/availability', requireAuth, requireRole('seller'), (req, res) => {
  const { quantity_available, vintage, category, indicative_price, seller_confirmed_at, expires_at, notes } = req.body || {};
  if (!ownsListing(req.params.id, req.user.id)) return res.status(404).json({ error: 'Listing not found.' });
  if (quantity_available == null || Number(quantity_available) < 0) return res.status(400).json({ error: 'quantity_available must be zero or greater.' });
  if (category != null && !CATEGORIES.includes(category)) return res.status(400).json({ error: 'Invalid ACCU category.' });
  const result = db.prepare(`
    INSERT INTO listing_availability
      (listing_id, quantity_available, vintage, category, indicative_price, seller_confirmed_at, expires_at, notes)
    VALUES (?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?)
  `).run(req.params.id, Number(quantity_available), vintage || null, category || null, indicative_price == null ? null : Number(indicative_price), seller_confirmed_at || null, expires_at || null, notes || null);
  marketChanged('availability');
  res.status(201).json(db.prepare('SELECT * FROM listing_availability WHERE id = ?').get(Number(result.lastInsertRowid)));
});

router.get('/seller/listings/:id/availability', requireAuth, requireRole('seller'), (req, res) => {
  if (!ownsListing(req.params.id, req.user.id)) return res.status(404).json({ error: 'Listing not found.' });
  expireAvailability();
  res.json(db.prepare('SELECT * FROM listing_availability WHERE listing_id = ? ORDER BY created_at DESC').all(req.params.id));
});

router.patch('/seller/availability/:id', requireAuth, requireRole('seller'), (req, res) => {
  const row = db.prepare(`
    SELECT a.id FROM listing_availability a
    JOIN project_listings l ON l.id = a.listing_id
    JOIN project_claims c ON c.id = l.claim_id
    WHERE a.id = ? AND c.seller_id = ?
  `).get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Availability record not found.' });
  const fields = ['quantity_available', 'vintage', 'category', 'indicative_price', 'seller_confirmed_at', 'expires_at', 'status', 'notes'];
  const updates = [];
  const params = [];
  for (const field of fields) {
    if (req.body?.[field] !== undefined) {
      if (field === 'category' && req.body[field] != null && !CATEGORIES.includes(req.body[field])) return res.status(400).json({ error: 'Invalid ACCU category.' });
      if (field === 'status' && !['active', 'expired', 'withdrawn', 'sold_elsewhere', 'pending_verification'].includes(req.body[field])) return res.status(400).json({ error: 'Invalid availability status.' });
      updates.push(`${field} = ?`);
      params.push(['quantity_available', 'indicative_price'].includes(field) && req.body[field] != null ? Number(req.body[field]) : req.body[field]);
    }
  }
  if (!updates.length) return res.status(400).json({ error: 'No availability fields provided.' });
  params.push(req.params.id);
  db.prepare(`UPDATE listing_availability SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  marketChanged('availability');
  res.json(db.prepare('SELECT * FROM listing_availability WHERE id = ?').get(req.params.id));
});

router.post('/contact-requests', requireAuth, requireRole('buyer'), (req, res) => {
  const { listing_id, requested_quantity, preferred_vintage, preferred_category, message } = req.body || {};
  if (!listing_id) return res.status(400).json({ error: 'listing_id is required.' });
  if (preferred_category != null && !CATEGORIES.includes(preferred_category)) return res.status(400).json({ error: 'Invalid ACCU category.' });
  const listing = db.prepare(`
    SELECT id FROM project_listings WHERE id = ? AND listing_status = 'published' AND contact_available = 1
  `).get(listing_id);
  if (!listing) return res.status(404).json({ error: 'Published contact-enabled listing not found.' });
  const result = db.prepare(`
    INSERT INTO project_contact_requests
      (buyer_id, listing_id, requested_quantity, preferred_vintage, preferred_category, message)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.user.id, listing_id, requested_quantity == null ? null : Number(requested_quantity), preferred_vintage || null, preferred_category || null, message || null);
  marketChanged('enquiry');
  res.status(201).json(db.prepare('SELECT * FROM project_contact_requests WHERE id = ?').get(Number(result.lastInsertRowid)));
});

router.get('/buyer/contact-requests', requireAuth, requireRole('buyer'), (req, res) => {
  res.json(db.prepare(`
    SELECT r.*, p.name AS project_name, p.project_reference, s.name AS seller_name, s.organisation_name
    FROM project_contact_requests r
    JOIN project_listings l ON l.id = r.listing_id
    JOIN projects p ON p.id = l.project_id
    JOIN project_claims c ON c.id = l.claim_id
    JOIN user_seller s ON s.id = c.seller_id
    WHERE r.buyer_id = ? ORDER BY r.created_at DESC
  `).all(req.user.id));
});

router.get('/seller/contact-requests', requireAuth, requireRole('seller'), (req, res) => {
  res.json(db.prepare(`
    SELECT r.*, p.name AS project_name, p.project_reference, b.name AS buyer_name, b.organisation_name
    FROM project_contact_requests r
    JOIN project_listings l ON l.id = r.listing_id
    JOIN project_claims c ON c.id = l.claim_id
    JOIN projects p ON p.id = l.project_id
    JOIN user_buyer b ON b.id = r.buyer_id
    WHERE c.seller_id = ? ORDER BY r.created_at DESC
  `).all(req.user.id));
});

router.patch('/seller/contact-requests/:id', requireAuth, requireRole('seller'), (req, res) => {
  if (!STATUSES.includes(req.body?.status)) return res.status(400).json({ error: 'Invalid contact request status.' });
  const row = db.prepare(`
    SELECT r.id FROM project_contact_requests r
    JOIN project_listings l ON l.id = r.listing_id
    JOIN project_claims c ON c.id = l.claim_id
    WHERE r.id = ? AND c.seller_id = ?
  `).get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Contact request not found.' });
  db.prepare('UPDATE project_contact_requests SET status = ? WHERE id = ?').run(req.body.status, req.params.id);
  marketChanged('enquiry');
  res.json({ ok: true });
});

module.exports = router;
