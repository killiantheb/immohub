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
    id: 'decouverte',
    nom: 'Découverte',
    prix: 0,
    periode: 'Gratuit 14 jours',
    description: 'Découvrez Althy sans engagement',
    fonctionnalites: [
      '2 biens',
      'Documents IA illimités',
      'Bail, EDL, quittances',
      '1 utilisateur',
      'Support email',
    ],
    cta: 'Commencer gratuitement',
    note: 'Sans carte bancaire',
    vedette: false,
  },
  {
    id: 'proprio',
    nom: 'Propriétaire',
    prix: 29,
    prixAnnuel: 23,
    periode: '/mois',
    description: 'Pour les propriétaires qui gèrent seuls',
    fonctionnalites: [
      '15 biens',
      'Documents IA illimités',
      'Sphère IA 24h/24',
      'Marketplace artisans et ouvreurs',
      '4% sur paiements reçus (transparent)',
      'Annonces portails (tarif portail direct)',
      'Rapport mensuel automatique',
    ],
    cta: 'Choisir Propriétaire',
    note: 'CHF 23/mois si annuel',
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
      'Sphère IA pour toute l\'équipe',
      'Portail proprio pour vos clients (CHF 9/mois)',
      '4% transparent',
      'Comptabilité PPE',
    ],
    cta: 'Démo agence',
    note: 'Dégressif dès 5 agents',
    vedette: false,
  },
  {
    id: 'expert',
    nom: 'Expert Pro',
    prix: 19,
    periode: '/mois',
    description: 'Pour les professionnels du secteur',
    fonctionnalites: [
      'Profil vérifié et noté',
      'Accès aux missions Althy',
      'Facturation automatique',
      'Badge Expert Althy',
    ],
    cta: 'Devenir Expert',
    note: 'Profil de base gratuit',
    vedette: false,
  },
];
