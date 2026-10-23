const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const schemaPath = path.join(__dirname, '../Database/schema.sql');
const featuresPath = path.join(__dirname, '../Database/features.sql');
const db = new DatabaseSync(':memory:');
db.exec(fs.readFileSync(schemaPath, 'utf8'));
db.exec(fs.readFileSync(featuresPath, 'utf8'));
// features.sql must be safe to run repeatedly.
db.exec(fs.readFileSync(featuresPath, 'utf8'));

const core = [
  'user_buyer', 'user_seller', 'user_admin', 'projects',
  'project_details', 'project_unit_totals', 'project_unit_issuances', 'project_links',
  'project_locations', 'project_claims', 'project_claim_documents',
  'project_listings', 'project_images', 'accu_evidence',
  'listing_availability', 'verification_audit_log', 'project_contact_requests',
];
const features = [
  'import_runs', 'project_source_hashes', 'api_keys', 'integration_settings',
  'market_prices', 'emissions_records', 'offset_retirements',
  'buyer_introductions', 'buyer_introduction_matches',
  'report_schedules', 'generated_reports', 'site_enquiries',
];

const tables = new Set(
  db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name)
);
for (const table of [...core, ...features]) assert.ok(tables.has(table), `missing table: ${table}`);
assert.equal(core.length, 17);
console.log(`Database/schema.sql OK (${core.length} core tables) + features.sql OK (${features.length} feature tables, idempotent)`);
