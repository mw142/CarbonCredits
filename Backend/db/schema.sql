-- Carbon Credit Marketplace — prototype schema (SQLite)
-- Adapted from /Database/schema.sql and /Database/old_schema.sql in the
-- CarbonCredits repo, simplified so a small local prototype can run end to
-- end (auth, listings, verification, purchases) without extra services.

PRAGMA foreign_keys = ON;

-- ============================================================
-- USERS (buyer / seller / admin share one table + role-specific extras)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL CHECK (role IN ('buyer', 'seller', 'admin')),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    phone_number TEXT,
    organisation_name TEXT,
    organisation_type TEXT,
    country TEXT NOT NULL,
    account_status TEXT NOT NULL DEFAULT 'active'
        CHECK (account_status IN ('pending', 'active', 'suspended')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Buyer-only ledger fields (emissions, offset goal, credit balance).
CREATE TABLE IF NOT EXISTS buyer_profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    total_emissions REAL NOT NULL DEFAULT 0 CHECK (total_emissions >= 0),
    annual_offset_goal REAL CHECK (annual_offset_goal IS NULL OR annual_offset_goal >= 0),
    carbon_credit_balance REAL NOT NULL DEFAULT 0 CHECK (carbon_credit_balance >= 0)
);

-- Reference list of project types, mirrors old_schema.sql.
CREATE TABLE IF NOT EXISTS project_types (
    name TEXT PRIMARY KEY
);

-- ============================================================
-- PROJECTS / LISTINGS
-- A "project" is both the seller's submission and its marketplace listing
-- in this simplified prototype (the full repo schema splits CER project,
-- claim and listing into separate tables — kept as one for the demo).
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    project_type TEXT NOT NULL REFERENCES project_types(name),
    image_url TEXT,
    description TEXT,
    methodology TEXT,
    estimated_emission_reductions REAL CHECK (estimated_emission_reductions IS NULL OR estimated_emission_reductions >= 0),
    accu_category TEXT CHECK (accu_category IS NULL OR accu_category IN ('KACCU', 'NKACCU')),
    vintage TEXT,
    price_per_credit REAL NOT NULL CHECK (price_per_credit >= 0),
    total_credits REAL NOT NULL DEFAULT 0 CHECK (total_credits >= 0),
    available_credits REAL NOT NULL DEFAULT 0 CHECK (available_credits >= 0),
    review_status TEXT NOT NULL DEFAULT 'waiting_review'
        CHECK (review_status IN ('waiting_review', 'approved', 'rejected', 'needs_changes')),
    is_verified INTEGER NOT NULL DEFAULT 0 CHECK (is_verified IN (0, 1)),
    is_listed INTEGER NOT NULL DEFAULT 0 CHECK (is_listed IN (0, 1)),
    review_notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Supporting evidence filenames attached to a submission (prototype stores
-- the filename only — no real file storage/upload pipeline).
CREATE TABLE IF NOT EXISTS project_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    uploaded_by_user_id INTEGER NOT NULL REFERENCES users(id),
    document_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Full audit trail of verification decisions, per the report's
-- "auditability" requirement for the admin/verifier dashboard.
CREATE TABLE IF NOT EXISTS verification_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    verifier_user_id INTEGER NOT NULL REFERENCES users(id),
    action TEXT NOT NULL
        CHECK (action IN ('submitted', 'approved', 'rejected', 'needs_changes', 'listed', 'unlisted')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Simulated purchases — no real payment processing happens here, this only
-- records the ledger entry so dashboards have something to show.
CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    credits_purchased REAL NOT NULL CHECK (credits_purchased > 0),
    price_per_credit REAL NOT NULL,
    total_price REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Buyer "save for later" list, shown on the buyer dashboard.
CREATE TABLE IF NOT EXISTS saved_projects (
    buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (buyer_id, project_id)
);
