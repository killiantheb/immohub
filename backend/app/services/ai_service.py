"""
Althy AI Service — powered by Claude claude-sonnet-4-20250514.

Features
--------
1. generate_listing_description  — SEO property ad
2. score_tenant_application      — 0-100 tenant risk score
3. recommend_best_quote          — best contractor quote
4. chat_stream                   — conversational copilot with memory (SSE generator)
5. detect_payment_anomalies      — late-payment pattern detection

Rate limiting
-------------
10 AI calls per minute per user, tracked in Redis (falls back to in-memory).

Monthly quota
-------------
100 000 tokens par utilisateur par mois. Remise à zéro automatique.

Memory
------
Les 10 derniers messages de la session sont passés à Claude pour une
conversation continue.

All calls are logged to ai_usage_logs.
"""

from __future__ import annotations

import json
import logging
import re
import time
import uuid
from collections import defaultdict
from collections.abc import AsyncGenerator
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import TYPE_CHECKING

import anthropic
from app.core.config import settings
from app.models.ai_log import AIUsageLog
from app.models.conversation_message import ConversationMessage
from app.models.transaction import Transaction
from app.models.user import User
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

if TYPE_CHECKING:
    from app.models.bien import Bien

log = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-5-20251001"
MAX_TOKENS = 1000
RATE_LIMIT = 10          # calls per minute per user
RATE_WINDOW = 60         # seconds
MONTHLY_TOKEN_LIMIT = 100_000
HISTORY_LIMIT = 10       # messages à passer en contexte

# ── In-memory rate-limit fallback ─────────────────────────────────────────────

_rate_buckets: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(user_id: str) -> bool:
    """Return True if the user is within the rate limit, False if throttled."""
    try:
        import redis as redis_lib  # type: ignore[import]

        r = redis_lib.from_url(settings.REDIS_URL, socket_connect_timeout=1)
        key = f"ai:rate:{user_id}"
        pipe = r.pipeline()
        now = time.time()
        pipe.zremrangebyscore(key, 0, now - RATE_WINDOW)
        pipe.zadd(key, {str(uuid.uuid4()): now})
        pipe.zcard(key)
        pipe.expire(key, RATE_WINDOW)
        results = pipe.execute()
        count = results[2]
        return count <= RATE_LIMIT
    except Exception:
        # Redis unavailable — fall back to in-memory
        now = time.time()
        bucket = _rate_buckets[user_id]
        _rate_buckets[user_id] = [t for t in bucket if now - t < RATE_WINDOW]
        _rate_buckets[user_id].append(now)
        return len(_rate_buckets[user_id]) <= RATE_LIMIT


# ── Logging helper ────────────────────────────────────────────────────────────


async def _log_usage(
    db: AsyncSession,
    user_id: str,
    action: str,
    usage: anthropic.types.Usage | None,
    context_ref: str | None = None,
) -> None:
    input_tok = getattr(usage, "input_tokens", None) if usage else None
    output_tok = getattr(usage, "output_tokens", None) if usage else None
    # Rough cost estimate: $3/M input, $15/M output (Sonnet pricing)
    cost = None
    if input_tok and output_tok:
        cost = (input_tok / 1_000_000 * 3) + (output_tok / 1_000_000 * 15)

    entry = AIUsageLog(
        user_id=uuid.UUID(user_id),
        action=action,
        model=MODEL,
        input_tokens=input_tok,
        output_tokens=output_tok,
        cost_usd=cost,
        context_ref=context_ref,
    )
    db.add(entry)
    try:
        await db.flush()
    except Exception:
        log.warning("Failed to flush AI usage log", exc_info=True)


# ── Shared Claude client ───────────────────────────────────────────────────────


def _client() -> anthropic.AsyncAnthropic:
    return anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)


# ── Data classes ──────────────────────────────────────────────────────────────


@dataclass
class TenantScore:
    score: int  # 0–100
    recommendation: str  # "approve" | "review" | "reject"
    risk_flags: list[str] = field(default_factory=list)
    summary: str = ""


@dataclass
class QuoteRecommendation:
    best_quote_index: int
    justification: str
    runner_up_index: int | None = None


@dataclass
class PaymentAlert:
    type: str  # "recurring_late" | "missed_payment" | "increasing_delay"
    severity: str  # "low" | "medium" | "high"
    description: str
    bien_id: str | None = None
    tenant_id: str | None = None


# ── 1. Listing description ────────────────────────────────────────────────────


async def generate_listing_description(
    bien: Bien,
    db: AsyncSession,
    user_id: str,
) -> str:
    """Generate an SEO-optimised property ad in French."""
    if not _check_rate_limit(user_id):
        raise RuntimeError("Limite de débit IA atteinte — réessayez dans une minute.")

    bien_json = {
        "type": bien.type,
        "address": bien.adresse,
        "city": bien.ville,
        "cp": bien.cp,
        "canton": bien.canton or "",
        "surface": bien.surface,
        "rooms": float(bien.rooms) if bien.rooms is not None else None,
        "floor": bien.etage,
        "monthly_rent": float(bien.loyer) if bien.loyer is not None else None,
        "charges": float(bien.charges) if bien.charges is not None else None,
        "deposit": float(bien.deposit) if bien.deposit is not None else None,
        "is_furnished": bien.is_furnished,
        "parking_type": bien.parking_type,
        "pets_allowed": bien.pets_allowed,
    }

    prompt = f"""Tu es un expert en immobilier et rédaction d'annonces. Rédige une annonce immobilière attrayante et optimisée SEO pour le bien suivant.

Données du bien :
{json.dumps(bien_json, ensure_ascii=False, indent=2)}

Consignes :
- Langue : français
- Longueur : 150-250 mots
- Commence par un titre accrocheur
- Mets en avant les points forts
- Termine par un appel à l'action
- Utilise des mots-clés SEO naturellement intégrés
- NE répète pas les données brutes telles quelles

Retourne uniquement l'annonce, sans commentaire."""

    client = _client()
    message = await client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        messages=[{"role": "user", "content": prompt}],
    )

    await _log_usage(db, user_id, "generate_listing", message.usage, str(bien.id))
    return message.content[0].text.strip()  # type: ignore[union-attr]


