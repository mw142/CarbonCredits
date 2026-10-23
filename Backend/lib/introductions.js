const { db } = require('../db');
const { marketChanged } = require('./events');

/**
 * Introduce a buyer (via their introduction brief) to a published listing. This records the
 * match and opens a normal buyer enquiry so the seller sees it in their workspace.
 * Purchases, payments and ACCU transfers still happen outside the platform.
 */
function introduce(brief, listingId, introducedBy = 'buyer', note = null) {
  if (!Number.isInteger(listingId) || listingId <= 0) throw Object.assign(new Error('listing_id is required.'), { status: 400 });
  if (['closed', 'withdrawn'].includes(brief.status)) throw Object.assign(new Error('This introduction request is closed.'), { status: 409 });
  const listing = db.prepare(`
    SELECT l.id, COALESCE(l.listing_title, p.name) AS title FROM project_listings l JOIN projects p ON p.id = l.project_id
    WHERE l.id = ? AND l.listing_status = 'published' AND l.contact_available = 1
  `).get(listingId);
  if (!listing) throw Object.assign(new Error('Published contact-enabled listing not found.'), { status: 404 });
  const already = db.prepare('SELECT id FROM buyer_introduction_matches WHERE introduction_id = ? AND listing_id = ?').get(brief.id, listingId);
  if (already) throw Object.assign(new Error('An introduction to this listing has already been made.'), { status: 409 });

  const lines = [
    introducedBy === 'admin' ? 'Introduction arranged by renewCo.' : 'Introduction requested through renewCo. buyer matching.',
    brief.purpose ? `Purpose: ${brief.purpose}` : null,
    brief.timeframe ? `Timeframe: ${brief.timeframe}` : null,
    brief.max_price != null ? `Indicative budget: up to A$${Number(brief.max_price).toFixed(2)} per ACCU` : null,
    brief.message || null,
    note || null,
  ].filter(Boolean);

  db.exec('BEGIN');
  try {
    const request = db.prepare(`
      INSERT INTO project_contact_requests (buyer_id, listing_id, requested_quantity, preferred_vintage, preferred_category, message)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(brief.buyer_id, listingId, brief.requested_quantity || null, brief.preferred_vintage || null, brief.preferred_category || null, lines.join('\n'));
    const requestId = Number(request.lastInsertRowid);
    db.prepare(`
      INSERT INTO buyer_introduction_matches (introduction_id, listing_id, introduced_by, contact_request_id) VALUES (?, ?, ?, ?)
    `).run(brief.id, listingId, introducedBy, requestId);
    db.prepare("UPDATE buyer_introductions SET status = 'introduced', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(brief.id);
    db.exec('COMMIT');
    marketChanged('introduction');
    return { ok: true, contact_request_id: requestId, listing_id: listingId, listing_title: listing.title };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

module.exports = { introduce };
