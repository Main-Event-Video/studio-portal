// =============================================================
// MAIN EVENT STUDIO — Character Build Sheet (premium, single PNG)
// A high-end labeled reference sheet: branded header, grouped sections with
// rounded thumbnails, and an AI-generated "Character Profile" write-up +
// paste-ready prompt. Built for both admin download and the completion email.
// =============================================================
import sharp from 'sharp';
import { getViewUrl } from '@/lib/r2';
import { CHAR_FOLDER, POSES, poseForSortNumber } from '@/lib/characterPoses';
import { generateCharacterProfile, profileRows } from '@/lib/characterProfile';

// ---- palette + metrics (premium dark) ----
const BG = '#0c0a12';
const PANEL = '#15111f';
const HAIR = '#2a2436';
const TEXT = '#f4f1f8';
const MUT = '#9aa4b2';
const GOLD = '#e6c77e';
const GOLD_DIM = '#b79a5e';
const VIOLET = '#8f7bff';

const W = 1680;
const M = 56;                    // outer margin
const COLS = 4;
const GAP = 22;
const IMG = Math.floor((W - 2 * M - (COLS - 1) * GAP) / COLS); // square edge
const LABEL_H = 46;
const RADIUS = 14;
const HEAD_H = 196;
const SEC_H = 56;                // section heading band

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// crude but reliable word-wrap for SVG text (no native wrapping).
function wrap(text, fontSize, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const cw = fontSize * 0.54;                 // avg char width for sans
  const max = Math.max(6, Math.floor(maxWidth / cw));
  const lines = [];
  let line = '';
  for (const w of words) {
    const cand = line ? `${line} ${w}` : w;
    if (cand.length > max && line) { lines.push(line); line = w; }
    else line = cand;
  }
  if (line) lines.push(line);
  return lines;
}

