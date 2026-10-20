// POST /api/site/hit — visitor beacon for maineventstudio.com (Squarespace).
//
// The Studio's public site lives on Squarespace, which cannot run server code,
// so a tiny script in Squarespace Code Injection sends each page view (and each
// click on a tracked button) here. Rows land in studio_site_views and feed the
// admin "Site analytics" panel. Pattern mirrors MEvid's /api/hit:
//   • known bots dropped
//   • visitor = salted hash of IP+UA (raw IP never stored)
//   • city-level location from Vercel's geo headers
// Best-effort: always answers 200 so the beacon never errors on the site.
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { createServiceClient } from '@/lib/supabaseAdmin';

const SALT = process.env.ANALYTICS_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || 'mes-analytics';
const BOT_RE = /bot|crawl|spider|slurp|bing|google|yandex|baidu|duckduck|facebookexternalhit|embedly|pinterest|slackbot|telegrambot|whatsapp|discordbot|headless|phantom|puppeteer|playwright|lighthouse|gtmetrix|pingdom|uptime|monitor|curl|wget|python-requests|axios|node-fetch|semrush|ahrefs|dataprovider|preview/i;
const ALLOWED_ORIGINS = ['https://www.maineventstudio.com', 'https://maineventstudio.com'];
const CLICK_LABELS = new Set(['mevid', 'donate', 'contact', 'phone_email', 'portal']);

function cors(request) {
  const origin = request.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function deviceFromUA(ua) {
  const s = String(ua || '').toLowerCase();
  if (!s) return 'unknown';
  if (/ipad|tablet|playbook|silk|kindle|(android(?!.*mobi))/.test(s)) return 'tablet';
  if (/mobi|iphone|ipod|android|windows phone|blackberry|iemobile|opera mini/.test(s)) return 'mobile';
  return 'desktop';
}

// Bare referring host; our own site (and empty) → null = "direct".
function refHost(ref) {
  if (!ref) return null;
  try {
    const h = new URL(ref).hostname.replace(/^www\./, '');
    if (!h || h === 'maineventstudio.com' || h.endsWith('.maineventstudio.com') || h.endsWith('squarespace.com')) return null;
    return h.slice(0, 120);
  } catch { return null; }
}

export async function OPTIONS(request) {
  return new NextResponse(null, { status: 204, headers: cors(request) });
}

export async function POST(request) {
  const headers = cors(request);
  try {
    // Only count beacons sent from the Studio site itself.
    const origin = request.headers.get('origin') || '';
    if (origin && !ALLOWED_ORIGINS.includes(origin)) return NextResponse.json({ ok: true, skipped: 'origin' }, { headers });

    // sendBeacon posts text/plain (no CORS preflight), so parse the raw text.
    let body = {};
    try { body = JSON.parse(await request.text()); } catch { body = {}; }
    const ua = request.headers.get('user-agent') || '';
    if (BOT_RE.test(ua)) return NextResponse.json({ ok: true, skipped: 'bot' }, { headers });

    const kind = body.kind === 'click' ? 'click' : 'view';
    const label = kind === 'click' && CLICK_LABELS.has(body.label) ? body.label : null;
    if (kind === 'click' && !label) return NextResponse.json({ ok: true, skipped: 'label' }, { headers });
    let path = String(body.path || '/').slice(0, 300);
    if (!path.startsWith('/')) path = '/';

    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || request.headers.get('x-real-ip') || 'noip';
    const visitor = createHash('sha256').update(`${ip}|${ua}|${SALT}`).digest('hex').slice(0, 16);
    const geo = (h) => { const v = request.headers.get(h); if (!v) return null; try { return decodeURIComponent(v).slice(0, 80); } catch { return v.slice(0, 80); } };
    const flt = (h) => { const v = request.headers.get(h); const n = v ? parseFloat(v) : NaN; return Number.isFinite(n) ? n : null; };

    const row = {
      kind, path, label, visitor,
      referrer: kind === 'view' ? refHost(body.ref) : null,
      device: deviceFromUA(ua),
      country: geo('x-vercel-ip-country'), region: geo('x-vercel-ip-country-region'), city: geo('x-vercel-ip-city'),
      lat: flt('x-vercel-ip-latitude'), lng: flt('x-vercel-ip-longitude'),
    };
    const { error } = await createServiceClient().from('studio_site_views').insert(row);
    if (error) {
      console.error('studio_site_views insert failed:', error.message || error);
      return NextResponse.json({ ok: false }, { headers });
    }
    return NextResponse.json({ ok: true }, { headers });
  } catch (e) {
    return NextResponse.json({ ok: false }, { headers });
  }
}
