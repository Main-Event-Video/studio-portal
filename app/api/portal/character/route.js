// Client-facing "Character Build" holding area (reserved folders, NOT in the
// montage/timeline). Multi-character (#9): one client can hold several named
// characters; each character's shots live under its own folder_path.
//
// GET  /api/portal/character?token=...            → { characters: [...] } roster
// POST /api/portal/character  { token, action, ... }
//   action 'create' { name }                       — start a new named character
//   action 'rename' { characterId, name }          — rename a character
//   action 'slot'   { characterId, sortNumber, key, filename, contentType }
//       — a guided shot for slot 1..12. Retake-safe: replaces any existing shot
//         in that slot for THIS character (deletes old R2 object + row first).
//   action 'extra'  { characterId, key, filename, contentType }
//       — the client's own uploaded shot (no fixed slot; sort_number = null).
//   action 'done'   { characterId }
//       — client finished this character; build the sheet and email the studio.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { getClientByToken } from '@/lib/portal';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { deleteFile } from '@/lib/r2';
import { POSE_COUNT } from '@/lib/characterPoses';
import { buildCharacterSheet } from '@/lib/characterSheet';
import { sendCharacterSheetReady } from '@/lib/email';
import {
  listCharacters, getCharacter, createCharacter, ensureCharacter,
  renameCharacter, markCharacterDone,
} from '@/lib/characters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveClient(token) {
  if (!token) return { error: 'Missing portal token', status: 400 };
  const client = await getClientByToken(token);
  if (!client) return { error: 'Portal not found', status: 404 };
  if (client.archived) return { error: 'This portal is archived', status: 400 };
  const authed = verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (authed !== client.id) return { error: 'Please sign in again', status: 401 };
  return { client };
}

// Roster for the photo-drop page.
export async function GET(request) {
  const token = new URL(request.url).searchParams.get('token');
  const r = await resolveClient(token);
  if (r.error) return NextResponse.json({ error: r.error }, { status: r.status });
  const db = createServiceClient();
  const characters = await listCharacters(db, r.client.id);
  return NextResponse.json({ characters });
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }); }

  const { token, action } = body || {};
  const r = await resolveClient(token);
  if (r.error) return NextResponse.json({ error: r.error }, { status: r.status });
  const client = r.client;
  const db = createServiceClient();

  if (action === 'create') {
    try {
      const character = await createCharacter(db, client.id, body.name);
      return NextResponse.json({
        ok: true,
        character: { id: character.id, name: character.name || '', folderPath: character.folder_path },
      });
    } catch (e) {
      return NextResponse.json({ error: 'Could not create character', detail: e.message }, { status: 500 });
    }
  }

  if (action === 'rename') {
    const character = await getCharacter(db, body.characterId);
    if (!character || character.client_id !== client.id) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 });
    }
    try { await renameCharacter(db, character.id, body.name); return NextResponse.json({ ok: true }); }
    catch (e) { return NextResponse.json({ error: 'Could not rename', detail: e.message }, { status: 500 }); }
  }

  // slot / extra / done all act on ONE character. ensureCharacter validates the
  // id against the client (or resolves/creates a legacy one if none is given).
  const character = await ensureCharacter(db, client.id, body.characterId, body.name);
  if (!character) return NextResponse.json({ error: 'Character not found' }, { status: 404 });
  const folder = character.folder_path;

  if (action === 'slot') {
    const sortNumber = Number(body.sortNumber);
    if (!Number.isInteger(sortNumber) || sortNumber < 1 || sortNumber > POSE_COUNT) {
      return NextResponse.json({ error: 'Bad shot number' }, { status: 400 });
    }
    if (!body.key || !body.filename) return NextResponse.json({ error: 'Missing file info' }, { status: 400 });

    // Retake: note any existing shot(s) in this slot for THIS character, but SAVE
    // THE NEW ONE FIRST so a failed insert can never leave the slot empty.
    const { data: old } = await db
      .from('studio_media')
      .select('id, r2_key')
      .eq('client_id', client.id).eq('kind', 'client_upload')
      .eq('folder_path', folder).eq('sort_number', sortNumber);

    const { error } = await db.from('studio_media').insert({
      client_id: client.id, kind: 'client_upload', r2_key: body.key,
      filename: String(body.filename), folder_path: folder,
      sort_number: sortNumber, content_type: body.contentType || 'image/jpeg', watermarked: false,
    });
    if (error) return NextResponse.json({ error: 'Could not save shot', detail: error.message }, { status: 500 });

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
      filename: String(body.filename), folder_path: folder,
      sort_number: null, content_type: body.contentType || null, watermarked: false,
    });
    if (error) return NextResponse.json({ error: 'Could not save shot', detail: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'done') {
    await markCharacterDone(db, character.id);
    // Generate the sheet + email the studio. Best-effort: never block the client.
    try {
      const { buffer, count, profile, name } = await buildCharacterSheet(db, character.id);
      if (buffer && count > 0) {
        await sendCharacterSheetReady({ client, character, buffer, count, profile, name })
          .catch((e) => console.error('sheet email failed:', e?.message));
      }
    } catch (e) {
      console.error('character-done failed:', e?.message);
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
