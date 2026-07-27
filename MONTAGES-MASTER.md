# MONTAGES — MASTER REFERENCE (single source of truth)
Last verified against commit 7c2db4f (2026-07-27). If a style looks wrong or
"disappeared," restore from here or from git — do NOT rebuild from memory.

## GOLDEN RULES (read before touching montages)
1. `lib/montage.js` is the ONE source of truth for the render. `STYLES` (the
   style params) + the shot builders live there. `app/admin/page.js` `MONTAGE_STYLES`
   is just the picker list and MUST stay in sync with `STYLES` keys.
2. There are SIX shipped styles. NEVER delete or rename a style key. If one is
   missing, restore it: `git show 7c2db4f:lib/montage.js` (or `git checkout 7c2db4f -- lib/montage.js`).
3. Two more styles — **Collage Wall (Classic)** and **Collage Wall (Featured)** —
   are APPROVED as browser mocks but were never built into the render engine.
   They are NOT lost from montage.js (they were never there). Build them from the
   spec in this file; reference mocks: collage_v3_template.html /
   collage-wall-optionA-MASTER.html / collage-wall-optionB.html.
4. Can't run Creatomate from the build box. After ANY montage change, smoke-test
   `buildMontageSource` (CJS transpile + node) to confirm the element JSON is sane,
   then render a real clip on the Test client and eyeball it.
5. Units: positions/sizes are `%` of frame; keyframed props are arrays
   `[{time,value,easing},{time,value}]` with easing ONLY on the first keyframe;
   avoid keyframed `z_rotation` (unreliable — use a static tilt).

---

## THE SIX SHIPPED STYLES (canonical `STYLES` params — verbatim)

```js
hollywood: { label:'Hollywood (gold on black, slow + cinematic)', bg:'#0a0a0a',
  text:'#F5E6C8', dim:'#C9A24B', font:'Playfair Display', kicker:'MAIN EVENT STUDIO',
  photoS:3.5, fadeS:0.8, transitions:['fade','slide','fade','scale'], zoom:['100%','110%'] },

timeless: { label:'Timeless (ivory, elegant, gentle)', bg:'#141414', text:'#F7F3EC',
  dim:'#B7A98C', font:'Playfair Display', kicker:'MAIN EVENT STUDIO',
  photoS:4.0, fadeS:0.9, transitions:['fade'], zoom:['100%','106%'] },

party: { label:'Party (fast, punchy, high energy)', bg:'#0b0f1a', text:'#FFFFFF',
  dim:'#7CC5FF', font:'Poppins', kicker:'MAIN EVENT STUDIO',
  photoS:2.0, fadeS:0.4, transitions:['slide','scale','circular-wipe','fade'], zoom:['100%','116%'] },

party2: { label:'Party 2 (energetic — drift + varied transitions)', bg:'#0b0f1a',
  text:'#FFFFFF', dim:'#7CC5FF', font:'Poppins', kicker:'MAIN EVENT STUDIO',
  photoS:2.5, fadeS:0.5, transitions:['slide','circular-wipe','scale','fade'],
  zoom:['100%','118%'], pan:true },      // pan:true => diagonal drift (see builder)

duotone: { label:'Duotone Split (dual-tint background, true-colour hero)', bg:'#101014',
  text:'#FFFFFF', dim:'#C9B6E0', font:'Poppins', kicker:'MAIN EVENT STUDIO',
  photoS:3.0, fadeS:0.6, transitions:['fade','slide','fade','scale'], zoom:['100%','108%'],
  duotone:true },

polaroid: { label:'Polaroid (tilted prints on a soft background)', bg:'#141018',
  text:'#FFFFFF', dim:'#C9B6E0', font:'Playfair Display', kicker:'MAIN EVENT STUDIO',
  photoS:3.2, fadeS:0.8, transitions:['scale','fade','slide','fade'], zoom:['100%','104%'],
  polaroid:true },
```

(If any value drifts, git is authoritative — the block above is a convenience copy.)

### How each style renders
- **hollywood / timeless / party**: the STANDARD path — one full-frame photo per
  slot on track 2, slow Ken-Burns zoom (`x_scale`/`y_scale` between `zoom[0]`/`zoom[1]`,
  direction alternating per photo), crossfade `transitionIn` between slots. Differ
  only by colour/font/pace/zoom/transition list above.
- **party**: same standard path, just fast + punchy (photoS 2.0, big zoom, varied
  transitions).
- **party2**: standard path + `pan:true` adds a gentle diagonal DRIFT on top of the
  zoom, direction alternating per photo, so the underlayer never freezes. Builder:
  ```js
  if (S.pan && !isFit) {
    const D = [['47%','53%'],['53%','47%'],['53%','53%'],['47%','47%']];
    const d = D[photoCount % D.length];
    photoEl.x = [{time:0,value:'50%',easing:'linear'},{time:S.photoS,value:d[0]}];
    photoEl.y = [{time:0,value:'50%',easing:'linear'},{time:S.photoS,value:d[1]}];
  }
  ```
