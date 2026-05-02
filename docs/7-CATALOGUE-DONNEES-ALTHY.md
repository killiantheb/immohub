# Catalogue des données Althy

> **Source de vérité granulaire** pour toute donnée Althy : qui possède,
> qui voit, comment elle arrive (acquisition), à quelle phase elle est
> active, dans quelle section/sous-section UI elle vit.
>
> Ce document est référencé par :
> - `1-VISION.md` (vision macro)
> - `2-ROADMAP.md` (phases produit)
> - `3-ARCHITECTURE.md` (sectorisation, sources de vérité)
> - `4-PRODUIT.md` (expérience utilisateur)
>
> Last update : 2026-04-30

---

## Préambule

### Légende acquisition

| Code | Signification |
|---|---|
| 🤖 **AUTO** | Calcul, jointure, default value, géocoding API publique |
| 🔗 **DÉDUIT** | Calculé à partir d'autres données déjà saisies |
| 🧠 **IA** | Sphère IA va chercher, OCR un document, Vision IA analyse une photo, scraping web |
| 📩 **EXTERNE** | Vient d'un tiers (banque CAMT, Stripe, partenaire, autre user Althy) |
| 👤 **USER** | Saisie utilisateur — en dernier recours, mais avec assistance IA |
| 🎯 **ONBOARDING** | Saisi une seule fois à l'inscription/setup, plus jamais redemandé |

### Légende source de vérité

| Symbole | Signification |
|---|---|
| 🏠 **Source** | Ce domaine **possède** la donnée (table de référence) |
| ↗ **Réf** | Ce domaine **référence** la donnée d'un autre domaine (FK ou jointure) |

### Légende phase

| Code | Période |
|---|---|
| **P1** | Phase 1 — L'Assistant (M1-M6) |
| **P2** | Phase 2 — L'Intelligence (M7-M12) |
| **P3** | Phase 3 — L'Écosystème (M13-M18) |
| **P4** | Phase 4 — Le Pilotage Patrimonial (M19-M24) |
| **P5+** | Phase 5+ — L'Agent Autonome (An 3+) |

### Légende état

| Symbole | Signification |
|---|---|
| ✅ | Existe en DB Althy aujourd'hui |
| ➕ | Nouveau, à créer |
| ♻️ | Existe mais à refacto/déplacer |

---

# RÔLE 1 — proprio_solo

Cible canonique Phase 1. Propriétaire-bailleur 1-15 biens en autonomie complète.

## SECTION UI : Tableau de bord

URL : `/app/dashboard`. Premier écran après login.

### Sous-section : Bandeau briefing IA

| Donnée | Acquisition | Phase | Source | État | Stratégie de simplification |
|---|---|---|---|---|---|
| Salutation personnalisée + date | 🤖 AUTO | P1 | calcul | ➕ | Heure + langue locale |
| Texte briefing matinal | 🧠 IA | P1 backlog | 🏠 IABriefing | ➕ | Sphère IA génère un résumé court le matin |
| CTA « Parler à Althy » | 🤖 AUTO | P1 | UI | ➕ | Lien vers /app/sphere |
| CTA « Voir mes biens » | 🤖 AUTO | P1 | UI | ✅ | Lien direct |

### Sous-section : Carrés KPI

| Donnée | Acquisition | Phase | Source | État | Stratégie de simplification |
|---|---|---|---|---|---|
| Compteur biens (total / loués / vacants / en travaux) | 🤖 AUTO | P1 | ↗ Bien.statut | ✅ | Jointure Bien.owner_id |
| Carré « Ce mois » : revenus reçus + attendus | 🤖 AUTO | P1 | ↗ Transaction | ✅ | Sum mois courant |
| Carré « Économies vs régie » : montant cumulé année | 🔗 DÉDUIT | P1 | calcul | ➕ | Formule : (loyer × 10% × 12) − 348 abo |
| Carré « Candidatures » : nombre + scores top 3 | 🤖 AUTO | P1 | ↗ Candidature | ✅ | Filter listings actifs proprio |
| Carré « Travaux » : interventions actives + ETA | 🤖 AUTO | P1 | ↗ WorkOrder | ♻️ | Filter statut ≠ resolu |
| Carré « Échéances 30j » : loyers / EDL / IPC à venir | 🤖 AUTO | P1 | calcul | ➕ | Croisement Contract dates + Transaction futures |

### Sous-section : Alertes intelligentes

| Donnée | Acquisition | Phase | Source | État | Stratégie de simplification |
|---|---|---|---|---|---|
| Liste alertes priorisées | 🧠 IA | P1 | ↗ Notification + IABriefing | ✅ partiel | IA score chaque alerte, top 5 affichées |
| Indicateur d'urgence couleur | 🤖 AUTO | P1 | calcul | ✅ | Vert/ambre/rouge selon délai |
| CTA action 1 clic | 🤖 AUTO | P1 | UI | ✅ | Action contextuelle (relancer / valider / signer) |

---

## SECTION UI : Mes biens (liste)

URL : `/app/biens`. Liste de tous les biens du proprio.

### Sous-section : Vue cartes (default)

| Donnée par carte-bien | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Photo cover | 🤖 AUTO | P1 | ↗ BienImage où is_cover=true | ✅ | Default = première photo uploadée |
| Adresse (rue + n° + ville) | 🤖 AUTO | P1 | ↗ Bien.adresse + cp + ville | ✅ | Affichage direct |
| Statut bien (badge couleur) | 🤖 AUTO | P1 | ↗ Bien.statut | ✅ | Loué/Vacant/Travaux |
| Surface | 🤖 AUTO | P1 | ↗ Bien.surface | ✅ | RegBL pré-rempli |
| Pièces | 🤖 AUTO | P1 | ↗ Bien.rooms | ✅ | RegBL |
| Loyer affiché | 🤖 AUTO | P1 | ↗ Contract.monthly_rent ou Bien.loyer | ✅ | Si loué = Contract / sinon = cible |
| Locataire actuel (nom court) | 🤖 AUTO | P1 | ↗ Locataire actif | ✅ | Jointure si loué |
| Date fin bail | 🤖 AUTO | P1 | ↗ Contract.end_date | ✅ | Si bail actif |
| Rendement net % | 🔗 DÉDUIT | P1 | calcul | ➕ | (loyer × 12 - charges) / prix_acquisition |
| CTA « Ouvrir → » | 🤖 AUTO | P1 | UI | ✅ | Vers fiche bien |

### Sous-section : Vue table (toggle)

Bascule en table pour Bernard Nicod-like avec 50+ biens.

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Colonnes configurables | 👤 USER | P2 | UI persisté | ➕ | Tri/filtre/colonnes choisies |
| Filtres avancés (canton, statut, plage loyer) | 👤 USER | P2 | UI | ➕ | Multi-filtre |
| Export CSV | 🤖 AUTO | P2 | calcul | ➕ | Bouton export |

### Sous-section : Vue carte interactive

URL `/app/biens?view=map`. Vue géographique des biens sur fond Mapbox.

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Pin chaque bien | 🤖 AUTO | P1 | ↗ Bien.lat/lng | ✅ | Géocoding auto |
| Cluster zones denses | 🤖 AUTO | P1 | calcul | ➕ | Mapbox clustering |
| Popup au clic pin | 🤖 AUTO | P1 | calcul | ✅ | Mini-card avec lien |
| Couches cadastre VSGIS (P3) | 📩 EXTERNE | P3 | API VSGIS | ➕ | DB Althy + tuiles cadastre |

---

## SECTION UI : Fiche bien (page principale)

URL : `/app/biens/[id]`. **Pivot central de l'expérience Althy** (doctrine bien = atomique).

### Sous-section : Header large 40/60

#### Zone gauche — Visuel

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Carrousel photos | 🤖 AUTO | P1 | ↗ BienImage | ✅ | Tri par is_cover desc, position asc |
| Bouton « Gérer photos » | 🤖 AUTO | P1 | UI | ➕ | Ouvre modale photos (A11.A.2) |
| Indicateur cover | 🤖 AUTO | P1 | ↗ BienImage.is_cover | ✅ | Badge sur la cover |

#### Zone droite — Bloc « Informations principales »

##### Identité

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Adresse (rue + n°) | 👤 USER | P1 | 🏠 Bien.adresse | ✅ | Autocomplete Mapbox/Swisstopo dès 3 lettres |
| Code postal | 🤖 AUTO | P1 | 🏠 Bien.cp | ✅ | Géocoding depuis adresse |
| Ville | 🤖 AUTO | P1 | 🏠 Bien.ville | ✅ | Géocoding |
| Canton | 🤖 AUTO | P1 | 🏠 Bien.canton | ✅ | Géocoding |
| Lat/lng | 🤖 AUTO | P1 | 🏠 Bien.lat/lng | ✅ | Géocoding |
| Nom de l'immeuble | 🧠 IA | P1 | 🏠 Bien.building_name | ✅ | OpenStreetMap + Swisstopo |
| Code immeuble (réf interne régie) | 👤 USER | P1 | 🏠 Bien.reference_number | ✅ | Optionnel, prompt sphère IA |
| N° appartement | 👤 USER | P1 | 🏠 Bien.unit_number | ✅ | Champ court |
| EGID (identifiant fédéral bâtiment) | 🧠 IA | P1 | 🏠 Bien.egid | ➕ | API GeoAdmin Swisstopo via adresse |
| EWID (identifiant fédéral logement) | 🧠 IA | P1 | 🏠 Bien.ewid | ➕ | API GeoAdmin/RegBL |
| N° parcelle cadastrale | 🧠 IA | P1 | 🏠 Bien.parcelle | ➕ | API GeoAdmin via lat/lng |
| Type bien | 🧠 IA | P1 | 🏠 Bien.type | ✅ | Vision IA + RegBL classifie |
| Statut actuel | 🤖 AUTO | P1 | 🏠 Bien.statut | ✅ | Déduit Locataire actif + WorkOrder |
| Date acquisition | 🧠 IA | P1 | 🏠 Bien.date_acquisition | ➕ | OCR acte d'achat |
| Prix acquisition | 🧠 IA | P1 | 🏠 Bien.prix_acquisition | ➕ | OCR acte d'achat |

##### Caractéristiques techniques

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Surface habitable m² | 🧠 IA | P1 | 🏠 Bien.surface | ✅ | RegBL via EGID |
| Surface pondérée m² | 🔗 DÉDUIT | P1 | 🏠 Bien.surface_ponderee | ➕ | Calcul Suisse standard |
| Étage logement | 🧠 IA | P1 | 🏠 Bien.etage | ✅ | RegBL |
| Nombre pièces | 🧠 IA | P1 | 🏠 Bien.rooms | ✅ | RegBL |
| Chambres | 🧠 IA | P1 | 🏠 Bien.bedrooms | ✅ | Déduit pièces - 1 cuisine - 1 salon |
| Salles de bain | 👤 USER | P1 | 🏠 Bien.bathrooms | ✅ | +/- buttons, default 1 |
| Toilettes visiteurs | 👤 USER | P1 | 🏠 Bien.toilets | ➕ | +/- buttons, default 0 |
| Hauteur sous plafond | 👤 USER | P2 | 🏠 Bien.ceiling_height_cm | ➕ | Optionnel skippable |
| Année construction | 🧠 IA | P1 | 🏠 Bien.annee_construction | ✅ | RegBL |
| Année rénovation | 👤 USER | P1 | 🏠 Bien.annee_renovation | ✅ | Pas dans RegBL |
| Date derniers travaux | 🤖 AUTO | P2 | 🏠 Bien.date_derniers_travaux | ➕ | Date dernier WorkOrder catégorie travaux_majeurs |
| Classe énergétique DPE | 🧠 IA | P1 | 🏠 Bien.classe_energetique | ✅ | OCR CECB + estimation IA fallback |
| Exposition (8 directions) | 🧠 IA | P1 | 🏠 Bien.exposition | ➕ | Lat/lng + OpenStreetMap orientation |
| Vue (lac/montagne/cour/rue) | 🧠 IA | P1 | 🏠 Bien.vue | ➕ | Vision IA sur photos extérieures |
| État du bien | 🧠 IA | P1 | 🏠 Bien.etat | ➕ | Vision IA + année rénovation |

##### Équipements

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Meublé | 🧠 IA | P1 | 🏠 Bien.is_furnished | ✅ | Vision IA sur photos |
| Linge fourni | 👤 USER | P1 | 🏠 Bien.linge_fourni | ➕ | Toggle simple |
| Balcon | 🧠 IA | P1 | 🏠 Bien.has_balcony | ✅ | Vision IA + RegBL |
| Terrasse | 🧠 IA | P1 | 🏠 Bien.has_terrace | ✅ | Vision IA |
| Jardin | 🧠 IA | P1 | 🏠 Bien.has_garden | ✅ | Vision IA |
| Cheminée | 🧠 IA | P1 | 🏠 Bien.has_fireplace | ✅ | Vision IA |
| Cave | 🤖 AUTO | P1 | 🏠 Bien.has_storage | ✅ | True si BienAnnexe type=cave existe |
| Buanderie privée | 👤 USER | P1 | 🏠 Bien.has_laundry_private | ✅ | Toggle |
| Buanderie commune | 👤 USER | P1 | 🏠 Bien.has_laundry_building | ✅ | Toggle |
| Lave-vaisselle | 🧠 IA | P1 | 🏠 Bien.has_dishwasher | ➕ | Vision IA cuisine |
| Climatisation | 🧠 IA | P1 | 🏠 Bien.has_aircon | ➕ | Vision IA |
| Internet inclus | 👤 USER | P1 | 🏠 Bien.has_internet | ➕ | Sphère IA prompt |
| Animaux autorisés | 👤 USER | P1 | 🏠 Bien.pets_allowed | ✅ | Tri-state |
| Fumeurs autorisés | 👤 USER | P1 | 🏠 Bien.smoking_allowed | ✅ | Tri-state |

##### Distances utiles

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Distance gare (min) | 🤖 AUTO | P1 | 🏠 Bien.distance_gare_minutes | ✅ | API isochrone |
| Distance bus | 🤖 AUTO | P1 | 🏠 Bien.distance_arret_bus_minutes | ✅ | API isochrone |
| Distance télécabine | 🤖 AUTO | P1 | 🏠 Bien.distance_telecabine_minutes | ✅ | API isochrone |
| Distance lac | 🤖 AUTO | P1 | 🏠 Bien.distance_lac_minutes | ✅ | API isochrone |
| Distance aéroport | 🤖 AUTO | P1 | 🏠 Bien.distance_aeroport_minutes | ✅ | API isochrone |
| Distance école | 🤖 AUTO | P1 | 🏠 Bien.distance_ecole_minutes | ➕ | API isochrone |
| Distance commerces | 🤖 AUTO | P1 | 🏠 Bien.distance_commerces_minutes | ➕ | API isochrone |
| Notes situation libre | 👤 USER | P2 | 🏠 Bien.situation_notes | ✅ | Optionnel |

##### Conditions location

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Type location actuel | 🤖 AUTO | P1 | 🏠 Bien.location_type_actuel | ✅ | Déduit Contract actif (annuelle/saisonnière 4 mois/vacant) |
| Type résidence | 👤 USER 🎯 | P1 | 🏠 Bien.residence_type | ✅ | Onboarding bien : principale/secondaire/investissement |
| Loyer cible (indicatif) | 🧠 IA | P1 | 🏠 Bien.loyer | ✅ | **Source vérité légale = Contract.monthly_rent** ; ici juste référence |
| Charges cibles | 🧠 IA | P1 | 🏠 Bien.charges | ✅ | Estimation IA |
| Caution cible | 🤖 AUTO | P1 | 🏠 Bien.deposit | ✅ | Default 3× loyer (CO art. 257e) |

##### Description publique

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Description du lieu | 🧠 IA | P1 | 🏠 Bien.description_lieu | ✅ | IA génère depuis ville+canton+distances |
| Description logement | 🧠 IA | P1 | 🏠 Bien.description_logement | ✅ | IA génère depuis caractéristiques+photos |
| Remarques internes | 👤 USER | P1 | 🏠 Bien.remarques | ✅ | Optionnel |
| Adresse affichée publique | 🤖 AUTO | P1 | ↗ Listing.adresse_affichee | ✅ | Default anonymisée |
| Atouts mis en avant | 🧠 IA | P1 | 🏠 Bien.atouts_ia | ➕ | IA bullet list |

##### Fiscalité du bien

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Valeur fiscale cantonale | 🧠 IA | P2 | 🏠 Bien.valeur_fiscale | ➕ | OCR déclaration impôts |
| Valeur locative | 🧠 IA | P2 | 🏠 Bien.valeur_locative | ➕ | OCR ou calcul cantonal indicatif |
| Impôt foncier annuel | 🧠 IA | P2 | 🏠 Bien.impot_foncier | ➕ | OCR ou calcul cantonal |
| Hypothèque montant | 👤 USER | P2 | 🏠 Bien.hypotheque_montant | ➕ | Optionnel |
| Taux hypothécaire personnel | 🧠 IA | P1 | 🏠 Bien.taux_hypothecaire | ➕ | OCR contrat hypothèque |
| Taux référence BNS | 🤖 AUTO | P1 | calcul | ➕ | API BNS |

##### Boutons d'action header

| Action | Acquisition | Phase | Source | État |
|---|---|---|---|---|
| Lien « Voir toutes les caractéristiques → » | 🤖 AUTO | P1 | UI | ✅ | Ouvre modale lecture |
| Bouton « Modifier » | 🤖 AUTO | P1 | UI | ✅ | Ouvre modale édition |
| Bouton « Supprimer » | 🤖 AUTO | P1 | UI | ✅ | Ouvre DeleteBienModal |

### Sous-section : Grille 6 carrés (3×2)

#### Carré 1 — Locataire

URL clic → side panel locataire.

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Avatar/initiales locataire actuel | 🤖 AUTO | P1 | ↗ Locataire actif | ✅ | Initiales par défaut |
| Nom locataire | 🤖 AUTO | P1 | ↗ User profil locataire | ✅ | Jointure |
| Statut paiement (à jour/retard) | 🤖 AUTO | P1 | ↗ Transaction | ✅ | Calcul dernière échéance |
| Bail jusqu'au | 🤖 AUTO | P1 | ↗ Contract.end_date | ✅ | Affichage |
| Score solvabilité | 🤖 AUTO | P1 | ↗ ScoringLocataire | ✅ | IA calcul |
| Caution montant + type | 🤖 AUTO | P1 | ↗ Caution | ➕ | Affichage |
| Cas vacant : nb candidatures | 🤖 AUTO | P1 | ↗ Candidature | ✅ | Compteur |
| CTA « Voir fiche » | 🤖 AUTO | P1 | UI | ✅ | Side panel |
| CTA « Communiquer » | 🤖 AUTO | P1 | UI | ✅ | Vers /app/communication?contact=X |
| Action 1 clic « Modifier locataire » | 👤 USER | P1 | UI | ➕ | **Règle 1 clic** : édition depuis ce carré, pas section globale |

#### Carré 2 — Finances

URL clic → side panel finances bien.

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Loyer mensuel actuel | 🤖 AUTO | P1 | ↗ Contract.monthly_rent | ✅ | Source légale |
| Charges mensuelles | 🤖 AUTO | P1 | ↗ Contract.charges | ✅ | Source légale |
| Loyer net après commission Althy 3% | 🔗 DÉDUIT | P1 | calcul | ✅ | Affichage transparent |
| Rendement brut % | 🔗 DÉDUIT | P1 | calcul | ➕ | (loyer×12)/prix_acquisition |
| Rendement net % | 🔗 DÉDUIT | P1 | calcul | ➕ | (loyer-charges)×12/prix_acquisition |
| Économies vs régie ce mois | 🔗 DÉDUIT | P1 | calcul | ➕ | (loyer×10%)−29 |
| Statut paiement mois courant | 🤖 AUTO | P1 | ↗ Transaction | ✅ | Reçu/attente/retard |
| CTA « Détail finances » | 🤖 AUTO | P1 | UI | ✅ | Side panel |
| Action 1 clic « Voir/modifier décompte » | 👤 USER | P1 | UI | ➕ | **Règle 1 clic** depuis ici |

#### Carré 3 — Estimation IA

URL clic → modale estimation enrichie.

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Estimation valeur actuelle | 🧠 IA | P1 | calcul | ✅ | Prompt Claude + comparables |
| Confiance % | 🤖 AUTO | P1 | calcul | ✅ | Score IA |
| Écart vs prix acquisition | 🔗 DÉDUIT | P1 | calcul | ➕ | % évolution |
| Prix m² zone | 🤖 AUTO | P2 | DB Althy | ➕ | DB propriétaire prix m² |
| Estimation 2030 (P3) | 🧠 IA | P3 | calcul | ➕ | Tendance + IA |
| COS restant constructible (P3) | 🤖 AUTO | P3 | API VSGIS | ➕ | Cadastre |
| Score opportunité (P3) | 🧠 IA | P3 | calcul | ➕ | Vendre/garder/valoriser |
| Disclaimer LSFin | 🤖 AUTO | P1 | UI | ✅ | À titre indicatif |
| CTA « Analyse complète » | 🤖 AUTO | P1 | UI | ✅ | Modale détail |

#### Carré 4 — Interventions

URL clic → side panel interventions (A11.A.5).

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Nombre interventions actives | 🤖 AUTO | P1 | ↗ WorkOrder | ✅ | Compteur statut ≠ resolu |
| Liste 3 dernières interventions | 🤖 AUTO | P1 | ↗ WorkOrder | ✅ | Tri date desc |
| Catégorie + urgence + ETA | 🤖 AUTO | P1 | ↗ WorkOrder | ✅ | Affichage |
| Cas vide : message + CTA création | 🤖 AUTO | P1 | UI | ✅ | Action vide |
| CTA « + Nouvelle intervention » | 👤 USER | P1 | UI | ➕ | **Règle 1 clic** depuis ce carré |
| Clic ligne intervention → side panel détail | 👤 USER | P1 | UI | ➕ | **Règle 1 clic** : pilotage complet sans changer de page |

#### Carré 5 — Documents

URL clic → modale documents bien.

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Compteur documents par catégorie | 🤖 AUTO | P1 | ↗ Document | ✅ | Bail/EDL/quittance/etc. |
| Dernier document ajouté | 🤖 AUTO | P1 | ↗ Document | ✅ | Tri date |
| Documents bientôt expirés | 🤖 AUTO | P1 | ↗ Document.expires_at | ➕ | Alerte 30j |
| CTA « + Déposer un document » | 👤 USER | P1 | UI | ✅ | Upload + IA classe auto |
| Clic ligne doc → preview | 👤 USER | P1 | UI | ✅ | Modale rapide |
| Action 1 clic « Générer document » | 🤖 AUTO | P1 | UI | ✅ | Sphère IA propose templates |

#### Carré 6 — Historique

URL clic → modale timeline complète.

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Timeline événements bien | 🤖 AUTO | P1 | ↗ AuditLog | ✅ | Ordre chrono inverse |
| Pastilles couleurs par type événement | 🤖 AUTO | P1 | calcul | ✅ | Création/modif/locataire/travaux/vente |
| 5 derniers événements visibles | 🤖 AUTO | P1 | ↗ AuditLog | ✅ | Limit 5 |
| CTA « Voir tout l'historique » | 🤖 AUTO | P1 | UI | ✅ | Modale timeline complète |
| Cas vide : « bien créé le X par Y » | 🤖 AUTO | P1 | calcul | ✅ | Default |

### Sous-section : Modales associées

#### Modale Caractéristiques (lecture/édition)

URL : ouverture overlay depuis fiche bien. Mode read par défaut, edit via bouton Modifier.

→ Données identiques au header (les 30+ champs caractéristiques) en mode formulaire complet.

#### Modale gestion photos (A11.A.2)

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Liste photos par catégorie | 🤖 AUTO | P1 | ↗ BienImage | ✅ | Filtré category |
| Sections auto-générées (chambre 1/2/3, sdb 1/2, wc 1/2/3, cuisine, salon, cave, ski_locker, parking, extérieur, vue) | 🤖 AUTO | P1 | calcul depuis Bien.bedrooms+bathrooms+toilets | ➕ | Génération dynamique |
| Upload photo | 👤 USER | P1 | ↗ BienImage | ✅ | Drag-and-drop |
| Catégorie auto-classée | 🧠 IA | P1 | ↗ BienImage.category | ✅ étendre | Vision IA |
| Set cover | 👤 USER | P1 | ↗ BienImage.is_cover | ✅ | Radio |
| Reorder drag-and-drop | 👤 USER | P2 | ↗ BienImage.position | ➕ | À créer |
| Suppression | 👤 USER | P1 | ↗ BienImage | ✅ | Bouton corbeille |
| Visite virtuelle URL | 👤 USER | P2 | 🏠 Bien.virtual_tour_url | ➕ | Matterport |

#### Side panel Intervention (A11.A.5)

→ Détail dans Sous-section Interventions plus bas.

### Sous-section : Annexes physiques (BienAnnexe)

URL : sous-section dédiée dans la modale Caractéristiques + accessible depuis sphère IA.

