-- =============================================================
-- MAIN EVENT STUDIO — non-destructive HIDE for albums (boxes) + their photos
-- Run in Supabase SQL Editor (project cyykrfnltvauqqxyujln).
-- SAFE FOR SHARED PROJECT: additive only — two nullable timestamp columns,
-- no data moved, nothing dropped. Fully reversible.
--
-- Model: "Hide album" is a soft-delete. When an album is hidden we stamp
-- hidden_at on the studio_boxes row AND on every one of its client_upload photos
-- in studio_media. Everywhere photos are listed for the timeline, the montage
-- maker, and the client portal filters `hidden_at IS NULL`, so a hidden album and
-- all its images vanish from view and from renders — but nothing is erased. Clear
-- hidden_at (Restore) and the album + photos come back exactly as they were.
-- =============================================================

-- 1) COLUMNS ---------------------------------------------------
alter table public.studio_boxes
  add column if not exists hidden_at timestamptz;

alter table public.studio_media
  add column if not exists hidden_at timestamptz;

comment on column public.studio_boxes.hidden_at is
  'When set, the album is hidden (non-destructive). Its photos are hidden too (studio_media.hidden_at). Clear to restore.';
comment on column public.studio_media.hidden_at is
  'When set, this upload is hidden from the timeline / montage maker / portal (e.g. its album was hidden). Row + R2 object are kept for recovery.';

-- 2) INDEXES (partial — only the visible rows, which every listing query hits) --
create index if not exists studio_media_visible_idx
  on public.studio_media (client_id, kind)
  where hidden_at is null;

create index if not exists studio_boxes_visible_idx
  on public.studio_boxes (client_id)
  where hidden_at is null;

-- 3) VERIFY ----------------------------------------------------
select table_name, column_name, data_type
from information_schema.columns
where table_name in ('studio_boxes', 'studio_media')
  and column_name = 'hidden_at'
order by table_name;
