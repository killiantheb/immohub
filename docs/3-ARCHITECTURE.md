# 3. Architecture Althy

> **Source de vérité unique** technique.
> Last update : 2026-04-30 (v5)
> Audience : Killian, devs, Claude Code, futur CTO.

---

## 3.1 Stack technique

| Couche | Technologie | Notes |
|---|---|---|
| Frontend | Next.js 14 + TypeScript + Tailwind CSS v3 | App Router, React Server Components |
| State client | Zustand + React Query v5 | `auth`, `sphere`, `notif` stores |
| Backend | FastAPI 0.115 + Python 3.12 | SQLAlchemy 2.0 async (asyncpg) |
| Auth | Supabase Auth | JWT HS256 vérifié côté backend (`SUPABASE_JWT_SECRET`) |
| Base de données | PostgreSQL 16 | Supabase (prod EU Frankfurt) + container local en dev |
| Cache / Queue | Redis 7 + Celery 5 | Worker + beat séparés |
| IA | Anthropic Claude Sonnet | Streaming SSE, intent parsing, OCR |
| Storage | Supabase Storage | Buckets : `documents`, `biens-images`, `candidatures` |
| Paiements | Stripe + Stripe Connect | Abos CHF 29 (Phase 1) + 95/5 split artisans (Phase 2+) |
| Email | Resend | Transactionnel + nurturing |
| SMS | Twilio | Notifications loyers (Phase 1 partiel) |
| Géoloc | Mapbox GL | Landing + carte Mapbox `/app/carte` |
| Analytics | PostHog | Événements opt-in (cookies) |
| Errors | Sentry | Frontend + backend |
| Déploiement | Vercel + Railway | + GitHub Actions CI/CD |

---

## 3.2 Architecture services

```
┌──────────────────────────────────────────────────────────────────────┐
│                          UTILISATEUR                                 │
│       Web (althy.ch) ↔ PWA installable (Phase 5+)                   │
└──────────────┬─────────────────────────────────┬─────────────────────┘
               │ HTTPS                           │ HTTPS
               ▼                                 ▼
┌──────────────────────────┐          ┌──────────────────────────┐
│      VERCEL (FR)         │          │  SUPABASE Auth (EU)      │
│  Next.js 14 frontend     │◄─────────│  JWT HS256               │
│  Edge functions          │          │  Magic link, password    │
└──────────┬───────────────┘          └──────────────────────────┘
           │ REST + SSE
           │ /api/v1/*
           ▼
┌──────────────────────────────────────────────────────────────────┐
│                     RAILWAY (EU)                                  │
│   ┌───────────────┐  ┌──────────┐  ┌───────────┐                │
│   │ FastAPI web   │  │ Celery   │  │ Celery    │                │
│   │ uvicorn       │  │ worker   │  │ beat      │                │
│   └────┬──────────┘  └────┬─────┘  └────┬──────┘                │
│        │                  │             │                        │
│        └──────────────────┴─────────────┘                        │
│                           │                                      │
└───────────────────────────┼──────────────────────────────────────┘
                            │
       ┌────────────────────┼─────────────────────┐
       ▼                    ▼                     ▼
┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ SUPABASE     │  │ REDIS Railway    │  │ EXTERNAL APIs    │
│ PostgreSQL   │  │ Cache + queue    │  │ Anthropic Claude │
│ (Frankfurt)  │  │                  │  │ Stripe + Connect │
│ + Storage    │  │                  │  │ Resend / Twilio  │
│ + Realtime   │  │                  │  │ Mapbox / SIX QR  │
└──────────────┘  └──────────────────┘  └──────────────────┘
```

**Flux principal** : utilisateur → Vercel (Next.js) → Supabase Auth (JWT) → FastAPI Railway → PostgreSQL Supabase + APIs externes (Claude, Stripe, etc.). Réponses SSE pour la sphère IA et le briefing.

**Tâches asynchrones** : Celery worker traite les jobs longs (relances loyers, génération PDF, OCR factures). Celery beat planifie les jobs récurrents (briefing matinal, rappels J-3/J0/J+5/J+10).

**Realtime** : Supabase Realtime configuré pour la messagerie in-app (table `messages`). Pas encore utilisé côté frontend en Phase 1.

---

## 3.3 Modèle de données

**Source de vérité** : `backend/alembic/versions/` — 20 migrations actives (004 → 0037).

Le DDL exhaustif n'est **pas dupliqué dans cette doc** car il rotterait. Pour comprendre une table : ouvrir le fichier de migration correspondant ou le modèle SQLAlchemy `backend/app/models/`.

