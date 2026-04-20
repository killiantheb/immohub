"""Service artisan marketplace (M1) — subscribe + founding logic + matching + T2.

Règle Uber : les 50 premiers artisans actifs par canton entrent en plan
`artisan_free_early` (gratuit à vie). Au-delà : `artisan_verified` (CHF 49/mois).

Le statut `is_founding_member` est figé au moment de la souscription —
un artisan fondateur reste fondateur même si 500 autres s'inscrivent après.

Commission T2 : 5% retenue sur chaque facture finale d'intervention,
le reste (95%) reversé à l'artisan via Stripe Connect Express (transfer_data).
"""

from __future__ import annotations

import datetime as dt
import logging
import uuid
from decimal import Decimal

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.profile_artisan import ProfileArtisan

logger = logging.getLogger("althy.artisan")

FOUNDING_SPOTS_PER_CANTON = 50
VALID_PLANS = ("artisan_free_early", "artisan_verified")
VALID_CANTONS = {
    "GE", "VD", "VS", "NE", "FR", "JU", "BE", "ZH", "BS", "BL", "AG",
    "AR", "AI", "GL", "GR", "LU", "NW", "OW", "SG", "SH", "SO", "SZ",
    "TG", "TI", "UR", "ZG",
}


class ArtisanError(Exception):
    """Erreur métier artisan."""


async def count_founding_in_canton(db: AsyncSession, canton: str) -> int:
    """Nombre d'artisans fondateurs actifs dans un canton."""
    q = select(func.count(ProfileArtisan.id)).where(
        ProfileArtisan.canton == canton,
        ProfileArtisan.is_founding_member.is_(True),
        ProfileArtisan.subscription_plan == "artisan_free_early",
    )
    result = await db.execute(q)
    return int(result.scalar_one() or 0)


async def founding_spots_remaining(db: AsyncSession, canton: str) -> int:
    """Places fondateurs restantes dans un canton (max 50)."""
    taken = await count_founding_in_canton(db, canton)
    return max(0, FOUNDING_SPOTS_PER_CANTON - taken)


