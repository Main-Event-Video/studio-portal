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
import { buildMontageSource, applyMattePass, STYLES, styleNeedsDims, styleNeedsFaces, normalizeKeyColor, keyAssetFor } from '@/lib/montage';
import { borderIsOn } from '@/lib/photoBorder';
import { createRender } from '@/lib/creatomate';
import { randomUUID } from 'crypto';

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
  // EXPORT WITH ALPHA (Josh 9/15): two full-res renders started together and
  // linked by params.alphaPair — the COLOUR pass over a BLACK backdrop (so
  // dissolves never tint) and the MATTE pass (photos white / backdrop black).
  // Josh downloads the pair and runs tools/Alpha Merge.command, which joins them
  // into one Animation-codec .mov with a real alpha channel for Premiere.
  // (The merge cannot run here: it needs ffmpeg and minutes of CPU per montage.)
  if (body && body.alpha === true) {
    const pair = randomUUID();
    const base = { ...body, alpha: false, full: true, keyColor: '#000000', alphaPair: pair };
    const r1 = await finalizeOne({ ...base, matte: false, alphaRole: 'color' });
    if (r1.status !== 200) return r1;
    const j1 = await r1.json();
    // The matte pass is a re-render OF THE COLOUR PASS (same number → ###HRM,
    // same photos, same black key), never a second revision with its own number.
    const r2 = await finalizeOne({ montageId: j1.montageId, full: true, matte: true, alphaPair: pair, alphaRole: 'matte' });
    if (r2.status !== 200) return r2;
    const j2 = await r2.json();
    return NextResponse.json({ ok: true, alphaPair: pair, color: j1, matte: j2 });
  }
  return finalizeOne(body || {});
}

