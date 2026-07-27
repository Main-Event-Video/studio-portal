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
//   → { media, boxes }
//     media : the client's media (mine) or delivered cuts (view), each row
//             carries timelinePos + sortNumber + folderPath so the timeline UI
//             can compute play order.
//     boxes : the client's albums as { name, position } in order (may be empty).
//             ("album" is the user-facing word; the table is still studio_boxes.)
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
  const runQuery = (cols) => db
    .from('studio_media')
    .select(cols)
    .eq('client_id', client.id)
    .in('kind', kinds)
    .order('folder_path', { ascending: true, nullsFirst: true })
    .order('sort_number', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  // Prefer the full set (with timeline_pos). If that column doesn't exist yet
  // (sql/006 not run), fall back so the portal NEVER shows an empty list —
  // ordering still works, timelinePos is just treated as null.
  let { data, error } = await runQuery('id, filename, content_type, r2_key, kind, note, sort_number, folder_path, timeline_pos, created_at');
  if (error) {
    ({ data, error } = await runQuery('id, filename, content_type, r2_key, kind, note, sort_number, folder_path, created_at'));
  }
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
      timelinePos: m.timeline_pos ?? null,
      createdAt: m.created_at,
      url: await getViewUrl(m.r2_key, 3600),
    }))
  );

  // Pre-made albums (persist even when empty). Non-fatal if the table isn't there.
  let boxes = [];
  const { data: boxRows } = await db
    .from('studio_boxes')
    .select('name, position, created_at')
    .eq('client_id', client.id)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (Array.isArray(boxRows)) boxes = boxRows.map((b) => ({ name: b.name, position: b.position }));

  return NextResponse.json({ media, boxes });
}

// POST /api/portal/media  { token, action, ... }
// Client-facing album + file actions. Delete of FILES is NOT allowed here
// (allowDelete:false) — only the studio admin can delete uploads.
//   action 'createBox'       { name }        — make an (empty) album
//   action 'renameBox'       { from, to }    — rename album + move its photos' folder
//   action 'deleteBox'       { name }        — remove the album record
//   action 'setArrangement'  { top, albums } — persist the WHOLE timeline (see below)
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
    if (!name) return NextResponse.json({ error: 'Album needs a name' }, { status: 400 });
    const { data: last } = await db
      .from('studio_boxes').select('position')
      .eq('client_id', client.id).order('position', { ascending: false }).limit(1);
    const position = last && last[0] ? (last[0].position ?? 0) + 1 : 0;
    const { error } = await db.from('studio_boxes').insert({ client_id: client.id, name, position });
    if (error && error.code !== '23505') { // ignore "already exists"
      return NextResponse.json({ error: 'Could not create album', detail: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === 'renameBox') {
    const from = String(body.from || '').trim();
    const to = String(body.to || '').trim();
    if (!from || !to) return NextResponse.json({ error: 'Missing album name' }, { status: 400 });
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

  // -------- setArrangement: persist the entire timeline in one request --------
  // body.top    : ordered top-level items — [{ type:'media', id } | { type:'album', name }]
  // body.albums : { "<albumName>": ["<mediaId>", ...] }  (order of media inside each album)
  //
  // We renumber everything 1..N so the state is fully explicit and stable:
  //   • loose media → studio_media.timeline_pos = its top rank, folder_path = null
  //   • album       → studio_boxes.position     = its top rank (album row upserted)
  //   • media in an album → folder_path = album, sort_number = its rank inside,
  //                         timeline_pos = null
  // Small N (dozens of photos), so per-row updates are fine.
  if (action === 'setArrangement') {
    const top = Array.isArray(body.top) ? body.top : [];
    const albums = body.albums && typeof body.albums === 'object' ? body.albums : {};

    try {
      let rank = 1;
      for (const entry of top) {
        if (!entry || typeof entry !== 'object') continue;
        if (entry.type === 'media' && entry.id) {
          const { error } = await db.from('studio_media')
            .update({ folder_path: null, timeline_pos: rank })
            .eq('client_id', client.id).eq('kind', 'client_upload').eq('id', entry.id);
          if (error) throw new Error(error.message);
        } else if (entry.type === 'album' && entry.name) {
          const name = String(entry.name).trim();
          if (!name) continue;
          // Upsert the album row so its position persists even if it had no
          // studio_boxes row yet (implied album, or pre-005 data).
          const { error } = await db.from('studio_boxes')
            .upsert({ client_id: client.id, name, position: rank }, { onConflict: 'client_id,name' });
          if (error) throw new Error(error.message);
        } else {
          continue;
        }
        rank++;
      }

      // Media inside each album: folder_path + within-album order.
      for (const [name, ids] of Object.entries(albums)) {
        const albumName = String(name).trim();
        if (!albumName || !Array.isArray(ids)) continue;
        let j = 1;
        for (const id of ids) {
          const { error } = await db.from('studio_media')
            .update({ folder_path: albumName, sort_number: j, timeline_pos: null })
            .eq('client_id', client.id).eq('kind', 'client_upload').eq('id', id);
          if (error) throw new Error(error.message);
          j++;
        }
      }
    } catch (e) {
      return NextResponse.json({ error: 'Could not save your order', detail: String(e.message || e) }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const result = await applyMediaAction(db, client.id, body, { allowDelete: true }); // clients may delete their OWN uploads (scoped to client_upload)
  if (result.error) {
    return NextResponse.json({ error: result.error, detail: result.detail }, { status: result.status || 500 });
  }
  return NextResponse.json(result);
}
