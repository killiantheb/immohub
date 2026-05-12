"""Module Proposition de dates locataire (Sprint 4B Option C — Phase 1.0).

Contexte (2026-05-12) :
  Audit UX condition réelle 2026-05-12 a identifié que le locataire n'avait
  aucun canal structuré pour proposer ses dates d'entrée souhaitées et ses
  préférences. Killian valide « Option C riche » : workflow back-and-forth
  (locataire propose → bailleur accepte / contre-propose / refuse → locataire
  accepte / re-contre-propose / refuse) plafonné à 4 tours, puis retombée en
  messagerie au-delà.

  10 colonnes étendues sur `dossiers_locataires` (Sprint 1A.5 a déjà créé la
  table — on ajoute sans rupture). Workflow déterministe ZÉRO IA (doctrine
  Killian §B.15 figée 2026-05-09).

  Au passage à 100% du dossier (cf mark_loyer_caution_verses Sprint 3), si
  `statut_proposition = 'accepte'` alors `locataire.date_entree =
  date_accord` au lieu du fallback `today()`. La date convenue lors de la
  négociation devient la date d'entrée officielle.

Doctrine appliquée :
  - §B.13 : migration Alembic Python only.
  - §B.10 : 4 CHECK constraints (statut_proposition, duree_envisagee,
    last_proposed_by, longueurs textuelles). La DB refuse les statuts
    invalides — pas de faux statut frontend possible.
  - §B.15 : Phase 1.0 stricte. Aucune mention notif Resend / OAuth.
  - §B.12 : workflow state transitions toujours dans un seul db.commit()
    (enforcée côté service Python ; la migration ne fait que poser le
    schéma).

Revision ID: 0046
Revises: 0045
Create Date: 2026-05-12
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0046"
down_revision = "0045"
branch_labels = None
depends_on = None


# ── Constantes (doivent matcher models/locataire.py + schemas/proposition.py) ─

_DUREE_VALUES = ("court", "moyen", "long", "indetermine")
_STATUT_PROPOSITION_VALUES = (
    "non_propose",
    "propose_par_locataire",
    "contre_propose_par_bailleur",
    "accepte",
    "refuse",
)
_LAST_PROPOSED_BY_VALUES = ("locataire", "bailleur")


def _exec(sql: str) -> None:
    """Execute a single SQL statement — asyncpg forbids multi-statement strings."""
    op.execute(sa.text(sql.strip()))


def upgrade() -> None:
    # ── 1. Colonnes locataire (dates souhaitées + préférences + commentaire) ──
    op.add_column(
        "dossiers_locataires",
        sa.Column("date_entree_souhaitee", sa.Date(), nullable=True),
    )
    op.add_column(
        "dossiers_locataires",
        sa.Column("duree_envisagee", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "dossiers_locataires",
        sa.Column(
            "preferences",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.add_column(
        "dossiers_locataires",
        sa.Column("commentaire_locataire", sa.Text(), nullable=True),
    )

    # ── 2. Workflow state ─────────────────────────────────────────────────────
    op.add_column(
        "dossiers_locataires",
        sa.Column(
            "statut_proposition",
            sa.String(length=40),
            nullable=False,
            server_default=sa.text("'non_propose'"),
        ),
    )
    op.add_column(
        "dossiers_locataires",
        sa.Column(
            "proposition_count",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )

    # ── 3. Réponse bailleur ────────────────────────────────────────────────────
    op.add_column(
        "dossiers_locataires",
        sa.Column("date_contre_proposee_bailleur", sa.Date(), nullable=True),
    )
    op.add_column(
        "dossiers_locataires",
        sa.Column("commentaire_bailleur", sa.Text(), nullable=True),
    )

    # ── 4. Final state ────────────────────────────────────────────────────────
    op.add_column(
        "dossiers_locataires",
        sa.Column("motif_refus", sa.Text(), nullable=True),
    )
    op.add_column(
        "dossiers_locataires",
        sa.Column("date_accord", sa.Date(), nullable=True),
    )
    op.add_column(
        "dossiers_locataires",
        sa.Column("last_proposed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "dossiers_locataires",
        sa.Column("last_proposed_by", sa.String(length=20), nullable=True),
    )

    # ── 5. CHECK constraints (§B.10 — DB refuse l'invalide) ───────────────────
    op.create_check_constraint(
        "ck_dossiers_duree_envisagee",
        "dossiers_locataires",
        "duree_envisagee IS NULL OR duree_envisagee IN ("
        + ", ".join(f"'{v}'" for v in _DUREE_VALUES)
        + ")",
    )
    op.create_check_constraint(
        "ck_dossiers_statut_proposition",
        "dossiers_locataires",
        "statut_proposition IN ("
        + ", ".join(f"'{v}'" for v in _STATUT_PROPOSITION_VALUES)
        + ")",
    )
    op.create_check_constraint(
        "ck_dossiers_last_proposed_by",
        "dossiers_locataires",
        "last_proposed_by IS NULL OR last_proposed_by IN ("
        + ", ".join(f"'{v}'" for v in _LAST_PROPOSED_BY_VALUES)
        + ")",
    )
    op.create_check_constraint(
        "ck_dossiers_commentaire_locataire_len",
        "dossiers_locataires",
        "commentaire_locataire IS NULL OR char_length(commentaire_locataire) <= 500",
    )
    op.create_check_constraint(
        "ck_dossiers_commentaire_bailleur_len",
        "dossiers_locataires",
        "commentaire_bailleur IS NULL OR char_length(commentaire_bailleur) <= 500",
    )
    op.create_check_constraint(
        "ck_dossiers_motif_refus_len",
        "dossiers_locataires",
        "motif_refus IS NULL OR char_length(motif_refus) <= 500",
    )
    op.create_check_constraint(
        "ck_dossiers_proposition_count_max",
        "dossiers_locataires",
        "proposition_count >= 0 AND proposition_count <= 10",
    )

    # ── 6. Index sur statut_proposition (filtrage rapide bailleur + bo admin) ──
    _exec(
        "CREATE INDEX IF NOT EXISTS ix_dossiers_locataires_statut_proposition "
        "ON dossiers_locataires(statut_proposition)"
    )


def downgrade() -> None:
    _exec("DROP INDEX IF EXISTS ix_dossiers_locataires_statut_proposition")

    op.drop_constraint("ck_dossiers_proposition_count_max", "dossiers_locataires")
    op.drop_constraint("ck_dossiers_motif_refus_len", "dossiers_locataires")
    op.drop_constraint("ck_dossiers_commentaire_bailleur_len", "dossiers_locataires")
    op.drop_constraint("ck_dossiers_commentaire_locataire_len", "dossiers_locataires")
    op.drop_constraint("ck_dossiers_last_proposed_by", "dossiers_locataires")
    op.drop_constraint("ck_dossiers_statut_proposition", "dossiers_locataires")
    op.drop_constraint("ck_dossiers_duree_envisagee", "dossiers_locataires")

    op.drop_column("dossiers_locataires", "last_proposed_by")
    op.drop_column("dossiers_locataires", "last_proposed_at")
    op.drop_column("dossiers_locataires", "date_accord")
    op.drop_column("dossiers_locataires", "motif_refus")
    op.drop_column("dossiers_locataires", "commentaire_bailleur")
    op.drop_column("dossiers_locataires", "date_contre_proposee_bailleur")
    op.drop_column("dossiers_locataires", "proposition_count")
    op.drop_column("dossiers_locataires", "statut_proposition")
    op.drop_column("dossiers_locataires", "commentaire_locataire")
    op.drop_column("dossiers_locataires", "preferences")
    op.drop_column("dossiers_locataires", "duree_envisagee")
    op.drop_column("dossiers_locataires", "date_entree_souhaitee")
