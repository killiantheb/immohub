"""Settings extended fields — users langue/notifs, profiles artisan/ouvreur extra columns.

Revision ID: 0007
Revises: 0006
Create Date: 2026-04-08
"""

from __future__ import annotations

from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def _add_col(table: str, column: str, ddl: str) -> None:
    """Add a column only if it doesn't already exist (idempotent)."""
    op.execute(f"""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = '{table}' AND column_name = '{column}'
            ) THEN
                ALTER TABLE {table} ADD COLUMN {column} {ddl};
            END IF;
        END $$;
    """)


def upgrade() -> None:
    # ── users: langue + notification preferences ──────────────────────────────
    _add_col("users", "langue",  "VARCHAR(5) DEFAULT 'fr'")
    _add_col("users", "adresse", "VARCHAR(300)")
    # notification channels
    _add_col("users", "notif_email",  "BOOLEAN NOT NULL DEFAULT true")
    _add_col("users", "notif_sms",    "BOOLEAN NOT NULL DEFAULT false")
    _add_col("users", "notif_push",   "BOOLEAN NOT NULL DEFAULT true")
    _add_col("users", "notif_inapp",  "BOOLEAN NOT NULL DEFAULT true")
    # notification events
    _add_col("users", "notif_nouvelle_mission", "BOOLEAN NOT NULL DEFAULT true")
    _add_col("users", "notif_devis_accepte",    "BOOLEAN NOT NULL DEFAULT true")
    _add_col("users", "notif_devis_refuse",     "BOOLEAN NOT NULL DEFAULT true")
    _add_col("users", "notif_mission_urgente",  "BOOLEAN NOT NULL DEFAULT true")
    _add_col("users", "notif_rappel_j1",        "BOOLEAN NOT NULL DEFAULT true")
    _add_col("users", "notif_rappel_2h",        "BOOLEAN NOT NULL DEFAULT true")
    _add_col("users", "notif_facture_impayee",  "BOOLEAN NOT NULL DEFAULT true")
    _add_col("users", "notif_paiement_recu",    "BOOLEAN NOT NULL DEFAULT true")

    # ── profiles_artisans: extra identity fields ──────────────────────────────
    _add_col("profiles_artisans", "statut_juridique",      "VARCHAR(30)")
    _add_col("profiles_artisans", "annees_experience",     "INTEGER")
    _add_col("profiles_artisans", "site_web",              "VARCHAR(300)")
    _add_col("profiles_artisans", "montant_min_mission",   "NUMERIC(8,2)")
    _add_col("profiles_artisans", "urgences_acceptees",    "BOOLEAN NOT NULL DEFAULT false")
    _add_col("profiles_artisans", "majoration_urgence_pct","INTEGER NOT NULL DEFAULT 0")
    _add_col("profiles_artisans", "chantiers_simultanees", "INTEGER NOT NULL DEFAULT 3")
    _add_col("profiles_artisans", "billing_name",          "VARCHAR(200)")
    _add_col("profiles_artisans", "billing_adresse",       "VARCHAR(300)")
    _add_col("profiles_artisans", "virement_auto",         "BOOLEAN NOT NULL DEFAULT false")
    _add_col("profiles_artisans", "facturation_auto",      "BOOLEAN NOT NULL DEFAULT false")
    _add_col("profiles_artisans", "relance_auto",          "BOOLEAN NOT NULL DEFAULT false")

    # ── profiles_ouvreurs: extra fields ──────────────────────────────────────
    _add_col("profiles_ouvreurs", "statut_ouvreur",        "VARCHAR(30)")
    _add_col("profiles_ouvreurs", "numero_avs",            "VARCHAR(20)")
    _add_col("profiles_ouvreurs", "permis_conduire",       "BOOLEAN NOT NULL DEFAULT false")
    _add_col("profiles_ouvreurs", "iban",                  "VARCHAR(34)")
    _add_col("profiles_ouvreurs", "bic",                   "VARCHAR(11)")
    _add_col("profiles_ouvreurs", "bank_account_holder",   "VARCHAR(200)")
    _add_col("profiles_ouvreurs", "montant_min_mission",   "NUMERIC(8,2)")
    _add_col("profiles_ouvreurs", "urgences_acceptees",    "BOOLEAN NOT NULL DEFAULT false")
    _add_col("profiles_ouvreurs", "majoration_urgence_pct","INTEGER NOT NULL DEFAULT 0")
    _add_col("profiles_ouvreurs", "missions_par_jour",     "INTEGER NOT NULL DEFAULT 5")
    _add_col("profiles_ouvreurs", "billing_name",          "VARCHAR(200)")
    _add_col("profiles_ouvreurs", "billing_adresse",       "VARCHAR(300)")
    _add_col("profiles_ouvreurs", "virement_auto",         "BOOLEAN NOT NULL DEFAULT false")


def downgrade() -> None:
    for col in ["statut_ouvreur", "numero_avs", "permis_conduire", "iban", "bic",
                "bank_account_holder", "montant_min_mission", "urgences_acceptees",
                "majoration_urgence_pct", "missions_par_jour",
                "billing_name", "billing_adresse", "virement_auto"]:
        op.execute(f"ALTER TABLE profiles_ouvreurs DROP COLUMN IF EXISTS {col}")

    for col in ["statut_juridique", "annees_experience", "site_web", "montant_min_mission",
                "urgences_acceptees", "majoration_urgence_pct", "chantiers_simultanees",
                "billing_name", "billing_adresse", "virement_auto", "facturation_auto", "relance_auto"]:
        op.execute(f"ALTER TABLE profiles_artisans DROP COLUMN IF EXISTS {col}")

    for col in ["langue", "notif_email", "notif_sms", "notif_push", "notif_inapp",
                "notif_nouvelle_mission", "notif_devis_accepte", "notif_devis_refuse",
                "notif_mission_urgente", "notif_rappel_j1", "notif_rappel_2h",
                "notif_facture_impayee", "notif_paiement_recu"]:
        op.execute(f"ALTER TABLE users DROP COLUMN IF EXISTS {col}")
