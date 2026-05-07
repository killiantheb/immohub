# Guide pour Claude Code — Althy

> Last update : 2026-04-29
> Entité opérationnelle : **HBM Swiss Sàrl** (CHE-179.984.757 TVA)
> Marque commerciale : **Althy**
> Branche canonique : `main`

---

## A. Documents de référence — ordre de lecture en début de session

| # | Doc | Contenu | Cas d'usage |
|---|---|---|---|
| 1 | [`docs/1-VISION.md`](docs/1-VISION.md) | Vision macro, cible, USPs | Rappel du « pourquoi » |
| 2 | [`docs/2-ROADMAP.md`](docs/2-ROADMAP.md) | Phases produit + sprints | Comprendre où on en est |
| 3 | [`docs/3-ARCHITECTURE.md`](docs/3-ARCHITECTURE.md) | Stack, DA, i18n, sécurité | Avant de toucher du code |
| 4 | [`docs/4-PRODUIT.md`](docs/4-PRODUIT.md) | Spec fonctionnelle, rôles, modules | Avant de coder une feature |
| 5 | [`docs/5-FINANCES.md`](docs/5-FINANCES.md) | Modèle économique, pricing | Avant de toucher au paiement/facture |
| 6 | [`docs/6-LEGAL.md`](docs/6-LEGAL.md) | Conformité juridique | Avant de toucher aux mentions légales / disclaimers |

**Sprint en cours** : [`docs/session12/SPRINT-bien-complet.md`](docs/session12/SPRINT-bien-complet.md).

**Archives historiques** : `docs/archive/` (HANDOFFs, sprints terminés, BP périmé, dossier-avocat). Ne jamais modifier les archives. Si une archive redevient pertinente, créer une copie à jour dans `docs/`.

---

## B. Règles absolues pour Claude Code

### B.1 Source de vérité = code

- Le **code est la source de vérité** (jamais la doc).
- Si conflit doc ↔ code : on suit le code et on corrige la doc dans le même PR.
- Toute décision tracée en commit message + référence sprint dans `docs/sessionN/`.

### B.2 Pricing

- Source unique : `frontend/src/lib/plans.config.ts`.
- **Jamais** hardcoder un prix (CHF 29, CHF 290, CHF 45, etc.) dans un composant.
- **Jamais** hardcoder une commission (3 %, 5 %) dans le code business.
- Détail : [`docs/5-FINANCES.md`](docs/5-FINANCES.md).

### B.3 Identité légale

- Source unique frontend : `frontend/src/lib/legal-entity.ts` (`LEGAL.name`, `LEGAL.form`, `LEGAL.ide`).
- Source unique backend : `backend/app/core/config.py` (`ALTHY_CREDITOR_NAME`, `ALTHY_CREDITOR_IDE`).
- ⚠️ **Jamais hardcoder** `« HBM Swiss Sàrl »` / `« Althy SA »` / `« Althy Sàrl »` dans le code.
- Permet le transfert futur vers Althy Sàrl sans refacto.
- Backlog code à corriger : 3 occurrences `« Althy SA »` hardcodées backend (cf [`docs/6-LEGAL.md`](docs/6-LEGAL.md) §6.16).

### B.4 Direction Artistique

- Palette officielle : **Bleu de Prusse** `#0F2E4C` (`--althy-prussian`) + **Or** `#C9A961` (`--althy-gold`).
- Source CSS : `frontend/src/app/globals.css`.
- Source TS : `frontend/src/lib/design-tokens.ts` → toujours via `C.prussian`, `C.gold`, etc.
- Typographies : **Fraunces** (titres) + **DM Sans** (corps) via `next/font/google`.
- Logo : `frontend/src/components/AlthyLogo.tsx` (4 variantes).
- ⚠️ **Aucun nouveau composant en orange / terre cuite** (palette retirée le 20/04/2026).
- Exceptions hex documentées : Mapbox GL (`components/map/`), gradients SVG (sphère, logo), Stripe `appearance`.
- Détail : [`docs/3-ARCHITECTURE.md`](docs/3-ARCHITECTURE.md) §3.6.

### B.5 i18n

