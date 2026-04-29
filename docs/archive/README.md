# Archive documentaire Althy

Ce dossier contient les documents obsolètes ou historiques conservés pour
traçabilité mais qui ne représentent plus la vision/architecture/produit
actuel d'Althy.

## Structure

- `sessions/` : HANDOFFs et logs de sessions de développement (séances 8 → 12)
- `business-plans/` : versions historiques du business plan
- `legal/` : audits juridiques antérieurs (à comparer avec `6-LEGAL.md` actuel)
- `sprints/` : plans de sprints terminés et journaux de sprint historiques

## Source de vérité actuelle

Voir les 6 docs vivants à la racine de `docs/` :

- `1-VISION.md` — Pourquoi Althy existe, mission, positionnement
- `2-ROADMAP.md` — Phases 1 → 4, jalons, sprints en cours
- `3-ARCHITECTURE.md` — Stack, données, infra, design system
- `4-PRODUIT.md` — 9 rôles, parcours, fiche bien, sphère IA
- `5-FINANCES.md` — Pricing v3, flux de revenus, projections
- `6-LEGAL.md` — Entité, conformité nLPD/RGPD, sous-traitants

## Politique d'archivage

- Les fichiers archivés ne doivent **pas** être modifiés.
- Toute évolution = mise à jour des docs vivants à la racine de `docs/`.
- Si un fichier archivé redevient pertinent, créer une **copie à jour**
  dans `docs/` plutôt que d'éditer l'archive.
- Les fichiers archivés sont déplacés via `git mv` pour préserver
  l'historique git.

## Date de création de cette archive

2026-04-29 — branche `refactor/docs-vision-unifiee` (Prompt 1/3 : audit + archivage).
