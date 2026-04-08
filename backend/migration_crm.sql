-- Migration CRM : crm_contacts + crm_notes
-- À exécuter manuellement sur la base de données Supabase

CREATE TABLE IF NOT EXISTS crm_contacts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    first_name  VARCHAR(100),
    last_name   VARCHAR(100),
    email       VARCHAR(255),
    phone       VARCHAR(30),
    status      VARCHAR(20)  NOT NULL DEFAULT 'prospect',
    source      VARCHAR(30)  NOT NULL DEFAULT 'manual',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS ix_crm_contacts_owner_id    ON crm_contacts(owner_id);
CREATE INDEX IF NOT EXISTS ix_crm_contacts_user_id     ON crm_contacts(user_id);
CREATE INDEX IF NOT EXISTS ix_crm_contacts_property_id ON crm_contacts(property_id);

CREATE TABLE IF NOT EXISTS crm_notes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
    target_contact_id UUID REFERENCES crm_contacts(id) ON DELETE CASCADE,
    property_id       UUID REFERENCES properties(id) ON DELETE SET NULL,
    content           TEXT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active         BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS ix_crm_notes_owner_id          ON crm_notes(owner_id);
CREATE INDEX IF NOT EXISTS ix_crm_notes_target_user_id    ON crm_notes(target_user_id);
CREATE INDEX IF NOT EXISTS ix_crm_notes_target_contact_id ON crm_notes(target_contact_id);
