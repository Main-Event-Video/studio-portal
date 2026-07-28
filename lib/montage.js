// Builds the Creatomate source JSON for a Studio montage.
// Three styles for v1 — every construct is copied from MEvid's WORKING render
// code (lib/render-script.js / lib/opening-card.js) and its verified
// constraints: same-track siblings auto-sequence; a transition is an animation
// on the SECOND element with transition:true (types verified: fade, slide,
// circular-wipe, scale); motion = keyframes on x_scale/y_scale/x/y/opacity
// (never z_rotation); easing on the FIRST keyframe; explicit tracks.

export const STYLES = {
  hollywood: {
    label: 'Hollywood (gold on black, slow + cinematic)',
    bg: '#0A0708',
    text: '#E8CC8A',
    dim: '#C4A460',
    font: 'Playfair Display',
    kicker: 'MAIN EVENT STUDIO PRESENTS',
    photoS: 3.5,
    fadeS: 1.0,
    transitions: ['fade'],
    zoom: ['100%', '112%'],
  },
  timeless: {
    label: 'Timeless (ivory, elegant, gentle)',
    bg: '#F5F1E8',
    text: '#4A3F30',
    dim: '#7A6A54',
    font: 'Playfair Display',
    kicker: 'MAIN EVENT STUDIO',
    photoS: 4.0,
    fadeS: 1.4,
    transitions: ['fade'],
    zoom: ['100%', '108%'],
  },
  party: {
    label: 'Party (fast, punchy, high energy)',
    bg: '#140A22',
    text: '#FFFFFF',
    dim: '#7ED8FF',
    font: 'Montserrat',
    kicker: 'MAIN EVENT STUDIO PRESENTS',
    photoS: 2.0,
    fadeS: 0.4,
    transitions: ['slide', 'circular-wipe', 'scale', 'fade'],
    zoom: ['100%', '116%'],
  },
  party2: {
    label: 'Party 2 (energetic — drift + varied transitions)',
    bg: '#140A22',
    text: '#FFFFFF',
    dim: '#FF6EB4',
    font: 'Montserrat',
    kicker: 'MAIN EVENT STUDIO PRESENTS',
    photoS: 2.5,          // sensible middle default; overridable by the pace control
    fadeS: 0.5,
    transitions: ['slide', 'circular-wipe', 'scale', 'fade'],
    zoom: ['100%', '118%'],
    pan: true,            // gentle diagonal drift on each photo (see buildMontageSource)
  },
  duotone: {
    label: 'Duotone Split (dual-tint background, true-colour hero)',
    bg: '#07070C',
    text: '#FFFFFF',
    dim: '#FF4D88',
    font: 'Montserrat',
    kicker: 'MAIN EVENT STUDIO PRESENTS',
    photoS: 3.0,
    fadeS: 0.7,
    transitions: ['slide', 'circular-wipe', 'scale', 'fade'],
    zoom: ['100%', '108%'],
    duotone: true,
    // [highlight, shadow] colour pairs; each shot uses two different pairs L/R
    pairs: [['#FF4D88', '#2A0A4A'], ['#38E1FF', '#04223F'], ['#FF7B3A', '#3A0630'],
            ['#A6FF4D', '#052E2A'], ['#C07BFF', '#0A0640'], ['#FFD23A', '#40060F']],
  },
  duotone2: {
    label: 'Duotone Split 2 (frantic — bg & hero transition separately)',
    bg: '#07070C',
    text: '#FFFFFF',
    dim: '#38E1FF',
    font: 'Montserrat',
    kicker: 'MAIN EVENT STUDIO PRESENTS',
    photoS: 3.0,
    fadeS: 0.7,
    transitions: ['slide', 'circular-wipe', 'scale', 'fade'],
    zoom: ['100%', '108%'],
    duotone: true,
    frantic: true,   // bg + hero get DIFFERENT transitions each move (duotone2Source)
    pairs: [['#FF4D88', '#2A0A4A'], ['#38E1FF', '#04223F'], ['#FF7B3A', '#3A0630'],
            ['#A6FF4D', '#052E2A'], ['#C07BFF', '#0A0640'], ['#FFD23A', '#40060F']],
  },
  polaroid: {
    label: 'Polaroid Drop (square print, thick white bottom)',
    bg: '#141018',
    text: '#FFFFFF',
    dim: '#C9B6E0',
    font: 'Playfair Display',
    kicker: 'MAIN EVENT STUDIO',
    photoS: 3.2,
    fadeS: 0.8,
    transitions: ['scale', 'fade', 'slide', 'fade'],
    zoom: ['100%', '104%'],
    polaroid: true,
  },
  photo_drop: {
    // Same drop/pile motion as Polaroid Drop, but the WHOLE photo shows (nothing
    // cropped) inside a card matched to the photo's aspect + an EVEN white border
    // (bottom = top = sides). wholePhoto flag switches the print geometry.
    label: 'Photo Drop (whole photo, even white border)',
    bg: '#141018',
    text: '#FFFFFF',
    dim: '#C9B6E0',
    font: 'Playfair Display',
    kicker: 'MAIN EVENT STUDIO',
    photoS: 3.2,
    fadeS: 0.8,
    transitions: ['scale', 'fade', 'slide', 'fade'],
    zoom: ['100%', '104%'],
    polaroid: true,
    wholePhoto: true,
  },
  // ---- Collage Wall (rebuilt from the approved mocks; see MONTAGES-MASTER.md) --
  // A wall of ALL the photos in a grid; a "camera" (the wall composition's x/y/
  // scale) glides across it, resting on featured tiles with neighbours visible,
  // over a warm grade. Classic = uniform grid; Featured = some 2×2 hero tiles.
  // NOT yet render-verified — the camera path/grade need first-render tuning.
  collage_classic: {
    label: 'Collage Wall — Classic (uniform grid, camera glides across)',
    bg: '#0E0C0A', text: '#FFFFFF', dim: '#E9D9B8', font: 'Montserrat',
    kicker: 'MAIN EVENT STUDIO', photoS: 2.6, fadeS: 0.6, transitions: ['fade'], zoom: ['100%', '100%'],
    collage: true, variant: 'classic', cols: 6, cellHoldS: 2.6, moveS: 1.2,
    warm: '#3A2A12', warmOpacity: '20%',   // warm multiply grade over the wall
  },
  collage_featured: {
    label: 'Collage Wall — Featured (big hero photos + smaller tiles)',
    bg: '#0E0C0A', text: '#FFFFFF', dim: '#E9D9B8', font: 'Montserrat',
    kicker: 'MAIN EVENT STUDIO', photoS: 2.8, fadeS: 0.6, transitions: ['fade'], zoom: ['100%', '100%'],
    collage: true, variant: 'featured', cols: 5, cellHoldS: 2.8, moveS: 1.3,
    warm: '#3A2A12', warmOpacity: '20%',
  },
  // Gallery 150 (Envato "150 Photo Gallery" ref): a wall of SCATTERED, TILTED,
  // white-bordered prints; camera flies over and features one print at a time.
  // Same camera engine as Collage, cells become tilted print-cards over a dark
  // surface. NO template text.
  gallery150: {
    label: 'Gallery 150 (scattered tilted prints, camera flies over)',
    bg: '#0E0C0A', text: '#FFFFFF', dim: '#E9D9B8', font: 'Montserrat',
    kicker: 'MAIN EVENT STUDIO', photoS: 2.6, fadeS: 0.6, transitions: ['fade'], zoom: ['100%', '100%'],
    collage: true, variant: 'gallery150', scatter: true, cols: 6, cellHoldS: 2.4, moveS: 1.1,
    warm: '#2A2620', warmOpacity: '12%',
  },
  // Epic Vintage (Envato "Epic Vintage" ref): ONE large tilted print in sharp
  // focus at a time, floating over a heavily-blurred, warm-graded bokeh field of
  // the same photo; a slow push on the hero; big warm light-leak flashes mask
  // each long crossfade. Faded, low-contrast vintage grade throughout. NO
  // template text. (epicVintageSource.)
  epic_vintage: {
    label: 'Epic Vintage (one hero print, blurred bokeh, heavy light leaks)',
    bg: '#171008', text: '#FFF3E0', dim: '#E8C79A', font: 'Montserrat',
    kicker: 'MAIN EVENT STUDIO', photoS: 3.4, fadeS: 1.1, transitions: ['fade'], zoom: ['100%', '100%'],
    epic: true,
    warm: '#C98A5A', warmOpacity: '26%',   // warm multiply grade
    haze: '#F0E2C8', hazeOpacity: '4%',    // very slight cream lift (render over-brightens screens — keep tiny)
  },
  // Trendy Photo Wall (Envato "Trendy Photo Montage" ref): a grid of white-MATTED
  // prints on a cream wall, viewed at a 3D PERSPECTIVE angle (Creatomate
  // perspective + x_rotation/y_rotation), with the camera drifting slowly across
  // and the wall rotating gently toward the lens. Soft dreamy grade + light
  // leaks. NO template text. (trendyWallSource.)
  trendy: {
    label: 'Trendy Photo Wall (3D angled grid of matte prints)',
    bg: '#ECE5D6', text: '#3A3226', dim: '#8A7C63', font: 'Montserrat',
    kicker: 'MAIN EVENT STUDIO', photoS: 2.4, fadeS: 0.6, transitions: ['fade'], zoom: ['100%', '100%'],
    trendy: true,
    wall: '#EFE9DC',                       // cream wall behind the prints
    warm: '#C9A46A', warmOpacity: '10%',   // soft warm grade
  },
};

const CARD_S = 4;

// Green-screen placeholder for a client video the editor will key in manually.
// Broadcast chroma green — keys cleanly in any NLE. The clip name shows ONLY
// while the green fully covers the frame (never during the dissolves), so the
// transitions into/out of the gap stay perfectly keyable.
const CHROMA_GREEN = '#00B140';

