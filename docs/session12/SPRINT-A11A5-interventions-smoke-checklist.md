# Smoke checklist — Sprint A11.A.5 (InterventionsSidePanel)

> Session 12 · Date d'émission : 2026-05-03
> Cible : valider en bout-en-bout le side panel interventions livré par PR
> `feat/bien-interventions` (commits `9930836` backend + `4b93db4` hooks +
> `a8193eb` panel + `dc3cc28` branchement page).

---

## Préambule

### Pré-requis avant smoke

- [ ] PR `feat/bien-interventions` mergée sur `main`.
- [ ] Railway prod redéployé : SHA affiché ≥ commit final, **migration
      0034 appliquée** (`alembic upgrade head` côté Railway → vérifier
      table `intervention_photos` créée et colonnes `note_cloture` /
      `closed_at` présentes sur `interventions`).
- [ ] Vercel prod redéployé : SHA ≥ celui du frontend final.
- [ ] URL test : `https://althy.ch/app/biens/cabf1ff0-f3f3-4784-aafc-e062fc3f64d4`
      (bien Crans-Montana, ou tout autre bien dont l'utilisateur test est
      proprio).
- [ ] Credentials test : `k.thebaud@sunimmo-riviera.ch`.
- [ ] Fichiers de test : 3 photos JPG/PNG petites (< 1 MB), 1 photo lourde
      (> 5 MB ≤ 10 MB), 1 fichier > 10 MB, 1 PDF.
- [ ] DevTools Console + Network ouverts pendant tout le smoke.

---

## Axe A — Régression existant (interventions A11.A.0 + autres modales)

**Ce qu'on teste** : la card SectionInterventions continue d'afficher la
preview comme avant, et les autres modales (DeleteBien / Caracteristiques
/ Photos) restent indépendantes.

**Sous-checks** :
- [ ] Card Interventions affiche les 3 dernières interventions du bien
      (nom + badge statut), comme dans la version A11.A.0.
- [ ] Le compteur « N active(s) » or apparaît dans le header de la card
      uniquement s'il y a au moins 1 intervention non `resolu`.
- [ ] Lien `bienLinks.interventions(bienId)` (TabInterventions sous-page)
      reste fonctionnel s'il existe encore (vérifier qu'aucun lien direct
      n'a été cassé).
- [ ] Modales Caractéristiques (lecture + édition), Photos, Suppression
      bien restent fonctionnelles ; aucune ne s'ouvre simultanément avec
      le side panel Interventions.

**Zones de fragilité à scruter en cas de bug** :
- `frontend/src/app/app/(dashboard)/biens/[id]/page.tsx:1735+` —
  `BienOverview` mount désormais 4 modales (Delete, Caracteristiques,
  PhotosManager, InterventionsSidePanel). Vérifier qu'aucun conflit
  z-index n'apparaît si deux étaient ouvertes (ne devrait pas — seuls
  les clics utilisateurs ouvrent une modale à la fois).
- `_shared.tsx:455` + `:14-15` — TabInterventions consomme toujours
  `useInterventions` + `useCreateIntervention` legacy depuis `useBiens.ts`.
  Aucune raison de casser, mais un refactor accidentel sur ces hooks
  peut impacter la sous-page.

---

## Axe B — Ouverture side panel (3 chemins)

**Ce qu'on teste** : les 3 entry points de la card SectionInterventions
ouvrent correctement le panel avec le bon mode initial.

**Sous-checks** :
- [ ] Bouton « + » dans le header de la card → side panel s'ouvre slide-in
      depuis la droite (animation 240 ms), mode **création** (form vide,
      titre « Nouvelle intervention »).
- [ ] Lien « Voir toutes (N) → » en footer de la card → panel s'ouvre,
      mode **liste** avec les filtres en haut.
- [ ] Clic sur une preview d'intervention dans la card → panel s'ouvre,
      mode **détail** sur l'intervention cliquée (form pré-rempli avec
      ses valeurs).
- [ ] Lien « Nouvelle intervention » sous l'empty state (quand 0
      intervention) → idem bouton « + », mode création.
- [ ] À l'ouverture, le `<body>` a `overflow: hidden` (vérifier dans
      DevTools — pas de scroll possible derrière le panel).
- [ ] Le bien reste visible derrière le backdrop semi-transparent à
      gauche (50% libre, 50% panel à droite).

