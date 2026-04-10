# ALTHY — L'assistant immobilier suisse

## L'esprit du projet

Althy n'est pas un logiciel de gestion. C'est un assistant immobilier disponible 24h/24, 7j/7, au service de tous les acteurs de l'immobilier suisse — propriétaires, agences, artisans, ouvreurs, locataires, hunters, experts.

Il ne remplace personne. Il simplifie ce qui est complexe, connecte ceux qui ont besoin de se trouver, et génère ce qui prend du temps. L'humain décide toujours. Althy propose, l'humain valide.

**Le maître mot : simplicité.** Deux clics maximum pour toute action courante. Une personne de 60 ans doit pouvoir utiliser Althy sans formation.

---

## L'identité visuelle

- **Orange** : `#E8602C` — `var(--althy-orange)`
- **Fond** : `#FAF8F5` — `var(--althy-bg)`
- **Surface cards** : `#FFFFFF` — `var(--althy-surface)`
- **Bordures** : `#EAE3D9` — `var(--althy-border)`
- **Texte principal** : `#1A1612` — `var(--althy-text)`
- **Texte secondaire** : `#8A7A6A` — `var(--althy-text-3)`
- **Police titres** : Cormorant Garamond, serif
- **Police corps** : Inter ou DM Sans
- **Border-radius** : 14-16px sur les cards
- **Toujours** utiliser les variables CSS `--althy-*` — jamais de couleurs codées en dur

Le design de toutes les pages doit être cohérent avec la marketplace interne (listings) : fond crème, cards blanches avec bordure légère, orange comme seul accent fort.

---

## Le stack technique

- **Frontend** : Next.js 14 App Router + TypeScript — Vercel
- **Backend** : FastAPI Python + Celery + Redis — Railway
- **Base de données** : Supabase (PostgreSQL + Auth + Storage + Realtime)
- **IA** : Anthropic Claude Sonnet — streaming SSE pour la Sphère
- **Paiements** : Stripe + Stripe Connect
- **Emails** : Resend | **SMS** : Twilio | **Push** : Firebase
- **Repo** : github.com/killiantheb/immohub
- **Site** : althy.ch

---

## Les 9 rôles utilisateurs

| Rôle | Description | Prix |
|------|-------------|------|
| `proprio_solo` | Propriétaire indépendant | CHF 29/mois |
| `agence` | Agence immobilière | CHF 29/agent/mois |
| `portail_proprio` | Proprio connecté par son agence | CHF 9/mois |
| `opener` | Ouvreur — visites et états des lieux | Gratuit / CHF 19 Pro |
| `artisan` | Artisan — devis et chantiers | Gratuit / CHF 19 Pro |
| `expert` | Expert immobilier | Gratuit / CHF 19 Pro |
| `hunter` | Apporteur de leads off-market | Referral fee |
| `locataire` | Locataire — documents et signalements | Gratuit |
| `acheteur_premium` | Acheteur — alertes et avant-premières | CHF 9/mois |

---

## Le modèle économique

- **4% sur tous les flux financiers** transitant par Althy (loyers, réservations Airbnb, Booking...)
- Si le client paie directement un portail : Althy facture ses 4% séparément
- **Zéro marge cachée** sur les portails — le client paie le tarif du portail directement
- Frais dossier locataire : **CHF 90 uniquement si candidat retenu** — jamais avant

---

## Le parcours utilisateur

```
/ (landing) → /login → /bienvenue → /app/sphere (hub central) → /app (tableau de bord optionnel)
```

La **Sphère IA** est le point d'entrée principal après connexion. Le tableau de bord est un complément optionnel pour ceux qui veulent une vue gestionnaire détaillée.

---

## La Sphère IA — le cœur d'Althy

La Sphère est un agent IA autonome. Chaque matin elle analyse le contexte complet de l'utilisateur et propose des actions prioritaires. Elle attend la validation humaine avant d'exécuter quoi que ce soit.

Elle comprend le langage naturel. Un propriétaire dit "ma chaudière est cassée" — la Sphère trouve trois artisans notés, compare les devis, attend la confirmation.

Elle apprend. Chaque modification apportée avant validation est mémorisée comme préférence.

Elle note. Après chaque transaction terminée, elle demande une évaluation de l'acteur concerné. Cela génère une base de confiance vérifiée dans chaque secteur de l'immobilier suisse.

---

## Le système de notation

