// Source de vérité unique pour les plans tarifaires Althy (v3 — pricing 2026-04-20)
// Importé dans : /app/abonnement/page.tsx · /components/landing/Tarifs.tsx

export type PlanCategory = "proprio" | "agence" | "invited" | "enterprise" | "autonomie"

export interface Plan {
  id: string
  nom: string
  prix: number
  prixAnnuel?: number
  periode: string
  description: string
  fonctionnalites: string[]
  cta: string
  note?: string
  vedette: boolean
  /** Badge spécifique : "populaire", "pour quitter son agence", etc. */
  badge?: string
  category: PlanCategory
  /** Limite de biens inclus (null = illimité) */
  maxBiens: number | null
}

// ── Propriétaire — 4 paliers payants + 1 gratuit ───────────────────────────

export const PLANS_PROPRIO: Plan[] = [
  {
    id: "gratuit",
    nom: "Gratuit",
    prix: 0,
    periode: "Pour toujours",
    description: "Testez Althy avec votre premier bien",
    fonctionnalites: [
      "1 bien sur la marketplace",
      "Fiche bien complète + documents",
      "Estimation IA gratuite",
      "Chat Althy (20 messages/mois)",
      "QR-facture loyer (basique)",
    ],
    cta: "Commencer gratuitement",
    note: "Sans carte bancaire · Sans engagement",
    vedette: false,
    category: "proprio",
    maxBiens: 1,
  },
  {
    id: "starter",
    nom: "Particulier",
    prix: 14,
    prixAnnuel: 12,
    periode: "/mois",
    description: "Propriétaire 1 à 3 biens",
    fonctionnalites: [
      "1 à 3 biens",
      "Quittances et QR-factures automatiques",
      "Relances loyers (email + WhatsApp)",
      "Chat Althy illimité",
      "Documents IA (bail, EDL, quittances)",
      "Marketplace artisans",
      "3% commission sur loyers encaissés",
    ],
    cta: "Essayer 30 jours gratuit",
    note: "CHF 12/mois si annuel · 30 jours d'essai gratuit",
    vedette: false,
    category: "proprio",
    maxBiens: 3,
  },
  {
    id: "pro",
    nom: "Actif",
    prix: 29,
    prixAnnuel: 25,
    periode: "/mois",
    description: "Propriétaire 4 à 10 biens",
    fonctionnalites: [
      "4 à 10 biens",
      "Tout Particulier inclus",
      "Rapports fiscaux annuels",
      "Sphère IA complète 24h/24",
      "Rapport mensuel automatique",
      "Comptabilité simplifiée",
      "3% commission sur loyers encaissés",
    ],
    cta: "Passer à Actif",
    note: "CHF 25/mois si annuel · 30 jours d'essai gratuit",
    vedette: true,
    badge: "Le plus populaire",
    category: "proprio",
    maxBiens: 10,
  },
  {
    id: "proprio_pro",
    nom: "Professionnel",
    prix: 79,
    prixAnnuel: 67,
    periode: "/mois",
    description: "Propriétaire 11 à 50 biens",
    fonctionnalites: [
      "11 à 50 biens",
      "Tout Actif inclus",
      "Comptabilité avancée multi-biens",
      "Tableaux de bord consolidés",
      "Export comptable (Banana, Bexio)",
      "Support prioritaire",
      "3% commission sur loyers encaissés",
    ],
    cta: "Passer à Professionnel",
    note: "CHF 67/mois si annuel · 30 jours d'essai gratuit",
    vedette: false,
    category: "proprio",
    maxBiens: 50,
  },
]

// ── Althy Autonomie — pivot stratégique pour quitter son agence ─────────────

export const PLAN_AUTONOMIE: Plan = {
  id: "autonomie",
  nom: "Althy Autonomie",
  prix: 39,
  prixAnnuel: 35,
  periode: "/mois",
  description: "Reprenez la main sur la gestion de votre bien — sans agence",
  fonctionnalites: [
    "Jusqu'à 10 biens",
    "Tout l'arsenal Althy : QR-factures, relances, contrats, EDL",
    "Sphère IA dédiée 24h/24",
    "Documents juridiques validés Suisse",
    "Réseau d'artisans et d'ouvreurs",
    "Onboarding accompagné (récupération données agence)",
    "3% commission sur loyers encaissés (vs 4-8% en agence)",
  ],
  cta: "Passer à Althy Autonomie",
  note: "Économisez ~CHF 1 600/an vs un compte invité agence",
  vedette: true,
  badge: "Pour quitter son agence",
  category: "autonomie",
  maxBiens: 10,
}

// ── Agence — 2 paliers ─────────────────────────────────────────────────────

export const PLANS_AGENCE: Plan[] = [
  {
    id: "agence",
    nom: "Agence",
    prix: 49,
    prixAnnuel: 42,
    periode: "/agent/mois",
    description: "Pour les agences immobilières",
    fonctionnalites: [
      "Biens illimités par agent",
      "Multi-agents (2–50)",
      "Sphère IA pour toute l'équipe",
      "CRM locataires et propriétaires",
      "Documents IA illimités",
      "Portail proprio inclus",
      "3% commission transparente",
    ],
    cta: "Demander une démo",
    note: "Dégressif : −10% dès 5 agents, −20% dès 10",
    vedette: true,
    badge: "Le plus populaire",
    category: "agence",
    maxBiens: null,
  },
  {
    id: "enterprise",
    nom: "Enterprise",
    prix: 1500,
    periode: "/mois",
    description: "White-label pour grandes agences et régies",
    fonctionnalites: [
      "Tout Agence inclus",
      "White-label (votre marque)",
      "API B2B données marché",
      "SSO + intégration ERP",
      "SLA 99.9% garanti",
      "Account manager dédié",
      "Conformité PPE et grandes régies",
    ],
    cta: "Contacter les ventes",
    note: "CHF 1 500 à 5 000/mois · Facturation personnalisée",
    vedette: false,
    category: "enterprise",
    maxBiens: null,
  },
]

// ── Compte invité (proprio rattaché à une agence Althy) ─────────────────────

export const PLANS_INVITED: Plan[] = [
  {
    id: "invite",
    nom: "Compte invité",
    prix: 9,
    periode: "/mois",
    description: "Compte propriétaire offert par votre agence Althy",
    fonctionnalites: [
      "Visualisation de vos biens gérés par l'agence",
      "Accès aux documents (bail, EDL, quittances)",
      "Suivi des loyers en temps réel",
      "Messagerie directe avec votre agence",
      "Mode lecture seule sur la gestion",
    ],
    cta: "Géré par votre agence",
    note: "Vous voulez reprendre la main ? Passez à Althy Autonomie pour CHF 39/mois.",
    vedette: false,
    category: "invited",
    maxBiens: null,
  },
]

// ── Export combiné (rétro-compat) ──────────────────────────────────────────

/** Tous les plans publics (proprio + autonomie + agence) — pour itération */
export const PLANS: Plan[] = [
  ...PLANS_PROPRIO,
  PLAN_AUTONOMIE,
  ...PLANS_AGENCE,
]

// ── Legacy mapping ─────────────────────────────────────────────────────────
// Anciens IDs encore en DB / Stripe → nouveau plan canonique
export const LEGACY_PLAN_MAP: Record<string, string> = {
  decouverte:     "gratuit",
  vitrine:        "gratuit",
  solo:           "starter",
  proprio:        "pro",
  agence_premium: "enterprise",
}
