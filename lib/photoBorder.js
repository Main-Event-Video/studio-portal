// Photo borders: one shared definition of what a border is and which one wins.
//
// A border can be set in three places.
//
// TWO OF THEM ARE PEERS: an ALBUM (every photo in it) and a SINGLE photo. Josh's
// rule there is "the most recent choice would prevail", so both are stored as
// stamped entries and the later stamp wins rather than one level always
// outranking the other. Any fixed precedence would be wrong half the time: set
// the album border after fixing one photo and you mean the album to take over;
// fix one photo after setting the album and you mean that photo to stay fixed.
// The timestamp is what tells those two apart.
//
// THE THIRD OUTRANKS BOTH. Josh 2026-09-08: "i want the Choose Style to override
// the Edit photos border". It is set per MONTAGE in the style panel, not per
// photo, and it is not stamped — it wins outright whenever it is set, because it
// is a statement about this render rather than about a picture.
//
// WHY IT IS A TRISTATE AND NOT ON/OFF. "Not set" has to mean "use whatever Edit
// Photos says" while "off" has to mean "force no border on this montage, ignore
// Edit Photos". Two states cannot carry both, so an absent/null styleBorder is
// the pass-through and { on: false } is a real, overriding choice.
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
export function resolveBorder(edits, photoKey, album, styleBorder) {
  const sty = normalizeStyleBorder(styleBorder);
  if (sty) return sty;
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

// Which level is currently winning, for the editor to label. Returns
// 'style' | 'photo' | 'album' | null.
export function borderSource(edits, photoKey, album, styleBorder) {
  if (normalizeStyleBorder(styleBorder)) return 'style';
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

// The montage-wide override from the style panel. Returns null for "not set"
// (pass through to album/photo) and a normalized border otherwise — INCLUDING
// { on: false }, which is the real choice "no border on this montage".
//
// `mode` is what the UI stores: 'edits' (default) | 'none' | 'custom'.
export function normalizeStyleBorder(sb) {
  if (!sb || typeof sb !== 'object') return null;
  const mode = sb.mode;
  if (mode === 'none') return { on: false, w: BORDER_DEFAULT.w, color: BORDER_DEFAULT.color, at: 0 };
  if (mode !== 'custom') return null;   // 'edits', anything unrecognised, or absent
  const n = normalizeBorder({ ...sb, on: true });
  return n ? { ...n, at: 0 } : null;
}

// Does this style actually draw the photo border? Basic cut and Comic Book do
// not, and Framed Box carries its own frame instead — showing them a live
// control that silently does nothing is worse than showing it greyed out.
export const NO_BORDER_STYLES = new Set(['basic_cut', 'comic_book', 'framed_box']);
