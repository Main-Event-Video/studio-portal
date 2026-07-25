// =============================================================
// MAIN EVENT STUDIO — Character Build Sheet (premium, single PNG)
// White theme with the studio logo in the header. Grouped sections with
// rounded thumbnails + an AI "Character Profile" write-up and paste-ready prompt.
// Used by both admin download and the completion email.
// =============================================================
import sharp from 'sharp';
import { Resvg } from '@resvg/resvg-js';
import { readFile } from 'fs/promises';
import path from 'path';
import { getViewUrl } from '@/lib/r2';
import { POSES, poseForSortNumber } from '@/lib/characterPoses';
import { generateCharacterProfile, profileRows } from '@/lib/characterProfile';
import { getCharacter } from '@/lib/characters';

// ---- palette + metrics (light / white theme) ----
const BG = '#ffffff';
const PANEL = '#f5f6f8';       // light card
const HAIR = '#e3e6ea';        // hairlines / thumb frames
const TEXT = '#14121a';        // near-black
const MUT = '#6b7280';         // muted gray
const BLUE = '#1e6fd0';        // brand blue (section headings)
const RED = '#e11d48';         // brand red (profile accent)
const LABELMUT = '#8a94a6';    // attribute labels

const W = 1680;
const M = 56;                    // outer margin
const COLS = 4;
const GAP = 22;
const IMG = Math.floor((W - 2 * M - (COLS - 1) * GAP) / COLS); // square edge
const LABEL_H = 46;
const RADIUS = 14;
const HEAD_H = 214;
const SEC_H = 56;                // section heading band
const LOGO_H = 150;              // logo height in header

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// crude but reliable word-wrap for SVG text (no native wrapping).
function wrap(text, fontSize, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const cw = fontSize * 0.54;
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
  // 'contain' so nothing gets cropped out of frame (heads/feet were being cut on
  // profile + full-body shots). Letterbox with a light neutral fill.
  const base = await sharp(buffer)
    .rotate()
    .resize(IMG, IMG, { fit: 'contain', background: { r: 240, g: 241, b: 244 } })
    .toBuffer();
  const mask = Buffer.from(`<svg width="${IMG}" height="${IMG}"><rect width="${IMG}" height="${IMG}" rx="${RADIUS}" ry="${RADIUS}"/></svg>`);
  return sharp(base).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

// Load + resize the studio logo (public/logo.png) for the header. Returns
// { input, width, height } for compositing, or null if it can't be read.
async function loadLogo() {
  const candidates = [
    path.join(process.cwd(), 'public', 'logo.png'),
    path.join(process.cwd(), 'public', 'logo.PNG'),
  ];
  for (const p of candidates) {
    try {
      const raw = await readFile(p);
      const img = sharp(raw).resize({ height: LOGO_H });
      const buf = await img.png().toBuffer();
      const meta = await sharp(buf).metadata();
      return { input: buf, width: meta.width, height: meta.height };
    } catch { /* try next */ }
  }
  return null;
}

// ---- text rendering ------------------------------------------------------
// The sheet's text layer is an SVG. Vercel's serverless runtime ships NO system
// fonts, so rasterizing SVG text with librsvg/sharp draws every glyph as a
// ".notdef" box ("tofu"). We render the vector+text layer with resvg using these
// bundled fonts instead, so text never depends on the host having fonts. The
// files live in public/ — the same place the header logo loads from at runtime.
const FONT_DIR = path.join(process.cwd(), 'public', 'fonts');
const FONT_FILES = ['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf', 'DejaVuSansMono.ttf'];
let _fontFiles = null;
async function resolveFontFiles() {
  if (_fontFiles) return _fontFiles;
  const found = [];
  for (const f of FONT_FILES) {
    const p = path.join(FONT_DIR, f);
    try { await readFile(p); found.push(p); } catch { /* skip if missing */ }
  }
  _fontFiles = found;
  return found;
}

// Rasterize the vector+text SVG to a PNG with the bundled fonts. Raster layers
// (photo thumbnails + logo) are composited on top separately by sharp.
async function renderSheetSvg(svg) {
  const fontFiles = await resolveFontFiles();
  const resvg = new Resvg(svg, {
    font: {
      // If the vendored fonts are somehow absent, fall back to system fonts so a
      // dev machine still renders text rather than failing outright.
      loadSystemFonts: fontFiles.length === 0,
      fontFiles,
      defaultFontFamily: 'DejaVu Sans',
      sansSerifFamily: 'DejaVu Sans',
      serifFamily: 'DejaVu Sans',
      monospaceFamily: 'DejaVu Sans Mono',
    },
  });
  return Buffer.from(resvg.render().asPng());
}

// buildCharacterSheet(db, characterId, opts) — builds ONE character's sheet.
// The character row supplies the client, the reserved shot folder, the printed
// name, and the AI write-up cache. Pass opts.character to skip the lookup.
export async function buildCharacterSheet(db, characterId, opts = {}) {
  const character = opts.character || await getCharacter(db, characterId);
  if (!character) throw new Error('Character not found');
  const clientId = character.client_id;
  const folder = character.folder_path;

  const { data: clientRow } = await db.from('studio_clients').select('display_name').eq('id', clientId).single();
  const clientName = (opts.name && String(opts.name).trim())
    || (character.name && String(character.name).trim())
    || clientRow?.display_name || 'Client';

  const { data: rows } = await db
    .from('studio_media')
    .select('id, r2_key, filename, sort_number, content_type, created_at')
    .eq('client_id', clientId).eq('kind', 'client_upload').eq('folder_path', folder)
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

  // geometry for the grid
  let y = HEAD_H;
  const placements = [];
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
    y += 14;
  }
  const gridBottom = y + 6;

  const composites = [];
  const shotBuffers = [];
  for (const p of placements) {
    if (!p.cell.row) continue;
    try {
      const buf = await fetchImageBuffer(p.cell.row.r2_key);
      if (p.cell.slug && !p.cell.slug.startsWith('extra-')) shotBuffers.push({ buffer: buf, slug: p.cell.slug, label: p.cell.label });
      const thumb = await roundedThumb(buf);
      composites.push({ input: thumb, left: p.x, top: p.y });
    } catch { /* leave empty */ }
  }

  // AI character write-up (best-effort, CACHED).
  // The write-up costs an Anthropic API call, so we generate it ONCE per set of
  // shots and reuse it. `sig` is a stable signature of exactly which shots the
  // sheet is built from — when the client adds/retakes shots, the signature
  // changes and the write-up regenerates; otherwise the cached copy is reused so
  // re-downloading a sheet never re-bills the API.
  const sig = all.map((r) => r.r2_key).filter(Boolean).sort().join('|');
  let profile = opts.profile || null;

  // Cache lives on the character row (loaded above). No extra query needed.
  const cached = character.character_profile || null;
  const cachedSig = character.character_profile_sig || null;

  if (!profile && !opts.force && cached && cachedSig && cachedSig === sig) {
    // Cache hit — reuse the stored write-up, no API call, no cost.
    profile = cached;
  } else if (!profile && opts.generateProfile !== false && shotBuffers.length) {
    profile = await generateCharacterProfile(shotBuffers);
    // Best-effort write-back. Only cache a real (non-null) result, and never let
    // a missing-column error break sheet generation.
    if (profile) {
      try {
        await db.from('studio_characters')
          .update({ character_profile: profile, character_profile_sig: sig })
          .eq('id', character.id);
      } catch { /* skip caching on error */ }
    }
  }

  // logo (composited into the header)
  const logo = await loadLogo();
  if (logo) composites.unshift({ input: logo.input, left: M, top: 34 });

  // profile panel geometry
  const panelX = M;
  const panelW = W - 2 * M;
  const padX = 34;
  const innerW = panelW - 2 * padX;
  const rowsData = profileRows(profile);
  const summaryLines = profile?.summary ? wrap(profile.summary, 25, innerW) : [];
  const promptLines = profile?.ai_prompt ? wrap(profile.ai_prompt, 23, innerW - 32) : [];

  const attrColW = innerW / 2;
  const attrRows = Math.ceil(rowsData.length / 2);
  let panelH;
  if (profile) {
    panelH = 24 + 40 + attrRows * 40 + 18
      + (summaryLines.length ? 34 + summaryLines.length * 32 + 14 : 0)
      + (promptLines.length ? 34 + 22 + promptLines.length * 30 + 22 : 0)
      + 24;
  } else {
    panelH = 96;
  }
  const panelY = gridBottom + 24;
  const H = panelY + panelH + M;

  const s = [];
  s.push(`<rect width="${W}" height="${H}" fill="${BG}"/>`);
  // header
  s.push(`<rect x="0" y="0" width="${W}" height="5" fill="${BLUE}"/>`);
  // (logo is composited as a raster over this area). Client name + labels:
  const nameX = M + (logo ? logo.width + 40 : 0);
  s.push(`<text x="${nameX}" y="112" font-family="sans-serif" font-size="50" font-weight="800" fill="${TEXT}">${esc(clientName)}</text>`);
  s.push(`<text x="${nameX}" y="150" font-family="sans-serif" font-size="23" font-weight="600" fill="${MUT}">Character Build Sheet</text>`);
  const today = new Date().toISOString().slice(0, 10);
  s.push(`<text x="${W - M}" y="104" text-anchor="end" font-family="sans-serif" font-size="20" font-weight="800" letter-spacing="1" fill="${RED}">AI CHARACTER REFERENCE</text>`);
  s.push(`<text x="${W - M}" y="136" text-anchor="end" font-family="sans-serif" font-size="18" fill="${MUT}">${count} shot${count === 1 ? '' : 's'} · ${today}</text>`);
  s.push(`<rect x="${M}" y="${HEAD_H - 24}" width="${W - 2 * M}" height="1.5" fill="${HAIR}"/>`);

  // section headings
  {
    let yy = HEAD_H;
    for (const sec of sections) {
      s.push(`<text x="${M}" y="${yy + 34}" font-family="sans-serif" font-size="22" letter-spacing="2.5" font-weight="800" fill="${BLUE}">${esc(sec.title.toUpperCase())}</text>`);
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
      s.push(`<rect x="${x}" y="${cy}" width="${IMG}" height="${IMG}" rx="${RADIUS}" fill="#f0f1f4" stroke="#c9ced6" stroke-width="2" stroke-dasharray="8 6"/>`);
      s.push(`<text x="${x + IMG / 2}" y="${cy + IMG / 2 + 6}" font-family="sans-serif" font-size="19" fill="#9aa1ab" text-anchor="middle">not taken yet</text>`);
    } else {
      s.push(`<rect x="${x}" y="${cy}" width="${IMG}" height="${IMG}" rx="${RADIUS}" fill="none" stroke="${HAIR}" stroke-width="1.5"/>`);
    }
    s.push(`<rect x="${x}" y="${cy + IMG + 6}" width="${IMG}" height="${LABEL_H - 6}" rx="8" fill="${PANEL}"/>`);
    s.push(`<text x="${x + IMG / 2}" y="${cy + IMG + 33}" font-family="sans-serif" font-size="20" font-weight="700" fill="${TEXT}" text-anchor="middle">${esc(cell.label)}</text>`);
  }

  // profile panel
  s.push(`<rect x="${panelX}" y="${panelY}" width="${panelW}" height="${panelH}" rx="18" fill="${PANEL}" stroke="${HAIR}" stroke-width="1.5"/>`);
  if (profile) {
    let py = panelY + 44;
    s.push(`<text x="${panelX + padX}" y="${py}" font-family="sans-serif" font-size="24" letter-spacing="2.5" font-weight="800" fill="${RED}">CHARACTER PROFILE</text>`);
    s.push(`<text x="${panelX + panelW - padX}" y="${py}" text-anchor="end" font-family="sans-serif" font-size="14" font-style="italic" fill="${MUT}">AI-generated draft — review before use</text>`);
    py += 34;
    rowsData.forEach(([label, value], i) => {
      const col = i % 2;
      const rx = panelX + padX + col * attrColW;
      const ry = py + Math.floor(i / 2) * 40;
      s.push(`<text x="${rx}" y="${ry}" font-family="sans-serif" font-size="15" font-weight="700" letter-spacing="1" fill="${LABELMUT}">${esc(label.toUpperCase())}</text>`);
      const vLines = wrap(value, 18, attrColW - 40);
      s.push(`<text x="${rx}" y="${ry + 22}" font-family="sans-serif" font-size="18" fill="${TEXT}">${esc(vLines[0] || '')}${vLines.length > 1 ? '…' : ''}</text>`);
    });
    py += attrRows * 40 + 18;
    if (summaryLines.length) {
      s.push(`<text x="${panelX + padX}" y="${py}" font-family="sans-serif" font-size="15" font-weight="700" letter-spacing="1" fill="${LABELMUT}">SUMMARY</text>`);
      py += 26;
      summaryLines.forEach((ln, i) => s.push(`<text x="${panelX + padX}" y="${py + i * 32}" font-family="sans-serif" font-size="21" fill="${TEXT}">${esc(ln)}</text>`));
      py += summaryLines.length * 32 + 14;
    }
    if (promptLines.length) {
      const boxY = py - 4;
      const boxH = 22 + promptLines.length * 30 + 16;
      s.push(`<rect x="${panelX + padX - 12}" y="${boxY}" width="${innerW + 24}" height="${boxH}" rx="12" fill="#ffffff" stroke="${RED}" stroke-width="1"/>`);
      s.push(`<text x="${panelX + padX}" y="${boxY + 26}" font-family="sans-serif" font-size="14" font-weight="700" letter-spacing="1" fill="${RED}">AI PROMPT — paste into your image tool</text>`);
      promptLines.forEach((ln, i) => s.push(`<text x="${panelX + padX}" y="${boxY + 52 + i * 30}" font-family="monospace" font-size="18" fill="${TEXT}">${esc(ln)}</text>`));
    }
  } else {
    s.push(`<text x="${panelX + padX}" y="${panelY + 42}" font-family="sans-serif" font-size="20" font-weight="700" fill="${MUT}">Character profile</text>`);
    s.push(`<text x="${panelX + padX}" y="${panelY + 72}" font-family="sans-serif" font-size="16" fill="${MUT}">Add ANTHROPIC_API_KEY in your environment to include an AI character write-up here.</text>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${s.join('')}</svg>`;
  // Render text with bundled fonts (resvg), then composite the raster thumbnails
  // and logo on top with sharp — as before.
  const basePng = await renderSheetSvg(svg);
  const buffer = await sharp(basePng).composite(composites).png().toBuffer();
  return { buffer, count, missing, profile, name: clientName };
}
