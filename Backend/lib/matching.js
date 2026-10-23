const { db } = require('../db');

function parseList(value) {
  try {
    const list = JSON.parse(value || '[]');
    return Array.isArray(list) ? list.map((v) => String(v).toLowerCase()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/**
 * Rank published listings with live availability against a buyer's brief.
 * Scores out of 100: project type 25, state 20, price 25, quantity 20, vintage/category 10.
 */
function matchListings(brief, limit = 8) {
  const candidates = db.prepare(`
    SELECT l.id AS listing_id, p.id AS project_id, p.project_reference, p.name AS project_name, p.project_type,
           COALESCE(l.listing_title, p.name) AS listing_title,
           (SELECT state_or_territory FROM project_locations pl WHERE pl.project_id = p.id ORDER BY pl.location_source = 'admin' DESC LIMIT 1) AS state,
           s.organisation_name AS seller_organisation, s.name AS seller_name,
           a.quantity_available, a.indicative_price, a.vintage, a.category, a.seller_confirmed_at,
           EXISTS (SELECT 1 FROM accu_evidence e WHERE e.listing_id = l.id AND e.review_status = 'verified') AS evidence_verified
    FROM project_listings l
    JOIN project_claims c ON c.id = l.claim_id
    JOIN user_seller s ON s.id = c.seller_id
    JOIN projects p ON p.id = l.project_id
    JOIN listing_availability a ON a.id = (
      SELECT id FROM listing_availability
      WHERE listing_id = l.id AND status = 'active' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      ORDER BY created_at DESC LIMIT 1
    )
    WHERE l.listing_status = 'published' AND l.contact_available = 1
  `).all();

  const types = parseList(brief.project_types);
  const states = parseList(brief.states);

  return candidates.map((c) => {
    let score = 0;
    const reasons = [];
    const type = String(c.project_type || '').toLowerCase();
    if (!types.length) score += 15;
    else if (types.some((t) => type.includes(t) || t.includes(type))) { score += 25; reasons.push('Project type matches'); }

    const state = String(c.state || '').toLowerCase();
    if (!states.length) score += 12;
    else if (states.some((st) => state.includes(st))) { score += 20; reasons.push('Location matches'); }

    if (brief.max_price == null) score += 15;
    else if (c.indicative_price != null && c.indicative_price <= brief.max_price) { score += 25; reasons.push('Within budget'); }
    else if (c.indicative_price != null && c.indicative_price <= brief.max_price * 1.1) { score += 10; reasons.push('Within 10% of budget'); }

    if (!brief.requested_quantity) score += 12;
    else if (c.quantity_available >= brief.requested_quantity) { score += 20; reasons.push('Covers full quantity'); }
    else if (c.quantity_available > 0) { score += Math.round(20 * (c.quantity_available / brief.requested_quantity)); reasons.push('Partial quantity'); }

    if (brief.preferred_category && c.category === brief.preferred_category) { score += 5; reasons.push(`${c.category}`); }
    else if (!brief.preferred_category) score += 3;
    if (brief.preferred_vintage && String(c.vintage || '') === String(brief.preferred_vintage)) { score += 5; reasons.push(`Vintage ${c.vintage}`); }
    else if (!brief.preferred_vintage) score += 2;

    if (c.evidence_verified) reasons.push('ACCU evidence verified');
    return { ...c, evidence_verified: Boolean(c.evidence_verified), score: Math.min(100, score), reasons };
  })
    .sort((a, b) => b.score - a.score || (a.indicative_price ?? 1e9) - (b.indicative_price ?? 1e9))
    .slice(0, limit);
}

module.exports = { matchListings, parseList };
