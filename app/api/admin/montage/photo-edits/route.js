// GET  /api/admin/montage/photo-edits?clientId=...
//   → the client's saved Photo Editor state (per-photo framing/fit/size/removed
//     + global colorCorrect). Applied to EVERY montage render for the client.
// POST /api/admin/montage/photo-edits  { clientId, edits }
//   → persists the editor state on the client row. Pure bookkeeping — no render.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A photo border. Thickness is in vmin (a % of the frame's short side), so the
// same number reads as the same weight whatever the output resolution.
//
// `at` is a timestamp, and it is the whole mechanism behind Josh's rule: "the
// most recent choice would prevail - global vs individual". A border set on the
// album and a border set on one photo are both just stamped entries; whichever
// was touched last is the one that renders. Without the stamp we would need a
// precedence rule, and any fixed precedence is wrong half the time — set the
// album border after fixing one photo and the album should win; fix one photo
// after setting the album and the photo should win.
const BORDER_MIN = 0.2, BORDER_MAX = 6;
function cleanBorder(b) {
  if (!b || typeof b !== 'object') return null;
  let w = Number(b.w);
  if (!Number.isFinite(w)) w = 1.2;
  w = Math.min(BORDER_MAX, Math.max(BORDER_MIN, Math.round(w * 10) / 10));
  const color = typeof b.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(b.color.trim())
    ? b.color.trim().toUpperCase()
    : '#FFFFFF';
  let at = Number(b.at);
  if (!Number.isFinite(at) || at < 0) at = 0;
  return { on: !!b.on, w, color, at: Math.round(at) };
}

// Normalize whatever is stored/sent into a safe shape.
function clean(edits) {
  const out = { photos: {}, colorCorrect: false, albumBorders: {} };
  if (!edits || typeof edits !== 'object') return out;
  out.colorCorrect = !!edits.colorCorrect;

  // Per-album border defaults. The key is the album (folder_path) name; '' is the
  // bucket for photos that are not in any album, so loose photos still get a
  // "whole set" control rather than no control at all.
  const ab = edits.albumBorders && typeof edits.albumBorders === 'object' ? edits.albumBorders : {};
  for (const [name, v] of Object.entries(ab)) {
    if (typeof name !== 'string' || name.length > 200) continue;
    const b = cleanBorder(v);
    if (b) out.albumBorders[name] = b;
  }
  const photos = edits.photos && typeof edits.photos === 'object' ? edits.photos : {};
  for (const [key, v] of Object.entries(photos)) {
    if (!v || typeof v !== 'object') continue;
    const anchor = ['top', 'center', 'bottom'].includes(v.anchor) ? v.anchor : 'top';
    const fit = v.fit === 'fill' ? 'fill' : 'fit';
    let size = Number(v.size);
    if (!Number.isFinite(size)) size = 100;
    size = Math.min(140, Math.max(60, Math.round(size)));
    const mode = ['color', 'bw', 'sepia'].includes(v.mode) ? v.mode : 'color';
    let contrast = Number(v.contrast); if (!Number.isFinite(contrast)) contrast = 100;
    contrast = Math.min(200, Math.max(50, Math.round(contrast)));
    let saturation = Number(v.saturation); if (!Number.isFinite(saturation)) saturation = 100;
    saturation = Math.min(200, Math.max(0, Math.round(saturation)));
    let posX = Number(v.posX), posY = Number(v.posY);
    posX = Number.isFinite(posX) ? Math.min(100, Math.max(0, Math.round(posX))) : null;
    posY = Number.isFinite(posY) ? Math.min(100, Math.max(0, Math.round(posY))) : null;
    // A per-photo border override. null (the common case) means "this photo has
    // never been given its own border" — NOT "no border": the album's border
    // still applies. Only an explicit entry competes with the album's timestamp.
    const border = cleanBorder(v.border);
    out.photos[key] = { anchor, fit, size, removed: !!v.removed, colorCorrect: !!v.colorCorrect, mode, contrast, saturation, posX, posY, border };
    // MEVID STILLS per-photo state (9/9): the transition this photo arrives
    // with (null = Auto), and the R2 keys of its derivatives (written by
    // /api/admin/montage/stills-derive, never by the editor).
    const st = cleanStills(v.stills);
    if (st) out.photos[key].stills = st;
  }
  // Manual screens for MEvid Stills: [{ keys:[r2_key…], layout }].
  const groups = Array.isArray(edits.stillsGroups) ? edits.stillsGroups : [];
  out.stillsGroups = groups.map((g) => {
    if (!g || typeof g !== 'object') return null;
    const keys = Array.isArray(g.keys) ? g.keys.filter((k) => typeof k === 'string' && k.length < 400).slice(0, 4) : [];
    if (keys.length < 2) return null;
    const layout = typeof g.layout === 'string' && /^[a-z0-9_-]{1,24}$/i.test(g.layout) ? g.layout : null;
    return { keys, layout };
  }).filter(Boolean).slice(0, 200);
  return out;
}

const STATUSES = ['ready', 'none', 'failed'];
function cleanStills(s) {
  if (!s || typeof s !== 'object') return null;
  const out = {};
  if (typeof s.transition === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(s.transition)) out.transition = s.transition;
  for (const f of ['cutout_key', 'watercolor_key']) if (typeof s[f] === 'string' && s[f].length < 400) out[f] = s[f];
  for (const f of ['cutout_status', 'watercolor_status']) if (STATUSES.includes(s[f])) out[f] = s[f];
  return Object.keys(out).length ? out : null;
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const clientId = url.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });

  const db = createServiceClient();
  const { data: c, error } = await db
    .from('studio_clients')
    .select('id, photo_edits')
    .eq('id', clientId)
    .single();
  if (error || !c) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  return NextResponse.json({ edits: clean(c.photo_edits) });
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const { clientId, edits } = body || {};
  if (!clientId || typeof edits !== 'object') {
    return NextResponse.json({ error: 'Missing clientId or edits' }, { status: 400 });
  }

  const db = createServiceClient();
  const safe = clean(edits);
  // Derivative keys are written server-side by stills-derive while the editor
  // may hold an older copy of the edits in memory — never let an editor save
  // drop them. Merge the stored keys back in wherever the incoming entry lacks
  // them.
  try {
    const { data: cur } = await db.from('studio_clients').select('photo_edits').eq('id', clientId).single();
    const curPhotos = cur && cur.photo_edits && typeof cur.photo_edits === 'object' && cur.photo_edits.photos ? cur.photo_edits.photos : {};
    for (const [k, v] of Object.entries(curPhotos)) {
      const cs = v && v.stills && typeof v.stills === 'object' ? v.stills : null;
      if (!cs) continue;
      const keep = {};
      for (const f of ['cutout_key', 'cutout_status', 'watercolor_key', 'watercolor_status']) if (cs[f] !== undefined) keep[f] = cs[f];
      if (!Object.keys(keep).length) continue;
      const dest = safe.photos[k] || (safe.photos[k] = { anchor: 'top', fit: 'fit', size: 100, removed: false, colorCorrect: false, mode: 'color', contrast: 100, saturation: 100, posX: null, posY: null, border: null });
      dest.stills = { ...keep, ...(dest.stills || {}) };
    }
  } catch { /* best effort — a failed merge only loses derivative keys, which regenerate */ }
  const { error } = await db
    .from('studio_clients')
    .update({ photo_edits: safe })
    .eq('id', clientId);
  if (error) return NextResponse.json({ error: 'Could not save', detail: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, edits: safe });
}
