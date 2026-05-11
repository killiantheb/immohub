"""Pydantic schemas — bien_messages (Module Communication Phase 1.0).

Cf `app/routers/bien_messages.py` pour les endpoints,
   `app/models/bien_message.py` pour le model ORM,
   `alembic/versions/0040_bien_messages.py` pour la migration.

Body limites Phase 1.0 :
  - longueur min : 1 char (validateur strip → empêche " " ou "\\n")
  - longueur max : 5000 chars (limite UI raisonnable, ajustable Phase 2 si
    besoin terrain — la DB elle-même n'impose pas de limite, c'est juste
    un garde-fou applicatif)
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


_BODY_MAX = 5000


class _UserMini(BaseModel):
    """Sous-objet exposé sur BienMessageRead pour affichage UI (sender/recipient)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    first_name: str | None = None
    last_name: str | None = None


class BienMessageCreate(BaseModel):
    """Payload POST /api/v1/biens/{bien_id}/messages.

    `bien_id` vient du path, `sender_user_id` vient de current_user (auth).
    Seuls `recipient_user_id` et `body` sont fournis par le client.
    """

    recipient_user_id: uuid.UUID
    body: str = Field(..., min_length=1, max_length=_BODY_MAX)

    @field_validator("body")
    @classmethod
    def _strip_and_validate_body(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("body must not be blank after trim")
        if len(v) > _BODY_MAX:
            raise ValueError(f"body must be at most {_BODY_MAX} characters")
        return v


class BienMessageRead(BaseModel):
    """Représentation d'un message (avec sender/recipient mini si chargés)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    bien_id: uuid.UUID
    sender_user_id: uuid.UUID
    recipient_user_id: uuid.UUID
    body: str
    lu: bool
    lu_at: datetime | None = None
    created_at: datetime

    sender: _UserMini | None = None
    recipient: _UserMini | None = None


class BienMessageThreadResponse(BaseModel):
    """Réponse GET /api/v1/biens/{bien_id}/messages."""

    messages: list[BienMessageRead]
    total: int
    unread_count: int  # count des messages non-lus côté current_user


class MarkThreadReadResponse(BaseModel):
    """Réponse PATCH /api/v1/biens/{bien_id}/messages/marquer-lus."""

    marked_count: int


class UnreadCountResponse(BaseModel):
    """Réponse GET /api/v1/bien_messages/non-lus."""

    count: int
