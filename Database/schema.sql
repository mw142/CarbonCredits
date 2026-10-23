PRAGMA foreign_keys = ON;
/*
Mike W - CarbonCredit Project CSIT321

DATABASE WORKFLOW OVERVIEW:
Administrators upload project CSV files into project tables.
Users discover carbon projects and verified sellers can claim projects,
create listings, upload evidence, and provide additional project information.
The database separates administrator-uploaded project data, seller data, and platform verification data to avoid fraudulent listings

Main database workflow:
- projects: stores project information loaded from administrator CSV files.
- project_locations: stores project mapping information, coordinates, and location accuracy.
- user_buyer, user_seller and user_admin: store different user roles.
- project_claims: manages seller requests to represent a project.
- project_claim_documents: stores private evidence submitted for verification.
- verification_audit_log: records administrator verification actions.
- project_listings: stores seller-created project listings linked to approved projects.
- project_images: stores seller-uploaded project images and media.
- accu_evidence: stores uploaded ACCU certificates and supporting evidence for review.
- listing_availability: stores seller-provided ACCU availability, vintage, and category details.
- project_contact_requests: allows buyers to contact verified sellers.
*/


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
-- PROJECTS AND ADMIN CSV DATA
-- ============================================================

-- Project data loaded by administrators. Seller data lives in project_listings.
CREATE TABLE projects (
    id INTEGER PRIMARY KEY,
    project_reference TEXT NOT NULL UNIQUE,
    project_type TEXT,
    name TEXT NOT NULL,
    project_proponent TEXT,
    description TEXT,
    methodology TEXT,
    project_status TEXT,
    project_registered_at TEXT,
    crediting_period_start TEXT,
    crediting_period_end TEXT,
    total_accus_issued INTEGER NOT NULL DEFAULT 0 CHECK (total_accus_issued >= 0),
    total_accus_relinquished INTEGER NOT NULL DEFAULT 0
        CHECK (total_accus_relinquished >= 0),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (total_accus_relinquished <= total_accus_issued)
);