- Source unique : `frontend/src/i18n/config.ts` (`LOCALES`, `LOCALES_ENABLED`, `DEFAULT_LOCALE`).
- Phase 1 : `fr-CH` activé seul.
- Phase 2 : `de-CH`. Phase 5+ : `it-CH` + `en`.
- **Jamais** hardcoder une locale (`"CHF"`, `"fr-CH"`) dans un composant — passer par `CURRENCY_BY_LOCALE` / `useLocale()`.
- **Jamais** hardcoder une string UI en FR — toujours `useTranslations()` ou `getTranslations()`.
- Détail : [`docs/3-ARCHITECTURE.md`](docs/3-ARCHITECTURE.md) §3.7.

### B.6 Discipline de travail

- **Audit avant code** (lecture seule d'abord, mapping des fichiers impactés).
- **Branches dédiées** : `feat/`, `fix/`, `refactor/`, `docs/`, `cleanup/` + slug descriptif.
- **PRs reviewées** par peer reviewer (Killian) — pas de merge auto sur `main`.
- **Checkpoints obligatoires** après chaque sous-étape (STOP + remontée + validation).
- **Pas de commit sans review**.
- Si on rencontre une anomalie inattendue : STOP + remontée à Killian, ne pas contourner.

### B.7 Phase actuelle

- **Phase 1 = location pure** (proprio_solo + locataire + super_admin).
- Tout autre rôle = ComingSoon Phase 2-3 (artisan partiellement actif M1 GE+VD).
- Marketplace publique routée mais **MASQUÉE** Phase 1 (cleanup PR #6 + #7).
- Détail : [`docs/2-ROADMAP.md`](docs/2-ROADMAP.md) §2.4.

### B.8 Sprint en cours

- **Sprint 12 — Bien complet** (ouvert le 26/04/2026).
- Détail : [`docs/session12/SPRINT-bien-complet.md`](docs/session12/SPRINT-bien-complet.md).
- État au 29/04/2026 : étapes 1, 2, 2bis, 2ter, 3 ✅. Étape 4 (fiche bien refonte cards) ⏭️ à venir. Étape 5 (modification/archivage) ⏭️ à venir.

### B.9 Triple test « 1 clic »

Toute décision design (UI, schéma DB, endpoint, naming) passe les 3 critères :

- ✅ **Simple** pour l'utilisateur (1 clic, vocabulaire clair, pas de jargon)
- ✅ **Complet** pour le pro (aucun champ métier sacrifié)
- ✅ **IA-ready** (structure sémantique forte, audit log, état introspectable)

Si une livraison échoue **un seul** des 3 critères → retour à la planche à dessin.

### B.10 Backend — pas de faux statuts

- ⚠️ **Interdit** de retourner `{"status": "sent"}` ou `{"success": true}` quand l'implémentation est un TODO/stub.
- Endpoint non implémenté → `HTTPException(501, "Non implémenté")`.

### B.11 Pas de fausses données

- ⚠️ **Interdit** de fabriquer des données qui se présentent comme réelles (faux loyers, faux KPIs, faux témoignages).
- Données de démo → marquées `[DEMO]` ou seed explicite.
- Témoignages : sourçables, datés, vérifiables (cf [`docs/6-LEGAL.md`](docs/6-LEGAL.md) §6.8).

### B.12 Logging best-effort isolé

- ⚠️ **Interdit** d'appeler `db.flush()` ou `db.add()` sur la session utilisateur pour un log non-critique (audit IA, métriques, traces) à l'intérieur d'un `try/except` silencieux.
- Postgres met la transaction en état *aborted* dès la première erreur SQL. Le `try/except` masque l'erreur Python mais la session user reste poisonnée → 500 inattendu au commit final.
- Pattern obligatoire : session dédiée via `AsyncSessionLocal()` + try/except englobant tout le bloc (open + add + commit).
- Référence : `app/services/ai_service.py:_log_usage` (figé 2026-05-08 post-incident `/ai/draft-edl`).
- Détail doctrine : [`docs/3-ARCHITECTURE.md`](docs/3-ARCHITECTURE.md) §3.14.

### B.13 Migrations Alembic exclusivement Python

- ⚠️ **Interdit** de créer des fichiers `.sql` dans `backend/alembic/versions/`.
- Alembic ne charge **que les `.py`**. Un `.sql` posé là est **orphelin par construction** : il n'est jamais appliqué par `alembic upgrade head` et crée une dette structurelle invisible (cf incident 2026-05-08 : table `ai_usage_logs` absente en prod pendant 1 mois à cause d'un `0003_ai_usage_logs.sql` jamais exécuté).
- Si une migration nécessite du SQL brut complexe : utiliser `op.execute("""...""")` à l'intérieur du `.py` Alembic.
- Source de vérité : `backend/alembic/versions/*.py` (cf `docs/3-ARCHITECTURE.md` §3.3).

---

## C. Conventions code (rappel rapide)

- Composants `Althy*` (jamais `Cathy*` ni `Immohub*` — héritages forks initiaux).
- Composants dashboard partagés : `D*` (`DCard`, `DKpi`, `DTopNav`, `DEmptyState`, `DRoleHeader`, `DSectionTitle`).
- Tokens design : `C.*` depuis `@/lib/design-tokens` (jamais d'hex direct).
- Plans tarifaires : `lib/plans.config.ts` (jamais de prix hardcodé).
- Identité légale : `lib/legal-entity.ts` (jamais de nom d'entité hardcodé).
- URLs en français : `/app/biens` pas `/app/properties` (redirections 301 dans `next.config.js`).
- Commits : verbe au présent (`feat: add X`), pas d'emoji, pas de `[skip ci]`.
- Détail : [`docs/3-ARCHITECTURE.md`](docs/3-ARCHITECTURE.md) §3.12.

---

## D. Procédure cold-start (début de session)

À exécuter en début de chaque session pour récupérer le contexte :

1. `git status` — vérifier le working tree.
2. `git log --oneline -10` — voir les commits récents.
3. Lire le HANDOFF de la session précédente s'il existe (`docs/sessionN/HANDOFF-*.md` ou archives).
4. Lire [`docs/session12/SPRINT-bien-complet.md`](docs/session12/SPRINT-bien-complet.md) pour le sprint en cours.
5. Survol [`docs/1-VISION.md`](docs/1-VISION.md) pour le rappel cible (5 min).
6. Demander à Killian le contexte précis de la session.
7. Confirmer la branche cible (`main` ou branche feature existante).

---

## E. Ajout d'un nouveau rôle — checklist obligatoire

Tout nouveau rôle nécessite la mise à jour **simultanée** de :

- `frontend/src/lib/useRole.ts` → `ROLE_SECTIONS`
- `frontend/src/components/dashboard/DashboardSidebar.tsx` → items nav
- `frontend/src/lib/flags.ts` → `ROLE_FLAG` + `FLAGS`
- `frontend/src/components/dashboard/DashboardLayoutClient.tsx` → `RESTRICTED_PAGES` si nécessaire
- `backend/app/schemas/auth.py` → `RegisterRequest.role` Literal
- `backend/app/core/config.py` → `ALLOWED_SIGNUP_ROLES` (si activation Phase 1)

Détail : [`docs/3-ARCHITECTURE.md`](docs/3-ARCHITECTURE.md) §3.12 + [`docs/4-PRODUIT.md`](docs/4-PRODUIT.md) §4.14.

---

## F. Backlog dette technique

Voir [`docs/2-ROADMAP.md`](docs/2-ROADMAP.md) §2.10 (règles transverses) et §2.11 (backlog vision long terme).

Backlog connu :
- 3 occurrences `« Althy SA »` hardcodées backend → cf [`docs/6-LEGAL.md`](docs/6-LEGAL.md) §6.16.
- Aliases `--althy-orange*` dans `globals.css` → à supprimer quand plus aucune référence `C.orange` / `var(--althy-orange)`.
- 4 `const S` résiduels (structurels CSSProperties) → garder tels quels.
- TODO connus backend (WhatsApp, SMS Twilio, CAMT.054 réel, OCR enrichi, Email sequences) → cf [`docs/4-PRODUIT.md`](docs/4-PRODUIT.md) §4.10 et §4.13.

---

## G. Si l'utilisateur demande de l'aide ou veut donner du feedback

- `/help` : aide Claude Code.
- Issues GitHub : https://github.com/anthropics/claude-code/issues.
