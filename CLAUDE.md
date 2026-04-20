# ALTHY — L'assistant immobilier suisse

> **Repo :** github.com/killiantheb/immohub · **Prod :** althy.ch
> **Stack :** Next.js 14 App Router + FastAPI + Supabase (PostgreSQL + Auth + Storage)
> **Branche canonique :** `main`
> **Dernière mise à jour :** 2026-04-20 — palette Bleu de Prusse + Or (migration design system v8)

---

## A. Vision produit

Althy est un assistant immobilier suisse disponible 24h/24 pour propriétaires, agences, artisans, ouvreurs, locataires, hunters et experts. Il ne remplace personne — il simplifie, connecte, génère. L'humain décide toujours. **Maître mot : simplicité.** 2 clics maximum. Un grand-père doit pouvoir utiliser Althy sans formation.

**Phase 1 (actuelle) :** gestion locative complète pour `proprio_solo` + `locataire`. Les autres rôles sont en waitlist (`/bientot/[role]`).

---

## B. Design system — état réel du code

### Palette Bleu de Prusse + Or (depuis 2026-04-20)

| Token | Hex | Rôle |
|-------|-----|------|
| Bleu de Prusse | `#0F2E4C` | Couleur principale (CTA, logos, liens actifs, icônes importantes) |
| Bleu signature | `#1A4975` | Hover + accents bleu plus clair |
| Or Althy | `#C9A961` | Accents premium (badges "populaire", bordures CTA premium) |
| Or clair | `#FEF9E7` | Background subtil (sections premium, highlight) |
| Glacier | `#F4F6F9` | Fond de sections institutionnelles |
| Ardoise | `#475569` | Texte secondaire |
| Muted | `#64748B` | Texte tertiaire |

Règle 85/15 : ~85 % des accents sont en Bleu de Prusse, ~15 % en Or (réservé aux éléments valorisants).

### Tokens CSS — source unique : `frontend/src/app/globals.css`

```css
/* Bleu de Prusse — couleur principale */
--althy-prussian:        #0F2E4C;
--althy-prussian-light:  rgba(15,46,76,0.08);
--althy-prussian-bg:     rgba(15,46,76,0.06);
--althy-signature:       #1A4975;       /* hover */
--althy-prussian-border: rgba(15,46,76,0.22);

/* Or Althy — accents premium */
--althy-gold:            #C9A961;
--althy-gold-light:      rgba(201,169,97,0.12);
--althy-gold-bg:         #FEF9E7;
--althy-gold-hover:      #B5975A;
--althy-gold-border:     rgba(201,169,97,0.28);

/* Aliases transition (à supprimer après migration complète) */
--althy-orange:        var(--althy-prussian);
--althy-orange-light:  var(--althy-prussian-light);
--althy-orange-bg:     var(--althy-prussian-bg);
--althy-orange-hover:  var(--althy-signature);
--althy-orange-border: var(--althy-prussian-border);

/* Surfaces */
--althy-bg:        #FAFAF8;
--althy-surface:   #FFFFFF;
--althy-surface-2: #F5F2ED;
--althy-glacier:   #F4F6F9;
--althy-border:    #E8E4DC;
--althy-border-2:  rgba(61,56,48,0.06);

/* Texte */
--althy-text:   #0F172A;   /* slate-900 */
--althy-text-2: #475569;   /* Ardoise */
--althy-text-3: #64748B;   /* Muted */

/* Sémantique */
--althy-green / --althy-red / --althy-amber / --althy-warning / --althy-blue / --althy-purple
/* + leurs variantes -bg */

/* Sidebar */
--sidebar-bg / --sidebar-border / --sidebar-text / --sidebar-text-on / --sidebar-active / --sidebar-hover / --sidebar-gold

/* Radius */
--radius-card: 12px;
--radius-elem: 8px;
```

### Tokens JS — `import { C } from "@/lib/design-tokens"`

