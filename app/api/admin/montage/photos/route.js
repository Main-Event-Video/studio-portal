// GET /api/admin/montage/photos?clientId=...            → the client's full timeline
// GET /api/admin/montage/photos?montageId=...           → ONLY the photos in THAT
//   render, in play order, and (for Multi-Page styles) each photo's page + cell +
//   the cell's real aspect ratio, so the framing adjuster mirrors the actual boxes.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { getViewUrl, getDownloadUrl } from '@/lib/r2';
import { orderedClientMedia } from '@/lib/clientTimeline';
import { multiPageLayout, STYLES } from '@/lib/montage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Compact copy of the render route's dimension probe (header bytes only, fully
// guarded) — the Multi-Page templates pick a cell shape from each photo's real
// aspect, so the adjuster needs the same dims to reproduce the boxes.
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
  } catch { /* unknown → treat as landscape */ }
  return null;
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const clientId = url.searchParams.get('clientId');
  const montageId = url.searchParams.get('montageId');
  const db = createServiceClient();

  // ---- render-specific mode: only the photos in THIS render, with cell shapes ----
  if (montageId) {
    const { data: m, error: mErr } = await db
      .from('studio_montages')
      .select('id, client_id, style, params')
      .eq('id', montageId)
      .maybeSingle();
    if (mErr || !m) return NextResponse.json({ error: 'Render not found' }, { status: 404 });

    const seq = Array.isArray(m.params?.renderSequence) ? m.params.renderSequence : null;
    // Old renders predate renderSequence → we can't know the exact subset; fall
    // back to the whole timeline so the adjuster still works (just not filtered).
    if (!seq) {
      const { media, error } = await orderedClientMedia(db, m.client_id, { imagesOnly: true });
      if (error) return NextResponse.json({ error: 'Could not load photos', detail: error.message }, { status: 500 });
      const photos = await Promise.all((media || []).slice(0, 500).map(async (mm, i) => ({
        index: i + 1, key: mm.r2_key, filename: mm.filename, album: mm.folder_path || null,
        url: await getViewUrl(mm.r2_key, 3600), downloadUrl: await getDownloadUrl(mm.r2_key, mm.filename, 3600),
      })));
      return NextResponse.json({ photos, partial: true });
    }

    const keys = seq.filter((s) => s && s.type === 'photo' && s.r2_key).map((s) => s.r2_key);
    // Filenames for labels (one query, then map by r2_key).
    const { data: rows } = await db.from('studio_media')
      .select('r2_key, filename, folder_path').eq('client_id', m.client_id).in('r2_key', keys.length ? keys : ['__none__']);
    const meta = new Map((rows || []).map((r) => [r.r2_key, r]));

    // Build the play items in render order, probing each photo's real dims.
    const photoItems = await Promise.all(keys.map(async (k) => {
      const info = meta.get(k) || {};
      const u = await getViewUrl(k, 3600);
      const dims = await probeDims(u);
      return { type: 'photo', r2_key: k, url: u, filename: info.filename || null, album: info.folder_path || null, w: dims?.w || null, h: dims?.h || null };
    }));

    const st = STYLES[m.style] || {};
    let layout = null;
    if (st.multipage) {
      // Reproduce the render's grouping EXACTLY, including the green bookends that
      // occupy cells (greenScreen defaults on) so page/cell numbers line up.
      const green = m.params?.greenScreen !== false;
      const g = { type: 'photo', url: 'green', w: 1920, h: 1080 };
      const items = green ? [g, ...photoItems, g] : photoItems;
      const lay = multiPageLayout({ items, width: 1920, height: 1080 });
      // lay is aligned to non-placeholder items in order; skip the leading green.
      layout = green ? lay.slice(1, 1 + photoItems.length) : lay.slice(0, photoItems.length);
    }

    const photos = await Promise.all(photoItems.map(async (it, i) => ({
      index: i + 1,
      key: it.r2_key,
      filename: it.filename,
      album: it.album,
      url: it.url,
      downloadUrl: await getDownloadUrl(it.r2_key, it.filename || 'photo', 3600),
      ...(layout && layout[i] ? { page: layout[i].page, cell: layout[i].cell, cells: layout[i].cells, cellAspect: layout[i].cellAspect } : {}),
    })));
    return NextResponse.json({ photos, style: m.style, multipage: !!st.multipage });
  }

  // ---- default mode: the client's whole timeline (unchanged) ----
  if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
  const { media: data, error } = await orderedClientMedia(db, clientId, { imagesOnly: true });
  if (error) return NextResponse.json({ error: 'Could not load photos', detail: error.message }, { status: 500 });

  const photos = await Promise.all(
    (data || []).slice(0, 500).map(async (m, i) => ({
      index: i + 1,
      key: m.r2_key,
      filename: m.filename,
      album: m.folder_path || null,
      url: await getViewUrl(m.r2_key, 3600),
      downloadUrl: await getDownloadUrl(m.r2_key, m.filename, 3600),
    }))
  );
  return NextResponse.json({ photos });
}
