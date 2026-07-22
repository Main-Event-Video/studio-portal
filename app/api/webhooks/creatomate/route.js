// POST /api/webhooks/creatomate — called BY CREATOMATE when a render finishes.
// Security model copied from MEvid's working webhook: Creatomate does not sign
// webhook calls, so NEVER trust the posted body. Take only the render id from
// it, re-fetch the render from Creatomate with our API key, and treat THAT as
// the source of truth (status, url, metadata).
//
// On success we immediately copy the MP4 into our R2 (Creatomate deletes its
// copy after ~30 days — verified from their docs). If the copy fails (big file
// vs serverless limits), the montage still goes 'ready' with the remote URL,
// and the admin list shows it as not-yet-archived.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { getRender } from '@/lib/creatomate';
import { putFile } from '@/lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // give the R2 copy room (Vercel allows up to 60s)

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
    console.error('Webhook: could not verify render', claimed.id, e.message);
    return NextResponse.json({ error: 'Render not found' }, { status: 400 });
  }

  const { id: renderId, status, url, metadata: montageId } = render;
  if (!montageId) return NextResponse.json({ error: 'No montage id in metadata' }, { status: 400 });

  const db = createServiceClient();
  const { data: montage, error: findErr } = await db
    .from('studio_montages')
    .select('id, client_id, render_id')
    .eq('id', montageId)
    .single();
  if (findErr || !montage) {
    console.error('Webhook: montage row not found', montageId);
    return NextResponse.json({ error: 'Montage not found' }, { status: 400 });
  }

  if (status === 'succeeded' && url) {
    // Try to archive to R2 right now. Best-effort: a failure must not lose
    // the render — we keep the remote URL either way.
    let r2Key = null;
    try {
      const res = await fetch(url);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const key = `studio/${montage.client_id}/montages/${montage.id}.mp4`;
        await putFile(key, buf, 'video/mp4');
        r2Key = key;
      } else {
        console.error('Webhook: render download failed', res.status);
      }
    } catch (e) {
      console.error('Webhook: R2 archive failed (keeping remote URL):', e.message);
    }

    const { error: updErr } = await db
      .from('studio_montages')
      .update({
        status: 'ready',
        render_id: renderId,
        video_url: url,
        r2_key: r2Key,
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', montageId);
    if (updErr) {
      console.error('Webhook DB update failed:', updErr.message);
      // 500 so Creatomate retries rather than dropping the event.
      return NextResponse.json({ error: 'DB update failed' }, { status: 500 });
    }
  } else if (status === 'failed') {
    const reason = render.error_message || render.error || 'Render failed';
    await db
      .from('studio_montages')
      .update({
        status: 'failed',
        render_id: renderId,
        error: String(reason).slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq('id', montageId);
    console.error('Montage render failed:', montageId, reason);
  }

  return NextResponse.json({ received: true });
}