| Donnée par annexe | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Type annexe (cave/casier_ski/parking/box/garage/dépendance) | 👤 USER | P1 | 🏠 BienAnnexe.type | ➕ | Sélection visuelle (icônes) |
| Numéro annexe | 👤 USER | P1 | 🏠 BienAnnexe.numero | ➕ | Champ court optionnel |
| Étage annexe | 👤 USER | P1 | 🏠 BienAnnexe.etage | ➕ | Dropdown -2/-1/RC/1/.../N |
| Surface annexe m² | 👤 USER | P1 | 🏠 BienAnnexe.surface | ➕ | Optionnel |
| Mode parcage (parking only) | 👤 USER | P1 | 🏠 BienAnnexe.mode_parcage | ➕ | int/ext/couvert/box |
| Photos annexe | 👤 USER | P1 | ↗ BienImage avec category=type annexe | ✅ étendre | Upload optionnel |
| Notes spécifiques | 👤 USER | P2 | 🏠 BienAnnexe.notes | ➕ | Texte libre |

### Sous-section : Sécurité opérationnelle

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Nombre de clés totales | 👤 USER | P1 | 🏠 Bien.keys_count | ✅ | Default 3, +/- |
| Description clés | 👤 USER | P1 | 🏠 Bien.keys_description | ➕ | Texte court ex « 2 portes + 1 BAL + 1 cave » |
| Numéro badge immeuble | 👤 USER | P1 | 🏠 Bien.numero_badge | ➕ | Optionnel |
| Code digicode immeuble | 👤 USER | P1 | 🏠 Bien.code_digicode | ➕ | **Sensible : masqué + chiffré** |
| Code serrure temporaire | 🤖 AUTO | P5+ | 🏠 Bien.code_serrure_temp | ➕ | Saisonnier nuitée uniquement |

### Sous-section : Compteurs (BienCompteur — table 1:N)

| Donnée par compteur | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Type compteur (eau/élec/gaz/chaleur) | 👤 USER | P1 | 🏠 BienCompteur.type | ➕ | Dropdown |
| Numéro compteur | 🧠 IA | P1 | 🏠 BienCompteur.numero | ➕ | OCR photo compteur |
| Relevé entrée locataire | 🧠 IA | P1 | 🏠 BienCompteur.releve_entree | ➕ | OCR photo |
| Relevé sortie locataire | 🧠 IA | P1 | 🏠 BienCompteur.releve_sortie | ➕ | OCR photo |
| Date relevé | 🤖 AUTO | P1 | 🏠 BienCompteur.date_releve | ➕ | Auto |
| Photo justificative | 👤 USER | P1 | ↗ Document | ➕ | Upload + OCR |

### Sous-section : Contacts du bien (BienContact)

URL : carré dédié ou sous-section modale + accessible depuis sphère IA.

| Donnée par contact | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Type contact (régie/concierge/agence/garant/fournisseur/autre) | 👤 USER | P1 | 🏠 BienContact.type | ➕ | Sélection visuelle |
| Lien user (si user Althy) | 🤖 AUTO | P1 | 🏠 BienContact.user_id | ➕ | Autocomplete users existants → pas de saisie |
| Nom contact | 👤 USER | P1 | 🏠 BienContact.nom | ➕ | Saisie nom régie ex |
| Téléphone | 🧠 IA | P1 | 🏠 BienContact.telephone | ➕ | Sphère IA scrape web depuis nom |
| Email | 🧠 IA | P1 | 🏠 BienContact.email | ➕ | Idem scraping |
| Adresse | 🧠 IA | P1 | 🏠 BienContact.adresse | ➕ | Idem |
| Notes libres | 👤 USER | P2 | 🏠 BienContact.notes | ➕ | Optionnel |
| Date début rôle | 🤖 AUTO | P1 | 🏠 BienContact.start_date | ➕ | Default création |
| Date fin rôle | 👤 USER | P1 | 🏠 BienContact.end_date | ➕ | Optionnel |

### Sous-section : Valorisation (P3-4 — module IA)

URL : carré dédié quand activé en P3.

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Estimation valeur 2030 | 🧠 IA | P3 | calcul | ➕ | Tendance ville + projections |
| COS restant constructible | 🤖 AUTO | P3 | API VSGIS | ➕ | Cadastre VSGIS |
| Possibilité agrandissement (m²) | 🔗 DÉDUIT | P3 | calcul | ➕ | COS - bâti existant |
| Surélévation possible | 🧠 IA | P3 | calcul | ➕ | Règlement communal + photos |
| Division lots PPE possible | 🧠 IA | P3 | calcul | ➕ | Surface + plans + règlement |
| Estimation gain post-travaux | 🧠 IA | P3 | DB Althy | ➕ | Comparables après-travaux |
| Comparables vendus 12 derniers mois | 🤖 AUTO | P3 | DB Althy | ➕ | Registre foncier + scraping |
| Prix marché m² actuel zone | 🤖 AUTO | P2 | DB Althy | ➕ | DB propriétaire |
| Évolution prix m² 5 ans | 🤖 AUTO | P2 | DB Althy | ➕ | Historique |
| Score d'opportunité | 🧠 IA | P3 | calcul | ➕ | IA croise tous signaux |
| Cadastre VSGIS lié | 🤖 AUTO | P3 | API | ➕ | Lien direct |
| Risques (zone inondable, glissement, bruit) | 🤖 AUTO | P3 | API VSGIS + dangers naturels | ➕ | Couches publiques |
| Servitudes inscrites | 🤖 AUTO | P3 | API registre foncier | ➕ | Données publiques |

### Sous-section : Maintenance prédictive (P3 — module IA)

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Pannes anticipées | 🧠 IA | P3 | calcul | ➕ | Âge équipement + historique |
| Calendrier entretien suggéré | 🤖 AUTO | P3 | calcul | ➕ | Templates par type équipement |
| Budget travaux 5 ans | 🧠 IA | P3 | calcul | ➕ | Projection IA |
| Économies énergie possibles | 🧠 IA | P3 | calcul | ➕ | DB Althy + subventions |
| Subventions cantonales applicables | 🤖 AUTO | P3 | DB Althy | ➕ | Mise à jour régulière |

### Sous-section : Marché local (P2 — module IA)

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Tension locative ville/canton | 🤖 AUTO | P2 | DB Althy | ➕ | % loués vs vacants |
| Délai relocation moyen | 🤖 AUTO | P2 | DB Althy | ➕ | Stats Althy |
| Profil locataire dominant | 🤖 AUTO | P3 | DB Althy | ➕ | Démographique |
| Concurrence directe (nb annonces) | 🤖 AUTO | P2 | scraping | ➕ | Lecture portails |
| Recommandations IA prix optimal | 🧠 IA | P2 | calcul | ➕ | IA croise marché + bien |

### Sous-section : Optimisation fiscale IA (P2 — module IA)

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Travaux à déduire 2026 | 🧠 IA | P2 | calcul | ➕ | IA classe WorkOrder selon AFC |
| Plafonds déductibles non utilisés | 🤖 AUTO | P2 | calcul | ➕ | Cantonal |
| Stratégie travaux pluri-annuelle | 🧠 IA | P3 | calcul | ➕ | IA propose timing optimal |
| Simulation impôts N+1 | 🧠 IA | P3 | calcul | ➕ | Estimation scénarios |
| Gain fiscal valorisation/vente | 🔗 DÉDUIT | P3 | calcul | ➕ | Calcul cantonal |
| Optimisation valeur locative | 🧠 IA | P3 | calcul | ➕ | IA détecte écart marché |

## SECTION UI : Locataires

URL : `/app/locataires`. Vue consolidée multi-biens. **Règle 1 clic** : tout est aussi accessible depuis la fiche bien.

### Sous-section : Liste locataires

| Donnée par carte locataire | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Avatar/initiales | 🤖 AUTO | P1 | ↗ User profil | ✅ | Default initiales |
| Nom complet | 🤖 AUTO | P1 | ↗ User profil | ✅ | Jointure |
| Bien associé (adresse courte) | 🤖 AUTO | P1 | ↗ Bien via Locataire.bien_id | ✅ | Affichage |
| Statut (actif / sorti / candidat) | 🤖 AUTO | P1 | ↗ Locataire.statut | ✅ | Filter |
| Bail (dates + jours restants) | 🤖 AUTO | P1 | ↗ Contract | ✅ | Calcul fin - aujourd'hui |
| Loyer mensuel | 🤖 AUTO | P1 | ↗ Contract.monthly_rent | ✅ | Affichage |
| Score solvabilité | 🤖 AUTO | P1 | ↗ ScoringLocataire | ✅ | IA score |
| Statut paiement actuel | 🤖 AUTO | P1 | ↗ Transaction | ✅ | À jour / retard |
| Dernière interaction | 🤖 AUTO | P1 | ↗ Conversation | ✅ | Délai dernier message |
| CTA « Ouvrir fiche » | 🤖 AUTO | P1 | UI | ✅ | Side panel |
| CTA « Communiquer » | 🤖 AUTO | P1 | UI | ✅ | Pré-cible WhatsApp/email |

### Sous-section : Filtres et tri

| Filtre | Acquisition | Phase | Source | État |
|---|---|---|---|---|
| Filtrer actifs / sortis / candidats | 👤 USER | P1 | UI | ✅ |
| Filtrer par bien | 👤 USER | P1 | UI | ✅ |
| Filtrer par canton | 👤 USER | P2 | UI | ➕ |
| Filtrer par statut paiement | 👤 USER | P1 | UI | ➕ |
| Tri par date entrée / sortie / score | 👤 USER | P1 | UI | ✅ |

### Sous-section : Side panel détail locataire

URL : ouverture overlay 50% droite depuis carte ou fiche bien.

#### Identité locataire

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Nom + prénom | 🧠 IA | P1 | ↗ User profil locataire | ✅ | OCR pièce identité à l'inscription locataire |
| Date naissance | 🧠 IA | P1 | ↗ User profil | ✅ | OCR |
| Nationalité | 🧠 IA | P1 | ↗ User profil | ✅ | OCR pièce identité |
| Permis séjour (si étranger) | 🧠 IA | P1 | ↗ User profil + Document | ➕ | OCR + upload |
| Email | 🤖 AUTO | P1 | ↗ User.email | ✅ | Profil user |
| Téléphone | 🤖 AUTO | P1 | ↗ User.phone | ✅ | Profil user |
| Adresse précédente | 👤 USER | P1 | ↗ User profil locataire | ➕ | Saisie locataire à l'inscription |
| Photo profil | 👤 USER | P2 | ↗ User profil | ➕ | Optionnel |

#### Dossier locataire

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Type contrat travail | 👤 USER 🎯 | P1 | ↗ TenantFile.type_contrat | ✅ | Onboarding locataire |
| Employeur nom | 👤 USER 🎯 | P1 | ↗ TenantFile.employeur | ✅ | Onboarding locataire |
| Employeur adresse | 🧠 IA | P2 | ↗ TenantFile.employeur_adresse | ➕ | Scraping registre du commerce |
| Salaire mensuel | 🧠 IA | P1 | ↗ TenantFile.salaire | ✅ | OCR fiche salaire (chiffré) |
| 13e salaire | 🧠 IA | P1 | ↗ TenantFile.salaire_13 | ➕ | OCR |
| Date entrée poste actuel | 🧠 IA | P2 | ↗ TenantFile.date_entree_poste | ➕ | OCR contrat travail |
| Garant éventuel | 👤 USER | P1 | ↗ BienContact type=garant | ➕ | Optionnel |
| Score solvabilité IA | 🧠 IA | P1 | ↗ ScoringLocataire | ✅ | IA calcule depuis tout le dossier |

#### Documents locataire

| Document | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Pièce identité (recto/verso) | 👤 USER 🎯 | P1 | ↗ Document catégorie=identite | ✅ | Upload locataire 1 fois |
| Permis séjour (si étranger) | 👤 USER 🎯 | P1 | ↗ Document catégorie=permis | ➕ | Upload locataire |
| 3 fiches salaire récentes | 👤 USER | P1 | ↗ Document catégorie=fiche_salaire | ✅ | Upload locataire |
| Attestation employeur | 👤 USER | P1 | ↗ Document | ✅ | Upload locataire |
| Extrait poursuites | 👤 USER | P1 | ↗ Document catégorie=extrait_poursuites | ✅ | Upload locataire (gratuit en CH) |
| Attestation assurance RC | 👤 USER | P1 | ↗ Document catégorie=assurance | ➕ | Upload locataire |
| Bail signé | 🤖 AUTO | P1 | ↗ Document catégorie=bail | ✅ | Génération auto Althy |
| EDL entrée signé | 🤖 AUTO | P1 | ↗ Document catégorie=edl_entree | ✅ | Génération auto |
| Quittances mensuelles | 🤖 AUTO | P1 | ↗ Document catégorie=quittance | ✅ | Génération auto |
| EDL sortie signé | 🤖 AUTO | P1 | ↗ Document catégorie=edl_sortie | ✅ | Génération auto à la sortie |

#### Bail actuel

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Type bail | 🤖 AUTO | P1 | ↗ Contract.type | ✅ | Annuelle / saisonnière 4 mois |
| Date début | 👤 USER | P1 | ↗ Contract.start_date | ✅ | Datepicker |
| Date fin | 👤 USER | P1 | ↗ Contract.end_date | ✅ | Datepicker |
| Préavis (mois) | 🤖 AUTO | P1 | ↗ Contract.preavis | ✅ | Default 3 mois CO |
| Loyer mensuel | 👤 USER | P1 | ↗ Contract.monthly_rent | ✅ | **Source vérité légale** |
| Charges mensuelles | 👤 USER | P1 | ↗ Contract.charges | ✅ | Cible négociée |
| Caution montant | 🤖 AUTO | P1 | ↗ Contract.deposit | ✅ | Default 3× loyer |
| Indexation IPC clause | 👤 USER | P1 | ↗ Contract.indexation_clause | ➕ | Toggle |
| Taux hypothécaire référence | 🤖 AUTO | P1 | ↗ Contract.taux_hypothecaire_ref | ➕ | API BNS |
| IPC référence | 🤖 AUTO | P1 | ↗ Contract.ipc_ref | ➕ | API OFS |
| Conditions spécifiques | 👤 USER | P1 | ↗ Contract.conditions | ➕ | Texte libre |

#### Paiements locataire

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Liste loyers (passés + à venir) | 🤖 AUTO | P1 | ↗ Transaction filter tenant | ✅ | Calcul auto échéances |
| Statut chaque loyer | 🤖 AUTO | P1 | ↗ Transaction.status | ✅ | Reçu/attente/retard |
| Total payé année courante | 🔗 DÉDUIT | P1 | calcul | ➕ | Sum |
| Retards historiques (nombre + cumul jours) | 🔗 DÉDUIT | P1 | calcul | ➕ | Stat |
| Mode paiement (QR direct / Stripe / autre) | 🤖 AUTO | P1 | ↗ Transaction.mode | ✅ | Affichage |

#### Caution locataire

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Type (cash / compte bloqué / organisme) | 👤 USER | P1 | ↗ Caution.type | ✅ | Dropdown 3 options |
| Montant | 🤖 AUTO | P1 | ↗ Caution.amount | ✅ | Reflet Contract.deposit |
| IBAN compte bloqué (si type=compte_bloqué) | 👤 USER | P1 | ↗ Caution.iban_compte_bloque | ➕ | Saisie locataire |
| Organisme (FirstCaution/GoCaution/Swisscaution) | 👤 USER | P1 | ↗ Caution.organisme | ➕ | Dropdown |
| Date réception | 📩 EXTERNE | P1 | ↗ Caution.received_at | ➕ | CAMT auto |
| Statut caution | 🤖 AUTO | P1 | ↗ Caution.status | ➕ | Versée/en libération/restituée |
| Document attestation | ↗ Document | P1 | ↗ Document | ✅ | OCR ou génération |

#### Communication locataire

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Historique conversations | 🤖 AUTO | P1 | ↗ Conversation | ✅ | Filter participants |
| Canal préféré | 👤 USER | P2 | ↗ User.notif_* | ✅ | Email/SMS/WhatsApp |
| Dernière interaction | 🤖 AUTO | P1 | calcul | ✅ | Délai |
| CTA « Envoyer message » | 👤 USER | P1 | UI | ✅ | Multi-canal P2 |

#### Action 1 clic depuis side panel locataire

| Action | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Modifier locataire | 👤 USER | P1 | UI | ➕ | Édition inline |
| Démarrer changement locataire | 👤 USER | P1 | UI | ✅ | Workflow Sprint 12 |
| Générer quittance manuelle | 🤖 AUTO | P1 | UI | ✅ | Sphère IA |
| Envoyer relance | 👤 USER | P1 | UI | ➕ | Workflow Reminder |
| Modifier caution | 👤 USER | P1 | UI | ➕ | **Règle 1 clic** depuis ici |
| Voir bail PDF | 🤖 AUTO | P1 | UI | ✅ | Preview |

---

## SECTION UI : Finances

URL : `/app/finances`. Vue multi-biens consolidée. **Règle 1 clic** : tout aussi accessible depuis fiche bien.

### Sous-section : Tableau de bord finances

#### Carrés KPI principaux (3×2)

| Carré | Donnée | Acquisition | Phase | Source | État |
|---|---|---|---|---|---|
| **Revenus** | Total revenus mois courant | 🤖 AUTO | P1 | ↗ Transaction | ✅ |
| | Évolution vs mois précédent | 🔗 DÉDUIT | P1 | calcul | ➕ |
| | Détail loyers / divers | 🔗 DÉDUIT | P1 | calcul | ➕ |
| **Charges** | Total charges mois | 🤖 AUTO | P1 | ↗ Transaction + ChargeLine | ➕ |
| | Évolution vs précédent | 🔗 DÉDUIT | P1 | calcul | ➕ |
| | Top 3 catégories | 🔗 DÉDUIT | P1 | calcul | ➕ |
| **Net** | Revenus - Charges - Commission | 🔗 DÉDUIT | P1 | calcul | ✅ |
| | Évolution % | 🔗 DÉDUIT | P1 | calcul | ➕ |
| | Cash disponible | 🔗 DÉDUIT | P1 | calcul | ➕ |
| **Rendement** | Rendement net moyen tous biens | 🔗 DÉDUIT | P1 | calcul | ➕ |
| | Comparaison vs marché ville | 🤖 AUTO | P2 | DB Althy | ➕ |
| **Comptes** | Solde total comptes bancaires | 📩 EXTERNE | P2 | ↗ BankAccount | ➕ |
| | Détail par compte | 📩 EXTERNE | P2 | ↗ BankAccount | ➕ |
| **Fiscalité** | Année fiscale en cours | 🤖 AUTO | P2 | calcul | ➕ |
| | Revenus déclarables | 🔗 DÉDUIT | P2 | calcul | ➕ |
| | Déductions estimées | 🧠 IA | P2 | calcul | ➕ |
| | Net imposable estimé | 🔗 DÉDUIT | P2 | calcul | ➕ |

#### Graphiques (style scientifique)

| Graphique | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Courbe revenus 12 mois glissants | 🤖 AUTO | P1 | ↗ Transaction | ➕ | Ligne avec marqueurs |
| Courbe charges 12 mois | 🤖 AUTO | P1 | ↗ ChargeLine + Transaction | ➕ | Ligne |
| Donut répartition charges par catégorie | 🤖 AUTO | P1 | ↗ ChargeLine | ➕ | Donut |
| Barres comparaison N vs N-1 | 🤖 AUTO | P2 | calcul | ➕ | Barres groupées |
| Cash-flow projeté 6 mois | 🧠 IA | P2 | calcul | ➕ | Ligne projection |

### Sous-section : Décompte propriétaire (OwnerStatement)

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Périodicité (mensuel/trimestriel/annuel) | 👤 USER 🎯 | P1 | 🏠 OwnerStatement.periode | ➕ | Setup 1 fois |
| Date génération | 🤖 AUTO | P1 | 🏠 OwnerStatement.generated_at | ➕ | Auto fin période |
| Lignes revenus | 🤖 AUTO | P1 | calcul Transaction | ➕ | Loyers + parking + divers |
| Lignes déductions | 🤖 AUTO | P1 | calcul Transaction + ChargeLine | ➕ | Commission Althy / artisans / charges PPE / assurance / bancaires / taxe séjour / commissions plateformes / contentieux / fonds réserve |
| Solde à reverser | 🔗 DÉDUIT | P1 | calcul | ➕ | Auto |
| Date versement effectif | 📩 EXTERNE | P1 | ↗ BankTransaction | ➕ | CAMT auto |
| PDF généré | 🤖 AUTO | P1 | ↗ Document | ➕ | Génération auto |
| Validation propriétaire | 👤 USER | P1 | 🏠 OwnerStatement.validated_at | ➕ | 1 clic « Valider » |
| Justificatifs joints | 🤖 AUTO | P1 | ↗ Document collection | ➕ | Auto-collecte |
| Version décompte | 🤖 AUTO | P1 | 🏠 OwnerStatement.version | ➕ | Si modifications |
| Export comptable Bexio/Banana/AbaWeb | 🤖 AUTO | P2 | ↗ AccountingExport | ➕ | API push |
| Export PDF récapitulatif | 🤖 AUTO | P1 | ↗ Document | ➕ | Bouton export |

### Sous-section : Loyers et paiements

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Liste transactions année courante | 🤖 AUTO | P1 | ↗ Transaction | ✅ | Filter période |
| Filtres (bien / type / statut / mois) | 👤 USER | P1 | UI | ➕ | Multi-filtre |
| QR-IBAN génération | 🤖 AUTO | P1 | calcul | ➕ | Algo standard SPC 2.0 |
| QR-facture mensuelle | 🤖 AUTO | P1 | ↗ Document | ➕ | Génération auto J-7 |
| Référence QR / SCOR | 🤖 AUTO | P1 | calcul | ➕ | Algo |
| Matching CAMT.054 | 🤖 AUTO | P1 | ↗ BankMatching | ➕ | Auto sur référence + montant |
| Matching manuel (si ambigu) | 👤 USER | P1 | UI | ➕ | Drag-and-drop ligne CAMT |
| Net après commission Althy | 🔗 DÉDUIT | P1 | calcul | ✅ | Affichage transparent |
| Mode dégradé QR direct (commission 0%) | 👤 USER | P1 | ↗ Bien.matching_active | ➕ | Toggle |

### Sous-section : Relances et contentieux

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Liste relances actives | 🤖 AUTO | P1 | ↗ Reminder | ➕ | Filter status |
| Niveau (R1 / R2 / mise en demeure) | 🤖 AUTO | P1 | ↗ Reminder.level | ➕ | Workflow auto |
| Date envoi | 🤖 AUTO | P1 | ↗ Reminder.sent_at | ➕ | Auto |
| Frais rappel | 🤖 AUTO | P1 | ↗ Reminder.frais_rappel | ➕ | Default canton |
| Intérêts moratoires | 🔗 DÉDUIT | P1 | calcul | ➕ | Auto 5% loi |
| PDF généré | 🤖 AUTO | P1 | ↗ Document | ➕ | Template + IA |
| Statut (active/résolue/contentieux) | 🤖 AUTO | P1 | ↗ Reminder.status | ➕ | Workflow |
| Blocage compte client | 👤 USER | P2 | ↗ Reminder.blocked | ➕ | 1 clic décision |
| Lien commission conciliation | 👤 USER | P2 | ↗ WorkOrder | ➕ | Workflow contestation |

### Sous-section : Caution

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Liste cautions actives | 🤖 AUTO | P1 | ↗ Caution | ➕ | Filter status=versée |
| Total bloqué | 🔗 DÉDUIT | P1 | calcul | ➕ | Sum |
| Cautions à libérer (sortie locataire) | 🤖 AUTO | P1 | ↗ Caution + Contract.end_date | ➕ | Alerte 30j |
| Workflow restitution | 👤 USER | P1 | UI | ➕ | Étapes : EDL sortie → calcul retenues → libération |
| Retenues (dégâts/impayés/charges/nettoyage/clés/annulation) | 👤 USER | P1 | ↗ CautionRetenue | ➕ | Form sortie locataire |
| Document libération PDF | 🤖 AUTO | P1 | ↗ Document | ➕ | Génération auto |

### Sous-section : Charges détaillées (ChargeLine)

| Donnée par ligne | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Catégorie (élec/eau/chauffage/internet/TV/ascenseur/nettoyage/poubelles/PPE/autre) | 👤 USER | P1 | 🏠 ChargeLine.category | ➕ | Sélection visuelle |
| Montant | 🧠 IA | P1 | 🏠 ChargeLine.montant | ➕ | OCR facture uploadée |
| Récurrence (mensuelle/trimestrielle/annuelle/one-shot) | 🧠 IA | P1 | 🏠 ChargeLine.recurrence | ➕ | IA détecte après 2-3 occurrences |
| Qui paie (proprio/locataire/partagé) | 👤 USER 🎯 | P1 | 🏠 ChargeLine.who_pays | ➕ | Onboarding charge, IA suggère |
| Inclus dans loyer | 👤 USER | P1 | 🏠 ChargeLine.included_in_rent | ➕ | Toggle |
| Type chauffage (élec/PPE/gaz) | 👤 USER 🎯 | P1 | 🏠 ChargeLine.heating_type | ➕ | 1 fois par bien |
| Reprise contrat existant possible | 👤 USER | P2 | 🏠 ChargeLine.is_resumable | ➕ | Pour internet existant |
| Justificatifs liés | 👤 USER | P1 | ↗ Document | ➕ | Upload + OCR |
| Décompte annuel généré | 🤖 AUTO | P1 | ↗ ChargeStatement | ➕ | Auto fin année locative |

