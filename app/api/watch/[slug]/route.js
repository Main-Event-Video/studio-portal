// /api/watch/<slug> — public endpoint behind a sample link (/w/<slug>).
// GET  → { title, locked: true }            when the link has a password
//        { title, url, poster }             otherwise (and counts an open)
// POST { password } → { title, url, poster } when the password matches (counts an open)
// ?studio=1 = Josh's own Preview from the admin: plays, but never counts or emails.
//
// An "open" = the moment the video URL is handed out to a real browser, so a
// password link only counts once the right password is entered. Every open
// counts (not just the first) and emails info@ — Josh's spec for sample links.
// A turned-off or archived link answers "not available".
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { getViewUrl } from '@/lib/r2';
import { sendSampleOpenedNotice } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Same list the cut share page uses: prefetchers, link scanners and unfurlers
// must never count as an open.
const BOT_RE = /(bot|crawl|spider|slurp|facebookexternalhit|slackbot|twitterbot|whatsapp|telegrambot|discordbot|linkedinbot|embedly|redditbot|applebot|bingbot|googlebot|duckduckbot|yandexbot|mediapartners|proofpoint|mimecast|barracuda|skypeuripreview|preview|curl|wget|python|axios|node-fetch|go-http|headless|phantom|puppeteer|pingdom|uptimerobot|monitor|scanner)/i;

const NOT_AVAILABLE = () => NextResponse.json({ error: 'This link is not available.' }, { status: 404 });

async function load(db, slug) {
  if (!slug || !/^[A-Za-z0-9]{4,32}$/.test(slug)) return null;
  const { data: link } = await db.from('studio_sample_links')
    .select('id, sample_id, recipient, title, password, disabled_at, archived_at')
    .eq('slug', slug).maybeSingle();
  if (!link || link.disabled_at || link.archived_at) return null;
  const { data: sample } = await db.from('studio_samples')
    .select('id, title, r2_key, thumb_key, content_type').eq('id', link.sample_id).maybeSingle();
  if (!sample || !sample.r2_key) return null;
  return { link, sample, title: link.title || sample.title || 'A Main Event Studio Presentation' };
}

async function release(request, db, row) {
  const studio = new URL(request.url).searchParams.get('studio') === '1';
  const ua = request.headers.get('user-agent') || '';
  if (!studio && ua && !BOT_RE.test(ua)) {
    try {
      const { data } = await db.rpc('studio_sample_open', { p_link: row.link.id });
      const r = Array.isArray(data) ? data[0] : data;
      await sendSampleOpenedNotice({
        recipient: row.link.recipient || '',
        title: row.title,
        opens: r?.opens || null,
        prevOpenedAt: r?.prev_opened_at || null,
      });
    } catch { /* tracking is best-effort — never block playback */ }
  }
  const url = await getViewUrl(row.sample.r2_key, 43200);
  const poster = row.sample.thumb_key ? await getViewUrl(row.sample.thumb_key, 43200).catch(() => null) : null;
  return NextResponse.json({ title: row.title, url, poster, contentType: row.sample.content_type || 'video/mp4' });
}

export async function GET(request, { params }) {
  const db = createServiceClient();
  const row = await load(db, params?.slug);
  if (!row) return NOT_AVAILABLE();
  if (row.link.password) return NextResponse.json({ title: row.title, locked: true });
  return release(request, db, row);
}

export async function POST(request, { params }) {
  const db = createServiceClient();
  const row = await load(db, params?.slug);
  if (!row) return NOT_AVAILABLE();
  let body = {};
  try { body = await request.json(); } catch { /* empty */ }
  const given = String(body?.password || '').trim();
  if (row.link.password && given.toLowerCase() !== String(row.link.password).trim().toLowerCase()) {
    return NextResponse.json({ error: 'That password is not right.' }, { status: 401 });
  }
  return release(request, db, row);
}
