"""Schémas Pydantic v2 — notifications."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationBase(BaseModel):
    user_id: uuid.UUID
    type: str
    titre: str
    message: str
    lu: bool = False
    lien: str | None = None


class NotificationCreate(NotificationBase):
    pass


class NotificationUpdate(BaseModel):
    lu: bool | None = None


class NotificationRead(NotificationBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
