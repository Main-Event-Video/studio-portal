// Admin "Character builds" panel data (#12).
// GET  /api/admin/character?characterId=...
//   → { name, program, total, done, shots:[{slot,label,group,filename,url,has}], extras:[{filename,url}] }
//     Every captured reference shot with a short-lived signed view URL, laid out
//     in the canonical 12-pose order (like the client's review page), plus the
//     character's own extra uploads and the saved target program.
// POST /api/admin/character  { characterId, program }
//   → saves which AI tool this character is being built for. program is one of
//     PROGRAMS (or null to clear). Admin-only.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { getViewUrl } from '@/lib/r2';
import { POSES, poseForSortNumber } from '@/lib/characterPoses';
import { getCharacter } from '@/lib/characters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The AI tools the studio exports for. Keep in sync with the sheet's
// PROGRAM_INFO (lib/characterSheet.js) and the admin dropdown.
export const PROGRAMS = ['openart', 'higgsfield', 'midjourney', 'lora'];

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const characterId = new URL(request.url).searchParams.get('characterId');
  if (!characterId) return NextResponse.json({ error: 'Missing characterId' }, { status: 400 });

  const db = createServiceClient();
  const ch = await getCharacter(db, characterId);
  if (!ch) return NextResponse.json({ error: 'Character not found' }, { status: 404 });

  const { data: rows } = await db
    .from('studio_media')
    .select('id, r2_key, filename, sort_number, content_type, created_at')
    .eq('client_id', ch.client_id).eq('kind', 'client_upload').eq('folder_path', ch.folder_path)
    .order('sort_number', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  const imgs = (rows || []).filter((r) => (r.content_type || 'image/').startsWith('image/'));
  const bySlot = new Map();
  const extraRows = [];
  for (const r of imgs) {
    const pose = poseForSortNumber(r.sort_number);
    if (pose && !bySlot.has(r.sort_number)) bySlot.set(r.sort_number, r);
    else extraRows.push(r);
  }

  const shots = [];
  for (let i = 1; i <= POSES.length; i++) {
    const p = POSES[i - 1];
    const row = bySlot.get(i) || null;
    let url = null;
    if (row) { try { url = await getViewUrl(row.r2_key, 3600); } catch { /* leave null */ } }
    shots.push({ slot: i, label: p.short || p.label, group: p.group, filename: row?.filename || null, url, has: !!row });
  }
  const extras = [];
  for (const r of extraRows) {
    let url = null;
    try { url = await getViewUrl(r.r2_key, 3600); } catch { /* leave null */ }
    extras.push({ filename: r.filename || null, url });
  }

  // program column may not exist yet (pre sql/012) — never let that 500 the panel.
  let program = null;
  try {
    const { data } = await db.from('studio_characters').select('program').eq('id', characterId).maybeSingle();
    program = data?.program || null;
  } catch { /* pre-migration */ }

  return NextResponse.json({
    name: ch.name || '',
    program,
    total: POSES.length,
    done: shots.filter((s) => s.has).length,
    shots,
    extras,
  });
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }); }
  const { characterId } = body || {};
  if (!characterId) return NextResponse.json({ error: 'Missing characterId' }, { status: 400 });

  const program = body.program == null || body.program === '' ? null : String(body.program).toLowerCase();
  if (program && !PROGRAMS.includes(program)) {
    return NextResponse.json({ error: 'Unknown program' }, { status: 400 });
  }

  const db = createServiceClient();
  const { error } = await db.from('studio_characters').update({ program }).eq('id', characterId);
  if (error) return NextResponse.json({ error: 'Could not save program', detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, program });
}
