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
    label: 'Polaroid (tilted prints on a soft background)',
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
const PLACEHOLDER_S = 3; // fixed 3s gap; the editor trims to their real clip

// Josh: EVERY montage starts and ends with a chroma-green "fake photo" frame he
// keys in Premiere to comp montages together. It must be a CLEAN full-green frame
// that CUTS to the first shot — a slow dissolve tinted the first/last photo green
// (un-keyable). So: hold FULL green, then a near-instant cut to the shot (tiny
// GREEN_FADE only to avoid a 1-frame strobe). On a top track so it fully covers
// everything while green.
const GREEN_HOLD = 1.6;   // seconds of full, clean green
const GREEN_FADE = 0.12;  // near-hard cut to/from the montage (no green bleed onto the photo)
function addGreenBookends(source, includeCards) {
  if (!source || !Array.isArray(source.elements)) return source;
  const rect = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
  const bgEl = source.elements.find((e) => e.name === 'Background');
  const total = bgEl && bgEl.duration
    ? bgEl.duration
    : source.elements.reduce((m, e) => Math.max(m, (e.time || 0) + (e.duration || 0)), 0);
  const cardS = includeCards ? CARD_S : 0;
  const dur = GREEN_HOLD + GREEN_FADE;
  // HEAD — after the opening card: hold green, then dissolve out into shot 1.
  source.elements.push({
    name: 'GreenStart', type: 'shape', track: 100, time: cardS, duration: dur,
    path: rect, width: '100%', height: '100%', fill_color: CHROMA_GREEN,
    opacity: [{ time: 0, value: '100%' }, { time: GREEN_HOLD, value: '100%' }, { time: dur, value: '0%' }],
  });
  // TAIL — before the closing card: last shot dissolves into green, which holds.
  const tailStart = Math.max(cardS, (total - cardS) - dur);
  source.elements.push({
    name: 'GreenEnd', type: 'shape', track: 100, time: tailStart, duration: dur,
    path: rect, width: '100%', height: '100%', fill_color: CHROMA_GREEN,
    opacity: [{ time: 0, value: '0%' }, { time: GREEN_FADE, value: '100%' }, { time: dur, value: '100%' }],
  });
  return source;
}

