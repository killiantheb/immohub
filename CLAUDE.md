# ALTHY — L'assistant immobilier suisse
> github.com/killiantheb/immohub · althy.ch · Stack : Next.js 14 + FastAPI + Supabase
> Dernière mise à jour : 2026-04-11 — toutes les corrections Phase 1–5 (P01–P16) appliquées

---

## L'esprit du projet

Althy n'est pas un logiciel de gestion. C'est un assistant immobilier disponible 24h/24, 7j/7, pour tous les acteurs de l'immobilier suisse — propriétaires, agences, artisans, ouvreurs, locataires, hunters, experts.

Il ne remplace personne. Il simplifie, connecte, génère. L'humain décide toujours. Althy propose, l'humain valide.

**Maître mot : simplicité.** 2 clics maximum. Un grand-père doit pouvoir utiliser Althy sans formation.

---

## Design system — tokens actifs dans globals.css

```css
/* Couleur principale — orange vif Althy */
--althy-orange:       #E8602C;   ← COULEUR OFFICIELLE (unifiée partout)
--althy-orange-light: #FEF2EB;
--althy-orange-bg:    rgba(232,96,44,0.08);
--althy-orange-hover: #C84E1E;

/* Surfaces */
--althy-bg:      #FAFAF8;
--althy-surface: #FFFFFF;
--althy-border:  #E8E4DC;

/* Texte */
--althy-text:   #3D3830;
--althy-text-2: #5C5650;
--althy-text-3: #7A7469;

/* Sidebar */
--sidebar-bg:     #FFFFFF;
--sidebar-gold:   #E8602C;
--sidebar-active: rgba(232,96,44,0.08);
--sidebar-hover:  rgba(232,96,44,0.04);

/* Radius */
--radius-card: 12px;
--radius-elem: 8px;
```

### Cohérences garanties ✓
- ✓ Orange unifié : `#E8602C` partout via `var(--althy-orange)` — zéro `#B55A30` dans le code
- ✓ Composants map (`CarteMapboxPage`, `LandingHeroMap`) utilisent la constante `ORANGE = "#E8602C"` pour les couches Mapbox (nécessite hex — CSS vars non supportés par Mapbox GL)
- ✓ Tout le reste utilise `var(--althy-orange)` — inline styles, SVG, gradients

### Typographie
- Titres : `var(--font-serif)` → Cormorant Garamond ou Fraunces, weight 300
- Corps : `var(--font-sans)` → DM Sans, system-ui
- Taille base : `font-size: 15px` sur `html`

### Sidebar — état réel et règle absolue
La `DashboardSidebar.tsx` filtre les items via `can(section)` depuis `useRole.ts`.
Structure : `NAV_GROUPS` (5 groupes) + `NAV_BOTTOM` (3 items fixes bas).

**En bas de la sidebar, pour TOUS les rôles, dans cet ordre :**
```
(séparateur bordure)
◉  Althy IA    → /app/sphere   section: "sphere"    ← point orange animé
👤 Mon profil  → /app/profile  section: "profile"
⚙  Paramètres  → /app/settings section: "settings"
🚪 Déconnexion
```

---

## Stack technique — état réel du repo

```
frontend/   Next.js 14 App Router + TypeScript → Vercel
backend/    FastAPI Python + Celery + Redis → Railway
mobile/     React Native / Expo
supabase/   PostgreSQL + Auth + Storage + Realtime
            25 migrations actives (0001 → 0025)
```

### Dépendances clés (frontend)
- `mapbox-gl` + `@types/mapbox-gl` — carte interactive
- `recharts` — graphiques dashboards
- `framer-motion` — animations
- `zustand` — état global (authStore, sphereStore)
- `@tanstack/react-query` — data fetching
- `posthog-js` — analytics

### Variables d'environnement requises
```bash
# frontend/.env.local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...    ← TOKEN MAPBOX — jamais en dur dans le code
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://eu.posthog.com

# backend/.env (voir .env.example)
ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RESEND_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
WHATSAPP_TOKEN=
FIREBASE_SERVER_KEY=
```