Le fichier `lib/design-tokens.ts` expose `C.prussian`, `C.signature`, `C.gold`, `C.text`, `C.border`, etc. — tous pointent vers des `var(--althy-*)`. **Toujours utiliser `C.xxx` dans le code TypeScript.**

`C.orange` reste disponible en alias pointant vers `C.prussian` durant la phase de transition.

### Ticker hex — état réel

Post-migration v8 : 0 occurrence de `#E8602C` dans `frontend/src`. Migration orange → Bleu de Prusse effectuée via les alias CSS + renommage des constantes map.

```
grep -rn '#E8602C' frontend/src --include="*.tsx" → 0 occurrence attendue
grep -rn '#E8602C' frontend/src --include="*.css"  → 0 occurrence attendue
```

### Exceptions hex documentées

| Fichier | Constante | Raison |
|---------|-----------|--------|
| `components/map/AlthyMap.tsx` | `PRUSSIAN = "#0F2E4C"` | Mapbox GL exige du hex brut |
| `components/map/CarteMapboxPage.tsx` | `PRUSSIAN = "#0F2E4C"` | idem |
| `components/map/ZoneMap.tsx` | `PRUSSIAN` / `PRUSSIAN_FILL` / `PRUSSIAN_DASH_BORDER` | idem |
| `app/page.tsx` | `PRUSSIAN_HEX = "#0F2E4C"` | Landing Mapbox layers |
| `globals.css` | Toutes les définitions `--althy-*` | Source des tokens |
| `AlthyLogo.tsx` / `AICopilot.tsx` / `sphere/page.tsx` / `estimation/page.tsx` | Radial gradients sphère | SVG/CSS gradient = hex requis |
| Stripe `appearance` | Hex dans l'objet Stripe Elements | API Stripe exige du hex |

### Alias legacy dans globals.css (ne pas étendre)

```css
--font-display: var(--font-serif);               /* alias → Fraunces */
--terracotta-primary: var(--althy-prussian);     /* legacy → prussian */
--althy-orange: var(--althy-prussian);           /* legacy → prussian */
--charcoal: var(--althy-text);
--cream: var(--althy-bg);
```

### `const S = { ... }` résiduels (4 fichiers structurels — garder tels quels)

- `DashboardSidebar.tsx` — S contient des fonctions CSSProperties, pas un simple map de couleurs
- `communication/AgendaContent.tsx`, `MessagerieContent.tsx`, `WhatsAppContent.tsx` — S.card = CSSProperties

### Typographie

- **Serif (titres) :** `var(--font-serif)` → Fraunces variable, weight 300
- **Sans (corps) :** `var(--font-sans)` → DM Sans, system-ui
- **Taille base :** `font-size: 15px` sur `html`
- Zéro Cormorant Garamond, zéro Playfair Display — tout est Fraunces

---

## C. Stack technique

```
frontend/   Next.js 14 App Router + TypeScript          → Vercel
backend/    FastAPI + Celery + Redis (54 routers)       → Railway
mobile/     React Native / Expo                          → (en pause)
supabase/   PostgreSQL + Auth + Storage + Realtime
            16 migrations actives (004 → 0033)
```

### Dépendances clés (frontend)

`mapbox-gl` · `recharts` · `framer-motion` · `zustand` · `@tanstack/react-query` · `posthog-js` · `react-hook-form` + `zod` · `lucide-react`

### Variables d'environnement

