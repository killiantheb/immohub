BEGIN;

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

