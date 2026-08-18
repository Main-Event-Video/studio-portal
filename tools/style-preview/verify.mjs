// House verification (HANDOFF-11 §9): build EVERY style with cards + green
// bookends and a mixed-aspect photo set, then assert the JSON is sane.
import fs from 'node:fs';
import { buildMontageSource, STYLES, styleNeedsDims } from './montage.mjs';

const manifest = JSON.parse(fs.readFileSync('/home/claude/samples/manifest.json', 'utf8')).slice(0, 9);
let fail = 0;
for (const style of Object.keys(STYLES)) {
  const needs = styleNeedsDims(STYLES[style]);
  const photos = manifest.map((m) => ({
    type: 'photo', url: `https://x/${m.file}`, framing: 'top', fit: null, size: 100,
    colorCorrect: false, mode: 'color', contrast: 100, saturation: 100, posX: null, posY: null,
    w: needs ? m.w : null, h: needs ? m.h : null,
  }));
  const green = { type: 'photo', green: true, url: 'https://x/green.png', fit: 'fill', w: 1920, h: 1080 };
  for (const mode of ['cards+green', 'bare', 'length60', 'nodims']) {
    const items = mode === 'bare' ? photos : [green, ...photos, green];
    const its = mode === 'nodims' ? items.map((i) => ({ ...i, w: i.green ? i.w : null, h: i.green ? i.h : null })) : items;
    let src;
    try {
      src = buildMontageSource({
        items: its, style, title: 'DYLAN', subtitle: 'BAT MITZVAH',
        watermarkUrl: 'https://x/watermark.png', assetBase: 'https://x',
        includeCards: mode !== 'bare', greenBookends: false,
        photoSeconds: mode === 'length60' ? null : 2,
        totalSeconds: mode === 'length60' ? 60 : null,
        background: null, mpTransition: 'record-fwd',
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

    if (mode === 'length60' && Math.abs(dur - 60) > 0.05 && !STYLES[style].multipage) {
      bad.push(`length mode did not snap to 60s (got ${dur.toFixed(2)})`);
    }
    if (bad.length) { console.log(`FAIL ${style}/${mode}: ${[...new Set(bad)].join('; ')}`); fail++; }
  }
}
console.log(fail === 0 ? `ALL ${Object.keys(STYLES).length} STYLES OK (4 modes each)` : `${fail} failures`);
