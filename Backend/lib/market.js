const crypto = require('node:crypto');
const { db } = require('../db');

const ACTIVE_AVAILABILITY = `
  a.status = 'active'
  AND (a.expires_at IS NULL OR a.expires_at > CURRENT_TIMESTAMP)
  AND l.listing_status = 'published'
`;

function registerStats() {
  const totals = db.prepare(`
    SELECT COUNT(*) AS projects,
           COALESCE(SUM(total_accus_issued), 0) AS accus_issued,
           COALESCE(SUM(total_accus_relinquished), 0) AS accus_relinquished,
           SUM(CASE WHEN project_status = 'registered' THEN 1 ELSE 0 END) AS active_projects
    FROM projects
  `).get();
  const byType = db.prepare(`
    SELECT COALESCE(project_type, 'Unspecified') AS label, COUNT(*) AS projects,
           COALESCE(SUM(total_accus_issued), 0) AS accus
    FROM projects GROUP BY label ORDER BY accus DESC, projects DESC LIMIT 8
  `).all();
  const byState = db.prepare(`
    SELECT COALESCE(l.state_or_territory, 'Unspecified') AS label, COUNT(DISTINCT p.id) AS projects,
           COALESCE(SUM(p.total_accus_issued), 0) AS accus
    FROM projects p
    LEFT JOIN project_locations l ON l.project_id = p.id AND l.location_source = 'admin'
    GROUP BY label ORDER BY projects DESC LIMIT 10
  `).all();
  const issuance = db.prepare(`
    SELECT financial_year,
           SUM(CASE WHEN unit_type = 'KACCU' THEN units_issued ELSE 0 END) AS kaccu,
           SUM(CASE WHEN unit_type = 'NKACCU' THEN units_issued ELSE 0 END) AS nkaccu,
           SUM(units_issued) AS total
    FROM project_unit_issuances GROUP BY financial_year ORDER BY financial_year
  `).all();
  const lastImport = db.prepare(`
    SELECT id, source_type, status, file_name, completed_at, records_inserted, records_updated, records_unchanged
    FROM import_runs WHERE status IN ('completed', 'completed_with_errors')
    ORDER BY completed_at DESC LIMIT 1
  `).get() || null;
  return { ...totals, by_type: byType, by_state: byState, issuance_by_fy: issuance, last_import: lastImport };
}

function listingStats() {
  const counts = db.prepare(`
    SELECT COUNT(*) AS published FROM project_listings WHERE listing_status = 'published'
  `).get();
  const supply = db.prepare(`
    SELECT COUNT(DISTINCT a.listing_id) AS listings_with_supply,
           COALESCE(SUM(a.quantity_available), 0) AS total_available,
           MIN(a.indicative_price) AS min_price,
           MAX(a.indicative_price) AS max_price,
           CASE WHEN SUM(CASE WHEN a.indicative_price IS NOT NULL THEN a.quantity_available END) > 0
             THEN SUM(a.indicative_price * a.quantity_available) / SUM(CASE WHEN a.indicative_price IS NOT NULL THEN a.quantity_available END)
           END AS weighted_avg_price,
           COUNT(a.indicative_price) AS priced_offers
    FROM listing_availability a JOIN project_listings l ON l.id = a.listing_id
    WHERE ${ACTIVE_AVAILABILITY}
  `).get();
  const byCategory = db.prepare(`
    SELECT COALESCE(a.category, 'Unspecified') AS category, SUM(a.quantity_available) AS quantity,
           AVG(a.indicative_price) AS avg_price, COUNT(*) AS offers
    FROM listing_availability a JOIN project_listings l ON l.id = a.listing_id
    WHERE ${ACTIVE_AVAILABILITY} GROUP BY category ORDER BY quantity DESC
  `).all();
  const byVintage = db.prepare(`
    SELECT COALESCE(a.vintage, 'Unspecified') AS vintage, SUM(a.quantity_available) AS quantity, AVG(a.indicative_price) AS avg_price
    FROM listing_availability a JOIN project_listings l ON l.id = a.listing_id
    WHERE ${ACTIVE_AVAILABILITY} GROUP BY vintage ORDER BY vintage DESC LIMIT 8
  `).all();
  const recent = db.prepare(`
    SELECT a.id, p.id AS project_id, p.name AS project_name, p.project_type, l.listing_title,
           a.quantity_available, a.indicative_price, a.vintage, a.category, a.seller_confirmed_at
    FROM listing_availability a
    JOIN project_listings l ON l.id = a.listing_id
    JOIN projects p ON p.id = l.project_id
    WHERE ${ACTIVE_AVAILABILITY}
    ORDER BY a.seller_confirmed_at DESC, a.id DESC LIMIT 8
  `).all();
  return { ...counts, ...supply, by_category: byCategory, by_vintage: byVintage, recent_offers: recent };
}

