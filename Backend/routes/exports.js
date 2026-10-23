const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendRows } = require('../lib/csv');
const { priceStats } = require('../lib/market');

/*
 * Data export. Every endpoint returns CSV by default, or JSON with ?format=json.
 * Exports only include what the requesting role can already see in the app.
 */
const router = express.Router();

// ---------- Public ----------

router.get('/projects', (req, res) => {
  const { type, state, status, search } = req.query;
  const where = ['1 = 1'];
  const params = [];
  if (type) { where.push('p.project_type = ?'); params.push(type); }
  if (state) { where.push('EXISTS (SELECT 1 FROM project_locations l WHERE l.project_id = p.id AND (l.state_or_territory LIKE ? OR l.region LIKE ?))'); params.push(`%${state}%`, `%${state}%`); }
  if (status) { where.push('p.project_status = ?'); params.push(status); }
  if (search) { where.push('(p.name LIKE ? OR p.project_proponent LIKE ? OR p.methodology LIKE ? OR p.project_reference LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }
  const rows = db.prepare(`
    SELECT p.project_reference, p.name, p.project_type, p.project_proponent, p.methodology, p.project_status,
           (SELECT state_or_territory FROM project_locations l WHERE l.project_id = p.id AND l.location_source = 'admin' LIMIT 1) AS state,
           p.project_registered_at, p.crediting_period_start, p.crediting_period_end,
           p.total_accus_issued, p.total_accus_relinquished,
           CASE WHEN pl.id IS NOT NULL THEN 'yes' ELSE 'no' END AS verified_listing,
           a.quantity_available AS accus_offered, a.indicative_price AS indicative_price_aud, a.vintage, a.category,
           p.updated_at AS cer_data_updated
    FROM projects p
    LEFT JOIN project_listings pl ON pl.project_id = p.id AND pl.listing_status = 'published'
    LEFT JOIN listing_availability a ON a.id = (
      SELECT id FROM listing_availability WHERE listing_id = pl.id AND status = 'active'
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP) ORDER BY created_at DESC LIMIT 1)
    WHERE ${where.join(' AND ')} ORDER BY p.name
  `).all(...params);
  sendRows(req, res, rows, { name: 'projects' });
});

router.get('/market-prices', (req, res) => {
  const rows = priceStats(5000).flatMap((p) => p.history.map((h) => ({ instrument: p.instrument, price_date: h.date, price_aud: h.price, source: h.source })));
  sendRows(req, res, rows, { name: 'market-prices' });
});

// ---------- Buyer ----------

router.get('/buyer/emissions', requireAuth, requireRole('buyer'), (req, res) => {
  const rows = db.prepare(`
    SELECT period_year, period_month, scope, category, facility, activity_value, activity_unit,
           emission_factor, factor_unit, tco2e, notes, created_at
    FROM emissions_records WHERE buyer_id = ? ORDER BY period_year, period_month, scope
  `).all(req.user.id);
  sendRows(req, res, rows, { name: 'emissions' });
});

router.get('/buyer/offsets', requireAuth, requireRole('buyer'), (req, res) => {
  const rows = db.prepare(`
    SELECT retired_on, quantity, project_reference, vintage, category, masked_registry_reference, notes
    FROM offset_retirements WHERE buyer_id = ? ORDER BY retired_on
  `).all(req.user.id);
  sendRows(req, res, rows, { name: 'offsets-retired' });
});

router.get('/buyer/enquiries', requireAuth, requireRole('buyer'), (req, res) => {
  const rows = db.prepare(`
    SELECT r.created_at, p.project_reference, p.name AS project, COALESCE(s.organisation_name, s.name) AS representative,
           r.requested_quantity, r.preferred_vintage, r.preferred_category, r.status, r.message
    FROM project_contact_requests r
    JOIN project_listings l ON l.id = r.listing_id JOIN projects p ON p.id = l.project_id
    JOIN project_claims c ON c.id = l.claim_id JOIN user_seller s ON s.id = c.seller_id
    WHERE r.buyer_id = ? ORDER BY r.created_at DESC
  `).all(req.user.id);
  sendRows(req, res, rows, { name: 'enquiries' });
});

// ---------- Seller ----------

router.get('/seller/enquiries', requireAuth, requireRole('seller'), (req, res) => {
  const rows = db.prepare(`
    SELECT r.created_at, p.project_reference, p.name AS project, b.name AS buyer, b.organisation_name AS buyer_organisation,
           b.email AS buyer_email, r.requested_quantity, r.preferred_vintage, r.preferred_category, r.status, r.message
    FROM project_contact_requests r
    JOIN project_listings l ON l.id = r.listing_id JOIN project_claims c ON c.id = l.claim_id
    JOIN projects p ON p.id = l.project_id JOIN user_buyer b ON b.id = r.buyer_id
    WHERE c.seller_id = ? ORDER BY r.created_at DESC
  `).all(req.user.id);
  sendRows(req, res, rows, { name: 'buyer-enquiries' });
});

router.get('/seller/listings', requireAuth, requireRole('seller'), (req, res) => {
  const rows = db.prepare(`
    SELECT p.project_reference, p.name AS project, l.listing_title, l.listing_status, a.quantity_available,
           a.indicative_price, a.vintage, a.category, a.status AS availability_status, a.seller_confirmed_at, a.expires_at
    FROM project_listings l JOIN project_claims c ON c.id = l.claim_id JOIN projects p ON p.id = l.project_id
    LEFT JOIN listing_availability a ON a.listing_id = l.id
    WHERE c.seller_id = ? ORDER BY p.name, a.created_at DESC
  `).all(req.user.id);
  sendRows(req, res, rows, { name: 'listings' });
});

// ---------- Admin ----------

const adminOnly = [requireAuth, requireRole('admin')];

router.get('/admin/users', ...adminOnly, (req, res) => {
  const rows = db.prepare(`
    SELECT 'buyer' AS role, name, email, organisation_name, organisation_type, country, account_status, created_at FROM user_buyer
    UNION ALL SELECT 'seller', name, email, organisation_name, organisation_type, country, account_status, created_at FROM user_seller
    UNION ALL SELECT 'admin', name, email, NULL, NULL, NULL, account_status, created_at FROM user_admin
    ORDER BY created_at DESC
  `).all();
  sendRows(req, res, rows, { name: 'users' });
});

router.get('/admin/claims', ...adminOnly, (req, res) => {
  const rows = db.prepare(`
    SELECT c.id, p.project_reference, p.name AS project, s.name AS seller, s.organisation_name, c.relationship_type,
           c.status, c.submitted_at, c.reviewed_at, c.verified_at, c.expires_at, c.review_notes, c.rejection_reason
    FROM project_claims c JOIN projects p ON p.id = c.project_id JOIN user_seller s ON s.id = c.seller_id
    ORDER BY c.submitted_at DESC
  `).all();
  sendRows(req, res, rows, { name: 'claims' });
});

router.get('/admin/enquiries', ...adminOnly, (req, res) => {
  const rows = db.prepare(`
    SELECT r.created_at, p.project_reference, p.name AS project, b.organisation_name AS buyer, COALESCE(s.organisation_name, s.name) AS seller,
           r.requested_quantity, r.status
    FROM project_contact_requests r
    JOIN project_listings l ON l.id = r.listing_id JOIN projects p ON p.id = l.project_id
    JOIN project_claims c ON c.id = l.claim_id JOIN user_seller s ON s.id = c.seller_id JOIN user_buyer b ON b.id = r.buyer_id
    ORDER BY r.created_at DESC
  `).all();
  sendRows(req, res, rows, { name: 'all-enquiries' });
});

router.get('/admin/import-runs', ...adminOnly, (req, res) => {
  const rows = db.prepare(`
    SELECT id, started_at, completed_at, source_type, file_name, source_url, status, records_received, records_inserted,
           records_updated, records_unchanged, records_failed, triggered_by
    FROM import_runs ORDER BY started_at DESC
  `).all();
  sendRows(req, res, rows, { name: 'import-runs' });
});

router.get('/admin/site-enquiries', ...adminOnly, (req, res) => {
  sendRows(req, res, db.prepare('SELECT * FROM site_enquiries ORDER BY created_at DESC').all(), { name: 'website-enquiries' });
});

router.get('/admin/introductions', ...adminOnly, (req, res) => {
  const rows = db.prepare(`
    SELECT i.created_at, b.name AS buyer, b.organisation_name, b.email, i.requested_quantity, i.max_price, i.project_types, i.states,
           i.preferred_vintage, i.preferred_category, i.timeframe, i.purpose, i.status,
           (SELECT COUNT(*) FROM buyer_introduction_matches m WHERE m.introduction_id = i.id) AS introductions_made
    FROM buyer_introductions i JOIN user_buyer b ON b.id = i.buyer_id ORDER BY i.created_at DESC
  `).all();
  sendRows(req, res, rows, { name: 'buyer-introductions' });
});

module.exports = router;