// Shared "Add background" importer. Returns the background layer element(s) for a
// full-frame backdrop, honouring the per-render `background` control:
//   • { green:true }          → a keyable chroma-green backdrop (the DEFAULT the
//                               UI offers, so Josh can key it in Premiere)
//   • { url, tint, opacity, blur } → the imported image (cover, optional blur)
//                               over the style colour, with an optional colour tint
//   • null / {}               → the style's own bg colour (unchanged look)
// track/duration are supplied by the caller so it can drop these behind everything.
function bgLayers(background, S, { track = 1, time = 0, duration }) {
  const rect = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
  const b = background || {};
  const base = (fill) => ({ name: 'Background', type: 'shape', track, time, duration, path: rect, width: '100%', height: '100%', fill_color: fill });
  if (b.green) return [base(CHROMA_GREEN)];
  if (b.url) {
    const out = [base(S.bg)];
    out.push({ name: 'Backdrop', type: 'image', source: b.url, track, time, duration, x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', fit: 'cover', ...(b.blur ? { blur_radius: Number(b.blur) || 18, blur_mode: 'stack' } : {}) });
    if (b.tint) out.push({ name: 'BgTint', type: 'shape', track, time, duration, path: rect, width: '100%', height: '100%', fill_color: b.tint, opacity: b.opacity || '50%' });
    return out;
  }
  return [base(S.bg)];
}
const PLACEHOLDER_S = 3; // fixed 3s gap; the editor trims to their real clip

// WALL/PILE styles only (Epic Vintage, Trendy, collage, polaroid, duotone2).
// These show many photos at once, so a single full-frame "green photo" can't sit
// in the grid the way it does in a slideshow. Instead we add a green FRAME at the
// head and tail: it WIPES in across the frame (the picture-like movement Josh
// wants — not a flat fade), holds a clean full-frame chroma-green key window he
// cuts his footage into, then — at the head — wipes off to reveal the wall; at
// the tail it holds to the closing card. On track 100 so it fully covers the
// wall while present. (The slideshow styles instead inject green as a real
// first/last PHOTO slot — see gseq in buildMontageSource.)
const GREEN_IN = 0.5;    // directional wipe-in (decelerates onto the frame)
const GREEN_HOLD = 2.2;  // a full green FRAME the editor keys into (not a flash)
const GREEN_OUT = 0.5;   // head only: wipe back off into the montage
const GREEN_OFF_L = '-72%'; // 120%-wide shape parked fully off the left edge
const GREEN_ON = '50%';     // centered → fully covers the frame
const GREEN_OFF_R = '172%'; // parked fully off the right edge
function greenWipe({ name, time, duration, xk }) {
  // 120% over-sized so the frame is never uncovered at the covered position and
  // no style background peeks past the edges during the slide.
  return {
    name, type: 'shape', track: 100, time, duration,
    path: 'M 0 0 L 100 0 L 100 100 L 0 100 Z',
    width: '120%', height: '120%', x_anchor: '50%', y_anchor: '50%', y: '50%',
    fill_color: CHROMA_GREEN, x: xk,
  };
}
function addGreenBookends(source, includeCards) {
  if (!source || !Array.isArray(source.elements)) return source;
  const bgEl = source.elements.find((e) => e.name === 'Background');
  const total = bgEl && bgEl.duration
    ? bgEl.duration
    : source.elements.reduce((m, e) => Math.max(m, (e.time || 0) + (e.duration || 0)), 0);
  const cardS = includeCards ? CARD_S : 0;
  // HEAD — after the opening card: green slides in from the left, holds clean,
  // then slides off to the right, revealing shot 1 (a real wipe transition).
  const headDur = GREEN_IN + GREEN_HOLD + GREEN_OUT;
  source.elements.push(greenWipe({
    name: 'GreenStart', time: cardS, duration: headDur,
    xk: [
      { time: 0, value: GREEN_OFF_L, easing: 'quadratic-out' },
      { time: GREEN_IN, value: GREEN_ON },
      { time: GREEN_IN + GREEN_HOLD, value: GREEN_ON, easing: 'quadratic-in' },
      { time: headDur, value: GREEN_OFF_R },
    ],
  }));
  // TAIL — before the closing card: the last shot wipes to green from the right,
  // which then holds clean to the end (mirror of the head).
  const tailDur = GREEN_IN + GREEN_HOLD;
  const tailStart = Math.max(cardS, (total - cardS) - tailDur);
  source.elements.push(greenWipe({
    name: 'GreenEnd', time: tailStart, duration: tailDur,
    xk: [
      { time: 0, value: GREEN_OFF_R, easing: 'quadratic-out' },
      { time: GREEN_IN, value: GREEN_ON },
      { time: tailDur, value: GREEN_ON },
    ],
  }));
  return source;
}

// Polaroid stacking pile (approved mock): new print every HOLD, drop-in over
// MOVE, keep KEEP visible, oldest fades over FADE.
const POL = { HOLD: 4.4, MOVE: 1.2, KEEP: 4, FADE: 0.65 }; // MOVE = quick fall (feathers to a soft land)
// Deterministic pseudo-random from an int seed, so re-renders are identical.
function pol_rand(n) { const x = Math.sin((n + 1) * 12.9898) * 43758.5453; return x - Math.floor(x); }

// Apply a photo's per-image colour edit. Creatomate applies ONE color_filter
// per image, so these are MUTUALLY EXCLUSIVE (see MONTAGE-EDITS-NOTES.md).
// Priority: B&W / Sepia > explicit Contrast > auto-colour. SATURATION is not
// emitted — there is no confirmed Creatomate 'saturate' filter and it could not
// co-exist with another color_filter anyway; it stays editor-preview-only until
// a Creatomate capability is confirmed. Contrast's value mapping is a first
// guess (signed delta from the neutral 100) — CALIBRATE on the first render.
function applyPhotoColor(el, it) {
  if (!it) return el;
  if (it.mode === 'bw') { el.color_filter = 'grayscale'; el.color_filter_value = '100%'; }
  else if (it.mode === 'sepia') { el.color_filter = 'sepia'; el.color_filter_value = '80%'; }
  else {
    const c = Number(it.contrast);
    if (Number.isFinite(c) && c !== 100) { el.color_filter = 'contrast'; el.color_filter_value = `${Math.round(c - 100)}%`; }
    // Auto color = one-tap enhance. Creatomate applies ONE color_filter per image,
    // so the render can't stack brightness+contrast+saturation like the editor
    // preview does — it uses the single most-visible lift (a contrast pop). The
    // editor preview shows the fuller enhance; use it as the starting point and the
    // sliders for precise control. (Was a barely-visible 6% brighten.) CALIBRATE
    // the strength on a test render.
    else if (it.colorCorrect) { el.color_filter = 'contrast'; el.color_filter_value = '15%'; }
  }
  return el;
}

// Rounded-rectangle SVG path in the element's local 0..100 space. rx/ry are the
// corner radii (different because the card isn't square, so corners look even).
function roundedRect(rx, ry) {
  const x2 = (100 - rx).toFixed(2), y2 = (100 - ry).toFixed(2);
  return `M ${rx} 0 L ${x2} 0 Q 100 0 100 ${ry} L 100 ${y2} Q 100 100 ${x2} 100 L ${rx} 100 Q 0 100 0 ${y2} L 0 ${ry} Q 0 0 ${rx} 0 Z`;
}
// Polaroid card ~42%×58% of a 16:9 frame → ~14px even corners.
const POLAROID_CARD_PATH = roundedRect(1.8, 2.4);

// Where the photo sits inside the print window so heads stay in. Default TOP
// (top-anchored cover shows the top of the source, crops the bottom).
function printFraming(it) {
  const f = it && ['top', 'center', 'bottom'].includes(it.framing) ? it.framing : 'top';
  if (f === 'center') return { x: '50%', y: '43%', y_anchor: '50%' };
  if (f === 'bottom') return { x: '50%', y: '82%', y_anchor: '100%' };
  return { x: '50%', y: '4%', y_anchor: '0%' }; // top — keeps heads
}

// Parse a photos expression like "1-10, 15, 108, 11-51" into an ordered list of
// 1-based photo positions. TYPED ORDER is preserved (so "10, 3" plays 10 then
// 3); a photo that appears twice keeps its FIRST occurrence; numbers outside
// 1..count are dropped. A descending range like "10-1" counts down. Blank or
// missing spec means "all photos in order". Positions map to the same 1..N
// numbering the admin photo strip shows.
export function parsePhotoSpec(spec, count) {
  const n = Math.max(0, Number(count) || 0);
  const all = [];
  for (let i = 1; i <= n; i++) all.push(i);
  if (spec == null || !String(spec).trim()) return all;

  const out = [];
  const seen = new Set();
  const add = (k) => {
    if (Number.isInteger(k) && k >= 1 && k <= n && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  };
  for (const raw of String(spec).split(',')) {
    const token = raw.trim();
    if (!token) continue;
    const range = token.match(/^(\d+)\s*[-–—]\s*(\d+)$/); // hyphen / en / em dash
    if (range) {
      const a = parseInt(range[1], 10);
      const b = parseInt(range[2], 10);
      if (Number.isNaN(a) || Number.isNaN(b)) continue;
      const step = a <= b ? 1 : -1;
      for (let k = a; step > 0 ? k <= b : k >= b; k += step) add(k);
    } else if (/^\d+$/.test(token)) {
      add(parseInt(token, 10));
    }
    // anything else (stray text) is ignored rather than throwing
  }
  return out;
}

// Title cards HARD CUT to/from the photos (Josh: he usually replaces the
// cards in the edit, so nothing may dissolve across those boundaries).
// Only photo→photo boundaries overlap: (n-1) transitions.
export function montageDuration(n, styleKey = 'hollywood') {
  const s = STYLES[styleKey] || STYLES.hollywood;
  return CARD_S + n * s.photoS + CARD_S - Math.max(0, n - 1) * s.fadeS;
}

function transitionIn(S, i) {
  const type = S.transitions[i % S.transitions.length];
  return [{ time: 'start', duration: S.fadeS, transition: true, type }];
}

function text(track, str, { size, weight = '700', y, color, spacing, font }) {
  const el = {
    type: 'text',
    track,
    text: str,
    font_family: font,
    font_weight: weight,
    font_size: `${size} px`,
    fill_color: color,
    x: '50%',
    y,
    width: '90%',
    x_anchor: '50%',
    y_anchor: '50%',
    x_alignment: '50%',
  };
  if (spacing) el.letter_spacing = spacing;
  return el;
}

function card(S, { kicker, title, subtitle, height }) {
  const elements = [
    { type: 'shape', track: 1, path: 'M 0 0 L 100 0 L 100 100 L 0 100 Z', width: '100%', height: '100%', fill_color: S.bg },
  ];
  if (kicker) elements.push(text(2, kicker, { size: Math.round(height * 0.032), weight: '600', y: '30%', color: S.dim, spacing: '18%', font: S.font }));
  if (title) {
    elements.push({
      ...text(3, title, { size: Math.round(height * 0.17), y: '48%', color: S.text, font: S.font }),
      x_scale: [{ time: 0, value: '112%', easing: 'quadratic-out' }, { time: 1.2, value: '100%' }],
      y_scale: [{ time: 0, value: '112%', easing: 'quadratic-out' }, { time: 1.2, value: '100%' }],
      opacity: [{ time: 0, value: '0%' }, { time: 0.6, value: '100%' }],
    });
  }
  if (subtitle) elements.push(text(4, subtitle, { size: Math.round(height * 0.036), weight: '400', y: '66%', color: S.dim, spacing: '14%', font: S.font }));
  return elements;
}

// photos: [{ url }] in final order.
// photoSeconds: optional 1–10 override for how long each photo holds
// (style default when omitted). Transitions clamp to 40% of the hold so a
// fast pace never drowns in a long dissolve.
// includeCards: opening + closing title cards (default true). When false the
// segment renders as bare photos — no cards to trim around when it's dropped in
// the middle of an edit. Either way the FIRST photo hard-cuts in (no dissolve
// on the opening frame) and cards never dissolve across a photo boundary.
// Duotone Split style: the same photo duplicated side by side, each half a
// different duotone (grayscale image + multiply-highlight + screen-shadow, the
// Creatomate equivalent of the CSS mock), with a true-colour hero centred on top
// that slowly pushes forward. One composition per photo.
function duotoneShot(S, url, photoCount) {
  const pa = S.pairs[photoCount % S.pairs.length];
  const pb = S.pairs[(photoCount + 2) % S.pairs.length];
  const rect = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
  const half = (xc, pair) => ([
    { type: 'image', source: url, x: xc, y: '50%', width: '50%', height: '100%',
      x_anchor: '50%', y_anchor: '50%', fit: 'cover', color_filter: 'grayscale', color_filter_value: '100%' },
    { type: 'shape', x: xc, y: '50%', width: '50%', height: '100%', x_anchor: '50%', y_anchor: '50%',
      path: rect, fill_color: pair[0], blend_mode: 'multiply' },
    { type: 'shape', x: xc, y: '50%', width: '50%', height: '100%', x_anchor: '50%', y_anchor: '50%',
      path: rect, fill_color: pair[1], blend_mode: 'screen', opacity: '55%' },
  ]);
  const els = half('25%', pa).concat(half('75%', pb));
  els.push({
    type: 'image', source: url, x: '50%', y: '50%', width: '58%', height: '84%',
    x_anchor: '50%', y_anchor: '50%', fit: 'cover',
    shadow_color: '#000000', shadow_blur: '6vmin', shadow_x: '0vmin', shadow_y: '3vmin',
    // hero slowly pushes forward ~8% over the shot
    x_scale: [{ time: 0, value: '100%', easing: 'linear' }, { time: S.photoS, value: '108%' }],
    y_scale: [{ time: 0, value: '100%', easing: 'linear' }, { time: S.photoS, value: '108%' }],
  });
  return els;
}

// Duotone Split BG panels (static) and the true-colour HERO (pushes forward),
// returned separately so Duotone 2 can transition them independently.
function duotoneParts(S, it, i) {
  const url = it.url;
  const pa = S.pairs[i % S.pairs.length];
  const pb = S.pairs[(i + 2) % S.pairs.length];
  const rect = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
  const half = (xc, pair) => ([
    applyPhotoColor({ type: 'image', source: url, x: xc, y: '50%', width: '50%', height: '100%',
      x_anchor: '50%', y_anchor: '50%', fit: 'cover', color_filter: 'grayscale', color_filter_value: '100%' }, null),
    { type: 'shape', x: xc, y: '50%', width: '50%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: rect, fill_color: pair[0], blend_mode: 'multiply' },
    { type: 'shape', x: xc, y: '50%', width: '50%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: rect, fill_color: pair[1], blend_mode: 'screen', opacity: '55%' },
  ]);
  const bg = half('25%', pa).concat(half('75%', pb));
  const hero = applyPhotoColor({
    type: 'image', source: url, x: '50%', y: '50%', width: '58%', height: '84%',
    x_anchor: '50%', y_anchor: '50%', fit: 'cover',
    shadow_color: '#000000', shadow_blur: '6vmin', shadow_x: '0vmin', shadow_y: '3vmin',
    x_scale: [{ time: 0, value: '100%', easing: 'linear' }, { time: S.photoS, value: '108%' }],
    y_scale: [{ time: 0, value: '100%', easing: 'linear' }, { time: S.photoS, value: '108%' }],
  }, it);
  return { bg, hero };
}

// ---- Duotone Split 2 — FRANTIC: the background (as one unit) and the hero get
// DIFFERENT transitions on every move (bg might wipe while the hero slides), and
// the type changes each cut so no two moves match. Bg on track 2, hero on track 3,
// aligned by explicit time; cards on track 4 so they hard-cut over the top.
function duotone2Source({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height }) {
  const rect = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
  const photos = seq.filter((it) => it.type !== 'placeholder');
  const n = Math.max(1, photos.length);
  const photoS = S.photoS, fade = S.fadeS;
  const step = photoS - fade;                          // consecutive overlap = fade
  const stackStart = includeCards ? CARD_S : 0;
  const contentDur = (n - 1) * step + photoS;
  const total = stackStart + contentDur + (includeCards ? CARD_S : 0);
  // Two never-matching transition wheels; index by move so every cut differs.
  const BG = ['slide', 'circular-wipe', 'scale', 'fade'];
  const HERO = ['scale', 'fade', 'slide', 'circular-wipe'];
  const tr = (type) => [{ time: 'start', duration: fade, transition: true, type }];

  const elements = [];
  elements.push({ name: 'Background', type: 'shape', track: 1, time: 0, duration: total, path: rect, width: '100%', height: '100%', fill_color: S.bg });
  photos.forEach((it, i) => {
    const t = +(stackStart + i * step).toFixed(2);
    if (it.green) {
      // Green frame → pure full-frame green (keyable), not the duotone tint.
      elements.push({ name: `DuoGreen-${i + 1}`, type: 'composition', track: 2, time: t, duration: photoS,
        ...(i > 0 ? { animations: tr(BG[i % BG.length]) } : {}),
        elements: [{ type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: rect, fill_color: CHROMA_GREEN }] });
      return;
    }
    const { bg, hero } = duotoneParts(S, it, i);
    elements.push({ name: `DuoBg-${i + 1}`, type: 'composition', track: 2, time: t, duration: photoS,
      ...(i > 0 ? { animations: tr(BG[i % BG.length]) } : {}), elements: bg });
    elements.push({ name: `DuoHero-${i + 1}`, type: 'composition', track: 3, time: t, duration: photoS,
      ...(i > 0 ? { animations: tr(HERO[i % HERO.length]) } : {}), elements: [hero] });
  });
  if (includeCards) {
    elements.push({ name: 'Opening', type: 'composition', track: 4, time: 0, duration: CARD_S, elements: card(S, { kicker: S.kicker, title, subtitle, height }) });
    elements.push({ name: 'Closing', type: 'composition', track: 4, time: total - CARD_S, duration: CARD_S, elements: card(S, { kicker: null, title: title || 'THANK YOU', subtitle: 'A MAIN EVENT STUDIO PRODUCTION', height }) });
  }
  if (watermarkUrl) elements.push({ name: 'Watermark', type: 'image', track: 99, source: watermarkUrl, time: 0, duration: Math.max(1, total - 0.1), width: '62%', height: '6.9%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', opacity: '42%' });
  return { output_format: 'mp4', width, height, frame_rate: 30, elements };
}


// ---- Polaroid: a GROWING STACKED PILE (not a slideshow) ----
// Prints drop in from above every HOLD seconds and land fanned/scattered; up to
// KEEP are visible at once; the oldest fades as new ones land on top. Mirrors
// the approved mock (polaroid_MOCK_perfected.html / polaroid_reference.mp4).
function polaroidStackSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height, background, perPhoto = null }) {
  const rect = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
  const photosOnly = seq.filter((it) => it.type !== 'placeholder'); // green-screen gaps aren't prints
  const n = photosOnly.length;

  // Length mode: a print drops every perPhoto seconds (the drop-in MOVE clamps so
  // it never exceeds the beat); default keeps the approved POL cadence.
  const HOLD = perPhoto != null ? Math.max(0.5, perPhoto) : POL.HOLD;
  const MOVE = perPhoto != null ? Math.min(POL.MOVE, HOLD * 0.6) : POL.MOVE;
  const cardsTime = includeCards ? 2 * CARD_S : 0;
  const stackDur = n > 0 ? (n - 1) * HOLD + MOVE + HOLD : 0;
  const total = cardsTime + stackDur;
  const stackStart = includeCards ? CARD_S : 0;
  // Changeable-background control (image + tint + opacity). Defaults: no custom
  // image (use the blurred current-photo backdrop) + the deep-violet wash.
  const bg = background || {};
  const bgUrl = bg.url || S.bgImageUrl || null;
  const TINT = bg.tint || S.tint || '#241033';
  const TINT_OP = bg.opacity || S.tintOpacity || '52%';

  const elements = [];

  // Style-colour backdrop for the whole piece.
  elements.push({ name: 'Background', type: 'shape', track: 1, time: 0, duration: total,
    path: rect, width: '100%', height: '100%', fill_color: S.bg });

  // Opening card (hard cut).
  if (includeCards) elements.push({ name: 'Opening', type: 'composition', track: 2, time: 0,
    duration: CARD_S, elements: card(S, { kicker: S.kicker, title, subtitle, height }) });

  // STABLE background (Josh: it must NOT change with each photo). Default is a
  // fixed deep-violet wash; a custom background image (from the Change-background
  // control) replaces it, still static. The old per-photo blurred backdrop —
  // which changed on every drop — is gone.
  if (bgUrl) {
    elements.push({ name: 'Backdrop', type: 'image', source: bgUrl, track: 2, time: stackStart,
      duration: stackDur, x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%',
      fit: 'cover', blur_radius: 18, blur_mode: 'stack' });
  }
  // A soft radial-ish depth: a darker vignette wash at the edges over the solid
  // Background, then the violet tint — all static, so the backdrop never shifts.
  elements.push({ name: 'Vignette', type: 'shape', track: 2, time: stackStart, duration: stackDur,
    path: rect, width: '150%', height: '150%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
    fill_color: '#000000', opacity: '22%', blend_mode: 'multiply', blur_radius: 60, blur_mode: 'stack' });
  elements.push({ name: 'Tint', type: 'shape', track: 3, time: stackStart, duration: stackDur,
    path: rect, width: '100%', height: '100%', fill_color: TINT, opacity: TINT_OP });

  // The prints. Each drops from above and stays (higher track = on top), then
  // fades once KEEP newer prints have landed over it.
  photosOnly.forEach((it, k) => {
    const t = stackStart + k * HOLD;
    // Haphazard scatter with a dominant front print \u2014 a wider, more natural
    // spread than the tight cluster it had drifted to (matches the reference pile).
    const rTilt = (pol_rand(k) * 2 - 1) * 15;              // \u00B115\u00B0 tilt
    const ox = (pol_rand(k + 100) * 2 - 1) * 17;           // \u00B117% horizontal
    const drop = pol_rand(k + 200) < 0.5;
    const oy = (drop ? 6 : -6) + (pol_rand(k + 300) * 2 - 1) * 4;  // ~\u00B110% vertical
    const settleX = 50 + ox, settleY = 50 + oy;
    const startX = settleX + (pol_rand(k + 400) * 2 - 1) * 10;
    const visibleBeats = Math.min(n - 1 - k, POL.KEEP);
    const life = MOVE + visibleBeats * HOLD + HOLD * 0.5;
    const willFade = k < n - POL.KEEP;

    // Print geometry differs by variant:
    //  \u2022 Polaroid Drop (default): fixed near-square card, photo COVER-crops the
    //    square window with a thin even top/sides and a THICK white bottom strip.
    //  \u2022 Photo Drop (wholePhoto): card matches the photo's native aspect + an EVEN
    //    absolute white margin all around, whole photo shown (nothing cropped).
    let cardW, cardH, cardEls;
    if (S.wholePhoto) {
      const A = (it.w > 0 && it.h > 0) ? it.w / it.h : 1;          // photo pixel aspect
      let phH = 50, phW = phH * A * (height / width);             // photo display size, frame %
      if (phW > 58) { phW = 58; phH = phW * (width / height) / A; }
      if (phH > 64) { phH = 64; phW = phH * A * (height / width); }
      // EVEN white border in PIXELS (bottom = top = sides). A frame-% margin
      // renders unequal because the frame is wider than tall, so the horizontal
      // margin-% is scaled by height/width to match the vertical margin in pixels.
      const My = 3.4, Mx = My * (height / width);
      cardW = phW + 2 * Mx; cardH = phH + 2 * My;
      cardEls = [
        { type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: roundedRect(100 * 1.4 / cardW, 100 * 1.4 / cardH), fill_color: '#FDFDFA' },
        // card matches the photo aspect, so 'fill' places the whole photo with an
        // exact even border \u2014 nothing cropped.
        applyPhotoColor({ type: 'image', source: it.url, x: '50%', y: '50%', width: `${(phW / cardW * 100).toFixed(1)}%`, height: `${(phH / cardH * 100).toFixed(1)}%`, x_anchor: '50%', y_anchor: '50%', fit: 'fill' }, it),
      ];
    } else {
      cardW = 40; cardH = 78;
      cardEls = [
        { type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: POLAROID_CARD_PATH, fill_color: '#FDFDFA' },
        // Square-ish photo window: thin even top/sides (~6%), THICK white bottom
        // (~30%). Cover-crops; head-safe top framing applied per photo.
        applyPhotoColor({ type: 'image', source: it.url, width: '88%', height: '64%', fit: 'cover', ...printFraming(it) }, it),
      ];
    }
    const print = {
      name: `Print-${k + 1}`, type: 'composition', track: 4 + k, time: t,
      duration: life + (willFade ? POL.FADE : 0),
      // Starts fully above the frame and FALLS QUICK (quadratic-in = accelerates
      // like gravity), then in the last stretch FEATHERS to a soft, still landing
      // (quadratic-out) \u2014 no scale bounce, no overshoot (Josh: "fall quickly then
      // feather soft land, not bounce").
      x: [{ time: 0, value: `${startX.toFixed(1)}%`, easing: 'quadratic-out' }, { time: MOVE, value: `${settleX.toFixed(1)}%` }],
      y: [{ time: 0, value: '-78%', easing: 'quadratic-in' }, { time: MOVE * 0.6, value: `${(settleY - 3).toFixed(1)}%`, easing: 'quadratic-out' }, { time: MOVE, value: `${settleY.toFixed(1)}%` }],
      x_anchor: '50%', y_anchor: '50%', width: `${cardW.toFixed(1)}%`, height: `${cardH.toFixed(1)}%`,
      z_rotation: `${rTilt.toFixed(1)}\u00B0`,   // static tilt (keyframed z_rotation is unreliable in Creatomate)
      // Soft, larger drop shadow so the print doesn't read as a hard cut-out.
      shadow_color: '#000000', shadow_blur: '8vmin', shadow_x: '0vmin', shadow_y: '3vmin',
      elements: cardEls,
    };
    if (willFade) print.opacity = [{ time: 0, value: '100%' }, { time: life, value: '100%' }, { time: life + POL.FADE, value: '0%' }];
    elements.push(print);
  });

  // Closing card + watermark (watermark on a very high track so it's always on top).
  if (includeCards) elements.push({ name: 'Closing', type: 'composition', track: 2, time: total - CARD_S,
    duration: CARD_S, elements: card(S, { kicker: null, title: title || 'THANK YOU', subtitle: 'A MAIN EVENT STUDIO PRODUCTION', height }) });
  if (watermarkUrl) elements.push({ name: 'Watermark', type: 'image', track: 99, source: watermarkUrl, time: 0,
    duration: Math.max(1, total - 0.1), width: '62%', height: '6.9%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', opacity: '42%' });

  return { output_format: 'mp4', width, height, frame_rate: 30, elements };
}

// ---- Collage Wall (Classic / Featured) — faithful port of the approved mocks
// (collage_classic.html / collage_featured.html). A grid of photo cells lives in
// a "Wall" composition bigger than the frame; a camera (the Wall's x/y +
// x_scale/y_scale keyframes) WHIPS onto a focal cell, then slowly PUSHES in
// (dwell), visiting focal cells in a haphazard order, alternating a full-frame
// fill with a pulled-back "wall visible" rest — the mock's tf()/whip/dwell model.
// Warm grade on top. Target is "same to the eye", not pixel-exact. RENDER-TEST
// items: (1) that Creatomate scales a composition's contents via x_scale (the
// camera zoom) — the crux; (2) light-leaks / dust / grain / vignette, which are
// browser/canvas effects approximated here by the warm grade (add overlay assets
// later for the full finish).
function collageWallSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width: W, height: H, background, assetBase, perPhoto = null }) {
  const rect = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
  const photos = seq.filter((it) => it.type !== 'placeholder');
  const n = Math.max(1, photos.length);
  const featured = S.variant === 'featured';
  const scatter = !!S.scatter;                     // gallery150: tilted print-cards
  const fast = featured || scatter;                // faster whips than Classic
  const pk = (i) => photos[i % n];

  // seeded RNG so re-renders are identical (varies with the photo set)
  let _s = 12345 + n * 97 + (featured ? 7 : 0) + (scatter ? 19 : 0);
  const rnd = (a, b) => { _s = (_s * 1103515245 + 12345) & 0x7fffffff; return a + (_s / 0x7fffffff) * (b - a); };

  const gap = 8;
  let wallWpx = 0, wallHpx = 0;
  const cells = [];          // { x,y,w,h,it }  (px in wall space)
  const focal = [];          // { cx,cy,w,h }   (camera targets)

  // NATIVE SHAPE — two wall layouts:
  //  • Collage (classic / featured) → JUSTIFIED ROWS (tidy grid, uniform row height).
  //  • Gallery 150 (scatter) → a haphazard OVERLAPPING PILE of tilted prints (its
  //    reference clip), each native-aspect, camera flying in to feature one.
  // Photos are PLACED in a shuffled order so resting on them 1..N still whips the
  // camera around; every photo keeps its own focused rest.
  const aspOf = (it) => { const a = (it && it.w > 0 && it.h > 0) ? it.w / it.h : 16 / 9; return Math.max(0.42, Math.min(3.2, a)); };
  const place = [...Array(n).keys()];
  for (let i = place.length - 1; i > 0; i--) { const j = Math.floor(rnd(0, i + 1)); [place[i], place[j]] = [place[j], place[i]]; }
  const cellOfPhoto = new Array(n).fill(-1);
  if (scatter) {
    const COLS = S.cols || 6;
    const ROWS = Math.max(3, Math.ceil(n / COLS));
    const BH = 300;                              // base card height (varies a little)
    const slotW = 380, slotH = 320, pad = 260;   // slot < card ⇒ prints overlap
    let pi = 0;
    for (let r = 0; r < ROWS && pi < n; r++) for (let c = 0; c < COLS && pi < n; c++) {
      const it = photos[place[pi]]; const a = aspOf(it);
      const h = BH * (0.86 + rnd(0, 0.32)); const w = h * a;
      const cx = pad + (c + 0.5) * slotW + rnd(-slotW * 0.26, slotW * 0.26);
      const cy = pad + (r + 0.5) * slotH + rnd(-slotH * 0.26, slotH * 0.26);
      cellOfPhoto[place[pi]] = cells.length;
      cells.push({ x: cx - w / 2, y: cy - h / 2, w, h, it, tilt: +rnd(-13, 13).toFixed(1) });
      pi++;
    }
    wallWpx = pad * 2 + COLS * slotW; wallHpx = pad * 2 + ROWS * slotH;
  } else {
    const ROWH = featured ? 460 : 300, TARGETW = featured ? 2400 : 2600, G = 22;
    const rows = []; let cur = [], sumA = 0;
    place.forEach((pIdx) => { const it = photos[pIdx]; const a = aspOf(it); cur.push({ pIdx, it, a }); sumA += a; if (sumA * ROWH + G * (cur.length - 1) >= TARGETW) { rows.push(cur); cur = []; sumA = 0; } });
    if (cur.length) rows.push(cur);
    let wy = G, maxRight = 0;
    rows.forEach((row, ri) => {
      const aSum = row.reduce((s, c) => s + c.a, 0);
      let h = (TARGETW - G * (row.length - 1)) / aSum;
      const isLast = ri === rows.length - 1;
      if (isLast && (row.length <= 1 || h > ROWH * 1.5)) h = ROWH;
      h = Math.max(ROWH * 0.7, Math.min(h, ROWH * 1.6));
      let x = G;
      row.forEach((c) => { const w = h * c.a; cellOfPhoto[c.pIdx] = cells.length; cells.push({ x, y: wy, w, h, it: c.it }); x += w + G; });
      maxRight = Math.max(maxRight, x); wy += h + G;
    });
    wallWpx = Math.max(TARGETW + G, maxRight); wallHpx = wy;
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fillScale = (f) => Math.max(W / f.w, H / f.h) * 1.02;
  const partialScale = (f) => Math.min(W * 0.68 / f.w, H * 0.78 / f.h) * rnd(0.92, 1.05);
  const tfPct = (cx, cy, s) => {
    let tx = W / 2 - cx * s, ty = H / 2 - cy * s;
    tx = clamp(tx, W - wallWpx * s, 0); ty = clamp(ty, H - wallHpx * s, 0);
    return { x: `${(tx / W * 100).toFixed(2)}%`, y: `${(ty / H * 100).toFixed(2)}%`, s: `${(s * 100).toFixed(2)}%` };
  };

  // Rest on every photo in CHRONOLOGICAL order; because placement was shuffled,
  // consecutive numbers sit in scattered cells so the camera whips around.
  const visitCells = [];
  for (let p = 0; p < n; p++) { if (cellOfPhoto[p] >= 0) visitCells.push(cellOfPhoto[p]); }
  // Cap light-leak overlays (one every few moves) so a large set doesn't stack
  // dozens of screen layers and balloon the render.
  const leakEvery = Math.max(1, Math.round(visitCells.length / 12));

  const xK = [], yK = [], sxK = [], syK = [];
  const leakTimes = [];
  let t = 0;
  visitCells.forEach((ci, i) => {
    const c = cells[ci];
    const f = { cx: c.x + c.w / 2, cy: c.y + c.h / 2, w: c.w, h: c.h };
    // scatter (Gallery 150) always keeps surrounding prints visible (partial);
    // Classic/Featured alternate a full-frame fill with a pulled-back rest.
    const s = (!scatter && rnd(0, 1) < 0.5) ? fillScale(f) : partialScale(f);
    const rest = tfPct(f.cx, f.cy, s), push = tfPct(f.cx, f.cy, s * 1.05);
    // Length mode: whip + dwell together fill exactly the per-photo budget so the
    // whole set cycles in the target time; otherwise keep the natural random pace.
    const whipS = perPhoto != null ? Math.max(0.16, perPhoto * 0.32) : (fast ? rnd(0.52, 0.72) : rnd(0.95, 1.25));
    const dwellS = perPhoto != null ? Math.max(0.14, perPhoto * 0.68) : (fast ? rnd(1.75, 2.15) : rnd(1.5, 1.9));
    const moveStart = t;
    if (i === 0) {
      xK.push({ time: 0, value: rest.x, easing: 'linear' }); yK.push({ time: 0, value: rest.y, easing: 'linear' });
      sxK.push({ time: 0, value: rest.s, easing: 'linear' }); syK.push({ time: 0, value: rest.s, easing: 'linear' });
    } else {
      const tw = +(t + whipS).toFixed(2);
      xK.push({ time: tw, value: rest.x, easing: 'quadratic-out' }); yK.push({ time: tw, value: rest.y, easing: 'quadratic-out' });
      sxK.push({ time: tw, value: rest.s, easing: 'quadratic-out' }); syK.push({ time: tw, value: rest.s, easing: 'quadratic-out' });
      t = tw;
    }
    const td = +(t + dwellS).toFixed(2);
    xK.push({ time: td, value: push.x }); yK.push({ time: td, value: push.y });
    sxK.push({ time: td, value: push.s }); syK.push({ time: td, value: push.s });
    // leak flows through the whip and lingers into the dwell (mock: leakFlow)
    if (i % leakEvery === 0) leakTimes.push({ start: +moveStart.toFixed(2), dur: +((td - moveStart) * 1.0).toFixed(2), v: Math.floor(rnd(0, 3)), peak: Math.round(rnd(42, 66)), from: +rnd(42, 48).toFixed(1), to: +rnd(52, 58).toFixed(1) });
    t = td;
  });
  const wallDur = t || 6;
  const stackStart = includeCards ? CARD_S : 0;
  const total = (includeCards ? 2 * CARD_S : 0) + wallDur;

  const cellEls = cells.map((c) => {
    const cx = `${((c.x + c.w / 2) / wallWpx * 100).toFixed(3)}%`, cy = `${((c.y + c.h / 2) / wallHpx * 100).toFixed(3)}%`;
    const cw = `${(c.w / wallWpx * 100).toFixed(3)}%`, ch = `${(c.h / wallHpx * 100).toFixed(3)}%`;
    if (scatter) {
      // a tilted white-bordered print: white card + photo inset, with a soft
      // shadow for depth, rotated by the cell's tilt.
      return {
        type: 'composition', x: cx, y: cy, width: cw, height: ch, x_anchor: '50%', y_anchor: '50%',
        z_rotation: `${(c.tilt || 0).toFixed(1)}°`,
        shadow_color: '#000000', shadow_blur: '2.5vmin', shadow_x: '0vmin', shadow_y: '1vmin',
        elements: [
          { type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: rect, fill_color: '#FBFAF7' },
          // Card matches the photo's aspect, so a uniform inset + contain shows the
          // WHOLE photo (no crop) with an even print border.
          applyPhotoColor({ type: 'image', source: c.it.url, x: '50%', y: '50%', width: '92%', height: '92%', x_anchor: '50%', y_anchor: '50%', fit: 'contain' }, c.it),
        ],
      };
    }
    return applyPhotoColor({ type: 'image', source: c.it.url, x: cx, y: cy, width: cw, height: ch, x_anchor: '50%', y_anchor: '50%', fit: 'cover' }, c.it);
  });
  const wallBacking = scatter ? '#141210' : '#F4F1EA';   // dark surface for prints; cream for grid

  const elements = [];
  elements.push({ name: 'Background', type: 'shape', track: 1, time: 0, duration: total, path: rect, width: '100%', height: '100%', fill_color: S.bg || '#0E0C0A' });
  if (includeCards) elements.push({ name: 'Opening', type: 'composition', track: 2, time: 0, duration: CARD_S, elements: card(S, { kicker: S.kicker, title, subtitle, height: H }) });
  elements.push({
    name: 'Wall', type: 'composition', track: 2, time: stackStart, duration: wallDur,
    x_anchor: '0%', y_anchor: '0%', width: `${(wallWpx / W * 100).toFixed(2)}%`, height: `${(wallHpx / H * 100).toFixed(2)}%`,
    x: xK, y: yK, x_scale: sxK, y_scale: syK,
    elements: [{ type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: rect, fill_color: wallBacking }, ...cellEls],
  });
  elements.push({ name: 'Warm', type: 'shape', track: 8, time: stackStart, duration: wallDur, path: rect, width: '100%', height: '100%', fill_color: S.warm || '#3A2A12', opacity: S.warmOpacity || '18%', blend_mode: 'multiply' });
  // Flowing warm light-leaks (screen blend) — one per camera move, sweeping and
  // fading, from public/overlays/leakN.png. Needs assetBase (the site URL) so
  // Creatomate can fetch them; skipped if not provided.
  if (assetBase) {
    leakTimes.forEach((L, i) => {
      elements.push({
        name: `Leak-${i + 1}`, type: 'image', track: 9, source: `${assetBase}/overlays/leak${L.v + 1}.png`,
        time: stackStart + L.start, duration: Math.max(0.6, L.dur), fit: 'cover', x_anchor: '50%', y_anchor: '50%',
        y: '50%', width: '128%', height: '128%', blend_mode: 'screen',
        x: [{ time: 0, value: `${L.from}%`, easing: 'linear' }, { time: Math.max(0.6, L.dur), value: `${L.to}%` }],
        opacity: [{ time: 0, value: '0%' }, { time: Math.max(0.6, L.dur) * 0.28, value: `${L.peak}%` }, { time: Math.max(0.6, L.dur) * 0.55, value: `${Math.round(L.peak * 0.7)}%` }, { time: Math.max(0.6, L.dur), value: '0%' }],
      });
    });
  }
  if (includeCards) elements.push({ name: 'Closing', type: 'composition', track: 2, time: total - CARD_S, duration: CARD_S, elements: card(S, { kicker: null, title: title || 'THANK YOU', subtitle: 'A MAIN EVENT STUDIO PRODUCTION', height: H }) });
  if (watermarkUrl) elements.push({ name: 'Watermark', type: 'image', track: 99, source: watermarkUrl, time: 0, duration: Math.max(1, total - 0.1), width: '62%', height: '6.9%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', opacity: '42%' });
  return { output_format: 'mp4', width: W, height: H, frame_rate: 30, elements };
}

// ---- Epic Vintage — faithful port of the APPROVED browser preview -----------
// (epic-preview.html, "v13", the version Josh signed off with "I love it!!!").
// One SHARP hero print rides in over a pile of BIG overlapping FADED same-photo
// prints, dwells, then the WHOLE pile (bg + hero, married) flies off — shrinking,
// spinning, drifting to a corner — while the NEXT pile hard-cuts in on top, and a
// warm light-leak BLOOM ramps up over the outgoing image and hits full-bright on
// the cut. Motion is ONE continuous curve (huge hard-cut in -> fast settle -> slow
// dwell -> accelerate off): no drop-in, no reversal, no stall. NO template text.
// Green bookends via the wrapper.
//
// The preview's exact numbers, translated to Creatomate keyframes:
//   scene scale : 230% -> 104% -> 100% -> 55% -> 30% -> 14%   (monotonic; offsets
//                 0, .175, .488, .722, .878, 1 of D)
//   hero (extra): linear 100% -> 117% + slight spin, riding on top of the scene
//   D (scene life) = BEAT * 1.4  -> consecutive piles OVERLAP by 0.4*BEAT so the
//                 frame is never empty (new pile covers the shrinking old one).
//   bloom       : peaks exactly on each cut, from a FRAME corner, cycling corners.
function epicVintageSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width: W, height: H, assetBase, perPhoto = null }) {
  const rect = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
  const circle = roundedRect(50, 50);                    // full ellipse in its box
  const printPath = roundedRect(0.8, 1.1);               // barely-rounded print corners
  const photos = seq.filter((s) => s.type === 'photo');
  const n = photos.length;
  const cardS = includeCards ? CARD_S : 0;
  const stackStart = cardS;

  // BEAT = per-photo cadence; D = how long each pile lives (1.4× the beat → overlap).
  const BEAT = perPhoto != null ? Math.max(1.2, perPhoto) : (S.photoS + 1.6);
  const D = BEAT * 1.4;
  const bodyDur = (n - 1) * BEAT + D;                    // last pile runs its full life
  const total = cardS * 2 + bodyDur;
  const WH = W / H;                                      // frame pixel aspect (≈1.778)

  // Approved scene curve (offsets → scale/rot/translate). x-translate is dir-signed
  // (flies to alternating sides); y-translate is always up.
  // CONTINUOUS FLOW — no plateau anywhere. The old curve held ~100% through the
  // "view" (104→100), which at a slower pace stretched into a visible FREEZE
  // ("the image stops"). This curve always moves: fast in, a steady SLOW glide
  // through the view (122→98, linear — decelerated, never still), then accelerate
  // off. Because the whole arc scales with the per-photo time, a longer pace just
  // makes the SAME motion slower — it never inserts a hold.
  const OFF   = [0, 0.16, 0.46, 0.72, 0.88, 1];
  const SC     = [230, 122, 98, 60, 33, 15];
  const ROT    = [-6, -1, 3, 26, 46, 64];                // ×dir — always turning
  const TX     = [0, 2, 7, 26, 54, 78];                  // ×dir — always drifting
  const TY     = [0, -2, -5, -13, -24, -34];             // fixed (up)
  const EASE   = ['quadratic-out', 'linear', 'quadratic-in', 'linear', 'linear', 'linear'];

  // Faded BIG background prints (cover the frame, show multiple edges) + 2 small.
  const SPOTS = [
    { l: -79, t: -73, w: 246, r: -8 }, { l: -27, t: -77, w: 252, r: 7 },
    { l: -77, t: -27, w: 252, r: 6 },  { l: -25, t: -29, w: 246, r: -6 },
    { l: 52,  t: -8,  w: 56,  r: 9 },  { l: -6,  t: 51,  w: 58,  r: 8 },
  ];
  // Bloom marches around the FRAME corners (not the image corners).
  const CORNERS = [{ x: 93, y: 9 }, { x: 7, y: 90 }, { x: 91, y: 88 }, { x: 9, y: 12 }];
  const RAMP = 0.82, FADE = 0.56, PK = RAMP / (RAMP + FADE);

  const elements = [];
  elements.push({ name: 'Background', type: 'shape', track: 1, time: 0, duration: total, path: rect, width: '100%', height: '100%', fill_color: S.bg || '#2a1d12' });
  if (includeCards) elements.push({ name: 'Opening', type: 'composition', track: 2, time: 0, duration: CARD_S, elements: card(S, { kicker: S.kicker, title, subtitle, height: H }) });

  // --- each PILE (one photo) -------------------------------------------------
  photos.forEach((it, i) => {
    const t = stackStart + i * BEAT;
    const dir = i % 2 ? 1 : -1;
    const A = (it.w > 0 && it.h > 0) ? it.w / it.h : 16 / 9;   // photo pixel aspect

    // scene transform keyframes (times = offset × D)
    const sceneScale = OFF.map((o, k) => ({ time: +(o * D).toFixed(3), value: `${SC[k]}%`, ...(EASE[k] && k < OFF.length - 1 ? { easing: EASE[k] } : {}) }));
    const sceneX = OFF.map((o, k) => ({ time: +(o * D).toFixed(3), value: `${(50 + dir * TX[k]).toFixed(1)}%`, ...(EASE[k] && k < OFF.length - 1 ? { easing: EASE[k] } : {}) }));
    const sceneY = OFF.map((o, k) => ({ time: +(o * D).toFixed(3), value: `${(50 + TY[k]).toFixed(1)}%`, ...(EASE[k] && k < OFF.length - 1 ? { easing: EASE[k] } : {}) }));
    const sceneR = OFF.map((o, k) => ({ time: +(o * D).toFixed(3), value: `${(dir * ROT[k]).toFixed(1)}°`, ...(EASE[k] && k < OFF.length - 1 ? { easing: EASE[k] } : {}) }));
    const sceneO = [{ time: 0, value: '100%' }, { time: +(0.878 * D).toFixed(3), value: '100%' }, { time: +(1 * D).toFixed(3), value: '0%' }];

    // faded background prints inside the scene
    const bgPrints = SPOTS.map((s) => {
      const bpH = s.w * WH / A;                              // native-aspect height (%, of frame)
      const cx = s.l + s.w / 2, cy = s.t + bpH / 2;          // center (CSS rotates about center)
      const mat = s.w * 0.012;                               // ~1% even white mat
      return {
        type: 'composition', x: `${cx.toFixed(1)}%`, y: `${cy.toFixed(1)}%`,
        width: `${s.w}%`, height: `${bpH.toFixed(1)}%`, x_anchor: '50%', y_anchor: '50%',
        z_rotation: `${s.r}°`, shadow_color: '#00000055', shadow_blur: '2.4vmin', shadow_x: '0vmin', shadow_y: '0.8vmin',
        elements: [
          { type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: rect, fill_color: '#EEE6D4' },
          { type: 'image', source: it.url, x: '50%', y: '50%', width: `${(100 - 2 * 1.2).toFixed(1)}%`, height: `${(100 - 2 * 1.2).toFixed(1)}%`, x_anchor: '50%', y_anchor: '50%', fit: 'cover', color_filter: 'sepia', color_filter_value: '58%', blur_radius: 9, blur_mode: 'stack' },
          // light warm/dark wash → faded, low-key vintage read but the print + its
          // frame stay VISIBLE (Josh: "you can make out the white frame")
          { type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: rect, fill_color: '#2A1B0C', blend_mode: 'multiply', opacity: '13%' },
        ],
      };
    });

    // sharp HERO print — fit inside a 62%h × 66%w box at native aspect (big, like
    // the approved preview where the hero fills most of the frame).
    let printH = 62, printW = 62 * A * (H / W);
    if (printW > 66) { printW = 66; printH = 66 * (W / H) / A; }
    const heroWrap = {
      type: 'composition', width: `${printW.toFixed(1)}%`, height: `${printH.toFixed(1)}%`, x_anchor: '50%', y_anchor: '50%', x: '50%', y: '50%',
      // rides on TOP of the scene transform: slow linear grow + slight spin (keeps
      // the dwell alive — never a frozen frame).
      x_scale: [{ time: 0, value: '100%', easing: 'linear' }, { time: D, value: '124%' }],
      y_scale: [{ time: 0, value: '100%', easing: 'linear' }, { time: D, value: '124%' }],
      z_rotation: [{ time: 0, value: '0°', easing: 'linear' }, { time: D, value: `${(dir * 7).toFixed(1)}°` }],
      shadow_color: '#140800', shadow_blur: '3.4vmin', shadow_x: '0vmin', shadow_y: '1.4vmin',
      elements: [
        { type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: printPath, fill_color: '#F1E8D6' },
        applyPhotoColor({ type: 'image', source: it.url, x: '50%', y: '50%', width: '99%', height: '99%', x_anchor: '50%', y_anchor: '50%', fit: 'contain' }, it),
      ],
    };

    elements.push({
      name: `Epic-${i + 1}`, type: 'composition', track: 3 + i, time: t, duration: D,
      width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%',
      x: sceneX, y: sceneY, z_rotation: sceneR, x_scale: sceneScale, y_scale: sceneScale, opacity: sceneO,
      elements: [
        // bokeh base — blurred same-photo fill so black NEVER shows through (kept
        // light so it doesn't flatten the faded print pile that sits on top)
        { type: 'image', source: it.url, x: '50%', y: '50%', width: '128%', height: '128%', x_anchor: '50%', y_anchor: '50%', fit: 'cover', color_filter: 'sepia', color_filter_value: '70%', blur_radius: 34, blur_mode: 'stack', opacity: '100%' },
        { type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: rect, fill_color: '#221606', blend_mode: 'multiply', opacity: '12%' },
        ...bgPrints,
        heroWrap,
      ],
    });
  });

  // --- persistent grade (warm multiply + cream lift) + drifting glows ---------
  // two slow warm glows (blurred amber circles), screen — the bokeh shimmer.
  const glow = (w, x0, y0, x1, y1, op) => ({
    type: 'shape', track: 7, time: stackStart, duration: bodyDur, path: circle,
    width: `${w}%`, height: `${w}%`, x_anchor: '50%', y_anchor: '50%', fill_color: '#FFD6AA',
    blend_mode: 'screen', blur_radius: 60, blur_mode: 'stack', opacity: `${op}%`,
    x: [{ time: 0, value: `${x0}%`, easing: 'linear' }, { time: bodyDur / 2, value: `${x1}%`, easing: 'linear' }, { time: bodyDur, value: `${x0}%` }],
    y: [{ time: 0, value: `${y0}%`, easing: 'linear' }, { time: bodyDur / 2, value: `${y1}%`, easing: 'linear' }, { time: bodyDur, value: `${y0}%` }],
  });
  elements.push(glow(46, 30, 62, 18, 70, 34));
  elements.push(glow(38, 70, 20, 82, 12, 30));
  elements.push({ name: 'Warm', type: 'shape', track: 8, time: stackStart, duration: bodyDur, path: rect, width: '100%', height: '100%', fill_color: S.warm || '#C9865A', opacity: S.warmOpacity || '16%', blend_mode: 'multiply' });
  elements.push({ name: 'Lift', type: 'shape', track: 8, time: stackStart, duration: bodyDur, path: rect, width: '100%', height: '100%', fill_color: '#F3D9B4', opacity: '8%', blend_mode: 'screen' });

  // floating dust (existing overlay assets), screen, slow parallax drift
  if (assetBase) {
    [['dust1.png', 20, 48, 52], ['dust2.png', 13, 52, 47]].forEach(([d, op, x0, y0], k) => {
      elements.push({
        name: `Dust-${k + 1}`, type: 'image', track: 9, source: `${assetBase}/overlays/${d}`,
        time: stackStart, duration: bodyDur, fit: 'cover', blend_mode: 'screen',
        x_anchor: '50%', y_anchor: '50%', width: '120%', height: '120%', opacity: `${op}%`,
        x: [{ time: 0, value: `${x0}%`, easing: 'linear' }, { time: bodyDur, value: `${100 - x0}%` }],
        y: [{ time: 0, value: `${y0}%`, easing: 'linear' }, { time: bodyDur, value: `${100 - y0}%` }],
      });
    });
  }

  // --- BLOOM: peaks on every cut, from a frame corner (cycles corners) --------
  // warm halo + white-hot core + expanding ring + horizontal streak, all screen.
  for (let k = 1; k < n; k++) {
    const tc = stackStart + k * BEAT;                        // the hard cut into pile k
    const c = CORNERS[(k - 1) % CORNERS.length];
    const t0 = Math.max(0, tc - RAMP);
    const dur = RAMP + FADE;
    const ramp = (peak) => [{ time: 0, value: '0%' }, { time: +(PK * dur).toFixed(3), value: `${peak}%`, easing: 'ease-in' }, { time: dur, value: '0%' }];
    // WAY brighter light-leak blowout (Josh). A warm FULL-FRAME flash nearly blows
    // the frame out at the cut, plus an intense warm-white core + halo from the
    // frame corner and a hot streak — screen-blended so they stack toward white.
    // full-frame warm blowout flash — the whole frame flares at the cut
    elements.push({ name: `Bloom-flash-${k}`, type: 'shape', track: 19, time: t0, duration: dur, path: rect, width: '100%', height: '100%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', fill_color: '#FFEECB', blend_mode: 'screen', blur_radius: 8, blur_mode: 'stack', opacity: ramp(58) });
    // wide amber halo from the corner
    elements.push({ name: `Bloom-halo-${k}`, type: 'shape', track: 20, time: t0, duration: dur, path: circle, width: '120%', height: '120%', x: `${c.x}%`, y: `${c.y}%`, x_anchor: '50%', y_anchor: '50%', fill_color: '#FFD79A', blend_mode: 'screen', blur_radius: 76, blur_mode: 'stack', opacity: ramp(96) });
    // intense warm-white core
    elements.push({ name: `Bloom-core-${k}`, type: 'shape', track: 21, time: t0, duration: dur, path: circle, width: '62%', height: '62%', x: `${c.x}%`, y: `${c.y}%`, x_anchor: '50%', y_anchor: '50%', fill_color: '#FFFCF4', blend_mode: 'screen', blur_radius: 46, blur_mode: 'stack', opacity: ramp(100) });
    // organic light-leak texture (real leak PNGs) sweeping from the corner, bright
    if (assetBase) {
      const EP = ['leak_epic1.png', 'leak_epic2.png', 'leak_epic3.png'];
      const from = c.x + (c.x > 50 ? 10 : -10), to = c.x;
      elements.push({
        name: `Bloom-leak-${k}`, type: 'image', track: 22, source: `${assetBase}/overlays/${EP[(k - 1) % EP.length]}`,
        time: t0, duration: dur, fit: 'cover', blend_mode: 'screen', x_anchor: '50%', y_anchor: '50%', y: '50%', width: '160%', height: '160%',
        x: [{ time: 0, value: `${from}%`, easing: 'linear' }, { time: dur, value: `${to}%` }], opacity: ramp(90),
      });
    }
    // expanding ring
    elements.push({
      name: `Bloom-ring-${k}`, type: 'shape', track: 23, time: t0, duration: dur, path: circle, x: `${c.x}%`, y: `${c.y}%`, x_anchor: '50%', y_anchor: '50%',
      fill_color: '#FFE6B4', blend_mode: 'screen', blur_radius: 3, blur_mode: 'stack', opacity: ramp(60),
      width: [{ time: 0, value: '16%', easing: 'ease-out' }, { time: dur, value: '44%' }],
      height: [{ time: 0, value: '16%', easing: 'ease-out' }, { time: dur, value: '44%' }],
    });
    // hot light streak across the corner's row
    elements.push({ name: `Bloom-streak-${k}`, type: 'shape', track: 24, time: t0, duration: dur, path: rect, width: '150%', height: '2.2%', x: '50%', y: `${c.y}%`, x_anchor: '50%', y_anchor: '50%', fill_color: '#FFF3D6', blend_mode: 'screen', blur_radius: 7, blur_mode: 'stack', opacity: ramp(92) });
  }

  if (includeCards) elements.push({ name: 'Closing', type: 'composition', track: 2, time: total - CARD_S, duration: CARD_S, elements: card(S, { kicker: null, title: title || 'THANK YOU', subtitle: 'A MAIN EVENT STUDIO PRODUCTION', height: H }) });
  if (watermarkUrl) elements.push({ name: 'Watermark', type: 'image', track: 99, source: watermarkUrl, time: 0, duration: Math.max(1, total - 0.1), width: '62%', height: '6.9%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', opacity: '42%' });
  return { output_format: 'mp4', width: W, height: H, frame_rate: 30, elements };
}