---

## Les 9 rôles — état dans useRole.ts

| Rôle | Label affiché | Prix | Dashboard actif |
|------|--------------|------|----------------|
| `proprio_solo` | Propriétaire | CHF 29/mois | `DashboardManager` |
| `agence` | Agence | CHF 29/agent/mois | `DashboardAgence` |
| `portail_proprio` | Portail Proprio | CHF 9/mois | `DashboardPortail` |
| `opener` | Ouvreur | Gratuit / CHF 19 Pro | `DashboardOpener` |
| `artisan` | Artisan | Gratuit / CHF 19 Pro | `DashboardArtisan` |
| `expert` | Expert | Gratuit / CHF 19 Pro | `DashboardExpert` |
| `hunter` | Hunter | Referral fee | `DashboardHunter` |
| `locataire` | Locataire | Gratuit | `DashboardTenant` |
| `acheteur_premium` | Acheteur | CHF 9/mois | `DashboardAcheteur` |
| `super_admin` | Admin | — | (admin pages) |

**Legacy roles mappés automatiquement :** `owner` → `proprio_solo`, `agency` → `agence`, `tenant` → `locataire`, `company` → `artisan`

### ROLE_SECTIONS — état actuel ✓
Toutes les sections incluent `"profile"` et `"carte"` pour tous les rôles non-admin.
`super_admin` a accès à tout via `"*"`.

---

## Architecture des pages — état réel

### Pages publiques ✅ (existent)
```
/                  Landing — map hero + cards biens flottantes + rôles + CTA
/estimation        Estimation IA gratuite
/login             Connexion
/register          Inscription + sélection rôle
/bienvenue         Onboarding post-inscription
/onboarding        Onboarding alternatif
/rejoindre/[token] Lien magique zero-friction
/tenant/*          Portail locataire public
/portail/[token]   Portail proprio public
/opener            Espace ouvreur
/legal/*           CGU, confidentialité, cookies, disclaimer-IA
/contact           Contact
/sitemap.ts        Sitemap
```

### Pages app ✅ (existent dans /app/(dashboard)/)
```
/app               Dashboard (routé selon useRole())
/app/sphere        Sphère IA — hub central ✅
/app/carte         Map Mapbox plein écran ✅ (1ère page post-connexion)
/app/biens         Liste biens + onglets Tous / Favoris / Archivés ✅
/app/biens/[id]    Fiche bien ✅
/app/biens/[id]/documents, /finances, /locataire, /interventions, /historique ✅
/app/finances      Finances ✅
/app/comptabilite  Comptabilité + OCR ✅
/app/messagerie    Messagerie ✅
/app/agenda        Agenda ✅
/app/whatsapp      WhatsApp ✅
/app/crm           CRM ✅
/app/artisans      Marketplace artisans ✅
/app/artisans/devis, /chantiers, /paiements, /historique ✅
/app/ouvreurs      Marketplace ouvreurs ✅
/app/ouvreurs/missions, /revenus, /historique ✅
/app/listings      Annonces ✅
/app/vente         Vente ✅
/app/hunters       Hunters ✅
/app/portail       Portail proprio (dashboard) ✅
/app/settings      Paramètres ✅
/app/settings/notifs, /paiement, /preferences, /zone ✅
/app/profile       Profil ✅ (URL: /profile — legacy, à migrer vers /profil un jour)
/app/abonnement    Abonnement ✅
/app/admin         Admin ✅
/app/admin/integration ✅
/app/admin/users, /transactions ✅
/app/contracts     Contrats ✅
/app/documents     Documents ✅
/app/interventions Interventions ✅
```

### Pages archivées (redirections actives) ✓
```
/app/overview      → redirect → /app
/app/companies     → redirect → /app/agence
/app/favorites     → redirect → /app/biens?tab=favoris
/app/rfqs          → redirect → /app/artisans/devis
/app/publications  → redirect → /app/listings
```