**Zones de fragilité à scruter en cas de bug** :
- `InterventionsSidePanel.tsx:122-141` — `useEffect` sync mode quand
  `selectedId` ou `initialCreate` change. Si le parent change ces props
  pendant que le panel est déjà ouvert (clic sur autre intervention
  depuis l'extérieur, improbable mais possible si l'utilisateur ré-ouvre
  via la card), le mode bascule. Dirty state reset à chaque ouverture.
- `page.tsx` — helpers `openInterventionsList` / `openInterventionCreate`
  / `openInterventionDetail` doivent set 3 états dans le bon ordre. Si
  un re-render intercale entre les `setState`, le panel pourrait
  s'ouvrir avec l'ancien `selectedId`. Risque très faible, React batch
  les updates.

---

## Axe C — Mode liste + filtres

**Ce qu'on teste** : la liste affiche correctement les interventions du
bien, les 2 filtres (statut + urgence) fonctionnent, l'empty state se
déclenche au bon moment.

**Sous-checks** :
- [ ] Sur un bien avec ≥ 1 intervention, mode liste affiche toutes les
      interventions sous forme de cards (titre + badges urgence/statut +
      date relative + coût final si `resolu`).
- [ ] Sélecteur statut « Toutes » → toutes affichées.
- [ ] Sélecteur statut « En cours » → seules celles `statut !== resolu`.
- [ ] Sélecteur statut « Clôturées » → seules celles `statut === resolu`
      (et leur coût final est visible).
- [ ] Sélecteur urgence (Faible / Modérée / Urgente / Très urgente) →
      filtre côté serveur (Network tab : `urgence=urgente` en query
      param).
- [ ] Sous-titre du header reflète le nombre filtré + mention « (filtrées) »
      si filtre actif.
- [ ] Sur un bien sans intervention, empty state s'affiche (icône
      Wrench dans cercle prussian + texte + bouton CTA Signaler).
- [ ] Clic sur une card de la liste → mode détail.
- [ ] Bouton « Signaler » dans le header du panel → mode création.

**Zones de fragilité à scruter en cas de bug** :
- `InterventionsSidePanel.tsx:248-263` — filtre statut (`open` /
  `closed`) appliqué côté frontend après le fetch. Le filtre urgence
  passe par le query param backend. Cohérence : si le backend renvoie
  une intervention avec un statut inconnu (pas dans l'enum), elle reste
  dans « Toutes » mais peut disparaître des sous-filtres.
- `useInterventions.ts:90-110` — `useInterventionsByBien(bienId, filters)`
  inclut `filters` dans la queryKey. Tout changement de filtre crée une
  nouvelle query (pas de partage cache entre filtres distincts) → re-fetch
  systématique. Acceptable Phase 1.
- Backend `interventions_althy.py:39-57` — `list_interventions` route.
  Filtre RBAC anti-énumération (super_admin / proprio / agency / artisan
  assigné / locataire actif). Le test user doit être proprio du bien
  pour voir toutes les interventions.

---

## Axe D — Création d'intervention

**Ce qu'on teste** : le flow de création d'une intervention fonctionne
avec validation côté client + persistance backend + visibilité immédiate
dans la liste après création.

**Sous-checks** :
- [ ] Mode création (via bouton + ou « Signaler ») → form vide, titre
      « Nouvelle intervention », statut désactivé/non visible.
- [ ] Saisir titre « Test fuite » + description + urgence Modérée +
      catégorie Plomberie. Bouton « Créer » devient actif (form dirty).
- [ ] Saisir un titre < 3 caractères → submit déclenche un message
      d'alerte rouge (« Le titre doit comporter au moins 3 caractères »).
- [ ] Soumettre form valide → `POST /api/v1/interventions-althy/` avec
      payload incluant `bien_id`. Réponse 201 `InterventionRead`.
- [ ] Après création : panel reste ouvert et bascule en mode détail sur
      la nouvelle intervention. Photos peuvent maintenant être uploadées.
- [ ] Fermer le panel → l'intervention apparaît dans la card de la fiche
      bien (preview ou liste).
- [ ] Email de notification reçu côté proprio (background task Resend)
      — si `RESEND_API_KEY` configurée en prod.

**Zones de fragilité à scruter en cas de bug** :
- `InterventionsSidePanel.tsx:404-430` — `handleSubmit` en mode création
  appelle `create.mutateAsync` puis `onCreated(created.id)`. Si
  `onCreated` change le mode de detail à create, le useEffect resync
  pourrait re-réinitialiser le form. Pattern testé via `creating=false`
  set par `onCreated`.
- `InterventionService.create_intervention` (`intervention_service.py:106-124`)
  — vérifie `_can_create_on_bien` (super_admin / proprio / agency /
  created_by / locataire actif). Locataire connecté peut créer sur son
  bien (ce qui peut surprendre si le test user est locataire d'un autre
  bien).
- `interventions_althy.py:60-79` — `create_intervention` lance
  `_notify_owner_new_intervention` en background task. Si Resend
  retourne ≠ 200/201, l'erreur est loggée silencieusement (pas de
  rollback de la création). Comportement intentionnel.

