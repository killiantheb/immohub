"""Sphere Agent — /api/v1/sphere (v2 complet)

Agent IA autonome qui :
  1. Charge un contexte riche par rôle (biens, locataires, paiements, interventions,
     baux, emails, WA, missions, devis, chantiers, agenda, préférences).
  2. Génère un briefing via Claude Sonnet avec cache MD5.
  3. Exécute les actions et génère des notation_action automatiques.
  4. Régénère le texte d'une action avec une instruction libre.

Remplace sphere.py — enregistrer avec prefix="/api/v1".
"""

from __future__ import annotations

import hashlib
import json
import re as _re
import uuid as _uuid
from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Any

import anthropic
from app.core.config import settings
from app.core.database import get_db
from app.core.limiter import rate_limit
from app.core.security import get_current_user
from app.models.user import User
from app.services.ai_service import chat_stream
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/sphere", tags=["sphere"])

DbDep      = Annotated[AsyncSession, Depends(get_db)]
AuthDep    = Annotated[User, Depends(get_current_user)]

# ── Constants ─────────────────────────────────────────────────────────────────

_MODEL = "claude-sonnet-4-20250514"

_ROLE_FR: dict[str, str] = {
    "proprio_solo":    "propriétaire solo",
    "agence":          "agence immobilière",
    "portail_proprio": "propriétaire via agence",
    "opener":          "ouvreur",
    "artisan":         "artisan",
    "expert":          "expert immobilier",
    "hunter":          "hunter / apporteur de leads",
    "locataire":       "locataire",
    "acheteur_premium":"acheteur premium",
    # legacy
    "owner":           "propriétaire",
    "agency":          "agence immobilière",
    "tenant":          "locataire",
    "company":         "artisan",
}

_MANAGER_ROLES = {"proprio_solo", "agence", "portail_proprio", "owner", "agency"}
_OPENER_ROLES  = {"opener"}
_ARTISAN_ROLES = {"artisan", "company"}
_HUNTER_ROLES  = {"hunter"}
_TENANT_ROLES  = {"locataire", "tenant"}
_BUYER_ROLES   = {"acheteur_premium"}
_EXPERT_ROLES  = {"expert"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _uid(user: User) -> _uuid.UUID:
    return user.id  # type: ignore[return-value]


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _ctx_hash(ctx: dict) -> str:
    raw = json.dumps(ctx, sort_keys=True, default=str).encode()
    return hashlib.md5(raw).hexdigest()


def _client() -> anthropic.AsyncAnthropic:
    return anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)


async def _log_usage(db: AsyncSession, user_id: _uuid.UUID, feature: str, usage: Any) -> None:
    try:
        from app.services.ai_service import _log_usage as _svc_log  # type: ignore[attr-defined]
        await _svc_log(db, str(user_id), feature, usage)
    except Exception:
        pass


# ═══════════════════════════════════════════════════════════════════════════════
# CONTEXT LOADER
# ═══════════════════════════════════════════════════════════════════════════════

