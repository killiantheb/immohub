# Import all models so Base.metadata is fully populated for Alembic
from app.models.agency_settings import AgencySettings
from app.models.ai_log import AIUsageLog
from app.models.audit_log import AuditLog
from app.models.autonomy import AutonomySubscription
from app.models.base import Base, BaseModel
from app.models.bien import (
    Bien,
    BienDocument,
    BienEquipement,
    BienImage,
    CatalogueEquipement,
)
from app.models.company import Company, Quote
from app.models.contract import Contract
from app.models.conversation_message import ConversationMessage
from app.models.crm import CRMContact, CRMNote
from app.models.document_althy import DocumentAlthy
from app.models.favorite import Favorite
from app.models.inspection import Inspection
from app.models.intervention import Devis, Intervention
from app.models.candidature import Candidature
from app.models.interest import Interest
from app.models.listing import Listing
from app.models.locataire import DossierLocataire, Locataire
from app.models.mission_ouvreur import MissionOuvreur, ProfileOuvreur
from app.models.notification import Notification
from app.models.opener import Mission, Opener
from app.models.paiement import Paiement
from app.models.profile_artisan import ProfileArtisan
from app.models.document import DocumentTemplate, GeneratedDocument
from app.models.rating import Rating
from app.models.scoring import ScoringLocataire
from app.models.transaction import Transaction
from app.models.user import User

__all__ = [
    "Base",
    "BaseModel",
    "User",
    # Althy core
    "Bien",
    "BienImage",
    "BienDocument",
    "BienEquipement",
    "CatalogueEquipement",
    "Locataire",
    "DossierLocataire",
    "DocumentAlthy",
    "Paiement",
    "Intervention",
    "Devis",
    "MissionOuvreur",
    "ProfileOuvreur",
    "ProfileArtisan",
    "ScoringLocataire",
    "Notification",
    "Contract",
    "Transaction",
    "Opener",
    "Mission",
    "Company",
    "Quote",
    "Inspection",
    "Listing",
    "Interest",
    "Candidature",
    "AIUsageLog",
    "AuditLog",
    "ConversationMessage",
    "Rating",
    "Favorite",
    "AgencySettings",
    "DocumentTemplate",
    "GeneratedDocument",
    "CRMContact",
    "CRMNote",
    "AutonomySubscription",
]
