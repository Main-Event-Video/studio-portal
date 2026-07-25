-- =============================================================
-- MAIN EVENT STUDIO — timeline top-level order for LOOSE media
-- Run in Supabase SQL Editor (project cyykrfnltvauqqxyujln), AFTER 005.
-- SAFE FOR SHARED PROJECT: additive only — adds ONE nullable column to the
-- existing studio_media table. No data is changed; nothing is dropped.
-- =============================================================
--
-- WHY: the client portal now has a single left-to-right "timeline" where loose
-- photos/videos and albums can be arranged in ANY order relative to each other
-- (a photo, then an album, then two photos, then another album…). To let an
-- album sit BETWEEN two loose photos we need loose media and albums to share
-- one ordering scale:
--
--   • album top-level rank ....... studio_boxes.position   (added in 005)
--   • loose media top-level rank .. studio_media.timeline_pos   (THIS migration)
--
-- Both are integers on the same 1..N sequence, renumbered whenever the client
-- rearranges. studio_media.sort_number keeps its existing job: the order of
-- photos INSIDE an album (and the "number from the filename" on upload).
--
-- BACKWARD COMPATIBLE: timeline_pos starts NULL for every existing row. While
-- it is NULL for all of a client's loose media, the app falls back to the old
-- default order (loose photos first, then albums), so existing renders are
-- unchanged until a client actually uses the new timeline.

-- 1) COLUMN ----------------------------------------------------
alter table public.studio_media
  add column if not exists timeline_pos int;   -- NULL = not yet placed on the timeline

comment on column public.studio_media.timeline_pos is
  'Top-level play order of a LOOSE media item (folder_path IS NULL) on the client timeline. Shares one 1..N scale with studio_boxes.position so albums can interleave with loose photos. NULL = not yet arranged.';

-- 2) VERIFY ----------------------------------------------------
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'studio_media' and column_name = 'timeline_pos';
