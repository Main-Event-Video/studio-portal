// Build a Creatomate source JSON for a style using the mixed-aspect sample set,
// mirroring EXACTLY what app/api/admin/montage/route.js does at render time:
//   • items carry url/framing/fit/size/colour edits + probed w,h
//   • green is an injected PHOTO item (green:true) at head and tail
//   • greenBookends:false, width/height default to 1920x1080
//   • watermarkUrl set (drafts are watermarked)
// Usage: node build-source.mjs <style> [count] [--no-green] [--no-cards] [--secs=N]
import fs from 'node:fs';
import path from 'node:path';
import { buildMontageSource, STYLES, styleNeedsDims } from './montage.mjs';

const args = process.argv.slice(2);
const style = args[0] || 'hollywood';
const count = Number(args[1]) || 10;
const flag = (n) => args.includes(n);
const val = (n, d) => { const a = args.find((x) => x.startsWith(n + '=')); return a ? a.split('=')[1] : d; };

const SAMPLES = '/home/claude/samples';
const manifest = JSON.parse(fs.readFileSync(path.join(SAMPLES, 'manifest.json'), 'utf8'));

if (!STYLES[style]) { console.error(`Unknown style: ${style}`); process.exit(1); }
const needsDims = styleNeedsDims(STYLES[style]);

// Interleave so consecutive photos differ in shape — the condition the new
// styles must survive. Deterministic: no shuffling.
const pick = manifest.slice(0, count);

const photoItems = pick.map((m) => ({
  type: 'photo',
  url: `/samples/${m.file}`,
  // Comic Book uses a SECOND, pre-rendered image. In production that comes from a
  // server-side sharp pipeline cached in R2; here it is the sandbox-generated art
  // so the preview shows the real target look rather than the fallback.
  ...(flag('--comic') ? { altUrl: `/comic/${m.file}` } : {}),
  // Mirror editFor() in the render route EXACTLY. It never emits null for
  // contrast/saturation/size — it defaults them to 100. (Passing contrast:null
  // here made Number(null)===0, so applyPhotoColor emitted contrast '-100%' and
  // every photo rendered as flat grey. The production route is not vulnerable to
  // this because it clamps; my harness was lying, not the engine.)
  framing: 'top', fit: null, size: 100, colorCorrect: false,
  mode: 'color', contrast: 100, saturation: 100, posX: null, posY: null,
  // Dimensions are only supplied when the real route would probe them.
  w: needsDims ? m.w : null,
  h: needsDims ? m.h : null,
}));

const greenItem = { type: 'photo', green: true, url: '/public/green.png', fit: 'fill', w: 1920, h: 1080 };
const items = flag('--no-green') ? photoItems : [greenItem, ...photoItems, greenItem];

// Background control, for exercising the imported-background path:
//   --bg-video   a looping video backdrop (the studio background library)
//   --bg-image   a still backdrop
const bgArg = flag('--bg-video')
  // WebM, not MP4: the sandbox Chromium is an open-source build with NO H.264
// decoder (an .mp4 <video> sits at readyState 0 forever and paints black).
// Creatomate has no such limit — this is a PREVIEW-ONLY proxy format.
  ? { videoUrl: '/samples_bg.webm', kind: 'video', tint: val('--bg-tint', null), opacity: val('--bg-opacity', null) }
  : flag('--bg-image')
    ? { url: `/samples/${manifest[3].file}`, kind: 'image', tint: '#102040', opacity: '55%' }
    : null;

const secs = val('--secs', null);
const source = buildMontageSource({
  items,
  style,
  photoSeconds: secs ? Number(secs) : null,
  totalSeconds: null,
  includeCards: !flag('--no-cards'),
  greenBookends: false,
  title: 'DYLAN',
  subtitle: 'BAT MITZVAH',
  watermarkUrl: flag('--no-watermark') ? null : '/public/watermark.png',
  assetBase: '/public', // overlays live under /public/overlays in this harness
  background: bgArg,
  mpTransition: 'record-fwd', mpStagger: null, mpHold: null, mpSpeed: null,
});

// assetBase is used as `${assetBase}/overlays/x.png` in the engine; '' gives
// '/overlays/x.png'. Our web root serves them under /public/overlays, so remap.
const remap = (e) => {
  if (!e || typeof e !== 'object') return;
  if (typeof e.source === 'string' && e.source.startsWith('/overlays/')) e.source = '/public' + e.source;
  if (typeof e.source === 'string' && e.source.startsWith('/backgrounds/')) e.source = '/public' + e.source;
  (e.elements || []).forEach(remap);
};
(source.elements || []).forEach(remap);

const dur = source.elements.reduce((m, e) => Math.max(m, (e.time || 0) + (e.duration || 0)), 0);
fs.writeFileSync('/home/claude/preview/www/source.json', JSON.stringify(source, null, 1));
fs.writeFileSync('/home/claude/preview/www/meta.json', JSON.stringify({ style, count, dur, needsDims }, null, 1));
console.log(`${style}: ${source.elements.length} top-level elements, ${dur.toFixed(2)}s, needsDims=${needsDims}`);
