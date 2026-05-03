# Smoke checklist — Sprint A11.A.2 (PhotosManagerModal + fix bucket)

> Session 12 · Date d'émission : 2026-05-03
> Cible : valider en bout-en-bout la modale gestion photos livrée par PR-A11.A.5
> (commits `d1406cb` + `97d6526` mergés sur main `dd84ae3`) ainsi que le fix
> bucket Supabase mergé sur main `043ace7`.

---

## Préambule

### Contexte

Trois livraisons à valider conjointement :

1. **Backend PR-A11.A.2** (`ad95e2f`) — endpoints `PATCH /biens/{id}/images/{image_id}`
   et `PATCH /biens/{id}/images/reorder`, plus refonte logique service
   (`add_image`, `update_image`, `reorder_images`, `delete_image`).
2. **Frontend PR-A11.A.5** — hooks `useUpdateBienImage` / `useReorderBienImages`
   (`e147172`), composant `PhotosManagerModal.tsx` (`d1406cb`), branchement
   zone photos sur la fiche bien (`97d6526`).
3. **Fix bucket** (`7f51f29`, mergé `043ace7`) — variabilisation des noms de
   buckets Supabase Storage via `SUPABASE_BUCKET_BIEN_IMAGES` /
   `SUPABASE_BUCKET_BIEN_DOCUMENTS` (defaults `property-images` /
   `property-documents` reflétant l'état legacy de la prod).

### Pré-requis avant smoke

- [ ] PR `fix/bucket-supabase-property-legacy` mergée sur main (commit
      `043ace7` poussé sur `origin/main`).
- [ ] Railway prod redéployé : vérifier sur Railway dashboard que le SHA
      affiché correspond bien à `043ace7` ou plus récent. Sans ce déploiement,
      l'upload retournera toujours 502 (cherche bucket `bien-images` inexistant).
- [ ] Vercel prod redéployé : vérifier sur Vercel dashboard que le SHA est
      ≥ `dd84ae3` (sans quoi la modale photo n'est pas accessible côté UI).
- [ ] URL de test : `https://althy.ch/app/biens/cabf1ff0-f3f3-4784-aafc-e062fc3f64d4`
      (bien Crans-Montana).
- [ ] Credentials test : `k.thebaud@sunimmo-riviera.ch`.
- [ ] Fichiers de test sous la main :
  - 3 photos JPG/PNG petites (< 1 MB) — pour upload nominal et reorder.
  - 1 photo lourde (> 5 MB mais ≤ 10 MB) — vérifier qu'elle passe.
  - 1 fichier > 10 MB — vérifier rejet 413 en erreur lisible.
  - 1 PDF (ou autre non-image) — vérifier rejet 422 en erreur lisible.
- [ ] DevTools Console + Network ouverts pendant tout le smoke.

---

## Axe A — Régression A11.A préservée

**Ce qu'on teste** : les modales Caractéristiques (PR-A11.A.3 / A11.A.4) et
DeleteBien (PR-A10) restent fonctionnelles et indépendantes de la nouvelle
modale photos. La grille 6 cards + le header restent visuellement intacts.

**Sous-checks** :
- [ ] Ouvrir fiche bien Crans-Montana → header bien s'affiche (titre, adresse,
      statut, méta, lien "Voir toutes les caractéristiques", boutons
      "Modifier" / "Supprimer").
- [ ] Cliquer "Voir toutes les caractéristiques" → modale Caractéristiques
      s'ouvre en mode lecture, modale Photos reste fermée.
- [ ] Cliquer "Modifier" dans le header → modale Caractéristiques s'ouvre en
      mode édition.
- [ ] Cliquer "Supprimer" → modale `DeleteBienModal` s'ouvre, modale Photos
      reste fermée.
- [ ] Fermer toutes les modales → fiche bien intacte, la grille 6 cards
      (Locataire / Finances / Estim IA / Interventions / Documents /
      Historique) s'affiche dans l'ordre attendu sur 3 colonnes desktop.
- [ ] Aucun warning React `Each child in a list should have a unique "key"`
      ou `Cannot update a component while rendering` dans la console.

**Zones de fragilité à scruter en cas de bug** :
- `frontend/src/app/app/(dashboard)/biens/[id]/page.tsx:1735-1820` —
  `BienOverview` mount désormais 3 modales (`DeleteBienModal`,
  `CaracteristiquesModal`, `PhotosManagerModal`). Trois `useState` distincts
  (`showDeleteModal`, `caracModal`, `photosModalOpen`) — vérifier qu'aucun
  conflit `z-index` n'apparaît si deux modales étaient ouvertes simultanément
  (ne devrait pas arriver UI mais le state est indépendant donc possible).
- `page.tsx:1305-1395` — la zone photos a basculé de deux structures (cover
  avec sub-button ET placeholder vide) à deux structures (cover button entier
  ET placeholder vide). Risque de régression layout si l'ancienne CSS
  `.card-header-bien-photos` repose sur la structure exacte (a priori non —
  c'est juste une `border-right` / `border-bottom`).
- `frontend/src/app/globals.css:303-311` — nouvelles règles
  `.card-header-bien-photos-cover:hover` / `:focus-visible` ajoutées. Si la
  classe existait avant pour autre chose (ne devrait pas — grep clean), elles
  pourraient interférer.

---

## Axe B — Ouverture modale

**Ce qu'on teste** : la zone photos du header est correctement câblée pour
ouvrir la modale, avec la double UX : cover cliquable + placeholder cliquable.

**Sous-checks** :
- [ ] Bien sans aucune photo → placeholder affiche `Camera` + "Ajouter des
      photos" + "Mettez votre bien en valeur". Cursor pointer au survol.
      Bordure passe de gris (`--althy-border-2`) à or (`--althy-gold`),
      icône camera scale 1.05 au hover.
- [ ] Clic sur le placeholder → modale Photos s'ouvre fullscreen (pas de
      transition vers une autre URL, pas de scroll de la page).
- [ ] Bien avec une cover → la cover s'affiche en background, aucun bouton
      "Gérer photos" en bas à droite (remplacé par overlay full-zone).
- [ ] Hover sur la cover → overlay sombre (`rgba(15, 46, 76, 0.55)`) avec
      icône Camera + "Gérer les photos" apparaît en fade-in (transition
      200 ms). Cursor pointer.
- [ ] Tab focus sur la cover → outline or visible (`focus-visible`) + overlay
      également affiché.
- [ ] Clic sur la cover → modale s'ouvre.
- [ ] À l'ouverture, le `<body>` a `overflow: hidden` (vérifier dans
      DevTools : pas de scroll possible derrière la modale).

