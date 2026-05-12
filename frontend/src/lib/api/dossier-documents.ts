/**
 * API client typed pour le Module Dossier Locataire Phase 1.0 (Sprint 1B).
 *
 * Mirror des endpoints livrés Sprint 1A + 1A.5 (2026-05-13) :
 *   - GET    /api/v1/locataires/me                                        → currentLocataire
 *   - GET    /api/v1/locataires/{id}/dossier/documents                    → listDossierDocuments
 *   - POST   /api/v1/locataires/{id}/dossier/documents                    → uploadDossierDocument (multipart)
 *   - DELETE /api/v1/dossier/documents/{doc_id}                           → deleteDossierDocument
 *   - GET    /api/v1/dossier/documents/{doc_id}/url                       → getDocumentSignedUrl
 *   - PATCH  /api/v1/dossier/documents/{doc_id}/valider                   → validateDocument
 *   - PATCH  /api/v1/dossier/documents/{doc_id}/rejeter                   → rejectDocument
 *   - PATCH  /api/v1/locataires/{id}/dossier/renseignements               → updateRenseignements
 *   - PATCH  /api/v1/locataires/{id}/dossier/loyer-caution-verses         → markLoyerCautionVerses
 *   - PATCH  /api/v1/locataires/{id}/cosignataires                        → updateCosignataires
 *
 * Types alignés sur `backend/app/schemas/document_dossier.py` +
 * `backend/app/schemas/locataire.py`.
 */

import { api } from "../api";

// ── Types miroirs Pydantic backend ────────────────────────────────────────────

export type TypeDocument =
  | "piece_identite"
  | "permis_sejour"
  | "contrat_travail"
  | "fiches_salaire"
  | "assurance_rc"
  | "caution"
  | "extrait_poursuites"
  | "bail_signe";

export type StatutDocument = "uploaded" | "valide" | "rejete";

export type TypeContrat = "cdi" | "cdd" | "independant" | "retraite" | "autre";

export type TypeCosignataire = "conjoint" | "enfant" | "autre";

// Source unique côté frontend (sync stricte avec models/document_dossier.py:TYPE_DOCUMENT_POIDS).
export const TYPE_DOCUMENT_POIDS: Record<TypeDocument, number> = {
  piece_identite:     15,
  permis_sejour:      10,
  contrat_travail:    15,
  fiches_salaire:     10,
  assurance_rc:       10,
  caution:             5,
  extrait_poursuites:  5,
  bail_signe:         10,
};

export const POIDS_RENSEIGNEMENTS = 15;
export const POIDS_LOYER_CAUTION_VERSES = 5;

// Libellés UI fr-CH (single source of truth pour les pages).
export const TYPE_DOCUMENT_LABELS: Record<TypeDocument, string> = {
  piece_identite:     "Pièce d'identité",
  permis_sejour:      "Permis de séjour",
  contrat_travail:    "Contrat de travail",
  fiches_salaire:     "3 dernières fiches de salaire",
  assurance_rc:       "Assurance Responsabilité Civile",
  caution:            "Preuve de caution",
  extrait_poursuites: "Extrait des poursuites (< 3 mois)",
  bail_signe:         "Bail signé",
};

// Types qui acceptent un équivalent textuel (cf §4.7 — promesse embauche, etc.)
export const TYPES_AVEC_EQUIVALENT: ReadonlySet<TypeDocument> = new Set<TypeDocument>([
  "contrat_travail",
  "fiches_salaire",
  "extrait_poursuites",
]);

// Types multi-fichiers (count max). Tous les autres = 1 fichier exact.
export const MAX_FICHIERS_PAR_TYPE: Partial<Record<TypeDocument, number>> = {
  fiches_salaire: 3,
};

export const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

export const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB


// ── Schemas ───────────────────────────────────────────────────────────────────

