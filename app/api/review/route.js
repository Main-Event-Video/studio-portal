// /api/review — the public review form behind the "How did we do?" email
// (Reviews, Josh + Robyn signed off 11/17). The link is
// /review?c=<client review_token>&stars=n.
// GET  ?c=<token> → { name, greeting, event }   (to pre-fill the form)
// POST { c, stars, body, name, event, display, ok } → saves a 'waiting' review,
//      marks the client reviewed, emails info@. Nothing is posted on the website
//      until an admin clicks Approve & post.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { sendNewReviewNotice } from '@/lib/email';
import { greetingName } from '@/lib/reviewName';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const clean = (v, n = 200) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const NOT_FOUND = () => NextResponse.json({ error: 'This review link is not valid. Please use the link from your email.' }, { status: 404 });

async function clientFor(db, token) {
  if (!token || !/^[A-Za-z0-9]{8,64}$/.test(token)) return null;
  const { data } = await db.from('studio_clients')
    .select('id, display_name, last_name, event_type').eq('review_token', token).maybeSingle();
  return data || null;
}

export async function GET(request) {
  const db = createServiceClient();
  const c = await clientFor(db, new URL(request.url).searchParams.get('c'));
  if (!c) return NOT_FOUND();
  // Pre-fill "Your name" only when the welcome name is one first name
  // ("Michelle" + last name → "Michelle Yosifon"). A family welcome name
  // ("Noah & family") leaves it blank for them to type.
  const greeting = greetingName(c.display_name);
  const single = greeting && !/\s/.test(greeting) && greeting === String(c.display_name).trim();
  const last = String(c.last_name || '').trim();
  const name = single && last ? `${greeting} ${last[0].toUpperCase()}${last.slice(1)}` : '';
  return NextResponse.json({
    name,
    greeting,
    event: (c.event_type || '').trim(),
  });
}

export async function POST(request) {
  const db = createServiceClient();
  let b = {};
  try { b = await request.json(); } catch { /* empty */ }
  const c = await clientFor(db, b.c);
  if (!c) return NOT_FOUND();

  const stars = Math.round(Number(b.stars));
  const body = clean(b.body, 4000);
  const name = clean(b.name, 120);
  const display = ['full', 'first', 'initials'].includes(b.display) ? b.display : 'first';
  if (!(stars >= 1 && stars <= 5)) return NextResponse.json({ error: 'Please tap a star rating.' }, { status: 400 });
  if (!body) return NextResponse.json({ error: 'Please write a few words.' }, { status: 400 });
  if (!name) return NextResponse.json({ error: 'Please add your name.' }, { status: 400 });

  const row = {
    client_id: c.id, source: 'client', stars, body, original_body: body,
    name_given: name, name_display: display, event_label: clean(b.event, 120) || null,
    ok_to_post: !!b.ok, status: 'waiting',
  };
  const { data, error } = await db.from('studio_reviews').insert(row).select('id').single();
  if (error) return NextResponse.json({ error: 'Sorry, your review could not be saved. Please try again.' }, { status: 500 });
  await db.from('studio_clients').update({ reviewed_at: new Date().toISOString() }).eq('id', c.id);
  await sendNewReviewNotice({ ...row, client: c.display_name }).catch(() => {});
  return NextResponse.json({ ok: true, id: data.id });
}
