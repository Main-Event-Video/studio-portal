'use client';

// SITE ANALYTICS (Josh 10/20) — maineventstudio.com traffic, folded under the
// "Site analytics" pill beside New client. A hybrid: our own tracker
// (studio_site_views, fed by the Squarespace Code Injection beacon → /api/site/hit)
// shown here, plus a link out to Squarespace's own Analytics for history and
// deeper reports. The map is the same approach as MEvid's admin map: Leaflet
// from unpkg + dark-filtered OpenStreetMap tiles, dot size by visitors.
// A pill at the top jumps to MEvid's Analytics page (and MEvid links back here).

import { useEffect, useRef, useState } from 'react';

const RANGES = [['today', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days']];
const SQUARESPACE_ANALYTICS = 'https://mackerel-krill-j3ga.squarespace.com/config/analytics';
const MEVID_ANALYTICS = 'https://maineventvideo.com/admin/usage';
const BLUE = '#3d7bff', RED = '#ff2e4c';

const box = { border: '1px solid var(--line)', borderRadius: 10, padding: 14, background: 'var(--panel-2)', minWidth: 0 };
const kicker = { fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 };
const rowStyle = { display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', borderTop: '1px solid var(--line)', fontSize: 13 };

function delta(cur, prev, rangeKey) {
  if (!prev) return cur ? 'new this period' : '';
  const pct = Math.round(((cur - prev) / prev) * 100);
  const vs = rangeKey === 'today' ? 'vs yesterday' : 'vs prior period';
  return `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}% ${vs}`;
}

function List({ title, items, empty, onPick }) {
  return (
    <div style={box}>
      <div style={kicker}>{title}</div>
      {items && items.length ? items.map((it, i) => (
        <div key={i} style={{ ...rowStyle, borderTop: i ? rowStyle.borderTop : 0, cursor: onPick ? 'pointer' : 'default' }}
          onClick={onPick ? () => onPick(it) : undefined}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
          <span style={{ fontWeight: 700 }}>{(it.count ?? it.hits ?? 0).toLocaleString()}</span>
        </div>
      )) : <div style={{ color: 'var(--muted)', fontSize: 13 }}>{empty || 'Nothing yet'}</div>}
    </div>
  );
}

function Chart({ series }) {
  const W = 1000, H = 130, pad = 14;
  const max = Math.max(1, ...series.map((s) => s.value));
  const n = series.length;
  const x = (i) => (n === 1 ? W / 2 : pad + (i * (W - pad * 2)) / (n - 1));
  const y = (v) => H - 24 - ((H - 40) * v) / max;
  const every = Math.ceil(n / 10);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {[0, 0.5, 1].map((f) => <line key={f} x1="0" x2={W} y1={16 + (H - 40) * f} y2={16 + (H - 40) * f} stroke="var(--line)" />)}
      <polyline fill="none" stroke={BLUE} strokeWidth="3" points={series.map((s, i) => `${x(i)},${y(s.value)}`).join(' ')} />
      {series.map((s, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(s.value)} r={n > 40 ? 2.5 : 4} fill={BLUE}><title>{`${s.label}: ${s.value}`}</title></circle>
          {i % every === 0 || i === n - 1 ? <text x={x(i)} y={H - 4} fontSize="11" fill="var(--muted)" textAnchor="middle">{s.label}</text> : null}
        </g>
      ))}
    </svg>
  );
}

export default function SiteAnalytics({ api }) {
  const [range, setRange] = useState('7d');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    let live = true;
    setLoading(true); setErr('');
    api(`/api/admin/site-stats?range=${range}`)
      .then((j) => { if (live) setData(j); })
      .catch((e) => { if (live) setErr(e.message || 'Could not load site analytics'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [range, api]);

  // Leaflet, loaded once from unpkg exactly like MEvid's admin map.
  useEffect(() => {
    if (!data || !mapEl.current) return;
    let cancelled = false;
    const ensure = () => new Promise((resolve) => {
      if (window.L) return resolve(window.L);
      if (!document.getElementById('leaflet-css')) {
        const l = document.createElement('link');
        l.id = 'leaflet-css'; l.rel = 'stylesheet'; l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(l);
      }
      let s = document.getElementById('leaflet-js');
      if (!s) {
        s = document.createElement('script');
        s.id = 'leaflet-js'; s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        document.body.appendChild(s);
      }
      s.addEventListener('load', () => resolve(window.L));
    });
    ensure().then((L) => {
      if (cancelled || !L || !mapEl.current) return;
      if (!mapRef.current) {
        mapRef.current = L.map(mapEl.current, { worldCopyJump: true, scrollWheelZoom: true }).setView([37, -96], 3);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap' }).addTo(mapRef.current);
        layerRef.current = L.layerGroup().addTo(mapRef.current);
      }
      const layer = layerRef.current;
      layer.clearLayers();
      const pts = data.mapPoints || [];
      const max = Math.max(1, ...pts.map((p) => p.hits));
      pts.forEach((p) => {
        const c = p.clicked ? RED : BLUE;
        L.circleMarker([p.lat, p.lng], { radius: 4 + Math.round(9 * Math.sqrt(p.hits / max)), color: c, fillColor: c, fillOpacity: 0.55, weight: 1.5 })
          .bindPopup(`${p.label} · ${p.hits} visitor${p.hits === 1 ? '' : 's'}${p.clicked ? ' · clicked a button' : ''}`)
          .addTo(layer);
      });
      if (pts.length) mapRef.current.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lng])).pad(0.3), { maxZoom: 6 });
      setTimeout(() => mapRef.current && mapRef.current.invalidateSize(), 120);
    });
    return () => { cancelled = true; };
  }, [data]);

  // Pill closed → panel unmounts → drop the map so reopening builds a fresh one.
  useEffect(() => () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; layerRef.current = null; } }, []);

  const flyTo = (loc) => { if (mapRef.current && loc.lat != null) mapRef.current.flyTo([loc.lat, loc.lng], 9, { duration: 0.8 }); };
  const t = data?.totals || {}, p = data?.prior || {};
  const tile = (label, value, sub) => (
    <div style={box}>
      <div style={kicker}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800 }}>{(value || 0).toLocaleString()}</div>
      <div style={{ fontSize: 12, color: 'var(--ok)', minHeight: 16 }}>{sub}</div>
    </div>
  );
  const nothingYet = data && !t.views && !t.clicks;

  return (
    <div style={{ marginTop: 16 }}>
      <style>{`.mes-sa .leaflet-tile-pane{filter:invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.86) saturate(0.55)}
        .mes-sa .leaflet-container{background:#1a2433;border-radius:8px}
        .mes-sa-grid4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
        .mes-sa-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        .mes-sa-map{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:12px}
        @media (max-width:760px){.mes-sa-grid4{grid-template-columns:1fr 1fr}.mes-sa-grid3,.mes-sa-map{grid-template-columns:1fr}}`}</style>
      <div className="mes-sa" style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <b style={{ fontSize: 16 }}>maineventstudio.com</b>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>· counted by our own tracker, since it went live</span>
          <a href={MEVID_ANALYTICS} target="_blank" rel="noopener"
            style={{ border: '1px solid #F5C800', color: '#F5C800', borderRadius: 999, padding: '5px 12px', fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textDecoration: 'none' }}>
            MEvid Analytics ↗
          </a>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {RANGES.map(([k, l]) => (
              <button key={k} type="button" onClick={() => setRange(k)}
                style={{ padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, border: `1px solid ${range === k ? BLUE : 'var(--line)'}`, background: range === k ? BLUE : 'transparent', color: range === k ? '#fff' : 'var(--text)' }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {err ? <div style={{ color: RED, fontSize: 13 }}>{err}</div> : null}
        {loading && !data ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</div> : null}
        {nothingYet ? <div style={{ ...box, color: 'var(--muted)', fontSize: 13 }}>No visits recorded in this period yet. Tracking starts from the day the site beacon went live — for older history use Squarespace Analytics below.</div> : null}

        {data ? (<>
          <div className="mes-sa-grid4">
            {tile('Visits', t.visits, delta(t.visits, p.visits, range))}
            {tile('Visitors', t.visitors, delta(t.visitors, p.visitors, range))}
            {tile('Pages viewed', t.views, t.visits ? `${(t.views / t.visits).toFixed(1)} per visit` : '')}
            {tile('Button clicks', t.clicks, 'MEvid · Donate · Contact')}
          </div>
          <div style={box}>
            <div style={kicker}>{range === 'today' ? 'Visitors per hour' : 'Visitors per day'}</div>
            <Chart series={data.series || []} />
          </div>
          <div className="mes-sa-map">
            <div style={box}>
              <div style={kicker}>Where visitors are</div>
              <div ref={mapEl} style={{ height: 360, width: '100%' }} />
              <div style={{ display: 'flex', gap: 16, fontSize: 12, marginTop: 8, flexWrap: 'wrap' }}>
                <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: BLUE, marginRight: 6 }} />Visitor</span>
                <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: RED, marginRight: 6 }} />Clicked a button</span>
                <span style={{ color: 'var(--muted)' }}>· click a city to zoom · scroll to zoom</span>
              </div>
            </div>
            <List title="Top locations" items={data.locations} empty="No locations yet" onPick={flyTo} />
          </div>
          <div className="mes-sa-grid3">
            <List title="Top pages" items={data.topPages} />
            <List title="Where visitors came from" items={data.sources} />
            <List title="Button clicks" items={data.buttonClicks} />
          </div>
        </>) : null}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid var(--line)' }}>
          <a href={SQUARESPACE_ANALYTICS} target="_blank" rel="noopener"
            style={{ border: `1px solid ${RED}`, color: '#fff', borderRadius: 999, padding: '8px 16px', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
            Open full Squarespace Analytics ↗
          </a>
          <small style={{ color: 'var(--muted)' }}>Opens Squarespace in a new tab for its full reports (history, search keywords, geography). You need to be logged in to Squarespace.</small>
        </div>
      </div>
    </div>
  );
}
