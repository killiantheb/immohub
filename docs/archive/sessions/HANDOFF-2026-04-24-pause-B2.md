# HANDOFF — Pause session 8 entre B.1 et B.2

> **Date de pause** : 2026-04-24 soir
> **Date de reprise prévue** : 2026-04-25 matin
> **Branche** : `refonte/fusion-properties-biens-complete`
> **HEAD commit** : `3b49707` (fix routers/__init__.py retire import résiduel `properties`)
> **Objectif à la reprise** : enchaîner B.2 → B.5 → Phase C → étape 20.2 (migration 0029 sur staging) → étape 20.3 (validation SQL staging). **20.4 (migration prod) reporté à feu vert explicite Killian post-20.3.**

---

## 1. État global session 8

**Terminé ce soir** :
- Fix bloquant `backend/app/routers/__init__.py` (commit `3b49707`) — routeur `properties` supprimé des imports résiduels, smoke runtime OK à 321 routes.
- Phase 0 checks A/B/C/D : verts (PYTHONUTF8=1, app.main import OK, `.env` UTF-8 intact, git propre).
- Phase 20.1.A — 3 dumps prod dans `backups/` (roles 297 B, schema 447 KB, data 169 KB), `alembic_version = 0028`, 3 biens + 2 properties + 4 users + 0 contracts confirmés.
- Phase 20.1.B.1 — projet staging créé : `althy-staging-20260424`, region `eu-central-2` (identique prod), plan Free, ref `uystpsndbyrcbuifjkzo`, DB password généré par Supabase stocké dans Bitwarden.

**En pause exacte** :
- Phase 20.1.B.2 — récupération des **6 credentials staging restants** (URL API, anon key, service_role key, JWT secret, DB URL direct 5432, DB URL pooler 6543) **non encore commencée**. La 7e (DB password) et la 1re (STAGING_PROJECT_REF) sont déjà OK.

**Reste à faire demain avant fin objectif "staging migré + validé"** :
- B.2 : récup des 6 credentials (page Settings → API + Settings → Database du projet staging)
- B.3 : chargement `STAGING_DB_PW` via `read -s` + smoke `SELECT 1`
- B.4.a : rappel décision 3 options filtrage (Option A retenue)
- B.4.b.1 : dry-run awk sur extrait 500 lignes
- B.4.b.2 : awk sur fichier complet → `data-public-only.sql`
- B.4.c : validation du dump filtré AVANT restore (counts 70/0/0, alembic=0028, 0 résidus)
- B.4.d : restore psql `roles.sql` → `schema.sql` → `data-public-only.sql`
- B.4.e : housekeeping (ne pas unset)
- B.5.0 : checkpoint rapide 5 valeurs
- B.5.1 à B.5.8 : validation détaillée (smoke, alembic formel, counts formels, 16 tables, 3 enums legacy, 11 FK property_id, RLS, housekeeping final)
- Phase C : switch `backend/.env` local prod→staging
- Étape 20.2 : migration alembic 0029 sur staging
- Étape 20.3 : validation SQL staging post-0029

**Reporté obligatoirement au lendemain** :
- Étape 20.4 (migration 0029 sur prod) — **pas avant feu vert explicite Killian post-20.3**.

---

## 2. Artefacts persistants (survivent à la fermeture)

### Fichiers `docs/session8/` (non committés, à relire à la reprise)

| Fichier | Description courte |
|---------|--------------------|
| `etape-20-1-backup-staging.md` | Procédure pré-Phase A (legacy, remplacé par les 3 docs dédiés ci-dessous). Référence historique, pas à suivre tel quel demain. |
| `phase-20-1-A-bilan.md` | Bilan Phase A terminée avec succès. Relire en premier pour contexte (snapshot prod, anomalies, prérequis validés). |
| `etape-20-1-B-staging.md` | **LE doc à suivre pas-à-pas demain**. 730 lignes, intègre les 3 amendements Killian (ADD-1 dry-run awk, ADD-2 checkpoint B.5.0, ADD-3 vars shell check B.1.0). |
| `HANDOFF-2026-04-24-pause-B2.md` | Ce fichier. |