**Source de vérité granulaire des données** : pour la liste exhaustive des champs par rôle utilisateur, leur acquisition (AUTO / DÉDUIT / IA / EXTERNE / USER / ONBOARDING), leur phase d'activation et leur section UI, voir [`7-CATALOGUE-DONNEES-ALTHY.md`](./7-CATALOGUE-DONNEES-ALTHY.md). Le catalogue couvre 8 rôles utilisateurs + 12 domaines transverses + ~250 données distinctes pour `proprio_solo`, ~150 pour `agence`, ~80 pour `locataire`.

**Domaines à créer ou consolider sur les phases à venir** (cf [`7-CATALOGUE-DONNEES-ALTHY.md`](./7-CATALOGUE-DONNEES-ALTHY.md) §A3 pour la liste exhaustive de 40 domaines) :

- **Phase 1** (sprints 12-15) : `BienAnnexe`, `BienCompteur`, `BienContact`, `BankAccount` (refacto `User.iban`), `OwnerStatement`, `Reminder`, `Caution` (refacto `Contract.deposit`), `CautionRetenue`, `ChargeLine`, `ChargeStatement`, `IndexationEvent`, `IABriefing`.
- **Phase 2** : `TaxStatement`, `Mandate`, `MandateFee`, `VAT`, `VATReport`, `Invoice` (consolidation), `CreditNote`, `BankConnection`, `BankStatement`, `BankTransaction`, `BankMatching`, `PaymentBatch`, `Payment`, `Lead`, `LeadActivity`, `ListingChannel`, `AccountingExport`, `ApprovalWorkflow`, `UserBienAccess`, `UserModuleAccess`.
- **Phase 3-4** : `SaleMandate`, `SaleOffer`, `HunterReferral`, `HunterContact`, `ProfileOpener`, `ProfileArtisan` (refacto), `ProfileHunter`, `ProfileAgence`.

**Consolidations critiques (résolutions doublons audit data-model 30/04/2026)** :

| Avant | Après (source de vérité unique) | Phase consolidation |
|---|---|---|
| 5 sources de loyer dispersées | `Contract.monthly_rent` | P1 |
| 4 systèmes événements / interventions | `WorkOrder` unifié | P1 |
| 5 systèmes documents | `Document` polymorphe | P1 |
| 3 tables devis | `Quote` consolidé | P1 |
| 2 systèmes openers | `ProfileOpener` | P3 |
| 2 profils prestataires | `ProfileArtisan` | P2 |
| `Paiement` + `Transaction` | `Transaction` unifié | P1 |

Doctrine : **Une donnée = une source de vérité unique. Zéro doublon.** Tout endpoint qui modifie un domaine sensible (Bien, Contract, Caution, Transaction, OwnerStatement, Mandate) **doit** écrire dans `audit_logs` (trigger backend automatique).

### Top 10 tables critiques Phase 1

| # | Table | Migration | Rôle |
|---|---|---|---|
| 1 | `profiles` | 004 | Données étendues utilisateur (rôle, IBAN, zone, langue, timezone) |
| 2 | `biens` | 0029 (fusion) | Le centre du modèle. ~50 champs (identité, surface, finances, équipements) |
| 3 | `tenants` | 004 | Locataires + candidats avec scoring IA `ai_score` 0-100 |
| 4 | `leases` | 004 | Baux signés (lien `bien_id` ↔ `tenant_id`) |
| 5 | `loyer_transactions` | 0026 | Loyers QR-facture SPC 2.0 + statut réconciliation CAMT.054 |
| 6 | `documents` | 0030 | Storage Supabase + flag `disclaimer_included` si IA |
| 7 | `interventions_althy` | 008 | Signalements proprio/locataire + devis |
| 8 | `changements_locataire` | 0028 | Cycle changement (5 phases métier, sprint 12) |
| 9 | `ai_sessions` | 010 | Historique sphère + tokens + intents validés |
| 10 | `messages` | 004 | Communication in-app proprio ↔ locataire |

### Migrations clés par phase

| Phase | Migrations notables |
|---|---|
| Phase 0 | 004-011 (foundation) · 0029 (fusion property→bien) |
| Phase 1 | 0026 (loyer_transactions QR) · 0028 (changements) · 0030 (Storage docs) · 0033 (frais proprio CHF 45) · 0034 (waitlist) |
| Phase 2 | 0031 (pricing v3 + agency_relationships) · 0032 (Althy Autonomie A4) |
| Phase 3 | 0035 (partenariats 6 verticales) · 0036 (artisans M1) |
| Multi-pays | 0037 (`currency`, `country`, `locale`, `bank_country` — fondations DACH) |

