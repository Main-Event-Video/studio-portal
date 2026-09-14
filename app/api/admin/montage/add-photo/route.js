// POST /api/admin/montage/add-photo
//   { clientId, key, filename, contentType?, sizeBytes? }
// Records a photo Josh uploaded from the admin (the browser PUTs it straight
// to R2 via /api/admin/upload-url first) as a NEW upload in the client's
// library — the same row the client portal's confirm step makes, so it takes an
// import number, shows in Edit Photos at the end of the loose photos, and can be
// used by any montage. Built for Revise: "add the ability to upload a
// replacement image into the revise of the already created montage."
// HEICs are converted to JPEG exactly as the portal does; an empty object is
// refused rather than stored.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { getObjectBuffer, putFile, deleteFile, objectSize, getViewUrl } from '@/lib/r2';
import { isHeic, anyImageToJpeg, toJpgName, toJpgKey } from '@/lib/heic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }); }
  const { clientId, key, filename, contentType, sizeBytes } = body || {};
  if (!clientId || !key || !filename) return NextResponse.json({ error: 'Missing file info' }, { status: 400 });
  if (contentType && !String(contentType).startsWith('image/')) return NextResponse.json({ error: 'Must be an image' }, { status: 400 });

  const db = createServiceClient();
  const { data: client } = await db.from('studio_clients').select('id, archived').eq('id', clientId).single();
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const stored = await objectSize(key);
  if (stored === null || stored === 0) {
    try { await deleteFile(key); } catch { /* nothing to remove */ }
    return NextResponse.json({ error: `${filename} arrived empty — please try again` }, { status: 422 });
  }

  let finalKey = key, finalName = filename, finalType = contentType || null, finalSize = Number.isFinite(sizeBytes) ? sizeBytes : stored;
  if (isHeic({ filename, contentType })) {
    try {
      const buf = await getObjectBuffer(key);
      const jpeg = await anyImageToJpeg(buf);
      const jpgKey = toJpgKey(key);
      await putFile(jpgKey, jpeg, 'image/jpeg');
      try { await deleteFile(key); } catch { /* orphan harmless */ }
      finalKey = jpgKey; finalName = toJpgName(filename); finalType = 'image/jpeg'; finalSize = jpeg.length;
    } catch (e) {
      return NextResponse.json({ error: `Could not convert ${filename}: ${e?.message || e}` }, { status: 422 });
    }
  }

  const { data: row, error } = await db.from('studio_media').insert({
    client_id: client.id, kind: 'client_upload', r2_key: finalKey, filename: finalName,
    folder_path: null, sort_number: null, size_bytes: finalSize, content_type: finalType, watermarked: false,
  }).select('id').single();
  if (error || !row) return NextResponse.json({ error: 'Could not save the photo', detail: error?.message }, { status: 500 });

  const url = await getViewUrl(finalKey, 43200);
  return NextResponse.json({ ok: true, key: finalKey, filename: finalName, url });
}
