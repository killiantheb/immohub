# Backend legal content by country

Miroir de `frontend/src/legal/`, utilisé côté backend pour :

- Injection dans les PDFs générés (bail, EDL, quittance) — clauses légales
  dépendantes du pays du bien.
- Emails transactionnels — signature + mentions légales localisées.
- Exports fiscaux — obligations déclaratives par pays.

## Résolution

Le pays est déterminé par la ressource :

- Bien → `properties.country` (migration 0037)
- Contrat → `properties.country` du bien lié
- Invoice / quittance → `properties.country`
- User → `profiles.country`

## Structure

```
backend/legal/
├── CH/         # Suisse (actif)
├── FR/         # placeholder
├── DE/         # placeholder
└── IT/         # placeholder
```

Aucun chargeur automatique en Phase 1 — les services PDF (quittance, qr-facture,
contracts) continuent d'inliner les mentions suisses.

Quand on activera un pays : ajouter un helper `load_legal_snippet(country, key)`
dans `backend/app/services/legal_service.py` (non créé en Phase 1).
