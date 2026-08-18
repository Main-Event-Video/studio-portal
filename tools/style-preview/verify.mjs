// House verification (HANDOFF-11 §9): build EVERY style with cards + green
// bookends and a mixed-aspect photo set, then assert the JSON is sane.
import fs from 'node:fs';
import { buildMontageSource, STYLES, styleNeedsDims } from './montage.mjs';

const manifest = JSON.parse(fs.readFileSync('/home/claude/samples/manifest.json', 'utf8')).slice(0, 9);
let fail = 0;
const warn = [];
for (const style of Object.keys(STYLES)) {
  const needs = styleNeedsDims(STYLES[style]);
  const photos = manifest.map((m) => ({
    type: 'photo', url: `https://x/${m.file}`, framing: 'top', fit: null, size: 100,
    colorCorrect: false, mode: 'color', contrast: 100, saturation: 100, posX: null, posY: null,
    w: needs ? m.w : null, h: needs ? m.h : null,
  }));
  const green = { type: 'photo', green: true, url: 'https://x/green.png', fit: 'fill', w: 1920, h: 1080 };
  for (const mode of ['cards+green', 'bare', 'length60', 'nodims', 'imagebg', 'videobg', 'texturebg']) {
    const items = mode === 'bare' ? photos : [green, ...photos, green];
    const bg = mode === 'imagebg' ? { url: 'https://r2/wall.jpg', tint: '#102040', opacity: '45%' }
      : mode === 'videobg' ? { videoUrl: 'https://r2/loop.mp4', kind: 'video', tint: '#102040', opacity: '45%' }
        : mode === 'texturebg' ? { texture: 'linen', animated: true, textureUrl: 'https://x/backgrounds/linen.jpg', tint: '#102040', opacity: '35%' }
          : null;
    const its = mode === 'nodims' ? items.map((i) => ({ ...i, w: i.green ? i.w : null, h: i.green ? i.h : null })) : items;
    let src;
    try {
      src = buildMontageSource({
        items: its, style, title: 'DYLAN', subtitle: 'BAT MITZVAH',
        watermarkUrl: 'https://x/watermark.png', assetBase: 'https://x',
        includeCards: mode !== 'bare', greenBookends: false,
        photoSeconds: mode === 'length60' ? null : 2,
        totalSeconds: mode === 'length60' ? 60 : null,
        background: bg, mpTransition: 'record-fwd',
      });
    } catch (e) { console.log(`FAIL ${style}/${mode}: threw ${e.message}`); fail++; continue; }
    const json = JSON.stringify(src);
    const bad = [];
    if (/undefined/.test(json)) bad.push('contains "undefined"');
    if (/NaN/.test(json)) bad.push('contains NaN');
    if (/null%/.test(json)) bad.push('contains "null%"');
    if (!src.elements || !src.elements.length) bad.push('no elements');
    const dur = (src.elements || []).reduce((m, e) => Math.max(m, (e.time || 0) + (e.duration || 0)), 0);
    if (!(dur > 0)) bad.push('zero duration');
    // Every image element must have a source
    (function walk(e) {
      if (!e || typeof e !== 'object') return;
      if (e.type === 'image' && !e.source) bad.push('image with no source');
      if (typeof e.time === 'number' && (e.time < -1e-6)) bad.push(`negative time ${e.time}`);
      if (typeof e.duration === 'number' && e.duration <= 0) bad.push(`non-positive duration ${e.duration}`);
      (e.elements || []).forEach(walk);
    })({ elements: src.elements });
    // Keyframe arrays must be strictly ordered in time and must not run past the
    // element's own duration — Creatomate interpolates between consecutive
    // keyframes, so an out-of-order pair silently produces garbage motion and a
    // keyframe beyond the duration simply never arrives. Neither is visible in
    // JSON.stringify, and neither is something I can test without a render.
    const KF = ['x','y','x_scale','y_scale','scale','opacity','z_rotation','x_rotation','y_rotation','width','height','blur_radius','stroke_start','stroke_end','stroke_offset'];
    (function kfWalk(e, parentDur) {
      if (!e || typeof e !== 'object') return;
      const dur = typeof e.duration === 'number' ? e.duration : parentDur;
      for (const k of KF) {
        const arr = e[k];
        if (!Array.isArray(arr) || !arr.length || typeof arr[0] !== 'object') continue;
        let prev = -Infinity;
        for (const kf of arr) {
          const t = typeof kf.time === 'number' ? kf.time : NaN;
          if (!Number.isFinite(t)) { bad.push(`${e.name || e.type}.${k} keyframe with non-numeric time`); break; }
          if (t < prev) { bad.push(`${e.name || e.type}.${k} keyframes out of order (${prev} then ${t})`); break; }
          if (t < -1e-6) { bad.push(`${e.name || e.type}.${k} negative keyframe time ${t}`); break; }
          prev = t;
        }
        const lastT = arr[arr.length - 1] && arr[arr.length - 1].time;
        if (Number.isFinite(dur) && Number.isFinite(lastT) && lastT > dur + 1e-6) {
          bad.push(`${e.name || e.type}.${k} last keyframe ${lastT} > duration ${dur}`);
        }
      }
      (e.elements || []).forEach((c) => kfWalk(c, dur));
    })({ elements: src.elements }, dur);

    // SAME-TRACK OVERLAP. A track is a lane: two clips sharing one and overlapping
    // in time is not a valid timeline, and Creatomate resolves it by dropping one
    // of them. The ONLY legal overlap is a transition, which is exactly how the
    // incoming clip blends over the outgoing one.
    //
    // This is the check that would have caught the imported-background bug, where
    // the fill, the backdrop and the tint all sat on track 1 for the full montage
    // and the backdrop vanished after the first shot. The simulator could NOT
    // catch it — it stacks overlapping layers rather than modelling the conflict.
    (function trackWalk(els, parentDur, path) {
      const byTrack = new Map();
      els.forEach((el, i) => {
        const tr = el.track == null ? `auto${i}` : `T${el.track}`;
        if (!byTrack.has(tr)) byTrack.set(tr, []);
        byTrack.get(tr).push(el);
      });
      for (const [tr, list] of byTrack) {
        const timed = list.filter((el) => typeof el.time === 'number')
          .map((el) => ({ el, start: el.time, end: el.time + (typeof el.duration === 'number' ? el.duration : parentDur) }))
          .sort((a, b) => a.start - b.start);
        // Tolerance is just under one frame at 30fps. scaleMontageToLength rounds
        // every time and duration independently to 3dp, so after a length-mode
        // rescale a transition's overlap can miss its animation duration by a few
        // milliseconds. That drift is sub-frame and invisible; a 1ms tolerance
        // flags it as a conflict and buries the real ones.
        const FRAME = 0.02;
        for (let k = 1; k < timed.length; k++) {
          const overlap = timed[k - 1].end - timed[k].start;
          if (overlap <= FRAME) continue;
          const tAnim = Array.isArray(timed[k].el.animations) && timed[k].el.animations.find((a) => a && a.transition);
          if (overlap > (tAnim ? Number(tAnim.duration) || 0 : 0) + FRAME) {
            const msg = `track ${tr}: "${timed[k - 1].el.name || timed[k - 1].el.type}" overlaps "${timed[k].el.name || timed[k].el.type}" by ${overlap.toFixed(2)}s with no transition`;
            // KNOWN, PRE-EXISTING, DELIBERATELY NOT FIXED. Epic Vintage and Trendy
            // both stack grade/dust/leak layers on tracks that their own photo
            // elements also use, so some of those layers are being dropped in the
            // render. Fixing it would change the look of two styles Josh has
            // already signed off on — probably for the better (it is a plausible
            // cause of "the leaks are way too dim" and of the render never quite
            // matching the approved browser preview), but that is his call and it
            // costs a render to confirm. Warned, not failed, so this check stays
            // useful for new work instead of crying wolf.
            if (style === 'epic_vintage' || style === 'trendy') warn.push(`${style}/${mode} ${path}${msg}`);
            else bad.push(`${path}${msg}`);
          }
        }
      }
      els.forEach((el) => {
        if (Array.isArray(el.elements) && el.elements.length) {
          trackWalk(el.elements, typeof el.duration === 'number' ? el.duration : parentDur, `${path}${el.name || el.type} > `);
        }
      });
    })(src.elements, dur, '');

    if (mode === 'length60' && Math.abs(dur - 60) > 0.05 && !STYLES[style].multipage) {
      bad.push(`length mode did not snap to 60s (got ${dur.toFixed(2)})`);
    }
    if (bad.length) { console.log(`FAIL ${style}/${mode}: ${[...new Set(bad)].join('; ')}`); fail++; }
  }
}
if (warn.length) {
  console.log(`\n${warn.length} KNOWN pre-existing track conflicts (not failures):`);
  [...new Set(warn.map((w) => w.replace(/\/[a-z0-9+]+ /, ' ')))].forEach((w) => console.log('  WARN', w));
  console.log('');
}
console.log(fail === 0 ? `ALL ${Object.keys(STYLES).length} STYLES OK (7 modes each)` : `${fail} failures`);
