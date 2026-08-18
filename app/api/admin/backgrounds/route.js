// The studio-wide BACKGROUND LIBRARY — imported images and videos that any
// client's montage can use as its backdrop.
//
//   GET    /api/admin/backgrounds            → every background, newest first,
//                                              each with a presigned view URL
//   POST   /api/admin/backgrounds            → { filename, contentType } gets a
//                                              presigned PUT so the browser
//                                              uploads straight to R2 (a 400MB
//                                              background video never touches
//                                              Vercel)
//   DELETE /api/admin/backgrounds?key=…      → remove one
//
// These are NOT client-scoped: they live under studio-backgrounds/ so a look
// imported once shows up for every client. Listing comes straight from R2, so
// there is no table to migrate.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import {
  listBackgrounds, getBackgroundUploadUrl, getViewUrl, deleteFile,
  BACKGROUND_PREFIX, backgroundKind,
} from '@/lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Only the formats Creatomate can actually fetch and decode. A .mov with an
// exotic codec is the classic way to get a render that fails ten minutes in, so
// the picker refuses it up front rather than at render time.
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const items = await listBackgrounds();
    const backgrounds = await Promise.all(items.map(async (b) => ({
      ...b,
      url: await getViewUrl(b.key, 3600),
    })));
    return NextResponse.json({ backgrounds });
  } catch (e) {
    return NextResponse.json({ error: 'Could not list backgrounds', detail: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }); }

  const { filename, contentType } = body || {};
  if (!filename || !contentType) {
    return NextResponse.json({ error: 'Missing file info' }, { status: 400 });
  }
  if (![...IMAGE_TYPES, ...VIDEO_TYPES].includes(String(contentType))) {
    return NextResponse.json({
      error: `Backgrounds must be JPEG, PNG or WebP images, or MP4/MOV/WebM video (got ${contentType}).`,
    }, { status: 400 });
  }

  try {
    const { url, key } = await getBackgroundUploadUrl(filename, contentType);
    return NextResponse.json({ url, key, kind: backgroundKind(key) });
  } catch (e) {
    return NextResponse.json({ error: 'Could not start upload', detail: e.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const key = new URL(request.url).searchParams.get('key');
  // Guard the prefix: this endpoint must never be usable to delete a client's
  // photos or a finished render.
  if (!key || !key.startsWith(BACKGROUND_PREFIX)) {
    return NextResponse.json({ error: 'Not a background key' }, { status: 400 });
  }
  try {
    await deleteFile(key);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Could not delete', detail: e.message }, { status: 500 });
  }
}
