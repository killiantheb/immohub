"""
Celery tasks — séquences d'emails automatiques post-inscription.

Séquences actives :
  proprio_solo : J+0, J+3 (si 0 bien), J+7, J+14 (si plan gratuit), J+30
  locataire    : J+0, J+7

La tâche check_email_sequences() tourne toutes les heures via Celery Beat.
Elle est idempotente grâce à la contrainte UNIQUE(user_id, sequence_key)
sur la table email_sequence_logs.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

import httpx
from app.core.config import settings
from app.tasks.celery_app import celery_app
from celery.utils.log import get_task_logger
from sqlalchemy import text

logger = get_task_logger(__name__)

APP_URL = settings.FRONTEND_URL  # https://althy.ch
_ORANGE = "#E8602C"

# Rôles proprio (legacy mapping inclus)
_PROPRIO_ROLES = {"proprio_solo", "owner", "agence", "agency"}
_LOCATAIRE_ROLES = {"locataire", "tenant"}


# ── Async runner ──────────────────────────────────────────────────────────────


def _run(coro):
    """Exécute un coroutine depuis un contexte Celery synchrone."""
    return asyncio.run(coro)


# ── Email HTML template ───────────────────────────────────────────────────────


def _email_html(
    *,
    title: str,
    preheader: str,
    body_html: str,
    cta_url: str,
    cta_label: str,
) -> str:
    """Template HTML Althy — simple, responsive, accessible."""
    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>{title}</title>
</head>
<body style="margin:0;padding:0;background:#F9F6F1;font-family:system-ui,-apple-system,Helvetica,sans-serif">
  <!--preheader--><div style="display:none;max-height:0;overflow:hidden;mso-hide:all">
    {preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background:#F9F6F1;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation"
             style="max-width:600px;width:100%;border-radius:12px;overflow:hidden;
                    box-shadow:0 4px 24px rgba(0,0,0,.08)">

        <!-- Logo header -->
        <tr><td style="background:#FFFFFF;padding:22px 32px 18px;
                        border-bottom:3px solid {_ORANGE}">
          <a href="{APP_URL}" style="text-decoration:none">
            <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;
                         font-weight:300;color:#3D3830;letter-spacing:.06em">
              ALT<span style="color:{_ORANGE}">H</span>Y
            </span>
          </a>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#FFFFFF;padding:32px 32px 8px">
          {body_html}
        </td></tr>

        <!-- CTA button -->
        <tr><td style="background:#FFFFFF;padding:8px 32px 32px;text-align:center">
          <a href="{cta_url}"
             style="display:inline-block;background:{_ORANGE};color:#FFFFFF;
                    text-decoration:none;padding:13px 32px;border-radius:8px;
                    font-size:15px;font-weight:600;letter-spacing:.01em;
                    mso-padding-alt:0;border:0">
            {cta_label}
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#F3EFE8;padding:18px 32px;text-align:center">
          <p style="margin:0;font-size:12px;color:#7A7469;line-height:1.7">
            Vous recevez cet email car vous avez créé un compte sur
            <a href="{APP_URL}" style="color:{_ORANGE};text-decoration:none">althy.ch</a>.<br>
            <a href="{APP_URL}/app/settings" style="color:#7A7469">Préférences</a>
            &nbsp;·&nbsp;
            <a href="{APP_URL}/app/settings?tab=notifications" style="color:#7A7469">Se désabonner</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""


# ── User context dataclass ────────────────────────────────────────────────────


@dataclass
class UserCtx:
    user_id: str
    email: str
    first_name: str
    role: str
    registered_at: datetime
    plan: str = "starter"
    nb_biens: int = 0
    nb_docs: int = 0
    nb_loyers: int = 0
    active_24h: bool = False          # a interagi dans les dernières 24h
    has_active_candidature: bool = False


# ── Email definitions ─────────────────────────────────────────────────────────
#
# Chaque définition contient :
#   delay_days  : nombre de jours après inscription
#   window_days : durée de la fenêtre d'envoi (ex: 2 = J+X jusqu'à J+X+2)
#   roles       : rôles concernés
#   subject     : sujet de l'email
#   preheader   : texte preheader (affiché par certains clients email)
#   body_fn     : callable(UserCtx) → str HTML du corps
#   cta_url_fn  : callable(UserCtx) → str URL du bouton
#   cta_label   : texte du bouton
#   condition   : callable(UserCtx) → bool — False = ne pas envoyer


def _body_proprio_j0(ctx: UserCtx) -> str:
    steps = [
        ("🏠", "Ajoutez votre premier bien",
         "Publiez votre bien en 5 minutes avec photos, description et loyer."),
        ("📄", "Générez un bail ou une quittance",
         "Modèles suisses conformes au CO — prêts à l'emploi, personnalisés par IA."),
        ("💬", "Parlez à la Sphère IA",
         "Votre assistant disponible 24h/24 : briefing du jour, questions, actions."),
    ]
    rows = "".join(
        f"""<tr><td style="padding:12px 16px;background:rgba(232,96,44,.07);
                            border-radius:8px;border-left:3px solid {_ORANGE};
                            margin-bottom:8px">
          <strong style="font-size:14px;color:#3D3830">{e} {t}</strong>
          <p style="margin:4px 0 0;font-size:13px;color:#7A7469">{d}</p>
        </td></tr><tr><td style="height:8px"></td></tr>"""
        for e, t, d in steps
    )
    return f"""
    <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:300;
               color:#3D3830;margin:0 0 10px">
      Bonjour {ctx.first_name} 👋
    </h1>
    <p style="color:#5C5650;font-size:15px;line-height:1.7;margin:0 0 24px">
      Bienvenue sur Althy — votre assistant immobilier suisse disponible 24h/24.<br>
      Voici 3 actions pour démarrer en moins de 10 minutes :
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">{rows}</table>
    <p style="color:#7A7469;font-size:13px;margin:0 0 8px">
      Des questions ?
      <a href="mailto:support@althy.ch" style="color:{_ORANGE}">support@althy.ch</a>
      ou
      <a href="{APP_URL}/contact" style="color:{_ORANGE}">althy.ch/contact</a>
    </p>
    """


def _body_proprio_j3(ctx: UserCtx) -> str:
    return f"""
    <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:300;
               color:#3D3830;margin:0 0 10px">
      Bonjour {ctx.first_name},
    </h1>
    <p style="color:#5C5650;font-size:15px;line-height:1.7;margin:0 0 18px">
      Vous avez créé votre compte il y a 3 jours mais n'avez pas encore publié de bien.
      Voici comment le faire en <strong>moins de 5 minutes</strong> :
    </p>
    <ol style="color:#5C5650;font-size:14px;line-height:2.1;
               padding-left:20px;margin:0 0 20px">
      <li>Allez dans <strong>Mes biens</strong> → <strong>Ajouter un bien</strong></li>
      <li>Renseignez l'adresse, le type et le loyer mensuel</li>
      <li>Uploadez au moins 3 photos</li>
      <li>Publiez — votre bien est visible immédiatement</li>
    </ol>
    <p style="color:#5C5650;font-size:14px;line-height:1.7;margin:0 0 20px;
              background:#F9F6F1;padding:14px 16px;border-radius:8px">
      💡 Vous pouvez aussi demander directement à la <strong>Sphère IA</strong> de vous
      guider étape par étape — elle répond instantanément.
    </p>
    <p style="color:#7A7469;font-size:13px;margin:0">
      Des blocages ?
      <a href="{APP_URL}/contact" style="color:{_ORANGE}">Écrivez-nous</a>, on vous aide.
    </p>
    """


def _body_proprio_j7(ctx: UserCtx) -> str:
    items = [
        ("💰", "Vérifiez les loyers reçus ce mois"),
        ("📋", "Relancez les loyers en retard si nécessaire"),
        ("🔔", "Consultez les actions suggérées par la Sphère IA"),
    ]
    rows = "".join(
        f"""<tr><td style="padding:11px 15px;border:1px solid #E8E4DC;border-radius:8px">
          <span style="font-size:17px">{e}</span>
          <span style="font-size:14px;color:#3D3830;margin-left:8px">{t}</span>
        </td></tr><tr><td style="height:7px"></td></tr>"""
        for e, t in items
    )
    return f"""
    <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:300;
               color:#3D3830;margin:0 0 10px">
      Bonjour {ctx.first_name},
    </h1>
    <p style="color:#5C5650;font-size:15px;line-height:1.7;margin:0 0 18px">
      Rappel hebdomadaire — 3 points à vérifier pour rester serein :
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
      {rows}
    </table>
    <p style="color:#7A7469;font-size:13px;margin:0;
              background:rgba(232,96,44,.06);padding:12px 16px;border-radius:8px">
      La <strong>Sphère IA</strong> peut vous préparer un briefing complet en un clic
      avec toutes vos actions prioritaires.
    </p>
    """


def _body_proprio_j14(ctx: UserCtx) -> str:
    rows_data = [
        ("Frais / loyer CHF 1 800/mois", "CHF 180–216 (10–12%)", "CHF 29/mois"),
        ("Biens gérés", "Facturation par bien", "15 biens inclus"),
        ("Documents IA", "Sur devis", "Illimités"),
        ("Sphère IA", "Non disponible", "30 interactions/jour"),
        ("Économie annuelle estimée", "—", "≈ CHF 1 800–2 200/an"),
    ]
    header = f"""<tr style="background:#F9F6F1">
      <td style="padding:10px 14px;font-size:12px;font-weight:600;color:#7A7469;
                 border-bottom:1px solid #E8E4DC;text-transform:uppercase">Critère</td>
      <td style="padding:10px 14px;font-size:12px;font-weight:600;color:#7A7469;
                 border-bottom:1px solid #E8E4DC;text-transform:uppercase">Régie traditionnelle</td>
      <td style="padding:10px 14px;font-size:12px;font-weight:600;color:{_ORANGE};
                 border-bottom:1px solid #E8E4DC;text-transform:uppercase">Althy Pro</td>
    </tr>"""
    body_rows = "".join(
        f"""<tr>
          <td style="padding:10px 14px;font-size:13px;color:#5C5650;
                     border-bottom:1px solid #E8E4DC">{r[0]}</td>
          <td style="padding:10px 14px;font-size:13px;color:#5C5650;
                     border-bottom:1px solid #E8E4DC">{r[1]}</td>
          <td style="padding:10px 14px;font-size:13px;font-weight:600;
                     color:{_ORANGE};border-bottom:1px solid #E8E4DC">{r[2]}</td>
        </tr>"""
        for r in rows_data
    )
    return f"""
    <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:300;
               color:#3D3830;margin:0 0 10px">
      Bonjour {ctx.first_name},
    </h1>
    <p style="color:#5C5650;font-size:15px;line-height:1.7;margin:0 0 18px">
      Après 2 semaines sur Althy, voici pourquoi le plan
      <strong style="color:{_ORANGE}">Pro à CHF 29/mois</strong>
      vaut le détour :
    </p>
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border-collapse:collapse;border:1px solid #E8E4DC;
                  border-radius:8px;overflow:hidden;margin-bottom:18px">
      {header}{body_rows}
    </table>
    <p style="color:#7A7469;font-size:13px;margin:0">
      Pas d'engagement. Résiliable à tout moment depuis votre tableau de bord.
    </p>
    """


def _body_proprio_j30(ctx: UserCtx) -> str:
    stats = [
        (ctx.nb_biens, "bien(s) géré(s) sur Althy"),
        (ctx.nb_docs,  "document(s) IA généré(s)"),
        (ctx.nb_loyers, "loyer(s) tracké(s)"),
    ]
    rows = "".join(
        f"""<tr><td style="padding:14px 18px;
                            background:{'rgba(232,96,44,.07)' if i % 2 == 0 else '#fff'};
                            border-radius:8px;border:1px solid #E8E4DC">
          <span style="font-size:26px;font-weight:700;color:{_ORANGE}">{v}</span>
          <span style="font-size:13px;color:#7A7469;margin-left:8px">{l}</span>
        </td></tr><tr><td style="height:7px"></td></tr>"""
        for i, (v, l) in enumerate(stats)
    )
    return f"""
    <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:300;
               color:#3D3830;margin:0 0 10px">
      Bonjour {ctx.first_name},
    </h1>
    <p style="color:#5C5650;font-size:15px;line-height:1.7;margin:0 0 18px">
      Un mois déjà ! Voici ce qu'Althy a fait pour vous :
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
      {rows}
    </table>
    <p style="color:#5C5650;font-size:14px;line-height:1.7;margin:0 0 16px">
      La Sphère IA apprend de votre portefeuille pour vous proposer des actions
      toujours plus pertinentes. Continuez à l'utiliser quotidiennement.
    </p>
    <p style="color:#7A7469;font-size:13px;margin:0">
      Suggestions ou retours ?
      <a href="mailto:support@althy.ch" style="color:{_ORANGE}">support@althy.ch</a>
    </p>
    """


def _body_locataire_j0(ctx: UserCtx) -> str:
    steps = [
        ("🔍", "Parcourez les biens disponibles",
         "Genève, Lausanne, Fribourg, Neuchâtel, Sion — filtrez par ville, prix, surface."),
        ("📋", "Créez votre dossier locataire",
         "Uploadez vos documents une seule fois et postulez partout en 2 clics."),
        ("✅", "Postulez — notre IA score votre dossier",
         "Score instantané, retour du propriétaire sous 48h en moyenne."),
    ]
    rows = "".join(
        f"""<tr><td style="padding:12px 16px;background:rgba(232,96,44,.07);
                            border-radius:8px;border-left:3px solid {_ORANGE}">
          <strong style="font-size:14px;color:#3D3830">{e} {t}</strong>
          <p style="margin:4px 0 0;font-size:13px;color:#7A7469">{d}</p>
        </td></tr><tr><td style="height:8px"></td></tr>"""
        for e, t, d in steps
    )
    return f"""
    <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:300;
               color:#3D3830;margin:0 0 10px">
      Bonjour {ctx.first_name} 👋
    </h1>
    <p style="color:#5C5650;font-size:15px;line-height:1.7;margin:0 0 22px">
      Bienvenue sur Althy ! Trouvez votre logement en Suisse romande avec un dossier
      100% digital, scoré par IA.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
      {rows}
    </table>
    <p style="color:#7A7469;font-size:13px;background:#F9F6F1;
              padding:12px 16px;border-radius:8px;margin:0">
      💡 <strong>Zéro frais à l'avance.</strong>
      Les CHF 90 de frais de dossier ne sont dus qu'en cas de candidature acceptée
      par le propriétaire.
    </p>
    """


def _body_locataire_j7(ctx: UserCtx) -> str:
    villes = [
        ("🏙️", "Genève &amp; Lausanne", "nouveaux biens publiés cette semaine"),
        ("🏡", "Fribourg &amp; Neuchâtel", "logements accessibles dès CHF 1 200/mois"),
        ("⛰️", "Sion &amp; Valais", "appartements ensoleillés dès CHF 900/mois"),
    ]
    rows = "".join(
        f"""<tr><td style="padding:12px 15px;border:1px solid #E8E4DC;border-radius:8px">
          <span style="font-size:18px">{e}</span>
          <strong style="font-size:14px;color:#3D3830;margin-left:8px">{v}</strong>
          <span style="font-size:13px;color:#7A7469"> · {d}</span>
        </td></tr><tr><td style="height:7px"></td></tr>"""
        for e, v, d in villes
    )
    return f"""
    <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:300;
               color:#3D3830;margin:0 0 10px">
      Bonjour {ctx.first_name},
    </h1>
    <p style="color:#5C5650;font-size:15px;line-height:1.7;margin:0 0 18px">
      De nouveaux logements sont disponibles sur Althy.
      Les propriétaires traitent les candidatures dans l'ordre d'arrivée —
      <strong>soyez parmi les premiers à postuler.</strong>
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px">
      {rows}
    </table>
    <p style="color:#7A7469;font-size:13px;margin:0">
      Créez une <strong>alerte</strong> dans votre espace Althy pour être notifié
      instantanément dès qu'un bien correspond à vos critères.
    </p>
    """


# ── Sequence registry ─────────────────────────────────────────────────────────
#
# Chaque entrée : (delay_days, window_days, roles, subject, preheader,
#                 body_fn, cta_url_fn, cta_label, condition_fn)

@dataclass
class SequenceDef:
    key: str
    delay_days: int          # J+N depuis l'inscription
    window_days: int = 2     # fenêtre d'envoi : J+N → J+N+window
    roles: frozenset = field(default_factory=frozenset)
    subject: str = ""
    preheader: str = ""
    body_fn: object = None   # callable(UserCtx) → str
    cta_url: str = f"{APP_URL}/app"
    cta_label: str = "Accéder à mon espace →"
    condition_fn: object = None  # callable(UserCtx) → bool, None = always True


_SEQUENCES: list[SequenceDef] = [
    SequenceDef(
        key="proprio_j0",
        delay_days=0, window_days=2,
        roles=frozenset(_PROPRIO_ROLES),
        subject="Bienvenue sur Althy — 3 choses que vous pouvez faire maintenant",
        preheader="Votre assistant immobilier est prêt. Commençons.",
        body_fn=_body_proprio_j0,
        cta_url=f"{APP_URL}/app/biens",
        cta_label="Ajouter mon premier bien →",
        condition_fn=None,
    ),
    SequenceDef(
        key="proprio_j3",
        delay_days=3, window_days=2,
        roles=frozenset(_PROPRIO_ROLES),
        subject="Vous n'avez pas encore ajouté de bien ?",
        preheader="C'est simple et rapide — voici comment.",
        body_fn=_body_proprio_j3,
        cta_url=f"{APP_URL}/app/sphere",
        cta_label="Parler à la Sphère IA →",
        condition_fn=lambda ctx: ctx.nb_biens == 0 and not ctx.active_24h,
    ),
    SequenceDef(
        key="proprio_j7",
        delay_days=7, window_days=2,
        roles=frozenset(_PROPRIO_ROLES),
        subject="Cette semaine : vérifiez vos loyers du mois",
        preheader="Restez à jour sur vos paiements en 30 secondes.",
        body_fn=_body_proprio_j7,
        cta_url=f"{APP_URL}/app/finances",
        cta_label="Voir mes finances →",
        condition_fn=lambda ctx: not ctx.active_24h,
    ),
    SequenceDef(
        key="proprio_j14",
        delay_days=14, window_days=2,
        roles=frozenset(_PROPRIO_ROLES),
        subject="Découvrez le plan Pro — 45% moins cher qu'une régie",
        preheader="CHF 29/mois vs CHF 216/mois pour une régie. Faites le calcul.",
        body_fn=_body_proprio_j14,
        cta_url=f"{APP_URL}/app/abonnement",
        cta_label="Découvrir le plan Pro →",
        condition_fn=lambda ctx: ctx.plan in (
            "starter", "decouverte", "vitrine", "free", ""
        ),
    ),
    SequenceDef(
        key="proprio_j30",
        delay_days=30, window_days=2,
        roles=frozenset(_PROPRIO_ROLES),
        subject="Votre premier mois sur Althy — bilan",
        preheader="Voici ce que vous avez accompli en 30 jours.",
        body_fn=_body_proprio_j30,
        cta_url=f"{APP_URL}/app",
        cta_label="Voir mon tableau de bord →",
        condition_fn=None,
    ),
    SequenceDef(
        key="locataire_j0",
        delay_days=0, window_days=2,
        roles=frozenset(_LOCATAIRE_ROLES),
        subject="Bienvenue sur Althy — trouvez votre logement en Suisse romande",
        preheader="Dossier gratuit. Frais de CHF 90 uniquement si vous êtes retenu.",
        body_fn=_body_locataire_j0,
        cta_url=f"{APP_URL}/biens",
        cta_label="Voir les biens disponibles →",
        condition_fn=None,
    ),
    SequenceDef(
        key="locataire_j7",
        delay_days=7, window_days=2,
        roles=frozenset(_LOCATAIRE_ROLES),
        subject="Nouveaux logements disponibles dans votre zone",
        preheader="Des biens viennent d'être publiés — soyez parmi les premiers.",
        body_fn=_body_locataire_j7,
        cta_url=f"{APP_URL}/biens",
        cta_label="Voir les nouveaux biens →",
        condition_fn=lambda ctx: not ctx.has_active_candidature,
    ),
]


# ── Resend email sender ───────────────────────────────────────────────────────


async def _send_email(
    *,
    to_email: str,
    subject: str,
    html: str,
) -> bool:
    """
    Envoie un email via l'API Resend.
    Retourne True si l'envoi a réussi, False sinon (non-bloquant).
    Si RESEND_API_KEY n'est pas configuré, loggue et retourne True (dev mode).
    """
    if not settings.RESEND_API_KEY:
        logger.info("[email_seq] DEV — email ignoré : %s → %s", subject, to_email)
        return True

    try:
        async with httpx.AsyncClient(timeout=12) as client:
            resp = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": f"Althy <{settings.EMAILS_FROM}>",
                    "to": [to_email],
                    "subject": subject,
                    "html": html,
                },
            )
            if resp.status_code in (200, 201):
                return True
            logger.warning(
                "[email_seq] Resend %s pour %s : %s",
                resp.status_code, to_email, resp.text[:200],
            )
            return False
    except Exception as exc:
        logger.error("[email_seq] Erreur Resend (%s): %s", to_email, exc)
        return False


# ── DB helpers ────────────────────────────────────────────────────────────────


async def _fetch_candidates(
    db,
    seq: SequenceDef,
    now: datetime,
) -> list[dict]:
    """
    Retourne les utilisateurs éligibles pour une séquence donnée.
    Critères : rôle correct, fenêtre temporelle correcte, pas encore envoyé.
    """
    since = now - timedelta(days=seq.delay_days + seq.window_days)
    until = now - timedelta(days=seq.delay_days)

    roles_list = list(seq.roles)
    placeholders = ", ".join(f":r{i}" for i in range(len(roles_list)))
    role_params = {f"r{i}": r for i, r in enumerate(roles_list)}

    rows = (await db.execute(
        text(f"""
            SELECT
                p.user_id   AS user_id,
                u.email     AS email,
                COALESCE(p.first_name, split_part(u.email, '@', 1)) AS first_name,
                COALESCE(p.role, u.raw_app_meta_data->>'role', '') AS role,
                u.created_at AS registered_at
            FROM profiles p
            JOIN auth.users u ON u.id = p.user_id
            WHERE COALESCE(p.role, u.raw_app_meta_data->>'role', '')
                  IN ({placeholders})
              AND u.created_at BETWEEN :since AND :until
              AND NOT EXISTS (
                  SELECT 1 FROM email_sequence_logs esl
                  WHERE esl.user_id = p.user_id
                    AND esl.sequence_key = :seq_key
              )
        """),
        {"since": since, "until": until, "seq_key": seq.key, **role_params},
    )).fetchall()

    return [dict(r._mapping) for r in rows]


async def _build_user_ctx(db, candidate: dict, now: datetime) -> UserCtx:
    """
    Construit le contexte complet d'un utilisateur pour évaluer les conditions
    et rendre les templates.
    """
    uid = str(candidate["user_id"])

    # Plan actif
    plan_row = (await db.execute(
        text("""
            SELECT COALESCE(plan, 'starter') AS plan
            FROM subscriptions
            WHERE user_id = :uid AND status = 'active'
            ORDER BY created_at DESC
            LIMIT 1
        """),
        {"uid": uid},
    )).fetchone()
    plan = plan_row[0] if plan_row else "starter"

    # Nombre de biens
    nb_biens_row = (await db.execute(
        text("SELECT COUNT(*) FROM biens WHERE owner_id = :uid"),
        {"uid": uid},
    )).fetchone()
    nb_biens = nb_biens_row[0] if nb_biens_row else 0

    # Nombre de documents IA générés
    nb_docs_row = (await db.execute(
        text("""
            SELECT COUNT(*) FROM ai_actions
            WHERE user_id = :uid AND action_type LIKE 'generer_%'
        """),
        {"uid": uid},
    )).fetchone()
    nb_docs = nb_docs_row[0] if nb_docs_row else 0

    # Nombre de loyers trackés (table loyer_transactions — migration 0026)
    try:
        nb_loyers_row = (await db.execute(
            text("""
                SELECT COUNT(*) FROM loyer_transactions
                WHERE owner_id = :uid
            """),
            {"uid": uid},
        )).fetchone()
        nb_loyers = nb_loyers_row[0] if nb_loyers_row else 0
    except Exception:
        nb_loyers = 0

    # Actif dans les dernières 24h ?
    # Proxy : profil mis à jour OU ai_action créée récemment
    active_row = (await db.execute(
        text("""
            SELECT EXISTS (
                SELECT 1 FROM profiles
                WHERE user_id = :uid
                  AND updated_at > :since
            ) OR EXISTS (
                SELECT 1 FROM ai_actions
                WHERE user_id = :uid
                  AND created_at > :since
            ) AS is_active
        """),
        {"uid": uid, "since": now - timedelta(hours=24)},
    )).fetchone()
    active_24h = bool(active_row[0]) if active_row else False

    # Candidature active (locataire)
    candidature_row = (await db.execute(
        text("""
            SELECT EXISTS (
                SELECT 1 FROM candidatures
                WHERE user_id = :uid
                  AND statut IN ('en_attente', 'acceptee')
            ) AS has_active
        """),
        {"uid": uid},
    )).fetchone()
    has_active_candidature = bool(candidature_row[0]) if candidature_row else False

    return UserCtx(
        user_id=uid,
        email=candidate["email"],
        first_name=candidate["first_name"] or "vous",
        role=candidate["role"] or "",
        registered_at=candidate["registered_at"],
        plan=plan,
        nb_biens=int(nb_biens),
        nb_docs=int(nb_docs),
        nb_loyers=int(nb_loyers),
        active_24h=active_24h,
        has_active_candidature=has_active_candidature,
    )


async def _mark_sent(db, user_id: str, seq_key: str) -> None:
    """Enregistre l'envoi dans email_sequence_logs (ON CONFLICT DO NOTHING = idempotent)."""
    await db.execute(
        text("""
            INSERT INTO email_sequence_logs (user_id, sequence_key)
            VALUES (:uid, :key)
            ON CONFLICT (user_id, sequence_key) DO NOTHING
        """),
        {"uid": user_id, "key": seq_key},
    )
    await db.commit()


