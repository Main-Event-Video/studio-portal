// POST /api/admin/deliver-set
//   { clientId, files: [{ key, filename, contentType, size }], note, sendTo, ccClient }
// Delivers MULTIPLE finals (e.g. different aspect ratios) as ONE set: each file is
// recorded with a shared set_id, and a single email links to one no-login page that
// lists them all. Finals only (clean, full-res) — no watermark, so it's immediate.
// Filenames are kept exactly as uploaded (they are the labels).
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { sendFinalSetReady } from '@/lib/email';
import { makeShareToken } from '@/lib/shareLink';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILES = 8;

function resolveRecipients(sendToRaw, ccClient, client) {
  const typed = String(sendToRaw || '')
    .split(/[,;]+/).map((s) => s.trim()).filter((s) => /\S+@\S+\.\S+/.test(s));
  if (!typed.length) return '';
  const list = ccClient ? [...typed, client.email] : typed;
  const seen = new Set();
  const out = [];
  for (const e of list) { const k = e.toLowerCase(); if (e && !seen.has(k)) { seen.add(k); out.push(e); } }
  return out.join(', ');
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }); }

  const { clientId, files } = body || {};
  if (!clientId || !Array.isArray(files) || !files.length) {
    return NextResponse.json({ error: 'Missing client or files' }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Too many files at once (max ${MAX_FILES}).` }, { status: 400 });
  }

  const db = createServiceClient();
  const { data: client, error: findErr } = await db
    .from('studio_clients')
    .select('id, display_name, email, portal_token, archived')
    .eq('id', clientId).single();
  if (findErr || !client) return NextResponse.json({ error: 'Client not found', detail: findErr?.message }, { status: 404 });
  if (client.archived) return NextResponse.json({ error: 'That client is archived' }, { status: 400 });

  const noteClean = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;
  const setId = crypto.randomUUID();

  const rows = files
    .filter((f) => f && f.key && f.filename)
    .map((f) => ({
      client_id: client.id,
      kind: 'final',
      r2_key: f.key,
      filename: f.filename,
      content_type: f.contentType || null,
      size_bytes: Number.isFinite(f.size) ? f.size : null,
      watermarked: false,
      note: noteClean,
      set_id: setId,
    }));
  if (!rows.length) return NextResponse.json({ error: 'No valid files' }, { status: 400 });

  const { error: insErr } = await db.from('studio_media').insert(rows);
  if (insErr && /set_id/i.test(insErr.message || '')) {
    return NextResponse.json({ error: 'Multi-file delivery needs a one-time database update — run the set_id SQL, then try again.' }, { status: 500 });
  }
  if (insErr) return NextResponse.json({ error: 'Could not save the files', detail: insErr.message }, { status: 500 });

  const to = resolveRecipients(body.sendTo, body.ccClient, client);
  const shareBase = process.env.SHARE_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || '';
  const watchUrl = shareBase ? `${shareBase}/set/${makeShareToken(setId)}` : '';

  await db.from('studio_messages').insert({
    client_id: client.id,
    subject: `Final videos delivered (${rows.length})${to ? ` to ${to}` : ''}`,
    note: noteClean,
  });

  let emailed = false;
  let emailError = null;
  try {
    await sendFinalSetReady({ client, count: rows.length, note: noteClean || '', to, watchUrl });
    emailed = true;
  } catch (e) {
    emailError = e?.message || 'Email failed';
  }

  return NextResponse.json({ ok: true, emailed, emailError, count: rows.length, setId });
}
