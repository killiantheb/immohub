# 1. Vision Althy

> **Source de vérité unique** pour la vision macro Althy.
> Last update : 2026-04-29
> Audience : Killian, futurs investisseurs, futurs employés, Claude IA en début de session.

---

## 1.1 Le concept en 1 phrase

**Althy est l'assistant immobilier suisse qui gère la location et la vente sans agence, alimenté par l'IA. Une sphère à qui on parle. Elle comprend, agit, et demande de valider.**

Concrètement : une plateforme SaaS où un propriétaire écrit (ou dit) « relance Dupont qui n'a pas payé son loyer », et la sphère IA construit la relance, l'envoie après validation, met à jour la compta, et journalise l'action. Le propriétaire reste maître. L'IA fait le travail répétitif.

---

## 1.2 Le problème

La gestion immobilière en Suisse romande oppose aujourd'hui trois mauvais choix :

**Les régies traditionnelles** facturent 8 à 12 % du loyer. Pour un appartement à CHF 2 000/mois, ça représente CHF 2 400 à CHF 2 880 par an et par bien — opaque, lent, et le propriétaire reste loin de la décision. Le marché des régies tient parce qu'il n'y a pas vraiment d'alternative crédible.

**Les outils dédiés (Buildium, Rentila, Immopro)** sont conçus pour des gestionnaires professionnels avec 50+ biens. Interface dense, vocabulaire métier brut (« rent_amount_monthly »), workflows en 6 étapes. Un propriétaire qui gère 2-3 appartements abandonne au bout d'une heure.

**Excel + paperasse** reste le choix par défaut de 80 % des propriétaires-bailleurs autonomes. Le résultat : quittances oubliées, indexations IPC ratées, déclaration fiscale faite à l'arrache, déperdition d'énergie qui décourage la location.

Persona cible : **un grand-père qui veut gérer son appartement à Lausanne sans rien comprendre au jargon immobilier ni au monde numérique moderne.** Si lui peut utiliser Althy, n'importe qui le peut.

---

## 1.3 La proposition Althy

**Sphère IA conversationnelle.** L'utilisateur parle ou écrit en langage naturel. L'IA comprend l'intent (« demander une quittance », « lancer un changement de locataire », « comparer 3 devis plombier »), construit l'action, et la propose. L'humain valide ou corrige.

**Mot d'ordre permanent : « 1 clic ».** Toute action courante doit pouvoir être déclenchée en un clic depuis la fiche du bien ou la sphère. Si une action en demande deux, on cherche pourquoi avant de coder.

**3 modes possibles.** Althy n'impose pas un modèle unique :
- **DIY** (proprio_solo) — le propriétaire gère seul, Althy est l'assistant.
- **Délégué** (agence) — l'agence utilise Althy comme logiciel métier, le proprio voit en lecture seule via le portail.
- **Hybride** — partie locative gérée par le proprio, partie travaux/visites déléguée à des artisans/openers Althy.

**L'IA agit, l'humain valide.** Pas d'agent autonome non supervisé en Phase 1. Chaque action proposée par la sphère est explicitée (« Envoyer à Dupont la relance suivante : … ») avec un bouton « Valider » et un bouton « Modifier ». Aucune action irréversible n'est jamais prise sans confirmation explicite.

---

## 1.4 Cible primaire Phase 1

