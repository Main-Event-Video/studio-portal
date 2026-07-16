// POST /api/admin/upload-url  { clientId, contentType }
// Admin-gated presigned PUT so Josh's browser uploads a cut straight to R2
// (big video files never touch Vercel). Same key scheme as client uploads.
import { NextResponse } from 'next/server';
import { getUploadUrl } from '@/lib/r2';
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

  const { clientId, contentType } = body || {};
  if (!clientId || !contentType) {
    return NextResponse.json({ error: 'Missing client or file info' }, { status: 400 });
  }

  try {
    const { url, key } = await getUploadUrl(clientId, contentType);
    return NextResponse.json({ url, key });
  } catch (e) {
    return NextResponse.json({ error: 'Could not start upload', detail: e.message }, { status: 500 });
  }
}
