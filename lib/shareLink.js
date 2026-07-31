import crypto from 'crypto';

// Stateless, unguessable, tamper-proof share token for a single delivered media
// row. token = base64url(mediaId) + '.' + HMAC(mediaId). No DB row needed; the
// signature makes ids non-enumerable and the link durable (it never carries the
// short-lived presigned R2 URL — the share route mints a fresh one on each open).
function secret() {
  // Same secret basis as the portal session (server-only, high entropy).
  return process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-only-secret';
}

export function makeShareToken(mediaId) {
  const id = String(mediaId);
  const b64 = Buffer.from(id).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(id).digest('base64url');
  return `${b64}.${sig}`;
}

export function verifyShareToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [b64, sig] = token.split('.');
  if (!b64 || !sig) return null;
  let mediaId;
  try { mediaId = Buffer.from(b64, 'base64url').toString(); } catch { return null; }
  const expected = crypto.createHmac('sha256', secret()).update(mediaId).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return mediaId || null;
}
