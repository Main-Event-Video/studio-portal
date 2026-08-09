// GET /api/admin/cut-status?clientId=...
// Returns the status of this client's recent watermark renders AND advances any
// that are still in flight (the reliable backstop that doesn't depend on the
// Creatomate webhook firing). The admin tool polls this after a send so Josh sees
// "watermarking… → delivered", and opening the tool also nudges pending ones along.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { completeCutRender } from '@/lib/completeCutRender';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const clientId = new URL(request.url).searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });

  const db = createServiceClient();
  let rows = [];
  try {
    const { data } = await db
      .from('studio_cut_renders')
      .select('id, status, version, filename, error, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(12);
    rows = Array.isArray(data) ? data : [];
  } catch {
    // Table not created yet → no cut renders to report.
    return NextResponse.json({ cuts: [] });
  }

  const out = [];
  for (const row of rows) {
    let status = row.status;
    let error = null;
    if (status === 'rendering' || status === 'processing') {
      const r = await completeCutRender(db, row.id);
      status = r.status;
      error = r.error || null;
    }
    out.push({ id: row.id, version: row.version, filename: row.filename, status, error });
  }
  return NextResponse.json({ cuts: out });
}
