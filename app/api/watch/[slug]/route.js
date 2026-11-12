// /api/watch/<slug> — public endpoint behind a sample link (/w/<slug>).
// GET  → { title, locked: true }                 when the link has a password
//        { title, items: [...], url, poster }    otherwise (and counts an open)
// POST { password } → same as the unlocked GET   when the password matches (counts an open)
// POST { play: <sampleId> } → counts one play of that clip (multi-clip links)
// ?studio=1 = Josh's own Preview from the admin: plays, but never counts or emails.
//
// A link carries one clip or several (sample_ids, in order). items = every clip
// with its own playable URL; url/poster mirror the FIRST clip so a one-clip link
// behaves exactly as before. An "open" = the moment the URLs are handed out to a
// real browser, so a password link only counts once the right password is
// entered. Every open counts and emails info@ (one email per open, never per clip).
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
const isStudio = (request) => new URL(request.url).searchParams.get('studio') === '1';
const isPerson = (request) => { const ua = request.headers.get('user-agent') || ''; return !!ua && !BOT_RE.test(ua); };

async function load(db, slug) {
  if (!slug || !/^[A-Za-z0-9]{4,32}$/.test(slug)) return null;
  const { data: link } = await db.from('studio_sample_links')
    .select('id, sample_id, sample_ids, recipient, title, password, disabled_at, archived_at')
    .eq('slug', slug).maybeSingle();
  if (!link || link.disabled_at || link.archived_at) return null;
  const ids = link.sample_ids?.length ? link.sample_ids : [link.sample_id];
  const { data: rows } = await db.from('studio_samples')
    .select('id, title, r2_key, thumb_key, content_type, duration_s').in('id', ids);
  const byId = Object.fromEntries((rows || []).filter((r) => r.r2_key).map((r) => [r.id, r]));
  const samples = ids.map((id) => byId[id]).filter(Boolean); // keep Josh's order
  if (!samples.length) return null;
  return { link, samples, title: link.title || samples[0].title || 'A Main Event Studio Presentation' };
}

async function release(request, db, row) {
  if (!isStudio(request) && isPerson(request)) {
    try {
      const { data } = await db.rpc('studio_sample_open', { p_link: row.link.id });
      const r = Array.isArray(data) ? data[0] : data;
      await sendSampleOpenedNotice({
        recipient: row.link.recipient || '',
        title: row.title,
        count: row.samples.length,
        opens: r?.opens || null,
        prevOpenedAt: r?.prev_opened_at || null,
      });
    } catch { /* tracking is best-effort — never block playback */ }
  }
  const items = await Promise.all(row.samples.map(async (s) => ({
    id: s.id,
    title: s.title,
    duration: s.duration_s ? Number(s.duration_s) : null,
    contentType: s.content_type || 'video/mp4',
    url: await getViewUrl(s.r2_key, 43200),
    poster: s.thumb_key ? await getViewUrl(s.thumb_key, 43200).catch(() => null) : null,
  })));
  return NextResponse.json({
    title: row.title,
    items,
    url: items[0].url,
    poster: items[0].poster,
    contentType: items[0].contentType,
  });
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

  // A play ping from a multi-clip page. Only counts clips that are on this link.
  if (body?.play) {
    if (!isStudio(request) && isPerson(request) && row.samples.some((s) => s.id === body.play)) {
      try { await db.rpc('studio_sample_play', { p_link: row.link.id, p_sample: body.play }); } catch { /* best-effort */ }
    }
    return NextResponse.json({ ok: true });
  }

  const given = String(body?.password || '').trim();
  if (row.link.password && given.toLowerCase() !== String(row.link.password).trim().toLowerCase()) {
    return NextResponse.json({ error: 'That password is not right.' }, { status: 401 });
  }
  return release(request, db, row);
}
