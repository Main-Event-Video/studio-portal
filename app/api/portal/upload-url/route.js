import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUploadUrl } from '@/lib/r2';
import { getClientByToken } from '@/lib/portal';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const { token, contentType } = body || {};
  if (!token || !contentType) {
    return NextResponse.json({ error: 'Missing file info' }, { status: 400 });
  }

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: 'Portal not found' }, { status: 404 });

  const authed = verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (authed !== client.id) {
    return NextResponse.json({ error: 'Please sign in again' }, { status: 401 });
  }

  try {
    const { url, key } = await getUploadUrl(client.id, contentType);
    return NextResponse.json({ url, key });
  } catch (e) {
    return NextResponse.json({ error: 'Could not start upload', detail: e.message }, { status: 500 });
  }
}
