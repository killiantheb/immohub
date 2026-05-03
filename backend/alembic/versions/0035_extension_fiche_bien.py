"""Extension fiche bien — 28 colonnes biens + 4 nouvelles tables (PR-A11.A.6.a).

Ajoute à `biens` les champs manquants vs catalogue 7-CATALOGUE-DONNEES-ALTHY :
  - Identité bâtiment (5)        : egid, ewid, numero_parcelle, numero_lot_ppe,
                                   commune_ofs
  - Caractéristiques techniques  : nb_etages, type_chauffage, mode_eau_chaude,
                                   orientation_principale, vue, bruit_proximite,
                                   accessibilite_pmr, ascenseur, cave_m2,
                                   balcon_m2, terrasse_m2, jardin_m2,
                                   terrain_m2
  - Conditions location          : loyer_charges_exclus, acompte_charges,
                                   caution_type, disponibilite_date,
                                   duree_minimale_mois, preavis_mois
  - Fiscalité                    : valeur_locative_fiscale, valeur_assurance_ecab
  - Description publique         : description_publique, points_forts

Crée 4 nouvelles tables :
  - `bien_annexes`   — caves, parkings, places, garages liés au bien
  - `bien_contacts`  — contacts externes non-Althy (régie tierce, syndic,
                       concierge, garant, voisins clés)
  - `bank_accounts`  — multi-comptes par usage (régie, cautions, charges,
                       travaux, general). Seedée depuis User.iban existants.
  - `bien_compteurs` — compteurs eau, électricité, gaz, mazout

Doctrine zéro doublon (3-ARCHITECTURE.md §3.3) :
  - `caution_montant` du catalogue ≡ `biens.deposit` existant → non dupliqué
  - `etage`, `annee_renovation`, `classe_energetique` déjà présents →
    non re-créés
  - `User.iban` est conservé (déprécié) pour rétrocompatibilité ; la nouvelle
    source de vérité est `bank_accounts`. Migration de données dans `upgrade`.

Pas d'enums Postgres — Strings + validation Pydantic plus tard (cohérent
décision A11.A.5).

Revision ID: 0035
Revises: 0034
Create Date: 2026-05-03
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "0035"
down_revision = "0034"
branch_labels = None
depends_on = None


# ══════════════════════════════════════════════════════════════════════════════
# Liste des nouvelles colonnes sur biens — utilisée par upgrade ET downgrade
# pour rester cohérent (single source of truth dans le fichier).
# ══════════════════════════════════════════════════════════════════════════════

NEW_BIEN_COLUMNS: list[tuple[str, sa.Column]] = [
    # Identité bâtiment
    ("egid", sa.Column("egid", sa.Integer(), nullable=True)),
    ("ewid", sa.Column("ewid", sa.Integer(), nullable=True)),
    ("numero_parcelle", sa.Column("numero_parcelle", sa.String(50), nullable=True)),
    ("numero_lot_ppe", sa.Column("numero_lot_ppe", sa.String(50), nullable=True)),
    ("commune_ofs", sa.Column("commune_ofs", sa.Integer(), nullable=True)),
    # Caractéristiques techniques
    ("nb_etages", sa.Column("nb_etages", sa.Integer(), nullable=True)),
    ("type_chauffage", sa.Column("type_chauffage", sa.String(30), nullable=True)),
    ("mode_eau_chaude", sa.Column("mode_eau_chaude", sa.String(30), nullable=True)),
    ("orientation_principale", sa.Column("orientation_principale", sa.String(5), nullable=True)),
    ("vue", sa.Column("vue", sa.String(30), nullable=True)),
    ("bruit_proximite", sa.Column("bruit_proximite", sa.String(20), nullable=True)),
    (
        "accessibilite_pmr",
        sa.Column(
            "accessibilite_pmr",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    ),
    (
        "ascenseur",
        sa.Column(
            "ascenseur",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    ),
    ("cave_m2", sa.Column("cave_m2", sa.Numeric(6, 2), nullable=True)),
    ("balcon_m2", sa.Column("balcon_m2", sa.Numeric(6, 2), nullable=True)),
    ("terrasse_m2", sa.Column("terrasse_m2", sa.Numeric(6, 2), nullable=True)),
    ("jardin_m2", sa.Column("jardin_m2", sa.Numeric(8, 2), nullable=True)),
    ("terrain_m2", sa.Column("terrain_m2", sa.Numeric(10, 2), nullable=True)),
    # Conditions location
    ("loyer_charges_exclus", sa.Column("loyer_charges_exclus", sa.Numeric(10, 2), nullable=True)),
    ("acompte_charges", sa.Column("acompte_charges", sa.Numeric(10, 2), nullable=True)),
    ("caution_type", sa.Column("caution_type", sa.String(30), nullable=True)),
    ("disponibilite_date", sa.Column("disponibilite_date", sa.Date(), nullable=True)),
    ("duree_minimale_mois", sa.Column("duree_minimale_mois", sa.Integer(), nullable=True)),
    ("preavis_mois", sa.Column("preavis_mois", sa.Integer(), nullable=True)),
    # Fiscalité
    (
        "valeur_locative_fiscale",
        sa.Column("valeur_locative_fiscale", sa.Numeric(10, 2), nullable=True),
    ),
    (
        "valeur_assurance_ecab",
        sa.Column("valeur_assurance_ecab", sa.Numeric(12, 2), nullable=True),
    ),
    # Description publique
    ("description_publique", sa.Column("description_publique", sa.Text(), nullable=True)),
    ("points_forts", sa.Column("points_forts", sa.Text(), nullable=True)),
]


def upgrade() -> None:
    # Garde-fou : pgcrypto requis pour gen_random_uuid() dans la migration
    # de données User.iban → bank_accounts plus bas. Idempotent — l'extension
    # est normalement déjà installée depuis la migration 0001.
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    # ──────────────────────────────────────────────────────────────────────
    # 1. Étendre `biens` avec 28 colonnes
    # ──────────────────────────────────────────────────────────────────────
    for _, column in NEW_BIEN_COLUMNS:
        op.add_column("biens", column)

    # ──────────────────────────────────────────────────────────────────────
    # 2. Table `bien_annexes` — caves, parkings, garages, places
    # ──────────────────────────────────────────────────────────────────────
    op.create_table(
        "bien_annexes",
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
        # type : cave / parking_couvert / parking_exterieur / box / garage /
        # grenier / autre
        sa.Column("type", sa.String(30), nullable=False),
        sa.Column("numero", sa.String(50), nullable=True),
        sa.Column("surface_m2", sa.Numeric(6, 2), nullable=True),
        sa.Column(
            "inclus_dans_loyer",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column("loyer_supplement", sa.Numeric(8, 2), nullable=True),
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
    op.create_index("ix_bien_annexes_bien_id", "bien_annexes", ["bien_id"])
    op.create_index("ix_bien_annexes_bien_type", "bien_annexes", ["bien_id", "type"])

    # ──────────────────────────────────────────────────────────────────────
    # 3. Table `bien_contacts` — contacts externes liés au bien
    # ──────────────────────────────────────────────────────────────────────
    op.create_table(
        "bien_contacts",
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
        # role : regie_tierce / concierge / syndic / garant / voisin_cle /
        # proprietaire_voisin / autre
        sa.Column("role", sa.String(30), nullable=False),
        sa.Column("nom", sa.String(200), nullable=False),
        sa.Column("prenom", sa.String(100), nullable=True),
        sa.Column("societe", sa.String(200), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("telephone", sa.String(30), nullable=True),
        sa.Column("adresse", sa.String(300), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
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
    op.create_index("ix_bien_contacts_bien_id", "bien_contacts", ["bien_id"])
    op.create_index("ix_bien_contacts_bien_role", "bien_contacts", ["bien_id", "role"])

    # ──────────────────────────────────────────────────────────────────────
    # 4. Table `bank_accounts` — multi-comptes bancaires par usage
    # ──────────────────────────────────────────────────────────────────────
    op.create_table(
        "bank_accounts",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # usage : regie / cautions / charges / travaux / general
        sa.Column(
            "usage",
            sa.String(30),
            nullable=False,
            server_default=sa.text("'general'"),
        ),
        sa.Column("iban", sa.String(34), nullable=False),
        sa.Column("bic", sa.String(11), nullable=True),
        sa.Column("titulaire", sa.String(200), nullable=False),
        sa.Column("banque_nom", sa.String(150), nullable=True),
        sa.Column(
            "banque_pays",
            sa.String(2),
            nullable=False,
            server_default=sa.text("'CH'"),
        ),
        sa.Column(
            "est_principal",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
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
    op.create_index("ix_bank_accounts_user_id", "bank_accounts", ["user_id"])
    op.create_index("ix_bank_accounts_user_usage", "bank_accounts", ["user_id", "usage"])
    op.create_index(
        "ix_bank_accounts_user_principal",
        "bank_accounts",
        ["user_id", "est_principal"],
    )
    # Garantit qu'un utilisateur ne peut avoir qu'un seul compte bancaire
    # principal (unique partial index Postgres). Permet plusieurs lignes
    # `est_principal=false` mais une seule `est_principal=true` par user.
    op.create_index(
        "ix_bank_accounts_user_principal_unique",
        "bank_accounts",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("est_principal = true"),
    )

    # ──────────────────────────────────────────────────────────────────────
    # 5. Table `bien_compteurs` — compteurs consommation par bien
    # ──────────────────────────────────────────────────────────────────────
    op.create_table(
        "bien_compteurs",
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
        # type : eau_froide / eau_chaude / electricite / gaz / mazout /
        # chauffage / autre
        sa.Column("type", sa.String(30), nullable=False),
        sa.Column("numero_compteur", sa.String(100), nullable=True),
        sa.Column("emplacement", sa.String(100), nullable=True),
        sa.Column("unite", sa.String(20), nullable=True),
        sa.Column("releve_initial", sa.Numeric(10, 2), nullable=True),
        sa.Column("date_releve_initial", sa.Date(), nullable=True),
        # partage : proprietaire / locataire / divise
        sa.Column("partage", sa.String(20), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
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
    op.create_index("ix_bien_compteurs_bien_id", "bien_compteurs", ["bien_id"])
    op.create_index("ix_bien_compteurs_bien_type", "bien_compteurs", ["bien_id", "type"])

    # ──────────────────────────────────────────────────────────────────────
    # 6. Migration de données : User.iban → bank_accounts (general, principal)
    # ──────────────────────────────────────────────────────────────────────
    # On crée 1 ligne `bank_accounts` par user qui a un iban non vide.
    # Le titulaire est calculé depuis bank_account_holder, sinon
    # first_name + last_name, sinon email. Tous marqués `est_principal=true`.
    # `gen_random_uuid()` requiert l'extension pgcrypto, déjà installée
    # dans le schéma 0001 initial.
    op.execute(
        """
        INSERT INTO bank_accounts (
            id, user_id, usage, iban, bic, titulaire,
            est_principal, banque_pays, created_at, updated_at, is_active
        )
        SELECT
            gen_random_uuid(),
            id,
            'general',
            iban,
            bic,
            COALESCE(
                NULLIF(bank_account_holder, ''),
                NULLIF(TRIM(COALESCE(first_name, '') || ' ' ||
                            COALESCE(last_name, '')), ''),
                email
            ),
            true,
            'CH',
            now(),
            now(),
            true
        FROM users
        WHERE iban IS NOT NULL AND iban <> ''
        """
    )


def downgrade() -> None:
    # 1. Drop tables (ordre inverse de création — pas de FK croisée mais
    #    respecte le style)
    op.drop_index("ix_bien_compteurs_bien_type", table_name="bien_compteurs")
    op.drop_index("ix_bien_compteurs_bien_id", table_name="bien_compteurs")
    op.drop_table("bien_compteurs")

    op.drop_index("ix_bank_accounts_user_principal_unique", table_name="bank_accounts")
    op.drop_index("ix_bank_accounts_user_principal", table_name="bank_accounts")
    op.drop_index("ix_bank_accounts_user_usage", table_name="bank_accounts")
    op.drop_index("ix_bank_accounts_user_id", table_name="bank_accounts")
    op.drop_table("bank_accounts")

    op.drop_index("ix_bien_contacts_bien_role", table_name="bien_contacts")
    op.drop_index("ix_bien_contacts_bien_id", table_name="bien_contacts")
    op.drop_table("bien_contacts")

    op.drop_index("ix_bien_annexes_bien_type", table_name="bien_annexes")
    op.drop_index("ix_bien_annexes_bien_id", table_name="bien_annexes")
    op.drop_table("bien_annexes")

    # 2. Drop les 28 colonnes `biens` dans l'ordre inverse
    for name, _ in reversed(NEW_BIEN_COLUMNS):
        op.drop_column("biens", name)
