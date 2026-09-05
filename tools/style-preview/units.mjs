// Unit check: every geometry/rotation value Creatomate receives, for every
// style, at both aspect ratios.
//
// WHY THIS EXISTS. A render came back with:
//     Source error: Dust-1.z_rotation: Expected a number ending with °
// because a builder wrote '6deg' instead of '6°'. CSS-style units are the
// natural thing to type and Creatomate rejects them, but only at render time —
// so the cost is a failed render and a round trip, not a build error.
//
// AND WHY IT DID NOT CATCH IT AT FIRST. The other harnesses build every style
// without an assetBase, and the dust / light-leak overlays are only emitted
// when one is present. So roughly 1,200 values inside those layers had never
// been checked by anything. That is exactly where the bad unit was. This one
// passes an assetBase for that reason — do not remove it.
//
// Usage: node units.mjs        (montage.mjs must be a fresh copy of lib/montage.js)
import { buildMontageSource, STYLES } from './montage.mjs';

const faces = [{ x: 0.44, y: 0.24, w: 0.14, h: 0.18 }];
const dims = [[1080, 1440], [1440, 1080], [1600, 900], [1080, 1350],
  [1080, 1080], [1600, 1067], [1440, 1080], [1080, 1440]];
const items = dims.map((d, i) => ({ type: 'photo', url: `https://example.invalid/${i}.jpg`, w: d[0], h: d[1], faces }));

// Rotations are strictly degrees. Opacity and scale are strictly percentages.
// Geometry accepts px / vmin / vmax / vw / vh as well as % — Glass's specular
// highlights are '3 px' and render correctly, so do not tighten these to % only.
const ROT = /^-?\d+(\.\d+)?°$/;
const PCT = /^-?\d+(\.\d+)?%$/;
const LEN = /^-?\d+(\.\d+)?\s*(px|vmin|vmax|vw|vh|%)$/;
const RULES = {
  z_rotation: ROT, x_rotation: ROT, y_rotation: ROT,
  x: LEN, y: LEN, width: LEN, height: LEN, x_anchor: LEN, y_anchor: LEN,
  opacity: PCT, x_scale: PCT, y_scale: PCT,
  stroke_width: LEN, shadow_blur: LEN, shadow_x: LEN, shadow_y: LEN,
};

let bad = 0, checked = 0;
const check = (style, path, k, v) => {
  const re = RULES[k];
  if (!re) return;
  const vals = Array.isArray(v) ? v.map((f) => f && f.value) : [v];
  for (const val of vals) {
    if (val == null || typeof val === 'number') continue;   // numbers are fine
    checked++;
    if (typeof val !== 'string' || !re.test(val.trim())) {
      bad++;
      if (bad <= 30) console.log(`  BAD UNIT  ${style}  ${path}.${k} = ${JSON.stringify(val)}`);
    }
  }
};
const walk = (style, els, path) => {
  for (const e of els || []) {
    const p = `${path}/${e.name || e.type}`;
    for (const k of Object.keys(RULES)) if (e[k] !== undefined) check(style, p, k, e[k]);
    if (e.elements) walk(style, e.elements, p);
  }
};

for (const st of Object.keys(STYLES)) {
  for (const [W, H] of [[1920, 1080], [1080, 1920]]) {
    let s;
    try {
      s = buildMontageSource({
        items, style: st, includeCards: true, title: 'TEST', subtitle: 'SUB',
        totalSeconds: 40, width: W, height: H,
        watermarkUrl: 'https://example.invalid/watermark.png',
        assetBase: 'https://example.invalid',      // REQUIRED — see the note above
      });
    } catch (err) {
      console.log(`  BUILD FAIL ${st} ${W}x${H}: ${err.message}`);
      bad++; continue;
    }
    walk(st, s.elements, st);
  }
}
console.log(`\n${Object.keys(STYLES).length} styles x 2 aspects — ${checked} unit values checked, ${bad} bad.`);
process.exit(bad ? 1 : 0);