async function fetchImageBuffer(r2Key) {
  const url = await getViewUrl(r2Key, 1800);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch image failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

async function roundedThumb(buffer) {
  const base = await sharp(buffer).rotate().resize(IMG, IMG, { fit: 'cover', position: 'attention' }).toBuffer();
  const mask = Buffer.from(`<svg width="${IMG}" height="${IMG}"><rect width="${IMG}" height="${IMG}" rx="${RADIUS}" ry="${RADIUS}"/></svg>`);
  return sharp(base).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

// db: service-role client. opts.generateProfile (default true), opts.profile
// (inject; skips the API — used by tests). Returns { buffer, count, missing, profile }.
export async function buildCharacterSheet(db, clientId, opts = {}) {
  const { data: clientRow } = await db.from('studio_clients').select('display_name').eq('id', clientId).single();
  const clientName = clientRow?.display_name || 'Client';

  const { data: rows } = await db
    .from('studio_media')
    .select('id, r2_key, filename, sort_number, content_type, created_at')
    .eq('client_id', clientId).eq('kind', 'client_upload').eq('folder_path', CHAR_FOLDER)
    .order('sort_number', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  const all = (rows || []).filter((r) => (r.content_type || 'image/').startsWith('image/'));
  const bySlot = new Map();
  const extras = [];
  for (const r of all) {
    const pose = poseForSortNumber(r.sort_number);
    if (pose && !bySlot.has(r.sort_number)) bySlot.set(r.sort_number, r);
    else extras.push(r);
  }

  // sections (grouped)
  const faceItems = [];
  const bodyItems = [];
  POSES.forEach((p, i) => {
    const cell = { label: p.short || p.label, slug: p.slug, row: bySlot.get(i + 1) || null };
    (p.group === 'body' ? bodyItems : faceItems).push(cell);
  });
  const extraItems = extras.map((r, i) => ({ label: `Your photo ${i + 1}`, slug: `extra-${i}`, row: r }));
  const sections = [
    { title: 'Face — angles & expressions', items: faceItems },
    { title: 'Full body', items: bodyItems },
  ];
  if (extraItems.length) sections.push({ title: 'Additional (client’s own)', items: extraItems });

  const count = [...faceItems, ...bodyItems, ...extraItems].filter((c) => c.row).length;
  const missing = [...faceItems, ...bodyItems].filter((c) => !c.row).map((c) => c.label);

  // ---- load + round all thumbnails (and keep buffers for the AI write-up) ----
  const thumbs = [];   // { cell, input, left, top }
  const shotBuffers = []; // for the profile model
  // compute geometry as we go
  let y = HEAD_H;
  const placements = []; // { cell, x, y }
  for (const sec of sections) {
    y += SEC_H;
    sec.items.forEach((cell, idx) => {
      const col = idx % COLS;
      const rowN = Math.floor(idx / COLS);
      const x = M + col * (IMG + GAP);
      const cy = y + rowN * (IMG + LABEL_H + GAP);
      placements.push({ cell, x, y: cy });
    });
    const rowsN = Math.ceil(sec.items.length / COLS);
    y += rowsN * (IMG + LABEL_H + GAP);
    y += 14; // section spacing
  }
  const gridBottom = y + 6;

  for (const p of placements) {
    if (!p.cell.row) continue;
    try {
      const buf = await fetchImageBuffer(p.cell.row.r2_key);
      if (p.cell.slug && !p.cell.slug.startsWith('extra-')) shotBuffers.push({ buffer: buf, slug: p.cell.slug, label: p.cell.label });
      const thumb = await roundedThumb(buf);
      thumbs.push({ input: thumb, left: p.x, top: p.y });
    } catch { /* leave empty */ }
  }

  // ---- AI character write-up (best-effort) ----
  let profile = opts.profile || null;
  if (!profile && opts.generateProfile !== false && shotBuffers.length) {
    profile = await generateCharacterProfile(shotBuffers);
  }

  // ---- profile panel geometry ----
  const panelX = M;
  const panelW = W - 2 * M;
  const padX = 34;
  const innerW = panelW - 2 * padX;
  const rowsData = profileRows(profile);
  const summaryLines = profile?.summary ? wrap(profile.summary, 25, innerW) : [];
  const promptLines = profile?.ai_prompt ? wrap(profile.ai_prompt, 23, innerW - 32) : [];

  let panelH = 0;
  const attrColW = innerW / 2;
  const attrRows = Math.ceil(rowsData.length / 2);
  if (profile) {
    panelH = 24 + 40                         // heading + note
      + attrRows * 40 + 18                    // attribute rows
      + (summaryLines.length ? 34 + summaryLines.length * 32 + 14 : 0)
      + (promptLines.length ? 34 + 22 + promptLines.length * 30 + 22 : 0)
      + 24;
  } else {
    panelH = 96; // just the hint
  }
  const panelY = gridBottom + 24;
  const H = panelY + panelH + M;

  // ---- build the SVG (background, header, section headings, labels, panel) ----
  const s = [];
  s.push(`<rect width="${W}" height="${H}" fill="${BG}"/>`);
  // header
  s.push(`<rect x="0" y="0" width="${W}" height="4" fill="${GOLD}"/>`);
  s.push(`<text x="${M}" y="62" font-family="sans-serif" font-size="20" letter-spacing="7" font-weight="700" fill="${GOLD}">MAIN EVENT STUDIO</text>`);
  s.push(`<text x="${M}" y="120" font-family="sans-serif" font-size="52" font-weight="800" fill="${TEXT}">${esc(clientName)}</text>`);
  s.push(`<text x="${M}" y="156" font-family="sans-serif" font-size="24" font-weight="600" fill="${MUT}">Character Build Sheet</text>`);
  const today = new Date().toISOString().slice(0, 10);
  s.push(`<text x="${W - M}" y="120" text-anchor="end" font-family="sans-serif" font-size="21" font-weight="700" fill="${GOLD_DIM}">AI CHARACTER REFERENCE</text>`);
  s.push(`<text x="${W - M}" y="152" text-anchor="end" font-family="sans-serif" font-size="18" fill="${MUT}">${count} shot${count === 1 ? '' : 's'} · ${today}</text>`);
  s.push(`<rect x="${M}" y="${HEAD_H - 26}" width="${W - 2 * M}" height="1.5" fill="${HAIR}"/>`);

  // section headings
  {
    let yy = HEAD_H;
    for (const sec of sections) {
      s.push(`<text x="${M}" y="${yy + 34}" font-family="sans-serif" font-size="22" letter-spacing="3" font-weight="800" fill="${VIOLET}">${esc(sec.title.toUpperCase())}</text>`);
      s.push(`<rect x="${M}" y="${yy + SEC_H - 12}" width="${W - 2 * M}" height="1" fill="${HAIR}"/>`);
      yy += SEC_H;
      const rowsN = Math.ceil(sec.items.length / COLS);
      yy += rowsN * (IMG + LABEL_H + GAP) + 14;
    }
  }

  // per-cell frames, placeholders, labels
  for (const p of placements) {
    const { x, y: cy, cell } = p;
    if (!cell.row) {
      s.push(`<rect x="${x}" y="${cy}" width="${IMG}" height="${IMG}" rx="${RADIUS}" fill="#120e1c" stroke="${HAIR}" stroke-width="2" stroke-dasharray="8 6"/>`);
      s.push(`<text x="${x + IMG / 2}" y="${cy + IMG / 2 + 6}" font-family="sans-serif" font-size="19" fill="#5c5670" text-anchor="middle">not taken yet</text>`);
    } else {
      s.push(`<rect x="${x}" y="${cy}" width="${IMG}" height="${IMG}" rx="${RADIUS}" fill="none" stroke="${HAIR}" stroke-width="1.5"/>`);
    }
    s.push(`<text x="${x + IMG / 2}" y="${cy + IMG + 30}" font-family="sans-serif" font-size="20" font-weight="600" fill="${TEXT}" text-anchor="middle">${esc(cell.label)}</text>`);
  }

  // profile panel
  s.push(`<rect x="${panelX}" y="${panelY}" width="${panelW}" height="${panelH}" rx="18" fill="${PANEL}" stroke="${HAIR}" stroke-width="1.5"/>`);
  if (profile) {
    let py = panelY + 44;
    s.push(`<text x="${panelX + padX}" y="${py}" font-family="sans-serif" font-size="24" letter-spacing="3" font-weight="800" fill="${GOLD}">CHARACTER PROFILE</text>`);
    s.push(`<text x="${panelX + panelW - padX}" y="${py}" text-anchor="end" font-family="sans-serif" font-size="14" font-style="italic" fill="${MUT}">AI-generated draft — review before use</text>`);
    py += 34;
    // attribute rows in two columns
    rowsData.forEach(([label, value], i) => {
      const col = i % 2;
      const rx = panelX + padX + col * attrColW;
      const ry = py + Math.floor(i / 2) * 40;
      s.push(`<text x="${rx}" y="${ry}" font-family="sans-serif" font-size="15" font-weight="700" letter-spacing="1" fill="${GOLD_DIM}">${esc(label.toUpperCase())}</text>`);
      const vLines = wrap(value, 18, attrColW - 40);
      s.push(`<text x="${rx}" y="${ry + 22}" font-family="sans-serif" font-size="18" fill="${TEXT}">${esc(vLines[0] || '')}${vLines.length > 1 ? '…' : ''}</text>`);
    });
    py += attrRows * 40 + 18;
    if (summaryLines.length) {
      s.push(`<text x="${panelX + padX}" y="${py}" font-family="sans-serif" font-size="15" font-weight="700" letter-spacing="1" fill="${GOLD_DIM}">SUMMARY</text>`);
      py += 26;
      summaryLines.forEach((ln, i) => s.push(`<text x="${panelX + padX}" y="${py + i * 32}" font-family="sans-serif" font-size="21" fill="${TEXT}">${esc(ln)}</text>`));
      py += summaryLines.length * 32 + 14;
    }
    if (promptLines.length) {
      const boxY = py - 4;
      const boxH = 22 + promptLines.length * 30 + 16;
      s.push(`<rect x="${panelX + padX - 12}" y="${boxY}" width="${innerW + 24}" height="${boxH}" rx="12" fill="#0e0b17" stroke="${GOLD_DIM}" stroke-width="1"/>`);
      s.push(`<text x="${panelX + padX}" y="${boxY + 26}" font-family="sans-serif" font-size="14" font-weight="700" letter-spacing="1" fill="${GOLD}">AI PROMPT — paste into your image tool</text>`);
      promptLines.forEach((ln, i) => s.push(`<text x="${panelX + padX}" y="${boxY + 52 + i * 30}" font-family="monospace" font-size="18" fill="#d9e0ea">${esc(ln)}</text>`));
    }
  } else {
    s.push(`<text x="${panelX + padX}" y="${panelY + 42}" font-family="sans-serif" font-size="20" font-weight="700" fill="${MUT}">Character profile</text>`);
    s.push(`<text x="${panelX + padX}" y="${panelY + 72}" font-family="sans-serif" font-size="16" fill="${MUT}">Add ANTHROPIC_API_KEY in your environment to include an AI character write-up here.</text>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${s.join('')}</svg>`;
  const buffer = await sharp(Buffer.from(svg)).composite(thumbs).png().toBuffer();
  return { buffer, count, missing, profile };
}