**Profil canonique** : un propriétaire-bailleur de 1 à 15 biens, en Suisse romande, qui gère lui-même (ou souhaite reprendre la main sur une régie qu'il trouve chère).

**Géographie Phase 1** : cantons VD, GE, FR, NE, JU, VS. Cantons alémaniques activés Phase 2.

**Marché potentiel adressable estimé** : ~80 000 propriétaires multi-biens autogérés en Suisse romande (sources OFL + estimations sectorielles). L'objectif Phase 1 n'est pas le volume — c'est de prouver qu'Althy fonctionne et est aimé sur 5 à 20 testeurs alpha.

**Pricing Phase 1** : CHF 29/mois ou CHF 290/an (-16 %). Détails dans [5-FINANCES.md](./5-FINANCES.md).

---

## 1.5 Les 3 acteurs pros de l'écosystème

Althy n'est pas qu'un outil pour propriétaires. À terme, c'est un écosystème où trois métiers professionnels gravitent autour de chaque bien :

**Openers** — agents de visite professionnels. Visites locataires, états des lieux entrée/sortie, check-in/check-out, remise des clés. Activés Phase 3.

**Artisans** — plombiers, électriciens, peintres, chauffagistes, serruriers. Devis comparé par IA, exécution, facturation, paiement Stripe Connect. Marketplace M1 partiellement ouverte (GE + VD), généralisation Phase 3.

**Hunters** — apporteurs de mandats. **Le rôle Hunter n'est pas réservé aux pros.** N'importe quel utilisateur Althy peut activer « mode Hunter » sur un bien pour lequel il a l'accord du propriétaire. Une agence, un proprio, un voisin, un ami — tout le monde peut apporter un mandat et être rémunéré à la conclusion. Slogan : ***« Finance ton réseau ».*** Activés Phase 3.

**En Phase 1 : seul `proprio_solo` est actif côté pros.** Les marketplaces sont masquées, les rôles secondaires verrouillés via feature flags. Les utilisateurs ayant un rôle non actif voient un écran « en préparation » avec un CTA waitlist.

---

## 1.6 8 USPs (Unique Selling Propositions)

| # | USP | Vs concurrence |
|---|---|---|
| 1 | Sphère IA conversationnelle (langage naturel) | UI complexe Buildium/Rentila |
| 2 | Pricing transparent CHF 29/mois | 8-12 % loyer caché des régies |
| 3 | Documents générés gratuits illimités (bail, quittance, EDL, relance, attestation) | Pack "documents" payant chez les concurrents |
| 4 | Compta intégrée OBLF suisse + export fiduciaire | Logiciel séparé Immopro CHF 49/mois en plus |
| 5 | Estimation IA gratuite (sans inscription) | Lead magnet acquisition + viralité |
| 6 | **Le locataire ne paie JAMAIS rien à Althy** | Frais cachés des plateformes concurrentes |
| 7 | Marketplace artisans/openers intégrée + devis comparé IA | Trois logiciels à coordonner ailleurs |
| 8 | Donnée propriétaire + IA = moat défensif (chaque mois enrichit le modèle) | Concurrence repart de zéro à chaque user |

L'USP #6 est stratégique : c'est le levier de viralité. Un locataire qui n'a rien à payer recommande Althy à son propriétaire suivant. Un endpoint qui facturerait un locataire est un bug à corriger immédiatement.

---

## 1.7 Ce qu'Althy n'est PAS

Définir ce qu'on n'est pas vaut autant que définir ce qu'on est. Les non-engagements suivants sont **figés** et n'évolueront pas sans décision explicite documentée.

- **Pas une régie.** Althy ne gère jamais à la place du propriétaire. La décision finale appartient toujours à l'humain. L'IA suggère, l'humain valide.
- **Pas une banque.** Les loyers ne transitent pas par un compte Althy en Phase 1. La QR-facture SPC 2.0 envoie le loyer directement sur l'IBAN du propriétaire. Stripe gère uniquement les abonnements (CHF 29) et, post-Phase 2, les transactions artisans via Connect (95/5).
- **Pas un courtier FINMA.** Les estimations IA sont indicatives, jamais des « conseils en placement » au sens de la LSFin. Le disclaimer apparaît systématiquement.
- **Pas Airbnb.** Althy gère la location annuelle (≥ 1 an) et saisonnière (30 jours à 1 an). La location courte (nuitée/semaine) n'est **pas** dans le scope, et ne le sera pas tant qu'aucune demande utilisateur prouvée ne le justifie.
- **Pas une app mobile native en Phase 1.** Web responsive d'abord. PWA installable plus tard. App native iOS/Android seulement si la demande le prouve (pas avant Phase 5+).

---

## 1.8 Le mot d'ordre « 1 clic »

Toute décision design — UI, schéma DB, endpoint, naming — passe un **triple test obligatoire** :

✅ **Simple pour l'utilisateur**
1 clic pour les actions courantes. Vocabulaire clair (« loyer mensuel » et pas « rent_amount_monthly »). Pas de jargon brutal. Pas de friction inutile. Le grand-père doit comprendre.

✅ **Complet pour le pro**
Aucun champ métier sacrifié, aucun écran amputé sous prétexte de simplicité. Une régie suisse qui regarde Althy doit y voir tout ce qu'elle a dans son logiciel actuel — plus l'intelligence en plus.

✅ **Lisible pour une IA agent future**
Structure sémantique forte (champs nommés explicitement, enums plutôt que strings libres). Events traçables (audit log à jour). État du bien introspectable depuis n'importe quel point du code (pas de state caché en mémoire React, tout dans la DB ou dans un cache `react-query` réhydratable).

Si une livraison échoue **un seul** des trois critères, retour à la planche à dessin. Le triple test est appliqué à chaque PR du sprint 12 et au-delà.

---

## 1.9 Stratégie cible

**Phase 1 = focus proprio_solo.**

La logique économique est claire :

| Segment | LTV (3 ans) | Churn estimé | Effort acquisition |
|---|---|---|---|
| Proprio solo | CHF 14 000 - CHF 19 000 | quasi nul | bouche-à-oreille + SEO |
| Agence (post-Phase 2) | CHF 430 000 - CHF 650 000 | possible | démos commerciales |

Une agence en accélérateur de volume (Phase 2+) apporte d'un coup des dizaines à des centaines de biens. Mais une agence qui part fait mal. Un proprio_solo qui part fait peu de mal.

**Doctrine Phase 1** : 5 à 20 proprios alpha qui aiment Althy au point de payer CHF 29/mois sans hésiter. Une fois cet acquis solide → ouverture aux agences (Phase 2) comme accélérateur.

---

## 1.10 Vision long terme

Au-delà de la location pure (Phase 1) et du lancement public (Phase 2), Althy ambitionne de devenir une plateforme immobilière complète et un hub conversationnel.

**Marketplace 3 acteurs (Phase 3)** — Openers, Artisans, Hunters tous activés. Commissions 10-15 % sur missions, devis comparé par IA, audit IA matériaux.

**Resales suisse (Phase 4)** — bascule mode vente sur le modèle Bien. Calcul fiscal par canton. Diffusion vente sur Homegate/Immoscout. Marketplace agences immo partenaires. Hunters vente avec commission 0.5 %.

**Expansion DACH + Hub IA (Phase 5+)** — activation locales it-CH (Tessin) et en (expatriés). Zurich early adopters → Munich → Berne. Hub conversationnel via WhatsApp Business API, Microsoft Graph (Outlook), Infomaniak kMail. PWA installable.

**Pistes exploratoires (non figées)** — indice Althy des loyers romands (revente données aux banques), API B2B données marché, abonnement acheteur premium. À cadrer selon les retours du marché Phase 2-3.

**Constante du temps long** : la fonction Hunter cross-produit. *« Finance ton réseau »* est un slogan qui a vocation à dépasser le seul rôle pro — c'est une mécanique virale qui colle à la culture suisse romande du réseau d'affaires.

---

## Annexes

- [2-ROADMAP.md](./2-ROADMAP.md) — Phases détaillées, sprints, gates
- [3-ARCHITECTURE.md](./3-ARCHITECTURE.md) — Stack technique, DA, intégrations
- [4-PRODUIT.md](./4-PRODUIT.md) — Spec fonctionnelle, rôles, modules
- [5-FINANCES.md](./5-FINANCES.md) — Modèle économique, pricing, projections
- [6-LEGAL.md](./6-LEGAL.md) — Entité légale, conformité nLPD/RGPD, sous-traitants
- [archive/](./archive/) — Documents historiques (sessions, sprints, BP périmé)
