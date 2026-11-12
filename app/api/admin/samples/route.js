// /api/admin/samples — the admin "Sample links" panel (Josh 11/11).
// A library of sample clips uploaded once, plus any number of trackable links per
// clip for prospective clients. Every real open of a link emails info@ (see
// /api/watch/[slug]). Admin-only, service role. Clips are NEVER deleted from here
// (Archive only); a link can be turned off, archived, or deleted.
//
// GET  → { samples: [...], links: [...] } with fresh thumbnail URLs.
// POST { action, ... }:
//   upload-url     { contentType }                         → { url, key }
//   create-sample  { key, thumbKey, filename, title, contentType, size, duration }
//   rename-sample  { id, title }
//   archive-sample { id, archived: true|false }
//   create-link    { sampleId, recipient, title, password } → { link }
//   update-link    { id, disabled?, archived?, password? }
//   delete-link    { id }
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { getUploadUrl, getViewUrl } from '@/lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const clean = (v, n = 200) => (typeof v === 'string' ? v.trim().slice(0, n) : '') || null;
const ALPHA = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no look-alikes
function makeSlug(len = 8) {
  const bytes = crypto.randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHA[bytes[i] % ALPHA.length];
  return s;
}
// Not exported: a route file may only export HTTP handlers and route config.
function watchBase() {
  return (process.env.SHARE_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://clients.maineventstudio.com').replace(/\/$/, '');
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const db = createServiceClient();

  const { data: samples, error: e1 } = await db.from('studio_samples')
    .select('id, created_at, title, filename, content_type, size_bytes, duration_s, thumb_key, archived_at')
    .order('created_at', { ascending: false });
  if (e1) return NextResponse.json({ error: e1.message.includes('does not exist') ? 'Run the 018 database step first.' : e1.message }, { status: 500 });

  const { data: links, error: e2 } = await db.from('studio_sample_links')
    .select('id, created_at, sample_id, slug, recipient, title, password, opens, last_opened_at, disabled_at, archived_at')
    .order('created_at', { ascending: false });
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  const base = watchBase();
  const out = await Promise.all((samples || []).map(async (s) => ({
    ...s,
    thumb_url: s.thumb_key ? await getViewUrl(s.thumb_key, 43200).catch(() => null) : null,
  })));
  return NextResponse.json({
    samples: out,
    links: (links || []).map((l) => ({ ...l, url: `${base}/w/${l.slug}` })),
  });
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let b;
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }); }
  const db = createServiceClient();
  const now = new Date().toISOString();

  try {
    switch (b?.action) {
      case 'upload-url': {
        if (!b.contentType) return NextResponse.json({ error: 'Missing file type' }, { status: 400 });
        const { url, key } = await getUploadUrl('samples', b.contentType);
        return NextResponse.json({ url, key });
      }
      case 'create-sample': {
        if (!b.key || !String(b.key).startsWith('studio/samples/')) return NextResponse.json({ error: 'Missing upload' }, { status: 400 });
        const row = {
          title: clean(b.title) || clean(b.filename) || 'Untitled sample',
          filename: clean(b.filename, 300),
          r2_key: b.key,
          content_type: clean(b.contentType, 100),
          size_bytes: Number.isFinite(+b.size) ? Math.round(+b.size) : null,
          duration_s: Number.isFinite(+b.duration) && +b.duration > 0 ? +(+b.duration).toFixed(2) : null,
          thumb_key: b.thumbKey && String(b.thumbKey).startsWith('studio/samples/') ? b.thumbKey : null,
        };
        const { data, error } = await db.from('studio_samples').insert(row).select('id').single();
        if (error) throw error;
        return NextResponse.json({ ok: true, id: data.id });
      }
      case 'rename-sample': {
        const title = clean(b.title);
        if (!b.id || !title) return NextResponse.json({ error: 'Name is empty' }, { status: 400 });
        const { error } = await db.from('studio_samples').update({ title }).eq('id', b.id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }
      case 'archive-sample': {
        if (!b.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        const { error } = await db.from('studio_samples').update({ archived_at: b.archived ? now : null }).eq('id', b.id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }
      case 'create-link': {
        if (!b.sampleId) return NextResponse.json({ error: 'Pick a clip' }, { status: 400 });
        const base = { sample_id: b.sampleId, recipient: clean(b.recipient), title: clean(b.title), password: clean(b.password, 100) };
        for (let i = 0; i < 5; i++) {
          const { data, error } = await db.from('studio_sample_links').insert({ ...base, slug: makeSlug() })
            .select('id, created_at, sample_id, slug, recipient, title, password, opens, last_opened_at, disabled_at, archived_at').single();
          if (!error) return NextResponse.json({ ok: true, link: { ...data, url: `${watchBase()}/w/${data.slug}` } });
          if (!String(error.message).includes('duplicate')) throw error; // slug clash → try another
        }
        return NextResponse.json({ error: 'Could not make a unique link, try again' }, { status: 500 });
      }
      case 'update-link': {
        if (!b.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        const patch = {};
        if ('disabled' in b) patch.disabled_at = b.disabled ? now : null;
        if ('archived' in b) patch.archived_at = b.archived ? now : null;
        if ('password' in b) patch.password = clean(b.password, 100);
        if ('recipient' in b) patch.recipient = clean(b.recipient);
        if (!Object.keys(patch).length) return NextResponse.json({ ok: true });
        const { error } = await db.from('studio_sample_links').update(patch).eq('id', b.id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }
      case 'delete-link': {
        if (!b.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        const { error } = await db.from('studio_sample_links').delete().eq('id', b.id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Something went wrong' }, { status: 500 });
  }
}
