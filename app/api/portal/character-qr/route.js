// GET /api/portal/character-qr?token=...
//   → an SVG QR code that opens THIS client's Character Build on a phone.
// Shown to desktop users (who can't do the "someone else photographs you" flow
// on a webcam). The encoded URL points at the portal home with ?start=character
// so it survives the phone's password login and then forwards into the capture.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import QRCode from 'qrcode';
import { getClientByToken } from '@/lib/portal';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  const client = await getClientByToken(token);
  if (!client) return NextResponse.json({ error: 'Portal not found' }, { status: 404 });

  // Only the signed-in owner of this portal can mint their QR.
  const authed = verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (authed !== client.id) return NextResponse.json({ error: 'Please sign in again' }, { status: 401 });

  const site = process.env.NEXT_PUBLIC_SITE_URL || `${url.protocol}//${url.host}`;
  const deepLink = `${site}/p/${token}?start=character`;

  let svg;
  try {
    svg = await QRCode.toString(deepLink, {
      type: 'svg',
      margin: 1,
      width: 320,
      errorCorrectionLevel: 'M',
      color: { dark: '#0b0710', light: '#ffffff' },
    });
  } catch (e) {
    return NextResponse.json({ error: 'Could not make QR', detail: String(e.message || e) }, { status: 500 });
  }

  return new NextResponse(svg, {
    status: 200,
    headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' },
  });
}