# ── 2. Tenant scoring ─────────────────────────────────────────────────────────


async def score_tenant_application(
    tenant_data: dict,
    db: AsyncSession,
    user_id: str,
) -> TenantScore:
    """Analyse a tenant application and return a risk score 0-100."""
    if not _check_rate_limit(user_id):
        raise RuntimeError("Limite de débit IA atteinte — réessayez dans une minute.")

    prompt = f"""Tu es un expert en gestion locative. Analyse ce dossier locataire et retourne une évaluation structurée.

Dossier :
{json.dumps(tenant_data, ensure_ascii=False, indent=2)}

Retourne UNIQUEMENT un objet JSON valide avec cette structure exacte :
{{
  "score": <entier 0-100>,
  "recommendation": "<approve|review|reject>",
  "risk_flags": ["<flag1>", "<flag2>"],
  "summary": "<résumé en 2-3 phrases>"
}}

Critères de scoring :
- 80-100 : Dossier solide, approuver
- 50-79  : Quelques réserves, à examiner
- 0-49   : Risques élevés, refuser

Facteurs : ratio revenus/loyer (idéal ≥3x), stabilité emploi, historique locatif, documents complets."""

    client = _client()
    message = await client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        messages=[{"role": "user", "content": prompt}],
    )

    await _log_usage(db, user_id, "score_tenant", message.usage)

    raw = message.content[0].text.strip()  # type: ignore[union-attr]
    # Extract JSON even if surrounded by markdown fences
    if "```" in raw:
        raw = raw.split("```")[1].lstrip("json").strip()

    try:
        data = json.loads(raw)
        return TenantScore(
            score=int(data.get("score", 50)),
            recommendation=data.get("recommendation", "review"),
            risk_flags=data.get("risk_flags", []),
            summary=data.get("summary", ""),
        )
    except (json.JSONDecodeError, KeyError, ValueError) as exc:
        log.warning("Failed to parse tenant score JSON: %s", exc)
        return TenantScore(score=50, recommendation="review", summary=raw)


# ── 3. Quote recommendation ───────────────────────────────────────────────────


async def recommend_best_quote(
    quotes: list[dict],
    db: AsyncSession,
    user_id: str,
) -> QuoteRecommendation:
    """Compare contractor quotes and return the best choice with justification."""
    if not _check_rate_limit(user_id):
        raise RuntimeError("Limite de débit IA atteinte — réessayez dans une minute.")

    prompt = f"""Tu es un expert en gestion de travaux immobiliers. Compare ces devis et recommande le meilleur.

Devis (indexés à partir de 0) :
{json.dumps(quotes, ensure_ascii=False, indent=2)}

Critères (par ordre de priorité) :
1. Note de l'entreprise (fiabilité)
2. Rapport qualité/prix
3. Délai d'intervention
4. Complétude des prestations

Retourne UNIQUEMENT un objet JSON valide :
{{
  "best_quote_index": <int>,
  "runner_up_index": <int|null>,
  "justification": "<explication claire en 2-3 phrases>"
}}"""

    client = _client()
    message = await client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        messages=[{"role": "user", "content": prompt}],
    )

    await _log_usage(db, user_id, "recommend_quote", message.usage)

    raw = message.content[0].text.strip()  # type: ignore[union-attr]
    if "```" in raw:
        raw = raw.split("```")[1].lstrip("json").strip()

    try:
        data = json.loads(raw)
        return QuoteRecommendation(
            best_quote_index=int(data["best_quote_index"]),
            runner_up_index=data.get("runner_up_index"),
            justification=data.get("justification", ""),
        )
    except (json.JSONDecodeError, KeyError, ValueError) as exc:
        log.warning("Failed to parse quote recommendation JSON: %s", exc)
        return QuoteRecommendation(best_quote_index=0, justification=raw)


# ── 4. Chat copilot — streaming SSE ──────────────────────────────────────────

SYSTEM_PROMPT = """Tu es AlthyAI, le copilote IA d'Althy — plateforme de gestion immobilière (althy.ch).

Tu aides les propriétaires, agences et locataires à gérer leur activité immobilière.
Tu peux :
- Expliquer les démarches (bail, état des lieux, congé, etc.)
- Analyser des situations et donner des conseils
- Suggérer des actions dans l'application (ex: "créer un contrat", "ajouter un bien")
- Répondre aux questions sur la réglementation locative française et suisse

Quand tu suggères une action dans l'app, utilise ce format JSON en fin de réponse :
<action>{"type": "navigate", "path": "/contracts/new", "label": "Créer un contrat"}</action>

Pour les actions qui nécessitent une validation humaine (paiements, création de documents légaux),
ajoute requires_validation: true dans l'action JSON.

Sois concis, professionnel et bienveillant. Réponds toujours en français."""

# ── Role-specific system prompts ──────────────────────────────────────────────

