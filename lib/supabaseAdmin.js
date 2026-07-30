// Service-role client for server routes ONLY. Never import in client code.
// Pattern copied from MEvid (webhook/public-API direct pattern).
import { createClient } from '@supabase/supabase-js';

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY, // LEGACY service_role key, starts "eyJ"
    {
      auth: { autoRefreshToken: false, persistSession: false },
      // Next.js patches global fetch and stores GET responses under ~2MB in its
      // Data Cache — even inside `export const dynamic = 'force-dynamic'` routes,
      // because force-dynamic opts the ROUTE out of caching but NOT the internal
      // Supabase fetch. Result: small per-client reads (e.g. a single client's
      // photo timeline) get cached and served STALE after a reorder write, so the
      // new order never shows even though the write landed. Forcing no-store on
      // every service-client request guarantees server reads always reflect the
      // latest DB state (reorders, trash, counts, and the montage render order).
      global: {
        fetch: (url, options = {}) => fetch(url, { ...options, cache: 'no-store' }),
      },
    }
  );
}
