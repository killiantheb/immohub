"use client";

/**
 * API wrappers — Module Proposition de dates locataire (Sprint 4B).
 *
 * Endpoints backend : backend/app/routers/proposition.py.
 *
 * Workflow back-and-forth bailleur ↔ locataire plafonné à 4 tours :
 *   non_propose → propose_par_locataire → accepte / contre_propose_par_bailleur
 *                                           ↓
 *                                       refuse  or accepte / propose_par_locataire
 */

import { api } from "../api";

// ── Types ────────────────────────────────────────────────────────────────────

export type DureeEnvisagee = "court" | "moyen" | "long" | "indetermine";
export type StatutProposition =
  | "non_propose"
  | "propose_par_locataire"
  | "contre_propose_par_bailleur"
  | "accepte"
  | "refuse";
export type LastProposedBy = "locataire" | "bailleur";
export type AnimauxPreference = "oui" | "non" | "sous_conditions";
export type FlexibiliteDate = "rigide" | "plus_moins_1_semaine" | "plus_moins_1_mois";
export type MeublePreference = "meuble" | "non_meuble" | "indifferent";

export interface PreferencesLocataire {
  animaux?: AnimauxPreference | null;
  flexibilite_date?: FlexibiliteDate | null;
  colocation?: boolean | null;
  meuble?: MeublePreference | null;
}

export interface PropositionStatusResponse {
  locataire_id: string;
  statut_proposition: StatutProposition;
  proposition_count: number;

  date_entree_souhaitee: string | null;
  duree_envisagee: DureeEnvisagee | null;
  preferences: PreferencesLocataire;
  commentaire_locataire: string | null;

  date_contre_proposee_bailleur: string | null;
  commentaire_bailleur: string | null;

  motif_refus: string | null;
  date_accord: string | null;

  last_proposed_at: string | null;
  last_proposed_by: LastProposedBy | null;

  // Computed flags (UI affiche / masque les CTA en fonction)
  peut_proposer: boolean;
  peut_contre_proposer: boolean;
  peut_accepter_locataire: boolean;
  peut_accepter_bailleur: boolean;
  peut_re_contre_proposer: boolean;
  peut_refuser: boolean;
  peut_reset: boolean;
  limite_atteinte: boolean;
}

export interface ProposerDatesRequest {
  date_entree_souhaitee: string; // ISO date YYYY-MM-DD
  duree_envisagee?: DureeEnvisagee | null;
  preferences?: PreferencesLocataire;
  commentaire?: string | null;
}

export interface ContrePropositionBailleurRequest {
  date_contre_proposee: string;
  commentaire?: string | null;
}

export interface ReContrePropositionLocataireRequest {
  date_entree_souhaitee: string;
  commentaire?: string | null;
}

export interface RefuserPropositionRequest {
  motif_refus?: string | null;
}

// ── Labels (FR) ──────────────────────────────────────────────────────────────

export const DUREE_LABELS: Record<DureeEnvisagee, string> = {
  court: "Court terme (moins de 6 mois)",
  moyen: "Moyen terme (6 à 12 mois)",
  long: "Long terme (plus d'un an)",
  indetermine: "Durée indéterminée",
};

export const ANIMAUX_LABELS: Record<AnimauxPreference, string> = {
  oui: "Oui",
  non: "Non",
  sous_conditions: "Sous conditions",
};

export const FLEXIBILITE_LABELS: Record<FlexibiliteDate, string> = {
  rigide: "Date stricte",
  plus_moins_1_semaine: "± 1 semaine",
  plus_moins_1_mois: "± 1 mois",
};

export const MEUBLE_LABELS: Record<MeublePreference, string> = {
  meuble: "Meublé",
  non_meuble: "Non meublé",
  indifferent: "Indifférent",
};

export const MAX_PROPOSITIONS = 4;

// ── API calls ────────────────────────────────────────────────────────────────

export async function getProposition(
  locataireId: string,
): Promise<PropositionStatusResponse> {
  const { data } = await api.get<PropositionStatusResponse>(
    `/locataires/${locataireId}/proposition`,
  );
  return data;
}

export async function proposerDates(
  locataireId: string,
  payload: ProposerDatesRequest,
): Promise<PropositionStatusResponse> {
  const { data } = await api.post<PropositionStatusResponse>(
    `/locataires/${locataireId}/proposition/proposer`,
    payload,
  );
  return data;
}

export async function contreProposerBailleur(
  locataireId: string,
  payload: ContrePropositionBailleurRequest,
): Promise<PropositionStatusResponse> {
  const { data } = await api.post<PropositionStatusResponse>(
    `/locataires/${locataireId}/proposition/contre-proposer`,
    payload,
  );
  return data;
}

export async function accepterBailleur(
  locataireId: string,
): Promise<PropositionStatusResponse> {
  const { data } = await api.post<PropositionStatusResponse>(
    `/locataires/${locataireId}/proposition/accepter-bailleur`,
    {},
  );
  return data;
}

export async function accepterLocataire(
  locataireId: string,
): Promise<PropositionStatusResponse> {
  const { data } = await api.post<PropositionStatusResponse>(
    `/locataires/${locataireId}/proposition/accepter-locataire`,
    {},
  );
  return data;
}

export async function reContreProposerLocataire(
  locataireId: string,
  payload: ReContrePropositionLocataireRequest,
): Promise<PropositionStatusResponse> {
  const { data } = await api.post<PropositionStatusResponse>(
    `/locataires/${locataireId}/proposition/re-contre-proposer`,
    payload,
  );
  return data;
}

export async function refuserProposition(
  locataireId: string,
  payload: RefuserPropositionRequest,
): Promise<PropositionStatusResponse> {
  const { data } = await api.post<PropositionStatusResponse>(
    `/locataires/${locataireId}/proposition/refuser`,
    payload,
  );
  return data;
}

export async function resetProposition(
  locataireId: string,
): Promise<PropositionStatusResponse> {
  const { data } = await api.post<PropositionStatusResponse>(
    `/locataires/${locataireId}/proposition/reset`,
    {},
  );
  return data;
}
