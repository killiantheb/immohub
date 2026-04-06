BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 0001

CREATE TYPE user_role_enum AS ENUM ('super_admin', 'agency', 'owner', 'tenant', 'opener', 'company');

CREATE TYPE property_type_enum AS ENUM ('apartment', 'villa', 'parking', 'garage', 'box', 'cave', 'depot', 'office', 'commercial', 'hotel');

CREATE TYPE property_status_enum AS ENUM ('available', 'rented', 'for_sale', 'sold', 'maintenance');

CREATE TYPE property_document_type_enum AS ENUM ('lease', 'inventory', 'insurance', 'notice', 'deed', 'diagnosis', 'other');

CREATE TYPE contract_type_enum AS ENUM ('long_term', 'seasonal', 'short_term', 'sale');

CREATE TYPE contract_status_enum AS ENUM ('draft', 'active', 'terminated', 'expired');

CREATE TYPE transaction_type_enum AS ENUM ('rent', 'commission', 'deposit', 'service', 'quote');

CREATE TYPE transaction_status_enum AS ENUM ('pending', 'paid', 'late', 'cancelled');

CREATE TYPE mission_type_enum AS ENUM ('visit', 'check_in', 'check_out', 'inspection', 'photography', 'other');

CREATE TYPE mission_status_enum AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled');

CREATE TYPE company_type_enum AS ENUM ('plumber', 'electrician', 'cleaner', 'painter', 'locksmith', 'other');

CREATE TYPE quote_status_enum AS ENUM ('pending', 'accepted', 'rejected', 'completed');

CREATE TYPE inspection_type_enum AS ENUM ('entry', 'exit');

CREATE TYPE inspection_condition_enum AS ENUM ('good', 'fair', 'poor');

CREATE TYPE listing_status_enum AS ENUM ('draft', 'active', 'paused', 'archived');

