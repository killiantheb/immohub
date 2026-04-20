-- 0035_partnerships.sql
-- Partenariats Althy : 6 verticales (insurance, caution, mortgage, moving, energy, telecom).
-- Logique 3-phases : affiliation → exclusive_with_minimum → strategic.
-- RLS fermée : tout passe par le backend (service key + require_roles super_admin).

-- ── partners ──────────────────────────────────────────────────────────────────

create table if not exists partners (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  vertical            text not null check (vertical in (
    'insurance','caution','mortgage','moving','energy','telecom','other'
  )),
  country             text default 'CH',
  region              text,                       -- NULL = national
  website             text,
  api_base_url        text,
  api_key_encrypted   text,                       -- chiffré côté backend (SECRET_KEY)
  status              text default 'active' check (status in ('active','paused','terminated')),
  contact_person      text,
  contact_email       text,
  contract_start_date date,
  contract_end_date   date,
  exclusivity_region  text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists idx_partners_vertical     on partners (vertical);
create index if not exists idx_partners_status       on partners (status);
create index if not exists idx_partners_region       on partners (region);

comment on table partners is 'Partenaires commerciaux Althy — 6 verticales (assurance, caution, hypothèque, déménagement, énergie, telecom)';
comment on column partners.api_key_encrypted is 'Clé API chiffrée avec SECRET_KEY backend — ne jamais exposer';
comment on column partners.exclusivity_region is 'Région d''exclusivité commerciale (ex: "GE", "VD", "CH-FR") — informatif';

-- ── partner_deals ─────────────────────────────────────────────────────────────

create table if not exists partner_deals (
  id                        uuid primary key default gen_random_uuid(),
  partner_id                uuid not null references partners(id) on delete cascade,
  deal_type                 text not null check (deal_type in (
    'affiliation','exclusive_with_minimum','strategic','revenue_share'
  )),
  min_monthly_guarantee     decimal(10,2) default 0,
  per_contract_commission   decimal(10,2),
  per_lead_commission       decimal(10,2),
  revenue_share_percentage  decimal(5,2),
  start_date                date not null,
  end_date                  date,
  status                    text default 'active' check (status in ('active','paused','terminated')),
  notes                     text,
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

create index if not exists idx_partner_deals_partner  on partner_deals (partner_id);
create index if not exists idx_partner_deals_status   on partner_deals (status);
create index if not exists idx_partner_deals_period   on partner_deals (start_date, end_date);

comment on table partner_deals is 'Contrats commerciaux par partenaire — phases affiliation → exclusive → strategic';

-- ── partner_leads ─────────────────────────────────────────────────────────────

create table if not exists partner_leads (
  id                  uuid primary key default gen_random_uuid(),
  partner_id          uuid not null references partners(id) on delete restrict,
  user_id             uuid references profiles(id) on delete set null,
  vertical            text not null,
  lead_data           jsonb default '{}'::jsonb,
  status              text default 'sent' check (status in (
    'sent','qualified','signed','rejected','expired'
  )),
  sent_at             timestamptz default now(),
  qualified_at        timestamptz,
  signed_at           timestamptz,
  commission_amount   decimal(10,2),
  commission_paid_at  timestamptz,
  external_reference  text,                -- ID chez le partenaire (si retour API)
  consent_id          uuid references consents(id) on delete set null,  -- preuve RGPD
  notes               text,
  created_at          timestamptz default now()
);

create index if not exists idx_partner_leads_partner  on partner_leads (partner_id);
create index if not exists idx_partner_leads_user     on partner_leads (user_id);
create index if not exists idx_partner_leads_vertical on partner_leads (vertical);
create index if not exists idx_partner_leads_status   on partner_leads (status);
create index if not exists idx_partner_leads_sent_at  on partner_leads (sent_at desc);

comment on table partner_leads is 'Leads envoyés aux partenaires. RGPD : consent_id obligatoire à la création';
comment on column partner_leads.lead_data is 'Payload transmis au partenaire (anonymisable à la demande RGPD)';
comment on column partner_leads.consent_id is 'Référence au consentement explicite (table consents) — preuve RGPD';

-- ── partner_commissions ──────────────────────────────────────────────────────
-- Regroupement mensuel facturé par Althy au partenaire.

create table if not exists partner_commissions (
  id                         uuid primary key default gen_random_uuid(),
  partner_id                 uuid not null references partners(id) on delete restrict,
  period_start               date not null,
  period_end                 date not null,
  total_leads                integer default 0,
  total_signed               integer default 0,
  minimum_guarantee_amount   decimal(10,2),
  variable_commission_amount decimal(10,2),
  total_amount               decimal(10,2),
  invoice_sent_at            timestamptz,
  paid_at                    timestamptz,
  notes                      text,
  created_at                 timestamptz default now(),
  updated_at                 timestamptz default now()
);

create unique index if not exists idx_partner_commissions_unique
  on partner_commissions (partner_id, period_start, period_end);
create index if not exists idx_partner_commissions_period
  on partner_commissions (period_start desc);

comment on table partner_commissions is 'Période mensuelle facturée au partenaire — max(minimum_garanti, commissions variables)';

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Toutes les opérations passent par le backend (service key + require_roles super_admin).

alter table partners            enable row level security;
alter table partner_deals       enable row level security;
alter table partner_leads       enable row level security;
alter table partner_commissions enable row level security;

drop policy if exists partners_no_direct_access            on partners;
drop policy if exists partner_deals_no_direct_access       on partner_deals;
drop policy if exists partner_leads_no_direct_access       on partner_leads;
drop policy if exists partner_commissions_no_direct_access on partner_commissions;

create policy partners_no_direct_access on partners
  for all using (false) with check (false);
create policy partner_deals_no_direct_access on partner_deals
  for all using (false) with check (false);
create policy partner_leads_no_direct_access on partner_leads
  for all using (false) with check (false);
create policy partner_commissions_no_direct_access on partner_commissions
  for all using (false) with check (false);

-- ── Extension RGPD : nouveaux consent_types ───────────────────────────────────
-- On utilise la table `consents` existante (006_consents.sql). Les types valides
-- pour partenaires — à enregistrer via record_consent() avant tout envoi :
--   partner_insurance  | partner_caution | partner_mortgage
--   partner_moving     | partner_energy  | partner_telecom
--
-- La colonne consent_type est un VARCHAR(30) libre — aucun ALTER nécessaire.
-- Le backend refuse d'insérer un partner_leads sans consent_id actif.