_ROLE_PROMPTS: dict[str, str] = {
    "owner": """Tu es AlthyAI, copilote IA d'un propriétaire sur Althy (althy.ch), plateforme immobilière suisse.

Tes compétences pour ce propriétaire :
- Gestion complète de ses biens (loyers, locataires, travaux, historique)
- Rédaction automatique de baux conformes au droit suisse (CO art. 253-274g)
- États des lieux d'entrée/sortie (EDL) détaillés et opposables
- Analyse des paiements, détection d'anomalies, relances
- Résumé de l'historique complet d'un bien (locataires, interventions, incidents)
- Contenu pour réseaux sociaux (annonces, posts immobiliers)
- Coordination des interventions techniques

Actions disponibles :
<action>{"type": "navigate", "path": "/app/biens", "label": "Mes biens"}</action>
<action>{"type": "navigate", "path": "/app/contracts/new", "label": "Nouveau bail", "requires_validation": true}</action>
<action>{"type": "navigate", "path": "/app/rfqs/new", "label": "Demander intervention"}</action>

Cite le CO (Code des obligations) et les lois cantonales suisses si pertinent. Max 300 mots.""",

    "agency": """Tu es AlthyAI, copilote IA d'une agence immobilière sur Althy (althy.ch).

Tes compétences pour cette agence :
- Gestion du portefeuille complet (tous les biens de toutes les agences)
- Comptabilité officielle exportable fiduciaire (format CSV/PDF structuré)
- Paramétrage flexible des commissions (gérance 2-5%, location 2-4 mois de loyer selon canton)
- Rédaction/adaptation de baux au profil de l'agence (clauses spécifiques, logos, coordonnées)
- EDL professionnels avec rapport complet
- Analyse de performance du portefeuille
- Récupération des infos de l'agence (DA, RC, coordonnées légales)

Actions disponibles :
<action>{"type": "navigate", "path": "/app/biens", "label": "Portefeuille"}</action>
<action>{"type": "navigate", "path": "/app/contracts", "label": "Contrats"}</action>
<action>{"type": "navigate", "path": "/app/transactions", "label": "Comptabilité"}</action>

Taux légaux CH : gérance locative 2-5%, honoraires de location 2-4 mois, dépôt max 3 mois (CO art. 257e).""",

    "tenant": """Tu es AlthyAI, copilote IA d'un locataire sur Althy (althy.ch).

Tes compétences pour ce locataire :
- Expliquer son bail en termes simples et accessibles
- Historique complet de tous ses logements passés et actuels
- Suivi des paiements (loyer, charges, caution)
- Signalement de problèmes et déclenchement d'interventions
- Droits et obligations (Code des obligations suisse, art. 257-259)
- Vérification de l'état des lieux (entrée/sortie)
- Accès aux favoris et alertes de biens disponibles

Actions disponibles :
<action>{"type": "navigate", "path": "/tenant", "label": "Mon espace"}</action>
<action>{"type": "navigate", "path": "/tenant/report", "label": "Signaler un problème"}</action>
<action>{"type": "navigate", "path": "/tenant/documents", "label": "Mes documents"}</action>

Explique le droit suisse simplement. Protège les intérêts du locataire (CO art. 270 hausse de loyer abusive, etc.).""",

    "company": """Tu es AlthyAI, copilote IA d'une entreprise/artisan sur Althy (althy.ch).

Tes compétences pour cette entreprise :
- Rédiger des devis professionnels à partir d'une description de travaux
- Gérer les appels d'offres (RFQ) reçus et y répondre
- Comptabilité des interventions (acceptées, en cours, terminées)
- Importer des devis existants dans la plateforme
- Rapport d'intervention complet après travaux
- Analyse des notes et avis reçus

Actions disponibles :
<action>{"type": "navigate", "path": "/app/rfqs", "label": "Appels d'offres"}</action>
<action>{"type": "navigate", "path": "/app/companies", "label": "Mon profil"}</action>

Sois direct et orienté résultat. Aide à maximiser les opportunités business.""",

    "opener": """Tu es AlthyAI, copilote IA d'un ouvreur terrain sur Althy (althy.ch).

Tes compétences pour cet ouvreur :
- Trouver et accepter des missions proches de sa localisation
- Rédiger des rapports de visite, états des lieux, remise de clés
- Suivre ses gains et ses disponibilités
- Optimiser sa zone d'intervention et ses tarifs
- Signaler des problèmes découverts lors d'une mission

Actions disponibles :
<action>{"type": "navigate", "path": "/app/openers", "label": "Mes missions"}</action>
<action>{"type": "navigate", "path": "/opener", "label": "Tableau de bord ouvreur"}</action>""",

    "super_admin": """Tu es AlthyAI, copilote administrateur de la plateforme Althy.
Tu as accès à toutes les fonctionnalités. Sois précis sur les données de la plateforme.""",
}


def _build_system_prompt(role: str, user_name: str = "", extra_context: str = "") -> str:
    """Return a role-specific system prompt enriched with user context."""
    base = _ROLE_PROMPTS.get(role, SYSTEM_PROMPT)
    parts: list[str] = []
    if user_name:
        parts.append(f"Tu parles à {user_name}.")
    parts.append(base)
    if extra_context:
        parts.append(f"Contexte actuel :\n{extra_context}")
    parts.append("Quand tu suggères une action dans l'app, utilise le format <action>{{...}}</action>.")
    parts.append("Réponds toujours en français. Sois concis et actionnable.")
    return "\n\n".join(parts)


async def _get_conversation_history(
    db: AsyncSession, user_id: str, session_id: str
) -> list[dict]:
    """Récupère les N derniers messages de la session pour contexte."""
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return []
    rows = (
        await db.execute(
            select(ConversationMessage)
            .where(
                ConversationMessage.user_id == uid,
                ConversationMessage.session_id == session_id,
            )
            .order_by(ConversationMessage.created_at.desc())
            .limit(HISTORY_LIMIT)
        )
    ).scalars().all()
    # Reverse to get chronological order
    return [{"role": m.role, "content": m.content} for m in reversed(rows)]


