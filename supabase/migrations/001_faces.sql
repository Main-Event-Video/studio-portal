-- Main Event Studio — face data for Glass accent crops.
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- WHAT IT IS FOR. The Glass montage style puts narrow accent panes down the
-- sides of the main photograph. A narrow pane showing a picture is showing a
-- TIGHT crop of it, and a tight crop aimed at nothing in particular once
-- isolated a child's torso. So an accent crop is now anchored on the midpoint
-- between a detected pair of eyes, and a pane that cannot reach a face becomes
-- plain glass instead. This column holds the eyes.
--
-- SHAPE. A JSON array, most confident face first, everything normalised 0..1 so
-- it does not depend on the photo's pixel size:
--   [{"x":0.31,"y":0.12,"w":0.18,"h":0.24,"ex":0.40,"ey":0.20,"score":0.94,"source":"yunet"}]
-- ex/ey is the eye midpoint — the anchor. An EMPTY array is a real answer
-- ("no face here"), and the renderer turns every accent pane on that photo into
-- plain glass. NULL means "not looked at yet".
--
-- Written by .github/workflows/face-detect.yml. Nothing in the app writes it.

alter table studio_media add column if not exists faces jsonb;
alter table studio_media add column if not exists faces_at timestamptz;

-- The detection job's only query: client uploads that are images and have not
-- been looked at yet, newest first. A partial index keeps that cheap as the
-- library grows, because the rows already done drop out of the index entirely.
create index if not exists studio_media_faces_pending
  on studio_media (created_at desc)
  where faces is null and kind = 'client_upload';

comment on column studio_media.faces is
  'Detected faces, normalised 0..1, most confident first. ex/ey is the eye midpoint used to anchor Glass accent crops. [] means none found (panes become plain glass); NULL means not yet processed.';
comment on column studio_media.faces_at is
  'When face detection last ran on this row.';
