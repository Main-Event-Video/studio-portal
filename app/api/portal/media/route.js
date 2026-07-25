import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { getClientByToken } from '@/lib/portal';
import { getViewUrl } from '@/lib/r2';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { applyMediaAction } from '@/lib/mediaOrganize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/portal/media?token=...&scope=view|mine
export async function GET(request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const scope = url.searchParams.get('scope') === 'mine' ? 'mine' : 'view';

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: 'Portal not found' }, { status: 404 });

  const authed = verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (authed !== client.id) {
    return NextResponse.json({ error: 'Please sign in again' }, { status: 401 });
  }

  const kinds = scope === 'mine' ? ['client_upload'] : ['rough_cut', 'final'];
  const db = createServiceClient();
  const { data, error } = await db
    .from('studio_media')
    .select('id, filename, content_type, r2_key, kind, note, sort_number, folder_path, created_at')
    .eq('client_id', client.id)
    .in('kind', kinds)
    .order('folder_path', { ascending: true, nullsFirst: true })
    .order('sort_number', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Could not load media', detail: error.message }, { status: 500 });
  }

  const media = await Promise.all(
    (data || []).map(async (m) => ({
      id: m.id,
      filename: m.filename,
      contentType: m.content_type,
      kind: m.kind,
      note: m.note,
      sortNumber: m.sort_number,
      folderPath: m.folder_path,
      url: await getViewUrl(m.r2_key, 3600),
    }))
  );

  return NextResponse.json({ media });
}

// POST /api/portal/media  { token, action, ... }
// Lets the client organize THEIR OWN uploads: reorder / rename / move folders.
// Delete is intentionally NOT allowed here (allowDelete:false) — only the studio
// admin can delete, so a shared family login can't wipe someone else's photos.
export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }); }

  const { token } = body || {};
  if (!token) return NextResponse.json({ error: 'Missing portal token' }, { status: 400 });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: 'Portal not found' }, { status: 404 });
  if (client.archived) return NextResponse.json({ error: 'This portal is archived' }, { status: 400 });

  const authed = verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (authed !== client.id) {
    return NextResponse.json({ error: 'Please sign in again' }, { status: 401 });
  }

  const db = createServiceClient();
  const result = await applyMediaAction(db, client.id, body, { allowDelete: false });
  if (result.error) {
    return NextResponse.json({ error: result.error, detail: result.detail }, { status: result.status || 500 });
  }
  return NextResponse.json(result);
}
