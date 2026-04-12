# Althy — Checklist de déploiement pré-lancement

> Dernière mise à jour : 2026-04-12
> Stack : Next.js 14 (Vercel) + FastAPI (Railway) + Supabase + Redis (Railway)

---

## 1. Variables d'environnement

### Frontend — Vercel

| Variable | Exemple | Obligatoire |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xyz.supabase.co` | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGci...` | ✅ |
| `NEXT_PUBLIC_API_URL` | `https://api.althy.ch/api/v1` | ✅ |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | `pk.eyJ1...` | ✅ |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | ✅ |
| `NEXT_PUBLIC_POSTHOG_KEY` | `phc_...` | ✅ |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://eu.posthog.com` | ✅ |
| `NEXT_PUBLIC_SENTRY_DSN` | `https://...@sentry.io/...` | Recommandé |

### Backend — Railway

| Variable | Exemple | Obligatoire |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://...` | ✅ |
| `SUPABASE_URL` | `https://xyz.supabase.co` | ✅ |
| `SUPABASE_SERVICE_KEY` | `eyJhbGci...` (service_role) | ✅ |
| `SUPABASE_ANON_KEY` | `eyJhbGci...` (anon) | ✅ |
| `SUPABASE_JWT_SECRET` | JWT secret Supabase | ✅ |
| `SECRET_KEY` | 64 chars random | ✅ |
| `APP_ENV` | `production` | ✅ |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | ✅ |
| `STRIPE_SECRET_KEY` | `sk_live_...` | ✅ |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | ✅ |
| `STRIPE_CONNECT_CLIENT_ID` | `ca_...` | ✅ |
| `REDIS_URL` | `redis://...` | ✅ |
| `CELERY_BROKER_URL` | `redis://...` | ✅ |
| `RESEND_API_KEY` | `re_...` | ✅ |
| `EMAILS_FROM` | `noreply@althy.ch` | ✅ |
| `FRONTEND_URL` | `https://althy.ch` | ✅ |
| `TWILIO_ACCOUNT_SID` | `AC...` | Recommandé |
| `TWILIO_AUTH_TOKEN` | `...` | Recommandé |
| `TWILIO_FROM_NUMBER` | `+41...` | Recommandé |
| `WHATSAPP_API_TOKEN` | `...` | Phase 2 |
| `WHATSAPP_PHONE_ID` | `...` | Phase 2 |
| `META_APP_SECRET` | `...` | Phase 2 |
| `GOOGLE_CLIENT_ID` | `...` | Phase 2 |
| `GOOGLE_CLIENT_SECRET` | `...` | Phase 2 |
| `MICROSOFT_CLIENT_ID` | `...` | Phase 2 |
| `MICROSOFT_CLIENT_SECRET` | `...` | Phase 2 |
| `SENTRY_DSN` | `https://...@sentry.io/...` | Recommandé |

---

## 2. Sécurité — checklist

### Backend
- [ ] `APP_ENV=production` défini sur Railway
- [ ] `ALLOWED_ORIGINS` ne contient pas `*` (✅ configuré dans config.py)
- [ ] CORS limité à `althy.ch`, `www.althy.ch`, `*.vercel.app` (✅)
- [ ] Rate limiting actif sur tous les POST publics (✅ via slowapi/Redis)
  - `/interesse` : 30/minute
  - `/postuler` : 10/minute
  - `/candidature` : 5/minute
  - `/publier` : 20/minute
  - `/contact` : 5/minute
- [ ] `lat`/`lng` arrondis à 3 décimales dans la marketplace publique (✅)
- [ ] Photos uploadées avec noms UUID randomisés (✅)
- [ ] Sentry configuré avec `SENTRY_DSN` (✅ code en place)
- [ ] Security headers actifs : X-Content-Type-Options, X-Frame-Options, Referrer-Policy (✅)
- [ ] RLS activé sur toutes les tables Supabase
- [ ] `docs_url` et `redoc_url` désactivés en production (actuellement `/api/docs` — restreindre si besoin)

### Frontend
- [ ] Aucun secret dans les variables `NEXT_PUBLIC_*`
- [ ] Token Mapbox restreint aux domaines : `althy.ch`, `*.althy.ch`, `localhost` (Mapbox dashboard)
- [ ] Sentry configuré avec `NEXT_PUBLIC_SENTRY_DSN` (✅ code en place)
- [ ] PostHog activé avec `NEXT_PUBLIC_POSTHOG_KEY` (✅)
- [ ] `next.config.js` : vérifier Content-Security-Policy headers

### Supabase
- [ ] Email templates personnalisés (logo Althy, couleur orange)
- [ ] SMTP custom configuré pour les emails Supabase Auth (ou déléguer à Resend)
- [ ] Storage buckets : RLS configuré sur `candidatures` et `listings-photos`
- [ ] Backup automatique activé (Supabase Pro)

---

## 3. DNS & Domaine

- [ ] `althy.ch` → Vercel (A record ou CNAME)
- [ ] `www.althy.ch` → Vercel
- [ ] `api.althy.ch` → Railway (CNAME vers le service Railway)
- [ ] SSL/TLS automatique via Vercel et Railway ✅
- [ ] SPF/DKIM configuré pour `noreply@althy.ch` (Resend fournit les entrées DNS)
- [ ] `support@althy.ch`, `partnerships@althy.ch`, `privacy@althy.ch` → boîte mail active

---

## 4. Stripe

- [ ] Compte Stripe en mode **Live** (pas Test)
- [ ] Stripe Connect activé (OAuth pour les agences/proprios)
- [ ] Webhook endpoint configuré : `https://api.althy.ch/api/v1/webhooks/webhook`
  - Events à écouter : `payment_intent.succeeded`, `invoice.payment_failed`, `customer.subscription.*`
