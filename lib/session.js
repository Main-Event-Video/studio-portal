import crypto from 'crypto';

// Clients are NOT Supabase auth users (per handoff) — they log in against
// studio_clients and get a signed HttpOnly cookie binding them to their id.
export const SESSION_COOKIE = 'studio_portal';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret() {
  // Optional dedicated secret; otherwise reuse the service-role key (server-only, high entropy).
  return process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-only-secret';
}

export function signSession(clientId) {
  const payload = `${clientId}.${Date.now()}`;
  const b64 = Buffer.from(payload).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${b64}.${sig}`;
}

export function verifySession(value) {
  if (!value) return null;
  const [b64, sig] = value.split('.');
  if (!b64 || !sig) return null;
  const payload = Buffer.from(b64, 'base64url').toString();
  const expected = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const [clientId, ts] = payload.split('.');
  if (!clientId) return null;
  if (Date.now() - Number(ts) > SESSION_MAX_AGE * 1000) return null;
  return clientId;
}
