// POST /api/portal/character  { token, action, ... }
// Client-facing "Character Build" holding area (reserved folder, NOT in the
// montage/timeline). All rows are kind='client_upload', folder_path=CHAR_FOLDER.
//   action 'slot'  { sortNumber, key, filename, contentType }
//       — a guided shot for slot 1..12. Retake-safe: replaces any existing shot
//         in that slot (deletes the old R2 object + row first).
//   action 'extra' { key, filename, contentType }
//       — the client's own uploaded shot (no fixed slot; sort_number = null).
//   action 'done'  { }
//       — client finished; generate the build sheet and email the studio.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { getClientByToken } from '@/lib/portal';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { deleteFile } from '@/lib/r2';
import { CHAR_FOLDER, POSE_COUNT } from '@/lib/characterPoses';
import { buildCharacterSheet } from '@/lib/characterSheet';
import { sendCharacterSheetReady } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }); }

  const { token, action } = body || {};
  if (!token) return NextResponse.json({ error: 'Missing portal token' }, { status: 400 });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: 'Portal not found' }, { status: 404 });
  if (client.archived) return NextResponse.json({ error: 'This portal is archived' }, { status: 400 });

  const authed = verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (authed !== client.id) return NextResponse.json({ error: 'Please sign in again' }, { status: 401 });

  const db = createServiceClient();

  if (action === 'slot') {
    const sortNumber = Number(body.sortNumber);
    if (!Number.isInteger(sortNumber) || sortNumber < 1 || sortNumber > POSE_COUNT) {
      return NextResponse.json({ error: 'Bad shot number' }, { status: 400 });
    }
    if (!body.key || !body.filename) return NextResponse.json({ error: 'Missing file info' }, { status: 400 });

    // Retake: note any existing shot(s) in this slot, but SAVE THE NEW ONE FIRST
    // so a failed insert can never leave the slot empty (data-safety).
    const { data: old } = await db
      .from('studio_media')
      .select('id, r2_key')
      .eq('client_id', client.id).eq('kind', 'client_upload')
      .eq('folder_path', CHAR_FOLDER).eq('sort_number', sortNumber);

    const { error } = await db.from('studio_media').insert({
      client_id: client.id, kind: 'client_upload', r2_key: body.key,
      filename: String(body.filename), folder_path: CHAR_FOLDER,
      sort_number: sortNumber, content_type: body.contentType || 'image/jpeg', watermarked: false,
    });
    if (error) return NextResponse.json({ error: 'Could not save shot', detail: error.message }, { status: 500 });

    // New shot is safely saved — now remove the superseded one(s).
    for (const row of old || []) {
      await db.from('studio_media').delete().eq('id', row.id);
      if (row.r2_key) { try { await deleteFile(row.r2_key); } catch { /* orphan blob is harmless */ } }
    }
    return NextResponse.json({ ok: true });
  }

  if (action === 'extra') {
    if (!body.key || !body.filename) return NextResponse.json({ error: 'Missing file info' }, { status: 400 });
    const { error } = await db.from('studio_media').insert({
      client_id: client.id, kind: 'client_upload', r2_key: body.key,
      filename: String(body.filename), folder_path: CHAR_FOLDER,
      sort_number: null, content_type: body.contentType || null, watermarked: false,
    });
    if (error) return NextResponse.json({ error: 'Could not save shot', detail: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'done') {
    // Generate the sheet + email the studio. Best-effort: never block the client.
    try {
      const { buffer, count, profile, name } = await buildCharacterSheet(db, client.id);
      if (buffer && count > 0) {
        await sendCharacterSheetReady({ client, buffer, count, profile, name }).catch((e) => console.error('sheet email failed:', e?.message));
      }
    } catch (e) {
      console.error('character-done failed:', e?.message);
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
