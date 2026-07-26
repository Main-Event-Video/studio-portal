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

// Normalize whatever is stored/sent into a safe shape.
function clean(edits) {
  const out = { photos: {}, colorCorrect: false };
  if (!edits || typeof edits !== 'object') return out;
  out.colorCorrect = !!edits.colorCorrect;
  const photos = edits.photos && typeof edits.photos === 'object' ? edits.photos : {};
  for (const [key, v] of Object.entries(photos)) {
    if (!v || typeof v !== 'object') continue;
    const anchor = ['top', 'center', 'bottom'].includes(v.anchor) ? v.anchor : 'top';
    const fit = v.fit === 'fill' ? 'fill' : 'fit';
    let size = Number(v.size);
    if (!Number.isFinite(size)) size = 100;
    size = Math.min(140, Math.max(60, Math.round(size)));
    out.photos[key] = { anchor, fit, size, removed: !!v.removed };
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
