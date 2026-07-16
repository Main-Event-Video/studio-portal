-- =============================================================
-- MAIN EVENT STUDIO — Phase 1 completion: client intake
-- Run in Supabase SQL Editor (project cyykrfnltvauqqxyujln).
-- SAFE FOR SHARED PROJECT: touches ONLY a NEW studio_* table.
-- Additive only — creates studio_intake. Does not alter existing tables.
-- =============================================================

-- 1) TABLE -----------------------------------------------------
-- One intake per client (unique client_id) so the form can be
-- saved and re-edited via upsert. Identity fields (email, event
-- date) live on studio_clients; here we store the client's own
-- SUBMITTED snapshot so Josh sees exactly what they typed, without
-- ever mutating the login username on studio_clients.

create table if not exists public.studio_intake (
  id                       uuid primary key default gen_random_uuid(),
  client_id                uuid not null unique
                             references public.studio_clients(id) on delete cascade,

  -- who / contact
  first_name               text,
  last_name                text,
  main_contact_name        text,          -- "Main Contact's Name (if different)"
  event_date               date,          -- their estimate; snapshot, not authoritative
  contact_number           text,
  contact_number_type      text,          -- Home | Cell | Work
  email                    text,          -- snapshot; login email stays on studio_clients
  news_signup              boolean not null default false,
  preferred_contact_method text,          -- Phone | Text | Email
  preferred_language       text,          -- English | Spanish | Other
  preferred_language_other text,

  -- event
  venue                    text,
  honoree_names            text,
  age_milestone            text,
  has_logo                 boolean,        -- Yes | No | (unanswered = null)
  event_description        text,
  vibe                     jsonb not null default '[]'::jsonb,  -- ["Elegant","FUN",...]
  color_palette            text,
  inspiration_links        text,
  songs                    text,
  must_include             text,
  avoid_content            text,
  hobbies                  text,
  favorite_media           text,          -- shows / movies / brands
  favorite_quotes          text,
  anything_else            text,

  submitted_at             timestamptz,   -- set on first real submit
  updated_at               timestamptz not null default now(),
  created_at               timestamptz not null default now()
);

create index if not exists studio_intake_client_idx
  on public.studio_intake (client_id);

-- 2) ROW LEVEL SECURITY ---------------------------------------
-- Same design as studio_* tables: enable RLS, create NO anon/
-- authenticated policies. All access flows through server routes
-- using the SERVICE-ROLE client, which bypasses RLS.

alter table public.studio_intake enable row level security;

-- 3) GRANTS ----------------------------------------------------

grant select, insert, update, delete on public.studio_intake to service_role;

-- 4) VERIFY ----------------------------------------------------

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_name = 'studio_intake'
order by grantee, privilege_type;
