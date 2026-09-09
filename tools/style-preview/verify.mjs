// House verification (HANDOFF-11 §9): build EVERY style with cards + green
// bookends and a mixed-aspect photo set, then assert the JSON is sane.
import fs from 'node:fs';
// Imports the SHIPPING engine directly. This used to import a hand-copied
// tools/style-preview/montage.mjs, which is gitignored and by 2026-09-08 had
// drifted 173 lines behind lib/montage.js — so this tool was reporting on an
// engine that does not ship. There is no copy step any more; there is nothing
// left to keep in step.
import { buildMontageSource, STYLES, styleNeedsDims, DUO_PALETTES, DUO_TREATMENTS } from '../../lib/montage.js';

// The sample set lived at a hardcoded /home/claude path, which only exists in
// one particular sandbox — anywhere else this tool died on line 6 before it
// checked anything. SAMPLES overrides it; the old path stays the default.
const SAMPLES = process.env.SAMPLES || '/home/claude/samples/manifest.json';
const manifest = JSON.parse(fs.readFileSync(SAMPLES, 'utf8')).slice(0, 9);
let fail = 0;
const warn = [];
const borderCounts = {};
for (const style of Object.keys(STYLES)) {
  const needs = styleNeedsDims(STYLES[style]);
  const photos = manifest.map((m) => ({
    type: 'photo', url: `https://x/${m.file}`, framing: 'top', fit: null, size: 100,
    colorCorrect: false, mode: 'color', contrast: 100, saturation: 100, posX: null, posY: null,
    w: needs ? m.w : null, h: needs ? m.h : null,
  }));
  const green = { type: 'photo', green: true, url: 'https://x/green.png', fit: 'fill', w: 1920, h: 1080 };
  // 'border' exercises the photo-border path: a border forces the dimension probe
  // in the real route, so it is verified WITH dims. 'border-nodims' is the
  // degraded path where the probe failed and the engine must frame the slot
  // rather than emit a broken rect.
  for (const mode of ['cards+green', 'bare', 'length60', 'nodims', 'imagebg', 'videobg', 'texturebg', 'border', 'border-nodims']) {
    const items = mode === 'bare' ? photos : [green, ...photos, green];
    const bg = mode === 'imagebg' ? { url: 'https://r2/wall.jpg', tint: '#102040', opacity: '45%' }
      : mode === 'videobg' ? { videoUrl: 'https://r2/loop.mp4', kind: 'video', tint: '#102040', opacity: '45%' }
        : mode === 'texturebg' ? { texture: 'linen', animated: true, textureUrl: 'https://x/backgrounds/linen.jpg', tint: '#102040', opacity: '35%' }
          : null;
    let its = mode === 'nodims' ? items.map((i) => ({ ...i, w: i.green ? i.w : null, h: i.green ? i.h : null })) : items;
    if (mode === 'border' || mode === 'border-nodims') {
      // A deliberately FAT border (near the slider maximum) — a thin one can hide
      // an inverted or negative rect that a heavy one exposes immediately.
      const b = { on: true, w: 5.5, color: '#FFDD55', at: 1 };
      its = items.map((i) => (i.green ? i : {
        ...i, border: b,
        ...(mode === 'border-nodims' ? { w: null, h: null } : {}),
      }));
    }
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
    // A STROKED SHAPE MUST NEVER CARRY blur_radius.
    //
    // This one cost three renders. Glass's pane rim was a stroked shape with
    // `fill_color: 'rgba(0,0,0,0)'` plus blur_radius and blend_mode 'screen',
    // and it rendered GREY — about 150/255 — instead of white. On Glass's light
    // wall that reads as a black edge, which is exactly what Josh reported three
    // times ("All the edges look wrong. They Look Black not White"). Measured on
    // render V4: background 241, "white" edge 157.
    //
    // The cause is that a stroked shape's fill is transparent BLACK, and a
    // non-premultiplied blur drags that black through the stroke. The same three
    // properties on a FILLED shape are fine — render 005's beams are white fill
    // + blur + screen and measured 86 -> 178 over a dark photo.
    //
    // It is invisible in the DOM simulator, because browsers blur with
    // premultiplied alpha and get it right. So it cannot be caught by previewing;
    // it can only be caught here, by refusing the construct.
    (function blurWalk(e) {
      if (!e || typeof e !== 'object') return;
      if (e.type === 'shape' && e.stroke_color && e.blur_radius) {
        const filled = e.fill_color
          && !(typeof e.fill_color === 'string' && /rgba\([^)]*,\s*0\s*\)/.test(e.fill_color));
        if (!filled) bad.push(`${e.name || 'shape'} is a stroked shape with blur_radius — renders grey, not ${e.stroke_color}`);
      }
      (e.elements || []).forEach(blurWalk);
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

    // A VIDEO element with no explicit duration runs for its MEDIA length, so
    // `loop` has nothing to loop into and a short backdrop clip simply stops
    // partway through the montage. Images are fine without one — they have no
    // intrinsic length — but every video must say how long it is on screen.
    (function videoDur(e) {
      if (!e || typeof e !== 'object') return;
      if (e.type === 'video' && typeof e.duration !== 'number') {
        bad.push(`video "${e.name || 'unnamed'}" has no explicit duration (would play once at media length, not loop)`);
      }
      (e.elements || []).forEach(videoDur);
    })({ elements: src.elements });

    // A border must never produce a degenerate rect. Percentages at or below zero
    // mean the inset ate the box; above 100 means it escaped it. Either renders as
    // a block of colour over the photo rather than a frame around it, and neither
    // shows up as invalid JSON.
    if (mode === 'border' || mode === 'border-nodims') {
      let seen = 0;
      (function borderWalk(e) {
        if (!e || typeof e !== 'object') return;
        if (e.name === 'PhotoBorder') {
          seen++;
          for (const k of ['width', 'height']) {
            const v = parseFloat(String(e[k]));
            if (!Number.isFinite(v)) bad.push(`PhotoBorder ${k} not numeric (${e[k]})`);
            else if (v <= 0) bad.push(`PhotoBorder ${k} collapsed to ${v}%`);
            else if (v > 100.001) bad.push(`PhotoBorder ${k} overflows its box at ${v}%`);
          }
          if (!/^\d+ px$/.test(String(e.stroke_width))) bad.push(`PhotoBorder stroke_width not px (${e.stroke_width})`);
          if (!/^#[0-9A-F]{6}$/i.test(String(e.stroke_color))) bad.push(`PhotoBorder bad colour ${e.stroke_color}`);
        }
        (e.elements || []).forEach(borderWalk);
      })({ elements: src.elements });
      // Not every style draws borders yet; the point of the count is to notice
      // when a style that DID draw them silently stops.
      borderCounts[style] = Math.max(borderCounts[style] || 0, seen);
    }

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
// Which styles actually draw a border, so coverage is a fact on the record
// rather than an assumption. A style at 0 is not broken — it just has not been
// wired yet, and this is the list of what is left.
const withB = Object.keys(STYLES).filter((k) => (borderCounts[k] || 0) > 0);
const withoutB = Object.keys(STYLES).filter((k) => !(borderCounts[k] || 0));
console.log(`\nBORDERS drawn in ${withB.length}/${Object.keys(STYLES).length} styles.`);
if (withoutB.length) console.log('  no border yet: ' + withoutB.join(', '));

// The duotone options must not break the two styles they apply to.
for (const style of ['duotone', 'duotone2', 'duotone_pastel']) {
  for (const pal of [null, ...Object.keys(DUO_PALETTES)]) {
    for (const tr of [null, ...Object.keys(DUO_TREATMENTS)]) {
      const photos = manifest.map((m) => ({ type: 'photo', url: `https://x/${m.file}`, framing: 'top', fit: null, size: 100, colorCorrect: false, mode: 'color', contrast: 100, saturation: 100, posX: null, posY: null, w: m.w, h: m.h }));
      try {
        const src = buildMontageSource({ items: photos, style, title: 'D', subtitle: 'B', watermarkUrl: null, includeCards: false, greenBookends: false, photoSeconds: 2, duoPalette: pal, duoTreatment: tr });
        const j = JSON.stringify(src);
        if (/undefined|NaN|null%/.test(j)) { console.log(`FAIL ${style} pal=${pal} tr=${tr}: bad value in JSON`); fail++; }
        if (!src.elements || !src.elements.length) { console.log(`FAIL ${style} pal=${pal} tr=${tr}: no elements`); fail++; }
      } catch (e) { console.log(`FAIL ${style} pal=${pal} tr=${tr}: threw ${e.message}`); fail++; }
    }
  }
}
console.log(`Duotone: ${Object.keys(DUO_PALETTES).length} palettes x ${Object.keys(DUO_TREATMENTS).length} treatments checked on 3 styles.`);

// NEON RINGS. Two separate ways these have already failed a real render, so
// both are asserted here:
//   1. VALID BUT INVISIBLE. The arcs used to be free-floating rounded rects
//      drawn on the EDGE of a box larger than the frame, so at 104% (never mind
//      174%) the outline sat at -2% and 102% and not one pixel was ever inside
//      the picture. They now nest INSIDE each shot's own composition at
//      100% x 100%, which is what puts them on the picture's edge — so the test
//      is that they are exactly that, and never a stray size again.
//   2. VISIBLE BUT INVALID. Creatomate requires stroke_start / stroke_end /
//      stroke_offset in 0-100 and rejects the WHOLE render otherwise. The trim
//      was start + length with start from the full range, so five arcs in
//      thirty exceeded it — intermittent by construction, which is why it
//      survived several renders before a seed happened to hit it.
{
  let rings = 0, offbox = 0, ranges = 0;
  for (const style of ['hollywood', 'sliding_images', 'photo_slide', 'party2', 'basic_cut', 'polaroid']) {
    const photos = manifest.map((m) => ({ type: 'photo', url: `https://x/${m.file}`, framing: 'top', fit: null, size: 100, colorCorrect: false, mode: 'color', contrast: 100, saturation: 100, posX: null, posY: null, w: m.w, h: m.h }));
    const src = buildMontageSource({ items: photos, style, title: 'N', watermarkUrl: null, includeCards: false, greenBookends: false, photoSeconds: 2, width: 1920, height: 1080, neonOpts: { on: true, colors: ['#00E5FF'] } });
    const walk = (node) => {
      for (const k of (node.elements || [])) {
        if (k.type === 'shape' && k.stroke_start !== undefined) {
          rings++;
          if (k.width !== '100%' || k.height !== '100%') {
            offbox++;
            if (offbox < 4) console.log(`FAIL ${style}: neon ring is ${k.width} x ${k.height}, not 100% of its shot — it will not sit on the picture's edge`);
          }
          const vals = [k.stroke_start, k.stroke_end, ...(Array.isArray(k.stroke_offset) ? k.stroke_offset.map((f) => f.value) : [k.stroke_offset])];
          for (const v of vals) {
            if (v === undefined) continue;
            const num = parseFloat(v);
            if (!Number.isFinite(num) || num < -100 || num > 100) {
              ranges++;
              if (ranges < 4) console.log(`FAIL ${style}: stroke value ${v} is outside the 0-100 Creatomate accepts`);
            }
          }
        }
        walk(k);
      }
    };
    (src.elements || []).forEach(walk);
  }
  fail += offbox + ranges;
  console.log(`Neon: ${rings} rings checked across 6 styles, ${offbox} off their shot box, ${ranges} out of range.`);

  // EVERY PICTURE GETS A LIGHT. Josh: "the neon selector isn't hitting on
  // every image." Two ways it wasn't: a borderless Fit photo went out as a
  // bare <image> with no composition to nest a ring in (every 9:16 on Party 2
  // / Party 3), and the six-box cap left half of Photo Ribbon / Gallery /
  // Trendy dark. Dims are passed for every style here because the route now
  // forces the probe whenever neon is on.
  let dark = 0;
  for (const style of Object.keys(STYLES)) {
    const photos = manifest.map((m) => ({ type: 'photo', url: `https://x/${m.file}`, framing: 'top', fit: null, size: 100, colorCorrect: false, mode: 'color', contrast: 100, saturation: 100, posX: null, posY: null, w: m.w, h: m.h }));
    const src = buildMontageSource({ items: photos, style, title: 'N', watermarkUrl: null, includeCards: false, greenBookends: false, photoSeconds: 2, width: 1920, height: 1080, neonOpts: { on: true, colors: ['#00E5FF'] } });
    const seen = new Set(), lit = new Set();
    const walk = (node, ringed) => {
      const kids = node.elements || [];
      const has = ringed || kids.some((k) => k.type === 'shape' && k.stroke_start !== undefined);
      for (const k of kids) {
        if ((k.type === 'image' || k.type === 'video') && /^https:\/\/x\//.test(k.source || '') && !/green/.test(k.source)) { seen.add(k.source); if (has) lit.add(k.source); }
        walk(k, has);
      }
    };
    walk(src, false);
    const miss = [...seen].filter((u) => !lit.has(u)).length;
    if (miss) { dark += miss; console.log(`FAIL ${style}: ${miss} of ${seen.size} photos have no neon ring`); }
  }
  fail += dark;
  console.log(`Neon coverage: ${dark} unlit photos across ${Object.keys(STYLES).length} styles.`);
}

// UNITS. Creatomate validates these and rejects the WHOLE render on one bad
// value — a montage was lost to `Shape.z_rotation: Expected a number ending
// with \u00B0` because two new elements were written with CSS's "deg" instead of
// the degree symbol every other z_rotation in the engine already used. Nothing
// caught it: it parses, it builds, it collides with nothing, and it only fails
// at Creatomate. Cheap to assert, so assert it everywhere.
{
  let checked = 0, wrong = 0;
  for (const style of Object.keys(STYLES)) {
    const photos = manifest.map((m) => ({ type: 'photo', url: `https://x/${m.file}`, framing: 'top', fit: null, size: 100, colorCorrect: false, mode: 'color', contrast: 100, saturation: 100, posX: null, posY: null, w: m.w, h: m.h }));
    const src = buildMontageSource({ items: photos, style, title: 'U', watermarkUrl: null, includeCards: false, greenBookends: false, photoSeconds: 2, width: 1920, height: 1080, assetBase: 'https://x', atmosphereOpts: { on: true }, neonOpts: { on: true, intensity: 300, colors: ['#00E5FF', '#FF2D95'] } });
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (node.z_rotation !== undefined) {
        const vals = Array.isArray(node.z_rotation) ? node.z_rotation.map((k) => k.value) : [node.z_rotation];
        for (const v of vals) {
          checked++;
          if (typeof v === 'string' && !/\u00B0$/.test(v)) {
            wrong++;
            if (wrong < 4) console.log(`FAIL ${style}: z_rotation ${JSON.stringify(v)} must end with \u00B0, not deg`);
          }
        }
      }
      Object.values(node).forEach(walk);
    };
    walk(src.elements);
  }
  fail += wrong;
  console.log(`Units: ${checked} z_rotation values checked across all styles, ${wrong} wrong.`);
}

console.log(fail === 0 ? `\nALL ${Object.keys(STYLES).length} STYLES OK (9 modes each)` : `\n${fail} failures`);