---

## Axe E — Édition + transitions de statut + clôture

**Ce qu'on teste** : modifier une intervention existante, transitionner
vers `resolu`, voir apparaître les champs de clôture, sauvegarder le
coût final + note.

**Sous-checks** :
- [ ] Ouvrir une intervention existante en mode détail → form pré-rempli
      avec toutes les valeurs (titre, description, urgence, catégorie,
      statut).
- [ ] Modifier seulement la description → bouton « Enregistrer » actif
      (dirty détecté), bouton « Annuler » actif aussi.
- [ ] Cliquer « Enregistrer » → `PATCH /api/v1/interventions-althy/{id}`
      avec **uniquement** `description` dans le body (diff calculé côté
      client). Réponse 200 avec intervention updated.
- [ ] Optimistic update : modification visible immédiatement dans le
      form. Si erreur backend, rollback.
- [ ] Changer statut à « Terminée » (`resolu`) → champs « Coût final
      (CHF) » et « Note de clôture » apparaissent dans le form.
- [ ] Saisir coût 250 + note. Enregistrer → PATCH inclut `statut: resolu`,
      `cout: 250`, `note_cloture: "..."`. Backend stamp `closed_at` =
      now.
- [ ] Cliquer le bouton « Marquer terminée » dans le footer (CTA
      secondaire vert) → set automatique du statut à `resolu`. Reste à
      enregistrer pour persister (non auto-save).
- [ ] Repasser de `resolu` à `en_cours` → backend reset `closed_at` à
      null (vérifier dans `GET /{id}` après save). Champs clôture restent
      saisissables même hors statut resolu (libre côté UI), mais ne
      seront sémantiquement pertinents qu'à la prochaine clôture.
- [ ] Si tentative de submit sans modif (form vierge) → bouton
      « Enregistrer » désactivé.

**Zones de fragilité à scruter en cas de bug** :
- `InterventionsSidePanel.tsx:380-400` — `isDirty` calculé via
  `JSON.stringify(form) !== JSON.stringify(initial)` en mode édition.
  Sensible à l'ordre des clés (Object.keys d'un literal devrait être
  stable en JS modernes mais fragile en théorie).
- `InterventionsSidePanel.tsx:404-446` — `handleSubmit` construit le
  payload PATCH champ par champ via diff `form vs initial`. Si un champ
  passe de "valeur" à "" (vidé), il est envoyé comme `null`. Vérifier
  côté backend que `description: null` ne casse rien (le schema accepte
  `Optional`).
- `intervention_service.py:140-163` — `update_intervention` : auto-stamp
  `closed_at` uniquement si `new_statut != inter.statut`. Si l'user
  PATCH `statut: resolu` mais que l'intervention était déjà `resolu`,
  `closed_at` est préservé. OK.

---

## Axe F — Photos jointes

**Ce qu'on teste** : upload, display, suppression des photos d'une
intervention. Réutilise le bucket Supabase Storage existant
(`property-images`) avec préfixe path.

**Sous-checks** :
- [ ] Mode détail (intervention existante) → section Photos avec grille
      3 colonnes. Si 0 photo, seul le tile « Ajouter » est visible.
- [ ] Cliquer le tile « Ajouter » → file picker OS s'ouvre. Choisir 1
      photo JPG.
