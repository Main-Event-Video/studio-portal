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
};

const CARD_S = 4;

// Green-screen placeholder for a client video the editor will key in manually.
// Broadcast chroma green — keys cleanly in any NLE. The clip name shows ONLY
// while the green fully covers the frame (never during the dissolves), so the
// transitions into/out of the gap stay perfectly keyable.
const CHROMA_GREEN = '#00B140';
const PLACEHOLDER_S = 3; // fixed 3s gap; the editor trims to their real clip

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

// Polaroid style: a tilted white-framed print (bottom-heavy border) with a drop
// shadow, over a blurred, darkened copy of the same photo. One print per shot,
// tilt alternating. (A fanned multi-print pile is a later enhancement — it needs
// persistent overlapping elements across shots.)
function polaroidShot(S, url, photoCount) {
  const rect = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
  const tilts = [-4, 3, -2.5, 4, -3.5, 2.5];
  const rot = tilts[photoCount % tilts.length];
  return [
    // soft blurred backdrop (same photo) + darkening
    { type: 'image', source: url, x: '50%', y: '50%', width: '100%', height: '100%',
      x_anchor: '50%', y_anchor: '50%', fit: 'cover', blur_radius: 28, blur_mode: 'stack' },
    { type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%',
      path: rect, fill_color: '#000000', opacity: '46%' },
    // the print: a rotated composition (white card + photo) with a drop shadow
    { type: 'composition', x: '50%', y: '50%', width: '46%', height: '58%',
      x_anchor: '50%', y_anchor: '50%', z_rotation: rot + '\u00B0',
      shadow_color: '#000000', shadow_blur: '5vmin', shadow_x: '0vmin', shadow_y: '2vmin',
      elements: [
        { type: 'shape', x: '50%', y: '50%', width: '100%', height: '100%', x_anchor: '50%', y_anchor: '50%',
          path: rect, fill_color: '#FDFDFA' },
        { type: 'image', source: url, x: '50%', y: '44%', width: '86%', height: '74%',
          x_anchor: '50%', y_anchor: '50%', fit: 'cover' },
      ],
    },
  ];
}

export function buildMontageSource({ photos, items, style = 'hollywood', title, subtitle, watermarkUrl, photoSeconds = null, includeCards = true, width = 1920, height = 1080 }) {
  const base = STYLES[style] || STYLES.hollywood;
  const photoS = photoSeconds ? Math.min(10, Math.max(1, Number(photoSeconds))) : base.photoS;
  const fadeS = Math.min(base.fadeS, photoS * 0.4);
  const S = { ...base, photoS, fadeS };
  // Unified play sequence: photos and (optional) green-screen video placeholders.
  // Back-compat: if only `photos` is passed, treat them all as photo items.
  const seq = Array.isArray(items) && items.length
    ? items
    : (photos || []).map((p) => ({ type: 'photo', url: p.url, framing: p.framing }));
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
    if (S.polaroid) {
      elements.push({
        name: `Photo-${photoCount}`, type: 'composition', track: 2, duration: S.photoS,
        ...(i > 0 ? { animations: transitionIn(S, i) } : {}),
        elements: polaroidShot(S, it.url, photoCount),
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
    const mul = Math.min(1.4, Math.max(0.6, (Number(it.size) || 100) / 100));
    const scalePct = (v) => {
      const n = parseFloat(v) * mul; // v like '112%'
      return `${(isFit ? n : Math.max(100, n)).toFixed(1)}%`;
    };
    const from = scalePct(zoomIn ? S.zoom[0] : S.zoom[1]);
    const to = scalePct(zoomIn ? S.zoom[1] : S.zoom[0]);
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
    // Per-photo colour (Creatomate allows one color_filter; B&W/Sepia or a gentle
    // auto-correct brighten). Safe default: none, so existing renders are unchanged.
    if (it.mode === 'bw') { photoEl.color_filter = 'grayscale'; photoEl.color_filter_value = '100%'; }
    else if (it.mode === 'sepia') { photoEl.color_filter = 'sepia'; photoEl.color_filter_value = '80%'; }
    else if (it.colorCorrect) { photoEl.color_filter = 'brighten'; photoEl.color_filter_value = '6%'; }
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