### Sous-section : Décompte de charges (ChargeStatement)

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Période concernée | 🤖 AUTO | P1 | 🏠 ChargeStatement.periode | ➕ | Année locative |
| Acomptes locataire | 🤖 AUTO | P1 | calcul Transaction | ➕ | Sum charges encaissées |
| Charges réelles | 🤖 AUTO | P1 | calcul ChargeLine | ➕ | Sum |
| Solde régularisation | 🔗 DÉDUIT | P1 | calcul | ➕ | Rendre ou demander complément |
| Clé répartition | 👤 USER 🎯 | P1 | 🏠 ChargeStatement.cle | ➕ | Surface/millièmes/compteur/forfait, 1 fois par bien |
| Prorata entrée locataire | 🤖 AUTO | P1 | calcul Contract.start_date | ➕ | Auto |
| Prorata sortie locataire | 🤖 AUTO | P1 | calcul Contract.end_date | ➕ | Auto |
| Document PDF | 🤖 AUTO | P1 | ↗ Document | ➕ | Génération auto |
| Validation locataire | 👤 USER | P1 | 🏠 ChargeStatement.validated_at | ➕ | 1 clic locataire |
| Contestation locataire | 👤 USER | P2 | 🏠 ChargeContestation | ➕ | Workflow |
| Correction post-contestation | 👤 USER | P2 | 🏠 ChargeStatement.corrected | ➕ | Versioning |

### Sous-section : Indexation IPC (IndexationEvent)

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Bail concerné | 🤖 AUTO | P1 | ↗ Contract | ➕ | Liste actifs |
| Date application | 👤 USER | P1 | 🏠 IndexationEvent.date_application | ➕ | Datepicker, IA propose date min légale |
| Ancien loyer | 🤖 AUTO | P1 | ↗ Contract.monthly_rent actuel | ➕ | Affichage |
| Nouveau loyer | 🔗 DÉDUIT | P1 | calcul | ➕ | Calcul auto IPC + taux + travaux |
| Motif (IPC/taux/travaux plus-value) | 🤖 AUTO | P1 | calcul | ➕ | IA explique composition |
| Pourcentage IPC appliqué | 🤖 AUTO | P1 | API OFS | ➕ | Données publiques |
| Pourcentage taux hypothécaire | 🤖 AUTO | P1 | API BNS | ➕ | Données publiques |
| Plus-value travaux | 👤 USER | P1 | 🏠 IndexationEvent.plus_value_travaux | ➕ | Optionnel |
| Formule officielle PDF | 🤖 AUTO | P1 | ↗ Document | ➕ | Template cantonal officiel |
| Statut workflow (préparée/envoyée/acceptée/contestée) | 🤖 AUTO | P1 | 🏠 IndexationEvent.status | ➕ | Workflow A+R |
| Date acceptation locataire | 👤 USER | P1 | 🏠 IndexationEvent.accepted_at | ➕ | 1 clic ou délai expiration |

### Sous-section : Fiscalité (TaxStatement)

URL : module activé en P2.

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Année fiscale | 🤖 AUTO | P2 | 🏠 TaxStatement.year | ➕ | Calendrier |
| Revenus locatifs annuels | 🤖 AUTO | P2 | calcul Transaction | ➕ | Sum année |
| Frais déductibles | 🤖 AUTO | P2 | calcul ChargeLine + WorkOrder | ➕ | Selon AFC |
| Travaux entretien (déductibles) | 🧠 IA | P2 | calcul | ➕ | IA classe selon barème AFC |
| Travaux amélioration (non déductibles) | 🧠 IA | P2 | calcul | ➕ | IA classe |
| Intérêts hypothécaires | 🧠 IA | P2 | OCR attestation banque | ➕ | OCR annuel |
| Assurance bâtiment | 🤖 AUTO | P2 | ↗ ChargeLine | ➕ | Sum |
| Frais PPE | 🤖 AUTO | P2 | ↗ ChargeLine | ➕ | Sum |
| Frais gérance | 🤖 AUTO | P2 | ↗ ChargeLine + commission Althy | ➕ | Sum |
| Charges non récupérées | 🔗 DÉDUIT | P2 | calcul | ➕ | Auto |
| Impôt foncier | 🤖 AUTO | P2 | ↗ Bien.impot_foncier | ➕ | Reflet |
| Valeur locative | 🤖 AUTO | P2 | ↗ Bien.valeur_locative | ➕ | Reflet |
| Valeur fiscale | 🤖 AUTO | P2 | ↗ Bien.valeur_fiscale | ➕ | Reflet |
| Net imposable estimé | 🔗 DÉDUIT | P2 | calcul | ➕ | Auto |
| Ventilation par bien | 🤖 AUTO | P2 | calcul | ➕ | Auto |
| Ventilation par canton | 🤖 AUTO | P2 | calcul | ➕ | Auto |
| Export PDF + Excel fiduciaire | 🤖 AUTO | P2 | ↗ Document | ➕ | Bouton export |
| Pièces justificatives | 🤖 AUTO | P2 | ↗ Document collection | ➕ | Auto-collecte |

### Sous-section : Vue rentabilité

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Rendement brut par bien | 🔗 DÉDUIT | P1 | calcul | ➕ | Auto |
| Rendement net par bien | 🔗 DÉDUIT | P1 | calcul | ➕ | Auto |
| Cash-flow mensuel net | 🔗 DÉDUIT | P1 | calcul | ✅ | Auto |
| Comparaison N/N-1 | 🔗 DÉDUIT | P2 | calcul | ➕ | Évolution |
| Économies vs régie cumulées | 🔗 DÉDUIT | P1 | calcul | ➕ | Auto |
| Top 3 biens performants | 🔗 DÉDUIT | P2 | calcul | ➕ | Tri |
| Bottom 3 biens à améliorer | 🔗 DÉDUIT | P2 | calcul | ➕ | Tri |
| Suggestions IA d'amélioration | 🧠 IA | P2 | calcul | ➕ | Insights par bien |

---

## SECTION UI : Documents

URL : `/app/documents`. Coffre-fort multi-biens. **Règle 1 clic** : aussi accessible depuis fiche bien.

### Sous-section : Tableau de bord coffre-fort

#### Carrés par catégorie auto-générés

| Carré catégorie | Donnée | Acquisition | Phase | Source | État |
|---|---|---|---|---|---|
| **Baux** | Compteur actifs | 🤖 AUTO | P1 | ↗ Document filter | ✅ | |
| | Baux expirant cette année | 🤖 AUTO | P1 | calcul Document.expires_at | ➕ | |
| | Baux indexables | 🤖 AUTO | P1 | calcul Contract | ➕ | |
| **EDL** | Total entrées + sorties | 🤖 AUTO | P1 | ↗ Document filter | ✅ | |
| | Dernière date | 🤖 AUTO | P1 | ↗ Document.created_at | ✅ | |
| | Tous signés | 🤖 AUTO | P1 | ↗ Document.signed_at | ➕ | |
| **Quittances** | Compteur émises | 🤖 AUTO | P1 | ↗ Document | ✅ | |
| | Mois courant | 🤖 AUTO | P1 | calcul | ➕ | |
| | Toutes payées | 🔗 DÉDUIT | P1 | calcul Transaction | ➕ | |
| **Assurances** | Polices actives | 🤖 AUTO | P1 | ↗ Document | ➕ | |
| | Bientôt expirées | 🤖 AUTO | P1 | ↗ Document.expires_at | ➕ | |
| | Cumul prime annuelle | 🔗 DÉDUIT | P1 | calcul | ➕ | |
| **Fiscal** | Total documents | 🤖 AUTO | P2 | ↗ Document | ➕ | |
| | Dernière déclaration | 🤖 AUTO | P2 | ↗ Document | ➕ | |
| | Cadastres (si uploadés) | 🤖 AUTO | P2 | ↗ Document | ➕ | |
| **Autres** | Devis / factures / divers | 🤖 AUTO | P1 | ↗ Document | ➕ | |

### Sous-section : Recherche et filtres

| Fonction | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Recherche full-text OCR | 🧠 IA | P2 | ↗ Document.ocr_content | ➕ | OCR à upload + recherche |
| Filtre catégorie | 👤 USER | P1 | UI | ✅ | Multi-select |
| Filtre par bien | 👤 USER | P1 | UI | ✅ | Filter context |
| Filtre par contrat / locataire | 👤 USER | P1 | UI | ➕ | FK polymorphe |
| Filtre par date | 👤 USER | P1 | UI | ✅ | Range |
| Filtre par tag | 👤 USER | P2 | UI | ➕ | Multi-select |
| Filtre par confidentialité | 👤 USER | P1 | UI | ➕ | Interne/proprio/locataire/public |
| Tri (date / nom / taille) | 👤 USER | P1 | UI | ✅ | Configurable |

### Sous-section : Liste documents (vue détail)

| Donnée par document | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Nom fichier | 👤 USER | P1 | 🏠 Document.filename | ✅ | Saisi à l'upload ou auto |
| Catégorie | 🧠 IA | P1 | 🏠 Document.category | ✅ | IA classe à l'upload |
| Contexte (bien/contrat/intervention/locataire) | 🧠 IA | P1 | 🏠 Document.context_type + context_id | ➕ | IA détermine |
| Date upload | 🤖 AUTO | P1 | 🏠 Document.created_at | ✅ | Auto |
| Date validité / expiration | 🧠 IA | P1 | 🏠 Document.expires_at | ➕ | OCR détecte |
| Version | 🤖 AUTO | P1 | 🏠 Document.version | ➕ | Auto-incrément |
| Tags | 🧠 IA | P1 | 🏠 Document.tags | ➕ | IA suggère |
| Signature électronique | 📩 EXTERNE | P2 | 🏠 Document.signed_at | ➕ | Skribble.ch / Swiss Sign |
| Confidentialité | 🤖 AUTO | P1 | 🏠 Document.confidentiality | ➕ | Default selon catégorie |
| Taille fichier | 🤖 AUTO | P1 | 🏠 Document.size | ✅ | Auto |
| Format (PDF/JPG/PNG/DOCX) | 🤖 AUTO | P1 | 🏠 Document.mime_type | ✅ | Auto |
| Actions (preview / télécharger / partager / supprimer) | 👤 USER | P1 | UI | ✅ | Menu |

### Sous-section : Modale preview document

| Fonction | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Aperçu PDF/image | 🤖 AUTO | P1 | UI | ✅ | Embed |
| Téléchargement | 🤖 AUTO | P1 | UI | ✅ | Bouton |
| Partager (lien sécurisé temporaire) | 👤 USER | P2 | UI | ➕ | Generate signed URL |
| Modifier métadonnées | 👤 USER | P1 | UI | ➕ | Catégorie/tags/contexte |
| Voir versions précédentes | 👤 USER | P2 | ↗ Document.version | ➕ | Historique |
| Voir journal consultation | 👤 USER | P2 | ↗ DocumentAccess | ➕ | Qui a vu quand |
| Supprimer (avec audit) | 👤 USER | P1 | UI | ✅ | Soft delete + audit log |

### Sous-section : Génération de documents IA

#### Templates disponibles

| Template | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Bail standard cantonal (VD/GE/VS/FR/NE/JU) | 🤖 AUTO | P1 | 🏠 DocumentTemplate | ✅ | Catalogue Althy |
| Quittance mensuelle | 🤖 AUTO | P1 | 🏠 DocumentTemplate | ✅ | |
| EDL entrée | 🤖 AUTO | P1 | 🏠 DocumentTemplate | ✅ | |
| EDL sortie | 🤖 AUTO | P1 | 🏠 DocumentTemplate | ✅ | |
| Attestation bail | 🤖 AUTO | P1 | 🏠 DocumentTemplate | ✅ | |
| Attestation domicile | 🤖 AUTO | P1 | 🏠 DocumentTemplate | ✅ | |
| Attestation IFD proprio | 🤖 AUTO | P1 | 🏠 DocumentTemplate | ✅ | |
| Relance R1 / R2 / mise en demeure | 🤖 AUTO | P1 | 🏠 DocumentTemplate | ✅ | |
| Formule officielle indexation | 🤖 AUTO | P1 | 🏠 DocumentTemplate | ➕ | Cantonal |
| Décompte propriétaire | 🤖 AUTO | P1 | 🏠 DocumentTemplate | ➕ | |
| Décompte de charges | 🤖 AUTO | P1 | 🏠 DocumentTemplate | ➕ | |
| Annonce locative | 🧠 IA | P1 | 🏠 DocumentTemplate | ➕ | Génération IA |
| Mandat de vente (P4) | 🤖 AUTO | P4 | 🏠 DocumentTemplate | ➕ | |
| Acte vente (P4) | 🤖 AUTO | P4 | 🏠 DocumentTemplate | ➕ | |

#### Workflow génération

| Étape | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Choix template | 👤 USER | P1 | UI | ✅ | Dropdown |
| Variables remplies | 🤖 AUTO | P1 | calcul Bien + Contract + Locataire | ✅ | Auto |
| Variables manquantes | 👤 USER | P1 | UI | ✅ | Form complement |
| Preview | 🤖 AUTO | P1 | UI | ✅ | Aperçu |
| Disclaimer IA inclus | 🤖 AUTO | P1 | 🏠 Document.disclaimer_included | ✅ | Auto |
| Validation et signature | 👤 USER | P1 | UI | ✅ | 1 clic |
| Envoi automatique destinataire | 🤖 AUTO | P1 | UI | ✅ | Email/SMS |

---

## SECTION UI : Interventions

URL : `/app/interventions`. Vue consolidée multi-biens. **Règle 1 clic** : aussi accessible depuis fiche bien.

### Sous-section : Vue Kanban (default)

| Colonne | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| **À faire** | Liste WorkOrder.statut=nouveau | 🤖 AUTO | P1 | ↗ WorkOrder | ✅ | Filter |
| **En cours** | Liste WorkOrder.statut=en_cours | 🤖 AUTO | P1 | ↗ WorkOrder | ✅ | |
| **En attente** | Liste WorkOrder.statut=planifie ou attente_devis | 🤖 AUTO | P1 | ↗ WorkOrder | ✅ | |
| **Résolues** | Liste WorkOrder.statut=resolu | 🤖 AUTO | P1 | ↗ WorkOrder | ✅ | |
| Drag-and-drop changement statut | 👤 USER | P1 | UI | ➕ | Kanban interactif |

### Sous-section : Vue liste (toggle)

| Donnée par ligne | Acquisition | Phase | Source | État |
|---|---|---|---|---|
| Titre intervention | 🤖 AUTO | P1 | ↗ WorkOrder.titre | ✅ |
| Bien associé | 🤖 AUTO | P1 | ↗ Bien | ✅ |
| Catégorie + urgence | 🤖 AUTO | P1 | ↗ WorkOrder.categorie + urgence | ✅ |
| Statut | 🤖 AUTO | P1 | ↗ WorkOrder.statut | ✅ |
| Avancement % | 🤖 AUTO | P1 | ↗ WorkOrder.avancement | ✅ |
| Artisan assigné | 🤖 AUTO | P2 | ↗ WorkOrder.artisan_id | ✅ |
| Coût estimé / réel | 🤖 AUTO | P1 | ↗ WorkOrder.cout + Quote | ✅ |
| Date intervention | 🤖 AUTO | P1 | ↗ WorkOrder.date_intervention | ✅ |
| Action 1 clic « Ouvrir » | 👤 USER | P1 | UI | ➕ | Side panel |

### Sous-section : Side panel intervention (A11.A.5)

#### Détails

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Titre + description | 👤 USER | P1 | ↗ WorkOrder.titre + description | ✅ | Sphère IA structure |
| Catégorie (7 valeurs) | 👤 USER | P1 | ↗ WorkOrder.categorie | ✅ | Dropdown |
| Urgence (4 valeurs) | 👤 USER | P1 | ↗ WorkOrder.urgence | ✅ | Dropdown coloré |
| Statut (4 valeurs) | 👤 USER | P1 | ↗ WorkOrder.statut | ✅ | Dropdown |
| Avancement (slider 0-100) | 👤 USER | P1 | ↗ WorkOrder.avancement | ✅ | Slider |
| Date signalement | 🤖 AUTO | P1 | ↗ WorkOrder.date_signalement | ✅ | Auto création |
| Date intervention prévue | 👤 USER | P1 | ↗ WorkOrder.date_intervention | ✅ | Datepicker |
| Date résolution | 🤖 AUTO | P1 | ↗ WorkOrder.date_resolution | ➕ | Auto au statut=resolu |
| Coût estimé | 🤖 AUTO | P1 | ↗ Quote acceptée | ✅ | Reflet devis |
| Coût réel | 👤 USER | P1 | ↗ WorkOrder.cout_reel | ➕ | Saisi à la clôture |
| Artisan assigné | 🧠 IA | P2 | ↗ WorkOrder.artisan_id | ✅ | IA suggère |
| Garantie travaux (date fin) | 👤 USER | P2 | ↗ WorkOrder.warranty_until | ➕ | Default 24 mois |

#### Photos avant/après

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Photos avant | 👤 USER | P1 | ↗ Document filter context=workorder + tag=avant | ✅ | Upload + IA tag |
| Photos après | 👤 USER | P1 | ↗ Document filter | ✅ | Idem |
| Reconnaissance auto avant/après | 🧠 IA | P1 | UI | ➕ | Vision IA + prompt |

#### Devis liés (Quote consolidé)

| Donnée par devis | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Lien intervention | 🤖 AUTO | P1 | ↗ Quote.workorder_id | ♻️ | FK consolidé |
| Artisan | 🤖 AUTO | P2 | ↗ ProfileArtisan | ✅ | Jointure |
| Montant TTC | 🧠 IA | P2 | ↗ Quote.montant | ✅ | OCR PDF si reçu hors marketplace |
| TVA | 🤖 AUTO | P2 | ↗ Quote.tva | ➕ | Default 8.1% |
| Description prestation | 👤 USER | P2 | ↗ Quote.description | ✅ | Artisan saisit |
| Statut (en_attente/accepté/refusé) | 👤 USER | P2 | ↗ Quote.statut | ✅ | Proprio 1 clic |
| Date envoi | 🤖 AUTO | P2 | ↗ Quote.date_envoi | ✅ | Auto |
| Date réponse | 🤖 AUTO | P2 | ↗ Quote.date_reponse | ✅ | Auto |
| Comparaison IA (rapport) | 🧠 IA | P2 | ↗ Quote.ai_comparison | ✅ | Existante RFQ |
| Document devis PDF | 🤖 AUTO | P2 | ↗ Document | ➕ | Génération auto |

#### Journal événements (audit log intervention)

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Timeline événements | 🤖 AUTO | P1 | ↗ AuditLog | ➕ | Auto |
| Types événements (création/modif statut/avancement/devis ajouté/photo ajoutée/clôture) | 🤖 AUTO | P1 | ↗ AuditLog.event_type | ➕ | Mapping libellés |
| Auteur événement | 🤖 AUTO | P1 | ↗ AuditLog.actor_id | ➕ | Affichage nom |

#### Notes / chat artisan

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Notes internes proprio | 👤 USER | P1 | ↗ WorkOrderComment.is_internal | ➕ | Texte libre |
| Chat avec artisan | 👤 USER | P2 | ↗ WorkOrderComment | ➕ | Conversation in-app |
| Pièces jointes | 👤 USER | P2 | ↗ Document | ➕ | Upload |

#### Marketplace M1 (stub disabled jusqu'à activation)

| Action | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Demander un devis marketplace | 🧠 IA | P2 | UI | ➕ | Disabled stub jusqu'activation |
| Comparer devis IA | 🧠 IA | P2 | ↗ Quote.ai_comparison | ✅ | Auto si 2+ devis |
| Régler artisan via Stripe Connect | 📩 EXTERNE | P2 | API Stripe | ✅ | Existant |

### Sous-section : Maintenance prédictive (P3)

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Pannes anticipées par bien | 🧠 IA | P3 | calcul | ➕ | Croisement âge équipement + historique |
| Recommandations entretien | 🤖 AUTO | P3 | calcul | ➕ | Templates par type équipement |
| Budget travaux 5 ans estimé | 🧠 IA | P3 | calcul | ➕ | Projection IA |
| Subventions cantonales applicables | 🤖 AUTO | P3 | DB Althy | ➕ | Mise à jour régulière |

---

## SECTION UI : Annonces et candidatures

URL : `/app/annonces`. Gestion mise en location.

### Sous-section : Annonces actives

| Donnée par annonce | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Lien bien | 🤖 AUTO | P1 | ↗ Bien.id | ✅ | FK |
| Statut (brouillon/actif/pause/archivé) | 👤 USER | P1 | ↗ Listing.status | ✅ | Toggle |
| Titre annonce | 🧠 IA | P1 | ↗ Listing.titre | ✅ | IA génère |
| Description courte | 🧠 IA | P1 | ↗ Listing.description_courte | ✅ | IA génère |
| Description longue | 🧠 IA | P1 | ↗ Listing.description_longue | ✅ | IA génère |
| Prix affiché | 🤖 AUTO | P1 | ↗ Listing.prix_affiche | ✅ | Reflet Bien.loyer cible |
| Disponibilité date | 🤖 AUTO | P1 | ↗ Listing.dispo_date | ✅ | Déduit Contract |
| Adresse anonymisée | 🤖 AUTO | P1 | ↗ Listing.adresse_affichee | ✅ | Default |
| Photos sélectionnées (subset BienImage) | 👤 USER | P1 | ↗ Listing.image_ids | ➕ | Multi-select |
| Plans | 🧠 IA | P1 | ↗ Document filter category=plan | ✅ | OCR plan PDF |
| Visite virtuelle URL | 👤 USER | P2 | ↗ Bien.virtual_tour_url | ➕ | Optionnel |
| Stats vues | 📩 EXTERNE | P2 | ↗ Listing.views_count | ➕ | Tracking |
| Stats contacts | 🤖 AUTO | P2 | ↗ Candidature compteur | ➕ | Compteur |

### Sous-section : Diffusion multi-portails (P2 — 4 packs)

| Donnée par canal | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Pack actif (Découverte/Standard/Pro/Premium) | 👤 USER | P2 | ↗ User.diffusion_pack | ➕ | Choix abo |
| Liste canaux activés | 🤖 AUTO | P2 | ↗ ListingChannel | ➕ | Selon pack |
| Statut publication par canal | 📩 EXTERNE | P2 | ↗ ListingChannel.status | ➕ | API portail |
| ID externe sur portail | 📩 EXTERNE | P2 | ↗ ListingChannel.external_id | ➕ | Retour API |
| Coût mensuel cumulé | 🤖 AUTO | P2 | calcul Plan | ➕ | Auto |
| Stats vues / contacts / CTR par canal | 📩 EXTERNE | P2 | ↗ ListingChannel.stats | ➕ | API portail |

**Packs** :
- **Découverte** (CHF 0 inclus) : Althy + Flatfox
- **Standard** (CHF 9) : + 1 canal au choix (Homegate OU ImmoScout24)
- **Pro** (CHF 19) : + Homegate + ImmoScout24 + immobilier.ch
- **Premium** (CHF 29) : tous canaux + boost IA + remontée prioritaire

### Sous-section : Candidatures reçues

| Donnée par candidature | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Lien annonce | 🤖 AUTO | P1 | ↗ Candidature.listing_id | ✅ | FK |
| Candidat (User) | 🤖 AUTO | P1 | ↗ User profil | ✅ | Jointure |
| Statut (soumise/en cours/acceptée/refusée) | 🤖 AUTO | P1 | ↗ Candidature.statut | ✅ | Workflow |
| Date soumission | 🤖 AUTO | P1 | ↗ Candidature.created_at | ✅ | Auto |
| Score IA candidat | 🧠 IA | P1 | ↗ ScoringLocataire | ✅ | Calcul auto |
| Score matching profil idéal (P2) | 🧠 IA | P2 | calcul | ➕ | IA croise bien + dossier |
| Dossier complet (oui/non) | 🤖 AUTO | P1 | calcul | ✅ | Tous documents requis présents |
| Documents soumis | 📩 EXTERNE | P1 | ↗ Document upload candidat | ✅ | Candidat upload |
| Frais dossier 45 CHF (statut paiement) | 🤖 AUTO | P1 | ↗ Candidature.owner_fee_* | ✅ | Stripe off-session à acceptation |
| Lien futur Locataire (si acceptée) | 🤖 AUTO | P1 | ↗ Locataire.candidature_origin | ➕ | Création auto |

### Sous-section : Locataire idéal IA (P2)

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Profil locataire idéal pour ce bien | 🧠 IA | P2 | calcul | ➕ | IA déduit du bien + historique proprio |
| Revenus minimum recommandés | 🧠 IA | P2 | calcul | ➕ | Loyer × 3 standard CH |
| Type contrat travail souhaité | 🧠 IA | P2 | calcul | ➕ | CDI ou idéal |
| Durée bail souhaitée | 🧠 IA | P2 | calcul | ➕ | Long terme (3 ans+) |
| Garanties recommandées | 🧠 IA | P2 | calcul | ➕ | Caution + organisme + garant |
| Score matching candidatures vs profil idéal | 🧠 IA | P2 | calcul | ➕ | Tri auto |
| Risques détectés par candidat | 🧠 IA | P2 | calcul | ➕ | Changement employeur récent / poursuites / durée bail courte |
| Suggestions négociation (cas borderline) | 🧠 IA | P2 | calcul | ➕ | Loyer pré-payé / caution renforcée / garant |

---

## SECTION UI : Vente du bien (P4)

URL : onglet `/app/biens/[id]/vente` activable par bien (toggle mode vente).

