"""Schémas Pydantic v2 — documents (GED Althy)."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

DocumentTypeLiteral = Literal[
    "bail", "edl_entree", "edl_sortie", "quittance",
    "attestation_assurance", "contrat_travail", "fiche_salaire",
    "extrait_poursuites", "attestation_caution", "autre",
]


class DocumentAlthyBase(BaseModel):
    bien_id: uuid.UUID | None = None
    locataire_id: uuid.UUID | None = None
    type: DocumentTypeLiteral
    url_storage: str
    date_document: date | None = None
    genere_par_ia: bool = False


class DocumentAlthyCreate(DocumentAlthyBase):
    pass


class DocumentAlthyUpdate(BaseModel):
    type: DocumentTypeLiteral | None = None
    url_storage: str | None = None
    date_document: date | None = None
    genere_par_ia: bool | None = None


class DocumentAlthyRead(DocumentAlthyBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
