// Shared file-organize actions for studio_media (client_upload rows only).
// Used by BOTH the admin route and the portal route so the two stay in sync.
// The portal passes { allowDelete: true } so clients can reorder / rename /
// move AND delete their OWN uploads (every query is scoped to this client's
// client_upload rows — never other clients or delivered cuts/montages).
import { deleteFile } from '@/lib/r2';

// db: a service-role Supabase client. clientId: the owning client. body: the
// parsed request body ({ action, ... }). Returns { ok } or { error, status }.
export async function applyMediaAction(db, clientId, body, { allowDelete = false } = {}) {
  const action = body?.action;
  // Every query is scoped to this client's own uploads — never touches other
  // clients or delivered cuts/montages.
  const scope = (q) => q.eq('client_id', clientId).eq('kind', 'client_upload');

  if (action === 'update') {
    const { id } = body;
    if (!id) return { error: 'Missing file id', status: 400 };
    const patch = {};
    if (typeof body.filename === 'string' && body.filename.trim()) patch.filename = body.filename.trim();
    if ('folderPath' in body) {
      const fp = body.folderPath == null ? null : String(body.folderPath).trim();
      patch.folder_path = fp || null; // '' or blank → loose file
    }
    if ('sortNumber' in body) {
      const n = body.sortNumber;
      patch.sort_number = n === null || n === '' ? null : Number.isFinite(Number(n)) ? Math.trunc(Number(n)) : null;
    }
    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await scope(db.from('studio_media').update(patch)).eq('id', id);
    if (error) return { error: 'Could not update file', detail: error.message, status: 500 };
    return { ok: true };
  }

  if (action === 'renumber') {
    // ids in the desired order → sort_number 1..n. Scoped per client.
    const ids = Array.isArray(body.ids) ? body.ids : [];
    let i = 1;
    for (const id of ids) {
      const { error } = await scope(db.from('studio_media').update({ sort_number: i })).eq('id', id);
      if (error) return { error: 'Could not renumber', detail: error.message, status: 500 };
      i++;
    }
    return { ok: true };
  }

  if (action === 'createBox') {
    // Create a new (empty) album. Seeds a studio_boxes row so it shows up even
    // with no photos yet; position goes to the end.
    const name = String(body.name || '').trim();
    if (!name) return { error: 'Album needs a name', status: 400 };
    if (/^trash$/i.test(name)) return { error: '"Trash" is a reserved name — please pick a different album name.', status: 400 };
    const { data: last } = await db.from('studio_boxes')
      .select('position').eq('client_id', clientId).order('position', { ascending: false }).limit(1);
    const position = last && last[0] ? (last[0].position ?? 0) + 1 : 0;
    const { error } = await db.from('studio_boxes').insert({ client_id: clientId, name, position });
    if (error && error.code !== '23505') return { error: 'Could not create album', detail: error.message, status: 500 }; // 23505 = already exists → fine
    return { ok: true };
  }

  if (action === 'deleteBox') {
    // Delete an EMPTY album only — never orphan photos. Refuses if any of this
    // client's photos still live in it.
    const name = String(body.name || '').trim();
    if (!name) return { error: 'Missing album name', status: 400 };
    const { count, error: ce } = await scope(db.from('studio_media').select('id', { count: 'exact', head: true })).eq('folder_path', name);
    if (ce) return { error: 'Could not check album', detail: ce.message, status: 500 };
    if ((count || 0) > 0) return { error: "Album isn't empty — move or remove its photos first.", status: 400 };
    const { error } = await db.from('studio_boxes').delete().eq('client_id', clientId).eq('name', name);
    if (error) return { error: 'Could not delete album', detail: error.message, status: 500 };
    return { ok: true };
  }

  if (action === 'renameFolder') {
    // Move every file in folder `from` to `to` (blank `to` → loose files).
    const from = body.from;
    const to = body.to && String(body.to).trim() ? String(body.to).trim() : null;
    // Never rename INTO the reserved system-trash name.
    if (to && /^trash$/i.test(to)) return { error: '"Trash" is a reserved name — please pick a different album name.', status: 400 };
    let q = scope(db.from('studio_media').update({ folder_path: to }));
    q = from == null || from === '' ? q.is('folder_path', null) : q.eq('folder_path', from);
    const { error } = await q;
    if (error) return { error: 'Could not rename folder', detail: error.message, status: 500 };
    // Keep the album (studio_boxes) row in sync so no ghost/empty album is left
    // behind under the OLD name (the bug that made renames look like they failed).
    if (from) {
      if (to) {
        const { error: be } = await db.from('studio_boxes').update({ name: to }).eq('client_id', clientId).eq('name', from);
        // A box named `to` already exists → photos are already merged in; drop the old box.
        if (be && be.code === '23505') await db.from('studio_boxes').delete().eq('client_id', clientId).eq('name', from);
      } else {
        // renamed into "loose" → the album no longer holds photos; remove its box.
        await db.from('studio_boxes').delete().eq('client_id', clientId).eq('name', from);
      }
    }
    return { ok: true };
  }

  if (action === 'delete') {
    if (!allowDelete) return { error: 'Not allowed', status: 403 };
    const { id } = body;
    if (!id) return { error: 'Missing file id', status: 400 };
    const { data: row } = await scope(db.from('studio_media').select('r2_key').eq('id', id)).maybeSingle();
    const { error } = await scope(db.from('studio_media').delete()).eq('id', id);
    if (error) return { error: 'Could not delete file', detail: error.message, status: 500 };
    // Best-effort remove the object; an orphaned R2 blob is invisible + harmless.
    if (row?.r2_key) { try { await deleteFile(row.r2_key); } catch { /* ignore */ } }
    return { ok: true };
  }

  if (action === 'deleteMany') {
    // Used by "Empty Trash" — admin only.
    if (!allowDelete) return { error: 'Not allowed', status: 403 };
    const ids = Array.isArray(body.ids) ? body.ids : [];
    for (const id of ids) {
      const { data: row } = await scope(db.from('studio_media').select('r2_key').eq('id', id)).maybeSingle();
      const { error } = await scope(db.from('studio_media').delete()).eq('id', id);
      if (error) return { error: 'Could not delete files', detail: error.message, status: 500 };
      if (row?.r2_key) { try { await deleteFile(row.r2_key); } catch { /* ignore */ } }
    }
    return { ok: true };
  }

  // ---- Non-destructive HIDE for a whole album (box) + its photos ------------
  // "Hide album" stamps hidden_at on the studio_boxes row AND every one of its
  // client_upload photos, so the album + all its images disappear from the
  // timeline / montage maker / portal (those queries filter hidden_at IS NULL)
  // WITHOUT deleting anything. Allowed for clients too (it's reversible — a
  // client can never erase real files this way). 'unhideBox' clears both stamps.
  if (action === 'hideBox' || action === 'unhideBox') {
    const name = String(body.name || '').trim();
    if (!name) return { error: 'Missing album name', status: 400 };
    const ts = action === 'hideBox' ? new Date().toISOString() : null;
    // Album record (best-effort — the album may be "implied" with no studio_boxes row).
    await db.from('studio_boxes').update({ hidden_at: ts }).eq('client_id', clientId).eq('name', name);
    // Every photo in the album (scoped to this client's own uploads).
    const { error } = await scope(db.from('studio_media').update({ hidden_at: ts })).eq('folder_path', name);
    if (error) return { error: action === 'hideBox' ? 'Could not hide album' : 'Could not restore album', detail: error.message, status: 500 };
    return { ok: true };
  }

  return { error: 'Unknown action', status: 400 };
}