**Diagramme ER** : non maintenu en Phase 1 (rotterait trop vite). À régénérer via `pgmodeler` ou `dbdiagram.io` au gate Phase 2.

---

## 3.4 Authentification + RBAC

**Provider** : Supabase Auth (signup email/password, magic link, password reset). Le JWT (HS256) est vérifié côté backend FastAPI via `SUPABASE_JWT_SECRET` dans `app/core/security.py:get_current_user`.

**Flow d'inscription Phase 1** :
1. Frontend `/register` propose les rôles **filtrés par `LOCALES_ENABLED` + flags** (cf [`2-ROADMAP.md`](./2-ROADMAP.md) §2.4 et `frontend/src/lib/flags.ts`).
2. Backend `auth.py` valide contre `ALLOWED_SIGNUP_ROLES` env var (Phase 1 : `["proprio_solo", "locataire", "super_admin", "artisan"]`).
3. Création `auth.users` (Supabase) + insert `profiles` (FastAPI) en transaction.
4. Email de confirmation Resend.

### 9 rôles utilisateurs

| Rôle | Phase | Flag | Dashboard |
|---|---|---|---|
| `proprio_solo` | **1 actif** | aucun | `DashboardManager` |
| `locataire` | **1 actif** | aucun | `DashboardTenant` |
| `super_admin` | **1 actif** | aucun | admin pages |
| `agence` | 2 | `ROLE_AGENCE` | `DashboardAgence` |
| `portail_proprio` | 2 | `ROLE_PORTAIL_PROPRIO` | `DashboardPortail` |
| `artisan` | **3 actif partiel** | `ROLE_ARTISAN` | `DashboardArtisan` |
| `opener` | 3 | `ROLE_OPENER` | `DashboardOpener` |
| `expert` | hors phase | hardcodé `false` | `DashboardExpert` |
| `hunter` | hors phase | hardcodé `false` | `DashboardHunter` |

`acheteur_premium` existe également mais reste hardcodé `false` (Phase 5+).

**Mappings legacy** : `owner` → `proprio_solo`, `agency` → `agence`, `tenant` → `locataire`, `company` → `artisan`. Source : `frontend/src/lib/useRole.ts`.

**Ajout d'un rôle** = checklist obligatoire (cf §3.12 Conventions).

---

## 3.5 Sécurité

**RLS Supabase strict** sur toutes les tables. Chaque utilisateur ne voit que ses données. Exemples de policies :

```sql
profiles:    USING (user_id = auth.uid())
biens:       USING (owner_id = auth.uid() OR agency_id = auth.uid())
documents:   USING (owner_id = auth.uid())
```

Les service rôles (backend FastAPI) bypassent RLS via `SUPABASE_SERVICE_KEY`. Tous les endpoints backend filtrent explicitement par `current_user.id`.

**Rate limiting** (slowapi + Redis) sur les endpoints publics :
- `/interesse` : 30/min
- `/postuler` : 10/min
- `/candidature` : 5/min
- `/publier` : 20/min
- `/contact` : 5/min
- IA `/sphere/chat` : 30/jour standard, 100/jour pro (par `subscription.plan`)

**Security headers** (configurés dans `next.config.js` et FastAPI middleware) :
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy` (whitelist Mapbox + Stripe + Anthropic + Sentry + PostHog)

**CORS** : `ALLOWED_ORIGINS` limité à `https://althy.ch`, `https://www.althy.ch`, `https://*.vercel.app` (preview PRs). Pas de wildcard `*`.

**Audit logs** : table `audit_logs` capture toutes les actions financières et modifications critiques (`old_values` / `new_values` JSON). Sérializer Decimal en place depuis PR #1 (session 11).

