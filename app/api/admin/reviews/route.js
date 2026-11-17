// /api/admin/reviews — the admin "Reviews" panel (Josh + Robyn signed off 11/17).
// Reviews come in from the public form (/api/review) as 'waiting'. Only
// 'posted' reviews ever show on the website. Reviews are never deleted here:
// Hide / Take down moves them to 'hidden', and they can be brought back.
//
// GET  → { reviews: [...newest first, with client name], waiting: n }
// POST { action, ... }:
//   approve  { id }                → posted (shows on the website)
//   hide     { id }                → hidden (waiting or posted → off the site)
//   restore  { id }                → waiting again
//   edit     { id, body?, name_given?, name_display?, event_label?, stars? }
//   add      { stars, body, name_given, name_display, event_label, post }
//            → a review typed in by hand (arrived by text/email). post=true
//              puts it straight on the website.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const clean = (v, n = 200) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const COLS = 'id, created_at, client_id, source, stars, body, original_body, name_given, name_display, event_label, ok_to_post, status, posted_at';
const MODES = ['full', 'first', 'initials'];

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const db = createServiceClient();
  const { data, error } = await db.from('studio_reviews').select(COLS).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message.includes('does not exist') ? 'Run the 020 database step first.' : error.message }, { status: 500 });
  const ids = [...new Set((data || []).map((r) => r.client_id).filter(Boolean))];
  let names = {};
  if (ids.length) {
    const { data: cs } = await db.from('studio_clients').select('id, display_name').in('id', ids);
    names = Object.fromEntries((cs || []).map((c) => [c.id, c.display_name]));
  }
  const reviews = (data || []).map((r) => ({ ...r, client_name: names[r.client_id] || '' }));
  return NextResponse.json({ reviews, waiting: reviews.filter((r) => r.status === 'waiting').length });
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const db = createServiceClient();
  let b = {};
  try { b = await request.json(); } catch { /* empty */ }
  const now = new Date().toISOString();
  const upd = async (patch) => {
    if (!b.id) return NextResponse.json({ error: 'Missing review id' }, { status: 400 });
    const { data, error } = await db.from('studio_reviews').update(patch).eq('id', b.id).select(COLS).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ review: data });
  };

  switch (b.action) {
    case 'approve': return upd({ status: 'posted', posted_at: now });
    case 'hide': return upd({ status: 'hidden' });
    case 'restore': return upd({ status: 'waiting', posted_at: null });
    case 'edit': {
      const p = {};
      if ('body' in b) { const v = clean(b.body, 4000); if (!v) return NextResponse.json({ error: 'The review text cannot be empty.' }, { status: 400 }); p.body = v; }
      if ('name_given' in b) { const v = clean(b.name_given, 120); if (!v) return NextResponse.json({ error: 'The name cannot be empty.' }, { status: 400 }); p.name_given = v; }
      if ('name_display' in b && MODES.includes(b.name_display)) p.name_display = b.name_display;
      if ('event_label' in b) p.event_label = clean(b.event_label, 120) || null;
      if ('stars' in b) { const s = Math.round(Number(b.stars)); if (s >= 1 && s <= 5) p.stars = s; }
      return upd(p);
    }
    case 'add': {
      const stars = Math.round(Number(b.stars));
      const body = clean(b.body, 4000), name = clean(b.name_given, 120);
      if (!(stars >= 1 && stars <= 5) || !body || !name) return NextResponse.json({ error: 'Stars, review text and name are all needed.' }, { status: 400 });
      const row = {
        source: 'manual', stars, body, original_body: body, name_given: name,
        name_display: MODES.includes(b.name_display) ? b.name_display : 'first',
        event_label: clean(b.event_label, 120) || null, ok_to_post: true,
        status: b.post ? 'posted' : 'waiting', posted_at: b.post ? now : null,
      };
      const { data, error } = await db.from('studio_reviews').insert(row).select(COLS).single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ review: data });
    }
    default: return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
