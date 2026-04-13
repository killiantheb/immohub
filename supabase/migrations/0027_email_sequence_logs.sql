-- ── Migration 0027 — email_sequence_logs ─────────────────────────────────────
-- Trackage des emails de séquence automatique envoyés.
-- UNIQUE(user_id, sequence_key) garantit l'idempotence — un email par clé.

CREATE TABLE IF NOT EXISTS email_sequence_logs (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sequence_key   VARCHAR(50) NOT NULL,   -- ex: "proprio_j0", "locataire_j7"
    sent_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, sequence_key)
);

CREATE INDEX IF NOT EXISTS idx_esl_user_id  ON email_sequence_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_esl_sent_at  ON email_sequence_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_esl_seq_key  ON email_sequence_logs(sequence_key);

-- RLS — seul le service_role peut lire/écrire (accès Celery via DATABASE_URL direct)
ALTER TABLE email_sequence_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON email_sequence_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
