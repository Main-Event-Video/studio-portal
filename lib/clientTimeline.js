// Server-side: load a client's uploads + albums and return them in the ONE
// canonical timeline play order (via buildTimeline). Used by the montage render
// route AND the admin framing strip so the two never drift — and both match the
// order the client sees in the portal timeline.
import { buildTimeline } from '@/lib/timelineOrder';

// Load a client's uploads, tolerant of the timeline_pos column not existing yet
// (sql/006 not run) — falls back to the base columns so a render never breaks.
async function loadClientMedia(db, clientId) {
  const base = 'id, r2_key, filename, content_type, folder_path, sort_number, created_at';
  let { data, error } = await db.from('studio_media').select(`${base}, timeline_pos`).eq('client_id', clientId).eq('kind', 'client_upload');
  if (error) {
    ({ data, error } = await db.from('studio_media').select(base).eq('client_id', clientId).eq('kind', 'client_upload'));
  }
  return { data, error };
}

// db: service-role Supabase client. Returns { media } (ordered) or { error }.
// imagesOnly:true drops videos from the returned list (the montage spine is
// photos-only for now) while KEEPING their timeline slot's effect on order.
export async function orderedClientMedia(db, clientId, { imagesOnly = false } = {}) {
  const { data: media, error } = await loadClientMedia(db, clientId);
  if (error) return { error };

  // Albums (studio_boxes). Non-fatal if the table isn't there yet (pre-005):
  // buildTimeline just treats it as no pre-made albums.
  let boxes = [];
  const { data: boxRows } = await db
    .from('studio_boxes')
    .select('name, position, created_at')
    .eq('client_id', clientId);
  if (Array.isArray(boxRows)) boxes = boxRows;

  const { flat } = buildTimeline(media || [], boxes);
  const ordered = imagesOnly ? flat.filter((m) => (m.content_type || '').startsWith('image/')) : flat;
  return { media: ordered };
}

// Full timeline INCLUDING videos, in play order — used by the montage render to
// interleave green-screen placeholders at each video's slot. Returns { items }.
export async function orderedClientTimeline(db, clientId) {
  const { data: media, error } = await loadClientMedia(db, clientId);
  if (error) return { error };

  let boxes = [];
  const { data: boxRows } = await db
    .from('studio_boxes')
    .select('name, position, created_at')
    .eq('client_id', clientId);
  if (Array.isArray(boxRows)) boxes = boxRows;

  const { flat } = buildTimeline(media || [], boxes);
  return { items: flat };
}
