// POST /api/webhooks/creatomate-cut — called BY CREATOMATE when a rough-cut
// WATERMARK render finishes. Separate from the montage webhook so it can't disturb
// that flow. Same security model: never trust the posted body — take only the render
// id, re-fetch from Creatomate, treat that as truth.
//
// The delivery details ride along in the render's `metadata` (JSON): client, version,
// recipient, note, original filename, and the raw uploaded key. We only create the
// studio_media row (and email the client) once the watermark actually succeeds — so a
// clean, un-watermarked cut can never reach the client. Any failure alerts Josh
// instead of delivering.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { getRender } from '@/lib/creatomate';
import { putFile, deleteFile } from '@/lib/r2';
import { sendCutReady, sendCutWatermarkFailed } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // room to copy the 720p file into R2

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const claimed = Array.isArray(body) ? body[0] : body;
  if (!claimed?.id) return NextResponse.json({ error: 'No render ID' }, { status: 400 });

  // Verify with Creatomate — the posted body could be forged.
  let render;
  try {
    render = await getRender(claimed.id);
  } catch (e) {
    console.error('Cut webhook: could not verify render', claimed.id, e.message);
    return NextResponse.json({ error: 'Render not found' }, { status: 400 });
  }

  const { status, url, metadata } = render;
  let meta = {};
  try { meta = JSON.parse(metadata || '{}'); } catch { /* not ours */ }
  if (meta.t !== 'cut' || !meta.clientId) {
    return NextResponse.json({ error: 'Not a cut render' }, { status: 400 });
  }

  const db = createServiceClient();
  const { data: client } = await db
    .from('studio_clients')
    .select('id, display_name, email, portal_token')
    .eq('id', meta.clientId)
    .single();
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 400 });

  const versionLabel = meta.version || '';

  // ---- FAILED render → alert Josh, deliver nothing ----
  if (status === 'failed') {
    const reason = render.error_message || render.error || 'Render failed';
    try {
      await sendCutWatermarkFailed({ client, version: versionLabel, error: String(reason), rawKey: meta.rawKey || '' });
    } catch (e) {
      console.error('Cut webhook: failure alert could not send', e.message);
    }
    console.error('Cut watermark failed:', meta.clientId, versionLabel, reason);
    return NextResponse.json({ received: true, failed: true });
  }

  if (status !== 'succeeded' || !url) {
    // Still processing / no output — nothing to do yet.
    return NextResponse.json({ received: true });
  }

  // ---- SUCCEEDED → archive the watermarked MP4 into R2 ----
  let r2Key = null;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      const key = `studio/${client.id}/cuts/${claimed.id}.mp4`;
      await putFile(key, buf, 'video/mp4');
      r2Key = key;
    } else {
      console.error('Cut webhook: watermarked download failed', res.status);
    }
  } catch (e) {
    console.error('Cut webhook: R2 archive failed:', e.message);
  }

  // If we couldn't store the finished file, treat it like a failure — never leave
  // the client with a broken/unviewable link. Alert Josh with the render URL.
  if (!r2Key) {
    try {
      await sendCutWatermarkFailed({
        client, version: versionLabel,
        error: 'Watermarking succeeded but the finished file could not be saved to storage.',
        rawKey: meta.rawKey || '', renderUrl: url,
      });
    } catch (e) { console.error('Cut webhook: archive-fail alert could not send', e.message); }
    return NextResponse.json({ received: true, archiveFailed: true });
  }

  // Record the delivered (watermarked) cut now that it's real.
  const record = {
    client_id: client.id,
    kind: 'rough_cut',
    r2_key: r2Key,
    filename: meta.filename || 'cut.mp4',
    content_type: 'video/mp4',
    watermarked: true,
    note: meta.note || null,
    version: versionLabel || null,
  };
  let { error: insErr } = await db.from('studio_media').insert(record);
  if (insErr && /version/i.test(insErr.message || '')) {
    delete record.version;
    ({ error: insErr } = await db.from('studio_media').insert(record));
  }
  if (insErr) {
    console.error('Cut webhook: media insert failed', insErr.message);
    return NextResponse.json({ error: 'DB insert failed' }, { status: 500 }); // let Creatomate retry
  }

  // Log + email the client (to the override recipient if one was set).
  await db.from('studio_messages').insert({
    client_id: client.id,
    subject: `Rough cut sent${versionLabel ? ` (${versionLabel})` : ''}${meta.deliverTo ? ` to ${meta.deliverTo}` : ''}`,
    note: meta.note || null,
  });

  try {
    await sendCutReady({ client, kind: 'rough_cut', note: meta.note || '', version: versionLabel, to: meta.deliverTo || '' });
  } catch (e) {
    console.error('Cut webhook: client email failed', e.message);
    // The cut IS saved and watermarked; email can be retried by resending from the tool.
  }

  // Best-effort: drop the raw (un-watermarked) upload now that the stamped copy is stored.
  if (meta.rawKey) {
    try { await deleteFile(meta.rawKey); } catch { /* orphan is harmless */ }
  }

  return NextResponse.json({ received: true, ok: true });
}
