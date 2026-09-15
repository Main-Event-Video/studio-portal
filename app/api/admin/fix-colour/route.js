// Repeatable backfill: re-encode photos already in R2 that carry a NON-sRGB
// colour profile (iPhone = Display P3) to true sRGB, IN PLACE (same key, same
// row). Admin-only. Why: Creatomate ignores embedded profiles, so a P3 photo
// renders ~15% duller (pink → salmon). See toSrgb in lib/heic.js.
//
//   GET  /api/admin/fix-colour?clientId=...   → dry run: { count, files } (downloads each file to inspect)
//   POST /api/admin/fix-colour { clientId, limit? } → { converted, skipped, failed, remaining }
//
// Safe to run repeatedly: a converted file has no profile and is skipped next
// time. Soft time budget; if `remaining > 0`, run again.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { getObjectBuffer, putFile } from '@/lib/r2';
import { toSrgb } from '@/lib/heic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function loadRows(db, clientId) {
  let q = db
    .from('studio_media')
    .select('id, client_id, r2_key, filename, content_type')
    .eq('kind', 'client_upload')
    .order('created_at', { ascending: true });
  if (clientId) q = q.eq('client_id', clientId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).filter((m) => /\.(jpe?g|png|webp)$/i.test(m.filename || '') || /^image\/(jpeg|png|webp)$/i.test(m.content_type || ''));
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const url = new URL(request.url);
  const clientId = url.searchParams.get('clientId') || null;
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });
  const db = createServiceClient();
  try {
    const rows = await loadRows(db, clientId);
    const files = [];
    for (const m of rows) {
      try {
        const buf = await getObjectBuffer(m.r2_key);
        const r = await toSrgb(buf);
        files.push({ id: m.id, filename: m.filename, profile: r.profile, needsFix: r.changed });
      } catch (e) { files.push({ id: m.id, filename: m.filename, error: String(e.message || e) }); }
    }
    return NextResponse.json({ count: files.filter((f) => f.needsFix).length, files });
  } catch (e) {
    return NextResponse.json({ error: 'Could not scan', detail: String(e.message || e) }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let body = {};
  try { body = await request.json(); } catch { /* optional body */ }
  const clientId = body?.clientId || null;
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });
  const limit = Number.isFinite(body?.limit) ? Math.max(1, Math.trunc(body.limit)) : 50;

  const db = createServiceClient();
  let rows;
  try { rows = await loadRows(db, clientId); } catch (e) {
    return NextResponse.json({ error: 'Could not scan', detail: String(e.message || e) }, { status: 500 });
  }

  const started = Date.now();
  const BUDGET_MS = 45000;
  const converted = [], failed = [];
  let skipped = 0, processed = 0;

  for (const m of rows) {
    if (converted.length >= limit) break;
    if (Date.now() - started > BUDGET_MS - 5000 && processed > 0) break;
    processed++;
    try {
      const buf = await getObjectBuffer(m.r2_key);
      const r = await toSrgb(buf);
      if (!r.changed) { skipped++; continue; }
      await putFile(m.r2_key, r.buffer, 'image/jpeg');
      const { error: upErr } = await db.from('studio_media')
        .update({ content_type: 'image/jpeg', size_bytes: r.buffer.length }).eq('id', m.id);
      if (upErr) throw new Error(upErr.message);
      converted.push({ id: m.id, filename: m.filename, profile: r.profile });
    } catch (e) {
      failed.push({ id: m.id, filename: m.filename, error: String(e.message || e) });
    }
  }

  const remaining = rows.length - processed;
  return NextResponse.json({ ok: true, converted, skipped, failed, remaining, total: rows.length });
}