### Sous-section : Mandat de vente

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Type mandat (simple/exclusif/semi-exclusif) | 👤 USER | P4 | 🏠 SaleMandate.type | ➕ | Dropdown |
| Date début | 👤 USER | P4 | 🏠 SaleMandate.start_date | ➕ | Datepicker |
| Date fin | 👤 USER | P4 | 🏠 SaleMandate.end_date | ➕ | Datepicker |
| Prix demandé | 🧠 IA | P4 | 🏠 SaleMandate.prix_demande | ➕ | Estimation IA + comparables |
| Prix estimé Althy | 🧠 IA | P4 | calcul | ➕ | IA |
| Prix minimum proprio (confidentiel) | 👤 USER | P4 | 🏠 SaleMandate.prix_minimum | ➕ | Champ chiffré |
| Prix négocié | 👤 USER | P4 | 🏠 SaleMandate.prix_negocie | ➕ | Au cours négociation |
| Prix vendu final | 📩 EXTERNE | P4 | 🏠 SaleMandate.prix_vendu | ➕ | Acte notaire |
| Commission % | 🤖 AUTO | P4 | 🏠 SaleMandate.commission_pct | ➕ | Default selon mandat |
| Commission fixe | 👤 USER | P4 | 🏠 SaleMandate.commission_fixe | ➕ | Optionnel |
| TVA commission | 🤖 AUTO | P4 | calcul | ➕ | 8.1% |
| Frais marketing | 👤 USER | P4 | 🏠 SaleMandate.frais_marketing | ➕ | Photos / vidéo / pub |
| Frais dossier | 👤 USER | P4 | 🏠 SaleMandate.frais_dossier | ➕ | Optionnel |

### Sous-section : Acquéreur et financement

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Acquéreur (User ou contact externe) | 📩 EXTERNE | P4 | ↗ User ou BienContact | ➕ | Depuis offre acceptée |
| Notaire | 👤 USER | P4 | ↗ BienContact type=notaire | ➕ | Sélection |
| Banque acquéreur | 📩 EXTERNE | P4 | 🏠 SaleMandate.banque_acquereur | ➕ | Depuis acquéreur |
| Cédule hypothécaire | 🧠 IA | P4 | ↗ Document | ➕ | OCR |
| Financement confirmé (date) | 📩 EXTERNE | P4 | 🏠 SaleMandate.financement_confirme_at | ➕ | Banque confirme |

### Sous-section : Offres reçues

| Donnée par offre | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Acheteur potentiel | 📩 EXTERNE | P4 | 🏠 SaleOffer | ➕ | Via Althy |
| Montant offre | 📩 EXTERNE | P4 | 🏠 SaleOffer.montant | ➕ | Saisie |
| Conditions | 📩 EXTERNE | P4 | 🏠 SaleOffer.conditions | ➕ | Texte |
| Date offre | 🤖 AUTO | P4 | 🏠 SaleOffer.created_at | ➕ | Auto |
| Statut (reçue/contre-proposition/acceptée/refusée) | 👤 USER | P4 | 🏠 SaleOffer.status | ➕ | Workflow |

### Sous-section : Étapes vente

| Étape | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Promesse de vente signée | 🤖 AUTO | P4 | ↗ Document | ➕ | Génération auto |
| Acompte acheteur (séquestre notaire) | 📩 EXTERNE | P4 | 🏠 SaleMandate.acompte | ➕ | Notaire |
| Date acte authentique | 👤 USER | P4 | 🏠 SaleMandate.date_acte | ➕ | Datepicker |
| Date transfert propriété | 👤 USER | P4 | 🏠 SaleMandate.date_transfert | ➕ | Datepicker |
| Date remise clés | 👤 USER | P4 | 🏠 SaleMandate.date_remise_cles | ➕ | Datepicker |

### Sous-section : Calcul fiscalité vente

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Impôt gains immobiliers cantonal | 🤖 AUTO | P4 | calcul | ➕ | Calcul cantonal auto |
| Droits mutation | 🤖 AUTO | P4 | calcul | ➕ | Calcul cantonal |
| Frais notaire | 🤖 AUTO | P4 | calcul | ➕ | Calcul standard |
| Frais registre foncier | 🤖 AUTO | P4 | calcul | ➕ | Calcul |
| Répartition charges vendeur/acheteur | 🤖 AUTO | P4 | calcul | ➕ | Au prorata date transfert |
| Décompte vendeur final | 🤖 AUTO | P4 | ↗ Document | ➕ | PDF auto |
| Décompte acheteur | 🤖 AUTO | P4 | ↗ Document | ➕ | PDF auto |

### Sous-section : Dataroom

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Collection documents due diligence | 🤖 AUTO | P4 | ↗ Document tag=dataroom | ➕ | Auto-collecte |
| Diagnostics | 🤖 AUTO | P4 | ↗ Document filter | ➕ | DPE / amiante / radon |
| Servitudes | 📩 EXTERNE | P4 | API registre foncier | ➕ | Données publiques |
| PPE règlement | 👤 USER | P4 | ↗ Document | ➕ | Upload |
| Hypothèques | 📩 EXTERNE | P4 | API registre foncier | ➕ | Public |
| Mainlevée hypothèque | 📩 EXTERNE | P4 | ↗ Document | ➕ | Banque |
| État locatif | 🤖 AUTO | P4 | calcul Contract + Transaction | ➕ | Auto |
| Rendement brut / net cible investisseur | 🔗 DÉDUIT | P4 | calcul | ➕ | Auto |

### Sous-section : Diffusion vente sur portails

| Action | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Publication Homegate | 📩 EXTERNE | P4 | API | ➕ | Bouton |
| Publication ImmoScout24 | 📩 EXTERNE | P4 | API | ➕ | Bouton |
| Publication immobilier.ch | 📩 EXTERNE | P4 | API | ➕ | Bouton |
| Marketplace agences immo partenaires | 🤖 AUTO | P4 | DB Althy | ➕ | Directory |

---

## SECTION UI : Sphère IA

URL : `/app/sphere`. Pleine largeur, conversationnel.

### Sous-section : Interface conversationnelle

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Historique conversations | 🤖 AUTO | P1 | ↗ Conversation | ✅ | Multi-thread |
| Messages | 🤖 AUTO | P1 | ↗ ConversationMessage | ✅ | Auto stockage |
| Sphère animée | 🤖 AUTO | P1 | UI | ➕ | CSS gradient P1 → designer P2 |
| Input texte | 👤 USER | P1 | UI | ✅ | Champ chat |
| Input vocal (P3) | 👤 USER | P3 | UI | ➕ | API Whisper |
| Suggestions du jour | 🧠 IA | P1 | calcul | ➕ | Génération contextuelle |
| Quota tokens mois | 🤖 AUTO | P1 | ↗ User.monthly_ai_tokens_used | ✅ | Compteur |
| Reset date | 🤖 AUTO | P1 | ↗ User.monthly_ai_reset_date | ✅ | Auto |

### Sous-section : Capacités IA Phase 1

| Capacité | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Briefing matinal | 🧠 IA | P1 backlog | ↗ IABriefing | ➕ | Génération auto |
| Intent `creer_bien` | 🧠 IA | P1 | UI | ✅ | Form pré-rempli |
| Intent `lancer_changement_locataire` | 🧠 IA | P1 | UI | ✅ | Workflow |
| Intent `relance_loyer` | 🧠 IA | P1 | UI | ✅ | Brouillon + validation |
| Intent `generer_quittance` | 🧠 IA | P1 | UI | ✅ | PDF + validation |
| Intent `signaler_intervention` | 🧠 IA | P1 | UI | ✅ | Form |
| Intent `chat_compta` | 🧠 IA | P1 | UI | ✅ | Q&A simple |
| OCR factures | 🧠 IA | P1 | UI | ✅ | Upload + extraction |

### Sous-section : Garde-fous

| Garde-fou | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Rate limiting (30/jour starter, 100/jour pro) | 🤖 AUTO | P1 | ↗ User plan | ✅ | Compteur |
| Validation humaine obligatoire | 🤖 AUTO | P1 | UI | ✅ | Avant action irréversible |
| Disclaimer permanent | 🤖 AUTO | P1 | UI | ✅ | « propose, l'humain décide » |
| Pseudonymisation données perso | 🤖 AUTO | P1 | calcul | ✅ | Avant envoi Anthropic |

### Sous-section : Agent IA autonome (P3-4 — module premium)

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Mode agent autonome (toggle on/off) | 👤 USER | P3 | ↗ User.agent_mode | ➕ | Le proprio délègue |
| Niveau autonomie (jamais/suggérer/agir avec confirmation/agir librement) | 👤 USER | P3 | ↗ User.agent_level | ➕ | 4 niveaux |
| Limites monétaires autonomie | 👤 USER | P3 | ↗ User.agent_max_amount | ➕ | Garde-fou |
| Actions autorisées (relancer/publier/accepter devis<X/payer<Y) | 👤 USER | P3 | ↗ AgentPermission | ➕ | Multi-select |
| Audit décisions IA | 🤖 AUTO | P3 | ↗ AuditLog | ➕ | Tracking complet |
| Niveau 1 (P3) : suggérer / agir avec confirmation | 🧠 IA | P3 | UI | ➕ | Premier déploiement |
| Niveau 2 (P4) : limites élargies + actions complexes | 🧠 IA | P4 | UI | ➕ | Confiance accrue |
| Niveau 3 (P5+) : autonomie quasi totale | 🧠 IA | P5+ | UI | ➕ | Vision long terme |

---

## SECTION UI : Communication multi-canaux (P2)

URL : `/app/communication`. Hub messaging.

### Sous-section : Conversations actives

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Liste conversations toutes catégories | 🤖 AUTO | P2 | ↗ Conversation | ✅ | Filter participants |
| Filtre par bien / locataire / artisan / régie | 👤 USER | P2 | UI | ➕ | Multi-filtre |
| Pré-ciblage contact depuis fiche bien | 🤖 AUTO | P1 | UI | ➕ | Query param `?contact=X` |
| Statut lecture (lu / non lu) | 🤖 AUTO | P2 | ↗ Conversation.read_at | ✅ | Auto |
| Compteur non lus | 🔗 DÉDUIT | P2 | calcul | ✅ | Badge |

### Sous-section : Canaux

| Canal | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Email | 📩 EXTERNE | P1 | API Resend | ✅ | In/Out |
| SMS | 📩 EXTERNE | P1 | API Twilio | ✅ | In/Out |
| WhatsApp Business | 📩 EXTERNE | P2 | API Meta WhatsApp Cloud | ➕ | In/Out |
| In-app (notifications push) | 🤖 AUTO | P1 | UI | ✅ | Real-time |
| Email centralisé Gmail/Outlook (P3) | 🧠 IA | P3 | OAuth | ➕ | Aspire emails proprio liés bien |
| Infomaniak kMail (P5+) | 📩 EXTERNE | P5+ | API | ➕ | Pour CH |

### Sous-section : Templates IA

| Template | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Relance locataire | 🧠 IA | P2 | 🏠 NotificationTemplate | ➕ | Bibliothèque |
| Accusé réception candidature | 🧠 IA | P2 | 🏠 NotificationTemplate | ➕ | |
| Info travaux | 🧠 IA | P2 | 🏠 NotificationTemplate | ➕ | |
| Demande document manquant | 🧠 IA | P2 | 🏠 NotificationTemplate | ➕ | |
| Annonce indexation | 🧠 IA | P2 | 🏠 NotificationTemplate | ➕ | |
| Confirmation paiement | 🧠 IA | P2 | 🏠 NotificationTemplate | ➕ | |
| Auto-réponse intelligente (P3) | 🧠 IA | P3 | UI | ➕ | IA répond pour proprio en attente validation |
| Traduction auto FR/DE/IT/EN | 🧠 IA | P2 | UI | ➕ | Pour locataires non FR |

---

## SECTION UI : Marché local (P2)

URL : `/app/marche`. Module IA premium.

### Sous-section : Données zone

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Tension locative ville/canton | 🤖 AUTO | P2 | DB Althy | ➕ | % loués vs vacants |
| Délai relocation moyen ville | 🤖 AUTO | P2 | DB Althy | ➕ | Stats |
| Profil locataire dominant | 🤖 AUTO | P3 | DB Althy démographique | ➕ | Familles / jeunes actifs / retraités |
| Concurrence directe (nb annonces type/zone) | 🤖 AUTO | P2 | scraping public | ➕ | Lecture portails |
| Recommandations IA prix optimal par bien | 🧠 IA | P2 | calcul | ➕ | IA croise marché + bien + vacance |

### Sous-section : Évolution marché

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Prix m² zone (loyer mensuel) | 🤖 AUTO | P2 | DB Althy | ➕ | DB propriétaire |
| Évolution prix m² 5 ans | 🤖 AUTO | P2 | DB Althy | ➕ | Historique |
| Prix m² vente zone | 🤖 AUTO | P3 | DB Althy | ➕ | DB propriétaire |
| Comparables vendus 12 mois | 🤖 AUTO | P3 | DB Althy + registre foncier | ➕ | Auto |

---

## SECTION UI : Optimisation fiscale IA (P2)

URL : `/app/fiscal`. Module IA premium.

### Sous-section : Dashboard fiscal

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Économie potentielle année courante | 🧠 IA | P2 | calcul | ➕ | Big number |
| Travaux à anticiper avant fin année | 🧠 IA | P2 | calcul | ➕ | Liste |
| Plafonds déductibles non utilisés | 🤖 AUTO | P2 | calcul cantonal | ➕ | Auto |
| Contestations valeur locative possibles | 🧠 IA | P3 | calcul | ➕ | IA détecte écart marché |
| Stratégie pluri-annuelle suggérée | 🧠 IA | P3 | calcul | ➕ | Reporter ou anticiper |

### Sous-section : Simulations

| Simulation | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Scénario travaux N vs N+1 | 🧠 IA | P3 | calcul | ➕ | Comparaison fiscale |
| Scénario vente N vs N+5 (gain immo) | 🧠 IA | P3 | calcul | ➕ | Calcul cantonal |
| Scénario indexation locataire | 🧠 IA | P3 | calcul | ➕ | Impact net |

---

## SECTION UI : Communauté proprios (P3)

URL : `/app/communaute`. Module engagement.

### Sous-section : Forum

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Questions communauté | 👤 USER | P3 | 🏠 ForumPost | ➕ | Anonymisable |
| Réponses experts Althy | 👤 USER | P3 | 🏠 ForumComment | ➕ | Modération |
| Avis artisans communautaires | 👤 USER | P3 | ↗ Rating + commentaires | ➕ | Au-delà du Rating Althy |
| Bons plans / partage expériences | 👤 USER | P3 | 🏠 ForumPost type=tips | ➕ | Engagement |

### Sous-section : Événements

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Webinaires (taxes / juridique / IA) | 🤖 AUTO | P3 | 🏠 Event | ➕ | Calendrier Althy |
| Inscription en ligne | 👤 USER | P3 | 🏠 EventRegistration | ➕ | 1 clic |
| Replay accessible | 🤖 AUTO | P3 | ↗ Document type=video | ➕ | Stockage |

### Sous-section : Hunters référencement

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Hunters disponibles ma zone | 🧠 IA | P3 | ↗ ProfileHunter | ➕ | Matching |
| Avis et recommandations | 👤 USER | P3 | ↗ Rating | ➕ | Communautaire |
| CTA « Trouver un Hunter pour mon bien » | 👤 USER | P3 | UI | ➕ | Workflow |

---

## SECTION UI : Mon profil

URL : `/app/profil`. Paramètres compte proprio.

### Sous-section : Identité

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Prénom + nom | 👤 USER 🎯 | P1 | 🏠 ProfileProprio | ➕ refacto | Onboarding 1 fois |
| Date naissance | 👤 USER 🎯 | P1 | 🏠 ProfileProprio | ➕ | Onboarding |
| Nationalité | 👤 USER 🎯 | P1 | 🏠 ProfileProprio | ➕ | Onboarding |
| Email | 👤 USER 🎯 | P1 | 🏠 User.email | ✅ | Inscription |
| Téléphone | 🧠 IA | P1 | 🏠 User.phone | ✅ | OCR pièce identité possible |
| Adresse personnelle | 👤 USER | P1 | 🏠 User.adresse | ✅ | Autocomplete |
| Langue préférée | 🤖 AUTO | P1 | 🏠 User.locale | ✅ | Détection navigateur |
| Photo profil | 👤 USER | P1 | ↗ Document | ➕ | Optionnel |
| N° AVS | 👤 USER | P2 | 🏠 ProfileProprio.avs | ➕ | OCR carte AVS |

### Sous-section : Comptes bancaires

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Liste comptes bancaires | 👤 USER 🎯 | P1 | 🏠 BankAccount | ➕ | Onboarding |
| IBAN principal | 👤 USER 🎯 | P1 | 🏠 BankAccount.iban | ♻️ depuis User.iban | Saisi 1 fois, chiffré |
| Affichage IBAN masqué (****1234) | 🤖 AUTO | P1 | UI | ➕ | Bouton Afficher |
| QR-IBAN dérivé | 🤖 AUTO | P1 | calcul | ➕ | Algo standard |
| Nom banque | 🤖 AUTO | P1 | calcul depuis IBAN BIC | ➕ | Auto |
| BIC | 🤖 AUTO | P1 | calcul depuis IBAN | ➕ | Auto |
| Override IBAN par bien (rare) | 👤 USER | P2 | ↗ Bien.iban_override | ➕ | Optionnel |
| Open Banking sync (P2) | 📩 EXTERNE | P2 | API | ➕ | Bunq/Revolut/PostFinance |

### Sous-section : Fiscalité personnelle

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Canton fiscal | 🤖 AUTO | P2 | calcul depuis adresse | ➕ | Auto |
| Assujetti TVA | 👤 USER 🎯 | P2 | 🏠 ProfileProprio.tva_assujetti | ➕ | Onboarding |
| Numéro TVA | 👤 USER | P2 | 🏠 ProfileProprio.tva_numero | ➕ | Saisie |
| Méthode TVA | 👤 USER | P2 | 🏠 ProfileProprio.tva_methode | ➕ | Dropdown |
| Fréquence déclaration | 👤 USER | P2 | 🏠 ProfileProprio.tva_freq | ➕ | Dropdown |

### Sous-section : Préférences notifications

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Email (12 booléens types notifs) | 👤 USER | P1 | 🏠 User.notif_* | ✅ | Defaults sensés |
| Push in-app | 👤 USER | P1 | 🏠 User.notif_push | ✅ | Toggle |
| SMS (urgences uniquement) | 👤 USER | P1 | 🏠 User.notif_sms | ✅ | Toggle |
| WhatsApp (P2) | 👤 USER | P2 | 🏠 User.notif_whatsapp | ➕ | Toggle |
| Fréquence digest (jamais/quotidien/hebdo) | 👤 USER | P2 | 🏠 User.digest_freq | ➕ | Dropdown |

### Sous-section : Abonnement Althy

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Plan actuel | 🤖 AUTO | P1 | ↗ Subscription.plan | ✅ | Stripe |
| Date renouvellement | 🤖 AUTO | P1 | ↗ Subscription.renewed_at | ✅ | Auto |
| Méthode paiement (carte ****61) | 📩 EXTERNE | P1 | ↗ StripePaymentMethod | ✅ | Stripe Customer |
| Historique factures Althy | 🤖 AUTO | P1 | ↗ StripeInvoice | ✅ | API |
| Pack diffusion (P2) | 👤 USER | P2 | ↗ User.diffusion_pack | ➕ | Découverte/Standard/Pro/Premium |
| Grandfathering | 🤖 AUTO | P1 | ↗ Subscription.is_grandfathered | ✅ | Migration tarifaire |
| Bouton « Bascule Autonomie » (si invité agence) | 👤 USER | P1 | UI | ✅ | 1 clic CHF 39/mois |
| Annuler abonnement | 👤 USER | P1 | UI | ✅ | Workflow Stripe |

### Sous-section : Sécurité

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| 2FA actif (TOTP) | 👤 USER | P2 | 🏠 User.totp_secret | ➕ | Optionnel |
| Dernière connexion | 🤖 AUTO | P1 | 🏠 User.last_login_at | ✅ | Auto |
| Sessions actives | 🤖 AUTO | P2 | ↗ Session | ➕ | Liste |
| Révoquer session | 👤 USER | P2 | UI | ➕ | 1 clic |
| Historique connexions (IP + UA + date) | 🤖 AUTO | P2 | ↗ AuditLog filter login | ➕ | Affichage |
| Demander suppression compte (RGPD/nLPD) | 👤 USER | P1 | UI | ➕ | Workflow droit à l'oubli |
| Export données perso (RGPD) | 🤖 AUTO | P2 | UI | ➕ | Bouton export ZIP |

### Sous-section : Préférences

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Devise (CHF/EUR) | 👤 USER | P5+ | 🏠 User.currency | ➕ | Default CHF |
| Format date | 👤 USER | P2 | 🏠 User.date_format | ➕ | DD/MM/YYYY |
| Thème (clair/sombre/auto) | 👤 USER | P2 | 🏠 User.theme | ➕ | Default clair |
| Vue par défaut Mes biens (cartes/table/carte) | 👤 USER | P1 | 🏠 User.default_biens_view | ➕ | Persisté |

# RÔLE 2 — agence (P2)

L'agence administre des mandats pour des proprios + ses propres biens. Multi-utilisateurs (un compte agence = N agents). **Cheval de Troie stratégique** : la doctrine est qu'à terme, les proprios invités basculent en autonomie via le bouton CHF 39/mois.

## SECTION UI : Tableau de bord agence

URL : `/app/dashboard` (vue agence). Première page après login.

### Sous-section : Bandeau briefing IA agence

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Salutation agence + date | 🤖 AUTO | P2 | calcul | ➕ | Heure + langue |
| Texte briefing matinal agence | 🧠 IA | P2 | ↗ IABriefing | ➕ | Synthèse multi-mandats |
| CTA « Sphère IA » | 🤖 AUTO | P2 | UI | ➕ | Lien |

### Sous-section : Carrés KPI agence (3×2)

| Carré | Donnée | Acquisition | Phase | Source | État |
|---|---|---|---|---|---|
| **Portefeuille** | Nombre de biens sous mandat | 🤖 AUTO | P2 | calcul Mandate + Bien | ➕ |
| | Répartition par mandat (location / vente / saisonnière) | 🔗 DÉDUIT | P2 | calcul | ➕ |
| | Nombre de proprios | 🔗 DÉDUIT | P2 | calcul | ➕ |
| **Performance** | Taux occupation moyen | 🔗 DÉDUIT | P2 | calcul | ➕ |
| | Délai relocation moyen | 🔗 DÉDUIT | P2 | calcul | ➕ |
| | % loyers à l'heure | 🔗 DÉDUIT | P2 | calcul | ➕ |
| **Finances** | MRR honoraires agence | 🤖 AUTO | P2 | calcul Mandate + Invoice | ➕ |
| | Cash dispo | 📩 EXTERNE | P2 | ↗ BankAccount | ➕ |
| | Factures en attente | 🤖 AUTO | P2 | ↗ Invoice | ➕ |
| **Pipeline** | Candidatures multi-biens | 🤖 AUTO | P2 | ↗ Candidature | ➕ |
| | Mandats prospects | 🤖 AUTO | P2 | ↗ Lead type=mandat | ➕ |
| | Visites planifiées | 🤖 AUTO | P3 | ↗ WorkOrder type=visite | ➕ |
| **Travaux** | Interventions actives | 🤖 AUTO | P2 | ↗ WorkOrder | ➕ |
| | Devis en attente validation | 🤖 AUTO | P2 | ↗ Quote | ➕ |
| | Travaux > plafond mandat | 🤖 AUTO | P2 | calcul | ➕ |
| **Alertes** | Échéances 30j (baux / EDL / IPC) | 🤖 AUTO | P2 | calcul | ➕ |
| | Loyers en retard | 🤖 AUTO | P2 | ↗ Transaction | ➕ |
| | Compliance (TVA / décomptes / clôtures) | 🤖 AUTO | P3 | calcul | ➕ |

### Sous-section : Graphiques tendances (style scientifique)

| Graphique | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Courbe MRR honoraires 12 mois | 🤖 AUTO | P2 | calcul | ➕ | Ligne |
| Donut répartition revenus par type mandat | 🤖 AUTO | P2 | calcul | ➕ | Donut |
| Barres performance par bien (top/bottom 5) | 🤖 AUTO | P2 | calcul | ➕ | Barres |
| Heatmap occupation calendaire | 🤖 AUTO | P3 | calcul | ➕ | Pour saisonnier |
| Funnel pipeline candidatures (vues → contact → visite → offre → bail) | 🤖 AUTO | P2 | calcul | ➕ | Funnel |

### Sous-section : Insights IA d'amélioration

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Top 3 leviers d'amélioration | 🧠 IA | P2 | calcul | ➕ | IA analyse perf agence |
| Score d'efficacité par bien (0-100%) | 🧠 IA | P2 | calcul | ➕ | IA croise loyer marché + vacance + travaux |
| Suggestions optimisation (loyer / charges / travaux à reporter) | 🧠 IA | P2 | calcul | ➕ | Liste actionnable |

---

## SECTION UI : Portefeuille de biens

URL : `/app/biens`. Vue agence multi-biens. Mêmes données que proprio_solo Section 1.2 mais filtrées par `agency_id` au lieu de `owner_id`.

### Différences vs proprio_solo

