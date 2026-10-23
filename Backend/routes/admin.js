const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { importProjectCsv, pullProjectCsv, bufferFromDataUrl, publicRun } = require('../lib/project-import');
const { allSettings, getSetting, setSetting } = require('../lib/settings');
const { createApiKey, listApiKeys, revokeApiKey, SCOPES } = require('../lib/api-keys');
const { savePrices } = require('../lib/market');
const { matchListings } = require('../lib/matching');
const { introduce } = require('../lib/introductions');
const { marketChanged } = require('../lib/events');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.post('/projects/csv', (req, res) => {
  const { file_name, file_data, strict = false } = req.body || {};
  if (!file_name || !file_data) return res.status(400).json({ error: 'file_name and file_data are required.' });
  let buffer;
  try { buffer = bufferFromDataUrl(file_data); } catch (error) { return res.status(400).json({ error: error.message }); }
  const run = importProjectCsv(buffer, { sourceType: 'admin_upload', fileName: file_name, triggeredBy: `admin:${req.user.id}`, strict: Boolean(strict) });
  const status = run.status === 'failed' ? 400 : 201;
  res.status(status).json({ ...publicRun(run), error: run.status === 'failed' ? (run.errors?.[0]?.error || 'Import failed.') : undefined });
});

router.get('/import-runs', (req, res) => {
  res.json(db.prepare('SELECT * FROM import_runs ORDER BY started_at DESC, id DESC LIMIT 100').all().map(publicRun));
});

// ---------- Integrations: API keys + scheduled CER pull ----------

router.get('/integrations', (req, res) => {
  const settings = allSettings();
  res.json({
    settings: {
      cer_source_url: settings.cer_source_url,
      auto_sync_enabled: settings.auto_sync_enabled === 'true',
      auto_sync_interval_hours: Number(settings.auto_sync_interval_hours || 24),
      last_auto_sync_at: settings.last_auto_sync_at || null,
    },
    api_keys: listApiKeys(),
    scopes: SCOPES,
  });
});