### Fichiers `backups/` (ignored par `.gitignore` section "Backups & dumps")

| Fichier | Taille | Contenu |
|---------|-------:|---------|
| `backups/prod-dump-2026-04-24-1847-roles.sql` | 297 B | 3 `ALTER ROLE SET statement_timeout` sur anon/authenticated/authenticator |
| `backups/prod-dump-2026-04-24-1847-schema.sql` | 447 KB | 69 tables + 326 ALTER + 175 index + 32 enums, état pré-0029 |
| `backups/prod-dump-2026-04-24-1847-data.sql` | 169 KB | 99 COPY (22 auth + 70 public + 7 storage), alembic_version=0028 |

**Sécurité** : `data.sql` contient les hashes password des 4 users prod. À nettoyer en fin de session 8 (après migration prod 20.4 réussie).

### Entrée Bitwarden

- Nom exact : `Althy Supabase Staging - DB Password (session 8)`
- Username : `postgres.uystpsndbyrcbuifjkzo`
- Password : DB password ~32 chars généré par Supabase à la création du projet staging
- Notes : contexte session 8

### Modifications git non committées (working tree)

```
 M .claude/settings.local.json             ← habituel Claude Code
 M .gitignore                              ← 2 ajouts session 8 :
                                             section "Backups & dumps" (backups/, *.sql.gz, prod-dump-*)
                                             et pattern "**/supabase/.temp/"
 M SPRINT_LOG.md                           ← 2 lignes 🟢 Phase 1 Alpha ajoutées :
                                             "Collision numérotation Supabase CLI vs Alembic"
                                             "Standardiser CWD d'exécution Supabase CLI"
?? docs/session8/                          ← 4 fichiers dont ce handoff
```

Le dossier `backend/supabase/` existe sur disque (créé par `supabase link` au Bloc 1.3) mais **n'apparaît PAS** dans `git status` car son unique contenu est `.temp/` qui est gitignored.

### Projet Supabase staging

- **Ref** : `uystpsndbyrcbuifjkzo`
- **Nom** : `althy-staging-20260424`
- **Région** : `eu-central-2` (identique prod, vérifié)
- **Plan** : Free
- **Status** : Ready / Healthy (à re-vérifier à la reprise, a pu évoluer pendant la nuit mais très improbable)
- **URL projet** : `https://uystpsndbyrcbuifjkzo.supabase.co`
- **Empty** : aucun restore fait ce soir, staging est à l'état post-provisioning Supabase (schemas auth/storage/public vides hors bootstraps platform)

### Projet Supabase prod

- Linké via `supabase link` depuis `backend/` CWD à 18h42
- Ref et URL stockés dans `backend/supabase/.temp/` (accessible `cat backend/supabase/.temp/project-ref` si besoin)
- `alembic_version = 0028` confirmé en Phase A

---

## 3. Ce qui DISPARAÎT à la fermeture

Tout ce qui est en mémoire shell / terminal :

- Variable `TS` (valeur actuelle : `2026-04-24-1847`)
- Variable `PREFIX` (valeur actuelle : `backups/prod-dump-2026-04-24-1847`)
- Variable `PROD_DB_PW` (longueur 14, extrait de `.env`)
- Historique `read -s` (jamais sauvegardé, conforme au design)
- Venv activé (activation python)
- `supabase login` : normalement persiste car stocké dans `%USERPROFILE%\AppData\Roaming\supabase\` — mais à re-vérifier si un prompt `supabase login` apparaît au matin
- `supabase link` : persiste via `backend/supabase/.temp/`, rien à refaire

### Procédure de reconstruction minimale au matin

```bash
cd /c/Users/Killan/immohub/backend
source venv/Scripts/activate

# Reconstruire TS et PREFIX depuis les filenames Phase A
PREFIX=$(ls backups/prod-dump-*-roles.sql | sed 's/-roles\.sql$//')
TS=$(echo "$PREFIX" | sed 's/backups\/prod-dump-//')
echo "TS     : $TS"
echo "PREFIX : $PREFIX"
test -f "${PREFIX}-schema.sql" && test -f "${PREFIX}-data.sql" && echo "dumps OK" || echo "STOP : dumps manquants"

