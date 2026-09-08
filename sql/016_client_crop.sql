-- Client-side photo crop (2026-09-08).
--
-- Josh's rule: KEEP THE ORIGINAL. The client's crop is written to a SEPARATE R2
-- object and the row points at it, so nothing they uploaded is ever overwritten
-- and 'uncrop' is instant — it just forgets the pointer.
--
--   crop_key   the r2 key of the cropped derivative (null = not cropped)
--   crop_rect  {x,y,w,h,ratio} as fractions of the ORIGINAL, so the editor can
--              reopen on the whole photo with their box where they left it
--
-- Both are nullable and every read path falls back when they are absent, so the
-- app keeps working if this has not been run yet.
alter table studio_media add column if not exists crop_key text;
alter table studio_media add column if not exists crop_rect jsonb;
