-- 015_import_seq.sql
-- Permanent per-photo IMPORT NUMBER (001, 002, 003 …) for client uploads.
-- A stable reference id that never changes when a photo is reordered or moved.
--
-- Just adds the column. The app (lib/importSeq.js) lazily assigns a number to
-- every upload that doesn't have one yet — in import (created_at) order,
-- continuing from the current max — and persists it, so existing photos get
-- numbered automatically on the next load and keep that number forever.
--
-- Safe to run more than once.

alter table studio_media add column if not exists import_seq integer;

-- Optional: seed existing rows now (the app does this lazily too, but running
-- it here numbers everyone immediately). Per client, in import order.
with ranked as (
  select id,
         row_number() over (partition by client_id order by created_at asc, id asc) as rn
  from studio_media
  where kind = 'client_upload'
)
update studio_media m
set import_seq = r.rn
from ranked r
where m.id = r.id
  and m.import_seq is null;
