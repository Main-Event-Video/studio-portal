import crypto from 'crypto';

// Stateless, unguessable, tamper-proof share token for a single delivered media
// row — no DB row needed; the HMAC signature makes ids non-enumerable and the link
// durable (the share route mints a fresh presigned URL on each open).
//
// COMPACT format (new): base64url(16 raw UUID bytes) + '.' + base64url(HMAC[:12]).
//   → ~39 chars instead of ~90. Truncating the HMAC to 12 bytes (96 bits) still
//     makes forging a valid token for an arbitrary id computationally infeasible.
// LEGACY format (old): base64url(uuid-string) + '.' + base64url(full HMAC). Still
//   accepted on verify so links shared before this change keep working.
function secret() {
  return process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-only-secret';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bytesFromUuid = (id) => Buffer.from(id.replace(/-/g, ''), 'hex');            // 16 bytes
const uuidFromBytes = (buf) => {
  const h = buf.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

export function makeShareToken(mediaId) {
  const id = String(mediaId);
  if (UUID_RE.test(id)) {
    const b64 = bytesFromUuid(id).toString('base64url'); // 22 chars
    const sig = crypto.createHmac('sha256', secret()).update(id).digest().subarray(0, 12).toString('base64url'); // 16 chars
    return `${b64}.${sig}`;
  }
  // Non-UUID id (shouldn't happen for studio_media, but stay safe): legacy shape.
  const b64 = Buffer.from(id).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(id).digest('base64url');
  return `${b64}.${sig}`;
}

export function verifyShareToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [b64, sig] = token.split('.');
  if (!b64 || !sig) return null;
  let raw;
  try { raw = Buffer.from(b64, 'base64url'); } catch { return null; }

  let mediaId, expected;
  if (raw.length === 16) {
    // Compact format: 16 raw UUID bytes + truncated HMAC.
    mediaId = uuidFromBytes(raw);
    expected = crypto.createHmac('sha256', secret()).update(mediaId).digest().subarray(0, 12).toString('base64url');
  } else {
    // Legacy format: the id was encoded as its string.
    mediaId = raw.toString();
    expected = crypto.createHmac('sha256', secret()).update(mediaId).digest('base64url');
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return mediaId || null;
}

// --- Short slugs (DB-backed, sql/014) ---------------------------------------
// Once the share_slug column exists, delivered files get an 8-char slug so links
// read watch.maineventstudio.com/s/x7Kp9q42 instead of the signed token. Fully
// graceful: if the column isn't migrated yet, ensureSlug returns null and callers
// fall back to the HMAC token, and resolveShareId still handles legacy tokens.
export function newSlug() {
  return crypto.randomBytes(6).toString('base64url'); // 8 URL-safe chars, ~48 bits
}

export async function ensureSlug(db, mediaId) {
  try {
    const { data } = await db.from('studio_media').select('share_slug').eq('id', mediaId).maybeSingle();
    if (data && data.share_slug) return data.share_slug;
    for (let i = 0; i < 6; i++) {
      const slug = newSlug();
      const { error } = await db.from('studio_media').update({ share_slug: slug }).eq('id', mediaId).is('share_slug', null);
      if (!error) {
        const { data: a } = await db.from('studio_media').select('share_slug').eq('id', mediaId).maybeSingle();
        if (a && a.share_slug) return a.share_slug;
      }
      // unique collision or lost race → try a fresh slug
    }
  } catch { /* column not migrated yet → caller falls back to the HMAC token */ }
  return null;
}

// Resolve a URL segment (short slug OR legacy HMAC token) → media id, or null.
export async function resolveShareId(db, sid) {
  if (!sid || typeof sid !== 'string') return null;
  if (sid.includes('.')) return verifyShareToken(sid);        // legacy signed token
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(sid)) return null;
  try {
    const { data } = await db.from('studio_media').select('id').eq('share_slug', sid).maybeSingle();
    return data && data.id ? data.id : null;
  } catch { return null; }
}
