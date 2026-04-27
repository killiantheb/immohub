# 🔴 BUG — POST /biens/{id}/changement/creer → 500

> Date découverte : 2026-04-27 (session 12 / soir 2)
> Statut : ✅ RÉSOLU le 2026-04-27 (commit ca13842, PR #4)
> Sévérité : P1 (bloque création changement de locataire)

## Contexte

Bug découvert lors du smoke test post-migration 0030. Le GET
/changement/actif retourne bien 200 (bug initial fixé), mais le POST
/changement/creer retourne toujours 500.

## Reproduction

1. althy.ch → login → page bien e074ae1d-3ded-45b1-b007-cfbdab6b2b61
2. Onglet "Changement"
3. Cliquer "Démarrer un changement de locataire"
4. Remplir date_depart_prevu = 2026-04-09
5. Valider → 500

## Données capturées

URL : POST /api/v1/biens/e074ae1d-3ded-45b1-b007-cfbdab6b2b61/changement/creer
Payload :
```json
{"date_depart_prevu": "2026-04-09"}
```

Réponse :
```json
{"detail": "Internal server error"}
```

(Le detail générique masque la vraie erreur — c'est le comportement
prod par défaut. Logs Railway nécessaires pour traceback complet.)

## État backend

- Migration 0030 appliquée prod ✅
- Table changements_locataire existe avec 25 colonnes ✅
- 2 CHECK constraints en place
- 5 indexes
- 2 RLS policies (owner_all, service_role_all)

## Code à investiguer

backend/app/routers/changements.py — chercher la fonction qui handle
POST /{bien_id}/changement/creer.

D'après l'audit étape 2.A : le router utilise du SQL brut text(...),
pas d'ORM SQLAlchemy. L'INSERT est probablement quelque chose comme :

```sql
INSERT INTO changements_locataire (bien_id, date_depart_prevu, ...)
VALUES (:bien_id, :date_depart_prevu, ...)
```

## Hypothèses à tester demain

1. **Type mismatch DATE** : asyncpg refuse "2026-04-09" en str alors
   qu'il attend datetime.date — peu probable, asyncpg cast
   habituellement.
2. **Paramètre nommé différent** : le SQL brut attend
   `:date_depart_prev` ou `:date_depart`, frontend envoie
   `date_depart_prevu`.
3. **Colonne NOT NULL sans default oubliée** : le backend ne renseigne
   pas une colonne obligatoire (pas dans payload, pas dans default DB).
4. **RLS bloque l'INSERT** : peu probable, le backend devrait utiliser
   service_role_key (bypass RLS).
5. **CHECK constraint violé** : le backend essaie d'écrire une valeur
   non valide pour `type_resiliation` ou `remplacant_trouve_par`. Mais
   ces colonnes sont nullables et le payload ne les inclut pas.
6. **Une dépendance manquante** : import error, module non chargé, etc.

## Procédure d'investigation prévue

1. Reproduire le bug en local (backend + frontend pointés sur staging)
   pour avoir les logs python complets
2. OU lire les logs Railway prod (dashboard Railway → service backend
   → Logs)
3. Identifier la ligne Python qui crashe
4. Lire la fonction concernée dans changements.py
5. Comparer le SQL brut au schéma 0030
6. Fixer le mismatch
7. Smoke test (reproduire le clic UI)

## JWT utilisé pour le test

Login utilisateur : k.thebaud@sunimmo-riviera.ch (super_admin)
User ID : ac53d2ca-fae9-4e05-81b7-0b50b081404d
JWT : extrait du cookie sb-zvcjaiqfinmxguiyozzu-auth-token (Local
Storage althy.ch). Expire 1h après login.

## Notes

- L'endpoint GET /actif fonctionne (200 + body null)
- Donc la table est bien lisible
- Le bug est donc spécifiquement dans la logique INSERT du POST /creer
- Pas un bug de migration, pas un bug de schéma, pas un bug d'auth
- Bug applicatif Python pur

## ✅ Résolution

**Date** : 2026-04-27 (session 12 / soir 2)
**Commit fix** : `ca13842`
**PR** : #4 (mergée sur main → `6e275a0`)

### Cause racine confirmée

Diagnostic 2bis-A confirmé via traceback Railway :

```
sqlalchemy.dialects.postgresql.asyncpg.AsyncAdapt_asyncpg_dbapi.ProgrammingError:
<class 'asyncpg.exceptions.PostgresSyntaxError'>: syntax error at or near ":"
```

Conflit syntaxe `:param` SQLAlchemy avec `::type` Postgres dans l'INSERT :

```python
INSERT INTO changements_locataire (..., checklist_depart)
VALUES (..., :checklist::jsonb)  # ❌ syntaxe ambiguë pour asyncpg
```

Le SQL ne se compile **même pas**, donc l'INSERT n'atteint jamais
asyncpg ni la DB. Aucune des 6 hypothèses initiales n'était la cause
directe (toutes éliminables a posteriori, sauf #1 qui était un bug
latent réel mais masqué par le syntax error).

### Fix appliqué (combiné, 2 bugs en 1)

**Bug visible — SQL syntax** :
- 4 occurrences `:param::jsonb` → `CAST(:param AS jsonb)`
- Affecte les 4 INSERT/UPDATE de changements.py

**Bug latent — date type mismatch** (jamais déclenché car bloqué avant) :
- 3 schémas Pydantic `str | None` → `date | None`
- Pydantic v2 fait la coercition auto str ISO → datetime.date
- Validation 422 propre si format invalide (vs 500 cryptique)

### Validation prod

Smoke test cycle complet sur althy.ch (bien e074ae1d-... Crans-Montana) :
- ✅ POST /creer (création changement)
- ✅ PUT /checklist (checklist départ)
- ✅ POST /passer-recherche (transition phase 2)
- ✅ PUT /edl (EDL sortie + entrée)
- ✅ POST /finaliser-depart (transition checkout)
- ✅ POST /finaliser-entree (clôture cycle terminé)

État final : "Cycle terminé · Bail signé · 1er QR-loyer envoyé".

0 erreur console, 0 warning. Fix validé en conditions réelles.

### Leçons retenues

- **Hypothèses n'étaient pas exhaustives** : aucune des 6 hypothèses du
  diagnostic n'avait identifié le conflit syntaxique `:param` vs `::type`.
  La cause réelle a été révélée par le traceback Railway directement.
  Pour les bugs avec error masqué en prod (`{"detail": "Internal server
  error"}`), **toujours commencer par lire les logs Railway** plutôt que
  de raisonner par déduction.
- **Pattern `::type` Postgres dans SQLAlchemy `text()`** : à éviter
  systématiquement. Préférer `CAST(... AS type)` qui ne génère aucun
  conflit avec le parser de bind parameters.
- **Bug latent jamais déclenché** : le bug DATE str→date était présent
  depuis l'écriture du module mais bloqué en amont par le syntax error.
  Audit recommandé : vérifier les autres routers du repo qui utilisent
  `text()` avec des params DATE en str.
