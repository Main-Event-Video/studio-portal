// POST /api/admin/deliver
//   New send:  { clientId, key, filename, contentType, size, kind, note, version, sendTo }
//   Resend:    { clientId, resendId, note?, sendTo? }  — re-emails an existing cut, no re-upload
// GET  /api/admin/deliver?clientId=...  → this client's sent cuts (newest first) for
//                                         the red/green version buttons + resend list.
//
// The file is already in R2 (admin uploaded it via the presigned URL). This records
// it as studio_media, logs a studio_messages row, and emails a link.
//
// Watermarking of the video itself is NOT done here (the portal has no video
// processing). `version` is stored and surfaced in the email + resend list; a
// burned-in watermark is a separate, still-to-be-decided step.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { sendCutReady } from '@/lib/email';
import { getViewUrl } from '@/lib/r2';
import { createRender } from '@/lib/creatomate';
import { buildCutWatermarkSource } from '@/lib/watermarkCut';
import { makeShareToken, ensureSlug } from '@/lib/shareLink';

async function watchLinkFor(db, mediaId) {
  const shareBase = process.env.SHARE_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || '';
  try {
    const tok = (await ensureSlug(db, mediaId)) || makeShareToken(mediaId);
    return shareBase && tok ? `${shareBase}/s/${tok}` : '';
  } catch {
    return '';
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KINDS = ['rough_cut', 'final'];
const CUT_KINDS = ['rough_cut', 'final'];

function cleanVersion(v) {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s.slice(0, 24) : null;
}
// Resolve the final recipient string: the address(es) typed in "Send to"
// (comma/semicolon separated, validated), plus the client when ccClient is set.
// Empty result → the caller falls back to the client.
function resolveRecipients(sendToRaw, ccClient, client) {
  const typed = String(sendToRaw || '')
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter((s) => /\S+@\S+\.\S+/.test(s));
  if (!typed.length) return '';
  const list = ccClient ? [...typed, client.email] : typed;
  const seen = new Set();
  const out = [];
  for (const e of list) {
    const k = e.toLowerCase();
    if (e && !seen.has(k)) { seen.add(k); out.push(e); }
  }
  return out.join(', ');
}

// -------- GET: list this client's sent cuts (for auto-advance + resend) --------
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const clientId = new URL(request.url).searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });

  const db = createServiceClient();
  const run = (cols) =>
    db
      .from('studio_media')
      .select(cols)
      .eq('client_id', clientId)
      .in('kind', CUT_KINDS)
      .order('created_at', { ascending: false });

  // Prefer the version column; fall back gracefully if the migration hasn't run.
  let { data, error } = await run('id, kind, version, filename, created_at');
  if (error) ({ data, error } = await run('id, kind, filename, created_at'));
  if (error) return NextResponse.json({ error: 'Could not load cuts', detail: error.message }, { status: 500 });

  return NextResponse.json({ cuts: data || [] });
}

