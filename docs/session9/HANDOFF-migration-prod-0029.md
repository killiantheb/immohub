# HANDOFF Session 9 — Migration prod alembic 0029 et stabilisation backend

**Date** : 2026-04-25  
**Durée** : ~5h (reprise café ~12h30 UTC → clôture ~17h30 UTC)  
**Branche** : `refonte/fusion-properties-biens-complete`  
**Migration** : `0029_fusion_properties_biens_complete`  
**Statut final** : 🟢 VERT — GO pour création de premiers biens via UI/API

---

## 1. Résultat et statut final

Migration alembic 0028 → 0029 appliquée sur prod sans incident. Validation profonde 5/5 sous-blocs verts (parité staging session 8 stricte). Runtime backend restauré sur Transaction Pooler 6543 et hardé contre `DuplicatePreparedStatementError`. Trois bugs pré-existants déterrés et corrigés en passant. Chemin écriture `biens` validé en transaction ROLLBACK.

**Tu peux créer ton premier bien réel via l'UI ou via API authentifiée. Le backend est prêt.**

4 commits backend session 9, 0 pollution data prod, 4 users intacts, working tree clean.

---

## 2. Décisions techniques arbitrées

### Option B pooler pour alembic
Session Pooler 5432 pendant `alembic upgrade head`, retour Transaction Pooler 6543 pour le runtime. Décision motivée par : `pg_advisory_lock` relâché entre transactions en mode pgbouncer transaction, `DuplicatePreparedStatementError` asyncpg, recommandation officielle Supabase pour outils de migration, et chemin déjà validé sur staging session 8.

**Validation empirique** : smoke runtime sur 6543 post-migration (4 SELECT + 5 queries séquentielles dans le même process avec `statement_cache_size=0`) passe sans erreur. Confirme que 6543 est correct pour le runtime FastAPI mono-process.

### Hardening database.py
Ajout de `statement_cache_size=0` et `prepared_statement_cache_size=0` dans `connect_args` de `create_async_engine`. Pré-existant à la session, déterré pendant 20.7.2-bis, corrigé en commit séparé.

### Rename `property_id` → `bien_id` Option α (breaking, pas de rétro-compat)
Cohérent avec la migration DB qui était déjà breaking. Pas d'alias Pydantic, pas de double naming. Le front s'aligne sur `bien_id` désormais.

---

## 3. Hashes et archives `.env`

| Fichier | Hash SHA-256 | Rôle | Port DB |
|---|---|---|---|
| `.env.prod-backup` | `fe12db1678fe48b9091b5c27bc14862d5e3f643d996ecf21c00cef5532d772c3` | Archive prod runtime | 6543 |
| `.env.prod-migration` | `194a29d10a3a1de2d585ea369ba90c61ffe0618be29e35d747a361a0e67eeacd` | Archive prod migration | 5432 |
| `.env.staging` | `1b9c61e36453416e609b5b10d9f9511c17f4434279392ba8ad309025edd460c9` | Archive staging | 5432 |
| `.env` (actif fin session) | `fe12db1678…d772c3` (= prod-backup) | Runtime prod | 6543 |

**Project ref prod** : `zvcjaiqfinmxguiyozzu`  
**Host pooler prod** : `aws-1-eu-central-2.pooler.supabase.com` (identique staging, région Zurich)

**Génération `.env.prod-migration`** : `sed 's|:6543/postgres|:5432/postgres|' .env.prod-backup > .env.prod-migration` (1 ligne modifiée, lecture seule sur backup).

---

## 4. Timeline migration prod 20.4

| Phase | T0 | T1 | Durée | Statut |
|---|---|---|---|---|
| 20.4.1 + bis — Switch .env + pré-flight | — | — | ~10 min | ✓ |
| 20.4.2 — `alembic upgrade head` | 2026-04-25T14:34:41Z | 2026-04-25T14:34:45Z | **4 sec** | ✓ exit 0 |
| 20.4.5 — Validation profonde 5/5 | — | — | ~30 min | ✓ |
| 20.5 — Cleanup .env + smoke 6543 | — | — | ~5 min | ✓ |