| Donnée additionnelle | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Propriétaire affiché par bien | 🤖 AUTO | P2 | ↗ User profil | ➕ | Filtre |
| Mandat associé | 🤖 AUTO | P2 | ↗ Mandate | ➕ | FK |
| Honoraires perçus / dus | 🔗 DÉDUIT | P2 | calcul | ➕ | Visible agent |
| Plafond travaux mandat | 🤖 AUTO | P2 | ↗ Mandate.plafond_travaux | ➕ | Affichage |
| Validation proprio requise (oui/non) | 🤖 AUTO | P2 | ↗ Mandate.validation_required | ➕ | Selon plafond |
| Vue groupée par propriétaire | 👤 USER | P2 | UI | ➕ | Toggle |
| Vue groupée par mandat | 👤 USER | P2 | UI | ➕ | Toggle |
| Vue groupée par agent | 👤 USER | P2 | UI | ➕ | Toggle |
| Filtre « Mes biens » (agent connecté) | 👤 USER | P2 | UI | ➕ | Filter UserBienAccess |

### Fiche bien — sections supplémentaires agence

| Sous-section additionnelle | Phase | Description |
|---|---|---|
| Mandat | P2 | Détails mandat lié au bien |
| Décompte proprio à reverser | P2 | Calcul auto |
| Validation proprio en cours | P2 | Liste actions en attente validation |
| Honoraires détaillés ce bien | P2 | Décomposition |
| Notes internes agence | P2 | Texte libre, invisible proprio |

---

## SECTION UI : Mandats

URL : `/app/mandats`. Module clé agence.

### Sous-section : Liste mandats

| Donnée par mandat | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Type (location/vente/gestion/saisonnière/PPE/technique/administratif) | 👤 USER | P2 | 🏠 Mandate.type | ➕ | Dropdown |
| Bien associé | 👤 USER | P2 | ↗ Mandate.bien_id | ➕ | Autocomplete bien |
| Propriétaire | 👤 USER | P2 | ↗ Mandate.proprio_id | ➕ | Autocomplete user ou création |
| Date début | 👤 USER | P2 | 🏠 Mandate.start_date | ➕ | Datepicker |
| Date fin | 👤 USER | P2 | 🏠 Mandate.end_date | ➕ | Datepicker |
| Reconduction tacite | 👤 USER | P2 | 🏠 Mandate.auto_renew | ➕ | Toggle |
| Préavis (mois) | 👤 USER | P2 | 🏠 Mandate.preavis | ➕ | Default 3 |
| Honoraires fixes (CHF) | 👤 USER | P2 | 🏠 Mandate.honoraires_fixes | ➕ | Default ProfileAgence.default_fees |
| Honoraires % (sur loyer) | 👤 USER | P2 | 🏠 Mandate.honoraires_pct | ➕ | Default 6-8% selon agence |
| Minimum mensuel | 👤 USER | P2 | 🏠 Mandate.min_mensuel | ➕ | Garde-fou |
| Plafond travaux sans accord proprio | 👤 USER | P2 | 🏠 Mandate.plafond_travaux | ➕ | Default CHF 500 |
| Validation proprio obligatoire | 🤖 AUTO | P2 | 🏠 Mandate.validation_required | ➕ | Toggle si plafond dépassé |
| Fréquence reversement proprio | 👤 USER 🎯 | P2 | 🏠 Mandate.reversement_freq | ➕ | Mensuel/trimestriel |
| Retenues (fonds travaux / sécurité) | 👤 USER | P2 | 🏠 Mandate.retenues | ➕ | % ou montant fixe |
| Solde proprio disponible | 🔗 DÉDUIT | P2 | calcul | ➕ | Auto |
| Solde proprio bloqué | 🔗 DÉDUIT | P2 | calcul | ➕ | Auto |
| Statut (actif/résilié/expiré) | 🤖 AUTO | P2 | 🏠 Mandate.status | ➕ | Workflow |
| Document mandat signé | 🤖 AUTO | P2 | ↗ Document | ➕ | Génération auto template + signature électronique |

### Sous-section : Frais mandat (MandateFee — table 1:N)

| Donnée par frais | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Type frais (relocation/EDL/annonce/photos/visite/dossier/contentieux/travaux) | 👤 USER | P2 | 🏠 MandateFee.type | ➕ | Dropdown |
| Montant fixe ou % | 👤 USER | P2 | 🏠 MandateFee.amount | ➕ | Saisie |
| Récurrence (one-shot / mensuel / annuel) | 👤 USER | P2 | 🏠 MandateFee.recurrence | ➕ | Dropdown |
| Conditions de déclenchement | 👤 USER | P2 | 🏠 MandateFee.trigger | ➕ | Texte ou enum |

### Sous-section : Décompte propriétaire (par mandat)

→ Identique au décompte propriétaire proprio_solo, mais générés par l'agence pour ses mandants.

| Action 1 clic | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Générer décompte mois | 👤 USER | P2 | UI | ➕ | Auto + envoi proprio |
| Valider décompte | 👤 USER | P2 | UI | ➕ | Étape interne agence |
| Envoyer pour signature proprio | 👤 USER | P2 | UI | ➕ | Workflow |
| Reverser solde au proprio | 👤 USER | P2 | UI | ➕ | Paiement groupé |
| Export comptable | 🤖 AUTO | P2 | ↗ AccountingExport | ➕ | Bexio/Banana/AbaWeb |

---

## SECTION UI : Centre comptable agence

URL : `/app/comptabilite`. **Module premium P2-3** — agrégateur intelligent.

### Sous-section : Tableau de bord comptable

#### Carrés KPI (3×2)

| Carré | Donnée | Acquisition | Phase | Source | État |
|---|---|---|---|---|---|
| **Bilan** | Actif total | 🔗 DÉDUIT | P3 | calcul | ➕ |
| | Passif total | 🔗 DÉDUIT | P3 | calcul | ➕ |
| | Capitaux propres | 🔗 DÉDUIT | P3 | calcul | ➕ |
| **Compte de résultat** | Produits année courante | 🤖 AUTO | P2 | calcul | ➕ |
| | Charges année courante | 🤖 AUTO | P2 | calcul | ➕ |
| | Résultat net | 🔗 DÉDUIT | P2 | calcul | ➕ |
| **TVA** | TVA due trimestre courant | 🔗 DÉDUIT | P2 | calcul | ➕ |
| | TVA récupérable | 🔗 DÉDUIT | P2 | calcul | ➕ |
| | TVA nette à payer / récupérer | 🔗 DÉDUIT | P2 | calcul | ➕ |
| **Trésorerie** | Solde global comptes | 📩 EXTERNE | P2 | ↗ BankAccount | ➕ |
| | Dépenses prévues 30j | 🔗 DÉDUIT | P2 | calcul | ➕ |
| | Encaissements prévus 30j | 🔗 DÉDUIT | P2 | calcul | ➕ |
| **Clients** | Balance âgée clients | 🔗 DÉDUIT | P2 | calcul Invoice | ➕ |
| | En souffrance > 30j | 🤖 AUTO | P2 | calcul | ➕ |
| | Total à encaisser | 🔗 DÉDUIT | P2 | calcul | ➕ |
| **Fournisseurs** | Balance âgée fournisseurs | 🔗 DÉDUIT | P2 | calcul Invoice | ➕ |
| | En attente paiement | 🤖 AUTO | P2 | calcul | ➕ |
| | Total à payer | 🔗 DÉDUIT | P2 | calcul | ➕ |

#### Graphiques

| Graphique | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Courbe trésorerie 12 mois | 🤖 AUTO | P2 | calcul | ➕ | Ligne |
| Barres recettes vs dépenses mensuelles | 🤖 AUTO | P2 | calcul | ➕ | Barres groupées |
| Donut répartition charges par catégorie | 🤖 AUTO | P2 | calcul | ➕ | Donut |
| Évolution résultat net N vs N-1 | 🤖 AUTO | P3 | calcul | ➕ | Comparaison |
| Heatmap loyers reçus par mois × bien | 🤖 AUTO | P2 | calcul | ➕ | Heatmap |

### Sous-section : Insights IA agence

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Score efficacité agence global | 🧠 IA | P2 | calcul | ➕ | « 94% efficacité » |
| Score par bien (0-100%) | 🧠 IA | P2 | calcul | ➕ | « 98% sur lui, 76% sur celui-là » |
| Top 5 leviers d'amélioration | 🧠 IA | P2 | calcul | ➕ | Actionnable |
| Détection anomalies | 🧠 IA | P3 | calcul | ➕ | Flux atypiques |
| Suggestions optimisation fiscale | 🧠 IA | P2 | calcul | ➕ | Travaux à reporter / déduire |
| Benchmarking vs agences similaires | 🧠 IA | P3 | DB Althy | ➕ | Anonymisé |

### Sous-section : Plan comptable

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Plan comptable suisse PME PCG | 🤖 AUTO | P3 | 🏠 ChartOfAccounts | ➕ | Default standard |
| Comptes personnalisés | 👤 USER | P3 | 🏠 ChartOfAccounts | ➕ | Création |
| Mapping automatique opérations → comptes | 🧠 IA | P3 | calcul | ➕ | IA classe les écritures |

### Sous-section : Journaux

| Journal | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Journal banque | 🤖 AUTO | P2 | calcul Transaction | ➕ | Auto depuis CAMT |
| Journal caisse | 👤 USER | P3 | 🏠 JournalEntry | ➕ | Saisie manuelle |
| Journal ventes | 🤖 AUTO | P2 | calcul Invoice | ➕ | Auto |
| Journal achats | 🤖 AUTO | P2 | calcul Invoice fournisseur | ➕ | Auto |
| Journal salaires | 👤 USER | P3 | 🏠 JournalEntry | ➕ | Saisie manuelle |
| Journal loyers | 🤖 AUTO | P2 | calcul Transaction | ➕ | Auto |
| Journal charges | 🤖 AUTO | P2 | calcul ChargeLine | ➕ | Auto |
| Journal écritures OD (opérations diverses) | 👤 USER | P3 | 🏠 JournalEntry | ➕ | Saisie manuelle |
| Journal TVA | 🤖 AUTO | P2 | calcul | ➕ | Auto |

### Sous-section : Grand livre / balance / bilan / CR

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Grand livre par compte | 🔗 DÉDUIT | P3 | calcul JournalEntry | ➕ | Auto |
| Balance N et N-1 | 🔗 DÉDUIT | P3 | calcul | ➕ | Auto |
| Bilan synthétique | 🔗 DÉDUIT | P3 | calcul | ➕ | Auto |
| Compte de résultat | 🔗 DÉDUIT | P2 | calcul | ➕ | Auto |
| Extraits propriétaires | 🤖 AUTO | P2 | ↗ OwnerStatement | ➕ | Auto |
| Décomptes de gérance | 🤖 AUTO | P2 | calcul Mandate | ➕ | Auto |
| Écritures analytiques | 🔗 DÉDUIT | P3 | calcul | ➕ | Par mandat / bien / activité |

### Sous-section : Lettrage et rapprochement

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Lettrage automatique | 🤖 AUTO | P3 | 🏠 Lettrage | ➕ | Algo matching |
| Lettrage manuel | 👤 USER | P3 | UI | ➕ | Drag-and-drop |
| Rapprochement bancaire CAMT.054 | 🤖 AUTO | P1 | 🏠 BankMatching | ➕ | Auto sur référence + montant |
| Rapprochement bancaire CAMT.053 | 📩 EXTERNE | P2 | 🏠 BankStatement | ➕ | Import mensuel |
| Écart bancaire | 🔗 DÉDUIT | P2 | calcul | ➕ | Solde théo vs réel |
| Justificatifs liés | ↗ Document | P2 | ↗ Document | ➕ | Auto-collecte |

### Sous-section : Écritures récurrentes

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Loyer mensuel par bien | 🤖 AUTO | P2 | 🏠 RecurringEntry | ➕ | Auto |
| Charges mensuelles fournisseurs | 🤖 AUTO | P3 | 🏠 RecurringEntry | ➕ | Auto |
| Honoraires mandat mensuels | 🤖 AUTO | P3 | 🏠 RecurringEntry | ➕ | Auto |
| Salaires mensuels (P3) | 👤 USER | P3 | 🏠 RecurringEntry | ➕ | Setup une fois |

### Sous-section : Clôture mensuelle / annuelle

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Clôture mensuelle | 👤 USER | P3 | 🏠 ClosingPeriod | ➕ | Bouton clôture |
| Blocage modifications après clôture | 🤖 AUTO | P3 | 🏠 ClosingPeriod.locked | ➕ | Auto |
| Réouverture avec justification | 👤 USER | P3 | 🏠 ClosingPeriod.reopened_at | ➕ | Workflow validation superviseur |
| Clôture annuelle | 👤 USER | P3 | 🏠 ClosingPeriod | ➕ | Bouton |
| Archivage légal | 🤖 AUTO | P3 | calcul | ➕ | Conservation 10 ans CO |

### Sous-section : Audit trail forensique

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Journal complet écritures | 🤖 AUTO | P1 | ↗ AuditLog | ✅ | Auto |
| Qui a vu / modifié quoi | 🤖 AUTO | P1 | ↗ AuditLog | ✅ | Auto |
| Ancienne / nouvelle valeur | 🤖 AUTO | P1 | ↗ AuditLog.before/after | ✅ | Auto |
| IP + UA | 🤖 AUTO | P1 | ↗ AuditLog | ✅ | Auto |
| Horodatage | 🤖 AUTO | P1 | ↗ AuditLog.created_at | ✅ | Auto |
| Export audit | 🤖 AUTO | P3 | UI | ➕ | Bouton export |

### Sous-section : Export 1 clic fiduciaire

| Format export | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Bexio (API push) | 🤖 AUTO | P2 | ↗ AccountingExport | ➕ | Configuration OAuth |
| Banana (XML) | 🤖 AUTO | P2 | ↗ AccountingExport | ➕ | Format standard |
| AbaWeb (XML) | 🤖 AUTO | P2 | ↗ AccountingExport | ➕ | Format standard |
| Excel/CSV générique | 🤖 AUTO | P2 | calcul | ➕ | Bouton export |
| PDF récapitulatif (bilan + CR + détail TVA) | 🤖 AUTO | P2 | ↗ Document | ➕ | Génération auto |
| ZIP pièces justificatives | 🤖 AUTO | P2 | calcul | ➕ | Toutes les factures + relevés |

---

## SECTION UI : TVA

URL : `/app/tva`. Module dédié.

### Sous-section : Configuration TVA agence

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Assujetti TVA | 👤 USER 🎯 | P2 | 🏠 ProfileAgence.tva_assujetti | ➕ | Onboarding 1 fois |
| Numéro TVA | 👤 USER 🎯 | P2 | 🏠 ProfileAgence.tva_numero | ➕ | Onboarding |
| Méthode (effective / dette nette / forfaitaire) | 👤 USER 🎯 | P2 | 🏠 ProfileAgence.tva_methode | ➕ | Onboarding |
| Fréquence (trimestrielle / semestrielle / annuelle) | 👤 USER 🎯 | P2 | 🏠 ProfileAgence.tva_freq | ➕ | Onboarding |
| Taux par défaut (8.1% standard) | 🤖 AUTO | P2 | calcul | ➕ | Default CH |

### Sous-section : Configuration TVA par bien

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Surface commerciale m² | 👤 USER | P2 | ↗ Bien.surface_commerciale | ➕ | Pour prorata |
| Surface habitation m² | 🤖 AUTO | P2 | ↗ Bien.surface | ➕ | Reflet |
| Type opération par bien (exclue/imposable/option/exonérée) | 👤 USER | P2 | ↗ Bien.tva_type | ➕ | Dropdown |
| Quote-part récupérable | 🔗 DÉDUIT | P2 | calcul | ➕ | Auto si mixte |

### Sous-section : Module TVA P2 (light)

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| TVA par transaction (auto-classifiée) | 🧠 IA | P2 | ↗ Transaction.tva_type | ➕ | IA classe selon catégorie |
| TVA sur honoraires | 🤖 AUTO | P2 | calcul | ➕ | Auto |
| TVA sur commissions | 🤖 AUTO | P2 | calcul | ➕ | Auto |
| Décompte TVA trimestriel | 🤖 AUTO | P2 | ↗ VATReport | ➕ | Génération auto |
| Export rapport AFC | 🤖 AUTO | P2 | UI | ➕ | Bouton |

### Sous-section : Module TVA P3 (medium)

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Prorata TVA mixte commerciale/habitation | 🔗 DÉDUIT | P3 | calcul | ➕ | Auto |
| Correction impôt préalable | 🔗 DÉDUIT | P3 | calcul | ➕ | Auto |
| Affectation privée/commerciale | 🤖 AUTO | P3 | calcul | ➕ | Auto |
| TVA sur nettoyage / parking | 🤖 AUTO | P3 | calcul | ➕ | Auto |
| TVA sur location saisonnière (P3) | 🤖 AUTO | P3 | calcul | ➕ | Auto |
| Historique corrections TVA | 🤖 AUTO | P3 | 🏠 VATCorrection | ➕ | Audit log |

### Sous-section : Module TVA P4 (full)

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| TVA sur vente immo | 🤖 AUTO | P4 | calcul | ➕ | Auto |
| TVA sur travaux capitalisés | 🤖 AUTO | P4 | calcul | ➕ | Auto |
| Option TVA volontaire | 👤 USER | P4 | ↗ Bien.tva_option | ➕ | Toggle |

---

## SECTION UI : Facturation

URL : `/app/facturation`. Hub de toutes les factures émises et reçues.

### Sous-section : Factures émises (Invoice)

| Donnée par facture | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Type (loyer locataire / honoraires proprio / commission acheteur / saisonnier / artisan) | 🤖 AUTO | P2 | 🏠 Invoice.type | ➕ | Auto selon contexte |
| Bien lié | 🤖 AUTO | P2 | ↗ Invoice.bien_id | ➕ | FK |
| Contrat lié | 🤖 AUTO | P2 | ↗ Invoice.contract_id | ➕ | FK |
| Émetteur (qui facture) | 🤖 AUTO | P2 | ↗ Invoice.emetteur_id | ➕ | Auto contexte |
| Destinataire (qui paie) | 🤖 AUTO | P2 | ↗ Invoice.destinataire_id | ➕ | Auto contexte |
| QR-IBAN | ↗ BankAccount.qr_iban | P2 | ↗ BankAccount | ➕ | Auto |
| Référence QR / SCOR | 🤖 AUTO | P2 | calcul | ➕ | Algo standard |
| Devise | 🤖 AUTO | P2 | 🏠 Invoice.currency | ➕ | Default CHF |
| Date émission | 🤖 AUTO | P2 | 🏠 Invoice.issued_at | ➕ | Auto |
| Date échéance | 🤖 AUTO | P2 | 🏠 Invoice.due_at | ➕ | Auto + délai standard |
| Conditions paiement (30j net / etc.) | 🤖 AUTO | P2 | 🏠 Invoice.terms | ➕ | Default 30j |
| Montant TTC | 🤖 AUTO | P2 | 🏠 Invoice.amount | ➕ | Calcul |
| TVA | 🤖 AUTO | P2 | 🏠 Invoice.tva | ➕ | Auto |
| Paiement partiel | 🤖 AUTO | P2 | 🏠 Invoice.partial_paid | ➕ | Workflow |
| Trop-perçu | 🤖 AUTO | P2 | calcul | ➕ | Auto |
| Avoir / note de crédit | 👤 USER | P2 | 🏠 CreditNote | ➕ | Sur facture annulée |
| Statut (brouillon/envoyée/partiellement payée/payée/en retard/contestée/annulée) | 🤖 AUTO | P2 | 🏠 Invoice.status | ➕ | Workflow |
| Document PDF | 🤖 AUTO | P2 | ↗ Document | ➕ | Génération auto |
| Frais rappel cumulés | 🤖 AUTO | P2 | ↗ Reminder | ➕ | Auto |
| Intérêts moratoires | 🔗 DÉDUIT | P2 | calcul | ➕ | Auto |

### Sous-section : Factures reçues (fournisseurs)

| Donnée par facture reçue | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Fournisseur | 🧠 IA | P2 | ↗ BienContact ou User | ➕ | OCR |
| Bien lié | 🧠 IA | P2 | ↗ Invoice.bien_id | ➕ | IA détermine depuis adresse facturée |
| Catégorie (charge / travaux / honoraires / autre) | 🧠 IA | P2 | 🏠 Invoice.category | ➕ | IA classe |
| Montant TTC | 🧠 IA | P2 | 🏠 Invoice.amount | ➕ | OCR |
| TVA | 🧠 IA | P2 | 🏠 Invoice.tva | ➕ | OCR |
| Date émission | 🧠 IA | P2 | 🏠 Invoice.issued_at | ➕ | OCR |
| Date échéance | 🧠 IA | P2 | 🏠 Invoice.due_at | ➕ | OCR |
| Référence QR / IBAN bénéficiaire | 🧠 IA | P2 | calcul | ➕ | OCR QR-facture |
| Statut paiement | 🤖 AUTO | P2 | 🏠 Invoice.paid_at | ➕ | Workflow |
| Document PDF | 👤 USER | P2 | ↗ Document | ➕ | Upload + OCR |
| Affectation OBLF (proprio/locataire) | 🧠 IA | P1 | 🏠 Invoice.oblf_split | ✅ | IA suggère + validation |

---

## SECTION UI : Banque et paiements

URL : `/app/banque`. Module gestion bancaire agence.

### Sous-section : Comptes bancaires

| Donnée par compte | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Compte par propriétaire | 👤 USER | P2 | 🏠 BankAccount.purpose=proprio_id | ➕ | Setup |
| Compte régie principal | 👤 USER 🎯 | P2 | 🏠 BankAccount.purpose=regie | ➕ | Onboarding |
| Compte cautions | 👤 USER 🎯 | P2 | 🏠 BankAccount.purpose=cautions | ➕ | Compte bloqué |
| Compte charges | 👤 USER | P2 | 🏠 BankAccount.purpose=charges | ➕ | Optionnel |
| Compte travaux | 👤 USER | P2 | 🏠 BankAccount.purpose=travaux | ➕ | Optionnel |
| Solde temps réel | 📩 EXTERNE | P2 | API Open Banking | ➕ | Si connexion établie |

### Sous-section : Connexions bancaires

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Connexions Open Banking | 📩 EXTERNE | P2 | 🏠 BankConnection | ➕ | UBS / Raiffeisen / PostFinance |
| Imports manuels CAMT.053 | 👤 USER | P1 | 🏠 BankStatement | ➕ | Upload XML |
| Imports manuels CAMT.054 | 👤 USER | P1 | 🏠 BankStatement | ➕ | Upload XML |
| Statut import (réussi / partiel / échec) | 🤖 AUTO | P1 | 🏠 BankStatement.status | ➕ | Auto |

### Sous-section : Matching automatique

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Matching référence QR | 🤖 AUTO | P1 | 🏠 BankMatching | ➕ | Algo |
| Matching montant | 🤖 AUTO | P1 | 🏠 BankMatching | ➕ | Algo |
| Matching nom payeur | 🤖 AUTO | P2 | 🏠 BankMatching | ➕ | Algo flou |
| Matching manuel (cas ambigus) | 👤 USER | P1 | UI | ➕ | Drag-and-drop |
| Score confiance matching | 🔗 DÉDUIT | P1 | calcul | ➕ | 0-100% |

### Sous-section : Paiements groupés

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Liste paiements à effectuer | 🤖 AUTO | P2 | 🏠 PaymentBatch | ➕ | Auto compilation |
| Type (fournisseurs / proprios / cautions / taxes séjour / commissions) | 🤖 AUTO | P2 | 🏠 PaymentBatch.type | ➕ | Auto |
| Total batch | 🔗 DÉDUIT | P2 | calcul | ➕ | Sum |
| Validation préparée par agent | 👤 USER | P2 | 🏠 PaymentBatch.prepared_by | ➕ | Workflow |
| Validation finale (double signature) | 👤 USER | P2 | 🏠 PaymentBatch.validated_by | ➕ | Multi-utilisateurs |
| Date envoi banque | 🤖 AUTO | P2 | 🏠 PaymentBatch.sent_at | ➕ | Auto post-validation |
| Statut (préparé / validé / envoyé / exécuté / rejeté) | 🤖 AUTO | P2 | 🏠 PaymentBatch.status | ➕ | Workflow |
| Motif rejet | 🤖 AUTO | P2 | 🏠 Payment.reject_reason | ➕ | Auto depuis banque |

### Sous-section : Réconciliation

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Solde théorique | 🔗 DÉDUIT | P2 | calcul | ➕ | Sum Transaction |
| Solde réel banque | 📩 EXTERNE | P2 | API ou import | ➕ | CAMT |
| Écart | 🔗 DÉDUIT | P2 | calcul | ➕ | Auto |
| Identification écarts | 🧠 IA | P2 | calcul | ➕ | IA explique |

---

## SECTION UI : Reporting agence

URL : `/app/reporting`. Vues analytiques.

### Sous-section : Reporting opérationnel

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Rentabilité par bien | 🔗 DÉDUIT | P2 | calcul | ➕ | Auto |
| Rentabilité par propriétaire | 🔗 DÉDUIT | P2 | calcul | ➕ | Auto |
| Rentabilité par activité (location/saisonnière/vente) | 🔗 DÉDUIT | P2 | calcul | ➕ | Auto |
| Marge régie | 🔗 DÉDUIT | P2 | calcul | ➕ | Auto |
| Honoraires encaissés | 🤖 AUTO | P2 | calcul Mandate + Invoice | ➕ | Auto |
| Commissions dues / encaissées | 🤖 AUTO | P2 | calcul | ➕ | Auto |
| Loyers encaissés | 🤖 AUTO | P2 | calcul Transaction | ✅ | Auto |
| Loyers impayés | 🤖 AUTO | P2 | calcul | ✅ | Auto |
| Taux vacance global | 🔗 DÉDUIT | P2 | calcul | ➕ | Auto |
| Délai relocation moyen | 🔗 DÉDUIT | P2 | calcul | ➕ | Auto |
| Délai vente moyen (P4) | 🔗 DÉDUIT | P4 | calcul | ➕ | Auto |
| Prix affiché vs vendu (P4) | 🔗 DÉDUIT | P4 | calcul | ➕ | Auto |
| Budget travaux vs réel | 🔗 DÉDUIT | P2 | calcul WorkOrder + Quote | ➕ | Auto |
| Charges N / N-1 | 🔗 DÉDUIT | P2 | calcul | ➕ | Auto |

