// POST /api/admin/montage/stills-derive  { clientId, keys: [r2_key…], what: 'cutout' | 'watercolor' }
//   → for each photo key without that derivative yet: run the fal.ai model on
//     the stored original, save the result next to it in R2, and record the
//     R2 key on studio_clients.photo_edits.photos[key].stills.
//
// MEVID STILLS derivatives (Josh 9/9). The engine's cut-out transitions need a
// transparent PNG of the person; the Watercolor transition needs a painting of
// the photo. Both are made ONCE per photo and reused by every render. Nothing
// waits on this: a photo without a derivative gets that move's fallback.
//
//   FAL_KEY                 (required)  same key as MEvid — add it to this
//                                       project's Vercel env
//   STILLS_CUTOUT_MODEL     (optional)  default 'fal-ai/birefnet'
//   STILLS_WATERCOLOR_MODEL (optional)  default 'fal-ai/flux-pro/kontext'
//   FAL_AUTH_SCHEME         (optional)  default 'Key'
//
// Returns { done: [{key, status, r2_key?}], skipped: n } — status 'ready' |
// 'none' | 'failed'. Processes at most 6 keys per call (Vercel time budget);
// the admin calls again for the rest.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { getViewUrl, putFile } from '@/lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const clean = (v) => String(v || '').trim().replace(/^['"]|['"]$/g, '');
const CUT_MODEL = clean(process.env.STILLS_CUTOUT_MODEL) || 'fal-ai/birefnet';
const WC_MODEL = clean(process.env.STILLS_WATERCOLOR_MODEL) || 'fal-ai/flux-pro/kontext';
const SCHEME = clean(process.env.FAL_AUTH_SCHEME) || 'Key';
const WC_PROMPT = 'Turn this photo into a loose watercolor painting on textured watercolor paper: soft bleeding edges, translucent washes, visible brush strokes, a little white paper showing through. Keep the exact same composition, people, faces and colors.';
const PER_CALL = 6;

function firstImageUrl(data) {
  if (!data || typeof data !== 'object') return null;
  const cands = [data.image, data.output, data.result, ...(Array.isArray(data.images) ? data.images : []), ...(Array.isArray(data.outputs) ? data.outputs : [])];
  for (const c of cands) {
    if (!c) continue;
    if (typeof c === 'string' && /^https?:\/\//.test(c)) return c;
    if (typeof c === 'object' && typeof c.url === 'string') return c.url;
  }
  return null;
}

async function falImage(model, body, timeoutMs) {
  const key = clean(process.env.FAL_KEY);
  if (!key) throw new Error('FAL_KEY is not set on this project');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`https://fal.run/${model}`, {
      method: 'POST',
      headers: { Authorization: `${SCHEME} ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally { clearTimeout(timer); }
  const text = await res.text();
  if (!res.ok) throw new Error(`engine ${res.status}: ${text.slice(0, 200)}`);
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('engine returned non-JSON'); }
  const url = firstImageUrl(data);
  if (!url) throw new Error('engine returned no image');
  return url;
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }); }
  const { clientId, keys, what = 'cutout', force = false } = body || {};
  if (!clientId || !Array.isArray(keys) || !keys.length) return NextResponse.json({ error: 'Missing clientId or keys' }, { status: 400 });
  if (!['cutout', 'watercolor'].includes(what)) return NextResponse.json({ error: 'what must be cutout or watercolor' }, { status: 400 });
  if (!clean(process.env.FAL_KEY)) return NextResponse.json({ error: 'FAL_KEY is not set on this project (add it in Vercel → Environment Variables)' }, { status: 500 });

  const db = createServiceClient();
  const { data: client, error } = await db.from('studio_clients').select('id, photo_edits').eq('id', clientId).single();
  if (error || !client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  // Which photos are actually owned by this client (never derive a foreign key).
  const { data: media } = await db.from('studio_media').select('r2_key, content_type').eq('client_id', clientId);
  const owned = new Map((media || []).map((m) => [m.r2_key, m.content_type || '']));

  const pe = client.photo_edits && typeof client.photo_edits === 'object' ? { ...client.photo_edits } : {};
  const photos = pe.photos && typeof pe.photos === 'object' ? { ...pe.photos } : {};
  const done = [];
  let skipped = 0;
  const kf = what === 'cutout' ? 'cutout_key' : 'watercolor_key';
  const sf = what === 'cutout' ? 'cutout_status' : 'watercolor_status';

  for (const key of keys.map(String).slice(0, 200)) {
    if (done.length >= PER_CALL) { skipped++; continue; }
    if (!owned.has(key) || !String(owned.get(key)).startsWith('image/')) { skipped++; continue; }
    const cur = photos[key] && typeof photos[key] === 'object' ? photos[key] : {};
    const stills = cur.stills && typeof cur.stills === 'object' ? { ...cur.stills } : {};
    if (!force && (stills[kf] || stills[sf] === 'none')) { skipped++; continue; }
    let status = 'failed', r2Key = null;
    try {
      const src = await getViewUrl(key, 3600);
      const tmp = what === 'cutout'
        ? await falImage(CUT_MODEL, { image_url: src, output_format: 'png' }, 60000)
        : await falImage(WC_MODEL, { prompt: WC_PROMPT, image_url: src, num_images: 1, output_format: 'jpeg', safety_tolerance: '2' }, 90000);
      const res = await fetch(tmp);
      if (!res.ok) throw new Error(`fetch derivative ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length) throw new Error('empty derivative');
      r2Key = key.replace(/\.[a-z0-9]+$/i, '') + (what === 'cutout' ? '-cutout.png' : '-watercolor.jpg');
      await putFile(r2Key, buf, what === 'cutout' ? 'image/png' : 'image/jpeg');
      status = 'ready';
    } catch (e) {
      const msg = String(e?.message || e);
      console.error('[stills-derive]', what, key, msg);
      status = /no (foreground|person|subject)|empty mask/i.test(msg) ? 'none' : 'failed';
    }
    stills[sf] = status;
    if (r2Key) stills[kf] = r2Key;
    photos[key] = { ...cur, stills };
    done.push({ key, status, r2_key: r2Key });
  }

  if (done.length) {
    // Re-read + merge right before writing so a concurrent editor save can't be
    // lost, then write only the stills sub-objects we touched.
    const { data: fresh } = await db.from('studio_clients').select('photo_edits').eq('id', clientId).single();
    const base = fresh && fresh.photo_edits && typeof fresh.photo_edits === 'object' ? fresh.photo_edits : {};
    const merged = { ...base, photos: { ...(base.photos || {}) } };
    for (const d of done) {
      const cur = merged.photos[d.key] && typeof merged.photos[d.key] === 'object' ? merged.photos[d.key] : {};
      merged.photos[d.key] = { ...cur, stills: { ...(cur.stills || {}), ...(photos[d.key].stills) } };
    }
    const { error: upErr } = await db.from('studio_clients').update({ photo_edits: merged }).eq('id', clientId);
    if (upErr) return NextResponse.json({ error: 'Could not save', detail: upErr.message, done }, { status: 500 });
  }
  return NextResponse.json({ done, skipped, remaining: Math.max(0, keys.length - done.length - skipped) });
}
