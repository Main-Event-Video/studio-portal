// Builds the Creatomate source JSON for a Studio montage (spine v1).
// One style for now: 'hollywood' — near-black + gold serif titles, slow
// Ken Burns push-ins, fade-through transitions. More styles plug in later
// as alternate builders; the pipeline doesn't care.
//
// Schema notes — every construct here is copied from MEvid's WORKING
// render code (lib/render-script.js / lib/opening-card.js), including its
// verified constraints: elements on the same track auto-sequence; a
// transition is an animation on the SECOND element with transition:true;
// motion = keyframes on x_scale/y_scale/x/y/opacity (never z_rotation);
// easing belongs on the FIRST keyframe of a pair; explicit track numbers.

const GOLD = '#E8CC8A';
const GOLD_DIM = '#C4A460';
const BG = '#0A0708';

const CARD_S = 4;       // opening/closing card duration
const PHOTO_S = 3.5;    // per photo
const FADE_S = 1.0;     // transition overlap

// Total timeline length given n photos: siblings overlap by FADE_S at each
// of the (n+1) transitions (card→p1, between photos, last→closing).
export function montageDuration(n) {
  return CARD_S + n * PHOTO_S + CARD_S - (n + 1) * FADE_S;
}

function fadeIn() {
  return [{ time: 'start', duration: FADE_S, transition: true, type: 'fade' }];
}

function text(track, str, { size, weight = '700', y, color = GOLD, spacing, font = 'Playfair Display' }) {
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

function card({ kicker, title, subtitle, height }) {
  const elements = [
    { type: 'shape', track: 1, path: 'M 0 0 L 100 0 L 100 100 L 0 100 Z', width: '100%', height: '100%', fill_color: BG },
  ];
  if (kicker) elements.push(text(2, kicker, { size: Math.round(height * 0.032), weight: '600', y: '30%', color: GOLD_DIM, spacing: '18%' }));
  if (title) {
    elements.push({
      ...text(3, title, { size: Math.round(height * 0.17), y: '48%' }),
      // Gentle keyframed settle (verified pattern: scale keyframes, easing on first).
      x_scale: [{ time: 0, value: '112%', easing: 'quadratic-out' }, { time: 1.2, value: '100%' }],
      y_scale: [{ time: 0, value: '112%', easing: 'quadratic-out' }, { time: 1.2, value: '100%' }],
      opacity: [{ time: 0, value: '0%' }, { time: 0.6, value: '100%' }],
    });
  }
  if (subtitle) elements.push(text(4, subtitle, { size: Math.round(height * 0.036), weight: '400', y: '66%', color: GOLD_DIM, spacing: '14%' }));
  return elements;
}

// photos: [{ url }] in final order. watermarkUrl: absolute URL of the logo
// PNG (drafts) or null (clean).
export function buildMontageSource({ photos, title, subtitle, watermarkUrl, width = 1920, height = 1080 }) {
  const n = photos.length;
  const total = montageDuration(n);

  const elements = [];

  // Opening card (track 1 sequences: card → photos → closing card).
  elements.push({
    name: 'Opening',
    type: 'composition',
    track: 1,
    duration: CARD_S,
    elements: card({ kicker: 'MAIN EVENT STUDIO PRESENTS', title, subtitle, height }),
  });

  // Photos with alternating slow push (Ken Burns) + fade-through transitions.
  photos.forEach((p, i) => {
    const zoomIn = i % 2 === 0;
    const from = zoomIn ? '100%' : '112%';
    const to = zoomIn ? '112%' : '100%';
    elements.push({
      name: `Photo-${i + 1}`,
      type: 'image',
      track: 1,
      source: p.url,
      fit: 'cover',
      duration: PHOTO_S,
      x_scale: [{ time: 0, value: from, easing: 'linear' }, { time: PHOTO_S, value: to }],
      y_scale: [{ time: 0, value: from, easing: 'linear' }, { time: PHOTO_S, value: to }],
      animations: fadeIn(),
    });
  });

  // Closing card.
  elements.push({
    name: 'Closing',
    type: 'composition',
    track: 1,
    duration: CARD_S,
    elements: card({ kicker: null, title: title || 'THANK YOU', subtitle: 'A MAIN EVENT STUDIO PRODUCTION', height }),
    animations: fadeIn(),
  });

  // Draft watermark: logo riding above everything for the whole runtime.
  if (watermarkUrl) {
    elements.push({
      name: 'Watermark',
      type: 'image',
      track: 9,
      source: watermarkUrl,
      time: 0,
      duration: Math.max(1, total - 0.1),
      width: '14%',
      x: '88%',
      y: '90%',
      x_anchor: '50%',
      y_anchor: '50%',
      opacity: '55%',
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
