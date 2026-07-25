-- =============================================================
-- MAIN EVENT STUDIO — soft-delete for character builds (#4, scoped)
-- Run in Supabase SQL Editor. SAFE: additive only — one nullable timestamp on
-- studio_characters. A "deleted" character is HIDDEN from the roster but nothing
-- is actually removed: the row stays and the photos stay in R2, so it is fully
-- recoverable (clear deleted_at to restore).
-- =============================================================

alter table public.studio_characters
  add column if not exists deleted_at timestamptz;

comment on column public.studio_characters.deleted_at is
  'When set, the character build is soft-deleted (hidden from the client roster). Row + R2 photos are kept for recovery.';