async def _save_messages(
    db: AsyncSession, user_id: str, session_id: str, user_msg: str, assistant_msg: str
) -> None:
    """Persiste le message utilisateur et la réponse assistant."""
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return
    db.add(ConversationMessage(user_id=uid, session_id=session_id, role="user", content=user_msg))
    db.add(ConversationMessage(user_id=uid, session_id=session_id, role="assistant", content=assistant_msg))
    await db.flush()


async def _check_monthly_quota(db: AsyncSession, user_id: str) -> bool:
    """
    Vérifie le quota mensuel. Remet à zéro si on est dans un nouveau mois.
    Retourne True si l'utilisateur peut encore appeler l'IA.
    """
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return True
    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()
    if user is None:
        return True

    now = datetime.now(timezone.utc)
    reset = user.monthly_ai_reset_date
    if reset is None or reset.year != now.year or reset.month != now.month:
        user.monthly_ai_tokens_used = 0
        user.monthly_ai_reset_date = now
        await db.flush()

    return user.monthly_ai_tokens_used < MONTHLY_TOKEN_LIMIT


async def _increment_monthly_tokens(db: AsyncSession, user_id: str, tokens: int) -> None:
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return
    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()
    if user:
        user.monthly_ai_tokens_used = (user.monthly_ai_tokens_used or 0) + tokens
        await db.flush()


# ── Intent detection (keyword-based, no extra API call) ──────────────────────

_INTENT_RULES: list[tuple[re.Pattern[str], str, list[dict]]] = [
    (
        re.compile(
            r"chaudière|plombier|électricien|artisan|panne|cassé|fuite|réparation|"
            r"chauffage|dégât|infiltration|problème technique",
            re.IGNORECASE,
        ),
        "search_artisan",
        [
            {"id": "new_intervention", "label": "Créer une intervention", "icon": "wrench",
             "path": "/app/interventions", "requires_validation": False},
            {"id": "find_artisan",     "label": "Trouver un artisan",     "icon": "search",
             "path": "/app/interventions", "requires_validation": False},
        ],
    ),
    (
        re.compile(
            r"quittance|reçu de loyer|attestation.*loyer|loyer.*reçu|"
            r"bail|contrat.*bail|état des lieux|génère.*document",
            re.IGNORECASE,
        ),
        "generate_document",
        [
            {"id": "gen_doc",      "label": "Générer le document", "icon": "file-text",
             "path": "/app/documents", "requires_validation": True},
            {"id": "view_docs",   "label": "Mes documents",        "icon": "folder",
             "path": "/app/documents", "requires_validation": False},
        ],
    ),
    (
        re.compile(
            r"pas payé|impayé|retard.*loyer|loyer.*retard|n'a pas payé|"
            r"relance|mise en demeure|défaut de paiement",
            re.IGNORECASE,
        ),
        "rent_reminder",
        [
            {"id": "send_reminder", "label": "Envoyer une relance", "icon": "mail",
             "path": "/app/crm", "requires_validation": True},
            {"id": "view_payments", "label": "Voir les paiements",  "icon": "credit-card",
             "path": "/app/finances", "requires_validation": False},
        ],
    ),
    (
        re.compile(
            r"combien vaut|valeur.*bien|estimation|estimer|prix.*marché|"
            r"évaluation|valeur vénale|valorisation",
            re.IGNORECASE,
        ),
        "estimate_property",
        [
            {"id": "estimate",    "label": "Lancer l'estimation", "icon": "trending-up",
             "path": "/estimation", "requires_validation": False},
            {"id": "view_market", "label": "Analyse de marché",   "icon": "bar-chart",
             "path": "/app/biens", "requires_validation": False},
        ],
    ),
]


def _detect_intent(message: str) -> dict | None:
    """Return {intent, actions} if a keyword pattern matches, else None."""
    for pattern, intent, actions in _INTENT_RULES:
        if pattern.search(message):
            return {"intent": intent, "actions": actions}
    return None


