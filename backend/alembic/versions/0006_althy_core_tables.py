"""Althy core tables — 13 tables du modèle métier.

Revision ID: 0006
Revises: 0005
Create Date: 2026-04-08
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. users — colonne adresse ─────────────────────────────────────────────
    op.add_column("users", sa.Column("adresse", sa.String(300), nullable=True))

    # ── Enums ──────────────────────────────────────────────────────────────────
    bien_type = postgresql.ENUM(
        "appartement", "villa", "studio", "maison", "commerce",
        "bureau", "parking", "garage", "cave", "autre",
        name="bien_type_enum", create_type=False,
    )
    bien_type.create(op.get_bind(), checkfirst=True)

    bien_statut = postgresql.ENUM(
        "loue", "vacant", "en_travaux",
        name="bien_statut_enum", create_type=False,
    )
    bien_statut.create(op.get_bind(), checkfirst=True)

    locataire_statut = postgresql.ENUM(
        "actif", "sorti",
        name="locataire_statut_enum", create_type=False,
    )
    locataire_statut.create(op.get_bind(), checkfirst=True)

    type_caution = postgresql.ENUM(
        "cash", "compte_bloque", "organisme",
        name="type_caution_enum", create_type=False,
    )
    type_caution.create(op.get_bind(), checkfirst=True)

    type_contrat = postgresql.ENUM(
        "cdi", "cdd", "independant", "retraite", "autre",
        name="type_contrat_enum", create_type=False,
    )
    type_contrat.create(op.get_bind(), checkfirst=True)

    doc_type = postgresql.ENUM(
        "bail", "edl_entree", "edl_sortie", "quittance",
        "attestation_assurance", "contrat_travail", "fiche_salaire",
        "extrait_poursuites", "attestation_caution", "autre",
        name="document_althy_type_enum", create_type=False,
    )
    doc_type.create(op.get_bind(), checkfirst=True)

    paiement_statut = postgresql.ENUM(
        "recu", "en_attente", "retard",
        name="paiement_statut_enum", create_type=False,
    )
    paiement_statut.create(op.get_bind(), checkfirst=True)

    intervention_categorie = postgresql.ENUM(
        "plomberie", "electricite", "menuiserie", "peinture",
        "serrurerie", "chauffage", "autre",
        name="intervention_categorie_enum", create_type=False,
    )
    intervention_categorie.create(op.get_bind(), checkfirst=True)

    intervention_urgence = postgresql.ENUM(
        "faible", "moderee", "urgente", "tres_urgente",
        name="intervention_urgence_enum", create_type=False,
    )
    intervention_urgence.create(op.get_bind(), checkfirst=True)

    intervention_statut = postgresql.ENUM(
        "nouveau", "en_cours", "planifie", "resolu",
        name="intervention_statut_enum", create_type=False,
    )
    intervention_statut.create(op.get_bind(), checkfirst=True)

    devis_statut = postgresql.ENUM(
        "en_attente", "accepte", "refuse",
        name="devis_statut_enum", create_type=False,
    )
    devis_statut.create(op.get_bind(), checkfirst=True)

    mission_type = postgresql.ENUM(
        "visite", "edl_entree", "edl_sortie", "remise_cles", "expertise",
        name="mission_ouvreur_type_enum", create_type=False,
    )
    mission_type.create(op.get_bind(), checkfirst=True)

    mission_statut = postgresql.ENUM(
        "proposee", "acceptee", "effectuee", "annulee",
        name="mission_ouvreur_statut_enum", create_type=False,
    )
    mission_statut.create(op.get_bind(), checkfirst=True)

    # ── 2. biens ───────────────────────────────────────────────────────────────
    op.create_table(
        "biens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("adresse", sa.String(300), nullable=False),
        sa.Column("ville", sa.String(100), nullable=False),
        sa.Column("cp", sa.String(10), nullable=False),
        sa.Column("type", sa.Enum(name="bien_type_enum"), nullable=False, server_default="appartement"),
        sa.Column("surface", sa.Float(), nullable=True),
        sa.Column("etage", sa.Integer(), nullable=True),
        sa.Column("loyer", sa.Numeric(10, 2), nullable=True),
        sa.Column("charges", sa.Numeric(10, 2), nullable=True),
        sa.Column("statut", sa.Enum(name="bien_statut_enum"), nullable=False, server_default="vacant"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_biens_owner_id", "biens", ["owner_id"])
    op.create_index("ix_biens_statut", "biens", ["statut"])

    # ── 3. locataires ─────────────────────────────────────────────────────────
    op.create_table(
        "locataires",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("bien_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("biens.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("date_entree", sa.Date(), nullable=True),
        sa.Column("date_sortie", sa.Date(), nullable=True),
        sa.Column("loyer", sa.Numeric(10, 2), nullable=True),
        sa.Column("charges", sa.Numeric(10, 2), nullable=True),
        sa.Column("depot_garantie", sa.Numeric(10, 2), nullable=True),
        sa.Column("type_caution", sa.Enum(name="type_caution_enum"), nullable=True),
        sa.Column("banque_caution", sa.String(200), nullable=True),
        sa.Column("iban_caution", sa.String(34), nullable=True),
        sa.Column("statut", sa.Enum(name="locataire_statut_enum"), nullable=False, server_default="actif"),
        sa.Column("motif_depart", sa.String(300), nullable=True),
        sa.Column("note_interne", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_locataires_bien_id", "locataires", ["bien_id"])
    op.create_index("ix_locataires_user_id", "locataires", ["user_id"])
    op.create_index("ix_locataires_statut", "locataires", ["statut"])

    # ── 4. dossiers_locataires ────────────────────────────────────────────────
    op.create_table(
        "dossiers_locataires",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("locataire_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("locataires.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("employeur", sa.String(200), nullable=True),
        sa.Column("poste", sa.String(200), nullable=True),
        sa.Column("type_contrat", sa.Enum(name="type_contrat_enum"), nullable=True),
        sa.Column("salaire_net", sa.Numeric(10, 2), nullable=True),
        sa.Column("anciennete", sa.Integer(), nullable=True),
        sa.Column("assureur_rc", sa.String(200), nullable=True),
        sa.Column("numero_police", sa.String(100), nullable=True),
        sa.Column("validite_assurance", sa.Date(), nullable=True),
        sa.Column("resultat_poursuites", sa.String(100), nullable=True),
        sa.Column("date_poursuites", sa.Date(), nullable=True),
        sa.Column("office_poursuites", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_dossiers_locataire_id", "dossiers_locataires", ["locataire_id"])

    # ── 5. documents ──────────────────────────────────────────────────────────
    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("bien_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("biens.id", ondelete="CASCADE"), nullable=True),
        sa.Column("locataire_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("locataires.id", ondelete="SET NULL"), nullable=True),
        sa.Column("type", sa.Enum(name="document_althy_type_enum"), nullable=False),
        sa.Column("url_storage", sa.Text(), nullable=False),
        sa.Column("date_document", sa.Date(), nullable=True),
        sa.Column("genere_par_ia", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_documents_bien_id", "documents", ["bien_id"])
    op.create_index("ix_documents_locataire_id", "documents", ["locataire_id"])
    op.create_index("ix_documents_type", "documents", ["type"])

    # ── 6. paiements ──────────────────────────────────────────────────────────
    op.create_table(
        "paiements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("locataire_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("locataires.id", ondelete="CASCADE"), nullable=False),
        sa.Column("bien_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("biens.id", ondelete="CASCADE"), nullable=False),
        sa.Column("mois", sa.String(7), nullable=False),
        sa.Column("montant", sa.Numeric(10, 2), nullable=False),
        sa.Column("date_echeance", sa.Date(), nullable=False),
        sa.Column("date_paiement", sa.Date(), nullable=True),
        sa.Column("statut", sa.Enum(name="paiement_statut_enum"), nullable=False, server_default="en_attente"),
        sa.Column("jours_retard", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_paiements_locataire_id", "paiements", ["locataire_id"])
    op.create_index("ix_paiements_bien_id", "paiements", ["bien_id"])
    op.create_index("ix_paiements_statut", "paiements", ["statut"])
    op.create_index("ix_paiements_mois", "paiements", ["mois"])

    # ── 7. interventions ──────────────────────────────────────────────────────
    op.create_table(
        "interventions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("bien_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("biens.id", ondelete="CASCADE"), nullable=False),
        sa.Column("signale_par_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("artisan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("titre", sa.String(300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("categorie", sa.Enum(name="intervention_categorie_enum"), nullable=False, server_default="autre"),
        sa.Column("urgence", sa.Enum(name="intervention_urgence_enum"), nullable=False, server_default="moderee"),
        sa.Column("statut", sa.Enum(name="intervention_statut_enum"), nullable=False, server_default="nouveau"),
        sa.Column("avancement", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("date_signalement", sa.Date(), nullable=True),
        sa.Column("date_intervention", sa.Date(), nullable=True),
        sa.Column("cout", sa.Numeric(10, 2), nullable=True),
        sa.Column("photos", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_interventions_bien_id", "interventions", ["bien_id"])
    op.create_index("ix_interventions_statut", "interventions", ["statut"])

    # ── 8. devis ──────────────────────────────────────────────────────────────
    op.create_table(
        "devis",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("intervention_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("interventions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("artisan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("montant", sa.Numeric(10, 2), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("statut", sa.Enum(name="devis_statut_enum"), nullable=False, server_default="en_attente"),
        sa.Column("date_envoi", sa.Date(), nullable=True),
        sa.Column("date_reponse", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_devis_intervention_id", "devis", ["intervention_id"])
    op.create_index("ix_devis_artisan_id", "devis", ["artisan_id"])

    # ── 9. missions_ouvreurs ──────────────────────────────────────────────────
    op.create_table(
        "missions_ouvreurs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("bien_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("biens.id", ondelete="CASCADE"), nullable=False),
        sa.Column("agence_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("ouvreur_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("type", sa.Enum(name="mission_ouvreur_type_enum"), nullable=False),
        sa.Column("date_mission", sa.String(20), nullable=True),
        sa.Column("creneau_debut", sa.Time(), nullable=True),
        sa.Column("creneau_fin", sa.Time(), nullable=True),
        sa.Column("nb_candidats", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("remuneration", sa.Numeric(8, 2), nullable=True),
        sa.Column("statut", sa.Enum(name="mission_ouvreur_statut_enum"), nullable=False, server_default="proposee"),
        sa.Column("rayon_km", sa.Integer(), nullable=False, server_default="20"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_missions_ouvreurs_bien_id", "missions_ouvreurs", ["bien_id"])
    op.create_index("ix_missions_ouvreurs_ouvreur_id", "missions_ouvreurs", ["ouvreur_id"])
    op.create_index("ix_missions_ouvreurs_statut", "missions_ouvreurs", ["statut"])

    # ── 10. profiles_ouvreurs ─────────────────────────────────────────────────
    op.create_table(
        "profiles_ouvreurs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("rayon_km", sa.Integer(), nullable=False, server_default="20"),
        sa.Column("jours_dispo", postgresql.ARRAY(sa.Integer()), nullable=True),
        sa.Column("heure_debut", sa.Time(), nullable=True),
        sa.Column("heure_fin", sa.Time(), nullable=True),
        sa.Column("types_missions", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("note_moyenne", sa.Float(), nullable=False, server_default="0"),
        sa.Column("nb_missions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("vehicule", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_profiles_ouvreurs_user_id", "profiles_ouvreurs", ["user_id"])

    # ── 11. profiles_artisans ─────────────────────────────────────────────────
    op.create_table(
        "profiles_artisans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("raison_sociale", sa.String(300), nullable=True),
        sa.Column("uid_ide", sa.String(20), nullable=True),
        sa.Column("numero_tva", sa.String(30), nullable=True),
        sa.Column("specialites", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("rayon_km", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("note_moyenne", sa.Float(), nullable=False, server_default="0"),
        sa.Column("nb_chantiers", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("assurance_rc", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("iban", sa.String(34), nullable=True),
        sa.Column("delai_paiement_jours", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_profiles_artisans_user_id", "profiles_artisans", ["user_id"])

    # ── 12. scoring_locataires ────────────────────────────────────────────────
    op.create_table(
        "scoring_locataires",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("locataire_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("locataires.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("ponctualite", sa.Float(), nullable=False, server_default="5"),
        sa.Column("solvabilite", sa.Float(), nullable=False, server_default="5"),
        sa.Column("communication", sa.Float(), nullable=False, server_default="5"),
        sa.Column("etat_logement", sa.Float(), nullable=False, server_default="5"),
        sa.Column("score_global", sa.Float(), nullable=False, server_default="5"),
        sa.Column("nb_retards", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_scoring_locataires_locataire_id", "scoring_locataires", ["locataire_id"])

    # ── 13. notifications ─────────────────────────────────────────────────────
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(100), nullable=False),
        sa.Column("titre", sa.String(300), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("lu", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("lien", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_lu", "notifications", ["lu"])

    # ── Row Level Security (enable) ───────────────────────────────────────────
    for table in [
        "biens", "locataires", "dossiers_locataires", "documents",
        "paiements", "interventions", "devis", "missions_ouvreurs",
        "profiles_ouvreurs", "profiles_artisans", "scoring_locataires",
        "notifications",
    ]:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")


def downgrade() -> None:
    tables = [
        "notifications", "scoring_locataires", "profiles_artisans",
        "profiles_ouvreurs", "missions_ouvreurs", "devis", "interventions",
        "paiements", "documents", "dossiers_locataires", "locataires", "biens",
    ]
    for table in tables:
        op.drop_table(table)

    op.drop_column("users", "adresse")

    for enum_name in [
        "bien_type_enum", "bien_statut_enum", "locataire_statut_enum",
        "type_caution_enum", "type_contrat_enum", "document_althy_type_enum",
        "paiement_statut_enum", "intervention_categorie_enum",
        "intervention_urgence_enum", "intervention_statut_enum",
        "devis_statut_enum", "mission_ouvreur_type_enum",
        "mission_ouvreur_statut_enum",
    ]:
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")
