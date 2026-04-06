"""
CATHY AI Service — powered by Claude claude-sonnet-4-20250514.

Features
--------
1. generate_listing_description  — SEO property ad
2. score_tenant_application      — 0-100 tenant risk score
3. recommend_best_quote          — best contractor quote
4. chat_stream                   — conversational copilot (SSE generator)
5. detect_payment_anomalies      — late-payment pattern detection

Rate limiting
-------------
10 AI calls per minute per user, tracked in Redis (falls back to in-memory
if Redis is unavailable so the service never hard-fails).

All calls are logged to ai_usage_logs.
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, AsyncGenerator

import anthropic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.ai_log import AIUsageLog
from app.models.transaction import Transaction

if TYPE_CHECKING:
    from app.models.property import Property

log = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-20250514"
MAX_TOKENS = 1000
RATE_LIMIT = 10          # calls per minute per user
RATE_WINDOW = 60         # seconds

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
    score: int                         # 0–100
    recommendation: str                # "approve" | "review" | "reject"
    risk_flags: list[str] = field(default_factory=list)
    summary: str = ""


@dataclass
class QuoteRecommendation:
    best_quote_index: int
    justification: str
    runner_up_index: int | None = None


@dataclass
class PaymentAlert:
    type: str                          # "recurring_late" | "missed_payment" | "increasing_delay"
    severity: str                      # "low" | "medium" | "high"
    description: str
    property_id: str | None = None
    tenant_id: str | None = None


# ── 1. Listing description ────────────────────────────────────────────────────

async def generate_listing_description(
    property: "Property",
    db: AsyncSession,
    user_id: str,
) -> str:
    """Generate an SEO-optimised property ad in French."""
    if not _check_rate_limit(user_id):
        raise RuntimeError("Limite de débit IA atteinte — réessayez dans une minute.")

    prop_json = {
        "type": property.type,
        "address": getattr(property, "address", ""),
        "city": getattr(property, "city", ""),
        "surface": getattr(property, "surface", None),
        "rooms": getattr(property, "rooms", None),
        "floor": getattr(property, "floor", None),
        "monthly_rent": getattr(property, "monthly_rent", None),
        "charges": getattr(property, "charges", None),
        "deposit": getattr(property, "deposit", None),
        "is_furnished": getattr(property, "is_furnished", False),
        "has_parking": getattr(property, "has_parking", False),
        "pets_allowed": getattr(property, "pets_allowed", False),
    }

    prompt = f"""Tu es un expert en immobilier et rédaction d'annonces. Rédige une annonce immobilière attrayante et optimisée SEO pour le bien suivant.

Données du bien :
{json.dumps(prop_json, ensure_ascii=False, indent=2)}

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

    await _log_usage(db, user_id, "generate_listing", message.usage, str(property.id))
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

SYSTEM_PROMPT = """Tu es CathyAI, le copilote IA d'CATHY — plateforme de gestion immobilière.

Tu aides les propriétaires, agences et locataires à gérer leur activité immobilière.
Tu peux :
- Expliquer les démarches (bail, état des lieux, congé, etc.)
- Analyser des situations et donner des conseils
- Suggérer des actions dans l'application (ex: "créer un contrat", "ajouter un bien")
- Répondre aux questions sur la réglementation locative française

Quand tu suggères une action dans l'app, utilise ce format JSON en fin de réponse :
<action>{"type": "navigate", "path": "/contracts/new", "label": "Créer un contrat"}</action>

Sois concis, professionnel et bienveillant. Réponds toujours en français."""


async def chat_stream(
    message: str,
    context: dict,
    db: AsyncSession,
    user_id: str,
) -> AsyncGenerator[str, None]:
    """
    Stream a Claude response as SSE chunks.
    Yields strings formatted as SSE events: "data: <text>\\n\\n"
    """
    if not _check_rate_limit(user_id):
        yield 'data: {"error": "Limite de débit atteinte. Réessayez dans une minute."}\n\n'
        return

    # Build context block
    ctx_parts = []
    if context.get("page"):
        ctx_parts.append(f"Page active : {context['page']}")
    if context.get("role"):
        ctx_parts.append(f"Rôle utilisateur : {context['role']}")
    if context.get("property_id"):
        ctx_parts.append(f"Bien sélectionné : {context['property_id']}")

    system = SYSTEM_PROMPT
    if ctx_parts:
        system += "\n\nContexte actuel :\n" + "\n".join(ctx_parts)

    client = _client()
    total_input = 0
    total_output = 0

    try:
        async with client.messages.stream(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=system,
            messages=[{"role": "user", "content": message}],
        ) as stream:
            async for text in stream.text_stream:
                # Escape newlines for SSE
                escaped = text.replace("\n", "\\n")
                yield f"data: {json.dumps({'text': escaped})}\n\n"

            final = await stream.get_final_message()
            total_input = final.usage.input_tokens
            total_output = final.usage.output_tokens

        yield "data: [DONE]\n\n"

    except anthropic.APIError as exc:
        log.error("Claude API error in chat_stream: %s", exc)
        yield f'data: {json.dumps({"error": "Erreur IA temporaire."})}\n\n'

    finally:
        # Log usage with approximate token counts
        class _FakeUsage:
            input_tokens = total_input
            output_tokens = total_output

        await _log_usage(
            db, user_id, "chat",
            _FakeUsage(),  # type: ignore[arg-type]
            context.get("property_id"),
        )


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
    ).scalars().all()

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
            "property_id": str(r.property_id) if r.property_id else None,
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
    "property_id": "<uuid ou null>",
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
                property_id=item.get("property_id"),
                tenant_id=item.get("tenant_id"),
            )
            for item in items
            if isinstance(item, dict)
        ]
    except (json.JSONDecodeError, TypeError) as exc:
        log.warning("Failed to parse anomaly JSON: %s", exc)
        return []


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
- Chemins disponibles: /properties, /contracts, /transactions, /rfqs, /openers, /companies, /overview
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
