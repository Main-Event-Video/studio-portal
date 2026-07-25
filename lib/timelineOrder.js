// =============================================================
// MAIN EVENT STUDIO — the ONE source of truth for play order.
// Turns a client's uploaded media + their albums into a single flat,
// left-to-right play order (the "timeline"). Used by BOTH the portal
// timeline UI and the admin montage render path so what the client
// arranges is exactly what the video plays.
//
// The model (see HANDOFF-6):
//   • The master timeline is a list of TOP-LEVEL items, left→right = play order.
//   • A top-level item is either a LOOSE media file (photo/video with no album)
//     or an ALBUM (a named bundle: studio_media.folder_path === album name).
//   • Loose items and albums interleave freely: photo, album, photo, photo, album…
//   • When play reaches an album it plays that album's items in their own
//     internal order, then continues to the next top-level item.
//
// Ordering fields (all integers, small N — we renumber 1..N on every change):
//   • Loose media top-level rank ....... studio_media.timeline_pos   (006 migration)
//   • Album top-level rank ............. studio_boxes.position        (005 migration)
//     ^ these two share ONE 1..N scale so an album can sit between two loose photos.
//   • Media order INSIDE an album ...... studio_media.sort_number
//
// "album" is the user-facing word; the DB table is still studio_boxes and the
// folder_path column still stores the album name — internal names only, never
// shown to a client or the studio.
// =============================================================

// Photos moved here are set aside for the studio; they never play.
const TRASH_FOLDER = 'Trash';

// Folders that never appear on the timeline or in the montage: the studio's
// Trash and the client's Character Build holding area. The second value MUST
// stay in sync with CHAR_FOLDER in lib/characterPoses.js (kept literal here so
// this ordering helper has zero imports — it's shared by client + server).
const EXCLUDED_FOLDERS = new Set([TRASH_FOLDER, '__character_build__']);

// Field readers tolerant of BOTH shapes: snake_case DB rows (render path) and
// camelCase portal rows (the timeline UI). One helper, two callers, no drift.
const fFolder = (m) => (m.folder_path ?? m.folderPath ?? '');
const fSort = (m) => (m.sort_number ?? m.sortNumber ?? null);
const fPos = (m) => (m.timeline_pos ?? m.timelinePos ?? null);
const fCreated = (m) => (m.created_at ?? m.createdAt ?? '');

// Stable numeric compare with a fallback key. null/undefined sort LAST.
function byNumThen(getNum, getFallback) {
  return (a, b) => {
    const na = getNum(a); const nb = getNum(b);
    const va = na == null ? Infinity : na;
    const vb = nb == null ? Infinity : nb;
    if (va !== vb) return va - vb;
    const fa = getFallback ? getFallback(a) : '';
    const fb = getFallback ? getFallback(b) : '';
    return String(fa).localeCompare(String(fb));
  };
}

/**
 * Build the flat play order + the display structure for a client.
 *
 * @param {Array} mediaRows  studio_media rows (client_upload). Each needs at
 *   least: { id, folder_path, sort_number, timeline_pos, created_at, ... }.
 *   Any extra fields (r2_key, filename, content_type, url…) are passed through
 *   untouched, so both the render path and the UI can use the same objects.
 * @param {Array} boxRows    studio_boxes rows: { name, position, created_at }.
 * @returns {{ flat: Array, structure: Array }}
 *   flat      — every media row in final play order (albums expanded inline).
 *   structure — top-level items for the UI:
 *                 { type:'media', item }              (a loose photo/video)
 *                 { type:'album', name, items:[...] } (an album + its media)
 */
export function buildTimeline(mediaRows, boxRows) {
  const media = Array.isArray(mediaRows) ? mediaRows : [];
  const rawBoxes = Array.isArray(boxRows) ? boxRows : [];

  // Album registry — seeded from studio_boxes so EMPTY albums still appear.
  const albums = new Map(); // name -> { name, position, created_at, items:[] }
  for (const b of rawBoxes) {
    if (!b || !b.name) continue;
    albums.set(b.name, { name: b.name, position: b.position ?? null, created_at: fCreated(b) || null, items: [] });
  }

  const loose = [];
  for (const m of media) {
    const fp = String(fFolder(m) || '').trim();
    if (EXCLUDED_FOLDERS.has(fp)) continue;       // trashed or character-build — never plays
    if (fp) {
      // An album implied by a photo but with no studio_boxes row (e.g. created
      // before 005, or via an admin folder rename) still shows up.
      if (!albums.has(fp)) albums.set(fp, { name: fp, position: null, created_at: fCreated(m) || null, items: [] });
      albums.get(fp).items.push(m);
    } else {
      loose.push(m);
    }
  }

  // Order INSIDE each album: sort_number then created_at.
  for (const a of albums.values()) {
    a.items.sort(byNumThen((x) => fSort(x), (x) => fCreated(x)));
  }

  // Has the client actually arranged the timeline yet? The moment any loose
  // photo carries a timeline_pos we treat the whole timeline as "seeded" and
  // honor the explicit ranks. Until then we fall back to the legacy default
  // (loose photos first in number order, then albums) so existing clients'
  // renders are byte-for-byte unchanged until they touch the new UI.
  const seeded = loose.some((m) => fPos(m) != null);

  const top = [];
  for (const m of loose) top.push({ kind: 'media', rank: fPos(m), created: fCreated(m), sub: fSort(m), item: m });
  for (const a of albums.values()) top.push({ kind: 'album', rank: a.position, created: a.created_at, sub: null, album: a });

  if (seeded) {
    // Explicit shared-scale ranks. Newly uploaded, not-yet-placed items
    // (rank null) fall to the end in upload order.
    top.sort((x, y) => {
      const rx = x.rank == null ? Infinity : x.rank;
      const ry = y.rank == null ? Infinity : y.rank;
      if (rx !== ry) return rx - ry;
      return String(x.created).localeCompare(String(y.created));
    });
  } else {
    // Legacy default: all loose first (by sort_number, then created), then
    // albums (by position when known, else creation time, else name).
    top.sort((x, y) => {
      if (x.kind !== y.kind) return x.kind === 'media' ? -1 : 1;
      if (x.kind === 'media') {
        const sx = x.sub == null ? Infinity : x.sub;
        const sy = y.sub == null ? Infinity : y.sub;
        if (sx !== sy) return sx - sy;
        return String(x.created).localeCompare(String(y.created));
      }
      const px = x.rank == null ? Infinity : x.rank;
      const py = y.rank == null ? Infinity : y.rank;
      if (px !== py) return px - py;
      const cc = String(x.created).localeCompare(String(y.created));
      if (cc !== 0) return cc;
      return x.album.name.localeCompare(y.album.name);
    });
  }

  const flat = [];
  const structure = [];
  for (const t of top) {
    if (t.kind === 'media') {
      flat.push(t.item);
      structure.push({ type: 'media', item: t.item });
    } else {
      for (const it of t.album.items) flat.push(it);
      structure.push({ type: 'album', name: t.album.name, items: t.album.items });
    }
  }
  return { flat, structure };
}

export { TRASH_FOLDER };
