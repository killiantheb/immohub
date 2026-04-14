"""Sphere IA router — /api/v1/sphere"""

from __future__ import annotations

import json
import uuid as _uuid
from datetime import date, timedelta
from typing import Annotated, Any

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.limiter import rate_limit
from app.models.user import User
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/sphere", tags=["sphere"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
AuthUserDep = Annotated[User, Depends(get_current_user)]

# ── Role mappings ─────────────────────────────────────────────────────────────

_ROLE_FR = {
    "proprio_solo": "propriétaire solo",
    "agence": "agence immobilière",
    "portail_proprio": "propriétaire via agence",
    "opener": "ouvreur",
    "artisan": "artisan",
    "expert": "expert immobilier",
    "hunter": "hunter",
    "locataire": "locataire",
    "acheteur_premium": "acheteur premium",
    # legacy
    "owner": "propriétaire",
    "agency": "agence immobilière",
    "tenant": "locataire",
    "company": "artisan",
}


# ── Helpers ───────────────────────────────────────────────────────────────────


def _uid(user: User) -> str:
    return str(user.id)


async def _fetch_context(user: User, db: AsyncSession) -> dict[str, Any]:
    """Pull lightweight real-data context used to prompt Claude."""
    ctx: dict[str, Any] = {}
    uid = user.id
    role = user.role
    today = date.today()

    try:
        if role in ("proprio_solo", "owner", "agence", "agency", "portail_proprio"):
            # Late transactions
            rows = await db.execute(
                text("""
                    SELECT id, amount, due_date, reference
                    FROM transactions
                    WHERE owner_id = :uid AND status IN ('pending','late')
                      AND due_date <= :today AND is_active = true
                    LIMIT 5
                """),
                {"uid": uid, "today": today},
            )
            ctx["late_transactions"] = [
                {
                    "id": str(r.id),
                    "amount": float(r.amount),
                    "due_date": r.due_date.isoformat() if r.due_date else None,
                    "href": "/app/finances?filter=impaye",
                }
                for r in rows
            ]

            # Expiring contracts (60 days)
            rows = await db.execute(
                text("""
                    SELECT id, end_date, monthly_rent, property_id
                    FROM contracts
                    WHERE owner_id = :uid AND status = 'active'
                      AND end_date IS NOT NULL
                      AND end_date BETWEEN :today AND :future
                    LIMIT 3
                """),
                {"uid": uid, "today": today, "future": today + timedelta(days=60)},
            )
            ctx["expiring_contracts"] = [
                {
                    "id": str(r.id),
                    "end_date": r.end_date.isoformat(),
                    "monthly_rent": float(r.monthly_rent or 0),
                    "href": f"/app/biens/{r.property_id}?tab=locataire",
                }
                for r in rows
            ]

            # Pending interventions
            rows = await db.execute(
                text("""
                    SELECT i.id, i.bien_id, i.titre, i.urgence, i.statut
                    FROM interventions i
                    JOIN biens b ON b.id = i.bien_id
                    WHERE b.owner_id = :uid
                      AND i.statut IN ('nouveau', 'en_cours')
                    LIMIT 5
                """),
                {"uid": uid},
            )
            ctx["pending_interventions"] = [
                {
                    "id": str(r.id),
                    "titre": r.titre,
                    "urgence": r.urgence,
                    "statut": r.statut,
                    "href": f"/app/biens/{r.bien_id}?tab=interventions",
                }
                for r in rows
            ]

            # Vacant properties
            rows = await db.execute(
                text("""
                    SELECT id, address, city, monthly_rent
                    FROM properties
                    WHERE owner_id = :uid AND status = 'available' AND is_active = true
                    LIMIT 3
                """),
                {"uid": uid},
            )
            ctx["vacant_properties"] = [
                {"id": str(r.id), "address": r.address, "city": r.city}
                for r in rows
            ]

        elif role == "locataire":
            rows = await db.execute(
                text("""
                    SELECT id, amount, due_date FROM transactions
                    WHERE tenant_id = :uid AND status = 'pending' AND due_date >= :today
                    ORDER BY due_date LIMIT 3
                """),
                {"uid": uid, "today": today},
            )
            ctx["upcoming_payments"] = [
                {"id": str(r.id), "amount": float(r.amount), "due_date": r.due_date.isoformat()}
                for r in rows
            ]

        elif role == "opener":
            rows = await db.execute(
                text("""
                    SELECT id, type, scheduled_at, price FROM missions
                    WHERE status = 'pending' AND opener_id IS NULL
                    LIMIT 5
                """),
            )
            ctx["available_missions"] = [
                {"id": str(r.id), "type": r.type, "price": float(r.price or 0)}
                for r in rows
            ]

        elif role == "artisan":
            rows = await db.execute(
                text("""
                    SELECT id, title, category, city, budget_max, urgency FROM rfqs
                    WHERE status = 'published'
                    LIMIT 5
                """),
            )
            ctx["open_rfqs"] = [
                {"id": str(r.id), "title": r.title, "category": r.category, "city": r.city, "urgency": r.urgency}
                for r in rows
            ]

    except Exception:
        pass  # context is best-effort

    return ctx


