// GET  /api/admin/media?clientId=...  → a client's uploaded files (images +
//                                       videos) with presigned view/download URLs
// POST /api/admin/media  { clientId, action, ... }
//   action 'update' | 'renumber' | 'renameFolder' | 'delete'  (admin: delete OK)
// Shared organize logic lives in lib/mediaOrganize (also used by the portal).
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { getViewUrl, getDownloadUrl } from '@/lib/r2';
import { applyMediaAction, applyArrangement } from '@/lib/mediaOrganize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const clientId = url.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });

  const db = createServiceClient();
  // Admin SEES hidden photos (unlike the portal/render) so hidden albums can be
  // restored — each carries a `hidden` flag. Select hidden_at when present; fall
  // back if sql/013 hasn't run yet.
  const cols = 'id, filename, content_type, r2_key, sort_number, folder_path, size_bytes, created_at';
  const run = (c) => db
    .from('studio_media')
    .select(c)
    .eq('client_id', clientId)
    .eq('kind', 'client_upload')
    .order('folder_path', { ascending: true, nullsFirst: true })
    .order('sort_number', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });
  let { data, error } = await run(`${cols}, hidden_at, timeline_pos`);
  if (error) ({ data, error } = await run(`${cols}, hidden_at`));
  if (error) ({ data, error } = await run(cols));
  if (error) return NextResponse.json({ error: 'Could not load files', detail: error.message }, { status: 500 });

  const files = await Promise.all(
    (data || []).map(async (m) => ({
      id: m.id,
      filename: m.filename,
      contentType: m.content_type,
      isVideo: (m.content_type || '').startsWith('video'),
      sortNumber: m.sort_number,
      timelinePos: m.timeline_pos ?? null,
      folderPath: m.folder_path,
      sizeBytes: m.size_bytes,
      hidden: !!m.hidden_at,
      url: await getViewUrl(m.r2_key, 3600),
      // forces a real download (Content-Disposition: attachment) instead of
      // opening the image in a browser tab — the `download` attr is ignored on
      // cross-origin R2 links, so we let R2 set the disposition.
      downloadUrl: await getDownloadUrl(m.r2_key, String(m.filename || 'photo').replace(/\.jfif$/i, '.jpg'), 3600),
    }))
  );

  // Also return the client's albums (studio_boxes) so the admin UI can show
  // EMPTY albums (no photos yet) — otherwise a just-created or emptied album
  // would be invisible and impossible to rename or delete.
  let boxes = [];
  {
    let { data: bx } = await db.from('studio_boxes')
      .select('name, position, hidden_at').eq('client_id', clientId).order('position', { ascending: true });
    if (!Array.isArray(bx)) ({ data: bx } = await db.from('studio_boxes')
      .select('name, position').eq('client_id', clientId).order('position', { ascending: true }));
    boxes = Array.isArray(bx) ? bx : [];
  }

  return NextResponse.json({ files, boxes });
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const { clientId } = body || {};
  if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });

  const db = createServiceClient();
  if (body.action === 'setArrangement') {
    const r = await applyArrangement(db, clientId, { top: body.top, albums: body.albums });
    if (r.error) return NextResponse.json({ error: r.error, detail: r.detail }, { status: r.status || 500 });
    return NextResponse.json({ ok: true });
  }
  const result = await applyMediaAction(db, clientId, body, { allowDelete: true });
  if (result.error) {
    return NextResponse.json({ error: result.error, detail: result.detail }, { status: result.status || 500 });
  }
  return NextResponse.json(result);
}