```bash
# frontend/.env.local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_MAPBOX_TOKEN=            # jamais en dur dans le code
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://eu.posthog.com
# Feature flags (Phase 1 : tout à false en prod)
NEXT_PUBLIC_FLAG_AGENCE=false
NEXT_PUBLIC_FLAG_PORTAIL=false
NEXT_PUBLIC_FLAG_ARTISAN=false
NEXT_PUBLIC_FLAG_OPENER=false

# backend/.env
DATABASE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SUPABASE_JWT_SECRET=
SECRET_KEY=
ANTHROPIC_API_KEY=
STRIPE_SECRET_KEY=                   # abonnements uniquement
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER_MONTHLY=        # CHF 14
STRIPE_PRICE_PRO_MONTHLY=            # CHF 29
STRIPE_PRICE_AGENCY_MONTHLY=         # CHF 79
STRIPE_PRICE_AGENCY_PREMIUM_MONTHLY= # CHF 129
RESEND_API_KEY=
TWILIO_ACCOUNT_SID= / TWILIO_AUTH_TOKEN= / TWILIO_FROM_NUMBER=
GOOGLE_CLIENT_ID= / GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID= / MICROSOFT_CLIENT_SECRET=
WHATSAPP_API_TOKEN= / WHATSAPP_PHONE_ID= / META_APP_SECRET=
FEATURE_FLAGS_STRICT=true            # Phase 1 : refuse inscription rôles secondaires
ALLOWED_SIGNUP_ROLES=["proprio_solo","locataire","super_admin"]
```

---

## D. Architecture

### Les 9 rôles

| Rôle | Phase | Flag | Dashboard |
|------|-------|------|-----------|
| `proprio_solo` | **1 (actif)** | aucun | `DashboardManager` |
| `locataire` | **1 (actif)** | aucun | `DashboardTenant` |
| `super_admin` | **1 (actif)** | aucun | admin pages |
| `agence` | 2 | `ROLE_AGENCE` | `DashboardAgence` |
| `portail_proprio` | 2 | `ROLE_PORTAIL_PROPRIO` | `DashboardPortail` |
| `artisan` | 3 | `ROLE_ARTISAN` | `DashboardArtisan` |
| `opener` | 3 | `ROLE_OPENER` | `DashboardOpener` |
| `expert` | hors phase | hardcodé `false` | `DashboardExpert` |
| `hunter` | hors phase | hardcodé `false` | `DashboardHunter` |
| `acheteur_premium` | hors phase | hardcodé `false` | `DashboardAcheteur` |

**Legacy mappings :** `owner` → `proprio_solo`, `agency` → `agence`, `tenant` → `locataire`, `company` → `artisan`

### Pricing v3 (2026-04-20) — source unique : `lib/plans.config.ts`

7 tiers + plan gratuit, alignés sur la vision consolidée.

| Tier | ID | Nom | Prix | Cible | Catégorie |
|------|----|----|------|-------|-----------|
| —    | `gratuit`     | Gratuit       | CHF 0/mois            | 1 bien (essai)       | proprio    |
| A1   | `starter`     | Particulier   | CHF 14/mois           | 1–3 biens            | proprio    |
| A2   | `pro`         | Actif         | CHF 29/mois           | 4–10 biens           | proprio    |
| A3   | `proprio_pro` | Professionnel | CHF 79/mois           | 11–50 biens          | proprio    |
| A4   | `autonomie`   | Althy Autonomie | CHF 39/mois         | Pivot anti-agence    | autonomie  |
| A5   | `agence`      | Agence        | CHF 49/agent/mois     | Régies / agences     | agence     |
| A6   | `invite`      | Compte invité | CHF 9/mois            | Proprio rattaché agence | invited |
| A7   | `enterprise`  | Enterprise    | CHF 1500–5000/mois    | White-label, grandes régies | enterprise |

**Commission T1 (transit loyer)** : conservée à **3%** (baissera à 2% Y5+).

**Frais de dossier locataire T3 (pivot 2026-04-20)** : **CHF 45 payés par le PROPRIÉTAIRE** lors de l'acceptation d'une candidature. Prélèvement off-session automatique via PATCH `/api/v1/marketplace/candidature/{id}`. Un échec n'annule pas l'acceptation.

> **Règle absolue (viralité) : le locataire ne paie JAMAIS rien à Althy.** Ni inscription, ni candidature, ni acceptation, ni frais cachés. Tout endpoint qui facture un locataire est un bug à corriger immédiatement. Les anciennes colonnes `candidatures.frais_payes` et `candidatures.stripe_pi_id` sont conservées pour audit mais plus jamais écrites.

