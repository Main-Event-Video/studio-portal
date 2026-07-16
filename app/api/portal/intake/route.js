// POST /api/portal/intake  { token, ...intakeFields }
// Saves (upserts) a client's questionnaire, then best-effort emails Josh.
// Session-gated exactly like the other portal routes.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { getClientByToken } from '@/lib/portal';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { sendIntakeNotification } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VIBE_OPTIONS = [
  'Elegant', 'Glamorous', 'Romantic', 'Luxury', 'Minimalist', 'Emotional',
  'Modern', 'FUN', 'Trendy', 'Hollywood', 'High Energy', 'Editorial',
];

function clean(v) {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const { token } = body || {};
  if (!token) return NextResponse.json({ error: 'Missing portal token' }, { status: 400 });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: 'Portal not found' }, { status: 404 });

  const authed = verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (authed !== client.id) {
    return NextResponse.json({ error: 'Please sign in again' }, { status: 401 });
  }

  // Whitelist + sanitize. Only fields we defined in studio_intake.
  const vibe = Array.isArray(body.vibe)
    ? body.vibe.filter((v) => VIBE_OPTIONS.includes(v))
    : [];

  const eventDate = clean(body.event_date); // 'YYYY-MM-DD' from a date input, or null

  const row = {
    client_id: client.id,
    first_name: clean(body.first_name),
    last_name: clean(body.last_name),
    main_contact_name: clean(body.main_contact_name),
    event_date: eventDate,
    contact_number: clean(body.contact_number),
    contact_number_type: clean(body.contact_number_type),
    email: clean(body.email),
    news_signup: !!body.news_signup,
    preferred_contact_method: clean(body.preferred_contact_method),
    preferred_language: clean(body.preferred_language),
    preferred_language_other: clean(body.preferred_language_other),
    venue: clean(body.venue),
    honoree_names: clean(body.honoree_names),
    age_milestone: clean(body.age_milestone),
    has_logo: typeof body.has_logo === 'boolean' ? body.has_logo : null,
    event_description: clean(body.event_description),
    vibe,
    color_palette: clean(body.color_palette),
    inspiration_links: clean(body.inspiration_links),
    songs: clean(body.songs),
    must_include: clean(body.must_include),
    avoid_content: clean(body.avoid_content),
    hobbies: clean(body.hobbies),
    favorite_media: clean(body.favorite_media),
    favorite_quotes: clean(body.favorite_quotes),
    anything_else: clean(body.anything_else),
    submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const db = createServiceClient();
  const { error } = await db
    .from('studio_intake')
    .upsert(row, { onConflict: 'client_id' });

  if (error) {
    return NextResponse.json(
      { error: 'Could not save your answers', detail: error.message },
      { status: 500 }
    );
  }

  // Best-effort notify; never blocks the save.
  sendIntakeNotification({ client, intake: row }).catch(() => {});

  return NextResponse.json({ ok: true });
}
