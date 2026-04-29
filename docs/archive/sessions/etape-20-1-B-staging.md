# Étape 20.1.B — Création projet staging + restore des dumps prod

> Session 8 · 2026-04-24 · branche `refonte/fusion-properties-biens-complete`
> Phase précédente : **20.1.A validée** — 3 fichiers dump présents dans `backups/prod-dump-2026-04-24-1847-{roles,schema,data}.sql`, 616 KB total, `alembic_version = 0028` confirmé.
> Phase suivante : **20.1.C** (switch `.env` local backend sur staging), voir doc séparé.
> Doc adjacent : **`phase-20-1-A-bilan.md`** — lis-le d'abord si tu reprends cette session après une pause.

---

## Résumé exécutif

Objectif Phase B : créer un projet Supabase neuf nommé `althy-staging-20260424`, identique à prod côté schéma `public`, pour y tester la migration alembic 0029 avant la prod.

**3 amendements post-Phase A** intégrés dans cette procédure :

1. **Filtrage auth/storage au restore** — le dump `data.sql` inclut 22 COPY `auth.*` + 7 COPY `storage.*` en plus des 70 COPY `public.*`. On ne restore que `public` (la décision Phase 0 "auth exclu" s'applique). Option retenue : filtrage `awk` à la volée sur le dump existant, fichier intermédiaire `data-public-only.sql`. Argumentation complète ci-dessous en B.4.
2. **Deux passwords distincts** — `PROD_DB_PW` (Phase A, 14 chars, extrait de `.env`) n'est plus utilisé en Phase B. `STAGING_DB_PW` (généré par Supabase à la création du projet staging, ~32 chars) est la nouvelle var utilisée pour tous les `psql` de restore. Pattern `read -s` + `PGPASSWORD` env var pour ne pas exposer le password dans le shell history.
3. **Patterns grep avec guillemets doubles** — pg_dump 17.6 émet `COPY "public"."biens"` (guillemets doubles autour des identifiants). Toutes les validations par grep utilisent le format `^COPY "public"\."<table>" ` (guillemets littéraux, `\.` pour échapper les points).

Durée totale estimée : **30-45 minutes**, dont ~3 min d'attente de provisioning Supabase.

---

## 1. Prérequis avant de démarrer

Checkboxes à valider AVANT de lancer B.1.

### Environnement local

- [ ] CWD Git Bash = `/c/Users/Killan/immohub/backend`
  ```bash
  pwd   # attendu : /c/Users/Killan/immohub/backend
  ```
- [ ] venv activé
  ```bash
  which python   # attendu : .../backend/venv/Scripts/python
  ```
- [ ] CLI Supabase installé
  ```bash
  supabase --version   # attendu : 2.90.0 (Phase A) ou supérieur
  ```
- [ ] `psql` disponible
  ```bash
  psql --version   # attendu : psql (PostgreSQL) 18.3 (Phase A)
  ```
- [ ] Docker Desktop en cours d'exécution
  ```bash
  docker info >/dev/null 2>&1 && echo "docker OK" || echo "docker KO"
  ```
  **Note** : Docker n'est pas strictement requis en B (on utilise `psql`, pas `supabase db dump`), mais il était prérequis en A. S'il est arrêté, pas bloquant pour B.

### Artefacts Phase A

- [ ] Les 3 dumps présents dans `backups/`
  ```bash
  ls -lh backups/prod-dump-*-{roles,schema,data}.sql
  # Attendu : 3 fichiers, tailles typiques 297 B + 447 KB + 169 KB
  ```
- [ ] Reconstruire `PREFIX` depuis les noms de fichiers (si terminal rouvert depuis Phase A)
  ```bash
  # Si les vars shell sont perdues (nouveau terminal) :
  PREFIX=$(ls backups/prod-dump-*-roles.sql | sed 's/-roles\.sql$//')
  echo "PREFIX : $PREFIX"
  # Attendu : backups/prod-dump-2026-04-24-1847
  ```
- [ ] **PROD_DB_PW n'est PAS nécessaire en Phase B**. Ne le re-charge pas.

### Git status propre (ou cohérent avec Phase A)

- [ ] `git status --short` depuis repo root
  ```bash
  git -C /c/Users/Killan/immohub status --short
  ```
  Attendu (état cumulé fin Phase A + edits post-inspection backend/supabase/) :
  ```
   M .claude/settings.local.json
   M .gitignore
   M SPRINT_LOG.md
  ?? backend/supabase/   ← maintenant ignored via **/supabase/.temp/
  ?? docs/session8/
  ```
  Si le dossier `backend/supabase/` apparaît encore comme untracked alors que `**/supabase/.temp/` est dans `.gitignore`, c'est que le dossier contient autre chose que `.temp/` — STOP+remontée.

---

## 2. Sous-étape B.1 — Créer le projet staging via dashboard Supabase

Action **manuelle** dans le dashboard. Claude ne peut pas cliquer à ta place. Prends ton temps pour B.1.0 et B.1.a à B.1.c, chaque champ compte.

### B.1.0 — Vars shell check (préflight avant UI)

Avant de naviguer au dashboard, vérifier que l'état shell est cohérent avec la fin de Phase A (si terminal est resté ouvert) ou reconstruire (si terminal rouvert dans une nouvelle session).

```bash
echo "=== VARS SHELL CHECK ==="
echo "TS     : $TS"
echo "PREFIX : $PREFIX"
test -n "$PROD_DB_PW" && echo "PROD_DB_PW : set (length=${#PROD_DB_PW})" || echo "PROD_DB_PW : NOT SET"
```

Interprétation :

- **`TS` et `PREFIX` set (valeurs Phase A)** → shell est dans la continuité de la session A, continuer en B.1.a
- **`TS` ou `PREFIX` vide** (terminal rouvert) → reconstruire `PREFIX` depuis le nom du fichier Phase A :
  ```bash
  PREFIX=$(ls backups/prod-dump-*-roles.sql | sed 's/-roles\.sql$//')
  echo "PREFIX reconstruit : $PREFIX"
  test -f "${PREFIX}-schema.sql" && test -f "${PREFIX}-data.sql" && echo "dumps OK" || echo "STOP : dumps manquants"
  # Optionnel : remettre TS pour cohérence logs
  TS=$(echo "$PREFIX" | sed 's/backups\/prod-dump-//')
  echo "TS reconstruit : $TS"
  ```
- **`PROD_DB_PW : NOT SET`** → **attendu et OK** en Phase B (on n'en a pas besoin). Si encore set, pas bloquant mais sera purgé en B.5.8.

Une fois le shell check vert (soit les vars sont set, soit reconstruites depuis les fichiers), passer en B.1.a.

### B.1.a — Ouvrir le dashboard

- [ ] Naviguer vers [supabase.com/dashboard](https://supabase.com/dashboard)
- [ ] Vérifier que tu es dans la bonne organisation (celle qui contient le projet prod Althy, visible dans le sélecteur top-left)

### B.1.b — Créer le nouveau projet

- [ ] Cliquer **New project** (bouton en haut à droite ou dans la sidebar)
- [ ] **Name** : `althy-staging-20260424`
- [ ] **Database Password** : cliquer **Generate a password** (bouton à côté du champ)
  - Longueur attendue : ~32 caractères
  - **Copier immédiatement** dans ton gestionnaire de mots de passe sous l'entrée "Althy Staging DB Password — 2026-04-24"
  - Garder cette fenêtre ouverte jusqu'à B.3 (on va le saisir via `read -s` une seule fois)
- [ ] **Region** : identique à prod (`eu-central-2` d'après le pooler-url observé en Phase A, à confirmer — Supabase affiche les régions dans le dropdown)
  - **Vérif prod** : dashboard → projet prod → Settings → General → Region
  - Si divergence, **STOP** : cloner vers une région différente peut introduire des comportements Postgres subtilement différents (tri, collations, etc.). Prod était en `aws-1-eu-central-2`, on reste sur `eu-central-2`.
- [ ] **Pricing Plan** : Free Plan (500 MB DB, largement suffisant — prod fait 616 KB)
- [ ] Cliquer **Create new project**

### B.1.c — Attendre le provisioning

- [ ] Attendre que le status passe "Ready" (2-3 minutes typique)
- [ ] Pendant l'attente, préparer gestionnaire de mots de passe ouvert pour B.2

---

## 3. Sous-étape B.2 — Récupérer les credentials staging

Toutes les infos sont dans **Project Settings** du nouveau projet staging.

### B.2.a — Valeurs à noter

| Où le trouver dans le dashboard | Variable locale | Usage |
|---------------------------------|-----------------|-------|
| **General → Reference ID** | `STAGING_PROJECT_REF` | identifiant ~20 chars, pour logs + confirmation de livrable |
| **API → Project URL** | `STAGING_SUPABASE_URL` (= `https://<STAGING_PROJECT_REF>.supabase.co`) | sera utilisé en Phase C pour `.env.staging` |
| **API → Project API keys → `anon` public** | `STAGING_ANON_KEY` | pas utilisé en Phase B (backend n'en a pas besoin), à noter pour Phase C potentielle |
| **API → Project API keys → `service_role`** | `STAGING_SERVICE_KEY` | ⚠️ secret, bypass RLS, utilisé en Phase C |
| **API → JWT Settings → JWT Secret** | `STAGING_JWT_SECRET` | utilisé en Phase C |
| **Database → Connection string → URI (Direct connection, port 5432)** | `STAGING_DB_URL_DIRECT` | **Phase B : psql restore** |
| **Database → Connection string → URI (Transaction pooler, port 6543)** | `STAGING_DB_URL_POOLER` | Phase C : `DATABASE_URL` de l'app backend |

### B.2.b — Format des URLs

**Direct connection** (pour restore en B.4) — Supabase te donne :
```
postgresql://postgres:[YOUR-PASSWORD]@db.<STAGING_PROJECT_REF>.supabase.co:5432/postgres
```
→ Tu remplaceras `[YOUR-PASSWORD]` par la valeur via `PGPASSWORD` env var (voir B.3), **donc garde l'URL EXACTEMENT avec le placeholder `[YOUR-PASSWORD]` retiré** :
```
postgresql://postgres@db.<STAGING_PROJECT_REF>.supabase.co:5432/postgres
```
(sans le `:<password>`, juste `postgres@host`).

**Pooler Transaction** (pour Phase C `DATABASE_URL`) — Supabase te donne :
```
postgresql://postgres.<STAGING_PROJECT_REF>:[YOUR-PASSWORD]@aws-0-eu-central-2.pooler.supabase.com:6543/postgres
```
→ Pour `DATABASE_URL` du backend, il faudra convertir en `postgresql+asyncpg://...` et injecter le password. Phase C gère cette étape.

### B.2.c — Checklist B.2

- [ ] `STAGING_PROJECT_REF` noté
- [ ] `STAGING_DB_URL_DIRECT` noté au format **sans password** (ex: `postgresql://postgres@db.<ref>.supabase.co:5432/postgres`)
- [ ] `STAGING_SERVICE_KEY`, `STAGING_ANON_KEY`, `STAGING_JWT_SECRET` notés dans gestionnaire de mots de passe (pour Phase C)
- [ ] `STAGING_DB_URL_POOLER` noté (pour Phase C)
- [ ] Le `STAGING_DB_PW` (généré en B.1.b) est toujours copié dans gestionnaire de mots de passe

---

## 4. Sous-étape B.3 — Charger `STAGING_DB_PW` dans le shell

Pattern identique à `PROD_DB_PW` de Phase A : le password ne transite **jamais** par le clipboard ni par l'historique bash. Il entre via `read -s` (silencieux), reste en RAM shell jusqu'au `unset` de fin de Phase B.

```bash
# Saisir le password staging (copier depuis gestionnaire, coller, Enter)
read -s STAGING_DB_PW

# Vérifier sans exposer le password
test -n "$STAGING_DB_PW" && echo "STAGING_DB_PW : set (length=${#STAGING_DB_PW})" || echo "STAGING_DB_PW : NOT SET — STOP"

# Définir STAGING_DB_URL_DIRECT — remplace <STAGING_PROJECT_REF> par la vraie valeur
STAGING_DB_URL_DIRECT="postgresql://postgres@db.<STAGING_PROJECT_REF>.supabase.co:5432/postgres"
echo "STAGING_DB_URL_DIRECT : $STAGING_DB_URL_DIRECT"
```

### Validation B.3

- [ ] `STAGING_DB_PW : set (length=32)` (ou la longueur réelle du password Supabase, typiquement 24-40)
- [ ] `STAGING_DB_URL_DIRECT` contient le `STAGING_PROJECT_REF` à la bonne place, sans password dans la chaîne
- [ ] Pas d'erreur affichée

### Smoke test connexion (lecture seule, avant toute écriture)

```bash
PGPASSWORD="$STAGING_DB_PW" psql "$STAGING_DB_URL_DIRECT" -c "SELECT 1 AS ping, current_database(), current_user;"
```

**Attendu** :
```
 ping | current_database | current_user
------+------------------+--------------
    1 | postgres         | postgres
(1 row)
```

- [ ] `ping = 1` → connexion staging OK
- [ ] Pas de `password authentication failed`, pas de `connection refused`

**Si erreur** :
- `password authentication failed` → STAGING_DB_PW incorrect, re-charger via `read -s`
- `could not translate host name` → STAGING_PROJECT_REF mal saisi dans l'URL
- `connection refused` / timeout → projet staging pas encore Ready, attendre 30s et retry

---

## 5. Sous-étape B.4 — Restore des 3 dumps via `psql`

### B.4.a — Décision filtrage auth/storage : 3 options analysées

**Option A (retenue) — Filtrage `awk` local du dump data existant**

- **Avantages** : aucun contact prod supplémentaire (les dumps sont faits, on ne les régénère pas), déterministe depuis le dump déjà validé en Phase A, fichier intermédiaire `data-public-only.sql` inspectable avant restore
- **Inconvénients** : complexité awk (mais le pattern est simple, testé mentalement)
- **Mécanisme** : état machine à 2 variables (`in_copy`, `keep`), transition sur `^COPY "<schema>"\.`, arrêt sur `^\\\.$`. Lignes hors COPY filtrées séparément (ALTER TABLE / SELECT setval / SET search_path sur auth/storage)

**Option B (rejetée) — Restore complet puis `DROP SCHEMA auth CASCADE` + `DROP SCHEMA storage CASCADE`**

- **Pourquoi rejetée** : **cassera le projet staging**. Supabase exige que les schémas `auth` et `storage` existent pour que la plateforme fonctionne (Supabase Auth service, API REST, Storage API, dashboard SQL Editor, tout dépend de ces schémas). Un `DROP SCHEMA auth CASCADE` supprimerait `auth.users`, `auth.sessions`, `auth.refresh_tokens` etc. **ET** les tables référencées par les services internes Supabase. La "re-création via supabase" évoquée en amendement n'existe pas comme API publique : les schémas sont bootstrappés **une seule fois** à la création du projet, via un script d'init non exposé. La seule manière de les remettre en état serait de **supprimer puis recréer le projet staging** — ce qu'on fait déjà en rollback, donc autant ne jamais en arriver là.
- **Conclusion** : NE PAS utiliser cette approche. Documenté ici pour qu'on n'y revienne pas en cas de relecture dans 6 mois.

**Option C (fallback) — Re-dump prod avec `--schema public` explicite**

- **Avantages** : pas d'awk, trust le CLI flag
- **Inconvénients** : nouveau contact prod, nécessite `PROD_DB_PW` à re-charger, nécessite Docker running, risque que `--schema public` + `--data-only` ignore le flag schema comme observé en Phase A (même bug probablement)
- **Quand utiliser** : si l'Option A pose problème post-filtrage (fichier filtré corrompu, sémantique divergente)

**Décision retenue pour cette Phase B : Option A (awk filter)**.

### B.4.b.1 — Dry-run awk sur extrait (validation de la logique avant vrai run)

Avant de filtrer le fichier data complet (~169 KB), on teste l'awk sur un extrait de 500 lignes. Objectif : valider que le state machine filtre correctement les COPY `public`/`auth`/`storage` sur un petit volume avant de l'appliquer au fichier complet.

**Étape 1 — Extraire les 500 premières lignes** :

```bash
head -500 "${PREFIX}-data.sql" > /tmp/dump-extract.sql
wc -l /tmp/dump-extract.sql
# Attendu : 500 /tmp/dump-extract.sql
```

**Étape 2 — Lancer l'awk filter sur l'extrait** :

```bash
awk '
  /^COPY "public"\./ { in_copy = 1; keep = 1; print; next }
  /^COPY "auth"\./ { in_copy = 1; keep = 0; next }
  /^COPY "storage"\./ { in_copy = 1; keep = 0; next }
  in_copy && /^\\\.$/ {
    if (keep) print
    in_copy = 0; keep = 0
    next
  }
  in_copy {
    if (keep) print
    next
  }
  /^ALTER TABLE ONLY "(auth|storage)"\./ { next }
  /^SELECT pg_catalog\.setval\([^)]*"(auth|storage)"\./ { next }
  { print }
' /tmp/dump-extract.sql > /tmp/dump-extract-public-only.sql
```

**Étape 3 — Comparer counts avant / après sur l'extrait** :

```bash
echo "=== EXTRACT COUNTS BEFORE FILTER (/tmp/dump-extract.sql) ==="
echo "public  : $(grep -cE '^COPY \"public\"\.'  /tmp/dump-extract.sql)"
echo "auth    : $(grep -cE '^COPY \"auth\"\.'    /tmp/dump-extract.sql)"
echo "storage : $(grep -cE '^COPY \"storage\"\.' /tmp/dump-extract.sql)"

echo "=== EXTRACT COUNTS AFTER FILTER (/tmp/dump-extract-public-only.sql) ==="
echo "public  : $(grep -cE '^COPY \"public\"\.'  /tmp/dump-extract-public-only.sql)"
echo "auth    : $(grep -cE '^COPY \"auth\"\.'    /tmp/dump-extract-public-only.sql)"
echo "storage : $(grep -cE '^COPY \"storage\"\.' /tmp/dump-extract-public-only.sql)"

echo "=== SANITY : terminators \\. présents proportionnellement ==="
echo "terminators extract       : $(grep -cE '^\\\\\\.$' /tmp/dump-extract.sql)"
echo "terminators extract-filt  : $(grep -cE '^\\\\\\.$' /tmp/dump-extract-public-only.sql)"
# Le 2e count doit être égal au count 'public' du filtered (un terminator par COPY public gardé)
```

**Attendus dry-run** :
- `public` **avant** filter : peut être 0 dans les 500 premières lignes (le dump commence souvent par `auth.*` qui vient alphabétiquement avant `public.*` dans pg_dump — à observer)
- `auth` **avant** filter : probablement ≥ 1 (le dump commence typiquement par auth.users)
- `storage` **avant** filter : probablement 0 (vient après public alphabétiquement, donc pas dans les premières lignes)
- **`auth` après filter : 0** ✅ (critique — c'est la preuve que le filtre marche)
- **`public` après filter : identique à avant** (rien ne doit disparaître côté public)
- **`storage` après filter : 0** ✅

**Signaux STOP immédiat (dry-run invalide)** :
- `public` count qui diminue après filter → filtre trop agressif, awk bug
- `auth` ou `storage` count > 0 après filter → filtre trop permissif, awk bug
- Terminators après filter ≠ count COPY public après filter → COPY block incomplet (header gardé sans data, ou vice versa)

**Variante si 500 lignes n'ont pas assez de diversité** :

Si ton extrait ne contient aucun `COPY "auth"\.` (les 500 premières lignes n'incluent pas de COPY auth), étendre à 5000 lignes pour avoir un échantillon plus riche :

```bash
head -5000 "${PREFIX}-data.sql" > /tmp/dump-extract.sql
# puis refaire étapes 2 et 3
```

**Étape 4 — Cleanup des fichiers temporaires** :

```bash
rm /tmp/dump-extract.sql /tmp/dump-extract-public-only.sql
ls /tmp/dump-extract*.sql 2>/dev/null && echo "STOP: cleanup failed" || echo "cleanup OK"
```

**Étape 5 — Feu vert pour B.4.b.2** :

Ne passer en B.4.b.2 (awk sur fichier complet) **que si** les 3 critères dry-run sont validés :
- `auth` et `storage` counts après filter = 0
- `public` count après filter inchangé
- Terminators après filter cohérents avec nombre de COPY public

Si un seul de ces critères casse → STOP+remontée avec outputs bruts avant/après. Ne pas lancer B.4.b.2.

### B.4.b.2 — Générer le dump data filtré complet (sur fichier entier)

Après validation dry-run OK, lancer l'awk sur le fichier complet.

```bash
# PREFIX doit être set (voir B.1.0 vars check)
echo "Filtrage $PREFIX-data.sql → $PREFIX-data-public-only.sql"

awk '
  # COPY block sur public.* : on garde tout (header, data, terminator)
  /^COPY "public"\./ { in_copy = 1; keep = 1; print; next }
  # COPY block sur auth.* ou storage.* : on skip tout jusqu'\''au terminator
  /^COPY "auth"\./ { in_copy = 1; keep = 0; next }
  /^COPY "storage"\./ { in_copy = 1; keep = 0; next }
  # Terminator de COPY block
  in_copy && /^\\\.$/ {
    if (keep) print
    in_copy = 0; keep = 0
    next
  }
  # Lignes de data à l'\''intérieur d'\''un COPY block
  in_copy {
    if (keep) print
    next
  }
  # Hors COPY : filtrer ALTER TABLE ONLY auth/storage et SELECT setval auth/storage
  /^ALTER TABLE ONLY "(auth|storage)"\./ { next }
  /^SELECT pg_catalog\.setval\([^)]*"(auth|storage)"\./ { next }
  # Par défaut : garder (SET preamble, commentaires, ALTER TABLE public.*, SELECT setval public.*)
  { print }
' "${PREFIX}-data.sql" > "${PREFIX}-data-public-only.sql"

echo "Done."
ls -lh "${PREFIX}-data-public-only.sql"
```

### B.4.c — Valider le dump filtré AVANT restore

```bash
# Counts COPY par schéma — on veut public seulement
echo "=== Counts COPY (doit être 70 public / 0 auth / 0 storage) ==="
echo "public  : $(grep -cE '^COPY \"public\"\.'  "${PREFIX}-data-public-only.sql")"
echo "auth    : $(grep -cE '^COPY \"auth\"\.'    "${PREFIX}-data-public-only.sql")"
echo "storage : $(grep -cE '^COPY \"storage\"\.' "${PREFIX}-data-public-only.sql")"

# alembic_version toujours présent ?
echo "=== alembic_version value ==="
grep -A2 '^COPY "public"\."alembic_version"' "${PREFIX}-data-public-only.sql"
# Attendu : 3 lignes : COPY header, 0028, \.

# Lignes ALTER TABLE auth/storage résiduelles (doit être 0)
echo "=== ALTER TABLE auth/storage résiduels (doit être 0) ==="
grep -cE '^ALTER TABLE ONLY "(auth|storage)"\.' "${PREFIX}-data-public-only.sql"

# SELECT setval auth/storage résiduels (doit être 0)
echo "=== SELECT setval auth/storage résiduels (doit être 0) ==="
grep -cE '^SELECT pg_catalog\.setval\([^)]*"(auth|storage)"\.' "${PREFIX}-data-public-only.sql"

# Taille attendue : plus petite que data.sql original (on a viré 22+7 = 29 COPY blocks + lignes auxiliaires)
ls -lh "${PREFIX}-data.sql" "${PREFIX}-data-public-only.sql"
```

**Attendus** :
- `public` count : **70** (identique à Phase A)
- `auth` count : **0**
- `storage` count : **0**
- alembic_version value : toujours `0028`
- ALTER TABLE auth/storage résiduels : **0**
- SELECT setval auth/storage résiduels : **0**
- Taille : `data-public-only.sql` < `data.sql` (typiquement -20% à -40%)

**Si un de ces checks diverge** → STOP, awk filter buggy, me le signaler avec les outputs bruts.

### B.4.d — Restore dans l'ordre : roles → schema → data-public-only

Chaque psql utilise `ON_ERROR_STOP=1` (protocole strict Phase 0 amendement #3).

```bash
# 1. ROLES — peut générer des warnings bénins sur les rôles système pré-provisionnés
echo "=== Restore roles.sql ==="
PGPASSWORD="$STAGING_DB_PW" psql "$STAGING_DB_URL_DIRECT" -v ON_ERROR_STOP=1 -f "${PREFIX}-roles.sql"
```

**Attendu roles.sql** :
- Exécution rapide (<2 sec, fichier fait 297 B)
- Si tu vois `SET` et `RESET` qui s'exécutent + 3 `ALTER ROLE` OK → ✅
- Si tu vois `ERROR:  role "xxx" does not exist` → **STOP**, whitelist Phase 0 amendement #3 s'applique : vérifie que `xxx` est dans la liste (`postgres`, `authenticator`, `anon`, `authenticated`, `service_role`, `supabase_admin`, `dashboard_user`, `pgbouncer`). Si hors whitelist → **STOP+remontée**, ne pas enchaîner.

  **Note** : le dump roles Phase A ne contient QUE 3 `ALTER ROLE SET statement_timeout` sur `anon`, `authenticated`, `authenticator`. Tous dans la whitelist. Tous déjà pré-provisionnés côté staging. L'`ALTER ROLE` sur un rôle existant ne devrait PAS lever d'erreur, juste modifier le setting. Probabilité d'erreur sur ce fichier : **faible**.

```bash
# 2. SCHEMA — le gros morceau, crée 69 tables + 175 index + 32 enums
echo "=== Restore schema.sql ==="
PGPASSWORD="$STAGING_DB_PW" psql "$STAGING_DB_URL_DIRECT" -v ON_ERROR_STOP=1 -f "${PREFIX}-schema.sql"
```

**Attendu schema.sql** :
- Exécution 10-30 secondes
- Sortie : une liste de `CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX`, `CREATE TYPE`, etc. Chacun produit une ligne `CREATE TABLE` ou `CREATE INDEX` ou équivalent en output psql (en mode par défaut, psql ne dit rien en cas de succès, seulement les erreurs)
- **Si tu vois une erreur** → STOP+remontée avec l'erreur complète. Candidats fréquents :
  - `ERROR:  extension "xxx" is not available` → staging n'a pas certaines extensions Postgres installées par défaut. Prod peut en avoir plus (ex: `pgvector`, `pg_cron`, `pg_net`, `pgsodium`, `vault`). On avisera au cas par cas.
  - `ERROR:  schema "public" already has table "xxx"` → peu probable (staging est vierge), mais si ça arrive c'est que le projet staging n'est pas vierge. STOP.
  - `ERROR:  relation "xxx" already exists` → idem.

```bash
# 3. DATA (filtré public-only)
echo "=== Restore data-public-only.sql ==="
PGPASSWORD="$STAGING_DB_PW" psql "$STAGING_DB_URL_DIRECT" -v ON_ERROR_STOP=1 -f "${PREFIX}-data-public-only.sql"
```

**Attendu data-public-only.sql** :
- Exécution 2-10 secondes (petit volume de data)
- Sortie : série de `COPY N` où N est le nombre de lignes par table
- Somme des N ≈ ~200-500 lignes de data total
- **Si tu vois une erreur** → STOP+remontée. Candidats fréquents :
  - `ERROR:  duplicate key value violates unique constraint` → staging avait déjà des données (anormal sur projet vierge)
  - `ERROR:  insert or update on table violates foreign key constraint` → FK target manquante (anormal, schema.sql doit tout créer avant)

### B.4.e — Housekeeping fin B.4

**Ne pas encore** unset `STAGING_DB_PW` ni `PGPASSWORD` — on en a besoin pour B.5. On les purgera en fin de phase globale.

---

## 6. Sous-étape B.5 — Validation post-restore

Toutes les requêtes SQL ci-dessous utilisent des identifiants SQL standards (non-quoted, lowercase). Les guillemets doubles concernent uniquement les patterns grep **sur fichiers de dump**, pas les requêtes SQL live.

### B.5.0 — Checkpoint rapide (go / no-go avant checks détaillés)

Avant de faire les 8 checks détaillés B.5.1 à B.5.8, un checkpoint éclair qui matche les 5 valeurs clés observées côté prod en Phase A. Si une diverge, STOP immédiat — pas la peine de continuer les vérifs si les fondations sont fausses.

```bash
PGPASSWORD="$STAGING_DB_PW" psql "$STAGING_DB_URL_DIRECT" -c "
SELECT
  (SELECT COUNT(*) FROM public.biens)              AS biens,
  (SELECT COUNT(*) FROM public.properties)         AS properties,
  (SELECT COUNT(*) FROM public.users)              AS users,
  (SELECT COUNT(*) FROM public.contracts)          AS contracts,
  (SELECT version_num FROM public.alembic_version) AS alembic;
"
```

**Attendu exact** :

| Colonne | Valeur attendue |
|---------|----------------:|
| `biens` | **3** |
| `properties` | **2** |
| `users` | **4** |
| `contracts` | **0** |
| `alembic` | **0028** |

- **Les 5 valeurs matchent** → ✅ enchaîner B.5.1
- **Une divergence** → ⛔ STOP+remontée. Colle-moi les 5 valeurs observées, on diagnostique avant d'aller plus loin. Causes probables :
  - awk filter a mangé une table qu'il ne fallait pas (ex. `public.users` si le pattern a matché mal)
  - rollback silencieux d'une transaction restore (vérifier les logs psql)
  - table existante mais vide à cause d'un `TRUNCATE CASCADE` inattendu

### B.5.1 — Smoke basique

```bash
PGPASSWORD="$STAGING_DB_PW" psql "$STAGING_DB_URL_DIRECT" -c "
SELECT 1 AS ping, current_database(), current_user, version();
"
```
- [ ] `ping = 1`
- [ ] `current_database = postgres`
- [ ] `current_user = postgres`
- [ ] `version` : PostgreSQL 17.6.x (doit matcher prod)

### B.5.2 — alembic_version identique à prod (vérif formelle, redondant avec B.5.0)

```bash
PGPASSWORD="$STAGING_DB_PW" psql "$STAGING_DB_URL_DIRECT" -c "
SELECT version_num FROM alembic_version;
"
```
- [ ] Une seule ligne, **`0028`**
- [ ] Si autre valeur → STOP+remontée. On s'attend strictement à 0028, pas 0029 pré-appliqué ni autre.

### B.5.3 — Counts lignes identiques à prod (Phase A baseline, formel avec table)

```bash
PGPASSWORD="$STAGING_DB_PW" psql "$STAGING_DB_URL_DIRECT" -c "
SELECT
  (SELECT count(*) FROM public.users)            AS users,
  (SELECT count(*) FROM public.biens)            AS biens,
  (SELECT count(*) FROM public.properties)       AS properties,
  (SELECT count(*) FROM public.contracts)        AS contracts,
  (SELECT count(*) FROM public.alembic_version)  AS alembic_version;
"
```

| Colonne | Attendu (baseline Phase A) |
|---------|---------------------------:|
| `users` | **4** |
| `biens` | **3** |
| `properties` | **2** |
| `contracts` | **0** |
| `alembic_version` | **1** |

- [ ] Tous les counts identiques → ✅
- [ ] Un count diverge → STOP+remontée. Possible cause : le filtre awk a mangé une table qu'il ne fallait pas, ou le dump d'origine n'a pas tout capturé.

### B.5.4 — Tables cibles de la migration 0029 présentes

La migration 0029 va toucher 16 tables / relations. On vérifie qu'elles existent toutes côté staging avant de la jouer.

```bash
PGPASSWORD="$STAGING_DB_PW" psql "$STAGING_DB_URL_DIRECT" -c "
SELECT table_name
  FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name IN (
     'biens', 'properties', 'property_images', 'property_documents',
     'contracts', 'quotes', 'listings', 'inspections', 'missions',
     'rfqs', 'transactions', 'crm_contacts', 'crm_notes',
     'commissions', 'sale_mandates', 'alembic_version'
   )
 ORDER BY table_name;
"
```
- [ ] **16 lignes** retournées
- [ ] Si < 16 → STOP+remontée, identifier les tables manquantes

### B.5.5 — Enums legacy présents (seront droppés par 0029)

```bash
PGPASSWORD="$STAGING_DB_PW" psql "$STAGING_DB_URL_DIRECT" -c "
SELECT typname
  FROM pg_type
 WHERE typname IN (
   'property_type_enum',
   'property_status_enum',
   'property_document_type_enum',
   'parking_type_enum'
 )
 ORDER BY typname;
"
```
- [ ] **3 lignes** (les 3 enums legacy). PAS de `parking_type_enum` (sera créé par 0029).
- [ ] Si 4 lignes (parking_type_enum déjà là) → STOP+remontée (migration 0029 peut avoir été partiellement appliquée)
- [ ] Si < 3 lignes → STOP+remontée (schéma prod incomplet)

### B.5.6 — FK `property_id` présentes sur les 11 tables à renommer

La migration 0029 renomme `property_id → bien_id` sur 11 tables. On vérifie qu'elles ont bien la colonne `property_id` à l'état pré-0029.

```bash
PGPASSWORD="$STAGING_DB_PW" psql "$STAGING_DB_URL_DIRECT" -c "
SELECT table_name, column_name
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND column_name = 'property_id'
 ORDER BY table_name;
"
```
- [ ] **11 lignes** : `commissions`, `contracts`, `crm_contacts`, `crm_notes`, `inspections`, `listings`, `missions`, `quotes`, `rfqs`, `sale_mandates`, `transactions`
- [ ] Si différent, STOP+remontée

### B.5.7 — RLS (optionnel, ne bloque pas Phase B)

```bash
PGPASSWORD="$STAGING_DB_PW" psql "$STAGING_DB_URL_DIRECT" -c "
SELECT schemaname, tablename, rowsecurity
  FROM pg_tables
 WHERE schemaname = 'public' AND rowsecurity = true
 ORDER BY tablename;
"
```

- Note : sur staging fraîchement restauré, RLS peut ou non être activé selon si `schema.sql` a capturé les `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. À titre informatif — la migration 0029 ne touche pas aux policies RLS, donc pas bloquant.
- Colle la liste dans ton livrable final, pour référence.

### B.5.8 — Housekeeping variables sensibles

**À exécuter uniquement quand B.5 est complètement validée** :

```bash
# Purge des vars sensibles en RAM shell
unset PGPASSWORD
unset STAGING_DB_PW
# PROD_DB_PW est déjà inutile depuis Phase A, mais par sécurité :
unset PROD_DB_PW

# Vérifier que les 3 sont bien unset
echo "PGPASSWORD    : '${PGPASSWORD-UNSET}'"
echo "STAGING_DB_PW : '${STAGING_DB_PW-UNSET}'"
echo "PROD_DB_PW    : '${PROD_DB_PW-UNSET}'"
# Attendu : UNSET UNSET UNSET
```

- [ ] Les 3 vars affichent `UNSET`

---

## 7. Rollback Phase 20.1.B

Si la staging est corrompue, ou si on veut repartir de zéro, ou si on est bloqué sur une anomalie :

### B.R.a — Suppression propre du projet staging

1. Dashboard Supabase → projet staging (`althy-staging-20260424`)
2. **Project Settings → General → scroll bottom → Delete project**
3. Taper le nom du projet pour confirmer
4. Cliquer Delete

**Conséquences** :
- Projet staging supprimé entièrement (schema, data, auth, storage, tout)
- Aucun impact sur prod
- Les dumps Phase A restent intacts dans `backups/`
- On peut refaire B.1 avec un nouveau nom (ex: `althy-staging-20260424-b`) si besoin de retry

### B.R.b — Rollback partiel (garder projet, re-restore)

Si seule une partie du restore a foiré et qu'on veut re-tenter :

```bash
# 1. TRUNCATE tout dans public (pas auth ni storage, qui restent Supabase-managed)
PGPASSWORD="$STAGING_DB_PW" psql "$STAGING_DB_URL_DIRECT" <<'SQL'
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
  END LOOP;
END $$;
SQL

# 2. DROP tout ce qui est non-table dans public (enums, fonctions, etc.)
# Attention : cette opération est drastique. Préférer B.R.a (re-création projet) pour partir vraiment propre.
```

**Recommandation** : en cas de gros doute, rollback complet via B.R.a plutôt que partiel. Le provisioning Supabase prend 3 minutes, ce n'est pas long.

---

## 8. Livrable attendu de Killian après Phase B

À remonter à Claude avant de lancer Phase 20.2 (migration 0029 sur staging).

1. **Confirmation projet staging créé** : `STAGING_PROJECT_REF = <20-chars-ref>`
2. **Région staging** : attendu `eu-central-2` (identique prod)
3. **Résultat B.5.0** (checkpoint 5 valeurs) : biens=3, properties=2, users=4, contracts=0, alembic=0028
4. **Résultat B.5.1** (smoke) : `ping = 1`, PostgreSQL version
5. **Résultat B.5.2** (alembic formel) : `version_num = 0028`
6. **Résultat B.5.3** (counts formels avec table) : identique B.5.0 (cohérence)
7. **Résultat B.5.4** : 16 tables cibles présentes
8. **Résultat B.5.5** : 3 enums legacy présents, 0 parking_type_enum
9. **Résultat B.5.6** : 11 FK `property_id` présentes
10. **Résultat B.5.8** (housekeeping) : 3 vars sensibles unset
10. **Housekeeping dump filtré** : `ls -lh "${PREFIX}-data-public-only.sql"` taille observée

**NE PAS coller dans le chat** : `STAGING_SERVICE_KEY`, `STAGING_JWT_SECRET`, `STAGING_DB_PW`, `STAGING_DB_URL_DIRECT` avec password. Claude n'a besoin que des confirmations de validation + le project ref public.

---

## Récap "à NE PAS toucher en Phase B"

- Frontend (`.env.local`, Vercel) : intouchés
- Backend prod (Railway) : intouché
- Backend local `.env` : intouché en Phase B (switch prod→staging = Phase C séparée)
- Schéma prod Supabase : intouché (on a juste dumpé en lecture en Phase A)
- Données prod Supabase : intouchées

Tout ce qui bouge en Phase B est **soit le nouveau projet staging** soit le **fichier local filtré `data-public-only.sql`**.

---

## Notes finales pour reprise à froid

Si cette procédure est relue demain matin (ou dans 6 mois) :

- **Phase A doit être terminée** avant Phase B. Les 3 dumps doivent être dans `backups/`. Voir `phase-20-1-A-bilan.md` pour l'état à la fin de Phase A.
- **Phase B est réversible** en 1 clic (Delete project). Aucune action Phase B ne modifie la prod.
- **Phase C** (doc séparé, pas encore rédigé) — switch du backend local `.env` vers staging. À faire après validation B complète.
- **Phase 20.2** — lancement de la migration alembic 0029 sur staging. À faire après Phase C.
- **Phase 20.4** — migration 0029 sur prod. Protocole strict, feu vert explicite requis, pas avant validation 20.2 + 20.3.

---

*Procédure rédigée en session 8, 2026-04-24, après validation Phase 20.1.A. Intègre les 3 amendements post-A : filtrage auth/storage (Option A awk), distinction PROD_DB_PW / STAGING_DB_PW (var séparée via `read -s` + `PGPASSWORD`), patterns grep avec guillemets doubles (pg_dump 17.6 format).*
