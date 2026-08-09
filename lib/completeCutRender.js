// Shared completion for a watermarked rough-cut render. Called by BOTH the
// Creatomate webhook (fast path) AND the admin status poll (reliable backstop),
// so delivery no longer depends on the webhook firing at all.
//
// Concurrency-safe: a render is "claimed" (status rendering → processing) with a
// guarded UPDATE before any heavy work, so the webhook and a poll can't both
// deliver it. The finished file's R2 key is also an idempotency guard.
import { getRender } from '@/lib/creatomate';
import { putFile, deleteFile } from '@/lib/r2';
import { sendCutReady, sendCutWatermarkFailed } from '@/lib/email';

const now = () => new Date().toISOString();

export async function completeCutRender(db, cutRenderId) {
  const { data: row } = await db
    .from('studio_cut_renders')
    .select('id, client_id, render_id, status, version, filename, deliver_to, note, raw_key')
    .eq('id', cutRenderId)
    .single();
  if (!row) return { status: 'missing' };
  if (row.status === 'ready' || row.status === 'failed') return { status: row.status };
  if (!row.render_id) return { status: 'rendering' };

  let render;
  try { render = await getRender(row.render_id); }
  catch { return { status: 'rendering' }; }

  const { data: client } = await db
    .from('studio_clients')
    .select('id, display_name, email, portal_token')
    .eq('id', row.client_id)
    .single();
  if (!client) return { status: 'rendering' };

  // ---- FAILED render → mark failed once, alert Josh, deliver nothing ----
  if (render.status === 'failed') {
    const reason = String(render.error_message || render.error || 'Render failed');
    const { data: claim } = await db
      .from('studio_cut_renders')
      .update({ status: 'failed', error: reason.slice(0, 500), updated_at: now() })
      .eq('id', row.id).in('status', ['rendering', 'processing'])
      .select('id');
    if (Array.isArray(claim) && claim.length) {
      try { await sendCutWatermarkFailed({ client, version: row.version || '', error: reason, rawKey: row.raw_key || '' }); } catch { /* alert best-effort */ }
    }
    return { status: 'failed', error: reason };
  }

  // ---- Not finished yet ----
  if (render.status !== 'succeeded' || !render.url) return { status: 'rendering' };

  // ---- SUCCEEDED. Idempotency: if the finished file is already recorded, done. ----
  const key = `studio/${client.id}/cuts/${row.render_id}.mp4`;
  const { data: existing } = await db.from('studio_media').select('id').eq('r2_key', key).limit(1);
  if (Array.isArray(existing) && existing.length) {
    await db.from('studio_cut_renders').update({ status: 'ready', updated_at: now() }).eq('id', row.id);
    return { status: 'ready', already: true };
  }

  // Claim it so a concurrent webhook+poll can't both deliver.
  const { data: claim } = await db
    .from('studio_cut_renders')
    .update({ status: 'processing', updated_at: now() })
    .eq('id', row.id).eq('status', 'rendering')
    .select('id');
  if (!Array.isArray(claim) || !claim.length) return { status: 'processing' }; // someone else has it

  // Any transient failure below reverts to 'rendering' so a later poll retries.
  const revert = async () => { await db.from('studio_cut_renders').update({ status: 'rendering', updated_at: now() }).eq('id', row.id); };

  let buf;
  try {
    const res = await fetch(render.url);
    if (!res.ok) { await revert(); return { status: 'rendering' }; }
    buf = Buffer.from(await res.arrayBuffer());
  } catch { await revert(); return { status: 'rendering' }; }

  try { await putFile(key, buf, 'video/mp4'); }
  catch { await revert(); return { status: 'rendering' }; }

  const record = {
    client_id: client.id, kind: 'rough_cut', r2_key: key,
    filename: row.filename || 'cut.mp4', content_type: 'video/mp4',
    watermarked: true, note: row.note || null, version: row.version || null,
  };
  let { error: insErr } = await db.from('studio_media').insert(record);
  if (insErr && /version/i.test(insErr.message || '')) {
    delete record.version;
    ({ error: insErr } = await db.from('studio_media').insert(record));
  }
  if (insErr) { await revert(); return { status: 'rendering' }; }

  await db.from('studio_cut_renders').update({ status: 'ready', updated_at: now() }).eq('id', row.id);
  await db.from('studio_messages').insert({
    client_id: client.id,
    subject: `Rough cut sent${row.version ? ` (${row.version})` : ''}${row.deliver_to ? ` to ${row.deliver_to}` : ''}`,
    note: row.note || null,
  });
  try { await sendCutReady({ client, kind: 'rough_cut', note: row.note || '', version: row.version || '', to: row.deliver_to || '' }); } catch { /* can be resent from the tool */ }
  if (row.raw_key) { try { await deleteFile(row.raw_key); } catch { /* orphan harmless */ } }

  return { status: 'ready' };
}