**Pivot stratégique A6 → A4** : un proprio en compte invité peut basculer en
Althy Autonomie. Le backend (`stripe_webhooks._trigger_autonomy_upgrade`) :
- met `agency_relationships.status = 'left_for_autonomy'`
- notifie l'agence (in-app + email Resend)
- log `autonomy_activated` côté front (PostHog)

**Legacy IDs mappés via `LEGACY_PLAN_MAP`** :
`decouverte`/`vitrine` → `gratuit` · `solo` → `starter` · `proprio` → `pro` · `agence_premium` → `enterprise`

**Grandfathering** :
- `subscriptions.is_grandfathered` (migration 0029)
- `subscriptions.grandfathered_price` + `profiles.grandfathered_price` (migration 0031)
- Les agences actuelles à CHF 79 conservent leur prix jusqu'à résiliation/changement.

### Pages publiques (existent)

```
/                      Landing (map hero + sections)
/estimation            Estimation IA
/login                 Connexion
/register              Inscription (rôles filtrés par flags)
/bienvenue             Onboarding post-inscription
/onboarding            Onboarding alternatif
/onboarding/scan       Scan onboarding agence
/rejoindre/[token]     Lien magique
/portail/[token]       Portail proprio public
/portail/accept        Acceptation portail
/bientot/[role]        Waitlist rôles désactivés (Phase 1)
/autonomie             Landing publique Althy Autonomie (pivot CHF 39/mois)
/biens                 Marketplace publique
/biens/[id]            Fiche bien publique
/biens/{ville}         SEO local (geneve, lausanne, fribourg, neuchatel, sion, valais, vaud)
/biens/swipe           Swipe biens
/postuler/[listing_id] Candidature locataire
/publier               Publier un bien
/contact               Contact
/legal                 Mentions légales
/legal/cgu             CGU
/legal/confidentialite Confidentialité
/legal/cookies         Cookies
/legal/disclaimer-ia   Disclaimer IA
/sitemap.ts            Sitemap
```

**Legacy routes encore présentes (à supprimer) :** `/privacy/page.tsx`, `/terms/page.tsx` — remplacées par `/legal/*`.

### Pages app (dashboard) — 61 pages

```
/app                 Dashboard routé par rôle
/app/sphere          Sphère IA (immersive, pas de sidebar)
/app/carte           Carte Mapbox plein écran
/app/biens           Liste biens + onglets
/app/biens/[id]      Fiche bien (vue d'ensemble 2 colonnes + édition inline)
/app/biens/nouveau   Créer un bien
/app/finances        Finances
/app/comptabilite    Comptabilité + OCR
/app/communication   Hub communication (messagerie + agenda + WhatsApp)
/app/messagerie      Messagerie
/app/agenda          Agenda
/app/whatsapp        WhatsApp
/app/crm             CRM locataires
/app/contracts       Contrats
/app/contracts/new   Nouveau contrat
/app/contracts/[id]  Détail contrat
/app/documents       Documents
/app/interventions   Interventions
/app/candidatures    Candidatures (côté proprio)
/app/mes-candidatures Candidatures (côté locataire)
/app/artisans        Marketplace artisans
/app/artisans/{sous-pages}  devis, chantiers, paiements, historique
/app/ouvreurs        Marketplace ouvreurs
/app/ouvreurs/{sous-pages}  missions, revenus, historique
/app/listings        Annonces
/app/publications    → redirect → /app/listings
/app/vente           Vente (flag-gated)
/app/hunters         Hunters (flag-gated)
/app/portail         Portail proprio (flag-gated)
/app/insurance       Assurance (flag-gated)
/app/transactions    Transactions (flag-gated)
/app/settings        Paramètres + sous-pages (notifs, paiement, preferences, zone)
/app/profile         Profil (legacy URL, devrait être /profil)
/app/abonnement      Abonnement + comparaison plans
/app/autonomie       Althy Autonomie (dashboard ou pitch selon plan_id)
/app/admin           Admin
/app/admin/users     Admin utilisateurs
/app/admin/transactions Admin transactions
/app/admin/integration Admin intégrations
```

