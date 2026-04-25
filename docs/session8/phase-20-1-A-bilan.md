# Bilan Phase 20.1.A — Backup dump prod local

> Session 8 · 2026-04-24 · branche `refonte/fusion-properties-biens-complete`
> Exécutant : Killian Thébaud (Git Bash Windows)
> Doc de pilotage : `docs/session8/etape-20-1-backup-staging.md`
> Cible session : préparer un filet de sécurité rollback **avant** la migration alembic 0029 `fusion_properties_biens_complete`, en dumpant la prod Supabase en local.

---

## 1. Résumé exécutif

Phase 20.1.A **terminée avec succès**. Trois fichiers dump produits à 18h47 le 2026-04-24, total 616 KB (prod Althy très petite — 3 biens, 2 properties, 4 users, 0 contrats). `alembic_version` figé à `0028` dans le dump, conforme à l'état prod pré-0029.

Deux points à retenir avant Phase 20.1.B :
- **Le dump `--data-only` a inclus les schémas `auth` et `storage`** malgré la décision initiale de n'exporter que `public`. Conséquence : au restore, il FAUT filtrer pour ne restaurer que `public`, sinon conflits sur rôles pré-provisionnés du nouveau projet staging.
- **Le dump contient les hashes de passwords des 4 users auth prod**. Le dossier `backups/` contient désormais des données sensibles niveau prod, à nettoyer en fin de session 8.

---

## 2. Journal chronologique

Horaires approximatifs (heure locale).

