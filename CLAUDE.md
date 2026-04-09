# Althy — Instructions pour Claude Code

> Business plan complet : `docs/althy_business_plan_definitif.pdf`

## Vision centrale
"Le grand-père qui veut gérer ses biens seul et qui comprend rien au monde moderne arrive sur Althy.
Il voit une sphère. Il parle. Althy comprend, agit, et lui demande de valider. C'est tout."

Le tableau de bord existe — mais il est **optionnel**. La sphère IA est le point d'entrée principal.

## Règles absolues (jamais déroger)

1. Althy ne prend **JAMAIS** de décision — il suggère, l'humain valide
2. Althy n'est **JAMAIS** responsable — disclaimer sur tous les docs générés
3. Frais dossier CHF 90 **UNIQUEMENT** si locataire retenu — jamais avant (carte enregistrée à l'inscription)
4. 4 % loyers affiché comme **"loyer net reçu"** — jamais comme "commission"
5. Rate limiting IA : **30 interactions/jour standard · 100/jour Pro**
6. Row Level Security Supabase sur **TOUTES** les tables — aucune exception
7. TypeScript strict — **pas de `any`** — **pas de `as Record<string, unknown>`** direct
8. Toujours **mobile-first**
9. **Jamais de publicité dans l'app** — incompatible avec le positionnement premium
10. Commission énergie/internet **seulement si accord de distribution formel signé**

## Design system

| Token | Valeur |
|-------|--------|
| Primaire (terre cuite) | `#B55A30` |
| Primaire light | `#FAE4D6` |
| Fond | `#FAFAF8` (stone) |
| Surface | `#FFFFFF` |
| Bordure | `#E8E4DC` |
| Texte | `#3D3830` |
| Muted | `#7A7469` |
| Succès (sage) | `#5A7D54` · light `#EBF2EA` |
| Border-radius cards | `12px` · éléments `8px` |

**Fonts** : titres → **Fraunces** (300, 400 italic) · corps → **DM Sans** (400, 500)

## Stack technique

- **Frontend** : Next.js 14 App Router · TypeScript · Tailwind — déployé sur Vercel
- **Mobile** : React Native / Expo (iOS + Android)
- **Backend** : FastAPI (Python) · Celery · Redis — déployé sur Railway
- **DB** : Supabase (PostgreSQL + Auth + Storage + Realtime)
- **IA** : Anthropic Claude Sonnet — streaming SSE pour la sphère
- **Paiements** : Stripe (abonnements) + Stripe Connect (transactions entre users)
- **Emails** : Resend · **SMS** : Twilio · **Push** : Firebase Cloud Messaging
- **Maps** : Leaflet + OpenStreetMap + Nominatim (gratuit)
- **CDN** : Cloudflare Pro (DNS + WAF + anti-DDoS)
- **Monitoring** : Sentry + BetterStack

## Les 9 profils utilisateurs

| Profil | Prix | Phase |
|--------|------|-------|
| `proprio_solo` | CHF 29/mois | M1 |
| `agence` | CHF 29/agent/mois | M1 |
| `portail_proprio` | CHF 9/mois | M1 |
| `opener` | CHF 0 base / CHF 19 Pro | M1 |
| `artisan` | CHF 0 base / CHF 19 Pro | M1 |
| `expert` | CHF 0 / CHF 19 Pro | M3 |
| `hunter` | Referral fee | M6 |
| `locataire` | Gratuit | M1 |
| `acheteur_premium` | CHF 9/mois | An 2 |

## Les 22 tables DB (§8.2 du BP)

`users` · `profiles` · `properties` · `leases` · `tenants` · `payments` · `documents` · `expenses` · `interventions` · `quotes` · `missions` · `listings` · `offers` · `partners` · `hunters` · `subscriptions` · `ai_sessions` · `messages` · `user_settings` · `zones` · `consents` · `integrations`

Migrations Supabase : `supabase/migrations/` (004–007)
- `004_settings.sql` — user_settings + trigger auto-création + RLS
- `005_zones.sql` — zones + PostGIS + index GIST + `find_openers_in_zone()`
- `006_consents.sql` — consents (insert-only, immuable) + vue `consents_latest` + `record_consent()`
- `007_integrations.sql` — integrations + chiffrement pgcrypto + `upsert_integration()` + vue `integrations_safe`

## Sources de revenus (§3.4)

- **CHF 29/user/mois** abonnement
- **4 % des loyers** via Stripe Connect (affiché "loyer net reçu")
- **CHF 90** frais dossier locataire à la réussite uniquement
- **15 %** commission openers (10 % Pro)
- **10 %** commission artisans sur devis comparés
- **8–15 %** experts
- **10 %** commission caution (Firstcaution/SwissCaution)
- **CHF 40** commission assurance RC ménage
- **CHF 9/mois** portail proprio (facturé agence)
- **CHF 50–500** referral hunters off-market

## Architecture du projet

```
immohub/
  docs/                # Business plan PDF
  frontend/            # Next.js 14, Vercel
    src/
      app/
        (landing)/     # /, /estimation, /register, /login
        app/(dashboard)/
      components/
      lib/             # hooks, store Zustand, api.ts, auth.ts
  backend/             # FastAPI, Railway
    app/
      routers/         # Un fichier par domaine
      models/          # SQLAlchemy (héritent de BaseModel)
      services/        # ai_service.py et autres
      core/            # config, database, security
    alembic/           # Migrations 0001 → 0012+
```

## Conventions backend

- Tous les modèles héritent de `BaseModel` (id UUID, created_at, updated_at, is_active)
- Migrations numérotées `00XX_description.py` · **idempotentes** (`IF NOT EXISTS`)
- Endpoints préfixés `/api/v1/`
- Auth : `Annotated[User, Depends(get_current_user)]` via Supabase JWT
- Pydantic schemas : `model_config = {"from_attributes": True}`
- **Vérifier `0001_initial_schema.py` avant toute nouvelle migration** — ne jamais recréer une table existante
- RLS sur toutes les tables — les policies listings passent par `properties.owner_id` (jointure)

## Conventions frontend

- CSS tokens : `var(--althy-orange)` = `#B55A30`, `var(--althy-bg)`, `var(--althy-surface)`, etc.
- Styles inline (objet `S` en haut de chaque fichier) dans le dashboard
- `import { api } from "@/lib/api"` — base URL = `NEXT_PUBLIC_API_URL` (inclut `/api/v1`)
- Auth : `useAuthStore()` (Zustand) + `useAuth()` pour signOut
- Rôles : `useRole()` → `can(section: string)`
- `RevenueChart` attend `data: MonthlyRevenue[]` — **pas** `year`
- Cast dynamique : `(obj as unknown as Record<string, T>)` pour éviter l'erreur TS

## Pages existantes

| Route | Description |
|-------|-------------|
| `/app` | Tableau de bord |
| `/app/biens` | Liste biens |
| `/app/biens/[id]` | Fiche bien + onglet Potentiel IA (7 blocs) |
| `/app/finances` | Revenus/dépenses |
| `/app/interventions` | Travaux |
| `/app/crm` | Contacts |
| `/app/listings` | Annonces portails |
| `/app/comptabilite` | État locatif + exports |
| `/app/hunters` | Leads off-market |
| `/app/abonnement` | Plans tarifaires |
| `/app/advisor` | Althy IA chat (sphère) |
| `/estimation` | Estimation IA publique (lead magnet §6.2) |

## Routes backend existantes (`/api/v1`)

`/auth` · `/properties` · `/contracts` · `/transactions` · `/openers` · `/missions` · `/companies` · `/dashboard` · `/ai` (inclut `/ai/estimate`) · `/rfqs` · `/admin` · `/tenants` · `/ratings` · `/favorites` · `/agency` · `/insurance` · `/crm` · `/documents` · `/biens` · `/locataires` · `/docs-althy` · `/paiements` · `/interventions-althy` · `/ouvreurs` · `/profiles-artisans` · `/scoring` · `/notifications` · `/matching` · `/geocode` · `/listings` · `/hunters`

## Points d'attention critiques

- Table `listings` (migration 0001) : colonnes `property_id`, `portals` JSONB — **sans** `owner_id` ni `monthly_rent`
- Router `/listings` stocke `listing_type`, `monthly_rent`, `sale_price`, `on_*` dans JSONB `portals`
- Table `hunters` (migration 0012) : colonne `hunter_id` (pas `submitter_id`), **pas de `is_active`**
- RLS `listings` : passe par `properties.owner_id` via JOIN
- Frais dossier CHF 90 : carte CB enregistrée à l'inscription, prélevée **uniquement à la réussite**
- 4 % loyers : ne jamais appeler ça une "commission" — c'est affiché comme "loyer net reçu"