async def _generate_sphere_actions(user: User, ctx: dict, db: AsyncSession) -> dict:
    """Call Claude to produce Sphere actions in the new SphereAction format."""
    from app.services.ai_service import _client, MODEL, _log_usage  # type: ignore[attr-defined]

    first_name = user.first_name or (user.email or "").split("@")[0]
    role_fr = _ROLE_FR.get(user.role, user.role)

    prompt = f"""Tu es Althy, l'assistant IA immobilier suisse.
Génère un briefing pour {first_name}, {role_fr}.

Données en temps réel :
{json.dumps(ctx, ensure_ascii=False, indent=2)}

Retourne UNIQUEMENT ce JSON valide (aucun texte avant/après) :
{{
  "summary": "Message d'accueil ultra-court et personnalisé (max 70 chars)",
  "actions": [
    {{
      "id": "uuid ou identifiant unique",
      "type": "paiement_action|document_action|messagerie_action|intervention_action|agenda_action|validation_action|notation_action|integration_action|info",
      "urgence": "haute|normale|info",
      "titre": "Titre court de l'action",
      "description": "Description utile, 1-2 phrases",
      "cta_principal": "Libellé bouton principal",
      "cta_secondaire": "Libellé bouton secondaire (optionnel)",
      "href": "/app/page?param=valeur (optionnel — deep-link de navigation, voir règles ci-dessous)",
      "payload": {{"id": "uuid_si_besoin"}}
    }}
  ]
}}

Règles :
- 2 à 5 actions maximum, uniquement les plus prioritaires
- urgence "haute" = rouge, "normale" = bleu, "info" = gris
- Si données vides : propose 1-2 actions utiles selon le rôle
- Chemins français : /app/biens, /app/finances, /app/documents, /app/comptabilite, /app/ouvreurs, /app/artisans, /app/sphere
- Réponds en français, sois concis et bienveillant
- Les IDs dans payload doivent correspondre à de vrais IDs si disponibles dans le contexte
- Champ "href" (deep-link) — utilise UNIQUEMENT pour les types de navigation (pas pour messagerie/document/whatsapp) :
  * Loyers impayés / transactions en retard → href: "/app/finances?status=late"
  * Interventions en cours sur un bien précis → href: "/app/biens/{{bien_id}}?tab=interventions"
  * Documents à générer → href: "/app/documents?action=generer"
  * Bail expirant sur un bien précis → href: "/app/biens/{{bien_id}}?tab=locataire"
  * Bien vacant → href: "/app/biens/{{bien_id}}"
  * Missions ouvreurs → href: "/app/ouvreurs/missions"
  * Devis artisan → href: "/app/artisans/devis"
- Omets "href" pour messagerie_action, whatsapp_action, document_action, validation_action, ocr_action (ces types ouvrent des panneaux inline)"""

    client = _client()
    message = await client.messages.create(
        model=MODEL,
        max_tokens=1200,
        messages=[{"role": "user", "content": prompt}],
    )

    await _log_usage(db, _uid(user), "sphere_briefing", message.usage)

    raw = message.content[0].text.strip()  # type: ignore[union-attr]
    if "```" in raw:
        raw = raw.split("```")[1].lstrip("json").strip()

    try:
        return json.loads(raw)
    except Exception:
        return {
            "summary": f"Bonjour {first_name}",
            "actions": [
                {
                    "id": str(_uuid.uuid4()),
                    "type": "info",
                    "urgence": "info",
                    "titre": "Bienvenue sur Althy",
                    "description": "Votre assistant immobilier est prêt. Posez-lui une question ou explorez vos biens.",
                    "cta_principal": "Voir mes biens",
                    "payload": {"path": "/app/biens"},
                }
            ],
        }


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/briefing")
async def get_briefing(
    current_user: AuthUserDep,
    db: DbDep,
    _=rate_limit(10, 60),
) -> dict:
    """Briefing quotidien personnalisé — actions prioritaires pour la Sphère."""
    today = date.today()

    # Try cache first (today's briefing)
    try:
        row = await db.execute(
            text("""
                SELECT summary, actions FROM ai_briefing_cache
                WHERE user_id = :uid AND date = :today AND expires_at > now()
                LIMIT 1
            """),
            {"uid": current_user.id, "today": today},
        )
        cached = row.one_or_none()
        if cached:
            actions = cached.actions if isinstance(cached.actions, list) else json.loads(cached.actions or "[]")
            return {"summary": cached.summary, "actions": actions}
    except Exception:
        pass

    ctx = await _fetch_context(current_user, db)
    try:
        result = await _generate_sphere_actions(current_user, ctx, db)
    except Exception as exc:
        first_name = current_user.first_name or (current_user.email or "").split("@")[0]
        return {
            "summary": f"Bonjour {first_name}",
            "actions": [
                {
                    "id": str(_uuid.uuid4()),
                    "type": "info",
                    "urgence": "info",
                    "titre": "Bienvenue sur Althy",
                    "description": "Votre assistant immobilier est prêt. Posez-lui une question ou explorez vos biens.",
                    "cta_principal": "Voir mes biens",
                    "payload": {"path": "/app/biens"},
                }
            ],
            "_error": str(exc),
        }

    # Cache for today
    try:
        actions_json = json.dumps(result.get("actions", []))
        pending_count = sum(1 for a in result.get("actions", []) if a.get("urgence") == "haute")
        await db.execute(
            text("""
                INSERT INTO ai_briefing_cache
                    (id, user_id, date, summary, actions, pending_count, expires_at)
                VALUES
                    (:id, :uid, :today, :summary, :actions, :pending_count, now() + interval '20 hours')
                ON CONFLICT (user_id, date) DO UPDATE
                    SET summary = EXCLUDED.summary,
                        actions = EXCLUDED.actions,
                        pending_count = EXCLUDED.pending_count,
                        expires_at = EXCLUDED.expires_at,
                        generated_at = now()
            """),
            {
                "id": _uuid.uuid4(),
                "uid": current_user.id,
                "today": today,
                "summary": result.get("summary", ""),
                "actions": actions_json,
                "pending_count": pending_count,
            },
        )
        await db.commit()
    except Exception:
        pass

    return result