-- CSV fields that are not needed in the core project search row.
CREATE TABLE project_details (
    project_id INTEGER PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    agent TEXT,
    significantly_involved_persons TEXT,
    method_url TEXT,
    method_type TEXT,
    estimation_approach TEXT,
    project_activities TEXT,
    project_suppressors TEXT,
    location_postcode TEXT,
    project_area TEXT,
    supplementary_information TEXT,
    model_start_dates TEXT,
    regional_plan_consistency TEXT,
    joint_implementation TEXT,
    carbon_maintenance_obligation TEXT,
    regulatory_approvals_condition TEXT,
    relevant_interest_holders_consent TEXT,
    nominated_permanence_period TEXT,
    permanence_start_date TEXT,
    permanence_end_date TEXT,
    contracted_on TEXT,
    contract_id TEXT,
    kaccu_recipient_name TEXT,
    nkaccu_recipient_name TEXT,
    enforceable_undertakings TEXT,
    notes TEXT,
    project_revoked INTEGER NOT NULL DEFAULT 0 CHECK (project_revoked IN (0, 1)),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Unit totals are kept by category instead of being collapsed into one number.
CREATE TABLE project_unit_totals (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    unit_type TEXT NOT NULL CHECK (unit_type IN ('ACCU', 'KACCU', 'NKACCU')),
    total_units_issued INTEGER NOT NULL DEFAULT 0 CHECK (total_units_issued >= 0),
    total_units_relinquished INTEGER NOT NULL DEFAULT 0 CHECK (total_units_relinquished >= 0),
    recipient_name TEXT,
    UNIQUE (project_id, unit_type)
);

-- Financial-year columns from the CSV become rows, so new years need no schema change.
CREATE TABLE project_unit_issuances (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    unit_type TEXT NOT NULL CHECK (unit_type IN ('KACCU', 'NKACCU')),
    financial_year TEXT NOT NULL,
    units_issued INTEGER NOT NULL DEFAULT 0 CHECK (units_issued >= 0),
    UNIQUE (project_id, unit_type, financial_year)
);

-- URLs are separate because a project can have several project documents.
CREATE TABLE project_links (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    link_type TEXT NOT NULL CHECK (link_type IN ('method', 'project_mapping', 'carbon_estimation_area_mapping', 'enforceable_undertaking')),
    url TEXT NOT NULL,
    UNIQUE (project_id, link_type, url)
);

-- Current project locations with source and accuracy recorded explicitly.
CREATE TABLE project_locations (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    location_name TEXT,
    state_or_territory TEXT,
    region TEXT,
    latitude REAL CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    longitude REAL CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
    precision_level TEXT NOT NULL DEFAULT 'state'
        CHECK (precision_level IN ('state', 'region', 'approximate', 'exact')),
    geometry_geojson TEXT
        CHECK (geometry_geojson IS NULL OR json_valid(geometry_geojson)),
    location_source TEXT NOT NULL
        CHECK (location_source IN ('seller', 'geocoded', 'admin')),
    seller_permission_to_display INTEGER NOT NULL DEFAULT 0
        CHECK (seller_permission_to_display IN (0, 1)),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- PROJECT CLAIMS AND LISTINGS
-- ============================================================

-- A seller's request to represent a project.
CREATE TABLE project_claims (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    seller_id INTEGER NOT NULL REFERENCES user_seller(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL
        CHECK (relationship_type IN ('owner', 'proponent', 'authorised_representative', 'project_manager', 'contributor')),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'additional_information_required', 'approved', 'rejected', 'revoked', 'expired')),
    submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verified_at TEXT,
    expires_at TEXT,
    reviewed_by_admin_id INTEGER REFERENCES user_admin(id) ON DELETE RESTRICT,
    reviewed_at TEXT,
    review_notes TEXT,
    rejection_reason TEXT,
    UNIQUE (id, project_id)
);

-- Private evidence supporting a project claim; never public by default.
CREATE TABLE project_claim_documents (
    id INTEGER PRIMARY KEY,
    claim_id INTEGER NOT NULL REFERENCES project_claims(id) ON DELETE CASCADE,
    uploaded_by_seller_id INTEGER NOT NULL REFERENCES user_seller(id) ON DELETE RESTRICT,
    document_type TEXT NOT NULL
        CHECK (document_type IN ('ownership_evidence', 'authority_document', 'project_agreement', 'registry_export', 'other')),
    original_file_name TEXT NOT NULL,
    storage_key TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL,
    file_size_bytes INTEGER CHECK (file_size_bytes IS NULL OR file_size_bytes > 0),
    review_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (review_status IN ('pending', 'under_review', 'verified', 'rejected', 'expired')),
    reviewed_by_admin_id INTEGER REFERENCES user_admin(id) ON DELETE RESTRICT,
    reviewed_at TEXT,
    review_notes TEXT,
    uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seller presentation of an official project after claim approval.
CREATE TABLE project_listings (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    claim_id INTEGER NOT NULL UNIQUE,
    listing_title TEXT,
    seller_description TEXT,
    contact_available INTEGER NOT NULL DEFAULT 1
        CHECK (contact_available IN (0, 1)),
    listing_status TEXT NOT NULL DEFAULT 'draft'
        CHECK (listing_status IN ('draft', 'published', 'paused', 'archived')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (claim_id, project_id)
        REFERENCES project_claims(id, project_id) ON DELETE RESTRICT
);

-- Images uploaded by the verified project representative.
CREATE TABLE project_images (
    id INTEGER PRIMARY KEY,
    listing_id INTEGER NOT NULL REFERENCES project_listings(id) ON DELETE CASCADE,
    uploaded_by_seller_id INTEGER NOT NULL REFERENCES user_seller(id) ON DELETE RESTRICT,
    original_file_name TEXT NOT NULL,
    storage_key TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL,
    file_size_bytes INTEGER CHECK (file_size_bytes IS NULL OR file_size_bytes > 0),
    alt_text TEXT,
    caption TEXT,
    display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
    is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
    review_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (review_status IN ('pending', 'approved', 'rejected')),
    uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Private ACCU certificates and evidence uploaded by sellers.
CREATE TABLE accu_evidence (
    id INTEGER PRIMARY KEY,
    listing_id INTEGER NOT NULL REFERENCES project_listings(id) ON DELETE CASCADE,
    uploaded_by_seller_id INTEGER NOT NULL REFERENCES user_seller(id) ON DELETE RESTRICT,
    document_type TEXT NOT NULL
        CHECK (document_type IN ('accu_certificate', 'holdings_export', 'registry_statement', 'account_evidence', 'other')),
    original_file_name TEXT NOT NULL,
    storage_key TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL,
    file_size_bytes INTEGER CHECK (file_size_bytes IS NULL OR file_size_bytes > 0),
    vintage TEXT,
    category TEXT CHECK (category IS NULL OR category IN ('KACCU', 'NKACCU')),
    verified_quantity INTEGER CHECK (verified_quantity IS NULL OR verified_quantity >= 0),
    masked_reference TEXT,
    review_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (review_status IN ('pending', 'under_review', 'verified', 'rejected', 'expired')),
    reviewed_by_admin_id INTEGER REFERENCES user_admin(id) ON DELETE RESTRICT,
    reviewed_at TEXT,
    verified_at TEXT,
    expires_at TEXT,
    review_notes TEXT,
    uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seller availability it expires unless reconfirmed.
CREATE TABLE listing_availability (
    id INTEGER PRIMARY KEY,
    listing_id INTEGER NOT NULL REFERENCES project_listings(id) ON DELETE CASCADE,
    evidence_id INTEGER REFERENCES accu_evidence(id) ON DELETE SET NULL,
    quantity_available INTEGER NOT NULL CHECK (quantity_available >= 0),
    vintage TEXT,
    category TEXT CHECK (category IS NULL OR category IN ('KACCU', 'NKACCU')),
    indicative_price REAL CHECK (indicative_price IS NULL OR indicative_price >= 0),
    seller_confirmed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'expired', 'withdrawn', 'sold_elsewhere', 'pending_verification')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Only one open claim can exist for a project at a time.
CREATE UNIQUE INDEX one_open_project_claim
    ON project_claims(project_id)
    WHERE status IN ('pending', 'additional_information_required', 'approved');

-- Archived listings remain as history; only one listing can be active at a time.
CREATE UNIQUE INDEX one_active_project_listing
    ON project_listings(project_id)
    WHERE listing_status IN ('draft', 'published', 'paused');

-- ============================================================
-- VERIFICATIONS
-- ============================================================

-- Permanent admin history for claims, evidence and listing moderation.
CREATE TABLE verification_audit_log (
    id INTEGER PRIMARY KEY,
    subject_type TEXT NOT NULL
        CHECK (subject_type IN ('project_claim', 'project_claim_document', 'project_listing', 'project_image', 'accu_evidence')),
    subject_id INTEGER NOT NULL,
    admin_user_id INTEGER NOT NULL REFERENCES user_admin(id) ON DELETE RESTRICT,
    action TEXT NOT NULL
        CHECK (action IN ('submitted', 'review_started', 'verified', 'rejected', 'needs_changes', 'verification_revoked', 'expired', 'published', 'paused')),
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
    listing_id INTEGER NOT NULL REFERENCES project_listings(id) ON DELETE CASCADE,
    requested_quantity INTEGER CHECK (requested_quantity IS NULL OR requested_quantity > 0),
    preferred_vintage TEXT,
    preferred_category TEXT CHECK (preferred_category IS NULL OR preferred_category IN ('KACCU', 'NKACCU')),
    message TEXT,
    status TEXT NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'viewed', 'responded', 'closed', 'withdrawn')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
