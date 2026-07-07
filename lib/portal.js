import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

// Resolve a portal token → client row (service-role; RLS blocks browsers).
export async function getClientByToken(token) {
  if (!token) return null;
  const db = createServiceClient();
  const { data } = await db
    .from('studio_clients')
    .select('id, display_name, email, event_date, event_type, archived')
    .eq('portal_token', token)
    .single();
  return data || null;
}

// The client id proven by the signed cookie, or null.
export function getAuthedClientId() {
  const value = cookies().get(SESSION_COOKIE)?.value;
  return verifySession(value);
}
