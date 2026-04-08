"""Schémas Pydantic v2 — documents (GED Althy)."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict

DocumentTypeLiteral = Literal[
    "bail", "edl_entree", "edl_sortie", "quittance",
    "attestation_assurance", "contrat_travail", "fiche_salaire",
    "extrait_poursuites", "attestation_caution", "autre",
]


class DocumentAlthyBase(BaseModel):
    bien_id: Optional[uuid.UUID] = None
    locataire_id: Optional[uuid.UUID] = None
    type: DocumentTypeLiteral
    url_storage: str
    date_document: Optional[date] = None
    genere_par_ia: bool = False


class DocumentAlthyCreate(DocumentAlthyBase):
    pass


class DocumentAlthyUpdate(BaseModel):
    type: Optional[DocumentTypeLiteral] = None
    url_storage: Optional[str] = None
    date_document: Optional[date] = None
    genere_par_ia: Optional[bool] = None


class DocumentAlthyRead(DocumentAlthyBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
