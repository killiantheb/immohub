# PHASE 2 HIDDEN AUDIT — Sprint 9 Lot B

**Date** : 2026-05-14
**Branche** : `feat/sprint-9-lot-b-frontend-cleanup`
**Worktree** : `/c/Users/Killan/immohub-s9-lot-b-frontend-cleanup`
**Auditeur** : Lot B — Cleanup frontend Phase 2 visible

Doctrine de référence : CLAUDE.md §B.15 + docs/2-ROADMAP.md §2.4.5 + §2.4.6.

---

## 1. Flags Phase 2 actifs (`frontend/src/lib/flags.ts`)

| Flag | Env var | Surfaces gated | Statut |
|------|---------|----------------|--------|
| `ROLE_AGENCE` | `NEXT_PUBLIC_FLAG_AGENCE` | Dashboard agence + CRM | OK (false en Phase 1) |
| `ROLE_PORTAIL_PROPRIO` | `NEXT_PUBLIC_FLAG_PORTAIL` | Rôle portail_proprio + section `/portail` | OK |
| `ROLE_ARTISAN` | `NEXT_PUBLIC_FLAG_ARTISAN` | Dashboard artisan + missions + profil + revenus | OK |
| `ROLE_OPENER` | `NEXT_PUBLIC_FLAG_OPENER` | Dashboard ouvreur + missions + historique + revenus | OK |
| `OAUTH_COMMUNICATION` | `NEXT_PUBLIC_FLAG_OAUTH_COMMUNICATION` | Page `/communication`, MessagerieContent, bouton Contacter fiche bien, badge unread sidebar | OK (gel actif §B.15 PR-0 2026-05-11) |

Flags hors phase (hardcodés `false`) : `ROLE_EXPERT`, `ROLE_HUNTER`, `ROLE_ACHETEUR_PREMIUM`.

**Pas de `FLAGS.MARKETPLACE`** — la marketplace publique est entièrement code dormant côté middleware (cf §3 ci-dessous), pas via feature flag.

---

## 2. Usages des helpers de flag (frontend)

`grep -rn "isEnabled|isRoleEnabled|isSectionEnabled" frontend/src` :