async def chat_stream(
    message: str,
    context: dict,
    db: AsyncSession,
    user_id: str,
) -> AsyncGenerator[str, None]:
    """
    Stream a Claude response as SSE chunks with conversation memory.
    Protocol:
      data: {"type": "intent", "intent": "...", "actions": [...]}\n\n  (optional)
      data: {"type": "text",   "text": "..."}\n\n                      (repeated)
      data: {"type": "done"}\n\n
    Backwards-compatible: "text" key still present for legacy parsers.
    """
    if not _check_rate_limit(user_id):
        yield 'data: {"error": "Limite de débit atteinte. Réessayez dans une minute."}\n\n'
        return

    if not await _check_monthly_quota(db, user_id):
        yield 'data: {"error": "Quota mensuel IA atteint. Contactez le support."}\n\n'
        return

    # Emit intent + action suggestions before the text stream
    detected = _detect_intent(message)
    if detected:
        yield f"data: {json.dumps({'type': 'intent', **detected})}\n\n"

    session_id = context.get("session_id") or str(uuid.uuid4())

    # Build context block
    ctx_parts = []
    if context.get("page"):
        ctx_parts.append(f"Page active : {context['page']}")
    if context.get("bien_id"):
        ctx_parts.append(f"Bien sélectionné : {context['bien_id']}")
    if context.get("contract_id"):
        ctx_parts.append(f"Contrat en cours : {context['contract_id']}")
    if context.get("mission_id"):
        ctx_parts.append(f"Mission en cours : {context['mission_id']}")

    role = context.get("role", "")
    user_name = context.get("user_name", "")
    system = _build_system_prompt(role, user_name, "\n".join(ctx_parts))

    # Retrieve conversation history
    history = await _get_conversation_history(db, user_id, session_id)
    messages = history + [{"role": "user", "content": message}]

    client = _client()
    total_input = 0
    total_output = 0
    full_reply = ""

    try:
        async with client.messages.stream(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=system,
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                full_reply += text
                escaped = text.replace("\n", "\\n")
                yield f"data: {json.dumps({'type': 'text', 'text': escaped})}\n\n"

            final = await stream.get_final_message()
            total_input = final.usage.input_tokens
            total_output = final.usage.output_tokens

        yield f"data: {json.dumps({'type': 'done'})}\n\n"
        yield "data: [DONE]\n\n"  # backwards compatibility

        # Persist conversation + update token quota
        await _save_messages(db, user_id, session_id, message, full_reply)
        await _increment_monthly_tokens(db, user_id, total_input + total_output)

    except anthropic.APIError as exc:
        log.error("Claude API error in chat_stream: %s", exc)
        yield f"data: {json.dumps({'type': 'error', 'error': 'Erreur IA temporaire.'})}\n\n"

    finally:
        class _FakeUsage:
            input_tokens = total_input
            output_tokens = total_output

        await _log_usage(db, user_id, "chat", _FakeUsage(), context.get("bien_id"))  # type: ignore[arg-type]


# ── 5. Payment anomaly detection ──────────────────────────────────────────────


async def detect_payment_anomalies(
    owner_id: str,
    db: AsyncSession,
    user_id: str,
) -> list[PaymentAlert]:
    """Detect recurring late payments and suspicious patterns for an owner."""
    if not _check_rate_limit(user_id):
        raise RuntimeError("Limite de débit IA atteinte — réessayez dans une minute.")

    # Fetch last 12 months of transactions for this owner
    try:
        oid = uuid.UUID(owner_id)
    except ValueError:
        return []

    rows = (
        (
            await db.execute(
                select(Transaction)
                .where(
                    Transaction.owner_id == oid,
                    Transaction.type == "rent",
                    Transaction.is_active.is_(True),
                )
                .order_by(Transaction.due_date.desc())
                .limit(100)
            )
        )
        .scalars()
        .all()
    )

    if not rows:
        return []

    # Summarise for Claude (no PII)
    summary = [
        {
            "ref": r.reference,
            "status": r.status,
            "amount": float(r.amount),
            "due_date": r.due_date.isoformat() if r.due_date else None,
            "paid_at": r.paid_at.isoformat() if r.paid_at else None,
            "bien_id": str(r.bien_id) if r.bien_id else None,
            "tenant_id": str(r.tenant_id) if r.tenant_id else None,
        }
        for r in rows
    ]

    prompt = f"""Tu es un expert en analyse de risques locatifs. Analyse ces transactions de loyer et détecte les anomalies.

Transactions (du plus récent au plus ancien) :
{json.dumps(summary, ensure_ascii=False, indent=2)}

Retourne UNIQUEMENT un tableau JSON d'alertes (peut être vide []) :
[
  {{
    "type": "<recurring_late|missed_payment|increasing_delay>",
    "severity": "<low|medium|high>",
    "description": "<description claire en français>",
    "bien_id": "<uuid ou null>",
    "tenant_id": "<uuid ou null>"
  }}
]

Détecte uniquement des patterns réels : impayés répétés, retards croissants, loyers jamais payés."""

    client = _client()
    message = await client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        messages=[{"role": "user", "content": prompt}],
    )

    await _log_usage(db, user_id, "detect_anomalies", message.usage, owner_id)

    raw = message.content[0].text.strip()  # type: ignore[union-attr]
    if "```" in raw:
        raw = raw.split("```")[1].lstrip("json").strip()

    try:
        items = json.loads(raw)
        return [
            PaymentAlert(
                type=item.get("type", "missed_payment"),
                severity=item.get("severity", "medium"),
                description=item.get("description", ""),
                bien_id=item.get("bien_id"),
                tenant_id=item.get("tenant_id"),
            )
            for item in items
            if isinstance(item, dict)
        ]
    except (json.JSONDecodeError, TypeError) as exc:
        log.warning("Failed to parse anomaly JSON: %s", exc)
        return []


# ── 6. Draft lease (Swiss law) ────────────────────────────────────────────────


async def draft_lease(
    property_data: dict,
    tenant_data: dict,
    params: dict,
    db: AsyncSession,
    user_id: str,
) -> str:
    """
    Generate a complete Swiss-law compliant residential lease in French.
    Covers CO art. 253-274g. Returns markdown text ready to render as PDF.
    """
    if not _check_rate_limit(user_id):
        raise RuntimeError("Limite de débit IA atteinte — réessayez dans une minute.")

    prompt = f"""Tu es expert en droit suisse du bail à loyer. Rédige un bail d'habitation COMPLET et juridiquement valide selon le Code des obligations suisse (CO art. 253-274g).

Données du bien :
{json.dumps(property_data, ensure_ascii=False, indent=2)}

Données du locataire :
{json.dumps(tenant_data, ensure_ascii=False, indent=2)}

Paramètres du bail :
{json.dumps(params, ensure_ascii=False, indent=2)}

Rédige le bail complet en markdown avec ces sections obligatoires :
1. **Parties au contrat** (bailleur, locataire, bien)
2. **Objet du bail** (description précise du logement)
3. **Durée du bail** (début, fin si déterminée, durée minimale)
4. **Loyer et charges** (montant, acompte charges, mode de paiement, IBAN)
5. **Dépôt de garantie** (max 3 mois selon CO art. 257e — sur compte bloqué)
6. **Usage de la chose louée** (affectation, sous-location, animaux)
7. **Entretien et réparations** (art. 259-259i CO — petites réparations à charge locataire)
8. **Résiliation** (délais légaux : 3 mois pour logements, congé à terme)
9. **Hausses de loyer** (procédure formule officielle, art. 269d CO)
10. **État des lieux** (EDL d'entrée joint, réserves)
11. **Dispositions particulières** (selon paramètres spécifiques)
12. **Signatures** (lieu, date, espaces bailleur/locataire)

Utilise les formulations légales suisses exactes. Cite les articles du CO si pertinent.
Note en bas : "Ce bail est fourni à titre indicatif par Althy. Faites-le valider par un juriste avant signature."
Réponds uniquement le bail, en markdown."""

    client = _client()
    message = await client.messages.create(
        model=MODEL,
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}],
    )

    await _log_usage(db, user_id, "draft_lease", message.usage)
    return message.content[0].text.strip()  # type: ignore[union-attr]


