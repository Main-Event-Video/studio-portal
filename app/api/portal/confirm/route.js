import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { getClientByToken } from '@/lib/portal';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  const db = createServiceClient();
  const { error } = await db.from('studio_media').insert({
    client_id: client.id,
    kind: 'client_upload',
    r2_key: key,
    filename,
    folder_path: folderPath || null,
    sort_number: Number.isFinite(sortNumber) ? sortNumber : null,
    size_bytes: Number.isFinite(size) ? size : null,
    content_type: contentType || null,
    watermarked: false,
  });

  if (error) {
    return NextResponse.json({ error: 'Could not save file record', detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