### Pages encore à traiter
```
/app/insurance     → fusionner dans /app/settings ou /app/abonnement
/app/transactions  → fusionner dans /app/finances
```

---

## Parcours utilisateur — chaîne complète

```
/ (landing map + cards biens flottantes)
  → "Se connecter" → /login → /app/carte → /app/sphere → /app
  → "Commencer gratuitement" → /register → /bienvenue → /app/carte → /app/sphere → /app
  → "Estimer mon bien" → /estimation → capture email → /register?source=estimation
  → Lien magique reçu → /rejoindre/[token] → /bienvenue (pré-rempli) → /app/carte

Après connexion — TOUJOURS dans cet ordre :
/app/carte  (map immersive plein écran, bouton "Voir les biens disponibles →")
  → /app/sphere  (Sphère IA, briefing du jour, actions à valider)
    → /app  (dashboard selon le rôle, avec DTopNav ← Sphère IA)
      → /app/biens, /app/finances, /app/messagerie... (pages spécifiques)
```

**Implémenté dans `middleware.ts` :** connexion réussie → `/app/carte` ✓

---

## La Sphère IA — architecture actuelle

### Composants existants (sphere/)
```
AlthySphereCore.tsx   Rendu SVG animé de la sphère
SphereInput.tsx       Barre de saisie avec micro et envoi
SphereStream.tsx      Affichage streaming SSE
ActionCard.tsx        Card d'action à valider (urgent / normale / info)
NotationModal.tsx     Modal notation après transaction
SuggestionChips.tsx   Chips de suggestions rapides
SphereWidget.tsx      Widget flottant (bas-droite toutes pages /app/*)
```

### Endpoints backend actifs
```
GET  /api/v1/sphere/contexte         Contexte utilisateur (Redis 5min)
GET  /api/v1/sphere/briefing         Briefing streaming SSE
POST /api/v1/sphere/executer         Exécuter action validée
POST /api/v1/sphere/parse-location   Parser ville pour carte (Claude Sonnet)
POST /api/v1/sphere/ocr-facture      OCR facture photo/PDF
POST /api/v1/ai/chat                 Chat streaming SSE (utilisé par SphereWidget)
```

### SphereWidget — règles d'affichage ✓
Visible sur toutes les pages `/app/*` SAUF :
- `/app/sphere` (on est déjà dans la Sphère)
- `/app/carte` (plein écran, pas de widget)

Implémenté via `if (pathname === '/app/sphere' || pathname === '/app/carte') return null`

### États de la Sphère
```typescript
type SphereState = "idle" | "listening" | "thinking" | "speaking"
// Géré dans sphereStore.ts via Zustand
```

---

## La carte Mapbox — configuration exacte

### Token
```
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...
```
**Jamais en dur dans le code.** Toujours `process.env.NEXT_PUBLIC_MAPBOX_TOKEN`.

### Config map (identique landing et /app/carte)
```javascript
style:  'mapbox://styles/mapbox/light-v11'
center: [7.5, 46.8]
zoom:   7.2
minZoom: 5.5, maxZoom: 16
```

### GeoJSON cantons
```
frontend/public/cantons-suisse.json
```

### Zones colorées (cantons actifs)
```javascript
ACTIVE_CANTONS = ["Genève", "Vaud", "Valais", "Fribourg", "Neuchâtel", "Jura"]
fill-color:   "#E8602C"  // hex obligatoire — Mapbox GL ne supporte pas CSS vars
fill-opacity: 0.10
line-color:   "#E8602C"
line-width:   2
line-opacity: 0.5
```

### Villes actives (punaises oranges + animation ping)
```javascript
{ id: "geneve",    name: "Genève",    lng: 6.143, lat: 46.204, biens: 47 }
{ id: "lausanne",  name: "Lausanne",  lng: 6.632, lat: 46.519, biens: 83 }
{ id: "fribourg",  name: "Fribourg",  lng: 7.161, lat: 46.806, biens: 31 }
{ id: "neuchatel", name: "Neuchâtel", lng: 6.931, lat: 46.992, biens: 24 }
{ id: "sion",      name: "Sion",      lng: 7.359, lat: 46.233, biens: 19 }
```

