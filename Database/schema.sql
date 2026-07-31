PRAGMA foreign_keys = ON;
-- ============================================================
-- USERS: Buyer, Seller, Admin
-- ============================================================

-- Buyer login, profile, emissions, offset goals and project interests.
CREATE TABLE user_buyer (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone_number TEXT,
    password_hash TEXT NOT NULL,
    organisation_name TEXT,
    country TEXT NOT NULL,
    organisation_type TEXT NOT NULL
        CHECK (organisation_type IN ('investor', 'business', 'non-profit', 'government')),
    total_emissions REAL NOT NULL DEFAULT 0 CHECK (total_emissions >= 0),
    annual_offset_goal REAL CHECK (annual_offset_goal IS NULL OR annual_offset_goal >= 0),
    project_interests TEXT NOT NULL DEFAULT '[]'
        CHECK (json_valid(project_interests) AND json_type(project_interests) = 'array'),
    two_factor_enabled INTEGER NOT NULL DEFAULT 0
        CHECK (two_factor_enabled IN (0, 1)),
    two_factor_provider TEXT
        CHECK (two_factor_provider IS NULL OR two_factor_provider IN ('authenticator_app', 'sms', 'email')),
    account_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (account_status IN ('pending', 'active', 'suspended')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (two_factor_enabled = 0 OR two_factor_provider IS NOT NULL)
);

-- Seller login, profile and organisation details.
CREATE TABLE user_seller (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone_number TEXT,
    password_hash TEXT NOT NULL,
    organisation_name TEXT,
    country TEXT NOT NULL,
    organisation_type TEXT NOT NULL
        CHECK (organisation_type IN ('project developer', 'land owner', 'co-operative', 'business')),
    two_factor_enabled INTEGER NOT NULL DEFAULT 0
        CHECK (two_factor_enabled IN (0, 1)),
    two_factor_provider TEXT
        CHECK (two_factor_provider IS NULL OR two_factor_provider IN ('authenticator_app', 'sms', 'email')),
    account_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (account_status IN ('pending', 'active', 'suspended')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (two_factor_enabled = 0 OR two_factor_provider IS NOT NULL)
);

-- Admin login and account security details.
CREATE TABLE user_admin (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone_number TEXT,
    password_hash TEXT NOT NULL,
    two_factor_enabled INTEGER NOT NULL DEFAULT 0
        CHECK (two_factor_enabled IN (0, 1)),
    two_factor_provider TEXT
        CHECK (two_factor_provider IS NULL OR two_factor_provider IN ('authenticator_app', 'sms', 'email')),
    account_status TEXT NOT NULL DEFAULT 'active'
        CHECK (account_status IN ('active', 'suspended')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (two_factor_enabled = 0 OR two_factor_provider IS NOT NULL)
);

-- ============================================================
-- PROJECTS: Project images, Project Documents
-- ============================================================

-- Seller project listings sourced from the CER ACCU Scheme project register.
CREATE TABLE projects (
    id INTEGER PRIMARY KEY,
    seller_id INTEGER NOT NULL REFERENCES user_seller(id) ON DELETE CASCADE,
    cer_project_id TEXT NOT NULL UNIQUE,
    project_type TEXT NOT NULL,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    description TEXT,
    methodology TEXT,
    cer_project_url TEXT NOT NULL CHECK (cer_project_url LIKE 'https://cer.gov.au/%'),
    method_url TEXT CHECK (method_url IS NULL OR method_url LIKE 'https://cer.gov.au/%'),
    project_registered_at TEXT,
    crediting_period_start TEXT,
    crediting_period_end TEXT,
    project_area_url TEXT CHECK (project_area_url IS NULL OR project_area_url LIKE 'https://cer.gov.au/%'),
    carbon_estimation_area_url TEXT
        CHECK (carbon_estimation_area_url IS NULL OR carbon_estimation_area_url LIKE 'https://cer.gov.au/%'),
    total_accus_issued INTEGER NOT NULL DEFAULT 0 CHECK (total_accus_issued >= 0),
    total_accus_relinquished INTEGER NOT NULL DEFAULT 0
        CHECK (total_accus_relinquished >= 0),
    project_revoked INTEGER NOT NULL DEFAULT 0 CHECK (project_revoked IN (0, 1)),
    verification_status TEXT NOT NULL DEFAULT 'draft'
        CHECK (verification_status IN ('draft', 'submitted', 'in_review', 'needs_changes', 'verified', 'rejected')),
    is_listed INTEGER NOT NULL DEFAULT 0 CHECK (is_listed IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (total_accus_relinquished <= total_accus_issued)
);

-- Images displayed on project pages; files are stored by the backend.
CREATE TABLE project_images (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    uploaded_by_seller_id INTEGER NOT NULL REFERENCES user_seller(id) ON DELETE RESTRICT,
    original_file_name TEXT NOT NULL,
    storage_key TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL,
    alt_text TEXT,
    display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
    is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
    uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Evidence files supporting a project and their admin review state.
CREATE TABLE project_documents (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    uploaded_by_seller_id INTEGER NOT NULL REFERENCES user_seller(id) ON DELETE RESTRICT,
    document_type TEXT NOT NULL
        CHECK (document_type IN ('methodology', 'validation_report', 'verification_report', 'monitoring_report', 'registry_document', 'other')),
    original_file_name TEXT NOT NULL,
    storage_key TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL,
    file_size_bytes INTEGER CHECK (file_size_bytes IS NULL OR file_size_bytes > 0),
    verification_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (verification_status IN ('pending', 'in_review', 'needs_changes', 'verified', 'rejected')),
    uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- CER REGISTRY: ANREU Accounts, ACCU Certificates
-- ============================================================

-- References to CER-managed ANREU holding accounts.
CREATE TABLE anreu_accounts (
    id INTEGER PRIMARY KEY,
    buyer_id INTEGER REFERENCES user_buyer(id) ON DELETE CASCADE,
    seller_id INTEGER REFERENCES user_seller(id) ON DELETE CASCADE,
    account_holder_name TEXT NOT NULL,
    holding_account_reference TEXT NOT NULL UNIQUE,
    account_status TEXT NOT NULL DEFAULT 'active'
        CHECK (account_status IN ('active', 'closed')),
    cer_source_url TEXT NOT NULL CHECK (cer_source_url LIKE 'https://cer.gov.au/%'),
    cer_checked_at TEXT NOT NULL,
    CHECK ((buyer_id IS NOT NULL) + (seller_id IS NOT NULL) = 1)
);

-- CER-issued ACCU blocks and their issuance-time registry attributes.
CREATE TABLE accu_certificates (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    anreu_account_id INTEGER REFERENCES anreu_accounts(id) ON DELETE SET NULL,
    vintage TEXT NOT NULL,
    issuance_date TEXT NOT NULL,
    serial_number_from INTEGER NOT NULL,
    serial_number_to INTEGER NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('KACCU', 'NKACCU')),
    cer_source_url TEXT NOT NULL CHECK (cer_source_url LIKE 'https://cer.gov.au/%'),
    synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (serial_number_from, serial_number_to),
    CHECK (serial_number_from > 0),
    CHECK (serial_number_to >= serial_number_from)
);

-- ============================================================
-- VERIFICATIONS
-- ============================================================

-- Permanent admin history for project and project document reviews.
CREATE TABLE verification_audit_log (
    id INTEGER PRIMARY KEY,
    subject_type TEXT NOT NULL
        CHECK (subject_type IN ('project', 'project_document')),
    subject_id INTEGER NOT NULL,
    admin_user_id INTEGER NOT NULL REFERENCES user_admin(id) ON DELETE RESTRICT,
    action TEXT NOT NULL
        CHECK (action IN ('submitted', 'review_started', 'verified', 'rejected', 'needs_changes', 'verification_revoked')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- CONNECTIONS: Buyer and Seller Contact Requests
-- ============================================================

-- Records introductions only; purchases, payments and ACCU transfers remain outside this platform.
CREATE TABLE project_contact_requests (
    id INTEGER PRIMARY KEY,
    buyer_id INTEGER NOT NULL REFERENCES user_buyer(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'sent'
        CHECK (status IN ('sent', 'accepted', 'declined', 'closed')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
