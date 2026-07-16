// POST /api/admin/deliver
//   { clientId, key, filename, contentType, size, kind, note }
// Step 6 — the delivery flow. The file is already in R2 (admin uploaded it via
// the presigned URL). This records it as studio_media, logs a studio_messages
// row, and emails the client that a cut is ready. The video shows up in their
// existing "View" door.
//
// Watermarking is handled by Josh on export (rough cuts carry the logo, final
// delivery is clean full-res) — nothing here processes video.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { sendCutReady } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KINDS = ['rough_cut', 'final'];

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const { clientId, key, filename, contentType, size, kind, note } = body || {};
  if (!clientId || !key || !filename) {
    return NextResponse.json({ error: 'Missing file info' }, { status: 400 });
  }
  if (!KINDS.includes(kind)) {
    return NextResponse.json({ error: 'kind must be rough_cut or final' }, { status: 400 });
  }

  const db = createServiceClient();

  const { data: client, error: findErr } = await db
    .from('studio_clients')
    .select('id, display_name, email, portal_token, archived')
    .eq('id', clientId)
    .single();

  if (findErr || !client) {
    return NextResponse.json({ error: 'Client not found', detail: findErr?.message }, { status: 404 });
  }
  if (client.archived) {
    return NextResponse.json({ error: 'That client is archived' }, { status: 400 });
  }

  const noteClean = typeof note === 'string' && note.trim() ? note.trim() : null;

  const { error: mediaErr } = await db.from('studio_media').insert({
    client_id: client.id,
    kind,
    r2_key: key,
    filename,
    content_type: contentType || null,
    size_bytes: Number.isFinite(size) ? size : null,
    watermarked: kind === 'rough_cut', // record of intent; Josh burns it in on export
    note: noteClean,
  });

  if (mediaErr) {
    return NextResponse.json(
      { error: 'Could not save the media record', detail: mediaErr.message },
      { status: 500 }
    );
  }

  // Log the send (studio_messages exists for exactly this).
  await db.from('studio_messages').insert({
    client_id: client.id,
    subject: kind === 'final' ? 'Final video delivered' : 'Rough cut sent',
    note: noteClean,
  });

  // Send the notification. The record is already saved, so if email fails we
  // report it rather than failing the whole request — Josh can resend.
  let emailed = false;
  let emailError = null;
  try {
    await sendCutReady({ client, kind, note: noteClean || '' });
    emailed = true;
  } catch (e) {
    emailError = e?.message || 'Email failed';
  }

  return NextResponse.json({ ok: true, emailed, emailError });
}
