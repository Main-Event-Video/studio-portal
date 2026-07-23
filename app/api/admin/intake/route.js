// GET /api/admin/intake?clientId=...
//   → the client's submitted intake questionnaire (read-only, admin only).
//     Returns { intake: null } when they haven't filled it out yet.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const clientId = url.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });

  const db = createServiceClient();
  const { data, error } = await db
    .from('studio_intake')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle(); // no row yet → data null, no error

  if (error) {
    return NextResponse.json({ error: 'Could not load intake', detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ intake: data || null });
}