@router.get("/pending-count")
async def get_pending_count(
    current_user: AuthUserDep,
    db: DbDep,
) -> dict:
    """Nombre d'actions en attente pour le badge du widget flottant."""
    try:
        row = await db.execute(
            text("""
                SELECT actions, pending_count FROM ai_briefing_cache
                WHERE user_id = :uid AND expires_at > now()
                ORDER BY generated_at DESC LIMIT 1
            """),
            {"uid": current_user.id},
        )
        cached = row.one_or_none()
        if cached:
            actions = cached.actions if isinstance(cached.actions, list) else json.loads(cached.actions or "[]")
            urgent = [a for a in actions if a.get("urgence") == "haute"]
            return {"count": len(urgent), "actions": urgent[:3]}
    except Exception:
        pass

    return {"count": 0, "actions": []}


class ExecPayload(BaseModel):
    action_id: str
    type: str | None = None
    payload: dict | None = None


@router.post("/executer")
async def executer_action(
    body: ExecPayload,
    current_user: AuthUserDep,
    db: DbDep,
) -> dict:
    """Enregistre l'exécution d'une action Sphère."""
    try:
        merged_payload = {"action_id": body.action_id, **(body.payload or {})}
        await db.execute(
            text("""
                INSERT INTO ai_actions (id, user_id, action_type, status, payload, executed_at)
                VALUES (:id, :uid, :atype, 'executed', :payload, now())
            """),
            {
                "id": _uuid.uuid4(),
                "uid": current_user.id,
                "atype": body.type or "unknown",
                "payload": json.dumps(merged_payload),
            },
        )
        await db.commit()
    except Exception:
        pass

    return {"ok": True}


class RegenerPayload(BaseModel):
    action_id: str


@router.post("/regenerer")
async def regenerer_action(
    body: RegenerPayload,
    current_user: AuthUserDep,
    db: DbDep,
    _=rate_limit(10, 60),
) -> dict:
    """Régénère le texte IA d'une action (après modification utilisateur)."""
    # Invalidate today's cache so next briefing call regenerates
    try:
        await db.execute(
            text("DELETE FROM ai_briefing_cache WHERE user_id = :uid AND date = :today"),
            {"uid": current_user.id, "today": date.today()},
        )
        await db.commit()
    except Exception:
        pass

    return {"ok": True, "message": "Cache invalidé — prochain briefing régénéré"}


class PreferencePayload(BaseModel):
    cle: str
    valeur: Any


@router.post("/preference")
async def save_preference(
    body: PreferencePayload,
    current_user: AuthUserDep,
    db: DbDep,
) -> dict:
    """Mémorise une préférence utilisateur apprise par la Sphère."""
    try:
        await db.execute(
            text("""
                INSERT INTO ai_user_preferences (id, user_id, cle, valeur)
                VALUES (:id, :uid, :cle, :valeur)
                ON CONFLICT (user_id, cle) DO UPDATE SET valeur = EXCLUDED.valeur, updated_at = now()
            """),
            {
                "id": _uuid.uuid4(),
                "uid": current_user.id,
                "cle": body.cle,
                "valeur": json.dumps(body.valeur),
            },
        )
        await db.commit()
    except Exception:
        pass

    return {"ok": True}