# ── 7. Draft EDL (état des lieux) ─────────────────────────────────────────────


async def draft_edl(
    property_data: dict,
    edl_type: str,
    inspection_date: str,
    previous_edl: dict | None,
    db: AsyncSession,
    user_id: str,
) -> dict:
    """
    Generate a structured entry/exit inspection form (EDL) in French.
    Returns a structured dict with rooms, checkpoints, and comparison vs previous EDL.
    """
    if not _check_rate_limit(user_id):
        raise RuntimeError("Limite de débit IA atteinte — réessayez dans une minute.")

    edl_label = "entrée" if edl_type == "entry" else "sortie"
    comparison_block = ""
    if previous_edl and edl_type == "exit":
        comparison_block = f"""
EDL d'ENTRÉE (comparaison) :
{json.dumps(previous_edl, ensure_ascii=False, indent=2)}
Identifie les dégradations entre l'état d'entrée et la sortie.
"""

    prompt = f"""Tu es expert en gestion locative suisse. Génère un état des lieux d'{edl_label} STRUCTURÉ et opposable pour le bien suivant.

Bien :
{json.dumps(property_data, ensure_ascii=False, indent=2)}

Date d'inspection : {inspection_date}
Type : {edl_label.upper()}
{comparison_block}

Retourne UNIQUEMENT ce JSON :
{{
  "type": "{edl_type}",
  "date": "{inspection_date}",
  "property_summary": "description courte du bien",
  "general_condition": "bon|moyen|mauvais",
  "rooms": [
    {{
      "name": "Entrée / Hall",
      "elements": [
        {{"name": "Sol", "condition": "bon|moyen|mauvais|à noter", "notes": ""}},
        {{"name": "Murs/Plafond", "condition": "bon", "notes": ""}},
        {{"name": "Éclairage", "condition": "bon", "notes": ""}},
        {{"name": "Porte", "condition": "bon", "notes": ""}}
      ]
    }}
  ],
  "keys_given": {{"entrance": 2, "mailbox": 1, "cellar": 0, "garage": 0}},
  "meter_readings": {{"electricity_kwh": null, "water_m3": null, "gas_m3": null}},
  "remarks": "observations générales",
  "degradations": [],
  "total_estimated_cost_chf": null,
  "signatures_required": ["bailleur", "locataire", "témoin_optionnel"]
}}

Adapte les pièces au type de bien (studio = moins de pièces, villa = plus). Génère une liste réaliste.
Inclus : cuisine, salle de bain, WC, séjour, chambres selon le bien, cave/local si applicable."""

    client = _client()
    message = await client.messages.create(
        model=MODEL,
        max_tokens=3000,
        messages=[{"role": "user", "content": prompt}],
    )

    await _log_usage(db, user_id, "draft_edl", message.usage)

    raw = message.content[0].text.strip()  # type: ignore[union-attr]
    if "```" in raw:
        raw = raw.split("```")[1].lstrip("json").strip()

    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return {"type": edl_type, "date": inspection_date, "raw": raw, "rooms": []}


# ── 8. Mission report (opener) ────────────────────────────────────────────────


async def draft_mission_report(
    mission_data: dict,
    observations: str,
    db: AsyncSession,
    user_id: str,
) -> str:
    """Generate a professional mission report for an opener (visit, check-in, check-out)."""
    if not _check_rate_limit(user_id):
        raise RuntimeError("Limite de débit IA atteinte — réessayez dans une minute.")

    prompt = f"""Tu es un ouvreur terrain professionnel. Rédige un rapport de mission complet et professionnel.

Mission :
{json.dumps(mission_data, ensure_ascii=False, indent=2)}

Observations terrain : {observations}

Rédige en markdown avec :
1. **Résumé de la mission** (type, date, adresse, durée estimée)
2. **Déroulement** (étapes réalisées, personnes présentes)
3. **Observations** (état général, points notables)
4. **Actions réalisées** (remise de clés, photos prises, documents signés, etc.)
5. **Points d'attention** (problèmes détectés, travaux à prévoir)
6. **Confirmation** (mission accomplie / partiellement / problème)

Sois factuel, précis et professionnel. Max 400 mots."""

    client = _client()
    message = await client.messages.create(
        model=MODEL,
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )

    await _log_usage(db, user_id, "draft_mission_report", message.usage)
    return message.content[0].text.strip()  # type: ignore[union-attr]


# ── 9. Company quote assistant ────────────────────────────────────────────────


