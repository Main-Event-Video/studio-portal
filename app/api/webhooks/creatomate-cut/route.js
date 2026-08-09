// POST /api/webhooks/creatomate-cut — Creatomate calls this when a rough-cut
// WATERMARK render changes state. It's now just a FAST-PATH nudge: it verifies the
// render, reads the tracking-row id from the render's metadata, and hands off to
// the shared completion logic. The admin status-poll calls that same logic, so if
// this webhook never fires (Creatomate's callbacks are unreliable here), delivery
// still completes on the next poll. Completion is idempotent, so both firing is fine.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { getRender } from '@/lib/creatomate';
import { completeCutRender } from '@/lib/completeCutRender';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request) {
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }); }

  const claimed = Array.isArray(body) ? body[0] : body;
  if (!claimed?.id) return NextResponse.json({ error: 'No render ID' }, { status: 400 });

  // Never trust the posted body — re-fetch the render to read its metadata (the
  // tracking-row id we set when the render was created).
  let render;
  try { render = await getRender(claimed.id); }
  catch { return NextResponse.json({ error: 'Render not found' }, { status: 400 }); }

  const cutRenderId = render.metadata;
  if (!cutRenderId) return NextResponse.json({ error: 'No tracking id' }, { status: 400 });

  const db = createServiceClient();
  let result;
  try { result = await completeCutRender(db, cutRenderId); }
  catch (e) {
    console.error('Cut webhook completion error', e?.message || e);
    return NextResponse.json({ error: 'Completion failed' }, { status: 500 }); // let Creatomate retry
  }
  return NextResponse.json({ received: true, status: result.status });
}
