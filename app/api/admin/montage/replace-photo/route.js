// POST /api/admin/montage/replace-photo
//   { clientId, oldKey, newKey, filename?, contentType?, sizeBytes? }
// Swaps the R2 object behind an existing montage photo IN PLACE. The browser
// first uploads the replacement straight to R2 via a presigned PUT
// (/api/admin/upload-url), so large "fixed" files never hit Vercel; then this
// route repoints the studio_media row at the new key. The row keeps its sort
// position, so the photo stays in the same montage slot/number. Any Photo Editor
// edits for that slot move to the new key. The ORIGINAL object is left in R2
// (not deleted) so nothing is lost.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const { clientId, oldKey, newKey, filename, contentType, sizeBytes } = body || {};
  if (!clientId || !oldKey || !newKey) {
    return NextResponse.json({ error: 'Missing clientId, oldKey or newKey' }, { status: 400 });
  }
  if (contentType && !String(contentType).startsWith('image/')) {
    return NextResponse.json({ error: 'Replacement must be an image' }, { status: 400 });
  }

  const db = createServiceClient();

  // The photo must belong to this client.
  const { data: row, error: findErr } = await db
    .from('studio_media')
    .select('id, r2_key, filename')
    .eq('client_id', clientId)
    .eq('r2_key', oldKey)
    .single();
  if (findErr || !row) return NextResponse.json({ error: 'Photo not found for this client' }, { status: 404 });

  // Repoint the media row at the newly uploaded object (same slot & number).
  const patch = { r2_key: newKey };
  if (filename) patch.filename = filename;
  if (contentType) patch.content_type = contentType;
  if (Number.isFinite(Number(sizeBytes))) patch.size_bytes = Number(sizeBytes);
  const { error: upErr } = await db.from('studio_media').update(patch).eq('id', row.id);
  if (upErr) return NextResponse.json({ error: 'Could not swap the photo', detail: upErr.message }, { status: 500 });

  // Carry the slot's Photo Editor edits (framing/fit/size/removed) to the new key.
  const { data: c } = await db.from('studio_clients').select('photo_edits').eq('id', clientId).single();
  const pe = c && c.photo_edits && typeof c.photo_edits === 'object' ? c.photo_edits : null;
  if (pe && pe.photos && pe.photos[oldKey]) {
    const photos = { ...pe.photos };
    photos[newKey] = photos[oldKey];
    delete photos[oldKey];
    await db.from('studio_clients').update({ photo_edits: { ...pe, photos } }).eq('id', clientId);
  }

  return NextResponse.json({ ok: true, newKey });
}
