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
  }
  return out;
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
  const { error } = await db
    .from('studio_clients')
    .update({ photo_edits: safe })
    .eq('id', clientId);
  if (error) return NextResponse.json({ error: 'Could not save', detail: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, edits: safe });
}
