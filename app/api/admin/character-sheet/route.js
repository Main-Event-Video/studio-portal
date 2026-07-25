// GET /api/admin/character-sheet?clientId=...&download=1
//   → generates the client's Character Build sheet PNG on demand and streams it.
//     Admin-only. download=1 forces a file download; otherwise it renders inline.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { buildCharacterSheet } from '@/lib/characterSheet';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const clientId = url.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });

  const db = createServiceClient();
  const nameOverride = url.searchParams.get('name');
  let sheet;
  try {
    sheet = await buildCharacterSheet(db, clientId, nameOverride ? { name: nameOverride } : {});
  } catch (e) {
    return NextResponse.json({ error: 'Could not build sheet', detail: String(e.message || e) }, { status: 500 });
  }
  if (!sheet.buffer || sheet.count < 1) {
    return NextResponse.json({ error: 'This client has no character shots yet.' }, { status: 404 });
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