**Redirections actives :** `/app/overview` → `/app`, `/app/companies` → `/app/agence`, `/app/favorites` → `/app/biens?tab=favoris`, `/app/rfqs` → `/app/artisans/devis`, `/app/publications` → `/app/listings`

### Feature flags — `lib/flags.ts`

| Flag | Phase | Env var | État prod |
|------|-------|---------|-----------|
| `ROLE_AGENCE` | 2 | `NEXT_PUBLIC_FLAG_AGENCE` | `false` |
| `ROLE_PORTAIL_PROPRIO` | 2 | `NEXT_PUBLIC_FLAG_PORTAIL` | `false` |
| `ROLE_ARTISAN` | 3 | `NEXT_PUBLIC_FLAG_ARTISAN` | `false` |
| `ROLE_OPENER` | 3 | `NEXT_PUBLIC_FLAG_OPENER` | `false` |
| `ROLE_EXPERT` | - | hardcodé | `false` |
| `ROLE_HUNTER` | - | hardcodé | `false` |
| `ROLE_ACHETEUR_PREMIUM` | - | hardcodé | `false` |
| `FEATURE_INSURANCE` | - | hardcodé | `false` |
| `FEATURE_VENTE` | - | hardcodé | `false` |
| `FEATURE_TRANSACTIONS` | - | hardcodé | `false` |

**Fichiers impactés :** `flags.ts` → `useRole.ts` (can()) → `DashboardSidebar.tsx` (nav) → `DashboardLayoutClient.tsx` (gate pages + écran "en préparation") → `register/page.tsx` (filtre rôles) → `backend/auth.py` (ALLOWED_SIGNUP_ROLES)

---

## E. Règles absolues