**Zones de fragilité à scruter en cas de bug** :
- `page.tsx:1305-1395` — ternaire `{cover ? <button>... : <div>...}`. Si
  `bien.images` charge en streaming ou si le cover est calculé via
  `bien.images?.find((img) => img.is_cover) ?? bien.images?.[0] ?? null`
  (l. 1276), un flicker placeholder→cover est possible au premier load.
  Pas un bug mais à observer.
- `PhotosManagerModal.tsx:122-133` — `useEffect` scroll lock body. Si la
  modale est ouverte avec un autre overflow déjà appliqué (rare, mais
  `DCard` ou autre), le `prevOverflow` est restauré au unmount → safe.
- `page.tsx:1735+1737` — l'instance modale est mount **à tout moment** au
  niveau `BienOverview`, on contrôle juste via `open`. Donc `useBien(bienId)`
  est toujours actif via le hook interne — léger surcoût mais pas un bug.
- `PhotosManagerModal.tsx:142` — `if (!open) return null;` placé APRÈS tous
  les hooks → respecte les Rules of Hooks (pas d'erreur "Rendered fewer
  hooks").

---

## Axe C — Upload (qui marche maintenant)

**Ce qu'on teste** : le upload bout-en-bout via le bucket variabilisé
`property-images`. C'est le scénario qui était cassé (502) avant le fix
`043ace7`.

**Sous-checks** :
- [ ] Modale ouverte sur un bien sans photo → DropZone visible (icône Upload,
      "Cliquez ou glissez vos photos ici", label JPG/PNG/WebP/GIF ≤ 10 MB).
- [ ] Clic sur DropZone → file picker OS s'ouvre. Choisir 1 photo JPG petite
      (< 1 MB).
- [ ] Placeholder apparaît immédiatement dans la liste avec preview blob +
      spinner Loader2 + label "Upload en cours…" + nom du fichier tronqué.
- [ ] Network tab : `POST https://api.althy.ch/api/v1/biens/{id}/images`
      multipart/form-data avec `file` + `is_cover=false`.
- [ ] Réponse 201 + JSON contenant `url` pointant vers
      `/storage/v1/object/public/property-images/{bien_id}/{image_id}.jpg`.
- [ ] Placeholder disparaît, vraie photo apparaît dans la liste reorder
      (rangée 1, badge "Couverture" si c'est la première photo du bien —
      c'est `bien.images[0]` qui sert de cover par défaut côté frontend).
- [ ] Cover s'affiche dans le header bien après fermeture modale (vérifier
      le re-render via cache invalidation).
- [ ] Drag-drop OS sur DropZone (depuis Explorer/Finder) avec 3 fichiers
      d'un coup → 3 placeholders créés, 3 uploads parallèles, 3 succès.
- [ ] Upload photo lourde (5-10 MB) → compression côté client dans
      `compressImage` (max 1920 px, qualité 0.82) → POST avec body réduit →
      201.
- [ ] Upload fichier > 10 MB → placeholder en état erreur côté local (max
      10 MB), pas d'appel POST (la validation côté client `MAX_BYTES`
      intercepte avant la mutation). Bouton X pour retirer le placeholder.
