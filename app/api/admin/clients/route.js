// GET  /api/admin/clients        → list clients (admin only)
// POST /api/admin/clients        → create client, returns credentials + link
// All DB access via service-role client (RLS deny-by-default for browsers).
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { isCharacterFolder } from '@/lib/characterPoses';

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
  const base = 'id, display_name, last_name, email, portal_token, event_date, event_type, archived, created_at';
  // Prefer including the optional columns; step down gracefully if a migration
  // hasn't run yet (sql/007 character_name, sql/010 admin_info) so the list
  // never breaks.
  const order = { ascending: false };
  let { data, error } = await db.from('studio_clients').select(`${base}, character_name, admin_info`).order('created_at', order);
  if (error) {
    ({ data, error } = await db.from('studio_clients').select(`${base}, character_name`).order('created_at', order));
  }
  if (error) {
    ({ data, error } = await db.from('studio_clients').select(base).order('created_at', order));
  }
  if (error) {
    return NextResponse.json({ error: 'Could not load clients', detail: error.message }, { status: 500 });
  }

  // Per-client upload stats. upload_count is the BILLABLE count — how many
  // photos the client is actively USING — so it excludes anything they've
  // removed: soft-hidden (hidden_at) or trashed (folder_path = Trash, i.e.
  // flagged for removal). Hard-deleted rows are already gone. last_upload_at
  // still reflects when they last uploaded anything. Non-fatal if it fails;
  // hidden_at is selected defensively so a pre-migration DB (no such column)
  // can't zero out every count.
  const TRASH_FOLDER = 'Trash'; // must match the portal/timeline constant
  const stats = {};
  const runStats = (cols) =>
    db.from('studio_media').select(cols).eq('kind', 'client_upload');
  let { data: media, error: mediaErr } = await runStats('client_id, created_at, folder_path, hidden_at');
  if (mediaErr) ({ data: media } = await runStats('client_id, created_at, folder_path'));
  for (const m of media || []) {
    const s = stats[m.client_id] || (stats[m.client_id] = { upload_count: 0, trash_count: 0, file_count: 0, last_upload_at: null });
    // last_upload_at = when they last uploaded anything (even if later removed).
    if (!s.last_upload_at || m.created_at > s.last_upload_at) s.last_upload_at = m.created_at;
    // Hidden photos are excluded everywhere (client never sees them) — skip entirely.
    if (m.hidden_at) continue;
    // Trashed = set aside for removal: tracked separately, NOT in the billable count.
    if (m.folder_path === TRASH_FOLDER) { s.trash_count += 1; continue; }
    s.upload_count += 1; // active / billable
    // file_count = the client's actual project photos — EXCLUDES the reserved
    // character-build shots so the "Files" tab lights up only for real uploads.
    if (!isCharacterFolder(m.folder_path)) s.file_count += 1;
  }

  // Per-client status flags for the admin tab badges (green when "loaded").
  // Bulk (one query each), best-effort: a missing table/column must never break
  // the client list.
  const intakeDone = new Set();
  try {
    const { data: intakeRows } = await db.from('studio_intake').select('client_id');
    for (const r of intakeRows || []) intakeDone.add(r.client_id);
  } catch { /* intake table absent — leave all un-flagged */ }

  const charDone = new Set();
  try {
    let { data: charRows, error: charErr } = await db
      .from('studio_characters').select('client_id, done_at, deleted_at').not('done_at', 'is', null);
    if (charErr) {
      ({ data: charRows } = await db
        .from('studio_characters').select('client_id, done_at').not('done_at', 'is', null));
    }
    for (const r of charRows || []) { if (r.done_at && !r.deleted_at) charDone.add(r.client_id); }
  } catch { /* characters table absent — leave all un-flagged */ }

  const clients = (data || []).map((c) => ({
    ...c,
    upload_count: stats[c.id]?.upload_count || 0,
    trash_count: stats[c.id]?.trash_count || 0,
    last_upload_at: stats[c.id]?.last_upload_at || null,
    has_files: (stats[c.id]?.file_count || 0) > 0,
    intake_submitted: intakeDone.has(c.id),
    character_done: charDone.has(c.id),
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