- **`app/(auth)/register/page.tsx`** : `isRoleEnabled(role)` pour filtrer les rôles affichés dans la sélection signup.
- **`app/app/(dashboard)/biens/[id]/page.tsx:733`** : `isEnabled("OAUTH_COMMUNICATION")` masque le bouton « Contacter » de la fiche bien quand flag=false.
- **`app/app/(dashboard)/communication/page.tsx:40`** : `isEnabled("OAUTH_COMMUNICATION")` → redirection `/app` si flag=false.
- **`components/DashboardLayoutClient.tsx`** : `isRoleEnabled(role)` + `isEnabled(flagGated)` → page `/app/<section>` bloquée pour user dont le rôle ou la section est gated.
- **`components/DashboardSidebar.tsx`** :
  - `isEnabled("OAUTH_COMMUNICATION")` → désactivation du polling `/messagerie/unread-count`.
  - `isSectionEnabled(item.section)` → filtrage `navMain` et `navBottom` (masque l'item Communication si flag=false).
- **`lib/hooks/useRole.ts`** : `isRoleEnabled(role)` + `isSectionEnabled(section)` → calcule la visibilité des sections par rôle.

**Pages gated en redirect server-side** (`if (!FLAGS.ROLE_X) redirect("/app")`) :

- `agence/page.tsx`, `crm/page.tsx` → `ROLE_AGENCE`
- `artisan/page.tsx`, `artisans/missions/page.tsx`, `artisans/page.tsx`, `artisans/profil/page.tsx`, `artisans/revenus/page.tsx` → `ROLE_ARTISAN`
- `ouvreur/page.tsx`, `ouvreurs/page.tsx`, `ouvreurs/missions/page.tsx`, `ouvreurs/historique/page.tsx`, `ouvreurs/revenus/page.tsx` → `ROLE_OPENER`

**Note** : la page `/app/artisans/devis` (RFQ legacy) et `/app/artisans/chantiers` ne sont **pas** gated explicitement par `FLAGS.ROLE_ARTISAN` côté composant racine, mais leurs liens entrants ont été retirés en Lot B (commit 1 : interventions cleanup). Elles restent accessibles uniquement par URL directe → cible Lot C (sidebar/header) pour décider du retrait final ou ajout d'un guard `FLAGS.ROLE_ARTISAN`.

---

## 3. Marketplace publique — code dormant (middleware)

Source : `frontend/src/middleware.ts:85-87`.

```ts
if (pathname === "/biens" || pathname.startsWith("/biens/")) {
  return NextResponse.redirect(new URL(user ? "/app" : "/", request.url));
}
```

Surfaces concernées (intercepted hard) :

- `/biens` (liste publique)
- `/biens/[id]`, `/biens/swipe`
- Pages SEO villes : `/biens/lausanne`, `/biens/geneve`, `/biens/fribourg`, `/biens/neuchatel`, `/biens/sion`, `/biens/valais`, `/biens/vaud` (dossiers `frontend/src/app/biens/<ville>/` existants)

→ Tous ces dossiers existent en repo et redirigent vers `/app` (authentifié) ou `/` (anonyme). Code dormant validé conformément à §B.15.

---

## 4. Composants nettoyés en Lot B (sprint 9)

| Commit | Fichier | Action |
|--------|---------|--------|
| `7c1efdc` | `frontend/src/app/app/(dashboard)/interventions/page.tsx` | Refonte vue agrégée — retire RFQ + onglets + modale Comparer IA + commission 10 % |
| `a487bd6` | `frontend/src/app/app/(dashboard)/candidatures/page.tsx` | Remplace UI scoring + Stripe owner_fee par ComingSoon Phase 2 (Prussian) |
| `e5ae3d4` | `frontend/src/components/map/CarteMapboxPage.tsx` | Carte des biens user uniquement — retire stats 204/5/4.7, barre Sphère, CTA marketplace |
| `207f2b5` | `frontend/src/app/app/(dashboard)/biens/page.tsx` | Retire onglet Favoris + state + bouton Heart + carte par défaut |
| `c8c9095` | `frontend/src/components/finances/ComptabiliteView.tsx` | Retire Scanner facture (OCR IA) + Déclaration fiscale IA |
| `f9a8b7b` | `frontend/src/app/app/(dashboard)/documents/page.tsx` | Retire Scan facture (OCR) + Mandat de gestion + Dossier vendeur |

---

## 5. Surfaces Phase 2 conservées en code dormant (réactivation env var)

| Surface | Mécanisme | Réactivation |
|---------|-----------|--------------|
| Module Communication (OAuth + WhatsApp) | `FLAGS.OAUTH_COMMUNICATION` + `settings.ENABLE_OAUTH_COMMUNICATION` (backend) | Flip 2 env vars à `true` (front + back), zéro code |
| Dashboard agence + CRM | `FLAGS.ROLE_AGENCE` | `NEXT_PUBLIC_FLAG_AGENCE=true` |
| Dashboard artisan (RFQ, missions, devis, revenus) | `FLAGS.ROLE_ARTISAN` | `NEXT_PUBLIC_FLAG_ARTISAN=true` |
| Dashboard ouvreur (missions visite, revenus) | `FLAGS.ROLE_OPENER` | `NEXT_PUBLIC_FLAG_OPENER=true` |
| Portail propriétaire (agence ↔ proprio) | `FLAGS.ROLE_PORTAIL_PROPRIO` | `NEXT_PUBLIC_FLAG_PORTAIL=true` |
| Marketplace publique `/biens/*` | Middleware redirect | Retirer/conditionner les lignes 85-87 de `middleware.ts` |

Endpoints backend Phase 2 conservés (non démontés) :

- `POST /factures/analyser` (OCR IA — finances scanner)
- `POST /ai/scan-facture` + `POST /ai/confirmer-facture` (documents scan + affectation OBLF)
- `GET /export/declaration-fiscale` (déclaration fiscale IA)
- `/marketplace/candidatures` + `PATCH /marketplace/candidature/{id}` (scoring + Stripe owner_fee)
- `/favorites` CRUD (favoris cross-marketplace)
- `/rfqs/*` + `/rfqs/{id}/compare-devis` (RFQ artisans + comparaison IA)

---

## 6. Violations détectées pendant l'audit

**Néant.** Tous les composants Phase 2 visibles dans le scope Lot B ont été nettoyés. Les flags existants gardent leur sémantique (gate dur en Phase 1.0).

**Hors-scope reporté** :

- L'item sidebar « Candidatures reçues » reste visible → Lot C
- L'item sidebar « Annonces » / « Diffusion portails » : à vérifier dans Lot C
- Les URLs `/app/artisans/devis` et `/app/artisans/chantiers` restent atteignables par URL directe (plus de liens entrants) — pas de guard `FLAGS.ROLE_ARTISAN` au niveau page racine, à arbitrer Lot C
- Les pages SEO villes (`/biens/<ville>/page.tsx`) restent en repo et redirigent via middleware ; suppression complète = sprint dédié Phase 2

---

## 7. Backend mounts conservés (sanity check)

- `backend/app/main.py:278` : router `interventions-althy` monté → endpoint réel pour la nouvelle vue agrégée /app/interventions.
- `backend/app/main.py` (gel §B.15) : `oauth.py`, `whatsapp.py`, `messagerie.py` non montés si `ENABLE_OAUTH_COMMUNICATION=false` → 404 pour `/api/v1/oauth/*`, `/api/v1/whatsapp/*`, `/api/v1/messagerie/*`.