async def subscribe(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    canton: str,
    specialties: list[str],
    desired_plan: str = "artisan_free_early",
) -> tuple[ProfileArtisan, bool]:
    """Souscrit un artisan au marketplace M1.

    Retourne (profile, is_newly_founding).

    Logique :
      - canton doit être valide CH (26 cantons)
      - si desired_plan = artisan_free_early et places restantes > 0
        → is_founding_member = true, plan = artisan_free_early
      - sinon → plan = artisan_verified (CHF 49, paiement requis)
    """
    if canton not in VALID_CANTONS:
        raise ArtisanError(f"Canton invalide : {canton}")
    if desired_plan not in VALID_PLANS:
        raise ArtisanError(f"Plan invalide : {desired_plan}")

    # Récupère le profil existant (créé à l'inscription) ou en crée un
    result = await db.execute(
        select(ProfileArtisan).where(ProfileArtisan.user_id == user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        profile = ProfileArtisan(user_id=user_id)
        db.add(profile)
        await db.flush()

    # Détermine le plan final
    is_newly_founding = False
    if desired_plan == "artisan_free_early":
        remaining = await founding_spots_remaining(db, canton)
        if remaining > 0 and not profile.is_founding_member:
            profile.subscription_plan = "artisan_free_early"
            profile.is_founding_member = True
            is_newly_founding = True
        else:
            # Canton plein → fallback payant
            profile.subscription_plan = "artisan_verified"
    else:
        profile.subscription_plan = "artisan_verified"

    profile.canton = canton
    profile.specialties = specialties
    profile.subscription_activated_at = dt.datetime.now(dt.timezone.utc)

    await db.flush()
    await db.refresh(profile)
    logger.info(
        "artisan.subscribed user=%s canton=%s plan=%s founding=%s",
        user_id, canton, profile.subscription_plan, profile.is_founding_member,
    )
    return profile, is_newly_founding


# ── Matching RFQ → artisans ─────────────────────────────────────────────────


async def match_artisans_for_rfq(
    db: AsyncSession,
    *,
    canton: str | None,
    specialty: str | None,
    limit: int = 20,
) -> list[ProfileArtisan]:
    """Retourne les artisans éligibles à une RFQ (request for quote).

    Filtres :
      - subscription_plan actif (not NULL)
      - canton match (si fourni)
      - specialty dans specialties[] (si fourni)
      - tri : fondateurs d'abord (visibilité lancement) puis note_moyenne desc
    """
    conditions = [ProfileArtisan.subscription_plan.isnot(None)]
    if canton:
        conditions.append(ProfileArtisan.canton == canton)
    if specialty:
        # ARRAY overlap via SQL `?` operator (jsonb) ou `@>` (array).
        # On utilise `= any(specialties)` pour du text[].
        conditions.append(text("(:specialty) = any(profiles_artisans.specialties)").bindparams(specialty=specialty))

    q = (
        select(ProfileArtisan)
        .where(*conditions)
        .order_by(
            ProfileArtisan.is_founding_member.desc(),
            ProfileArtisan.note_moyenne.desc(),
        )
        .limit(limit)
    )
    result = await db.execute(q)
    return list(result.scalars().all())


# ── Stripe Connect Express (T2 marketplace) ─────────────────────────────────


async def create_stripe_connect_link(profile: ProfileArtisan) -> dict:
    """Crée (ou récupère) un compte Stripe Connect Express pour l'artisan
    et retourne l'URL d'onboarding hébergée.

    Appelé depuis /artisan/stripe-connect/onboard. Nécessite STRIPE_SECRET_KEY.
    """
    import stripe
    stripe.api_key = settings.STRIPE_SECRET_KEY

    if not profile.stripe_connect_id:
        account = stripe.Account.create(
            type="express",
            country="CH",
            capabilities={
                "card_payments": {"requested": True},
                "transfers":     {"requested": True},
            },
            business_type="company",
            metadata={"althy_profile_id": str(profile.id), "role": "artisan"},
        )
        profile.stripe_connect_id = account.id

    link = stripe.AccountLink.create(
        account=profile.stripe_connect_id,
        refresh_url=f"{settings.FRONTEND_URL}/app/artisans/profil?stripe=refresh",
        return_url=f"{settings.FRONTEND_URL}/app/artisans/profil?stripe=done",
        type="account_onboarding",
    )
    return {"account_id": profile.stripe_connect_id, "url": link.url}


def compute_commission(gross_amount_chf: Decimal | float | int) -> tuple[Decimal, Decimal]:
    """Retourne (commission_althy, net_artisan) pour un montant brut TTC.

    Commission : 5% par défaut (settings.STRIPE_ARTISAN_FEE_PCT).
    """
    gross = Decimal(str(gross_amount_chf))
    fee_pct = Decimal(str(settings.STRIPE_ARTISAN_FEE_PCT))
    commission = (gross * fee_pct / Decimal(100)).quantize(Decimal("0.01"))
    net = (gross - commission).quantize(Decimal("0.01"))
    return commission, net


async def settle_intervention_payment(
    db: AsyncSession,
    *,
    artisan_profile: ProfileArtisan,
    owner_payment_method_id: str,
    gross_amount_chf: float,
    intervention_id: uuid.UUID,
    description: str = "Intervention Althy",
) -> dict:
    """Crée un PaymentIntent côté propriétaire avec transfert 95% à l'artisan.

    Retient 5% sur le compte plateforme Althy via `application_fee_amount`.
    N'est appelable que si `artisan.stripe_connect_ready = true`.
    """
    if not artisan_profile.stripe_connect_id or not artisan_profile.stripe_connect_ready:
        raise ArtisanError("L'artisan n'a pas finalisé son onboarding Stripe Connect")

    import stripe
    stripe.api_key = settings.STRIPE_SECRET_KEY

    commission_chf, _ = compute_commission(gross_amount_chf)
    amount_cents = int(round(gross_amount_chf * 100))
    fee_cents = int(round(float(commission_chf) * 100))

    intent = stripe.PaymentIntent.create(
        amount=amount_cents,
        currency="chf",
        payment_method=owner_payment_method_id,
        confirm=True,
        off_session=True,
        application_fee_amount=fee_cents,
        transfer_data={"destination": artisan_profile.stripe_connect_id},
        description=description,
        metadata={
            "althy_intervention_id": str(intervention_id),
            "althy_artisan_id":      str(artisan_profile.id),
            "althy_commission_chf":  str(commission_chf),
        },
    )
    logger.info(
        "artisan.settle intervention=%s gross=%s commission=%s artisan=%s",
        intervention_id, gross_amount_chf, commission_chf, artisan_profile.id,
    )
    return {
        "payment_intent_id": intent.id,
        "status": intent.status,
        "gross_chf": float(gross_amount_chf),
        "commission_chf": float(commission_chf),
        "net_artisan_chf": float(gross_amount_chf) - float(commission_chf),
    }