async def _load_context(user: User, db: AsyncSession) -> dict[str, Any]:  # noqa: C901
    """Charge toutes les données pertinentes selon le rôle — best-effort."""
    ctx: dict[str, Any] = {}
    uid   = _uid(user)
    role  = user.role or ""
    today = date.today()

    # ── Propriétaires & Agences ───────────────────────────────────────────────
    if role in _MANAGER_ROLES:

        # Biens
        try:
            rows = await db.execute(
                text("""
                    SELECT id, adresse, ville, statut, loyer
                    FROM biens
                    WHERE owner_id = :uid AND is_active = true
                    ORDER BY created_at DESC
                    LIMIT 20
                """),
                {"uid": uid},
            )
            biens = [
                {"id": str(r.id), "adresse": r.adresse, "ville": r.ville,
                 "statut": r.statut, "loyer": float(r.loyer or 0)}
                for r in rows
            ]
            ctx["biens_total"]  = len(biens)
            ctx["biens_vacants"] = [b for b in biens if b["statut"] == "vacant"]
            ctx["biens_loues"]   = [b for b in biens if b["statut"] == "loue"]
        except Exception:
            pass

        # Locataires actifs
        try:
            rows = await db.execute(
                text("""
                    SELECT l.id, l.bien_id, l.loyer, l.date_entree,
                           b.adresse, b.ville
                    FROM locataires l
                    JOIN biens b ON b.id = l.bien_id
                    WHERE b.owner_id = :uid AND l.statut = 'actif'
                    LIMIT 10
                """),
                {"uid": uid},
            )
            ctx["locataires_actifs"] = [
                {"id": str(r.id), "bien": r.adresse, "loyer": float(r.loyer or 0)}
                for r in rows
            ]
        except Exception:
            pass

        # Paiements en retard
        try:
            rows = await db.execute(
                text("""
                    SELECT p.id, p.montant, p.date_echeance, p.jours_retard,
                           b.adresse
                    FROM paiements p
                    JOIN biens b ON b.id = p.bien_id
                    WHERE b.owner_id = :uid
                      AND p.statut IN ('en_attente', 'en_retard')
                      AND p.date_echeance < :today
                    ORDER BY p.jours_retard DESC
                    LIMIT 8
                """),
                {"uid": uid, "today": today},
            )
            ctx["paiements_retard"] = [
                {"id": str(r.id), "montant": float(r.montant),
                 "jours_retard": r.jours_retard, "bien": r.adresse,
                 "date_echeance": r.date_echeance.isoformat()}
                for r in rows
            ]
        except Exception:
            pass

        # Paiements à venir (7 jours)
        try:
            rows = await db.execute(
                text("""
                    SELECT p.id, p.montant, p.date_echeance, b.adresse
                    FROM paiements p
                    JOIN biens b ON b.id = p.bien_id
                    WHERE b.owner_id = :uid
                      AND p.statut = 'en_attente'
                      AND p.date_echeance BETWEEN :today AND :future
                    ORDER BY p.date_echeance
                    LIMIT 5
                """),
                {"uid": uid, "today": today, "future": today + timedelta(days=7)},
            )
            ctx["paiements_a_venir"] = [
                {"id": str(r.id), "montant": float(r.montant),
                 "date_echeance": r.date_echeance.isoformat(), "bien": r.adresse}
                for r in rows
            ]
        except Exception:
            pass

        # Interventions ouvertes
        try:
            rows = await db.execute(
                text("""
                    SELECT i.id, i.titre, i.urgence, i.statut,
                           i.artisan_id, b.adresse
                    FROM interventions i
                    JOIN biens b ON b.id = i.bien_id
                    WHERE b.owner_id = :uid
                      AND i.statut IN ('nouveau', 'en_cours', 'planifie')
                    ORDER BY CASE i.urgence
                        WHEN 'tres_urgente' THEN 1
                        WHEN 'urgente'      THEN 2
                        WHEN 'moderee'      THEN 3
                        ELSE 4 END
                    LIMIT 6
                """),
                {"uid": uid},
            )
            ctx["interventions_ouvertes"] = [
                {"id": str(r.id), "titre": r.titre, "urgence": r.urgence,
                 "statut": r.statut, "artisan_id": str(r.artisan_id) if r.artisan_id else None,
                 "bien": r.adresse}
                for r in rows
            ]
        except Exception:
            pass

        # Baux expirant dans 60 jours
        try:
            rows = await db.execute(
                text("""
                    SELECT l.id, l.date_sortie, l.loyer, b.adresse
                    FROM locataires l
                    JOIN biens b ON b.id = l.bien_id
                    WHERE b.owner_id = :uid
                      AND l.statut = 'actif'
                      AND l.date_sortie IS NOT NULL
                      AND l.date_sortie BETWEEN :today AND :future
                    LIMIT 3
                """),
                {"uid": uid, "today": today, "future": today + timedelta(days=60)},
            )
            ctx["baux_expirant"] = [
                {"id": str(r.id), "date_sortie": r.date_sortie.isoformat(),
                 "loyer": float(r.loyer or 0), "bien": r.adresse}
                for r in rows
            ]
        except Exception:
            pass

    # ── Ouvreurs ──────────────────────────────────────────────────────────────
    elif role in _OPENER_ROLES:

        # Missions disponibles
        try:
            rows = await db.execute(
                text("""
                    SELECT id, type, scheduled_at, price, city
                    FROM missions
                    WHERE status = 'pending' AND opener_id IS NULL
                    ORDER BY scheduled_at
                    LIMIT 8
                """),
            )
            ctx["missions_disponibles"] = [
                {"id": str(r.id), "type": r.type,
                 "price": float(r.price or 0), "city": getattr(r, "city", None)}
                for r in rows
            ]
        except Exception:
            pass

        # Missions assignées
        try:
            rows = await db.execute(
                text("""
                    SELECT id, type, scheduled_at, price, status
                    FROM missions
                    WHERE opener_id = :uid AND status IN ('accepted', 'in_progress')
                    ORDER BY scheduled_at
                    LIMIT 5
                """),
                {"uid": uid},
            )
            ctx["missions_assignees"] = [
                {"id": str(r.id), "type": r.type, "status": r.status,
                 "price": float(r.price or 0)}
                for r in rows
            ]
        except Exception:
            pass

        # Revenus du mois
        try:
            row = await db.execute(
                text("""
                    SELECT COALESCE(SUM(m.price), 0) AS total
                    FROM missions m
                    WHERE m.opener_id = :uid
                      AND m.status = 'completed'
                      AND date_trunc('month', m.scheduled_at) = date_trunc('month', now())
                """),
                {"uid": uid},
            )
            r = row.one_or_none()
            ctx["revenus_mois"] = float(r.total) if r else 0.0
        except Exception:
            ctx["revenus_mois"] = 0.0

    # ── Artisans ──────────────────────────────────────────────────────────────
    elif role in _ARTISAN_ROLES:

        # Devis ouverts (RFQs disponibles)
        try:
            rows = await db.execute(
                text("""
                    SELECT id, title, category, city, budget_max, urgency
                    FROM rfqs
                    WHERE status = 'published'
                    ORDER BY created_at DESC
                    LIMIT 8
                """),
            )
            ctx["devis_disponibles"] = [
                {"id": str(r.id), "titre": r.title, "categorie": r.category,
                 "ville": r.city, "budget_max": float(r.budget_max or 0),
                 "urgence": r.urgency}
                for r in rows
            ]
        except Exception:
            pass

        # Chantiers actifs
        try:
            rows = await db.execute(
                text("""
                    SELECT i.id, i.titre, i.statut, i.urgence,
                           i.date_intervention, b.adresse, b.ville
                    FROM interventions i
                    JOIN biens b ON b.id = i.bien_id
                    WHERE i.artisan_id = :uid
                      AND i.statut IN ('en_cours', 'planifie')
                    ORDER BY i.date_intervention
                    LIMIT 6
                """),
                {"uid": uid},
            )
            ctx["chantiers_actifs"] = [
                {"id": str(r.id), "titre": r.titre, "statut": r.statut,
                 "urgence": r.urgence,
                 "date": r.date_intervention.isoformat() if r.date_intervention else None,
                 "adresse": r.adresse, "ville": r.ville}
                for r in rows
            ]
        except Exception:
            pass

        # Devis soumis en attente de réponse
        try:
            rows = await db.execute(
                text("""
                    SELECT d.id, d.montant, d.date_envoi,
                           i.titre AS intervention_titre
                    FROM devis d
                    JOIN interventions i ON i.id = d.intervention_id
                    WHERE d.artisan_id = :uid AND d.statut = 'en_attente'
                    ORDER BY d.date_envoi DESC
                    LIMIT 5
                """),
                {"uid": uid},
            )
            ctx["devis_en_attente"] = [
                {"id": str(r.id), "montant": float(r.montant),
                 "date_envoi": r.date_envoi.isoformat() if r.date_envoi else None,
                 "intervention": r.intervention_titre}
                for r in rows
            ]
        except Exception:
            pass

    # ── Hunters ───────────────────────────────────────────────────────────────
    elif role in _HUNTER_ROLES:
        try:
            rows = await db.execute(
                text("""
                    SELECT id, status, commission_amount, created_at
                    FROM hunter_leads
                    WHERE hunter_id = :uid
                    ORDER BY created_at DESC
                    LIMIT 10
                """),
                {"uid": uid},
            )
            ctx["leads"] = [
                {"id": str(r.id), "status": r.status,
                 "commission": float(r.commission_amount or 0)}
                for r in rows
            ]
        except Exception:
            ctx["leads"] = []

    # ── Locataires ────────────────────────────────────────────────────────────
    elif role in _TENANT_ROLES:

        # Paiements
        try:
            rows = await db.execute(
                text("""
                    SELECT p.id, p.montant, p.date_echeance, p.statut,
                           p.jours_retard, b.adresse
                    FROM paiements p
                    JOIN biens b ON b.id = p.bien_id
                    JOIN locataires l ON l.bien_id = b.id
                    WHERE l.user_id = :uid
                      AND p.statut IN ('en_attente', 'en_retard')
                    ORDER BY p.date_echeance
                    LIMIT 5
                """),
                {"uid": uid},
            )
            ctx["paiements"] = [
                {"id": str(r.id), "montant": float(r.montant),
                 "date_echeance": r.date_echeance.isoformat(),
                 "statut": r.statut, "jours_retard": r.jours_retard,
                 "adresse": r.adresse}
                for r in rows
            ]
        except Exception:
            pass

        # Interventions signalées
        try:
            rows = await db.execute(
                text("""
                    SELECT i.id, i.titre, i.statut, i.urgence
                    FROM interventions i
                    WHERE i.signale_par_id = :uid
                      AND i.statut != 'resolu'
                    ORDER BY i.created_at DESC
                    LIMIT 5
                """),
                {"uid": uid},
            )
            ctx["interventions_signalees"] = [
                {"id": str(r.id), "titre": r.titre,
                 "statut": r.statut, "urgence": r.urgence}
                for r in rows
            ]
        except Exception:
            pass

    # ── Acheteur premium ──────────────────────────────────────────────────────
    elif role in _BUYER_ROLES:
        try:
            rows = await db.execute(
                text("""
                    SELECT id, title, price, city, property_type, created_at
                    FROM listings
                    WHERE status = 'published'
                    ORDER BY created_at DESC
                    LIMIT 5
                """),
            )
            ctx["nouvelles_annonces"] = [
                {"id": str(r.id), "titre": r.title, "prix": float(r.price or 0),
                 "ville": r.city, "type": r.property_type}
                for r in rows
            ]
        except Exception:
            pass

    # ── Données communes à tous ───────────────────────────────────────────────

    # Emails non lus
    try:
        row = await db.execute(
            text("SELECT COUNT(*) AS n FROM email_cache WHERE user_id = :uid AND is_processed = FALSE"),
            {"uid": uid},
        )
        r = row.one_or_none()
        ctx["emails_non_lus"] = int(r.n) if r else 0
    except Exception:
        ctx["emails_non_lus"] = 0

    # WhatsApp non lus
    try:
        row = await db.execute(
            text("SELECT COALESCE(SUM(unread_count), 0) AS n FROM whatsapp_conversations WHERE user_id = :uid"),
            {"uid": uid},
        )
        r = row.one_or_none()
        ctx["wa_non_lus"] = int(r.n) if r else 0
    except Exception:
        ctx["wa_non_lus"] = 0

    # Agenda — événements du jour et demain
    try:
        rows = await db.execute(
            text("""
                SELECT id, title, start_at, end_at, location, contexte_type
                FROM calendar_events
                WHERE user_id = :uid
                  AND start_at BETWEEN :today AND :future
                ORDER BY start_at
                LIMIT 5
            """),
            {"uid": uid, "today": _now_utc(), "future": _now_utc() + timedelta(days=2)},
        )
        ctx["agenda_prochain"] = [
            {"id": str(r.id), "titre": r.title,
             "start": r.start_at.isoformat() if r.start_at else None,
             "lieu": r.location, "contexte": r.contexte_type}
            for r in rows
        ]
    except Exception:
        ctx["agenda_prochain"] = []

    return ctx


