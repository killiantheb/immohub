-- Migration 011 — Table estimation_logs
-- Analytics des estimations IA rapides (landing page / lead magnet)
-- Pas de FK user_id — endpoint public sans auth

CREATE TABLE IF NOT EXISTS estimation_logs (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    adresse     TEXT        NOT NULL,
    pieces      INTEGER     NOT NULL,
    surface_m2  NUMERIC(8,2) NOT NULL,
    type        TEXT        NOT NULL DEFAULT 'apartment',
    resultat    JSONB,                            -- {min, max, confiance}
    ip          TEXT,                             -- IP anonymisée pour analytics
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour analytics par date et par IP (détection abus)
CREATE INDEX IF NOT EXISTS ix_estimation_logs_created_at ON estimation_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS ix_estimation_logs_ip         ON estimation_logs (ip);

-- RLS : lecture admin uniquement, écriture via service role (backend)
ALTER TABLE estimation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_estimation_logs"
    ON estimation_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid() AND u.role = 'super_admin'
        )
    );
