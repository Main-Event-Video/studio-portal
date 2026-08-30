-- =============================================================
-- MAIN EVENT STUDIO — target AI program per character (#12)
-- Records which AI tool the studio is building each character for
-- (OpenArt / Higgsfield / Midjourney / LoRA), chosen in the admin
-- "Character builds" panel and stamped on the exported sheet.
-- Additive + nullable; SAFE FOR SHARED PROJECT and safe to re-run.
-- =============================================================
alter table public.studio_characters
  add column if not exists program text;