export interface DocumentDossierUserMini {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

export interface DocumentDossierRead {
  id: string;
  locataire_id: string;
  type_document: TypeDocument;
  storage_key: string;
  filename_original: string;
  mime_type: string;
  size_bytes: number;
  statut: StatutDocument;
  poids_progression: number;
  est_equivalent: boolean;
  equivalent_libelle: string | null;
  commentaire_rejet: string | null;
  uploaded_by_user_id: string;
  uploaded_by: DocumentDossierUserMini | null;
  valide_par_user_id: string | null;
  valide_par: DocumentDossierUserMini | null;
  valide_at: string | null;
  ai_score_at: string | null;
  ai_recommendation: "approve" | "review" | "reject" | null;
  ai_details: Record<string, unknown> | null;
  created_at: string;
  updated_at: string | null;
}

export interface TypeBreakdown {
  poids: number;
  poids_max: number;
  poids_acquis: number;
  count_uploaded: number;
  count_valide: number;
  count_rejete: number;
  max_fichiers: number;
}

export interface DossierMetaRead {
  id: string;
  locataire_id: string;
  employeur: string | null;
  poste: string | null;
  type_contrat: TypeContrat | null;
  salaire_net: number | null;
  anciennete: number | null;
  assureur_rc: string | null;
  numero_police: string | null;
  validite_assurance: string | null;
  resultat_poursuites: string | null;
  date_poursuites: string | null;
  office_poursuites: string | null;
  renseignements_complets: boolean;
  renseignements_completed_at: string | null;
  loyer_caution_verses: boolean;
  loyer_caution_verses_at: string | null;
  loyer_caution_verses_by: string | null;
  created_at: string;
}

export interface DossierProgressionResponse {
  progression: number;
  renseignements_complets: boolean;
  loyer_caution_verses: boolean;
  dossier: DossierMetaRead | null;
  documents: DocumentDossierRead[];
  breakdown: Record<TypeDocument, TypeBreakdown>;
}

export interface RenseignementsUpdate {
  employeur?: string;
  poste?: string;
  type_contrat?: TypeContrat;
  salaire_net?: number;
  anciennete?: number;
  assureur_rc?: string;
  numero_police?: string;
  validite_assurance?: string; // ISO yyyy-mm-dd
  resultat_poursuites?: string;
  date_poursuites?: string;
  office_poursuites?: string;
}

export interface CosignataireBase {
  type: TypeCosignataire;
  prenom: string;
  nom: string;
  date_naissance: string | null;
  signature_requise: boolean;
  lien_filial: string | null;
}

export interface LocataireMini {
  id: string;
  bien_id: string;
  user_id: string | null;
  date_entree: string | null;
  date_sortie: string | null;
  loyer: number | null;
  charges: number | null;
  depot_garantie: number | null;
  statut: "actif" | "sorti";
  cosignataires: CosignataireBase[];
  created_at: string;
}

export interface SignedUrlResponse {
  url: string;
  expires_at: string;
}


// ── Endpoints ─────────────────────────────────────────────────────────────────

export async function getMyLocataire(): Promise<LocataireMini> {
  const { data } = await api.get<LocataireMini>("/locataires/me");
  return data;
}

export async function listDossierDocuments(
  locataireId: string,
): Promise<DossierProgressionResponse> {
  const { data } = await api.get<DossierProgressionResponse>(
    `/locataires/${locataireId}/dossier/documents`,
  );
  return data;
}

export async function uploadDossierDocument(
  locataireId: string,
  payload: {
    file: File;
    type_document: TypeDocument;
    est_equivalent?: boolean;
    equivalent_libelle?: string;
  },
): Promise<DocumentDossierRead> {
  // Validation côté client AVANT l'envoi pour UX rapide. Le backend re-valide
  // (defense in depth + CHECK constraints DB).
  if (!ALLOWED_MIME_TYPES.has(payload.file.type)) {
    throw new Error("Format non supporté (PDF, JPG, PNG uniquement)");
  }
  if (payload.file.size > MAX_SIZE_BYTES) {
    throw new Error("Fichier trop volumineux (max 10 MB)");
  }

  const form = new FormData();
  form.append("file", payload.file);
  form.append("type_document", payload.type_document);
  if (payload.est_equivalent !== undefined) {
    form.append("est_equivalent", String(payload.est_equivalent));
  }
  if (payload.equivalent_libelle) {
    form.append("equivalent_libelle", payload.equivalent_libelle);
  }

  const { data } = await api.post<DocumentDossierRead>(
    `/locataires/${locataireId}/dossier/documents`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

export async function deleteDossierDocument(documentId: string): Promise<void> {
  await api.delete(`/dossier/documents/${documentId}`);
}

export async function getDocumentSignedUrl(documentId: string): Promise<SignedUrlResponse> {
  const { data } = await api.get<SignedUrlResponse>(
    `/dossier/documents/${documentId}/url`,
  );
  return data;
}

export async function validateDocument(documentId: string): Promise<DocumentDossierRead> {
  const { data } = await api.patch<DocumentDossierRead>(
    `/dossier/documents/${documentId}/valider`,
  );
  return data;
}

export async function rejectDocument(
  documentId: string,
  commentaire_rejet: string,
): Promise<DocumentDossierRead> {
  const { data } = await api.patch<DocumentDossierRead>(
    `/dossier/documents/${documentId}/rejeter`,
    { commentaire_rejet },
  );
  return data;
}

export async function updateRenseignements(
  locataireId: string,
  payload: RenseignementsUpdate,
): Promise<DossierMetaRead> {
  const { data } = await api.patch<DossierMetaRead>(
    `/locataires/${locataireId}/dossier/renseignements`,
    payload,
  );
  return data;
}

export async function markLoyerCautionVerses(
  locataireId: string,
  body?: { loyer_montant?: number; caution_montant?: number },
): Promise<DossierMetaRead> {
  const { data } = await api.patch<DossierMetaRead>(
    `/locataires/${locataireId}/dossier/loyer-caution-verses`,
    body ?? {},
  );
  return data;
}

export async function updateCosignataires(
  locataireId: string,
  cosignataires: CosignataireBase[],
): Promise<LocataireMini> {
  const { data } = await api.patch<LocataireMini>(
    `/locataires/${locataireId}/cosignataires`,
    { cosignataires },
  );
  return data;
}
