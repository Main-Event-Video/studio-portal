// =============================================================
// MAIN EVENT STUDIO — multi-character data helpers (#9)
// One client can hold several named characters. Each character's 12 guided shots
// live in studio_media under the character's reserved folder_path (see sql/009);
// the name + AI write-up cache live on the studio_characters row.
// =============================================================
import { randomUUID } from 'crypto';
import { CHAR_FOLDER, POSE_COUNT, characterFolderPath } from '@/lib/characterPoses';

const MAX_NAME = 60;
export function cleanName(name) {
  const n = String(name == null ? '' : name).replace(/\s+/g, ' ').trim();
  return n ? n.slice(0, MAX_NAME) : null;
}

// Fetch one character row (raw), or null.
export async function getCharacter(db, characterId) {
  if (!characterId) return null;
  const { data } = await db
    .from('studio_characters')
    .select('id, client_id, name, folder_path, position, done_at, character_profile, character_profile_sig, created_at')
    .eq('id', characterId)
    .maybeSingle();
  return data || null;
}

// Create a new character for a client. The client's FIRST character adopts the
// canonical legacy folder (__character_build__); later ones namespace by id.
export async function createCharacter(db, clientId, name) {
  const id = randomUUID();
  const { data: existing } = await db
    .from('studio_characters')
    .select('id, folder_path, position')
    .eq('client_id', clientId);
  const rows = existing || [];
  const legacyTaken = rows.some((r) => r.folder_path === CHAR_FOLDER);
  const folderPath = rows.length === 0 && !legacyTaken ? CHAR_FOLDER : characterFolderPath(id);
  const position = rows.reduce((m, r) => Math.max(m, r.position ?? 0), -1) + 1;

  const { data, error } = await db
    .from('studio_characters')
    .insert({ id, client_id: clientId, name: cleanName(name), folder_path: folderPath, position })
    .select('id, client_id, name, folder_path, position, done_at, created_at')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// Resolve the character to act on. With an id, validates it belongs to the
// client. Without one (legacy callers / QR deep-link), returns the first
// character, creating one if the client has none yet.
export async function ensureCharacter(db, clientId, characterId, name) {
  if (characterId) {
    const c = await getCharacter(db, characterId);
    return c && c.client_id === clientId ? c : null;
  }
  const { data: first } = await db
    .from('studio_characters')
    .select('id, client_id, name, folder_path, position, done_at, created_at')
    .eq('client_id', clientId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (first) return first;
  return createCharacter(db, clientId, name);
}

export async function renameCharacter(db, characterId, name) {
  const { error } = await db.from('studio_characters').update({ name: cleanName(name) }).eq('id', characterId);
  if (error) throw new Error(error.message);
}

export async function markCharacterDone(db, characterId) {
  const stamp = new Date().toISOString();
  await db.from('studio_characters').update({ done_at: stamp }).eq('id', characterId);
}

// Soft-delete: hide from the roster but keep the row + R2 photos (recoverable).
export async function markCharacterDeleted(db, characterId) {
  const stamp = new Date().toISOString();
  const { error } = await db.from('studio_characters').update({ deleted_at: stamp }).eq('id', characterId);
  if (error) throw new Error(error.message);
}

// The roster shown on the photo-drop page: each character with its progress.
export async function listCharacters(db, clientId) {
  const cols = 'id, name, folder_path, position, done_at, created_at';
  // Hide soft-deleted characters. Fall back if sql/011 (deleted_at) hasn't run.
  let { data: chars, error } = await db
    .from('studio_characters')
    .select(cols)
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) {
    ({ data: chars } = await db
      .from('studio_characters')
      .select(cols)
      .eq('client_id', clientId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true }));
  }
  const list = chars || [];
  if (!list.length) return [];

  const folders = list.map((c) => c.folder_path);
  const { data: media } = await db
    .from('studio_media')
    .select('folder_path, sort_number, content_type')
    .eq('client_id', clientId)
    .eq('kind', 'client_upload')
    .in('folder_path', folders);

  const byFolder = new Map();
  for (const m of media || []) {
    if (!(m.content_type || 'image/').startsWith('image/')) continue;
    const arr = byFolder.get(m.folder_path) || [];
    arr.push(m);
    byFolder.set(m.folder_path, arr);
  }

  return list.map((c) => {
    const rows = byFolder.get(c.folder_path) || [];
    const slots = Array.from(
      new Set(rows.map((r) => r.sort_number).filter((n) => Number.isInteger(n) && n >= 1 && n <= POSE_COUNT)),
    ).sort((a, b) => a - b);
    const extras = rows.filter((r) => !Number.isInteger(r.sort_number)).length;
    return {
      id: c.id,
      name: c.name || '',
      folderPath: c.folder_path,
      position: c.position,
      doneAt: c.done_at,
      createdAt: c.created_at,
      slots,
      done: slots.length,
      total: POSE_COUNT,
      extras,
    };
  });
}
