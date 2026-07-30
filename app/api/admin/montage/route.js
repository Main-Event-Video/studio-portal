// POST /api/admin/montage  { clientId, title, subtitle, watermark }
//   → builds the render from the client's uploaded PHOTOS (in folder+number
//     order), submits to Creatomate, tracks it in studio_montages.
// GET  /api/admin/montage
//   → list renders (admin panel status list) with playable URLs.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { getViewUrl, getDownloadUrl } from '@/lib/r2';
import { buildMontageSource, STYLES, parsePhotoSpec, styleNeedsDims } from '@/lib/montage';
import { createRender } from '@/lib/creatomate';
import { orderedClientTimeline } from '@/lib/clientTimeline';
import { isHeic } from '@/lib/heic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PHOTOS = 100; // spine cap: keeps renders + credits sane

// Read a photo's real pixel dimensions from just its header bytes, so the
// tiled/print styles can give a portrait its own tall cell (native shape). Range
// fetch keeps it cheap (no full download); sharp parses the header; EXIF
// orientation 5–8 means the displayed image is rotated 90°, so its aspect swaps.
// Fully guarded: any failure (sharp missing, truncated header, odd format) just
// returns null and the style falls back to treating the photo as landscape.
async function probeDims(url) {
  try {
    const sharp = (await import('sharp')).default;
    const res = await fetch(url, { headers: { Range: 'bytes=0-262143' } });
    if (!res.ok && res.status !== 206) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const md = await sharp(buf).metadata();
    if (md && md.width && md.height) {
      const rot = md.orientation >= 5 && md.orientation <= 8;
      return { w: rot ? md.height : md.width, h: rot ? md.width : md.height };
    }
  } catch { /* unknown → caller defaults to landscape */ }
  return null;
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { clientId, title, subtitle, watermark = true, style = 'hollywood', photoSeconds = null, totalSeconds = null, adjustments = {}, photoSpec = null, album = null, includeCards = true, videoPlaceholders = true, greenScreen = true, background = null, mpTransition = null, mpStagger = null, mpHold = null, mpSpeed = null } = body || {};
  // "Add background" control: keyable green-screen (default) or an imported image
  // + tint/opacity. Sanitised to a small known shape; null = the style's own bg.
  // Built-in animated textures live in public/backgrounds/<name>.jpg.
  const TEXTURES = { soft_focus: 1, linen: 1, gradient: 1 };
  const bgControl = (background && typeof background === 'object')
    ? {
        green: !!background.green,
        // built-in texture (name only; URL resolved at render time from siteUrl)
        texture: (background.texture && TEXTURES[background.texture]) ? String(background.texture) : null,
        animated: background.animated !== false,   // textures drift by default
        url: background.url ? String(background.url) : null,
        tint: background.tint ? String(background.tint) : null,
        opacity: background.opacity ? String(background.opacity) : null,
        blur: Number.isFinite(Number(background.blur)) ? Number(background.blur) : null,
      }
    : null;
  if (photoSeconds != null && !(Number(photoSeconds) >= 1 && Number(photoSeconds) <= 10)) {
    return NextResponse.json({ error: 'photoSeconds must be 1–10' }, { status: 400 });
  }
  // Total-length mode: photos cycle to fit this many seconds (overrides seconds/photo).
  if (totalSeconds != null && !(Number(totalSeconds) >= 3 && Number(totalSeconds) <= 1800)) {
    return NextResponse.json({ error: 'totalSeconds must be 3–1800' }, { status: 400 });
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
      // null = unset (let the style default decide: Party 2 fills+drifts, others
      // fit). An explicit 'fit'/'fill' from the editor always wins in montage.js.
      fit: e.fit === 'fill' ? 'fill' : e.fit === 'fit' ? 'fit' : null,
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
    const adj = adjustments && adjustments[k] != null ? adjustments[k] : undefined; // number 0 (slider top) must survive
    return { type: 'photo', r2_key: k, framing: adj != null ? adj : e.anchor, fit: e.fit, size: e.size, colorCorrect: e.colorCorrect, mode: e.mode, contrast: e.contrast, saturation: e.saturation, posX: e.posX, posY: e.posY };
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

  // Stable per-client render NUMBER, stamped at creation so it never shifts or
  // recycles when other renders are removed. The old number was recomputed by
  // position on every read, so deleting/re-rendering reshuffled it and exports
  // collected duplicate ###'s. next = 1 + the highest number already in use.
  let nextSeq = 1;
  try {
    const { data: prior } = await db.from('studio_montages').select('params').eq('client_id', client.id);
    // Only PRIMARY renders (not Export re-renders) consume numbers, so exports
    // sharing a draft's number can't inflate the next draft's number.
    let maxStored = 0, primaryCount = 0;
    for (const p of prior || []) {
      if (p?.params?.rerenderOf) continue;
      primaryCount++;
      const s = Number(p?.params?.seq); if (Number.isFinite(s)) maxStored = Math.max(maxStored, s);
    }
    nextSeq = Math.max(maxStored, primaryCount) + 1;
  } catch { /* leave at 1; GET keeps a positional fallback for un-stamped rows */ }

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
        seq: nextSeq,      // permanent studio render number (never recycled)
        photoSeconds: photoSeconds ? Number(photoSeconds) : null,
        totalSeconds: totalSeconds ? Number(totalSeconds) : null,
        adjustments: adjustments && typeof adjustments === 'object' ? adjustments : {},
        // Photo selection for this segment: the raw expression (for display) and
        // the resolved 1-based positions (for exact re-renders). Blank = all.
        photoSpec: photoSpec ? String(photoSpec).trim() : null,
        album: album ? String(album).trim() : null,
        photoIndexes: indexes,
        includeCards: includeCards !== false,
        videoPlaceholders: videoPlaceholders !== false,
        greenScreen: greenScreen !== false,
        videoGaps: gapCount,
        colorCorrect: !!pe.colorCorrect,
        background: bgControl,   // "Add background" control, so Export Final reuses it
        // Multi Page motion options (transition + rhythm), so a re-render matches.
        mpTransition: mpTransition || null,
        mpStagger: Number.isFinite(Number(mpStagger)) ? Number(mpStagger) : null,
        mpHold: Number.isFinite(Number(mpHold)) ? Number(mpHold) : null,
        mpSpeed: Number.isFinite(Number(mpSpeed)) ? Number(mpSpeed) : null,

        // Fully-resolved play sequence (r2_keys + each photo's edits AT THIS
        // MOMENT, placeholder names) — the snapshot the "Export Final" re-render
        // rebuilds from, so a final reproduces THIS draft exactly even if the
        // client's photo edits change afterward. URLs are NOT stored (they
        // expire); finalize re-presigns from the r2_keys.
        renderSequence: sequence,
      },
    })
    .select('id')
    .single();
  if (insErr) return NextResponse.json({ error: 'Could not track render', detail: insErr.message }, { status: 500 });

  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    // Only the tiled/print styles need each photo's real shape (portrait vs
    // landscape) to lay out native-aspect cells; the one-at-a-time styles always
    // cover-fill, so we skip the probe for them (keeps those renders fast).
    const st = STYLES[style] || {};
    // Styles that lay out by each photo's real aspect need the pixel dims probed:
    // tiled/print walls, Epic, plus Photo Drop (native-aspect card) and Story
    // Builder (aspect-aware fan). Without this, aspect defaults to square and
    // Photo Drop squishes landscapes.
    const needsDims = styleNeedsDims(st);
    // Long-lived presigned URLs — Creatomate fetches these while rendering.
    // Placeholders carry only a name (a green gap the editor keys their clip into).
    const photoItemsBuilt = await Promise.all(
      sequence.map(async (s) => {
        if (s.type !== 'photo') return { type: 'placeholder', name: s.name };
        const url = await getViewUrl(s.r2_key, 21600);
        const dims = needsDims ? await probeDims(url) : null;
        return { type: 'photo', url, framing: s.framing, fit: s.fit, size: s.size, colorCorrect: s.colorCorrect, mode: s.mode, contrast: s.contrast, saturation: s.saturation, posX: s.posX, posY: s.posY, w: dims?.w || null, h: dims?.h || null };
      })
    );

    // GREEN SCREEN as a real PHOTO (Josh): when on, a broadcast-green frame is
    // injected as the first AND last item, so every style just treats it like a
    // photo — full-frame green on the slideshows, a green print in Polaroid, a
    // green cell in the walls. It drops in like any photo (no overlay covering the
    // opening), and the editor `green` flag keeps it keyable (duotone renders it
    // pure, not tinted). public/green.png is the asset.
    const greenItem = { type: 'photo', green: true, url: `${siteUrl}/green.png`, fit: 'fill', w: 1920, h: 1080 };
    const items = (greenScreen !== false)
      ? [greenItem, ...photoItemsBuilt, greenItem]
      : photoItemsBuilt;

    const source = buildMontageSource({
      items,
      style,
      photoSeconds: photoSeconds ? Number(photoSeconds) : null,
      totalSeconds: totalSeconds ? Number(totalSeconds) : null,
      includeCards: includeCards !== false,
      greenBookends: false,   // green is now an injected photo, not an overlay
      title: String(title).toUpperCase(),
      subtitle: subtitle ? String(subtitle).toUpperCase() : null,
      watermarkUrl: watermark ? `${siteUrl}/watermark.png` : null,
      assetBase: siteUrl || null,   // for collage light-leak overlays (public/overlays/*)
      background: (bgControl && bgControl.texture)
        ? { ...bgControl, textureUrl: `${siteUrl}/backgrounds/${bgControl.texture}.jpg` }
        : bgControl,                // "Add background" control (green / texture / image+tint)
      mpTransition, mpStagger, mpHold, mpSpeed,   // Multi Page motion options
    });

    const render = await createRender({
      source,
      webhookUrl: `${siteUrl}/api/webhooks/creatomate`,
      metadata: row.id, // webhook looks the row up by this
      // Watermarked = a DRAFT (checking motion/framing), so render at half
      // resolution → ~1/4 the Creatomate credits. Un-watermarked finals stay
      // full-res. Big saver while iterating (see credit formula in creatomate.js).
      renderScale: watermark ? 0.5 : null,
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
    .select('id, client_id, style, title, subtitle, status, video_url, r2_key, error, photo_count, watermarked, params, created_at, studio_clients(display_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(500);   // was 25 (GLOBAL across all clients) — a busy day of rendering pushed older drafts out of view and broke per-client numbering. 500 keeps everyone's renders visible.
  if (error) return NextResponse.json({ error: 'Could not load renders', detail: error.message }, { status: 500 });

  // Studio file-naming: a stable per-client sequence number (oldest render = 001)
  // — shown on the card AND used as the filename prefix so a draft maps back to a
  // card — plus a version that bumps for re-renders of the same client + style +
  // range + album.
  const seqMap = new Map(), verMap = new Map(), perVariant = {};
  // Group by client so each client numbers independently.
  const byClient = {};
  for (const r of (data || [])) { const cid = r.client_id || ''; (byClient[cid] = byClient[cid] || []).push(r); }
  for (const cid in byClient) {
    const rows = byClient[cid].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    // PRIMARY renders (a fresh generate) OWN the numbers: a stamped params.seq is
    // permanent, older un-stamped primaries fill the gaps in creation order. A
    // re-render (Export Low/Full Rez → params.rerenderOf) INHERITS its source's
    // number so the high-rez export shares the draft's ### and only adds "HR".
    const claimed = new Set();
    const primaries = rows.filter((r) => !r.params?.rerenderOf);
    for (const r of primaries) { const s = Number(r.params?.seq); if (Number.isFinite(s)) { seqMap.set(r.id, s); claimed.add(s); } }
    let next = 1;
    for (const r of primaries) {
      if (!seqMap.has(r.id)) { while (claimed.has(next)) next++; seqMap.set(r.id, next); claimed.add(next); next++; }
    }
    for (const r of rows) {                 // re-renders inherit their source's number
      if (seqMap.has(r.id)) continue;
      const srcId = r.params?.rerenderOf;
      if (srcId && seqMap.has(srcId)) seqMap.set(r.id, seqMap.get(srcId));
      else { while (claimed.has(next)) next++; seqMap.set(r.id, next); claimed.add(next); next++; }
    }
    for (const r of rows) {                 // version, creation order, per variant
      const vk = `${cid}|${r.style}|${r.params?.photoSpec || ''}|${r.params?.album || ''}`;
      perVariant[vk] = (perVariant[vk] || 0) + 1;
      verMap.set(r.id, perVariant[vk]);
    }
  }
  const STYLE_LABELS = { hollywood: 'Hollywood', timeless: 'Timeless', party: 'Party', party2: 'Party2', duotone: 'Duotone', duotone2: 'Duotone2', polaroid: 'PolaroidDrop', photo_drop: 'PhotoDrop', collage_classic: 'CollageClassic', collage_featured: 'CollageFeatured', gallery150: 'Gallery', epic_vintage: 'EpicVintage', story_builder: 'StoryBuilder', trendy: 'Trendy', multi_page: 'MultiPage', multi_page_record: 'MultiPageRecord' };
  const cp = (s) => String(s || '').replace(/[^A-Za-z0-9]+/g, '');
  // The number prefix: ### for a low-rez/draft, ###HR for a full-rez export — same
  // number, so a high-rez file sorts right next to the draft it came from.
  const seqLabel = (m) => String(seqMap.get(m.id) || 1).padStart(3, '0') + (m.watermarked ? '' : 'HR');
  const renderName = (m) => {
    const num = seqLabel(m);
    const last = cp(m.studio_clients?.last_name || m.studio_clients?.display_name) || 'Client';
    const style = STYLE_LABELS[m.style] || cp(m.style) || 'Montage';
    const album = cp(m.params?.album);
    const range = String(m.params?.photoSpec || '').replace(/\s+/g, '').replace(/[^0-9,\-]/g, '') || 'all';
    const date = (m.created_at || '').slice(0, 10) || 'nodate';
    return [num, last, style, album, range, date].filter(Boolean).join('_') + `_V${verMap.get(m.id) || 1}.mp4`;
  };

  const montages = await Promise.all(
    (data || []).map(async (m) => ({
      id: m.id,
      seq: seqLabel(m),                  // ### for a draft, ###HR for a full-rez export
      version: verMap.get(m.id) || 1,
      name: renderName(m),               // full studio file name (###_Last_Style_Album_Range_Date_V#.mp4)
      album: m.params?.album || null,    // album this render was built from (if any)
      clientId: m.client_id,
      client: m.studio_clients?.display_name || '—',
      style: m.style,
      title: m.title,
      subtitle: m.subtitle,
      photoSeconds: m.params?.photoSeconds || null,
      adjustments: m.params?.adjustments || {},
      photoSpec: m.params?.photoSpec || null,
      includeCards: m.params?.includeCards !== false,
      greenScreen: m.params?.greenScreen !== false,
      hidden: m.params?.hidden === true,
      viewed: m.params?.viewed === true,
      starred: m.params?.starred === true,
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
        ? await getDownloadUrl(m.r2_key, renderName(m), 3600)
        : null,
      archived: !!m.r2_key, // false = still only on Creatomate's 30-day hosting
    }))
  );
  return NextResponse.json({ montages });
}