- [ ] Upload PDF (ou .txt) → placeholder en état erreur "Format non
      supporté…", pas d'appel POST.

**Zones de fragilité à scruter en cas de bug** :
- `backend/app/services/bien_service.py:467-469` — appel
  `_upload_to_storage(settings.SUPABASE_BUCKET_BIEN_IMAGES, ...)`. Si la
  Railway env n'a PAS la variable et que les defaults Settings ne prennent
  pas (mauvais reload service), tomber back à `bien-images` qui n'existe
  pas → 502 avec message "Storage upload failed: ...". Vérifier
  `_storage_url` headers (`_STORAGE_HEADERS` en haut du fichier).
- `frontend/src/lib/hooks/useBiens.ts:316-343` — `useUploadBienImage` lance
  `compressImage` (l. 187) qui peut échouer silencieusement (canvas/blob
  null) → fallback sur `file` original. Si compression bug, on envoie le
  fichier non compressé (pas un blocker pour le test).
- `PhotosManagerModal.tsx:144-200` — `handleFiles` boucle synchrone sur
  `files`, lance N mutations en parallèle. Pas de queue/throttle. Si l'user
  drop 20 fichiers, 20 POST simultanés → backend probablement OK mais
  Vercel/Railway peuvent rate-limit. Pas un bug, juste à savoir.
- `PhotosManagerModal.tsx:159-167` — détection `MAX_BYTES = 10 * 1024 * 1024`
  (10 MB strict). Backend `MAX_FILE_SIZE` même valeur (`bien_service.py:38`).
  Cohérent.
- `bien_service.py:457` — `data = await file.read()` charge tout en mémoire.
  Si plusieurs uploads concurrents, mémoire pic ~ N × 10 MB. Pas un bug
  pour smoke mais à monitorer plus tard.
- `bien_service.py:451-455` — validation `content_type` strict via
  `ALLOWED_IMAGE_TYPES` (jpeg, png, webp, gif). Si le navigateur envoie
  `application/octet-stream` (rare, fichier sans extension), 422.
  Frontend filtre déjà via `accept="image/jpeg,..."` mais drag-drop OS
  contourne le filtre.

---

## Axe D — Drag-and-drop reorder

**Ce qu'on teste** : la réorganisation des photos via drag fonctionne en
optimistic + persiste après refresh + le backend valide la cohérence du payload.