### Sous-section : Reporting financier

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Cash-flow propriétaire (par mandat) | 🔗 DÉDUIT | P2 | calcul OwnerStatement | ➕ | Auto |
| Solde bancaire global | 📩 EXTERNE | P2 | ↗ BankAccount | ➕ | Auto |
| Balance âgée clients | 🔗 DÉDUIT | P2 | calcul Invoice | ➕ | Auto |
| Balance âgée fournisseurs | 🔗 DÉDUIT | P2 | calcul Invoice | ➕ | Auto |
| TVA due | 🔗 DÉDUIT | P2 | calcul | ➕ | Auto |
| TVA récupérable | 🔗 DÉDUIT | P2 | calcul | ➕ | Auto |
| Alertes risques | 🧠 IA | P3 | calcul | ➕ | Détection anomalies |

### Sous-section : Reporting saisonnier (P5+ uniquement nuitée)

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Taux occupation saisonnier | 🔗 DÉDUIT | P5+ | calcul | ➕ | Si module nuitée activé |
| RevPAR (revenus per available room) | 🔗 DÉDUIT | P5+ | calcul | ➕ | Hôtelier |
| ADR (average daily rate) | 🔗 DÉDUIT | P5+ | calcul | ➕ | Hôtelier |
| Durée moyenne séjour | 🔗 DÉDUIT | P5+ | calcul | ➕ | Hôtelier |

### Sous-section : Reporting marketing / pipeline

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Taux transformation leads | 🔗 DÉDUIT | P2 | calcul Lead | ➕ | Auto |
| Sources leads (UTM tracking) | 🤖 AUTO | P2 | 🏠 Lead.source | ➕ | Auto |
| Coût acquisition lead | 🔗 DÉDUIT | P3 | calcul | ➕ | Auto |
| Funnel candidatures | 🔗 DÉDUIT | P2 | calcul | ➕ | Auto |

---

## SECTION UI : CRM (prospects)

URL : `/app/crm`. Pipeline commercial agence.

### Sous-section : Liste leads

| Donnée par lead | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Type (locataire / acheteur / propriétaire / mandant) | 👤 USER | P2 | 🏠 Lead.type | ➕ | Dropdown |
| Source (site / portail / bouche à oreille / agence / Airbnb / Booking) | 🤖 AUTO | P2 | 🏠 Lead.source | ✅ | UTM tracking auto |
| Score lead | 🧠 IA | P2 | 🏠 Lead.score | ➕ | IA calcul |
| Budget | 👤 USER | P2 | 🏠 Lead.budget | ➕ | Saisie ou form web |
| Critères recherche (surface / nb pièces / canton / zone) | 👤 USER | P2 | 🏠 Lead.criteria | ➕ | Form |
| Pipeline stage (nouveau/qualifié/visite/offre/négociation/gagné/perdu) | 👤 USER | P2 | 🏠 Lead.stage | ➕ | Drag-and-drop kanban |
| Date contact initial | 🤖 AUTO | P2 | 🏠 Lead.created_at | ➕ | Auto |
| Date dernier contact | 🤖 AUTO | P2 | 🏠 Lead.last_contact | ➕ | Auto |
| Visites planifiées | ↗ WorkOrder | P2 | ↗ WorkOrder type=visite | ➕ | FK |
| Visites effectuées | 🤖 AUTO | P2 | ↗ WorkOrder.completed_at | ➕ | Compteur |
| Offre faite (P4) | ↗ SaleOffer | P4 | ↗ SaleOffer | ➕ | FK |
| Refus + motif | 👤 USER | P2 | 🏠 Lead.refused_at + reason | ➕ | Form |
| Relance planifiée | 🧠 IA | P2 | 🏠 Lead.next_followup | ➕ | IA suggère |

### Sous-section : Activités lead (LeadActivity)

| Donnée par activité | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Type (email / téléphone / visite / message / note) | 👤 USER | P2 | 🏠 LeadActivity.type | ➕ | Auto si email/SMS |
| Date | 🤖 AUTO | P2 | 🏠 LeadActivity.created_at | ➕ | Auto |
| Auteur agent | 🤖 AUTO | P2 | 🏠 LeadActivity.actor_id | ➕ | Auto |
| Contenu | 👤 USER | P2 | 🏠 LeadActivity.content | ➕ | Texte |
| Documents demandés / reçus | 🧠 IA | P2 | ↗ Document | ➕ | Checklist auto selon type prospect |

### Sous-section : Templates IA CRM

| Template | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Email de qualification | 🧠 IA | P2 | 🏠 NotificationTemplate | ➕ | Auto |
| Email de visite confirmation | 🧠 IA | P2 | 🏠 NotificationTemplate | ➕ | Auto |
| Email de relance | 🧠 IA | P2 | 🏠 NotificationTemplate | ➕ | Auto |
| Email de proposition de bien matchant | 🧠 IA | P2 | calcul | ➕ | IA matche Lead.criteria avec biens disponibles |

---

## SECTION UI : Utilisateurs (multi-agents)

URL : `/app/admin/users`. Gestion équipe agence.

### Sous-section : Liste agents

| Donnée par agent | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Identité agent | 🤖 AUTO | P2 | ↗ User | ✅ | Profil |
| Rôle interne (admin agence / agent / comptable / superviseur) | 👤 USER | P2 | 🏠 User.agency_role | ➕ | Dropdown |
| Date arrivée | 🤖 AUTO | P2 | 🏠 User.created_at | ✅ | Auto |
| Statut (actif / inactif / suspendu) | 👤 USER | P2 | 🏠 User.is_active | ✅ | Toggle |
| Dernière connexion | 🤖 AUTO | P2 | 🏠 User.last_login_at | ✅ | Auto |
| Biens assignés | 🤖 AUTO | P2 | ↗ UserBienAccess | ➕ | Liste |

### Sous-section : Permissions

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Droits par bien | 🤖 AUTO | P2 | 🏠 UserBienAccess | ➕ | Default selon rôle interne |
| Droits par module | 🤖 AUTO | P2 | 🏠 UserModuleAccess | ➕ | Default selon rôle interne |
| Override custom (par admin agence) | 👤 USER | P2 | UI | ➕ | Multi-select |
| Workflow validation paiements | 👤 USER 🎯 | P2 | 🏠 ApprovalWorkflow | ➕ | Setup une fois |

### Sous-section : Invitations

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Inviter par email | 👤 USER | P2 | UI | ➕ | Form simple |
| Statut invitation (envoyée / acceptée / expirée) | 🤖 AUTO | P2 | 🏠 Invitation.status | ➕ | Workflow |
| Lien magique | 🤖 AUTO | P2 | calcul | ➕ | UUID + expiration 7j |

---

## SECTION UI : Identité agence

URL : `/app/admin/agence`. Profil entreprise.

### Sous-section : Identité légale

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Raison sociale | 👤 USER 🎯 | P2 | 🏠 ProfileAgence.raison_sociale | ➕ | Onboarding |
| IDE | 🧠 IA | P2 | 🏠 ProfileAgence.ide | ➕ | Auto-recherche registre du commerce CH depuis nom |
| Forme juridique | 🧠 IA | P2 | 🏠 ProfileAgence.forme | ➕ | Idem registre |
| Adresse siège | 🧠 IA | P2 | 🏠 ProfileAgence.adresse | ➕ | Idem registre |
| Logo | 👤 USER | P2 | ↗ Document | ➕ | Upload |
| Numéro membre USPI | 👤 USER | P2 | 🏠 ProfileAgence.uspi_member_id | ➕ | Optionnel |

### Sous-section : Comptes bancaires agence

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Comptes bancaires | 👤 USER 🎯 | P2 | ↗ BankAccount | ➕ | Onboarding |
| IBAN principal régie | 👤 USER 🎯 | P2 | ↗ BankAccount.iban | ➕ | Setup |
| Comptes par usage (cautions / charges / travaux) | 👤 USER | P2 | ↗ BankAccount.purpose | ➕ | Multi-comptes |

### Sous-section : Fiduciaire externe

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Provider (Bexio / Banana / AbaWeb / autre) | 👤 USER | P2 | 🏠 ProfileAgence.fiduciaire_provider | ➕ | Sélection partenaire |
| Identifiant fiduciaire | 👤 USER | P2 | 🏠 ProfileAgence.fiduciaire_external_id | ➕ | OAuth ou token |
| Connexion API établie | 🤖 AUTO | P2 | 🏠 ProfileAgence.fiduciaire_connected_at | ➕ | Workflow OAuth |
| Test connexion | 🤖 AUTO | P2 | UI | ➕ | Bouton test |

### Sous-section : Honoraires standards

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Templates honoraires par type mandat | 👤 USER 🎯 | P2 | 🏠 ProfileAgence.default_fees | ➕ | Onboarding |
| Honoraires location % | 👤 USER 🎯 | P2 | 🏠 ProfileAgence.default_fees.location | ➕ | Default 6-8% |
| Honoraires vente % | 👤 USER 🎯 | P4 | 🏠 ProfileAgence.default_fees.vente | ➕ | Default 3% |
| Frais relocation | 👤 USER | P2 | 🏠 ProfileAgence.default_fees.relocation | ➕ | Default 1 mois loyer |
| Frais EDL | 👤 USER | P2 | 🏠 ProfileAgence.default_fees.edl | ➕ | Default CHF 200 |

### Sous-section : Configuration produit

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Plan Althy actif | 🤖 AUTO | P2 | ↗ Subscription | ✅ | CHF 49/agent/mois |
| Nombre agents max | 🤖 AUTO | P2 | calcul | ✅ | Selon plan |
| Pack diffusion | 👤 USER | P2 | ↗ User.diffusion_pack | ➕ | Découverte/Standard/Pro/Premium |
| Branding personnalisé (logo dans emails / docs générés) | 👤 USER | P3 | 🏠 ProfileAgence.branding | ➕ | Upload + colors |

---

## SECTION UI : Sphère IA (agence)

→ Identique proprio_solo, mais capacités IA agence supplémentaires :

| Capacité additionnelle | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Analyse rentabilité agence | 🧠 IA | P2 | calcul | ➕ | Insights cross-mandats |
| Suggestions optimisation portefeuille | 🧠 IA | P2 | calcul | ➕ | « Bien X sous-loué de 8% » |
| Alertes anomalies financières | 🧠 IA | P3 | calcul | ➕ | « Charge atypique sur Bien Y » |
| Préparation décompte multi-mandats | 🧠 IA | P2 | UI | ➕ | Génération auto |
| Détection conformité | 🧠 IA | P3 | calcul | ➕ | « TVA Q3 à déclarer dans 7 jours » |

---

# RÔLE 3 — locataire

Locataire actuel ou candidat. **Ne paie jamais rien à Althy** (USP n°1, levier viralité). Si un endpoint facturait un locataire, c'est un bug à corriger immédiatement.

## SECTION UI : Tableau de bord locataire

URL : `/app/dashboard` (vue locataire).

### Sous-section : Bandeau briefing

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Salutation | 🤖 AUTO | P1 | calcul | ➕ | Heure |
| Mon bien actuel (carte synthèse) | 🤖 AUTO | P1 | ↗ Bien | ✅ | Si Locataire actif |
| Prochain loyer (date + montant) | 🤖 AUTO | P1 | calcul Contract + Transaction | ✅ | Auto |
| Notifications non lues | 🤖 AUTO | P1 | ↗ Notification | ✅ | Compteur |
| Actions à faire (signer doc / valider EDL / régler loyer) | 🤖 AUTO | P1 | calcul | ➕ | Liste priorisée |

### Sous-section : Carrés KPI locataire

| Carré | Donnée | Acquisition | Phase | Source | État |
|---|---|---|---|---|---|
| **Mon loyer** | Loyer mensuel | 🤖 AUTO | P1 | ↗ Contract.monthly_rent | ✅ |
| | Charges | 🤖 AUTO | P1 | ↗ Contract.charges | ✅ |
| | Total mensuel | 🔗 DÉDUIT | P1 | calcul | ➕ |
| **Statut** | Loyer ce mois (à payer / payé) | 🤖 AUTO | P1 | ↗ Transaction | ✅ |
| | Date prochain | 🤖 AUTO | P1 | calcul | ➕ |
| | Quittance dispo | 🤖 AUTO | P1 | ↗ Document | ✅ |
| **Bail** | Date fin | 🤖 AUTO | P1 | ↗ Contract.end_date | ✅ |
| | Préavis (mois) | 🤖 AUTO | P1 | ↗ Contract.preavis | ✅ |
| | Indexation possible | 🤖 AUTO | P1 | calcul | ➕ |
| **Caution** | Montant | 🤖 AUTO | P1 | ↗ Caution.amount | ✅ |
| | Type | 🤖 AUTO | P1 | ↗ Caution.type | ✅ |
| | Statut | 🤖 AUTO | P1 | ↗ Caution.status | ➕ |
| **Charges** | Acomptes payés année | 🔗 DÉDUIT | P1 | calcul | ➕ |
| | Décompte annuel reçu | 🤖 AUTO | P1 | ↗ ChargeStatement | ➕ |
| | Solde | 🔗 DÉDUIT | P1 | calcul | ➕ |
| **Communication** | Messages non lus | 🤖 AUTO | P1 | ↗ Conversation | ✅ |
| | Dernier message proprio/régie | 🤖 AUTO | P1 | ↗ ConversationMessage | ✅ |

---

## SECTION UI : Mon bien actuel

URL : `/app/mon-bien`. Vue lecture du bien loué.

### Sous-section : Identité bien (lecture seule)

→ Même données que fiche bien proprio_solo, **en lecture seule**. Pas d'édition.

| Donnée affichée | Acquisition | Phase | Source | État |
|---|---|---|---|---|
| Adresse | 🤖 AUTO | P1 | ↗ Bien | ✅ |
| Photos | 🤖 AUTO | P1 | ↗ BienImage | ✅ |
| Caractéristiques (surface, pièces, équipements) | 🤖 AUTO | P1 | ↗ Bien | ✅ |
| Annexes (cave, parking, casier) attribuées | 🤖 AUTO | P1 | ↗ BienAnnexe | ➕ |
| Compteurs avec relevé entrée | 🤖 AUTO | P1 | ↗ BienCompteur | ➕ |
| Code digicode immeuble | 🤖 AUTO | P1 | ↗ Bien.code_digicode | ➕ | Affichage **uniquement si autorisé** |
| Numéro badge | 🤖 AUTO | P1 | ↗ Bien.numero_badge | ➕ | Idem |
| Distances utiles | 🤖 AUTO | P1 | ↗ Bien.distance_* | ✅ | Lecture |

### Sous-section : Mon bail

→ Même structure que side panel locataire vu côté proprio, **mais lecture seule pour le locataire**.

| Donnée | Acquisition | Phase | Source | État |
|---|---|---|---|---|
| Dates début / fin | 🤖 AUTO | P1 | ↗ Contract | ✅ |
| Loyer / charges / caution | 🤖 AUTO | P1 | ↗ Contract | ✅ |
| Préavis | 🤖 AUTO | P1 | ↗ Contract.preavis | ✅ |
| Indexation IPC clause | 🤖 AUTO | P1 | ↗ Contract.indexation_clause | ➕ |
| Bail PDF | ↗ Document | P1 | ↗ Document | ✅ |
| EDL entrée signé | ↗ Document | P1 | ↗ Document | ✅ |
| Conditions spécifiques | 🤖 AUTO | P1 | ↗ Contract.conditions | ➕ |

### Sous-section : Donner mon préavis

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Date souhaitée de départ | 👤 USER | P1 | UI | ✅ | Datepicker |
| Calcul date effective (selon préavis) | 🔗 DÉDUIT | P1 | calcul | ✅ | Auto |
| Type résiliation (CO art. 266g et suivants) | 👤 USER | P1 | 🏠 Locataire.type_resiliation | ✅ | 5 types |
| Document préavis généré | 🤖 AUTO | P1 | ↗ Document | ✅ | Génération auto |
| Signature électronique | 📩 EXTERNE | P2 | UI | ➕ | Skribble.ch |
| Notification proprio/régie | 🤖 AUTO | P1 | ↗ Notification | ✅ | Auto |

---

## SECTION UI : Mes paiements

URL : `/app/paiements` (locataire).

### Sous-section : Loyers

| Donnée par loyer | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Mois concerné | 🤖 AUTO | P1 | ↗ Transaction | ✅ | Auto échéances |
| Montant | 🤖 AUTO | P1 | ↗ Transaction.amount | ✅ | Reflet Contract |
| Date d'échéance | 🤖 AUTO | P1 | ↗ Transaction.due_at | ✅ | Auto |
| Statut (à payer / payé / en retard) | 🤖 AUTO | P1 | ↗ Transaction.status | ✅ | Auto matching |
| QR-facture à payer | ↗ Document | P1 | ↗ Document | ✅ | Génération auto |
| Mode paiement utilisé | 🤖 AUTO | P1 | ↗ Transaction.mode | ✅ | QR direct / autre |
| Quittance générée (si payé) | ↗ Document | P1 | ↗ Document | ✅ | Auto |
| Total payé année courante | 🔗 DÉDUIT | P1 | calcul | ➕ | Auto |
| Historique total | 🔗 DÉDUIT | P1 | calcul | ➕ | Tous les loyers du bail |

### Sous-section : Charges / décompte

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Décompte annuel reçu | ↗ ChargeStatement | P1 | ↗ ChargeStatement | ➕ | Reflet |
| Détail charges qui paie quoi | 🤖 AUTO | P1 | ↗ ChargeLine where who_pays=locataire | ➕ | Filter |
| Justificatifs liés | ↗ Document | P1 | ↗ Document | ➕ | Auto-collecte |
| Solde régularisation | 🔗 DÉDUIT | P1 | calcul | ➕ | Auto |
| Bouton « Contester » | 👤 USER | P2 | UI | ➕ | Workflow |
| Validation décompte | 👤 USER | P1 | UI | ➕ | 1 clic |

### Sous-section : Documents fiscaux locataire

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Attestation loyer payé année (pour impôts) | 🤖 AUTO | P1 | ↗ Document | ➕ | Génération auto janvier |
| Attestation domicile | 🤖 AUTO | P1 | ↗ Document | ✅ | Génération à la demande |

---

## SECTION UI : Ma caution

URL : `/app/caution`.

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Type caution | 🤖 AUTO | P1 | ↗ Caution.type | ✅ | Lecture |
| Montant versé | 🤖 AUTO | P1 | ↗ Caution.amount | ✅ | Lecture |
| IBAN compte bloqué (si type=compte_bloqué) | 🤖 AUTO | P1 | ↗ Caution.iban_compte_bloque | ➕ | Lecture |
| Organisme assurance (si type=organisme) | 🤖 AUTO | P1 | ↗ Caution.organisme | ➕ | Lecture |
| Date versement | 🤖 AUTO | P1 | ↗ Caution.received_at | ➕ | Auto |
| Statut (versée / en libération / restituée) | 🤖 AUTO | P1 | ↗ Caution.status | ➕ | Auto |
| Retenues éventuelles + motifs | 🤖 AUTO | P1 | ↗ CautionRetenue | ➕ | Lecture |
| Document libération | ↗ Document | P1 | ↗ Document | ➕ | Si libérée |
| Bouton « Contester retenue » | 👤 USER | P2 | UI | ➕ | Workflow conciliation |

---

## SECTION UI : Mes interventions

URL : `/app/interventions` (locataire).

### Sous-section : Liste interventions signalées

| Donnée par intervention | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Liste interventions signalées par moi | 🤖 AUTO | P1 | ↗ WorkOrder where signale_par_id=user.id | ✅ | Filter |
| Statut workflow | 🤖 AUTO | P1 | ↗ WorkOrder.statut | ✅ | Auto |
| Avancement | 🤖 AUTO | P1 | ↗ WorkOrder.avancement | ✅ | Auto |
| Photos avant/après | 🤖 AUTO | P1 | ↗ Document | ✅ | Lecture |
| Date prévue intervention | 🤖 AUTO | P1 | ↗ WorkOrder.date_intervention | ✅ | Lecture |
| Artisan assigné | 🤖 AUTO | P2 | ↗ ProfileArtisan | ✅ | Lecture |

### Sous-section : Signaler nouvelle intervention

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Bouton « Signaler » | 👤 USER | P1 | UI | ✅ | Sphère IA prend le relais |
| Description en langage naturel | 👤 USER | P1 | ↗ WorkOrder.description | ✅ | Sphère IA structure |
| Catégorie auto-détectée | 🧠 IA | P1 | ↗ WorkOrder.categorie | ✅ | IA classe |
| Urgence auto-évaluée | 🧠 IA | P1 | ↗ WorkOrder.urgence | ✅ | IA évalue |
| Photos uploadées | 👤 USER | P1 | ↗ Document | ✅ | Upload + IA tag |
| Validation envoi | 👤 USER | P1 | UI | ✅ | 1 clic |

---

## SECTION UI : Mes documents

URL : `/app/documents` (locataire).

### Sous-section : Coffre-fort locataire

| Document | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Bail signé | 🤖 AUTO | P1 | ↗ Document filter category=bail | ✅ | Lecture |
| EDL entrée signé | 🤖 AUTO | P1 | ↗ Document filter category=edl_entree | ✅ | Lecture |
| EDL sortie (si effectué) | 🤖 AUTO | P1 | ↗ Document filter category=edl_sortie | ✅ | Lecture |
| Quittances mensuelles | 🤖 AUTO | P1 | ↗ Document filter category=quittance | ✅ | Auto-générées |
| Attestations diverses | 🤖 AUTO | P1 | ↗ Document filter | ✅ | Selon demandes |
| Décomptes de charges | ↗ ChargeStatement | P1 | ↗ Document | ➕ | Reçus annuels |
| Document libération caution | ↗ Document | P1 | ↗ Document | ➕ | À la sortie |
| Mon dossier locataire (TenantFile) | 🤖 AUTO | P1 | ↗ Document filter | ✅ | Documents fournis lors candidature |

### Sous-section : Demander un document

| Action | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Demander attestation domicile | 👤 USER | P1 | UI | ✅ | 1 clic, génération auto |
| Demander attestation paiement loyer | 👤 USER | P1 | UI | ✅ | 1 clic |
| Demander attestation bail | 👤 USER | P1 | UI | ✅ | 1 clic |

---

## SECTION UI : Communication

URL : `/app/communication` (locataire).

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Conversations avec proprio/régie | 🤖 AUTO | P1 | ↗ Conversation | ✅ | Filter participants |
| Notifications | 🤖 AUTO | P1 | ↗ Notification | ✅ | Auto |
| Canal préféré (P2) | 👤 USER | P2 | ↗ User.notif_* | ✅ | Email/SMS/WhatsApp/in-app |
| Envoyer message | 👤 USER | P1 | UI | ✅ | Multi-canal |
| Templates rapides (rappel paiement / signaler problème / demande document) | 🤖 AUTO | P2 | 🏠 NotificationTemplate | ➕ | Pré-rédigés |

---

## SECTION UI : Recherche d'un bien (mode candidat)

URL : `/app/recherche`. Mode candidat (le locataire cherche un nouveau logement).

### Sous-section : Annonces visibles

| Donnée par annonce | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Liste annonces actives filtrées | 🤖 AUTO | P1 | ↗ Listing where status=active | ✅ | Filter |
| Critères filtres (canton / surface / pièces / loyer max / dispo) | 👤 USER | P1 | UI | ✅ | Multi-filtre |
| Détail annonce (photos, description, prix, dispo) | 🤖 AUTO | P1 | ↗ Listing | ✅ | Lecture |
| Calculatrice budget (revenus × 3 = loyer max) | 🔗 DÉDUIT | P1 | calcul | ➕ | Standard CH |
| Score adéquation (basé sur dossier locataire) | 🧠 IA | P2 | calcul | ➕ | IA matche |
| Favoris | 👤 USER | P1 | ↗ Favorite | ✅ | Cœur 1 clic |
| Alertes nouveaux biens matchant critères | 🤖 AUTO | P2 | calcul | ➕ | Email/push |

### Sous-section : Mes candidatures

| Donnée par candidature | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Liste candidatures soumises | 🤖 AUTO | P1 | ↗ Candidature where candidat_id=user.id | ✅ | Filter |
| Statut (soumise / en cours / acceptée / refusée) | 🤖 AUTO | P1 | ↗ Candidature.statut | ✅ | Auto |
| Annonce associée | 🤖 AUTO | P1 | ↗ Listing | ✅ | FK |
| Date soumission | 🤖 AUTO | P1 | ↗ Candidature.created_at | ✅ | Auto |
| Documents soumis | 🤖 AUTO | P1 | ↗ Document | ✅ | Lecture |
| Score affiché | 🤖 AUTO | P1 | ↗ ScoringLocataire | ✅ | Transparence |
| Suggestions d'amélioration dossier | 🧠 IA | P2 | calcul | ➕ | « Ajoute ton attestation employeur » |

