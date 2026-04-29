# Étape 20.1 — Backup prod + création staging + prépa env local

> **Session 8, 2026-04-24**
> **Cible migration** : alembic **0029 `fusion_properties_biens_complete`** (destructive : TRUNCATE biens + properties + DROP 2 tables + DROP 3 enums + ADD 29 colonnes + renommages FK + 2 seeds).
> **Hors scope** : supabase-cli 0029 `pricing_v2_starter_agence` (déjà en prod).
> **Approche retenue** : CLI Supabase (`supabase db dump` en multi-fichiers + `psql` pour restore) — feature UI "Restore to new project" abandonnée.

---

## Différences entre ma mémoire et la doc Supabase live

Vérifications faites via WebFetch sur `supabase.com/docs/reference/cli/supabase-db-dump` et `.../supabase-db-push` :

| Point | Mémoire (avant WebFetch) | Doc officielle 2026 | Conséquence |
|-------|--------------------------|---------------------|-------------|
| Restore dump vers nouveau projet | `supabase db push` | **NON — `db push` sert uniquement aux migrations `supabase/migrations/`**. Restore = `psql` direct. | Procédure ci-dessous utilise `psql`. |
| Schemas inclus par défaut dans `db dump` | Tous | **Seulement `public` — `auth`, `storage` et schemas d'extensions sont EXCLUS**. Il faut `--schema auth,storage` explicite pour les inclure. | Procédure ci-dessous fait 3 dumps séparés (roles + schema public + data public) — pas d'inclusion auth pour cette session car la migration 0029 ne dépend pas des users auth. |
| Roles du cluster | Inclus dans dump standard | **Exclu — nécessite `--role-only` dans un dump séparé**. | Dump séparé `--role-only`. |

---

## Cartographie config Supabase — source de vérité

### Backend — `backend/.env` (local) + Railway (prod)

Variables **effectivement présentes** dans `backend/.env` (vérifié via `awk -F= '/^[A-Z_]+=/{print $1}' .env | sort -u`) :

| Variable | Usage |
|----------|-------|
| `DATABASE_URL` | Connexion SQLAlchemy/alembic, format `postgresql+asyncpg://...` |
| `SUPABASE_URL` | SDK Supabase Admin (python) |
| `SUPABASE_SERVICE_KEY` | JWT service_role (pouvoir admin bypass RLS) |
| `SUPABASE_JWT_SECRET` | Valide les tokens Supabase côté backend |

**Note** : `SUPABASE_ANON_KEY` est **ABSENT** de `backend/.env` (le settings dans `config.py` tolère ça via `SUPABASE_ANON_KEY: str = ""`). Le backend n'utilise pas la anon key. → **4 vars à switcher**, pas 5.

Aucune valeur hardcodée : `grep -rn "SUPABASE" backend/app/` montre que tous les usages passent par `settings.SUPABASE_*` ou `os.environ`.

### Frontend — `frontend/.env.local` (local) + Vercel (prod)

| Variable | Usage |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client browser + SSR + middleware |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem |

**On ne touche PAS le frontend ce soir** — le frontend reste pointé sur prod. On ne veut pas d'utilisateurs (ni réels, ni soi-même via le navigateur) sur la DB staging pendant qu'on joue la migration.

### Railway (backend prod) et Vercel (frontend prod)

**Intouchables ce soir.** On ne modifie que le `.env` local pour basculer en staging.

---

# PHASE 20.1.A — Backup dump prod LOCAL (filet de sécurité rollback)

> **Ce dump est utile MÊME si on saute la phase staging**. Le docstring de la migration 0029 exige un backup préalable "à télécharger manuellement AVANT l'exécution". C'est le filet rollback si la migration prod casse quelque chose.

## Prérequis

- [ ] Supabase CLI installé (≥ 1.100, version 2026 recommandée)
  ```bash
  supabase --version
  ```
  Si absent : `scoop install supabase` (Windows), `brew install supabase/tap/supabase` (mac), ou `npm i -g supabase`
- [ ] Docker Desktop lancé (le CLI exécute `pg_dump` dans un container)
  ```bash
  docker info >/dev/null 2>&1 && echo "docker OK" || echo "docker KO"
  ```