// ---- Trendy Photo Wall — a 3D-perspective grid of white-matted prints --------
// A grid of matte prints on a cream wall, viewed at an oblique 3D angle
// (Creatomate `perspective` + `x_rotation`/`y_rotation` — confirmed properties),
// with the camera drifting slowly across while the wall rotates gently toward
// the lens, so prints recede with real foreshortening. Soft warm grade + light
// leaks. NO template text. Green bookends via the wrapper. NOTE: this is the
// engine's first use of Creatomate 3D — the first render validates the look.
function trendyWallSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width: W, height: H, assetBase, perPhoto = null }) {
  const rect = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
  const photos = seq.filter((s) => s.type === 'photo');
  const cardS = includeCards ? CARD_S : 0;
  // Length mode: the drift lasts exactly the per-photo budget × photo count;
  // default keeps the gentle count-scaled drift.
  const BODY = perPhoto != null ? Math.max(4, perPhoto * photos.length) : Math.min(22, Math.max(11, 9 + photos.length * 0.5));  // slow drift, scales gently with count
  const total = cardS * 2 + BODY;

  // NATIVE SHAPE: justified rows (uniform row height, native-aspect widths) in
  // chronological order, so the 3D drift reveals the photos 1..N in order and each
  // keeps its true proportions (portrait = tall cell, landscape = wide).
  const aspOf = (it) => { const a = (it && it.w > 0 && it.h > 0) ? it.w / it.h : 16 / 9; return Math.max(0.42, Math.min(3.2, a)); };
  const ROWH = 270, TARGETW = 2400, gap = 30, pad = 90;
  const rows = []; let cur = [], sumA = 0;
  photos.forEach((it) => {
    const a = aspOf(it); cur.push({ it, a }); sumA += a;
    if (sumA * ROWH + gap * (cur.length - 1) >= TARGETW) { rows.push(cur); cur = []; sumA = 0; }
  });
  if (cur.length) rows.push(cur);
  const laid = []; let wy = pad;
  rows.forEach((row, ri) => {
    const aSum = row.reduce((s, c) => s + c.a, 0);
    let h = (TARGETW - gap * (row.length - 1)) / aSum;
    const isLast = ri === rows.length - 1;
    if (isLast && (row.length <= 1 || h > ROWH * 1.5)) h = ROWH;
    h = Math.max(ROWH * 0.7, Math.min(h, ROWH * 1.6));
    let x = pad;
    row.forEach((c) => { const w = h * c.a; laid.push({ x, y: wy, w, h, it: c.it }); x += w + gap; });
    wy += h + gap;
  });
  const wallWpx = TARGETW + pad * 2;
  const wallHpx = (wy - gap) + pad;

  const cellEls = laid.map((cell) => ({
    type: 'composition',
    x: `${((cell.x + cell.w / 2) / wallWpx * 100).toFixed(3)}%`, y: `${((cell.y + cell.h / 2) / wallHpx * 100).toFixed(3)}%`,
    width: `${(cell.w / wallWpx * 100).toFixed(3)}%`, height: `${(cell.h / wallHpx * 100).toFixed(3)}%`,
    x_anchor: '50%', y_anchor: '50%',
    shadow_color: '#0000004D', shadow_blur: '1.6vmin', shadow_x: '0vmin', shadow_y: '0.5vmin',
    elements: [
      { type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: rect, fill_color: '#F8F4EB' },
      // native-aspect card → contain shows the whole photo (no crop), even border.
      applyPhotoColor({ type: 'image', source: cell.it.url, x: '50%', y: '50%', width: '92%', height: '92%', x_anchor: '50%', y_anchor: '50%', fit: 'contain' }, cell.it),
    ],
  }));

  // The wall composition, rendered in 3D. Camera drift = animate the wall's
  // in-frame position + a gentle rotation/scale so it feels like moving across
  // an angled wall (perspective gives the foreshortening).
  const BASE = 1.34;                                   // wall ~1.34× frame width
  const wallWpct = (wallWpx / W * 100) * BASE;
  const wallHpct = (wallHpx / H * 100) * BASE;
  const wallEl = {
    name: 'Wall', type: 'composition', time: cardS, duration: BODY,
    width: `${wallWpct.toFixed(2)}%`, height: `${wallHpct.toFixed(2)}%`,
    x_anchor: '50%', y_anchor: '50%',
    perspective: 1500, backface_visible: false,
    // oblique angle that eases toward the lens over the drift
    x_rotation: [{ time: 0, value: '-11°', easing: 'linear' }, { time: BODY, value: '-4°' }],
    y_rotation: [{ time: 0, value: '-22°', easing: 'linear' }, { time: BODY, value: '-7°' }],
    z_rotation: [{ time: 0, value: '2°', easing: 'linear' }, { time: BODY, value: '-1°' }],
    // Camera travels from the wall's TOP-LEFT (photo 1) to its BOTTOM-RIGHT (last
    // photo) so the wall reveals the client's images in order as it drifts.
    x: [{ time: 0, value: '66%', easing: 'linear' }, { time: BODY, value: '40%' }],
    y: [{ time: 0, value: '64%', easing: 'linear' }, { time: BODY, value: '40%' }],
    scale: [{ time: 0, value: '112%', easing: 'linear' }, { time: BODY, value: '126%' }],
    elements: [
      { type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: rect, fill_color: S.wall || '#EFE9DC' },
      ...cellEls,
    ],
  };

  const elements = [];
  elements.push({ name: 'Background', type: 'shape', track: 1, time: 0, duration: total, path: rect, width: '100%', height: '100%', fill_color: S.bg || '#ECE5D6' });
  if (includeCards) elements.push({ name: 'Opening', type: 'composition', track: 2, time: 0, duration: CARD_S, elements: card(S, { kicker: S.kicker, title, subtitle, height: H }) });
  elements.push({ ...wallEl, track: 3 });
  // soft warm grade + dreamy haze
  elements.push({ name: 'Warm', type: 'shape', track: 8, time: cardS, duration: BODY, path: rect, width: '100%', height: '100%', fill_color: S.warm || '#C9A46A', opacity: S.warmOpacity || '10%', blend_mode: 'multiply' });
  elements.push({ name: 'Haze', type: 'shape', track: 8, time: cardS, duration: BODY, path: rect, width: '100%', height: '100%', fill_color: '#FBF3E4', opacity: '10%', blend_mode: 'screen' });
  // gentle drifting light leaks (screen) across the drift
  if (assetBase) {
    const LK = ['leak1.png', 'leak3.png', 'leak2.png'];
    const nLeaks = 3;
    for (let i = 0; i < nLeaks; i++) {
      const t0 = cardS + (i + 0.3) * (BODY / (nLeaks + 0.6));
      const dur = BODY / (nLeaks + 0.6) * 1.4;
      const from = i % 2 ? 60 : 35, to = i % 2 ? 35 : 60;
      elements.push({
        name: `Leak-${i + 1}`, type: 'image', track: 9, source: `${assetBase}/overlays/${LK[i % LK.length]}`,
        time: t0, duration: dur, fit: 'cover', blend_mode: 'screen', x_anchor: '50%', y_anchor: '50%', y: '50%', width: '150%', height: '150%',
        x: [{ time: 0, value: `${from}%`, easing: 'linear' }, { time: dur, value: `${to}%` }],
        opacity: [{ time: 0, value: '0%' }, { time: dur * 0.4, value: '58%' }, { time: dur * 0.7, value: '40%' }, { time: dur, value: '0%' }],
      });
    }
  }
  if (includeCards) elements.push({ name: 'Closing', type: 'composition', track: 2, time: total - CARD_S, duration: CARD_S, elements: card(S, { kicker: null, title: title || 'THANK YOU', subtitle: 'A MAIN EVENT STUDIO PRODUCTION', height: H }) });
  if (watermarkUrl) elements.push({ name: 'Watermark', type: 'image', track: 99, source: watermarkUrl, time: 0, duration: Math.max(1, total - 0.1), width: '62%', height: '6.9%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', opacity: '42%' });
  return { output_format: 'mp4', width: W, height: H, frame_rate: 30, elements };
}

