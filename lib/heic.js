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

// Sniff the REAL image format from magic bytes — filenames/extensions lie
// (e.g. a JPEG saved as ".HEIC"). Returns 'heic' | 'jpeg' | 'png' | 'webp' |
// 'gif' | 'avif' | 'unknown'.
export function sniffImageType(buf) {
  if (!buf || buf.length < 12) return 'unknown';
  const b = buf;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
  // ISO-BMFF 'ftyp' box (HEIC/HEIF/AVIF share it); brand sits at bytes 8–11.
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]).toLowerCase();
    if (brand.startsWith('avi')) return 'avif';
    return 'heic'; // heic/heix/mif1/msf1/etc — let the HEIC decoder try
  }
  return 'unknown';
}

// Turn ANY flagged image buffer into a clean JPEG. A real HEIC decodes via
// heic-convert; anything sharp can already read (JPEG/PNG/WebP/GIF/AVIF) is
// re-encoded directly — this rescues files mis-named .heic that were never
// actually HEIC. THROWS with a clear, logged message when the bytes aren't a
// decodable image (truly corrupt), so the caller can report it precisely.
export async function anyImageToJpeg(inputBuffer, { quality = 84, maxEdge = 4096 } = {}) {
  const type = sniffImageType(inputBuffer);
  if (type === 'heic') return convertHeicToJpeg(inputBuffer, { quality, maxEdge });
  if (type === 'jpeg' || type === 'png' || type === 'webp' || type === 'gif' || type === 'avif') {
    return sharp(inputBuffer)
      .rotate()
      .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer();
  }
  const head = Buffer.from(inputBuffer.slice(0, 12)).toString('hex');
  throw new Error(`not a decodable image (sniffed '${type}', header ${head})`);
}
