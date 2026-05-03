# Sprint A11.A.5 — Side panel interventions fiche bien

> Statut : ✅ Code livré, smoke runtime à exécuter sur preview Vercel + Railway
> Date livraison : 2026-05-03
> Branche : feat/bien-interventions (à merger sur main)

## Périmètre livré

Side panel droit 50% `<InterventionsSidePanel />` accessible depuis la card `SectionInterventions` de la fiche bien, permettant la consultation, création, édition, clôture d'une intervention avec photos jointes — sans rupture de contexte du bien (le panel glisse depuis la droite, le bien reste visible derrière un backdrop). Pattern documenté `3-ARCHITECTURE.md` §3.12 (3 patterns modales — pilotage de sous-entité liée).

## Endpoints backend ajoutés

Préfixe `/api/v1/interventions-althy` :

- `POST /{intervention_id}/photos` — upload multipart, body `file` (UploadFile). Réutilise `settings.SUPABASE_BUCKET_BIEN_IMAGES` (default `property-images`) avec path `{bien_id}/interventions/{intervention_id}/{photo_id}{ext}`. Returns 201 `InterventionPhotoRead`.
- `DELETE /{intervention_id}/photos/{photo_id}` — purge DB + Storage. Returns 204.

Tous les autres endpoints CRUD interventions existaient déjà (PR-A11.A.0).

## Changements service

`InterventionService.update_intervention` auto-stamp `closed_at = now()` à la transition vers `resolu` (et reset à `null` si rebascule statut ouvert). Ajout `add_photo` / `delete_photo` (pattern `_load_or_404("write")` réutilisant `_upload_to_storage` / `_delete_from_storage` de `bien_service`).

## Hooks React Query ajoutés

Nouveau fichier `frontend/src/lib/hooks/useInterventions.ts` :

- `useInterventionsByBien(bienId, filters)` — query liste filtrable (statut, urgence, page, size)
- `useIntervention(id)` — query detail (inclut `images: InterventionPhoto[]`)
- `useCreateIntervention(bienId)` — mutation
- `useUpdateIntervention(id, bienId)` — optimistic snapshot/rollback
- `useDeleteIntervention(bienId)` — mutation
- `useUploadInterventionPhoto(id)` — multipart + compression client (`compressImage` répliqué)
- `useDeleteInterventionPhoto(id)` — optimistic remove

Le hook legacy `useInterventions(bienId)` dans `useBiens.ts` reste actif (consommé par `SectionInterventions` preview + `_shared.tsx` TabInterventions).

## Composants ajoutés

- `frontend/src/components/biens/InterventionsSidePanel.tsx` (1256 LoC) — side panel droit avec mode liste (filtres + cards) et mode détail (form édition + photos + clôture). framer-motion `AnimatePresence` + slide-in 240 ms.

## Migration Alembic appliquée

**0034_complete_intervention_for_a11a5** :

- ADD `interventions.note_cloture` TEXT NULL
- ADD `interventions.closed_at` TIMESTAMPTZ NULL
- CREATE TABLE `intervention_photos` (id UUID PK, intervention_id FK CASCADE, url TEXT, order INT, timestamps, is_active) + 2 index (intervention_id, intervention_id+order)
- L'ancienne colonne ARRAY `interventions.photos` est conservée (legacy, inutilisée par la nouvelle UI). Cleanup futur.

Downgrade implémenté symétriquement.

## Décisions arbitraires prises pendant le sprint

1. **Enums conservés** — backend a `urgence: faible/moderee/urgente/tres_urgente` et `statut: nouveau/en_cours/planifie/resolu`, alors que la spec proposait `low/normal/high/urgent` et `nouvelle/en_attente_devis/validee/en_cours/terminee`. Décision : conserver les enums backend (migration enum type Postgres = trop fragile pour Phase 1) et mapper côté UI : `resolu` → libellé "Terminée". Statuts intermédiaires `en_attente_devis` / `validee` reportés en backlog (intégrés naturellement avec la sous-ressource Devis qui existe déjà mais n'est pas exposée dans le panel Phase 1).

2. **Photos relation table** — backend avait `photos: ARRAY[Text]` sans IDs stables, incompatible avec `DELETE /photos/{photo_id}`. Décision : créer table `intervention_photos` (relation 1:N) et laisser l'ancienne colonne array intacte (orphan, sera nettoyée dans un sprint dédié). Le frontend exclusivement la nouvelle relation.

3. **Préfixe d'API conservé** — la spec proposait `GET /api/v1/biens/{bien_id}/interventions`. L'existant utilise `GET /api/v1/interventions-althy/?bien_id=X`. Décision : garder l'existant (pas de duplication de routes, hooks construits sur l'URL existante).

## Backlog identifié

### Sprints futurs potentiels

- **Matching artisans P3+** — assigner artisan_id depuis le panel via une recherche. Champ DB existe (`Intervention.artisan_id`) mais aucune UI exposée Phase 1.
- **Stripe Connect P3+** — payer un artisan via Connect quand intervention résolue avec coût. Schéma Devis existe (table `devis`, statuts `en_attente/accepte/refuse`) mais pas exposé dans le panel.
- **OCR factures P2+** — uploader une facture photo, OCR auto-pré-remplit `cout` à la clôture. À coupler avec la pipeline existante des dépenses.
- **Notifications proprio email/push** — mail Resend déjà câblé pour création (background task `_notify_owner_new_intervention`). Manquent : transitions de statut, photos ajoutées, clôture.
- **Historique transitions statuts** — `closed_at` est stamp, mais pas la chronologie (ex : nouveau → en_cours → planifie → resolu). À adosser à `audit_log` existant.

### Refacto opportuniste

- `InterventionsSidePanel.tsx` (1256 LoC) — extractions `ListView`, `DetailView`, `PhotosSection` déjà séparées en sous-composants ; quand maintenance lourde, sortir dans des fichiers dédiés.
- Cleanup colonne legacy `interventions.photos ARRAY[Text]` — drop column dans une future migration une fois confirmé que rien ne lit plus ce champ.

### Bugs / améliorations connus

- **Compression client absente du panel photos** — la `compressImage` est dupliquée depuis `useBiens.ts` au lieu d'être factorisée dans un module shared. Sprint dette technique : `frontend/src/lib/imageCompression.ts`.
- **Suppression intervention interdite si devis accepté** — backend retourne 409 (`InterventionService.delete_intervention`). Aucun bouton Supprimer Phase 1 n'est exposé dans le panel ; à ajouter en respectant ce 409.

## Doc de référence

- Smoke checklist : `docs/session12/SPRINT-A11A5-interventions-smoke-checklist.md`
- Spec produit : `docs/4-PRODUIT.md` §4.10 (Module Interventions) + §4.2 (Règle 8 1 clic)
- Architecture : `docs/3-ARCHITECTURE.md` §3.6 (DA scientifique) + §3.12 (3 patterns modales)
- Sprint photo précédent (pattern jumeau) : `docs/session12/SPRINT-A11A2-photos.md`