**Secrets** :
- `SUPABASE_SERVICE_KEY` (bypass RLS)
- `SUPABASE_JWT_SECRET` (vérification JWT)
- `SECRET_KEY` (chiffrement clés API partenaires + sessions internes)
- `ANTHROPIC_API_KEY` (sphère IA)
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`, `TWILIO_AUTH_TOKEN`

**Jamais commités**. Toujours via dashboards Vercel / Railway. Cf [`DEPLOYMENT_CHECKLIST.md`](../DEPLOYMENT_CHECKLIST.md) pour la liste complète.

**Photos uploadées** : noms UUID randomisés (jamais le nom original). Bucket `biens-images` + `candidatures` avec RLS spécifique.

**Coordonnées GPS** : `lat`/`lng` arrondis à 3 décimales dans la marketplace publique (anti-fingerprinting locataires).

---

## 3.6 Direction Artistique

**Palette officielle** (depuis migration v8 du 20/04/2026). Source unique : `frontend/src/app/globals.css`.

| Token CSS | Hex | Rôle |
|---|---|---|
| `--althy-prussian` | `#0F2E4C` | Bleu de Prusse — couleur principale (CTA, liens actifs, icônes) |
| `--althy-signature` | `#1A4975` | Hover du bleu principal |
| `--althy-gold` | `#C9A961` | Or Althy — accents premium (badges « populaire », bordures) |
| `--althy-gold-bg` | `#FEF9E7` | Background subtil sections premium |
| `--althy-bg` | `#FAFAF8` | Surface principale |
| `--althy-glacier` | `#F4F6F9` | Fond sections institutionnelles |
| `--althy-text` | `#0F172A` | Texte principal (slate-900) |
| `--althy-text-2` | `#475569` | Texte secondaire (Ardoise) |
| `--althy-text-3` | `#64748B` | Texte tertiaire (Muted) |

**Règle 85/15** : ~85 % des accents sont en Bleu de Prusse, ~15 % en Or (réservé aux éléments valorisants).

**Wrapper TS** : `frontend/src/lib/design-tokens.ts` exporte `C.prussian`, `C.signature`, `C.gold`, `C.text`, etc. — tous pointent vers `var(--althy-*)`. **Toujours utiliser `C.xxx` dans le code TypeScript**, jamais d'hex direct (sauf exceptions documentées dans CLAUDE.md §B).

**Typographies** (via `next/font/google`) :
- **Fraunces** (titres, serif, weight 300) — `var(--font-serif)`
- **DM Sans** (corps, sans-serif) — `var(--font-sans)`
- Taille base : `15px` sur `html`

**Logo** : 4 variantes « A althy » dans `frontend/src/components/AlthyLogo.tsx`. SVG inline pour permettre le coloring dynamique (gradient gold → prussian).

**Sphère IA** : gradient radial gold (centre) → bleu profond (extérieur), animation framer-motion sur changement d'état (idle / listening / streaming). Composant : `frontend/src/components/sphere/AlthySphere.tsx`. **Phase 1** : implémentation CSS gradient sobre. **Phase 2+** : remplacement par asset designer externe premium (Lottie / Three.js / WebGL animation) pour atteindre le niveau de finition cible Anthropic / Apple Siri.

**Direction artistique scientifique** (doctrine v5, 30/04/2026) : Althy adopte une esthétique scientifique (discipline, rigueur, ordre). Les UI métier suivent un pattern **carrés (cards) avec données majeures + clic pour le détail**. Graphiques (courbes, barres, donuts), organigrammes (workflows), tableaux structurés, hiérarchie visuelle forte. L'objectif est que l'utilisateur ait l'impression de **jouer quand il gère son bien** — gamification subtile par la donnée. Cible UX double : grand-père qui gère 1 appartement ↔ Bernard Nicod qui pilote 5000 lots, le même produit servant les deux sans compromis. Cf [`1-VISION.md`](./1-VISION.md#11-le-concept-en-1-phrase) §1.1.

**Aliases legacy** dans `globals.css` (à supprimer post-migration) : `--althy-orange* = var(--althy-prussian*)`. Garder tant que `C.orange` apparaît dans le code.

**Anti-pattern documenté** : aucun nouveau composant en orange / terre cuite. Palette retirée le 20/04/2026.

---

## 3.7 Internationalisation (i18n)

**Lib** : `next-intl` (compatible Next.js 14 App Router).

**Source de vérité** : `frontend/src/i18n/config.ts` (`LOCALES`, `LOCALES_ENABLED`, `DEFAULT_LOCALE`).

| Locale | Statut | Phase activation |
|---|---|---|
| `fr-CH` | ✅ activée prod (default) | Phase 1 |
| `fr-FR` | déclarée, non activée | Phase 5+ |
| `de-CH` | déclarée, non activée | **Phase 2** |
| `de-DE` | déclarée, non activée | Phase 5+ |
| `it-CH` | déclarée, non activée | Phase 5+ (Tessin) |
| `it-IT` | déclarée, non activée | Phase 5+ |
| `en` | déclarée, non activée | Phase 5+ (expatriés) |

**Bascule** : cookie `NEXT_LOCALE` + préfixe URL (`/de-CH/biens`) → middleware redirect 302 + cookie. **Ne pas utiliser `rewrite`** : Supabase Auth ne verrait pas la requête finale.

**Messages** : `frontend/messages/{locale}.json` — 8 namespaces stables :

