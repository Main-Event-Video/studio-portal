-- =============================================================
-- MAIN EVENT STUDIO — Phase 1 initial schema
-- Run in Supabase SQL Editor (project cyykrfnltvauqqxyujln).
-- SAFE FOR SHARED PROJECT: touches ONLY new studio_* tables.
-- =============================================================

-- 1) TABLES ----------------------------------------------------

create table if not exists public.studio_clients (
  id            uuid primary key default gen_random_uuid(),
  display_name  text not null,                -- "The Goldbergs"
  last_name     text not null,                -- "goldberg" (password base)
  email         text not null unique,         -- username
  password_hash text not null,                -- bcrypt of lastname+MMDD
  portal_token  uuid not null unique default gen_random_uuid(),
  event_date    date not null,
  event_type    text,
  archived      boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists public.studio_media (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.studio_clients(id) on delete cascade,
  kind          text not null check (kind in ('client_upload','rough_cut','final')),
  r2_key        text not null,
  filename      text not null,
  sort_number   integer,
  size_bytes    bigint,
  content_type  text,
  watermarked   boolean not null default false,
  note          text,
  created_at    timestamptz not null default now()
);

create table if not exists public.studio_messages (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.studio_clients(id) on delete cascade,
  subject    text,
  note       text,
  sent_at    timestamptz not null default now()
);

create index if not exists studio_media_client_idx
  on public.studio_media (client_id, kind, sort_number);

-- 2) ROW LEVEL SECURITY ---------------------------------------
-- Lesson learned on MEvid: anon-key browser queries get blocked for
-- logged-out visitors. Design decision: ALL portal data flows through
-- server API routes using the SERVICE-ROLE client. So: enable RLS and
-- create NO anon/authenticated policies. Deny-by-default for browsers;
-- service_role bypasses RLS.

alter table public.studio_clients  enable row level security;
alter table public.studio_media    enable row level security;
alter table public.studio_messages enable row level security;

-- 3) GRANTS (lesson: check GRANTs, not just keys) ---------------

grant select, insert, update, delete on public.studio_clients  to service_role;
grant select, insert, update, delete on public.studio_media    to service_role;
grant select, insert, update, delete on public.studio_messages to service_role;

-- 4) VERIFY (run after; expect service_role rows for each table) -

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_name in ('studio_clients','studio_media','studio_messages')
order by table_name, grantee, privilege_type;
