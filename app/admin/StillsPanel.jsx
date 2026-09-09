'use client';
// app/admin/StillsPanel.jsx — the "Open MEvid Stills" panel under a segment's
// Style select (Josh 9/9 mockup). Only shown when the segment's style is
// 'stills'. Everything else on the segment form (photos, pace, background,
// key colour, cards) already applies to the style; this panel carries only
// what is NEW: transition order, screens, the live preview, and the per-photo
// grid where a photo's arriving move (or a manual screen) is chosen.
//
// Per-photo picks and manual screens live on the CLIENT's photo_edits (like
// every other per-photo edit), so they survive reloads and style switches:
//   photo_edits.photos[key].stills.transition   (null = Auto)
//   photo_edits.stillsGroups                    [{ keys:[…], layout }]
// Segment-level choices (mode / screens / shadow) live on the segment, and so
// do the LOOK settings the bar shares with every other style (sbMode / sbW /
// sbColor for the print border, neonOn / neonI / neonT / neonColors /
// neonExtras for the neon). Josh 9/9: on this page the border ALWAYS
// overrides Edit Photos, so the choice is Off / Colour / Neon — never "use
// Edit Photos".
//
// The preview is a CSS approximation of the Creatomate render (same as the
// MEvid demo pages): right layout and motion, but only the render is the truth.
import { useEffect, useMemo, useRef, useState } from 'react';
import { parsePhotoSpec } from '@/lib/montage';
import { ALL_TRANSITION_KEYS, FX_LABELS, STILLS_FX, NATIVE, screenLayout, planStills } from '@/lib/stillsEngine';
import { BORDER_MIN, BORDER_MAX, BORDER_DEFAULT } from '@/lib/photoBorder';
import NeonControls from './NeonControls';

const BORDER_SWATCHES = ['#FFFFFF', '#000000', '#F5E6C8', '#D8B56B', '#C0C0C0', '#FF4D88'];

const FAMILIES = [
  ['Live today', ['Fade', 'Dissolve', 'Slide', 'Wipe', 'Zoom', 'Pop']],
  ['3D spins', ['flip', 'tumble', 'barrel', 'spinzoom']],
  ['Push / whip / drop', ['push', 'whip', 'drop']],
  ['Light / glitch', ['flash', 'sweep', 'zoomblur', 'glitch']],
  ['Shatter / slice', ['shatter', 'mosaic', 'blinds', 'doors', 'split']],
  ['Cut-out', ['cutfly', 'cutpop', 'cutpeel']],
  ['Paint', ['watercolor']],
];
const LAYOUT_NAMES = { 2: '2-up', 3: '3-up hero', 4: '4-grid' };
const label = (k) => (k ? (FX_LABELS[k] || k) : 'Auto');

