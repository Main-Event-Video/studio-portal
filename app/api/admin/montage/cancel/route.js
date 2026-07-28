// POST /api/admin/montage/cancel  { montageId }
// Stops a queued/rendering montage: marks the row failed so it leaves the
// "rendering" state and the renders-list auto-refresh polling stops. Also makes a
// BEST-EFFORT call to Creatomate to drop the render (Creatomate has no documented
// cancel endpoint, so a render already in progress may still finish + bill on
// their side — the portal side always clears regardless).
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { cancelRender } from '@/lib/creatomate';

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
  const { montageId } = body || {};
  if (!montageId) return NextResponse.json({ error: 'Missing montageId' }, { status: 400 });

  const db = createServiceClient();
  const { data: m, error: findErr } = await db
    .from('studio_montages')
    .select('id, render_id, status')
    .eq('id', montageId)
    .single();
  if (findErr || !m) return NextResponse.json({ error: 'Montage not found' }, { status: 404 });
  if (m.status === 'ready') return NextResponse.json({ error: 'Render already finished' }, { status: 400 });

  let creatomate = { attempted: false };
  if (m.render_id) creatomate = await cancelRender(m.render_id);

  await db
    .from('studio_montages')
    .update({ status: 'failed', error: 'Cancelled', updated_at: new Date().toISOString() })
    .eq('id', m.id);

  return NextResponse.json({ ok: true, status: 'failed', creatomate });
}
