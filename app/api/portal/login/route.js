import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const { token, password } = body || {};
  if (!token || !password) {
    return NextResponse.json({ error: 'Enter your password' }, { status: 400 });
  }

  const db = createServiceClient();
  const { data: client, error } = await db
    .from('studio_clients')
    .select('id, password_hash, archived')
    .eq('portal_token', token)
    .single();

  if (error || !client || client.archived) {
    return NextResponse.json({ error: 'Portal not found', detail: error?.message }, { status: 404 });
  }

  const ok = await bcrypt.compare(password, client.password_hash);
  if (!ok) {
    return NextResponse.json({ error: "That password didn't match. Try again." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, signSession(client.id), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