CREATE TABLE users (
    id UUID NOT NULL, 
    email VARCHAR(255) NOT NULL, 
    hashed_password VARCHAR(255), 
    role user_role_enum NOT NULL, 
    first_name VARCHAR(100), 
    last_name VARCHAR(100), 
    phone VARCHAR(20), 
    avatar_url TEXT, 
    is_verified BOOLEAN DEFAULT false NOT NULL, 
    supabase_uid VARCHAR(36), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE INDEX ix_users_role ON users (role);

CREATE UNIQUE INDEX ix_users_supabase_uid ON users (supabase_uid);

CREATE TABLE properties (
    id UUID NOT NULL, 
    owner_id UUID NOT NULL, 
    agency_id UUID, 
    created_by_id UUID NOT NULL, 
    type property_type_enum NOT NULL, 
    status property_status_enum DEFAULT 'available' NOT NULL, 
    address VARCHAR(500) NOT NULL, 
    city VARCHAR(100) NOT NULL, 
    zip_code VARCHAR(10) NOT NULL, 
    country VARCHAR(2) DEFAULT 'FR' NOT NULL, 
    surface FLOAT, 
    rooms INTEGER, 
    floor INTEGER, 
    description TEXT, 
    monthly_rent NUMERIC(12, 2), 
    charges NUMERIC(12, 2), 
    deposit NUMERIC(12, 2), 
    price_sale NUMERIC(14, 2), 
    is_furnished BOOLEAN DEFAULT false NOT NULL, 
    has_parking BOOLEAN DEFAULT false NOT NULL, 
    pets_allowed BOOLEAN DEFAULT false NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE RESTRICT, 
    FOREIGN KEY(agency_id) REFERENCES users (id) ON DELETE SET NULL, 
    FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX ix_properties_owner_id ON properties (owner_id);

CREATE INDEX ix_properties_agency_id ON properties (agency_id);

CREATE INDEX ix_properties_created_by_id ON properties (created_by_id);

CREATE INDEX ix_properties_status ON properties (status);

CREATE INDEX ix_properties_type ON properties (type);

CREATE INDEX ix_properties_city ON properties (city);

CREATE INDEX ix_properties_zip_code ON properties (zip_code);

CREATE TABLE property_images (
    id UUID NOT NULL, 
    property_id UUID NOT NULL, 
    url TEXT NOT NULL, 
    "order" INTEGER DEFAULT '0' NOT NULL, 
    is_cover BOOLEAN DEFAULT false NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(property_id) REFERENCES properties (id) ON DELETE CASCADE
);

CREATE INDEX ix_property_images_property_id ON property_images (property_id);

CREATE INDEX ix_property_images_order ON property_images (property_id, "order");

CREATE TABLE property_documents (
    id UUID NOT NULL, 
    property_id UUID NOT NULL, 
    type property_document_type_enum NOT NULL, 
    url TEXT NOT NULL, 
    name VARCHAR(255) NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(property_id) REFERENCES properties (id) ON DELETE CASCADE
);

CREATE INDEX ix_property_documents_property_id ON property_documents (property_id);

CREATE INDEX ix_property_documents_type ON property_documents (type);

CREATE TABLE contracts (
    id UUID NOT NULL, 
    property_id UUID NOT NULL, 
    tenant_id UUID, 
    agency_id UUID, 
    type contract_type_enum NOT NULL, 
    status contract_status_enum DEFAULT 'draft' NOT NULL, 
    start_date TIMESTAMP WITH TIME ZONE NOT NULL, 
    end_date TIMESTAMP WITH TIME ZONE, 
    monthly_rent NUMERIC(12, 2), 
    charges NUMERIC(12, 2), 
    deposit NUMERIC(12, 2), 
    signed_at TIMESTAMP WITH TIME ZONE, 
    terminated_at TIMESTAMP WITH TIME ZONE, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(property_id) REFERENCES properties (id) ON DELETE RESTRICT, 
    FOREIGN KEY(tenant_id) REFERENCES users (id) ON DELETE SET NULL, 
    FOREIGN KEY(agency_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_contracts_property_id ON contracts (property_id);

CREATE INDEX ix_contracts_tenant_id ON contracts (tenant_id);

CREATE INDEX ix_contracts_agency_id ON contracts (agency_id);

CREATE INDEX ix_contracts_status ON contracts (status);

CREATE INDEX ix_contracts_type ON contracts (type);

CREATE INDEX ix_contracts_start_date ON contracts (start_date);

CREATE TABLE transactions (
    id UUID NOT NULL, 
    contract_id UUID, 
    property_id UUID, 
    owner_id UUID NOT NULL, 
    tenant_id UUID, 
    type transaction_type_enum NOT NULL, 
    status transaction_status_enum DEFAULT 'pending' NOT NULL, 
    amount NUMERIC(12, 2) NOT NULL, 
    commission_front_pct NUMERIC(5, 2), 
    commission_back_pct NUMERIC(5, 2), 
    commission_amount NUMERIC(12, 2), 
    due_date TIMESTAMP WITH TIME ZONE, 
    paid_at TIMESTAMP WITH TIME ZONE, 
    stripe_payment_id VARCHAR(255), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(contract_id) REFERENCES contracts (id) ON DELETE SET NULL, 
    FOREIGN KEY(property_id) REFERENCES properties (id) ON DELETE SET NULL, 
    FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE RESTRICT, 
    FOREIGN KEY(tenant_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_transactions_contract_id ON transactions (contract_id);

CREATE INDEX ix_transactions_property_id ON transactions (property_id);

CREATE INDEX ix_transactions_owner_id ON transactions (owner_id);

CREATE INDEX ix_transactions_tenant_id ON transactions (tenant_id);

CREATE INDEX ix_transactions_status ON transactions (status);

CREATE INDEX ix_transactions_type ON transactions (type);

CREATE INDEX ix_transactions_due_date ON transactions (due_date);

CREATE INDEX ix_transactions_stripe_payment_id ON transactions (stripe_payment_id);

CREATE TABLE openers (
    id UUID NOT NULL, 
    user_id UUID NOT NULL, 
    bio TEXT, 
    radius_km FLOAT, 
    hourly_rate NUMERIC(8, 2), 
    is_available BOOLEAN DEFAULT true NOT NULL, 
    rating NUMERIC(3, 2), 
    total_missions INTEGER DEFAULT '0' NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    PRIMARY KEY (id), 
    UNIQUE (user_id), 
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX ix_openers_user_id ON openers (user_id);

CREATE INDEX ix_openers_is_available ON openers (is_available);

CREATE TABLE missions (
    id UUID NOT NULL, 
    opener_id UUID NOT NULL, 
    property_id UUID NOT NULL, 
    type mission_type_enum NOT NULL, 
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    status mission_status_enum DEFAULT 'pending' NOT NULL, 
    price NUMERIC(8, 2), 
    report_url TEXT, 
    photos_urls TEXT[], 
    rating_given NUMERIC(3, 2), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(opener_id) REFERENCES openers (id) ON DELETE RESTRICT, 
    FOREIGN KEY(property_id) REFERENCES properties (id) ON DELETE RESTRICT
);

CREATE INDEX ix_missions_opener_id ON missions (opener_id);

CREATE INDEX ix_missions_property_id ON missions (property_id);

CREATE INDEX ix_missions_status ON missions (status);

CREATE INDEX ix_missions_scheduled_at ON missions (scheduled_at);

CREATE INDEX ix_missions_type ON missions (type);

CREATE TABLE companies (
    id UUID NOT NULL, 
    user_id UUID NOT NULL, 
    name VARCHAR(255) NOT NULL, 
    type company_type_enum NOT NULL, 
    siret VARCHAR(14), 
    description TEXT, 
    rating NUMERIC(3, 2), 
    total_jobs INTEGER DEFAULT '0' NOT NULL, 
    commission_pct NUMERIC(5, 2), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    PRIMARY KEY (id), 
    UNIQUE (user_id), 
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
    UNIQUE (siret)
);

CREATE UNIQUE INDEX ix_companies_user_id ON companies (user_id);

CREATE INDEX ix_companies_type ON companies (type);

CREATE INDEX ix_companies_siret ON companies (siret);

CREATE TABLE quotes (
    id UUID NOT NULL, 
    company_id UUID NOT NULL, 
    property_id UUID NOT NULL, 
    owner_id UUID NOT NULL, 
    description TEXT NOT NULL, 
    amount NUMERIC(12, 2) NOT NULL, 
    status quote_status_enum DEFAULT 'pending' NOT NULL, 
    validated_at TIMESTAMP WITH TIME ZONE, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE RESTRICT, 
    FOREIGN KEY(property_id) REFERENCES properties (id) ON DELETE RESTRICT, 
    FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX ix_quotes_company_id ON quotes (company_id);

CREATE INDEX ix_quotes_property_id ON quotes (property_id);

CREATE INDEX ix_quotes_owner_id ON quotes (owner_id);

CREATE INDEX ix_quotes_status ON quotes (status);

CREATE TABLE inspections (
    id UUID NOT NULL, 
    property_id UUID NOT NULL, 
    contract_id UUID, 
    inspector_id UUID NOT NULL, 
    type inspection_type_enum NOT NULL, 
    date TIMESTAMP WITH TIME ZONE NOT NULL, 
    report_url TEXT, 
    photos_urls TEXT[], 
    condition inspection_condition_enum DEFAULT 'good' NOT NULL, 
    notes TEXT, 
    signature_tenant TEXT, 
    signature_owner TEXT, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(property_id) REFERENCES properties (id) ON DELETE RESTRICT, 
    FOREIGN KEY(contract_id) REFERENCES contracts (id) ON DELETE SET NULL, 
    FOREIGN KEY(inspector_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX ix_inspections_property_id ON inspections (property_id);

CREATE INDEX ix_inspections_contract_id ON inspections (contract_id);

CREATE INDEX ix_inspections_inspector_id ON inspections (inspector_id);

CREATE INDEX ix_inspections_type ON inspections (type);

CREATE INDEX ix_inspections_date ON inspections (date);

CREATE TABLE listings (
    id UUID NOT NULL, 
    property_id UUID NOT NULL, 
    title TEXT, 
    description_ai TEXT, 
    price NUMERIC(12, 2), 
    status listing_status_enum DEFAULT 'draft' NOT NULL, 
    portals JSONB, 
    ai_score NUMERIC(5, 2), 
    views INTEGER DEFAULT '0' NOT NULL, 
    leads_count INTEGER DEFAULT '0' NOT NULL, 
    published_at TIMESTAMP WITH TIME ZONE, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    PRIMARY KEY (id), 
    UNIQUE (property_id), 
    FOREIGN KEY(property_id) REFERENCES properties (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX ix_listings_property_id ON listings (property_id);

CREATE INDEX ix_listings_status ON listings (status);

CREATE INDEX ix_listings_published_at ON listings (published_at);

CREATE INDEX ix_listings_portals ON listings USING gin (portals);

CREATE TABLE audit_logs (
    id UUID NOT NULL, 
    user_id UUID, 
    action VARCHAR(100) NOT NULL, 
    resource_type VARCHAR(100) NOT NULL, 
    resource_id VARCHAR(36), 
    old_values JSONB, 
    new_values JSONB, 
    ip_address VARCHAR(45), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_audit_logs_user_id ON audit_logs (user_id);

CREATE INDEX ix_audit_logs_action ON audit_logs (action);

CREATE INDEX ix_audit_logs_resource_type ON audit_logs (resource_type);

CREATE INDEX ix_audit_logs_resource_id ON audit_logs (resource_id);

CREATE INDEX ix_audit_logs_created_at ON audit_logs (created_at);

CREATE INDEX ix_audit_logs_old_values ON audit_logs USING gin (old_values);

CREATE INDEX ix_audit_logs_new_values ON audit_logs USING gin (new_values);

INSERT INTO alembic_version (version_num) VALUES ('0001') RETURNING alembic_version.version_num;

-- Running upgrade 0001 -> 0002

ALTER TABLE contracts ADD COLUMN reference VARCHAR(50);

ALTER TABLE contracts ADD COLUMN owner_id UUID;

ALTER TABLE contracts ADD FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE RESTRICT;

ALTER TABLE contracts ADD COLUMN signed_ip VARCHAR(45);

UPDATE contracts SET reference = 'REF-' || substring(id::text, 1, 8) WHERE reference IS NULL;

ALTER TABLE contracts ALTER COLUMN reference SET NOT NULL;

ALTER TABLE contracts ADD CONSTRAINT uq_contracts_reference UNIQUE (reference);

CREATE INDEX ix_contracts_owner_id ON contracts (owner_id);

ALTER TABLE transactions ADD COLUMN reference VARCHAR(50);

ALTER TABLE transactions ADD COLUMN notes TEXT;

UPDATE transactions SET reference = 'TXN-' || substring(id::text, 1, 8) WHERE reference IS NULL;

ALTER TABLE transactions ALTER COLUMN reference SET NOT NULL;

ALTER TABLE transactions ADD CONSTRAINT uq_transactions_reference UNIQUE (reference);

ALTER TABLE openers ADD COLUMN latitude FLOAT;

ALTER TABLE openers ADD COLUMN longitude FLOAT;

ALTER TABLE openers ADD COLUMN skills TEXT[];

ALTER TABLE missions ALTER COLUMN opener_id DROP NOT NULL;

ALTER TABLE missions ADD COLUMN requester_id UUID;

ALTER TABLE missions ADD FOREIGN KEY(requester_id) REFERENCES users (id) ON DELETE RESTRICT;

UPDATE missions
        SET requester_id = (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)
        WHERE requester_id IS NULL;

ALTER TABLE missions ADD COLUMN accepted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE missions ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE missions ADD COLUMN cancelled_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE missions ADD COLUMN cancelled_reason VARCHAR(255);

ALTER TABLE missions ADD COLUMN property_lat FLOAT;

ALTER TABLE missions ADD COLUMN property_lng FLOAT;

ALTER TABLE missions ADD COLUMN notes TEXT;

ALTER TABLE missions ADD COLUMN report_text TEXT;

ALTER TABLE missions ADD COLUMN rating_comment TEXT;

ALTER TABLE missions ADD COLUMN stripe_payment_intent_id VARCHAR(255);

CREATE INDEX ix_missions_requester_id ON missions (requester_id);

UPDATE alembic_version SET version_num='0002' WHERE alembic_version.version_num = '0001';

COMMIT;

