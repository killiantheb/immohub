"""Settings extended fields — users langue/notifs, profiles artisan/ouvreur extra columns.

Revision ID: 0007
Revises: 0006
Create Date: 2026-04-08
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── users: langue + notification preferences ──────────────────────────────
    op.add_column("users", sa.Column("langue", sa.String(5), nullable=True, server_default="fr"))
    op.add_column("users", sa.Column("adresse", sa.String(300), nullable=True))  # may already exist from 0006
    # notification channels
    op.add_column("users", sa.Column("notif_email",  sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("users", sa.Column("notif_sms",    sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("users", sa.Column("notif_push",   sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("users", sa.Column("notif_inapp",  sa.Boolean(), nullable=False, server_default="true"))
    # notification events
    op.add_column("users", sa.Column("notif_nouvelle_mission",  sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("users", sa.Column("notif_devis_accepte",     sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("users", sa.Column("notif_devis_refuse",      sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("users", sa.Column("notif_mission_urgente",   sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("users", sa.Column("notif_rappel_j1",         sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("users", sa.Column("notif_rappel_2h",         sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("users", sa.Column("notif_facture_impayee",   sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("users", sa.Column("notif_paiement_recu",     sa.Boolean(), nullable=False, server_default="true"))

    # ── profiles_artisans: extra identity fields ──────────────────────────────
    op.add_column("profiles_artisans", sa.Column("statut_juridique",   sa.String(30), nullable=True))
    op.add_column("profiles_artisans", sa.Column("annees_experience",  sa.Integer(), nullable=True))
    op.add_column("profiles_artisans", sa.Column("site_web",           sa.String(300), nullable=True))
    # charge settings
    op.add_column("profiles_artisans", sa.Column("montant_min_mission",     sa.Numeric(8, 2), nullable=True))
    op.add_column("profiles_artisans", sa.Column("urgences_acceptees",      sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("profiles_artisans", sa.Column("majoration_urgence_pct",  sa.Integer(), nullable=False, server_default="0"))
    op.add_column("profiles_artisans", sa.Column("chantiers_simultanees",   sa.Integer(), nullable=False, server_default="3"))
    # billing
    op.add_column("profiles_artisans", sa.Column("billing_name",    sa.String(200), nullable=True))
    op.add_column("profiles_artisans", sa.Column("billing_adresse", sa.String(300), nullable=True))
    op.add_column("profiles_artisans", sa.Column("virement_auto",   sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("profiles_artisans", sa.Column("facturation_auto",sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("profiles_artisans", sa.Column("relance_auto",    sa.Boolean(), nullable=False, server_default="false"))

    # ── profiles_ouvreurs: extra fields ──────────────────────────────────────
    op.add_column("profiles_ouvreurs", sa.Column("statut_ouvreur",      sa.String(30), nullable=True))
    op.add_column("profiles_ouvreurs", sa.Column("numero_avs",          sa.String(20), nullable=True))
    op.add_column("profiles_ouvreurs", sa.Column("permis_conduire",     sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("profiles_ouvreurs", sa.Column("iban",                sa.String(34), nullable=True))
    op.add_column("profiles_ouvreurs", sa.Column("bic",                 sa.String(11), nullable=True))
    op.add_column("profiles_ouvreurs", sa.Column("bank_account_holder", sa.String(200), nullable=True))
    op.add_column("profiles_ouvreurs", sa.Column("montant_min_mission",     sa.Numeric(8, 2), nullable=True))
    op.add_column("profiles_ouvreurs", sa.Column("urgences_acceptees",      sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("profiles_ouvreurs", sa.Column("majoration_urgence_pct",  sa.Integer(), nullable=False, server_default="0"))
    op.add_column("profiles_ouvreurs", sa.Column("missions_par_jour",       sa.Integer(), nullable=False, server_default="5"))
    op.add_column("profiles_ouvreurs", sa.Column("billing_name",    sa.String(200), nullable=True))
    op.add_column("profiles_ouvreurs", sa.Column("billing_adresse", sa.String(300), nullable=True))
    op.add_column("profiles_ouvreurs", sa.Column("virement_auto",   sa.Boolean(), nullable=False, server_default="false"))


def downgrade() -> None:
    # profiles_ouvreurs
    for col in ["statut_ouvreur", "numero_avs", "permis_conduire", "iban", "bic",
                "bank_account_holder", "montant_min_mission", "urgences_acceptees",
                "majoration_urgence_pct", "missions_par_jour",
                "billing_name", "billing_adresse", "virement_auto"]:
        op.drop_column("profiles_ouvreurs", col)

    # profiles_artisans
    for col in ["statut_juridique", "annees_experience", "site_web", "montant_min_mission",
                "urgences_acceptees", "majoration_urgence_pct", "chantiers_simultanees",
                "billing_name", "billing_adresse", "virement_auto", "facturation_auto", "relance_auto"]:
        op.drop_column("profiles_artisans", col)

    # users
    for col in ["langue", "notif_email", "notif_sms", "notif_push", "notif_inapp",
                "notif_nouvelle_mission", "notif_devis_accepte", "notif_devis_refuse",
                "notif_mission_urgente", "notif_rappel_j1", "notif_rappel_2h",
                "notif_facture_impayee", "notif_paiement_recu"]:
        op.drop_column("users", col)