### Sous-section : Mon dossier locataire (TenantFile)

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Identité (nom / prénom / naissance / nationalité) | 🧠 IA | P1 | ↗ TenantFile | ✅ | OCR pièce identité |
| Type contrat travail | 👤 USER 🎯 | P1 | ↗ TenantFile.type_contrat | ✅ | Onboarding |
| Employeur | 👤 USER 🎯 | P1 | ↗ TenantFile.employeur | ✅ | Onboarding |
| Salaire | 🧠 IA | P1 | ↗ TenantFile.salaire | ✅ | OCR fiche salaire |
| Fiche salaire (3 derniers) | 👤 USER | P1 | ↗ Document | ✅ | Upload, OCR |
| Extrait poursuites | 👤 USER | P1 | ↗ Document | ✅ | Upload (gratuit en CH) |
| Attestation employeur | 👤 USER | P1 | ↗ Document | ✅ | Upload |
| Pièce identité | 👤 USER 🎯 | P1 | ↗ Document | ✅ | Onboarding 1 fois |
| Garant éventuel | 👤 USER | P1 | ↗ BienContact type=garant | ➕ | Optionnel |
| Score IA solvabilité | 🧠 IA | P1 | ↗ ScoringLocataire | ✅ | Auto |
| Profil candidat anonymisé public | 🤖 AUTO | P2 | calcul | ➕ | Dossier réutilisable multi-candidatures |

### Sous-section : Suggestion proactive (P2)

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Biens correspondant à mon profil | 🧠 IA | P2 | calcul | ➕ | IA matche TenantFile + budget |
| Notification quand nouveau bien match | 🤖 AUTO | P2 | calcul | ➕ | Email/push selon préférences |
| Suggestions partenaires (caution organisme / assurance RC / déménagement) | 🤖 AUTO | P3 | calcul | ➕ | Affilié, commissions Althy |

---

## SECTION UI : Mon profil (locataire)

URL : `/app/profil` (locataire).

### Sous-section : Identité

→ Identique proprio_solo §1 mais sans champs fiscaux pro et sans IBAN comme bénéficiaire (locataire ne reçoit pas de loyer).

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Prénom + nom | 🧠 IA | P1 | ↗ User profil | ✅ | OCR pièce identité |
| Date naissance | 🧠 IA | P1 | ↗ User profil | ✅ | OCR |
| Email | 👤 USER 🎯 | P1 | ↗ User.email | ✅ | Inscription |
| Téléphone | 👤 USER 🎯 | P1 | ↗ User.phone | ✅ | Onboarding |
| Adresse actuelle | 👤 USER | P1 | ↗ User.adresse | ✅ | Auto si Locataire actif (depuis Bien adresse) |
| Photo profil | 👤 USER | P2 | ↗ Document | ➕ | Optionnel |
| Langue préférée | 🤖 AUTO | P1 | ↗ User.locale | ✅ | Détection navigateur |

### Sous-section : Mon abonnement

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Plan locataire | 🤖 AUTO | P1 | UI | ✅ | **Toujours gratuit** |
| Mention « Althy gratuit pour locataires » | 🤖 AUTO | P1 | UI | ✅ | USP affichée |

### Sous-section : Préférences notifications + sécurité + langue

→ Identique proprio_solo §1 (mêmes structures, scope locataire).

---

# RÔLE 4 — artisan (P2-3)

Prestataire (plombier, électricien, peintre, jardinier, etc.) qui exécute des interventions. Marketplace M1 partielle déjà active en P1 (50 places fondateurs GE+VD), full marketplace en P3.

## SECTION UI : Tableau de bord artisan

URL : `/app/dashboard` (vue artisan).

### Carrés KPI

| Carré | Donnée | Acquisition | Phase | Source | État |
|---|---|---|---|---|---|
| **Demandes** | RFQ reçues à traiter | 🤖 AUTO | P2 | ↗ Quote where status=pending | ➕ |
| | Délai moyen réponse | 🔗 DÉDUIT | P2 | calcul | ➕ |
| | Taux acceptation | 🔗 DÉDUIT | P2 | calcul | ➕ |
| **Interventions** | En cours | 🤖 AUTO | P2 | ↗ WorkOrder where artisan=user | ➕ |
| | Planifiées 7j | 🤖 AUTO | P2 | calcul | ➕ |
| | Cumulées année | 🔗 DÉDUIT | P2 | calcul | ➕ |
| **Revenus** | CA mois courant | 🤖 AUTO | P2 | ↗ Invoice | ➕ |
| | CA cumul année | 🔗 DÉDUIT | P2 | calcul | ➕ |
| | Net après commission Althy 5% | 🔗 DÉDUIT | P2 | calcul | ➕ |
| **Réputation** | Note moyenne | 🤖 AUTO | P2 | ↗ Rating.score | ✅ |
| | Nombre avis | 🔗 DÉDUIT | P2 | calcul | ✅ |
| | Score qualité IA | 🧠 IA | P3 | calcul | ➕ |
| **Disponibilité** | Calendrier 7j | 👤 USER | P2 | ↗ Availability | ➕ |
| | Zone d'intervention | 👤 USER 🎯 | P2 | ↗ ProfileArtisan.zones | ➕ |

---

## SECTION UI : Mes interventions (artisan)

URL : `/app/interventions` (artisan).

### Sous-section : Liste interventions assignées

