# Sprint A11.A.2 — Modale gestion photos bien

> Statut : ✅ Livré et fonctionnel en prod
> Date livraison : 2026-05-03
> Branches mergées sur main : feat/bien-photos (commit dd84ae3) + fix/bucket-supabase-property-legacy (commit 043ace7)

## Périmètre livré

Modale fullscreen `<PhotosManagerModal />` accessible par clic sur la zone photos du `<CardHeaderBien />`, permettant :
- Upload multiple drag-and-drop (séquentiel, max 10 MB par photo, types jpg/png/webp/gif)
- Réordonnancement par drag (framer-motion Reorder.Group)
- Set cover (1 clic)
- Suppression individuelle avec confirmation native

## Fichiers touchés

| Layer | Fichiers | LoC |
|---|---|---|
| Backend schemas | backend/app/schemas/bien.py | +25 |
| Backend service | backend/app/services/bien_service.py | +121 |
| Backend router | backend/app/routers/biens.py | +35 |
| Frontend hooks | frontend/src/lib/hooks/useBiens.ts | +89 |
| Frontend composant | frontend/src/components/biens/PhotosManagerModal.tsx | +702 (nouveau) |
| Frontend page | frontend/src/app/app/(dashboard)/biens/[id]/page.tsx | +94 / -62 |
| Frontend CSS | frontend/src/app/globals.css | +10 |
| Backend config | backend/app/core/config.py | +5 (post-fix bucket) |

## Endpoints backend ajoutés

- `PATCH /api/v1/biens/{bien_id}/images/reorder` — body `{order: list[UUID]}` — batch reorder atomique
- `PATCH /api/v1/biens/{bien_id}/images/{image_id}` — body `{is_cover?: bool, order?: int}` — update unitaire

## Hooks React Query ajoutés

- `useUpdateBienImage(bienId)` — optimistic sur is_cover
- `useReorderBienImages(bienId)` — optimistic sur order

## Bugs résolus en cours de smoke

1. **502 sur upload** — bucket Supabase Storage prod nommé `property-images` (legacy avant migration 0029) vs code qui cherchait `bien-images`. Fix : variabilisation via `Settings.SUPABASE_BUCKET_BIEN_IMAGES` (default `property-images`).

## Backlog identifié pour sprints futurs

### Refacto opportuniste (quand maintenance lourde)
- Extraction sous-composants : `PhotoCard`, `UploadDropzone`, `EmptyState` depuis `PhotosManagerModal.tsx` (702 lignes)

### Bugs / améliorations connus
- **Race condition reorder pendant upload concurrent** : si user upload une photo pendant qu'il drag-reorder, le payload `order` ne contient pas le nouvel ID → backend rejette en 400 « IDs manquants ». Fix : re-snapshotter `bien.images` au moment du drop (pas du drag start) dans `useReorderBienImages`.
- **8 warnings mypy de shadowing** : `BienService.list` shadow le builtin `list[]` dans tous les types. Fix : refactor `BienService.list` → `BienService.list_biens` (touche signature publique service, sprint dédié).

### Migration buckets propre (sprint dédié)
- Créer `bien-images` et `bien-documents` côté Supabase prod
- Pas de copie de fichiers nécessaire (table `bien_images` actuellement vide en prod)
- Basculer Railway env vars `SUPABASE_BUCKET_BIEN_IMAGES=bien-images` et `SUPABASE_BUCKET_BIEN_DOCUMENTS=bien-documents`
- Supprimer les anciens buckets `property-*`
- Mettre à jour la doc `3-ARCHITECTURE.md` §3.1 et §3.5

### Catégorisation photos (reportée sprint A11.A.6)
- Catégories par pièce : salon / chambre / cuisine / SDB / extérieur / autre
- Légendes manuelles
- Tags pièces dynamiques selon le bien

## Doc de référence

- Smoke test checklist : `docs/session12/SPRINT-A11A2-photos-smoke-checklist.md`
- Spec produit : `docs/4-PRODUIT.md` §4.6 (Module Bien) + §4.2 (Règle 8 1 clic)
- Architecture : `docs/3-ARCHITECTURE.md` §3.6 (DA scientifique) + §3.12 (3 patterns modales)
