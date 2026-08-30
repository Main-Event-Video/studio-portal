// GET /api/admin/character-sheet?characterId=...&download=1
//   → builds ONE character's Character Build sheet PNG on demand and streams it.
// GET /api/admin/character-sheet?list=1&clientId=...
//   → JSON roster of the client's characters (id, name, progress) for the UI.
// Back-compat: ?clientId=... with no characterId builds the client's FIRST
//   character. Admin-only. download=1 forces a file download.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { buildCharacterSheet } from '@/lib/characterSheet';
import { listCharacters } from '@/lib/characters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const db = createServiceClient();

  // Roster mode for the admin UI.
  if (url.searchParams.get('list') === '1') {
    const clientId = url.searchParams.get('clientId');
    if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
    const characters = await listCharacters(db, clientId);
    return NextResponse.json({ characters });
  }

  let characterId = url.searchParams.get('characterId');
  const clientId = url.searchParams.get('clientId');
  if (!characterId && clientId) {
    // Back-compat: build the client's first character.
    const chars = await listCharacters(db, clientId);
    if (!chars.length) return NextResponse.json({ error: 'This client has no character shots yet.' }, { status: 404 });
    characterId = chars[0].id;
  }
  if (!characterId) return NextResponse.json({ error: 'Missing characterId' }, { status: 400 });

  const nameOverride = url.searchParams.get('name');
  // Target AI program to stamp on the sheet (openart/higgsfield/midjourney/lora).
  const program = url.searchParams.get('program') || '';
  // regenerate=1 forces a fresh AI write-up (bypasses the cache), e.g. if you
  // want a new take. Normal downloads reuse the cached write-up — no re-billing.
  const force = url.searchParams.get('regenerate') === '1';
  let sheet;
  try {
    sheet = await buildCharacterSheet(db, characterId, {
      ...(nameOverride ? { name: nameOverride } : {}),
      ...(program ? { program } : {}),
      ...(force ? { force: true } : {}),
    });
  } catch (e) {
    return NextResponse.json({ error: 'Could not build sheet', detail: String(e.message || e) }, { status: 500 });
  }
  if (!sheet.buffer || sheet.count < 1) {
    return NextResponse.json({ error: 'This character has no shots yet.' }, { status: 404 });
  }

  const download = url.searchParams.get('download');
  const disp = download ? 'attachment' : 'inline';
  return new NextResponse(sheet.buffer, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `${disp}; filename="character-build-sheet.png"`,
      'Cache-Control': 'no-store',
    },
  });
}
