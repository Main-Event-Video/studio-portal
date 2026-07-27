// Server-side: load a client's uploads + albums and return them in the ONE
// canonical timeline play order (via buildTimeline). Used by the montage render
// route AND the admin framing strip so the two never drift — and both match the
// order the client sees in the portal timeline.
import { buildTimeline } from '@/lib/timelineOrder';

// Load a client's uploads, tolerant of newer columns not existing yet
// (hidden_at → sql/013, timeline_pos → sql/006) — falls back so a render never
// breaks. The HIDDEN filter drops soft-hidden albums/photos so they can never
// reach a render or the timeline.
async function loadClientMedia(db, clientId) {
  const base = 'id, r2_key, filename, content_type, folder_path, sort_number, created_at';
  const q = () => db.from('studio_media').select(`${base}, timeline_pos`).eq('client_id', clientId).eq('kind', 'client_upload');
  let { data, error } = await q().is('hidden_at', null);
  if (error) ({ data, error } = await q());
  if (error) ({ data, error } = await db.from('studio_media').select(base).eq('client_id', clientId).eq('kind', 'client_upload'));
  return { data, error };
}

// A client's albums with hidden ones excluded (graceful pre-migration fallback).
async function loadClientBoxes(db, clientId) {
  let { data } = await db.from('studio_boxes').select('name, position, created_at').eq('client_id', clientId).is('hidden_at', null);
  if (!Array.isArray(data)) ({ data } = await db.from('studio_boxes').select('name, position, created_at').eq('client_id', clientId));
  return Array.isArray(data) ? data : [];
}

// db: service-role Supabase client. Returns { media } (ordered) or { error }.
// imagesOnly:true drops videos from the returned list (the montage spine is
// photos-only for now) while KEEPING their timeline slot's effect on order.
export async function orderedClientMedia(db, clientId, { imagesOnly = false } = {}) {
  const { data: media, error } = await loadClientMedia(db, clientId);
  if (error) return { error };

  // Albums (studio_boxes), hidden ones excluded. Non-fatal if the table isn't
  // there yet (pre-005): buildTimeline just treats it as no pre-made albums.
  const boxes = await loadClientBoxes(db, clientId);

  const { flat } = buildTimeline(media || [], boxes);
  const ordered = imagesOnly ? flat.filter((m) => (m.content_type || '').startsWith('image/')) : flat;
  return { media: ordered };
}

// Full timeline INCLUDING videos, in play order — used by the montage render to
// interleave green-screen placeholders at each video's slot. Returns { items }.
export async function orderedClientTimeline(db, clientId) {
  const { data: media, error } = await loadClientMedia(db, clientId);
  if (error) return { error };

  const boxes = await loadClientBoxes(db, clientId);

  const { flat } = buildTimeline(media || [], boxes);
  return { items: flat };
}
