// POST /api/portal/forward  { token, mediaId, vendorEmail, note }
// A signed-in client forwards one of their delivered files to a vendor: we email
// the vendor a durable download link (+ optional note). Replies go back to the
// client. Only the client's own delivered cuts can be forwarded.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { getClientByToken } from '@/lib/portal';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { makeShareToken } from '@/lib/shareLink';
import { sendVendorForward } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }); }
  const { token, mediaId, vendorEmail, note } = body || {};
  if (!token || !mediaId || !vendorEmail) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: 'Portal not found' }, { status: 404 });
  const authed = verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (authed !== client.id) return NextResponse.json({ error: 'Please sign in again' }, { status: 401 });

  const email = String(vendorEmail).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });

  // The file must belong to THIS client and be a delivered cut (never an upload).
  const db = createServiceClient();
  const { data: m } = await db
    .from('studio_media')
    .select('id, filename, kind, client_id')
    .eq('id', mediaId)
    .single();
  if (!m || m.client_id !== client.id || !['rough_cut', 'final'].includes(m.kind)) {
    return NextResponse.json({ error: 'File not found.' }, { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const shareUrl = `${origin}/api/portal/share/${makeShareToken(m.id)}`;
  try {
    await sendVendorForward({
      client,
      vendorEmail: email,
      note: String(note || '').slice(0, 1000),
      fileName: m.filename || '',
      shareUrl,
    });
  } catch (e) {
    return NextResponse.json({ error: 'Could not send the email.', detail: e?.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
