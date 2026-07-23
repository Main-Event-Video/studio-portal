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
};

const CARD_S = 4;

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
export function buildMontageSource({ photos, style = 'hollywood', title, subtitle, watermarkUrl, photoSeconds = null, includeCards = true, width = 1920, height = 1080 }) {
  const base = STYLES[style] || STYLES.hollywood;
  const photoS = photoSeconds ? Math.min(10, Math.max(1, Number(photoSeconds))) : base.photoS;
  const fadeS = Math.min(base.fadeS, photoS * 0.4);
  const S = { ...base, photoS, fadeS };
  const n = photos.length;
  const cardsTime = includeCards ? 2 * CARD_S : 0;
  const total = cardsTime + n * photoS - Math.max(0, n - 1) * fadeS;

  const elements = [];

  if (includeCards) {
    elements.push({
      name: 'Opening',
      type: 'composition',
      track: 1,
      duration: CARD_S,
      elements: card(S, { kicker: S.kicker, title, subtitle, height }),
    });
  }

  // Per-photo framing fix: shifts the image inside the frame. Cover-crop
  // shows the CENTER by default; moving the element down reveals more of the
  // image's TOP (keeps heads), etc.
  const FRAMING = {
    top: { y: '63%' },    // show top of photo (heads) — shifts image down 13%
    bottom: { y: '37%' }, // show bottom
    left: { x: '56%' },   // show left side (only helps portrait-ish photos)
    right: { x: '44%' },  // show right side
  };

  photos.forEach((p, i) => {
    const zoomIn = i % 2 === 0;
    const from = zoomIn ? S.zoom[0] : S.zoom[1];
    const to = zoomIn ? S.zoom[1] : S.zoom[0];
    elements.push({
      name: `Photo-${i + 1}`,
      type: 'image',
      track: 1,
      source: p.url,
      fit: 'cover',
      ...(FRAMING[p.framing] || {}),
      duration: S.photoS,
      x_scale: [{ time: 0, value: from, easing: 'linear' }, { time: S.photoS, value: to }],
      y_scale: [{ time: 0, value: from, easing: 'linear' }, { time: S.photoS, value: to }],
      // First photo gets NO transition — hard cut from the opening card so the
      // card can be swapped out cleanly in the edit.
      ...(i > 0 ? { animations: transitionIn(S, i) } : {}),
    });
  });

  // Closing card also hard-cuts in (same replaceability rule as the opener).
  if (includeCards) {
    elements.push({
      name: 'Closing',
      type: 'composition',
      track: 1,
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