# PROD_DB_PW : pas besoin en Phase B (migration 0029 pas encore lancée, Phase A terminée)
# Confirmer qu'il est bien absent (attendu) :
test -z "$PROD_DB_PW" && echo "PROD_DB_PW absent : OK Phase B" || echo "PROD_DB_PW encore set : non bloquant"

# Smoke rapide pour vérifier que le backend tourne toujours
python -c "from app.main import app; print('OK routes:', len(app.routes))"
# Attendu : OK routes: 321
```

---

## 4. Première action du matin — checklist 5 lignes

```bash
# 1. Ouvrir Git Bash
# 2. Naviguer au bon CWD :
cd /c/Users/Killan/immohub/backend
# 3. Activer venv :
source venv/Scripts/activate
# 4. Reconstruire vars Phase A + smoke :
PREFIX=$(ls backups/prod-dump-*-roles.sql | sed 's/-roles\.sql$//'); TS=$(echo "$PREFIX" | sed 's/backups\/prod-dump-//'); echo "PREFIX=$PREFIX"; echo "TS=$TS"; test -f "${PREFIX}-schema.sql" && test -f "${PREFIX}-data.sql" && echo "dumps OK"
# 5. Charger STAGING_DB_PW depuis Bitwarden puis :
read -s STAGING_DB_PW ; test -n "$STAGING_DB_PW" && echo "STAGING_DB_PW : set (length=${#STAGING_DB_PW})"
```

Ensuite → ouvrir `docs/session8/etape-20-1-B-staging.md`, sauter à la **section 3 (B.2 — Récupération credentials staging)** et suivre pas à pas le bloc B.2 (recopié en §6 ci-dessous).

---

## 5. Rappels critiques à ne pas oublier

1. **Pas de migration prod (étape 20.4) sans feu vert explicite Killian** — même après une 20.2 + 20.3 réussies sur staging. C'est lui qui clique, pas Claude.
2. **Patterns grep** : pg_dump 17.6 émet les noms quotés → `^COPY "public"\."<table>"` et `CREATE TABLE IF NOT EXISTS "public"\."<table>"`. Pas de `\b` (non POSIX).
3. **Deux passwords distincts** : `PROD_DB_PW` (14 chars, Phase A uniquement, inutile en B) vs `STAGING_DB_PW` (~32 chars, Phase B uniquement, via `PGPASSWORD` env var pour psql).
4. **Dump data contient auth+storage** malgré la doc CLI. Au restore staging, **filtrer** via awk pour ne garder que `public.*`. Option A retenue, dry-run B.4.b.1 obligatoire avant B.4.b.2.
5. **Ne JAMAIS coller dans le chat** : `STAGING_SERVICE_KEY`, `STAGING_JWT_SECRET`, `STAGING_DB_PW`, URLs avec password réel inline. Les URLs avec `[YOUR-PASSWORD]` placeholder sont OK à coller (no secret).
6. **Option B (DROP SCHEMA auth/storage CASCADE) est rejetée** — casserait la plateforme Supabase staging. Ne jamais y retourner.
7. **Nettoyage fin session 8** : supprimer `backups/prod-dump-*` après migration prod réussie (les fichiers contiennent des hashes password des 4 users prod).
8. **Backlog 🟢 Phase 1 Alpha** (SPRINT_LOG.md) : collision numérotation Supabase CLI vs Alembic + standardisation CWD Supabase CLI — à trancher avant users alpha, pas ce soir/demain.

---

## 6. Bloc B.2 exact à exécuter demain

Recopié intégralement depuis le livrable `etape-20-1-B-staging.md` pour éviter toute ambiguïté à la reprise. Si divergence avec le livrable, **le livrable prime** (source de vérité).

### Les 7 credentials — tableau de synthèse

| # | Credential | Chemin dashboard | Sensibilité | Stockage |
|---|------------|------------------|-------------|----------|
| 1 | `STAGING_PROJECT_REF` | — (déjà récupéré) | Public | Chat : `uystpsndbyrcbuifjkzo` ✅ |
| 2 | `STAGING_SUPABASE_URL` | Settings → API → Project URL | Public | Bitwarden + chat OK |
| 3 | `STAGING_ANON_KEY` | Settings → API → Project API keys → `anon public` | Semi-sensible | Bitwarden **uniquement** |
| 4 | `STAGING_SERVICE_KEY` | Settings → API → Project API keys → `service_role` ⚠️ | **SECRET** | Bitwarden **uniquement** |
| 5 | `STAGING_JWT_SECRET` | Settings → API → JWT Settings → JWT Secret | **SECRET** | Bitwarden **uniquement** |
| 6 | `STAGING_DB_URL_DIRECT` | Settings → Database → Connection string → mode Direct / port 5432 | Public avec placeholder | Chat OK si `[YOUR-PASSWORD]` intact |
| 7 | `STAGING_DB_URL_POOLER` | Settings → Database → Connection string → mode Transaction / port 6543 | idem #6 | idem #6 |
| — | DB password | (déjà Bitwarden) | **SECRET** | Bitwarden seul, jamais chat/shell history |

### B.2.a — Settings → API (credentials 2, 3, 4, 5)

Navigation : dashboard staging → sidebar ⚙️ Settings → **API**

Blocs à parcourir :
- **Project URL** (infobulle haut de page) : confirmer `https://uystpsndbyrcbuifjkzo.supabase.co`
- **Project API keys → anon public** : clic Reveal/Copy → Bitwarden
- **Project API keys → service_role** ⚠️ : clic Reveal/Copy → Bitwarden (jamais chat)
- **JWT Settings → JWT Secret** (peut être sur sous-onglet JWT) : clic Reveal → Bitwarden

