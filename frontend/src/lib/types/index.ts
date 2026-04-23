// ─── User ───────────────────────────────────────────────────────────────────

export type UserRole =
  | "proprio_solo"
  | "agence"
  | "portail_proprio"
  | "opener"
  | "artisan"
  | "expert"
  | "hunter"
  | "locataire"
  | "acheteur_premium"
  | "super_admin";

export const ROLE_LABELS: Record<UserRole, string> = {
  proprio_solo:     "Propriétaire",
  agence:           "Agence",
  portail_proprio:  "Portail Proprio",
  opener:           "Ouvreur",
  artisan:          "Artisan",
  expert:           "Expert",
  hunter:           "Hunter",
  locataire:        "Locataire",
  acheteur_premium: "Acheteur Premium",
  super_admin:      "Admin",
};

/** Rôles legacy (DB ancienne) → rôles actuels. */
export const LEGACY_ROLE_MAP: Record<string, UserRole> = {
  owner:   "proprio_solo",
  agency:  "agence",
  tenant:  "locataire",
  company: "artisan",
};

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  adresse: string | null;
  langue: string | null;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  // banking
  iban: string | null;
  bic: string | null;
  bank_account_holder: string | null;
  // AI quota
  monthly_ai_tokens_used: number;
  // notification channels
  notif_email: boolean;
  notif_sms: boolean;
  notif_push: boolean;
  notif_inapp: boolean;
  // notification events
  notif_nouvelle_mission: boolean;
  notif_devis_accepte: boolean;
  notif_devis_refuse: boolean;
  notif_mission_urgente: boolean;
  notif_rappel_j1: boolean;
  notif_rappel_2h: boolean;
  notif_facture_impayee: boolean;
  notif_paiement_recu: boolean;
  // computed fields from backend
  full_name: string;
  permissions: string[];
  // billing / plan (optionnel — peut être absent sur les vieux comptes)
  plan_id?: string | null;
  plan_category?: "proprio" | "agence" | "invited" | "enterprise" | "autonomie" | null;
}

// ─── Bien ────────────────────────────────────────────────────────────────────
// Refonte fusion properties→biens (étape 19.1a). Aligné schemas/bien.py BienRead.
// Valeurs enum FR, rupture API property_id → bien_id sur Transaction/Contract/etc.

export type BienType =
  | "appartement"
  | "villa"
  | "studio"
  | "maison"
  | "commerce"
  | "bureau"
  | "parking"
  | "garage"
  | "cave"
  | "autre";

export type BienStatut = "loue" | "vacant" | "en_travaux";

export type ParkingType =
  | "exterieur"
  | "exterieur_couvert"
  | "interieur"
  | "interieur_box";

export type EquipementCategorie =
  | "cuisine"
  | "literie"
  | "salle_bain"
  | "tech"
  | "loisirs"
  | "entretien"
  | "confort";

export interface BienImage {
  id: string;
  bien_id: string;
  url: string;
  order: number;
  is_cover: boolean;
  created_at: string;
}

export interface BienDocument {
  id: string;
  bien_id: string;
  /** Libre côté backend (BienDocumentRead.type: str, upload doc_type: Form("autre")). */
  type: string;
  url: string;
  name: string;
  created_at: string;
}

export interface CatalogueEquipement {
  id: string;
  nom: string;
  categorie: EquipementCategorie;
  icone: string | null;
  ordre_affichage: number;
}

export interface BienEquipement {
  id: string;
  bien_id: string;
  equipement: CatalogueEquipement;
}

export interface Bien {
  // Système
  id: string;
  owner_id: string;
  agency_id: string | null;
  created_by_id: string;
  created_at: string;
  updated_at: string;

  // Localisation
  adresse: string;                      // max 300 chars
  ville: string;                        // max 100
  cp: string;                           // min 4, max 10 — pas de regex (multi-pays futur)
  canton: string | null;                // 2 lettres ISO CH

  // Identité
  building_name: string | null;
  unit_number: string | null;
  reference_number: string | null;

  // Type et statut
  type: BienType;
  statut: BienStatut;

  // Caractéristiques
  surface: number | null;
  etage: number | null;                 // négatif possible (sous-sol)
  rooms: number | null;                 // 3.5 possible (convention CH)
  bedrooms: number | null;
  bathrooms: number | null;
  annee_construction: number | null;
  annee_renovation: number | null;

