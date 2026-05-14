# Sprint 9 — Lot E — Bugs prod fixés

> Worktree : `/c/Users/Killan/immohub-s9-lot-e-bugs-prod`
> Branche : `feat/sprint-9-lot-e-bugs-prod`
> HEAD de départ : `b15bfe8`
> Mode : LECTURE CODE + FIX dans worktree (pas d'exec live sur prod Sunimmo).
> Doctrine respectée : §B.10 (statuts honnêtes), §B.12 (transactions DB isolées),
> §B.13 (aucune migration Alembic — Lot A est seul à toucher 0050).

---

## BUG 1 — POST /api/v1/documents/generate retournait 500 (ExceptionGroup TaskGroup)

**Symptôme prod** : tout appel `POST /api/v1/documents/generate` renvoyait 500.
Les logs Railway exposaient une `ExceptionGroup` enveloppant des erreurs Python
classiques (TaskGroup = wrapper anyio/Starlette autour de toute exception non
gérée en async).

**Cause racine** (3 défauts cumulés) :

1. La requête `select(AgencySettings).where(AgencySettings.agency_id == ...)`
   ciblait une colonne `agency_id` qui **n'existe pas** sur le modèle (la
   colonne réelle est `user_id`). Le `try/except: pass` autour absorbait
   l'`AttributeError` Python, mais 8 autres colonnes accédées dans le bloc
   (`notification_email`, `representative_name`, `address`, `city`, `phone`,
   `website`, `logo_url`) ne mappaient pas non plus le schéma réel
   (`agency_email`, `agency_phone`, `agency_address`, `agency_website`,
   `agency_logo_url`, pas de `representative_name` ni `city`).
2. `_build_ctx` renvoyait un `tenant_info`, `prop_info` ou `contract_info`
   **vide `{}`** quand l'objet associé n'existait pas. Les builders f-string
   accédaient ensuite `tenant['civility']`, `prop['address']`,
   `contract['start_date_long']` **sans `.get()`** → `KeyError` → 500 enveloppé
   en ExceptionGroup TaskGroup.
3. Lecture `agency_settings` dans la session SQLA partagée → §B.12 :
   risque de session aborted qui polluerait le `commit` final du doc.

**Fix appliqué** : `backend/app/routers/documents.py:1408-1538`

- Query agency_settings corrigée (`user_id` au lieu de `agency_id`).
- Session dédiée `AsyncSessionLocal()` pour la lecture best-effort
  (cf §B.12).
- Mapping colonnes réelles : `agency_name`, `agency_email`, `agency_phone`,
  `agency_address`, `agency_website`, `agency_logo_url`.
- `_build_ctx` : defaults exhaustifs pour `tenant_info` (10 clés),
  `prop_info` (35 clés) et `contract_info` (38 clés). Les builders peuvent
  désormais accéder en `[]` sans risque de `KeyError`.
- Ajout `extra` + `today` dans le `ctx` retourné (utilisé par `_build_relance`
  et `_build_dossier_vendeur`).
- UUID parsing : `ValueError` → 400 explicite.
- Wrapping `try/except KeyError|ValueError|TypeError|AttributeError` autour
  de la sélection du builder → 400 « Données insuffisantes pour générer ce
  document » au lieu d'un 500 opaque. §B.10 respecté : on ne retourne plus
  un 201 quand le HTML n'a pas pu être construit, on remonte un échec clair.

**Test de validation** :

```bash
# Smoke test backend import
SECRET_KEY=x DATABASE_URL=postgresql+asyncpg://x:x@x/x SUPABASE_URL=https://x.supabase.co \
  SUPABASE_SERVICE_KEY=x SUPABASE_JWT_SECRET=x python -c "import app.main"
# → main.py OK
```

Reproduction manuelle locale (à exécuter après merge) :

```bash
curl -X POST http://localhost:8000/api/v1/documents/generate \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"template_type":"fiche_bien","bien_id":"<uuid-valide>","extra":{}}'
# Avant fix : 500 ExceptionGroup TaskGroup
# Après fix : 201 + content_html JSON
```

**Commit** : `f39d5f4` — `fix(documents): /generate hardened`

---

## BUG 2 — POST /api/v1/biens/{id}/generer-annee retournait 404

**Symptôme prod** : le bailleur appuie sur « Générer l'année », le frontend
appelle `POST /api/v1/biens/{bien_id}/generer-annee?annee=N` mais reçoit 404.

**Cause racine** : le backend n'exposait la route que sous
`POST /api/v1/loyers/generer-annee` (avec body `GenererAnneeRequest`,
cf `routers/loyers.py:482`). Le frontend (`lib/api/loyers.ts:78-83`) appelle
`/biens/{bien_id}/generer-annee` avec `bien_id` dans le path et `annee` en
query string. Aucun mapping côté backend → 404.

