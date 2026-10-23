const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'carbon_credits.db');
const SCHEMA_PATH = path.join(__dirname, '../../Database/schema.sql');
const FEATURES_PATH = path.join(__dirname, '../../Database/features.sql');
const STORAGE_DIR = process.env.STORAGE_DIR || path.join(__dirname, 'storage');
const REQUIRED_TABLES = [
  'user_buyer', 'user_seller', 'user_admin', 'projects',
  'project_details', 'project_unit_totals', 'project_unit_issuances', 'project_links',
  'project_locations', 'project_claims', 'project_claim_documents',
  'project_listings', 'project_images', 'accu_evidence',
  'listing_availability', 'verification_audit_log', 'project_contact_requests',
];
const FEATURE_TABLES = [
  'import_runs', 'project_source_hashes', 'api_keys', 'integration_settings',
  'market_prices', 'emissions_records', 'offset_retirements',
  'buyer_introductions', 'buyer_introduction_matches',
  'report_schedules', 'generated_reports', 'site_enquiries',
];

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
fs.mkdirSync(STORAGE_DIR, { recursive: true });

const isNewDatabase = !fs.existsSync(DB_PATH);
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

const existingTables = new Set(
  db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name)
);

if (existingTables.size === 0) {
  db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
} else if (!REQUIRED_TABLES.every((table) => existingTables.has(table))) {
  throw new Error(`Database does not use Database/schema.sql: ${DB_PATH}. Remove the local database and restart.`);
}

// Feature tables are additive and idempotent, so existing local databases upgrade in place.
db.exec(fs.readFileSync(FEATURES_PATH, 'utf8'));

module.exports = {
  db, DB_PATH, SCHEMA_PATH, FEATURES_PATH, STORAGE_DIR, isNewDatabase, REQUIRED_TABLES, FEATURE_TABLES,
};