Tous les acteurs sont notés après chaque interaction réelle. Les bons acteurs remontent dans les résultats de la Sphère. Le badge "Vérifié Althy" s'affiche à partir de 4.5/5 avec 10 avis ou plus.

| Acteur noté | Ce qui est noté | Affichage | Bénéfice |
|-------------|-----------------|-----------|----------|
| Artisan | Qualité, délais, propreté, communication | Étoiles 1–5 + avis texte vérifié | Remonte dans les résultats Sphère |
| Ouvreur | Ponctualité, professionnalisme, rapport, photos | Étoiles + badge "Vérifié Althy" | Reçoit plus de missions automatiquement |
| Expert | Précision estimations, qualité rapports, délais | Note + spécialités vérifiées | Profil premium visible marketplace |
| Agence | Réactivité, satisfaction proprios, taux mise en location | Score global agence | Visibilité auprès des proprios |
| Proprio | Sérieux des paiements, communication locataires | Note interne (visible artisans/ouvreurs) | Attire les meilleurs prestataires |
| Hunter | Qualité des leads, taux de transformation | Taux de succès visible | Honoraires plus élevés si bon track record |
| Locataire | Paiement à temps, état logement, communication | Note interne (visible proprios) | Accès prioritaire aux bons logements |

---

## Messages clés par audience

| Pour qui | Message marketing |
|----------|------------------|
| Proprio solo | Gérez vos biens vous-même, simplement. Althy s'occupe des documents, des relances, des artisans. Vous gardez le contrôle. |
| Agence immobilière | Althy est l'outil de votre équipe. Moins de tâches répétitives, plus de temps pour vos clients. Et vos proprios clients ont leur portail dédié. |
| Artisan | Trouvez des chantiers qualifiés. Recevez les devis, facturez directement. Votre profil vérifié parle pour vous. |
| Ouvreur | Des missions de visite planifiées automatiquement. Votre zone, vos disponibilités, vos revenus en temps réel. |
| Locataire | Vos documents, vos quittances, signaler un problème. Tout en un. Simple et gratuit. |
| Hunter | Apportez des leads. Soyez rémunéré à chaque transaction réussie. Le réseau Althy travaille pour vous. |

---

## La stratégie réseau

Althy grandit par effet réseau naturel — les uns appellent les autres :

| Canal / Mécanisme | Comment ça fonctionne | Impact prévu |
|-------------------|-----------------------|--------------|
| Proprio → artisan | Le proprio ajoute un artisan à un chantier, l'artisan reçoit une invitation | 1 proprio = 2–3 artisans |
| Agence → proprios | L'agence envoie le portail CHF 9 à tous ses clients | 1 agence = 50–300 utilisateurs |
| Artisan → proprios | L'artisan recommande Althy à ses clients proprios | 1 artisan = 5–15 proprios |
| Ouvreur → proprios | Le proprio voit la qualité du service et s'inscrit | 1 ouvreur = 3–8 proprios |
| Estimation gratuite | Capture email → 14 jours gratuits | Tunnel principal |
| Démo Sphère | Intégration agence en 30 secondes — l'effet WOW = meilleur commercial | 1 démo = 1 agence signée |

---

## Règles de développement

**Langue** : tout en français — URLs, labels, boutons, messages. Aucun mot anglais visible par l'utilisateur final.

