// PATCH /api/admin/clients/:id
//   { action: "reset_password" } → re-derives lastname+MMDD, re-hashes, returns plaintext
//   { action: "toggle_archive" } → flips archived
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = params;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const db = createServiceClient();
  const { data: client, error: findErr } = await db
    .from('studio_clients')
    .select('id, last_name, event_date, archived, email')
    .eq('id', id)
    .single();

  if (findErr || !client) {
    return NextResponse.json({ error: 'Client not found', detail: findErr?.message }, { status: 404 });
  }

  if (body.action === 'reset_password') {
    const [, mm, dd] = String(client.event_date).split('-');
    const password = `${client.last_name.toLowerCase().replace(/[^a-z]/g, '')}${mm}${dd}`;
    const password_hash = await bcrypt.hash(password, 10);
    const { error } = await db.from('studio_clients').update({ password_hash }).eq('id', id);
    if (error) return NextResponse.json({ error: 'Reset failed', detail: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, credentials: { username: client.email, password } });
  }

  if (body.action === 'toggle_archive') {
    const { error } = await db
      .from('studio_clients')
      .update({ archived: !client.archived })
      .eq('id', id);
    if (error) return NextResponse.json({ error: 'Update failed', detail: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, archived: !client.archived });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