### B.2.b — Settings → Database (credentials 6, 7)

Navigation : Settings → **Database**, descendre au bloc **Connection string**

Relever les 2 URLs :
- **Direct connection** (port 5432) : `postgresql://postgres:[YOUR-PASSWORD]@db.uystpsndbyrcbuifjkzo.supabase.co:5432/postgres`
- **Transaction mode** (port 6543) : `postgresql://postgres.uystpsndbyrcbuifjkzo:[YOUR-PASSWORD]@aws-0-eu-central-2.pooler.supabase.com:6543/postgres`

**Vérif région critique** : le host du pooler DOIT contenir `eu-central-2`. Si `eu-central-1` / `us-*` / autre → STOP, rollback B.1 + recréation.

### B.2.c — Confirmation à me coller en chat demain

1. `STAGING_SUPABASE_URL` complète (public, OK à coller)
2. `STAGING_DB_URL_DIRECT` avec `[YOUR-PASSWORD]` placeholder intact
3. `STAGING_DB_URL_POOLER` avec `[YOUR-PASSWORD]` placeholder intact
4. Confirmation région : "le pooler contient `eu-central-2` ✅"
5. Confirmation Bitwarden : "anon + service_role + JWT secret stockés"

**Ne PAS me coller** : les 3 keys (anon, service_role, JWT secret), le DB password, les URLs avec password réel injecté.

### Ce que je ferai ensuite (B.3)

Je te donnerai le bloc B.3 de chargement `STAGING_DB_PW` via `read -s` + export `PGPASSWORD` + définition `STAGING_DB_URL_DIRECT` en var shell + smoke `SELECT 1` sur staging.

---

## État final avant fermeture

- Aucun commit fait en dehors de `3b49707` (fix router) en début de session 8
- Working tree : 4 fichiers modifiés + `docs/session8/` + `backups/`
- Aucune action destructive effectuée
- Aucune modification prod
- Staging Supabase en état "vierge post-provisioning" (pas de restore lancé)

**À demain.**

---

*Handoff rédigé fin session 8, 2026-04-24, pour reprise 2026-04-25 matin. Cold-start safe.*