| Namespace | Contenu |
|---|---|
| `common` | mots courants (save, cancel, loading, app name) |
| `auth` | écrans login/register/reset |
| `dashboard` | navigation sidebar, empty states, KPIs |
| `landing` | pages publiques (hero, features, témoignages) |
| `autonomie` | landing + calculator Althy Autonomie |
| `pricing` | cartes Tarifs + CTAs |
| `legal` | titres CGU/confidentialité/cookies |
| `errors` | messages d'erreur techniques visibles utilisateur |

**Règle absolue** : aucune string UI hardcodée en FR dans un nouveau composant. Toujours `useTranslations("namespace")` ou `getTranslations()`.

**Backend multi-pays** (migration 0037) :
- `properties.currency` / `contracts.currency` / `subscriptions.currency` / `transactions.currency` / `loyer_transactions.currency` (ISO-4217, default `CHF`)
- `properties.country` / `profiles.country` / `companies.country` (ISO-3166, default `CH`)
- `profiles.locale` (BCP-47, default `fr-CH`)
- `loyer_transactions.bank_country` (route le parser bancaire)

**Services backend** :
- `app.services.currency_service` — `format_currency`, `convert`, `get_exchange_rate` (taux figés Phase 1).
- `app.services.bank_parsers` — registry par `(country, format)`. CAMT.054 (CH) actif, CAMT.053 (SEPA) prêt mais non routé.

**Détail complet** : ancien `docs/i18n-guide.md` (à intégrer ou supprimer en Prompt 3).

---

## 3.8 Intégrations externes

| Service | Usage | Statut Phase 1 |
|---|---|---|
| **Anthropic Claude Sonnet** | Sphère IA, OCR, scoring locataire, briefing | ✅ Active |
| **Stripe** | Abonnements CHF 29 + frais proprio CHF 45 | ✅ Active (abos uniquement) |
| **Stripe Connect Express** | Transactions artisans (95/5 split) | 🟡 Partiel (M1 GE+VD) |
| **Supabase Storage** | Bucket `documents`, `biens-images`, `candidatures` | ✅ Active |
| **Supabase Realtime** | Messagerie in-app | 🟡 Configuré, pas branché |
| **Resend** | Emails transactionnels + nurturing | ✅ Active |
| **Twilio** | SMS notifications loyers | 🟡 Config OK, envoi non testé prod |
| **Mapbox GL** | Landing + carte `/app/carte` | ✅ Active |
| **PostHog** | Analytics (opt-in cookies) | ✅ Active (eu.posthog.com) |
| **Sentry** | Error tracking frontend + backend | ✅ Active |
| **WhatsApp Business API** | Messages auto | 🔮 Phase 5+ (Hub IA) |
| **Google OAuth** (Gmail/Calendar) | Sync agenda | 🔮 Phase 4-5 (Client ID configuré, sync non implémentée) |
| **Microsoft OAuth** (Outlook) | Sync agenda + mail | 🔮 Phase 4-5 (Client ID configuré, sync non implémentée) |
| **Infomaniak kMail** | Sync mail (CH-spécifique) | 🔮 Phase 5+ |
| **SIX QR-bill** | Génération QR-facture SPC 2.0 | 🔮 Sprint 15 |
| **GoCaution / Swisscaution / Firstcaution** | Cautions partenaires | 🔮 Sprint 13 |
| **La Mobilière / Raiffeisen** | Partenariats assurance / hypothèque | 🔮 Phase 2-3 |

### APIs publiques suisses mobilisées

Source de vérité : [`7-CATALOGUE-DONNEES-ALTHY.md`](./7-CATALOGUE-DONNEES-ALTHY.md) §A1.

| API | Usage | Phase | Coût |
|---|---|---|---|
| **GeoAdmin Swisstopo** | Géocoding, EGID, EWID, parcelles, couches cadastre | P1 | Gratuit |
| **RegBL** | Métadonnées bâtiment (surface, année construction, type) | P1 | Gratuit |
| **BNS** | Taux hypothécaire de référence | P1 | Gratuit |
| **OFS** | IPC, statistiques démographiques | P1 | Gratuit |
| **Zefix** | Recherche IDE, raison sociale, registre du commerce CH | P2 | Gratuit (limité) |
| **AFC** | Barèmes fiscaux, taux TVA | P2 | Gratuit |
| **Cadastre cantonal VS (VSGIS)** | Couches cadastre Valais (terrain de jeu Crans-Montana) | P3 | Gratuit |
| **Cadastre cantonal VD / GE** | Couches cadastre Vaud / Genève | P3 | Gratuit |

