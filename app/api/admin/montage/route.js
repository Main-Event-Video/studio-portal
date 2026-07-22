// POST /api/admin/montage  { clientId, title, subtitle, watermark }
//   → builds the render from the client's uploaded PHOTOS (in folder+number
//     order), submits to Creatomate, tracks it in studio_montages.
// GET  /api/admin/montage
//   → list renders (admin panel status list) with playable URLs.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { getViewUrl } from '@/lib/r2';
import { buildMontageSource, STYLES } from '@/lib/montage';
import { createRender } from '@/lib/creatomate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PHOTOS = 100; // spine cap: keeps renders + credits sane

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { clientId, title, subtitle, watermark = true, style = 'hollywood', photoSeconds = null } = body || {};
  if (photoSeconds != null && !(Number(photoSeconds) >= 1 && Number(photoSeconds) <= 10)) {
    return NextResponse.json({ error: 'photoSeconds must be 1–10' }, { status: 400 });
  }
  if (!clientId || !title) {
    return NextResponse.json({ error: 'clientId and title are required' }, { status: 400 });
  }
  if (!STYLES[style]) {
    return NextResponse.json({ error: 'Unknown style' }, { status: 400 });
  }

  const db = createServiceClient();
  const { data: client, error: cErr } = await db
    .from('studio_clients')
    .select('id, display_name, archived')
    .eq('id', clientId)
    .single();
  if (cErr || !client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  if (client.archived) return NextResponse.json({ error: 'That client is archived' }, { status: 400 });

  // The client's uploaded PHOTOS, in their folder + numbering order — the
  // same order the portal shows. Videos are excluded from the spine.
  const { data: media, error: mErr } = await db
    .from('studio_media')
    .select('r2_key, filename, folder_path, sort_number, content_type')
    .eq('client_id', clientId)
    .eq('kind', 'client_upload')
    .like('content_type', 'image/%')
    .order('folder_path', { ascending: true, nullsFirst: true })
    .order('sort_number', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });
  if (mErr) return NextResponse.json({ error: 'Could not load photos', detail: mErr.message }, { status: 500 });

  const list = (media || []).slice(0, MAX_PHOTOS);
  if (list.length < 2) {
    return NextResponse.json(
      { error: `Not enough photos — this client has ${list.length} image upload(s). Upload photos first.` },
      { status: 400 }
    );
  }

  // Track the job first so the webhook has a row to update.
  const { data: row, error: insErr } = await db
    .from('studio_montages')
    .insert({
      client_id: client.id,
      style,
      title,
      subtitle: subtitle || null,
      status: 'queued',
      photo_count: list.length,
      watermarked: !!watermark,
    })
    .select('id')
    .single();
  if (insErr) return NextResponse.json({ error: 'Could not track render', detail: insErr.message }, { status: 500 });

  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    // Long-lived presigned URLs — Creatomate fetches these while rendering.
    const photos = await Promise.all(
      list.map(async (m) => ({ url: await getViewUrl(m.r2_key, 21600) }))
    );

    const source = buildMontageSource({
      photos,
      style,
      photoSeconds: photoSeconds ? Number(photoSeconds) : null,
      title: String(title).toUpperCase(),
      subtitle: subtitle ? String(subtitle).toUpperCase() : null,
      watermarkUrl: watermark ? `${siteUrl}/logo.png` : null,
    });

    const render = await createRender({
      source,
      webhookUrl: `${siteUrl}/api/webhooks/creatomate`,
      metadata: row.id, // webhook looks the row up by this
    });

    await db
      .from('studio_montages')
      .update({ status: 'rendering', render_id: render.id, updated_at: new Date().toISOString() })
      .eq('id', row.id);

    return NextResponse.json({ ok: true, montageId: row.id, renderId: render.id });
  } catch (e) {
    await db
      .from('studio_montages')
      .update({ status: 'failed', error: String(e.message || e).slice(0, 500), updated_at: new Date().toISOString() })
      .eq('id', row.id);
    return NextResponse.json({ error: 'Render failed to start', detail: e.message }, { status: 500 });
  }
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = createServiceClient();
  const { data, error } = await db
    .from('studio_montages')
    .select('id, client_id, style, title, subtitle, status, video_url, r2_key, error, photo_count, watermarked, created_at, studio_clients(display_name)')
    .order('created_at', { ascending: false })
    .limit(25);
  if (error) return NextResponse.json({ error: 'Could not load renders', detail: error.message }, { status: 500 });

  const montages = await Promise.all(
    (data || []).map(async (m) => ({
      id: m.id,
      client: m.studio_clients?.display_name || '—',
      style: m.style,
      title: m.title,
      status: m.status,
      error: m.error,
      photoCount: m.photo_count,
      watermarked: m.watermarked,
      createdAt: m.created_at,
      // Prefer our permanent R2 copy; fall back to Creatomate's temp URL.
      url: m.r2_key ? await getViewUrl(m.r2_key, 3600) : m.video_url || null,
      archived: !!m.r2_key, // false = still only on Creatomate's 30-day hosting
    }))
  );
  return NextResponse.json({ montages });
}