### Villes inactives (punaises grises, opacity 0.4, label "An 2")
```javascript
{ id: "berne",  name: "Berne",  lng: 7.447, lat: 46.948 }
{ id: "zurich", name: "Zürich", lng: 8.541, lat: 47.376 }
{ id: "bale",   name: "Bâle",   lng: 7.589, lat: 47.560 }
```

### Landing vs /app/carte — différences
| | Landing `/` | Post-connexion `/app/carte` |
|---|---|---|
| Search bar | Centre bas, sous la map | Topbar centrée |
| Cards biens | Flottantes sur la map, reliées aux punaises par lignes SVG pointillées | Non (bouton "Voir les biens") |
| Filtres pills | Sous la map | Non |
| Stats | Pill bas centrée | Card stats haut-gauche (totalBiens + nbVilles) |
| CTA | Grille biens en dessous | Bouton dark "Voir les biens disponibles →" bas centré |
| Sidebar | Non (landing publique) | Oui (DashboardShell) |
| SphereWidget | Non | Non (exception) |

---

## Modèle économique — source de vérité : plans.config.ts

```
CHF 29/mois    proprio_solo, agence (par agent)
CHF 23/mois    proprio_solo ou agence si annuel
CHF 9/mois     portail_proprio, acheteur_premium
CHF 19/mois    opener Pro, artisan Pro, expert Pro
Gratuit        locataire, opener base, artisan base, expert base
Referral fee   hunter (variable selon transaction)
4%             sur TOUS les flux financiers via Stripe Connect
CHF 90         frais dossier locataire (UNIQUEMENT si retenu)
15%            commission missions ouvreurs
10%            commission artisans sur devis comparés
10%            commission caution (Firstcaution/SwissCaution)
CHF 40         par police RC (Helvetia/AXA)
```

**Règle absolue : zéro marge cachée sur les portails.**
Le client paie le tarif du portail directement. Althy facture ses 4% séparément.

**Clause fondateur (dans les statuts) :**
L'agence du fondateur (130 biens annuels + 30 saisonniers + 20/semaine) → accès permanent gratuit.

### Stripe Connect — 4% Althy ✓
- `POST /api/v1/paiements/creer-intent` — crée un PaymentIntent avec `application_fee_amount = montant * 4%`
- `POST /api/v1/webhooks/loyer/{paiement_id}` — idem pour paiement depuis une fiche paiement
- Webhook `payment_intent.succeeded` — traite uniquement `metadata.type == 'loyer'`, met à jour statut, notifie le proprio, log audit
- Webhook `invoice.payment_failed` — crée `ai_action` urgente `relancer_loyer` + SMS Twilio au proprio

---

## Système de notation

Tables DB : `notations` + `notation_stats` (vue matérialisée).
Badge "Vérifié Althy" : note ≥ 4.5 + ≥ 10 avis vérifiés.
Composant : `RatingWidget.tsx` + `NotationModal.tsx`.
Notation créée automatiquement après chaque transaction terminée.

Acteurs notés : artisan, ouvreur, agence, expert, proprio, hunter, locataire.

---

## Règles de développement — ABSOLUES

### Langue
Tout en français. URLs, labels, boutons, messages d'erreur. Zéro anglais visible.

**Exceptions legacy encore présentes (à corriger progressivement) :**
- `/app/profile` (devrait être `/app/profil`)
- `/app/listings` (devrait être `/app/annonces`)
- `insurance`, `transactions` dans certaines routes