// LENGTH MODE exact-fit: after a style builds (each paces to ~the target already
// via perPhoto), scale every time/duration/keyframe-time so the whole montage
// lands exactly on totalSeconds. This absorbs each style's own overhead
// (transition overlap, whip/dwell, stacking) that a simple per-photo estimate
// can't predict. Static values (percent strings) and 'start'/'end' transition
// markers are left alone; only numeric times scale.
const KEYFRAME_PROPS = ['x', 'y', 'x_scale', 'y_scale', 'scale', 'opacity', 'z_rotation', 'x_rotation', 'y_rotation', 'width', 'height', 'blur_radius'];
function scaleMontageToLength(src, target) {
  if (!src || !Array.isArray(src.elements) || !(target > 0)) return src;
  const cur = src.elements.reduce((m, e) => Math.max(m, (e.time || 0) + (e.duration || 0)), 0);
  if (!(cur > 0)) return src;
  const f = target / cur;
  const scaleEl = (el) => {
    if (!el || typeof el !== 'object') return;
    if (typeof el.time === 'number') el.time = +(el.time * f).toFixed(3);
    if (typeof el.duration === 'number') el.duration = +(el.duration * f).toFixed(3);
    for (const k of KEYFRAME_PROPS) {
      if (Array.isArray(el[k])) el[k].forEach((kf) => { if (kf && typeof kf.time === 'number') kf.time = +(kf.time * f).toFixed(3); });
    }
    if (Array.isArray(el.animations)) el.animations.forEach((a) => {
      if (a && typeof a.duration === 'number') a.duration = +(a.duration * f).toFixed(3);
      if (a && typeof a.time === 'number') a.time = +(a.time * f).toFixed(3);
    });
    if (Array.isArray(el.elements)) el.elements.forEach(scaleEl);
  };
  src.elements.forEach(scaleEl);
  return src;
}

