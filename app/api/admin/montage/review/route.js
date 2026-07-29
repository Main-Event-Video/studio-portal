// POST /api/admin/montage/review  { montageId, viewed?, starred? }
// Records lightweight review state on a render (stored in params, like `hidden`):
//   • viewed:true    → the admin has watched it (flips "Ready to view" → "Viewed")
//   • starred:true   → marked a keeper (gold ★, floats to the top of the list)
// Only the provided fields are changed. Non-destructive.
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
  const { montageId, viewed, starred } = body || {};
  if (!montageId) return NextResponse.json({ error: 'Missing montageId' }, { status: 400 });

  const db = createServiceClient();
  const { data: m, error: findErr } = await db
    .from('studio_montages')
    .select('id, params')
    .eq('id', montageId)
    .single();
  if (findErr || !m) return NextResponse.json({ error: 'Montage not found' }, { status: 404 });

  const next = { ...(m.params || {}) };
  if (viewed !== undefined) next.viewed = !!viewed;
  if (starred !== undefined) next.starred = !!starred;

  const { error } = await db
    .from('studio_montages')
    .update({ params: next, updated_at: new Date().toISOString() })
    .eq('id', montageId);
  if (error) return NextResponse.json({ error: 'Could not update', detail: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, viewed: next.viewed === true, starred: next.starred === true });
}