- [ ] Prix créés dans Stripe Dashboard et IDs reportés dans les env vars :
  - `STRIPE_PRICE_PROPRIO_MONTHLY` (CHF 29)
  - `STRIPE_PRICE_PRO_MONTHLY` (CHF 19)
  - `STRIPE_PRICE_AGENCY_MONTHLY` (CHF 29/agent)
  - `STRIPE_PRICE_PORTAL_MONTHLY` (CHF 9)
- [ ] 4% `application_fee_amount` testé en mode Live
- [ ] Stripe Tax configuré pour la TVA suisse (7.7%)

---

## 5. Email transactionnel (Resend)

- [ ] Domaine `althy.ch` vérifié dans Resend
- [ ] SPF / DKIM / DMARC configurés
- [ ] Templates à vérifier / implémenter :
  - [ ] **Bienvenue** — déclenché à l'inscription (`/api/v1/auth/register`)
  - [ ] **Intérêt reçu** — notifie le proprio quand swipe droit (`/marketplace/interesse`)
  - [ ] **Candidature reçue** — notifie le proprio + email de confirmation au locataire
  - [ ] **Confirmation de publication** — envoyé au proprio après `POST /marketplace/publier`
  - [ ] **Lien magique** — déjà implémenté (`/api/v1/onboarding/inviter`)
  - [ ] **Relance loyer en retard** — déclenché par webhook Stripe `invoice.payment_failed`
  - [ ] **Contact** — notifie `support@althy.ch` depuis le formulaire `/contact` (✅)

---

## 6. Analytics (PostHog)

Events trackés (✅ implémentés) :
- `page_viewed` — toutes les pages (PostHogProvider)
- `listing_viewed` — fiche bien vue (id, prix, ville)
- `swipe_right` — intérêt exprimé en mode swipe
- `swipe_left` — bien passé en mode swipe
- `candidature_submitted` — dossier locataire envoyé
- `bien_publie` — bien publié par un proprio
- `user_signed_in` — connexion
- `ai_used` — usage Sphère IA
- `payment_received` — loyer reçu

Actions à faire dans PostHog dashboard :
- [ ] Créer le projet "Althy Production"
- [ ] Configurer les funnels : `listing_viewed → swipe_right → candidature_submitted`
- [ ] Configurer les funnels : Inscription → Publication → Premier loyer reçu
- [ ] Activer Session Replay (RGPD : activer le masquage des données sensibles)
- [ ] Créer les dashboards : Marketplace, Propriétaires, Revenue

---

## 7. Monitoring (Sentry)

- [ ] Projet "althy-frontend" créé sur Sentry
- [ ] Projet "althy-backend" créé sur Sentry
- [ ] DSN configuré dans les env vars (frontend + backend)
- [ ] Alertes configurées : erreurs 5xx, taux d'erreur > 1%
- [ ] Release tracking activé (lié aux déploiements Vercel/Railway)

---

## 8. Performance

- [ ] Lighthouse score ≥ 85 sur `/`, `/biens`, `/biens/geneve`
- [ ] Images : `next/image` avec `sizes` correct sur toutes les fiches biens (✅)
- [ ] Cache-Control headers sur les GET marketplace (✅ : `max-age=60, stale-while-revalidate=300`)
- [ ] ISR activé sur `/biens/[ville]` (✅ : `revalidate: 60`)
- [ ] Redis actif pour le cache briefing Sphère IA et rate limiting

---

## 9. SEO

- [ ] `sitemap.xml` généré et accessible : `https://althy.ch/sitemap.xml`
- [ ] `robots.txt` configuré (✅ : autorise `/biens/*`, bloque `/app/`)
- [ ] JSON-LD `RealEstateListing` sur toutes les fiches biens (✅)
- [ ] OG tags sur toutes les pages publiques (✅)
- [ ] Pages statiques ville générées : geneve, lausanne, vaud, fribourg, valais, neuchatel (✅)
- [ ] `canonical` URL sur toutes les pages (✅ via generateMetadata)
- [ ] Google Search Console : soumettre le sitemap

---

## 10. Tests pré-lancement (Golden path)

- [ ] Inscription → choix rôle → onboarding → carte → sphere → dashboard
- [ ] Publier un bien (Option A et B) → photos → description IA → publication
- [ ] Mode swipe : voir biens → swipe right → intérêt enregistré
- [ ] Fiche bien : galerie photos → lightbox → bouton "Je suis intéressé"
- [ ] Candidature : connexion requise → formulaire → scoring IA → email proprio
- [ ] Paiement loyer : stripe → 4% prélevé → email confirmation
- [ ] Sphère IA : question → réponse streaming → action à valider
- [ ] Dashboard : KPIs corrects, biens affichés, notifications
- [ ] Mobile : responsive OK sur iPhone 14 et Samsung Galaxy S21

---

## 11. Lancement

### Jour J (Phase 1 — Agence fondateur)
- [ ] Importer les 130 biens de l'agence fondateur via script
- [ ] Vérifier que les photos sont bien uploadées dans Supabase Storage
- [ ] Vérifier que la map Mapbox affiche les biens correctement
- [ ] Activer le mode production sur Railway (`APP_ENV=production`)
- [ ] Déclencher un déploiement Vercel en production
- [ ] Vérifier `https://althy.ch` accessible et SSL OK
- [ ] Tester l'email de bienvenue avec un compte test

### Post-lancement
- [ ] Monitorer Sentry pendant les 48 premières heures
- [ ] Vérifier les métriques PostHog (page views, conversions)
- [ ] Vérifier le webhook Stripe (logs Railway)
- [ ] Créer le post LinkedIn annonçant le lancement

---

*Généré automatiquement par Claude Code — à maintenir à jour à chaque sprint*
