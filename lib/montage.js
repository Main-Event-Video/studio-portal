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
    greenDefault: true,   // default background is keyable green (plain-colour style)
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
    greenDefault: true,
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
    greenDefault: true,
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
    greenDefault: true,
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
    photoS: 2.0,
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
    photoS: 2.0,
    fadeS: 0.8,
    transitions: ['scale', 'fade', 'slide', 'fade'],
    zoom: ['100%', '104%'],
    polaroid: true,
    wholePhoto: true,
  },
  story_builder: {
    // Continuous story wall: one photo at a time lands center + pauses (a cut
    // point for editing), then joins a centered aspect-aware fan; completed rows
    // shift to alternating sides and shrink. Keyable green-screen default.
    label: 'Story Builder (one at a time, builds a story wall)',
    bg: '#00B140',
    text: '#FFFFFF',
    dim: '#CFF7DD',
    font: 'Playfair Display',
    kicker: 'MAIN EVENT STUDIO',
    photoS: 2.6,
    fadeS: 0.4,
    transitions: ['fade'],
    zoom: ['100%', '100%'],
    story: true,
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
    kicker: 'MAIN EVENT STUDIO', photoS: 1.9, fadeS: 1.1, transitions: ['fade'], zoom: ['100%', '100%'],
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
  multi_page: {
    // Green-screen collage: 3–4 photos per page in one of four aspect-adaptive
    // layouts that repeat; each photo pivots ON individually, one at a time.
    label: 'Multi Page (green screen · images pop on one by one)',
    bg: '#00B140', text: '#FFFFFF', dim: '#CFF7DD', font: 'Playfair Display',
    kicker: 'MAIN EVENT STUDIO', photoS: 2.0, fadeS: 0.5, transitions: ['fade'], zoom: ['100%', '100%'],
    multipage: true, perImage: true,
  },
  multi_page_record: {
    // Same collage, but the whole PAGE pivots off around the bottom-left hub
    // (record turn), then the next page's photos reveal one at a time.
    label: 'Multi Page Record (green screen · page pivots, then reveals)',
    bg: '#00B140', text: '#FFFFFF', dim: '#CFF7DD', font: 'Playfair Display',
    kicker: 'MAIN EVENT STUDIO', photoS: 2.0, fadeS: 0.5, transitions: ['fade'], zoom: ['100%', '100%'],
    multipage: true, perImage: false,
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
  // Built-in TEXTURE background (soft-focus / linen / gradient). Optionally drifts
  // + slow-zooms (Ken Burns) when animated. Starts at 106% so the drift never
  // reveals an edge.
  if (b.textureUrl) {
    const el = { name: 'Background', type: 'image', source: b.textureUrl, track, time, duration, x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', fit: 'cover' };
    if (b.animated) {
      el.x_scale = [{ time: 0, value: '106%', easing: 'linear' }, { time: duration, value: '116%' }];
      el.y_scale = [{ time: 0, value: '106%', easing: 'linear' }, { time: duration, value: '116%' }];
      el.x = [{ time: 0, value: '47%', easing: 'linear' }, { time: duration, value: '53%' }];
      el.y = [{ time: 0, value: '51%', easing: 'linear' }, { time: duration, value: '48%' }];
    } else { el.x_scale = '104%'; el.y_scale = '104%'; }
    const out = [base('#0b0b0e'), el];
    if (b.tint) out.push({ name: 'BgTint', type: 'shape', track, time, duration, path: rect, width: '100%', height: '100%', fill_color: b.tint, opacity: b.opacity || '35%' });
    return out;
  }
  if (b.url) {
    const out = [base(S.bg)];
    out.push({ name: 'Backdrop', type: 'image', source: b.url, track, time, duration, x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', fit: 'cover', ...(b.blur ? { blur_radius: Number(b.blur) || 18, blur_mode: 'stack' } : {}) });
    if (b.tint) out.push({ name: 'BgTint', type: 'shape', track, time, duration, path: rect, width: '100%', height: '100%', fill_color: b.tint, opacity: b.opacity || '50%' });
    return out;
  }
  // No background chosen → the style's own palette, EXCEPT the plain-colour styles
  // now default to keyable green (Josh). Styles whose look IS their background
  // (Epic, walls, Story, Duotone) keep S.bg.
  return [base(S.greenDefault ? CHROMA_GREEN : S.bg)];
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
const POL = { HOLD: 2.0, MOVE: 1.6, KEEP: 4, FADE: 0.65 }; // HOLD = default 2s beat (overridden by the per-photo / length control); MOVE = floaty toss that eases to rest
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

  // A print drops every HOLD seconds. HOLD honours the per-photo / length control
  // (S.photoS carries the effective seconds-per-photo — the editor's setting, or
  // the length-mode value, or the style default of 2s). The floaty toss (MOVE)
  // takes most of the beat so the landing stays gentle, but never exceeds it.
  const HOLD = Math.max(0.5, perPhoto != null ? perPhoto : (Number(S.photoS) || POL.HOLD));
  // The DROP takes a slice of the beat so each print visibly falls, slows, and
  // gently STOPS with a rest before the next drops. A single long ease-out (below)
  // keeps the landing soft, not abrupt.
  const MOVE = Math.min(1.4, HOLD * 0.7);
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
    // Josh: prints should PILE UP and stay — no fading away in the back. Each
    // print lives from the moment it lands to the end of the stack.
    const life = Math.max(MOVE + HOLD, stackDur - k * HOLD);

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
      // Polaroid Drop — matches the APPROVED real-polaroid preview: a SQUARE photo
      // with a thin even top/sides border (~1.4% of card width) and a moderate
      // bottom strip (~8.2%), on a card ~30% of the frame width (was 40% — too
      // big). Photo cover-crops the square window, top-biased to keep heads.
      // Real-polaroid proportions: SQUARE photo, thin even top/sides, and a THICK
      // white bottom strip (Josh: it lost the polaroid look when the bottom got
      // thin). Card taller (×1.183) so the bottom band is ~5× the top; the photo
      // stays square at any frame aspect (see width/height derivation).
      cardW = 30; cardH = cardW * (width / height) * 1.183;
      cardEls = [
        { type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: roundedRect(2.3, 1.8), fill_color: '#FCFBF7' },
        applyPhotoColor({ type: 'image', source: it.url, x: '50%', y: '2.0%', width: '97.0%', height: '82.0%', x_anchor: '50%', y_anchor: '0%', fit: 'cover' }, it),
      ];
    }
    const print = {
      name: `Print-${k + 1}`, type: 'composition', track: 4 + k, time: t,
      duration: life,
      // Drop: falls STRAIGHT DOWN (no sideways drift/bounce \u2014 Josh), decelerating on
      // a long ease-out so it lands SOFTLY. The delicate part is the TWIST: it enters
      // over-tilted (same direction) and untwists into its resting tilt, with the
      // last few degrees finishing just AFTER it lands (rotation runs to MOVE\u00D71.22),
      // so the settle reads as a gentle twist-into-place. No horizontal drift.
      x: `${settleX.toFixed(1)}%`,
      y: [{ time: 0, value: '-120%', easing: 'ease-out' }, { time: MOVE, value: `${settleY.toFixed(1)}%` }],
      x_scale: [{ time: 0, value: '106%', easing: 'ease-out' }, { time: MOVE, value: '100%' }],
      y_scale: [{ time: 0, value: '106%', easing: 'ease-out' }, { time: MOVE, value: '100%' }],
      x_anchor: '50%', y_anchor: '50%', width: `${cardW.toFixed(1)}%`, height: `${cardH.toFixed(1)}%`,
      z_rotation: [{ time: 0, value: `${(rTilt + (rTilt >= 0 ? 11 : -11)).toFixed(1)}\u00B0`, easing: 'ease-out' }, { time: MOVE * 1.22, value: `${rTilt.toFixed(1)}\u00B0` }],
      // Soft, larger drop shadow so the print doesn't read as a hard cut-out.
      shadow_color: '#000000', shadow_blur: '8vmin', shadow_x: '0vmin', shadow_y: '3vmin',
      elements: cardEls,
    };
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
    return applyPhotoColor({ type: 'image', source: c.it.url, x: cx, y: `${(c.y / wallHpx * 100).toFixed(3)}%`, width: cw, height: ch, x_anchor: '50%', y_anchor: '0%', fit: 'cover' }, c.it); // top-anchored — crops the bottom, keeps heads
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
  // EXACT timing from the approved mockup (epic-preview.html) — "fast then slow
  // then fast": a QUICK hard-cut-in that decelerates (0→0.175), a long SLOW glide
  // to view (0.175→0.488, linear), then ACCELERATE off (0.488→1). Offsets, scales,
  // rotation and drift all copied from the mockup so the speed matches.
  const OFF   = [0, 0.175, 0.488, 0.722, 0.878, 1];
  const SC     = [280, 106, 100, 55, 30, 14];
  const ROT    = [-6, 0, 1, 30, 48, 64];                 // ×dir
  const TX     = [0, 0, 1, 24, 54, 78];                  // ×dir
  const TY     = [0, 0, -1, -12, -24, -34];              // fixed (up)
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

    // MOCKUP background = big overlapping FADED WHITE-FRAMED prints of the same
    // photo (you can make out the frames), softly blurred + desaturated, with a
    // SOFT (not hard) drop shadow. All six spots (4 big covering + 2 small edge
    // prints) like epic-preview.html.
    const bgPrints = SPOTS.map((s) => {
      const bpH = s.w * WH / A;                              // native-aspect height (%, of frame)
      const cx = s.l + s.w / 2, cy = s.t + bpH / 2;          // center (CSS rotates about center)
      return {
        type: 'composition', x: `${cx.toFixed(1)}%`, y: `${cy.toFixed(1)}%`,
        width: `${s.w}%`, height: `${bpH.toFixed(1)}%`, x_anchor: '50%', y_anchor: '50%',
        z_rotation: `${s.r}°`, shadow_color: '#0000003A', shadow_blur: '3.4vmin', shadow_x: '0vmin', shadow_y: '0.6vmin',
        elements: [
          { type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: rect, fill_color: '#EDE6D6' },
          // faded print: desaturated + softly blurred (the mockup's grayscale .76 /
          // brightness .82 / blur look). Thin even white mat around it.
          { type: 'image', source: it.url, x: '50%', y: '50%', width: '97.4%', height: '97.4%', x_anchor: '50%', y_anchor: '50%', fit: 'cover', color_filter: 'grayscale', color_filter_value: '66%', blur_radius: 14.4, blur_mode: 'stack' },
          { type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: rect, fill_color: '#241708', blend_mode: 'multiply', opacity: '20%' },
        ],
      };
    });

    // sharp HERO print — fit inside a 62%h × 66%w box at native aspect (big, like
    // the approved preview where the hero fills most of the frame).
    let printH = 62, printW = 62 * A * (H / W);
    if (printW > 66) { printW = 66; printH = 66 * (W / H) / A; }
    const heroWrap = {
      type: 'composition', width: `${printW.toFixed(1)}%`, height: `${printH.toFixed(1)}%`, x_anchor: '50%', y_anchor: '50%', x: '50%', y: '50%',
      // Mockup hero: rides on the scene, growing 100→117 with a slight spin over
      // the whole beat so the slow "view" still breathes (matches epic-preview).
      x_scale: [{ time: 0, value: '100%', easing: 'linear' }, { time: D, value: '117%' }],
      y_scale: [{ time: 0, value: '100%', easing: 'linear' }, { time: D, value: '117%' }],
      z_rotation: [{ time: 0, value: '0°', easing: 'linear' }, { time: D, value: `${(dir * 5).toFixed(1)}°` }],
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
        { type: 'image', source: it.url, x: '50%', y: '50%', width: '128%', height: '128%', x_anchor: '50%', y_anchor: '50%', fit: 'cover', color_filter: 'sepia', color_filter_value: '70%', blur_radius: 38.4, blur_mode: 'stack', opacity: '100%' },
        { type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: rect, fill_color: '#221606', blend_mode: 'multiply', opacity: '16%' },
        ...bgPrints,
        heroWrap,
      ],
    });
  });

  // --- persistent grade (warm multiply + faint cream lift) --------------------
  // (Removed the drifting amber circle "glows" — they read as floaty orbs.)
  elements.push({ name: 'Warm', type: 'shape', track: 8, time: stackStart, duration: bodyDur, path: rect, width: '100%', height: '100%', fill_color: S.warm || '#C9865A', opacity: S.warmOpacity || '20%', blend_mode: 'multiply' });
  elements.push({ name: 'Lift', type: 'shape', track: 8, time: stackStart, duration: bodyDur, path: rect, width: '100%', height: '100%', fill_color: '#F3D9B4', opacity: '3%', blend_mode: 'screen' });

  // floating dust (existing overlay assets), screen, slow parallax drift
  if (assetBase) {
    [['dust1.png', 46, 48, 52], ['dust2.png', 36, 52, 47]].forEach(([d, op, x0, y0], k) => {
      elements.push({
        name: `Dust-${k + 1}`, type: 'image', track: 9, source: `${assetBase}/overlays/${d}`,
        time: stackStart, duration: bodyDur, fit: 'cover', blend_mode: 'screen',
        x_anchor: '50%', y_anchor: '50%', width: '120%', height: '120%', opacity: `${op}%`,
        x: [{ time: 0, value: `${x0}%`, easing: 'linear' }, { time: bodyDur, value: `${100 - x0}%` }],
        y: [{ time: 0, value: `${y0}%`, easing: 'linear' }, { time: bodyDur, value: `${100 - y0}%` }],
      });
    });
  }

  // --- BIG BRIGHT light leak on every cut (Josh: "bring the light to a higher
  // level"). A warm RADIAL BURST (cream→amber→orange→transparent, the mockup's
  // .bloom) blows in from a FRAME CORNER at full-bright on the hard cut, plus a
  // sweeping edge-bleed, a hot streak, and a gentle full-frame warm lift. Cycles
  // corners. Bright and impressive, but radial so the hero stays visible (not a
  // flat white-out).
  for (let k = 1; k < n; k++) {
    const tc = stackStart + k * BEAT;                        // the hard cut into pile k
    const t0 = Math.max(0, tc - RAMP);
    const dur = RAMP + FADE;
    const c = CORNERS[(k - 1) % CORNERS.length];
    const d2 = k % 2 ? 1 : -1;
    const ramp = (peak) => [{ time: 0, value: '0%' }, { time: +(PK * dur).toFixed(3), value: `${peak}%`, easing: 'ease-in' }, { time: dur, value: '0%' }];
    // gentle full-frame warm lift (whole frame warms a touch — not a white flash)
    elements.push({ name: `Leak-lift-${k}`, type: 'shape', track: 18, time: t0, duration: dur, path: rect, width: '100%', height: '100%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', fill_color: '#FFE0A8', blend_mode: 'screen', blur_radius: 8, blur_mode: 'stack', opacity: ramp(22) });
    if (assetBase) {
      // BRIGHT warm radial burst emanating from the corner (kept square so the
      // radial stays circular: 178% of height ≈ 100% of width in px)
      elements.push({
        name: `Leak-burst-${k}`, type: 'image', track: 20, source: `${assetBase}/overlays/leak_burst.png`,
        time: t0, duration: dur, blend_mode: 'screen', x: `${c.x}%`, y: `${c.y}%`, x_anchor: '50%', y_anchor: '50%',
        width: '100%', height: '178%', fit: 'cover', opacity: ramp(100),
      });
      // sweeping directional edge-bleed underneath, for organic streaking
      const EP = ['leak_epic1.png', 'leak_epic2.png', 'leak_epic3.png'];
      elements.push({
        name: `Leak-edge-${k}`, type: 'image', track: 19, source: `${assetBase}/overlays/${EP[(k - 1) % EP.length]}`,
        time: t0, duration: dur, fit: 'cover', blend_mode: 'screen', x_anchor: '50%', y_anchor: '50%', y: '50%', width: '150%', height: '150%',
        x: [{ time: 0, value: `${(50 + d2 * 12).toFixed(1)}%`, easing: 'linear' }, { time: dur, value: `${(50 - d2 * 6).toFixed(1)}%` }],
        opacity: ramp(78),
      });
    }
    // hot light streak across the corner's row
    elements.push({ name: `Leak-streak-${k}`, type: 'shape', track: 21, time: t0, duration: dur, path: rect, width: '150%', height: '2.4%', x: '50%', y: `${c.y}%`, x_anchor: '50%', y_anchor: '50%', fill_color: '#FFF3D6', blend_mode: 'screen', blur_radius: 7, blur_mode: 'stack', opacity: ramp(90) });
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
// ---- Story Builder — continuous story wall (faithful port of the locked preview
// story-builder-APPROVED.html). Each photo LANDS center (~60%, a cut point), then
// the row RE-FANS (all its cards shrink to a centered, aspect-aware fan that fills
// the frame width — verticals hang over a landscape's right edge). When a row
// fills, it's pushed to ONE side (alternating up/down); only that side shifts and
// its outer rows shrink, so nothing ever leaves the frame. Keyable GREEN-SCREEN
// default background (+ optional Add-background image/tint). The choreography is a
// deterministic simulation of the preview's JS, recorded to keyframes.
function storyBuilderSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width: W, height: H, background, perPhoto = null }) {
  const rect = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
  const cardPath = roundedRect(2.2, 2.2);
  const photos = seq.filter((s) => s.type !== 'placeholder');
  const n = photos.length;
  const cardS = includeCards ? CARD_S : 0;
  const stackStart = cardS;

  // Preview constants (ms → s). A slower pace stretches the per-photo beat.
  const paceK = perPhoto != null ? Math.max(0.5, perPhoto) / 2.59 : 1; // preview beat ≈ 2.59s
  const LAND = 1.25 * paceK, MOVE = 0.78 * paceK, HOLD = 0.56 * paceK, ROWGAP = 1.0 * paceK, RELAY = 0.95 * paceK;
  const tiltStep = 3.0, TARGET = 0.86, MAXPR = 14, SHR = 0.86;
  const sw = W, sh = H;
  const aspOf = (it) => (it.w > 0 && it.h > 0) ? it.w / it.h : 1.5;
  const isVert = (it) => aspOf(it) < 0.85;
  const landWpx = (it) => Math.min(0.672 * sh * aspOf(it), 0.72 * sw);
  const halfW = (it) => landWpx(it) * 0.25;

  // per-card record: waypoints of {t, dx, dy, sc, tl}
  const cards = photos.map((it) => ({ it, wp: [], dx: 0, dy: 0, sc: 1, tl: 0, dx0: 0, landStart: 0 }));
  const push = (c, t, dx, dy, sc, tl) => c.wp.push({ t, dx, dy, sc, tl });
  let current = [], up = [], down = [], toggle = false;

  function layoutCurrent(atT) {
    const k = current.length;
    const hw = current.map((c) => halfW(c.it));
    const cx = [0];
    for (let j = 1; j < k; j++) {
      const pv = isVert(current[j - 1].it), cv = isVert(current[j].it);
      let step;
      if (pv) step = hw[j] + 0.32 * hw[j - 1];
      else if (cv) step = hw[j - 1] + 0.25 * hw[j];
      else step = hw[j];
      cx.push(cx[j - 1] + Math.max(step, 0.42 * hw[j]));
    }
    const left = cx[0] - hw[0], right = cx[k - 1] + hw[k - 1], mid = (left + right) / 2, span = right - left;
    current.forEach((c, j) => {
      const dx = cx[j] - mid, tl = (j - (k - 1) / 2) * tiltStep;
      push(c, atT, c.dx, c.dy, c.sc, c.tl);          // hold at current state until the move starts
      push(c, atT + MOVE, dx, 0, 0.5, tl);           // move into the centered fan
      c.dx = dx; c.dy = 0; c.sc = 0.5; c.tl = tl;
    });
    return span / sw;
  }
  // BOUNDED 3-row collage (the shorter version, not the infinite scroll): a
  // completed row moves to a fixed slot — 1st → TOP, 2nd → BOTTOM, 3rd → stays
  // MIDDLE. Once 3 rows fill the frame it's a finished collage; if more photos
  // remain it holds, fades out, and a fresh 3-row page builds.
  const SLOTS = [
    { dy: -0.31 * sh, sc: 0.42 },   // 1st completed row → TOP (shrinks a touch)
    { dy: 0.31 * sh, sc: 0.42 },    // 2nd → BOTTOM
    { dy: 0, sc: 0.50 },            // 3rd → stays centred (the focal middle row)
  ];
  const PAGEHOLD = 1.2, FADE = 0.6;
  function moveRowTo(rc, atT, slot) {
    const f = slot.sc / 0.5;
    rc.forEach((c) => {
      const ndx = c.dx * f;
      push(c, atT, c.dx, c.dy, c.sc, c.tl);
      push(c, atT + RELAY, ndx, slot.dy, slot.sc, c.tl);
      c.dx = ndx; c.dy = slot.dy; c.sc = slot.sc;
    });
  }

  // ---- run the choreography, recording every waypoint ----
  let t = stackStart, idx = 0, pageRows = 0, pageCards = [];
  while (idx < n) {
    const c = cards[idx];
    c.landStart = t;
    push(c, t, 0, 0, 0.92, 0);                        // land: small→full at center
    push(c, t + 0.34 * LAND, 0, 0, 1, 0);
    current.push(c);
    const afterLandT = t + LAND;
    const frac = layoutCurrent(afterLandT);
    const decideT = afterLandT + MOVE + HOLD;
    const rowFull = frac >= TARGET || current.length >= MAXPR;
    const lastPhoto = idx === n - 1;
    if (rowFull || lastPhoto) {
      moveRowTo(current, decideT, SLOTS[Math.min(pageRows, 2)]);
      pageCards.push(...current);
      current = [];
      pageRows += 1;
      t = decideT + RELAY + ROWGAP;
      if (pageRows === 3 && !lastPhoto) {
        // finished 3-row collage — hold to view, fade out, then a fresh page
        const holdEnd = t + PAGEHOLD;
        pageCards.forEach((pc) => { pc.fadeOut = holdEnd; });
        pageCards = []; pageRows = 0;
        t = holdEnd + FADE + 0.2;
      }
    } else {
      t = decideT;
    }
    idx += 1;
  }
  const bodyEnd = cards.reduce((m, c) => Math.max(m, c.wp.length ? c.wp[c.wp.length - 1].t : 0), stackStart) + 0.6;
  const total = bodyEnd + cardS; // trailing card, if any

  const elements = [];
  // Keyable green-screen background by default; an imported image (tint/opacity)
  // replaces it. Story default = green so Josh can key it.
  const bg = (background && (background.url || background.green)) ? background : { green: true };
  bgLayers(bg, S, { track: 1, time: 0, duration: total }).forEach((el) => elements.push(el));
  if (includeCards) elements.push({ name: 'Opening', type: 'composition', track: 2, time: 0, duration: CARD_S, elements: card(S, { kicker: S.kicker, title, subtitle, height: H }) });

  // one composition per card, keyframed through its recorded trajectory
  cards.forEach((c, i) => {
    const it = c.it;
    const lw = landWpx(it);
    const cardWpct = lw / sw * 100;
    const cardHpct = (lw / aspOf(it)) / sh * 100;
    const rel = (v) => +(v - c.landStart).toFixed(3);
    const xk = c.wp.map((w) => ({ time: rel(w.t), value: `${(50 + w.dx / sw * 100).toFixed(2)}%`, easing: 'quadratic-out' }));
    const yk = c.wp.map((w) => ({ time: rel(w.t), value: `${(50 + w.dy / sh * 100).toFixed(2)}%`, easing: 'quadratic-out' }));
    const sk = c.wp.map((w) => ({ time: rel(w.t), value: `${(w.sc * 100).toFixed(2)}%`, easing: 'quadratic-out' }));
    const rk = c.wp.map((w) => ({ time: rel(w.t), value: `${w.tl.toFixed(2)}°`, easing: 'quadratic-out' }));
    const op = [{ time: 0, value: '0%' }, { time: +(0.34 * LAND).toFixed(3), value: '100%' }];
    if (c.fadeOut != null) { op.push({ time: rel(c.fadeOut), value: '100%' }); op.push({ time: rel(c.fadeOut + FADE), value: '0%' }); }
    elements.push({
      name: `Story-${i + 1}`, type: 'composition', track: 10 + i, time: c.landStart, duration: +(total - c.landStart).toFixed(3),
      width: `${cardWpct.toFixed(2)}%`, height: `${cardHpct.toFixed(2)}%`, x_anchor: '50%', y_anchor: '50%',
      x: xk, y: yk, x_scale: sk, y_scale: sk, z_rotation: rk,
      opacity: op,
      shadow_color: '#00000066', shadow_blur: '2vmin', shadow_x: '0vmin', shadow_y: '0.8vmin',
      elements: [
        // NO white framing (Josh): the photo IS the card, edge-to-edge at its
        // native aspect. The card composition is already sized to the photo's real
        // aspect (from the probed w/h), so 'cover' fills it with no crop and no
        // letterbox — 9:16 verticals stay tall, landscapes stay wide.
        applyPhotoColor({ type: 'image', source: it.url, x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', fit: 'cover' }, it),
      ],
    });
  });

  if (includeCards) elements.push({ name: 'Closing', type: 'composition', track: 3, time: total - CARD_S, duration: CARD_S, elements: card(S, { kicker: null, title: title || 'THANK YOU', subtitle: 'A MAIN EVENT STUDIO PRODUCTION', height: H }) });
  if (watermarkUrl) elements.push({ name: 'Watermark', type: 'image', track: 99, source: watermarkUrl, time: 0, duration: Math.max(1, total - 0.1), width: '62%', height: '6.9%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', opacity: '42%' });
  return { output_format: 'mp4', width: W, height: H, frame_rate: 30, elements };
}

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

// ============================================================================
// MULTI PAGE / MULTI PAGE RECORD
// Green-screen collage. Photos are grouped 4,3,4,3… per page; each page picks
// one of four layouts by the orientation of its photos (aspect-adaptive) and
// cover-crops each photo into its cell. Two motion variants (S.perImage):
//   • Multi Page (perImage:true):  each photo pivots ON around its own
//     bottom-left corner, one at a time (staggered). Whole page fades out.
//   • Multi Page Record (false):   photos reveal in place (scale+fade, one at a
//     time); then the WHOLE page pivots OFF around the frame's bottom-left hub
//     before the next page reveals. Only one page's photos are on screen at once.
// The green background is static (keys clean); only the photos move.
// ============================================================================
function mpTemplate(g) {
  const n = g.length;
  const nP = g.filter((x) => x.ar === 'p').length, nL = g.filter((x) => x.ar === 'l').length;
  const portrait = nP >= nL;
  if (n >= 4) return portrait
    ? { n: 4, cols: [1.35, 1], rows: [1, 1, 1], areas: [['a', 'b'], ['a', 'c'], ['a', 'd']] }   // Feature Left
    : { n: 4, cols: [1.5, 1], rows: [1, 1.5], areas: [['a', 'b'], ['c', 'd']] };                 // Uneven Quad
  if (n === 3) return portrait
    ? { n: 3, cols: [1, 1.9, 1], rows: [1], areas: [['a', 'b', 'c']] }                           // Triptych Hero
    : { n: 3, cols: [1, 1], rows: [1.5, 1], areas: [['a', 'a'], ['b', 'c']] };                   // Banner Pair
  if (n === 2) return { n: 2, cols: [1, 1], rows: [1], areas: [['a', 'b']] };
  return { n: 1, cols: [1], rows: [1], areas: [['a']] };
}
// Solve a fractional grid into cell rects (% of frame; x,y = top-left corner).
function mpCells(tpl, padX, padY, gapX, gapY) {
  const { cols, rows } = tpl;
  const cW = 100 - 2 * padX - (cols.length - 1) * gapX;
  const cH = 100 - 2 * padY - (rows.length - 1) * gapY;
  const cSum = cols.reduce((a, b) => a + b, 0), rSum = rows.reduce((a, b) => a + b, 0);
  const colW = cols.map((f) => cW * f / cSum), rowH = rows.map((f) => cH * f / rSum);
  const colX = []; { let x = padX; for (let i = 0; i < cols.length; i++) { colX.push(x); x += colW[i] + gapX; } }
  const rowY = []; { let y = padY; for (let i = 0; i < rows.length; i++) { rowY.push(y); y += rowH[i] + gapY; } }
  const span = {};
  tpl.areas.forEach((rowArr, r) => rowArr.forEach((k, c) => {
    const s = span[k] || (span[k] = { c0: c, c1: c, r0: r, r1: r });
    s.c0 = Math.min(s.c0, c); s.c1 = Math.max(s.c1, c); s.r0 = Math.min(s.r0, r); s.r1 = Math.max(s.r1, r);
  }));
  const out = {};
  for (const k in span) {
    const s = span[k];
    const x = colX[s.c0], y = rowY[s.r0];
    const w = colW.slice(s.c0, s.c1 + 1).reduce((a, b) => a + b, 0) + (s.c1 - s.c0) * gapX;
    const h = rowH.slice(s.r0, s.r1 + 1).reduce((a, b) => a + b, 0) + (s.r1 - s.r0) * gapY;
    out[k] = { x, y, w, h };
  }
  return out;
}
// The motions Creatomate can do faithfully (2D only — no true 3D flip).
const MP_MOTIONS = ['record-fwd', 'record-back', 'slide-left', 'slide-right', 'slide-up', 'slide-down'];
function mpPickMotion(transition, i) {
  if (transition === 'random') return MP_MOTIONS[(i * 2654435761 >>> 0) % MP_MOTIONS.length]; // deterministic per page
  return MP_MOTIONS.includes(transition) ? transition : 'record-fwd';
}
// Per-IMAGE entrance (Multi Page): the cell starts off-pose and animates to rest,
// staggered. Returns the composition wrapping the photo.
function mpPhotoEnter(motion, c, st, MOVE, FADE, inner) {
  const op = [{ time: 0, value: '0%' }, { time: st, value: '0%' }, { time: st + FADE * 0.7, value: '100%' }];
  const base = { type: 'composition', clip: true, width: `${c.w.toFixed(2)}%`, height: `${c.h.toFixed(2)}%`, opacity: op, elements: [inner] };
  if (motion === 'record-fwd')
    return { ...base, x: `${c.x.toFixed(2)}%`, y: `${(c.y + c.h).toFixed(2)}%`, x_anchor: '0%', y_anchor: '100%',
      z_rotation: [{ time: 0, value: '-88°' }, { time: st, value: '-88°', easing: 'quadratic-out' }, { time: st + MOVE, value: '0°' }] };
  if (motion === 'record-back')
    return { ...base, x: `${(c.x + c.w).toFixed(2)}%`, y: `${(c.y + c.h).toFixed(2)}%`, x_anchor: '100%', y_anchor: '100%',
      z_rotation: [{ time: 0, value: '88°' }, { time: st, value: '88°', easing: 'quadratic-out' }, { time: st + MOVE, value: '0°' }] };
  const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
  const ax = (motion === 'slide-left' || motion === 'slide-right') ? 'x' : 'y';
  const rest = ax === 'x' ? cx : cy;
  const from = motion === 'slide-left' ? cx + 75 : motion === 'slide-right' ? cx - 75 : motion === 'slide-up' ? cy + 75 : cy - 75;
  const el = { ...base, x: `${cx.toFixed(2)}%`, y: `${cy.toFixed(2)}%`, x_anchor: '50%', y_anchor: '50%' };
  el[ax] = [{ time: 0, value: `${from.toFixed(2)}%` }, { time: st, value: `${from.toFixed(2)}%`, easing: 'quadratic-out' }, { time: st + MOVE, value: `${rest.toFixed(2)}%` }];
  return el;
}
// Page-level EXIT (Multi Page Record): the whole page leaves via the motion.
function mpApplyExit(pageComp, motion, exit, pageDur) {
  pageComp.opacity = [{ time: 0, value: '100%' }, { time: pageDur - 0.08, value: '100%' }, { time: pageDur, value: '0%' }];
  if (motion === 'record-fwd') { pageComp.x = '0%'; pageComp.y = '100%'; pageComp.x_anchor = '0%'; pageComp.y_anchor = '100%';
    pageComp.z_rotation = [{ time: 0, value: '0°' }, { time: exit, value: '0°', easing: 'quadratic-in' }, { time: pageDur, value: '92°' }]; return; }
  if (motion === 'record-back') { pageComp.x = '100%'; pageComp.y = '100%'; pageComp.x_anchor = '100%'; pageComp.y_anchor = '100%';
    pageComp.z_rotation = [{ time: 0, value: '0°' }, { time: exit, value: '0°', easing: 'quadratic-in' }, { time: pageDur, value: '-92°' }]; return; }
  pageComp.x = '50%'; pageComp.y = '50%'; pageComp.x_anchor = '50%'; pageComp.y_anchor = '50%';
  const ax = (motion === 'slide-left' || motion === 'slide-right') ? 'x' : 'y';
  const to = motion === 'slide-left' ? '-62%' : motion === 'slide-right' ? '162%' : motion === 'slide-up' ? '-62%' : '162%';
  pageComp[ax] = [{ time: 0, value: '50%' }, { time: exit, value: '50%', easing: 'quadratic-in' }, { time: pageDur, value: to }];
}
function multiPageSource({ S, seq, watermarkUrl, width, height, mp = {} }) {
  const rect = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
  const AREA = ['a', 'b', 'c', 'd'];
  const per = !!S.perImage;
  const transition = mp.transition || 'record-fwd';
  const photos = seq.filter((it) => it.type !== 'placeholder' && it.url);
  photos.forEach((p) => { const A = (p.w > 0 && p.h > 0) ? p.w / p.h : 1; p.ar = A < 0.9 ? 'p' : A > 1.2 ? 'l' : 's'; });

  // Head-safe cell fill: display the photo at (a touch over) the cell WIDTH,
  // aspect-preserved, and TOP-anchor it inside the clipping cell so any crop
  // falls off the BOTTOM (feet) — never the top (heads). Height is derived from
  // the photo's REAL aspect so 'cover' can't center-crop the head away first.
  // The cell composition is clipped (clip:true below). The trick to never cut a
  // head: size the image element to the photo's TRUE aspect so 'cover' has NOTHING
  // to center-crop (Creatomate's 'cover' center-crops any aspect mismatch, ignoring
  // the anchor — that was the old head-cutter), then let the CLIP trim the overflow.
  //   • photo taller than the cell → fill full width, TOP-anchor, clip trims the
  //     BOTTOM (feet) → heads always kept.
  //   • photo wider than the cell → fill full height, CENTER, clip trims the SIDES
  //     evenly → a face in the middle of a landscape is never cut vertically.
  const headSafe = (it, c) => {
    const ar = (it.w > 0 && it.h > 0) ? it.w / it.h : 1.5;   // photo width/height
    const cellWpx = (c.w / 100) * width;                     // EXACT cell width → gaps between cells preserved
    const cellHpx = (c.h / 100) * height;
    const cellAr = cellHpx > 0 ? cellWpx / cellHpx : 1;
    if (ar <= cellAr) {
      // taller-than-cell: full width, real proportional height (uncapped so the
      // element matches the photo → no center-crop), top-anchored, clip the bottom.
      const hPct = cellHpx > 0 ? (cellWpx / ar) / cellHpx * 100 : 100;
      return { x: '50%', y: '0%', x_anchor: '50%', y_anchor: '0%', width: '100%', height: `${Math.max(100, hPct).toFixed(1)}%`, fit: 'cover' };
    }
    // wider-than-cell: full height, real proportional width, centered, clip sides.
    const wPct = cellWpx > 0 ? (cellHpx * ar) / cellWpx * 100 : 100;
    return { x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', width: `${Math.max(100, wPct).toFixed(1)}%`, height: '100%', fit: 'cover' };
  };

  // group into pages of 4,3,4,3 …; the tail page takes whatever is left (1–4)
  const pagesArr = []; const sizes = [4, 3, 4, 3]; let gi = 0, si = 0;
  while (gi < photos.length) { const w = sizes[si % sizes.length]; const g = photos.slice(gi, gi + w); pagesArr.push(g); gi += g.length; si++; }
  if (!pagesArr.length) return { output_format: 'mp4', width, height, frame_rate: 30, elements: [{ type: 'shape', track: 1, time: 0, duration: 2, path: rect, width: '100%', height: '100%', fill_color: S.bg }] };

  // even pixel padding / gaps (vertical % scaled so margins match horizontally)
  const padX = 2.8, padY = padX * (width / height);
  const gapX = 1.4, gapY = gapX * (width / height);
  // rhythm (overridable from the style options): STAG = gap between images,
  // HOLD = how long a full page sits, MOVE = per-transition duration.
  const STAG = Math.max(0.06, Number(mp.stagger) || 0.24);
  const HOLD = Math.max(0.3, Number(mp.hold) || 1.3);
  const MOVE = Math.max(0.25, Number(mp.speed) || 0.72);
  const FADE = 0.5;

  const elements = [];
  const bg = { name: 'Background', type: 'shape', track: 1, time: 0, duration: 1, path: rect, width: '100%', height: '100%', fill_color: S.bg };
  elements.push(bg);

  let t = 0, toggle = 0;
  pagesArr.forEach((group, pi) => {
    const motion = mpPickMotion(transition, pi);
    const tpl = mpTemplate(group);
    const cells = mpCells(tpl, padX, padY, gapX, gapY);
    const keys = AREA.slice(0, tpl.n);
    const n = keys.length;
    const revealDur = (n - 1) * STAG + (per ? MOVE : FADE);
    const pageDur = per ? (revealDur + HOLD + 0.3) : (revealDur + HOLD + MOVE);
    const photoEls = [];
    keys.forEach((k, idx) => {
      const it = group[idx]; if (!it) return;
      const c = cells[k]; const st = idx * STAG;
      if (per) {
        // each image transitions ON via the chosen motion, one at a time
        const inner = applyPhotoColor({ type: 'image', source: it.url, ...headSafe(it, c) }, it); // fill cell width, aspect-preserved, top-anchored → crop falls off the bottom, keeps heads
        photoEls.push(mpPhotoEnter(motion, c, st, MOVE, FADE, inner));
      } else {
        // reveal in place: scale + fade, staggered (motion is applied to the page EXIT)
        // Clipping cell composition: the overscan photo inside is top-anchored so
        // 'cover' crops the BOTTOM (keeps heads); the reveal pop rides the comp.
        photoEls.push({
          type: 'composition', clip: true,
          x: `${(c.x + c.w / 2).toFixed(2)}%`, y: `${(c.y + c.h / 2).toFixed(2)}%`, width: `${c.w.toFixed(2)}%`, height: `${c.h.toFixed(2)}%`,
          x_anchor: '50%', y_anchor: '50%',
          opacity: [{ time: 0, value: '0%' }, { time: st, value: '0%' }, { time: st + FADE * 0.7, value: '100%' }],
          x_scale: [{ time: 0, value: '92%' }, { time: st, value: '92%', easing: 'quadratic-out' }, { time: st + FADE, value: '100%' }],
          y_scale: [{ time: 0, value: '92%' }, { time: st, value: '92%', easing: 'quadratic-out' }, { time: st + FADE, value: '100%' }],
          elements: [applyPhotoColor({ type: 'image', source: it.url, ...headSafe(it, c) }, it)],
        });
      }
    });
    const pageComp = {
      name: `Page-${pi + 1}`, type: 'composition', track: 2 + toggle, time: t, duration: pageDur,
      width: '100%', height: '100%', elements: photoEls,
    };
    if (per) {
      // whole page fades out at the very end so the next page enters clean
      pageComp.x = '50%'; pageComp.y = '50%'; pageComp.x_anchor = '50%'; pageComp.y_anchor = '50%';
      pageComp.opacity = [{ time: 0, value: '100%' }, { time: pageDur - 0.3, value: '100%' }, { time: pageDur, value: '0%' }];
      t += pageDur - 0.25;                       // slight crossfade overlap
    } else {
      // the WHOLE page leaves via the chosen motion, then the next page reveals
      mpApplyExit(pageComp, motion, revealDur + HOLD, pageDur);
      t += pageDur;                              // sequential (page exits, then next reveals)
    }
    elements.push(pageComp);
    toggle ^= 1;
  });

  const total = t + 0.3;
  bg.duration = total;
  if (watermarkUrl) elements.push({ name: 'Watermark', type: 'image', track: 99, source: watermarkUrl, time: 0, duration: Math.max(1, total - 0.1), width: '62%', height: '6.9%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', opacity: '42%' });
  return { output_format: 'mp4', width, height, frame_rate: 30, elements };
}

export function buildMontageSource({ photos, items, style = 'hollywood', title, subtitle, watermarkUrl, photoSeconds = null, totalSeconds = null, includeCards = true, width = 1920, height = 1080, background = null, greenBookends = true, assetBase = null, mpTransition = null, mpStagger = null, mpHold = null, mpSpeed = null }) {
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
  if (S.multipage) return multiPageSource({ S, seq, watermarkUrl, width, height, mp: { transition: mpTransition, stagger: mpStagger, hold: mpHold, speed: mpSpeed } });
  if (S.polaroid) return finish(wrap(polaroidStackSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height, background, perPhoto })));
  if (S.collage) return finish(wrap(collageWallSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height, background, assetBase, perPhoto })));
  if (S.epic) return finish(wrap(epicVintageSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height, assetBase, perPhoto })));
  if (S.story) return finish(wrap(storyBuilderSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height, background, perPhoto })));
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
    // FIT vs FILL, per the photo's editor setting (explicit Fit/Fill always wins):
    //  • FIT  → the WHOLE photo, native aspect, centred and letterboxed on the
    //    style's background palette (Josh: "retain their frame and fit on the
    //    palette"). Nothing is ever cropped. Only a very gentle zoom.
    //  • FILL → cover-crops to fill the frame (110% box + framing / drag / pan).
    // When the photo has NO explicit setting, the style default applies: Party 2
    // (S.pan) is a MOVEMENT style and fills+drifts by default; every other
    // one-at-a-time style fits by default. An explicit Fit ALWAYS shows the whole
    // photo — even in Party 2 (Josh: a 9:16 set to Fit must not crop top/bottom).
    const eff = (it.fit === 'fill' || it.fit === 'fit') ? it.fit : (S.pan ? 'fill' : 'fit');
    let photoEl;
    if (S.pan && eff === 'fill') {
      // PARTY 2: cover-fill with a push/pull, biased by the photo's framing so the
      // drift keeps the chosen edge in view. TOP (default) pins the top (keep
      // faces); BOTTOM pins the bottom (Josh: "make the drift go to the bottom");
      // CENTER keeps it centred. The element is taller than the frame so the zoom
      // grows off-frame, and a gentle horizontal drift adds energy.
      const lo = sizePct, hi = sizePct + amp;
      const from = `${(zoomIn ? lo : hi).toFixed(1)}%`, to = `${(zoomIn ? hi : lo).toFixed(1)}%`;
      const DX = ['47%', '53%', '52%', '48%'];
      const fr = it.framing === 'bottom' ? 'bottom' : it.framing === 'center' ? 'center' : 'top';
      const yA = fr === 'bottom' ? '100%' : fr === 'center' ? '50%' : '0%';
      photoEl = {
        type: 'image', source: it.url, fit: 'cover',
        width: '112%', height: '120%', y: yA, x_anchor: '50%', y_anchor: yA,
        x_scale: [{ time: 0, value: from, easing: 'linear' }, { time: S.photoS, value: to }],
        y_scale: [{ time: 0, value: from, easing: 'linear' }, { time: S.photoS, value: to }],
        x: [{ time: 0, value: '50%', easing: 'linear' }, { time: S.photoS, value: DX[photoCount % DX.length] }],
      };
    } else if (eff === 'fill') {
      const lo = sizePct, hi = sizePct + amp;
      const from = `${(zoomIn ? lo : hi).toFixed(1)}%`, to = `${(zoomIn ? hi : lo).toFixed(1)}%`;
      photoEl = {
        type: 'image', source: it.url, fit: 'cover',
        width: '110%', height: '110%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
        x_scale: [{ time: 0, value: from, easing: 'linear' }, { time: S.photoS, value: to }],
        y_scale: [{ time: 0, value: from, easing: 'linear' }, { time: S.photoS, value: to }],
      };
      if (Number.isFinite(it.posX) && Number.isFinite(it.posY)) {
        photoEl.x = `${it.posX}%`;
        photoEl.y = `${it.posY}%`;
      } else {
        Object.assign(photoEl, FRAMING[it.framing] || FRAMING.top);
      }
    } else {
      // FIT: whole photo, native aspect, on the palette. Gentle zoom (kept small so
      // the photo never crops out of frame).
      const gz = Math.min(4, amp);
      const lo = sizePct, hi = sizePct + gz;
      const from = `${(zoomIn ? lo : hi).toFixed(1)}%`, to = `${(zoomIn ? hi : lo).toFixed(1)}%`;
      photoEl = {
        type: 'image', source: it.url, fit: 'contain',
        width: '100%', height: '100%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
        x_scale: [{ time: 0, value: from, easing: 'linear' }, { time: S.photoS, value: to }],
        y_scale: [{ time: 0, value: from, easing: 'linear' }, { time: S.photoS, value: to }],
      };
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