router.put('/integrations/settings', (req, res) => {
  const { cer_source_url, auto_sync_enabled, auto_sync_interval_hours } = req.body || {};
  if (cer_source_url !== undefined) {
    if (cer_source_url && !/^https?:\/\//i.test(cer_source_url)) return res.status(400).json({ error: 'The source URL must start with http:// or https://.' });
    setSetting('cer_source_url', cer_source_url.trim());
  }
  if (auto_sync_enabled !== undefined) setSetting('auto_sync_enabled', auto_sync_enabled ? 'true' : 'false');
  if (auto_sync_interval_hours !== undefined) {
    const hours = Number(auto_sync_interval_hours);
    if (!Number.isFinite(hours) || hours < 1 || hours > 24 * 31) return res.status(400).json({ error: 'Interval must be between 1 and 744 hours.' });
    setSetting('auto_sync_interval_hours', hours);
  }
  res.json({ ok: true, settings: allSettings() });
});

router.post('/integrations/pull', async (req, res) => {
  const url = req.body?.url || getSetting('cer_source_url');
  if (!url) return res.status(400).json({ error: 'Set a CER source URL first.' });
  try {
    const run = await pullProjectCsv(url, { sourceType: 'url_pull', triggeredBy: `admin:${req.user.id}` });
    res.status(run.status === 'failed' ? 502 : 201).json({ ...publicRun(run), error: run.status === 'failed' ? run.errors?.[0]?.error : undefined });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/api-keys', (req, res) => {
  try {
    res.status(201).json(createApiKey({ name: req.body?.name, scopes: req.body?.scopes, adminId: req.user.id }));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.delete('/api-keys/:id', (req, res) => {
  if (!revokeApiKey(req.params.id)) return res.status(404).json({ error: 'Active API key not found.' });
  res.json({ ok: true });
});

// ---------- Market reference prices ----------

router.post('/market-prices', (req, res) => {
  const rows = Array.isArray(req.body) ? req.body : Array.isArray(req.body?.prices) ? req.body.prices : [req.body || {}];
  try {
    const result = savePrices(rows, 'admin');
    if (result.saved) marketChanged('price');
    res.status(result.saved ? 201 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/market-prices/:id', (req, res) => {
  const changes = db.prepare('DELETE FROM market_prices WHERE id = ?').run(req.params.id).changes;
  if (!changes) return res.status(404).json({ error: 'Price not found.' });
  marketChanged('price');
  res.json({ ok: true });
});

router.get('/market-prices', (req, res) => {
  res.json(db.prepare('SELECT * FROM market_prices ORDER BY price_date DESC, id DESC LIMIT 500').all());
});

// ---------- Website enquiries ----------

router.get('/site-enquiries', (req, res) => {
  res.json(db.prepare('SELECT * FROM site_enquiries ORDER BY created_at DESC LIMIT 500').all());
});

router.patch('/site-enquiries/:id', (req, res) => {
  if (!['new', 'contacted', 'closed'].includes(req.body?.status)) return res.status(400).json({ error: 'Invalid status.' });
  const changes = db.prepare('UPDATE site_enquiries SET status = ? WHERE id = ?').run(req.body.status, req.params.id).changes;
  if (!changes) return res.status(404).json({ error: 'Enquiry not found.' });
  res.json({ ok: true });
});

// ---------- Buyer introductions ----------

router.get('/introductions', (req, res) => {
  const rows = db.prepare(`
    SELECT i.*, b.name AS buyer_name, b.organisation_name, b.email AS buyer_email,
           (SELECT COUNT(*) FROM buyer_introduction_matches m WHERE m.introduction_id = i.id) AS introductions_made
    FROM buyer_introductions i JOIN user_buyer b ON b.id = i.buyer_id
    ORDER BY CASE i.status WHEN 'new' THEN 0 WHEN 'matching' THEN 1 ELSE 2 END, i.created_at DESC
  `).all();
  res.json(rows.map((row) => ({ ...row, project_types: JSON.parse(row.project_types), states: JSON.parse(row.states) })));
});

router.get('/introductions/:id/matches', (req, res) => {
  const brief = db.prepare('SELECT * FROM buyer_introductions WHERE id = ?').get(req.params.id);
  if (!brief) return res.status(404).json({ error: 'Introduction not found.' });
  res.json(matchListings(brief, 10));
});

router.patch('/introductions/:id', (req, res) => {
  const { status, admin_notes } = req.body || {};
  if (status && !['new', 'matching', 'introduced', 'closed', 'withdrawn'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  const changes = db.prepare(`
    UPDATE buyer_introductions SET status = COALESCE(?, status), admin_notes = COALESCE(?, admin_notes), updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(status || null, admin_notes ?? null, req.params.id).changes;
  if (!changes) return res.status(404).json({ error: 'Introduction not found.' });
  res.json({ ok: true });
});

/** Admin introduces the buyer to a listing: creates the enquiry on the buyer's behalf. */
router.post('/introductions/:id/introduce', (req, res) => {
  const brief = db.prepare('SELECT * FROM buyer_introductions WHERE id = ?').get(req.params.id);
  if (!brief) return res.status(404).json({ error: 'Introduction not found.' });
  try {
    const result = introduce(brief, Number(req.body?.listing_id), 'admin', req.body?.note);
    res.status(201).json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/projects/:id/locations', (req, res) => {
  const { location_name, state_or_territory, region, latitude, longitude, precision_level = 'state', geometry_geojson, location_source = 'admin', seller_permission_to_display = false } = req.body || {};
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  if (!['state', 'region', 'approximate', 'exact'].includes(precision_level)) return res.status(400).json({ error: 'Invalid precision_level.' });
  if (!['seller', 'geocoded', 'admin'].includes(location_source)) return res.status(400).json({ error: 'Invalid location_source.' });
  const result = db.prepare(`
    INSERT INTO project_locations
      (project_id, location_name, state_or_territory, region, latitude, longitude, precision_level, geometry_geojson, location_source, seller_permission_to_display)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, location_name || null, state_or_territory || null, region || null, latitude == null ? null : Number(latitude), longitude == null ? null : Number(longitude), precision_level, geometry_geojson || null, location_source, seller_permission_to_display ? 1 : 0);
  res.status(201).json(db.prepare('SELECT * FROM project_locations WHERE id = ?').get(Number(result.lastInsertRowid)));
});

router.get('/stats', (req, res) => {
  const count = (table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
  res.json({
    buyers: count('user_buyer'),
    sellers: count('user_seller'),
    projects: count('projects'),
    pending_claims: db.prepare("SELECT COUNT(*) AS n FROM project_claims WHERE status = 'pending'").get().n,
    pending_evidence: db.prepare("SELECT COUNT(*) AS n FROM accu_evidence WHERE review_status = 'pending'").get().n,
    pending_images: db.prepare("SELECT COUNT(*) AS n FROM project_images WHERE review_status = 'pending'").get().n,
    published_listings: db.prepare("SELECT COUNT(*) AS n FROM project_listings WHERE listing_status = 'published'").get().n,
    open_introductions: db.prepare("SELECT COUNT(*) AS n FROM buyer_introductions WHERE status IN ('new', 'matching')").get().n,
    new_site_enquiries: db.prepare("SELECT COUNT(*) AS n FROM site_enquiries WHERE status = 'new'").get().n,
    last_import: publicRun(db.prepare("SELECT * FROM import_runs ORDER BY started_at DESC, id DESC LIMIT 1").get()),
  });
});

router.get('/users', (req, res) => {
  const rows = db.prepare(`
    SELECT id, 'buyer' AS role, name, email, organisation_name, country, account_status, created_at FROM user_buyer
    UNION ALL
    SELECT id, 'seller' AS role, name, email, organisation_name, country, account_status, created_at FROM user_seller
    UNION ALL
    SELECT id, 'admin' AS role, name, email, NULL AS organisation_name, NULL AS country, account_status, created_at FROM user_admin
    ORDER BY created_at DESC
  `).all();
  res.json(rows);
});

router.get('/claims', (req, res) => {
  const status = req.query.status;
  const rows = db.prepare(`
    SELECT c.id, c.project_id, c.seller_id, c.relationship_type, c.status,
           c.submitted_at, c.verified_at, c.expires_at, c.reviewed_at,
           c.review_notes, c.rejection_reason, p.project_reference, p.name AS project_name,
           p.project_proponent, s.name AS seller_name, s.organisation_name
    FROM project_claims c JOIN projects p ON p.id = c.project_id
    JOIN user_seller s ON s.id = c.seller_id
    ${status ? 'WHERE c.status = ?' : ''}
    ORDER BY c.submitted_at ASC
  `).all(...(status ? [status] : []));
  res.json(rows.map((row) => ({
    ...row,
    documents: db.prepare(`
      SELECT id, document_type, original_file_name, mime_type, file_size_bytes,
             review_status, reviewed_at, review_notes, uploaded_at
      FROM project_claim_documents WHERE claim_id = ? ORDER BY uploaded_at
    `).all(row.id),
  })));
});

router.get('/claims/:id', (req, res) => {
  const claim = db.prepare(`
    SELECT c.*, p.project_reference, p.name AS project_name, p.project_proponent,
           s.name AS seller_name, s.organisation_name
    FROM project_claims c JOIN projects p ON p.id = c.project_id
    JOIN user_seller s ON s.id = c.seller_id WHERE c.id = ?
  `).get(req.params.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found.' });
  claim.documents = db.prepare(`
    SELECT id, document_type, original_file_name, mime_type, file_size_bytes,
           review_status, reviewed_at, review_notes, uploaded_at
    FROM project_claim_documents WHERE claim_id = ? ORDER BY uploaded_at
  `).all(req.params.id);
  res.json(claim);
});

router.post('/claims/:id/review', (req, res) => {
  const { decision, review_notes, rejection_reason, expires_at } = req.body || {};
  const allowed = ['additional_information_required', 'approved', 'rejected', 'revoked', 'expired'];
  if (!allowed.includes(decision)) return res.status(400).json({ error: 'Invalid claim decision.' });
  const claim = db.prepare('SELECT id FROM project_claims WHERE id = ?').get(req.params.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found.' });
  const action = decision === 'approved' ? 'verified' : decision === 'additional_information_required' ? 'needs_changes' : decision === 'revoked' ? 'verification_revoked' : decision;
  try {
    db.exec('BEGIN');
    db.prepare(`
      UPDATE project_claims
      SET status = ?, verified_at = CASE WHEN ? = 'approved' THEN CURRENT_TIMESTAMP ELSE verified_at END,
          expires_at = ?, reviewed_by_admin_id = ?, reviewed_at = CURRENT_TIMESTAMP,
          review_notes = ?, rejection_reason = ?
      WHERE id = ?
    `).run(decision, decision, expires_at || null, req.user.id, review_notes || null, rejection_reason || null, req.params.id);
    if (['revoked', 'expired', 'rejected', 'additional_information_required'].includes(decision)) {
      db.prepare(`UPDATE project_listings SET listing_status = 'paused' WHERE claim_id = ? AND listing_status = 'published'`).run(req.params.id);
    }
    db.prepare(`
      INSERT INTO verification_audit_log (subject_type, subject_id, admin_user_id, action, notes)
      VALUES ('project_claim', ?, ?, ?, ?)
    `).run(req.params.id, req.user.id, action, review_notes || rejection_reason || null);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: error.message });
  }
  marketChanged('claim_review');
  res.json({ ok: true, status: decision });
});

module.exports = router;
