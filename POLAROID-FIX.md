# POLAROID STYLE — FIX (stacking pile, not a slideshow)

## The bug
The Polaroid montage style renders as a ONE-photo-at-a-time slideshow: a blurred
full-frame backdrop + a single tilted white-bordered card, then it slides to the
next single card. Root cause: in `lib/montage.js`, the `if (S.polaroid)` branch of
`buildMontageSource` pushes ONE composition per photo on track 2 sequentially
(like every other style), so cards replace each other instead of piling up.

## The target (approved mock)
A GROWING STACKED PILE: prints drop in from the top every few seconds and land
fanned/scattered, several visible at once, oldest fading as newer prints land on
top. Visual references (in the montage scratch workspace / delivered):
`polaroid_MOCK_perfected.html`, `polaroid_reference.mp4`, `polaroid_target_still.png`.

Approved params: new print every 4.4s; drop-in 2.3s; keep 4 visible (oldest fades
0.65s, no pop); scatter = tilt ±18°, horizontal spread ±15% (~30% total), vertical
±10% (roughly half ~10% lower / half ~10% higher); feather-drop from above, hard
decelerate, no bounce, fully opaque; white card `#FDFDFA` w/ thick bottom border +
soft shadow, photo object-position toward top (heads); backdrop = current photo
blurred (blur_radius 28) + tint wash (default `#241033` @ ~52%, expose as a control).

## The fix — in `lib/montage.js`

1) Near the top consts add:

```js
const POL = { HOLD: 4.4, MOVE: 2.3, KEEP: 4, FADE: 0.65 };
// Deterministic pseudo-random from an int seed, so re-renders are identical.
function pol_rand(n) { const x = Math.sin((n + 1) * 12.9898) * 43758.5453; return x - Math.floor(x); }
```

2) In `buildMontageSource`, right after `seq` is built and `const S = {...}`, add an
early return so Polaroid uses its own builder and other styles are untouched:

```js
  if (S.polaroid) return polaroidStackSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height });
```

3) Delete the dead `if (S.polaroid) { ... }` block in the per-photo loop and the old
`polaroidShot()` helper.

4) Add this function (smoke-tested — overlapping prints on ascending tracks, valid JSON):

```js
// ---- Polaroid: a GROWING STACKED PILE (not a slideshow) ----
function polaroidStackSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height }) {
  const rect = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
  const photosOnly = seq.filter((it) => it.type !== 'placeholder');
  const n = photosOnly.length;
  const cardsTime = includeCards ? 2 * CARD_S : 0;
  const stackDur = n > 0 ? (n - 1) * POL.HOLD + POL.MOVE + POL.HOLD : 0;
  const total = cardsTime + stackDur;
  const stackStart = includeCards ? CARD_S : 0;
  const TINT = S.tint || '#241033';
  const TINT_OP = S.tintOpacity || '52%';
  const elements = [];
  elements.push({ name: 'Background', type: 'shape', track: 1, time: 0, duration: total,
    path: rect, width: '100%', height: '100%', fill_color: S.bg });
  if (includeCards) elements.push({ name: 'Opening', type: 'composition', track: 2, time: 0,
    duration: CARD_S, elements: card(S, { kicker: S.kicker, title, subtitle, height }) });
  photosOnly.forEach((it, k) => {
    const t = stackStart + k * POL.HOLD;
    const life = (k === n - 1 ? POL.MOVE + POL.HOLD : POL.HOLD) + 0.6;
    elements.push({ name: `Backdrop-${k + 1}`, type: 'image', source: it.url, track: 2, time: t,
      duration: life, x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%',
      fit: 'cover', blur_radius: 28, blur_mode: 'stack',
      animations: [{ time: 'start', duration: 0.6, transition: true, type: 'fade' }] });
  });
  elements.push({ name: 'Tint', type: 'shape', track: 3, time: stackStart, duration: stackDur,
    path: rect, width: '100%', height: '100%', fill_color: TINT, opacity: TINT_OP });
  photosOnly.forEach((it, k) => {
    const t = stackStart + k * POL.HOLD;
    const rTilt = (pol_rand(k) * 2 - 1) * 18;
    const ox = (pol_rand(k + 100) * 2 - 1) * 15;
    const drop = pol_rand(k + 200) < 0.5;
    const oy = (drop ? 10 : -10) + (pol_rand(k + 300) * 2 - 1) * 3;
    const settleX = 50 + ox, settleY = 50 + oy;
    const startX = settleX + (pol_rand(k + 400) * 2 - 1) * 14;
    const visibleBeats = Math.min(n - 1 - k, POL.KEEP);
    const life = POL.MOVE + visibleBeats * POL.HOLD + POL.HOLD * 0.5;
    const willFade = k < n - POL.KEEP;
    const print = {
      name: `Print-${k + 1}`, type: 'composition', track: 4 + k, time: t,
      duration: life + (willFade ? POL.FADE : 0),
      x: [{ time: 0, value: `${startX.toFixed(1)}%`, easing: 'quadratic-out' }, { time: POL.MOVE, value: `${settleX.toFixed(1)}%` }],
      y: [{ time: 0, value: '-20%', easing: 'quadratic-out' }, { time: POL.MOVE, value: `${settleY.toFixed(1)}%` }],
      x_anchor: '50%', y_anchor: '50%', width: '42%', height: '58%',
      z_rotation: `${rTilt.toFixed(1)}°`,
      x_scale: [{ time: 0, value: '104%', easing: 'quadratic-out' }, { time: POL.MOVE, value: '100%' }],
      y_scale: [{ time: 0, value: '104%', easing: 'quadratic-out' }, { time: POL.MOVE, value: '100%' }],
      shadow_color: '#000000', shadow_blur: '5vmin', shadow_x: '0vmin', shadow_y: '2vmin',
      elements: [
        { type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: rect, fill_color: '#FDFDFA' },
        { type: 'image', source: it.url, x: '50%', y: '44%', width: '86%', height: '74%', x_anchor: '50%', y_anchor: '50%', fit: 'cover' },
      ],
    };
    if (willFade) print.opacity = [{ time: 0, value: '100%' }, { time: life, value: '100%' }, { time: life + POL.FADE, value: '0%' }];
    elements.push(print);
  });
  if (includeCards) elements.push({ name: 'Closing', type: 'composition', track: 2, time: total - CARD_S,
    duration: CARD_S, elements: card(S, { kicker: null, title: title || 'THANK YOU', subtitle: 'A MAIN EVENT STUDIO PRODUCTION', height }) });
  if (watermarkUrl) elements.push({ name: 'Watermark', type: 'image', track: 99, source: watermarkUrl, time: 0,
    duration: Math.max(1, total - 0.1), width: '62%', height: '6.9%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', opacity: '42%' });
  return { output_format: 'mp4', width, height, frame_rate: 30, elements };
}
```

## Verify
- Smoke-test buildMontageSource with style 'polaroid' + ~7 fake photo urls: expect
  7 `Print-*` elements on ascending tracks that OVERLAP in time (multiple visible
  at once), not one-at-a-time.
- Render a real test clip; compare to polaroid_reference.mp4.
- Creatomate specifics to confirm on that render: (a) easing name `quadratic-out`
  (swap for Creatomate's ease-out if ignored); (b) `opacity` keyframes on a
  composition for the exit fade (else use an `animations` fade `reversed:true`).
  Tilt is intentionally static (keyframed z_rotation is unreliable).
- Approve the look (mock/test-render frame) before finalizing.
