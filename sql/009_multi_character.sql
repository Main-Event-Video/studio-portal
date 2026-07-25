-- =============================================================
-- MAIN EVENT STUDIO — multiple named characters per client (#9)
-- Run in Supabase SQL Editor. SAFE FOR SHARED PROJECT: additive only.
--   * creates ONE new table (studio_characters)
--   * backfills one row per client that already has a character build
--   * does NOT alter or drop any existing column, and does NOT move any photo.
--
-- Model: each character's 12 guided shots stay in studio_media exactly where
-- they are. The EXISTING single character keeps folder_path='__character_build__'
-- and becomes that client's first character. Additional characters store their
-- shots under folder_path='__character_build__::<character id>'. The per-character
-- name + AI write-up cache live on studio_characters (moved off studio_clients;
-- the old columns stay as harmless legacy).
-- =============================================================

create table if not exists public.studio_characters (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.studio_clients(id) on delete cascade,
  name text,
  folder_path text not null,
  position int not null default 0,
  done_at timestamptz,
  character_profile jsonb,
  character_profile_sig text,
  created_at timestamptz not null default now()
);

create index if not exists studio_characters_client_idx
  on public.studio_characters (client_id, position, created_at);

-- A client can't have two character rows pointing at the same shot folder.
create unique index if not exists studio_characters_client_folder_idx
  on public.studio_characters (client_id, folder_path);

-- Backfill (idempotent): every client that already has a character build — i.e.
-- has shots in the legacy '__character_build__' folder, or a saved character
-- name/profile — gets exactly one legacy character row pointing at that folder,
-- carrying its existing name + cached write-up. Re-running inserts nothing new.
insert into public.studio_characters (client_id, name, folder_path, position, character_profile, character_profile_sig)
select c.id,
       nullif(btrim(coalesce(c.character_name, c.display_name)), ''),
       '__character_build__',
       0,
       c.character_profile,
       c.character_profile_sig
from public.studio_clients c
where (
        exists (
          select 1 from public.studio_media m
          where m.client_id = c.id
            and m.folder_path = '__character_build__'
        )
        or c.character_profile is not null
        or nullif(btrim(coalesce(c.character_name, '')), '') is not null
      )
  and not exists (
        select 1 from public.studio_characters sc
        where sc.client_id = c.id
          and sc.folder_path = '__character_build__'
      );
