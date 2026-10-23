const express = require('express');
const { parse } = require('csv-parse/sync');
const { db } = require('../db');
const { requireApiScope } = require('../lib/api-keys');
const { importProjectCsv, pullProjectCsv, bufferFromDataUrl, publicRun, MAX_CSV_BYTES } = require('../lib/project-import');
const { marketSnapshot, priceStats, savePrices } = require('../lib/market');
const { marketChanged } = require('../lib/events');
const { sendRows } = require('../lib/csv');

/*
 * renewCo. integration API — v1
 *
 * Authenticate with an API key created in Admin → Integrations:
 *   X-API-Key: rc_live_xxxxxxxx
 *
 * POST /api/v1/projects/import   Upload a CER project register CSV (raw text/csv body,
 *                                multipart is not needed). JSON {url} pulls from a URL instead.
 * GET  /api/v1/projects          Paged project list (filters: search, type, state, updated_since)
 * GET  /api/v1/projects/:ref     One project by CER Project ID (e.g. ERF101234)
 * GET  /api/v1/imports/:id       Status of an import run
 * GET  /api/v1/market/summary    Current market snapshot
 * GET  /api/v1/market/prices     Reference price history
 * POST /api/v1/market/prices     Push reference prices (JSON array, or text/csv with
 *                                instrument,price,price_date[,source,currency,notes])
 */

const router = express.Router();
const rawCsv = express.text({ type: ['text/csv', 'text/plain', 'application/csv'], limit: MAX_CSV_BYTES });

router.get('/', (req, res) => {
  res.json({
    name: 'renewCo. platform API',
    version: 'v1',
    auth: 'Send X-API-Key: rc_live_… (create keys in Admin → Integrations).',
    endpoints: [
      'POST /api/v1/projects/import  (text/csv body, or JSON {file_name, file_data} or {url})',
      'GET  /api/v1/projects?search=&type=&state=&updated_since=&page=&page_size=',
      'GET  /api/v1/projects/:project_reference',
      'GET  /api/v1/imports/:id',
      'GET  /api/v1/market/summary',
      'GET  /api/v1/market/prices',
      'POST /api/v1/market/prices',
    ],
  });
});

router.post('/projects/import', requireApiScope('projects:write'), rawCsv, async (req, res) => {
  const who = req.apiClient.type === 'api_key' ? `api_key:${req.apiClient.id}` : `admin:${req.apiClient.id}`;
  const strict = String(req.query.strict || '') === 'true';
  try {
    let run;
    if (typeof req.body === 'string') {
      run = importProjectCsv(Buffer.from(req.body, 'utf8'), { sourceType: 'api', fileName: String(req.query.file_name || 'api-upload.csv'), triggeredBy: who, strict });
    } else if (req.body?.url) {
      run = await pullProjectCsv(req.body.url, { sourceType: 'url_pull', triggeredBy: who });
    } else if (req.body?.file_data) {
      run = importProjectCsv(bufferFromDataUrl(req.body.file_data), { sourceType: 'api', fileName: req.body.file_name || 'api-upload.csv', triggeredBy: who, strict });
    } else {
      return res.status(400).json({ error: 'Send the CSV as a text/csv body, or JSON with file_data (base64 data URL) or url.' });
    }
    const out = publicRun(run);
    if (run.errors?.length) out.errors = run.errors.slice(0, 50);
    return res.status(run.status === 'failed' ? 422 : 201).json(out);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
});

router.get('/imports/:id', requireApiScope('projects:read'), (req, res) => {
  const run = db.prepare('SELECT * FROM import_runs WHERE id = ?').get(req.params.id);
  if (!run) return res.status(404).json({ error: 'Import run not found.' });
  res.json(publicRun(run));
});

function projectQuery(query) {
  const where = ['1 = 1'];
  const params = [];
  if (query.search) { where.push('(p.name LIKE ? OR p.project_reference LIKE ? OR p.project_proponent LIKE ?)'); params.push(`%${query.search}%`, `%${query.search}%`, `%${query.search}%`); }
  if (query.type) { where.push('p.project_type = ?'); params.push(query.type); }
  if (query.state) { where.push('EXISTS (SELECT 1 FROM project_locations l WHERE l.project_id = p.id AND l.state_or_territory LIKE ?)'); params.push(`%${query.state}%`); }
  if (query.updated_since) { where.push('p.updated_at >= ?'); params.push(query.updated_since); }
  return { where: where.join(' AND '), params };
}

const PROJECT_COLUMNS = `
  p.project_reference, p.name, p.project_type, p.project_proponent, p.methodology, p.project_status,
  p.project_registered_at, p.crediting_period_start, p.crediting_period_end,
  p.total_accus_issued, p.total_accus_relinquished, p.updated_at,
  (SELECT state_or_territory FROM project_locations l WHERE l.project_id = p.id AND l.location_source = 'admin' LIMIT 1) AS state,
  EXISTS (SELECT 1 FROM project_listings pl WHERE pl.project_id = p.id AND pl.listing_status = 'published') AS has_verified_listing
`;

router.get('/projects', requireApiScope('projects:read'), (req, res) => {
  const { where, params } = projectQuery(req.query);
  const pageSize = Math.min(500, Math.max(1, Number(req.query.page_size) || 100));
  const page = Math.max(1, Number(req.query.page) || 1);
  const total = db.prepare(`SELECT COUNT(*) AS n FROM projects p WHERE ${where}`).get(...params).n;
  const rows = db.prepare(`SELECT ${PROJECT_COLUMNS} FROM projects p WHERE ${where} ORDER BY p.project_reference LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize)
    .map((r) => ({ ...r, has_verified_listing: Boolean(r.has_verified_listing) }));
  if (String(req.query.format || '') === 'csv') return sendRows(req, res, rows, { name: 'projects' });
  res.json({ page, page_size: pageSize, total, data: rows });
});

router.get('/projects/:ref', requireApiScope('projects:read'), (req, res) => {
  const row = db.prepare(`SELECT ${PROJECT_COLUMNS}, p.description, p.id FROM projects p WHERE p.project_reference = ?`).get(req.params.ref);
  if (!row) return res.status(404).json({ error: 'Project not found.' });
  const issuances = db.prepare('SELECT unit_type, financial_year, units_issued FROM project_unit_issuances WHERE project_id = ? ORDER BY financial_year').all(row.id);
  delete row.id;
  res.json({ ...row, has_verified_listing: Boolean(row.has_verified_listing), issuances });
});

router.get('/market/summary', requireApiScope('market:read'), (req, res) => res.json(marketSnapshot()));
router.get('/market/prices', requireApiScope('market:read'), (req, res) => res.json(priceStats(Number(req.query.limit) || 365)));

router.post('/market/prices', requireApiScope('market:write'), rawCsv, (req, res) => {
  let rows;
  try {
    if (typeof req.body === 'string') rows = parse(req.body, { columns: (h) => h.map((x) => x.trim().toLowerCase()), skip_empty_lines: true, bom: true, trim: true });
    else rows = Array.isArray(req.body) ? req.body : Array.isArray(req.body?.prices) ? req.body.prices : [req.body];
  } catch (error) {
    return res.status(400).json({ error: `Could not read prices: ${error.message}` });
  }
  const result = savePrices(rows.slice(0, 5000), typeof req.body === 'string' ? 'csv' : 'api');
  if (result.saved) marketChanged('price');
  res.status(result.saved ? 201 : 400).json(result);
});

module.exports = router;
