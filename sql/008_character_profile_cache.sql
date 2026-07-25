-- =============================================================
-- MAIN EVENT STUDIO — cache the AI character write-up so it's generated ONCE
-- and reused (re-downloading a build sheet won't re-bill the Anthropic API).
-- Run in Supabase SQL Editor. SAFE: additive only — two nullable columns on
-- studio_clients. Nothing changed or dropped.
-- =============================================================
--
-- character_profile      : the last generated profile JSON (attributes/summary/prompt).
-- character_profile_sig  : a signature of the shots it was built from. When the
--                          client's character shots change, the signature changes
--                          and the write-up regenerates; otherwise it's reused.

alter table public.studio_clients
  add column if not exists character_profile jsonb;
alter table public.studio_clients
  add column if not exists character_profile_sig text;
