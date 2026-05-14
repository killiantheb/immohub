"""Modèle SQLAlchemy — comptes bancaires multi-usage par utilisateur (PR-A11.A.6.a).

`BankAccount` permet à un utilisateur d'attacher plusieurs IBAN selon l'usage
métier (régie, cautions, charges, travaux, général). Source de vérité unique
pour les coordonnées bancaires côté Althy (Sprint 9 Lot A, 2026-05-14).

Cascade de résolution (cf `app.services.iban_resolver.get_effective_iban`) :
    Bien.iban_compte_id  ──>  bank_accounts.id (override par bien)
                          \
                           ─>  bank_accounts WHERE user_id = bien.owner_id
                                AND est_principal = true (défaut bailleur)
                          \
                           ─>  None (aucun IBAN → fallback Althy_QR_IBAN)

`User.iban_legacy` / `bic_legacy` / `bank_account_holder_legacy` restent
pour rétrocompatibilité (suppression Phase 2). Aucune écriture ne doit
plus toucher ces colonnes. Les migrations 0035 et 0050 ont seedé
`bank_accounts` (usage='general', est_principal=true) pour chaque user
qui avait un IBAN legacy non vide.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from app.models.base import BaseModel
from sqlalchemy import Boolean, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.models.user import User


class BankAccount(BaseModel):
    """Compte bancaire multi-usage attaché à un utilisateur.

    Note durcissement Phase 2 : l'iban est stocké en clair pour P1
    (cohérent état actuel `User.iban_legacy`). Phase 2 — chiffrement at-rest
    via Postgres pgcrypto ou solution KMS dédiée.
    """

    __tablename__ = "bank_accounts"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    # usage : regie / cautions / charges / travaux / general
    usage: Mapped[str] = mapped_column(
        String(30), nullable=False, default="general", server_default="general"
    )
    iban: Mapped[str] = mapped_column(String(34), nullable=False)
    bic: Mapped[str | None] = mapped_column(String(11))
    titulaire: Mapped[str] = mapped_column(String(200), nullable=False)
    banque_nom: Mapped[str | None] = mapped_column(String(150))
    banque_pays: Mapped[str] = mapped_column(
        String(2), nullable=False, default="CH", server_default="CH"
    )
    # Logique métier `est_principal` unique par user — non implémentée DB
    # (pas de UNIQUE partial index Phase 1) ; à enforcer service Phase 1.b.
    est_principal: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    user: Mapped[User] = relationship("User", back_populates="bank_accounts")

    __table_args__ = (
        Index("ix_bank_accounts_user_id", "user_id"),
        Index("ix_bank_accounts_user_usage", "user_id", "usage"),
        Index("ix_bank_accounts_user_principal", "user_id", "est_principal"),
    )
