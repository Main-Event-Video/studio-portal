// GET /api/admin/montage/photos?clientId=...
// The client's montage photo list (same order the montage uses), with
// presigned thumbnail URLs — feeds the framing-adjustment strip in admin.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { getViewUrl } from '@/lib/r2';
import { orderedClientMedia } from '@/lib/clientTimeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const clientId = url.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });

  const db = createServiceClient();
  // Same canonical timeline order the render uses, so the framing strip's 1..N
  // numbers line up exactly with the montage's photo positions.
  const { media: data, error } = await orderedClientMedia(db, clientId, { imagesOnly: true });
  if (error) return NextResponse.json({ error: 'Could not load photos', detail: error.message }, { status: 500 });

  const photos = await Promise.all(
    (data || []).slice(0, 500).map(async (m, i) => ({
      index: i + 1,
      key: m.r2_key,
      filename: m.filename,
      url: await getViewUrl(m.r2_key, 3600),
    }))
  );
  return NextResponse.json({ photos });
}