### 1. Couleurs
- **Toujours** `var(--althy-*)` en CSS ou `C.xxx` en inline styles.
- **Interdit** de hardcoder un hex dans un `.tsx` — sauf Mapbox GL (`map/` uniquement), gradients SVG (sphère, logo) et Stripe `appearance`.
- **Interdit** de déclarer `const PRUSSIAN`, `const S = { prussian: "..." }` ou toute map locale de couleurs. Importer `C` depuis `@/lib/design-tokens`.
- Exception map : `const PRUSSIAN = "#0F2E4C"` dans `components/map/` uniquement (Mapbox GL ne supporte pas les CSS vars).
- Boutons primaires → `C.prussian` (Bleu de Prusse). Hover → `C.signature` (#1A4975). Badges "nouveauté"/"populaire" + bordures premium → `C.gold` (#C9A961).

### 2. Boutons
- Chaque `<button>` doit avoir `onClick`, `type="submit"`, ou `disabled={true}`. Pas de boutons décoratifs sans handler.

### 3. Liens internes
- Chaque `href="/app/…"` doit pointer vers une route qui existe. Vérifier que la page `.tsx` correspondante existe.

### 4. Backend — pas de faux statuts
- **Interdit** de retourner `"status": "sent"` ou `"success": true` quand l'implémentation est un TODO/stub.
- Un endpoint non implémenté doit lever `HTTPException(501, "Non implémenté")`.

### 5. Pas de fausses données
- **Interdit** de fabriquer des données qui se présentent comme réelles (faux loyers, faux KPIs). Les données de démo doivent être marquées `[DEMO]` ou provenir d'un seed explicite.

### 6. Ajout de rôle — checklist obligatoire
Tout nouveau rôle nécessite la mise à jour simultanée de :
- `useRole.ts` → `ROLE_SECTIONS`
- `DashboardSidebar.tsx` → items nav
- `flags.ts` → `ROLE_FLAG` + `FLAGS`
- `DashboardLayoutClient.tsx` → `RESTRICTED_PAGES` si nécessaire
- `backend/schemas/auth.py` → `RegisterRequest.role` Literal
- `backend/core/config.py` → `ALLOWED_SIGNUP_ROLES` (si Phase 1)

### 7. Langue
- Tout en français : URLs, labels, boutons, messages d'erreur.
- **Exceptions legacy :** `/app/profile`, `/app/listings`, `/app/insurance`, `/app/transactions` — à corriger progressivement.

### 8. Entité légale
- Source unique : `lib/legal-entity.ts` → `LEGAL.name`, `LEGAL.form`, etc.
- Nom actuel : **"Killian Thébaud — Althy"** (raison individuelle, Sàrl en cours).
- Ne jamais écrire "Althy SA" ou "Althy Sàrl" en dur.

### 9. Navigation
- Logo ALTHY → `/` partout
- `← Retour à althy.ch` sur les pages auth
- SphereWidget visible sur `/app/*` SAUF `/app/sphere` et `/app/carte`
- `DTopNav` en haut de chaque dashboard
- Sidebar : `NAV_GROUPS` + `NAV_BOTTOM` (Althy IA / Profil / Paramètres / Déconnexion)

### 10. Code
- Composants `Althy*` uniquement — aucun `Cathy*`
- Plans depuis `plans.config.ts` — source unique
- Token Mapbox : `process.env.NEXT_PUBLIC_MAPBOX_TOKEN` — jamais en dur
- RLS activé sur toutes les tables Supabase
- Maximum 2 clics pour toute action courante
- Chaque action irréversible → écran de confirmation
- Dashboards : utiliser `DCard`, `DKpi`, `DRoleHeader`, `DSectionTitle`, `DEmptyState`, `DTopNav` depuis `DashBoardShared.tsx`

---

## F. Workflow

### Branches
```
main                      Production
sprintN-taskId-description  Branches de travail (ex: sprint3-S3.2-design-tokens)
```

### PR requirements
- Tests passent (ou justification si nouveau code non testable)
- Screenshot si changement UI
- Commit message conventionnel : `feat:`, `fix:`, `refactor:`, `docs:`

### Déploiement
- Frontend : push sur `main` → Vercel auto-deploy
- Backend : push sur `main` → Railway auto-deploy
- Migrations : appliquer manuellement via `supabase db push` avant le deploy backend

---

## G. Anti-patterns à traquer

| Pattern | Pourquoi c'est un problème | Comment corriger |
|---------|---------------------------|------------------|
| `const S = { prussian: "#0F2E4C", ... }` dans un .tsx | Dilue les tokens DS, couleurs dupliquées | Importer `C` depuis `@/lib/design-tokens` |
| Hex brut (`#0F2E4C`, `#E8602C`, ...) hors `map/` et `globals.css` | Bypass des CSS vars, impossible de themer | Utiliser `var(--althy-prussian)` ou `C.prussian` |
| Nouveau composant décoratif en orange | Palette retirée en 2026-04-20 | Prussian (principal) ou Gold (premium uniquement) |
| Deux composants qui font la même chose | Confusion, maintenance double | Supprimer le doublon, garder le canonique |
| Page dashboard sans lien dans la sidebar | Page orpheline, inatteignable | Ajouter dans `NAV_GROUPS` ou supprimer la page |
| `"status": "sent"` quand rien n'est envoyé | L'UI affiche un succès mensonger | Lever 501 ou implémenter réellement |
| Données fabriquées présentées comme réelles | L'utilisateur prend des décisions sur du faux | Marquer `[DEMO]` ou utiliser un seed |
| `window.posthog?.capture()` direct | Pas de null-check robuste | Utiliser `trackEvent()` depuis `@/lib/analytics.ts` |

---

## H. Endpoints backend — référence rapide

### Sphere (router : `sphere_agent.py`)
```
GET  /sphere/contexte · /sphere/briefing (SSE)
POST /sphere/executer · /sphere/chat (SSE) · /sphere/parse-location
POST /sphere/ocr-facture · /sphere/copilot · /sphere/voice-action
POST /sphere/agency-advisor · /sphere/parse-contract-params · /sphere/rediger-description
```

### Loyers (QR-facture SPC 2.0 — hors Stripe)
```
POST /loyers/generer-qr       → QR-facture PDF + loyer_transaction + Storage upload
POST /loyers/quittance         → Quittance PDF + Storage upload
POST /loyers/reconcilier       → CAMT.054 / liste manuelle
GET  /loyers                   → liste loyer_transactions du proprio
PATCH /loyers/{id}/statut      → forcer statut (admin)
```

### Stripe (abonnements uniquement)
```
POST /stripe/create-subscription-intent → Subscription + client_secret
GET  /stripe/subscription               → abonnement actif
POST /stripe/connect/onboard            → Stripe Connect Express
POST /webhooks/webhook                  → Stripe webhook
```

### Auth
```
POST /auth/register → inscription (garde ALLOWED_SIGNUP_ROLES en Phase 1)
POST /auth/login · /auth/refresh · /auth/logout
GET  /auth/me · PUT /auth/me
```

### Autonomie (A4 — pivot stratégique CHF 39/mois)
```
GET  /autonomie/eligibility            → éligibilité du user connecté
POST /autonomie/comparison             → calcul économie vs régie (public)
POST /autonomie/subscribe              → activation post-paiement Stripe
POST /autonomie/cancel                 → résiliation
GET  /autonomie/usage                  → compteurs unités incluses (4 vérifs + 4 missions)
POST /autonomie/trigger-verification   → décrémente quota vérification
POST /autonomie/trigger-opener-mission → décrémente quota mission ouvreur
POST /autonomie/legal-request          → 501 stub (assistance juridique partenaire)
POST /autonomie/fiscal-export          → 501 stub (export PDF fiscal)
```

### 54 routers au total dans `main.py`
```
auth · properties · contracts · transactions · openers · missions · companies · dashboard
ai_documents · ai_scoring · ai_listings · rfq · admin · smart_onboarding · tenants
ratings · favorites · agency_settings · insurance · crm · documents
biens · locataires · docs_althy · paiements · interventions_althy · missions_ouvreurs
profiles_artisans · scoring · notifications · matching · geocode · listings · marketplace
hunters · stripe_webhooks · portail · integrations · vente · rgpd
sphere_agent · notations · oauth · factures · messagerie · agenda
whatsapp · onboarding · sphere_carte · contact · estimation · loyers · changements · autonomie
```

---

## I. Migrations DB

16 fichiers dans `supabase/migrations/` (004 → 0033).

| Migration | Contenu |
|-----------|---------|
| 004-011 | Settings, zones, consents, integrations, marketplace, interests, candidatures, estimation_logs |
| 0026 | `loyer_transactions` (QR-facture SPC 2.0, transit Althy, CAMT.054) |
| 0027 | `email_sequence_logs` |
| 0028 | `changements_locataire` (cycle check-in/check-out/EDL) |
| 0029 | Pricing v2 : `is_grandfathered` + mapping legacy plans |
| 0030 | Bucket Storage "documents" (PDF) + RLS |
| 0031 | Pricing v3 : `plan_category`, `agency_relationships`, `grandfathered_price`, mapping `agence_premium` → `enterprise` |
| 0032 | `autonomy_subscriptions` (A4 — CHF 39/mois) : compteurs annuels (4 vérifs + 4 missions ouvreur), `previous_agency_id`, RLS |
| 0033 | Pivot facturation dossier locataire : `owner_fee_amount` (CHF 45), `owner_fee_paid_at`, `owner_fee_stripe_intent_id`, `owner_fee_failed_at`/`reason`. Le locataire ne paie plus jamais. |

---

## J. Carte Mapbox

```javascript
style:   'mapbox://styles/mapbox/light-v11'
center:  [7.5, 46.8]
zoom:    7.2
minZoom: 5.5, maxZoom: 16
```

**GeoJSON :** `frontend/public/cantons-suisse.json`
**Cantons actifs :** Genève, Vaud, Valais, Fribourg, Neuchâtel, Jura
**Villes actives :** Genève, Lausanne, Fribourg, Neuchâtel, Sion
**Villes inactives (An 2) :** Berne, Zürich, Bâle

---

## K. Stratégie lancement

```
Phase 1 (actuelle) — Agence fondateur : 130 biens → marketplace peuplée Jour 1
Phase 2            — Early adopters solo + rôle agence activé
Phase 3            — Artisans + ouvreurs activés
Phase 4            — SEO local + LinkedIn + hunters/vente
```

---

## Annexe — TODO connus

### Backend : endpoints stub ou partiels

| Endpoint/Service | État | Fichier |
|------------------|------|---------|
| WhatsApp webhook (réception messages) | Webhook route existe, traitement partiel | `routers/whatsapp.py` |
| SMS Twilio (envoi réel) | Config présente, envoi non testé en prod | `routers/notifications.py` |
| Réconciliation CAMT.054 | Parser existe, non testé avec fichier bancaire réel | `services/reconciliation.py` |
| Stripe Connect onboarding | Route existe, flow complet non testé | `routers/stripe_webhooks.py` |
| OCR facture | Route existe, dépend d'Anthropic vision | `routers/sphere_agent.py` |
| Email sequences | Table `email_sequence_logs` existe, worker Celery à brancher | migration 0027 |

### Pages legacy à supprimer

| Page | Raison |
|------|--------|
| `/privacy/page.tsx` | Remplacée par `/legal/confidentialite` |
| `/terms/page.tsx` | Remplacée par `/legal/cgu` |
| `/app/overview/page.tsx` | Redirect vers `/app` — garder la redirect, supprimer si plus nécessaire |
| `/app/companies/page.tsx` | Redirect vers `/app/agence` |
| `/app/favorites/page.tsx` | Redirect vers `/app/biens?tab=favoris` |
| `/app/rfqs/*` | Redirect vers `/app/artisans/devis` |
| `/app/publications/*` | Redirect vers `/app/listings` |

### Intégrations non finalisées

| Intégration | État | Prochaine étape |
|-------------|------|-----------------|
| Google OAuth (Gmail/Calendar) | Client ID configuré, sync non implémentée | Implémenter `oauth.py` sync endpoints |
| Microsoft OAuth (Outlook) | Client ID configuré, sync non implémentée | idem |
| WhatsApp Business API | Webhook enregistré, messages sortants OK, entrants partiels | Compléter le handler incoming |
| Firebase Push | `FIREBASE_SERVER_KEY` en env, envoi non implémenté | Implémenter dans `notifications.py` |
| PostHog analytics | Wrapper `trackEvent()` existe, événements à compléter | Ajouter tracking sur actions clés |
| Supabase Realtime | Configuré pour messagerie, pas encore utilisé côté frontend | Brancher sur `MessagerieContent.tsx` |

### Dette technique identifiée

| Sujet | Détails |
|-------|---------|
| Alias `--althy-orange*` dans `globals.css` | Transition palette v8 — supprimer quand plus aucune ref `C.orange` / `var(--althy-orange)` | 
| 4 `const S` résiduels | Structurels (CSSProperties) — garder tels quels |
| `comptabilite/page.tsx` | 2 références `S` cassées (TS error) — à corriger |
| URLs legacy anglaises | `/app/profile`, `/app/listings`, `/app/insurance`, `/app/transactions` |
| `/bientot` waitlist POST | Formulaire email sans backend — implémenter table `waitlist` ou Resend list |