### Snapshot pré → post

| Métrique | Pré-0029 | Post-0029 |
|---|---|---|
| `alembic_version` | 0028 | 0029 |
| `biens` | 3 | 0 (TRUNCATE) |
| `properties` (table) | 2 lignes | DROPPED |
| `users` | 4 | 4 (intacts) |
| `catalogue_equipements` | absente | 49 lignes |
| `ch_postal_codes` | absente | 256 lignes |
| BASE TABLE public | 70 | 72 (= 70 − 3 + 5) |
| Enums public | 32 | 30 (= 32 − 3 + 1) |
| FK total public | 105 | 106 |

---

## 5. Validation profonde 5/5 (parité staging session 8)

| Sous-bloc | Description | Résultat |
|---|---|---|
| 20.4.5.1 | FK redirigées vers `biens.id` | 22 FK, 0 résiduel `properties` |
| 20.4.5.2 | Colonnes `bien_id` / 0 `property_id` | 24 / 0 |
| 20.4.5.3 | Structure `biens` | 50 colonnes total, 19/19 critiques |
| 20.4.5.4 | Seeds + jonctions | catalogue=49, postal=256, jonctions=0 |
| 20.4.5.5 | Intégrité globale | FK=106, 0 orpheline, 0 constraint `property` |

---

## 6. Audit code post-migration (Phase 20.7) et 4 commits session 9

Cette phase a **dépassé son scope initial** ("vérifs avant premier bien") et déterré 3 bugs pré-existants corrigés en commits dédiés, plus un durcissement `.gitignore`.

### 4 commits session 9

| SHA | Description | Fichiers | Lignes |
|---|---|---|---|
| `3557319` | `fix(post-0029): rename property_id → bien_id in API and AI service layers` | 5 | 22+/22− |
| `3de508f` | `fix(db): disable asyncpg statement cache for Supabase Transaction Pooler` | 1 | 6+ |
| `ce0a7ed` | `fix(notations): reference correct column avatar_url in classement query` | 1 | 1+/1− |
| `ba7eda0` | `chore(gitignore): protect backend env archives from accidental staging` | 1 | 12+ |

### Sous-phases

| Phase | Description | Statut |
|---|---|---|
| 20.7.1 + fix | Audit `properties`/`property_id` résidus → 5 fichiers backend renommés | ✓ commit `3557319` |
| 20.7.2 + bis | Smoke import ORM + audit `Base.metadata` → 5 modèles ORPHAN détectés (dette session 10) | 🟡 acceptée |
| 20.7.2-fix | Hardening `database.py` pour Transaction Pooler 6543 | ✓ commit `3de508f` |
| 20.7.3 + bis | Validation auth Supabase, architecture H3 confirmée | ✓ documentée |
| 20.7.4 N1 + fix | Smoke 94 routes sans token → 1 bug `photo_url` corrigé | ✓ commit `ce0a7ed` |
| 20.7.4 N2 | Smoke 4 routes auth (mono-process post-attente pgbouncer) | ✓ rename validé runtime |
| 20.7.5 | INSERT bien minimal en transaction ROLLBACK | ✓ chemin write validé |
| 20.8 | Hardening `.gitignore` (env archives + backups + supabase temp) | ✓ commit `ba7eda0` |

---

## 7. Schémas et architecture découverts

### Auth pattern H3 (à propager dans CLAUDE.md)
- `auth.users` (Supabase managé) ↔ `public.users` (métier) reliés par `users.supabase_uid` (varchar(36) UNIQUE indexé)
- **`public.users.id` ≠ `auth.users.id`** — c'est intentionnel : `users.id` est un UUID métier interne (PK des FK depuis tous les modèles), `users.supabase_uid` est le pont
- Auto-provisioning skeleton dans `get_current_user` au premier login Supabase d'un user qui n'a pas encore son pendant métier
- 0 FK SQL entre les deux schémas, lien strictement applicatif via `app/core/security.py`
- `public.profiles` existe (33 colonnes) mais est vide (0 ligne) — table préparée Phase 2/3, pas utilisée par le code auth actuel

