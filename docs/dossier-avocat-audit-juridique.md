# Dossier de briefing avocat — Audit juridique Althy

**Objet :** Audit juridique de la plateforme Althy avant lancement commercial
**Durée prévue :** 2 heures
**Date :** [ ___ / ___ / 2026 ]
**Domaines de compétence requis :** Droit numérique suisse, droit immobilier, nLPD

---

## 1. Présentation d'Althy

Althy est une plateforme SaaS suisse destinée principalement aux propriétaires immobiliers qui gèrent leurs biens sans agence. L'outil centralise la gestion locative : baux, quittances, QR-factures (SPC 2.0), relances de loyers impayés, dossiers locataires, interventions artisans et communication avec les locataires. Un module d'intelligence artificielle (basé sur Anthropic Claude) assiste l'utilisateur : rédaction de documents, estimation immobilière, briefing quotidien et suggestions d'actions. L'outil est accessible via le web (althy.ch) et une application mobile. Le siège est à Genève. Le modèle de revenus combine des abonnements mensuels (CHF 0 / 29 / 29 par agent) et des commissions de 4% sur les loyers réconciliés via QR-facture. L'infrastructure est hébergée aux USA (Vercel, Railway) avec la base de données en EU (Supabase, Frankfurt). La plateforme est en phase de pré-lancement avec ~130 biens gérés (agence du fondateur).

---

## 2. Entités juridiques concernées

| Rubrique | État actuel | Remarque |
|----------|-------------|----------|
| **Raison sociale** | Althy Sàrl (en cours de constitution) | _[ Killian : compléter si constitution effectuée ]_ |
| **Forme juridique** | Sàrl prévue | _[ Killian : confirmer Sàrl vs raison individuelle ]_ |
| **N IDE** | En cours d'attribution | _[ Killian : compléter CHE-xxx.xxx.xxx si obtenu ]_ |
| **RC** | Inscription en cours (RC Genève) | _[ Killian : confirmer ]_ |
| **Siège social** | Genève, Suisse | |
| **Contact** | contact@althy.ch / privacy@althy.ch | |

### Incohérence constatée dans le code

Le frontend (CGU, mentions légales, politique de confidentialité) utilise **"Althy Sàrl"**. Cependant, le backend utilise **"Althy SA"** dans 3 endroits :

| Fichier | Occurrence |
|---------|-----------|
| `backend/app/core/config.py:104` | `ALTHY_CREDITOR_NAME: str = "Althy SA"` |
| `backend/app/services/qr_facture.py:207` | Pied de page des QR-factures PDF |
| `backend/app/services/quittance.py:103` | Pied de page des quittances PDF |

**Risque juridique :** Si l'entité est une Sàrl, les documents officiels (QR-factures, quittances) portent un nom de société erroné. Question pour l'avocat : implications LCD art. 3 et validité des documents.

---

## 3. Questions pour l'avocat

### A. nLPD 2023 (RS 235.1)

1. **Responsable du traitement** — Qui est le responsable au sens de l'art. 5 let. j nLPD ? La Sàrl (une fois constituée) ou le fondateur en tant que personne physique pendant la phase de pré-lancement ?

2. **Conseiller DPD** — Un conseiller à la protection des données (art. 10 nLPD) est-il obligatoire ou recommandé pour notre taille et notre activité (plateforme SaaS, ~130 biens, données locataires) ?

3. **Registre des activités de traitement** — Nous n'avons pas de registre formel au sens de l'art. 12 nLPD. Est-ce obligatoire pour une entreprise de notre taille ? Quels sont les traitements qui devraient y figurer en priorité ?

4. **Sous-traitants étrangers** — La politique de confidentialité liste les sous-traitants suivants avec des SCCs. Les garanties sont-elles suffisantes au regard de l'art. 16 nLPD pour les transferts vers les USA ?

   | Sous-traitant | Pays | Données traitées |
   |--------------|------|------------------|
   | Supabase Inc. | USA (infra EU Frankfurt) | Toutes les données (DB, auth) |
   | Vercel Inc. | USA | Logs d'accès, code frontend |
   | Railway Corp. | USA | Logs d'application, API backend |
   | Stripe Inc. | USA | Données de paiement (abonnements) |
   | Anthropic PBC | USA | Questions/réponses IA (anonymisées) |
   | Resend Inc. | USA | Emails transactionnels |
   | Twilio Inc. | USA | SMS, WhatsApp (n de tel, contenu) |
   | Mapbox Inc. | USA | Géolocalisation (pas de données personnelles) |
   | PostHog Inc. | USA/EU | Analytics comportementales (opt-in) |

5. **IA et données personnelles** — L'IA (Anthropic Claude) traite des contextes contenant potentiellement des noms de locataires, montants de loyers, adresses. La politique indique que "les noms propres, adresses et données financières sont remplacés par des pseudonymes" avant envoi. Est-ce suffisant ? Faut-il une AIPD (analyse d'impact) pour ce traitement ?

