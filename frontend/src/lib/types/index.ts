// ─── User ───────────────────────────────────────────────────────────────────

export type UserRole =
  | "super_admin"
  | "agency"
  | "owner"
  | "tenant"
  | "opener"
  | "company";

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  // banking
  iban: string | null;
  bic: string | null;
  bank_account_holder: string | null;
  // AI quota
  monthly_ai_tokens_used: number;
  // computed fields from backend
  full_name: string;
  permissions: string[];
}

// ─── Property ────────────────────────────────────────────────────────────────

export type PropertyType =
  | "apartment"
  | "villa"
  | "parking"
  | "garage"
  | "box"
  | "cave"
  | "depot"
  | "office"
  | "commercial"
  | "hotel";

export type PropertyStatus = "available" | "rented" | "for_sale" | "sold" | "maintenance";

export type DocumentType =
  | "lease"
  | "inventory"
  | "insurance"
  | "notice"
  | "deed"
  | "diagnosis"
  | "other";

export interface PropertyImage {
  id: string;
  url: string;
  order: number;
  is_cover: boolean;
  created_at: string;
}

export interface PropertyDocument {
  id: string;
  type: DocumentType;
  url: string;
  name: string;
  created_at: string;
}

export interface Property {
  id: string;
  owner_id: string;
  agency_id: string | null;
  created_by_id: string;
  type: PropertyType;
  status: PropertyStatus;
  address: string;
  city: string;
  zip_code: string;
  country: string;
  surface: number | null;
  rooms: number | null;
  floor: number | null;
  description: string | null;
  monthly_rent: number | null;
  charges: number | null;
  deposit: number | null;
  price_sale: number | null;
  is_furnished: boolean;
  has_parking: boolean;
  pets_allowed: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // detail only
  images?: PropertyImage[];
  documents?: PropertyDocument[];
}

export interface PropertyFilters {
  type?: PropertyType;
  status?: PropertyStatus;
  city?: string;
  owner_id?: string;
  agency_id?: string;
}

export interface PaginatedProperties {
  items: Property[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// ─── Contract ────────────────────────────────────────────────────────────────

export type ContractType = "long_term" | "seasonal" | "short_term" | "sale";
export type ContractStatus = "draft" | "active" | "terminated" | "expired";

export interface Contract {
  id: string;
  reference: string;
  owner_id: string;
  property_id: string;
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

export type TransactionType = "rent" | "commission" | "deposit" | "service" | "quote";
export type TransactionStatus = "pending" | "paid" | "late" | "cancelled";

export interface Transaction {
  id: string;
  reference: string;
  owner_id: string;
  contract_id: string | null;
  property_id: string | null;
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

// ─── Opener marketplace ───────────────────────────────────────────────────────

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

// Legacy camelCase interface kept for backwards-compat with company module
export interface Opener {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  companyId?: string;
  commissionRate?: number;
  totalCommissions?: number;
  activeContracts?: number;
  createdAt: string;
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
