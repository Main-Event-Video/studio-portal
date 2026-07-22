-- =============================================================
-- MAIN EVENT STUDIO — Montage pipeline (spine v1)
-- Run in Supabase SQL Editor (project cyykrfnltvauqqxyujln).
-- SAFE FOR SHARED PROJECT: creates ONLY a new studio_* table.
-- =============================================================

create table if not exists public.studio_montages (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.studio_clients(id) on delete cascade,
  style        text not null default 'hollywood',
  title        text,                -- "DYLAN"
  subtitle     text,                -- "A BAT MITZVAH STORY"
  status       text not null default 'queued'
                 check (status in ('queued','rendering','ready','failed')),
  render_id    text,                -- Creatomate render id
  video_url    text,                -- Creatomate temp URL (auto-deleted ~30 days)
  r2_key       text,                -- our permanent copy (set by webhook)
  error        text,
  photo_count  integer,
  watermarked  boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists studio_montages_client_idx
  on public.studio_montages (client_id, created_at desc);

-- Same RLS design as all studio_* tables: deny-by-default for browsers,
-- everything flows through server routes with the service-role client.
alter table public.studio_montages enable row level security;
grant select, insert, update, delete on public.studio_montages to service_role;

-- Verify:
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_name = 'studio_montages'
order by grantee, privilege_type;
