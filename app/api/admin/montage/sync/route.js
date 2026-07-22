// POST /api/admin/montage/sync  { montageId }
// Webhook-independent status check: asks Creatomate directly for the render's
// state and applies the same finishing logic the webhook would (archive to R2,
// mark ready/failed). Exists because webhooks can be missed — the render is
// the source of truth, not the phone call.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { getRender } from '@/lib/creatomate';
import { putFile } from '@/lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const { montageId } = body || {};
  if (!montageId) return NextResponse.json({ error: 'Missing montageId' }, { status: 400 });

  const db = createServiceClient();
  const { data: m, error: findErr } = await db
    .from('studio_montages')
    .select('id, client_id, render_id, status, r2_key')
    .eq('id', montageId)
    .single();
  if (findErr || !m) return NextResponse.json({ error: 'Montage not found' }, { status: 404 });
  if (!m.render_id) return NextResponse.json({ error: 'No render id on this montage' }, { status: 400 });

  let render;
  try {
    render = await getRender(m.render_id);
  } catch (e) {
    return NextResponse.json({ error: 'Could not reach Creatomate', detail: e.message }, { status: 502 });
  }

  if (render.status === 'succeeded' && render.url) {
    let r2Key = m.r2_key || null;
    if (!r2Key) {
      try {
        const res = await fetch(render.url);
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          const key = `studio/${m.client_id}/montages/${m.id}.mp4`;
          await putFile(key, buf, 'video/mp4');
          r2Key = key;
        }
      } catch (e) {
        console.error('Sync: R2 archive failed (keeping remote URL):', e.message);
      }
    }
    await db
      .from('studio_montages')
      .update({ status: 'ready', video_url: render.url, r2_key: r2Key, error: null, updated_at: new Date().toISOString() })
      .eq('id', m.id);
    return NextResponse.json({ ok: true, status: 'ready', archived: !!r2Key });
  }

  if (render.status === 'failed') {
    const reason = render.error_message || render.error || 'Render failed';
    await db
      .from('studio_montages')
      .update({ status: 'failed', error: String(reason).slice(0, 500), updated_at: new Date().toISOString() })
      .eq('id', m.id);
    return NextResponse.json({ ok: true, status: 'failed', error: reason });
  }

  return NextResponse.json({ ok: true, status: 'rendering' });
}