**Sous-checks** :
- [ ] Avoir au moins 4 photos uploadées sur le bien.
- [ ] Drag photo position 3 vers position 1 → animation framer-motion fluide
      (cards s'écartent, photo dragguée scale 1.02 + box-shadow), pas de
      saut visuel à la prise ni au drop.
- [ ] Au drop, la grille reflète immédiatement le nouvel ordre (optimistic
      update via `useReorderBienImages.onMutate`).
- [ ] Network tab : `PATCH /api/v1/biens/{id}/images/reorder` avec body
      `{ "order": ["uuid1", "uuid2", "uuid3", "uuid4"] }` — TOUS les IDs
      du bien dans le nouvel ordre.
- [ ] Réponse 200 avec `list[BienImageRead]` dans le nouvel ordre.
- [ ] Refresh page (F5) → ordre persiste, photo précédemment en position 3
      est bien rendue en position 1, badge couverture suit la photo cover
      même si elle a changé de position.
- [ ] Drag puis ESC pendant le drag → drag annulé par framer-motion, ordre
      original conservé, AUCUN appel `PATCH /reorder` (à vérifier dans
      Network tab).
- [ ] Drag puis drop hors zone reorder (sur DropZone par exemple) →
      framer-motion annule, ordre original conservé.
- [ ] Mobile (375 px viewport via DevTools) : long-press + drag sur une
      Reorder.Item → fonctionne (touch events). À noter : Reorder.Group
      gère bien touch + mouse, mais sur mobile le tap pour scroll vertical
      peut entrer en conflit. Vérifier qu'on peut quand même scroller la
      modale verticalement quand on ne touche pas une row.

**Zones de fragilité à scruter en cas de bug** :
- `PhotosManagerModal.tsx:74-89` — sync `localOrder` ← `bien.images` via
  `useEffect` gardé par `isReorderingRef`. Si `bien.images` change pendant
  un drag (un autre upload se termine, par exemple), l'effet skip la sync
  → drag continue avec ordre stale → potentiel saut visuel post-drop.
  Workaround possible si ça pose souci : pause uploads pendant drag.
- `PhotosManagerModal.tsx:241-251` — `handleReorder(next)` set ref true,
  mutate, `onSettled` reset ref. Si la mutation throw avant settled (cas
  rare), ref reste `true` → next sync skip indéfiniment. Mitigation : la
  prochaine mutation reset.
- `frontend/src/lib/hooks/useBiens.ts:422-457` — `useReorderBienImages`
  optimistic update REORDER l'array `images` ET réécrit `img.order = idx`.
  Si la response serveur diffère (race), `onSettled` invalide → resync.
- `backend/app/services/bien_service.py:557-618` — `reorder_images` exige
  set strict `payload == existing` (l. 591). Si l'user supprime une photo
  juste avant un reorder (race), le reorder envoie un set qui contient
  encore l'ID supprimé → 400 "inconnus : [...]". Le hook frontend
  `onError` rollback proprement.
- `bien_service.py:576-580` — détection doublons en payload → 400.
  Improbable côté frontend (Reorder.Group ne duplique pas).
- `backend/app/schemas/bien.py:269` — `min_length=1` sur `order` →
  appel reorder avec liste vide rejeté en 422 schéma. Ne devrait jamais
  arriver côté UI (handler n'est pas appelé sans photos).
- `backend/app/routers/biens.py:179-192` — ⚠️ **ordre des routes critique** :
  `/reorder` déclaré AVANT `/{image_id}` pour que FastAPI ne tente pas de
  parser "reorder" comme UUID. Si quelqu'un réordonne les routes →
  régression silencieuse 422 sur reorder.

---

## Axe E — Set cover

**Ce qu'on teste** : changer la photo de couverture depuis la modale, avec
optimistic + persistance + unicité (une seule cover par bien).

**Sous-checks** :
- [ ] Avoir 3+ photos. La 1ère a le badge "Couverture" or.
- [ ] Cliquer l'étoile sur la photo position 2 → optimistic immédiat :
      badge se déplace en 2, étoile disparaît de 2, étoile réapparaît en 1.
- [ ] Network tab : `PATCH /api/v1/biens/{id}/images/{image_id}` avec body
      `{ "is_cover": true }`. Réponse 200 avec `BienImageRead` updated.
- [ ] Refresh page → la photo position 2 est bien la nouvelle cover, dans
      le header bien la cover affichée correspond.
- [ ] Cliquer l'étoile sur la photo position 3 → cover bascule à nouveau,
      badge sur 3, plus de badge sur 2.
- [ ] Vérifier qu'il n'y a JAMAIS deux badges "Couverture" simultanément
      (unicité backend respectée).
- [ ] La cover dans le header bien (`page.tsx:1276`) suit la nouvelle
      cover après cache invalidation.

**Zones de fragilité à scruter en cas de bug** :
- `frontend/src/lib/hooks/useBiens.ts:375-415` — `useUpdateBienImage`
  optimistic appliqué UNIQUEMENT sur `is_cover === true` (l. 397). Si on
  passait `is_cover: false`, pas d'optimistic → l'UI attend la response
  serveur. Cohérent avec la décision documentée dans le commentaire l. 372.
- `bien_service.py:537-548` — `update_image` force l'unicité quand
  `is_cover=true` : SELECT toutes les autres covers → flag à false →
  applique le True sur la cible. Tout dans la même transaction (flush en
  l. 553). OK.
- `bien_service.py:537` — la condition `data.get("is_cover") is True`
  utilise l'égalité stricte avec `True`. Si Pydantic renvoyait `1` ou
  un truthy non-True, raté. Vérifié : `BienImageUpdate.is_cover: bool | None`
  donc Pydantic coerce en bool strict. OK.
- `PhotosManagerModal.tsx:227-235` — bouton étoile rendu seulement si
  `!img.is_cover`. Pas de "désigner aucune cover" — pour ça il faudrait
  cliquer la cover actuelle, ce qui n'est pas exposé. Si l'utilisateur veut
  retirer la cover sans en désigner une autre : impossible via UI (à
  noter). Edge case probablement non testé.

---

## Axe F — Delete

**Ce qu'on teste** : la suppression d'une photo retire l'image du bien, du
storage Supabase, et de la liste reorder.

**Sous-checks** :
- [ ] Avoir 3+ photos. Cliquer la poubelle sur la photo position 2.
- [ ] `window.confirm("Supprimer cette photo ?")` → confirmer.
- [ ] Optimistic immédiat : photo position 2 disparaît, photo précédemment
      en 3 monte en 2, le total photos décrémente.
- [ ] Network tab : `DELETE /api/v1/biens/{id}/images/{image_id}` →
      réponse 204.
- [ ] Refresh page → photo bien supprimée, ordre persistant.
- [ ] Vérifier dans Supabase Storage dashboard que le fichier a été
      réellement supprimé du bucket `property-images/{bien_id}/`.
- [ ] Supprimer la cover → optimistic remove. Le frontend `CardHeaderBien`
      tombera en fallback sur `bien.images[0]` (next photo), MAIS le
      backend ne re-promote pas une autre cover automatiquement → si
      plus aucune photo, retour au placeholder vide.
- [ ] Annuler le confirm → aucune action, aucun appel réseau.

**Zones de fragilité à scruter en cas de bug** :
- `frontend/src/lib/hooks/useBiens.ts:345-368` — `useDeleteBienImage`
  optimistic remove du cache + rollback `onError`. Ne ré-promote pas une
  autre cover.
- `bien_service.py:637-641` — `delete_image` calcule le path à supprimer
  via `img.url.split(marker)[-1]` où `marker = f"/{bucket}/"`. Si l'URL
  en DB pointe vers un AUTRE bucket (cas legacy hypothétique : URL avec
  `/bien-images/` alors que le bucket actif est `property-images`), le
  marker ne match pas → `path = None` → fichier orphelin dans Storage,
  ligne supprimée en DB sans purge Storage.
- `bien_service.py:640-641` — purge Storage NON await sur erreur
  (`_delete_from_storage` n'a pas de check de status). Si Supabase répond
  404 (fichier déjà absent), on continue silencieusement. Pas un bug,
  comportement défensif.
- `bien_service.py:643-644` — `await self.db.delete(img)` puis `flush`.
  La transaction est commit par le router/middleware (FastAPI dependency
  pattern). Si commit échoue, fichier déjà purgé Storage mais ligne DB
  conservée → orphelin storage→DB inverse. Risque très faible.
- `PhotosManagerModal.tsx:213-216` — `window.confirm` natif. Sur mobile,
  certains navigateurs WebView (in-app browser Instagram/FB) n'affichent
  pas le confirm correctement. Pas un blocker pour smoke desktop.

---

## Axe G — Fermeture modale

**Ce qu'on teste** : les 4 chemins de fermeture (X, backdrop, ESC, "Fermer"
footer) passent tous par `attemptClose` avec confirmation native si uploads
en vol.

**Sous-checks** :
- [ ] Modale ouverte sans upload en cours → clic sur X (header) → modale
      ferme immédiatement, pas de confirmation.
- [ ] Modale ouverte → clic sur backdrop (zone sombre autour de la
      shell) → modale ferme.
- [ ] Modale ouverte → ESC → modale ferme.
- [ ] Modale ouverte → clic "Fermer" du footer → modale ferme.
- [ ] Au close, `<body>` retrouve son `overflow` initial (scroll page
      reprend).
- [ ] Démarrer un upload (gros fichier qui prend > 2 s), pendant l'upload
      cliquer X → `window.confirm` "Des uploads sont en cours…" apparaît.
- [ ] Refuser le confirm → modale reste ouverte, upload continue.
- [ ] Accepter le confirm → modale ferme, l'upload continue en arrière-plan
      (l'invalidate cache fera apparaître la photo en background une fois
      terminée).
- [ ] Réouvrir la modale après une fermeture pendant upload → les
      placeholders en `status: "uploading"` sont conservés, ceux en
      `status: "error"` sont reset (effet l. 116-119).
- [ ] Cliquer sur une Reorder.Item à l'intérieur de la modale → `e.stopPropagation()`
      empêche le close backdrop par bubbling.

**Zones de fragilité à scruter en cas de bug** :
- `PhotosManagerModal.tsx:104-115` — `attemptClose` checks
  `hasUploadsInFlight` via `pending.some((p) => p.status === "uploading")`.
  Si un upload est en cours mais a déjà set `status: "error"` avant
  l'attemptClose, pas de confirmation (correct).
- `PhotosManagerModal.tsx:122-133` — listener Esc + scroll lock body. Le
  cleanup restaure `prevOverflow` capturé à l'open. Si une autre
  modal/route lock le body en parallèle, restauration potentiellement
  incorrecte. Probabilité très faible.
- `PhotosManagerModal.tsx:233-235` — `onClick={(e) => { if (e.target ===
  e.currentTarget) attemptClose(); }}` sur backdrop. La shell intérieure
  a `onClick={(e) => e.stopPropagation()}` (l. 257) — empêche bubble.
  Si un Reorder.Item lance un drag puis releaseboard hors de la shell, le
  mouseup peut être catché par le backdrop → backdrop close ? framer-motion
  consomme normalement ces events.
- `PhotosManagerModal.tsx:116-119` — `useEffect` qui filtre les pending
  errors à chaque (re)ouverture. Si la modale n'a pas de transition fadeout,
  ça filtre instantanément à la prochaine open.
- `page.tsx:1735` — la modale est mount en permanence. Donc le state
  `pending` survit à open=false → reopen. Si l'utilisateur ferme la modale
  pendant un upload, accepte le confirm, navigue vers une autre fiche bien,
  le state pending de la précédente est GC'd avec l'unmount du composant
  parent. OK.

---

## Axe H — Responsive

**Ce qu'on teste** : la modale fullscreen et la zone photos du header sont
correctement responsive sur mobile (375 px), tablette (768 px), desktop
(1280+ px).

**Sous-checks** :
- [ ] Desktop 1280+ : modale fullscreen avec body inner max-width 880 px
      centré, padding 28 px latéral.
- [ ] Desktop 1024 : grille header bien 2 colonnes (zone photos gauche, infos
      droite). Cover prend la moitié gauche, hauteur ≥ 200 px.
- [ ] Tablette 768-1023 : mêmes 2 colonnes (CSS `card-header-bien-grid`
      kicks in ≥ 768).
- [ ] Mobile 375 : grille header 1 colonne (photos en haut, infos dessous).
      Zone photos `min-height: 220 px` (CSS l. 253). Modale prend 100vh,
      DropZone full width avec padding 28 px latéral.
- [ ] Mobile : DropZone clic ouvre file picker mobile (camera ou galerie).
- [ ] Mobile : Reorder.Item peut être draggué via long-press (framer-motion
      détecte touchstart). Scroll vertical de la modale fonctionne quand on
      ne touche pas une row.
- [ ] Mobile : Header modale (titre "Galerie photos" + sous-titre + bouton X)
      ne déborde pas, le X reste accessible en haut à droite.
- [ ] Footer modale ("Fermer") collé en bas, accessible sans scroll
      additionnel.

**Zones de fragilité à scruter en cas de bug** :
- `frontend/src/app/globals.css:240-256` — règles `card-header-bien-photos`
  + breakpoint `max-width: 767px` (border bottom + min-height 220). Pas
  de média-queries dans la modale elle-même → tout en inline styles fluides.
- `PhotosManagerModal.tsx:584-600` — `bodyStyle` = `flex: 1; overflowY: auto`.
  Si le viewport est très étroit (< 320 px), les actions inline (étoile +
  poubelle) peuvent passer sous le label. Pas testé. Avec les 72 px
  thumb + flex: 1 sur le label central + actions flex-shrink: 0, sur 320 px
  ça reste OK mais à vérifier.
- `PhotosManagerModal.tsx:560` — `shellStyle` `width: 100%; maxWidth: 100%;
  height: 100vh`. Sur iOS Safari, `100vh` inclut la URL bar → léger overflow
  bottom. Pas un bug bloquant.
- `globals.css:303-311` — pas de média-query `:hover` pour mobile, mais
  les browsers mobiles ne déclenchent normalement pas `:hover`. Le
  `:focus-visible` reste accessible au tab clavier.

---

## Axe I — Console JS clean

**Ce qu'on teste** : aucune erreur ni warning React/Next nouvelle apparaît
dans la console pendant les flows nominaux du smoke.

**Sous-checks** :
- [ ] Console DevTools ouverte avant d'ouvrir la modale.
- [ ] Charger fiche bien → 0 erreur, 0 warning React (sauf hydration mismatch
      pré-existant documenté en backlog roadmap §2.10).
- [ ] Ouvrir / fermer la modale 3 fois → 0 nouveau warning.
- [ ] Upload 1 photo → 0 erreur. Vérifier qu'aucun warning
      `state update on unmounted component` ne sort si l'utilisateur ferme
      la modale pendant un upload (la modale ne unmount pas, juste
      `return null`, donc pas de warning attendu).
- [ ] Drag-reorder → 0 warning framer-motion (`Reorder.Item without unique
      key`, etc.).
- [ ] Set cover, delete → 0 warning React Query (`Cancelling already
      cancelled query`, etc.).
- [ ] Network tab : aucun XHR / fetch en 4xx hors comportement attendu
      (validation côté serveur sur uploads invalides intentionnels).
- [ ] Aucune URL d'image en 404 dans Network (vérification cohérence
      bucket).

**Zones de fragilité à scruter en cas de bug** :
- `PhotosManagerModal.tsx:88-94` — cleanup blob URLs au démontage final
  via ref. Si pendant la session de modale on revoke un blob trop tôt
  (avant que l'<img> ne l'ait chargé), Chrome peut afficher
  `ERR_FILE_NOT_FOUND`. Pas attendu ici car on revoke après upload settle.
- `PhotosManagerModal.tsx:200-208` — `mutateAsync().catch((err))` → narrow
  type via cast `as { response?: { data?: { detail?: string } } }`. Si
  axios change la structure d'erreur ou si c'est une erreur réseau pure
  (pas de response), `detail` undefined → fallback "Échec de l'upload".
  OK.
- `useBiens.ts:280-298` — `useUpdateBien` optimistic snapshot en mémoire
  (ctx.prev). Si plusieurs `update_image` en parallèle, le `prev` peut être
  l'état déjà optimistic d'une mutation précédente → rollback partiel.
  Edge case rare en smoke.
- `frontend/src/lib/api.ts` (non audité ici) — gère les axios interceptors.
  Si un 401 sort sur upload (token expiré), le user est redirect login →
  modale photos perdue. Pas blocker smoke si on est connecté.

---

## Axe J — Backend endpoints réseau

**Ce qu'on teste** : les 4 endpoints REST images répondent avec les bons
codes/headers en prod, et le bucket effectif sur les URLs renvoyées.

**Sous-checks (via DevTools Network ou curl direct)** :
- [ ] `GET /api/v1/biens/{id}` → 200, payload contient `images: [...]` avec
      `id`, `bien_id`, `url`, `order`, `is_cover`, `created_at`.
- [ ] Toutes les `images[].url` matchent
      `^https://[^/]+/storage/v1/object/public/property-images/{uuid}/.*$`
      (regex). Si une URL contient `/bien-images/`, c'est de la donnée
      orpheline (la table était vide en prod confirmé, donc ne devrait
      pas arriver).
- [ ] `POST /api/v1/biens/{id}/images` (multipart) → 201,
      `Content-Type: application/json`, body `BienImageRead`.
- [ ] `POST /api/v1/biens/{id}/images` avec un .txt → 422 + detail
      "Format image non supporté : text/plain" (à confirmer). Frontend
      bloque déjà mais le test backend direct doit aussi rejeter.
- [ ] `POST` avec fichier > 10 MB raw (sans compression client) → 413
      + detail "Fichier trop gros (max 10 MB)".
- [ ] `PATCH /api/v1/biens/{id}/images/{image_id}` `{ "is_cover": true }`
      → 200 + image updated. Vérifier que toute autre image du bien a
      `is_cover: false` dans le `GET` suivant.
- [ ] `PATCH /api/v1/biens/{id}/images/reorder` avec un seul UUID alors
      que le bien en a 3 → 400 + detail "manquants : [...]".
- [ ] `PATCH /reorder` avec un UUID inconnu → 400 + detail "inconnus :
      [...]".
- [ ] `PATCH /reorder` avec un doublon → 400 "IDs en doublon dans le
      payload".
- [ ] `PATCH /reorder` avec liste complète dans nouvel ordre → 200 +
      `list[BienImageRead]`.
- [ ] `DELETE /api/v1/biens/{id}/images/{image_id}` → 204 sans body.
- [ ] `DELETE` sur un image_id qui n'appartient pas au bien → 404
      "Image introuvable".
- [ ] User non autorisé (proprio d'un autre bien, locataire) → 403 sur
      tous les endpoints (`_can_write` check).

**Zones de fragilité à scruter en cas de bug** :
- `backend/app/routers/biens.py:179-192` — ordre de déclaration des routes
  critique : `/reorder` AVANT `/{image_id}`. Documenté en commentaire,
  mais une régression silencieuse est facile.
- `backend/app/services/bien_service.py:467-469` — passage du bucket via
  `settings.SUPABASE_BUCKET_BIEN_IMAGES`. Si Railway env mal chargé →
  fallback default `property-images` (cohérent avec prod actuelle).
- `bien_service.py:557-618` — `reorder_images` exige set strict. Le
  service charge **toutes** les images du bien d'abord (l. 582-586) puis
  compare. Si N est très grand (improbable Phase 1 : on imagine ≤ 30
  photos par bien), perf dégradée mais OK fonctionnellement.
- `bien_service.py:589-590` — `existing_ids: set[uuid.UUID]` vs
  `payload_ids: set[uuid.UUID]`. Si le payload contient des strings au
  lieu d'UUID, Pydantic coerce déjà au schéma (`order: list[uuid.UUID]`)
  donc pas un risque ici.
- `backend/app/schemas/bien.py:269` — `min_length=1`. Un payload vide est
  rejeté avant même d'atteindre le service.
- Auth : `_can_write` check rôles `MANAGER_ROLES = {"super_admin",
  "proprio_solo", "agence"}`. Locataire / artisan tenteraient un upload →
  403. Compte test `k.thebaud@sunimmo-riviera.ch` doit être proprio_solo
  ou super_admin du bien Crans-Montana pour que les checks passent.

---

## Anomalies détectées

À remplir au fur et à mesure du smoke. Si une case est cochée comme
défaillante, créer une ligne ici.

| Axe | Description bug | Fichier suspecté | Sévérité |
|-----|-----------------|------------------|----------|
|     |                 |                  |          |

Sévérités : **P0** (bloque le smoke), **P1** (smoke OK mais à corriger
avant prochain sprint), **P2** (cosmétique / edge case).

---

## Conclusion

- [ ] Tous les axes A-J passent → A11.A.2 considérée smoke-OK.
- [ ] Création doc finale `SPRINT-A11A2-photos.md` (bilan global du sprint
      A11.A.2 incluant ce résultat smoke embedded).
- [ ] Si fix(es) nécessaire(s) → branche dédiée par fix
      (`fix/<slug>` à partir de `main`) + nouveau cycle smoke ciblé.

---

## Top 3 zones de fragilité à scruter en priorité

Si un bug apparaît pendant le smoke, regarder ces 3 zones EN PREMIER :

1. **Bucket effectif Supabase** —
   `backend/app/services/bien_service.py:467-469` (upload),
   `:637-641` (delete path split) +
   `backend/app/core/config.py:27-30` (defaults).
   Les URLs renvoyées doivent toutes contenir `/property-images/` (état
   legacy actuel). Toute URL `bien-images` indique un Railway pas à jour
   ou un revert silencieux. C'est la cause racine du 502 qui vient d'être
   fixé — premier endroit à vérifier sur n'importe quel bug d'upload /
   suppression.

2. **Reorder.Group + sync `localOrder`** —
   `frontend/src/components/biens/PhotosManagerModal.tsx:74-89`
   (sync useEffect) + `:241-251` (handleReorder + isReorderingRef).
   La synchro entre l'état local de drag et le cache React Query est le
   point le plus subtil de la modale. Symptômes possibles : photo qui
   "saute" en arrière après un drop, ordre qui se déresync après un
   upload simultané, ref `isReorderingRef` bloquée à `true` après une
   mutation qui throw. À déboguer avec un `console.log` du `localOrder`
   + `bien.images.map(i => i.id)` dans l'effet.

3. **Validation set strict du reorder backend** —
   `backend/app/services/bien_service.py:589-603`.
   Le service exige que le payload contienne EXACTEMENT tous les IDs du
   bien (manquants OU inconnus → 400). Toute désynchro entre la liste
   client et la DB (ex : un autre onglet a delete une photo, ou un
   upload qui termine à 1 ms du drop) → reorder rejeté en 400. Le hook
   frontend rollback proprement, mais l'utilisateur voit une UI qui
   "rejette" silencieusement son drag. À monitorer côté logs Railway si
   un user reporte des reorders qui ne persistent pas.

---

> Document créé en réponse à la demande Killian 2026-05-03 — branche
> `docs/smoke-checklist-a11a2`.
