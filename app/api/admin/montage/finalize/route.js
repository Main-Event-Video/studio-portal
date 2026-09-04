// POST /api/admin/montage/finalize  { montageId, full = true }
//   → re-renders an existing render using the EXACT settings + resolved photo
//     sequence snapshotted on its row. full:true → FULL 1920×1080, no watermark
//     ("Export Full Rez"); full:false → half-res watermarked draft ("Export Low
//     Rez"). Josh: export a low-res draft to check it, then one click to get the
//     other resolution with everything set exactly as it was. Creates a NEW
//     render row (the source render is left intact) so both show in the list.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { getViewUrl, getDownloadUrl, resolveBackground } from '@/lib/r2';
import { buildMontageSource, STYLES, styleNeedsDims, styleNeedsFaces } from '@/lib/montage';
import { borderIsOn } from '@/lib/photoBorder';
import { createRender } from '@/lib/creatomate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CHROMA_GREEN = '#00B140';

// Same header-only dimension probe the main render route uses (tiled/print styles
// need each photo's real aspect). Fully guarded → null falls back to landscape.
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
  const { montageId, full = true } = body || {};
  if (!montageId) return NextResponse.json({ error: 'Missing montageId' }, { status: 400 });
  const wantFull = full !== false;

  const db = createServiceClient();
  const { data: src, error: findErr } = await db
    .from('studio_montages')
    .select('id, client_id, style, title, subtitle, params')
    .eq('id', montageId)
    .single();
  if (findErr || !src) return NextResponse.json({ error: 'Render not found' }, { status: 404 });

  const params = (src.params && typeof src.params === 'object') ? src.params : {};
  const seq = Array.isArray(params.renderSequence) ? params.renderSequence : null;
  if (!seq || !seq.length) {
    return NextResponse.json(
      { error: 'This render was made before Export Final existed, so its exact settings weren’t saved. Run a fresh draft and the final will be available on it.' },
      { status: 400 },
    );
  }
  if (!STYLES[src.style]) return NextResponse.json({ error: 'Unknown style on this render' }, { status: 400 });

  // New row FIRST so the webhook has something to update.
  const photoCount = seq.filter((s) => s && s.type === 'photo').length;
  const { data: row, error: insErr } = await db
    .from('studio_montages')
    .insert({
      client_id: src.client_id,
      style: src.style,
      title: src.title,
      subtitle: src.subtitle || null,
      status: 'queued',
      photo_count: photoCount,
      watermarked: !wantFull,                    // full = no watermark; low = watermarked draft
      // Same RENDER SETTINGS, marked as a re-render of the source. Review state
      // is deliberately not carried over: a brand-new export has not been viewed,
      // is not starred, is not hidden, and its name is resolved through
      // rerenderOf at read time so renaming the draft renames the export too
      // (copying the label here would freeze the two apart).
      params: (() => {
        const { viewed, starred, hidden, label, ...settings } = params || {};
        return { ...settings, rerenderOf: src.id };
      })(),
    })
    .select('id')
    .single();
  if (insErr) return NextResponse.json({ error: 'Could not track final render', detail: insErr.message }, { status: 500 });

  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const st = STYLES[src.style] || {};
    // MUST match the draft route or exports won't match the draft (stretched /
    // heads cropped). Shared helper = one source of truth.
    // A border must hug the picture's edge, which needs the photo's real shape —
    // so a bordered snapshot forces the probe here exactly as the draft did.
    // Without this the export would quietly come back with the borders in the
    // wrong place (or gone) on any style that skips the probe, which is the
    // "exports won't match the draft" failure this helper exists to prevent.
    const needsDims = styleNeedsDims(st) || seq.some((s) => s && s.type === 'photo' && borderIsOn(s.border));
    // Same face lookup the draft did, so a high-rez export crops identically to
    // the draft it came from. Snapshots store r2_keys, and faces live on the
    // media row rather than in the snapshot, so this re-reads them.
    const facesByKey = new Map();
    if (styleNeedsFaces(st)) {
      const fkeys = seq.filter((s) => s && s.type === 'photo' && s.r2_key).map((s) => s.r2_key);
      if (fkeys.length) {
        const { data: fr } = await db.from('studio_media')
          .select('r2_key, faces').eq('client_id', src.client_id).in('r2_key', fkeys);
        for (const r of (fr || [])) if (Array.isArray(r.faces)) facesByKey.set(r.r2_key, r.faces);
      }
    }

    // Rebuild the photo items from the snapshot — re-presign fresh URLs from the
    // stored r2_keys; carry each photo's snapshotted edits verbatim.
    const photoItemsBuilt = await Promise.all(
      seq.map(async (s) => {
        if (!s || s.type !== 'photo') return { type: 'placeholder', name: s?.name };
        const url = await getViewUrl(s.r2_key, 21600);
        const dims = needsDims ? await probeDims(url) : null;
        return {
          type: 'photo', url,
          framing: s.framing, fit: s.fit, size: s.size, colorCorrect: s.colorCorrect,
          mode: s.mode, contrast: s.contrast, saturation: s.saturation, posX: s.posX, posY: s.posY,
          border: s.border || null,
          w: dims?.w || null, h: dims?.h || null,
          faces: facesByKey.get(s.r2_key) || null,
        };
      }),
    );

    // Same green-bookend injection as the draft used.
    const greenItem = { type: 'photo', green: true, url: `${siteUrl}/green.png`, fit: 'fill', w: 1920, h: 1080 };
    const items = (params.greenScreen !== false)
      ? [greenItem, ...photoItemsBuilt, greenItem]
      : photoItemsBuilt;

    const bgResolved = await resolveBackground(params.background || null);

    const source = buildMontageSource({
      items,
      style: src.style,
      photoSeconds: params.photoSeconds ? Number(params.photoSeconds) : null,
      totalSeconds: params.totalSeconds ? Number(params.totalSeconds) : null,
      includeCards: params.includeCards !== false,
      greenBookends: false,
      title: String(src.title || '').toUpperCase(),
      subtitle: src.subtitle ? String(src.subtitle).toUpperCase() : null,
      watermarkUrl: wantFull ? null : `${siteUrl}/watermark.png`,
      assetBase: siteUrl || null,
      // Reuse the draft's "Add background" control. An imported library background
      // is stored as an r2_key, so it must be RE-PRESIGNED here — the draft's URL
      // is long expired by the time anyone clicks Export Full Rez.
      background: (params.background && params.background.texture)
        ? { ...params.background, textureUrl: `${siteUrl}/backgrounds/${params.background.texture}.jpg` }
        : bgResolved,
      mpTransition: params.mpTransition || null,   // reuse Multi Page motion options
      mpStagger: params.mpStagger ?? null,
      mpHold: params.mpHold ?? null,
      mpSpeed: params.mpSpeed ?? null,
      duoPalette: params.duoPalette ?? null,
      duoTreatment: params.duoTreatment ?? null,
      glassLight: params.glassLight !== false,
      // The full export always pays for the reflections, whatever the draft did.
      glassRefl: true,
    });

    const render = await createRender({
      source,
      webhookUrl: `${siteUrl}/api/webhooks/creatomate`,
      metadata: row.id,
      renderScale: wantFull ? null : 0.5,   // full 1920×1080, or half-res draft
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
    return NextResponse.json({ error: 'Final render failed to start', detail: e.message }, { status: 500 });
  }
}