| Heure | Étape | Résultat |
|-------|-------|----------|
| ~18h30 | Fix router session 8 (commit `3b49707`), Phase 0 checks A/C/D verts | ✅ |
| ~18h35 | Rédaction livrable `etape-20-1-backup-staging.md` (3 phases) | ✅ |
| ~18h40 | Validation par Killian + 3 tranchages (auth exclu, CLI only, ON_ERROR_STOP strict) | ✅ |
| ~18h42 | Bloc 1 — `supabase login` + `supabase link --project-ref <prod>` + `mkdir backups/` + MAJ `.gitignore` (section "Backups & dumps" : `backups/`, `*.sql.gz`, `prod-dump-*`) | ✅ |
| ~18h45 | Vérif `alembic_version` prod via SQL Editor → `0028` confirmé | ✅ |
| ~18h47 | Bloc 2 essai 1 — `supabase db dump --role-only` **échec** | ❌ |
| ~18h47 | Cause : contamination clipboard — le password collé contenait la chaîne `Password length: 52 chars"` (artefact d'un prior copy-paste depuis notes perso). L'auth Postgres a naturellement refusé. | — |
| ~18h48 | Correction : extraction du password via `grep`+`sed` directement depuis `DATABASE_URL` de `backend/.env` → variable shell `PROD_DB_PW` (14 chars). Zéro clipboard, zéro risque. | ✅ |
| ~18h48 | Bloc 2 essai 2 — dump roles OK (297 octets, 0 `CREATE ROLE`, 3 `ALTER ROLE`, 0 erreur). 0 CREATE ROLE est normal : Supabase gère les rôles système au niveau plateforme, `--role-only` ne capture que les modifications custom (ici : 3 `statement_timeout` sur `anon`/`authenticated`/`authenticator`). | ✅ |
| ~18h50 | Bloc 3 — dump schema OK (447 KB, 69 tables, 326 ALTER, 175 index, 32 enums, 0 erreur). Tous les checks sémantiques pré-0029 passent (`biens`, `properties`, `property_images`, `property_documents`, 3 enums legacy présents, `parking_type_enum` absent). | ✅ |
| ~18h52 | Bloc 4 — dump data OK (169 KB, 99 COPY, 0 INSERT, 0 erreur). `alembic_version` figé à `0028`, row counts conformes. | ✅ |
| ~18h55 | Phase 20.1.A clôturée, rédaction du présent bilan | ✅ |

---

## 3. Fichiers produits

Dossier : `backups/` (couvert par `.gitignore` — aucun de ces fichiers n'est tracké par git).

| Fichier | Taille | Contenu | Intégrité |
|---------|-------:|---------|-----------|
| `backups/prod-dump-2026-04-24-1847-roles.sql` | 297 B | 3 `ALTER ROLE ... SET statement_timeout` + 3 `SET` header pg_dump + `RESET ALL` | pg_dump exit 0, 0 erreur, fichier lisible head/tail |
| `backups/prod-dump-2026-04-24-1847-schema.sql` | 447 KB | 69 `CREATE TABLE IF NOT EXISTS` + 326 `ALTER TABLE` (FKs/contraintes) + 175 `CREATE INDEX` + 32 `CREATE TYPE` (enums) + 0 `CREATE FUNCTION` + 0 `CREATE TRIGGER` | pg_dump exit 0, 0 erreur, sémantique pré-0029 vérifiée |
| `backups/prod-dump-2026-04-24-1847-data.sql` | 169 KB | 99 `COPY` (22 auth + 70 public + 7 storage), 0 `INSERT` (grâce à `--use-copy`) | pg_dump exit 0, 0 erreur, `alembic_version = 0028` présent et vérifié |

**Total** : 616 KB. Très petit — cohérent avec une prod en phase 0 utilisateurs réels.

### Snapshot prod observé au moment du dump

| Table `public.*` | Lignes |
|------------------|-------:|
| `biens` | **3** |
| `properties` | **2** |
| `users` | **4** |
| `contracts` | **0** |
| `alembic_version` | **1** (valeur `0028`) |

> **Implication tests staging** : aucun `contract` en base prod signifie qu'on ne pourra pas valider les flows contrats (génération PDF bail, quittance, résiliation) avec des données restaurées. Il faudra créer des contrats manuellement côté staging (ou attendre Phase B.3 et utiliser les 3 biens+2 properties pour tester les migrations de FK `property_id → bien_id` seulement sur des tables vides côté `contracts`).

---

## 4. Anomalies flaguées pour Phase 20.1.B

### 🟡 Anomalie A — Dump inclut auth + storage (pas que public)

**Ce qui s'est passé** :
Par design documenté, `supabase db dump` (sans `--schema`) **exclut** par défaut les schémas `auth`, `storage` et ceux des extensions, **côté DDL (schema)** uniquement. Côté **data**, `--data-only` a néanmoins ramené 22 `COPY` dans `auth.*` et 7 `COPY` dans `storage.*`. Il semble que l'exclusion documentée ne s'applique pas au `--data-only` en 2026 (CLI 2.90.0, pg_dump 17.6.1.104). À vérifier sur un prochain usage, à flaguer si ça devient un bug récurrent.

**Conséquence immédiate** :
Au restore staging :
- Les COPY `auth.*` vont tenter d'insérer des users dans `auth.users` du staging **qui contient déjà les rôles `anon`, `authenticated`, `service_role`, etc.** pré-provisionnés par Supabase à la création du projet staging. Conflits quasi-garantis.
- Les COPY `storage.*` vont tenter d'insérer des references à des objets storage qui n'existent pas côté staging (aucun fichier uploadé). Conflits ou état inconsistant.

**Fix pour Phase B** :
Filtrer le dump data **avant** de le passer à `psql`. Deux approches au choix :

Option 1 (recommandée — plus simple) : pipe `awk` qui ne garde que les COPY blocks `public.*` :
```bash
awk '
  /^COPY / { in_public = ($2 ~ /^"public"\./ || $2 ~ /^public\./); }
  in_public { print }
  /^\\\.$/ { in_public = 0 }
' "${PREFIX}-data.sql" > "${PREFIX}-data-public-only.sql"

# Puis restore :
psql "$STAGING_URL" -v ON_ERROR_STOP=1 -f "${PREFIX}-data-public-only.sql"
```

Option 2 : re-dump avec `--schema public` explicite :
```bash
supabase db dump --linked -p "$PROD_DB_PW" --schema public --data-only --use-copy -f "${PREFIX}-data-public-only.sql"
```

**Point d'attention** : l'option 1 garde aussi le `SET` statements de header et les `SELECT pg_catalog.setval(...)` de fin, qui sont potentiellement pour auth/storage aussi. À vérifier à l'œil après génération du fichier filtré.

**Point d'attention 2** : ne PAS restaurer les COPY `auth.*` est **cohérent avec la décision Phase 0** de ne pas cloner les users prod sur staging. Les users de test seront créés à la main côté staging si besoin.

### 🟢 Anomalie B — Password DB 14 chars (non auto-généré)

**Ce qui s'est passé** :
Le `DATABASE_URL` de `backend/.env` prod contient un password de **14 caractères**, pas un password auto-généré par Supabase (qui font typiquement 24-32 chars). Au premier essai de dump, une confusion au copy-paste a fait passer la chaîne `Password length: 52 chars"` comme password (l'artefact d'une note perso), ce qui a fait échouer l'auth.

**Statut** :
- Password réel confirmé à 14 chars par Killian, et il authentifie correctement sur les 3 dumps successifs (roles, schema, data)
- Pas une vulnérabilité en soi (14 chars complexes restent solides si non dict-based)
- Aucune action à prendre

**Implication pour Phase B** :
- La variable shell `PROD_DB_PW` est déjà set et fonctionnelle → rien à re-configurer
- Quand Phase B créera un projet staging, Killian **générera** un password staging via le bouton "Generate a password" Supabase (sera plus long, ~32 chars). C'est un password différent, indépendant du prod. À stocker dans son gestionnaire de mots de passe immédiatement.

### 🔴 Anomalie C — Mes patterns grep ont été buggés 3 fois dans cette phase

Auto-revue brutale avant Phase B : je dois intérioriser ces 3 règles pour ne plus refaire les mêmes erreurs.

**Bug 1 (Bloc 3 — grep schema)** :
- J'ai utilisé `\b` (word boundary) → non supporté par grep POSIX sans `-P` / PCRE. Le `\b` a été pris littéralement, 0 match.
- **Règle désormais** : jamais de `\b` dans un grep / `grep -E`. Si j'ai besoin d'une frontière de mot, soit `grep -P` explicite, soit un pattern avec chars non-mot autour (ex. `[^a-zA-Z]biens[^a-zA-Z]`).

**Bug 2 (Bloc 3 — grep schema)** :
- J'ai cherché `CREATE TABLE` alors que pg_dump 17.6 émet `CREATE TABLE IF NOT EXISTS`.
- **Règle désormais** : pour pg_dump moderne, chercher `CREATE TABLE IF NOT EXISTS` ou accepter avec alternation `CREATE TABLE( IF NOT EXISTS)?`.

**Bug 3 (Bloc 4 — grep data)** :
- J'ai cherché `COPY public.biens` alors que pg_dump 17.6 émet `COPY "public"."biens"` (avec guillemets doubles autour du schéma et du nom de table).
- **Règle désormais** : pour pg_dump moderne, systématiquement mettre les noms schema/table/colonne entre guillemets doubles dans les patterns : `COPY "public"\."biens"`. Les guillemets sont littéraux en regex, le `.` est échappé pour matcher le séparateur littéral.

**Pattern canonique à utiliser en Phase B** :
```bash
# Détection d'un COPY block sur une table public donnée (pg_dump 17.6)
grep -cE '^COPY "public"\."<table_name>" '
# Détection d'un CREATE TABLE sur une table donnée
grep -cE '^CREATE TABLE (IF NOT EXISTS )?"public"\."<table_name>"'
```

Je relirai les commandes que je produirai en Phase B avec ces règles en tête. Si je retombe dans un des 3 pièges, que Killian me stoppe immédiatement.

---

## 5. Prérequis validés pour Phase 20.1.B

| Prérequis | État |
|-----------|------|
| Supabase CLI disponible | ✅ 2.90.0 |
| Docker daemon running | ✅ 29.3.1 |
| Image Docker `supabase/postgres:17.6.1.104` cached | ✅ (speedera Phase B) |
| `psql` disponible | ✅ 18.3 |
| `supabase login` actif | ✅ |
| Projet prod linké via `supabase link` | ✅ |
| venv backend activé | ✅ |
| Working tree branche `refonte/fusion-properties-biens-complete` propre hors attendus | ✅ (`.claude/settings.local.json`, `SPRINT_LOG.md`, `.gitignore`, `docs/session8/`, `backups/`) |
| Variables shell Phase A encore en mémoire (pour réutilisation B) | ⚠️ **Persisteront UNIQUEMENT tant que le terminal reste ouvert**. Si Killian ferme le terminal entre A et B, il faudra re-setter `TS`, `PREFIX`, `PROD_DB_PW`. |
| alembic_version prod = 0028 | ✅ (vérifié en début Bloc 1, re-confirmé dans data.sql) |
| Dossier `backups/` + `.gitignore` patterns | ✅ (section "Backups & dumps" : `backups/`, `*.sql.gz`, `prod-dump-*`) |

---

## 6. État git post-Phase A (rien de committé)

```
 M .claude/settings.local.json             ← habituel
 M SPRINT_LOG.md                           ← ligne backlog 🟢 (collision numérotation)
 M ../.gitignore                           ← section "Backups & dumps" ajoutée
?? docs/session8/                          ← livrables + bilans
?? backups/                                ← 3 fichiers dump (ignored par .gitignore)
```

Aucun commit effectué cette session 8 en dehors de `3b49707` (fix router).

---

## 7. Nettoyage à faire en fin de session 8

- **Supprimer `backups/prod-dump-2026-04-24-1847-*.sql`** quand la session 8 est clôturée ET que la migration prod 0029 a été jouée avec succès. Ces fichiers contiennent :
  - Schéma complet de la prod (sensibilité modérée)
  - Données de 4 utilisateurs réels, incluant **hashes de password auth**
  - Données des 3 biens + 2 properties réels (potentiellement PII : adresses, propriétaires identifiables)
- **Garder** un de ces dumps hors-repo (disque externe, vault, etc.) comme archive historique du passage 0028→0029 — optionnel mais recommandé.
- **Ne jamais** committer ces fichiers, même si `.gitignore` est oublié un jour. Check paranoïaque avec `git status` avant chaque commit.

---

## 8. Feu vert pour Phase 20.1.B ?

Toutes les conditions sont remplies côté Phase A. Les 3 anomalies ci-dessus sont documentées et actionnables en Phase B (principalement : filtrer le dump `data.sql` pour ne restaurer que `public`).

Killian peut valider ce bilan puis donner le "OK go Phase 20.1.B".

---

*Bilan rédigé en session 8, 2026-04-24. Aucune action destructive entreprise, aucune modification prod.*
