// GET /api/portal/character-sheet?token=...&characterId=...[&download=1]
//   → streams the client's OWN character build sheet PNG. Session-gated like the
//     other portal routes. Uses the CACHED write-up only (generateProfile:false)
//     so a client viewing their sheet never triggers a paid API call.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { getClientByToken } from '@/lib/portal';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { buildCharacterSheet } from '@/lib/characterSheet';
import { getCharacter } from '@/lib/characters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const characterId = url.searchParams.get('characterId');
  if (!token || !characterId) return NextResponse.json({ error: 'Missing token or character' }, { status: 400 });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: 'Portal not found' }, { status: 404 });

  const authed = verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (authed !== client.id) return NextResponse.json({ error: 'Please sign in again' }, { status: 401 });

  const db = createServiceClient();
  const character = await getCharacter(db, characterId);
  if (!character || character.client_id !== client.id) {
    return NextResponse.json({ error: 'Character not found' }, { status: 404 });
  }

  let sheet;
  try {
    // Reuse the cached write-up; never bill the API from a client view.
    sheet = await buildCharacterSheet(db, character.id, { character, generateProfile: false });
  } catch (e) {
    return NextResponse.json({ error: 'Could not build sheet', detail: String(e.message || e) }, { status: 500 });
  }
  if (!sheet.buffer || sheet.count < 1) {
    return NextResponse.json({ error: 'No character shots yet.' }, { status: 404 });
  }

  const disp = url.searchParams.get('download') ? 'attachment' : 'inline';
  return new NextResponse(sheet.buffer, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `${disp}; filename="my-character-sheet.png"`,
      'Cache-Control': 'no-store',
    },
  });
}