### Navigation
- Logo ALTHY → `/` sur toutes les pages
- `← Retour à althy.ch` sur `/login`, `/register`, `/forgot-password`, `/reset-password`
- Header minimal (logo + "Se connecter") sur `/tenant/*`, `/portail/[token]`, `/opener`
- Fil d'ariane sur `/app/biens/[id]/*` — composant `FilAriane.tsx` existe ✅
- SphereWidget flottant sur `/app/*` SAUF `/app/sphere` et `/app/carte` ✅
- `DTopNav` en haut de chaque dashboard : pills "← Sphère IA" et "Carte" ✅
- Bouton "Tableau de bord →" sur `/app/sphere` ✅

### Code
- Composants `Althy*` uniquement — aucun `Cathy*`
- Plans depuis `plans.config.ts` — source unique ✅ (existe)
- Une seule URL par page, toujours en français
- Une seule entrée "Althy IA" dans sidebar → `/app/sphere` ✅
- Sidebar settings : entrée unique `/app/settings`, sous-pages dans la page elle-même ✅
- `var(--althy-*)` partout — jamais de couleurs en dur (exception : couches Mapbox GL)
- Token Mapbox : `process.env.NEXT_PUBLIC_MAPBOX_TOKEN` — jamais en dur ✅
- RLS activé sur toutes les tables Supabase
- Maximum 2 clics pour toute action courante
- Chaque action irréversible → écran de confirmation

---

## Structure des dashboards — DashBoardShared.tsx

Composants partagés exportés :
```typescript
DC            // Design constants — tous via CSS vars (var(--althy-*))
DCard         // Card wrapper standard
DKpi          // KPI metric card (icon: React.ElementType, iconColor, iconBg, trend)
DRoleHeader   // Header de page avec nom + rôle + lien ← Sphère IA
DSectionTitle // Titre de section avec barre orange
DEmptyState   // État vide illustré avec CTA optionnel
DTopNav       // Navigation haut de page : "← Sphère IA" + "Carte"
```

**Règle :** tous les nouveaux dashboards doivent utiliser ces composants.
**Ne pas** recréer des cards custom — utiliser `DCard` et `DKpi`.
**Chaque dashboard** commence par `<DTopNav />` puis `<DRoleHeader />`.

---

## Migrations DB — état actuel

25 migrations actives (0001 → 0025).
- 0006 : tables Althy core
- 0022 : communication, onboarding, notation
- 0023 : briefing cache + context hash
- 0024 : type et affectation sur dépenses
- 0025 : index partiels messagerie/whatsapp non-lus (performances < 10ms)

**Prochaine migration à créer si besoin :**
- Table `ai_user_preferences` (apprentissage Sphère) — vérifier si existe déjà en 0003/0006

---

## Endpoints backend — référence rapide

### Sphere
```
GET  /api/v1/sphere/contexte
GET  /api/v1/sphere/briefing          (SSE streaming)
POST /api/v1/sphere/executer
POST /api/v1/sphere/parse-location    (Claude Sonnet, fallback CITY_FALLBACK local)
POST /api/v1/sphere/ocr-facture
```

### Messagerie & WhatsApp (badges sidebar)
```
GET /api/v1/messagerie/non-lus        → { count: int }  (email_cache non traités)
GET /api/v1/whatsapp/non-lus          → { count: int }  (somme unread_count)
```
Appelés toutes les 60s par DashboardSidebar avec `.catch(() => { count: 0 })`.

### Paiements
```
POST /api/v1/paiements/creer-intent   → PaymentIntent avec 4% application_fee
POST /api/v1/webhooks/loyer/{id}      → idem depuis fiche paiement existante
POST /api/v1/webhooks/webhook         → Stripe webhook (payment_intent.succeeded,
                                        invoice.payment_failed, subscriptions...)
```

---

## Ce qu'Althy n'est PAS

- Pas un concurrent des agences — il les aide à être meilleures
- Pas responsable des actions — l'utilisateur valide et assume
- Pas opaque — 4% visible partout, rien d'autre caché
- Pas complexe — si > 2 clics, c'est à simplifier
- Pas générique — chaque page pensée pour le rôle précis de l'utilisateur
- Pas en anglais — tout en français, toujours
