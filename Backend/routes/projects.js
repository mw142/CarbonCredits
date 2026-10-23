const express = require('express');
const { db } = require('../db');
const { filePath } = require('../lib/files');

const router = express.Router();

function listingForProject(projectId) {
  return db.prepare(`
    SELECT l.id, l.project_id, l.claim_id, l.listing_title, l.seller_description,
           l.contact_available, l.listing_status, l.created_at, l.updated_at,
           s.id AS seller_id, s.name AS seller_name, s.organisation_name,
           a.id AS availability_id, a.quantity_available, a.vintage AS availability_vintage,
           a.category AS availability_category, a.indicative_price, a.seller_confirmed_at,
           a.expires_at AS availability_expires_at, a.status AS availability_status, a.notes AS availability_notes,
           (SELECT '/api/media/' || pi.storage_key
            FROM project_images pi
            WHERE pi.listing_id = l.id AND pi.review_status = 'approved'
            ORDER BY pi.is_primary DESC, pi.display_order, pi.uploaded_at
            LIMIT 1) AS cover_image_url
    FROM project_listings l
    JOIN project_claims c ON c.id = l.claim_id AND c.project_id = l.project_id
    JOIN user_seller s ON s.id = c.seller_id
    LEFT JOIN listing_availability a ON a.id = (
      SELECT id FROM listing_availability
      WHERE listing_id = l.id
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      ORDER BY created_at DESC LIMIT 1
    )
    WHERE l.project_id = ? AND l.listing_status = 'published'
  `).get(projectId);
}

function locationsForProject(projectId) {
  return db.prepare(`
    SELECT id, location_name, state_or_territory, region, latitude, longitude,
           precision_level, geometry_geojson, location_source,
           seller_permission_to_display, updated_at
    FROM project_locations WHERE project_id = ? ORDER BY updated_at DESC
  `).all(projectId).filter((location) => (
    location.location_source !== 'seller' || location.seller_permission_to_display === 1
  ));
}

function publicProject(project, detail = false) {
  const listing = listingForProject(project.id);
  const out = {
    id: project.id,
    project_reference: project.project_reference,
    project_type: project.project_type,
    name: project.name,
    project_proponent: project.project_proponent,
    description: project.description,
    methodology: project.methodology,
    project_status: project.project_status,
    project_registered_at: project.project_registered_at,
    crediting_period_start: project.crediting_period_start,
    crediting_period_end: project.crediting_period_end,
    total_accus_issued: project.total_accus_issued,
    total_accus_relinquished: project.total_accus_relinquished,
    claimed: Boolean(listing),
    listing: listing ? {
      id: listing.id,
      title: listing.listing_title,
      description: listing.seller_description,
      cover_image_url: listing.cover_image_url,
      contact_available: Boolean(listing.contact_available),
      seller: { id: listing.seller_id, name: listing.seller_name, organisation_name: listing.organisation_name },
      availability: listing.availability_id ? {
        id: listing.availability_id,
        quantity_available: listing.quantity_available,
        vintage: listing.availability_vintage,
        category: listing.availability_category,
        indicative_price: listing.indicative_price,
        seller_confirmed_at: listing.seller_confirmed_at,
        expires_at: listing.availability_expires_at,
        status: listing.availability_status,
        notes: listing.availability_notes,
      } : null,
    } : null,
    locations: locationsForProject(project.id),
  };

  if (detail && listing) {
    out.listing.images = db.prepare(`
      SELECT id, caption, alt_text, display_order, is_primary, uploaded_at,
             '/api/media/' || storage_key AS url
      FROM project_images WHERE listing_id = ? AND review_status = 'approved'
      ORDER BY is_primary DESC, display_order, uploaded_at
    `).all(listing.id);
    out.listing.accu_evidence = db.prepare(`
      SELECT id, vintage, category, verified_quantity, masked_reference, verified_at
      FROM accu_evidence
      WHERE listing_id = ? AND review_status = 'verified'
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      ORDER BY verified_at DESC
    `).all(listing.id);
  }
  if (detail) {
    out.project_details = db.prepare('SELECT * FROM project_details WHERE project_id = ?').get(project.id) || null;
    out.project_unit_totals = db.prepare(`
      SELECT unit_type, total_units_issued, total_units_relinquished, recipient_name
      FROM project_unit_totals WHERE project_id = ? ORDER BY unit_type
    `).all(project.id);
    out.project_unit_issuances = db.prepare(`
      SELECT unit_type, financial_year, units_issued
      FROM project_unit_issuances WHERE project_id = ? ORDER BY financial_year, unit_type
    `).all(project.id);
    out.project_links = db.prepare('SELECT link_type, url FROM project_links WHERE project_id = ? ORDER BY link_type, url').all(project.id);
  }
  return out;
}

router.get('/projects', (req, res) => {
  const { type, state, status, search } = req.query;
  let sql = 'SELECT * FROM projects WHERE 1 = 1';
  const params = [];
  if (type) { sql += ' AND project_type = ?'; params.push(type); }
  if (state) { sql += ' AND (project_status LIKE ? OR EXISTS (SELECT 1 FROM project_locations l WHERE l.project_id = projects.id AND (l.state_or_territory LIKE ? OR l.region LIKE ?)))'; params.push(`%${state}%`, `%${state}%`, `%${state}%`); }
  if (status) { sql += ' AND project_status = ?'; params.push(status); }
  if (search) { sql += ' AND (name LIKE ? OR project_proponent LIKE ? OR methodology LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  sql += ' ORDER BY name';
  res.json(db.prepare(sql).all(...params).map((project) => publicProject(project)));
});

router.get('/projects/:id', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  res.json(publicProject(project, true));
});

router.get('/media/:storageKey', (req, res) => {
  const image = db.prepare(`
    SELECT pi.storage_key FROM project_images pi
    JOIN project_listings l ON l.id = pi.listing_id
    WHERE pi.storage_key = ? AND pi.review_status = 'approved' AND l.listing_status = 'published'
  `).get(req.params.storageKey);
  if (!image) return res.status(404).json({ error: 'Image not found.' });
  try { return res.sendFile(filePath(image.storage_key)); } catch { return res.status(400).json({ error: 'Invalid media key.' }); }
});

router.publicProject = publicProject;
module.exports = router;
