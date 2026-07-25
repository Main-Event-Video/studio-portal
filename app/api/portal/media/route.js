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
//   → { media, boxes }  (boxes = the client's box names, in order; may be empty)
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

  // Pre-made boxes (persist even when empty). Non-fatal if the table isn't there.
  let boxes = [];
  const { data: boxRows } = await db
    .from('studio_boxes')
    .select('name, position, created_at')
    .eq('client_id', client.id)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (Array.isArray(boxRows)) boxes = boxRows.map((b) => b.name);

  return NextResponse.json({ media, boxes });
}

// POST /api/portal/media  { token, action, ... }
// Client-facing box + file actions. Delete of FILES is NOT allowed here
// (allowDelete:false) — only the studio admin can delete uploads.
//   action 'createBox'   { name }        — make an (empty) box
//   action 'renameBox'   { from, to }    — rename box + move its photos' folder
//   action 'deleteBox'   { name }        — remove the box record
//   others → shared organize (update / renumber / renameFolder)
export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }); }

  const { token, action } = body || {};
  if (!token) return NextResponse.json({ error: 'Missing portal token' }, { status: 400 });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: 'Portal not found' }, { status: 404 });
  if (client.archived) return NextResponse.json({ error: 'This portal is archived' }, { status: 400 });

  const authed = verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (authed !== client.id) {
    return NextResponse.json({ error: 'Please sign in again' }, { status: 401 });
  }

  const db = createServiceClient();

  if (action === 'createBox') {
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: 'Box needs a name' }, { status: 400 });
    const { data: last } = await db
      .from('studio_boxes').select('position')
      .eq('client_id', client.id).order('position', { ascending: false }).limit(1);
    const position = last && last[0] ? (last[0].position ?? 0) + 1 : 0;
    const { error } = await db.from('studio_boxes').insert({ client_id: client.id, name, position });
    if (error && error.code !== '23505') { // ignore "already exists"
      return NextResponse.json({ error: 'Could not create box', detail: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === 'renameBox') {
    const from = String(body.from || '').trim();
    const to = String(body.to || '').trim();
    if (!from || !to) return NextResponse.json({ error: 'Missing box name' }, { status: 400 });
    await db.from('studio_boxes').update({ name: to }).eq('client_id', client.id).eq('name', from);
    await db.from('studio_media').update({ folder_path: to })
      .eq('client_id', client.id).eq('kind', 'client_upload').eq('folder_path', from);
    return NextResponse.json({ ok: true });
  }

  if (action === 'deleteBox') {
    const name = String(body.name || '').trim();
    if (name) await db.from('studio_boxes').delete().eq('client_id', client.id).eq('name', name);
    return NextResponse.json({ ok: true });
  }

  const result = await applyMediaAction(db, client.id, body, { allowDelete: false });
  if (result.error) {
    return NextResponse.json({ error: result.error, detail: result.detail }, { status: result.status || 500 });
  }
  return NextResponse.json(result);
}