### `ch_postal_codes` (3 colonnes)
- `code_postal` varchar NOT NULL **← pas `code`**
- `canton` varchar NOT NULL  
- `ville_principale` varchar NOT NULL

**Distribution NPAs (256 total, 10 cantons)** : VD 67 / VS 61 / GE 47 / FR 18 / NE 15 / ZH 13 / BE 10 / JU 10 / BS 8 / TI 7 (Suisse romande 85%, chefs-lieux SD/IT 15%).

### `catalogue_equipements` (8 colonnes, 49 lignes seedées)
`id` uuid, `nom` varchar, `categorie` varchar, `icone` varchar NULL, `ordre_affichage` integer, `is_active` boolean, `created_at`/`updated_at` timestamptz.

### Enums `biens` post-0029
- `bien_type_enum` : `appartement`, `villa`, `studio`, `maison`, `commerce`, `bureau`, `parking`, `garage`, `cave`, `autre`
- `bien_statut_enum` : `loue`, `vacant`, `en_travaux` ⚠️ **pas `disponible`**
- `parking_type_enum` (créé par 0029) : `exterieur`, `exterieur_couvert`, `interieur`, `interieur_box`

---

## 8. Payload minimal pour création de bien (Phase 1 frontend)

**5 colonnes NOT NULL sans default** :
- `owner_id` (uuid, FK → `users.id`)
- `created_by_id` (uuid, FK → `users.id`)
- `adresse` (varchar)
- `ville` (varchar)
- `cp` (varchar)

**3 FK sortantes — toutes vers `users.id`** :
- `biens.owner_id → users.id`
- `biens.created_by_id → users.id`
- `biens.agency_id → users.id` ⚠️ **pas vers une table `agencies` séparée — un user `role='agence'` représente l'agence**

### Payload type (validé en transaction ROLLBACK)
```json
{
  "owner_id": "<uuid_user>",
  "created_by_id": "<uuid_user>",
  "agency_id": "<uuid_user_with_role_agence>" | null,
  "adresse": "string",
  "ville": "string",
  "cp": "string",
  "canton": "string",
  "type": "appartement|villa|studio|maison|commerce|bureau|parking|garage|cave|autre",
  "statut": "loue|vacant|en_travaux"
}
```

⚠️ **Mapping front à effectuer** : si le front utilise `disponible` quelque part (listing public, default form), remplacer par `vacant` — sémantiquement équivalent (bien sans locataire actif).

---

## 9. Trois corrections d'attendus identifiées (méthodologie)

Pendant la session, **3 mismatches comptables** détectés et résolus chirurgicalement. **Aucun n'était une anomalie data** ; tous étaient des erreurs d'attendu pré-rédigés "de tête" sans validation.

| Mismatch | Attendu erroné | Vrai chiffre | Cause |
|---|---|---|---|
| `enums_total` snapshot pré-migration | 32 | 44 (mesuré sans filtre) | Requête sans `nspname='public'` → comptait enums Supabase auth/realtime/storage |
| `BASE TABLE public` post-0029 | 75 (= 70+5) | 72 (= 70−3+5) | Calcul oubliait drops `property_images` + `property_documents` |
| Spot-check NPAs Lausanne 1000-1018 | ≥15 | 10 | Lausanne n'a que ~10 NPAs réels dans cette plage |

### Règle adoptée pour sessions futures
Tout attendu numérique doit être **traçable** à une source : soit une mesure validée précédemment, soit un calcul explicite documenté. Pas d'attendu "de tête".

### Requêtes baseline standardisées
```sql
-- Tables (filtrées BASE TABLE et public)
SELECT count(*) FROM information_schema.tables
WHERE table_schema='public' AND table_type='BASE TABLE';

-- Enums (filtrés public)
SELECT count(*) FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE t.typtype='e' AND n.nspname='public';
```

