// Photo borders: one shared definition of what a border is and which one wins.
//
// A border can be set in two places — on an ALBUM (every photo in it) and on a
// SINGLE photo. Josh's rule is "the most recent choice would prevail". So both
// are stored as stamped entries and the later stamp wins, rather than one level
// always outranking the other. Any fixed precedence would be wrong half the
// time: set the album border after fixing one photo and you mean the album to
// take over; fix one photo after setting the album and you mean that photo to
// stay fixed. The timestamp is what tells those two apart.
//
// This module is imported by BOTH the admin editor (to preview) and the render
// route (to build), so the preview cannot drift from the render. Keep it free of
// server-only imports.

export const BORDER_MIN = 0.2;   // vmin
export const BORDER_MAX = 6;     // vmin
export const BORDER_DEFAULT = { on: true, w: 1.2, color: '#FFFFFF' };

// Thickness is in vmin — a percentage of the frame's SHORT side. That keeps one
// number meaning one visual weight at any output size, and makes a border on a
// small tiled cell the same thickness as one on a full-frame photo, which is
// what "the same border on every image" has to mean.
export function normalizeBorder(b) {
  if (!b || typeof b !== 'object') return null;
  let w = Number(b.w);
  if (!Number.isFinite(w)) w = BORDER_DEFAULT.w;
  w = Math.min(BORDER_MAX, Math.max(BORDER_MIN, Math.round(w * 10) / 10));
  const color = typeof b.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(b.color.trim())
    ? b.color.trim().toUpperCase()
    : BORDER_DEFAULT.color;
  let at = Number(b.at);
  if (!Number.isFinite(at) || at < 0) at = 0;
  return { on: !!b.on, w, color, at: Math.round(at) };
}

// The album bucket for a photo. Photos outside any album share the '' bucket, so
// a loose set still gets one global control instead of none.
export function albumKey(album) {
  return typeof album === 'string' && album ? album : '';
}

// Which border applies to one photo — the album's or its own, whichever was set
// most recently. Returns null when neither has ever been set.
export function resolveBorder(edits, photoKey, album) {
  const e = edits && typeof edits === 'object' ? edits : {};
  const photos = e.photos && typeof e.photos === 'object' ? e.photos : {};
  const albums = e.albumBorders && typeof e.albumBorders === 'object' ? e.albumBorders : {};
  const own = normalizeBorder((photos[photoKey] || {}).border);
  const alb = normalizeBorder(albums[albumKey(album)]);
  if (!own) return alb;
  if (!alb) return own;
  // Ties go to the individual photo: a per-photo edit is the more specific
  // statement, and same-millisecond collisions are only reachable by a
  // programmatic write, never by two human clicks.
  return own.at >= alb.at ? own : alb;
}

// Is there actually a line to draw? An entry with on:false is a real choice
// ("this album's photos have NO border") and must still beat an older album
// entry — so it resolves, then reports nothing to draw.
export function borderIsOn(b) {
  return !!(b && b.on && Number(b.w) > 0);
}

// Which of the two levels is currently winning, for the editor to label. Returns
// 'photo' | 'album' | null.
export function borderSource(edits, photoKey, album) {
  const e = edits && typeof edits === 'object' ? edits : {};
  const photos = e.photos && typeof e.photos === 'object' ? e.photos : {};
  const albums = e.albumBorders && typeof e.albumBorders === 'object' ? e.albumBorders : {};
  const own = normalizeBorder((photos[photoKey] || {}).border);
  const alb = normalizeBorder(albums[albumKey(album)]);
  if (!own && !alb) return null;
  if (!own) return 'album';
  if (!alb) return 'photo';
  return own.at >= alb.at ? 'photo' : 'album';
}