- [ ] Espace disque local ≥ 500 MB libres (le dump prod fait quelques MB seulement — 2 properties + 3 biens — mais on prévoit large)
- [ ] Supabase Access Token disponible
  ```bash
  supabase login    # ouvre un navigateur si pas déjà authentifié
  ```
- [ ] Project ref prod noté : `<PROD_PROJECT_REF>` (visible dans URL dashboard `/project/<ref>`)
- [ ] Password DB prod noté (à récupérer dans **Project Settings → Database → Database password** — c'est le mot de passe du user `postgres`, pas le password du compte Supabase)
- [ ] Aucune migration alembic en cours côté prod. Vérifier en prod (Supabase SQL Editor) :
  ```sql
  SELECT version_num FROM alembic_version;
  ```
  **Attendu : `0028`**. Si autre valeur → STOP, remonter à Claude.
- [ ] Dossier de sortie prêt :
  ```bash
  mkdir -p backups
  ```
- [ ] `.gitignore` couvre bien `backups/` (vérifier — sinon le dump sera tracké, ce qui serait un désastre côté secrets)
  ```bash
  grep -E '^(/)?backups/?' .gitignore || echo "NOT IGNORED — à ajouter"
  ```
  Si pas ignoré, ajouter une ligne `backups/` à `.gitignore` AVANT de dumper.

## Commandes exactes

**Depuis la racine du repo** (`C:\Users\Killan\immohub`), git bash :

```bash
# 1. Link le CLI sur le projet prod
supabase link --project-ref <PROD_PROJECT_REF>
# Si prompt de confirmation : taper Y

# 2. Préparer le timestamp et le préfixe de fichiers
TS=$(date +%Y-%m-%d-%H%M)
PREFIX="backups/prod-dump-${TS}"
echo "Dump prefix : $PREFIX"

# 3. Dump ROLES (cluster roles)
supabase db dump --linked -p "<PROD_DB_PASSWORD>" --role-only -f "${PREFIX}-roles.sql"

# 4. Dump SCHEMA (public, pas auth ni storage — défaut)
supabase db dump --linked -p "<PROD_DB_PASSWORD>" -f "${PREFIX}-schema.sql"

# 5. Dump DATA (public, COPY statements pour perfs, pas auth ni storage)
supabase db dump --linked -p "<PROD_DB_PASSWORD>" --data-only --use-copy -f "${PREFIX}-data.sql"
```

**Notes sur les flags utilisés** (confirmés via doc live 2026) :
- `--linked` : utilise le projet lié via `supabase link` (pas de `--db-url` manuel à construire)
- `-p <password>` : mot de passe DB prod, **évite le prompt interactif** (le terminal Claude n'est pas interactif)
- `-f <file>` : chemin de sortie (sans ce flag, écrit sur stdout)
- `--role-only` : dump cluster roles uniquement, exclut tables/data
- `--data-only` : dump data uniquement, exclut schema DDL
- `--use-copy` : utilise `COPY` au lieu de `INSERT` pour l'import (rapide, stream-friendly)
- Pas de `--schema auth,storage` : **décision assumée** pour cette session — la migration 0029 ne dépend que du schéma `public` + alembic_version. Inclure auth clonerait les users (potentiellement 0 users de toute façon en prod early), mais complique le restore (rôles auth.* spécifiques Supabase). On reste simple.

## Validation "après dump"

- [ ] Les 3 fichiers existent et sont non vides
  ```bash
  ls -lh backups/prod-dump-${TS}-*.sql
  # Attendu : 3 lignes, tailles typiques :
  #   roles.sql  :   1-10 KB
  #   schema.sql : 100-500 KB
  #   data.sql   :  10-200 KB (prod minimaliste)
  ```
- [ ] Premier et dernier statement lisibles de chaque fichier
  ```bash
  for f in backups/prod-dump-${TS}-*.sql; do
    echo "=== $f (head) ==="
    head -5 "$f"
    echo "=== $f (tail) ==="
    tail -5 "$f"
    echo
  done
  # Attendu schema.sql et data.sql : commencent par "-- Dumped from database..." ou un SET statement
  # Attendu roles.sql : commence par "CREATE ROLE ..." ou "SET ..."
  # Pas d'erreur "pg_dump: error:" dans les fichiers
  ```
- [ ] Count grep de cohérence (pas un dump vide)
  ```bash
  echo "CREATE TABLE  : $(grep -c 'CREATE TABLE'  backups/prod-dump-${TS}-schema.sql)"
  echo "ALTER TABLE   : $(grep -c 'ALTER TABLE'   backups/prod-dump-${TS}-schema.sql)"
  echo "CREATE INDEX  : $(grep -c 'CREATE INDEX'  backups/prod-dump-${TS}-schema.sql)"
  echo "COPY (data)   : $(grep -c '^COPY '         backups/prod-dump-${TS}-data.sql)"
  echo "CREATE ROLE   : $(grep -c 'CREATE ROLE'   backups/prod-dump-${TS}-roles.sql)"
  ```
  Attendu (ordres de grandeur, pas exacts) :
  - `CREATE TABLE` : 30-60 (tables public)
  - `ALTER TABLE` : 50-200 (FKs, constraints)
  - `CREATE INDEX` : 20-80
  - `COPY (data)` : ≥ 10 (au moins quelques tables peuplées)
  - `CREATE ROLE` : 3-10 (roles Supabase + custom)

  Si tout est à 0 → STOP, le dump a foiré silencieusement. Investiguer (souvent : Docker pas lancé, ou password faux).

- [ ] Vérifier que la version alembic est bien figée dans le dump
  ```bash
  grep -A2 'alembic_version' backups/prod-dump-${TS}-data.sql | head -10
  ```
  Attendu : une ligne `COPY public.alembic_version ...` suivie de `0028`.

## Rollback (= usage) du dump

Ce dump EST le rollback. En cas de sinistre sur prod après migration 0029 :
```bash
# Attention : OVERRIDE TOTAL — à faire uniquement en dernier recours
psql "postgresql://postgres:<PASSWORD>@<prod-host>/postgres" < backups/prod-dump-<TS>-roles.sql
psql "postgresql://postgres:<PASSWORD>@<prod-host>/postgres" < backups/prod-dump-<TS>-schema.sql
psql "postgresql://postgres:<PASSWORD>@<prod-host>/postgres" < backups/prod-dump-<TS>-data.sql
```

**Aucun rollback à exécuter ici-même en Phase 20.1.A** — on ne fait que créer le filet, on ne l'utilise pas.

---

# PHASE 20.1.B — Création projet staging + restore dump

> Cette phase **inclut une étape UI** (création d'un projet Supabase neuf via le dashboard). C'est nécessaire pour obtenir `<STAGING_PROJECT_REF>` + les API keys. Un projet vierge ne présente aucun risque.

## Prérequis

- [ ] Phase 20.1.A terminée, 3 fichiers dump présents et validés
- [ ] Région prod connue (ex. `eu-central-1`) — **à reproduire à l'identique** sur staging (évite différences Postgres selon région)
- [ ] Taille totale du dump connue (`ls -lh backups/prod-dump-${TS}-*.sql` → somme des 3 tailles)
- [ ] Quota "nombre de projets" Supabase de l'organisation ≥ actuels + 1
- [ ] Gestionnaire de mots de passe ouvert (tu vas générer un DB password staging à stocker)

## Étape B.1 — Créer le projet staging (UI dashboard)

Actions manuelles dans le dashboard Supabase :

- [ ] Dashboard → haut-gauche org → **New project**
- [ ] **Name** : `althy-staging-20260424`
- [ ] **Database Password** : générer un strong via le bouton "Generate a password", **copier immédiatement dans le gestionnaire de mots de passe**, coller aussi temporairement dans `.env.staging` qu'on prépare Phase 20.1.C
- [ ] **Region** : identique à prod (ex. `eu-central-1`)
- [ ] **Pricing Plan** : le plus petit qui convient (Free Plan = 500 MB DB, largement suffisant)
- [ ] Clic **Create new project** → attendre que le status passe "Ready" (2-3 min typique)

## Étape B.2 — Récupérer les credentials staging

Quand le projet est Ready, dans **Project Settings** :

| Chercher dans | Valeur à noter | Usage |
|---------------|----------------|-------|
| General → Reference ID | `<STAGING_PROJECT_REF>` | CLI + conversions URL |
| API → Project URL | `https://<STAGING_PROJECT_REF>.supabase.co` | `SUPABASE_URL` |
| API → Project API keys → `anon` public | `eyJhbGci...` | (info — pas utilisé par le backend) |
| API → Project API keys → `service_role` | `eyJhbGci...` | `SUPABASE_SERVICE_KEY` (⚠️ secret, bypass RLS) |
| API → JWT Settings → JWT Secret | `<jwt-secret>` | `SUPABASE_JWT_SECRET` |
| Database → Connection string (URI tab, **Session** mode, port 5432) | `postgresql://postgres:...@...` | Base pour `DATABASE_URL` (conversion ci-dessous) |

**Conversion `DATABASE_URL`** (le backend exige le driver asyncpg) :
```
Supabase te fournit : postgresql://postgres.<ref>:<PASSWORD>@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
Toi tu poses dans .env : postgresql+asyncpg://postgres.<ref>:<PASSWORD>@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```
(seul changement : `postgresql` → `postgresql+asyncpg`)

## Étape B.3 — Restore des 3 dumps via psql

Prérequis : `psql` disponible en ligne de commande (installé avec PostgreSQL client, ou via `scoop install postgresql` sur Windows).

```bash
# Vérifier psql
psql --version    # attendu : psql (PostgreSQL) 15.x ou 16.x

# Variable de commodité — URL de connexion staging (direct, port 5432, PAS le pooler 6543 pour le restore)
# Dans Project Settings → Database → Connection string → Direct connection (port 5432)
STAGING_URL="postgresql://postgres:<STAGING_DB_PASSWORD>@db.<STAGING_PROJECT_REF>.supabase.co:5432/postgres"

# Restore dans l'ordre : roles → schema → data
psql "$STAGING_URL" -v ON_ERROR_STOP=1 -f backups/prod-dump-${TS}-roles.sql
psql "$STAGING_URL" -v ON_ERROR_STOP=1 -f backups/prod-dump-${TS}-schema.sql
psql "$STAGING_URL" -v ON_ERROR_STOP=1 -f backups/prod-dump-${TS}-data.sql
```

**Notes** :
- `ON_ERROR_STOP=1` : la commande s'arrête à la première erreur SQL (pas de continue silencieux)
- Pour le restore on utilise le **port direct 5432** (pas le pooler 6543) — le pooler buffer les transactions longues bizarrement
- Ordre obligatoire : roles avant schema (schema référence des rôles), schema avant data (data référence des tables)

**Gestion des erreurs sur `roles.sql`** (protocole strict) :

- **Par défaut** : lancer avec `ON_ERROR_STOP=1`. Si ça passe direct → parfait, continuer avec schema.sql.
- **Si ça casse sur un `role "X" already exists`** : **STOP, NE PAS enchaîner sur `ON_ERROR_STOP=0` sans review manuelle**. Lire le message d'erreur : le nom du rôle X doit figurer dans la whitelist ci-dessous (rôles Supabase pré-provisionnés système). Sinon → STOP+remontée à Claude.

  **Whitelist rôles Supabase système (erreurs "already exists" acceptables)** :
  - `postgres`
  - `authenticator`
  - `anon`
  - `authenticated`
  - `service_role`
  - `supabase_admin`
  - `dashboard_user`
  - `pgbouncer`

- **Si et seulement si** toutes les erreurs vues sont des `role "X" already exists` avec X dans la whitelist ci-dessus, alors relancer `roles.sql` avec `-v ON_ERROR_STOP=0`. Noter explicitement dans le ping à Claude : "erreurs ignorées : <liste exhaustive des rôles incriminés>". Chaque rôle en dehors de la whitelist = STOP immédiat, aucune exception, on ne contourne pas.
- **Toute autre erreur** (autre message, autre type) = STOP+remontée avant de continuer. On ne force pas le passage en silence.

## Validation "après restore"

Dans **Supabase SQL Editor staging** (ou via psql) :

- [ ] Connectivité basique
  ```sql
  SELECT 1 AS ping;
  -- Attendu : ping=1
  ```
- [ ] Alembic version identique à prod
  ```sql
  SELECT version_num FROM alembic_version;
  -- Attendu : '0028'
  ```
- [ ] Counts lignes tables clés identiques à prod
  ```sql
  SELECT
    (SELECT count(*) FROM public.users)      AS users,
    (SELECT count(*) FROM public.biens)      AS biens,
    (SELECT count(*) FROM public.properties) AS properties,
    (SELECT count(*) FROM public.contracts)  AS contracts;
  -- Attendu selon prod (à comparer avec même requête côté prod) :
  -- biens : ~3, properties : ~2, contracts : ?, users : ?
  ```
  **Comparer point par point avec prod** — si divergence, STOP, investiguer.

- [ ] Tables-cibles de la migration 0029 présentes
  ```sql
  SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name IN (
       'biens', 'properties', 'property_images', 'property_documents',
       'contracts', 'quotes', 'listings', 'inspections', 'missions',
       'rfqs', 'transactions', 'crm_contacts', 'crm_notes',
       'commissions', 'sale_mandates', 'alembic_version'
     )
   ORDER BY table_name;
  -- Attendu : 16 lignes
  ```
- [ ] Enums legacy (seront droppés par 0029) présents
  ```sql
  SELECT typname FROM pg_type
   WHERE typname IN ('property_type_enum', 'property_status_enum',
                     'property_document_type_enum', 'parking_type_enum')
   ORDER BY typname;
  -- Attendu : 3 lignes (pas parking_type_enum — il sera créé par 0029)
  ```
- [ ] FK `property_id` présentes sur les tables à renommer
  ```sql
  SELECT table_name, column_name FROM information_schema.columns
   WHERE table_schema = 'public' AND column_name = 'property_id'
   ORDER BY table_name;
  -- Attendu : 11 lignes (contracts, quotes, listings, inspections, missions,
  --                       rfqs, transactions, crm_contacts, crm_notes,
  --                       commissions, sale_mandates)
  ```

## Rollback Phase 20.1.B

Si la staging est cassée ou inutile :
- Dashboard → staging project → Settings → General → **Delete project** (bouton rouge en bas)
- Aucun impact sur prod

---

# PHASE 20.1.C — Prépa env local pour pointer backend sur staging

> **Aucune modification Railway/Vercel ici**. On ne bascule que `backend/.env` en local, le temps de l'étape 20.2 (migration sur staging).

## Prérequis

- [ ] Phase 20.1.B terminée, credentials staging notés
- [ ] Terminal git bash ouvert, CWD = `C:\Users\Killan\immohub\backend`
- [ ] venv activé (`source venv/Scripts/activate`, `which python` → `.../backend/venv/Scripts/python`)

## Étape C.1 — Backup `.env` prod actuel

```bash
# Depuis backend/
cp .env .env.prod-backup
ls -la .env.prod-backup    # attendu : fichier existe, taille identique à .env
```

- [ ] `.env.prod-backup` présent et non vide
- [ ] **Ne PAS commit** ce fichier (il contient les secrets prod). Vérifier :
  ```bash
  grep -E '^(/)?(backend/)?\.env\.prod-backup' ../.gitignore || echo "NOT IGNORED"
  ```
  Si pas ignoré : ajouter une ligne `.env.prod-backup` dans `.gitignore` racine AVANT la suite.

## Étape C.2 — Préparer `.env.staging`

Créer un nouveau fichier `backend/.env.staging` avec **uniquement** les 4 variables Supabase modifiées, le reste copié-collé de `.env.prod-backup` :

```bash
cp .env.prod-backup .env.staging
# Puis éditer .env.staging avec un éditeur (pas echo > qui écrase)
```

Valeurs à remplacer dans `.env.staging` (les 4 seules — c'est vérifié dans la cartographie) :

| Variable | Source (depuis Phase 20.1.B) |
|----------|-------------------------------|
| `DATABASE_URL` | `postgresql+asyncpg://postgres.<STAGING_REF>:<STAGING_DB_PASS>@aws-0-<region>.pooler.supabase.com:6543/postgres` (mode pooler/Transaction, port 6543 pour l'app) |
| `SUPABASE_URL` | `https://<STAGING_REF>.supabase.co` |
| `SUPABASE_SERVICE_KEY` | staging service_role key (commence par `eyJ...`) |
| `SUPABASE_JWT_SECRET` | staging JWT Secret |

**Ne PAS modifier** : toutes les autres variables (`STRIPE_*`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `TWILIO_*`, `GOOGLE_*`, `SMTP_*`, `REDIS_URL`, `SECRET_KEY`, `APP_ENV`, etc.) — elles restent identiques à prod. On ne veut **pas** d'emails envoyés, pas de paiements, pas de SMS déclenchés depuis staging, mais la migration 0029 n'appelle aucun de ces services, donc aucun effet de bord attendu.

- [ ] `.env.staging` aussi dans `.gitignore` :
  ```bash
  grep -E '^(/)?(backend/)?\.env\.staging' ../.gitignore || echo "NOT IGNORED"
  ```

## Étape C.3 — Activer la config staging

```bash
# Depuis backend/
cp .env.staging .env
```

## Validation C — smoke connectivité DB staging

### C.a — Smoke import app (doit passer comme en Phase 0)

```bash
# venv activé, CWD = backend/
python -c "from app.main import app; print('OK routes:', len(app.routes))"
```
- [ ] Sortie : `OK routes: 321` (ou ≥ 321 — nombre de routes stable)
- [ ] Aucune erreur, aucun warning

### C.b — Vérifier que DATABASE_URL pointe bien sur staging (sans exposer le password)

```bash
python - <<'PY'
from app.core.config import settings
url = settings.DATABASE_URL
# Extraire seulement le host pour contrôle visuel, pas le password
import re
m = re.search(r'@([^:/]+)', url)
print("DB host:", m.group(1) if m else "UNKNOWN")
print("DB driver:", url.split(":", 1)[0])
print("SUPABASE_URL:", settings.SUPABASE_URL)
PY
```
- [ ] DB driver : `postgresql+asyncpg`
- [ ] DB host : contient `<STAGING_PROJECT_REF>` OU `aws-0-<region>.pooler.supabase.com` (si tu utilises le pooler — normal)
- [ ] SUPABASE_URL : contient `<STAGING_PROJECT_REF>.supabase.co`

Si un de ces 3 checks montre encore des valeurs prod → STOP, `.env` pas bien switché.

### C.c — Requête read-only sur staging via alembic

```bash
alembic current
```
- [ ] Sortie : `0028 (head)` ou `0028`
- [ ] Aucune erreur de connexion

Si erreur genre `connection refused` ou `password authentication failed` → staging mal configuré. Re-vérifier le DB password et le host.

## Rollback C — retour config prod

À tout moment, pour revenir sur prod :
```bash
cp .env.prod-backup .env
python -c "from app.main import app; print('back on prod, routes:', len(app.routes))"
# Re-vérifier le host :
python -c "from app.core.config import settings; import re; m=re.search(r'@([^:/]+)', settings.DATABASE_URL); print('DB host:', m.group(1))"
```
- [ ] DB host : valeur prod
- [ ] Routes comptent comme avant (321)

Aucun commit git à ce stade. Tous les fichiers `.env*` restent untracked.

---

# Livrables à envoyer à Claude avant étape 20.2

Quand les 3 phases sont terminées :

1. **Confirmation Phase 20.1.A** : les 3 fichiers dump existent, tailles cohérentes, counts grep OK, `alembic_version` contient bien `0028`
2. **Confirmation Phase 20.1.B** : projet staging créé, `<STAGING_PROJECT_REF>` renseigné, restore OK, `SELECT version_num FROM alembic_version` staging = `0028`, counts tables clés identiques à prod
3. **Confirmation Phase 20.1.C** : `backend/.env` = staging, smoke `from app.main import app` OK à 321 routes, `alembic current` = `0028`
4. **Région staging** : `<region>` (doit être la même que prod)

**Ne PAS partager dans le chat** :
- Les service_role keys (staging OU prod)
- Les DB passwords
- Les contenus de fichiers dump

Claude n'a besoin **que** des 4 confirmations ci-dessus pour préparer la commande alembic de l'étape 20.2.

---

# Récap "à NE PAS toucher ce soir"

- Frontend `.env.local` (reste prod)
- Railway (backend prod — reste prod)
- Vercel (frontend prod — reste prod)
- Schéma prod Supabase (intouché — on a juste dumpé en lecture)
- Données prod Supabase (intouchées)

Tout ce qui bouge ce soir est **local au poste de Killian** et **dans le nouveau projet staging**.

---

*Procédure rédigée en session 8, 2026-04-24. Migration cible : alembic 0029 `fusion_properties_biens_complete`. Approche : CLI Supabase + psql. Révisé post-WebFetch doc Supabase live.*