export default function StillsPanel({ seg, update, projPhotos, photoEdits, setPhotoEdits, persistEdits, clientId, api }) {
  const mode = seg.stillsMode || 'cycle';
  const screens = seg.stillsScreens || 'off';
  const mix = Array.isArray(seg.stillsMix) ? seg.stillsMix : [];
  const shadow = seg.stillsShadow !== false;
  // Border on this page: 'off' | 'colour' | 'neon' (neon = tracing light, no mat)
  const border = seg.neonOn ? 'neon' : (seg.sbMode === 'none' ? 'off' : 'colour');
  const bW = Number.isFinite(Number(seg.sbW)) ? Number(seg.sbW) : BORDER_DEFAULT.w;
  const bColor = seg.sbColor || BORDER_DEFAULT.color;
  const [open, setOpen] = useState(!!seg.stillsOpen);
  const [menuFor, setMenuFor] = useState(null);      // key of the tile whose menu is open
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState([]);       // keys ticked in Select ✓ mode
  const [swapA, setSwapA] = useState(null);           // first tap of an in-screen swap
  const [previewKey, setPreviewKey] = useState(null);  // scene whose move plays in the preview
  const [derive, setDerive] = useState({ cut: null, wc: null, busy: false, err: '' });

  // A fresh segment arrives with sbMode 'edits' (the other styles' default).
  // Stills always overrides Edit Photos, so that becomes the white default mat.
  useEffect(() => {
    if (open && (!seg.sbMode || seg.sbMode === 'edits')) update({ sbMode: 'custom', sbW: bW, sbColor: bColor });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seg.sbMode]);

  // The photos this segment resolves to, in play order.
  const photos = useMemo(() => {
    const N = projPhotos.length;
    const idx = parsePhotoSpec(seg.photos, N);
    return idx.map((i) => projPhotos[i - 1]).filter(Boolean);
  }, [seg.photos, projPhotos]);
  const keys = useMemo(() => photos.map((p) => p.key), [photos]);
  const picks = useMemo(() => {
    const out = {};
    for (const p of photos) { const t = photoEdits?.photos?.[p.key]?.stills?.transition; if (t) out[p.key] = t; }
    return out;
  }, [photos, photoEdits]);
  const groups = useMemo(() => (Array.isArray(photoEdits?.stillsGroups) ? photoEdits.stillsGroups : []).filter((g) => g.keys.every((k) => keys.includes(k))), [photoEdits, keys]);

  // The plan the engine will use (same function, same inputs) — drives the tile
  // badges ("Auto → Flip"), the screens, and which derivatives to make.
  const plan = useMemo(() => {
    const clips = photos.map((p) => ({ id: p.key, clip_url: p.url, width: 1500, height: 1000, cutout_url: 'x', watercolor_url: 'x', photo_transition: picks[p.key] || null }));
    const CYCLE = ['flip', 'Dissolve', 'push', 'shatter', 'Fade', 'cutfly', 'whip', 'doors', 'Slide', 'barrel', 'split', 'sweep', 'Wipe', 'tumble', 'mosaic', 'flash', 'Zoom', 'spinzoom', 'blinds', 'cutpop', 'Pop', 'glitch', 'zoomblur', 'drop', 'cutpeel', 'watercolor'];
    const all = [...CYCLE, ...ALL_TRANSITION_KEYS.filter((k) => k !== 'Cut' && !CYCLE.includes(k))];
    try {
      return planStills({ id: 'portal', theme: 'fun' }, clips, {
        secs: 2.6, screens, groups: groups.map((g) => ({ ids: g.keys, layout: g.layout })),
        pool: mode === 'mix' && mix.length ? mix : all, order: mode === 'shuffle' ? 'random' : 'cycle', seed: 'preview',
      }).scenes;
    } catch { return []; }
  }, [photos, picks, groups, mode, mix, screens]);

  // ── persistence helpers ────────────────────────────────────────
  const setPick = (key, t) => {
    setPhotoEdits((prev) => {
      const cur = prev.photos[key] || {};
      const stills = { ...(cur.stills || {}) };
      if (t) stills.transition = t; else delete stills.transition;
      const next = { ...prev, photos: { ...prev.photos, [key]: { ...cur, stills } } };
      persistEdits(clientId, next);
      return next;
    });
  };
  const setGroups = (fn) => {
    setPhotoEdits((prev) => {
      const next = { ...prev, stillsGroups: fn(Array.isArray(prev.stillsGroups) ? prev.stillsGroups : []) };
      persistEdits(clientId, next);
      return next;
    });
  };
  const resetAll = () => {
    setPhotoEdits((prev) => {
      const photosNext = { ...prev.photos };
      for (const k of keys) { if (photosNext[k]?.stills?.transition) { const s = { ...photosNext[k].stills }; delete s.transition; photosNext[k] = { ...photosNext[k], stills: s }; } }
      const next = { ...prev, photos: photosNext, stillsGroups: (prev.stillsGroups || []).filter((g) => !g.keys.every((k) => keys.includes(k))) };
      persistEdits(clientId, next);
      return next;
    });
    setSelected([]);
  };
  const groupSelected = () => {
    const ks = keys.filter((k) => selected.includes(k)).slice(0, 4);
    if (ks.length < 2) return;
    setGroups((gs) => [...gs.filter((g) => !g.keys.some((k) => ks.includes(k))), { keys: ks, layout: LAYOUT_NAMES[ks.length] ? String(ks.length) : null }]);
    setSelected([]); setSelecting(false);
    if (screens === 'off') update({ stillsScreens: 'manual' });
  };
  const ungroup = (g) => setGroups((gs) => gs.filter((x) => x !== g && x.keys.join('|') !== g.keys.join('|')));
  const applySelected = (t) => { selected.forEach((k) => setPick(k, t)); setSelected([]); setSelecting(false); };
  const swapInScreen = (g, k) => {
    if (!swapA || swapA.g !== g) { setSwapA({ g, k }); return; }
    const a = g.keys.indexOf(swapA.k), b = g.keys.indexOf(k);
    if (a >= 0 && b >= 0 && a !== b) setGroups((gs) => gs.map((x) => (x.keys.join('|') === g.keys.join('|') ? { ...x, keys: x.keys.map((kk, i) => (i === a ? g.keys[b] : i === b ? g.keys[a] : kk)) } : x)));
    setSwapA(null);
  };

  // ── derivatives (cut-outs / watercolors) for the photos that will need them ──
  useEffect(() => {
    if (!open || !clientId || !photos.length) return;
    const needCut = new Set(), needWc = new Set();
    plan.forEach((sc, i) => {
      const fx = STILLS_FX[sc.transition];
      if (!fx?.needs) return;
      if (fx.needs === 'cutoutB') sc.clips.forEach((c) => needCut.add(c.id));
      if (fx.needs === 'cutoutA' && plan[i - 1]) plan[i - 1].clips.forEach((c) => needCut.add(c.id));
      if (fx.needs === 'watercolorAB') { sc.clips.forEach((c) => needWc.add(c.id)); if (plan[i - 1]) plan[i - 1].clips.forEach((c) => needWc.add(c.id)); }
    });
    const missing = (set, kf, sf) => [...set].filter((k) => { const s = photoEdits?.photos?.[k]?.stills || {}; return !s[kf] && s[sf] !== 'none'; });
    const cutKeys = missing(needCut, 'cutout_key', 'cutout_status');
    const wcKeys = missing(needWc, 'watercolor_key', 'watercolor_status');
    setDerive((d) => ({ ...d, cut: needCut.size ? `${needCut.size - cutKeys.length}/${needCut.size}` : null, wc: needWc.size ? `${needWc.size - wcKeys.length}/${needWc.size}` : null }));
    if (derive.busy || (!cutKeys.length && !wcKeys.length)) return;
    let cancelled = false;
    (async () => {
      setDerive((d) => ({ ...d, busy: true, err: '' }));
      try {
        const what = cutKeys.length ? 'cutout' : 'watercolor';
        const list = cutKeys.length ? cutKeys : wcKeys;
        const res = await api('/api/admin/montage/stills-derive', { method: 'POST', body: JSON.stringify({ clientId, keys: list.slice(0, 6), what }) });
        if (cancelled) return;
        // Fold the results into the edits WITHOUT persisting (the server already saved them).
        setPhotoEdits((prev) => {
          const photosNext = { ...prev.photos };
          for (const d of res.done || []) {
            const cur = photosNext[d.key] || {};
            const kf = what === 'cutout' ? 'cutout_key' : 'watercolor_key', sf = what === 'cutout' ? 'cutout_status' : 'watercolor_status';
            photosNext[d.key] = { ...cur, stills: { ...(cur.stills || {}), [sf]: d.status, ...(d.r2_key ? { [kf]: d.r2_key } : {}) } };
          }
          return { ...prev, photos: photosNext };
        });
      } catch (e) {
        if (!cancelled) setDerive((d) => ({ ...d, err: e.message || 'derive failed' }));
      } finally {
        if (!cancelled) setDerive((d) => ({ ...d, busy: false }));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientId, plan, photoEdits, derive.busy]);

  // ── preview ────────────────────────────────────────────────────
  const previewScene = useMemo(() => {
    if (!plan.length) return null;
    const idx = previewKey ? plan.findIndex((sc) => sc.clips.some((c) => c.id === previewKey)) : -1;
    return idx > 0 ? { A: plan[idx - 1], B: plan[idx], key: plan[idx].transition } : null;
  }, [plan, previewKey]);

  const urlOf = (id) => photos.find((p) => p.key === id)?.url;
  const setCount = Object.keys(picks).length;
  const pillBtn = (on, txt, fn) => (
    <button type="button" className={on ? 'btn-primary' : 'btn-ghost'} style={{ padding: '3px 10px', fontSize: 11 }} onClick={fn}>{txt}</button>
  );
  const help = (txt) => <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, lineHeight: 1.4 }}>{txt}</div>;
  const row = (k, body) => (
    <div key={k} style={{ display: 'grid', gridTemplateColumns: '92px 1fr', gap: '6px 12px', alignItems: 'start', margin: '7px 0' }}>
      <div style={{ fontSize: 12, paddingTop: 4 }}>{k}</div>
      <div>{body}</div>
    </div>
  );
  const section = (title, rows) => (
    <div style={{ marginTop: 12, paddingTop: 9, borderTop: '1px solid var(--line)' }}>
      <div style={{ fontSize: 10.5, letterSpacing: '0.14em', color: '#f5b301', fontWeight: 800, marginBottom: 4 }}>{title}</div>
      {rows}
    </div>
  );

  return (
    <div style={{ marginTop: 8 }}>
      <button type="button" className="btn-primary" style={{ fontSize: 12 }} onClick={() => { setOpen((o) => !o); update({ stillsOpen: !open }); }}>
        {open ? '▴ Close MEvid Stills' : '▾ Open MEvid Stills'}
      </button>
      {open && (
        <div style={{ border: '1px solid rgba(245,179,1,0.5)', borderRadius: 12, marginTop: 8, background: 'rgba(245,179,1,0.05)', padding: '11px 12px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <b style={{ color: '#f5b301' }}>MEvid Stills</b>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>uses this segment's photos, pace, background and key colour from the form</span>
          </div>
          {/* THE BAR — three named sections with a plain-English line under each
              choice (Josh 9/9: "Cycle all 26 / Shuffle / Screens — confusing what
              goes with what"). Mockup approved 9/9. */}
          {section('MOVES — how each photo arrives', [
            row('Order', <>
              <span style={{ display: 'inline-flex', gap: 4 }}>
                {pillBtn(mode === 'cycle', 'Cycle all 26', () => update({ stillsMode: 'cycle' }))}
                {pillBtn(mode === 'shuffle', 'Shuffle', () => update({ stillsMode: 'shuffle' }))}
                {pillBtn(mode === 'mix', `My picks${mix.length ? ` (${mix.length})` : ''}`, () => update({ stillsMode: 'mix' }))}
              </span>
              {help(mode === 'cycle' ? 'Every photo arrives with a different move, in a fixed order that mixes the families. Tap any photo below to give it its own.'
                : mode === 'shuffle' ? 'Same 26 moves, dealt in a random order. Re-render for a new deal.'
                : 'Only the moves you tick here, cycled in order. Tap a photo below to give it something else.')}
              {mode === 'mix' && (
                <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {ALL_TRANSITION_KEYS.filter((k) => k !== 'Cut').map((k) => (
                    <button key={k} type="button" className={mix.includes(k) ? 'btn-primary' : 'btn-ghost'} style={{ padding: '2px 8px', fontSize: 10.5 }}
                      onClick={() => update({ stillsMix: mix.includes(k) ? mix.filter((x) => x !== k) : [...mix, k] })}>{label(k)}</button>
                  ))}
                </div>
              )}
            </>),
          ])}
          {section('SCREENS — two, three or four photos at once', [
            row('Screens', <>
              <span style={{ display: 'inline-flex', gap: 4 }}>
                {pillBtn(screens === 'off', 'Off', () => update({ stillsScreens: 'off' }))}
                {pillBtn(screens === 'auto', 'Auto', () => update({ stillsScreens: 'auto' }))}
                {pillBtn(screens === 'manual', 'Only mine', () => update({ stillsScreens: 'manual' }))}
              </span>
              {help(screens === 'off' ? 'One photo at a time, always.'
                : screens === 'auto' ? 'Now and then the engine puts 2, 3 or 4 photos up together, in the same play order. You can still build your own with Select ✓.'
                : 'No automatic screens — only the ones you build with Select ✓ → Group into a screen.')}
            </>),
          ])}
          {section('LOOK — border, shadow, neon', [
            row('Border', <>
              <span style={{ display: 'inline-flex', gap: 4 }}>
                {pillBtn(border === 'off', 'Off', () => update({ sbMode: 'none', neonOn: false }))}
                {pillBtn(border === 'colour', 'Colour', () => update({ sbMode: 'custom', sbW: bW, sbColor: bColor, neonOn: false }))}
                {pillBtn(border === 'neon', 'Neon', () => update({ sbMode: 'none', neonOn: true }))}
              </span>
              {help(border === 'off' ? 'No border on this montage. (This page always overrides Edit Photos.)'
                : border === 'colour' ? 'A print mat around every photo, this thickness and colour. Overrides Edit Photos.'
                : 'A neon light traces the edge of every photo instead of a mat. Overrides Edit Photos.')}
              {border === 'colour' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: 7, fontSize: 11.5, color: 'var(--muted)' }}>
                  <span>Thickness</span>
                  <input type="range" min={BORDER_MIN} max={BORDER_MAX} step="0.1" value={bW} style={{ width: 110 }}
                    onChange={(ev) => update({ sbMode: 'custom', sbW: Number(ev.target.value) })} />
                  <span style={{ minWidth: 24 }}>{bW.toFixed(1)}</span>
                  <input type="color" value={bColor} aria-label="Border colour"
                    style={{ width: 28, height: 22, padding: 0, border: '1px solid var(--line)', borderRadius: 6, background: 'transparent', cursor: 'pointer' }}
                    onChange={(ev) => update({ sbMode: 'custom', sbColor: ev.target.value.toUpperCase() })} />
                  {BORDER_SWATCHES.map((sw) => (
                    <button key={sw} type="button" title={sw} onClick={() => update({ sbMode: 'custom', sbColor: sw })}
                      style={{ width: 16, height: 16, borderRadius: 4, cursor: 'pointer', padding: 0,
                        border: bColor === sw ? '2px solid #38b6ff' : '1px solid var(--line)', background: sw }} />
                  ))}
                </div>
              )}
              {border === 'neon' && <NeonControls seg={seg} set={update} compact />}
            </>),
            row('Shadow', <>
              <span style={{ display: 'inline-flex', gap: 4 }}>
                {pillBtn(!shadow, 'Off', () => update({ stillsShadow: false }))}
                {pillBtn(shadow, 'On', () => update({ stillsShadow: true }))}
              </span>
              {help('Soft drop shadow under each print. Turns itself off on a green / key-colour background.')}
            </>),
          ])}

          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginTop: 12, flexWrap: 'wrap' }}>
            <Preview scene={previewScene} urlOf={urlOf} shadow={shadow} />
            <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5, maxWidth: 300 }}>
              {previewScene
                ? <>Photo {photos.findIndex((p) => p.key === previewKey) + 1} arriving with <b style={{ color: 'var(--text)' }}>{label(previewScene.key)}</b>. Tap another photo below to preview its move.</>
                : <>Tap a photo below and its arriving move plays here, over the one before it. A CSS approximation — the render is the truth.</>}
              <div style={{ marginTop: 8 }}>
                {derive.cut && <div>Cut-outs ready: {derive.cut}{derive.busy ? ' · working…' : ''}</div>}
                {derive.wc && <div>Watercolors ready: {derive.wc}{derive.busy ? ' · working…' : ''}</div>}
                {derive.err && <div style={{ color: 'var(--red)' }}>{derive.err}</div>}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
            <span>Per photo · {photos.length} in play order · <span style={{ color: 'var(--text)' }}>{setCount} set · {groups.length} screen{groups.length === 1 ? '' : 's'}</span></span>
            <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>
              <button type="button" className="btn-ghost" style={{ padding: '3px 9px', fontSize: 11 }} onClick={resetAll}>Reset all to Auto</button>
              <button type="button" className={selecting ? 'btn-primary' : 'btn-ghost'} style={{ padding: '3px 9px', fontSize: 11 }} onClick={() => { setSelecting((v) => !v); setSelected([]); }}>Select ✓</button>
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 8, marginTop: 8 }}>
            {plan.map((sc, si) => {
              const isScreen = sc.clips.length > 1;
              const g = isScreen ? groups.find((x) => x.keys.join('|') === sc.clips.map((c) => c.id).join('|')) || null : null;
              const first = sc.clips[0];
              const p = photos.find((x) => x.key === first.id);
              const pick = picks[first.id];
              const badge = si === 0 ? 'opens' : (pick ? label(pick) : `Auto · ${label(sc.transition)}`);
              const active = sc.clips.some((c) => c.id === previewKey);
              const tick = (k) => (
                <span onClick={(e) => { e.stopPropagation(); setSelected((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k])); }}
                  style={{ position: 'absolute', right: 4, top: 4, width: 16, height: 16, borderRadius: '50%', background: selected.includes(k) ? '#f5b301' : 'rgba(0,0,0,.55)', border: '1px solid #fff', color: '#000', fontSize: 10, fontWeight: 800, textAlign: 'center', lineHeight: '16px', cursor: 'pointer' }}>{selected.includes(k) ? '✓' : ''}</span>
              );
              return (
                <div key={first.id} style={{ gridColumn: isScreen ? 'span 2' : 'auto', background: 'var(--panel, #1a1b21)', border: `1px solid ${active ? '#f5b301' : isScreen ? '#7ee0a5' : 'var(--line)'}`, borderRadius: 8, position: 'relative' }}>
                  <div onClick={() => setPreviewKey(first.id)} style={{ height: 70, position: 'relative', overflow: 'hidden', borderRadius: '8px 8px 0 0', background: '#000', cursor: 'pointer',
                    display: isScreen ? 'grid' : 'block', gridTemplateColumns: sc.clips.length === 3 ? '1.3fr 1fr' : '1fr 1fr', gridTemplateRows: sc.clips.length === 2 ? '1fr' : '1fr 1fr', gap: 2, padding: isScreen ? 3 : 0 }}>
                    {sc.clips.map((c, ci) => {
                      const pp = photos.find((x) => x.key === c.id);
                      const n = photos.findIndex((x) => x.key === c.id) + 1;
                      const cell = { position: 'relative', overflow: 'hidden', borderRadius: isScreen ? 3 : 0, ...(isScreen && sc.clips.length === 3 && ci === 0 ? { gridRow: '1 / 3' } : {}), outline: swapA && swapA.k === c.id ? '2px solid #f5b301' : 'none' };
                      return (
                        <div key={c.id} style={cell} onClick={isScreen && g ? (e) => { e.stopPropagation(); swapInScreen(g, c.id); setPreviewKey(first.id); } : undefined}>
                          {pp?.url && <img src={pp.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                          <span style={{ position: 'absolute', left: 4, top: 3, fontSize: 10, fontWeight: 800, color: '#fff', textShadow: '0 1px 2px #000' }}>{n}</span>
                          {selecting && !isScreen && tick(c.id)}
                        </div>
                      );
                    })}
                  </div>
                  {isScreen && (
                    <div style={{ fontSize: 10.5, padding: '4px 6px 0', color: '#7ee0a5', fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Screen · {LAYOUT_NAMES[sc.clips.length] || `${sc.clips.length}-up`}{g ? '' : ' (auto)'}</span>
                      {g && <span onClick={() => ungroup(g)} style={{ color: 'var(--muted)', fontWeight: 400, cursor: 'pointer' }}>Ungroup</span>}
                    </div>
                  )}
                  {isScreen && g && <div style={{ fontSize: 10, padding: '0 6px', color: 'var(--muted)' }}>tap two photos to swap them</div>}
                  <div style={{ position: 'relative' }}>
                    <div onClick={() => setMenuFor(menuFor === first.id ? null : first.id)} style={{ fontSize: 10.5, padding: '5px 6px', color: pick ? '#f5b301' : 'var(--muted)', fontWeight: pick ? 700 : 400, cursor: si === 0 ? 'default' : 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {badge}{si > 0 ? ' ▾' : ''}
                    </div>
                    {menuFor === first.id && si > 0 && (
                      <Menu current={pick || null} onPick={(t) => { setPick(first.id, t); setMenuFor(null); setPreviewKey(first.id); }} onClose={() => setMenuFor(null)} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {selecting && (
            <div style={{ marginTop: 8, background: 'rgba(0,0,0,.35)', border: '1px solid rgba(245,179,1,0.4)', borderRadius: 8, padding: '7px 10px', fontSize: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <b style={{ color: '#f5b301' }}>{selected.length} selected</b>
              <button type="button" className="btn-ghost" style={{ padding: '3px 9px', fontSize: 11 }} disabled={selected.length < 2 || selected.length > 4} onClick={groupSelected}>Group into a screen ({LAYOUT_NAMES[selected.length] || 'pick 2–4'})</button>
              <ApplyMenu onPick={applySelected} />
              <button type="button" className="btn-ghost" style={{ padding: '3px 9px', fontSize: 11 }} onClick={() => applySelected(null)}>Back to Auto</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Menu({ current, onPick, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  const it = (k, txt) => (
    <div key={k || 'auto'} onClick={() => onPick(k)} style={{ padding: '4px 8px', borderRadius: 6, cursor: 'pointer', background: (current || null) === k ? '#fff2c9' : 'transparent', fontWeight: (current || null) === k ? 700 : 400 }}>{txt}</div>
  );
  return (
    <div ref={ref} style={{ position: 'absolute', left: 0, top: '100%', zIndex: 30, width: 210, maxHeight: 300, overflowY: 'auto', background: '#fff', color: '#111', borderRadius: 10, boxShadow: '0 12px 30px rgba(0,0,0,.6)', padding: 6, fontSize: 11.5 }}>
      {it(null, 'Auto (cycle)')}
      {FAMILIES.map(([fam, ks]) => (
        <div key={fam}>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: '#2563eb', letterSpacing: '.08em', textTransform: 'uppercase', padding: '6px 8px 2px', borderTop: '1px solid #eee', marginTop: 3 }}>{fam}</div>
          {ks.filter((k) => NATIVE[k] !== undefined || STILLS_FX[k]).map((k) => it(k, label(k)))}
        </div>
      ))}
    </div>
  );
}

function ApplyMenu({ onPick }) {
  const [openM, setOpenM] = useState(false);
  return (
    <span style={{ position: 'relative' }}>
      <button type="button" className="btn-primary" style={{ padding: '3px 9px', fontSize: 11 }} onClick={() => setOpenM((v) => !v)}>Apply transition ▾</button>
      {openM && <Menu current={null} onPick={(t) => { setOpenM(false); if (t) onPick(t); }} onClose={() => setOpenM(false)} />}
    </span>
  );
}

// ── CSS preview of one transition, A → B, looping ──────────────────────────
// Reproduces the moves of the MEvid demo with the segment's real photos.
const EASE = { qIn: 'cubic-bezier(.11,0,.5,0)', qOut: 'cubic-bezier(.5,1,.89,1)', qIO: 'cubic-bezier(.45,0,.55,1)', backOut: 'cubic-bezier(.34,1.56,.64,1)', lin: 'linear' };
function Preview({ scene, urlOf, shadow }) {
  const ref = useRef(null);
  const arCache = useRef(new Map());
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const st = ref.current; if (!st) return;
    st.innerHTML = '';
    if (!scene) { const d = document.createElement('div'); d.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#666;font-size:12px'; d.textContent = 'PREVIEW — tap a photo below'; st.appendChild(d); return; }
    const HOLD = 800;
    const W = st.clientWidth, H = st.clientHeight;
    // Each photo keeps its NATIVE aspect (read from the thumbnail once it has
    // loaded; 3:2 only until then), contained in its cell like the render.
    const stack = (sc, extra = '') => {
      const wrap = document.createElement('div'); wrap.className = 'stk'; wrap.style.cssText = 'position:absolute;inset:0;transform-origin:50% 50%;' + extra;
      const cells = screenLayout(sc.clips.length, '16:9');
      sc.clips.forEach((c, i) => {
        const cell = sc.clips.length > 1 ? cells[i] : { x: 0.5, y: 0.5, w: 1 / 1.06, h: 1 / 1.06 };
        const ph = document.createElement('div');
        const bw = cell.w * W, bh = cell.h * H;
        const size = (ar) => { const pw = Math.min(bw, bh * ar), phh = pw / ar; ph.style.width = `${pw}px`; ph.style.height = `${phh}px`; };
        ph.style.cssText = `position:absolute;left:${cell.x * 100}%;top:${cell.y * 100}%;transform:translate(-50%,-50%);background:#fff;padding:2px;box-sizing:border-box;${shadow ? 'box-shadow:0 4px 12px rgba(0,0,0,.55)' : ''}`;
        size(arCache.current.get(c.id) || 1.5);
        const img = document.createElement('img'); img.src = urlOf(c.id) || ''; img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
        img.onload = () => { if (img.naturalWidth && img.naturalHeight) { const ar = img.naturalWidth / img.naturalHeight; arCache.current.set(c.id, ar); size(ar); } };
        ph.appendChild(img); wrap.appendChild(ph);
      });
      return wrap;
    };
    const bed = (sc) => { const b = document.createElement('div'); b.style.cssText = `position:absolute;inset:-6%;background:url(${urlOf(sc.clips[0].id)}) center/cover;filter:blur(14px) brightness(.6)`; return b; };
    const piece = (src, x0, y0, w, h) => { const d = document.createElement('div'); d.style.cssText = `position:absolute;left:${x0 * 100}%;top:${y0 * 100}%;width:${w * 100}%;height:${h * 100}%;overflow:hidden;transform-origin:50% 50%`; const inner = src.cloneNode(true); inner.style.cssText = `position:absolute;left:${-x0 / w * 100}%;top:${-y0 / h * 100}%;width:${100 / w}%;height:${100 / h}%`; d.appendChild(inner); return d; };
    const A = scene.A, B = scene.B, key = scene.key;
    const bedA = bed(A), bedB = bed(B); bedB.style.opacity = 0;
    st.append(bedA, bedB);
    const anims = [];
    const k = (el, kf, o) => anims.push([el, kf, o]);
    const fx = STILLS_FX[key];
    const D = fx ? fx.D * 1000 : 600;
    k(bedB, [{ opacity: 0 }, { opacity: 1 }], { d: Math.max(300, D * 0.6), e: EASE.qIO });
    let SA = stack(A), SB = stack(B);
    const both = () => st.append(SA, SB);
    switch (key) {
      case 'Fade': case 'Dissolve': both(); k(SB, [{ opacity: 0 }, { opacity: 1 }], { d: D, e: EASE.qIO }); break;
      case 'Slide': both(); k(SB, [{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }], { d: 550, e: EASE.qOut }); break;
      case 'Wipe': both(); k(SB, [{ clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)' }], { d: 600, e: EASE.qIO }); break;
      case 'Zoom': case 'Pop': both(); k(SB, [{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { d: key === 'Pop' ? 400 : 550, e: EASE.qOut }); break;
      case 'flip': both(); k(SA, [{ transform: 'rotateY(0)' }, { transform: 'rotateY(90deg)', opacity: .6 }], { d: D / 2, e: EASE.qIn }); k(SB, [{ transform: 'rotateY(-90deg)', opacity: .6 }, { transform: 'rotateY(0)', opacity: 1 }], { d: D / 2, e: EASE.qOut, delay: D / 2 }); break;
      case 'tumble': both(); k(SA, [{ transform: 'rotateX(0)' }, { transform: 'rotateX(-90deg)', opacity: .6 }], { d: D / 2, e: EASE.qIn }); k(SB, [{ transform: 'rotateX(90deg)', opacity: .6 }, { transform: 'rotateX(0)', opacity: 1 }], { d: D / 2, e: EASE.qOut, delay: D / 2 }); break;
      case 'barrel': both(); k(SA, [{ transform: 'rotate(0) scale(1)', opacity: 1 }, { transform: 'rotate(-180deg) scale(0)', opacity: 0 }], { d: D * .6, e: EASE.qIn }); k(SB, [{ transform: 'rotate(180deg) scale(0)', opacity: 0 }, { transform: 'rotate(0) scale(1)', opacity: 1 }], { d: D * .7, e: EASE.backOut, delay: D * .3 }); break;
      case 'spinzoom': st.append(SB, SA); k(SA, [{ transform: 'rotate(0) scale(1)', opacity: 1, filter: 'blur(0)' }, { transform: 'rotate(25deg) scale(3)', opacity: 0, filter: 'blur(8px)' }], { d: D * .58, e: EASE.qIn }); k(SB, [{ transform: 'rotate(-25deg) scale(.4)', filter: 'blur(8px)' }, { transform: 'rotate(0) scale(1)', filter: 'blur(0)' }], { d: D * .68, e: EASE.qOut, delay: D * .32 }); break;
      case 'push': both(); k(SA, [{ transform: 'translateX(0)' }, { transform: 'translateX(-100%)' }], { d: D, e: EASE.qIO }); k(SB, [{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }], { d: D, e: EASE.qIO }); break;
      case 'whip': both(); k(SA, [{ transform: 'translateX(0)', filter: 'blur(0)' }, { transform: 'translateX(-60%)', filter: 'blur(14px)' }, { transform: 'translateX(-120%)', filter: 'blur(0)' }], { d: D, e: EASE.qIO }); k(SB, [{ transform: 'translateX(120%)', filter: 'blur(0)' }, { transform: 'translateX(60%)', filter: 'blur(14px)' }, { transform: 'translateX(0)', filter: 'blur(0)' }], { d: D, e: EASE.qIO }); break;
      case 'drop': st.append(SB, SA); k(SA, [{ transform: 'translateY(0) rotate(0)' }, { transform: 'translateY(110%) rotate(6deg)' }], { d: D * .56, e: EASE.qIn }); k(SB, [{ transform: 'translateY(-110%)' }, { transform: 'translateY(0)' }], { d: D * .75, e: EASE.backOut, delay: D * .25 }); break;
      case 'flash': { both(); const F = document.createElement('div'); F.style.cssText = 'position:absolute;inset:0;background:#fff;opacity:0'; st.appendChild(F); k(SB, [{ opacity: 0, transform: 'scale(1.08)' }, { opacity: 1, transform: 'scale(1.08)', offset: .3 }, { opacity: 1, transform: 'scale(1)' }], { d: D, e: EASE.qOut }); k(F, [{ opacity: 0 }, { opacity: 1, offset: .3 }, { opacity: 0 }], { d: D * .85, e: EASE.lin }); break; }
      case 'sweep': { both(); const S = document.createElement('div'); S.style.cssText = 'position:absolute;top:0;height:100%;width:35%;left:-40%;background:linear-gradient(90deg,#fff0,#fff,#fff0);filter:blur(10px);transform:skewX(-20deg)'; st.appendChild(S); k(SB, [{ opacity: 0 }, { opacity: 1 }], { d: D * .8, e: EASE.qIO, delay: D * .18 }); k(S, [{ transform: 'translateX(0) skewX(-20deg)' }, { transform: 'translateX(400%) skewX(-20deg)' }], { d: D, e: EASE.qIO }); break; }
      case 'zoomblur': st.append(SB, SA); k(SA, [{ transform: 'scale(1)', filter: 'blur(0)', opacity: 1 }, { transform: 'scale(2.2)', filter: 'blur(18px)', opacity: 0 }], { d: D * .53, e: EASE.qIn }); k(SB, [{ transform: 'scale(1.6)', filter: 'blur(18px)' }, { transform: 'scale(1)', filter: 'blur(0)' }], { d: D * .7, e: EASE.qOut, delay: D * .3 }); break;
      case 'shatter': { st.append(SB); const cols = 6, rows = 4; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const p = piece(SA, c / cols, r / rows, 1 / cols, 1 / rows); st.appendChild(p); const dx = (c - (cols - 1) / 2) * 24 + (Math.random() * 16 - 8), dy = (r - (rows - 1) / 2) * 30 + (Math.random() * 16 - 8); k(p, [{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: `translate(${dx}%,${dy}%) rotate(${(Math.random() * 180 - 90) | 0}deg) scale(.6)`, opacity: 0 }], { d: D, e: EASE.qIn, delay: Math.random() * D * .16 }); } break; }
      case 'mosaic': { st.append(SA); const cols = 6, rows = 4; const step = (D - .32 * D) / (cols + rows - 2); for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const p = piece(SB, c / cols, r / rows, 1 / cols, 1 / rows); st.appendChild(p); k(p, [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { d: .32 * D, e: EASE.backOut, delay: (c + r) * step }); } break; }
      case 'blinds': { st.append(SB); for (let i = 0; i < 8; i++) { const p = piece(SA, i / 8, 0, 1 / 8, 1); st.appendChild(p); k(p, [{ transform: 'rotateY(0)', opacity: 1 }, { transform: 'rotateY(90deg)', opacity: .5 }], { d: D * .45, e: EASE.qIn, delay: i * (D * .55 / 7) }); } break; }
      case 'doors': { st.append(SB); const L = piece(SA, 0, 0, .5, 1), R = piece(SA, .5, 0, .5, 1); L.style.transformOrigin = '0% 50%'; R.style.transformOrigin = '100% 50%'; st.append(L, R); k(L, [{ transform: 'rotateY(0)' }, { transform: 'rotateY(-110deg)' }], { d: D, e: EASE.qIn }); k(R, [{ transform: 'rotateY(0)' }, { transform: 'rotateY(110deg)' }], { d: D, e: EASE.qIn }); break; }
      case 'split': { st.append(SB); const T = piece(SA, 0, 0, 1, .5), Bo = piece(SA, 0, .5, 1, .5); st.append(T, Bo); k(SB, [{ transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { d: D * 1.4, e: EASE.qOut }); k(T, [{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }], { d: D, e: EASE.qIO }); k(Bo, [{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }], { d: D, e: EASE.qIO }); break; }
      case 'glitch': { st.append(SB); for (let i = 0; i < 8; i++) { const p = piece(SA, i / 8, 0, 1 / 8, 1); st.appendChild(p); const j = () => `${(Math.random() * 40 - 20) | 0}px`; k(p, [{ transform: 'translateX(0)' }, { transform: `translateX(${j()})`, filter: 'hue-rotate(90deg) saturate(3)', offset: .25 }, { transform: `translateX(${j()})`, filter: 'hue-rotate(-90deg) saturate(3)', offset: .5 }, { transform: `translateX(${j()})`, opacity: 1, offset: .58 }, { transform: 'translateX(0)', opacity: 0, offset: .6 }, { opacity: 0 }], { d: D, e: EASE.lin }); } break; }
      case 'cutfly': both(); k(SB, [{ transform: 'translateX(85%) scale(1.5)', opacity: 0 }, { transform: 'translateX(0) scale(1)', opacity: 1 }], { d: D * .7, e: EASE.qOut, delay: D * .1 }); break;
      case 'cutpop': both(); k(SA, [{ filter: 'blur(0) brightness(1)' }, { filter: 'blur(7px) brightness(.45)' }], { d: D * .3, e: EASE.qIO }); k(SB, [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { d: D * .4, e: EASE.backOut, delay: D * .2 }); break;
      case 'cutpeel': both(); k(SB, [{ opacity: 0 }, { opacity: 1 }], { d: D * .45, e: EASE.qIO }); k(SA, [{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(0)', opacity: 1, offset: .68 }, { transform: 'translateX(-75%)', opacity: 0 }], { d: D, e: EASE.qIn }); break;
      case 'watercolor': { both(); SA.style.filter = 'none'; k(SA, [{ filter: 'saturate(1) contrast(1)' }, { filter: 'saturate(.7) contrast(.85) blur(1px)' }], { d: D * .25, e: EASE.qIO }); [[32, 38], [66, 30], [50, 70]].forEach(([px, py], i) => { const land = D * (.3 + i * .12); const pud = SB.cloneNode(true); pud.style.clipPath = `circle(0% at ${px}% ${py}%)`; st.appendChild(pud); k(pud, [{ clipPath: `circle(0% at ${px}% ${py}%)` }, { clipPath: `circle(95% at ${px}% ${py}%)` }], { d: D * .42, e: EASE.qOut, delay: land }); }); SB.style.opacity = 0; k(SB, [{ opacity: 0 }, { opacity: 1 }], { d: D * .2, e: EASE.qIO, delay: D * .8 }); break; }
      default: both(); k(SB, [{ opacity: 0 }, { opacity: 1 }], { d: 600, e: EASE.qIO });
    }
    if (['cutfly', 'cutpop', 'cutpeel', 'watercolor'].includes(key)) {
      const n = document.createElement('div'); n.style.cssText = 'position:absolute;left:6px;top:6px;font-size:10px;color:#fff;background:#0009;padding:2px 6px;border-radius:4px'; n.textContent = key === 'watercolor' ? 'painting shown at render' : 'cut-out shown at render'; st.appendChild(n);
    }
    const total = Math.max(...anims.map(([, , o]) => (o.delay || 0) + o.d));
    const handles = anims.map(([el, kf, o]) => el.animate(kf, { duration: o.d, easing: o.e, delay: HOLD + (o.delay || 0), fill: 'both' }));
    const t = setTimeout(() => setTick((x) => x + 1), HOLD + total + 900);
    return () => { clearTimeout(t); handles.forEach((h) => h.cancel()); };
  }, [scene, tick, urlOf, shadow]);
  return <div ref={ref} style={{ width: 400, maxWidth: '100%', aspectRatio: '16/9', background: '#000', borderRadius: 8, position: 'relative', overflow: 'hidden', border: '1px solid var(--line)', perspective: 900, flexShrink: 0 }} />;
}
