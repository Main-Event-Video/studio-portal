import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { getClientByToken } from '@/lib/portal';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { getObjectBuffer, putFile, deleteFile } from '@/lib/r2';
import { isHeic, convertHeicToJpeg, toJpgName, toJpgKey } from '@/lib/heic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// HEIC conversion (decode via WASM + one sharp pass) is ~3s for a 12MP photo;
// give the function generous headroom so a large upload never times out.
export const maxDuration = 60;

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const { token, key, filename, contentType, size, sortNumber, folderPath } = body || {};
  if (!token || !key || !filename) {
    return NextResponse.json({ error: 'Missing file info' }, { status: 400 });
  }

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: 'Portal not found' }, { status: 404 });

  const authed = verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (authed !== client.id) {
    return NextResponse.json({ error: 'Please sign in again' }, { status: 401 });
  }

  // What actually gets stored. Starts as the uploaded file; if it's a HEIC we
  // swap in the converted JPEG below (convert + replace).
  let finalKey = key;
  let finalName = filename;
  let finalType = contentType || null;
  let finalSize = Number.isFinite(size) ? size : null;
  let converted = false;

  if (isHeic({ filename, contentType })) {
    try {
      const heicBuf = await getObjectBuffer(key);
      const jpegBuf = await convertHeicToJpeg(heicBuf);
      const jpgKey = toJpgKey(key);
      await putFile(jpgKey, jpegBuf, 'image/jpeg');
      // Replace: drop the HEIC original now that the JPEG is safely stored.
      try { await deleteFile(key); } catch { /* orphaned original is harmless */ }
      finalKey = jpgKey;
      finalName = toJpgName(filename);
      finalType = 'image/jpeg';
      finalSize = jpegBuf.length;
      converted = true;
    } catch (e) {
      // Conversion failed — KEEP the original HEIC rather than lose the photo.
      // It'll show as an unpreviewable tile, but nothing is destroyed.
      console.error('HEIC conversion failed for', key, e?.message || e);
    }
  }

  const db = createServiceClient();
  const { error } = await db.from('studio_media').insert({
    client_id: client.id,
    kind: 'client_upload',
    r2_key: finalKey,
    filename: finalName,
    folder_path: folderPath || null,
    sort_number: Number.isFinite(sortNumber) ? sortNumber : null,
    size_bytes: finalSize,
    content_type: finalType,
    watermarked: false,
  });

  if (error) {
    return NextResponse.json({ error: 'Could not save file record', detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, converted, filename: finalName, contentType: finalType });
}