// -------- POST: new send OR resend --------
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const { clientId, resendId } = body || {};
  if (!clientId) return NextResponse.json({ error: 'Missing client' }, { status: 400 });

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

  const sendTo = resolveRecipients(body.sendTo, body.ccClient, client);
  const noteClean = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;

  // ---- RESEND: re-email an existing cut, no new upload/record ----
  if (resendId) {
    const { data: row, error: rErr } = await db
      .from('studio_media')
      .select('id, kind, version, filename')
      .eq('id', resendId)
      .eq('client_id', client.id)
      .single();
    if (rErr || !row) return NextResponse.json({ error: 'That cut was not found' }, { status: 404 });

    const watchUrl = await watchLinkFor(db, row.id);
    let emailed = false;
    let emailError = null;
    try {
      await sendCutReady({
        client,
        kind: row.kind,
        note: noteClean || '',
        version: row.version || '',
        to: sendTo || '',
        watchUrl,
      });
      emailed = true;
    } catch (e) {
      emailError = e?.message || 'Email failed';
    }

    await db.from('studio_messages').insert({
      client_id: client.id,
      subject: `${row.kind === 'final' ? 'Final' : 'Rough cut'}${row.version ? ` ${row.version}` : ''} resent${sendTo ? ` to ${sendTo}` : ''}`,
      note: noteClean,
    });

    return NextResponse.json({ ok: true, resent: true, emailed, emailError });
  }

  // ---- NEW SEND ----
  const { key, filename, contentType, size, kind } = body;
  if (!key || !filename) {
    return NextResponse.json({ error: 'Missing file info' }, { status: 400 });
  }
  if (!KINDS.includes(kind)) {
    return NextResponse.json({ error: 'kind must be rough_cut or final' }, { status: 400 });
  }
  const version = cleanVersion(body.version);

  // ROUGH CUT → watermark through Creatomate first. We track the render in
  // studio_cut_renders so the admin status-poll (not just the webhook) can complete
  // it: archive the stamped file, record it, and email the client. A clean cut can
  // never slip out — delivery only happens after the watermark is confirmed on.
  if (kind === 'rough_cut') {
    const durationSec = Number(body.durationSec) > 0 ? Number(body.durationSec) : null;
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
      // Tracking row FIRST so the webhook/poll have something to complete.
      const { data: cr, error: crErr } = await db
        .from('studio_cut_renders')
        .insert({
          client_id: client.id,
          status: 'rendering',
          version,
          filename,
          deliver_to: sendTo || null,
          note: noteClean,
          raw_key: key,
        })
        .select('id')
        .single();
      if (crErr || !cr) {
        return NextResponse.json({ error: 'Could not start watermarking', detail: crErr?.message || 'no tracking row' }, { status: 500 });
      }

      const videoUrl = await getViewUrl(key, 21600); // presigned source for Creatomate to fetch
      const source = buildCutWatermarkSource({
        videoUrl,
        logoUrl: `${siteUrl}/watermark.png`,
        version: version || '',
        durationSec,
      });
      const render = await createRender({
        source,
        webhookUrl: `${siteUrl}/api/webhooks/creatomate-cut`,
        metadata: cr.id, // the tracking-row id; webhook + poll resolve delivery from it
      });
      await db
        .from('studio_cut_renders')
        .update({ render_id: render.id, updated_at: new Date().toISOString() })
        .eq('id', cr.id);

      return NextResponse.json({ ok: true, watermarking: true, cutRenderId: cr.id });
    } catch (e) {
      return NextResponse.json({ error: 'Could not start watermarking', detail: e?.message || String(e) }, { status: 500 });
    }
  }

  // FINAL → clean, full-res, delivered immediately (no render).
  const record = {
    client_id: client.id,
    kind,
    r2_key: key,
    filename,
    content_type: contentType || null,
    size_bytes: Number.isFinite(size) ? size : null,
    watermarked: false, // finals are clean
    note: noteClean,
    version,
  };

  let ins = await db.from('studio_media').insert(record).select('id').single();
  // If the `version` column doesn't exist yet, still deliver — just drop it.
  if (ins.error && /version/i.test(ins.error.message || '')) {
    delete record.version;
    ins = await db.from('studio_media').insert(record).select('id').single();
  }
  if (ins.error || !ins.data) {
    return NextResponse.json(
      { error: 'Could not save the media record', detail: ins.error?.message },
      { status: 500 }
    );
  }

  await db.from('studio_messages').insert({
    client_id: client.id,
    subject: `${kind === 'final' ? 'Final video delivered' : 'Rough cut sent'}${version ? ` (${version})` : ''}${sendTo ? ` to ${sendTo}` : ''}`,
    note: noteClean,
  });

  const watchUrl = await watchLinkFor(db, ins.data.id);
  let emailed = false;
  let emailError = null;
  try {
    await sendCutReady({ client, kind, note: noteClean || '', version: version || '', to: sendTo || '', watchUrl });
    emailed = true;
  } catch (e) {
    emailError = e?.message || 'Email failed';
  }

  return NextResponse.json({ ok: true, emailed, emailError });
}
