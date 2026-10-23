/*
renewCo. platform features (built by IrongateIT)

This file is idempotent: every statement uses IF NOT EXISTS, and Backend/db/index.js
runs it on every start-up after Database/schema.sql. Existing local databases are
upgraded in place — nothing in schema.sql is altered.

Tables:
- import_runs / project_source_hashes: CER import history and unchanged-row detection.
- api_keys / integration_settings: external API access and the scheduled CSV pull.
- market_prices: reference ACCU spot prices pushed by admins or the API.
- emissions_records / offset_retirements: buyer emissions tracking and offset position.
- buyer_introductions / buyer_introduction_matches: buyer needs briefs and introductions.
- report_schedules / generated_reports: automated reporting.
- site_enquiries: public "Contact us" form.
*/

PRAGMA foreign_keys = ON;

-- ============================================================
-- CER IMPORTS
-- ============================================================

CREATE TABLE IF NOT EXISTS import_runs (
    id INTEGER PRIMARY KEY,
    source_type TEXT NOT NULL
        CHECK (source_type IN ('admin_upload', 'api', 'url_pull', 'scheduled_pull')),
    source_name TEXT NOT NULL DEFAULT 'Clean Energy Regulator — ACCU Scheme project register',
    file_name TEXT,
    source_url TEXT,
    status TEXT NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'completed', 'completed_with_errors', 'failed')),
    records_received INTEGER NOT NULL DEFAULT 0,
    records_inserted INTEGER NOT NULL DEFAULT 0,
    records_updated INTEGER NOT NULL DEFAULT 0,
    records_unchanged INTEGER NOT NULL DEFAULT 0,
    records_failed INTEGER NOT NULL DEFAULT 0,
    error_details TEXT CHECK (error_details IS NULL OR json_valid(error_details)),
    changed_project_refs TEXT CHECK (changed_project_refs IS NULL OR json_valid(changed_project_refs)),
    triggered_by TEXT,
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT
);

-- Hash of the official CER fields for each project so unchanged rows are skipped.
CREATE TABLE IF NOT EXISTS project_source_hashes (
    project_id INTEGER PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    source_hash TEXT NOT NULL,
    last_import_run_id INTEGER REFERENCES import_runs(id) ON DELETE SET NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- INTEGRATIONS
-- ============================================================

-- Only a SHA-256 hash of each key is stored; the plain key is shown once on creation.
CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    scopes TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(scopes) AND json_type(scopes) = 'array'),
    created_by_admin_id INTEGER REFERENCES user_admin(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TEXT,
    revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS integration_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- MARKET DATA
-- ============================================================

-- Reference prices (e.g. generic ACCU spot) supplied by an admin or a data provider via the API.
CREATE TABLE IF NOT EXISTS market_prices (
    id INTEGER PRIMARY KEY,
    instrument TEXT NOT NULL,
    price REAL NOT NULL CHECK (price >= 0),
    currency TEXT NOT NULL DEFAULT 'AUD',
    price_date TEXT NOT NULL,
    source TEXT,
    notes TEXT,
    created_via TEXT NOT NULL DEFAULT 'admin' CHECK (created_via IN ('admin', 'api', 'csv')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (instrument, price_date, source)
);
CREATE INDEX IF NOT EXISTS market_prices_instrument_date ON market_prices(instrument, price_date);

-- ============================================================
-- BUYER EMISSIONS TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS emissions_records (
    id INTEGER PRIMARY KEY,
    buyer_id INTEGER NOT NULL REFERENCES user_buyer(id) ON DELETE CASCADE,
    period_year INTEGER NOT NULL CHECK (period_year BETWEEN 1990 AND 2100),
    period_month INTEGER CHECK (period_month IS NULL OR period_month BETWEEN 1 AND 12),
    scope INTEGER NOT NULL CHECK (scope IN (1, 2, 3)),
    category TEXT NOT NULL,
    activity_value REAL CHECK (activity_value IS NULL OR activity_value >= 0),
    activity_unit TEXT,
    emission_factor REAL CHECK (emission_factor IS NULL OR emission_factor >= 0),
    factor_unit TEXT,
    tco2e REAL NOT NULL CHECK (tco2e >= 0),
    facility TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS emissions_records_buyer_period ON emissions_records(buyer_id, period_year, period_month);

-- ACCUs the buyer has surrendered/retired (recorded by the buyer; transfers happen off-platform).
CREATE TABLE IF NOT EXISTS offset_retirements (
    id INTEGER PRIMARY KEY,
    buyer_id INTEGER NOT NULL REFERENCES user_buyer(id) ON DELETE CASCADE,
    retired_on TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    project_reference TEXT,
    vintage TEXT,
    category TEXT CHECK (category IS NULL OR category IN ('KACCU', 'NKACCU')),
    masked_registry_reference TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- BUYER INTRODUCTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS buyer_introductions (
    id INTEGER PRIMARY KEY,
    buyer_id INTEGER NOT NULL REFERENCES user_buyer(id) ON DELETE CASCADE,
    requested_quantity INTEGER CHECK (requested_quantity IS NULL OR requested_quantity > 0),
    max_price REAL CHECK (max_price IS NULL OR max_price >= 0),
    project_types TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(project_types)),
    states TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(states)),
    preferred_vintage TEXT,
    preferred_category TEXT CHECK (preferred_category IS NULL OR preferred_category IN ('KACCU', 'NKACCU')),
    timeframe TEXT,
    purpose TEXT,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'matching', 'introduced', 'closed', 'withdrawn')),
    admin_notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS buyer_introduction_matches (
    id INTEGER PRIMARY KEY,
    introduction_id INTEGER NOT NULL REFERENCES buyer_introductions(id) ON DELETE CASCADE,
    listing_id INTEGER NOT NULL REFERENCES project_listings(id) ON DELETE CASCADE,
    match_score INTEGER,
    introduced_by TEXT NOT NULL DEFAULT 'buyer' CHECK (introduced_by IN ('buyer', 'admin')),
    contact_request_id INTEGER REFERENCES project_contact_requests(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (introduction_id, listing_id)
);

-- ============================================================
-- AUTOMATED REPORTING
-- ============================================================

CREATE TABLE IF NOT EXISTS report_schedules (
    id INTEGER PRIMARY KEY,
    owner_role TEXT NOT NULL CHECK (owner_role IN ('buyer', 'seller', 'admin')),
    owner_id INTEGER NOT NULL,
    report_type TEXT NOT NULL,
    frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'off')),
    next_run_at TEXT,
    last_run_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (owner_role, owner_id, report_type)
);

CREATE TABLE IF NOT EXISTS generated_reports (
    id INTEGER PRIMARY KEY,
    owner_role TEXT NOT NULL CHECK (owner_role IN ('buyer', 'seller', 'admin')),
    owner_id INTEGER NOT NULL,
    report_type TEXT NOT NULL,
    title TEXT NOT NULL,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    trigger TEXT NOT NULL DEFAULT 'manual' CHECK (trigger IN ('scheduled', 'manual')),
    data_json TEXT NOT NULL CHECK (json_valid(data_json)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS generated_reports_owner ON generated_reports(owner_role, owner_id, created_at);

-- ============================================================
-- PUBLIC CONTACT FORM
-- ============================================================

CREATE TABLE IF NOT EXISTS site_enquiries (
    id INTEGER PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    company TEXT,
    location TEXT,
    interest TEXT,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'closed')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