# ── Main async logic ──────────────────────────────────────────────────────────


async def _check_email_sequences_async() -> dict:
    from app.core.database import AsyncSessionLocal

    now = datetime.now(tz=timezone.utc)
    sent_total = 0
    skipped_condition = 0
    errors = 0

    async with AsyncSessionLocal() as db:
        for seq in _SEQUENCES:
            try:
                candidates = await _fetch_candidates(db, seq, now)
            except Exception as exc:
                logger.error(
                    "[email_seq] _fetch_candidates(%s) erreur: %s", seq.key, exc
                )
                errors += 1
                continue

            for candidate in candidates:
                try:
                    ctx = await _build_user_ctx(db, candidate, now)
                except Exception as exc:
                    logger.error(
                        "[email_seq] _build_user_ctx(%s, %s) erreur: %s",
                        seq.key, candidate.get("email"), exc,
                    )
                    errors += 1
                    continue

                # Évaluer la condition
                if seq.condition_fn is not None:
                    try:
                        if not seq.condition_fn(ctx):
                            skipped_condition += 1
                            logger.debug(
                                "[email_seq] %s → %s : condition false, skip",
                                seq.key, ctx.email,
                            )
                            continue
                    except Exception as exc:
                        logger.error(
                            "[email_seq] condition(%s, %s) erreur: %s",
                            seq.key, ctx.email, exc,
                        )
                        errors += 1
                        continue

                # Construire l'HTML
                try:
                    body_html = seq.body_fn(ctx)  # type: ignore[operator]
                    html = _email_html(
                        title=seq.subject,
                        preheader=seq.preheader,
                        body_html=body_html,
                        cta_url=seq.cta_url,
                        cta_label=seq.cta_label,
                    )
                except Exception as exc:
                    logger.error(
                        "[email_seq] render(%s, %s) erreur: %s",
                        seq.key, ctx.email, exc,
                    )
                    errors += 1
                    continue

                # Envoyer
                ok = await _send_email(
                    to_email=ctx.email,
                    subject=seq.subject,
                    html=html,
                )

                if ok:
                    await _mark_sent(db, ctx.user_id, seq.key)
                    sent_total += 1
                    logger.info(
                        "[email_seq] ✓ %s → %s", seq.key, ctx.email
                    )
                else:
                    errors += 1

    return {
        "sent": sent_total,
        "skipped_condition": skipped_condition,
        "errors": errors,
        "sequences_checked": len(_SEQUENCES),
    }


# ── Celery task ───────────────────────────────────────────────────────────────


@celery_app.task(
    bind=True,
    name="tasks.check_email_sequences",
    max_retries=2,
    default_retry_delay=300,
)
def check_email_sequences(self) -> dict:
    """
    Tâche Celery Beat — vérification horaire des séquences emails.

    Pour chaque séquence définie dans _SEQUENCES :
      1. Récupère les utilisateurs dans la bonne fenêtre temporelle
         (J+N à J+N+window) n'ayant pas encore reçu l'email.
      2. Évalue les conditions (nb_biens, plan, activité 24h…).
      3. Génère l'HTML et l'envoie via Resend.
      4. Log l'envoi dans email_sequence_logs (idempotent via ON CONFLICT DO NOTHING).
    """
    try:
        result = _run(_check_email_sequences_async())
        logger.info(
            "[email_seq] bilan : sent=%d skip=%d errors=%d",
            result["sent"], result["skipped_condition"], result["errors"],
        )
        return result
    except Exception as exc:
        logger.exception("[email_seq] check_email_sequences failed: %s", exc)
        raise self.retry(exc=exc, countdown=300)
