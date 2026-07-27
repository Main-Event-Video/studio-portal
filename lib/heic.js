// =============================================================
// HEIC/HEIF → JPEG conversion.
//
// iPhones upload photos as HEIC. Chrome and Firefox CANNOT display HEIC, and
// Creatomate can't reliably render it either — so every HEIC is converted to
// JPEG server-side and the JPEG is stored in its place (convert + replace).
//
// Why not just sharp? sharp's prebuilt binary can't DECODE HEIC — HEVC is
// patent-encumbered and isn't compiled into the shipped libvips (verified:
// "Support for this compression format has not been built in"). So we decode
// with heic-convert (libheif via WASM — pure JS, no native binary, Vercel-safe)
// and then run ONE fast sharp pass to apply EXIF orientation, cap the size, and
// re-encode a clean JPEG.
// =============================================================
import sharp from 'sharp';

// Detect HEIC/HEIF from the content type OR the filename extension. Browsers
// are inconsistent: some send image/heic, some image/heif, some a blank or
// application/octet-stream type with only the .heic name to go on.
export function isHeic({ filename, contentType } = {}) {
  const ct = String(contentType || '').toLowerCase();
  if (ct.includes('heic') || ct.includes('heif')) return true;
  const name = String(filename || '').toLowerCase();
  return /\.(heic|heif)$/.test(name);
}

// Convert a HEIC/HEIF buffer → a JPEG buffer. THROWS on decode failure so the
// caller can fall back to keeping the original (we never silently lose a photo).
export async function convertHeicToJpeg(inputBuffer, { quality = 84, maxEdge = 4096 } = {}) {
  // Lazy-load: heic-convert pulls in a multi-MB WASM module; only touch it when
  // we actually hit a HEIC, so plain JPEG/PNG uploads pay nothing.
  const mod = await import('heic-convert');
  const convert = mod.default || mod;
  const jpegRaw = await convert({ buffer: inputBuffer, format: 'JPEG', quality: quality / 100 });
  // One light sharp pass: apply orientation, cap huge phone photos, re-encode.
  // Fast path (no mozjpeg) — ~0.2s for a 12MP image.
  const out = await sharp(Buffer.from(jpegRaw))
    .rotate()
    .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality })
    .toBuffer();
  return out;
}

// Swap a .heic/.heif extension for .jpg on a display filename.
export function toJpgName(name) {
  const n = String(name || 'photo');
  return /\.(heic|heif)$/i.test(n) ? n.replace(/\.(heic|heif)$/i, '.jpg') : `${n}.jpg`;
}

// Swap the extension on an R2 key so the JPEG lives beside (not on top of) the
// original path. Falls back to appending .jpg if there's no recognised ext.
export function toJpgKey(key) {
  const k = String(key || '');
  return /\.(heic|heif)$/i.test(k) ? k.replace(/\.(heic|heif)$/i, '.jpg') : `${k}.jpg`;
}