**Stratégie d'acquisition automatisée** : ~44 % des données d'un bien sont acquises automatiquement (calcul, jointure, géocoding API publique) + ~10 % déduites + ~20 % par IA (OCR, Vision, scraping) + ~10 % via partenaires externes + ~16 % saisie utilisateur (dont ~50 % onboarding une seule fois). Doctrine : *« le proprio fait le minimum, l'IA fait le reste »*. Cf [`7-CATALOGUE-DONNEES-ALTHY.md`](./7-CATALOGUE-DONNEES-ALTHY.md) §A1 + R5.

### DBs propriétaires Althy à constituer

Sources de différenciation défensive d'Althy. Killian alimente progressivement.

| DB | Source d'alimentation | Phase de constitution | Différenciateur |
|---|---|---|---|
| Prix m² loyer par zone | Anonymisation Listings + Contract réels Althy | P2 | Précision granulaire vs estimations agrégées concurrents |
| Prix m² vente par zone | Registre foncier CH + scraping anonymisé portails | P3 | Comparables vente précis |
| Démographique locataire | Anonymisation TenantFile Althy | P3 | Profil locataire dominant par zone |
| Risques (zones inondables, glissements, bruit) | Couches publiques OFEV + cantonales | P3 | Affichage automatique sur fiche bien |
| Barème AFC travaux déductibles | AFC + cantonales + jurisprudence | P2 | IA classifie WorkOrder → déductible/amélioration |
| Subventions cantonales travaux énergie | Sites cantonaux + OFEN | P3 | Suggestions automatiques |
| Comparables vente IA enrichis | DB Althy + registre foncier + portails | P3 | Estimation IA premium |
| Tendances marché 5 ans | Historique Althy + données OFS | P2 | Évolution prix m² fiable |

**Conformité** : toutes les DBs propriétaires sont alimentées avec données anonymisées (k-anonymity ≥ 5 minimum). Cf [`7-CATALOGUE-DONNEES-ALTHY.md`](./7-CATALOGUE-DONNEES-ALTHY.md) §A2.

### Pattern partenaires

**Pattern partenaires** : table `partners` (migration 0035) avec clé API chiffrée via `SECRET_KEY`. Contrats actifs trackés dans `partner_deals` (4 phases : `affiliation` / `exclusive_with_minimum` / `strategic` / `revenue_share`). Leads RGPD-conformes via `partner_leads` (consent obligatoire).

---

## 3.9 Déploiement

**Frontend → Vercel**
- Push sur `main` → auto-deploy production.
- Push sur branche feature → preview deploy URL.
- Variables d'env via dashboard Vercel.
- Build : `next build` puis `next start`.

**Backend → Railway**
- Push sur `main` → auto-deploy 3 services (web FastAPI + worker Celery + beat Celery).
- Variables d'env via dashboard Railway.
- Health check : `GET /api/health` (200 OK requis).

**CI/CD GitHub Actions** (`.github/workflows/ci.yml`) :
- Sur PR / push : backend (`ruff lint` → `ruff format` → `mypy` → `pytest`) + frontend (`eslint` → `tsc` → `next build`).
- Sur merge `main` : deploy auto (Vercel + Railway).

**Migrations Alembic** : appliquées **manuellement** via `make migrate` (ou `alembic upgrade head` dans le shell Railway) **avant** le deploy backend. Procédure validée session 8 : staging d'abord, parité 5/5 validée, puis prod avec backup manuel préalable. Cf `docs/archive/sessions/etape-20-1-B-staging.md`.

**Backup Supabase** : automatique journalier (Supabase Pro). Backup manuel additionnel avant chaque migration sensible.

**Variables d'env requises** : cf [`DEPLOYMENT_CHECKLIST.md`](../DEPLOYMENT_CHECKLIST.md) pour la liste exhaustive (frontend + backend, prod + staging).

---

## 3.10 Conformité technique

**LPD / nLPD 2023** (CH) :
- Chiffrement at-rest (Supabase) + in-transit (TLS 1.3 partout).
- Pseudonymisation des données personnelles avant envoi à Anthropic Claude (noms locataires → tokens, montants → ranges).
- Audit log immutable pour traçabilité des actions financières.

**RGPD** (en complément si users EU futurs Phase 5+) :
- 9 sous-traitants documentés + SCCs (cf [`6-LEGAL.md`](./6-LEGAL.md) §6.4).
- Politique cookies opt-in (PostHog désactivé par défaut, activé après consentement).
- Export RGPD / droit à l'oubli prévu Phase 2.

