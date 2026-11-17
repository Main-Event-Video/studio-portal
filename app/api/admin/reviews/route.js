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
//   request-link { clientId }  → { url }  (makes the client's private link if needed)
//   send-request { clientId, to, subject, heading, message } → emails the request
//              (only after the admin clicks "Request approved to send to client"),
//              copy to info@, and records when they were asked / reminded.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import crypto from 'crypto';
import { requireAdmin } from '@/lib/adminAuth';
import { sendReviewRequest } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const clean = (v, n = 200) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const COLS = 'id, created_at, client_id, source, stars, body, original_body, name_given, name_display, event_label, ok_to_post, status, posted_at';
const MODES = ['full', 'first', 'initials'];
const ALPHA = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeToken(len = 24) {
  const bytes = crypto.randomBytes(len);
  let t = '';
  for (let i = 0; i < len; i++) t += ALPHA[bytes[i] % ALPHA.length];
  return t;
}
function reviewBase() {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://clients.maineventstudio.com').replace(/\/$/, '');
}
// The client's private review link — made once, then reused for reminders.
async function linkFor(db, clientId) {
  const { data: c } = await db.from('studio_clients').select('id, review_token, review_asked_at').eq('id', clientId).maybeSingle();
  if (!c) return null;
  let token = c.review_token;
  if (!token) {
    token = makeToken();
    const { error } = await db.from('studio_clients').update({ review_token: token }).eq('id', clientId);
    if (error) return null;
  }
  return { url: `${reviewBase()}/review?c=${token}`, askedBefore: !!c.review_asked_at };
}

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
    case 'request-link': {
      const l = await linkFor(db, b.clientId);
      if (!l) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      return NextResponse.json({ url: l.url });
    }
    case 'send-request': {
      const to = clean(b.to, 300), subject = clean(b.subject, 200), heading = clean(b.heading, 200);
      const message = typeof b.message === 'string' ? b.message.slice(0, 8000) : '';
      if (!to.includes('@')) return NextResponse.json({ error: 'Add an email address in To.' }, { status: 400 });
      if (!subject || !message.trim()) return NextResponse.json({ error: 'Subject and message are both needed.' }, { status: 400 });
      const l = await linkFor(db, b.clientId);
      if (!l) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      try { await sendReviewRequest({ to, subject, heading, message, link: l.url }); }
      catch (e) { return NextResponse.json({ error: `The email could not be sent: ${e?.message || 'unknown error'}` }, { status: 502 }); }
      await db.from('studio_clients').update(l.askedBefore ? { review_reminded_at: now } : { review_asked_at: now }).eq('id', b.clientId);
      return NextResponse.json({ ok: true, at: now, reminder: l.askedBefore });
    }
    default: return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