async def _load_preferences(user: User, db: AsyncSession) -> dict[str, Any]:
    """Charge les préférences IA mémorisées pour personnaliser le prompt."""
    try:
        rows = await db.execute(
            text("SELECT cle, valeur FROM ai_user_preferences WHERE user_id = :uid"),
            {"uid": _uid(user)},
        )
        return {r.cle: json.loads(r.valeur) for r in rows}
    except Exception:
        return {}


# ═══════════════════════════════════════════════════════════════════════════════
# CLAUDE — PROMPT & APPEL
# ═══════════════════════════════════════════════════════════════════════════════

_SYSTEM_PROMPT = """Tu es Althy, l'assistant immobilier suisse, disponible 24h/24, 7j/7.
Tu es bienveillant, clair et efficace. Tu aides TOUS les acteurs de l'immobilier — propriétaires,
agences, artisans, ouvreurs, locataires, hunters, experts — sans jamais porter de jugement.
L'humain valide TOUJOURS avant que tu exécutes quoi que ce soit.
Tu proposes, tu n'imposes pas. Tu simplifies ce qui est complexe.
Réponds UNIQUEMENT en JSON valide. Aucun texte en dehors du JSON."""


def _build_prompt(user: User, ctx: dict, prefs: dict) -> str:
    prenom   = user.first_name or (user.email or "").split("@")[0]
    role_fr  = _ROLE_FR.get(user.role or "", user.role or "utilisateur")
    today_fr = datetime.now().strftime("%A %d %B %Y")

    prefs_txt = ""
    if prefs:
        prefs_txt = f"\nPréférences mémorisées : {json.dumps(prefs, ensure_ascii=False)}"

    return f"""Analyse la situation de {prenom} ({role_fr}) au {today_fr}.{prefs_txt}

Contexte temps réel :
{json.dumps(ctx, ensure_ascii=False, indent=2, default=str)}

Génère maximum 8 actions prioritaires. Retourne UNIQUEMENT ce JSON (pas de texte avant/après) :
{{
  "salutation": "Message bienveillant et personnalisé, max 80 caractères",
  "resume": "Résumé neutre de la situation, 1-2 phrases, sans comparaison agressive",
  "actions": [
    {{
      "id": "uuid-unique",
      "type_action": "paiement_action|document_action|messagerie_action|intervention_action|agenda_action|validation_action|notation_action|integration_action|info",
      "urgence": "urgent|normal|info",
      "titre": "Titre court, max 8 mots",
      "description": "Une phrase utile et concrète",
      "texte_suggere": "Texte pré-rédigé si applicable (email, message, relance) — null sinon",
      "payload": {{"path": "/app/...", "id": "uuid-si-besoin", "action": "sous-action-optionnelle"}},
      "libelle_cta": "Libellé bouton principal",
      "libelle_cta2": "Libellé bouton secondaire — null si non applicable"
    }}
  ]
}}

Règles :
- urgence "urgent" = rouge, "normal" = orange, "info" = gris/bleu
- Si données vides : propose 1-2 actions utiles selon le rôle
- Chemins français : /app/biens, /app/locataires, /app/paiements, /app/interventions,
  /app/ouvreurs, /app/artisans, /app/comptabilite, /app/sphere, /app/messagerie, /app/whatsapp
- Les IDs payload doivent venir du contexte si disponibles
- Ne propose pas plus d'1 action de type "info"
- Sois concis, bienveillant, jamais condescendant"""


async def _call_claude(user: User, ctx: dict, prefs: dict, db: AsyncSession) -> dict:
    """Appelle Claude Sonnet et retourne le JSON de briefing."""
    client  = _client()
    message = await client.messages.create(
        model=_MODEL,
        max_tokens=2000,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": _build_prompt(user, ctx, prefs)}],
    )
    await _log_usage(db, _uid(user), "sphere_briefing", message.usage)

    raw = message.content[0].text.strip()  # type: ignore[union-attr]
    # Strip markdown code fences if present
    if "```" in raw:
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip().rstrip("```").strip()

    try:
        return json.loads(raw)
    except Exception:
        prenom = user.first_name or "vous"
        return {
            "salutation": f"Bonjour {prenom}, je suis prêt à vous aider.",
            "resume": "Votre espace Althy est opérationnel.",
            "actions": [
                {
                    "id": str(_uuid.uuid4()),
                    "type_action": "info",
                    "urgence": "info",
                    "titre": "Explorer mes biens",
                    "description": "Consultez l'état de votre portefeuille immobilier.",
                    "texte_suggere": None,
                    "payload": {"path": "/app/biens"},
                    "libelle_cta": "Voir mes biens",
                    "libelle_cta2": None,
                }
            ],
        }