- [ ] Spinner Loader2 sur le tile pendant l'upload. `POST
      /api/v1/interventions-althy/{id}/photos` avec body multipart
      `file`.
- [ ] Réponse 201 + `InterventionPhotoRead` (id, intervention_id, url,
      order). URL publique pointe vers
      `/storage/v1/object/public/property-images/{bien_id}/interventions/{intervention_id}/{photo_id}.jpg`.
- [ ] Refresh cache `useIntervention` → la photo apparaît dans la grille
      avec preview.
- [ ] Sélectionner plusieurs photos d'un coup → uploads parallèles, tous
      reflétés.
- [ ] Upload photo > 10 MB → bloqué côté client avec message d'erreur
      « Fichier trop volumineux (max 10 MB) », pas d'appel POST.
- [ ] Upload PDF → bloqué côté client avec message « Format non supporté ».
- [ ] Hover sur une photo → bouton poubelle visible en haut à droite.
- [ ] Cliquer poubelle → `window.confirm("Supprimer cette photo ?")`.
- [ ] Confirmer → `DELETE /api/v1/interventions-althy/{id}/photos/{photo_id}` →
      204. Optimistic remove (photo disparaît avant la fin du round-trip).
- [ ] Vérifier dans Supabase Storage dashboard que le fichier a bien été
      purgé du bucket.
- [ ] Si fermeture du panel pendant un upload en vol → `window.confirm`
      « Un upload est en cours… Continuer ? ».

**Zones de fragilité à scruter en cas de bug** :
- `intervention_service.py:184-225` — `add_photo` réutilise
  `_upload_to_storage` de `bien_service` via import local. Si
  `bien_service` change sa signature, casse silencieuse runtime.
- `intervention_service.py:227-258` — `delete_photo` calcule path à
  purger via `photo.url.split(marker)[-1]` où `marker = f"/{bucket}/"`.
  Si le bucket change entre upload et delete (ex : bascule env var),
  le marker ne match plus → `path = None` → fichier orphelin Storage.
- `useInterventions.ts:202-220` — `useUploadInterventionPhoto` invalide
  `interventionKeys.detail(id)` au succès. Si plusieurs uploads parallèles,
  N invalidations parallèles → re-fetches multiples (cosmétique, pas un bug).
- `InterventionsSidePanel.tsx:639-660` — `inFlightRef` compteur ref pour
  notifier le parent (`onUploadFlightChange`) quand au moins 1 upload
  est en vol. Si une mutation throw avant le `finally`, le compteur peut
  rester décalé. `finally` sauve la mise. Acceptable.

---

## Axe G — Fermeture panel

**Ce qu'on teste** : les 3 chemins de fermeture (X / backdrop / Esc)
passent tous par `attemptClose` avec confirmations natives si dirty ou
upload en vol.

**Sous-checks** :
- [ ] Panel ouvert sans modification → cliquer X → ferme immédiatement.
- [ ] Panel ouvert sans modification → cliquer backdrop (zone sombre à
      gauche) → ferme.
- [ ] Panel ouvert sans modification → ESC → ferme.
- [ ] Panel ouvert avec form dirty (mode création avec titre saisi) →
      X / backdrop / Esc → `window.confirm("Annuler les modifications
      en cours ?")`.
- [ ] Refuser le confirm → panel reste ouvert, form intact.
- [ ] Accepter le confirm → panel ferme, modifications perdues.
- [ ] Panel ouvert avec un upload photo en vol → X → confirm
      « Un upload est en cours… ». Refuser maintient le panel.
- [ ] Mode détail avec modif en cours + upload en vol → 2 confirms
      séquentiels (dirty puis upload).
- [ ] À la fermeture, `<body>` retrouve son overflow initial (scroll
      page reprend).
- [ ] Bouton « ← Liste » dans le header en mode détail → revient au mode
      liste sans fermer le panel. Si dirty, confirm.

**Zones de fragilité à scruter en cas de bug** :
- `InterventionsSidePanel.tsx:144-160` — `attemptClose` callback
  mémoïsé sur `[dirty, hasUploadInFlight, onClose]`. Si l'user déclenche
  ESC pendant que le `useEffect` qui set `setDirty` n'a pas encore
  flushé, l'attemptClose pourrait ne pas voir le dirty récent → fermeture
  sans confirm. Cas très edge (ms-timing).
- `InterventionsSidePanel.tsx:163-176` — listener Esc + scroll lock
  body. Si une autre modale lock body en parallèle, restauration
  potentiellement incorrecte (probabilité très faible).
- `page.tsx` — `closeInterventionsPanel` reset `selectedInterventionId`
  et `interventionsCreating`. Le panel ne unmount pas (return null via
  `AnimatePresence`), juste cache.

---

## Axe H — Responsive & Console JS

**Ce qu'on teste** : le side panel reste utilisable sur tablette et
mobile, et la console reste clean sans warnings React.

**Sous-checks responsive** :
- [ ] Desktop ≥ 1280 : panel = 50% de la largeur (max-width 720 px).
- [ ] Tablette 768-1023 : panel = 50%, min-width 480 px → couvre la
      majorité de l'écran.
- [ ] Mobile 375 : panel = 50% mais min-width 480 px > viewport → panel
      prend toute la largeur effective. Acceptable Phase 1, à
      ajuster en sprint mobile dédié.
- [ ] Scroll vertical du body fonctionne dans le panel (long form +
      photos).
- [ ] Header sticky (titre + bouton X), footer sticky (Annuler / save).

**Sous-checks console** :
- [ ] DevTools Console ouverte avant ouverture du panel.
- [ ] Ouvrir / fermer 3 fois → 0 warning React (Each child in a list…,
      Cannot update component while rendering, etc.).
- [ ] Naviguer entre liste / détail / création → 0 warning React Query.
- [ ] Network tab : aucun XHR en 4xx/5xx hors comportement attendu.
- [ ] `<img>` warnings Next.js attendus (pattern aligné avec
      PhotosManagerModal — 3 occurrences `eslint-disable
      @next/next/no-img-element`).

**Zones de fragilité à scruter en cas de bug** :
- `InterventionsSidePanel.tsx:903-906` — `min-width: 480 px` sur le
  shell. Sur viewport < 480 (rare mais mobile petit), le panel sort
  de l'écran à gauche. Workaround : ajouter `@media (max-width: 480)
  { width: 100vw; min-width: 0 }`. Reportée backlog mobile.
- framer-motion `AnimatePresence` + `motion.div` avec `initial/animate/exit`.
  Si l'AnimatePresence parent unmount avant la fin de l'exit, framer
  loggue un warning. Pas observé pour l'instant.
- `useEffect` sur `[open, attemptClose]` : `attemptClose` change
  référence à chaque render quand `dirty` ou `hasUploadInFlight`
  changent → le listener Esc est re-attaché à chaque render. Coût
  négligeable, no leak puisque cleanup correct.

---

## Anomalies détectées

À remplir au fur et à mesure du smoke. Si une case est cochée comme
défaillante, créer une ligne ici.

| Axe | Description bug | Fichier suspecté | Sévérité |
|-----|-----------------|------------------|----------|
|     |                 |                  |          |

Sévérités : **P0** (bloque le smoke), **P1** (smoke OK mais à corriger),
**P2** (cosmétique / edge case).

---

## Conclusion

- [ ] Tous les axes A-H passent → A11.A.5 considérée smoke-OK.
- [ ] Si fix(es) → branche dédiée + nouveau cycle smoke ciblé.

---

## Top 3 zones de fragilité à scruter en priorité

1. **Bucket effectif Supabase pour photos intervention** —
   `backend/app/services/intervention_service.py:202-225` (add_photo) +
   `:241-258` (delete_photo). Réutilise `settings.SUPABASE_BUCKET_BIEN_IMAGES`
   (legacy `property-images` actuel). Toute URL en `/bien-images/` indique
   un Railway pas à jour ou un revert silencieux du fix bucket. C'est le
   premier endroit à vérifier sur tout bug d'upload / suppression photo.

2. **Auto-stamp closed_at + reset au rebascule** —
   `intervention_service.py:140-163`. La logique : si nouveau statut
   transitionne et = `resolu`, set `closed_at = now()`. Si transitionne
   et != `resolu`, reset à `null`. Comportement attendu mais subtil :
   un user qui PATCH simultanément `statut: en_cours` et
   `note_cloture: "..."` reset le closed_at et garde la note (qui devient
   sémantiquement déphasée). À monitorer si des reports d'incohérence
   remontent.

3. **Compression image + flux de retry** —
   `useInterventions.ts:36-79` (`compressImage` dupliqué depuis
   `useBiens.ts`) + hook `useUploadInterventionPhoto`. Si la compression
   échoue (canvas/blob null pour formats exotiques), fallback sur le
   fichier original — peut atteindre la limite 10 MB côté serveur même
   si la photo originale était sous 10 MB côté client. Symptôme : 413
   sur upload de photo apparemment légère. Mitigation : module shared
   factorisé en sprint dette technique.

---

> Document créé en réponse à la demande Killian 2026-05-03 — branche
> `feat/bien-interventions`.
