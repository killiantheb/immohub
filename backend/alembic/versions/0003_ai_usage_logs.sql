-- Migration 0003: ai_usage_logs table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL,
    action      VARCHAR(64) NOT NULL,
    model       VARCHAR(64) NOT NULL,
    input_tokens  INTEGER,
    output_tokens INTEGER,
    cost_usd    NUMERIC(10, 6),
    context_ref VARCHAR(255),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_ai_usage_logs_user_id ON ai_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS ix_ai_usage_logs_created_at ON ai_usage_logs(created_at);

-- Update alembic version
UPDATE alembic_version SET version_num = '0003';