  // Équipements booléens
  is_furnished: boolean;
  has_balcony: boolean;
  has_terrace: boolean;
  has_garden: boolean;
  has_storage: boolean;
  has_fireplace: boolean;
  has_laundry_private: boolean;
  has_laundry_building: boolean;
  classe_energetique: string | null;    // A–G regex côté backend

  // Parking
  parking_type: ParkingType | null;

  // Règles
  pets_allowed: boolean;
  smoking_allowed: boolean;

  // Situation et transports
  distance_gare_minutes: number | null;
  distance_arret_bus_minutes: number | null;
  distance_telecabine_minutes: number | null;
  distance_lac_minutes: number | null;
  distance_aeroport_minutes: number | null;
  situation_notes: string | null;

  // Présentation (ex-description scindée 3/3)
  description_lieu: string | null;
  description_logement: string | null;
  remarques: string | null;

  // Finances (Decimal backend → number côté TS)
  loyer: number | null;
  charges: number | null;
  deposit: number | null;
  keys_count: number | null;

  // Coordonnées Mapbox
  lat: number | null;
  lng: number | null;
}

/** Liste paginée lightweight — ajoute l'image de couverture. */
export interface BienListItem extends Bien {
  images: BienImage[];
}

/** Détail complet — images + documents + équipements. */
export interface BienDetail extends Bien {
  images: BienImage[];
  documents: BienDocument[];
  equipements: CatalogueEquipement[];
}

export interface BienFilters {
  type?: BienType;
  statut?: BienStatut;
  ville?: string;
  canton?: string;
  owner_id?: string;
  agency_id?: string;
}