**Navigation** :
- Logo ALTHY cliquable = retour vers `/` sur toutes les pages
- Bouton `← Retour à althy.ch` sur /login, /register, /forgot-password, /reset-password
- Header minimal (logo + "Se connecter") sur /tenant/*, /portail/[token], /opener
- Fil d'ariane sur toutes les sous-pages /app/biens/[id]/*
- Widget Sphère flottant sur toutes les pages /app/* sauf /app/sphere
- Bouton "Tableau de bord" en haut droite de /app/sphere
- Bouton "← Sphère IA" en haut de /app

**Code** :
- Composants `Althy*` uniquement — jamais `Cathy*`
- Plans tarifaires centralisés dans `frontend/src/lib/plans.config.ts`
- Une seule URL par page, toujours en français
- Une seule entrée "Althy IA" dans la sidebar → /app/sphere
- Sidebar Paramètres : une seule entrée vers /app/settings, sans sous-liens
- Variables CSS `--althy-*` partout, jamais de couleurs en dur

**Comportement** :
- L'humain valide toujours avant exécution
- Chaque action irréversible a un écran de confirmation
- Les prix et commissions sont toujours affichés clairement — zéro opacité
- Maximum 2 clics pour toute action courante

---

## Ce qu'Althy n'est PAS

- Pas un concurrent des agences — il les aide à être meilleures
- Pas responsable des actions exécutées — l'utilisateur valide et prend la responsabilité
- Pas opaque — 4% visible, rien d'autre
- Pas complexe — si ça prend plus de 2 clics, c'est à simplifier

---

## Parcours utilisateur — de A à Z

| # | URL | Expérience utilisateur |
|---|-----|----------------------|
| 1 | `/` | Landing : message "Votre assistant immobilier". Boutons : "Se connecter" (haut droite) + "Commencer gratuitement" (CTA orange). Tunnel estimation en accroche. |
| 2 | `/estimation` | Estimation IA gratuite. Capture email après le résultat. Redirect `/register?email=...&source=estimation`. |
| 3 | `/login` | Logo ALTHY = lien vers `/`. Bouton `← Retour à althy.ch`. Email + mot de passe. Liens : S'inscrire \| Mot de passe oublié. |
| 4 | `/register` | Bouton retour. Choix rôle en cards. Redirect `/bienvenue` après inscription. |
| 5 | `/bienvenue` | 5 étapes max. Pré-rempli si invitation. Sphère s'anime. 2 clics pour être prêt. |
| 6 | `/app/sphere` | **HUB CENTRAL.** Briefing du jour. Cards actions à valider. Bouton "Tableau de bord" en haut droite. Widget flottant sur les autres pages. |
| 7 | `/app` | Tableau de bord optionnel. Bouton "← Sphère IA" en haut. Sidebar selon le rôle. |
| 8 | `/app/*` | Pages spécifiques. Fil d'Ariane. Widget Sphère flottant. |
| 9 | Portails publics | `/tenant/*` `/portail/[token]` `/opener` : header minimal logo ALTHY + "Se connecter". |

---

## Modèle économique

| Source | Mécanisme |
|--------|-----------|
| Abonnement CHF 29/mois | Par utilisateur proprio ou agent d'agence (CHF 23 si annuel) |
| 4% sur flux financiers | Loyer ou réservation transite par Althy via Stripe Connect |
| 4% facturé séparément | Client paie portail directement → Althy facture ses 4% au client |
| Frais dossier CHF 90 | Locataire retenu **uniquement** — jamais prélevé avant la réussite |
| Commission ouvreurs 15% | Mission planifiée et payée via Althy → 15% pour Althy |
| Caution locative 10% | Commission versée par Firstcaution/SwissCaution |
| Portail proprio CHF 9 | Accès portail pour proprios des agences clientes |
| Expert/Artisan Pro CHF 19 | Abonnement pro pour profil premium + accès missions |

---

## Règles absolues — chaque développement doit les respecter

**TOUJOURS**
- Tout en **français** — URLs, labels, boutons, messages. Zéro mot anglais visible.
- Logo ALTHY = retour vers `/` sur toutes les pages
- Bouton `← Retour à althy.ch` sur `/login` `/register` `/forgot-password` `/reset-password`
- Header minimal (logo + "Se connecter") sur `/tenant/*` `/portail/[token]` `/opener`
- Fil d'Ariane sur toutes les sous-pages `/app/biens/[id]/*`
- Widget Sphère flottant sur toutes les pages `/app/*` sauf `/app/sphere`
- Bouton "Tableau de bord" en haut droite de `/app/sphere`
- Bouton "← Sphère IA" en haut de `/app`
- Variables CSS `--althy-*` partout — jamais de couleurs codées en dur
- Plans tarifaires depuis `plans.config.ts` — une seule source de vérité
- 4% transparent sur tous les flux — zéro marge cachée
- L'humain valide **toujours** avant exécution
- Système de notation sur chaque transaction/interaction
- Ton bienveillant — Althy aide tous les acteurs, ne remplace personne

**NE JAMAIS**
- URLs en anglais (`/properties` `/openers` `/accounting` `/advisor`)
- Composants nommés `Cathy*` — tout renommer en `Althy*`
- Marge cachée sur les portails
- Message comparatif agressif contre les régies ou agences
- Deux entrées "Althy IA" dans la sidebar
- Sous-liens Settings dans la sidebar (1 seule entrée → `/app/settings`)
- Section abonnement dupliquée dans Settings ET `/abonnement`
- Actions irréversibles sans confirmation utilisateur
- Doublon de routes — une seule URL française par page
- Oublier le `CookieBanner` sur les pages publiques (LPD suisse)
