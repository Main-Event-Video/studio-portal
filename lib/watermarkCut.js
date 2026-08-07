// Build a Creatomate source that stamps the Main Event Studio logo (lower third)
// + the version (bottom-right) onto an uploaded rough cut, and exports it at 720p
// regardless of the source resolution (the source video is scaled with fit:cover
// into a 1280×720 composition).
//
// Watermark placement mirrors the approved mock: a wide logo band across the lower
// third at ~45% opacity, the version bottom-right at ~60% opacity.
//
// Timing: if we know the cut runs longer than ~90s, the watermark shows only on the
// first 90 seconds (rest clean). If the duration is unknown or the cut is short, the
// watermark simply covers the whole thing — same render cost either way (Creatomate
// bills by output length, not overlay length), and it avoids padding a short video.
//
// Creatomate quirks honored (from the montage engine): opacity is a PERCENT STRING
// ('45%'), positions are percent strings, Google fonts only.

export function buildCutWatermarkSource({ videoUrl, logoUrl, version = '', durationSec = null, width = 1280, height = 720 }) {
  const onlyFirst90 = Number(durationSec) > 92;      // long cut → first 90s only
  const overlayTiming = onlyFirst90 ? { time: 0, duration: 90 } : { time: 0 };

  const elements = [
    // Base cut, scaled to fill the 720p frame; audio kept (default volume).
    { type: 'video', source: videoUrl, x: '50%', y: '50%', width: '100%', height: '100%', fit: 'cover' },
    // Logo — wide band across the lower third.
    {
      type: 'image', source: logoUrl,
      x: '50%', y: '83%', x_anchor: '50%', y_anchor: '50%',
      width: '80%', fit: 'contain', opacity: '45%',
      ...overlayTiming,
    },
  ];

  const v = String(version || '').trim();
  if (v) {
    elements.push({
      type: 'text', text: v,
      x: '95%', y: '90%', x_anchor: '100%', y_anchor: '100%',
      font_family: 'Open Sans', font_weight: '700', font_size: '6 vmin',
      fill_color: '#ffffff', opacity: '60%',
      shadow_color: 'rgba(0,0,0,0.55)', shadow_blur: '1 vmin', shadow_x: '0.2 vmin', shadow_y: '0.2 vmin',
      ...overlayTiming,
    });
  }

  return { width, height, elements };
}
