# Althy — Instructions pour Claude Code

## Contexte projet
SaaS immobilier suisse. Sphère IA centrale. Utilisateur parle, Althy agit, utilisateur valide.
Dashboard optionnel ultra-simple. Pensé pour le grand-père qui comprend rien au monde moderne.

## Design system

| Token | Valeur |
|-------|--------|
| Couleur primaire (terre cuite) | `#B55A30` |
| Couleur light | `#FAE4D6` |
| Fond | `#FAFAF8` (stone) |
| Surface | `#FFFFFF` |
| Bordure | `#E8E4DC` |
| Texte | `#3D3830` |
| Muted | `#7A7469` |
| Succès (sage) | `#5A7D54` · light `#EBF2EA` |
| Border-radius cards | `12px` |
| Border-radius éléments | `8px` |

**Fonts** : titres → Fraunces (300, 400 italic) · corps → DM Sans (400, 500)

## Stack technique

- **Frontend** : Next.js 14 App Router · TypeScript · Tailwind · **mobile-first**
- **Mobile** : React Native / Expo
- **Backend** : FastAPI (Python) · Celery · Redis
- **DB** : Supabase (PostgreSQL + Auth + Storage + Realtime)
- **IA** : Anthropic Claude Sonnet — streaming SSE
- **Paiements** : Stripe + Stripe Connect
- **Emails** : Resend · **SMS** : Twilio · **Push** : Firebase
- **Maps** : Leaflet + OpenStreetMap
- **CDN** : Cloudflare Pro

## Règles absolues

1. Althy ne prend **JAMAIS** de décision — il suggère, l'humain valide
2. Althy n'est **JAMAIS** responsable — disclaimer sur tous les docs générés
3. Frais dossier CHF 90 **UNIQUEMENT** si locataire retenu — jamais avant
4. 4 % loyers affiché comme "loyer net reçu" — jamais comme "commission"
5. Rate limiting IA : 30 interactions/jour standard · 100/jour Pro
6. Row Level Security Supabase sur **TOUTES** les tables
7. TypeScript strict — **pas de `any`**
8. Toujours **mobile-first**

## Les 9 profils utilisateurs

`proprio_solo` · `agence` · `portail_proprio` (CHF 9) · `opener` · `artisan` · `expert` · `hunter` · `locataire` · `acheteur_premium`

## Les 18 tables DB

`users` · `profiles` · `properties` · `leases` · `tenants` · `payments` · `documents` · `expenses` · `interventions` · `quotes` · `missions` · `listings` · `offers` · `partners` · `hunters` · `subscriptions` · `ai_sessions` · `messages`

## Architecture

```
immohub/
  frontend/          # Next.js 14, déployé sur Vercel
    src/
      app/
        (landing)/   # Pages publiques (/, /estimation, /register, /login)
        app/         # Dashboard authentifié
          (dashboard)/
      components/    # Composants réutilisables
      lib/           # Hooks, store Zustand, api.ts, auth.ts
  backend/           # FastAPI, déployé sur Railway
    app/
      routers/       # Un fichier par domaine
      models/        # SQLAlchemy ORM (héritent de BaseModel)
      services/      # Logique métier, ai_service.py
      core/          # Config, database, security
    alembic/         # Migrations (0001 → 0012+)
```

## Conventions backend

- Tous les modèles héritent de `BaseModel` (id UUID, created_at, updated_at, is_active)
- Migrations numérotées `00XX_description.py` · **idempotentes** (`IF NOT EXISTS`)
- Endpoints préfixés `/api/v1/`
- Auth : `get_current_user` via Supabase JWT · `Annotated[User, Depends(get_current_user)]`
- Pydantic schemas : `model_config = {"from_attributes": True}` pour les read schemas
- **Ne jamais recréer une table existante** — vérifier `0001_initial_schema.py` avant

## Conventions frontend

- CSS tokens : `var(--althy-orange)` = `#B55A30`, `var(--althy-bg)`, `var(--althy-surface)`, etc.
- Styles inline (objet `S` en haut de chaque page) dans le dashboard
- `import { api } from "@/lib/api"` — base URL = `NEXT_PUBLIC_API_URL` (inclut `/api/v1`)
- Auth store : `useAuthStore()` (Zustand) + `useAuth()` pour signOut
- Rôles : `useRole()` → `can(section: string)`
- `RevenueChart` attend `data: MonthlyRevenue[]` (pas `year`)

## Pages dashboard existantes

| Route | Description |
|-------|-------------|
| `/app` | Tableau de bord |
| `/app/biens` | Liste des biens |
| `/app/biens/[id]` | Fiche bien + onglet Potentiel IA |
| `/app/finances` | Revenus/dépenses |
| `/app/interventions` | Travaux |
| `/app/crm` | Contacts |
| `/app/listings` | Annonces portails |
| `/app/comptabilite` | État locatif |
| `/app/hunters` | Leads off-market |
| `/app/abonnement` | Plans tarifaires |
| `/app/advisor` | Althy IA chat |
| `/estimation` | Estimation publique (lead magnet) |

## Routes backend existantes (`/api/v1`)

`/auth` · `/properties` · `/contracts` · `/transactions` · `/openers` · `/missions` · `/companies` · `/dashboard` · `/ai` · `/rfqs` · `/admin` · `/tenants` · `/ratings` · `/favorites` · `/agency` · `/insurance` · `/crm` · `/documents` · `/biens` · `/locataires` · `/docs-althy` · `/paiements` · `/interventions-althy` · `/ouvreurs` · `/profiles-artisans` · `/scoring` · `/notifications` · `/matching` · `/geocode` · `/listings` · `/hunters`

## Points d'attention critiques

- La table `listings` (migration 0001) a `property_id`, `portals` JSONB — **pas** `owner_id` ni `monthly_rent`
- Le router `/listings` stocke `listing_type`, `monthly_rent`, `sale_price`, `on_*` dans `portals` JSONB
- La table `hunters` (migration 0012) utilise `hunter_id` (pas `submitter_id`), pas de colonne `is_active`
- Les RLS policies sur `listings` doivent passer par `properties.owner_id` (jointure)
