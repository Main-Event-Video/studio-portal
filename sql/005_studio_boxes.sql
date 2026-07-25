-- =============================================================
-- MAIN EVENT STUDIO — client "boxes" (folders) that persist even when EMPTY
-- Run in Supabase SQL Editor (project cyykrfnltvauqqxyujln).
-- SAFE FOR SHARED PROJECT: additive only — creates ONE new studio_* table.
-- Lets a client set up empty boxes ahead of time and fill them later.
-- =============================================================

-- 1) TABLE -----------------------------------------------------
-- A box is just a named folder for a client. Photos still reference a box by
-- studio_media.folder_path = the box name; this table lets a box exist with
-- zero photos and carry a top-to-bottom position.
create table if not exists public.studio_boxes (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.studio_clients(id) on delete cascade,
  name       text not null,
  position   int  not null default 0,        -- order among boxes
  created_at timestamptz not null default now(),
  unique (client_id, name)                    -- one box per name per client
);

create index if not exists studio_boxes_client_idx on public.studio_boxes (client_id);

-- 2) ROW LEVEL SECURITY ---------------------------------------
-- Same design as the other studio_* tables: enable RLS, create NO anon/
-- authenticated policies. All access flows through server routes using the
-- SERVICE-ROLE client, which bypasses RLS.
alter table public.studio_boxes enable row level security;

-- 3) GRANTS ----------------------------------------------------
grant select, insert, update, delete on public.studio_boxes to service_role;

-- 4) VERIFY ----------------------------------------------------
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_name = 'studio_boxes'
order by grantee, privilege_type;
