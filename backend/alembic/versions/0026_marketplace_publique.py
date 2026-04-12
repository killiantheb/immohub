"""Marketplace publique — extension listings + tables interests & candidatures.

Ajoute les colonnes nécessaires à la marketplace publique (swipe, map, photos…),
la table des intérêts (swipes droite / candidatures initiales) et la table des
dossiers de candidature complets (scoring IA, frais CHF 90).

Note : l'index géospatial GIST sur ST_MakePoint requiert PostGIS (activé en 0020).
Pour les tables volumineuses en production, créer l'index manuellement avec
CONCURRENTLY AVANT de lancer alembic upgrade.

Revision ID: 0026
Revises: 0025
"""

from __future__ import annotations

from alembic import op
from sqlalchemy import text

revision = "0026"
down_revision = "0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Étendre la table listings ──────────────────────────────────────────

    op.execute(text("""
        ALTER TABLE listings
            ADD COLUMN IF NOT EXISTS transaction_type TEXT
                CHECK (transaction_type IN ('location','vente','colocation'))
                DEFAULT 'location',
            ADD COLUMN IF NOT EXISTS lat FLOAT,
            ADD COLUMN IF NOT EXISTS lng FLOAT,
            ADD COLUMN IF NOT EXISTS adresse_affichee TEXT,
            ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS tags_ia JSONB DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS expire_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS swipes_count INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS contacts_count INTEGER DEFAULT 0
    """))

    # ── 2. Table interests (swipes droite + candidatures initiales) ───────────

    op.execute(text("""
        CREATE TABLE IF NOT EXISTS interests (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            listing_id  UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
            user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
            session_id  TEXT,
            status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN (
                    'pending','contacte','visite_planifiee',
                    'dossier_envoye','accepte','refuse'
                )),
            message     TEXT,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))

    op.execute(text("""
        CREATE INDEX IF NOT EXISTS ix_interests_listing_id ON interests(listing_id)
    """))
    op.execute(text("""
        CREATE INDEX IF NOT EXISTS ix_interests_user_id    ON interests(user_id)
    """))
    op.execute(text("""
        CREATE INDEX IF NOT EXISTS ix_interests_status     ON interests(status)
    """))

    # ── 3. Table candidatures (dossiers complets) ─────────────────────────────

    op.execute(text("""
        CREATE TABLE IF NOT EXISTS candidatures (
            id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            interest_id              UUID REFERENCES interests(id),
            listing_id               UUID NOT NULL REFERENCES listings(id),
            user_id                  UUID REFERENCES users(id),
            documents                JSONB DEFAULT '[]',
            score_ia                 INTEGER,
            score_detail             JSONB,
            statut                   TEXT NOT NULL DEFAULT 'en_attente'
                CHECK (statut IN (
                    'en_attente','accepte','refuse','dossier_paye'
                )),
            frais_dossier_stripe_id  TEXT,
            created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))

    # ── 4. Index géospatial GIST (PostGIS — activé en migration 0020) ─────────
    # WHERE status = 'active' : filtre les listings inactifs dès l'index.
    # WHERE lat IS NOT NULL  : exclut les biens sans coordonnées.

    op.execute(text("""
        CREATE INDEX IF NOT EXISTS ix_listings_geo
            ON listings USING GIST (ST_MakePoint(lng, lat))
            WHERE status = 'active' AND lat IS NOT NULL
    """))


def downgrade() -> None:
    # Inverse dans l'ordre : index d'abord, puis tables, puis colonnes.

    op.execute(text("DROP INDEX IF EXISTS ix_listings_geo"))

    op.execute(text("DROP TABLE IF EXISTS candidatures"))

    op.execute(text("DROP INDEX IF EXISTS ix_interests_status"))
    op.execute(text("DROP INDEX IF EXISTS ix_interests_user_id"))
    op.execute(text("DROP INDEX IF EXISTS ix_interests_listing_id"))
    op.execute(text("DROP TABLE IF EXISTS interests"))

    op.execute(text("""
        ALTER TABLE listings
            DROP COLUMN IF EXISTS transaction_type,
            DROP COLUMN IF EXISTS lat,
            DROP COLUMN IF EXISTS lng,
            DROP COLUMN IF EXISTS adresse_affichee,
            DROP COLUMN IF EXISTS photos,
            DROP COLUMN IF EXISTS tags_ia,
            DROP COLUMN IF EXISTS is_premium,
            DROP COLUMN IF EXISTS expire_at,
            DROP COLUMN IF EXISTS swipes_count,
            DROP COLUMN IF EXISTS contacts_count
    """))
