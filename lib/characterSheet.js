// =============================================================
// MAIN EVENT STUDIO — Character Build Sheet (single labeled PNG)
// Composites the client's captured/uploaded reference shots into ONE labeled
// grid image, ready to drop straight into an AI image tool as reference.
// Used on-demand by the admin route and on completion by the portal.
// =============================================================
import sharp from 'sharp';
import { getViewUrl } from '@/lib/r2';
import { CHAR_FOLDER, POSES, poseForSortNumber } from '@/lib/characterPoses';

// layout constants (px)
const COLS = 4;
const IMG = 380;          // square thumbnail edge
const LABEL_H = 48;       // label strip under each thumbnail
const GAP = 24;
const HEADER_H = 132;
const BG = '#0d0913';
const CELL_H = IMG + LABEL_H;

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function fetchImageBuffer(r2Key) {
  const url = await getViewUrl(r2Key, 1800);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch image failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

// db: service-role client. Returns { buffer, count, missing } — buffer is a PNG.
// count = how many real shots are in the sheet. missing = labels not yet taken.
export async function buildCharacterSheet(db, clientId) {
  const { data: clientRow } = await db.from('studio_clients').select('display_name').eq('id', clientId).single();
  const clientName = clientRow?.display_name || 'Client';

  const { data: rows } = await db
    .from('studio_media')
    .select('id, r2_key, filename, sort_number, content_type, created_at')
    .eq('client_id', clientId).eq('kind', 'client_upload').eq('folder_path', CHAR_FOLDER)
    .order('sort_number', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  const all = (rows || []).filter((r) => (r.content_type || 'image/').startsWith('image/'));

  // Build the ordered cell list: 12 labeled pose slots (filled or "missing"),
  // then any of the client's own extra uploads.
  const bySlot = new Map();
  const extras = [];
  for (const r of all) {
    const pose = poseForSortNumber(r.sort_number);
    if (pose && !bySlot.has(r.sort_number)) bySlot.set(r.sort_number, r);
    else extras.push(r);
  }

  const cells = [];
  POSES.forEach((p, i) => cells.push({ label: p.label, row: bySlot.get(i + 1) || null }));
  extras.forEach((r, i) => cells.push({ label: `Additional ${i + 1}`, row: r }));

  const count = cells.filter((c) => c.row).length;
  const missing = cells.filter((c) => !c.row && POSES.some((p) => p.label === c.label)).map((c) => c.label);

  const rowsN = Math.ceil(cells.length / COLS);
  const width = COLS * IMG + (COLS + 1) * GAP;
  const height = HEADER_H + rowsN * CELL_H + (rowsN + 1) * GAP;

  const cellX = (i) => GAP + (i % COLS) * (IMG + GAP);
  const cellY = (i) => HEADER_H + GAP + Math.floor(i / COLS) * (CELL_H + GAP);

  // Composite images first, then a single SVG overlay for all text + frames.
  const composites = [];
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (!c.row) continue;
    try {
      const buf = await fetchImageBuffer(c.row.r2_key);
      const thumb = await sharp(buf).rotate().resize(IMG, IMG, { fit: 'cover', position: 'attention' }).png().toBuffer();
      composites.push({ input: thumb, left: cellX(i), top: cellY(i) });
    } catch {
      // leave the slot empty if the image can't be fetched
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const svgParts = [];
  svgParts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="${BG}"/>`);
  svgParts.push(`<text x="${GAP}" y="56" font-family="sans-serif" font-size="40" font-weight="700" fill="#f4f1f8">${esc(clientName)} — Character Build Sheet</text>`);
  svgParts.push(`<text x="${GAP}" y="94" font-family="sans-serif" font-size="22" fill="#8fb0cc">${count} reference shot${count === 1 ? '' : 's'} · Main Event Studio · ${today}</text>`);

  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const x = cellX(i); const y = cellY(i);
    if (!c.row) {
      // missing slot placeholder
      svgParts.push(`<rect x="${x}" y="${y}" width="${IMG}" height="${IMG}" rx="10" fill="#161022" stroke="#3a3350" stroke-width="2" stroke-dasharray="8 6"/>`);
      svgParts.push(`<text x="${x + IMG / 2}" y="${y + IMG / 2}" font-family="sans-serif" font-size="20" fill="#6b6480" text-anchor="middle">not taken yet</text>`);
    } else {
      svgParts.push(`<rect x="${x}" y="${y}" width="${IMG}" height="${IMG}" rx="10" fill="none" stroke="#2c2438" stroke-width="2"/>`);
    }
    // label strip
    svgParts.push(`<rect x="${x}" y="${y + IMG}" width="${IMG}" height="${LABEL_H}" fill="#1f1729"/>`);
    svgParts.push(`<text x="${x + IMG / 2}" y="${y + IMG + 31}" font-family="sans-serif" font-size="21" font-weight="600" fill="#eae6f0" text-anchor="middle">${esc(c.label)}</text>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${svgParts.join('')}</svg>`;

  const buffer = await sharp(Buffer.from(svg)).composite(composites).png().toBuffer();
  return { buffer, count, missing };
}