| Donnée par intervention | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Liste WorkOrder où artisan=user | 🤖 AUTO | P2 | ↗ WorkOrder | ✅ | Filter |
| Catégorie + urgence | 🤖 AUTO | P2 | ↗ WorkOrder | ✅ | Lecture |
| Adresse bien (anonymisée jusqu'acceptation) | 🤖 AUTO | P2 | ↗ Bien | ➕ | Anonymisée |
| Description prestation | 🤖 AUTO | P2 | ↗ WorkOrder.description | ✅ | Lecture |
| Photos avant uploadées par proprio/locataire | 🤖 AUTO | P2 | ↗ Document | ✅ | Lecture |
| Date intervention prévue | 🤖 AUTO | P2 | ↗ WorkOrder.date_intervention | ✅ | Lecture |
| Coût accepté | 🤖 AUTO | P2 | ↗ Quote.montant accepté | ✅ | Lecture |
| Statut | 🤖 AUTO | P2 | ↗ WorkOrder.statut | ✅ | Workflow artisan |
| Avancement % | 👤 USER | P2 | ↗ WorkOrder.avancement | ✅ | Slider |

### Sous-section : Side panel intervention (artisan)

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Mettre à jour avancement | 👤 USER | P2 | UI | ✅ | Slider |
| Uploader photos après | 👤 USER | P2 | ↗ Document | ✅ | Upload + IA tag |
| Demander acompte (si applicable) | 👤 USER | P2 | UI | ➕ | Workflow Stripe Connect |
| Marquer comme terminé | 👤 USER | P2 | UI | ✅ | Demande validation proprio |
| Émettre facture finale | 🤖 AUTO | P2 | ↗ Invoice | ➕ | Auto post-validation proprio |
| Chat avec proprio/régie | 👤 USER | P2 | ↗ ConversationMessage | ➕ | In-app |

---

## SECTION UI : Devis (Quote consolidé)

URL : `/app/devis` (artisan).

### Sous-section : Liste devis

| Donnée par devis | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Liste Quote où artisan=user | 🤖 AUTO | P2 | ↗ Quote | ✅ | Filter |
| Statut (en attente / envoyé / accepté / refusé / expiré) | 🤖 AUTO | P2 | ↗ Quote.statut | ✅ | Workflow |
| Lien WorkOrder | 🤖 AUTO | P2 | ↗ Quote.workorder_id | ✅ | FK |
| Date envoi | 🤖 AUTO | P2 | ↗ Quote.date_envoi | ✅ | Auto |
| Montant TTC | 👤 USER | P2 | ↗ Quote.montant | ✅ | Saisie |
| TVA | 🤖 AUTO | P2 | ↗ Quote.tva | ➕ | Default 8.1% si assujetti |
| Description prestation | 👤 USER | P2 | ↗ Quote.description | ✅ | Texte |
| Délai validité | 👤 USER | P2 | ↗ Quote.validity_days | ➕ | Default 30 jours |
| Délai exécution | 👤 USER | P2 | ↗ Quote.delai_execution | ➕ | Saisie jours |
| PDF généré | 🤖 AUTO | P2 | ↗ Document | ➕ | Génération auto |
| Concurrence (autres devis sur même WO) | 🤖 AUTO | P2 | calcul | ➕ | Visible artisan |
| Comparaison IA prix marché | 🧠 IA | P2 | ↗ Quote.ai_comparison | ✅ | Si surfacturé/sous-facturé |

### Sous-section : Templates devis

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Templates par catégorie prestation | 👤 USER | P3 | 🏠 QuoteTemplate | ➕ | Réutilisable |
| Lignes types (plomberie : changement robinet / fuite / etc.) | 👤 USER | P3 | 🏠 QuoteTemplate.lines | ➕ | Bibliothèque artisan |

---

## SECTION UI : Mon profil artisan (ProfileArtisan)

URL : `/app/profil` (artisan). Profil pro consolidé.

### Sous-section : Identité entreprise

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Raison sociale | 👤 USER 🎯 | P2 | 🏠 ProfileArtisan.raison_sociale | ➕ | Onboarding |
| IDE | 🧠 IA | P2 | 🏠 ProfileArtisan.ide | ➕ | Auto-recherche registre du commerce |
| Forme juridique | 🧠 IA | P2 | 🏠 ProfileArtisan.forme | ➕ | Idem |
| Adresse siège | 🧠 IA | P2 | 🏠 ProfileArtisan.adresse | ➕ | Idem |
| Logo | 👤 USER | P2 | ↗ Document | ➕ | Upload |
| Photo profil pro | 👤 USER | P2 | ↗ Document | ➕ | Optionnel |
| Bio courte | 👤 USER | P2 | 🏠 ProfileArtisan.bio | ➕ | Texte |

### Sous-section : Compétences et zones

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Catégories prestations (multi-select) | 👤 USER 🎯 | P2 | 🏠 ProfileArtisan.categories | ➕ | Onboarding (plomberie/élec/peinture/jardinage/serrurerie/etc.) |
| Sous-spécialités | 👤 USER | P2 | 🏠 ProfileArtisan.sub_categories | ➕ | Multi-select |
| Zones d'intervention (cantons / villes / rayon km) | 👤 USER 🎯 | P2 | 🏠 ProfileArtisan.zones | ➕ | Onboarding |
| Disponibilité 24/7 (urgence) | 👤 USER | P3 | 🏠 ProfileArtisan.urgence_24_7 | ➕ | Toggle |

### Sous-section : Tarification

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Tarif horaire | 👤 USER | P2 | 🏠 ProfileArtisan.hourly_rate | ➕ | CHF/h |
| Tarif déplacement | 👤 USER | P2 | 🏠 ProfileArtisan.travel_fee | ➕ | Forfait |
| Tarif urgence (majoration) | 👤 USER | P3 | 🏠 ProfileArtisan.emergency_rate | ➕ | % majoration |

### Sous-section : Documents légaux

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Extrait registre du commerce | 👤 USER 🎯 | P2 | ↗ Document | ➕ | Upload |
| Attestation TVA | 👤 USER 🎯 | P2 | ↗ Document | ➕ | Upload |
| Assurance RC pro | 👤 USER 🎯 | P2 | ↗ Document | ➕ | Upload |
| Certifications métier (CFC etc.) | 👤 USER | P2 | ↗ Document | ➕ | Upload optionnel |
| Vérification Althy (badge vérifié) | 🤖 AUTO | P3 | 🏠 ProfileArtisan.verified | ➕ | Modération Althy |

### Sous-section : Stripe Connect (pour recevoir paiements)

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Compte Stripe Connect onboardé | 📩 EXTERNE | P2 | ↗ StripeAccount | ✅ | OAuth Stripe |
| Statut KYC | 📩 EXTERNE | P2 | ↗ StripeAccount.kyc_status | ✅ | Auto |
| IBAN payout | 📩 EXTERNE | P2 | ↗ StripeAccount.payout_iban | ✅ | Saisi via Stripe |
| Commission Althy 5% | 🤖 AUTO | P2 | calcul | ✅ | Auto split |

### Sous-section : Réputation

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Note moyenne | 🤖 AUTO | P2 | ↗ Rating.score | ✅ | Calcul auto |
| Avis détaillés | 📩 EXTERNE | P2 | ↗ Rating | ✅ | Proprios laissent avis |
| Nombre interventions cumulées | 🔗 DÉDUIT | P2 | calcul | ✅ | Compteur |
| Score qualité IA | 🧠 IA | P3 | calcul | ➕ | Croisement délai/prix/satisfaction |
| Badge « Vérifié Althy » | 🤖 AUTO | P3 | 🏠 ProfileArtisan.verified | ➕ | Modération |
| Badge « Top performer » | 🤖 AUTO | P3 | calcul | ➕ | Top 10% catégorie |

---

## SECTION UI : Disponibilités

URL : `/app/disponibilites` (artisan, P3).

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Calendrier hebdomadaire récurrent | 👤 USER | P3 | ↗ Availability | ➕ | Plages horaires par jour |
| Exceptions (vacances / jours fermés) | 👤 USER | P3 | ↗ Availability.exception | ➕ | Datepicker |
| Sync Google Calendar (P3) | 📩 EXTERNE | P3 | OAuth | ➕ | Lecture seule |

---

# RÔLE 5 — opener (P3)

Pro de terrain qui fait visites, EDL, check-in, check-out à la place du proprio absent. Marketplace ouverte en P3.

## SECTION UI : Tableau de bord opener

| Carré | Donnée | Acquisition | Phase | Source | État |
|---|---|---|---|---|---|
| **Missions** | À faire 7j | 🤖 AUTO | P3 | ↗ WorkOrder type=opening | ➕ |
| | En cours | 🤖 AUTO | P3 | ↗ WorkOrder | ➕ |
| | Cumulées année | 🔗 DÉDUIT | P3 | calcul | ➕ |
| **Revenus** | CA mois | 🤖 AUTO | P3 | ↗ Invoice | ➕ |
| | Net après commission 10-15% | 🔗 DÉDUIT | P3 | calcul | ➕ |
| **Réputation** | Note moyenne | 🤖 AUTO | P3 | ↗ Rating | ➕ |
| | Nombre missions | 🔗 DÉDUIT | P3 | calcul | ➕ |
| **Calendrier** | Disponibilités semaine | 👤 USER | P3 | ↗ Availability | ➕ |

---

## SECTION UI : Mes missions

| Donnée par mission | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Type mission (visite / EDL entrée / EDL sortie / check-in / check-out / remise clés) | 🤖 AUTO | P3 | ↗ WorkOrder.type | ➕ | Auto depuis demande |
| Bien concerné (anonymisé jusqu'acceptation) | 🤖 AUTO | P3 | ↗ Bien | ➕ | Anonymisé |
| Date / heure | 🤖 AUTO | P3 | ↗ WorkOrder.date_intervention | ➕ | Lecture |
| Durée estimée | 🤖 AUTO | P3 | ↗ WorkOrder.duration_estimated | ➕ | Lecture |
| Tarif accepté | 🤖 AUTO | P3 | ↗ Quote.montant | ➕ | Lecture |
| Documents à remplir (formulaires EDL structurés) | 🤖 AUTO | P3 | UI | ➕ | Templates Althy |
| Photos à prendre | 👤 USER | P3 | ↗ Document | ➕ | Upload terrain |
| Signature électronique sur place | 📩 EXTERNE | P3 | UI | ➕ | Skribble |
| Statut workflow | 🤖 AUTO | P3 | ↗ WorkOrder.statut | ➕ | Auto |
| Compte-rendu IA généré | 🧠 IA | P3 | calcul | ➕ | Synthèse auto post-mission |

---

## SECTION UI : Mon profil opener (ProfileOpener)

→ Structure similaire ProfileArtisan.

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Identité légale | 👤 USER 🎯 | P3 | 🏠 ProfileOpener | ➕ | Onboarding |
| Zone d'intervention | 👤 USER 🎯 | P3 | 🏠 ProfileOpener.zones | ➕ | Onboarding |
| Tarifs (par type mission) | 👤 USER | P3 | 🏠 ProfileOpener.tarifs | ➕ | Setup |
| Disponibilités | 👤 USER | P3 | ↗ Availability | ➕ | Calendrier |
| Documents légaux | 👤 USER 🎯 | P3 | ↗ Document | ➕ | Onboarding |
| Stripe Connect | 📩 EXTERNE | P3 | ↗ StripeAccount | ➕ | OAuth |
| Réputation (note + avis) | 🤖 AUTO | P3 | ↗ Rating | ➕ | Auto |
| Badge vérifié Althy | 🤖 AUTO | P3 | 🏠 ProfileOpener.verified | ➕ | Modération |
| Spécialisations (vente / location / saisonnier) | 👤 USER | P3 | 🏠 ProfileOpener.specialties | ➕ | Multi-select |

---

# RÔLE 6 — hunter (P3)

Apporteur d'affaires. **Tout user peut être Hunter** sur un bien (cross-produit) avec accord proprio. Slogan UX : *« Finance ton réseau »*. Applicable location P3 + vente P4.

## SECTION UI : Mode Hunter

URL : `/app/hunter`. Module activable depuis n'importe quel compte user.

### Sous-section : Activer mode Hunter

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Toggle « Activer mode Hunter » | 👤 USER | P3 | ↗ User.hunter_mode | ➕ | 1 clic |
| Acceptation conditions Hunter | 👤 USER | P3 | ↗ User.hunter_terms_accepted_at | ➕ | CGU spécifiques |
| Profil Hunter (si renseigné) | 👤 USER | P3 | 🏠 ProfileHunter | ➕ | Optionnel |

### Sous-section : Mes apports

| Donnée par apport | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Liste HunterReferral | 🤖 AUTO | P3 | ↗ HunterReferral | ➕ | Filter user.id |
| Bien apporté | 🤖 AUTO | P3 | ↗ Bien | ➕ | FK |
| Type apport (location / vente / mandat agence) | 🤖 AUTO | P3 | ↗ HunterReferral.type | ➕ | Auto |
| Statut (proposé / accepté proprio / converti / payé) | 🤖 AUTO | P3 | ↗ HunterReferral.status | ➕ | Workflow |
| Date apport initial | 🤖 AUTO | P3 | ↗ HunterReferral.created_at | ➕ | Auto |
| Date conversion (bail signé / vente conclue) | 🤖 AUTO | P3 | ↗ HunterReferral.converted_at | ➕ | Auto |
| Commission négociée | 👤 USER | P3 | ↗ HunterReferral.commission | ➕ | % négocié |
| Commission Althy split | 🤖 AUTO | P3 | calcul | ➕ | Auto |
| Net Hunter | 🔗 DÉDUIT | P3 | calcul | ➕ | Auto |

### Sous-section : Apporter un bien

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Sélectionner bien (depuis catalogue Althy) | 👤 USER | P3 | UI | ➕ | Autocomplete |
| Ajouter contacts Hunter (HunterContact) | 👤 USER | P3 | 🏠 HunterContact | ➕ | Liste contacts apportés |
| Type contact (futur locataire / acheteur / vendeur potentiel) | 👤 USER | P3 | 🏠 HunterContact.type | ➕ | Dropdown |
| Détails contact (nom / email / tel / contexte) | 👤 USER | P3 | 🏠 HunterContact | ➕ | Form |
| Validation proprio bien | 🤖 AUTO | P3 | UI | ➕ | Auto demande proprio |
| Champ Bien.hunter_id activé | 🤖 AUTO | P3 | ↗ Bien.hunter_id | ➕ | Auto post-acceptation |
| Champ Bien.hunter_commission_rate | 👤 USER | P3 | ↗ Bien.hunter_commission_rate | ➕ | Saisie négociée |

### Sous-section : Stripe Connect Hunter

→ Identique artisan/opener pour recevoir les commissions.

---

# RÔLE 7 — fiduciaire (P2-3)

Comptable externe accédant en lecture aux données comptables des proprios/agences clients.

## SECTION UI : Tableau de bord fiduciaire

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Liste clients (proprios + agences) | 🤖 AUTO | P2 | ↗ FiduciaireAccess | ➕ | Permissions |
| Échéances fiscales par client | 🤖 AUTO | P2 | calcul | ➕ | Auto |
| Décomptes en attente validation | 🤖 AUTO | P2 | ↗ OwnerStatement.validated_at IS NULL | ➕ | Filter |
| Documents fiscaux à transmettre | 🤖 AUTO | P2 | ↗ TaxStatement | ➕ | Filter |

---

## SECTION UI : Vue client

→ Le fiduciaire consulte en lecture seule les sections Finances + Centre comptable + Documents fiscaux du client connecté.

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Bilan synthétique client | 🔗 DÉDUIT | P3 | calcul | ➕ | Lecture |
| Compte de résultat | 🔗 DÉDUIT | P2 | calcul | ➕ | Lecture |
| Décomptes propriétaires | 🤖 AUTO | P2 | ↗ OwnerStatement | ➕ | Lecture |
| TVA déclarations | 🤖 AUTO | P2 | ↗ VATReport | ➕ | Lecture |
| Pièces justificatives | 🤖 AUTO | P2 | ↗ Document | ➕ | Lecture |
| Export 1 clic vers son outil (Bexio/Banana/AbaWeb) | 🤖 AUTO | P2 | ↗ AccountingExport | ➕ | Auto |

### Sous-section : Annotations fiduciaire

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Notes par écriture | 👤 USER | P3 | 🏠 FiduciaireNote | ➕ | Annotation collaborative |
| Demandes de complément au client | 👤 USER | P3 | ↗ ConversationMessage | ➕ | Workflow |
| Validation écriture | 👤 USER | P3 | 🏠 FiduciaireNote.validated | ➕ | Workflow approbation |

---

# RÔLE 8 — super_admin

Admin technique Anthropic / Killian + futurs collaborateurs Althy.

## SECTION UI : Tableau de bord super_admin

URL : `/admin`.

### Carrés KPI plateforme

| Carré | Donnée | Acquisition | Phase | Source | État |
|---|---|---|---|---|---|
| **Users** | Total inscrits | 🤖 AUTO | P1 | ↗ User | ✅ |
| | Actifs 30j | 🔗 DÉDUIT | P1 | calcul | ✅ |
| | Nouveaux 7j | 🔗 DÉDUIT | P1 | calcul | ✅ |
| | Par rôle | 🔗 DÉDUIT | P1 | calcul | ✅ |
| **Biens** | Total créés | 🤖 AUTO | P1 | ↗ Bien | ✅ |
| | Actifs (statut ≠ archivé) | 🔗 DÉDUIT | P1 | calcul | ✅ |
| **MRR** | MRR total | 🔗 DÉDUIT | P1 | calcul Subscription | ✅ |
| | Évolution % | 🔗 DÉDUIT | P2 | calcul | ➕ |
| | Churn rate | 🔗 DÉDUIT | P2 | calcul | ➕ |
| **Marketplace** | Devis générés | 🤖 AUTO | P2 | ↗ Quote | ✅ |
| | Commissions encaissées | 🔗 DÉDUIT | P2 | calcul | ➕ |
| **Système** | Erreurs Sentry 24h | 📩 EXTERNE | P1 | API Sentry | ✅ |
| | Uptime BetterStack | 📩 EXTERNE | P1 | API | ✅ |
| | Latence API moyenne | 🤖 AUTO | P1 | monitoring | ✅ |

---

## SECTION UI : Gestion utilisateurs

| Action | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Liste tous users | 🤖 AUTO | P1 | ↗ User | ✅ | Pagination |
| Filtrer par rôle / canton / plan / statut | 👤 USER | P1 | UI | ✅ | Multi-filtre |
| Recherche email / nom | 👤 USER | P1 | UI | ✅ | Search |
| Créer user manuellement | 👤 USER | P1 | UI | ✅ | Form admin |
| Modifier user (rôle / plan / statut) | 👤 USER | P1 | UI | ✅ | Édition |
| Suspendre / réactiver | 👤 USER | P1 | UI | ✅ | Toggle |
| Supprimer (soft delete avec audit) | 👤 USER | P1 | UI | ✅ | Workflow |
| Impersonate (mode debug) | 👤 USER | P1 | UI | ✅ | Token temporaire avec audit |
| Forcer reset mot de passe | 👤 USER | P1 | UI | ✅ | Email |
| Voir audit log par user | 👤 USER | P1 | ↗ AuditLog | ✅ | Filter actor_id |

---

## SECTION UI : Waitlist (Coming Soon)

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Liste waitlist par rôle | 🤖 AUTO | P1 | ↗ Waitlist | ✅ | Filter |
| Date inscription | 🤖 AUTO | P1 | ↗ Waitlist.created_at | ✅ | Auto |
| Source (UTM) | 🤖 AUTO | P1 | ↗ Waitlist.source | ✅ | Tracking |
| Activer accès (basculer en user) | 👤 USER | P1 | UI | ✅ | Workflow d'activation |
| Email de bienvenue auto | 🤖 AUTO | P1 | ↗ EmailLog | ✅ | Resend |

---

## SECTION UI : Marketplace partners (curated)

| Donnée par partenaire | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Liste partenaires actifs | 🤖 AUTO | P2 | ↗ Partner | ➕ | Curated |
| Type (caution / assurance / déménagement / internet / énergie / SOS / fiduciaire / banque) | 👤 USER | P2 | 🏠 Partner.type | ➕ | Dropdown |
| Statut (en discussion / signé / actif / suspendu) | 👤 USER | P2 | 🏠 Partner.status | ➕ | Workflow |
| Commission négociée | 👤 USER | P2 | 🏠 Partner.commission | ➕ | % ou fixe |
| API connectée | 📩 EXTERNE | P2 | 🏠 Partner.api_connected | ➕ | OAuth |
| Trafic redirigé (clics / conversions) | 📩 EXTERNE | P3 | tracking | ➕ | Analytics |
| Commissions encaissées | 🔗 DÉDUIT | P2 | calcul | ➕ | Auto |

---

## SECTION UI : Système et observabilité

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Logs Sentry temps réel | 📩 EXTERNE | P1 | API Sentry | ✅ | Embed |
| Uptime BetterStack | 📩 EXTERNE | P1 | API | ✅ | Embed |
| Logs Railway | 📩 EXTERNE | P1 | dashboard | ✅ | Lien externe |
| Logs Vercel | 📩 EXTERNE | P1 | dashboard | ✅ | Lien externe |
| Métriques DB (connexions / queries lentes) | 📩 EXTERNE | P1 | Supabase | ✅ | Dashboard Supabase |
| Quota IA tokens consommés global | 🤖 AUTO | P1 | calcul | ✅ | Compteur |
| Quota Anthropic API | 📩 EXTERNE | P1 | API Anthropic | ✅ | Dashboard |

---

## SECTION UI : Audit log global

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Tous events système | 🤖 AUTO | P1 | ↗ AuditLog | ✅ | Pagination |
| Filtres (actor / target / type / period) | 👤 USER | P1 | UI | ✅ | Multi-filtre |
| Détail event (before/after/IP/UA) | 🤖 AUTO | P1 | ↗ AuditLog | ✅ | Modale |
| Export CSV | 🤖 AUTO | P1 | UI | ✅ | Bouton |

---

## SECTION UI : Configuration plateforme

| Donnée | Acquisition | Phase | Source | État | Stratégie |
|---|---|---|---|---|---|
| Feature flags par phase | 👤 USER | P1 | 🏠 FeatureFlag | ✅ | Toggle ON/OFF |
| Activation rôles par environnement | 👤 USER | P1 | env vars | ✅ | ALLOWED_SIGNUP_ROLES |
| Locales activées | 👤 USER | P2 | env vars | ✅ | LOCALES_ENABLED |
| Plans tarifaires actifs | 👤 USER | P1 | 🏠 Plan | ✅ | Liste |
| Templates emails / docs / notifs | 👤 USER | P1 | 🏠 Template | ✅ | Édition |
| Maintenance mode | 👤 USER | P1 | 🏠 SystemConfig.maintenance | ✅ | Toggle |

---

# DOMAINES TRANSVERSES (12)

Ces domaines ne sont pas attachés à un rôle unique mais sont mobilisés à travers Althy.

## T1 — AuditLog

Source : 🏠 AuditLog. Phase : P1.

| Champ | Type | Acquisition | Phase | Description |
|---|---|---|---|---|
| id | UUID | 🤖 AUTO | P1 | PK |
| created_at | timestamp | 🤖 AUTO | P1 | Auto |
| actor_id | UUID | 🤖 AUTO | P1 | User déclencheur |
| actor_role | enum | 🤖 AUTO | P1 | Rôle au moment action |
| target_type | string | 🤖 AUTO | P1 | Bien / Contract / etc. |
| target_id | UUID | 🤖 AUTO | P1 | FK polymorphe |
| event_type | enum | 🤖 AUTO | P1 | create/update/delete/access/login/payment/etc. |
| before_value | JSONB | 🤖 AUTO | P1 | État avant |
| after_value | JSONB | 🤖 AUTO | P1 | État après |
| ip_address | string | 🤖 AUTO | P1 | IP request |
| user_agent | string | 🤖 AUTO | P1 | Navigateur |
| session_id | UUID | 🤖 AUTO | P1 | Pour grouper actions |

**Stratégie** : Trigger DB + middleware FastAPI sur tous les endpoints sensibles. Conservation 10 ans (CO).

---

## T2 — Notification

Source : 🏠 Notification. Phase : P1.

| Champ | Type | Acquisition | Phase | Description |
|---|---|---|---|---|
| id | UUID | 🤖 AUTO | P1 | PK |
| user_id | UUID | 🤖 AUTO | P1 | Destinataire |
| type | enum | 🤖 AUTO | P1 | loyer_recu / candidature / intervention / indexation / etc. |
| title | string | 🧠 IA | P1 | Auto via template |
| body | string | 🧠 IA | P1 | Auto via template |
| context_type | string | 🤖 AUTO | P1 | Bien / Contract / etc. |
| context_id | UUID | 🤖 AUTO | P1 | FK polymorphe |
| priority | enum | 🤖 AUTO | P1 | low/normal/high/urgent |
| channels_sent | array | 🤖 AUTO | P1 | email/sms/push/whatsapp |
| read_at | timestamp | 👤 USER | P1 | Marqué comme lu |
| dismissed_at | timestamp | 👤 USER | P1 | Fermé sans lecture |
| action_url | string | 🤖 AUTO | P1 | CTA 1 clic |

---

## T3 — NotificationTemplate

Source : 🏠 NotificationTemplate. Phase : P1.

| Champ | Type | Acquisition | Description |
|---|---|---|---|
| id | UUID | 🤖 AUTO | PK |
| code | string | 🤖 AUTO | Slug unique (ex: `loyer_recu`) |
| locale | string | 🤖 AUTO | fr-CH / de-CH / it-CH / en |
| channel | enum | 🤖 AUTO | email / sms / push / whatsapp / in-app |
| title_template | string | 👤 USER | Template avec variables {{var}} |
| body_template | string | 👤 USER | Template |
| variables | array | 🤖 AUTO | Liste vars attendues |

**Stratégie** : 1 template = 1 (code, locale, channel). i18n par défaut.

---

## T4 — Subscription (Stripe)

Source : 🏠 Subscription. Phase : P1.

| Champ | Type | Acquisition | Phase | Description |
|---|---|---|---|---|
| id | UUID | 🤖 AUTO | P1 | PK |
| user_id | UUID | 🤖 AUTO | P1 | Owner |
| stripe_customer_id | string | 📩 EXTERNE | P1 | Stripe |
| stripe_subscription_id | string | 📩 EXTERNE | P1 | Stripe |
| plan | enum | 👤 USER | P1 | proprio_solo / agence / autonomie / etc. |
| price_chf | decimal | 🤖 AUTO | P1 | Reflet plan |
| billing_period | enum | 👤 USER | P1 | monthly / yearly |
| trial_end | timestamp | 🤖 AUTO | P2 | Si trial |
| current_period_start | timestamp | 📩 EXTERNE | P1 | Stripe |
| current_period_end | timestamp | 📩 EXTERNE | P1 | Stripe |
| status | enum | 📩 EXTERNE | P1 | active / past_due / canceled / trialing |
| cancel_at_period_end | bool | 👤 USER | P1 | Demandé annulation |
| is_grandfathered | bool | 🤖 AUTO | P1 | Migration tarifaire |
| diffusion_pack | enum | 👤 USER | P2 | discovery / standard / pro / premium |

---

## T5 — Rating (réputation)

Source : 🏠 Rating. Phase : P2.

| Champ | Type | Acquisition | Description |
|---|---|---|---|
| id | UUID | 🤖 AUTO | PK |
| target_type | string | 🤖 AUTO | artisan / opener / hunter |
| target_id | UUID | 🤖 AUTO | FK polymorphe |
| author_id | UUID | 🤖 AUTO | Qui note |
| score | int | 👤 USER | 1-5 |
| comment | string | 👤 USER | Texte avis |
| context_type | string | 🤖 AUTO | WorkOrder / SaleMandate / etc. |
| context_id | UUID | 🤖 AUTO | FK polymorphe |
| created_at | timestamp | 🤖 AUTO | Auto |
| visible | bool | 🤖 AUTO | Modération auto/manuelle |

---

## T6 — Partner B2B

Source : 🏠 Partner. Phase : P2.

| Champ | Type | Acquisition | Description |
|---|---|---|---|
| id | UUID | 🤖 AUTO | PK |
| name | string | 👤 USER | Nom partenaire |
| type | enum | 👤 USER | caution / assurance / déménagement / internet / énergie / SOS / fiduciaire / banque |
| logo_url | string | 👤 USER | Upload |
| description | string | 👤 USER | Bio |
| api_endpoint | string | 👤 USER | Endpoint API si intégré |
| oauth_client_id | string | 👤 USER | OAuth |
| commission_pct | decimal | 👤 USER | Si % |
| commission_fixed | decimal | 👤 USER | Si fixe |
| status | enum | 👤 USER | discussion / signed / active / suspended |
| countries | array | 👤 USER | CH par défaut |

---

## T7 — Conversation et ConversationMessage

Source : 🏠 Conversation + ConversationMessage. Phase : P1.

**Conversation** :

| Champ | Type | Acquisition | Description |
|---|---|---|---|
| id | UUID | 🤖 AUTO | PK |
| participants_ids | array | 🤖 AUTO | UUID[] |
| context_type | string | 🤖 AUTO | Bien / WorkOrder / Lead / etc. |
| context_id | UUID | 🤖 AUTO | FK polymorphe |
| channel | enum | 🤖 AUTO | email / sms / whatsapp / in-app |
| last_message_at | timestamp | 🤖 AUTO | Auto |

**ConversationMessage** :

| Champ | Type | Acquisition | Description |
|---|---|---|---|
| id | UUID | 🤖 AUTO | PK |
| conversation_id | UUID | 🤖 AUTO | FK |
| author_id | UUID | 🤖 AUTO | Sender |
| body | text | 👤 USER | Contenu |
| attachments | array | 👤 USER | Document IDs |
| read_by | JSONB | 🤖 AUTO | {user_id: timestamp} |
| translated_body | JSONB | 🧠 IA | {locale: text} P2 |
| ai_suggested | bool | 🤖 AUTO | True si auto-réponse IA |
| ai_validated | bool | 👤 USER | Validation humaine si auto |

---

## T8 — Document (polymorphe)

Source : 🏠 Document. Phase : P1.

| Champ | Type | Acquisition | Phase | Description |
|---|---|---|---|---|
| id | UUID | 🤖 AUTO | P1 | PK |
| filename | string | 👤 USER ou 🤖 AUTO | P1 | Auto si généré |
| original_filename | string | 🤖 AUTO | P1 | Si upload |
| category | enum | 🧠 IA | P1 | bail/edl/quittance/identite/etc. |
| context_type | string | 🧠 IA | P1 | Bien / Contract / WorkOrder / etc. |
| context_id | UUID | 🧠 IA | P1 | FK polymorphe |
| uploaded_by | UUID | 🤖 AUTO | P1 | User |
| created_at | timestamp | 🤖 AUTO | P1 | Auto |
| expires_at | date | 🧠 IA | P1 | OCR détecte si applicable |
| signed_at | timestamp | 📩 EXTERNE | P2 | Skribble webhook |
| signature_provider | string | 📩 EXTERNE | P2 | skribble / etc. |
| confidentiality | enum | 🤖 AUTO | P1 | interne / proprio / locataire / public |
| storage_url | string | 🤖 AUTO | P1 | Supabase Storage |
| size | int | 🤖 AUTO | P1 | Bytes |
| mime_type | string | 🤖 AUTO | P1 | Auto |
| version | int | 🤖 AUTO | P1 | Auto-incrément |
| previous_version_id | UUID | 🤖 AUTO | P1 | Chaîne versions |
| ocr_content | text | 🧠 IA | P2 | Recherche full-text |
| tags | array | 🧠 IA | P1 | IA suggère |
| disclaimer_included | bool | 🤖 AUTO | P1 | Si généré IA |
| ai_generated | bool | 🤖 AUTO | P1 | True si génération auto |

---

## T9 — Indexation IPC (rappel système)

→ Détaillé dans Section Finances proprio (IndexationEvent). Domaine transverse réutilisé par locataire (lecture) et agence (proxy proprio).

---

## T10 — UserBienAccess + UserModuleAccess (RBAC fin)

**UserBienAccess** :

| Champ | Type | Acquisition | Description |
|---|---|---|---|
| id | UUID | 🤖 AUTO | PK |
| user_id | UUID | 🤖 AUTO | FK |
| bien_id | UUID | 🤖 AUTO | FK |
| permission_level | enum | 👤 USER | owner / admin / agent / read_only / locataire |
| granted_by | UUID | 🤖 AUTO | Qui a accordé |
| granted_at | timestamp | 🤖 AUTO | Auto |
| expires_at | timestamp | 👤 USER | Optionnel |

**UserModuleAccess** :

| Champ | Type | Acquisition | Description |
|---|---|---|---|
| id | UUID | 🤖 AUTO | PK |
| user_id | UUID | 🤖 AUTO | FK |
| module | enum | 👤 USER | bien / contrat / finance / compta / interventions / annonces / vente / etc. |
| permission | enum | 👤 USER | none / read / write / admin |

**Stratégie** : Permissions par rôle (default) + override custom (admin agence).

---

## T11 — IABriefing

Source : 🏠 IABriefing. Phase : P1 backlog → P2.

| Champ | Type | Acquisition | Description |
|---|---|---|---|
| id | UUID | 🤖 AUTO | PK |
| user_id | UUID | 🤖 AUTO | FK |
| date | date | 🤖 AUTO | Date briefing |
| summary | text | 🧠 IA | Texte généré IA |
| highlights | JSONB | 🧠 IA | Liste points clés structurés |
| suggestions | JSONB | 🧠 IA | Liste actions proposées |
| tokens_used | int | 🤖 AUTO | Quota tracking |
| read_at | timestamp | 👤 USER | Marqué lu |

**Stratégie** : Génération nocturne via Celery beat. 1 briefing / user / jour max.

---

## T12 — Waitlist

Source : 🏠 Waitlist. Phase : P1.

| Champ | Type | Acquisition | Description |
|---|---|---|---|
| id | UUID | 🤖 AUTO | PK |
| email | string | 👤 USER | Email |
| role | enum | 👤 USER | proprio_solo / agence / artisan / opener / hunter / etc. |
| created_at | timestamp | 🤖 AUTO | Auto |
| source | string | 🤖 AUTO | UTM tracking |
| activated_at | timestamp | 👤 USER | Quand admin active |
| metadata | JSONB | 👤 USER | Info contextuelle |

---

# RÈGLES D'ARCHITECTURE TRANSVERSES

## R1 — Une donnée = une source de vérité

| Donnée | Source unique | NE PAS dupliquer dans |
|---|---|---|
| Loyer mensuel actif | `Contract.monthly_rent` | Bien.loyer (juste cible/référence) |
| Charges mensuelles actives | `Contract.charges` | Bien.charges (cible) |
| Caution montant | `Caution.amount` (1:1 avec Contract) | Contract.deposit (default initial) |
| Statut bien | `Bien.statut` (déduit Locataire actif + WorkOrder) | Aucun ailleurs |
| EGID/EWID/parcelle | `Bien` | Aucun ailleurs |
| Surface habitable | `Bien.surface` | Aucun ailleurs |
| Identité user | `User` + `Profile{Role}` | Aucun ailleurs |

## R2 — Polymorphisme stricte

Un domaine ne référence pas plusieurs FKs concurrents. Il utilise `(context_type, context_id)`.

Exemples :
- `Document.context_type + .context_id` (Bien, Contract, WorkOrder, Locataire, Mandate, etc.)
- `Conversation.context_type + .context_id`
- `Notification.context_type + .context_id`
- `Rating.target_type + .target_id`

## R3 — Audit log universel

Tout endpoint qui modifie un domaine sensible (Bien, Contract, Caution, Transaction, OwnerStatement, Mandate, etc.) **doit** écrire dans AuditLog. Trigger backend automatique.

## R4 — i18n stricte dès Phase 1

- Aucune string hardcodée FR dans le code (front + back).
- Tout texte passe par `next-intl` (front) ou `babel.cfg` (back).
- Templates documents et emails templatisés par locale.
- DB `User.locale` détermine langue de toutes les communications.

## R5 — Acquisition automatisée maximale

Avant chaque champ que l'utilisateur saisirait : se demander si on peut le déduire/calculer/scraper/OCR. **Le proprio fait le minimum, l'IA fait le reste.**

| Si la donnée vient de... | Alors la stratégie privilégiée est... |
|---|---|
| Document uploadé | OCR + extraction structurée (Vision IA Claude) |
| Adresse postale | Géocoding Mapbox/Swisstopo + RegBL/EGID |
| Photo bien | Vision IA classification (chambre/sdb/etc.) + détection équipements |
| Nom entreprise | Scraping registre du commerce CH (IDE, adresse, forme) |
| Banque (paiement) | CAMT.054 / CAMT.053 import + matching auto |
| Marché immobilier | DB propriétaire Althy + scraping public anonymisé |

## R6 — Règle « 1 clic interaction directe »

Depuis n'importe quelle entité parente (fiche bien, fiche locataire, fiche mandat), on accède et modifie ses entités liées **sans changer de page**. Les sections globales (`/app/interventions`, `/app/locataires`) sont des **vues consolidées multi-biens**, jamais le seul point d'accès.

## R7 — Confidentialité des données sensibles

| Donnée | Niveau confidentialité | Stratégie |
|---|---|---|
| IBAN | High | Chiffré at-rest (pgcrypto), masqué (****1234) en UI |
| Code digicode immeuble | High | Chiffré at-rest, masqué par défaut, bouton « Afficher » + audit log |
| Numéro AVS | High | Chiffré at-rest |
| Pièce identité PDF | High | Stockage Supabase encrypted bucket |
| Salaire locataire | Medium | Chiffré at-rest, visible uniquement proprio + agence du bien |
| Score solvabilité | Medium | Calculé à la volée, ne pas exposer score brut au candidat (tranches uniquement) |
| Prix minimum vente confidentiel | High | Chiffré at-rest, visible proprio + agence mandataire uniquement |

## R8 — i18n et locales

| Locale | Activation | Phase |
|---|---|---|
| fr-CH | ✅ Toujours active | P1 |
| de-CH | À activer via `LOCALES_ENABLED` env var | P2 |
| it-CH | À activer | P5+ |
| en | À activer | P5+ |

## R9 — Phase activation rôles

| Rôle | Phase active | Déclencheur |
|---|---|---|
| proprio_solo | P1 | Toujours |
| locataire | P1 | Toujours (gratuit) |
| super_admin | P1 | Toujours (interne) |
| agence | P2 | `ALLOWED_SIGNUP_ROLES += 'agence'` |
| portail_proprio (invité agence) | P2 | Idem |
| artisan | P2 partial / P3 full | Marketplace M1 actuelle (50 places fondateurs GE+VD) → marketplace généralisée |
| opener | P3 | Marketplace ouverte |
| hunter | P3 | Mode activable cross-produit |
| fiduciaire | P2 light / P3 full | Accès lecture compta clients |

## R10 — Flags et gates durs

Tout module qui n'est pas Phase 1 doit avoir un feature flag (default OFF). Activation = décision documentée + gate dur Phase précédente franchi.

---

# ANNEXES

## A1 — Liste APIs publiques CH mobilisées

| API | Usage | Phase | Coût | Documentation |
|---|---|---|---|---|
| GeoAdmin Swisstopo | Géocoding, EGID, EWID, parcelles, couches cadastre | P1 | Gratuit | api3.geo.admin.ch |
| RegBL | Métadonnées bâtiment (surface, année, type) | P1 | Gratuit | api3.geo.admin.ch |
| Mapbox | Géocoding adresses + tuiles cartes | P1 | Tier gratuit puis payant | docs.mapbox.com |
| BNS | Taux hypothécaire de référence | P1 | Gratuit | data.snb.ch |
| OFS | IPC, statistiques démographiques | P1 | Gratuit | bfs.admin.ch |
| Registre du commerce CH | Recherche IDE, raison sociale, adresse | P2 | Gratuit (limité) | zefix.ch |
| AFC | Barèmes fiscaux, taux TVA | P2 | Gratuit | estv.admin.ch |
| Cadastre cantonal VS (VSGIS) | Couches cadastre Valais | P3 | Gratuit | vsgis.ch |
| Cadastre cantonal VD | Couches cadastre Vaud | P3 | Gratuit | (à intégrer) |
| Cadastre cantonal GE | Couches cadastre Genève | P3 | Gratuit | sitg.ge.ch |

## A2 — DBs propriétaires Althy à constituer

Ces bases enrichissent la valeur Althy au fil du temps. Killian alimente progressivement.

| DB | Source | Phase de constitution | Différenciateur |
|---|---|---|---|
| Prix m² loyer par zone | Anonymisation Listings + Contract réels Althy | P2 | Précision granulaire vs estimations agrégées concurrents |
| Prix m² vente par zone | Registre foncier CH + scraping anonymisé portails | P3 | Comparables vente précis |
| Démographique locataire | Anonymisation TenantFile Althy | P3 | Profil locataire dominant par zone |
| Risques (zones inondables, glissements, bruit avion) | Couches publiques OFEV + cantonales | P3 | Affichage automatique sur fiche bien |
| Barème fiscal cantonal travaux déductibles | AFC + cantonales + jurisprudence | P2 | IA classifie WorkOrder → déductible/amélioration |
| Subventions cantonales travaux énergie | Sites cantonaux + OFEN | P3 | Suggestions automatiques |
| Comparables vente IA enrichis | DB Althy + registre foncier + portails | P3 | Estimation IA premium |
| Tendances marché 5 ans | Historique Althy + données OFS | P2 | Évolution prix m² fiable |

## A3 — Liste 25 nouveaux domaines à créer

**Phase 1** (modèles à créer pour livrer Phase 1 complète) :
1. BienAnnexe ➕
2. BienCompteur ➕
3. BienContact ➕
4. BankAccount ➕ (refacto depuis User.iban)
5. OwnerStatement ➕
6. Reminder ➕
7. Caution ➕ (refacto depuis Contract.deposit + extensions)
8. CautionRetenue ➕
9. ChargeLine ➕
10. ChargeStatement ➕
11. IndexationEvent ➕
12. IABriefing ➕

**Phase 2** :
13. TaxStatement ➕
14. Mandate ➕
15. MandateFee ➕
16. VAT (config) ➕
17. VATReport ➕
18. Invoice ➕ (consolidation)
19. CreditNote ➕
20. BankConnection ➕
21. BankStatement ➕
22. BankTransaction ➕
23. BankMatching ➕
24. PaymentBatch ➕
25. Payment ➕
26. Lead ➕
27. LeadActivity ➕
28. ListingChannel ➕
29. AccountingExport ➕
30. ApprovalWorkflow ➕
31. UserBienAccess ➕
32. UserModuleAccess ➕

**Phase 3-4** :
33. SaleMandate ➕
34. SaleOffer ➕
35. HunterReferral ➕
36. HunterContact ➕
37. ProfileOpener ➕ (consolidation)
38. ProfileArtisan ➕ (refacto)
39. ProfileHunter ➕
40. ProfileAgence ➕

## A4 — Glossaire

| Terme | Définition |
|---|---|
| **EGID** | Identifiant fédéral du bâtiment (8 chiffres) |
| **EWID** | Identifiant fédéral du logement (3 chiffres) |
| **RegBL** | Registre fédéral des bâtiments et logements |
| **CAMT.054** | Format ISO 20022 d'avis de crédit bancaire |
| **CAMT.053** | Format ISO 20022 de relevé de compte bancaire |
| **QR-IBAN** | IBAN avec QR-référence pour QR-facture SPC 2.0 |
| **SPC 2.0** | Swiss Payment Currency 2.0 (norme suisse paiement QR) |
| **OBLF** | Ordonnance sur le bail à loyer |
| **CO** | Code des Obligations suisse |
| **AFC** | Administration Fédérale des Contributions |
| **OFS** | Office Fédéral de la Statistique |
| **OFEN** | Office Fédéral de l'Énergie |
| **BNS** | Banque Nationale Suisse |
| **PPE** | Propriété Par Étages |
| **CECB** | Certificat Energétique Cantonal des Bâtiments |
| **IPC** | Indice des Prix à la Consommation |
| **nLPD** | nouvelle Loi sur la Protection des Données (CH, en vigueur depuis sept. 2023) |
| **RFQ** | Request For Quote (demande de devis) |
| **MRR** | Monthly Recurring Revenue |
| **ADR** | Average Daily Rate (saisonnier nuitée — P5+ uniquement) |
| **RevPAR** | Revenue Per Available Room (saisonnier nuitée) |
| **EDL** | État Des Lieux |
| **RBAC** | Role-Based Access Control |

---

# CONCLUSION

Ce catalogue est la **source de vérité granulaire** d'Althy. Il liste exhaustivement :
- 8 rôles utilisateurs + 12 domaines transverses
- ~250 données distinctes pour proprio_solo, ~150 pour agence, ~80 pour locataire, plus rôles secondaires
- Acquisition (AUTO/DÉDUIT/IA/EXTERNE/USER/ONBOARDING) pour chaque champ
- Phase d'activation (P1/P2/P3/P4/P5+)
- Section UI + sous-section UI où la donnée vit
- Source de vérité unique pour chaque domaine

**Doctrine fondatrice rappelée** :

> Le bien est l'unité atomique. On classe les données, on ne les croise pas. Zéro doublon. Une donnée = une source de vérité unique. Le proprio fait le minimum, l'IA fait le reste. Du carré KPI à la modale détail en 1 clic, jamais 2.

**Ce catalogue se met à jour uniquement sur événement réel** : nouveau module validé, refacto data-model en cours, retour utilisateur contradictoire. Pas de re-discussion « pour le fun » (cf règle 6 de la roadmap).
