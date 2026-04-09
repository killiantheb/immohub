"""0016 — depenses_scannees table + document types extensions."""

from __future__ import annotations

from alembic import op

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── depenses_scannees — factures scannées via OCR/Vision ─────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS depenses_scannees (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            bien_id             UUID REFERENCES biens(id) ON DELETE SET NULL,
            owner_id            UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
            -- Données extraites par Claude Vision
            montant             NUMERIC(10,2),
            fournisseur         VARCHAR(300),
            date_facture        DATE,
            description         TEXT,
            numero_facture      VARCHAR(100),
            -- Affectation OBLF suisse
            categorie_oblf      VARCHAR(50),   -- entretien|reparation|assurance|impots|frais_admin|autre
            sous_categorie      VARCHAR(100),
            -- Statut
            statut              VARCHAR(20) NOT NULL DEFAULT 'propose',  -- propose|confirme|rejete
            confirme_par_user   BOOLEAN NOT NULL DEFAULT FALSE,
            -- Fichier source
            url_fichier_source  TEXT,
            media_type          VARCHAR(50),
            -- Timestamps
            created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            is_active           BOOLEAN NOT NULL DEFAULT TRUE
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_depenses_scannees_bien ON depenses_scannees(bien_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_depenses_scannees_owner ON depenses_scannees(owner_id)")

    # ── Ajouter colonne content_texte aux documents générés ──────────────────
    op.execute("""
        ALTER TABLE generated_documents
            ADD COLUMN IF NOT EXISTS content_texte TEXT
    """)


def downgrade() -> None:
    pass