export interface PaginatedBiens {
  items: BienListItem[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
}

export interface GenerateDescriptionResponse {
  description: string;
}

// ─── Contract ────────────────────────────────────────────────────────────────
// Rupture API : property_id → bien_id (schemas/contract.py).
// Contract.monthly_rent CONSERVÉ côté backend et frontend.

export type ContractType = "long_term" | "seasonal" | "short_term" | "sale";
export type ContractStatus = "draft" | "active" | "terminated" | "expired";

export interface Contract {
  id: string;
  reference: string;
  owner_id: string;
  bien_id: string;
  tenant_id: string | null;
  agency_id: string | null;
  type: ContractType;
  status: ContractStatus;
  start_date: string;
  end_date: string | null;
  monthly_rent: number | null;
  charges: number | null;
  deposit: number | null;
  signed_at: string | null;
  signed_ip: string | null;
  terminated_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaginatedContracts {
  items: Contract[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// ─── Transaction ─────────────────────────────────────────────────────────────
// Rupture API : property_id → bien_id (schemas/transaction.py).

export type TransactionType = "rent" | "commission" | "deposit" | "service" | "quote";
export type TransactionStatus = "pending" | "paid" | "late" | "cancelled";

export interface Transaction {
  id: string;
  reference: string;
  owner_id: string;
  contract_id: string | null;
  bien_id: string | null;
  tenant_id: string | null;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  commission_front_pct: number | null;
  commission_back_pct: number | null;
  commission_amount: number | null;
  due_date: string | null;
  paid_at: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface PaginatedTransactions {
  items: Transaction[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface MonthlyRevenue {
  month: string;
  amount: number;
  count: number;
}

export interface RevenueStats {
  total: number;
  paid_count: number;
  pending_count: number;
  late_count: number;
  by_month: MonthlyRevenue[];
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
// OwnerDashboard.total_properties CONSERVÉ (schemas/transaction.py L77 backend pas migré).
// recent_transactions cascade via Transaction.bien_id (corrige le bug dormant
// "clic sur transaction récente → lien cassé" confirmé étape 13).

export interface OwnerDashboard {
  revenue_current_month: number;
  revenue_prev_month: number;
  occupancy_rate: number;
  active_contracts: number;
  pending_rents: number;
  late_rents: number;
  total_properties: number;
  recent_transactions: Transaction[];
}

export interface AgencyDashboard {
  portfolio_count: number;
  active_contracts: number;
  total_revenue_ytd: number;
  commissions_ytd: number;
  pending_rents: number;
  occupancy_rate: number;
  recent_transactions: Transaction[];
}

// ─── Documents Althy (GED FR) ─────────────────────────────────────────────────
// Enum strict aligné schemas/document_althy.py DocumentTypeLiteral (10 valeurs)
// + contrainte DB enum doc_althy_type (alembic 0006 L58-60).
// Distinct de BienDocument.type qui est libre (schema bien_documents backend).

export type DocAlthyType =
  | "bail"
  | "edl_entree"
  | "edl_sortie"
  | "quittance"
  | "attestation_assurance"
  | "contrat_travail"
  | "fiche_salaire"
  | "extrait_poursuites"
  | "attestation_caution"
  | "autre";

export interface DocumentAlthy {
  id: string;
  bien_id: string | null;
  locataire_id: string | null;
  type: DocAlthyType;
  url_storage: string;
  date_document: string | null;
  genere_par_ia: boolean;
  created_at: string;
}

// ─── Opener marketplace ───────────────────────────────────────────────────────
// Note : Mission.property_id CONSERVÉ — schemas/opener.py backend non migré
// dans le sprint fusion. À aligner lors d'un sprint futur opener→bien.

export type MissionType = "visit" | "check_in" | "check_out" | "inspection" | "photography" | "other";
export type MissionStatus = "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";

export interface OpenerProfile {
  id: string;
  user_id: string;
  bio: string | null;
  radius_km: number | null;
  hourly_rate: number | null;
  latitude: number | null;
  longitude: number | null;
  skills: string[] | null;
  is_available: boolean;
  rating: number | null;
  total_missions: number;
  created_at: string;
}

export interface OpenerWithDistance extends OpenerProfile {
  distance_km: number;
}

export interface Mission {
  id: string;
  requester_id: string;
  opener_id: string | null;
  property_id: string;
  type: MissionType;
  status: MissionStatus;
  scheduled_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancelled_reason: string | null;
  property_lat: number | null;
  property_lng: number | null;
  price: number | null;
  notes: string | null;
  report_text: string | null;
  report_url: string | null;
  photos_urls: string[] | null;
  rating_given: number | null;
  rating_comment: string | null;
  stripe_payment_intent_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface PaginatedMissions {
  items: Mission[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface MissionPriceEstimate {
  mission_type: MissionType;
  distance_km: number;
  base_price: number;
  distance_surcharge: number;
  total: number;
}

// ─── Company ─────────────────────────────────────────────────────────────────

export interface Company {
  id: string;
  name: string;
  siret?: string;
  vatNumber?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  zipCode?: string;
  country: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

// ─── RFQ marketplace ─────────────────────────────────────────────────────────
// Note : RFQ.property_id CONSERVÉ — schemas/rfq.py backend non migré
// dans le sprint fusion. À aligner lors d'un sprint futur rfq→bien.

export type RFQCategory =
  | "plumbing" | "electricity" | "cleaning" | "painting" | "locksmith"
  | "roofing" | "gardening" | "masonry" | "hvac" | "renovation" | "other";

export type RFQStatus =
  | "draft" | "published" | "quotes_received" | "accepted"
  | "in_progress" | "completed" | "rated" | "cancelled";

export type RFQUrgency = "low" | "medium" | "high" | "emergency";

export interface RFQQuote {
  id: string;
  rfq_id: string;
  company_id: string;
  amount: number;
  description: string;
  delay_days: number | null;
  warranty_months: number | null;
  notes: string | null;
  status: "pending" | "accepted" | "rejected" | "completed";
  submitted_at: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface RFQ {
  id: string;
  owner_id: string;
  property_id: string | null;
  title: string;
  description: string;
  category: RFQCategory;
  ai_detected: boolean;
  status: RFQStatus;
  urgency: RFQUrgency;
  city: string | null;
  zip_code: string | null;
  budget_min: number | null;
  budget_max: number | null;
  scheduled_date: string | null;
  selected_quote_id: string | null;
  commission_amount: number | null;
  published_at: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  rating_given: number | null;
  rating_comment: string | null;
  is_active: boolean;
  created_at: string;
  quotes: RFQQuote[];
}

export interface PaginatedRFQs {
  items: RFQ[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface RFQCreate {
  title: string;
  description: string;
  category: RFQCategory;
  urgency?: RFQUrgency;
  city?: string;
  zip_code?: string;
  budget_min?: number;
  budget_max?: number;
  scheduled_date?: string;
  property_id?: string;
}

export interface AIQualifyResponse {
  category: RFQCategory;
  suggested_title: string;
  urgency: RFQUrgency;
  confidence: number;
}

export interface MarketplaceCompany {
  id: string;
  name: string;
  type: string;
  description: string | null;
  rating: number | null;
  total_jobs: number;
  city: string | null;
  zip_code: string | null;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface ApiError {
  detail: string;
  status: number;
}
