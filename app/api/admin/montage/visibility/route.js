// POST /api/admin/montage/visibility  { montageId, hidden }
// Hides (or unhides) a render by flagging params.hidden. Non-destructive — the
// render and its file are untouched; it's just filtered out of the default list.
// Deleting is a separate, later step.
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
  const { montageId, hidden } = body || {};
  if (!montageId) return NextResponse.json({ error: 'Missing montageId' }, { status: 400 });

  const db = createServiceClient();
  const { data: m, error: findErr } = await db
    .from('studio_montages')
    .select('id, params')
    .eq('id', montageId)
    .single();
  if (findErr || !m) return NextResponse.json({ error: 'Montage not found' }, { status: 404 });

  const { error } = await db
    .from('studio_montages')
    .update({ params: { ...(m.params || {}), hidden: !!hidden }, updated_at: new Date().toISOString() })
    .eq('id', montageId);
  if (error) return NextResponse.json({ error: 'Could not update', detail: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, hidden: !!hidden });
}