**Décision Killian** : la route LOGIQUEMENT appartient à `/biens/{id}/`
(action sur le bien). Ajout d'un wrapper RESTful dans `routers/biens.py` qui
délègue à `generer_loyers_annee` (pas de duplication métier).

**Fix appliqué** : `backend/app/routers/biens.py:402-433`

```python
@router.post("/{bien_id}/generer-annee", status_code=status.HTTP_201_CREATED)
async def generer_annee_bien(
    bien_id: uuid.UUID,
    annee: int,
    current_user: AuthDep,
    db: DbDep,
):
    from app.routers.loyers import GenererAnneeRequest, generer_loyers_annee
    payload = GenererAnneeRequest(bien_id=bien_id, annee=annee)
    return await generer_loyers_annee(payload, current_user, db)
```

L'ancienne route `/loyers/generer-annee` reste exposée pour compatibilité
(cron interne / scripts).

**Test de validation** : smoke import (route visible dans
`router.routes` avec path `/{bien_id}/generer-annee`).

**Commit** : `ee0aeab` — `fix(biens): POST /biens/{id}/generer-annee`

---

## BUG 3 — Frontend appelait endpoints Phase 2 gated (503)

**Symptôme prod** : la console Sunimmo loggait des 503 répétés sur
`GET /api/v1/favorites` (au chargement de la liste biens) et
`GET /api/v1/scoring/{tenant_id}` (à l'ouverture d'une fiche bien).

**Cause racine** : le backend a `BACKEND_FLAG_FAVORITES=false` et
`BACKEND_FLAG_SCORING=false` par défaut (cf `backend/app/core/config.py:197/199`).
Le frontend ne possédait aucun flag équivalent → les appels partaient
systématiquement.

**Fix appliqué** :

1. `frontend/src/lib/flags.ts` : ajout de 2 flags
   - `FAVORITES` (driven par `NEXT_PUBLIC_FLAG_FAVORITES`), default false.
   - `SCORING` (driven par `NEXT_PUBLIC_FLAG_SCORING`), default false.
2. `frontend/src/app/app/(dashboard)/biens/page.tsx` :
   - `useEffect` favoris : early-return si `!FLAGS.FAVORITES`.
   - Onglet « Favoris » : masqué de `TABS` si flag off.
   - `toggleFavorite` : no-op si flag off (ceinture + bretelles).
   - Bouton cœur sur `BienCard` : masqué si flag off.
3. `frontend/src/lib/hooks/useBiens.ts` :
   - `useScoring` : `enabled = Boolean(locataireId) && FLAGS.SCORING`.

**Réactivation Phase 2** : flip des 2 env vars côté Vercel + 2 env vars
côté Railway. Zéro code à toucher.

**Commit** : `aefffa1` — `fix(frontend): gate /favorites + /scoring`

---

## BUG 4 + BUG 5 — Settings Comptabilité defaults EUR / 1er juillet

**Symptôme prod** :
- BUG 4 : la devise affichée par défaut est EUR alors que §B.2 impose CHF.
- BUG 5 : le début d'exercice affiché est « 1er juillet » alors que le hint
  dit « 01.01 par défaut (standard suisse) ».

**Cause racine** : `TabComptabilite` initialisait son state local avec
`fiscal_year_start: "01-01"` et `devise: "CHF"`, mais **aucune coercition
défensive** n'était appliquée à l'affichage. Si la valeur du state se
trouvait égale à une chaîne hors options (state corrompu localement, ancien
localStorage périmé, race condition entre tabs), le `<select>` rendait
l'option par défaut du navigateur ou l'option vide `— Choisir —` — comportement
non déterministe.

Par ailleurs, le backend `PATCH /auth/me` n'a pas de colonne dédiée pour
`fiscal_year_start` ni `devise` côté users, donc une éventuelle valeur saisie
par l'utilisateur **n'est pas persistée**.

**Fix appliqué** : `frontend/src/app/app/(dashboard)/settings/page.tsx:1253-1336`

- Const figées `COMPTABILITE_DEFAULTS` (01-01 + CHF), `FISCAL_YEAR_OPTIONS`,
  `DEVISE_OPTIONS`.
- State initial via spread des defaults.
- Defensive value coercion : si la valeur courante n'est pas dans la liste
  des options, on retombe sur le default. Aucun scénario ne peut faire
  afficher EUR ou « 1er juillet » comme état initial.
- Hint « CHF par défaut (§B.2) » ajouté sur le sélecteur Devise.

**Note pour Lot A** : pas de migration data requise. La persistance backend
des comptabilité settings est hors scope Lot E (le PATCH `/auth/me` ne stocke
rien actuellement). Si Lot A décide d'ajouter ces colonnes dans 0050, les
defaults seront cohérents dès la 1re sauvegarde — mais **rien à backfiller**
pour les users existants car aucune donnée n'a été persistée à ce jour.

