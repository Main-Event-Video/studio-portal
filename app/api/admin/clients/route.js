// GET  /api/admin/clients        → list clients (admin only)
// POST /api/admin/clients        → create client, returns credentials + link
// All DB access via service-role client (RLS deny-by-default for browsers).
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

// goldberg + 2026-09-21 → "goldberg0921"
function buildPassword(lastName, eventDate) {
  const base = lastName.toLowerCase().replace(/[^a-z]/g, '');
  const [, mm, dd] = eventDate.split('-'); // YYYY-MM-DD
  return `${base}${mm}${dd}`;
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = createServiceClient();
  const { data, error } = await db
    .from('studio_clients')
    .select('id, display_name, last_name, email, portal_token, event_date, event_type, archived, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Could not load clients', detail: error.message }, { status: 500 });
  }

  // Per-client upload stats: how many files THEY uploaded, and when they last did.
  // One pass over their own uploads (kind='client_upload'); non-fatal if it fails.
  const stats = {};
  const { data: media } = await db
    .from('studio_media')
    .select('client_id, created_at')
    .eq('kind', 'client_upload');
  for (const m of media || []) {
    const s = stats[m.client_id] || (stats[m.client_id] = { upload_count: 0, last_upload_at: null });
    s.upload_count += 1;
    if (!s.last_upload_at || m.created_at > s.last_upload_at) s.last_upload_at = m.created_at;
  }

  const clients = (data || []).map((c) => ({
    ...c,
    upload_count: stats[c.id]?.upload_count || 0,
    last_upload_at: stats[c.id]?.last_upload_at || null,
  }));
  return NextResponse.json({ clients });
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { display_name, last_name, email, event_date, event_type } = body || {};
  if (!display_name || !last_name || !email || !event_date) {
    return NextResponse.json(
      { error: 'display_name, last_name, email, and event_date are required' },
      { status: 400 }
    );
  }

  const password = buildPassword(last_name, event_date);
  const password_hash = await bcrypt.hash(password, 10);

  const db = createServiceClient();
  const { data, error } = await db
    .from('studio_clients')
    .insert({
      display_name,
      last_name: last_name.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      password_hash,
      event_date,
      event_type: event_type || null,
    })
    .select('id, display_name, email, portal_token, event_date, event_type')
    .single();

  if (error) {
    const friendly = error.code === '23505' ? 'A client with that email already exists' : 'Could not create client';
    return NextResponse.json({ error: friendly, detail: error.message }, { status: 500 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  return NextResponse.json({
    client: data,
    credentials: { username: data.email, password },
    portal_link: `${siteUrl}/p/${data.portal_token}`,
  });
}
