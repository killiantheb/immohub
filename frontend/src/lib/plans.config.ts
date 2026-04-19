// Source de vérité unique pour les plans tarifaires Althy
// Importé dans : /app/abonnement/page.tsx · /components/landing/Tarifs.tsx

export type PlanCategory = "proprio" | "agence"

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
  category: PlanCategory
  /** Limite de biens inclus (null = illimité) */
  maxBiens: number | null
}

// ── Propriétaire solo — 3 paliers ──────────────────────────────────────────

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
    nom: "Starter",
    prix: 14,
    prixAnnuel: 11,
    periode: "/mois",
    description: "Gestion complète de votre bien",
    fonctionnalites: [
      "1 bien — fonctions complètes",
      "Quittances et QR-factures automatiques",
      "Relances loyers (email + WhatsApp)",
      "Chat Althy illimité",
      "Documents IA (bail, EDL, quittances)",
      "Marketplace artisans",
      "3% commission sur loyers encaissés",
    ],
    cta: "Essayer 30 jours gratuit",
    note: "CHF 11/mois si annuel · 30 jours d'essai gratuit",
    vedette: true,
    category: "proprio",
    maxBiens: 1,
  },
  {
    id: "pro",
    nom: "Pro",
    prix: 29,
    prixAnnuel: 23,
    periode: "/mois",
    description: "Multi-biens avec rapports fiscaux",
    fonctionnalites: [
      "2 à 5 biens",
      "Tout Starter inclus",
      "Rapports fiscaux annuels",
      "Sphère IA complète 24h/24",
      "Rapport mensuel automatique",
      "Comptabilité simplifiée",
      "3% commission sur loyers encaissés",
    ],
    cta: "Passer au Pro",
    note: "CHF 23/mois si annuel · 30 jours d'essai gratuit",
    vedette: false,
    category: "proprio",
    maxBiens: 5,
  },
]

// ── Agence — 2 paliers ─────────────────────────────────────────────────────

export const PLANS_AGENCE: Plan[] = [
  {
    id: "agence",
    nom: "Agence Standard",
    prix: 79,
    prixAnnuel: 63,
    periode: "/agent/mois",
    description: "Pour les agences jusqu'à 30 biens",
    fonctionnalites: [
      "Jusqu'à 30 biens par agent",
      "Multi-agents (2–50)",
      "Sphère IA pour toute l'équipe",
      "CRM locataires et propriétaires",
      "Documents IA illimités",
      "3% commission transparente",
    ],
    cta: "Demander une démo",
    note: "Dégressif : −10% dès 5 agents, −20% dès 10",
    vedette: true,
    category: "agence",
    maxBiens: 30,
  },
  {
    id: "agence_premium",
    nom: "Agence Premium",
    prix: 129,
    prixAnnuel: 103,
    periode: "/agent/mois",
    description: "Biens illimités + portail propriétaire",
    fonctionnalites: [
      "Biens illimités (+ CHF 9/bien au-delà de 30)",
      "Tout Standard inclus",
      "Portail proprio pour vos clients",
      "API B2B données marché",
      "Comptabilité avancée (PPE)",
      "Support prioritaire",
    ],
    cta: "Contacter les ventes",
    note: "Facturation personnalisée possible",
    vedette: false,
    category: "agence",
    maxBiens: null,
  },
]

// ── Export combiné (rétro-compat) ──────────────────────────────────────────

/** Tous les plans (proprio + agence) — pour itération rapide */
export const PLANS: Plan[] = [...PLANS_PROPRIO, ...PLANS_AGENCE]

// ── Legacy mapping ─────────────────────────────────────────────────────────
// Anciens IDs encore en DB / Stripe → nouveau plan
export const LEGACY_PLAN_MAP: Record<string, string> = {
  decouverte: "gratuit",
  vitrine:    "gratuit",
  solo:       "starter",
  proprio:    "pro",
}
