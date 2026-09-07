// One shot, one direction.
//
// Josh, on Framed Box: "Everything moves in one consistent direction. Not down
// then up. not to the left then right. Its always down. or always up or always
// to the right." He has now had to say a version of this three times — twice on
// Glass (a drift that opposed its own slide, then an easing that stopped dead at
// every waypoint) and once here, where the shot slid one way while the box
// inside it slid the other.
//
// WHAT THIS USED TO CHECK, AND WHY THAT WAS WRONG
// The first version compared a child's direction against its parent's and failed
// any child that moved the other way. That caught the real bug, but it is not
// the rule Josh stated. His rule is about what ends up ON SCREEN, and a child
// moving against its parent is the ordinary way to make a foreground travel
// more slowly than the background carrying it. Framed Box needs exactly that:
// the card must cross a whole frame to wipe, the hero crosses 60% of one, so
// the hero's own keyframes necessarily run back against the card. The old rule
// called that a failure and would have forced the hero to out-travel its own
// wipe — which is how I ended up with a hero that covered 87% of its distance
// in the first 40% of the shot and then sat still.
//
// So it now checks the composite: sum each element's animated position with
// every animated position it inherits, sample that over the shot, and assert
// the result never reverses. A scene sliding one way while its box slides the
// other still fails — the sum changes sign — while legitimate parallax passes.
//
// Caveat worth stating: the sum treats a nested composition's percentage as if
// it were frame-relative. That is exact for Framed Box, where every composition
// is full-frame, and approximate for a style whose panes sit in smaller boxes.
// It is a sign check, so the approximation does not change the verdict.
//
// Usage: node direction.mjs   (montage.mjs must be a fresh copy of lib/montage.js)
import { buildMontageSource, STYLES } from './montage.mjs';

const faces = [{ x: 0.44, y: 0.24, w: 0.14, h: 0.18 }];
const dims = [[1080, 1440], [1440, 1080], [1600, 900], [1080, 1350], [1080, 1080], [1600, 1067]];
const items = dims.map((d, i) => ({ type: 'photo', url: `https://example.invalid/${i}.jpg`, w: d[0], h: d[1], faces }));

const SAMPLES = 60;
const EPS = 0.35;          // % of frame — below this it is rounding, not a move

// A property as a function of time. Easings are all monotone between waypoints,
// so linear interpolation cannot invent or hide a reversal.
const fn = (v) => {
  if (!Array.isArray(v) || v.length < 2) return null;
  const ks = v.map((k) => [Number(k.time) || 0, parseFloat(k.value)]).filter((k) => Number.isFinite(k[1]));
  if (ks.length < 2) return null;
  if (Math.abs(ks[ks.length - 1][1] - ks[0][1]) < EPS) return null;
  return (t) => {
    if (t <= ks[0][0]) return ks[0][1];
    for (let i = 1; i < ks.length; i += 1) {
      if (t <= ks[i][0]) {
        const [t0, a] = ks[i - 1]; const [t1, b] = ks[i];
        return t1 === t0 ? b : a + ((b - a) * ((t - t0) / (t1 - t0)));
      }
    }
    return ks[ks.length - 1][1];
  };
};

const GATED = new Set(['framed_box']);
let bad = 0; let gatedBad = 0; let shots = 0; let moving = 0;

for (const st of Object.keys(STYLES)) {
  for (const [W, H] of [[1920, 1080], [1080, 1920]]) {
    let src;
    try { src = buildMontageSource({ items, style: st, includeCards: false, width: W, height: H, watermarkUrl: null, assetBase: 'https://example.invalid' }); }
    catch { continue; }
    for (const shot of src.elements) {
      if (!shot.elements || !/^(Framed|Glass)-/.test(shot.name || '')) continue;
      shots += 1;
      const dur = Number(shot.duration) || 1;
      const walk = (e, chainX, chainY, path) => {
        const cx = [...chainX, fn(e.x)].filter(Boolean);
        const cy = [...chainY, fn(e.y)].filter(Boolean);
        const here = `${path}/${e.name || e.type}`;
        for (const [axis, chain] of [['x', cx], ['y', cy]]) {
          if (!chain.length) continue;
          moving += 1;
          const at = (t) => chain.reduce((sum, f) => sum + f(t), 0);
          let sign = 0; let flips = 0; let worst = 0;
          let prev = at(0);
          for (let k = 1; k <= SAMPLES; k += 1) {
            const cur = at((k / SAMPLES) * dur);
            const dv = cur - prev;
            if (Math.abs(dv) > 0.02) {
              const sg = Math.sign(dv);
              if (sign && sg !== sign) { flips += 1; worst = Math.max(worst, Math.abs(dv)); }
              sign = sg;
            }
            prev = cur;
          }
          if (flips && worst >= EPS) {
            bad += 1;
            if (GATED.has(st)) gatedBad += 1;
            if (GATED.has(st) ? gatedBad <= 12 : bad <= 4) console.log(`  ${GATED.has(st) ? 'FAIL' : 'note'}  REVERSES  ${st} ${W}x${H}  ${here}  ${axis}: ${flips} change(s) of direction, largest ${worst.toFixed(2)}% of frame`);
          }
        }
        for (const c of e.elements || []) walk(c, cx, cy, here);
      };
      walk(shot, [], [], st);
    }
  }
}
console.log(`\n${shots} shots, ${moving} composite paths checked — ${bad} reverse direction (${gatedBad} in gated styles).`);
process.exit(gatedBad ? 1 : 0);
