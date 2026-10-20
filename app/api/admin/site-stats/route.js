// GET /api/admin/site-stats?range=today|7d|30d|90d — numbers for the admin
// "Site analytics" panel (maineventstudio.com traffic from studio_site_views).
// Admin-only (same Bearer check as every /api/admin route). One range drives
// everything: tiles, the per-day chart, top pages, sources, button clicks and
// the map. The tiles also compare against the same-length window just before.
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';

const TZ = 'America/Los_Angeles';
const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 };

// UTC ms of local (LA) midnight for today.
function laMidnight() {
  const [y, m, d] = new Date().toLocaleDateString('en-CA', { timeZone: TZ }).split('-').map(Number);
  let guess = Date.UTC(y, m - 1, d, 8);
  for (let i = 0; i < 3; i++) {
    const g = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
    const wall = Date.UTC(+g.year, +g.month - 1, +g.day, +g.hour % 24, +g.minute);
    const want = Date.UTC(y, m - 1, d, 0, 0);
    if (wall === want) break;
    guess += want - wall;
  }
  return guess;
}
const dayKey = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
const hourKey = (iso) => Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hour12: false }).format(new Date(iso))) % 24;

// Page through PostgREST's 1,000-row cap (the bug that froze MEvid's 30-day card at 1000).
async function fetchAll(make, pageSize = 1000, max = 200000) {
  const rows = [];
  for (let from = 0; from < max; from += pageSize) {
    const { data, error } = await make().range(from, from + pageSize - 1);
    if (error) return { rows, error };
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return { rows, error: null };
}

const PAGE_NAMES = { '/': 'Home', '/samplework': 'Portfolio', '/testimonials': 'Testimonials', '/about': 'About', '/articles': 'Articles', '/contact': 'Contact', '/pricing': 'Pricing', '/new-page': 'Client Page' };
function pageName(p) {
  const path = (p || '/').replace(/\/+$/, '') || '/';
  if (PAGE_NAMES[path]) return PAGE_NAMES[path];
  if (path.startsWith('/articles/')) return 'Article: ' + path.slice(10).replace(/[-_]+/g, ' ').slice(0, 40);
  return path;
}
function sourceName(h) {
  if (!h) return 'Direct / typed in';
  if (/(^|\.)google\./.test(h)) return 'Google search';
  if (/bing\.|duckduckgo\.|yahoo\.|ecosia\.|search\.brave/.test(h)) return 'Other search engines';
  if (/instagram\./.test(h)) return 'Instagram';
  if (/facebook\.|(^|\.)fb\.|messenger\./.test(h)) return 'Facebook';
  if (/tiktok\./.test(h)) return 'TikTok';
  if (/youtube\.|youtu\.be/.test(h)) return 'YouTube';
  if (/maineventvideo\.|mevid\.co/.test(h)) return 'MEvid';
  if (/wish\.org/.test(h)) return 'Make-A-Wish';
  return h;
}
const CLICK_NAMES = { mevid: 'MEvid banner → See how it works', donate: 'Make-A-Wish → Donate', contact: 'Contact / Start your project', phone_email: 'Phone / email taps', portal: 'Client Portal link' };

function topN(map, n) {
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n).map(([label, count]) => ({ label, count }));
}
function summarize(rows) {
  const views = rows.filter((r) => r.kind === 'view');
  const clicks = rows.filter((r) => r.kind === 'click');
  const visitors = new Set(views.map((r) => r.visitor).filter(Boolean));
  const visits = new Set(views.map((r) => `${r.visitor}|${dayKey(r.created_at)}`));
  return { views: views.length, visitors: visitors.size, visits: visits.size, clicks: clicks.length };
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const range = new URL(request.url).searchParams.get('range');
  const key = range === 'today' || RANGE_DAYS[range] ? range : '7d';
  const now = Date.now();
  const start = key === 'today' ? laMidnight() : now - RANGE_DAYS[key] * 864e5;
  const priorStart = start - (now - start);

  const db = createServiceClient();
  const { rows: all, error } = await fetchAll(() => db.from('studio_site_views')
    .select('created_at, kind, path, label, visitor, referrer, device, country, region, city, lat, lng')
    .gte('created_at', new Date(priorStart).toISOString())
    .order('created_at', { ascending: true }));
  if (error) return NextResponse.json({ error: 'Could not load site analytics', detail: error.message }, { status: 500 });

  const startIso = new Date(start).toISOString();
  const rows = all.filter((r) => r.created_at >= startIso);
  const prior = all.filter((r) => r.created_at < startIso);
  const views = rows.filter((r) => r.kind === 'view');
  const clicks = rows.filter((r) => r.kind === 'click');

  // Visits per day (or per hour for Today), zero-filled so the chart has no gaps.
  let series = [];
  if (key === 'today') {
    const nowHour = hourKey(new Date().toISOString());
    const byH = {};
    for (const r of views) { const h = hourKey(r.created_at); (byH[h] = byH[h] || new Set()).add(r.visitor); }
    for (let h = 0; h <= nowHour; h++) series.push({ label: `${(h % 12) || 12}${h < 12 ? 'a' : 'p'}`, value: byH[h] ? byH[h].size : 0 });
  } else {
    const byD = {};
    for (const r of views) { const d = dayKey(r.created_at); (byD[d] = byD[d] || new Set()).add(r.visitor); }
    for (let i = RANGE_DAYS[key] - 1; i >= 0; i--) {
      const d = dayKey(new Date(now - i * 864e5).toISOString());
      const [, m, dd] = d.split('-');
      series.push({ label: `${Number(m)}/${Number(dd)}`, value: byD[d] ? byD[d].size : 0 });
    }
  }

  const pages = {}, sources = {}, btn = {};
  for (const r of views) {
    pages[pageName(r.path)] = (pages[pageName(r.path)] || 0) + 1;
  }
  // Source = where a visit STARTED: first view per visitor per day.
  const seenVisit = new Set();
  for (const r of views) {
    const v = `${r.visitor}|${dayKey(r.created_at)}`;
    if (seenVisit.has(v)) continue;
    seenVisit.add(v);
    const s = sourceName(r.referrer); sources[s] = (sources[s] || 0) + 1;
  }
  for (const r of clicks) btn[r.label] = (btn[r.label] || 0) + 1;
  const buttonClicks = Object.keys(CLICK_NAMES).map((k) => ({ label: CLICK_NAMES[k], count: btn[k] || 0 }));

  // Map: one dot per place, red when anyone from there clicked a tracked button.
  const clickers = new Set(clicks.map((r) => r.visitor));
  const places = {};
  for (const r of views) {
    if (r.lat == null || r.lng == null) continue;
    const k = `${r.lat.toFixed(2)},${r.lng.toFixed(2)}`;
    const label = [r.city, r.region && r.country === 'US' ? r.region : r.country].filter(Boolean).join(', ') || 'Unknown';
    const p = places[k] || (places[k] = { lat: r.lat, lng: r.lng, label, visitors: new Set(), clicked: false });
    p.visitors.add(r.visitor);
    if (clickers.has(r.visitor)) p.clicked = true;
  }
  const mapPoints = Object.values(places).map((p) => ({ lat: p.lat, lng: p.lng, label: p.label, hits: p.visitors.size, clicked: p.clicked }))
    .sort((a, b) => b.hits - a.hits).slice(0, 3000);
  const locAgg = {};
  for (const p of mapPoints) {
    const l = locAgg[p.label] || (locAgg[p.label] = { label: p.label, hits: 0, lat: p.lat, lng: p.lng });
    l.hits += p.hits;
  }
  const locations = Object.values(locAgg).sort((a, b) => b.hits - a.hits).slice(0, 8);

  const totals = summarize(rows);
  const devices = {};
  for (const r of views) devices[r.device || 'unknown'] = (devices[r.device || 'unknown'] || 0) + 1;

  return NextResponse.json({
    range: key,
    since: startIso,
    totals,
    prior: summarize(prior),
    series,
    topPages: topN(pages, 6),
    sources: topN(sources, 6),
    buttonClicks,
    devices,
    mapPoints,
    locations,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
