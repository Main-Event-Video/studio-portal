// Stable per-photo IMPORT NUMBER (001, 002, 003 …) — a permanent reference id
// for each uploaded photo that NEVER changes when the photo is reordered or
// moved between albums. It reflects the order photos were imported.
//
// How it stays permanent: a photo's number is stored in studio_media.import_seq
// (sql/015). We lazily assign a number to any upload that doesn't have one yet
// — continuing from the current max, in created_at (import) order — and persist
// it, so once a photo has a number it keeps it forever (deleting an earlier
// photo leaves a gap rather than renumbering the rest).
//
// Degrades gracefully: if the import_seq column isn't there yet (migration not
// run), we fall back to a computed created_at rank so numbers still show —
// they're just not delete-permanent until the column exists.
//
// Returns { byId: Map<id, n>, byKey: Map<r2_key, n> } for this client's uploads.
export async function importSeqMap(db, clientId) {
  // Try WITH the column (ordered by import order = created_at, then id tiebreak).
  const withCol = await db
    .from('studio_media')
    .select('id, r2_key, import_seq, created_at')
    .eq('client_id', clientId)
    .eq('kind', 'client_upload')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });

  // Column missing (pre-migration) → pure computed rank, no persistence.
  if (withCol.error) {
    const { data } = await db
      .from('studio_media')
      .select('id, r2_key, created_at')
      .eq('client_id', clientId)
      .eq('kind', 'client_upload')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });
    const byId = new Map();
    const byKey = new Map();
    (data || []).forEach((r, i) => { byId.set(r.id, i + 1); if (r.r2_key) byKey.set(r.r2_key, i + 1); });
    return { byId, byKey };
  }

  const rows = withCol.data || [];
  // Highest number already handed out (deterministic → concurrent reads agree).
  let max = 0;
  for (const r of rows) if (Number.isFinite(r.import_seq)) max = Math.max(max, r.import_seq);
  // Assign numbers to any not-yet-numbered uploads, continuing from max.
  const toFill = [];
  for (const r of rows) {
    if (!Number.isFinite(r.import_seq)) { max += 1; r.import_seq = max; toFill.push({ id: r.id, seq: max }); }
  }
  // Persist the newly-assigned numbers (best-effort, chunked). Idempotent.
  if (toFill.length) {
    const CHUNK = 20;
    for (let i = 0; i < toFill.length; i += CHUNK) {
      await Promise.all(toFill.slice(i, i + CHUNK).map(({ id, seq }) =>
        db.from('studio_media').update({ import_seq: seq })
          .eq('client_id', clientId).eq('kind', 'client_upload').eq('id', id)
          .then(() => {}, () => {}))); // swallow write errors — display still works
    }
  }
  const byId = new Map();
  const byKey = new Map();
  for (const r of rows) { byId.set(r.id, r.import_seq); if (r.r2_key) byKey.set(r.r2_key, r.import_seq); }
  return { byId, byKey };
}

// Format a number as a 3-digit import label: 7 → "007", 142 → "142".
export function fmtImportNo(n) {
  return Number.isFinite(n) ? String(n).padStart(3, '0') : '';
}