async function finalizeOne(body) {
  const { montageId, full = true, sequence: revised = null, matte = false, keyColor: keyOverride = null, alphaPair = null, alphaRole = null } = body || {};
  // MATTE PASS: a full-res luma matte of this render (see applyMattePass). Always full-res, never watermarked.
  const wantMatte = matte === true;
  if (!montageId) return NextResponse.json({ error: 'Missing montageId' }, { status: 400 });
  const wantFull = full !== false || wantMatte;

  const db = createServiceClient();
  const { data: src, error: findErr } = await db
    .from('studio_montages')
    .select('id, client_id, style, title, subtitle, params')
    .eq('id', montageId)
    .single();
  if (findErr || !src) return NextResponse.json({ error: 'Render not found' }, { status: 404 });

  const params = (src.params && typeof src.params === 'object') ? { ...src.params } : {};
  // KEY COLOUR OVERRIDE (Josh 9/15, from the Revise panel): re-render the same
  // montage against a different key. Snapshotted into the new row's params so
  // its own exports keep the new colour. Anything not a valid hex is ignored.
  if (typeof keyOverride === 'string' && /^#[0-9A-F]{6}$/i.test(keyOverride.trim())) params.keyColor = keyOverride.trim().toUpperCase();
  let seq = Array.isArray(params.renderSequence) ? params.renderSequence : null;
  if (!seq || !seq.length) {
    return NextResponse.json(
      { error: 'This render was made before Export Final existed, so its exact settings weren’t saved. Run a fresh draft and the final will be available on it.' },
      { status: 400 },
    );
  }
  if (!STYLES[src.style]) return NextResponse.json({ error: 'Unknown style on this render' }, { status: 400 });

  // ---- REVISION: the same render with photos swapped, removed or added ----
  // Josh 9/14: "client wants to change 1 image in a low rez clip. I want to
  // open that exact clip - keep all the transitions exactly the same but swap
  // an image or add or remove an image." The admin sends the edited order as a
  // list of { r2_key } / { type:'placeholder', name }. A key that was in the
  // original snapshot keeps its snapshotted edits verbatim (so a swap or a
  // removal changes nothing else); a key that is new to this render must belong
  // to the client and gets its CURRENT Edit Photos settings, the same way a
  // fresh draft would. Everything else — style, pace, cards, key colour,
  // border, neon, background — is the snapshot's, untouched.
  let isRevision = false;
  if (Array.isArray(revised) && revised.length) {
    const byKey = new Map();
    for (const e of seq) if (e && e.type === 'photo') { byKey.set(e.sourceKey || e.r2_key, e); byKey.set(e.r2_key, e); }
    const newKeys = [...new Set(revised.filter((r) => r && r.r2_key && !byKey.has(r.r2_key)).map((r) => r.r2_key))];
    let mediaByKey = new Map();
    let pePhotos = {};
    if (newKeys.length) {
      const { data: rows } = await db.from('studio_media').select('r2_key, crop_key').eq('client_id', src.client_id).in('r2_key', newKeys);
      for (const r of (rows || [])) mediaByKey.set(r.r2_key, r);
      const { data: cl } = await db.from('studio_clients').select('photo_edits').eq('id', src.client_id).single();
      const pe = cl && cl.photo_edits && typeof cl.photo_edits === 'object' ? cl.photo_edits : {};
      pePhotos = pe.photos && typeof pe.photos === 'object' ? pe.photos : {};
    }
    // Border comes from the snapshot's Choose Style setting, like every other photo.
    const sb = params.styleBorder && params.styleBorder.mode === 'custom'
      ? { on: true, w: Number(params.styleBorder.w) || 1.2, color: params.styleBorder.color || '#FFFFFF', at: 0 } : null;
    const out = [];
    for (const r of revised) {
      if (!r) continue;
      if (r.type === 'placeholder') { out.push({ type: 'placeholder', name: r.name || 'VIDEO' }); continue; }
      if (!r.r2_key) continue;
      const known = byKey.get(r.r2_key);
      if (known) { out.push({ ...known }); continue; }
      const m = mediaByKey.get(r.r2_key);
      if (!m) return NextResponse.json({ error: `A photo in the revision is not one of this client's uploads (${r.r2_key})` }, { status: 400 });
      const e = pePhotos[r.r2_key] || {};
      out.push({
        type: 'photo', r2_key: m.crop_key || m.r2_key, sourceKey: m.r2_key, clientCropped: !!m.crop_key, usingCrop: !!m.crop_key,
        framing: ['top', 'center', 'bottom'].includes(e.anchor) ? e.anchor : 'top',
        fit: e.fit === 'fill' ? 'fill' : e.fit === 'fit' ? 'fit' : null,
        size: Math.min(140, Math.max(60, Number(e.size) || 100)),
        colorCorrect: !!e.colorCorrect,
        mode: ['color', 'bw', 'sepia'].includes(e.mode) ? e.mode : 'color',
        contrast: Number.isFinite(Number(e.contrast)) ? Math.min(200, Math.max(50, Math.round(Number(e.contrast)))) : 100,
        saturation: Number.isFinite(Number(e.saturation)) ? Math.min(200, Math.max(0, Math.round(Number(e.saturation)))) : 100,
        posX: Number.isFinite(Number(e.posX)) ? Number(e.posX) : null,
        posY: Number.isFinite(Number(e.posY)) ? Number(e.posY) : null,
        border: sb,
      });
    }
    while (out.length && out[0].type === 'placeholder') out.shift();
    while (out.length && out[out.length - 1].type === 'placeholder') out.pop();
    if (!out.some((e) => e.type === 'photo')) return NextResponse.json({ error: 'A revision needs at least one photo' }, { status: 400 });
    seq = out;
    isRevision = true;
  }

  // A REVISION IS A NEW PIECE OF WORK, so it takes a NEW number. The first
  // revisions inherited the source's stamped `seq` along with its settings and
  // showed up in the list wearing the old number (Josh: "the new clip adopted
  // the same number as the previous version - it should be a whole new clip").
  // Same rule as a fresh draft: one higher than the highest primary in use.
  let nextSeq = null;
  if (isRevision) {
    nextSeq = 1;
    try {
      const { data: prior } = await db.from('studio_montages').select('params').eq('client_id', src.client_id);
      let maxStored = 0, primaryCount = 0;
      for (const p of prior || []) {
        if (p?.params?.rerenderOf) continue;
        primaryCount++;
        const n = Number(p?.params?.seq); if (Number.isFinite(n)) maxStored = Math.max(maxStored, n);
      }
      nextSeq = Math.max(maxStored, primaryCount) + 1;
    } catch { /* leave at 1 */ }
  }

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
        const { viewed, starred, hidden, label, seq: srcSeq, ...settings } = params || {};
        // A revision carries ITS OWN sequence (so its exports rebuild from the
        // revised photos), its OWN number, and the source's name with " R" so
        // the two are tellable apart in the list. A re-export keeps inheriting
        // the source's number (### / ###HR) exactly as before.
        const alphaTag = alphaPair ? { alphaPair, alphaRole: alphaRole || (wantMatte ? 'matte' : 'color') } : {};
        return isRevision
          ? { ...settings, ...alphaTag, ...(wantMatte ? { matte: true } : {}), renderSequence: seq, revisionOf: src.id, seq: nextSeq,
              ...(typeof label === 'string' && label.trim() ? { label: `${label.trim()} R` } : {}) }
          : { ...settings, ...alphaTag, seq: srcSeq, rerenderOf: src.id, ...(wantMatte ? { matte: true } : {}) };
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
    let stillsPhotos = {};
    if (st.stills) {
      try {
        const { data: cl } = await db.from('studio_clients').select('photo_edits').eq('id', src.client_id).single();
        stillsPhotos = (cl && cl.photo_edits && typeof cl.photo_edits === 'object' && cl.photo_edits.photos) ? cl.photo_edits.photos : {};
      } catch { stillsPhotos = {}; }
    }
    const needsDims = styleNeedsDims(st) || seq.some((s) => s && s.type === 'photo' && borderIsOn(s.border))
      || !!(params.neon && params.neon.on);   // neon traces the picture's rect, same reason as a border
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
        const it = {
          type: 'photo', url, sourceKey: s.sourceKey || s.r2_key,
          framing: s.framing, fit: s.fit, size: s.size, colorCorrect: s.colorCorrect,
          mode: s.mode, contrast: s.contrast, saturation: s.saturation, posX: s.posX, posY: s.posY,
          border: s.border || null,
          w: dims?.w || null, h: dims?.h || null,
          faces: facesByKey.get(s.r2_key) || null,
        };
        // MEvid Stills: cut-out / watercolor derivatives, read from the client's
        // CURRENT photo_edits (they only ever get added, never change).
        if (st.stills) {
          const d = stillsPhotos[it.sourceKey] && stillsPhotos[it.sourceKey].stills;
          if (d) {
            try { if (d.cutout_key && d.cutout_status !== 'failed') it.cutout_url = await getViewUrl(d.cutout_key, 21600); } catch { /* fallback move */ }
            try { if (d.watercolor_key && d.watercolor_status !== 'failed') it.watercolor_url = await getViewUrl(d.watercolor_key, 21600); } catch { /* fallback move */ }
          }
        }
        return it;
      }),
    );

    // Same green-bookend injection as the draft used.
    // Same key colour the draft used (green for anything rendered before the
    // setting existed). applyKeyColor would rewrite this URL anyway, but naming
    // it here keeps the two routes reading the same.
    const KEY = normalizeKeyColor(params.keyColor);
    const greenItem = { type: 'photo', green: true, url: `${siteUrl}${keyAssetFor(KEY)}`, fit: 'fill', w: 1920, h: 1080 };
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
      // Reuse the draft's key colour. An older render has no params.keyColor and
      // normalizeKeyColor sends it back to green, which is what it was made in.
      keyColor: KEY,
      // Same overlays the draft used. Absent on anything rendered before the
      // setting existed, which correctly means "none".
      atmosphereOpts: params.atmo || null,
      neonOpts: params.neon || null,
      mpTransition: params.mpTransition || null,   // reuse Multi Page motion options
      mpStagger: params.mpStagger ?? null,
      mpHold: params.mpHold ?? null,
      mpSpeed: params.mpSpeed ?? null,
      duoPalette: params.duoPalette ?? null,
      duoTreatment: params.duoTreatment ?? null,
      glassLight: params.glassLight !== false,
      // The full export always pays for the reflections, whatever the draft did.
      glassRefl: true,
      // Framed Box: replayed from the draft's snapshot, so the export is the
      // look that was approved. Unlike glassRefl these are a LOOK, not a cost,
      // so they are not overridden here.
      atmosphere: params.fbAtmosphere !== false,
      frameW: params.fbFrameW ?? null,
      frameColor: params.fbFrameColor ?? null,
      stillsOpts: params.stills || null,           // MEvid Stills: the draft's picks/screens
    });

    if (wantMatte) applyMattePass(source, KEY);

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
