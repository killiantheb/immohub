-- 0034_waitlist.sql
-- Waitlist : collecte des emails depuis /bientot/[role]
-- Rôles Phase 2/3 non encore ouverts à l'inscription (artisan, ouvreur, expert, hunter…)

create table if not exists waitlist (
  id                uuid primary key default gen_random_uuid(),
  email             text not null,
  role              text not null check (role in (
    'artisan','ouvreur','expert','hunter','acheteur_premium',
    'agence','portail_proprio','other'
  )),
  source            text default 'bientot_page',
  metadata          jsonb default '{}'::jsonb,
  created_at        timestamptz default now(),
  notified_at       timestamptz,
  converted_user_id uuid references profiles(id) on delete set null
);

create unique index if not exists idx_waitlist_email_role on waitlist (lower(email), role);
create index if not exists idx_waitlist_role on waitlist (role);
create index if not exists idx_waitlist_created on waitlist (created_at desc);

-- RLS : lecture et insertion contrôlées par le backend (service key)
alter table waitlist enable row level security;

-- Anon/authenticated n'ont aucun droit direct — tout passe par le backend.
-- Les admins consultent via l'endpoint backend qui utilise la service key.
drop policy if exists waitlist_no_direct_access on waitlist;
create policy waitlist_no_direct_access on waitlist
  for all
  using (false)
  with check (false);

comment on table waitlist is 'Collecte des emails depuis /bientot/[role] — géré via /api/v1/waitlist';
