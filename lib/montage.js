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
};

const CARD_S = 4;

// Green-screen placeholder for a client video the editor will key in manually.
// Broadcast chroma green — keys cleanly in any NLE. The clip name shows ONLY
// while the green fully covers the frame (never during the dissolves), so the
// transitions into/out of the gap stay perfectly keyable.
const CHROMA_GREEN = '#00B140';
const PLACEHOLDER_S = 3; // fixed 3s gap; the editor trims to their real clip

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
    else if (it.colorCorrect) { el.color_filter = 'brighten'; el.color_filter_value = '6%'; }
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
    const rTilt = (pol_rand(k) * 2 - 1) * 18;              // \u00B118\u00B0
    const ox = (pol_rand(k + 100) * 2 - 1) * 15;           // \u00B115% (\u224830% spread)
    const drop = pol_rand(k + 200) < 0.5;
    const oy = (drop ? 10 : -10) + (pol_rand(k + 300) * 2 - 1) * 3;  // ~10% down / ~10% up
    const settleX = 50 + ox, settleY = 50 + oy;
    const startX = settleX + (pol_rand(k + 400) * 2 - 1) * 14;
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
      x_anchor: '50%', y_anchor: '50%', width: '42%', height: '58%',
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

// ---- Collage Wall (Classic / Featured) ------------------------------------
// Lays ALL photos into a grid inside a "wall" composition bigger than the frame,
// then keyframes the wall's x/y so a camera glides from one featured tile to the
// next (resting cellHoldS on each, neighbours visible), over a warm grade.
// Featured makes some tiles 2×2 heroes. Camera is PAN-only + a gentle scale
// drift for v1; exact path, zoom-to-fill, light-leaks/dust, vignette and
// face-aware framing are first-render tuning items (assets not in repo yet).
function collageWallSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height, background }) {
  const rect = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
  const photos = seq.filter((it) => it.type !== 'placeholder');
  const n = Math.max(1, photos.length);
  const cols = Math.max(3, S.cols || 6);
  const rows = Math.max(2, Math.ceil(n / cols));
  const featured = S.variant === 'featured';

  // How much of the wall fills the frame at rest (≈ columns across). Fewer =
  // more zoomed-in (featured leans closer). Wall sized so cells stay ~16:9.
  const VIS = featured ? 2.2 : 2.8;
  const wallWpct = (cols / VIS) * 100;
  const cellWpx = (wallWpct / cols) / 100 * width;
  const cellHpx = cellWpx * 9 / 16;
  const wallHpct = (cellHpx * rows) / height * 100;

  // Camera stops: ~6 featured cells spread through the grid.
  const stops = [];
  const step = Math.max(1, Math.floor(n / 6));
  for (let i = 0; i < n; i += step) stops.push(i);
  if (stops[stops.length - 1] !== n - 1) stops.push(n - 1);

  const holdS = S.cellHoldS || 2.6;
  const moveS = S.moveS || 1.2;
  const stackStart = includeCards ? CARD_S : 0;
  const wallDur = stops.length * holdS + Math.max(0, stops.length - 1) * moveS;
  const total = (includeCards ? 2 * CARD_S : 0) + wallDur;

  // Position the wall (anchored top-left) so featured cell `idx` sits centred.
  const camFor = (idx) => {
    const r = Math.floor(idx / cols), c = idx % cols;
    const cx = (c / cols) * 100 + (100 / cols) / 2;
    const cy = (r / rows) * 100 + (100 / rows) / 2;
    return { wx: 50 - (cx / 100) * wallWpct, wy: 50 - (cy / 100) * wallHpct };
  };
  const xks = [], yks = [];
  let t = 0;
  stops.forEach((idx, si) => {
    const cam = camFor(idx);
    const first = si === 0;
    xks.push({ time: +t.toFixed(2), value: `${cam.wx.toFixed(2)}%`, ...(first ? { easing: 'linear' } : {}) });
    yks.push({ time: +t.toFixed(2), value: `${cam.wy.toFixed(2)}%`, ...(first ? { easing: 'linear' } : {}) });
    t += holdS;
    xks.push({ time: +t.toFixed(2), value: `${cam.wx.toFixed(2)}%` });
    yks.push({ time: +t.toFixed(2), value: `${cam.wy.toFixed(2)}%` });
    if (si < stops.length - 1) t += moveS;
  });

  // Grid cells (each fit:cover, colour edit applied; heads kept via top framing).
  const cells = photos.map((it, i) => {
    const r = Math.floor(i / cols), c = i % cols;
    const isHero = featured && (i % 7 === 0) && c < cols - 1 && r < rows - 1;
    const span = isHero ? 2 : 1;
    const cw = (100 / cols) * span, ch = (100 / rows) * span;
    const cx = (c / cols) * 100 + cw / 2, cy = (r / rows) * 100 + ch / 2;
    return applyPhotoColor({
      type: 'image', source: it.url,
      x: `${cx.toFixed(2)}%`, y: `${cy.toFixed(2)}%`,
      width: `${Math.max(1, cw - 0.5).toFixed(2)}%`, height: `${Math.max(1, ch - 0.5).toFixed(2)}%`,
      x_anchor: '50%', y_anchor: '0%', fit: 'cover',
    }, it);
  });

  const elements = [];
  elements.push({ name: 'Background', type: 'shape', track: 1, time: 0, duration: total,
    path: rect, width: '100%', height: '100%', fill_color: S.bg });
  if (includeCards) elements.push({ name: 'Opening', type: 'composition', track: 2, time: 0,
    duration: CARD_S, elements: card(S, { kicker: S.kicker, title, subtitle, height }) });

  elements.push({
    name: 'Wall', type: 'composition', track: 2, time: stackStart, duration: wallDur,
    x_anchor: '0%', y_anchor: '0%', width: `${wallWpct.toFixed(2)}%`, height: `${wallHpct.toFixed(2)}%`,
    x: xks, y: yks,
    // gentle continuous scale drift for life
    x_scale: [{ time: 0, value: '100%', easing: 'linear' }, { time: wallDur, value: '104%' }],
    y_scale: [{ time: 0, value: '100%', easing: 'linear' }, { time: wallDur, value: '104%' }],
    elements: cells,
  });

  // Warm grade over the wall (multiply). Light-leaks/dust/vignette = later.
  elements.push({ name: 'Warm', type: 'shape', track: 8, time: stackStart, duration: wallDur,
    path: rect, width: '100%', height: '100%', fill_color: S.warm || '#3A2A12',
    opacity: S.warmOpacity || '20%', blend_mode: 'multiply' });

  if (includeCards) elements.push({ name: 'Closing', type: 'composition', track: 2, time: total - CARD_S,
    duration: CARD_S, elements: card(S, { kicker: null, title: title || 'THANK YOU', subtitle: 'A MAIN EVENT STUDIO PRODUCTION', height }) });
  if (watermarkUrl) elements.push({ name: 'Watermark', type: 'image', track: 99, source: watermarkUrl, time: 0,
    duration: Math.max(1, total - 0.1), width: '62%', height: '6.9%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', opacity: '42%' });

  return { output_format: 'mp4', width, height, frame_rate: 30, elements };
}

export function buildMontageSource({ photos, items, style = 'hollywood', title, subtitle, watermarkUrl, photoSeconds = null, includeCards = true, width = 1920, height = 1080, background = null }) {
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
  if (S.polaroid) return polaroidStackSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height, background });
  if (S.collage) return collageWallSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width, height, background });

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

  return {
    output_format: 'mp4',
    width,
    height,
    frame_rate: 30,
    elements,
  };
}
