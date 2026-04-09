# Althy — Instructions pour Claude Code

## Stack

- **Frontend** : Next.js 14 (App Router) · TypeScript · TailwindCSS · React Query (TanStack) · Vercel
- **Backend** : FastAPI · SQLAlchemy async · Alembic · Pydantic v2 · Railway
- **DB** : PostgreSQL via Supabase (RLS activé)
- **Auth** : Supabase Auth (JWT bearer token)
- **IA** : Claude API (Anthropic) — SSE streaming via `/api/v1/ai/chat`
- **Paiements** : Stripe Connect

## Architecture

```
immohub/
  frontend/          # Next.js 14, déployé sur Vercel
    src/
      app/           # App Router pages
        (landing)/   # Pages publiques (/, /estimation, /register, /login)
        app/         # Dashboard authentifié
          (dashboard)/
      components/    # Composants réutilisables
      lib/           # Hooks, store (Zustand), api.ts, auth.ts
  backend/           # FastAPI, déployé sur Railway
    app/
      routers/       # Un fichier par domaine
      models/        # SQLAlchemy ORM (héritent de BaseModel)
      services/      # Logique métier, ai_service.py
      core/          # Config, database, security
    alembic/         # Migrations (0001 → 0012+)
```

## Conventions

### Backend
- Tous les modèles héritent de `BaseModel` (id UUID, created_at, updated_at, is_active)
- Les nouvelles migrations sont numérotées `00XX_description.py`
- Les endpoints sont préfixés `/api/v1/`
- Auth : `get_current_user` via Supabase JWT — injecter comme `Annotated[User, Depends(get_current_user)]`
- Pydantic schemas : `model_config = {"from_attributes": True}` pour les read schemas
- **Ne jamais créer de table en migration si elle existe déjà** — vérifier `0001_initial_schema.py`

### Frontend
- Design tokens CSS : `var(--althy-orange)`, `var(--althy-bg)`, `var(--althy-surface)`, etc. (définis dans `globals.css`)
- Palette principale : terracotta `#E8602C` (`--althy-orange`)
- Styles inline (objet `S` constant en haut de chaque page) — pas de classes Tailwind dans le dashboard
- API calls : `import { api } from "@/lib/api"` — base URL = `NEXT_PUBLIC_API_URL` (inclut `/api/v1`)
- Auth store : `useAuthStore()` (Zustand) + `useAuth()` pour signOut
- Rôles : `useRole()` → `can(section: string)`

## Domaine métier

Althy est un SaaS de gestion immobilière suisse (CHF) :
- **Propriétaires** : gèrent leurs biens, locataires, loyers, interventions
- **Ouvreurs** : visites pour compte de propriétaires (marketplace)
- **Artisans** : travaux sur mandat (marketplace)
- **Hunters** : soumettent des leads off-market (CHF 50–500 referral)
- **Modèle tarifaire** : CHF 29/mois, 4% Stripe Connect sur loyers, CHF 90 dossier locataire

## Pages dashboard existantes

| Route | Fichier | Description |
|-------|---------|-------------|
| `/app` | `dashboard/page.tsx` | Tableau de bord |
| `/app/biens` | `biens/page.tsx` | Liste des biens |
| `/app/biens/[id]` | `properties/[id]/page.tsx` | Fiche bien + onglet Potentiel IA |
| `/app/finances` | `finances/page.tsx` | Revenus/dépenses |
| `/app/interventions` | `interventions/page.tsx` | Travaux |
| `/app/crm` | `crm/page.tsx` | Contacts |
| `/app/listings` | `listings/page.tsx` | Annonces portails |
| `/app/comptabilite` | `comptabilite/page.tsx` | État locatif |
| `/app/hunters` | `hunters/page.tsx` | Leads off-market |
| `/app/abonnement` | `abonnement/page.tsx` | Plans tarifaires |
| `/app/advisor` | `advisor/page.tsx` | Althy IA chat |
| `/estimation` | `estimation/page.tsx` | Estimation publique (lead magnet) |

## Routes backend existantes (prefix `/api/v1`)

`/auth`, `/properties`, `/contracts`, `/transactions`, `/openers`, `/missions`, `/companies`, `/dashboard`, `/ai`, `/rfqs`, `/admin`, `/tenants`, `/ratings`, `/favorites`, `/agency`, `/insurance`, `/crm`, `/documents`, `/biens`, `/locataires`, `/docs-althy`, `/paiements`, `/interventions-althy`, `/ouvreurs`, `/profiles-artisans`, `/scoring`, `/notifications`, `/matching`, `/geocode`, `/listings`, `/hunters`

## Points d'attention

- La table `listings` vient de la migration `0001` (colonnes : `property_id`, `title`, `description_ai`, `price`, `portals` JSONB, `views`, `leads_count`) — **pas** de `owner_id` ni `monthly_rent`
- Le router `/listings` stocke `listing_type`, `monthly_rent`, `sale_price`, `on_*` dans le champ `portals` JSONB
- La table `hunters` (migration 0012) utilise `hunter_id` (pas `submitter_id`)
- `RevenueChart` attend `data: MonthlyRevenue[]` (pas `year`)
- Les migrations doivent être idempotentes (`CREATE TABLE IF NOT EXISTS`, `DO $$ BEGIN IF NOT EXISTS`)
