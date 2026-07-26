-- =============================================================
-- MAIN EVENT STUDIO — per-client photo editor state (#new)
-- Run in Supabase SQL Editor. SAFE: additive only — one nullable JSONB column
-- on studio_clients. Nothing else is changed or dropped.
--
-- Holds the admin Photo Editor's per-photo edits for a client, keyed by the
-- media r2_key. These edits are applied to EVERY montage render for the client,
-- regardless of which style is chosen, so a client's photos are framed once and
-- reused across styles.
--
-- Shape (all fields optional; sensible defaults applied in code):
--   {
--     "photos": {
--       "<r2_key>": { "anchor": "top|center|bottom", "fit": "fill|fit",
--                     "size": 100, "removed": false }
--     },
--     "colorCorrect": false
--   }
-- =============================================================

alter table public.studio_clients
  add column if not exists photo_edits jsonb;

comment on column public.studio_clients.photo_edits is
  'Admin Photo Editor state (per-photo framing/fit/size/removed + global colorCorrect), applied to every montage render for this client.';