---

## 10. Dette technique ouverte (session 10)

| Item | Origine | Bloquant Phase 1 ? | Action session 10 |
|---|---|---|---|
| 5 ORPHAN ORM (`ai_usage_logs`, `autonomy_subscriptions`, `partner_commissions`, `partner_deals`, `partner_leads`) | Pré-existant | Non (try/except + features non actives) | Créer migrations 0030-0037 OU supprimer modèles si features pas prévues court terme |
| `public.profiles` 33 colonnes / 0 ligne | Pré-existant | Non | Investiguer : table préparée Phase 2 ou bug provisioning |
| RBAC strings `properties:read/write/delete` dans `schemas/auth.py` | Pré-existant | Non | Renommer en `biens:*` (mini-migration RBAC) |
| `Mission.property_lat` / `property_lng` (ORM + Pydantic + service) | Pré-existant | Non | Mini-migration alembic + rename ORM/schemas/service |
| 7 commentaires anglais "# Property" / "# properties" | Pré-existant | Non | Cleanup cosmétique |
| Celery workers + concurrence multi-process pgbouncer | À investiguer | À déterminer (selon flag-gating Celery Phase 1) | Tester sous charge + envisager `prepared_statement_name_func` si vrai problème |
| 2 entries `auth.users` sans pendant `public.users` | Auto-provisioning normal au premier login | Non | Audit Supabase Dashboard si nécessaire |
| Bruit teardown `RuntimeError: Event loop is closed` en TestClient asyncpg | Artefact Windows + asyncpg + TestClient | Non (purement test, pas runtime) | Si pytest CI dérange, envisager AsyncClient httpx au lieu de TestClient |

---

## 11. Filets de sécurité disponibles

### Filets data
- **3 dumps prod du 24-04** archivés dans `backups/prod-dump-2026-04-24-1847-*.sql`  
  SHA256 : `2bdfebfe6ec95b39d4fb60394170218b4f8064da52c8e089c51c7d79361eba74`
- **Migration 0029 non-réversible automatiquement** (downgrade destructif) — rollback = restore depuis dump prod

### Filets config
- **3 archives `.env.*`** avec hashes connus pour rollback config (cf. section 3)
- **Procédure rollback `.env`** documentée dans `docs/session8/HANDOFF-rollback-env.md`

### Filets credentials (durcis cette session)
- **`.gitignore` durci (commit `ba7eda0`)** : pattern `backend/.env.*` couvre les 3 archives env + exception `!backend/.env.example`. Plus de risque de fuite credentials par `git add .` accidentel.
- Secrets protégés : `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_KEY`, `STRIPE_SECRET_KEY`, et tout autre token contenu dans les 3 archives.
- `.gitignore` couvre aussi : `backups/` (dumps SQL), `*.sql.gz` (dumps compressés), `prod-dump-*` (préfixe), `**/supabase/.temp/` (cache CLI).

---

## 12. Étapes suivantes (hors session 9)

1. **Surveillance runtime backend prod 24-48h** : logs Railway, métriques Stripe, login users existants.
2. **Login validation** : 4 users `public.users` ont `supabase_uid` valide → tester un login réel via UI front pour confirmer le chemin bout en bout.
3. **Premier bien créé via UI** : valider en conditions réelles le payload minimal de la section 8.
4. **Cleanup front** : aligner sur `bien_id` partout, mapper `disponible` → `vacant` côté listings publics, `agency_id` pointe vers user agence.
5. **Suite refonte branche `refonte/fusion-properties-biens-complete`** : pages biens, formulaires, AI Sphere maintenant que le schéma backend est stabilisé.
6. **Session 10** : traiter la dette technique de la section 10.
7. **Push remote** : la branche locale a 4 nouveaux commits. À pousser quand tu juges le travail prêt à être visible côté GitHub (rien d'urgent — la prod tourne déjà, les commits sont locaux pour l'instant).
