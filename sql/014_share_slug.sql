-- =============================================================
-- MAIN EVENT STUDIO — 014: short share-link slugs
-- Run in Supabase SQL Editor.
-- SAFE FOR SHARED PROJECT: adds ONE nullable column to studio_media
-- and a partial unique index. No data is changed or removed.
-- Until this runs, share links keep using the (longer) signed token;
-- after it runs, delivered files get short 8-char slugs like /s/x7Kp9q42.
-- =============================================================

alter table public.studio_media
  add column if not exists share_slug text;

-- Unique only among non-null slugs (every un-shared row stays null).
create unique index if not exists studio_media_share_slug_key
  on public.studio_media (share_slug)
  where share_slug is not null;