6. **Base légale des traitements** — La politique actuelle mentionne le RGPD (art. 6.1.a) pour le consentement cookies/analytics. Faut-il réécrire en se fondant sur la nLPD (et non le RGPD) vu que la société est suisse et cible un public suisse ? Ou maintenir les deux cadres ?

7. **Droit d'accès / portabilité** — Nos CGU mentionnent-elles correctement les droits des personnes concernées (art. 25-27 nLPD) ? Le délai de réponse de 30 jours est-il correct ?

8. **Durées de conservation** — La politique indique 10 ans pour les données financières (obligation fiscale CH) et "durée du compte + 2 ans" pour le reste. Est-ce conforme ?

### B. LCD (RS 241) et dénomination

9. **Forme juridique dans le nom** — Si l'entité est une Sàrl, l'utilisation de "SA" dans les documents générés (QR-factures, quittances) constitue-t-elle une violation de l'art. 3 al. 1 let. b LCD (indications trompeuses sur soi-même) ?

10. **Slogans et promesses** — Le site utilise les formulations suivantes. Sont-elles conformes à la LCD ?
    - "Votre bien, géré sans agence." (H1 principal)
    - "Propriétaire, sans charge mentale." (sous-titre)
    - "130 biens gérés" (statistique — il s'agit des biens de l'agence du fondateur)
    - "2 847 estimations réalisées" (section estimation — est-ce vérifiable ?)
    - "Patrick M. — Propriétaire à Lausanne, 130 biens gérés" (témoignage)

