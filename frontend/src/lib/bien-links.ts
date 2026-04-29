/**
 * Mini-lib de liens pour la fiche bien.
 *
 * Phase 1 : retourne les liens vers les sous-pages /app/biens/[id]/X
 * Phase 2-3 : retournera les liens vers les modules globaux filtrés
 *             /app/X?bien_id=xxx
 *
 * La transition Phase 2-3 = modifier UNIQUEMENT ce fichier.
 * Aucun composant à modifier.
 *
 * Référence : docs/3-ARCHITECTURE.md §3.11 (architecture cible Phase 2-3).
 */

export const bienLinks = {
  /** Détail du locataire actuel du bien */
  locataire: (bienId: string) => `/app/biens/${bienId}/locataire`,

  /** Vue finances détaillée du bien */
  finances: (bienId: string) => `/app/biens/${bienId}/finances`,

  /** Vue documents du bien */
  documents: (bienId: string) => `/app/biens/${bienId}/documents`,

  /** Vue interventions du bien */
  interventions: (bienId: string) => `/app/biens/${bienId}/interventions`,

  /** Historique du bien (anciens locataires + audit) */
  historique: (bienId: string) => `/app/biens/${bienId}/historique`,

  /** Estimation IA détaillée du bien (7 blocs) */
  potentiel: (bienId: string) => `/app/biens/${bienId}/potentiel`,

  /** Cycle de changement de locataire */
  changement: (bienId: string) => `/app/biens/${bienId}/changement`,

  /** Détail d'un ancien locataire d'un bien */
  historiqueLocataire: (bienId: string, locataireId: string) =>
    `/app/biens/${bienId}/historique/${locataireId}`,
} as const;

/**
 * TODO Phase 2-3 — remplacer les retours par les modules globaux filtrés :
 *
 *   locataire:    (bienId) => `/app/locataires?bien_id=${bienId}`
 *   finances:     (bienId) => `/app/finances?bien_id=${bienId}`
 *   documents:    (bienId) => `/app/documents?bien_id=${bienId}`
 *   interventions:(bienId) => `/app/interventions?bien_id=${bienId}`
 *
 * Aucun composant consommateur ne sera à toucher : seul ce fichier.
 */
