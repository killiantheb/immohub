"""Modèles SQLAlchemy — table biens et ses annexes (refonte fusion 2026-04-23).

Ce module contient l'ensemble des entités liées aux biens immobiliers Althy :
    Bien                   — fiche bien principale (43 colonnes, location annuelle)
    BienImage              — photos attachées à un bien (ex-property_images)
    BienDocument           — PDFs/docs attachés à un bien (ex-property_documents)
    BienEquipement         — jonction N:N entre un bien et le catalogue
    CatalogueEquipement    — catalogue global (49 items seedés, partagé)
    ChPostalCode           — référentiel NPA → canton CH (seed Phase 1 ~230 NPAs)
"""

from __future__ import annotations

import uuid

from app.models.base import BaseModel
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column


# ══════════════════════════════════════════════════════════════════════════════
# Enums
# ══════════════════════════════════════════════════════════════════════════════

BienType = Enum(
    "appartement",
    "villa",
    "studio",
    "maison",
    "commerce",
    "bureau",
    "parking",
    "garage",
    "cave",
    "autre",
    name="bien_type_enum",
)

BienStatut = Enum(
    "loue",
    "vacant",
    "en_travaux",
    name="bien_statut_enum",
)

ParkingType = Enum(
    "exterieur",
    "exterieur_couvert",
    "interieur",
    "interieur_box",
    name="parking_type_enum",
)


# ══════════════════════════════════════════════════════════════════════════════
# Bien — 43 colonnes
# ══════════════════════════════════════════════════════════════════════════════


class Bien(BaseModel):
    __tablename__ = "biens"

    # ── Relations & identité (6) ─────────────────────────────────────────────
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    agency_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
    )
    building_name: Mapped[str | None] = mapped_column(String(200))
    unit_number: Mapped[str | None] = mapped_column(String(20))
    reference_number: Mapped[str | None] = mapped_column(String(50))

    # ── Localisation (6) ──────────────────────────────────────────────────────
    adresse: Mapped[str] = mapped_column(String(300), nullable=False)
    ville: Mapped[str] = mapped_column(String(100), nullable=False)
    cp: Mapped[str] = mapped_column(String(10), nullable=False)
    canton: Mapped[str | None] = mapped_column(String(2))
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)

    # ── Type & statut (2) ─────────────────────────────────────────────────────
    type: Mapped[str] = mapped_column(BienType, nullable=False, default="appartement")
    statut: Mapped[str] = mapped_column(
        BienStatut, nullable=False, default="vacant", server_default="vacant"
    )

    # ── Caractéristiques (7) ──────────────────────────────────────────────────
    surface: Mapped[float | None] = mapped_column(Float)
    etage: Mapped[int | None] = mapped_column(Integer)
    rooms: Mapped[float | None] = mapped_column(Numeric(3, 1))
    bedrooms: Mapped[int | None] = mapped_column(Integer)
    bathrooms: Mapped[int | None] = mapped_column(Integer)
    annee_construction: Mapped[int | None] = mapped_column(Integer)
    annee_renovation: Mapped[int | None] = mapped_column(Integer)

    # ── Équipements (9) ──────────────────────────────────────────────────────
    is_furnished: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    has_balcony: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    has_terrace: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    has_garden: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    has_storage: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    has_fireplace: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    has_laundry_private: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    has_laundry_building: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    classe_energetique: Mapped[str | None] = mapped_column(String(2))

    # ── Parking (1) ──────────────────────────────────────────────────────────
    parking_type: Mapped[str | None] = mapped_column(ParkingType)

    # ── Règles (2) ────────────────────────────────────────────────────────────
    pets_allowed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    smoking_allowed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    # ── Situation & transports (6) ────────────────────────────────────────────
    distance_gare_minutes: Mapped[int | None] = mapped_column(Integer)
    distance_arret_bus_minutes: Mapped[int | None] = mapped_column(Integer)
    distance_telecabine_minutes: Mapped[int | None] = mapped_column(Integer)
    distance_lac_minutes: Mapped[int | None] = mapped_column(Integer)
    distance_aeroport_minutes: Mapped[int | None] = mapped_column(Integer)
    situation_notes: Mapped[str | None] = mapped_column(Text)

    # ── Présentation (3) ──────────────────────────────────────────────────────
    description_lieu: Mapped[str | None] = mapped_column(Text)
    description_logement: Mapped[str | None] = mapped_column(Text)
    remarques: Mapped[str | None] = mapped_column(Text)

    # ── Finances (3) — loyer, charges, dépôt ──────────────────────────────────
    loyer: Mapped[float | None] = mapped_column(Numeric(10, 2))
    charges: Mapped[float | None] = mapped_column(Numeric(10, 2))
    deposit: Mapped[float | None] = mapped_column(Numeric(12, 2))

    # ── Opérationnel (1) ──────────────────────────────────────────────────────
    keys_count: Mapped[int | None] = mapped_column(Integer, server_default="3")

    __table_args__ = (
        Index("ix_biens_agency_id", "agency_id"),
        Index("ix_biens_created_by_id", "created_by_id"),
        Index("ix_biens_canton", "canton"),
        Index("ix_biens_ville", "ville"),
        Index("ix_biens_cp", "cp"),
        CheckConstraint(
            "classe_energetique IS NULL OR classe_energetique ~ '^[A-G]$'",
            name="biens_classe_energetique_fmt",
        ),
        CheckConstraint(
            "annee_renovation IS NULL OR annee_construction IS NULL "
            "OR annee_renovation >= annee_construction",
            name="biens_annee_renovation_after_construction",
        ),
    )