**Rétention données** :
- 10 ans : données financières (obligation fiscale CH).
- Durée du compte + 2 ans : autres données.
- Audit logs : préservés au-delà des suppressions (préservation traçabilité).
- **Pas de hard delete biens** (soft delete via `is_active = false`).

**Backups** :
- Supabase Pro : backup automatique journalier (RPO < 24h).
- Backup manuel additionnel avant chaque migration sensible.
- Storage : versioning natif Supabase (revenir à n'importe quelle version d'un PDF).

**Disclaimers IA obligatoires** : tout document généré par Claude porte le flag `documents.disclaimer_included = true` et le pied de page disclaimer (frontend `/legal/disclaimer-ia` + backend templates).

---

## 3.11 Architecture cible Phase 2-3

**Vision** : modules globaux filtrés à la place de sous-pages enfants.

**Aujourd'hui** (Phase 1) :
```
/app/biens/[id]/locataire        → composant LocataireSubpage
/app/biens/[id]/finances         → composant FinancesSubpage
/app/biens/[id]/documents        → composant DocumentsSubpage
```

Chaque sous-page a son propre composant, sa propre route, son propre fetch. Duplication massive si on multiplie les biens.

**Demain** (Phase 2-3) :
```
/app/locataires?bien_id=xxx      → composant LocatairesGlobal filtré
/app/finances?bien_id=xxx        → composant FinancesGlobal filtré
/app/documents?bien_id=xxx       → composant DocumentsGlobal filtré
```

Un seul composant `LocatairesGlobal` qui gère tous les locataires de tous les biens, avec un système de filtres (`bien_id`, `statut`, `date_range`, etc.). Les sous-pages enfants deviennent des liens vers le module global pré-filtré.

**Avantages** :
- DRY massif (1 composant au lieu de N).
- Vue transversale possible (« tous mes locataires » sans `bien_id`).
- Cohérence UX (même filtres, même tri, même actions partout).
- Pattern éprouvé : Notion, Linear, Airtable, Stripe Dashboard.

**Migration** : pas de big bang. Module par module au fil des sprints Phase 2. Chaque migration a sa propre PR avec checkpoint UX.

---

## 3.12 Conventions code

**Nommage composants** : préfixe `Althy*` (jamais `Cathy*` héritage du fork initial). Composants dashboard partagés : `D*` (`DCard`, `DKpi`, `DTopNav`, `DEmptyState`, `DRoleHeader`, `DSectionTitle`).

**Tokens design** : `import { C } from "@/lib/design-tokens"`. Jamais d'hex direct dans le `.tsx` sauf exceptions Mapbox GL et gradients SVG (documentées dans CLAUDE.md §B).

**Plans tarifaires** : source unique `frontend/src/lib/plans.config.ts`. Jamais de prix hardcodé ailleurs. Mapping legacy via `LEGACY_PLAN_MAP`.

**Entité légale** : source unique `frontend/src/lib/legal-entity.ts`. Jamais d'« Althy SA » ou « Althy Sàrl » en dur. Cf [`6-LEGAL.md`](./6-LEGAL.md) §6.1.

**i18n** : aucune string UI hardcodée. Toujours `useTranslations()` ou `getTranslations()`.

**URLs** : tout en français (`/app/biens` pas `/app/properties`, `/app/comptabilite` pas `/app/accounting`). Redirections 301 permanentes vers les URLs FR (cf `next.config.js`).

**Branches git** : `feat/`, `fix/`, `refactor/`, `docs/`, `cleanup/` + slug descriptif. Une branche = un sprint/une PR.

**Commits** : verbe au présent (`feat: add X`, `fix: resolve Y`). Pas d'emoji, pas de mention `[skip ci]`.

