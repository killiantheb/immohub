export type Urgence = "haute" | "normale" | "info";

export interface SphereAction {
  id:          string;
  type?:       string;
  titre?:      string;
  description?: string;
  urgence?:    Urgence;
  cta_principal?:  string;
  cta_secondaire?: string;
  payload?:    Record<string, unknown>;
  acteur_id?:  string;
  acteur_nom?: string;
}

export interface SphereBriefing {
  salutation:  string;
  resume:      string;
  actions:     SphereAction[];
  pending_count: number;
}

export interface OcrResult {
  montant:       number | null;
  date_iso:      string | null;
  fournisseur:   string | null;
  description:   string | null;
  numero_facture: string | null;
  type:          "gros_entretien" | "menu_entretien" | "autre";
  affectation:   "proprio" | "locataire";
}

export interface UserProfile {
  id:        string;
  email:     string;
  prenom:    string | null;
  nom:       string | null;
  role:      string;
  photo_url: string | null;
}
