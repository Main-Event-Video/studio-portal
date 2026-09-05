// One shot, one direction.
//
// Josh, on Framed Box: "Everything moves in one consistent direction. Not down
// then up. not to the left then right. Its always down. or always up or always
// to the right." He has now had to say a version of this three times — twice on
// Glass (a drift that opposed its own slide, then an easing that stopped dead at
// every waypoint) and once here, where the shot slid one way while the box
// inside it slid the other.
//
// Every one of those was a SIGN, invisible in a build and obvious on screen. So
// this checks the thing directly: for each shot, gather every animated x (and
// every animated y) at every nesting depth, convert each to the direction it
// travels, and assert they all agree. A shot whose scene goes left while its box
// goes right fails here instead of in a twenty-minute render.
//
// Usage: node direction.mjs   (montage.mjs must be a fresh copy of lib/montage.js)
import { buildMontageSource, STYLES } from './montage.mjs';

const faces = [{ x: 0.44, y: 0.24, w: 0.14, h: 0.18 }];
const dims = [[1080, 1440], [1440, 1080], [1600, 900], [1080, 1350], [1080, 1080], [1600, 1067]];
const items = dims.map((d, i) => ({ type: 'photo', url: `https://example.invalid/${i}.jpg`, w: d[0], h: d[1], faces }));

// Net travel of one keyframed property, ignoring anything that barely moves.
const travel = (v) => {
  if (!Array.isArray(v) || v.length < 2) return 0;
  const nums = v.map((k) => parseFloat(k.value)).filter(Number.isFinite);
  if (nums.length < 2) return 0;
  const d = nums[nums.length - 1] - nums[0];
  return Math.abs(d) < 0.5 ? 0 : Math.sign(d);
};

// Styles this check GATES. Glass is reported but tolerated: its panes drift a
// few pixels a second against a stage that moves ~240 px/sec during a
// transition and is stationary the rest of the time, so the opposition is real
// on paper and invisible on screen — and Josh has signed that look off. Add a
// style here once its movement is meant to be strictly one-directional.
const GATED = new Set(['framed_box']);
let bad = 0, gatedBad = 0, shots = 0;
for (const st of Object.keys(STYLES)) {
  for (const [W, H] of [[1920, 1080], [1080, 1920]]) {
    let src;
    try { src = buildMontageSource({ items, style: st, includeCards: false, width: W, height: H, watermarkUrl: null, assetBase: 'https://example.invalid' }); }
    catch { continue; }
    for (const shot of src.elements) {
      if (!shot.elements || !/^(Framed|Glass)-/.test(shot.name || '')) continue;
      shots++;
      // The invariant is ANCESTRY, not siblinghood. Two panes in the same shot
      // may legitimately drift opposite ways — that is Glass's unsynchronised
      // drift and it looks right. What must never happen is a child moving
      // against a parent that is carrying it, because the two compose and the
      // thing on screen visibly changes its mind. So each element is compared
      // only with the signs it inherits.
      const walk = (e, ax, ay, path) => {
        const tx = travel(e.x), ty = travel(e.y);
        for (const [axis, t, inherited] of [['x', tx, ax], ['y', ty, ay]]) {
          if (t && inherited && t !== inherited) {
            bad++;
            if (GATED.has(st)) gatedBad++;
            if (bad <= 12) console.log(`  ${GATED.has(st) ? 'FAIL' : 'note'}  OPPOSES PARENT  ${st} ${W}x${H}  ${path}/${e.name || e.type}  ${axis}: child ${t} vs ancestor ${inherited}`);
          }
        }
        const nx = tx || ax, ny = ty || ay;
        for (const c of e.elements || []) walk(c, nx, ny, `${path}/${e.name || e.type}`);
      };
      walk(shot, 0, 0, st);
    }
  }
}
console.log(`\n${shots} shots checked — ${bad} elements moving against a parent (${gatedBad} in gated styles).`);
process.exit(gatedBad ? 1 : 0);
