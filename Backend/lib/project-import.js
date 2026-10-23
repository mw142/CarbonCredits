const crypto = require('node:crypto');
const { db } = require('../db');
const { parseProjectCsv } = require('./project-csv');
const { marketChanged } = require('./events');

const MAX_CSV_BYTES = 25 * 1024 * 1024;
const MAX_ERRORS_STORED = 200;

function hashRecord(record) {
  return crypto.createHash('sha256').update(JSON.stringify({
    project: record.project,
    location: record.location,
    details: record.details,
    unitTotals: record.unitTotals,
    issuances: record.issuances,
    links: record.links,
  })).digest('hex');
}

function finishRun(runId, fields) {
  db.prepare(`
    UPDATE import_runs
    SET status = ?, records_received = ?, records_inserted = ?, records_updated = ?,
        records_unchanged = ?, records_failed = ?, error_details = ?, changed_project_refs = ?,
        completed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    fields.status, fields.received || 0, fields.inserted || 0, fields.updated || 0,
    fields.unchanged || 0, fields.failed || 0,
    fields.errors?.length ? JSON.stringify(fields.errors.slice(0, MAX_ERRORS_STORED)) : null,
    fields.changed?.length ? JSON.stringify(fields.changed.slice(0, 5000)) : null,
    runId,
  );
  return db.prepare('SELECT * FROM import_runs WHERE id = ?').get(runId);
}

function writeRecord(record, runId) {
  const existing = db.prepare('SELECT id FROM projects WHERE project_reference = ?').get(record.project.project_reference);
  const hash = hashRecord(record);
  if (existing) {
    const stored = db.prepare('SELECT source_hash FROM project_source_hashes WHERE project_id = ?').get(existing.id);
    if (stored?.source_hash === hash) return 'unchanged';
  }

  let projectId;
  let outcome;
  // Only official CER fields are written. Listings, claims, evidence, availability,
  // enquiries and seller-supplied locations are never touched by an import.
  if (existing) {
    db.prepare(`
      UPDATE projects
      SET project_type = ?, name = ?, project_proponent = ?, description = ?, methodology = ?,
          project_status = ?, project_registered_at = ?, crediting_period_start = ?, crediting_period_end = ?,
          total_accus_issued = ?, total_accus_relinquished = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      record.project.project_type, record.project.name, record.project.project_proponent, record.project.description,
      record.project.methodology, record.project.project_status, record.project.project_registered_at,
      record.project.crediting_period_start, record.project.crediting_period_end, record.project.total_accus_issued,
      record.project.total_accus_relinquished, existing.id,
    );
    projectId = existing.id;
    outcome = 'updated';
  } else {
    const result = db.prepare(`
      INSERT INTO projects
        (project_reference, project_type, name, project_proponent, description, methodology, project_status,
         project_registered_at, crediting_period_start, crediting_period_end, total_accus_issued,
         total_accus_relinquished)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.project.project_reference, record.project.project_type, record.project.name, record.project.project_proponent,
      record.project.description, record.project.methodology, record.project.project_status,
      record.project.project_registered_at, record.project.crediting_period_start, record.project.crediting_period_end,
      record.project.total_accus_issued, record.project.total_accus_relinquished,
    );
    projectId = Number(result.lastInsertRowid);
    outcome = 'inserted';
  }

  db.prepare("DELETE FROM project_locations WHERE project_id = ? AND location_source = 'admin'").run(projectId);
  if (record.location) {
    db.prepare(`
      INSERT INTO project_locations
        (project_id, location_name, state_or_territory, region, precision_level, location_source)
      VALUES (?, ?, ?, ?, ?, 'admin')
    `).run(projectId, record.location.location_name, record.location.state_or_territory, record.location.region, record.location.precision_level);
  }

  const detailColumns = Object.keys(record.details);
  db.prepare(`
    INSERT INTO project_details (project_id, ${detailColumns.join(', ')})
    VALUES (?, ${detailColumns.map(() => '?').join(', ')})
    ON CONFLICT(project_id) DO UPDATE SET ${detailColumns.map((column) => `${column} = excluded.${column}`).join(', ')}, updated_at = CURRENT_TIMESTAMP
  `).run(projectId, ...detailColumns.map((column) => record.details[column]));

  db.prepare('DELETE FROM project_unit_totals WHERE project_id = ?').run(projectId);
  const totalStatement = db.prepare(`
    INSERT INTO project_unit_totals (project_id, unit_type, total_units_issued, total_units_relinquished, recipient_name)
    VALUES (?, ?, ?, ?, ?)
  `);
  record.unitTotals.forEach((total) => totalStatement.run(projectId, total.unit_type, total.total_units_issued, total.total_units_relinquished, total.recipient_name));

  db.prepare('DELETE FROM project_unit_issuances WHERE project_id = ?').run(projectId);
  const issuanceStatement = db.prepare(`
    INSERT INTO project_unit_issuances (project_id, unit_type, financial_year, units_issued)
    VALUES (?, ?, ?, ?)
  `);
  record.issuances.forEach((issuance) => issuanceStatement.run(projectId, issuance.unit_type, issuance.financial_year, issuance.units_issued));

  db.prepare('DELETE FROM project_links WHERE project_id = ?').run(projectId);
  const linkStatement = db.prepare('INSERT INTO project_links (project_id, link_type, url) VALUES (?, ?, ?)');
  record.links.forEach((link) => linkStatement.run(projectId, link.link_type, link.url));

  db.prepare(`
    INSERT INTO project_source_hashes (project_id, source_hash, last_import_run_id, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(project_id) DO UPDATE SET source_hash = excluded.source_hash,
      last_import_run_id = excluded.last_import_run_id, updated_at = CURRENT_TIMESTAMP
  `).run(projectId, hash, runId);

  return outcome;
}

/**
 * Import a CER project register CSV.
 *
 * Rows are matched on Project ID; new projects are inserted, changed projects updated and
 * unchanged projects skipped. Valid rows are saved together in one transaction. Rows that fail
 * validation are reported in the run (status completed_with_errors) unless `strict` is set,
 * in which case any invalid row fails the whole import.
 *
 * @returns {object} the import_runs row (plus `errors` for convenience)
 */
function importProjectCsv(buffer, { sourceType, fileName = null, sourceUrl = null, triggeredBy = null, strict = false } = {}) {
  const run = db.prepare(`
    INSERT INTO import_runs (source_type, file_name, source_url, triggered_by) VALUES (?, ?, ?, ?)
  `).run(sourceType, fileName, sourceUrl, triggeredBy);
  const runId = Number(run.lastInsertRowid);

  if (!buffer?.length) return { ...finishRun(runId, { status: 'failed', errors: [{ error: 'The CSV file is empty.' }] }), errors: [{ error: 'The CSV file is empty.' }] };
  if (buffer.length > MAX_CSV_BYTES) {
    const errors = [{ error: `The CSV must be ${MAX_CSV_BYTES / 1024 / 1024} MB or smaller.` }];
    return { ...finishRun(runId, { status: 'failed', errors }), errors };
  }

  let parsed;
  try {
    parsed = parseProjectCsv(buffer);
  } catch (error) {
    const errors = [{ error: error.message }];
    return { ...finishRun(runId, { status: 'failed', errors }), errors };
  }

  const received = parsed.records.length + parsed.errors.length;
  if (strict && parsed.errors.length) {
    return { ...finishRun(runId, { status: 'failed', received, failed: parsed.errors.length, errors: parsed.errors }), errors: parsed.errors };
  }
  if (!parsed.records.length) {
    return { ...finishRun(runId, { status: 'failed', received, failed: parsed.errors.length, errors: parsed.errors }), errors: parsed.errors };
  }

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  const changed = [];
  try {
    db.exec('BEGIN');
    for (const record of parsed.records) {
      const outcome = writeRecord(record, runId);
      if (outcome === 'inserted') inserted += 1;
      else if (outcome === 'updated') updated += 1;
      else unchanged += 1;
      if (outcome !== 'unchanged') changed.push(record.project.project_reference);
    }
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch { /* already rolled back */ }
    const errors = [{ error: `The CSV could not be saved atomically: ${error.message}` }];
    return { ...finishRun(runId, { status: 'failed', received, errors }), errors };
  }

  const result = finishRun(runId, {
    status: parsed.errors.length ? 'completed_with_errors' : 'completed',
    received, inserted, updated, unchanged, failed: parsed.errors.length, errors: parsed.errors, changed,
  });
  if (inserted || updated) marketChanged('cer_import');
  return { ...result, errors: parsed.errors };
}

/** Download a CSV from a URL and import it. Only http(s) URLs are allowed. */
async function pullProjectCsv(url, { sourceType = 'url_pull', triggeredBy = null } = {}) {
  let parsedUrl;
  try { parsedUrl = new URL(url); } catch { throw Object.assign(new Error('A valid source URL is required.'), { status: 400 }); }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw Object.assign(new Error('Only http(s) source URLs are supported.'), { status: 400 });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  let buffer;
  try {
    const response = await fetch(parsedUrl, { signal: controller.signal, headers: { 'User-Agent': 'renewCo-platform/1.0 (+IrongateIT)' } });
    if (!response.ok) throw new Error(`Source responded with HTTP ${response.status}.`);
    const length = Number(response.headers.get('content-length') || 0);
    if (length > MAX_CSV_BYTES) throw new Error('The source file is larger than 25 MB.');
    buffer = Buffer.from(await response.arrayBuffer());
  } catch (error) {
    const message = error.name === 'AbortError' ? 'The source did not respond within 60 seconds.' : error.message;
    const run = db.prepare(`
      INSERT INTO import_runs (source_type, source_url, triggered_by, status, error_details, completed_at)
      VALUES (?, ?, ?, 'failed', ?, CURRENT_TIMESTAMP)
    `).run(sourceType, parsedUrl.href, triggeredBy, JSON.stringify([{ error: message }]));
    return { ...db.prepare('SELECT * FROM import_runs WHERE id = ?').get(Number(run.lastInsertRowid)), errors: [{ error: message }] };
  } finally {
    clearTimeout(timer);
  }
  const fileName = decodeURIComponent(parsedUrl.pathname.split('/').pop() || 'download.csv');
  return importProjectCsv(buffer, { sourceType, fileName, sourceUrl: parsedUrl.href, triggeredBy });
}

/** Decode the base64 data URL the frontend sends for uploads. */
function bufferFromDataUrl(fileData) {
  if (typeof fileData !== 'string' || !fileData.includes(';base64,')) {
    throw Object.assign(new Error('file_data must be a base64 data URL.'), { status: 400 });
  }
  return Buffer.from(fileData.slice(fileData.indexOf(';base64,') + 8), 'base64');
}

function publicRun(run) {
  if (!run) return null;
  const parse = (value) => { try { return value ? JSON.parse(value) : null; } catch { return null; } };
  return {
    ...run,
    error_details: parse(run.error_details),
    changed_project_refs: undefined,
    changed_count: (parse(run.changed_project_refs) || []).length,
    errors: undefined,
  };
}

module.exports = { importProjectCsv, pullProjectCsv, bufferFromDataUrl, publicRun, MAX_CSV_BYTES };
