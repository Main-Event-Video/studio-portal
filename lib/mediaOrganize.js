// Shared file-organize actions for studio_media (client_upload rows only).
// Used by BOTH the admin route and the portal route so the two stay in sync.
// The portal passes { allowDelete: false } so clients can reorder / rename /
// move their uploads but never delete — only the studio (admin) can delete.
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

  if (action === 'renameFolder') {
    // Move every file in folder `from` to `to` (blank `to` → loose files).
    const from = body.from;
    const to = body.to && String(body.to).trim() ? String(body.to).trim() : null;
    let q = scope(db.from('studio_media').update({ folder_path: to }));
    q = from == null || from === '' ? q.is('folder_path', null) : q.eq('folder_path', from);
    const { error } = await q;
    if (error) return { error: 'Could not rename folder', detail: error.message, status: 500 };
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

  return { error: 'Unknown action', status: 400 };
}
