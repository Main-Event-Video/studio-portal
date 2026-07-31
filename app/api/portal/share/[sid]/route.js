// GET /api/portal/share/<sid>
// A DURABLE public link to a delivered file. The client (or a vendor they
// forwarded it to) opens it and gets a fresh forced-download of the file — no
// login needed. Only delivered cuts (rough_cut/final) are shareable, never a
// client upload. The token is HMAC-signed so ids can't be forged or enumerated.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { getDownloadUrl } from '@/lib/r2';
import { verifyShareToken } from '@/lib/shareLink';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const mediaId = verifyShareToken(params?.sid);
  if (!mediaId) return NextResponse.json({ error: 'This link is invalid.' }, { status: 404 });

  const db = createServiceClient();
  const { data: m } = await db
    .from('studio_media')
    .select('id, filename, r2_key, kind')
    .eq('id', mediaId)
    .single();

  if (!m || !m.r2_key || !['rough_cut', 'final'].includes(m.kind)) {
    return NextResponse.json({ error: 'This file is no longer available.' }, { status: 404 });
  }

  // Fresh presigned download (Content-Disposition: attachment) every open, so the
  // durable link keeps working long after any single presigned URL expires.
  const url = await getDownloadUrl(m.r2_key, m.filename || 'main-event-studio', 3600);
  return NextResponse.redirect(url, 302);
}
