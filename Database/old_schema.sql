PRAGMA foreign_keys = ON;

CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('buyer', 'seller', 'admin')),
    name TEXT NOT NULL,
    phone_number TEXT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    annual_offset_goal REAL,
    organisation_name TEXT,
    country TEXT NOT NULL,
    two_factor_enabled INTEGER NOT NULL DEFAULT 0
        CHECK (two_factor_enabled IN (0, 1)),
    two_factor_provider TEXT
        CHECK (two_factor_provider IS NULL OR two_factor_provider IN ('authenticator_app', 'sms', 'email')),
    account_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (account_status IN ('active', 'suspended', 'pending')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE buyer_profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    organisation_type TEXT NOT NULL
        CHECK (organisation_type IN ('investor', 'business', 'non-profit', 'government')),
    total_emissions REAL NOT NULL DEFAULT 0 CHECK (total_emissions >= 0),
    carbon_credit_balance REAL NOT NULL DEFAULT 0 CHECK (carbon_credit_balance >= 0)
);

CREATE TABLE seller_profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    organisation_type TEXT NOT NULL
        CHECK (organisation_type IN ('project developer', 'land owner', 'co-operative', 'business'))
);

CREATE TABLE project_types (
    name TEXT PRIMARY KEY
);

INSERT INTO project_types (name) VALUES
    ('solar'),
    ('wind'),
    ('reforestation'),
    ('soil carbon'),
    ('methane capture'),
    ('blue carbon'),
    ('hydro'),
    ('geothermal');

CREATE TABLE buyer_interests (
    buyer_id INTEGER NOT NULL REFERENCES buyer_profiles(user_id) ON DELETE CASCADE,
    project_type TEXT NOT NULL REFERENCES project_types(name),
    PRIMARY KEY (buyer_id, project_type)
);

CREATE TABLE projects (
    id INTEGER PRIMARY KEY,
    seller_id INTEGER NOT NULL REFERENCES seller_profiles(user_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    image_url TEXT,
    price_per_credit REAL NOT NULL CHECK (price_per_credit >= 0),
    available_credits REAL NOT NULL DEFAULT 0 CHECK (available_credits >= 0),
    review_status TEXT NOT NULL DEFAULT 'waiting_review'
        CHECK (review_status IN ('waiting_review', 'approved', 'rejected')),
    is_verified INTEGER NOT NULL DEFAULT 0 CHECK (is_verified IN (0, 1)),
    is_listed INTEGER NOT NULL DEFAULT 0 CHECK (is_listed IN (0, 1)),
    description TEXT,
    estimated_emission_reductions REAL
        CHECK (estimated_emission_reductions IS NULL OR estimated_emission_reductions >= 0),
    methodology TEXT,
    project_type TEXT NOT NULL REFERENCES project_types(name),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
);

CREATE TABLE project_contributions (
    id INTEGER PRIMARY KEY,
    buyer_id INTEGER NOT NULL REFERENCES buyer_profiles(user_id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    credits_contributed REAL NOT NULL CHECK (credits_contributed > 0),
    contribution_status TEXT NOT NULL DEFAULT 'active'
        CHECK (contribution_status IN ('active', 'completed', 'cancelled')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE project_documents (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    uploaded_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    document_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    mime_type TEXT,
    review_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (review_status IN ('pending', 'accepted', 'rejected')),
    uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE project_verification_audit_log (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    verifier_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action TEXT NOT NULL
        CHECK (action IN ('submitted', 'review_started', 'approved', 'rejected', 'verification_changed', 'listed', 'unlisted')),
    decision TEXT
        CHECK (decision IS NULL OR decision IN ('approved', 'rejected', 'needs_changes')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