11. **Preuves sociales** — Les témoignages affichés doivent-ils être sourcés, datés, et vérifiables ? Le fait que "Patrick M." gère 130 biens (= l'agence du fondateur) doit-il être explicité ?

### C. Gestion locative (CO art. 253ss, 412ss)

12. **Frais de dossier locataire (CHF 90)** — Althy prélève CHF 90 au locataire retenu ("frais de dossier"). Ce prélèvement est-il compatible avec l'art. 254 CO (pas de frais pour la conclusion du bail) ? Faut-il qualifier Althy de courtier (art. 412+ CO) ?

13. **Quittances générées par IA** — Qui porte la responsabilité juridique en cas d'erreur dans une quittance générée par la plateforme (montant erroné, mauvaises coordonnées bancaires sur la QR-facture) ? Le propriétaire, Althy, ou les deux solidairement ?

14. **QR-factures et obligations légales** — La génération de QR-factures SPC 2.0 pour le compte de tiers implique-t-elle des obligations spécifiques (accord avec la banque du créancier, conformité SIX) ?

15. **Hébergement de dossiers locataires** — La plateforme stocke des copies de pièces d'identité, fiches de salaire, extraits de poursuites et attestations d'assurance RC des locataires. Y a-t-il des obligations spécifiques au-delà de la nLPD (ex. devoir de destruction, durée max de conservation, chiffrement exigé) ?

16. **État des lieux (EDL)** — Un EDL généré par IA et signé électroniquement a-t-il la même valeur juridique qu'un EDL papier signé manuellement ?

### D. Estimation IA et responsabilité (LSFin RS 954.1)

17. **Qualification juridique** — L'estimation immobilière automatisée proposée gratuitement (sans inscription) constitue-t-elle un "conseil en placement" ou un "service financier" au sens de l'art. 3 LSFin ?

18. **Responsabilité en cas de décision basée sur l'estimation** — Si un utilisateur achète/vend un bien en se fondant sur l'estimation IA d'Althy, quelle est notre exposition juridique ?

19. **Disclaimer actuel** — Le disclaimer IA actuel stipule : _"Ce document est fourni à titre indicatif et de facilitation uniquement. Il ne constitue pas un conseil juridique, fiscal ou professionnel. L'utilisateur est seul responsable de sa validation et de son utilisation."_ Est-ce suffisant pour exclure la responsabilité ?

### E. Communications WhatsApp et SMS

20. **Consentement explicite** — L'envoi de messages WhatsApp automatisés aux locataires (relances de loyers, notifications) nécessite-t-il un consentement explicite distinct de l'acceptation des CGU ? Quid si c'est le propriétaire qui déclenche l'envoi vers son locataire ?

21. **LCD et démarchage** — Y a-t-il des règles suisses spécifiques sur les messages automatisés par messagerie instantanée (WhatsApp) et SMS ? Faut-il un opt-out dans chaque message ?

22. **Twilio et numéro d'expéditeur** — Les messages sont envoyés via Twilio depuis un numéro enregistré. Faut-il que ce numéro soit identifiable comme appartenant à Althy (ou au propriétaire) ?

### F. Modèle de rémunération et trafic des paiements

23. **Commission de 4% sur loyers** — Le modèle prévoit une commission de 4% prélevée sur les loyers réconciliés via QR-facture. Les loyers transitent-ils par un compte Althy ? Si oui, cela constitue-t-il une activité de services de paiement soumise à la LSFin/LIMF ?

24. **Inscription FINMA** — Devons-nous être enregistrés comme prestataire de services de paiement auprès de la FINMA si les loyers transitent par nos comptes ?

25. **Stripe Connect** — Les commissions sur services artisans/ouvreurs (4-15%) passent par Stripe Connect. Stripe agit-il comme établissement de paiement réglementé, ce qui nous exonère ?

26. **Commission hunter (0.5% du prix de vente)** — Ce modèle de rémunération est-il assimilable à du courtage immobilier soumis à autorisation ?

---

## 4. Documents a apporter au rendez-vous

### Documents societe
- [ ] Extrait du Registre du Commerce (ou preuve de la demande d'inscription)
- [ ] Statuts de la Sàrl (projet ou version signée)
- [ ] Clause fondateur (accès gratuit agence fondateur)

### Documents juridiques en ligne
- [ ] CGU actuelles — imprimer depuis althy.ch/legal/cgu
- [ ] Politique de confidentialite — imprimer depuis althy.ch/legal/confidentialite
- [ ] Disclaimer IA — imprimer depuis althy.ch/legal/disclaimer-ia
- [ ] Mentions legales — imprimer depuis althy.ch/legal
- [ ] Politique cookies — imprimer depuis althy.ch/legal/cookies

### Captures d'ecran
- [ ] Page d'accueil (hero + H1 + statistiques)
- [ ] Formulaire d'inscription (sélection de rôle)
- [ ] Section témoignages et chiffres
- [ ] Section estimation IA (formulaire + résultat)
- [ ] Dashboard propriétaire (vue d'ensemble)

### Exemples de documents generes
- [ ] Exemple de quittance PDF générée (noter le pied de page "Althy SA")
- [ ] Exemple de QR-facture SPC 2.0 générée (noter le pied de page "Althy SA")
- [ ] Exemple d'estimation IA (résultat affiché)
- [ ] Exemple de bail généré par IA (si disponible)
- [ ] Exemple d'état des lieux généré

### Liste des sous-traitants
- [ ] Tableau des 9 sous-traitants (cf. section 3.A ci-dessus) avec pays, données, et lien vers leurs DPA/SCCs respectifs

### Informations techniques
- [ ] Schéma simplifié de l'architecture (frontend Vercel -> backend Railway -> DB Supabase Frankfurt -> IA Anthropic)
- [ ] Flux de données du loyer : locataire -> QR-facture -> banque créancier -> réconciliation CAMT.054 -> Althy

---

## 5. Output attendu du rendez-vous

### 5.1 Matrice de risques

Demander a l'avocat de classifier chaque point en :

| Urgence | Definition | Action |
|---------|-----------|--------|
| **CRITIQUE** | Risque de sanction, nullité de documents ou responsabilité directe | Corriger avant le lancement commercial |
| **IMPORTANT** | Non-conformité partielle, risque modéré | Corriger dans les 3 mois |
| **SOUHAITABLE** | Bonne pratique, pas d'obligation immédiate | Planifier pour Phase 2-3 |

### 5.2 Actions correctives immediates attendues (3-5)

Exemples probables (a confirmer par l'avocat) :
1. Corriger "Althy SA" -> "Althy Sàrl" dans tous les documents générés (backend)
2. Créer un registre des activités de traitement (art. 12 nLPD)
3. Vérifier la qualification juridique des frais de dossier CHF 90
4. Clarifier le flux des loyers et l'éventuelle obligation FINMA
5. Mettre a jour les CGU pour référencer la nLPD (pas seulement le RGPD)

### 5.3 Devis pour corrections approfondies

Demander un devis séparé pour :
- [ ] Réécriture complète des CGU (nLPD + CO + LCD)
- [ ] Rédaction du registre des activités de traitement
- [ ] Analyse d'impact relative a la protection des données (AIPD) pour le module IA
- [ ] Revue des contrats sous-traitants (DPA avec Supabase, Anthropic, Stripe, Twilio)
- [ ] Avis juridique formel sur le modèle de commission 4% loyers (qualification FINMA)

---

## Annexe : incohérences relevées dans le code

| Probleme | Localisation | Severite |
|----------|-------------|----------|
| "Althy SA" au lieu de "Althy Sàrl" | `backend/app/core/config.py:104`, `services/qr_facture.py:207`, `services/quittance.py:103` | CRITIQUE |
| "2 847 estimations réalisées" (non vérifié dynamiquement) | `frontend/src/components/landing/LandingEstimation.tsx:119` | IMPORTANT (LCD) |
| "Patrick M. — 130 biens" (= fondateur, non explicité) | `frontend/src/components/landing/LandingPreuve.tsx:37` | IMPORTANT (LCD) |
| Politique de confidentialité réf. RGPD art. 6.1.a, pas nLPD | `frontend/src/app/legal/confidentialite/page.tsx:84` | IMPORTANT |
| "en cours de constitution" encore affiché | `frontend/src/app/legal/page.tsx:29,36` | A mettre a jour des que RC obtenu |

---

_Document préparé le 19 avril 2026 — a compléter par Killian avant envoi a l'avocat._
