-- 0036_artisan_marketplace.sql
-- Activation marketplace artisans (M1 du pricing 2026-04-20).
-- Ajoute les colonnes : subscription_plan, is_founding_member, canton, specialties.
-- Les 50 premiers artisans par canton deviennent fondateurs (gratuit à vie).

-- ── ALTER profiles_artisans ──────────────────────────────────────────────────

alter table profiles_artisans
  add column if not exists subscription_plan   text,
  add column if not exists is_founding_member  boolean not null default false,
  add column if not exists canton              text,
  add column if not exists specialties         text[] default '{}'::text[],
  add column if not exists stripe_connect_id   text,
  add column if not exists stripe_connect_ready boolean not null default false,
  add column if not exists subscription_activated_at timestamptz;

-- Check subscription_plan cohérence (laisse null = pas encore choisi)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_artisans_plan_check'
  ) then
    alter table profiles_artisans
      add constraint profiles_artisans_plan_check
      check (subscription_plan is null or subscription_plan in (
        'artisan_free_early', 'artisan_verified'
      ));
  end if;
end$$;

-- Check canton cohérence (26 cantons CH)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_artisans_canton_check'
  ) then
    alter table profiles_artisans
      add constraint profiles_artisans_canton_check
      check (canton is null or canton in (
        'GE','VD','VS','NE','FR','JU','BE','ZH','BS','BL','AG','AR','AI',
        'GL','GR','LU','NW','OW','SG','SH','SO','SZ','TG','TI','UR','ZG'
      ));
  end if;
end$$;

create index if not exists idx_profiles_artisans_canton
  on profiles_artisans (canton);
create index if not exists idx_profiles_artisans_plan
  on profiles_artisans (subscription_plan);
create index if not exists idx_profiles_artisans_founding
  on profiles_artisans (is_founding_member) where is_founding_member;
create index if not exists idx_profiles_artisans_specialties
  on profiles_artisans using gin (specialties);

comment on column profiles_artisans.subscription_plan is
  'Plan artisan actif : artisan_free_early (fondateur 50/canton) ou artisan_verified (CHF 49/mois)';
comment on column profiles_artisans.is_founding_member is
  'Fondateur = figé à la souscription. Ne jamais écraser après coup.';
comment on column profiles_artisans.canton is
  'Canton suisse (2 lettres) — déterminant pour matching RFQ + compteur founding';
comment on column profiles_artisans.specialties is
  'Spécialités (ex: plomberie, electricite, peinture) — matching par overlap avec rfq.metier';

-- ── Fonction : compteur fondateurs par canton ────────────────────────────────
-- Lecture uniquement ; retourne le nombre de fondateurs actifs pour un canton.
-- Utilisée côté backend au moment du POST /artisan/subscribe pour décider
-- si l'artisan peut entrer en plan artisan_free_early.

create or replace function count_founding_artisans_by_canton(p_canton text)
returns integer
language sql
stable
as $$
  select count(*)::int
  from profiles_artisans
  where canton = p_canton
    and is_founding_member = true
    and subscription_plan = 'artisan_free_early';
$$;

comment on function count_founding_artisans_by_canton(text) is
  'Retourne le nombre de fondateurs actifs dans un canton — plafonné à 50 côté backend';

-- ── Vue : places fondateurs restantes par canton ─────────────────────────────

create or replace view founding_artisans_spots_remaining as
select
  c.canton,
  50 as total_spots,
  coalesce(count(pa.*), 0)::int as taken,
  greatest(0, 50 - coalesce(count(pa.*), 0))::int as remaining
from (
  values ('GE'),('VD'),('VS'),('NE'),('FR'),('JU'),('BE'),('ZH'),('BS'),('BL'),
         ('AG'),('AR'),('AI'),('GL'),('GR'),('LU'),('NW'),('OW'),('SG'),('SH'),
         ('SO'),('SZ'),('TG'),('TI'),('UR'),('ZG')
) as c(canton)
left join profiles_artisans pa
  on pa.canton = c.canton
  and pa.is_founding_member = true
  and pa.subscription_plan = 'artisan_free_early'
group by c.canton;

comment on view founding_artisans_spots_remaining is
  'Places fondateurs restantes par canton (lecture publique via backend)';

-- ── RLS : profiles_artisans est déjà protégée (migration précédente).
-- On ne touche pas aux policies existantes.