// Polaroid stacking pile (approved mock): new print every HOLD, drop-in over
// MOVE, keep KEEP visible, oldest fades over FADE.
const POL = { HOLD: 4.4, MOVE: 2.3, KEEP: 4, FADE: 0.65 };
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
    const t = stackStart + i * step;
    const { bg, hero } = duotoneParts(S, it, i);
    elements.push({ name: `DuoBg-${i + 1}`, type: 'composition', track: 2, time: +t.toFixed(2), duration: photoS,
      ...(i > 0 ? { animations: tr(BG[i % BG.length]) } : {}), elements: bg });
    elements.push({ name: `DuoHero-${i + 1}`, type: 'composition', track: 3, time: +t.toFixed(2), duration: photoS,
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
function polaroidStackSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height, background }) {
  const rect = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
  const photosOnly = seq.filter((it) => it.type !== 'placeholder'); // green-screen gaps aren't prints
  const n = photosOnly.length;

  const cardsTime = includeCards ? 2 * CARD_S : 0;
  const stackDur = n > 0 ? (n - 1) * POL.HOLD + POL.MOVE + POL.HOLD : 0;
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

  // Backdrop. If a custom background image is set, it fills the whole piece
  // (blurred for depth); otherwise the blurred CURRENT photo crossfades each
  // beat. A tint wash sits over either (colour + opacity from the control).
  if (bgUrl) {
    elements.push({ name: 'Backdrop', type: 'image', source: bgUrl, track: 2, time: stackStart,
      duration: stackDur, x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%',
      fit: 'cover', blur_radius: 18, blur_mode: 'stack' });
  } else {
    photosOnly.forEach((it, k) => {
      const t = stackStart + k * POL.HOLD;
      const life = (k === n - 1 ? POL.MOVE + POL.HOLD : POL.HOLD) + 0.6;
      elements.push({ name: `Backdrop-${k + 1}`, type: 'image', source: it.url, track: 2, time: t,
        duration: life, x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%',
        fit: 'cover', blur_radius: 28, blur_mode: 'stack',
        animations: [{ time: 'start', duration: 0.6, transition: true, type: 'fade' }] });
    });
  }
  elements.push({ name: 'Tint', type: 'shape', track: 3, time: stackStart, duration: stackDur,
    path: rect, width: '100%', height: '100%', fill_color: TINT, opacity: TINT_OP });

  // The prints. Each drops from above and stays (higher track = on top), then
  // fades once KEEP newer prints have landed over it.
  photosOnly.forEach((it, k) => {
    const t = stackStart + k * POL.HOLD;
    // Tighter, bigger, centre-clustered pile with a dominant front print
    // (matches the approved reference clip) \u2014 was a wide \u00B115% scatter.
    const rTilt = (pol_rand(k) * 2 - 1) * 13;              // \u00B113\u00B0 tilt
    const ox = (pol_rand(k + 100) * 2 - 1) * 8;            // \u00B18% horizontal (tight cluster)
    const drop = pol_rand(k + 200) < 0.5;
    const oy = (drop ? 5 : -5) + (pol_rand(k + 300) * 2 - 1) * 2;  // ~\u00B15% vertical
    const settleX = 50 + ox, settleY = 50 + oy;
    const startX = settleX + (pol_rand(k + 400) * 2 - 1) * 8;
    const visibleBeats = Math.min(n - 1 - k, POL.KEEP);
    const life = POL.MOVE + visibleBeats * POL.HOLD + POL.HOLD * 0.5;
    const willFade = k < n - POL.KEEP;

    const print = {
      name: `Print-${k + 1}`, type: 'composition', track: 4 + k, time: t,
      duration: life + (willFade ? POL.FADE : 0),
      // Start FULLY above the frame so it feather-falls in cleanly (was -20%,
      // which left the bottom edge already showing = "pops then falls").
      x: [{ time: 0, value: `${startX.toFixed(1)}%`, easing: 'quadratic-out' }, { time: POL.MOVE, value: `${settleX.toFixed(1)}%` }],
      y: [{ time: 0, value: '-70%', easing: 'quadratic-out' }, { time: POL.MOVE, value: `${settleY.toFixed(1)}%` }],
      x_anchor: '50%', y_anchor: '50%', width: '46%', height: '66%',
      z_rotation: `${rTilt.toFixed(1)}\u00B0`,   // static tilt (keyframed z_rotation is unreliable in Creatomate)
      x_scale: [{ time: 0, value: '104%', easing: 'quadratic-out' }, { time: POL.MOVE, value: '100%' }],
      y_scale: [{ time: 0, value: '104%', easing: 'quadratic-out' }, { time: POL.MOVE, value: '100%' }],
      // Softer, larger shadow so the print doesn't read as a hard cut-out.
      shadow_color: '#000000', shadow_blur: '8vmin', shadow_x: '0vmin', shadow_y: '3vmin',
      elements: [
        // Rounded white card (was a hard-cornered rectangle \u2192 looked fake).
        { type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: POLAROID_CARD_PATH, fill_color: '#FDFDFA' },
        // Photo: thin even top/sides, thick bottom caption strip. Colour edit
        // (B&W/Sepia/contrast/auto) + head-safe framing applied per photo.
        applyPhotoColor({ type: 'image', source: it.url, width: '92%', height: '78%', fit: 'cover', ...printFraming(it) }, it),
      ],
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
function collageWallSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width: W, height: H, background, assetBase }) {
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

  if (featured) {
    const u = 120, COLS = 16, ROWS = 10;
    const px = (c) => gap + (c - 1) * (u + gap);
    const occ = new Set(); const mark = (c, r, w, h) => { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) occ.add((c + i) + '_' + (r + j)); };
    let pi = 0;
    [[1, 2], [5, 2], [9, 2], [13, 2], [1, 6], [5, 6], [9, 6], [13, 6]].forEach(([c, r]) => {
      const wpx = 4 * u + 3 * gap, hpx = 3 * u + 2 * gap, x = px(c), y = px(r);
      const cell = { x, y, w: wpx, h: hpx, it: pk(pi) }; cells.push(cell); focal.push({ cx: x + wpx / 2, cy: y + hpx / 2, w: wpx, h: hpx, cell }); mark(c, r, 4, 3); pi++;
    });
    [[2, 9], [6, 9], [10, 9], [14, 9]].forEach(([c, r]) => { const wpx = u, hpx = 2 * u + gap; cells.push({ x: px(c), y: px(r), w: wpx, h: hpx, it: pk(pi) }); mark(c, r, 1, 2); pi++; });
    for (let r = 1; r <= ROWS; r++) for (let c = 1; c <= COLS; c++) { if (occ.has(c + '_' + r)) continue; cells.push({ x: px(c), y: px(r), w: u, h: u, it: pk(pi) }); pi++; }
    wallWpx = COLS * u + (COLS + 1) * gap; wallHpx = ROWS * u + (ROWS + 1) * gap;
  } else if (scatter) {
    // Gallery 150: print-cards on a grid but each tilted + jittered so they
    // scatter and overlap (slot smaller than the card => overlap). Each cell
    // carries a tilt; every interior cell is a camera target.
    const cw = 440, ch = 300, COLS = S.cols || 6;
    const ROWS = Math.max(4, Math.min(8, Math.ceil(n / COLS)));
    const slotW = cw * 0.8, slotH = ch * 0.8;
    let pi = 0;
    for (let r = 1; r <= ROWS; r++) for (let c = 1; c <= COLS; c++) {
      const jx = rnd(-slotW * 0.12, slotW * 0.12), jy = rnd(-slotH * 0.12, slotH * 0.12);
      const cx = gap + (c - 0.5) * slotW + jx, cy = gap + (r - 0.5) * slotH + jy;
      const tilt = +rnd(-9, 9).toFixed(1);
      const cell = { x: cx - cw / 2, y: cy - ch / 2, w: cw, h: ch, it: pk(pi), tilt }; cells.push(cell);
      // Every non-side-edge cell is a camera target so the rests can span the
      // client's sequence from near the start; the tfPct clamp keeps the wall
      // filling the frame at the top/bottom rows.
      if (c >= 2 && c <= COLS - 1) focal.push({ cx, cy, w: cw, h: ch, cell });
      pi++;
    }
    wallWpx = gap * 2 + (COLS - 1) * slotW + cw; wallHpx = gap * 2 + (ROWS - 1) * slotH + ch;
  } else {
    const cw = 512, ch = 288, COLS = 7;            // uniform 16:9 cells (mock size; keeps camera zoom ~4× like Featured so the render stays sharp — was 256×144 → ~8× upscale → mush)
    const ROWS = Math.max(4, Math.min(9, Math.ceil(n / COLS)));
    const px = (c) => gap + (c - 1) * (cw + gap), py = (r) => gap + (r - 1) * (ch + gap);
    let pi = 0;
    for (let r = 1; r <= ROWS; r++) for (let c = 1; c <= COLS; c++) {
      const x = px(c), y = py(r); const cell = { x, y, w: cw, h: ch, it: pk(pi) }; cells.push(cell);
      // Non-side-edge cells are camera targets (see scatter note) so the rests
      // span the client's numbering from near the start.
      if (c >= 2 && c <= COLS - 1) focal.push({ cx: x + cw / 2, cy: y + ch / 2, w: cw, h: ch, cell });
      pi++;
    }
    wallWpx = COLS * cw + (COLS + 1) * gap; wallHpx = ROWS * ch + (ROWS + 1) * gap;
  }
  if (!focal.length) focal.push({ cx: wallWpx / 2, cy: wallHpx / 2, w: wallWpx / 3, h: wallHpx / 3 });

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fillScale = (f) => Math.max(W / f.w, H / f.h) * 1.02;
  const partialScale = (f) => Math.min(W * 0.68 / f.w, H * 0.78 / f.h) * rnd(0.92, 1.05);
  const tfPct = (cx, cy, s) => {
    let tx = W / 2 - cx * s, ty = H / 2 - cy * s;
    tx = clamp(tx, W - wallWpx * s, 0); ty = clamp(ty, H - wallHpx * s, 0);
    return { x: `${(tx / W * 100).toFixed(2)}%`, y: `${(ty / H * 100).toFixed(2)}%`, s: `${(s * 100).toFixed(2)}%` };
  };

  // Camera MOVEMENT stays haphazard (the approved back-and-forth whip): visit the
  // focal cells in a seeded-shuffled order so the camera darts around the wall.
  const order = [...Array(focal.length).keys()];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd(0, i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const visit = order.slice(0, Math.min(order.length, fast ? 9 : 11));
  // But each REST must land on the client's images in CHRONOLOGICAL order. The
  // camera path is unchanged; we only reassign which photo sits at each rested
  // cell so that, in visit order, the featured photo climbs through the sequence
  // (evenly sampled across the whole segment). Non-rested cells keep their accent
  // photos. (Josh: keep the movement — just rest/focus on the pics in order.)
  const R = visit.length;
  visit.forEach((fi, k) => {
    if (!focal[fi] || !focal[fi].cell) return;
    const p = R > 1 ? Math.round((k * (n - 1)) / (R - 1)) : 0;
    focal[fi].cell.it = pk(p);
  });

  const xK = [], yK = [], sxK = [], syK = [];
  const leakTimes = [];   // one flowing light-leak per camera move
  let t = 0;
  visit.forEach((fi, i) => {
    const f = focal[fi];
    // scatter (Gallery 150) always keeps surrounding prints visible (partial);
    // Classic/Featured alternate a full-frame fill with a pulled-back rest.
    const s = (!scatter && rnd(0, 1) < 0.5) ? fillScale(f) : partialScale(f);
    const rest = tfPct(f.cx, f.cy, s), push = tfPct(f.cx, f.cy, s * 1.05);
    const whipS = fast ? rnd(0.52, 0.72) : rnd(0.95, 1.25);
    const dwellS = fast ? rnd(1.75, 2.15) : rnd(1.5, 1.9);
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
    leakTimes.push({ start: +moveStart.toFixed(2), dur: +((td - moveStart) * 1.0).toFixed(2), v: Math.floor(rnd(0, 3)), peak: Math.round(rnd(42, 66)), from: +rnd(42, 48).toFixed(1), to: +rnd(52, 58).toFixed(1) });
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
          applyPhotoColor({ type: 'image', source: c.it.url, x: '50%', y: '46%', width: '90%', height: '84%', x_anchor: '50%', y_anchor: '50%', fit: 'cover' }, c.it),
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

// ---- Epic Vintage — one hero print at a time over blurred bokeh + heavy leaks
// Faithful to the reference: a large, slightly-tilted print sits in sharp focus
// (thin cream border, slow push) over a heavily-blurred, warm bokeh field of the
// same photo; consecutive prints CROSSFADE, and a big warm light-leak flash
// blooms over each cut so it nearly blows out — exactly the ref's transitions.
// A persistent warm-multiply + cream-screen grade gives the faded vintage look.
// NO template text (Josh). Green bookends are added by the wrapper.
function epicVintageSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width: W, height: H, assetBase }) {
  const rect = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
  const printPath = roundedRect(1.0, 1.4);              // barely-rounded print corners
  const photos = seq.filter((s) => s.type === 'photo'); // epic features single prints; ignores video gaps
  const HOLD = S.photoS + 1.6;                           // longer holds → fewer blowouts (transitions were washing out ~half the runtime)
  const cardS = includeCards ? CARD_S : 0;
  const stackStart = cardS;
  // SEQUENTIAL prints — each spins/flies away, the next falls on (no crossfade);
  // the light-leak blowout at each boundary covers the cut.
  const bodyDur = photos.length * HOLD;
  const total = cardS * 2 + bodyDur;
  const eIn = 0.5, eOut = 0.55;                          // fall-on / spin-away durations

  const elements = [];
  elements.push({ name: 'Background', type: 'shape', track: 1, time: 0, duration: total, path: rect, width: '100%', height: '100%', fill_color: S.bg || '#171008' });
  if (includeCards) elements.push({ name: 'Opening', type: 'composition', track: 2, time: 0, duration: CARD_S, elements: card(S, { kicker: S.kicker, title, subtitle, height: H }) });

  // Each hero print is a full-frame comp: a scatter of OTHER prints (blurred, warm)
  // sitting behind, plus the sharp hero print. The hero DRIFTS AWAY from camera
  // (its composition scales DOWN over the hold — a downscale, so no upscale blur),
  // revealing the prints behind it, exactly like the reference. The photo has a
  // THIN even border so it reads as one connected print, not floating in a mat.
  const nb = (i, k) => photos[(((i + k) % photos.length) + photos.length) % photos.length]; // neighbour photo
  photos.forEach((it, i) => {
    const t = stackStart + i * HOLD;                     // sequential slot
    const dur = HOLD;
    const spinDir = i % 2 ? 1 : -1;                      // alternate spin/fly direction
    const rot0 = (spinDir * -4).toFixed(1);              // rest angle
    const rot1 = (spinDir * 12).toFixed(1);              // spins ~16° while dwelling
    const rIn = (spinDir * -16).toFixed(1);              // enters rotated, settles to rot0
    const rOut = (spinDir * 30).toFixed(1);              // spins as it flies away (gentler)
    const camR0 = (spinDir * -2).toFixed(1), camR1 = (spinDir * 4).toFixed(1);
    const flyX = (50 + spinDir * 12).toFixed(1);         // flies off toward a corner
    // Prints BEHIND — blurred photos (no white card, so nothing can read as a blank
    // box) over a bright warm base; heavy blur keeps them dreamy + out of focus.
    const bgSpots = [
      { x: '14%', y: '24%', w: 60, tilt: -9, ph: nb(i, 1) },
      { x: '85%', y: '22%', w: 58, tilt: 8, ph: nb(i, 3) },
      { x: '17%', y: '80%', w: 60, tilt: 6, ph: nb(i, -2) },
      { x: '86%', y: '78%', w: 56, tilt: -7, ph: nb(i, 2) },
    ];
    const bgPrints = bgSpots.map((s) => applyPhotoColor({
      type: 'image', source: s.ph.url, x: s.x, y: s.y, width: `${s.w}%`, height: `${Math.round(s.w * 0.7)}%`,
      x_anchor: '50%', y_anchor: '50%', z_rotation: `${s.tilt}°`, fit: 'cover', blur_radius: 22, blur_mode: 'stack', opacity: '78%',
    }, s.ph));
    elements.push({
      name: `Epic-${i + 1}`, type: 'composition', track: 3, time: t, duration: dur,
      // oversized so the unified rotate/drift never reveals frame edges. ALL layers
      // (pile + hero) live in here, so they move in unison.
      width: '128%', height: '128%', x_anchor: '50%', y_anchor: '50%',
      x: [{ time: 0, value: '54%', easing: 'linear' }, { time: dur, value: '46%' }],
      y: [{ time: 0, value: '46%', easing: 'linear' }, { time: dur, value: '54%' }],
      z_rotation: [{ time: 0, value: `${camR0}°`, easing: 'linear' }, { time: dur, value: `${camR1}°` }],
      // slow drift for most of the shot, then a FAST push into the leak flash
      x_scale: [{ time: 0, value: '100%', easing: 'linear' }, { time: dur * 0.72, value: '103%', easing: 'quadratic-in' }, { time: dur, value: '115%' }],
      y_scale: [{ time: 0, value: '100%', easing: 'linear' }, { time: dur * 0.72, value: '103%', easing: 'quadratic-in' }, { time: dur, value: '115%' }],
      elements: [
        // MID warm base (was too bright — the render over-brightened, washing the
        // whole frame). A muted tan reads as a warm table, not blown-out cream.
        { type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: rect, fill_color: '#9C7E52' },
        ...bgPrints,
        // slight warm multiply to sink the pile a touch (no screen lift — screens
        // were stacking to overexpose the render)
        { type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: rect, fill_color: '#2E1E0C', blend_mode: 'multiply', opacity: '18%' },
        // HERO print — FALLS ON (drops + settles), dwells (recede + spin), then SPINS
        // AWAY (fast spin + flies off toward a corner). No crossfade; the leak covers it.
        {
          type: 'composition', width: '56%', height: '64%', x_anchor: '50%', y_anchor: '50%',
          shadow_color: '#000000', shadow_blur: '5vmin', shadow_x: '0vmin', shadow_y: '1.5vmin',
          x: [{ time: 0, value: '50%', easing: 'linear' }, { time: dur - eOut, value: '50%', easing: 'quadratic-in' }, { time: dur, value: `${flyX}%` }],
          y: [{ time: 0, value: '38%', easing: 'quadratic-out' }, { time: eIn, value: '50%' }, { time: dur - eOut, value: '50%', easing: 'quadratic-in' }, { time: dur, value: '22%' }],
          z_rotation: [{ time: 0, value: `${rIn}°`, easing: 'quadratic-out' }, { time: eIn, value: `${rot0}°`, easing: 'linear' }, { time: dur - eOut, value: `${rot1}°`, easing: 'quadratic-in' }, { time: dur, value: `${rOut}°` }],
          x_scale: [{ time: 0, value: '132%', easing: 'quadratic-out' }, { time: eIn, value: '116%', easing: 'linear' }, { time: dur - eOut, value: '90%', easing: 'quadratic-in' }, { time: dur, value: '46%' }],
          y_scale: [{ time: 0, value: '132%', easing: 'quadratic-out' }, { time: eIn, value: '116%', easing: 'linear' }, { time: dur - eOut, value: '90%', easing: 'quadratic-in' }, { time: dur, value: '46%' }],
          opacity: [{ time: 0, value: '0%' }, { time: eIn * 0.55, value: '100%' }, { time: dur - eOut * 0.4, value: '100%' }, { time: dur, value: '0%' }],
          elements: [
            { type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: printPath, fill_color: '#F6EFE0' },
            applyPhotoColor({ type: 'image', source: it.url, x: '50%', y: '50%', width: '96.5%', height: '95%', x_anchor: '50%', y_anchor: '50%', fit: 'cover' }, it),
          ],
        },
      ],
    });
  });

  // Persistent vintage grade: warm multiply (amber midtones) + cream screen
  // (lifts blacks → faded, low-contrast look). Spans the whole body.
  elements.push({ name: 'Warm', type: 'shape', track: 8, time: stackStart, duration: bodyDur, path: rect, width: '100%', height: '100%', fill_color: S.warm || '#C98A5A', opacity: S.warmOpacity || '22%', blend_mode: 'multiply' });
  elements.push({ name: 'Haze', type: 'shape', track: 8, time: stackStart, duration: bodyDur, path: rect, width: '100%', height: '100%', fill_color: S.haze || '#F0E2C8', opacity: S.hazeOpacity || '13%', blend_mode: 'screen' });

  // Floating light particles / dust drifting slowly over everything (screen blend),
  // two layers for a little parallax. Needs the overlay assets.
  if (assetBase) {
    [['dust1.png', 20, 48, 52], ['dust2.png', 13, 52, 47]].forEach(([d, op, x0, y0], k) => {
      elements.push({
        name: `Dust-${k + 1}`, type: 'image', track: 11, source: `${assetBase}/overlays/${d}`,
        time: stackStart, duration: bodyDur, fit: 'cover', blend_mode: 'screen',
        x_anchor: '50%', y_anchor: '50%', width: '120%', height: '120%', opacity: `${op}%`,
        x: [{ time: 0, value: `${x0}%`, easing: 'linear' }, { time: bodyDur, value: `${100 - x0}%` }],
        y: [{ time: 0, value: `${y0}%`, easing: 'linear' }, { time: bodyDur, value: `${100 - y0}%` }],
      });
    });
  }

  // Big warm blowout at EACH boundary: a solid cream FLASH + an organic light-leak
  // TEXTURE. They peak right as the current print spins away and the next falls on,
  // covering the hard cut so the swap reads as a burst of warm light (the ref).
  const EP = ['leak_epic1.png', 'leak_epic2.png', 'leak_epic3.png'];
  for (let i = 1; i < photos.length; i++) {
    const tc = stackStart + i * HOLD;                     // boundary between prints
    const fdur = 1.3;
    const t0 = Math.max(stackStart, tc - fdur / 2);
    elements.push({
      name: `Flash-${i}`, type: 'shape', track: 9, time: t0, duration: fdur,
      path: rect, width: '100%', height: '100%', fill_color: '#F6E6C8',
      opacity: [{ time: 0, value: '0%' }, { time: fdur * 0.5, value: '38%' }, { time: fdur, value: '0%' }],
    });
    if (assetBase) {
      const from = 40 + (i % 2 ? 8 : -8), to = 60 + (i % 2 ? -8 : 8);
      elements.push({
        name: `Leak-${i}`, type: 'image', track: 10, source: `${assetBase}/overlays/${EP[i % EP.length]}`,
        time: t0, duration: fdur, fit: 'cover', blend_mode: 'screen',
        x_anchor: '50%', y_anchor: '50%', y: '50%', width: '150%', height: '150%',
        x: [{ time: 0, value: `${from}%`, easing: 'linear' }, { time: fdur, value: `${to}%` }],
        opacity: [{ time: 0, value: '0%' }, { time: fdur * 0.5, value: '52%' }, { time: fdur, value: '0%' }],
      });
    }
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
function trendyWallSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width: W, height: H, assetBase }) {
  const rect = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
  const photos = seq.filter((s) => s.type === 'photo');
  const cardS = includeCards ? CARD_S : 0;
  const BODY = Math.min(22, Math.max(11, 9 + photos.length * 0.5));  // slow drift, scales gently with count
  const total = cardS * 2 + BODY;

  // Grid sized to the photos; thin gaps show the cream wall between matte prints.
  const COLS = 6;
  const ROWS = Math.max(4, Math.ceil(photos.length / COLS));
  const cw = 360, ch = 270, gap = 30, pad = 90;
  const wallWpx = pad * 2 + COLS * cw + (COLS - 1) * gap;
  const wallHpx = pad * 2 + ROWS * ch + (ROWS - 1) * gap;

  const cellEls = [];
  let pi = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const it = photos[pi % photos.length];
    const x = pad + c * (cw + gap), y = pad + r * (ch + gap);
    cellEls.push({
      type: 'composition',
      x: `${((x + cw / 2) / wallWpx * 100).toFixed(3)}%`, y: `${((y + ch / 2) / wallHpx * 100).toFixed(3)}%`,
      width: `${(cw / wallWpx * 100).toFixed(3)}%`, height: `${(ch / wallHpx * 100).toFixed(3)}%`,
      x_anchor: '50%', y_anchor: '50%',
      shadow_color: '#0000004D', shadow_blur: '1.6vmin', shadow_x: '0vmin', shadow_y: '0.5vmin',
      elements: [
        { type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%', path: rect, fill_color: '#F8F4EB' },
        applyPhotoColor({ type: 'image', source: it.url, x: '50%', y: '48%', width: '86%', height: '82%', x_anchor: '50%', y_anchor: '50%', fit: 'cover' }, it),
      ],
    });
    pi++;
  }

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

export function buildMontageSource({ photos, items, style = 'hollywood', title, subtitle, watermarkUrl, photoSeconds = null, includeCards = true, width = 1920, height = 1080, background = null, greenBookends = true, assetBase = null }) {
  const base = STYLES[style] || STYLES.hollywood;
  const photoS = photoSeconds ? Math.min(10, Math.max(1, Number(photoSeconds))) : base.photoS;
  const fadeS = Math.min(base.fadeS, photoS * 0.4);
  const S = { ...base, photoS, fadeS };
  // Unified play sequence: photos and (optional) green-screen video placeholders.
  // Back-compat: if only `photos` is passed, treat them all as photo items.
  const seq = Array.isArray(items) && items.length
    ? items
    : (photos || []).map((p) => ({ type: 'photo', url: p.url, framing: p.framing }));

  // Polaroid uses its own stacking-pile builder (prints pile up, not a
  // slideshow); every other style falls through to the per-photo loop below.
  const wrap = (src) => (greenBookends ? addGreenBookends(src, includeCards) : src);
  if (S.duotone && S.frantic) return wrap(duotone2Source({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height }));
  if (S.polaroid) return wrap(polaroidStackSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height, background }));
  if (S.collage) return wrap(collageWallSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height, background, assetBase }));
  if (S.epic) return wrap(epicVintageSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height, assetBase }));
  if (S.trendy) return wrap(trendyWallSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height, assetBase }));

  const durOf = (it) => (it.type === 'placeholder' ? PLACEHOLDER_S : photoS);
  const cardsTime = includeCards ? 2 * CARD_S : 0;
  const total = cardsTime + seq.reduce((a, it) => a + durOf(it), 0) - Math.max(0, seq.length - 1) * fadeS;

  const elements = [];

  // Persistent background in the style colour, behind every photo/card for the
  // whole montage. Without it, a Fit (contain) photo's letterbox/pillar margins
  // reveal the neighbouring photos instead of a clean backdrop (thumbnail shows
  // a clean frame, so this keeps the render true to it).
  elements.push({
    name: 'Background',
    type: 'shape',
    track: 1,
    time: 0,
    duration: total,
    path: 'M 0 0 L 100 0 L 100 100 L 0 100 Z',
    width: '100%',
    height: '100%',
    fill_color: S.bg,
  });

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
  const FRAMING = {
    top: { y: '63%' },    // show top of photo (heads) — shifts image down 13%
    center: {},           // true centered crop (no shift)
    bottom: { y: '37%' }, // show bottom
    left: { x: '56%' },   // show left side (only helps portrait-ish photos)
    right: { x: '44%' },  // show right side
  };

  let photoCount = 0;
  seq.forEach((it, i) => {
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
        elements: duotoneShot(S, it.url, photoCount),
      });
      return;
    }
    // Photo Editor per-photo controls (default: fill / size 100):
    //   fit  'fit'  = retain native aspect (letterbox/pillar on the style bg)
    //        'fill' = cover-crop to fill the frame (default)
    //   size = zoom multiplier (%). For cover we never let the effective scale
    //          drop below 100% (would reveal the background); for contain,
    //          smaller just adds more border, which is fine.
    const isFit = it.fit !== 'fill';   // default = Fit (native aspect); only 'fill' crops
    // SIZE sets the photo's baseline scale (Photo Editor), matching the editor
    // preview: 100% = frame default; below 100% the photo genuinely shrinks
    // (Fit adds border, Fill reveals the style background at the edges — exactly
    // what the editor shows). The style's Ken-Burns amount then drifts UP from
    // that baseline over the shot, so the photo sits at the size you set and
    // never shrinks past it. (Was: size multiplied INTO the zoom + a Fill floor
    // at 100%, so shrink was ignored and the size never actually held.)
    const sizePct = Math.min(140, Math.max(60, Number(it.size) || 100));
    const amp = Math.max(0, parseFloat(S.zoom[1]) - parseFloat(S.zoom[0])); // e.g. 12 for 100→112
    const lo = sizePct, hi = sizePct + amp;
    const from = `${(zoomIn ? lo : hi).toFixed(1)}%`;
    const to = `${(zoomIn ? hi : lo).toFixed(1)}%`;
    const photoEl = {
      name: `Photo-${photoCount}`,
      type: 'image',
      track: 2,
      source: it.url,
      fit: isFit ? 'contain' : 'cover',
      duration: S.photoS,
      x_scale: [{ time: 0, value: from, easing: 'linear' }, { time: S.photoS, value: to }],
      y_scale: [{ time: 0, value: from, easing: 'linear' }, { time: S.photoS, value: to }],
      // First item gets NO transition — hard cut from the opening card so the
      // card can be swapped out cleanly in the edit.
      ...(i > 0 ? { animations: transitionIn(S, i) } : {}),
    };
    if (S.pan && !isFit) {
      // Party 2: a gentle diagonal drift on top of the zoom, direction alternating
      // per photo. (Guarded by S.pan, so other styles are unchanged.)
      const D = [['47%', '53%'], ['53%', '47%'], ['53%', '53%'], ['47%', '47%']];
      const d = D[photoCount % D.length];
      photoEl.x = [{ time: 0, value: '50%', easing: 'linear' }, { time: S.photoS, value: d[0] }];
      photoEl.y = [{ time: 0, value: '50%', easing: 'linear' }, { time: S.photoS, value: d[1] }];
    } else if (!isFit) {
      // Drag-to-position focal point wins over the top/center/bottom anchor.
      if (Number.isFinite(it.posX) && Number.isFinite(it.posY)) {
        photoEl.x = `${it.posX}%`;
        photoEl.y = `${it.posY}%`;
      } else {
        Object.assign(photoEl, FRAMING[it.framing] || {});
      }
    }
    // Per-photo colour (B&W/Sepia/contrast/auto-correct — see applyPhotoColor).
    applyPhotoColor(photoEl, it);
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

  return wrap({
    output_format: 'mp4',
    width,
    height,
    frame_rate: 30,
    elements,
  });
}
