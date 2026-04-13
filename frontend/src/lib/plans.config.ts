// Source de vérité unique pour les plans tarifaires Althy
// Importé dans : /app/abonnement/page.tsx · /components/landing/Tarifs.tsx

export interface Plan {
  id: string;
  nom: string;
  prix: number;
  prixAnnuel?: number;
  periode: string;
  description: string;
  fonctionnalites: string[];
  cta: string;
  note?: string;
  vedette: boolean;
}

export const PLANS: Plan[] = [
  {
    id: 'gratuit',
    nom: 'Gratuit',
    prix: 0,
    periode: 'Pour toujours',
    description: 'Publiez vos biens et gérez vos loyers',
    fonctionnalites: [
      '3 biens sur la marketplace',
      'QR-facture pour loyers',
      'Tracking loyers (manuel)',
      'Estimation IA gratuite',
      'Chat Althy basique',
    ],
    cta: 'Commencer gratuitement',
    note: 'Sans carte bancaire · Sans engagement',
    vedette: false,
  },
  {
    id: 'pro',
    nom: 'Pro',
    prix: 29,
    prixAnnuel: 23,
    periode: '/mois',
    description: 'Gestion complète avec assistant IA',
    fonctionnalites: [
      '15 biens',
      'Sphère IA complète 24h/24',
      'Relance automatique impayés',
      'Documents IA (bail, EDL, quittances) — 10/mois inclus',
      'Marketplace artisans',
      '3% commission sur loyers encaissés (transparent)',
      'Diffusion marketplace gratuite',
      'Rapport mensuel automatique',
    ],
    cta: 'Passer au Pro',
    note: "CHF 23/mois si annuel · 45% moins cher qu'une régie",
    vedette: true,
  },
  {
    id: 'agence',
    nom: 'Agence',
    prix: 29,
    periode: '/agent/mois',
    description: 'Pour les agences qui veulent un outil moderne',
    fonctionnalites: [
      'Biens illimités',
      'Multi-agents 2–50',
      "Sphère IA pour toute l'équipe",
      'Portail proprio pour vos clients (CHF 9/proprio/mois)',
      '3% commission transparente',
      'CRM locataires et propriétaires',
    ],
    cta: 'Demander une démo',
    note: 'Dégressif dès 5 agents',
    vedette: false,
  },
];