# ══════════════════════════════════════════════════════════════════════════════
# BienImage — photos
# ══════════════════════════════════════════════════════════════════════════════


class BienImage(BaseModel):
    __tablename__ = "bien_images"

    bien_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("biens.id", ondelete="CASCADE"),
        nullable=False,
    )
    url: Mapped[str] = mapped_column(Text, nullable=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_cover: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    __table_args__ = (
        Index("ix_bien_images_bien_id", "bien_id"),
        Index("ix_bien_images_order", "bien_id", "order"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# BienDocument — PDFs et fichiers
# ══════════════════════════════════════════════════════════════════════════════


BienDocumentType = Enum(
    "bail",
    "etat_lieux",
    "assurance",
    "diagnostic",
    "facture",
    "autre",
    name="bien_document_type_enum",
    native_enum=False,  # stocké en VARCHAR côté DB (pas de type ENUM créé)
)


class BienDocument(BaseModel):
    __tablename__ = "bien_documents"

    bien_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("biens.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[str] = mapped_column(String(30), nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    __table_args__ = (
        Index("ix_bien_documents_bien_id", "bien_id"),
        Index("ix_bien_documents_type", "type"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# CatalogueEquipement — catalogue global (seedé dans la migration 0029)
# ══════════════════════════════════════════════════════════════════════════════


class CatalogueEquipement(BaseModel):
    __tablename__ = "catalogue_equipements"

    nom: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    categorie: Mapped[str] = mapped_column(String(30), nullable=False)
    icone: Mapped[str | None] = mapped_column(String(50))
    ordre_affichage: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )

    __table_args__ = (
        Index("ix_catalogue_equipements_categorie", "categorie"),
        CheckConstraint(
            "categorie IN ('cuisine', 'literie', 'salle_bain', 'tech', "
            "'loisirs', 'entretien', 'confort')",
            name="catalogue_equipements_categorie_valid",
        ),
    )


# ══════════════════════════════════════════════════════════════════════════════
# BienEquipement — jonction N:N (bien ⇄ catalogue)
# ══════════════════════════════════════════════════════════════════════════════


class BienEquipement(BaseModel):
    """Jonction N:N — attache un équipement du catalogue à un bien.

    N.B. : hérite de BaseModel pour la cohérence audit (id UUID + timestamps),
    mais `is_active` et `updated_at` sont peu utilisés ici. Le couple
    (bien_id, equipement_id) est UNIQUE.
    """

    __tablename__ = "bien_equipements"

    bien_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("biens.id", ondelete="CASCADE"),
        nullable=False,
    )
    equipement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("catalogue_equipements.id", ondelete="RESTRICT"),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("bien_id", "equipement_id", name="uq_bien_equipement"),
        Index("ix_bien_equipements_bien", "bien_id"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# ChPostalCode — référentiel NPA → canton (seedé dans la migration 0029)
# ══════════════════════════════════════════════════════════════════════════════


class ChPostalCode:
    """Référentiel NPA suisse. Table simple, pas d'héritage de BaseModel
    (pas d'audit nécessaire, la clé primaire est le code postal lui-même)."""

    # Note: cette classe n'étend pas BaseModel. Elle est définie via table()
    # ou mapping direct dans un fichier séparé si besoin. Pour le MVP, le
    # service bien_service.py interroge la table ch_postal_codes via SQL brut.
    # Si plus tard on veut un ORM, il suffit d'ajouter :
    #
    #   from app.models.base import Base
    #   class ChPostalCode(Base):
    #       __tablename__ = "ch_postal_codes"
    #       code_postal: Mapped[str] = mapped_column(String(4), primary_key=True)
    #       canton: Mapped[str] = mapped_column(String(2), nullable=False)
    #       ville_principale: Mapped[str] = mapped_column(String(100), nullable=False)
    #
    # Le stub est gardé ici pour documenter l'intention.
    pass
