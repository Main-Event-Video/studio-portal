// POST /api/admin/montage  { clientId, title, subtitle, watermark }
//   → builds the render from the client's uploaded PHOTOS (in folder+number
//     order), submits to Creatomate, tracks it in studio_montages.
// GET  /api/admin/montage
//   → list renders (admin panel status list) with playable URLs.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { getViewUrl, getDownloadUrl } from '@/lib/r2';
import { buildMontageSource, STYLES, parsePhotoSpec } from '@/lib/montage';
import { createRender } from '@/lib/creatomate';
import { orderedClientTimeline } from '@/lib/clientTimeline';
import { isHeic } from '@/lib/heic';

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
  const { clientId, title, subtitle, watermark = true, style = 'hollywood', photoSeconds = null, adjustments = {}, photoSpec = null, includeCards = true, videoPlaceholders = true } = body || {};
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
    .select('id, display_name, archived, photo_edits')
    .eq('id', clientId)
    .single();
  if (cErr || !client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  if (client.archived) return NextResponse.json({ error: 'That client is archived' }, { status: 400 });

  // Per-client Photo Editor edits (from studio_clients.photo_edits) — applied to
  // EVERY render for this client, whatever style is chosen. Default framing is
  // TOP (keep heads); a per-render Fix-framing adjustment still overrides it.
  const pe = client.photo_edits && typeof client.photo_edits === 'object' ? client.photo_edits : {};
  const pePhotos = pe.photos && typeof pe.photos === 'object' ? pe.photos : {};
  const editFor = (k) => {
    const e = pePhotos[k] || {};
    return {
      anchor: ['top', 'center', 'bottom'].includes(e.anchor) ? e.anchor : 'top',
      fit: e.fit === 'fill' ? 'fill' : 'fit',
      size: Math.min(140, Math.max(60, Number(e.size) || 100)),
      removed: !!e.removed,
      colorCorrect: !!e.colorCorrect,
      mode: ['color', 'bw', 'sepia'].includes(e.mode) ? e.mode : 'color',
      contrast: Number.isFinite(Number(e.contrast)) ? Math.min(200, Math.max(50, Math.round(Number(e.contrast)))) : 100,
      saturation: Number.isFinite(Number(e.saturation)) ? Math.min(200, Math.max(0, Math.round(Number(e.saturation)))) : 100,
      posX: Number.isFinite(Number(e.posX)) ? Number(e.posX) : null,
      posY: Number.isFinite(Number(e.posY)) ? Number(e.posY) : null,
    };
  };
  const photoObj = (k) => {
    const e = editFor(k);
    return { type: 'photo', r2_key: k, framing: (adjustments && adjustments[k]) || e.anchor, fit: e.fit, size: e.size, colorCorrect: e.colorCorrect, mode: e.mode, contrast: e.contrast, saturation: e.saturation, posX: e.posX, posY: e.posY };
  };

  // Full timeline (photos + videos) in play order. Photos define the 1..N
  // numbering the admin strip uses; each video becomes a green-screen placeholder
  // the editor keys their real clip into.
  const { items: timelineItems, error: mErr } = await orderedClientTimeline(db, clientId);
  if (mErr) return NextResponse.json({ error: 'Could not load media', detail: mErr.message }, { status: 500 });
  const photosAll = (timelineItems || []).filter((m) => (m.content_type || '').startsWith('image/') && !isHeic({ filename: m.filename, contentType: m.content_type }));
  if (photosAll.length < 1) {
    return NextResponse.json(
      { error: 'This client has no photo uploads yet. Upload photos first.' },
      { status: 400 }
    );
  }

  // Which photos this segment uses (blank spec = all), 1-based, in play order.
  const indexes = parsePhotoSpec(photoSpec, photosAll.length);
  const selected = new Set(indexes);
  const ascending = indexes.every((v, i) => i === 0 || v > indexes[i - 1]);

  // Build the play sequence. When placeholders are on AND the selection is in
  // natural order, walk the timeline and drop a green gap at each video slot
  // (trimming leading/trailing gaps). Otherwise fall back to the exact spec
  // order with photos only (preserves the reorder-spec behavior).
  const wantGaps = videoPlaceholders !== false && ascending && indexes.length > 0;
  let sequence;
  if (wantGaps) {
    const numByKey = new Map();
    photosAll.forEach((p, i) => numByKey.set(p.r2_key, i + 1));
    sequence = [];
    for (const it of timelineItems) {
      const ct = it.content_type || '';
      if (ct.startsWith('image/')) {
        const num = numByKey.get(it.r2_key);
        if (selected.has(num) && !editFor(it.r2_key).removed) sequence.push(photoObj(it.r2_key));
      } else if (ct.startsWith('video/')) {
        sequence.push({ type: 'placeholder', name: it.filename });
      }
    }
    while (sequence.length && sequence[0].type === 'placeholder') sequence.shift();
    while (sequence.length && sequence[sequence.length - 1].type === 'placeholder') sequence.pop();
  } else {
    sequence = indexes.map((i) => photosAll[i - 1]).filter(Boolean)
      .filter((m) => !editFor(m.r2_key).removed)
      .map((m) => photoObj(m.r2_key));
  }

  const photoItems = sequence.filter((s) => s.type === 'photo');
  const gapCount = sequence.length - photoItems.length;
  if (photoItems.length < 1) {
    return NextResponse.json(
      { error: `Your photo selection didn't match any of this client's ${photosAll.length} photos — check the numbers.` },
      { status: 400 }
    );
  }
  if (photoItems.length > MAX_PHOTOS) {
    return NextResponse.json(
      { error: `This segment selects ${photoItems.length} photos; the max per render is ${MAX_PHOTOS}. Split it into more segments.` },
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
      photo_count: photoItems.length,
      watermarked: !!watermark,
      params: {
        photoSeconds: photoSeconds ? Number(photoSeconds) : null,
        adjustments: adjustments && typeof adjustments === 'object' ? adjustments : {},
        // Photo selection for this segment: the raw expression (for display) and
        // the resolved 1-based positions (for exact re-renders). Blank = all.
        photoSpec: photoSpec ? String(photoSpec).trim() : null,
        photoIndexes: indexes,
        includeCards: includeCards !== false,
        videoPlaceholders: videoPlaceholders !== false,
        videoGaps: gapCount,
        colorCorrect: !!pe.colorCorrect,
      },
    })
    .select('id')
    .single();
  if (insErr) return NextResponse.json({ error: 'Could not track render', detail: insErr.message }, { status: 500 });

  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    // Long-lived presigned URLs — Creatomate fetches these while rendering.
    // Placeholders carry only a name (a green gap the editor keys their clip into).
    const items = await Promise.all(
      sequence.map(async (s) => (
        s.type === 'photo'
          ? { type: 'photo', url: await getViewUrl(s.r2_key, 21600), framing: s.framing, fit: s.fit, size: s.size, colorCorrect: s.colorCorrect, mode: s.mode, contrast: s.contrast, saturation: s.saturation, posX: s.posX, posY: s.posY }
          : { type: 'placeholder', name: s.name }
      ))
    );

    const source = buildMontageSource({
      items,
      style,
      photoSeconds: photoSeconds ? Number(photoSeconds) : null,
      includeCards: includeCards !== false,
      title: String(title).toUpperCase(),
      subtitle: subtitle ? String(subtitle).toUpperCase() : null,
      watermarkUrl: watermark ? `${siteUrl}/watermark.png` : null,
      assetBase: siteUrl || null,   // for collage light-leak overlays (public/overlays/*)
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
    .select('id, client_id, style, title, subtitle, status, video_url, r2_key, error, photo_count, watermarked, params, created_at, studio_clients(display_name)')
    .order('created_at', { ascending: false })
    .limit(25);
  if (error) return NextResponse.json({ error: 'Could not load renders', detail: error.message }, { status: 500 });

  const montages = await Promise.all(
    (data || []).map(async (m) => ({
      id: m.id,
      clientId: m.client_id,
      client: m.studio_clients?.display_name || '—',
      style: m.style,
      title: m.title,
      subtitle: m.subtitle,
      photoSeconds: m.params?.photoSeconds || null,
      adjustments: m.params?.adjustments || {},
      photoSpec: m.params?.photoSpec || null,
      includeCards: m.params?.includeCards !== false,
      hidden: m.params?.hidden === true,
      status: m.status,
      error: m.error,
      photoCount: m.photo_count,
      watermarked: m.watermarked,
      createdAt: m.created_at,
      // Prefer our permanent R2 copy; fall back to Creatomate's temp URL.
      url: m.r2_key ? await getViewUrl(m.r2_key, 3600) : m.video_url || null,
      // Force-download URL (Content-Disposition: attachment) so "Download MP4"
      // saves to a folder instead of navigating to the video (cross-origin
      // `download` is ignored by browsers). Only available for our R2 copies.
      downloadUrl: m.r2_key
        ? await getDownloadUrl(m.r2_key, `${(m.studio_clients?.display_name || 'montage').replace(/[^\w-]+/g, '_')}_${m.style}_${m.photo_count || 0}_${(m.created_at || '').slice(0, 10)}.mp4`, 3600)
        : null,
      archived: !!m.r2_key, // false = still only on Creatomate's 30-day hosting
    }))
  );
  return NextResponse.json({ montages });
}
