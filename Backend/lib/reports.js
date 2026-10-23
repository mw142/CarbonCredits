const { db } = require('../db');
const { emissionsSummary, round } = require('./emissions');
const { marketSnapshot } = require('./market');

/*
 * Automated reporting.
 *
 * Every report is a list of sections; each section can hold KPIs and/or a table. The same
 * structure is rendered by the frontend, printed to PDF by the browser, and flattened to CSV.
 */

const REPORT_TYPES = {
  buyer: [
    { type: 'buyer_sustainability', label: 'Emissions & offset report' },
    { type: 'market_summary', label: 'Market summary' },
  ],
  seller: [
    { type: 'seller_activity', label: 'Listing & enquiry report' },
    { type: 'market_summary', label: 'Market summary' },
  ],
  admin: [
    { type: 'platform_overview', label: 'Platform overview' },
    { type: 'market_summary', label: 'Market summary' },
  ],
};
const FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'off'];

// ---------- dates (UTC, stored in SQLite CURRENT_TIMESTAMP format) ----------
const iso = (d) => d.toISOString().slice(0, 10);
const sqlTs = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
const utc = (y, m, d = 1) => new Date(Date.UTC(y, m, d));

/** The most recent complete period for a frequency, as [startDate, endDateExclusive]. */
function previousPeriod(frequency, now = new Date()) {
  const today = utc(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (frequency === 'weekly') {
    const day = (today.getUTCDay() + 6) % 7; // Monday = 0
    const end = new Date(today); end.setUTCDate(end.getUTCDate() - day);
    const start = new Date(end); start.setUTCDate(start.getUTCDate() - 7);
    return [start, end];
  }
  if (frequency === 'quarterly') {
    const q = Math.floor(today.getUTCMonth() / 3);
    const end = utc(today.getUTCFullYear(), q * 3);
    return [utc(end.getUTCFullYear(), end.getUTCMonth() - 3), end];
  }
  const end = utc(today.getUTCFullYear(), today.getUTCMonth());
  return [utc(end.getUTCFullYear(), end.getUTCMonth() - 1), end];
}

/** When the next scheduled run is due: shortly after the current period closes. */
function nextRunAt(frequency, now = new Date()) {
  if (frequency === 'off') return null;
  const [, end] = previousPeriod(frequency, now);
  const next = new Date(end);
  if (frequency === 'weekly') next.setUTCDate(next.getUTCDate() + 7);
  else if (frequency === 'quarterly') next.setUTCMonth(next.getUTCMonth() + 3);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  next.setUTCHours(1, 0, 0, 0);
  return sqlTs(next);
}

const between = 'created_at >= ? AND created_at < ?';

// ---------- report builders ----------

function buyerReport(buyerId, start, end) {
  const year = Number(end.slice(0, 4)) - (end.slice(5) === '01-01' ? 1 : 0);
  const summary = emissionsSummary(buyerId, year);
  const enquiries = db.prepare(`
    SELECT r.created_at, p.name AS project, p.project_reference, r.requested_quantity, r.status
    FROM project_contact_requests r
    JOIN project_listings l ON l.id = r.listing_id JOIN projects p ON p.id = l.project_id
    WHERE r.buyer_id = ? AND r.created_at >= ? AND r.created_at < ? ORDER BY r.created_at
  `).all(buyerId, start, end);
  const intros = db.prepare(`
    SELECT created_at, requested_quantity, max_price, timeframe, status FROM buyer_introductions
    WHERE buyer_id = ? AND ${between} ORDER BY created_at
  `).all(buyerId, start, end);
  const retirements = db.prepare(`
    SELECT retired_on, quantity, project_reference, vintage, category FROM offset_retirements
    WHERE buyer_id = ? AND retired_on >= ? AND retired_on < ? ORDER BY retired_on
  `).all(buyerId, start, end);

  return [
    {
      heading: `${year} position (calendar year to date)`,
      kpis: [
        { label: 'Emissions recorded', value: summary.total_tco2e, unit: 't CO2-e' },
        { label: 'ACCUs retired', value: summary.offsets_retired, unit: 'ACCUs' },
        { label: 'Net position', value: summary.net_tco2e, unit: 't CO2-e' },
        { label: 'Offset goal progress', value: summary.goal_progress_pct, unit: '%' },
      ],
      note: '1 ACCU represents one tonne of CO2-e avoided or stored. Figures are self-reported by your organisation.',
    },
    {
      heading: 'Emissions by scope',
      table: {
        columns: [['scope', 'Scope'], ['tco2e', 't CO2-e'], ['entries', 'Entries']],
        rows: summary.by_scope.map((r) => ({ ...r, scope: `Scope ${r.scope}` })),
      },
    },
    {
      heading: 'Emissions by source',
      table: { columns: [['category', 'Source'], ['scope', 'Scope'], ['tco2e', 't CO2-e']], rows: summary.by_category },
    },
    {
      heading: 'Offsets retired this period',
      table: { columns: [['retired_on', 'Date'], ['quantity', 'ACCUs'], ['project_reference', 'Project'], ['vintage', 'Vintage'], ['category', 'Category']], rows: retirements },
    },
    {
      heading: 'Activity this period',
      kpis: [
        { label: 'Enquiries sent', value: enquiries.length },
        { label: 'ACCUs requested', value: enquiries.reduce((s, r) => s + (r.requested_quantity || 0), 0) },
        { label: 'Introduction requests', value: intros.length },
      ],
      table: { columns: [['created_at', 'Date'], ['project', 'Project'], ['requested_quantity', 'Quantity'], ['status', 'Status']], rows: enquiries },
    },
  ];
}

function sellerReport(sellerId, start, end) {
  const listings = db.prepare(`
    SELECT l.id, COALESCE(l.listing_title, p.name) AS listing, p.project_reference, l.listing_status,
      (SELECT SUM(quantity_available) FROM listing_availability a WHERE a.listing_id = l.id AND a.status = 'active'
         AND (a.expires_at IS NULL OR a.expires_at > CURRENT_TIMESTAMP)) AS available,
      (SELECT indicative_price FROM listing_availability a WHERE a.listing_id = l.id AND a.status = 'active' ORDER BY created_at DESC LIMIT 1) AS price,
      (SELECT COUNT(*) FROM project_contact_requests r WHERE r.listing_id = l.id AND r.created_at >= ? AND r.created_at < ?) AS enquiries_in_period
    FROM project_listings l JOIN project_claims c ON c.id = l.claim_id JOIN projects p ON p.id = l.project_id
    WHERE c.seller_id = ? ORDER BY l.updated_at DESC
  `).all(start, end, sellerId);
  const enquiries = db.prepare(`
    SELECT r.created_at, p.name AS project, b.organisation_name AS buyer_organisation, r.requested_quantity, r.status
    FROM project_contact_requests r
    JOIN project_listings l ON l.id = r.listing_id JOIN project_claims c ON c.id = l.claim_id
    JOIN projects p ON p.id = l.project_id JOIN user_buyer b ON b.id = r.buyer_id
    WHERE c.seller_id = ? AND r.created_at >= ? AND r.created_at < ? ORDER BY r.created_at
  `).all(sellerId, start, end);
  const byStatus = ['new', 'viewed', 'responded', 'closed', 'withdrawn'].map((status) => ({ status, count: enquiries.filter((e) => e.status === status).length }));
  const evidence = db.prepare(`
    SELECT e.review_status AS status, COUNT(*) AS count FROM accu_evidence e
    JOIN project_listings l ON l.id = e.listing_id JOIN project_claims c ON c.id = l.claim_id
    WHERE c.seller_id = ? GROUP BY e.review_status
  `).all(sellerId);
  const expiring = db.prepare(`
    SELECT COUNT(*) AS n FROM listing_availability a JOIN project_listings l ON l.id = a.listing_id
    JOIN project_claims c ON c.id = l.claim_id
    WHERE c.seller_id = ? AND a.status = 'active' AND a.expires_at IS NOT NULL
      AND a.expires_at BETWEEN CURRENT_TIMESTAMP AND datetime('now', '+14 days')
  `).get(sellerId).n;

  return [
    {
      heading: 'Summary',
      kpis: [
        { label: 'Published listings', value: listings.filter((l) => l.listing_status === 'published').length },
        { label: 'ACCUs offered', value: listings.reduce((s, l) => s + (l.available || 0), 0), unit: 'ACCUs' },
        { label: 'Enquiries this period', value: enquiries.length },
        { label: 'Offers expiring in 14 days', value: expiring },
      ],
      note: expiring ? 'Reconfirm expiring availability so buyers keep seeing it.' : null,
    },
    { heading: 'Listings', table: { columns: [['listing', 'Listing'], ['project_reference', 'Project'], ['listing_status', 'Status'], ['available', 'Available'], ['price', 'Indicative price (AUD)'], ['enquiries_in_period', 'Enquiries']], rows: listings } },
    { heading: 'Enquiries by status', table: { columns: [['status', 'Status'], ['count', 'Enquiries']], rows: byStatus } },
    { heading: 'Enquiries received', table: { columns: [['created_at', 'Date'], ['project', 'Project'], ['buyer_organisation', 'Buyer'], ['requested_quantity', 'Quantity'], ['status', 'Status']], rows: enquiries } },
    { heading: 'ACCU evidence', table: { columns: [['status', 'Review status'], ['count', 'Documents']], rows: evidence } },
  ];
}

function adminReport(start, end) {
  const count = (sql, ...params) => db.prepare(sql).get(...params).n;
  const imports = db.prepare(`
    SELECT started_at, source_type, file_name, status, records_received, records_inserted, records_updated, records_unchanged, records_failed
    FROM import_runs WHERE started_at >= ? AND started_at < ? ORDER BY started_at
  `).all(start, end);
  return [
    {
      heading: 'Growth',
      kpis: [
        { label: 'New buyers', value: count(`SELECT COUNT(*) AS n FROM user_buyer WHERE ${between}`, start, end) },
        { label: 'New sellers', value: count(`SELECT COUNT(*) AS n FROM user_seller WHERE ${between}`, start, end) },
        { label: 'Website enquiries', value: count(`SELECT COUNT(*) AS n FROM site_enquiries WHERE ${between}`, start, end) },
        { label: 'Buyer introductions', value: count(`SELECT COUNT(*) AS n FROM buyer_introductions WHERE ${between}`, start, end) },
      ],
    },
    {
      heading: 'Verification',
      kpis: [
        { label: 'Claims submitted', value: count('SELECT COUNT(*) AS n FROM project_claims WHERE submitted_at >= ? AND submitted_at < ?', start, end) },
        { label: 'Claims approved', value: count("SELECT COUNT(*) AS n FROM project_claims WHERE status = 'approved' AND verified_at >= ? AND verified_at < ?", start, end) },
        { label: 'Evidence verified', value: count("SELECT COUNT(*) AS n FROM accu_evidence WHERE review_status = 'verified' AND verified_at >= ? AND verified_at < ?", start, end) },
        { label: 'Still pending', value: count("SELECT (SELECT COUNT(*) FROM project_claims WHERE status = 'pending') + (SELECT COUNT(*) FROM accu_evidence WHERE review_status = 'pending') + (SELECT COUNT(*) FROM project_images WHERE review_status = 'pending') AS n") },
      ],
    },
    {
      heading: 'Marketplace',
      kpis: [
        { label: 'Published listings', value: count("SELECT COUNT(*) AS n FROM project_listings WHERE listing_status = 'published'") },
        { label: 'Buyer enquiries', value: count(`SELECT COUNT(*) AS n FROM project_contact_requests WHERE ${between}`, start, end) },
        { label: 'ACCUs requested', value: count(`SELECT COALESCE(SUM(requested_quantity), 0) AS n FROM project_contact_requests WHERE ${between}`, start, end) },
        { label: 'Price points recorded', value: count(`SELECT COUNT(*) AS n FROM market_prices WHERE ${between}`, start, end) },
      ],
    },
    {
      heading: 'CER data imports',
      table: {
        columns: [['started_at', 'Started'], ['source_type', 'Source'], ['file_name', 'File'], ['status', 'Status'], ['records_received', 'Rows'], ['records_inserted', 'Inserted'], ['records_updated', 'Updated'], ['records_unchanged', 'Unchanged'], ['records_failed', 'Failed']],
        rows: imports,
      },
    },
  ];
}

function marketReport() {
  const snap = marketSnapshot();
  const fmt = (v, d = 2) => (v == null ? null : round(v, d));
  return [
    {
      heading: 'CER register',
      kpis: [
        { label: 'Registered projects', value: snap.register.projects },
        { label: 'ACCUs issued (all time)', value: snap.register.accus_issued, unit: 'ACCUs' },
        { label: 'ACCUs relinquished', value: snap.register.accus_relinquished, unit: 'ACCUs' },
      ],
      table: { columns: [['label', 'Method type'], ['projects', 'Projects'], ['accus', 'ACCUs issued']], rows: snap.register.by_type },
    },
    {
      heading: 'Platform supply',
      kpis: [
        { label: 'ACCUs offered', value: snap.listings.total_available, unit: 'ACCUs' },
        { label: 'Weighted avg. indicative price', value: fmt(snap.listings.weighted_avg_price), unit: 'AUD' },
        { label: 'Price range', value: snap.listings.min_price == null ? null : `${fmt(snap.listings.min_price)}–${fmt(snap.listings.max_price)}`, unit: 'AUD' },
        { label: 'Open buyer demand', value: (snap.demand.requested_quantity_open || 0) + (snap.demand.introductions_quantity_open || 0), unit: 'ACCUs' },
      ],
    },
    {
      heading: 'Reference prices',
      table: {
        columns: [['instrument', 'Instrument'], ['price', 'Latest (AUD)'], ['date', 'Date'], ['change_pct', 'Change %'], ['source', 'Source']],
        rows: snap.prices.map((p) => ({ instrument: p.instrument, price: p.latest?.price, date: p.latest?.date, change_pct: fmt(p.change_pct, 1), source: p.latest?.source })),
      },
      note: 'Indicative prices are supplied by sellers or market data providers and are not offers. Purchases, payments and ACCU transfers occur outside this platform.',
    },
  ];
}

function ownerName(role, id) {
  const table = { buyer: 'user_buyer', seller: 'user_seller', admin: 'user_admin' }[role];
  const row = db.prepare(`SELECT name${role === 'admin' ? '' : ', organisation_name'} FROM ${table} WHERE id = ?`).get(id);
  return row ? row.organisation_name || row.name : null;
}

function generateReport({ role, ownerId, type, start, end, trigger = 'manual' }) {
  const allowed = (REPORT_TYPES[role] || []).find((r) => r.type === type);
  if (!allowed) throw Object.assign(new Error('That report type is not available for this account.'), { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start >= end) {
    throw Object.assign(new Error('Choose a valid period (start before end, YYYY-MM-DD).'), { status: 400 });
  }
  let sections;
  if (type === 'buyer_sustainability') sections = buyerReport(ownerId, start, end);
  else if (type === 'seller_activity') sections = sellerReport(ownerId, start, end);
  else if (type === 'platform_overview') sections = adminReport(start, end);
  else sections = marketReport();

  const lastDay = new Date(`${end}T00:00:00Z`); lastDay.setUTCDate(lastDay.getUTCDate() - 1);
  const data = { prepared_for: ownerName(role, ownerId), period_label: `${start} to ${iso(lastDay)}`, sections };
  const result = db.prepare(`
    INSERT INTO generated_reports (owner_role, owner_id, report_type, title, period_start, period_end, trigger, data_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(role, ownerId, type, allowed.label, start, end, trigger, JSON.stringify(data));
  return getReport(Number(result.lastInsertRowid), role, ownerId);
}

function getReport(id, role, ownerId) {
  const row = db.prepare('SELECT * FROM generated_reports WHERE id = ? AND owner_role = ? AND owner_id = ?').get(id, role, ownerId);
  if (!row) return null;
  const { data_json: dataJson, ...rest } = row;
  return { ...rest, data: JSON.parse(dataJson) };
}

/** Make sure every account has a monthly schedule for its main report. */
function ensureDefaultSchedules(role, ownerId) {
  const main = REPORT_TYPES[role]?.[0];
  if (!main) return;
  db.prepare(`
    INSERT OR IGNORE INTO report_schedules (owner_role, owner_id, report_type, frequency, next_run_at)
    VALUES (?, ?, ?, 'monthly', ?)
  `).run(role, ownerId, main.type, nextRunAt('monthly'));
}

function setSchedule(role, ownerId, type, frequency) {
  if (!FREQUENCIES.includes(frequency)) throw Object.assign(new Error(`frequency must be one of ${FREQUENCIES.join(', ')}.`), { status: 400 });
  if (!(REPORT_TYPES[role] || []).some((r) => r.type === type)) throw Object.assign(new Error('Unknown report type.'), { status: 400 });
  db.prepare(`
    INSERT INTO report_schedules (owner_role, owner_id, report_type, frequency, next_run_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(owner_role, owner_id, report_type) DO UPDATE SET frequency = excluded.frequency, next_run_at = excluded.next_run_at
  `).run(role, ownerId, type, frequency, nextRunAt(frequency));
}

/** Called by the scheduler: generate every report whose schedule is due. */
function runDueReports(now = new Date()) {
  const due = db.prepare(`
    SELECT * FROM report_schedules WHERE frequency != 'off' AND next_run_at IS NOT NULL AND next_run_at <= ?
  `).all(sqlTs(now));
  let generated = 0;
  for (const schedule of due) {
    try {
      const [start, end] = previousPeriod(schedule.frequency, now);
      generateReport({ role: schedule.owner_role, ownerId: schedule.owner_id, type: schedule.report_type, start: iso(start), end: iso(end), trigger: 'scheduled' });
      generated += 1;
    } catch (error) {
      console.error('[reports] scheduled report failed', schedule.id, error.message);
    }
    db.prepare('UPDATE report_schedules SET last_run_at = ?, next_run_at = ? WHERE id = ?').run(sqlTs(now), nextRunAt(schedule.frequency, now), schedule.id);
  }
  return generated;
}

/** Flatten a report into CSV-friendly rows. */
function reportRows(report) {
  const rows = [];
  for (const section of report.data.sections) {
    for (const kpi of section.kpis || []) rows.push({ section: section.heading, metric: kpi.label, value: kpi.value, unit: kpi.unit || '' });
    for (const row of section.table?.rows || []) {
      rows.push({
        section: section.heading,
        metric: section.table.columns.map(([key, label]) => `${label}: ${row[key] ?? ''}`).join(' | '),
        value: '',
        unit: '',
      });
    }
  }
  return rows;
}

module.exports = {
  REPORT_TYPES, FREQUENCIES, previousPeriod, nextRunAt, generateReport, getReport,
  ensureDefaultSchedules, setSchedule, runDueReports, reportRows, iso,
};
