"""Enrichissement fiche bien — charges incluses + sécurité opérationnelle (PR-A11.A.6.d).

Sprint A11.A.6.d (enrichissement UX & data complémentaire) :

  1. Ajoute à `biens` 13 booléens « charges incluses dans le forfait du bail ».
     Sémantique = clauses contractuelles déclaratives (par bien). Distinct de
     `ChargeLine` (lignes comptables réelles, sprint 13-14).

  2. Ajoute à `biens` 1 colonne `code_digicode_encrypted` (Text) — code
     d'accès à l'immeuble, chiffré at-rest via `app.core.crypto` (Fernet
     dérivé de SECRET_KEY). Conforme nLPD §6.2 (donnée sensible).

  3. Crée la table `bien_keys` — pattern aligné `BienAnnexe/BienContact/
     BienCompteur` (1:N par bien, soft-delete is_active, timestamps).

  4. Migration de données : pour chaque bien legacy ayant `keys_count > 0`,
     crée 1 ligne `bien_keys` type='entree' (description auto-générée). On ne
     crée qu'UNE clé par bien — l'utilisateur ajoutera le détail manuellement.

Notes architecturales :
  - `Bien.keys_count` est conservé : recalculé service-side par
    `BienKeyService` à chaque CRUD (count(*) where is_active=true).
  - Le catalogue 7-CATALOGUE l. 392-401 prévoit `keys_description` /
    `numero_badge` / `code_digicode` comme scalaires sur Bien. Le sprint
    A11.A.6.d innove : table 1:N `BienKey` (numero_badge + description par
    item) au lieu des scalaires `keys_description` / `numero_badge`. Backlog
    cohérence docs : update catalogue.

Revision ID: 0037
Revises: 0036
Create Date: 2026-05-04
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "0037"
down_revision = "0036"
branch_labels = None
depends_on = None


# ── 13 booléens « charges incluses dans le forfait du bail » ────────────────
CHARGES_BOOLEAN_COLUMNS: list[str] = [
    # Famille 1 — Chauffage et eau chaude
    "charges_chauffage",
    "charges_eau_chaude",
    "charges_entretien_chaudiere",
    "charges_releves_compteurs",
    # Famille 2 — Conciergerie et entretien
    "charges_conciergerie",
    "charges_nettoyage_communs",
    "charges_produits_entretien",
    # Famille 3 — Immeuble et espaces communs
    "charges_ascenseur",
    "charges_eclairage_communs",
    "charges_espaces_verts",
    "charges_deneigement",
    # Famille 4 — Taxes publiques et exploitation
    "charges_taxe_egouts",
    "charges_ordures",
    "charges_redevance_tv",
]


def upgrade() -> None:
    # ──────────────────────────────────────────────────────────────────────
    # 1. 13 booléens charges incluses (default false, NOT NULL)
    # ──────────────────────────────────────────────────────────────────────
    for col in CHARGES_BOOLEAN_COLUMNS:
        op.add_column(
            "biens",
            sa.Column(
                col,
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
        )

    # ──────────────────────────────────────────────────────────────────────
    # 2. Code digicode chiffré at-rest (nullable — pas tous les biens)
    # ──────────────────────────────────────────────────────────────────────
    op.add_column(
        "biens",
        sa.Column("code_digicode_encrypted", sa.Text(), nullable=True),
    )

    # ──────────────────────────────────────────────────────────────────────
    # 3. Table bien_keys (clés / badges / cadenas par bien)
    # ──────────────────────────────────────────────────────────────────────
    op.create_table(
        "bien_keys",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "bien_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("biens.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # type : entree / cave / boite_aux_lettres / parking / garage /
        # cadenas / autre — validation Pydantic au Create/Update
        sa.Column("type", sa.String(30), nullable=False),
        sa.Column("numero_badge", sa.String(50), nullable=True),
        sa.Column("description", sa.String(300), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
    )
    op.create_index("ix_bien_keys_bien_id", "bien_keys", ["bien_id"])
    op.create_index("ix_bien_keys_bien_type", "bien_keys", ["bien_id", "type"])

    # ──────────────────────────────────────────────────────────────────────
    # 4. Migration de données : 1 BienKey type='entree' par bien legacy
    #    ayant keys_count > 0. On ne déduit pas le détail des N clés
    #    (l'utilisateur enrichira la liste manuellement).
    #    pgcrypto déjà installée (cf migration 0035 + 0001).
    # ──────────────────────────────────────────────────────────────────────
    op.execute(
        """
        INSERT INTO bien_keys (
            id, bien_id, type, description,
            created_at, updated_at, is_active
        )
        SELECT
            gen_random_uuid(),
            b.id,
            'entree',
            'Clé d''entrée (auto-créée depuis legacy keys_count)',
            now(),
            now(),
            true
        FROM biens b
        WHERE b.keys_count IS NOT NULL AND b.keys_count > 0
        """
    )


def downgrade() -> None:
    # 1. Drop table bien_keys
    op.drop_index("ix_bien_keys_bien_type", table_name="bien_keys")
    op.drop_index("ix_bien_keys_bien_id", table_name="bien_keys")
    op.drop_table("bien_keys")

    # 2. Drop colonne digicode chiffrée
    op.drop_column("biens", "code_digicode_encrypted")

    # 3. Drop les 13 booléens charges (ordre inverse pour cohérence stylistique)
    for col in reversed(CHARGES_BOOLEAN_COLUMNS):
        op.drop_column("biens", col)