- **duotone**: `duotoneShot(S,url,photoCount)` — the same photo duplicated into two
  half-frame panels tinted differently (grayscale + a multiply/​screen colour shape),
  with a true-colour hero image centred on top that slowly pushes forward. Two
  independent transitions (bg vs hero).
- **polaroid**: `polaroidStackSource(...)` — a GROWING STACKED PILE (NOT a slideshow).
  Prints drop in from the top every 4.4s, land fanned/scattered (tilt ±18°, spread
  ±15%, vertical ±10%), 4 visible at once, oldest fades. See POLAROID-FIX.md for the
  full builder + params (HOLD 4.4 / MOVE 2.3 / KEEP 4 / FADE 0.65). This one uses its
  own early-return builder, bypassing the sequential per-slot model.

### Shared engine facts (don't break these)
- `buildMontageSource({ photos, items, style, title, subtitle, watermarkUrl,
  photoSeconds, includeCards, width=1920, height=1080 })`.
- Per-photo editor edits (photo_edits, sql/012) thread in per item: `anchor` (top/
  center/bottom), `fit` ('fit'=contain default / 'fill'=cover-crop), `size` %,
  `removed`, `mode` (color/bw/sepia), `contrast`, `saturation`, `posX`/`posY` (drag
  focal). Default is FIT (native aspect, nothing cropped). Removed photos are skipped.
- Video slots become a 3s chroma-green (#00B140) placeholder the editor keys into.
- A persistent style-colour Background (track 1) sits behind everything (stops Fit
  letterbox bleed-through).
- Watermark PNG: width 62% / height 6.9% (matches its aspect — width-only cover-crops
  into giant letters), opacity 42%, on a high track. Default OFF.
- Opening + closing cards hard-cut (no transition) so they're replaceable in edit.

---

## THE TWO COLLAGE STYLES (approved mocks — need building into montage.js)

### Collage Wall — Classic (uniform grid)
Mock: `collage_v3_template.html` / `collage-wall-optionA-MASTER.html`.
- A UNIFORM grid — every photo the SAME size (no big-photo-ringed-by-small). Mock
  used a 7×5 wall, cell 512×288 (16:9), 8px gap, cream backing `#f4f1ea`.
- Face-aware framing per tile (crop centred on the face/focal point).
- A "camera" glides across the wall: rests on an interior featured tile at ~65–80%
  scale (so equal-size neighbours stay visible), occasionally zooms one tile to fill,
  with very gentle rotation + drift. Warm light-leak washes + film dust + grain +
  vignette over the top for a warm, alive feel.
- Build in Creatomate: a parent composition holding a grid of image elements
  (each `fit:'cover'`, object-position = focal), then keyframe the PARENT
  composition's x/y/scale to pan+zoom across the grid over time; overlay a soft warm
  gradient + vignette. Photos fill the grid; the motion is the camera, not the tiles.

### Collage Wall — Featured (large photos)
Mock: `collage-wall-optionB.html`.
- Same wall idea but a NON-uniform layout: one (or a few) large "hero" photos
  ringed by smaller tiles; the camera favours the hero, then re-composes to a new
  hero. Same warm grade/leaks/dust treatment.
- Build: same parent-composition camera approach, but the grid template mixes large
  cells (2×2) with 1×1 tiles; hero cell changes as the camera moves.

Both are face-framed and share the warm cinematic grade. Neither exists in the render
engine yet — they must be added as new `STYLES` entries (`collage_classic`,
`collage_featured`) + builders, and added to `MONTAGE_STYLES` in page.js.

---

## MONTAGE MAKER UI (page.js) — keep these intact
- `MONTAGE_STYLES` (the picker list) MUST list every style key in `STYLES`, with a
  `{ value, label }`. Currently the 6 above. When Collage is built, ADD its entries
  here too or it won't be selectable.
- Step 2 "Choose style" is a click-to-pick palette of cards (label + one-line
  description). It is currently TEXT-ONLY. Josh wants each card to show a small
  PLAYING preview thumbnail of the style. Reference clips already rendered:
  party2_smooth.mp4, duotone_16x9.mp4, polaroid_16x9.mp4 (+ stills p2_*.png,
  duo_still*.png, pol_fan.png). To add: drop a short muted looping <video>/gif per
  style into each picker card (host the clips in /public or R2).
- Step 1 Photo editor thumbnails MIRROR each photo's edits: the same `styleFor(e)`
  (objectFit/objectPosition/transform scale/filter from anchor/fit/size/mode/
  contrast/saturation/posX/posY) is applied to BOTH the big editor image AND every
  grid thumbnail, so a thumbnail always shows that photo's current edit. Don't let a
  refactor break that shared `styleFor`.

## VERIFY AFTER ANY CHANGE
1. `node` smoke-test: build each style with ~7 fake photo urls; confirm no throw and
   the element JSON matches the style's model (e.g. polaroid => overlapping Print-*
   on ascending tracks; duotone => two half panels + hero; party2 => x/y drift).
2. Render one real clip per changed style on the Test client; compare to the
   reference clips above.
3. Confirm `MONTAGE_STYLES` (picker) still lists every `STYLES` key.