export function buildMontageSource({ photos, items, style = 'hollywood', title, subtitle, watermarkUrl, photoSeconds = null, totalSeconds = null, includeCards = true, width = 1920, height = 1080, background = null, greenBookends = true, assetBase = null }) {
  const base = STYLES[style] || STYLES.hollywood;
  // Unified play sequence: photos and (optional) green-screen video placeholders.
  // Back-compat: if only `photos` is passed, treat them all as photo items.
  const seq = Array.isArray(items) && items.length
    ? items
    : (photos || []).map((p) => ({ type: 'photo', url: p.url, framing: p.framing, w: p.w, h: p.h }));

  // LENGTH MODE (Josh: "I choose 100 images but want them to cycle through in 1
  // minute"). When totalSeconds is set, every style paces so the PHOTOS cycle in
  // that many seconds — per-photo time = totalSeconds / photo count (title cards,
  // if on, add their fixed few seconds on top). perPhoto is threaded into the
  // builders that otherwise use fixed pacing (walls, epic, polaroid). When it's
  // null, each style keeps its own default pace (or the seconds-per-photo value).
  const nPhotos = Math.max(1, seq.filter((it) => it.type === 'photo' || (it.type !== 'placeholder' && it.type !== 'green')).length);
  const perPhoto = (totalSeconds && Number(totalSeconds) > 0)
    ? Math.max(0.4, Math.min(12, Number(totalSeconds) / nPhotos))
    : null;
  const photoS = perPhoto != null ? perPhoto : (photoSeconds ? Math.min(10, Math.max(1, Number(photoSeconds))) : base.photoS);
  const fadeS = Math.min(base.fadeS, photoS * 0.4);
  const S = { ...base, photoS, fadeS };

  // Polaroid uses its own stacking-pile builder (prints pile up, not a
  // slideshow); every other style falls through to the per-photo loop below.
  const wrap = (src) => (greenBookends ? addGreenBookends(src, includeCards) : src);
  // In length mode, snap the finished montage to exactly totalSeconds.
  const finish = (src) => (perPhoto != null ? scaleMontageToLength(src, Number(totalSeconds)) : src);
  if (S.duotone && S.frantic) return finish(wrap(duotone2Source({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height })));
  if (S.polaroid) return finish(wrap(polaroidStackSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height, background, perPhoto })));
  if (S.collage) return finish(wrap(collageWallSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height, background, assetBase, perPhoto })));
  if (S.epic) return finish(wrap(epicVintageSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height, assetBase, perPhoto })));
  if (S.trendy) return finish(wrap(trendyWallSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height, assetBase, perPhoto })));

  // STANDARD (slideshow) styles: the green screen IS the first & last photo —
  // a full-length solid-green slot that plays for a whole photo beat and
  // transitions exactly like a photo (Josh: "imagine the first photo was just
  // solid green... the final photo solid green"). Injected into the play
  // sequence so NO client photo is lost and it inherits this style's own
  // transition. (Wall/pile styles show many photos at once — a single full-frame
  // green photo can't sit in the grid — so those get a green frame at the head
  // and tail via addGreenBookends instead.)
  const gseq = greenBookends ? [{ type: 'green' }, ...seq, { type: 'green' }] : seq;

  const durOf = (it) => (it.type === 'placeholder' ? PLACEHOLDER_S : photoS);
  const cardsTime = includeCards ? 2 * CARD_S : 0;
  const total = cardsTime + gseq.reduce((a, it) => a + durOf(it), 0) - Math.max(0, gseq.length - 1) * fadeS;

  const elements = [];

  // Persistent background behind every photo/card for the whole montage. Honours
  // the "Add background" control (green-screen default / imported image + tint);
  // with no control set it's the style colour. Without it, a Fit (contain) photo's
  // letterbox/pillar margins would reveal neighbouring photos instead of a clean
  // backdrop.
  bgLayers(background, S, { track: 1, time: 0, duration: total }).forEach((el) => elements.push(el));

  if (includeCards) {
    elements.push({
      name: 'Opening',
      type: 'composition',
      track: 2,
      duration: CARD_S,
      elements: card(S, { kicker: S.kicker, title, subtitle, height }),
    });
  }

  // Per-photo framing fix: shifts the image inside the frame. Cover-crop
  // shows the CENTER by default; moving the element down reveals more of the
  // image's TOP (keeps heads), etc.
  // The photo element is a 110% box (5% overscan each side) so a cover-crop always
  // FILLS the frame AND there's headroom to bias the crop for framing without
  // revealing the background. Shifts stay within that 5% margin.
  const FRAMING = {
    top: { y: '55%' },    // show top of photo (heads) — shifts image down 5%
    center: {},           // true centered crop (no shift)
    bottom: { y: '45%' }, // show bottom
    left: { x: '55%' },   // show left side
    right: { x: '45%' },  // show right side
  };

  let photoCount = 0;
  gseq.forEach((it, i) => {
    if (it.type === 'green') {
      // A full-length solid-green PHOTO slot: same beat + same transition as a
      // real photo, but pure broadcast chroma green the editor keys their intro/
      // outro (or a transition clip) into. The FIRST slot hard-cuts to clean
      // green so the segment opens on a pristine key frame; the tail slot
      // transitions IN from the montage like any other photo, then holds green.
      elements.push({
        name: i === 0 ? 'GreenIn' : 'GreenOut',
        type: 'composition', track: 2, duration: photoS,
        ...(i > 0 ? { animations: transitionIn(S, i) } : {}),
        elements: [
          { type: 'shape', track: 1, path: 'M 0 0 L 100 0 L 100 100 L 0 100 Z', width: '100%', height: '100%', fill_color: CHROMA_GREEN },
        ],
      });
      return;
    }
    if (it.type === 'placeholder') {
      // A chroma-green gap the editor keys their real clip into. Clean dissolve
      // in/out; the clip name shows ONLY while the green fully covers the frame.
      const holdText = Math.max(0.4, PLACEHOLDER_S - 2 * fadeS);
      const fadeT = Math.min(0.25, holdText / 3);
      elements.push({
        name: `VideoGap-${i + 1}`,
        type: 'composition',
        track: 2,
        duration: PLACEHOLDER_S,
        ...(i > 0 ? { animations: transitionIn(S, i) } : {}),
        elements: [
          { type: 'shape', track: 1, path: 'M 0 0 L 100 0 L 100 100 L 0 100 Z', width: '100%', height: '100%', fill_color: CHROMA_GREEN },
          {
            type: 'text', track: 2, time: fadeS, duration: holdText,
            text: it.name || 'VIDEO', font_family: S.font, font_weight: '700',
            font_size: `${Math.round(height * 0.05)} px`, fill_color: '#FFFFFF',
            x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', x_alignment: '50%',
            // Fade the label in/out INSIDE the full-green window so no text ever
            // sits on a transition frame (keeps the key clean).
            opacity: [
              { time: 0, value: '0%' }, { time: fadeT, value: '100%' },
              { time: Math.max(fadeT, holdText - fadeT), value: '100%' }, { time: holdText, value: '0%' },
            ],
          },
        ],
      });
      return;
    }
    const zoomIn = photoCount % 2 === 0;
    photoCount += 1;
    if (S.duotone) {
      elements.push({
        name: `Photo-${photoCount}`, type: 'composition', track: 2, duration: S.photoS,
        ...(i > 0 ? { animations: transitionIn(S, i) } : {}),
        // A green frame renders PURE full-frame green (skip the duotone tint) so
        // it stays keyable.
        elements: it.green
          ? [{ type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: 'M 0 0 L 100 0 L 100 100 L 0 100 Z', fill_color: CHROMA_GREEN }]
          : duotoneShot(S, it.url, photoCount),
      });
      return;
    }
    // ONE-AT-A-TIME styles fill the whole 16:9 frame: a single photo can't hold
    // its native shape full-screen without pillars/blur (which Josh ruled out), so
    // it always COVER-crops. Default anchor is the TOP (keep faces); the per-photo
    // framing / drag-to-position control still nudges it. `fit` is ignored here —
    // native aspect is honoured only by the tiled/print styles that can lay a
    // portrait beside a landscape.
    const sizePct = Math.min(140, Math.max(60, Number(it.size) || 100));
    const amp = Math.max(0, parseFloat(S.zoom[1]) - parseFloat(S.zoom[0])); // e.g. 12 for 100→112
    const lo = sizePct, hi = sizePct + amp;
    const from = `${(zoomIn ? lo : hi).toFixed(1)}%`;
    const to = `${(zoomIn ? hi : lo).toFixed(1)}%`;
    const photoEl = {
      type: 'image',
      source: it.url,
      fit: 'cover',
      // FILL the frame: an explicit 110% box (5% overscan) cover-cropped and
      // centered. Without an explicit width/height Creatomate drops the image in
      // at its natural pixel size in the top-left (the "photo doesn't fill / white
      // borders" bug). The overscan also gives the framing shifts room to bias the
      // crop without exposing the background.
      width: '110%',
      height: '110%',
      x: '50%',
      y: '50%',
      x_anchor: '50%',
      y_anchor: '50%',
      x_scale: [{ time: 0, value: from, easing: 'linear' }, { time: S.photoS, value: to }],
      y_scale: [{ time: 0, value: from, easing: 'linear' }, { time: S.photoS, value: to }],
    };
    if (S.pan) {
      // Party 2: a gentle diagonal drift on top of the zoom, alternating per photo.
      // Biased toward the TOP of the frame (y ≥ 53%) so the cover-crop keeps heads
      // in — the drift stays within the 110% box's 5% overscan so no bg reveals.
      const D = [['47%', '55%'], ['53%', '54%'], ['52%', '55%'], ['48%', '53%']];
      const d = D[photoCount % D.length];
      photoEl.x = [{ time: 0, value: '50%', easing: 'linear' }, { time: S.photoS, value: d[0] }];
      photoEl.y = [{ time: 0, value: '54%', easing: 'linear' }, { time: S.photoS, value: d[1] }];
    } else if (Number.isFinite(it.posX) && Number.isFinite(it.posY)) {
      // Drag-to-position focal point wins over the anchor.
      photoEl.x = `${it.posX}%`;
      photoEl.y = `${it.posY}%`;
    } else {
      // Default to the TOP so faces stay in frame on tall shots; an explicit
      // framing choice overrides.
      Object.assign(photoEl, FRAMING[it.framing] || FRAMING.top);
    }
    applyPhotoColor(photoEl, it);
    photoEl.name = `Photo-${photoCount}`;
    photoEl.track = 2;
    photoEl.duration = S.photoS;
    if (i > 0) photoEl.animations = transitionIn(S, i);
    elements.push(photoEl);
  });

  // Closing card also hard-cuts in (same replaceability rule as the opener).
  if (includeCards) {
    elements.push({
      name: 'Closing',
      type: 'composition',
      track: 2,
      duration: CARD_S,
      elements: card(S, { kicker: null, title: title || 'THANK YOU', subtitle: 'A MAIN EVENT STUDIO PRODUCTION', height }),
    });
  }

  // Deterrent watermark (Josh: "big enough to be annoying") — outlined
  // MAIN EVENT STUDIO wordmark, centered, translucent. Asset: public/watermark.png.
  if (watermarkUrl) {
    elements.push({
      name: 'Watermark',
      type: 'image',
      track: 9,
      source: watermarkUrl,
      time: 0,
      duration: Math.max(1, total - 0.1),
      // Explicit width AND height matching the PNG's aspect (2660x167 ≈ 15.9:1
      // → 62% of 1920 wide = 6.9% of 1080 tall). Width-only let Creatomate
      // cover-crop the strip into giant letters (first-render lesson).
      width: '62%',
      height: '6.9%',
      x: '50%',
      y: '50%',
      x_anchor: '50%',
      y_anchor: '50%',
      opacity: '42%',
    });
  }

  // No wrap() here — the standard path already injected green as real first/last
  // photo slots above (addGreenBookends is only for the wall/pile builders).
  return finish({
    output_format: 'mp4',
    width,
    height,
    frame_rate: 30,
    elements,
  });
}
