const { db } = require('../db');

/**
 * Indicative activity-based emission factors (kg CO2-e per unit), based on the Australian
 * National Greenhouse Accounts (NGA) Factors. They are starting points only: users can edit
 * the factor on every entry, and should check the current NGA Factors workbook each year.
 */
const FACTOR_PRESETS = [
  { id: 'elec_nsw', scope: 2, category: 'Purchased electricity — NSW & ACT', unit: 'kWh', factor: 0.66 },
  { id: 'elec_vic', scope: 2, category: 'Purchased electricity — VIC', unit: 'kWh', factor: 0.77 },
  { id: 'elec_qld', scope: 2, category: 'Purchased electricity — QLD', unit: 'kWh', factor: 0.71 },
  { id: 'elec_sa', scope: 2, category: 'Purchased electricity — SA', unit: 'kWh', factor: 0.23 },
  { id: 'elec_wa', scope: 2, category: 'Purchased electricity — WA (SWIS)', unit: 'kWh', factor: 0.50 },
  { id: 'elec_tas', scope: 2, category: 'Purchased electricity — TAS', unit: 'kWh', factor: 0.17 },
  { id: 'elec_nt', scope: 2, category: 'Purchased electricity — NT', unit: 'kWh', factor: 0.54 },
  { id: 'natural_gas', scope: 1, category: 'Natural gas (stationary)', unit: 'GJ', factor: 51.53 },
  { id: 'diesel_stationary', scope: 1, category: 'Diesel (stationary)', unit: 'L', factor: 2.71 },
  { id: 'diesel_transport', scope: 1, category: 'Diesel (vehicles)', unit: 'L', factor: 2.72 },
  { id: 'petrol_transport', scope: 1, category: 'Petrol (vehicles)', unit: 'L', factor: 2.31 },
  { id: 'lpg', scope: 1, category: 'LPG (stationary)', unit: 'L', factor: 1.56 },
  { id: 'custom', scope: 3, category: 'Other / supplier-reported', unit: 't CO2-e', factor: 1000 },
];

function round(value, digits = 3) {
  return value == null ? null : Math.round(value * 10 ** digits) / 10 ** digits;
}

/** Emissions & offsets for a buyer, optionally limited to one calendar year. */
function emissionsSummary(buyerId, year = null) {
  const where = year ? 'AND period_year = ?' : '';
  const params = year ? [buyerId, Number(year)] : [buyerId];

  const byYear = db.prepare(`
    SELECT period_year AS year,
           SUM(CASE WHEN scope = 1 THEN tco2e ELSE 0 END) AS scope1,
           SUM(CASE WHEN scope = 2 THEN tco2e ELSE 0 END) AS scope2,
           SUM(CASE WHEN scope = 3 THEN tco2e ELSE 0 END) AS scope3,
           SUM(tco2e) AS total
    FROM emissions_records WHERE buyer_id = ? ${where}
    GROUP BY period_year ORDER BY period_year
  `).all(...params);
  const byScope = db.prepare(`
    SELECT scope, SUM(tco2e) AS tco2e, COUNT(*) AS entries
    FROM emissions_records WHERE buyer_id = ? ${where} GROUP BY scope ORDER BY scope
  `).all(...params);
  const byCategory = db.prepare(`
    SELECT category, scope, SUM(tco2e) AS tco2e, COUNT(*) AS entries
    FROM emissions_records WHERE buyer_id = ? ${where} GROUP BY category, scope ORDER BY tco2e DESC
  `).all(...params);
  const byMonth = year ? db.prepare(`
    SELECT period_month AS month, SUM(tco2e) AS tco2e
    FROM emissions_records WHERE buyer_id = ? AND period_year = ? AND period_month IS NOT NULL
    GROUP BY period_month ORDER BY period_month
  `).all(buyerId, Number(year)) : [];

  const offsetWhere = year ? "AND strftime('%Y', retired_on) = ?" : '';
  const offsetParams = year ? [buyerId, String(year)] : [buyerId];
  const offsetsByYear = db.prepare(`
    SELECT CAST(strftime('%Y', retired_on) AS INTEGER) AS year, SUM(quantity) AS quantity
    FROM offset_retirements WHERE buyer_id = ? ${offsetWhere} GROUP BY year ORDER BY year
  `).all(...offsetParams);

  const profile = db.prepare('SELECT annual_offset_goal FROM user_buyer WHERE id = ?').get(buyerId) || {};
  const total = byYear.reduce((sum, row) => sum + (row.total || 0), 0);
  const offsets = offsetsByYear.reduce((sum, row) => sum + (row.quantity || 0), 0);
  const years = [...new Set([...byYear.map((r) => r.year), ...offsetsByYear.map((r) => r.year)])].sort();

  return {
    year: year ? Number(year) : null,
    total_tco2e: round(total),
    offsets_retired: offsets,
    // 1 ACCU = 1 tonne CO2-e abated or stored.
    net_tco2e: round(total - offsets),
    annual_offset_goal: profile.annual_offset_goal ?? null,
    goal_progress_pct: profile.annual_offset_goal ? round((offsets / profile.annual_offset_goal) * 100, 1) : null,
    by_year: years.map((y) => {
      const e = byYear.find((r) => r.year === y) || {};
      const o = offsetsByYear.find((r) => r.year === y) || {};
      return {
        year: y,
        scope1: round(e.scope1 || 0), scope2: round(e.scope2 || 0), scope3: round(e.scope3 || 0),
        total: round(e.total || 0), offsets: o.quantity || 0, net: round((e.total || 0) - (o.quantity || 0)),
      };
    }),
    by_scope: byScope.map((row) => ({ ...row, tco2e: round(row.tco2e) })),
    by_category: byCategory.map((row) => ({ ...row, tco2e: round(row.tco2e) })),
    by_month: byMonth.map((row) => ({ ...row, tco2e: round(row.tco2e) })),
  };
}

module.exports = { FACTOR_PRESETS, emissionsSummary, round };
