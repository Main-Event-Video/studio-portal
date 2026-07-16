// POST /api/portal/login-email  { email, password }
// Email + password sign-in for returning clients (the "Client Portal" button
// on the Squarespace site lands here — no private link needed). On success we
// set the same signed session cookie used by the private-link flow and return
// the client's portal_token so the browser can go to /p/{token}.
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

  const email = (body?.email || '').toLowerCase().trim();
  const password = body?.password || '';
  if (!email || !password) {
    return NextResponse.json({ error: 'Enter your email and password' }, { status: 400 });
  }

  const db = createServiceClient();
  const { data: client, error } = await db
    .from('studio_clients')
    .select('id, portal_token, password_hash, archived')
    .eq('email', email)
    .single();

  // Same generic message whether the email is unknown or the password is wrong,
  // so the form doesn't reveal which emails exist.
  const generic = "That email and password didn't match. Try again.";
  if (error || !client || client.archived) {
    return NextResponse.json({ error: generic }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, client.password_hash);
  if (!ok) {
    return NextResponse.json({ error: generic }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, token: client.portal_token });
  res.cookies.set(SESSION_COOKIE, signSession(client.id), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
