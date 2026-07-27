// One-time (repeatable) backfill: convert HEIC/HEIF photos already stored in R2
// to JPEG, in place. Admin-only. Runs in the deployed env (has R2 + Supabase
// creds). Safe to run repeatedly — it only touches rows that are still HEIC.
//
//   GET  /api/admin/convert-heic[?clientId=...]  → dry run: { count, files }
//   POST /api/admin/convert-heic  { clientId?, limit? }
//        → converts a batch, returns { converted, failed, remaining }
//
// A soft time budget stops before the serverless timeout so it works on any
// plan; if `remaining > 0`, just run it again to continue.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { getObjectBuffer, putFile, deleteFile } from '@/lib/r2';
import { isHeic, convertHeicToJpeg, toJpgName, toJpgKey } from '@/lib/heic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function loadHeicRows(db, clientId) {
  let q = db
    .from('studio_media')
    .select('id, client_id, r2_key, filename, content_type')
    .eq('kind', 'client_upload')
    .order('created_at', { ascending: true });
  if (clientId) q = q.eq('client_id', clientId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).filter((m) => isHeic({ filename: m.filename, contentType: m.content_type }));
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const url = new URL(request.url);
  const clientId = url.searchParams.get('clientId') || null;
  const db = createServiceClient();
  try {
    const rows = await loadHeicRows(db, clientId);
    return NextResponse.json({ count: rows.length, files: rows.map((r) => ({ id: r.id, filename: r.filename })) });
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
  const limit = Number.isFinite(body?.limit) ? Math.max(1, Math.trunc(body.limit)) : 50;

  const db = createServiceClient();
  let rows;
  try { rows = await loadHeicRows(db, clientId); } catch (e) {
    return NextResponse.json({ error: 'Could not scan', detail: String(e.message || e) }, { status: 500 });
  }

  const started = Date.now();
  const BUDGET_MS = 45000; // stay well under maxDuration; also safe-ish on lower plans
  const converted = [];
  const failed = [];
  let processed = 0;

  for (const m of rows) {
    if (processed >= limit) break;
    // Leave room for one more (~4s) conversion before the budget runs out.
    if (Date.now() - started > BUDGET_MS - 5000 && processed > 0) break;
    processed++;
    try {
      const heicBuf = await getObjectBuffer(m.r2_key);
      const jpegBuf = await convertHeicToJpeg(heicBuf);
      const jpgKey = toJpgKey(m.r2_key);
      await putFile(jpgKey, jpegBuf, 'image/jpeg');
      const { error: upErr } = await db
        .from('studio_media')
        .update({ r2_key: jpgKey, filename: toJpgName(m.filename), content_type: 'image/jpeg', size_bytes: jpegBuf.length })
        .eq('id', m.id);
      if (upErr) throw new Error(upErr.message);
      // Replace: remove the HEIC original now the JPEG is stored + the row points at it.
      if (jpgKey !== m.r2_key) { try { await deleteFile(m.r2_key); } catch { /* orphan is harmless */ } }
      converted.push({ id: m.id, filename: toJpgName(m.filename) });
    } catch (e) {
      failed.push({ id: m.id, filename: m.filename, error: String(e.message || e) });
    }
  }

  const remaining = rows.length - converted.length;
  return NextResponse.json({ ok: true, converted, failed, remaining, total: rows.length });
}
