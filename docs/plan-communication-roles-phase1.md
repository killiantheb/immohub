# Plan de communication — Désactivation rôles secondaires (Phase 1)

> Date : 2026-04-19
> Contexte : Phase 1 du lancement Althy — seuls les rôles `proprio_solo`, `locataire` et `super_admin` sont actifs.

---

## Rôles concernés par la désactivation

| Rôle | Phase prévue | Page waitlist |
|------|-------------|---------------|
| `agence` | Phase 2 | /bientot/agence |
| `portail_proprio` | Phase 2 | /bientot/portail_proprio |
| `artisan` | Phase 3 | /bientot/artisan |
| `opener` | Phase 3 | /bientot/opener |
| `expert` | Hors phase | /bientot/expert |
| `hunter` | Hors phase | /bientot/hunter |
| `acheteur_premium` | Hors phase | /bientot/acheteur_premium |

---

## Mesures techniques mises en place

### Backend
- **Guard inscription** : `FEATURE_FLAGS_STRICT=true` + `ALLOWED_SIGNUP_ROLES` dans `config.py` — refuse les inscriptions avec un rôle non autorisé (HTTP 403).
- Message d'erreur redirige vers `/bientot/{role}`.

### Frontend — Inscription (/register)
- `ROLE_OPTIONS` filtré par `isRoleEnabled()` — seuls Propriétaire et Locataire apparaissent.
- Le lien "Je suis une agence" redirige vers `/bientot/agence` au lieu d'inscrire.

### Frontend — Dashboard (DashboardLayoutClient)
- Utilisateurs existants avec un rôle désactivé voient un écran **"Votre espace est en préparation"** avec CTA vers la Sphère IA et contact.
- Pas de redirection ni de perte de session — l'utilisateur reste connecté.

### Pages /bientot/[role]
- Page publique (pas de login requis).
- Formulaire email pour liste d'attente.
- Contenu adapté par rôle (label, icône, description).

---

## Variables d'environnement

### Production (Phase 1)
```env
# frontend/.env.production
NEXT_PUBLIC_FLAG_AGENCE=false
NEXT_PUBLIC_FLAG_PORTAIL=false
NEXT_PUBLIC_FLAG_ARTISAN=false
NEXT_PUBLIC_FLAG_OPENER=false

# backend/.env
FEATURE_FLAGS_STRICT=true
ALLOWED_SIGNUP_ROLES=["proprio_solo", "locataire", "super_admin"]
```

### Staging (tout activé pour tests)
```env
# frontend/.env.staging
NEXT_PUBLIC_FLAG_AGENCE=true
NEXT_PUBLIC_FLAG_PORTAIL=true
NEXT_PUBLIC_FLAG_ARTISAN=true
NEXT_PUBLIC_FLAG_OPENER=true

# backend/.env
FEATURE_FLAGS_STRICT=false
```

---

## Communication aux utilisateurs existants

### Utilisateurs avec rôle désactivé (artisan, opener, agence déjà inscrits)

**Email à envoyer :**

> **Objet :** Votre espace Althy arrive bientôt
>
> Bonjour {prénom},
>
> Nous travaillons activement sur votre espace **{label_rôle}** sur Althy. Vous serez parmi les premiers informés dès son lancement.
>
> En attendant, vous pouvez accéder à la **Sphère IA** pour explorer les fonctionnalités disponibles.
>
> À très vite,
> L'équipe Althy

**Canal :** Email via Resend + notification in-app via `ai_actions`.

### Nouveaux visiteurs (page /bientot)
- Collecte email via formulaire waitlist.
- Confirmation immédiate visuelle ("Inscrit !").
- TODO : implémenter le POST vers une table `waitlist` ou un service email (Resend list).

---

## Activation progressive

1. **Phase 2** (Mois 2) : Activer `NEXT_PUBLIC_FLAG_AGENCE=true` + `NEXT_PUBLIC_FLAG_PORTAIL=true`, ajouter `"agence"` et `"portail_proprio"` à `ALLOWED_SIGNUP_ROLES`.
2. **Phase 3** (Mois 3) : Activer `NEXT_PUBLIC_FLAG_ARTISAN=true` + `NEXT_PUBLIC_FLAG_OPENER=true`, ajouter `"artisan"` et `"opener"`.
3. **Phases suivantes** : Modifier les flags hardcodés dans `flags.ts` (expert, hunter, acheteur_premium).

---

## Checklist avant déploiement

- [ ] Vérifier que les env vars sont correctes sur Vercel (frontend) et Railway (backend)
- [ ] Tester l'inscription avec rôle `artisan` → doit être refusée (403)
- [ ] Tester la page /bientot/agence — visible sans login
- [ ] Tester un user existant `agence` → doit voir l'écran "en préparation"
- [ ] Vérifier que `proprio_solo` et `locataire` fonctionnent normalement
- [ ] Envoyer l'email de communication aux utilisateurs concernés
