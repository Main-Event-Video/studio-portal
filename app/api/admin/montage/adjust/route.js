// POST /api/admin/montage/adjust  { montageId, adjustments }
// Persists in-progress framing picks onto the montage row so a page refresh
// never loses them. Pure bookkeeping — no render is triggered here.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const { montageId, adjustments } = body || {};
  if (!montageId || typeof adjustments !== 'object') {
    return NextResponse.json({ error: 'Missing montageId or adjustments' }, { status: 400 });
  }

  const db = createServiceClient();
  const { data: m, error: findErr } = await db
    .from('studio_montages')
    .select('id, params')
    .eq('id', montageId)
    .single();
  if (findErr || !m) return NextResponse.json({ error: 'Montage not found' }, { status: 404 });

  const { error } = await db
    .from('studio_montages')
    .update({ params: { ...(m.params || {}), adjustments }, updated_at: new Date().toISOString() })
    .eq('id', montageId);
  if (error) return NextResponse.json({ error: 'Could not save', detail: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