async def draft_company_quote(
    rfq_data: dict,
    company_data: dict,
    work_description: str,
    db: AsyncSession,
    user_id: str,
) -> dict:
    """AI-assisted professional quote draft for a company responding to an RFQ."""
    if not _check_rate_limit(user_id):
        raise RuntimeError("Limite de débit IA atteinte — réessayez dans une minute.")

    prompt = f"""Tu es un expert en travaux immobiliers. Génère un devis professionnel complet.

Appel d'offre (RFQ) :
{json.dumps(rfq_data, ensure_ascii=False, indent=2)}

Profil de l'entreprise :
{json.dumps(company_data, ensure_ascii=False, indent=2)}

Description complémentaire : {work_description}

Retourne UNIQUEMENT ce JSON :
{{
  "title": "titre du devis",
  "description": "présentation de l'offre (2-3 phrases)",
  "line_items": [
    {{"description": "Main d'œuvre", "unit": "h", "qty": 8, "unit_price_chf": 85, "total_chf": 680}},
    {{"description": "Fournitures et matériaux", "unit": "forfait", "qty": 1, "unit_price_chf": 200, "total_chf": 200}}
  ],
  "subtotal_chf": 880,
  "tva_pct": 8.1,
  "tva_chf": 71.28,
  "total_chf": 951.28,
  "delay_days": 5,
  "warranty_months": 24,
  "validity_days": 30,
  "payment_terms": "30 jours net",
  "notes": "observations ou conditions particulières"
}}

Base tes estimations sur les tarifs horaires suisses réels selon le corps de métier.
TVA CH : 8.1% (taux normal), 3.8% (hébergement), 2.6% (alimentation)."""

    client = _client()
    message = await client.messages.create(
        model=MODEL,
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )

    await _log_usage(db, user_id, "draft_company_quote", message.usage)

    raw = message.content[0].text.strip()  # type: ignore[union-attr]
    if "```" in raw:
        raw = raw.split("```")[1].lstrip("json").strip()

    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return {"raw": raw, "line_items": [], "total_chf": 0}


# ── 10. Explain contract (tenant) ─────────────────────────────────────────────


async def explain_contract(
    contract_data: dict,
    db: AsyncSession,
    user_id: str,
) -> dict:
    """
    Explain a lease contract in plain language for a tenant.
    Returns structured key points + warnings.
    """
    if not _check_rate_limit(user_id):
        raise RuntimeError("Limite de débit IA atteinte — réessayez dans une minute.")

    prompt = f"""Tu es un conseiller locataire bienveillant. Explique ce bail à un locataire en termes simples.

Contrat :
{json.dumps(contract_data, ensure_ascii=False, indent=2)}

Retourne UNIQUEMENT ce JSON :
{{
  "summary": "résumé en 2 phrases accessibles",
  "key_points": [
    {{"title": "Loyer et charges", "value": "CHF XXX/mois + CHF XX charges", "explanation": "Ce que vous payez chaque mois"}},
    {{"title": "Durée", "value": "...", "explanation": "..."}},
    {{"title": "Préavis", "value": "3 mois", "explanation": "Délai pour résilier votre bail"}},
    {{"title": "Dépôt de garantie", "value": "CHF ...", "explanation": "..."}},
    {{"title": "Animaux", "value": "...", "explanation": "..."}},
    {{"title": "Sous-location", "value": "...", "explanation": "..."}}
  ],
  "rights": [
    "Droit à une formule officielle pour toute hausse de loyer (CO art. 269d)",
    "Contestation possible d'une hausse abusive dans les 30 jours"
  ],
  "obligations": [
    "Paiement ponctuel du loyer (avant le 1er du mois)",
    "Signaler immédiatement tout défaut (CO art. 257g)"
  ],
  "warnings": [],
  "important_dates": [
    {{"label": "Début du bail", "date": "..."}},
    {{"label": "Fin du bail", "date": "... ou indéterminée"}}
  ]
}}

Sois clair, positif et neutre. Signale dans 'warnings' tout point défavorable ou inhabituel pour le locataire."""

    client = _client()
    message = await client.messages.create(
        model=MODEL,
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )

    await _log_usage(db, user_id, "explain_contract", message.usage)

    raw = message.content[0].text.strip()  # type: ignore[union-attr]
    if "```" in raw:
        raw = raw.split("```")[1].lstrip("json").strip()

    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return {"summary": raw, "key_points": [], "rights": [], "obligations": [], "warnings": []}


# ── 11. Notification draft (mail / WhatsApp) ──────────────────────────────────


async def draft_notification(
    channel: str,
    recipient_role: str,
    subject: str,
    context: dict,
    db: AsyncSession,
    user_id: str,
) -> dict:
    """
    Draft a ready-to-send notification (email or WhatsApp) for any role.
    channel: "email" | "whatsapp"
    recipient_role: "locataire" | "proprio_solo" | "artisan" | "opener"
    """
    if not _check_rate_limit(user_id):
        raise RuntimeError("Limite de débit IA atteinte — réessayez dans une minute.")

    tone_map = {
        "email": "professionnel, formel, avec objet et formule de politesse complète",
        "whatsapp": "cordial, bref (max 5 lignes), naturel, sans formule longue",
    }
    tone = tone_map.get(channel, tone_map["email"])

    prompt = f"""Tu es un assistant immobilier suisse. Rédige un message prêt à envoyer.

Canal : {channel} ({tone})
Destinataire : {recipient_role}
Sujet / objectif : {subject}
Contexte :
{json.dumps(context, ensure_ascii=False, indent=2)}

Retourne UNIQUEMENT ce JSON :
{{
  "subject": "objet du message (pour email) ou null",
  "body": "corps du message prêt à copier-coller",
  "tone": "{channel}",
  "suggested_send_time": "immédiatement|matin|après-midi",
  "follow_up_days": null
}}

Pour les relances de loyer impayé : ton ferme mais non menaçant, cite le montant et l'échéance.
Pour les annonces de travaux : prévenir avec délai, excuse le dérangement.
Réponds en français."""

    client = _client()
    message = await client.messages.create(
        model=MODEL,
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}],
    )

    await _log_usage(db, user_id, "draft_notification", message.usage)

    raw = message.content[0].text.strip()  # type: ignore[union-attr]
    if "```" in raw:
        raw = raw.split("```")[1].lstrip("json").strip()

    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return {"subject": subject, "body": raw, "tone": channel}


