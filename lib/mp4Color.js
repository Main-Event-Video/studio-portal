// Stamp BT.709 colour tags onto an MP4 that has none, without re-encoding.
//
// WHY. Creatomate's renders carry no colour information at all — no `colr`
// atom in the container, no VUI in the stream — so every player guesses.
// Chrome on a Mac guesses wrong: a purple bikini played back blue (Josh,
// 2026-09-14, render 108 at 0:25). A copy of the same file with only the
// container tag added played purple in Chrome. So this writes that tag:
//   colr (nclx): primaries 1 (BT.709), transfer 1 (BT.709), matrix 6 (BT.601 — see below),
//   full_range 0 (video range)
// into every visual sample entry (avc1 / hvc1 / hev1 / av01 / mp4v) that lacks
// one. Pixels untouched.
//
// THE CATCH. Creatomate puts `moov` BEFORE `mdat`, so growing moov by the 19
// bytes of the colr box shifts every chunk in mdat. The chunk offsets in each
// track's stco / co64 are therefore bumped by the same 19 bytes. A file whose
// moov sits AFTER mdat needs no such fix (offsets are unaffected), and that
// case is handled too. Anything unexpected → the ORIGINAL buffer is returned
// untouched, so a strange file is archived as-is rather than corrupted.
const COLR = (() => {
  const b = Buffer.alloc(19);
  b.writeUInt32BE(19, 0); b.write('colr', 4); b.write('nclx', 8);
  // MATRIX = 6 (BT.601 / SMPTE 170M), NOT 1 (BT.709) — measured 9/15 on render
  // 098HR Seg A @0:37: Creatomate converts RGB→YUV with BT.601 coefficients
  // (ffmpeg's default). Tagged 709, hot pink decoded 7° redder + 15% duller
  // (salmon); decoded as 601 it matched the source photo to within 1/255 on
  // every channel. Primaries + transfer stay BT.709. Do not change back to 1.
  b.writeUInt16BE(1, 12); b.writeUInt16BE(1, 14); b.writeUInt16BE(6, 16); b[18] = 0;
  return b;
})();
const VISUAL = new Set(['avc1', 'avc3', 'hvc1', 'hev1', 'av01', 'mp4v', 'vp09']);
const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl']);

function boxes(buf, start, end) {
  const out = [];
  let i = start;
  while (i + 8 <= end) {
    let size = buf.readUInt32BE(i);
    const type = buf.toString('latin1', i + 4, i + 8);
    let hdr = 8;
    if (size === 1) { size = Number(buf.readBigUInt64BE(i + 8)); hdr = 16; }
    else if (size === 0) size = end - i;
    if (size < hdr || i + size > end) return null;
    out.push({ type, start: i, size, hdr, end: i + size });
    i += size;
  }
  return out;
}

export function hasColorTags(buf) {
  try {
    const top = boxes(buf, 0, buf.length); if (!top) return true;
    const moov = top.find((b) => b.type === 'moov'); if (!moov) return true;
    let found = false, entries = 0;
    const walk = (s, e) => {
      const bs = boxes(buf, s, e); if (!bs) return;
      for (const b of bs) {
        if (CONTAINERS.has(b.type)) walk(b.start + b.hdr, b.end);
        else if (b.type === 'stsd') {
          const n = buf.readUInt32BE(b.start + 12);
          const ents = boxes(buf, b.start + 16, b.end) || [];
          for (const en of ents.slice(0, n)) {
            if (!VISUAL.has(en.type)) continue;
            entries++;
            const kids = boxes(buf, en.start + 8 + 78, en.end) || [];
            if (kids.some((k) => k.type === 'colr')) found = true;
          }
        }
      }
    };
    walk(moov.start + moov.hdr, moov.end);
    return entries === 0 || found;
  } catch { return true; }
}

export function stampMp4Color(buf) {
  try {
    if (!Buffer.isBuffer(buf) || buf.length < 16) return buf;
    const top = boxes(buf, 0, buf.length); if (!top) return buf;
    const moov = top.find((b) => b.type === 'moov'); if (!moov) return buf;
    const mdats = top.filter((b) => b.type === 'mdat');
    const moovBeforeData = mdats.some((m) => m.start > moov.start);

    // Plan: where to insert the colr box (absolute offsets), which boxes to
    // grow, and which offset tables to bump. Collected first, applied last.
    const inserts = [];            // absolute offsets where COLR goes in
    const grow = new Map();        // box start -> bytes added inside it
    const offsetTables = [];       // { start, kind: 'stco'|'co64' }
    const walk = (s, e, ancestors) => {
      const bs = boxes(buf, s, e); if (!bs) throw new Error('bad box');
      for (const b of bs) {
        const chain = ancestors.concat([b]);
        if (CONTAINERS.has(b.type)) walk(b.start + b.hdr, b.end, chain);
        else if (b.type === 'stco' || b.type === 'co64') offsetTables.push({ start: b.start, kind: b.type });
        else if (b.type === 'stsd') {
          const n = buf.readUInt32BE(b.start + 12);
          const ents = boxes(buf, b.start + 16, b.end) || [];
          for (const en of ents.slice(0, n)) {
            if (!VISUAL.has(en.type)) continue;
            const kidsStart = en.start + 8 + 78;   // VisualSampleEntry fixed fields
            const kids = boxes(buf, kidsStart, en.end) || [];
            if (kids.some((k) => k.type === 'colr')) continue;
            inserts.push(en.end);                    // append inside the entry
            for (const a of chain.concat([en])) grow.set(a.start, (grow.get(a.start) || 0) + COLR.length);
          }
        }
      }
    };
    walk(moov.start + moov.hdr, moov.end, [moov]);
    if (!inserts.length) return buf;

    // Rebuild: copy the file, splicing COLR in at each insert point (ascending).
    const total = COLR.length * inserts.length;
    const out = Buffer.alloc(buf.length + total);
    let src = 0, dst = 0;
    const sorted = inserts.slice().sort((a, b) => a - b);
    for (const at of sorted) {
      buf.copy(out, dst, src, at); dst += at - src; src = at;
      COLR.copy(out, dst); dst += COLR.length;
    }
    buf.copy(out, dst, src); 

    // Map an ORIGINAL offset to its position in the new buffer.
    const shifted = (off) => off + COLR.length * sorted.filter((a) => a <= off).length;
    // Grow every ancestor box size (32-bit or 64-bit header).
    for (const [start, add] of grow) {
      const pos = shifted(start) - (sorted.some((a) => a === start) ? 0 : 0);
      const size32 = buf.readUInt32BE(start);
      if (size32 === 1) out.writeBigUInt64BE(BigInt(Number(buf.readBigUInt64BE(start + 8)) + add), pos + 8);
      else out.writeUInt32BE(size32 + add, pos);
    }
    // Chunk offsets point into mdat: bump those that sit after the growth.
    if (moovBeforeData) {
      for (const t of offsetTables) {
        const pos = shifted(t.start);
        const count = out.readUInt32BE(pos + 12);
        for (let i = 0; i < count; i++) {
          if (t.kind === 'stco') { const p = pos + 16 + i * 4; out.writeUInt32BE(out.readUInt32BE(p) + total, p); }
          else { const p = pos + 16 + i * 8; out.writeBigUInt64BE(out.readBigUInt64BE(p) + BigInt(total), p); }
        }
      }
    }
    return out;
  } catch {
    return buf;
  }
}