**Règle 8 — Interaction directe « 1 clic » sur chaque carré** (cf [`2-ROADMAP.md`](./2-ROADMAP.md#210-règles-transverses-toute-la-durée-du-projet) §2.10) : depuis n'importe quelle entité parente (fiche bien, fiche locataire, fiche mandat), l'utilisateur accède et modifie ses entités liées **sans changer de page**. Implémentation côté code :

- Chaque carré (`DCard`) dans une fiche entité doit exposer 3 capacités : (1) **voir le détail** (clic ligne → modale ou side panel via `Sheet` / `Dialog`), (2) **créer un nouveau** (bouton `+` dans le header du carré), (3) **modifier l'existant** (clic ligne → mode édition inline ou modale).
- Les sections globales (`/app/interventions`, `/app/locataires`, `/app/documents`) sont des **vues consolidées multi-biens** ; elles ne sont **jamais le seul point d'accès** à une entité.
- 3 patterns de modale : **fullscreen** (édition de l'entité elle-même : caractéristiques bien, profil utilisateur), **side panel droit 50%** (pilotage sous-entité liée : intervention, devis, paiement, candidature), **modale rapide** (actions ponctuelles, max 480px).
- Source de vérité produit : [`4-PRODUIT.md`](./4-PRODUIT.md) + [`7-CATALOGUE-DONNEES-ALTHY.md`](./7-CATALOGUE-DONNEES-ALTHY.md) (Règle R6).

**Ajout d'un rôle** = checklist obligatoire :
- `frontend/src/lib/useRole.ts` → `ROLE_SECTIONS`
- `frontend/src/components/dashboard/DashboardSidebar.tsx` → items nav
- `frontend/src/lib/flags.ts` → `ROLE_FLAG` + `FLAGS`
- `frontend/src/components/dashboard/DashboardLayoutClient.tsx` → `RESTRICTED_PAGES`
- `backend/app/schemas/auth.py` → `RegisterRequest.role` Literal
- `backend/app/core/config.py` → `ALLOWED_SIGNUP_ROLES` (si Phase 1)

**Tests** :
- Backend : `pytest` (smoke tests sur endpoints critiques + tests unitaires services).
- Frontend : `vitest` (composants critiques) + Playwright e2e (flows complets).
- CI obligatoire avant merge.

---

## 3.13 Référence rapide endpoints

**Source de vérité** : `backend/app/routers/` — **56 routers actifs** dans `main.py`.

### Top 10 routers critiques Phase 1

| # | Router | Rôle | Endpoints clés |
|---|---|---|---|
| 1 | `auth.py` | Inscription / login / JWT | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| 2 | `biens.py` | CRUD biens (refonte fusion 0029) | `GET/POST/PATCH /biens`, `POST /biens/{id}/images` |
| 3 | `tenants.py` (legacy) + `locataires.py` | Locataires + dossier IA | `POST /locataires/{id}/score` |
| 4 | `contracts.py` | Baux | `POST /contracts/generate` (PDF IA) |
| 5 | `loyers.py` | Loyers QR-facture SPC 2.0 (hors Stripe) | `POST /loyers/generer-qr`, `POST /loyers/quittance`, `POST /loyers/reconcilier` |
| 6 | `documents.py` | Storage + génération | `POST /documents/generate`, `POST /documents/{id}/send` |
| 7 | `interventions_althy.py` | Signalements | `POST /interventions`, `POST /interventions/{id}/request-quotes` |
| 8 | `changements.py` | Cycle changement de locataire (sprint 12) | `GET /changement/actif`, `POST /changement/creer`, `PATCH /changement/{id}` |
| 9 | `sphere_agent.py` | Sphère IA + briefing + chat SSE | `GET /sphere/briefing` (SSE), `POST /sphere/chat` (SSE), `POST /sphere/ocr-facture` |
| 10 | `stripe_webhooks.py` | Webhooks Stripe + Connect | `POST /webhooks/webhook` |

**Listing exhaustif des 56 routers** dans CLAUDE.md §H. Réorganisation par domaine prévue Phase 2 (architecture cible §3.11).

### Conventions endpoints

- Préfixe global : `/api/v1`.
- IDs UUID typés strict (`uuid.UUID`) → 422 automatique si malformé (jamais 500).
- Réponses paginées : `PaginatedResponse[T]` (Pydantic v2) avec `items`, `total`, `page`, `size`, `pages`.
- Erreurs : `HTTPException(status_code, detail)` — `detail` toujours en français.
- Endpoints non implémentés : lever `HTTPException(501, "Non implémenté")` — **jamais** de faux `{"status": "sent"}` ou `{"success": true}` quand l'implémentation est un TODO.

---

## Annexes

- [1-VISION.md](./1-VISION.md) — Vision macro Althy
- [2-ROADMAP.md](./2-ROADMAP.md) — Phases produit + sprints
- [4-PRODUIT.md](./4-PRODUIT.md) — Spec fonctionnelle, rôles, modules
- [5-FINANCES.md](./5-FINANCES.md) — Modèle économique
- [6-LEGAL.md](./6-LEGAL.md) — Conformité juridique
- [7-CATALOGUE-DONNEES-ALTHY.md](./7-CATALOGUE-DONNEES-ALTHY.md) — Source de vérité granulaire (données par rôle, acquisition, phases, sections UI)
- [DEPLOYMENT_CHECKLIST.md](../DEPLOYMENT_CHECKLIST.md) — Checklist déploiement (variables d'env, DNS, sécurité)
- [README.md](../README.md) — Setup dev local (Docker + scripts make)