# ── 12. Property full history recap ──────────────────────────────────────────


async def generate_property_recap(
    property_data: dict,
    tenants_history: list[dict],
    transactions_summary: dict,
    interventions: list[dict],
    issues: list[dict],
    db: AsyncSession,
    user_id: str,
) -> dict:
    """
    Generate a complete history recap for a property (owner/agency view).
    Covers all tenants, payments, interventions, incidents.
    """
    if not _check_rate_limit(user_id):
        raise RuntimeError("Limite de débit IA atteinte — réessayez dans une minute.")

    prompt = f"""Tu es un gestionnaire immobilier. Génère un récapitulatif complet de l'historique d'un bien.

Bien :
{json.dumps(property_data, ensure_ascii=False, indent=2)}

Historique des locataires :
{json.dumps(tenants_history, ensure_ascii=False, indent=2)}

Résumé financier :
{json.dumps(transactions_summary, ensure_ascii=False, indent=2)}

Interventions :
{json.dumps(interventions, ensure_ascii=False, indent=2)}

Incidents / problèmes :
{json.dumps(issues, ensure_ascii=False, indent=2)}

Retourne UNIQUEMENT ce JSON :
{{
  "title": "Récap — [adresse]",
  "period": "de [date] à aujourd'hui",
  "financial_summary": {{
    "total_revenue_chf": 0,
    "total_charges_chf": 0,
    "net_chf": 0,
    "avg_monthly_chf": 0,
    "unpaid_count": 0,
    "unpaid_total_chf": 0
  }},
  "occupancy": {{
    "rate_pct": 0,
    "total_tenants": 0,
    "avg_duration_months": 0
  }},
  "tenants": [
    {{"name": "...", "period": "...", "rating": null, "notes": ""}}
  ],
  "interventions_summary": {{
    "total_count": 0,
    "total_cost_chf": 0,
    "categories": {{}}
  }},
  "incidents": [
    {{"date": "...", "type": "...", "resolved": true, "cost_chf": 0}}
  ],
  "score": 0,
  "score_label": "Excellent|Bon|Moyen|À surveiller",
  "recommendations": ["recommandation 1", "recommandation 2"]
}}"""

    client = _client()
    message = await client.messages.create(
        model=MODEL,
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )

    await _log_usage(db, user_id, "property_recap", message.usage)

    raw = message.content[0].text.strip()  # type: ignore[union-attr]
    if "```" in raw:
        raw = raw.split("```")[1].lstrip("json").strip()

    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return {"raw": raw}


# ── 6. Cathy home briefing ────────────────────────────────────────────────────


async def generate_briefing(
    first_name: str,
    role: str,
    context: dict,
    db: AsyncSession,
    user_id: str,
) -> dict:
    """Generate a personalised Cathy home screen briefing (status + priority cards)."""
    if not _check_rate_limit(user_id):
        return {"status": f"bonjour {first_name}", "cards": []}

    role_hints = {
        "owner": "propriétaire immobilier gérant ses biens et locataires",
        "agency": "agence immobilière gérant un portefeuille de biens",
        "super_admin": "administrateur de la plateforme",
        "opener": "ouvreur terrain qui effectue des missions (visites, remises de clés)",
        "tenant": "locataire qui paie son loyer et suit son contrat",
        "company": "artisan/société qui répond à des appels d'offres",
    }

    prompt = f"""Tu es Cathy, l'assistante IA d'une plateforme immobilière.
Génère un briefing personnalisé pour {first_name}, {role_hints.get(role, role)}.

Données temps réel:
{json.dumps(context, ensure_ascii=False, indent=2)}

Retourne UNIQUEMENT ce JSON (aucun texte avant/après):
{{
  "status": "message ultra-court personnalisé (max 55 chars)",
  "cards": [
    {{
      "id": "identifiant_unique",
      "type": "urgent|success|info|mission",
      "label": "label court",
      "badge": "texte badge court",
      "badgeColor": "red|green|blue|amber",
      "title": "titre principal",
      "subtitle": "description courte et utile",
      "primaryAction": {{"label": "Action", "type": "navigate|mark_paid|accept_mission", "path": "/chemin_si_navigate", "id": "uuid_si_action"}},
      "secondaryAction": {{"label": "Voir", "type": "navigate", "path": "/chemin"}}
    }}
  ]
}}

Règles:
- 2 à 4 cartes maximum, seulement les plus urgentes/utiles
- Si données vides: suggère 1-2 actions utiles selon le rôle
- type "urgent" = rouge, "success" = vert, "info" = bleu, "mission" = amber
- Actions: navigate (chemin de la page), mark_paid (id transaction), accept_mission (id mission)
- Chemins disponibles: /biens, /contracts, /transactions, /rfqs, /openers, /companies, /overview
- Réponds en français, sois concis et proactif"""

    client = _client()
    message = await client.messages.create(
        model=MODEL,
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )

    await _log_usage(db, user_id, "generate_briefing", message.usage)

    raw = message.content[0].text.strip()  # type: ignore[union-attr]
    if "```" in raw:
        raw = raw.split("```")[1].lstrip("json").strip()

    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError) as exc:
        log.warning("Failed to parse briefing JSON: %s | raw: %.200s", exc, raw)
        return {"status": f"bonjour {first_name}", "cards": []}
