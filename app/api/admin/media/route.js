// GET  /api/admin/media?clientId=...  → a client's uploaded files (images +
//                                       videos) with presigned view/download URLs
// POST /api/admin/media  { clientId, action, ... }
//   action 'update' | 'renumber' | 'renameFolder' | 'delete'  (admin: delete OK)
// Shared organize logic lives in lib/mediaOrganize (also used by the portal).
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { getViewUrl } from '@/lib/r2';
import { applyMediaAction } from '@/lib/mediaOrganize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const clientId = url.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });

  const db = createServiceClient();
  const { data, error } = await db
    .from('studio_media')
    .select('id, filename, content_type, r2_key, sort_number, folder_path, size_bytes, created_at')
    .eq('client_id', clientId)
    .eq('kind', 'client_upload')
    .order('folder_path', { ascending: true, nullsFirst: true })
    .order('sort_number', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: 'Could not load files', detail: error.message }, { status: 500 });

  const files = await Promise.all(
    (data || []).map(async (m) => ({
      id: m.id,
      filename: m.filename,
      contentType: m.content_type,
      isVideo: (m.content_type || '').startsWith('video'),
      sortNumber: m.sort_number,
      folderPath: m.folder_path,
      sizeBytes: m.size_bytes,
      url: await getViewUrl(m.r2_key, 3600),
    }))
  );
  return NextResponse.json({ files });
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const { clientId } = body || {};
  if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });

  const db = createServiceClient();
  const result = await applyMediaAction(db, clientId, body, { allowDelete: true });
  if (result.error) {
    return NextResponse.json({ error: result.error, detail: result.detail }, { status: result.status || 500 });
  }
  return NextResponse.json(result);
}
