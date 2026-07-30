// POST /api/admin/montage/arrange  { clientId, top, albums }
// Admin-side reorder of a client's photo timeline. It writes the SAME order
// fields the client's portal reorder writes:
//   • loose top-level item  → studio_media.timeline_pos = its rank, folder_path null
//   • album (top-level)     → studio_boxes.position     = its rank
//   • media inside an album → studio_media.folder_path = album, sort_number = rank,
//                             timeline_pos = null
// so the admin and the client always read the identical play order (both go
// through buildTimeline). Photos are identified by r2_key (what the admin photo
// list already carries). ADDITIVE: brand-new endpoint, admin-authed, sharing no
// code with the working client path — nothing that works today is touched.
//
//   top    : [{ type:'media', key:<r2_key> } | { type:'album', name:<album> }]
//   albums : { "<albumName>": [<r2_key>, ...] }   // order of media inside each album
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }); }
  const { clientId } = body || {};
  if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
  const top = Array.isArray(body.top) ? body.top : [];
  const albums = body.albums && typeof body.albums === 'object' ? body.albums : {};

  const db = createServiceClient();

  // Mirror of the portal's setArrangement persistence. writeAll(withTLP) writes
  // every position in parallel chunks; if this DB predates the timeline_pos
  // column, the first pass throws a "timeline_pos" error and we retry WITHOUT it
  // (sort_number still records the order).
  const writeAll = async (withTLP) => {
    const mediaWrites = [];
    const albumRows = [];
    let rank = 1;
    for (const entry of top) {
      if (!entry || typeof entry !== 'object') continue;
      if (entry.type === 'media' && entry.key) {
        const pos = rank, key = entry.key;
        mediaWrites.push(async () => {
          const patch = withTLP ? { folder_path: null, timeline_pos: pos } : { folder_path: null, sort_number: pos };
          const { error } = await db.from('studio_media').update(patch)
            .eq('client_id', clientId).eq('kind', 'client_upload').eq('r2_key', key);
          return error ? error.message : null;
        });
      } else if (entry.type === 'album' && entry.name) {
        const name = String(entry.name).trim();
        if (!name) continue;
        albumRows.push({ client_id: clientId, name, position: rank });
      } else {
        continue;
      }
      rank++;
    }
    for (const [name, keys] of Object.entries(albums)) {
      const albumName = String(name).trim();
      if (!albumName || !Array.isArray(keys)) continue;
      let j = 1;
      for (const key of keys) {
        const pos = j, k = key;
        mediaWrites.push(async () => {
          const patch = withTLP
            ? { folder_path: albumName, sort_number: pos, timeline_pos: null }
            : { folder_path: albumName, sort_number: pos };
          const { error } = await db.from('studio_media').update(patch)
            .eq('client_id', clientId).eq('kind', 'client_upload').eq('r2_key', k);
          return error ? error.message : null;
        });
        j++;
      }
    }
    if (albumRows.length) {
      const { error } = await db.from('studio_boxes').upsert(albumRows, { onConflict: 'client_id,name' });
      if (error) throw new Error(error.message);
    }
    const CHUNK = 20;
    for (let i = 0; i < mediaWrites.length; i += CHUNK) {
      const results = await Promise.all(mediaWrites.slice(i, i + CHUNK).map((fn) => fn()));
      const firstErr = results.find((r) => r);
      if (firstErr) throw new Error(firstErr);
    }
  };

  try {
    try {
      await writeAll(true);
    } catch (e) {
      if (/timeline_pos/i.test(String(e?.message || e))) {
        await writeAll(false);
      } else {
        throw e;
      }
    }
  } catch (e) {
    return NextResponse.json({ error: 'Could not save order', detail: String(e.message || e) }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