function demandStats() {
  return db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM project_contact_requests) AS enquiries_total,
      (SELECT COUNT(*) FROM project_contact_requests WHERE created_at >= datetime('now', '-30 days')) AS enquiries_30d,
      (SELECT COALESCE(SUM(requested_quantity), 0) FROM project_contact_requests WHERE status IN ('new', 'viewed', 'responded')) AS requested_quantity_open,
      (SELECT COUNT(*) FROM buyer_introductions WHERE status IN ('new', 'matching')) AS introductions_open,
      (SELECT COALESCE(SUM(requested_quantity), 0) FROM buyer_introductions WHERE status IN ('new', 'matching')) AS introductions_quantity_open
  `).get();
}

function priceStats(historyLimit = 90) {
  const instruments = db.prepare('SELECT DISTINCT instrument FROM market_prices ORDER BY instrument').all().map((row) => row.instrument);
  return instruments.map((instrument) => {
    const history = db.prepare(`
      SELECT price_date AS date, price, source FROM market_prices
      WHERE instrument = ? ORDER BY price_date DESC, id DESC LIMIT ?
    `).all(instrument, historyLimit).reverse();
    const latest = history[history.length - 1] || null;
    const previous = history[history.length - 2] || null;
    const change = latest && previous ? latest.price - previous.price : null;
    return {
      instrument,
      currency: 'AUD',
      latest,
      previous,
      change,
      change_pct: change != null && previous.price ? (change / previous.price) * 100 : null,
      history,
    };
  });
}

function marketSnapshot() {
  const body = {
    register: registerStats(),
    listings: listingStats(),
    demand: demandStats(),
    prices: priceStats(),
  };
  const version = crypto.createHash('sha1').update(JSON.stringify(body)).digest('hex').slice(0, 12);
  return { generated_at: new Date().toISOString(), version, ...body };
}

const PRICE_HEADERS = ['instrument', 'price', 'price_date'];

/** Validate and upsert price rows. Returns { saved, errors }. */
function savePrices(rows, createdVia = 'admin') {
  const errors = [];
  let saved = 0;
  const statement = db.prepare(`
    INSERT INTO market_prices (instrument, price, currency, price_date, source, notes, created_via)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(instrument, price_date, source) DO UPDATE SET price = excluded.price, notes = excluded.notes
  `);
  db.exec('BEGIN');
  try {
    rows.forEach((row, index) => {
      const instrument = String(row.instrument || '').trim();
      const price = Number(row.price);
      const date = String(row.price_date || row.date || '').trim() || new Date().toISOString().slice(0, 10);
      if (!instrument) return errors.push({ row: index + 1, error: 'instrument is required.' });
      if (!Number.isFinite(price) || price < 0) return errors.push({ row: index + 1, error: 'price must be a non-negative number.' });
      if (!/^\d{4}-\d{2}-\d{2}/.test(date)) return errors.push({ row: index + 1, error: 'price_date must be YYYY-MM-DD.' });
      statement.run(instrument.slice(0, 80), price, String(row.currency || 'AUD').toUpperCase().slice(0, 3), date.slice(0, 10), row.source ? String(row.source).slice(0, 120) : 'manual', row.notes ? String(row.notes).slice(0, 500) : null, createdVia);
      saved += 1;
      return null;
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return { saved, errors };
}

module.exports = { marketSnapshot, priceStats, savePrices, PRICE_HEADERS };