# ── Cache helpers ─────────────────────────────────────────────────────────────

async def _get_cached_briefing(user_id: _uuid.UUID, ctx_hash: str, db: AsyncSession) -> dict | None:
    """Retourne le cache si le hash contexte correspond et n'est pas expiré."""
    try:
        row = await db.execute(
            text("""
                SELECT summary, actions, generated_at
                FROM ai_briefing_cache
                WHERE user_id   = :uid
                  AND ctx_hash  = :hash
                  AND expires_at > now()
                ORDER BY generated_at DESC
                LIMIT 1
            """),
            {"uid": user_id, "hash": ctx_hash},
        )
        cached = row.one_or_none()
        if not cached:
            return None
        actions = cached.actions if isinstance(cached.actions, list) else json.loads(cached.actions or "[]")
        return {
            "salutation": cached.summary or "",
            "resume":     "",
            "actions":    actions,
            "from_cache": True,
            "generated_at": cached.generated_at.isoformat() if cached.generated_at else None,
        }
    except Exception:
        return None


async def _save_briefing_cache(
    user_id: _uuid.UUID,
    today: date,
    ctx_hash: str,
    result: dict,
    db: AsyncSession,
) -> None:
    try:
        actions_json = json.dumps(result.get("actions", []))
        pending_count = sum(
            1 for a in result.get("actions", []) if a.get("urgence") == "urgent"
        )
        summary = result.get("salutation", "")[:500]

        await db.execute(
            text("""
                INSERT INTO ai_briefing_cache
                    (id, user_id, date, ctx_hash, summary, actions, pending_count, expires_at)
                VALUES
                    (:id, :uid, :today, :hash, :summary, :actions, :pc,
                     now() + interval '20 hours')
                ON CONFLICT (user_id, date) DO UPDATE
                    SET ctx_hash     = EXCLUDED.ctx_hash,
                        summary      = EXCLUDED.summary,
                        actions      = EXCLUDED.actions,
                        pending_count= EXCLUDED.pending_count,
                        expires_at   = EXCLUDED.expires_at,
                        generated_at = now()
            """),
            {
                "id":      _uuid.uuid4(),
                "uid":     user_id,
                "today":   today,
                "hash":    ctx_hash,
                "summary": summary,
                "actions": actions_json,
                "pc":      pending_count,
            },
        )
        await db.commit()
    except Exception:
        pass


async def _persist_actions(user_id: _uuid.UUID, actions: list[dict], db: AsyncSession) -> None:
    """Sauvegarde chaque action dans ai_actions avec status=pending.
    texte_suggere + libelles CTA sont stockés dans le payload JSONB.
    """
    try:
        for a in actions:
            urgence_map = {"urgent": "haute", "normal": "normale", "info": "info"}
            # Enrichit le payload avec les champs d'affichage
            payload = dict(a.get("payload") or {})
            if a.get("texte_suggere"):
                payload["texte_suggere"] = a["texte_suggere"]
            if a.get("libelle_cta"):
                payload["libelle_cta"] = a["libelle_cta"]
            if a.get("libelle_cta2"):
                payload["libelle_cta2"] = a["libelle_cta2"]

            await db.execute(
                text("""
                    INSERT INTO ai_actions
                        (id, user_id, action_type, titre, description,
                         urgence, payload, status, expires_at)
                    VALUES
                        (:id, :uid, :atype, :titre, :desc,
                         :urgence, :payload, 'pending',
                         now() + interval '24 hours')
                    ON CONFLICT DO NOTHING
                """),
                {
                    "id":      _uuid.UUID(a["id"]) if _is_valid_uuid(a.get("id", "")) else _uuid.uuid4(),
                    "uid":     user_id,
                    "atype":   a.get("type_action", "info"),
                    "titre":   a.get("titre", "")[:255],
                    "desc":    a.get("description", ""),
                    "urgence": urgence_map.get(a.get("urgence", "info"), "info"),
                    "payload": json.dumps(payload),
                },
            )
        await db.commit()
    except Exception:
        pass


def _is_valid_uuid(val: str) -> bool:
    try:
        _uuid.UUID(val)
        return True
    except (ValueError, AttributeError):
        return False


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════


# ── GET /sphere/contexte ──────────────────────────────────────────────────────

@router.get("/contexte")
async def get_contexte(current_user: AuthDep, db: DbDep) -> dict:
    """Retourne le contexte brut de l'utilisateur (sans appel Claude)."""
    ctx   = await _load_context(current_user, db)
    prefs = await _load_preferences(current_user, db)
    return {
        "role":        current_user.role,
        "role_fr":     _ROLE_FR.get(current_user.role or "", current_user.role or ""),
        "contexte":    ctx,
        "preferences": prefs,
        "timestamp":   _now_utc().isoformat(),
    }


def _enrich_briefing(result: dict, today: date) -> dict:
    """Add legacy BriefingData fields (titre, message, date, is_today)
    so callers that expect the old /dashboard/briefing shape still work."""
    result.setdefault("titre", result.get("salutation", f"Briefing du {today.strftime('%d/%m/%Y')}"))
    result.setdefault("message", result.get("resume", ""))
    result.setdefault("date", today.isoformat())
    result.setdefault("is_today", True)
    return result


# ── GET /sphere/briefing ──────────────────────────────────────────────────────

@router.get("/briefing")
async def get_briefing(
    current_user: AuthDep,
    db: DbDep,
    _=rate_limit(12, 60),
) -> dict:
    """Briefing quotidien personnalisé — cache MD5 sur le contexte."""
    today = date.today()

    ctx   = await _load_context(current_user, db)
    prefs = await _load_preferences(current_user, db)
    hash_ = _ctx_hash({**ctx, **prefs})

    # Try MD5-keyed cache
    cached = await _get_cached_briefing(_uid(current_user), hash_, db)
    if cached:
        return _enrich_briefing(cached, today)

    # Generate via Claude
    result = await _call_claude(current_user, ctx, prefs, db)

    # Persist cache + individual actions
    await _save_briefing_cache(_uid(current_user), today, hash_, result, db)
    await _persist_actions(_uid(current_user), result.get("actions", []), db)

    return _enrich_briefing(
        {**result, "from_cache": False, "generated_at": _now_utc().isoformat()},
        today,
    )


# ── GET /sphere/pending-count ─────────────────────────────────────────────────

