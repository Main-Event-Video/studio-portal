// Service-role client for server routes ONLY. Never import in client code.
// Pattern copied from MEvid (webhook/public-API direct pattern).
import { createClient } from '@supabase/supabase-js';

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY, // LEGACY service_role key, starts "eyJ"
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
