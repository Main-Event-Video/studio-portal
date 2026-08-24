// PATCH /api/admin/clients/:id
//   { action: "reset_password" } → re-derives lastname+MMDD, re-hashes, returns plaintext
//   { action: "toggle_archive" } → flips archived
//   { action: "set_details" }    → fix a typo made at setup (name / email / event)
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

  if (body.action === 'set_character_name') {
    const name = typeof body.character_name === 'string' ? body.character_name.trim() : '';
    const { error } = await db.from('studio_clients').update({ character_name: name || null }).eq('id', id);
    if (error) return NextResponse.json({ error: 'Could not save name', detail: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, character_name: name || null });
  }

  if (body.action === 'set_admin_info') {
    const info = body.admin_info;
    if (info == null || typeof info !== 'object' || Array.isArray(info)) {
      return NextResponse.json({ error: 'admin_info must be an object' }, { status: 400 });
    }
    const { error } = await db.from('studio_clients').update({ admin_info: info }).eq('id', id);
    if (error) return NextResponse.json({ error: 'Could not save info', detail: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Fix a setup typo. The email is the client's PORTAL USERNAME, so correcting it
  // changes what they sign in with — which is the point when it was mistyped and
  // they could never sign in at all, but it does mean any credentials already
  // sent out are stale.
  //
  // The password is NOT touched. It was hashed from last_name + event_date at
  // creation, so an existing password keeps working even if those are corrected
  // here; only a future "Reset password" would derive from the new values.
  if (body.action === 'set_details') {
    const patch = {};
    const str = (v) => (typeof v === 'string' ? v.trim() : '');

    if ('display_name' in body) {
      const v = str(body.display_name);
      if (!v) return NextResponse.json({ error: 'Client name cannot be empty' }, { status: 400 });
      patch.display_name = v;
    }
    if ('last_name' in body) {
      const v = str(body.last_name);
      if (!v) return NextResponse.json({ error: 'Last name cannot be empty' }, { status: 400 });
      patch.last_name = v.toLowerCase();
    }
    if ('email' in body) {
      const v = str(body.email).toLowerCase();
      // Deliberately loose: the job here is to catch a fat-fingered address, not
      // to adjudicate what a valid mailbox looks like.
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        return NextResponse.json({ error: 'That does not look like an email address' }, { status: 400 });
      }
      patch.email = v;
    }
    if ('event_date' in body) {
      const v = str(body.event_date);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        return NextResponse.json({ error: 'Event date must be YYYY-MM-DD' }, { status: 400 });
      }
      patch.event_date = v;
    }
    if ('event_type' in body) patch.event_type = str(body.event_type) || null;

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });
    }

    const { error } = await db.from('studio_clients').update(patch).eq('id', id);
    if (error) {
      // 23505 = the unique index on email
      const friendly = error.code === '23505'
        ? 'Another client already uses that email address'
        : 'Could not save changes';
      return NextResponse.json({ error: friendly, detail: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...patch });
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
