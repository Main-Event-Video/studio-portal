// Verifies the Bearer token from the admin browser belongs to Josh.
// Admin = Josh's existing Supabase auth user (shared project). The browser
// logs in with the anon key, then sends its access token to API routes.
import { createClient } from '@supabase/supabase-js';

export async function requireAdmin(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return { error: 'Not signed in', status: 401 };

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return { error: 'Invalid session', status: 401 };

  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
  if (!adminEmail || data.user.email?.toLowerCase() !== adminEmail) {
    return { error: 'Not authorized', status: 403 };
  }
  return { user: data.user };
}
