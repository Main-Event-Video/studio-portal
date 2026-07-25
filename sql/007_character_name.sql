-- =============================================================
-- MAIN EVENT STUDIO — subject / character name for the Character Build sheet
-- Run in Supabase SQL Editor. SAFE FOR SHARED PROJECT: additive only — adds ONE
-- nullable column to studio_clients. Nothing is changed or dropped.
-- =============================================================
--
-- WHY: the project's "display_name" (e.g. "The Goldbergs") isn't always the name
-- of the person in the character shots. This holds the subject/character name to
-- print on the build sheet. NULL/blank → the sheet falls back to display_name.

alter table public.studio_clients
  add column if not exists character_name text;

comment on column public.studio_clients.character_name is
  'Subject/character name printed on the Character Build sheet. NULL → fall back to display_name.';
