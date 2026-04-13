import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base

class OnboardingScan(Base):
    __tablename__ = "onboarding_scans"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id         = Column(UUID(as_uuid=True), nullable=False, index=True)
    status          = Column(String(30), default="pending")
    # pending → scan en cours
    # pending_review → terminé, attente validation user
    # done → importé
    elements_trouves = Column(Text, nullable=True)  # JSON
    nb_elements      = Column(Integer, default=0)
    created_at       = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