@router.get("/pending-count")
async def get_pending_count(current_user: AuthDep, db: DbDep) -> dict:
    """Badge du widget flottant — nombre d'actions urgentes en attente."""
    try:
        row = await db.execute(
            text("""
                SELECT actions, pending_count
                FROM ai_briefing_cache
                WHERE user_id  = :uid
                  AND expires_at > now()
                ORDER BY generated_at DESC
                LIMIT 1
            """),
            {"uid": _uid(current_user)},
        )
        cached = row.one_or_none()
        if cached:
            actions = cached.actions if isinstance(cached.actions, list) else json.loads(cached.actions or "[]")
            urgent  = [a for a in actions if a.get("urgence") == "urgent"]
            return {"count": len(urgent), "actions": urgent[:3]}
    except Exception:
        pass
    return {"count": 0, "actions": []}


# ── POST /sphere/actions ─────────────────────────────────────────────────────

class ActionCreate(BaseModel):
    type_action:  str
    urgence:      str = "normal"
    titre:        str
    description:  str | None = None
    texte_suggere:str | None = None
    payload:      dict | None = None
    libelle_cta:  str | None = None
    libelle_cta2: str | None = None


@router.post("/actions", status_code=201)
async def creer_action(body: ActionCreate, current_user: AuthDep, db: DbDep) -> dict:
    """Crée manuellement une action dans la Sphère (ex : après scan OCR)."""
    urgence_map = {"urgent": "haute", "normal": "normale", "info": "info"}
    action_id   = _uuid.uuid4()

    enriched_payload = dict(body.payload or {})
    if body.texte_suggere:
        enriched_payload["texte_suggere"] = body.texte_suggere
    if body.libelle_cta:
        enriched_payload["libelle_cta"] = body.libelle_cta
    if body.libelle_cta2:
        enriched_payload["libelle_cta2"] = body.libelle_cta2

    try:
        await db.execute(
            text("""
                INSERT INTO ai_actions
                    (id, user_id, action_type, titre, description,
                     urgence, payload, status, expires_at)
                VALUES
                    (:id, :uid, :atype, :titre, :desc,
                     :urgence, :payload, 'pending',
                     now() + interval '72 hours')
            """),
            {
                "id":      action_id,
                "uid":     _uid(current_user),
                "atype":   body.type_action[:50],
                "titre":   body.titre[:255],
                "desc":    body.description,
                "urgence": urgence_map.get(body.urgence, "normale"),
                "payload": json.dumps(enriched_payload),
            },
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(500, f"Erreur lors de la création : {exc}") from exc

    return {"id": str(action_id), "ok": True}


# ── POST /sphere/executer ─────────────────────────────────────────────────────

class ExecPayload(BaseModel):
    action_id: str
    modifications: str | None = None
    payload: dict | None = None


@router.post("/executer")
async def executer_action(body: ExecPayload, current_user: AuthDep, db: DbDep) -> dict:  # noqa: C901
    """Exécute une action Sphère. Génère une notation_action si applicable."""
    if not _is_valid_uuid(body.action_id):
        raise HTTPException(422, "action_id invalide")

    action_uuid = _uuid.UUID(body.action_id)

    # Fetch action
    row = await db.execute(
        text("SELECT action_type, payload, status FROM ai_actions WHERE id = :id AND user_id = :uid"),
        {"id": action_uuid, "uid": _uid(current_user)},
    )
    action = row.one_or_none()
    if not action:
        # Action may have been generated by briefing but not yet in ai_actions — still log
        pass

    action_type = action.action_type if action else (body.payload or {}).get("type_action", "info")
    raw_payload = action.payload if action else {}
    if isinstance(raw_payload, str):
        try:
            raw_payload = json.loads(raw_payload)
        except Exception:
            raw_payload = {}
    merged_payload = {**(raw_payload or {}), **(body.payload or {})}

    # ── Type-specific execution ───────────────────────────────────────────────

    result_msg = "Action exécutée."

    if action_type == "paiement_action":
        paiement_id = merged_payload.get("id") or merged_payload.get("paiement_id")
        sous_action  = merged_payload.get("action", "marquer_paye")
        if paiement_id and sous_action == "marquer_paye":
            try:
                await db.execute(
                    text("""
                        UPDATE paiements
                        SET statut = 'paye', date_paiement = :today
                        WHERE id = :id
                    """),
                    {"id": _uuid.UUID(paiement_id), "today": date.today()},
                )
                await db.commit()
                result_msg = "Paiement marqué comme reçu."
            except Exception:
                pass

    elif action_type == "intervention_action":
        intervention_id = merged_payload.get("id") or merged_payload.get("intervention_id")
        sous_action      = merged_payload.get("action", "")
        if intervention_id:
            try:
                if sous_action == "resoudre":
                    await db.execute(
                        text("UPDATE interventions SET statut = 'resolu' WHERE id = :id"),
                        {"id": _uuid.UUID(intervention_id)},
                    )
                    await db.commit()
                    result_msg = "Intervention marquée comme résolue."

                    # Auto-generate notation_action for artisan if one was assigned
                    artisan_row = await db.execute(
                        text("SELECT artisan_id FROM interventions WHERE id = :id"),
                        {"id": _uuid.UUID(intervention_id)},
                    )
                    artisan = artisan_row.one_or_none()
                    if artisan and artisan.artisan_id:
                        await _create_notation_action(
                            user_id    = _uid(current_user),
                            acteur_id  = artisan.artisan_id,
                            acteur_role= "artisan",
                            contexte   = "intervention",
                            contexte_id= _uuid.UUID(intervention_id),
                            db         = db,
                        )
            except Exception:
                pass

    elif action_type == "agenda_action":
        titre    = merged_payload.get("title") or merged_payload.get("titre", "Rendez-vous")
        start_at = merged_payload.get("start_at")
        end_at   = merged_payload.get("end_at")
        if start_at and end_at:
            try:
                await db.execute(
                    text("""
                        INSERT INTO calendar_events
                            (id, user_id, title, start_at, end_at,
                             contexte_type, contexte_id)
                        VALUES
                            (:id, :uid, :title, :start, :end, :ctype, :cid)
                    """),
                    {
                        "id":    _uuid.uuid4(),
                        "uid":   _uid(current_user),
                        "title": titre[:255],
                        "start": start_at,
                        "end":   end_at,
                        "ctype": merged_payload.get("contexte_type"),
                        "cid":   (
                            _uuid.UUID(merged_payload["contexte_id"])
                            if merged_payload.get("contexte_id") and _is_valid_uuid(merged_payload["contexte_id"])
                            else None
                        ),
                    },
                )
                await db.commit()
                result_msg = "Événement ajouté à l'agenda."
            except Exception:
                pass

    elif action_type == "notation_action":
        # Notation actions are handled by the user via /notations/ endpoint
        result_msg = "Notation enregistrée dans votre agenda d'actions."

    # Default: just mark executed (messagerie_action, integration_action, info, validation_action, etc.)

    # ── Mark ai_actions row as executed ───────────────────────────────────────
    try:
        await db.execute(
            text("""
                UPDATE ai_actions
                SET status       = 'executed',
                    executed_at  = now(),
                    modifications= :mods
                WHERE id = :id AND user_id = :uid
            """),
            {
                "id":   action_uuid,
                "uid":  _uid(current_user),
                "mods": body.modifications,
            },
        )
        await db.commit()
    except Exception:
        pass

    return {"ok": True, "message": result_msg}


async def _create_notation_action(
    user_id: _uuid.UUID,
    acteur_id: _uuid.UUID,
    acteur_role: str,
    contexte: str,
    contexte_id: _uuid.UUID,
    db: AsyncSession,
) -> None:
    """Crée une action de type notation_action dans ai_actions."""
    try:
        await db.execute(
            text("""
                INSERT INTO ai_actions
                    (id, user_id, action_type, titre, description,
                     urgence, payload, status, expires_at)
                VALUES
                    (:id, :uid, 'notation_action',
                     'Évaluer l''intervenant',
                     'Comment s''est passée cette intervention ? Votre avis compte.',
                     'info',
                     :payload, 'pending',
                     now() + interval '7 days')
            """),
            {
                "id":      _uuid.uuid4(),
                "uid":     user_id,
                "payload": json.dumps({
                    "acteur_id":    str(acteur_id),
                    "acteur_role":  acteur_role,
                    "contexte_type": contexte,
                    "contexte_id":  str(contexte_id),
                    "path":         "/app/sphere",
                }),
            },
        )
        await db.commit()
    except Exception:
        pass


# ── POST /sphere/action/{id}/ignorer ─────────────────────────────────────────

@router.post("/action/{action_id}/ignorer")
async def ignorer_action(action_id: str, current_user: AuthDep, db: DbDep) -> dict:
    """Ignore (dismiss) une action Sphère."""
    if not _is_valid_uuid(action_id):
        raise HTTPException(422, "action_id invalide")
    try:
        await db.execute(
            text("""
                UPDATE ai_actions
                SET status = 'dismissed', dismissed_at = now()
                WHERE id = :id AND user_id = :uid
            """),
            {"id": _uuid.UUID(action_id), "uid": _uid(current_user)},
        )
        await db.commit()
    except Exception:
        pass
    return {"ok": True}


# ── POST /sphere/preference ───────────────────────────────────────────────────

class PrefPayload(BaseModel):
    cle: str
    valeur: Any


@router.post("/preference")
async def save_preference(body: PrefPayload, current_user: AuthDep, db: DbDep) -> dict:
    """Mémorise une préférence utilisateur apprise par la Sphère."""
    try:
        await db.execute(
            text("""
                INSERT INTO ai_user_preferences (id, user_id, cle, valeur)
                VALUES (:id, :uid, :cle, :valeur)
                ON CONFLICT (user_id, cle) DO UPDATE
                    SET valeur = EXCLUDED.valeur, updated_at = now(), hits = hits + 1
            """),
            {
                "id":     _uuid.uuid4(),
                "uid":    _uid(current_user),
                "cle":    body.cle[:200],
                "valeur": json.dumps(body.valeur),
            },
        )
        await db.commit()
    except Exception:
        pass
    return {"ok": True}


# ── POST /sphere/regenerer ────────────────────────────────────────────────────

class RegenerPayload(BaseModel):
    action_id: str
    instruction: str


@router.post("/regenerer")
async def regenerer_action(
    body: RegenerPayload,
    current_user: AuthDep,
    db: DbDep,
    _=rate_limit(10, 60),
) -> dict:
    """Régénère le texte d'une action via Claude selon une instruction libre.

    Mémorise la modification comme préférence utilisateur.
    """
    if not _is_valid_uuid(body.action_id):
        raise HTTPException(422, "action_id invalide")

    # Fetch original action (texte_suggere stocké dans payload.texte_suggere)
    row = await db.execute(
        text("SELECT titre, description, payload FROM ai_actions WHERE id = :id AND user_id = :uid"),
        {"id": _uuid.UUID(body.action_id), "uid": _uid(current_user)},
    )
    action = row.one_or_none()
    if not action:
        raise HTTPException(404, "Action introuvable")

    raw_payload: dict = {}
    if action.payload:
        try:
            raw_payload = json.loads(action.payload) if isinstance(action.payload, str) else action.payload
        except Exception:
            pass

    # Build Claude prompt
    original: dict[str, Any] = {
        "titre":       action.titre,
        "description": action.description,
    }
    if raw_payload.get("texte_suggere"):
        original["texte_suggere"] = raw_payload["texte_suggere"]

    prompt = f"""Tu es Althy, assistant immobilier suisse, bienveillant et efficace.
Voici une action existante :
{json.dumps(original, ensure_ascii=False, indent=2)}

Instruction de l'utilisateur : "{body.instruction}"

Régénère UNIQUEMENT ce JSON (aucun texte avant/après) :
{{
  "titre": "...",
  "description": "...",
  "texte_suggere": "..."
}}

Conserve le sens original. Adapte selon l'instruction. Sois concis."""

    client  = _client()
    message = await client.messages.create(
        model=_MODEL,
        max_tokens=600,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )
    await _log_usage(db, _uid(current_user), "sphere_regenerer", message.usage)

    raw = message.content[0].text.strip()  # type: ignore[union-attr]
    if "```" in raw:
        raw = raw.split("```")[1].lstrip("json").strip().rstrip("```").strip()

    try:
        updated = json.loads(raw)
    except Exception:
        raise HTTPException(502, "Réponse Claude invalide — réessayez")

    # Update ai_actions
    try:
        await db.execute(
            text("""
                UPDATE ai_actions
                SET titre         = COALESCE(:titre, titre),
                    description   = COALESCE(:desc, description),
                    modifications = :instruction
                WHERE id = :id AND user_id = :uid
            """),
            {
                "titre":       updated.get("titre"),
                "desc":        updated.get("description"),
                "instruction": body.instruction,
                "id":          _uuid.UUID(body.action_id),
                "uid":         _uid(current_user),
            },
        )
        await db.commit()
    except Exception:
        pass

    # Mémorise la préférence de style
    await save_preference(
        PrefPayload(
            cle=f"style_regeneration_{body.action_id[:8]}",
            valeur={"instruction": body.instruction, "resultat": updated.get("titre", "")},
        ),
        current_user,
        db,
    )

    return {"ok": True, "action": updated}


# ═══════════════════════════════════════════════════════════════════════════════
# ROUTES MIGRÉES DEPUIS ai_sphere.py (prefix /ai → /sphere)
# ═══════════════════════════════════════════════════════════════════════════════


class ChatRequest(BaseModel):
    message: str
    context: dict = {}


class CopilotResponse(BaseModel):
    response: str


class VoiceActionRequest(BaseModel):
    transcript: str


class AdvisorRequest(BaseModel):
    question: str
    context: dict = {}


class ContractParamsRequest(BaseModel):
    description: str


class RedigerDescriptionRequest(BaseModel):
    type_publication: str
    type_intervention: str
    adresse_bien: str | None = None
    description_contexte: str | None = None


# ── POST /sphere/copilot ─────────────────────────────────────────────────────

@router.post("/copilot", response_model=CopilotResponse)
async def copilot(
    payload: ChatRequest,
    current_user: AuthDep,
    db: DbDep,
) -> CopilotResponse:
    """Non-streaming copilot — collects the full Claude response and returns it."""
    user_name = current_user.first_name or (current_user.email or "").split("@")[0]
    context = {**payload.context, "role": current_user.role, "user_name": user_name}
    parts: list[str] = []
    async for chunk in chat_stream(
        message=payload.message,
        context=context,
        db=db,
        user_id=str(current_user.id),
    ):
        if chunk.startswith("data: ") and chunk.strip() != "data: [DONE]":
            try:
                parsed = json.loads(chunk[6:].strip())
                if "text" in parsed:
                    parts.append(parsed["text"].replace("\\n", "\n"))
            except Exception:
                pass
    return CopilotResponse(response="".join(parts))


# ── POST /sphere/chat ────────────────────────────────────────────────────────

@router.post("/chat")
async def chat(
    payload: ChatRequest,
    current_user: AuthDep,
    db: DbDep,
    _=rate_limit(20, 60),
) -> StreamingResponse:
    """Conversational copilot — streams SSE events."""
    user_name = current_user.first_name or (current_user.email or "").split("@")[0]
    context = {**payload.context, "role": current_user.role, "user_name": user_name}

    async def _generate():
        async for chunk in chat_stream(
            message=payload.message, context=context, db=db, user_id=str(current_user.id),
        ):
            yield chunk

    return StreamingResponse(
        _generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── GET /sphere/chat ─────────────────────────────────────────────────────────

@router.get("/chat")
async def chat_get(
    current_user: AuthDep,
    db: DbDep,
    message: str = Query(..., description="Message de l'utilisateur"),
    _=rate_limit(20, 60),
) -> StreamingResponse:
    """SSE streaming chat avec contexte auto-injecté (biens, locataires, interventions)."""
    from app.models.bien import Bien
    from app.models.intervention import Intervention
    from app.models.locataire import Locataire
    from sqlalchemy import and_, func, select as sa_sel

    uid = current_user.id
    ctx: dict = {"role": current_user.role, "user_name": current_user.first_name or ""}

    try:
        biens_count = (await db.execute(
            sa_sel(func.count()).select_from(Bien).where(Bien.owner_id == uid)
        )).scalar() or 0
        ctx["nb_biens"] = biens_count

        biens_res = await db.execute(sa_sel(Bien).where(Bien.owner_id == uid).limit(10))
        biens = biens_res.scalars().all()
        bien_ids = [b.id for b in biens]
        ctx["biens"] = [{"adresse": b.adresse, "ville": b.ville, "statut": b.statut} for b in biens]

        if bien_ids:
            loc_res = await db.execute(
                sa_sel(func.count()).select_from(Locataire).where(
                    and_(Locataire.bien_id.in_(bien_ids), Locataire.statut == "actif")
                )
            )
            ctx["nb_locataires_actifs"] = loc_res.scalar() or 0

            inter_res = await db.execute(
                sa_sel(Intervention).where(
                    and_(
                        Intervention.bien_id.in_(bien_ids),
                        Intervention.statut.in_(["nouveau", "en_cours"]),
                    )
                ).limit(5)
            )
            interventions = inter_res.scalars().all()
            ctx["interventions_en_cours"] = [
                {"titre": i.titre, "categorie": i.categorie, "urgence": i.urgence, "statut": i.statut}
                for i in interventions
            ]
    except Exception:
        pass

    async def _generate():
        async for chunk in chat_stream(
            message=message, context=ctx, db=db, user_id=str(current_user.id),
        ):
            yield chunk

    return StreamingResponse(
        _generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── POST /sphere/voice-action ────────────────────────────────────────────────

@router.post("/voice-action")
async def voice_action(
    payload: VoiceActionRequest,
    current_user: AuthDep,
    db: DbDep,
    _=rate_limit(10, 60),
):
    """Analyse un message vocal et exécute l'action détectée."""
    client = _client()

    response = await client.messages.create(
        model=_MODEL,
        max_tokens=800,
        messages=[{"role": "user", "content": f"""
Tu es Althy, assistant immobilier suisse. L'utilisateur a dit :
"{payload.transcript}"

Détecte l'intention et retourne UNIQUEMENT ce JSON :
{{
  "intent": "create_property|navigate|question|unknown",
  "message": "ta réponse courte en français (1 phrase)",
  "navigate_path": null,
  "property": {{
    "type": "apartment|house|studio|commercial|parking|land",
    "address": null, "city": null, "zip_code": null,
    "surface": null, "rooms": null, "monthly_rent": null,
    "charges": null, "deposit": null,
    "status": "available", "is_furnished": false, "has_parking": false, "country": "CH"
  }}
}}

Règles :
- "create_property" si l'utilisateur veut ajouter/créer un bien immobilier
- "navigate" si l'utilisateur veut aller sur une page
- "question" pour toute autre demande
- Extrais les détails du bien si intent=create_property
- type : "apartment"=appartement, "house"=maison/villa, "studio"=studio
"""}]
    )

    raw = response.content[0].text.strip()
    if "```" in raw:
        raw = raw.split("```")[1].lstrip("json").strip()

    try:
        result = json.loads(raw)
    except Exception:
        return {"intent": "question", "message": "Je n'ai pas compris. Reformulez votre demande.", "property": None}

    if result.get("intent") == "create_property" and result.get("property"):
        prop_data = result["property"]
        if prop_data.get("address") or prop_data.get("city"):
            from app.models.property import Property
            new_prop = Property(
                id=_uuid.uuid4(),
                type=prop_data.get("type", "apartment"),
                address=prop_data.get("address") or "",
                city=prop_data.get("city") or "",
                zip_code=prop_data.get("zip_code") or "",
                country=prop_data.get("country") or "CH",
                surface=prop_data.get("surface"),
                rooms=prop_data.get("rooms"),
                monthly_rent=prop_data.get("monthly_rent"),
                charges=prop_data.get("charges"),
                deposit=prop_data.get("deposit"),
                status=prop_data.get("status", "available"),
                is_furnished=bool(prop_data.get("is_furnished", False)),
                has_parking=bool(prop_data.get("has_parking", False)),
                owner_id=current_user.id,
                created_by_id=current_user.id,
                is_active=True,
            )
            db.add(new_prop)
            await db.commit()
            result["property_id"] = str(new_prop.id)
            result["message"] = f"Bien créé : {new_prop.type} à {new_prop.city or new_prop.address}."
        else:
            result["intent"] = "need_more_info"
            result["message"] = "J'ai besoin d'une adresse ou d'une ville pour créer le bien."

    return result


# ── POST /sphere/agency-advisor ──────────────────────────────────────────────

@router.post("/agency-advisor")
async def agency_advisor(
    payload: AdvisorRequest,
    current_user: AuthDep,
    db: DbDep,
    _=rate_limit(15, 60),
):
    """Conseiller IA spécialisé pour agences et propriétaires."""
    from app.models.contract import Contract
    from app.models.transaction import Transaction
    from sqlalchemy import select as sa_sel, and_

    if current_user.role not in ("agency", "owner", "super_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux agences et propriétaires")

    client = _client()

    contracts = (await db.execute(
        sa_sel(Contract).where(
            and_(Contract.is_active.is_(True),
                 (Contract.owner_id == current_user.id) | (Contract.agency_id == current_user.id))
        ).limit(20)
    )).scalars().all()

    late_tx = (await db.execute(
        sa_sel(Transaction).where(
            and_(Transaction.owner_id == current_user.id,
                 Transaction.status == "late", Transaction.is_active.is_(True))
        ).limit(10)
    )).scalars().all()

    context_data = {
        "nb_contrats_actifs":   len([c for c in contracts if c.status == "active"]),
        "nb_contrats_brouillon": len([c for c in contracts if c.status == "draft"]),
        "nb_loyers_en_retard":  len(late_tx),
        "types_contrats":       list({c.type for c in contracts}),
        **(payload.context or {}),
    }

    role_label = "agence immobilière" if current_user.role == "agency" else "propriétaire"
    system = f"""Tu es AlthyLegal, conseiller IA expert en droit immobilier suisse (CO, LDTR, bail à loyer).
Tu conseilles {current_user.first_name or "l'utilisateur"}, {role_label}.

Données de son portefeuille :
{json.dumps(context_data, ensure_ascii=False)}

Tu peux conseiller sur :
- Conformité juridique des baux (durée, loyer initial, hausses, résiliation)
- Qualité des états des lieux et ce qui doit être documenté
- Optimisation des paiements et gestion des retards
- Commissions de gérance (taux légaux suisses)
- Dépôts de garantie (max 3 mois selon CO art. 257e)
- Baux saisonniers vs longue durée

Réponds en français, cite les articles de loi suisses si pertinent. Sois direct et actionnable. Max 300 mots."""

    response = await client.messages.create(
        model=_MODEL,
        max_tokens=600,
        system=system,
        messages=[{"role": "user", "content": payload.question}],
    )
    return {"advice": response.content[0].text.strip()}


# ── POST /sphere/parse-contract-params ───────────────────────────────────────

@router.post("/parse-contract-params")
async def parse_contract_params(
    payload: ContractParamsRequest,
    current_user: AuthDep,
    _=rate_limit(20, 60),
):
    """Parse une description en langage naturel → paramètres de contrat structurés."""
    if current_user.role not in ("agency", "owner", "super_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux agences et propriétaires")

    client = _client()
    response = await client.messages.create(
        model=_MODEL,
        max_tokens=500,
        messages=[{"role": "user", "content": f"""
Tu es un expert en droit du bail suisse. Analyse cette description et extrait les paramètres du contrat.

Description : "{payload.description}"

Retourne UNIQUEMENT ce JSON :
{{
  "type": "long_term|seasonal|short_term|management",
  "commission_pct": <pourcentage de commission ou null>,
  "deposit_months": <nombre de mois (max 3 selon CO) ou null>,
  "notice_months": <préavis en mois ou null>,
  "min_duration_months": <durée minimale en mois ou null>,
  "rent_increase_pct": <hausse annuelle max en % ou null>,
  "included_charges": true/false,
  "management_fee_pct": <honoraires de gérance % ou null>,
  "ai_recommendations": ["recommandation 1", "recommandation 2"],
  "warnings": ["avertissement si paramètre hors norme suisse"]
}}

Droit suisse : dépôt max 3 mois, préavis standard 3 mois longue durée, bail saisonnier < 1 an.
"""}]
    )

    raw = response.content[0].text.strip()
    if "```" in raw:
        raw = _re.sub(r"```(?:json)?", "", raw).strip()
    try:
        return json.loads(raw)
    except Exception:
        return {"type": "long_term", "ai_recommendations": [], "warnings": ["Impossible de parser les paramètres"]}


# ── POST /sphere/briefing-quotidien ──────────────────────────────────────────

@router.post("/briefing-quotidien")
async def briefing_quotidien(
    current_user: AuthDep,
    db: DbDep,
) -> dict:
    """Déclenche la génération du briefing quotidien. Réservé aux super_admin."""
    if current_user.role != "super_admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Réservé aux super_admin")

    from app.tasks.ai_tasks import daily_briefing_all_users
    task = daily_briefing_all_users.delay()
    return {"task_id": task.id, "status": "queued"}


# ── POST /sphere/rediger-description ─────────────────────────────────────────

@router.post(
    "/rediger-description",
    summary="Rédige une description de mission ou devis (SSE streaming)",
)
async def rediger_description(
    payload: RedigerDescriptionRequest,
    current_user: AuthDep,
    db: DbDep,
    _=rate_limit(15, 60),
) -> StreamingResponse:
    """Génère une description professionnelle pour une mission ou devis en streaming SSE."""
    if payload.type_publication == "mission":
        prompt = (
            f"Rédige une description professionnelle et concise (3-5 lignes) pour une mission ouvreur de type "
            f"'{payload.type_intervention}'"
            + (f" au bien situé à {payload.adresse_bien}" if payload.adresse_bien else "")
            + (f". Contexte : {payload.description_contexte}" if payload.description_contexte else "")
            + ". La description doit être claire, attrayante pour un ouvreur qualifié, "
            "et mentionner le type de mission, les attentes principales et le niveau de service attendu. "
            "Réponds uniquement avec la description, sans titre ni introduction."
        )
    else:
        prompt = (
            f"Rédige une description professionnelle pour une demande de devis de travaux : "
            f"type '{payload.type_intervention}'"
            + (f" au bien situé à {payload.adresse_bien}" if payload.adresse_bien else "")
            + (f". Contexte supplémentaire : {payload.description_contexte}" if payload.description_contexte else "")
            + ". La description doit être précise pour un artisan, mentionner la nature du problème, "
            "les contraintes éventuelles et les attentes en termes de qualité. "
            "Réponds uniquement avec la description, sans titre ni introduction."
        )

    context = {"page": "publications/new", "role": current_user.role, "user_name": current_user.first_name or ""}

    async def _generate():
        async for chunk in chat_stream(
            message=prompt, context=context, db=db, user_id=str(current_user.id),
        ):
            yield chunk

    return StreamingResponse(
        _generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