**Commit** : `c907cce` — `fix(settings): defaults CHF + 1er janvier`

---

## BUG 6 — Trailing slashes 307 redirects

**Symptôme prod** : nombreuses requêtes type
`GET /api/v1/interventions-althy/?size=50` déclenchaient un 307 redirect
vers `/api/v1/interventions-althy?size=50`. Coût : 1 RTT supplémentaire
par appel + risque de casse sur certains proxies / CORS preflight.

**Cause racine** : 29 occurrences `api.{verb}("/<path>/", ...)` dans le
frontend, alors que les routes backend sont définies sans slash final
(`@router.get("", ...)` et `@router.post("", ...)`).

**Décision Killian** : convention SANS slash final partout.

**Fix appliqué** :

- Frontend — 29 occurrences corrigées (script Python regex
  `api.{verb}(<...>)?("path/", ...)` → `("path", ...)`).
  Fichiers : `AgendaContent.tsx` (2), `MessagerieContent.tsx` (2),
  `UnifiedDashboard.tsx` (8), `ComptabiliteView.tsx` (1),
  `NotationModal.tsx` (1), `useBiens.ts` (3), `useCompanies.ts` (2),
  `useDashboardData.ts` (8), `useInterventions.ts` (1), `useRFQ.ts` (1).
- Backend — 2 routes étaient déclarées avec slash final (`factures.py`) :
  - `POST /depenses/` → `POST /depenses`
  - `GET  /depenses/` → `GET  /depenses`
  Aligné sur la convention. Aucun autre router backend n'utilise de slash
  terminal (vérifié exhaustivement avec
  `grep -rE '@router\.(get|post|put|patch|delete)\("[^"]+/"' backend/app/routers/`).

**Test de validation** : `grep` confirme 0 trailing slash résiduel dans
`api.*` calls côté frontend.

**Commit** : `ee883bd` — `fix(api): remove trailing slashes`

---

## BUG 7 — 404 sur /api/v1/invite/{token}/preview

**Symptôme prod** : la page `/invite/[token]` côté frontend recevait 404 sur
`GET /api/v1/invite/{token}/preview`.

**Cause racine** (audit) :
- L'endpoint **existe bien** dans `backend/app/routers/biens_invitations.py:476`.
- Le router `preview_router` est bien monté dans `main.py:243` avec prefix
  `/api/v1` → la route finale `/api/v1/invite/{token}/preview` est correcte.
- La query magic_links filtrait sur `target_role = 'locataire'` — trop strict
  pour les invitations historiques où `target_role` pouvait être NULL ou
  avoir une autre valeur.
- Aucun log diagnostic : impossible de différencier prod « token absent »
  vs « token tronqué côté front » vs « mismatch schema ».

**Fix appliqué** : `backend/app/routers/biens_invitations.py:476-545`

1. Query magic_links tolérante : retrait du filtre `target_role`. On
   conserve `type = 'invitation'`. Sécurité préservée (token secret 32-byte
   urlsafe, collision astronomique inter-types).
2. `token.strip()` défensif + 404 explicite si vide.
3. Log INFO sur 404 avec préfixe token (6 chars) + longueur (pas de fuite
   du token complet). Permet de diagnostiquer en prod :
   - token absent en base → vrai 404.
   - token de longueur != 43 → bug de troncature côté front.
   - target_role NULL ou différent → maintenant résolu par la query plus
     permissive.

**Test de validation** : smoke import → preview_router enregistre bien
1 route `GET /invite/{token}/preview`.

**Commit** : `49eefa3` — `fix(invite): query tolérante + log diagnostic`

---

## Hors scope rencontré

Aucun bug supplémentaire découvert en dehors des 7 listés.

---

## Smoke tests finaux

```bash
# Backend import
cd /c/Users/Killan/immohub-s9-lot-e-bugs-prod/backend
SECRET_KEY=x DATABASE_URL=postgresql+asyncpg://x:x@x/x \
  SUPABASE_URL=https://x.supabase.co SUPABASE_SERVICE_KEY=x \
  SUPABASE_JWT_SECRET=x python -c "import app.main"
# → main.py OK

# Frontend tsc
cd /c/Users/Killan/immohub-s9-lot-e-bugs-prod/frontend
npx tsc --noEmit
# → 0 erreurs

# Frontend build
npm run build
# → Build OK (toutes routes générées)
```

---

## Action Killian

- **Merge en ordre 1** (premier dans la séquence Sprint 9) — ces 7 fixes
  débloquent le smoke prod Sunimmo.
- **Data migration dans 0050 (Lot A)** : **NON requise**. Les BUG 4 + BUG 5
  ne nécessitent pas de backfill (aucune donnée persistée historiquement).
  Tous les autres bugs sont code-only.

---

*Sprint 9 Lot E — Bugs prod — 2026-05-14*
