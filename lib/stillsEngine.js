// lib/stillsEngine.js  (Studio Portal copy — see stillsSource at the bottom)
// ─────────────────────────────────────────────────────────────────────────────
// STILLS ENGINE — photo scenes, multi-photo SCREENS, VIBE packages and the
// photo-only transition FX (Josh 9/5–9/6). PORTED from MEvid's lib/stills-fx.js
// on 9/9 (the repos never share a file — changes are made there and re-copied;
// the portal-only adapter lives in the STILLS SOURCE section at the bottom).
//
// Called by lib/render-script.js ONLY for all-photo (Stills) projects. The
// video path and the mixed video+photo path are untouched — they still use
// the native Creatomate transition map. Everything here is pure and
// isomorphic (no server calls) so the Preview SDK and the export agree.
//
// Concepts
//   • STACK  — one scene's layers: black floor, blurred fill, N framed photo
//     comps (with the top-favoured drift). A single photo is a 1-up stack.
//   • SCREEN — a stack with 2/3/4 photos laid out Apple-style (every image
//     shown whole, never cropped). Vibes decide how often screens appear.
//   • FX     — a transition scene inserted BETWEEN two stacks. It holds A's
//     end state and B's start state and animates them with keyframes on the
//     Creatomate-animatable properties only (x, y, x_scale, y_scale,
//     x/y/z_rotation, opacity, blur_radius). Native transitions (Cut/Fade/
//     Dissolve/Slide/Wipe/Zoom/Pop) stay native — they overlap the scenes the
//     way they always have.
//   • PIECES — shatter/mosaic/blinds/doors/split/glitch manufacture their
//     tiles IN the render: each piece is a clipped composition that shows an
//     offset copy of the whole scene. No upload-time slicing needed.
//   • CUT-OUTS — cutfly/cutpop/cutpeel need clips.cutout_url (a transparent
//     PNG of the person, made by lib/photo-cutout.js after upload). A photo
//     without one falls back to the FX named in `fallback`.
//
// Honest caveat: keyframe values here reproduce the approved CSS demo
// (stills-transitions-v2.html). They are unproven in Creatomate until the
// batched test render (scripts/stills-fx-test.mjs) has been watched.
// ─────────────────────────────────────────────────────────────────────────────

export const NATIVE = {
  'Cut':      null,
  'Fade':     { type: 'fade',          duration: 1 },
  'Dissolve': { type: 'fade',          duration: 1.5 },
  'Slide':    { type: 'slide',         duration: 0.8 },
  'Wipe':     { type: 'circular-wipe', duration: 0.8 },
  'Zoom':     { type: 'scale',         duration: 0.8 },
  'Pop':      { type: 'scale',         duration: 0.5 },
}

// Render-safe easings only (verified in shipped renders). elastic/bounce are
// NOT on this list on purpose.
const E = { qIn: 'quadratic-in', qOut: 'quadratic-out', qIO: 'quadratic-in-out', backOut: 'back-out', backIO: 'back-in-out', lin: 'linear' }

const RECT = 'M 0 0 L 100 0 L 100 100 L 0 100 Z'
const r2 = v => Number(Number(v).toFixed(2))
const r3 = v => Number(Number(v).toFixed(3))
const pct = v => `${r2(v)}%`
const FULL = { width: '100%', height: '100%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%' }

// Deterministic 0..1 noise (same seed → same film every render).
export function seededRnd(seedStr) {
  let h = 2166136261
  for (const ch of String(seedStr)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0 }
  return () => { h = (Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0; return (h >>> 8) / 16777216 }
}

// ── Keyframe helpers ─────────────────────────────────────────
// kf(t0, v0, t1, v1, easing[, holdFrom]) → a keyframe array that holds v0
// from time 0, moves v0→v1 between t0 and t1. Easing sits on the keyframe the
// motion STARTS from (the convention the shipped drift/collage code uses).
function kf(t0, v0, t1, v1, easing = E.qIO) {
  const out = []
  if (t0 > 0) out.push({ time: 0, value: v0 })
  out.push({ time: r3(t0), value: v0, easing })
  out.push({ time: r3(t1), value: v1 })
  return out
}
// Multi-point: [[t, v, easing?], ...]
function kfs(points) {
  return points.map(([t, v, e]) => (e ? { time: r3(t), value: v, easing: e } : { time: r3(t), value: v }))
}

// ── Photo geometry (mirrors the shipped single-photo scene exactly) ──
const TPL = { '16:9': 16 / 9, '1:1': 1, '9:16': 9 / 16 }
export function photoBox(clip, width, height, cell = null, inset = 0) {
  const pw = Number(clip.width) || 1500
  const ph = Number(clip.height) || 1000
  const ratio = TPL[clip.photo_template] || (pw / ph)
  const scaleRaw = Number(clip.photo_scale)
  const pScale = Number.isFinite(scaleRaw) ? Math.min(1, Math.max(0.55, scaleRaw)) : 1
  // 1-up (Josh 9/6 "sit bigger in the frame; the end of the zoom is right
  // when the hero hits the frame edge"): the base box is the frame divided by
  // the drift's end scale, so the slow 100→106% zoom lands the photo's long
  // side exactly on the edge. A contributor who set their own size still
  // gets it (relative to that). Screens: the cell governs.
  const EDGE = DRIFT.scale1 / 100
  // `inset` = the print border (px): the border must reach the edge too.
  const availW = cell ? cell.w * width - 2 * inset : (width / EDGE) * pScale - 2 * inset
  const availH = cell ? cell.h * height - 2 * inset : (height / EDGE) * pScale - 2 * inset
  let boxW = Math.min(availW, availH * ratio)
  let boxH = boxW / ratio
  const cx = cell ? cell.x * width : width / 2
  const cy = cell ? cell.y * height : height / 2
  return { boxW, boxH, cx, cy, frameW: width, frameH: height, wPct: pct((boxW / width) * 100), hPct: pct((boxH / height) * 100), xPct: pct((cx / width) * 100), yPct: pct((cy / height) * 100) }
}

// Drift endpoints (shipped values): slow 100→106% zoom and 51.2→48.8% upward
// travel on a centred 1-up. Screens drift each cell around its own centre by
// the same relative amount.
const DRIFT = { scale0: 100, scale1: 106, dy: 2.4 /* % of frame, upward */ }
const SHADOW = { shadow_color: 'rgba(0,0,0,0.45)', shadow_blur: '2.4 vmin', shadow_x: '0 vmin', shadow_y: '0.6 vmin' }

// A framed photo comp. phase: 'run' animates the drift over secs; 'end' is
// the drift's final frame frozen; 'start' its first frame frozen.
// Print border + drop shadow (Josh 9/6): on by default, white, "not too
// thick" — 0.9% of the frame's height. projects.stills_frame ('on'|'off'),
// stills_frame_color (#hex), stills_shadow ('on'|'off'). Cut-out layers and
// screens' cells use the same rule; a cut-out itself never gets a border.
export function frameStyle(project) {
  const on = String(project?.stills_frame ?? 'on').toLowerCase() !== 'off'
  const color = /^#[0-9a-f]{6}$/i.test(String(project?.stills_frame_color || '')) ? project.stills_frame_color : '#FFFFFF'
  const shadow = String(project?.stills_shadow ?? 'on').toLowerCase() !== 'off'
  return { on, color, shadow, thick: 0.009 /* × frame height */ }
}

function photoComp(clip, box, secs, phase, src, extra = {}, frame = null) {
  const y0 = Number(box.yPct.replace('%', '')) + DRIFT.dy / 2
  const y1 = y0 - DRIFT.dy
  let scale, y
  if (phase === 'run') {
    scale = [{ time: 0, value: pct(DRIFT.scale0), easing: E.qIO }, { time: r2(secs), value: pct(DRIFT.scale1) }]
    y = [{ time: 0, value: pct(y0), easing: E.qIO }, { time: r2(secs), value: pct(y1) }]
  } else if (phase === 'end') { scale = pct(DRIFT.scale1); y = pct(y1) }
  else { scale = pct(DRIFT.scale0); y = pct(y0) }
  // With a border the comp grows by the border on every side and the photo
  // sits inset, so the border is uniform in pixels whatever the photo's shape.
  const b = frame && frame.on ? frame.thick * box.frameH : 0
  const compW = box.boxW + 2 * b, compH = box.boxH + 2 * b
  const inner = b ? { width: pct((box.boxW / compW) * 100), height: pct((box.boxH / compH) * 100), x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%' } : FULL
  return {
    type: 'composition', duration: secs,
    width: pct((compW / box.frameW) * 100), height: pct((compH / box.frameH) * 100),
    x: box.xPct, y, x_anchor: '50%', y_anchor: '50%',
    x_scale: scale, y_scale: scale,
    elements: [
      // Border on → a coloured mat carries the shadow. Border off → the shadow
      // rides on the photo itself (a transparent shape casts nothing).
      ...(frame && frame.on ? [{
        type: 'shape', track: 1, duration: secs, path: RECT, ...FULL, fill_color: frame.color,
        ...(frame.shadow ? SHADOW : {}),
      }] : []),
      { type: 'image', track: 2, source: src, fit: clip.dimsUnknown ? 'contain' : 'cover', ...inner, duration: secs, ...(frame && !frame.on && frame.shadow ? SHADOW : {}) },
      ...(phase === 'run' && Array.isArray(clip.photo_stickers) ? clip.photo_stickers.slice(0, 8).map((st, k) => ({
        type: 'text', track: 3 + k, text: String(st.id || '🎉'),
        x: `${Math.min(96, Math.max(4, Number(st.x) || 50))}%`,
        y: `${Math.min(96, Math.max(4, Number(st.y) || 50))}%`,
        x_anchor: '50%', y_anchor: '50%',
        rotate: Number(st.rotate) || 0,
        font_size: `${Math.max(4, Math.min(14, 7 * (Number(st.scale) || 1)))} vmin`,
        duration: secs,
      })) : []),
    ],
    ...extra,
  }
}

// ── Screens (multi-photo layouts) ────────────────────────────
// Cells are fractions of the frame: {x,y} centre, {w,h} available box.
// Every photo is CONTAINED in its cell (never cropped). Layouts are chosen
// by orientation so a 9:16 film stacks vertically and a 16:9 film sits
// side-by-side.
const G = 0.03 // gutter
export function screenLayout(n, format) {
  const vertical = format === '9:16'
  if (n <= 1) return [{ x: 0.5, y: 0.5, w: 0.86, h: 0.86 }]
  if (n === 2) {
    return vertical
      ? [{ x: 0.5, y: 0.27, w: 0.86, h: 0.42 }, { x: 0.5, y: 0.73, w: 0.86, h: 0.42 }]
      : [{ x: 0.27, y: 0.5, w: 0.43, h: 0.84 }, { x: 0.73, y: 0.5, w: 0.43, h: 0.84 }]
  }
  if (n === 3) {
    // one hero + two supporting
    return vertical
      ? [{ x: 0.5, y: 0.3, w: 0.86, h: 0.5 }, { x: 0.27, y: 0.75, w: 0.42, h: 0.36 }, { x: 0.73, y: 0.75, w: 0.42, h: 0.36 }]
      : [{ x: 0.3, y: 0.5, w: 0.52, h: 0.84 }, { x: 0.76, y: 0.28, w: 0.38, h: 0.38 }, { x: 0.76, y: 0.72, w: 0.38, h: 0.38 }]
  }
  // 4-up grid
  return [
    { x: 0.27, y: 0.27, w: 0.43 - G, h: 0.43 - G }, { x: 0.73, y: 0.27, w: 0.43 - G, h: 0.43 - G },
    { x: 0.27, y: 0.73, w: 0.43 - G, h: 0.43 - G }, { x: 0.73, y: 0.73, w: 0.43 - G, h: 0.43 - G },
  ]
}

// A STACK = the layer list for one scene, built for a phase.
//   phase 'run'   → the scene as it plays (drift animates, stickers/message on)
//   phase 'end'   → frozen on the last drift frame (A side of an FX)
//   phase 'start' → frozen on the first drift frame (B side of an FX)
// opts.source = 'photo' | 'cutout' (cutout → only photos with a cutout_url,
// on a transparent background: no floor, no fill)
// The blurred bed behind a 1-up: the photo blown up to cover 112% of the frame.
// A plain centred cover shows the MIDDLE of a tall photo (Josh 9/9: "not middle
// groin area… at least the upper third"), so the picture is sized to its true
// aspect and slid so the frame looks at its upper third (v = 0.25 of the
// overflow). Faces, when a caller supplies clip.bed_v (0 top … 1 bottom), win.
export function bedCover(clip, width, height, v = 0.25) {
  const OVER = 112
  const ar = Number(clip?.width) > 0 && Number(clip?.height) > 0 ? Number(clip.width) / Number(clip.height) : width / height
  const fa = width / height
  let W, H
  if (ar <= fa) { W = OVER; H = (OVER * fa) / ar } else { H = OVER; W = (OVER * ar) / fa }
  const bias = Number.isFinite(Number(clip?.bed_v)) ? Math.min(1, Math.max(0, Number(clip.bed_v))) : v
  const y = 50 + ((H - 100) / 2) * (1 - 2 * bias)
  return { fit: 'cover', width: pct(W), height: pct(H), x: '50%', y: pct(y), x_anchor: '50%', y_anchor: '50%' }
}
export function buildStack(scene, ctx, phase, opts = {}) {
  const { width, height, format, project } = ctx
  const secs = scene.secs
  const useCut = opts.source === 'cutout'
  const useWc = opts.source === 'watercolor'
  const cells = screenLayout(scene.clips.length, format)
  const els = []
  let track = 1
  if (!useCut && !ctx.noBed) {
    els.push({ type: 'shape', track: track++, duration: secs, path: RECT, fill_color: '#000000', ...FULL })
    els.push({ type: 'image', track: track++, duration: secs, source: useWc ? (scene.clips[0].watercolor_url || photoSrc(scene.clips[0])) : photoSrc(scene.clips[0]), ...bedCover(scene.clips[0], width, height), blur_radius: 55, blur_mode: 'stack', color_overlay: 'rgba(0,0,0,0.34)', ...(opts.fillProps || {}) })
  }
  scene.clips.forEach((clip, k) => {
    if (useCut && !clip.cutout_url) return
    // Portal: ctx.frameFor(clip) supplies a per-photo frame (album / per-photo
    // border); MEvid: one project-wide frame.
    const fs = ctx.frameFor ? ctx.frameFor(clip) : frameStyle(project)
    const inset = fs.on ? fs.thick * height : 0
    const box = photoBox(clip, width, height, scene.clips.length > 1 ? cells[k] : null, inset)
    const src = useCut ? clip.cutout_url : useWc ? (clip.watercolor_url || photoSrc(clip)) : photoSrc(clip)
    const comp = photoComp(clip, box, secs, phase, src, opts.photoProps || {}, useCut ? null : fs)
    // Portal: per-photo colour edits (B&W / sepia / contrast) on the image itself.
    if (ctx.imageProps && !useCut) comp.elements = comp.elements.map(e => (e.type === 'image' ? ctx.imageProps(e, clip) : e))
    els.push({ ...comp, track: track++ })
  })
  if (phase === 'run' && !useCut) {
    scene.clips.forEach((clip, k) => {
      if (clip.photo_message && project.overlays_enabled !== false) {
        els.push({
          type: 'text', track: 20 + k, duration: secs,
          text: String(clip.photo_message).slice(0, 200),
          x: '50%', y: '90%', x_anchor: '50%', y_anchor: '50%', width: '84%',
          font_family: 'Poppins', font_weight: '600', font_size: '3.4 vmin',
          fill_color: '#FFFFFF', shadow_color: 'rgba(0,0,0,0.65)', shadow_blur: '1.2 vmin',
          text_align: 'center',
        })
      }
    })
  }
  return els
}

export function photoSrc(clip) {
  const u = String(clip?.clip_url || '')
  if (/\.(jpe?g|png|webp)(\?|$)/i.test(u)) return u
  const sp = clip?.storage_path
  const base = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_R2_PUBLIC_URL : ''
  if (sp && base) return `${base}/${sp}`
  return u
}

// Wrap a stack into ONE full-frame composition so a whole scene can be
// flipped / pushed / scaled as a unit. `props` are keyframes or statics on
// the wrapper (x, y, x_scale, y_scale, rotations, opacity, blur_radius).
function unit(name, els, D, track, props = {}) {
  return { name, type: 'composition', track, duration: D, ...FULL, elements: els, ...props }
}

// A PIECE: a clipped window onto the frame region [x0,y0]-[x0+w,y0+h]
// (fractions), showing an offset copy of `els` so the pieces tile the scene
// exactly. Animating the piece moves that window's content with it.
function piece(name, els, D, track, x0, y0, w, h, props = {}) {
  return {
    name, type: 'composition', track, duration: D, clip: true,
    width: pct(w * 100), height: pct(h * 100),
    x: pct((x0 + w / 2) * 100), y: pct((y0 + h / 2) * 100), x_anchor: '50%', y_anchor: '50%',
    elements: [{
      type: 'composition', track: 1, duration: D,
      width: pct(100 / w), height: pct(100 / h),
      x: pct(((0.5 - x0) / w) * 100), y: pct(((0.5 - y0) / h) * 100), x_anchor: '50%', y_anchor: '50%',
      elements: els,
    }],
    ...props,
  }
}

const white = (D, track, props = {}) => ({ type: 'shape', track, duration: D, path: RECT, fill_color: '#FFFFFF', ...FULL, ...props })
const black = (D, track, props = {}) => ({ type: 'shape', track, duration: D, path: RECT, fill_color: '#000000', ...FULL, ...props })

// A GROWING WINDOW (Josh 9/9: "the circle blows up full screen then pops to
// image"): scaling a piece() scales what it shows, so the circular wipe and
// the watercolor puddles were magnifying B instead of revealing it. Here the
// window scales s0→s1 (fractions of its base size) while the content inside is
// counter-scaled 1/s and re-centred, so the picture stays fixed to the frame
// and the window simply opens over it. Both use the same sampled, piecewise-
// linear curve (NS steps of the chosen easing), so they agree at every sample.
const EASE_FN = { [E.qIO]: u => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2), [E.qOut]: u => 1 - (1 - u) * (1 - u), [E.qIn]: u => u * u, [E.lin]: u => u }
// s0/s1 may be numbers (uniform) or {x,y} (per axis, for rectangular windows).
function openWindow(name, els, D, track, x0, y0, w, h, t0, s0, t1, s1, easing = E.qOut, props = {}) {
  const NS = 30, fn = EASE_FN[easing] || EASE_FN[E.qOut], MIN = 0.05
  const ax = v => (typeof v === 'number' ? v : v.x), ay = v => (typeof v === 'number' ? v : v.y)
  const baseX = ((0.5 - x0) / w) * 100, baseY = ((0.5 - y0) / h) * 100
  const outX = [], outY = [], inSX = [], inSY = [], inX = [], inY = []
  const at = (tm, sx, sy) => {
    sx = Math.max(MIN, sx); sy = Math.max(MIN, sy)
    outX.push({ time: r3(tm), value: pct(sx * 100), easing: E.lin }); outY.push({ time: r3(tm), value: pct(sy * 100), easing: E.lin })
    inSX.push({ time: r3(tm), value: pct(100 / sx), easing: E.lin }); inSY.push({ time: r3(tm), value: pct(100 / sy), easing: E.lin })
    inX.push({ time: r3(tm), value: pct(50 + (baseX - 50) / sx), easing: E.lin })
    inY.push({ time: r3(tm), value: pct(50 + (baseY - 50) / sy), easing: E.lin })
  }
  if (t0 > 0) at(0, ax(s0), ay(s0))
  for (let i = 0; i <= NS; i++) { const u = fn(i / NS); at(t0 + (t1 - t0) * (i / NS), ax(s0) + (ax(s1) - ax(s0)) * u, ay(s0) + (ay(s1) - ay(s0)) * u) }
  return {
    name, type: 'composition', track, duration: D, clip: true,
    width: pct(w * 100), height: pct(h * 100),
    x: pct((x0 + w / 2) * 100), y: pct((y0 + h / 2) * 100), x_anchor: '50%', y_anchor: '50%',
    x_scale: outX, y_scale: outY,
    elements: [{
      type: 'composition', track: 1, duration: D,
      width: pct(100 / w), height: pct(100 / h),
      x: inX, y: inY, x_anchor: '50%', y_anchor: '50%', x_scale: inSX, y_scale: inSY,
      elements: els,
    }],
    ...props,
  }
}

// ── THE FX MAP ───────────────────────────────────────────────
// Each: label, family, D (seconds at normal speed), needs ('cutoutB' |
// 'cutoutA'), fallback (key used when the need isn't met), build(ctx) →
// elements of the FX scene. ctx.A / ctx.B = stack builders for the two
// scenes, ctx.D the (speed-scaled) duration, ctx.rnd a seeded RNG.
export const STILLS_FX = {
  // ── Classic (the old native set, rebuilt as FX so the OUTGOING photo shrinks
  // and fades BEHIND the incoming one — Josh 9/9: "when 2 images overlap and
  // the bottom one is bigger you see it cut off"). Cut stays a hard native cut.
  Fade: { label: 'Fade', family: 'Classic', D: 0.8, build: ({ A, B, D }) => [
    unit('A', A('end'), D, 1, { opacity: kf(0, '100%', D, '0%', E.qIO), x_scale: kf(0, '100%', D, '90%', E.qIO), y_scale: kf(0, '100%', D, '90%', E.qIO) }),
    unit('B', B('start'), D, 2, { opacity: kf(0, '0%', D, '100%', E.qIO) }),
  ] },
  Dissolve: { label: 'Dissolve', family: 'Classic', D: 1.3, build: ({ A, B, D }) => [
    unit('A', A('end'), D, 1, { opacity: kf(0, '100%', D, '0%', E.qIO), x_scale: kf(0, '100%', D, '92%', E.qIO), y_scale: kf(0, '100%', D, '92%', E.qIO) }),
    unit('B', B('start'), D, 2, { opacity: kf(0, '0%', D, '100%', E.qIO) }),
  ] },
  Slide: { label: 'Slide', family: 'Classic', D: 0.7, build: ({ A, B, D }) => [
    unit('A', A('end'), D, 1, { opacity: kf(0, '100%', D, '20%', E.qIO), x_scale: kf(0, '100%', D, '90%', E.qIO), y_scale: kf(0, '100%', D, '90%', E.qIO) }),
    unit('B', B('start'), D, 2, { x: kf(0, '150%', D, '50%', E.qOut) }),
  ] },
  Wipe: { label: 'Circular wipe', family: 'Classic', D: 0.75, build: ({ A, B, D, width, height }) => {
    // a round window onto B growing from the centre (the puddle trick)
    const w = 0.42, h = 0.42 * (width / height)
    return [
      unit('A', A('end'), D, 1, { opacity: kf(0, '100%', D, '30%', E.qIO), x_scale: kf(0, '100%', D, '92%', E.qIO), y_scale: kf(0, '100%', D, '92%', E.qIO) }),
      openWindow('W', B('start'), D, 2, 0.5 - w / 2, 0.5 - h / 2, w, h, 0, 0, D, 3.6, E.qIO, { border_radius: `${r2((w / 2) * 100)} vw` }),
      unit('B', B('start'), D, 3, { opacity: kf(D * 0.96, '0%', D, '100%', E.lin) }),
    ]
  } },
  Zoom: { label: 'Zoom', family: 'Classic', D: 0.7, build: ({ A, B, D }) => [
    unit('A', A('end'), D, 1, { opacity: kf(0, '100%', D, '0%', E.qIO), x_scale: kf(0, '100%', D, '90%', E.qIO), y_scale: kf(0, '100%', D, '90%', E.qIO) }),
    unit('B', B('start'), D, 2, { opacity: kf(0, '0%', D * 0.5, '100%', E.qOut), x_scale: kf(0, '20%', D, '100%', E.qOut), y_scale: kf(0, '20%', D, '100%', E.qOut) }),
  ] },
  Pop: { label: 'Pop', family: 'Classic', D: 0.55, build: ({ A, B, D }) => [
    unit('A', A('end'), D, 1, { opacity: kf(0, '100%', D, '0%', E.qIO), x_scale: kf(0, '100%', D, '88%', E.qIO), y_scale: kf(0, '100%', D, '88%', E.qIO) }),
    unit('B', B('start'), D, 2, { opacity: kf(0, '0%', D * 0.3, '100%', E.qOut), x_scale: kf(0, '0%', D, '100%', E.backOut), y_scale: kf(0, '0%', D, '100%', E.backOut) }),
  ] },
  // ── 3D spins ──
  flip: { label: 'Flip', family: '3D spins', D: 0.7, build: ({ A, B, D }) => [
    unit('A', A('end'), D, 1, { y_rotation: kf(0, 0, D * 0.5, 90, E.qIn), opacity: kf(0, '100%', D * 0.5, '60%', E.qIn) }),
    unit('B', B('start'), D, 2, { y_rotation: kf(D * 0.5, -90, D, 0, E.qOut), opacity: kf(D * 0.5, '60%', D, '100%', E.qOut) }),
  ] },
  tumble: { label: 'Tumble', family: '3D spins', D: 0.7, build: ({ A, B, D }) => [
    unit('A', A('end'), D, 1, { x_rotation: kf(0, 0, D * 0.5, -90, E.qIn), opacity: kf(0, '100%', D * 0.5, '60%', E.qIn) }),
    unit('B', B('start'), D, 2, { x_rotation: kf(D * 0.5, 90, D, 0, E.qOut), opacity: kf(D * 0.5, '60%', D, '100%', E.qOut) }),
  ] },
  barrel: { label: 'Barrel roll', family: '3D spins', D: 0.85, build: ({ A, B, D }) => [
    unit('A', A('end'), D, 1, { z_rotation: kf(0, 0, D * 0.6, -180, E.qIn), x_scale: kf(0, '100%', D * 0.6, '0%', E.qIn), y_scale: kf(0, '100%', D * 0.6, '0%', E.qIn), opacity: kf(0, '100%', D * 0.6, '0%', E.qIn) }),
    unit('B', B('start'), D, 2, { z_rotation: kf(D * 0.3, 180, D, 0, E.backOut), x_scale: kf(D * 0.3, '0%', D, '100%', E.backOut), y_scale: kf(D * 0.3, '0%', D, '100%', E.backOut), opacity: kf(D * 0.3, '0%', D, '100%', E.qOut) }),
  ] },
  spinzoom: { label: 'Spin-zoom through', family: '3D spins', D: 0.95, build: ({ A, B, D }) => [
    unit('B', B('start'), D, 1, { z_rotation: kf(D * 0.32, -25, D, 0, E.qOut), x_scale: kf(D * 0.32, '40%', D, '100%', E.qOut), y_scale: kf(D * 0.32, '40%', D, '100%', E.qOut), blur_radius: kf(D * 0.32, 8, D, 0, E.qOut) }),
    unit('A', A('end'), D, 2, { z_rotation: kf(0, 0, D * 0.58, 25, E.qIn), x_scale: kf(0, '100%', D * 0.58, '300%', E.qIn), y_scale: kf(0, '100%', D * 0.58, '300%', E.qIn), opacity: kf(0, '100%', D * 0.58, '0%', E.qIn), blur_radius: kf(0, 0, D * 0.58, 8, E.qIn) }),
  ] },
  // ── Push / whip / drop (A and B move together) ──
  push: { label: 'Push', family: 'Push / whip / drop', D: 0.5, build: ({ A, B, D }) => [
    unit('A', A('end'), D, 1, { x: kf(0, '50%', D, '-50%', E.qIO) }),
    unit('B', B('start'), D, 2, { x: kf(0, '150%', D, '50%', E.qIO) }),
  ] },
  whip: { label: 'Whip pan', family: 'Push / whip / drop', D: 0.38, build: ({ A, B, D }) => [
    unit('A', A('end'), D, 1, { x: kf(0, '50%', D, '-70%', E.qIO), x_scale: kfs([[0, '100%', E.qIO], [D / 2, '130%', E.qIO], [D, '100%']]), blur_radius: kfs([[0, 0, E.qIO], [D / 2, 14, E.qIO], [D, 0]]) }),
    unit('B', B('start'), D, 2, { x: kf(0, '170%', D, '50%', E.qIO), x_scale: kfs([[0, '100%', E.qIO], [D / 2, '130%', E.qIO], [D, '100%']]), blur_radius: kfs([[0, 0, E.qIO], [D / 2, 14, E.qIO], [D, 0]]) }),
  ] },
  drop: { label: 'Drop', family: 'Push / whip / drop', D: 0.8, build: ({ A, B, D }) => [
    unit('B', B('start'), D, 1, { y: kf(D * 0.25, '-60%', D, '50%', E.backOut) }),
    unit('A', A('end'), D, 2, { y: kf(0, '50%', D * 0.56, '160%', E.qIn), z_rotation: kf(0, 0, D * 0.56, 6, E.qIn) }),
  ] },
  // ── Light / glitch ──
  flash: { label: 'Flash cut', family: 'Light / glitch', D: 0.45, build: ({ A, B, D }) => [
    unit('A', A('end'), D, 1),
    unit('B', B('start'), D, 2, { opacity: kfs([[0, '0%', E.lin], [D * 0.3, '100%']]), x_scale: kf(D * 0.3, '108%', D, '100%', E.qOut), y_scale: kf(D * 0.3, '108%', D, '100%', E.qOut) }),
    white(D, 3, { opacity: kfs([[0, '0%', E.lin], [D * 0.3, '100%', E.lin], [D * 0.85, '0%']]) }),
  ] },
  sweep: { label: 'Light sweep', family: 'Light / glitch', D: 0.65, build: ({ A, B, D }) => [
    unit('A', A('end'), D, 1),
    unit('B', B('start'), D, 2, { opacity: kf(D * 0.18, '0%', D * 0.95, '100%', E.qIO) }),
    { type: 'shape', track: 3, duration: D, path: RECT, fill_color: '#FFFFFF', width: '22%', height: '220%', y: '50%', x_anchor: '50%', y_anchor: '50%', z_rotation: 20, blur_radius: 40, blur_mode: 'stack', opacity: '85%', x: kf(0, '-30%', D, '130%', E.qIO) },
  ] },
  zoomblur: { label: 'Zoom blur', family: 'Light / glitch', D: 0.85, build: ({ A, B, D }) => [
    unit('B', B('start'), D, 1, { x_scale: kf(D * 0.3, '160%', D, '100%', E.qOut), y_scale: kf(D * 0.3, '160%', D, '100%', E.qOut), blur_radius: kf(D * 0.3, 18, D, 0, E.qOut) }),
    unit('A', A('end'), D, 2, { x_scale: kf(0, '100%', D * 0.53, '220%', E.qIn), y_scale: kf(0, '100%', D * 0.53, '220%', E.qIn), blur_radius: kf(0, 0, D * 0.53, 18, E.qIn), opacity: kf(0, '100%', D * 0.53, '0%', E.qIn) }),
  ] },
  glitch: { label: 'Glitch', family: 'Light / glitch', D: 0.72, build: ({ A, B, D, rnd }) => {
    const N = 8, els = [unit('B', B('start'), D, 1)]
    const aE = A('end'), bE = B('start')
    for (let i = 0; i < N; i++) {
      const x0 = i / N
      // A strips: jitter 3 steps then vanish at 58%
      els.push(piece(`A${i}`, aE, D, 2 + i, x0, 0, 1 / N, 1, {
        x: kfs([[0, pct((x0 + 0.5 / N) * 100), E.lin], [D * 0.2, pct((x0 + 0.5 / N) * 100 + (rnd() * 2 - 1) * 4), E.lin], [D * 0.4, pct((x0 + 0.5 / N) * 100 + (rnd() * 2 - 1) * 4), E.lin], [D * 0.58, pct((x0 + 0.5 / N) * 100)]]),
        opacity: kfs([[0, '100%', E.lin], [D * 0.57, '100%', E.lin], [D * 0.58, '0%']]),
      }))
      // B strips: arrive jittered from 52% to 95%, then vanish to reveal clean B
      els.push(piece(`B${i}`, bE, D, 2 + N + i, x0, 0, 1 / N, 1, {
        x: kfs([[0, pct((x0 + 0.5 / N) * 100 + (rnd() * 2 - 1) * 3), E.lin], [D * 0.7, pct((x0 + 0.5 / N) * 100 + (rnd() * 2 - 1) * 3), E.lin], [D * 0.95, pct((x0 + 0.5 / N) * 100)]]),
        opacity: kfs([[0, '0%', E.lin], [D * 0.52, '0%', E.lin], [D * 0.53, '100%', E.lin], [D * 0.95, '100%', E.lin], [D * 0.96, '0%']]),
      }))
    }
    // colour-split ghosts: tinted copies of A offset left/right that flicker
    els.push(unit('Ared', aE, D, 2 + 2 * N, { color_overlay: 'rgba(255,0,90,0.45)', x: '48.5%', opacity: kfs([[0, '0%', E.lin], [D * 0.1, '60%', E.lin], [D * 0.3, '0%', E.lin], [D * 0.45, '55%', E.lin], [D * 0.58, '0%']]) }))
    els.push(unit('Acyan', aE, D, 3 + 2 * N, { color_overlay: 'rgba(0,220,255,0.45)', x: '51.5%', opacity: kfs([[0, '0%', E.lin], [D * 0.15, '55%', E.lin], [D * 0.35, '0%', E.lin], [D * 0.5, '60%', E.lin], [D * 0.58, '0%']]) }))
    return els
  } },
  // ── Shatter / slice (pieces manufactured in-render) ──
  shatter: { label: 'Shatter', family: 'Shatter / slice', D: 0.75, build: ({ A, B, D, rnd, format }) => {
    const cols = format === '9:16' ? 4 : 6, rows = format === '9:16' ? 6 : 4
    const els = [unit('B', B('start'), D, 1)]
    const aE = A('end')
    let t = 2
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const w = 1 / cols, h = 1 / rows, x0 = c * w, y0 = r * h
      const cx = (x0 + w / 2) * 100, cy = (y0 + h / 2) * 100
      const dx = (c - (cols - 1) / 2) * 24 + (rnd() * 2 - 1) * 8
      const dy = (r - (rows - 1) / 2) * 30 + (rnd() * 2 - 1) * 8
      const delay = rnd() * 0.16 * D
      els.push(piece(`T${r}${c}`, aE, D, t++, x0, y0, w, h, {
        x: kf(delay, pct(cx), D, pct(cx + dx), E.qIn),
        y: kf(delay, pct(cy), D, pct(cy + dy), E.qIn),
        z_rotation: kf(delay, 0, D, Math.round((rnd() * 2 - 1) * 90), E.qIn),
        x_scale: kf(delay, '100%', D, '60%', E.qIn), y_scale: kf(delay, '100%', D, '60%', E.qIn),
        opacity: kf(delay, '100%', D, '0%', E.qIn),
      }))
    }
    return els
  } },
  mosaic: { label: 'Mosaic build', family: 'Shatter / slice', D: 0.8, build: ({ A, B, D, format }) => {
    const cols = format === '9:16' ? 4 : 6, rows = format === '9:16' ? 6 : 4
    const els = [unit('A', A('end'), D, 1)]
    const bS = B('start')
    const step = (D - 0.32 * D) / (cols + rows - 2)
    let t = 2
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const w = 1 / cols, h = 1 / rows, x0 = c * w, y0 = r * h
      const delay = (c + r) * step, end = Math.min(D, delay + 0.32 * D)
      els.push(piece(`M${r}${c}`, bS, D, t++, x0, y0, w, h, {
        x_scale: kf(delay, '0%', end, '100%', E.backOut), y_scale: kf(delay, '0%', end, '100%', E.backOut),
        opacity: kf(delay, '0%', end, '100%', E.qOut),
      }))
    }
    return els
  } },
  blinds: { label: 'Blinds', family: 'Shatter / slice', D: 0.75, build: ({ A, B, D }) => {
    const N = 8, els = [unit('B', B('start'), D, 1)]
    const aE = A('end')
    for (let i = 0; i < N; i++) {
      const delay = i * (D * 0.55 / (N - 1)), end = delay + D * 0.45
      els.push(piece(`S${i}`, aE, D, 2 + i, i / N, 0, 1 / N, 1, {
        y_rotation: kf(delay, 0, end, 90, E.qIn), opacity: kf(delay, '100%', end, '50%', E.qIn),
      }))
    }
    return els
  } },
  doors: { label: 'Doors', family: 'Shatter / slice', D: 0.6, build: ({ A, B, D }) => {
    const aE = A('end')
    const L = piece('L', aE, D, 2, 0, 0, 0.5, 1, { x: '0%', x_anchor: '0%', y_rotation: kf(0, 0, D, -110, E.qIn) })
    const R = piece('R', aE, D, 3, 0.5, 0, 0.5, 1, { x: '100%', x_anchor: '100%', y_rotation: kf(0, 0, D, 110, E.qIn) })
    return [unit('B', B('start'), D, 1), L, R]
  } },
  split: { label: 'Split reveal', family: 'Shatter / slice', D: 0.5, build: ({ A, B, D }) => {
    const aE = A('end')
    return [
      unit('B', B('start'), D, 1, { x_scale: kf(0, '112%', D, '100%', E.qOut), y_scale: kf(0, '112%', D, '100%', E.qOut) }),
      piece('T', aE, D, 2, 0, 0, 1, 0.5, { y: kf(0, '25%', D, '-25%', E.qIO) }),
      piece('Bt', aE, D, 3, 0, 0.5, 1, 0.5, { y: kf(0, '75%', D, '125%', E.qIO) }),
    ]
  } },
  // ── Cut-outs (person separated from the world) ──
  // Josh 9/9: the person must LAND before anything of the next photo shows —
  // no early blurred bed of B (that was a soft reveal). A's world stays, dims a
  // touch under the flight, and B's world (bed + photo) arrives only after the
  // landing.
  cutfly: { label: 'Cut-out fly-in', family: 'Cut-out', D: 1.4, needs: 'cutoutB', fallback: 'push', build: ({ A, B, D }) => [
    unit('A', A('end'), D, 1),
    black(D, 2, { opacity: kf(0, '0%', D * 0.3, '35%', E.qIO) }),
    unit('Bfull', B('start'), D, 3, { opacity: kf(D * 0.7, '0%', D, '100%', E.qIO) }),
    unit('Bperson', B('start', { source: 'cutout' }), D, 4, {
      // one continuous ease from entry to landing (Josh 9/9 V7: the two-part
      // flight "jerks" where the segments met)
      x: kfs([[0, '135%'], [D * 0.11, '135%', E.qOut], [D * 0.68, '50%']]),
      x_scale: kfs([[0, '170%'], [D * 0.11, '170%', E.qOut], [D * 0.68, '100%']]),
      y_scale: kfs([[0, '170%'], [D * 0.11, '170%', E.qOut], [D * 0.68, '100%']]),
      opacity: kfs([[0, '0%'], [D * 0.11, '0%', E.qOut], [D * 0.25, '100%']]),
    }),
  ] },
  cutpop: { label: 'Cut-out pop', family: 'Cut-out', D: 1.5, needs: 'cutoutB', fallback: 'barrel', build: ({ A, B, D }) => [
    unit('A', A('end'), D, 1, { blur_radius: kf(0, 0, D * 0.27, 7, E.qIO) }),
    black(D, 2, { opacity: kf(0, '0%', D * 0.27, '55%', E.qIO) }),
    unit('Bfull', B('start'), D, 3, { opacity: kf(D * 0.63, '0%', D, '100%', E.qOut), x_scale: kf(D * 0.63, '112%', D, '100%', E.qOut), y_scale: kf(D * 0.63, '112%', D, '100%', E.qOut) }),
    unit('Bperson', B('start', { source: 'cutout' }), D, 4, { x_scale: kf(D * 0.17, '0%', D * 0.53, '100%', E.backOut), y_scale: kf(D * 0.17, '0%', D * 0.53, '100%', E.backOut), opacity: kf(D * 0.17, '0%', D * 0.3, '100%', E.qOut) }),
  ] },
  // ── Paint (Josh 9/6 idea) ──
  // A settles into its watercolor; drops fall and each one puddles OUTWARD as a
  // round window onto B's watercolor until the frame is covered; B's
  // watercolor then dries into the real photo. Needs clips.watercolor_url on
  // BOTH photos (lib/photo-cutout.js ensureWatercolor). Puddles are pieces
  // with border_radius 50% — if the engine ignores border_radius on
  // compositions they still work, just as growing squares.
  watercolor: { label: 'Watercolor', family: 'Paint', D: 2.6, needs: 'watercolorAB', fallback: 'Dissolve', build: ({ A, B, D, width, height }) => {
    const aW = A('end', { source: 'watercolor' }), bW = B('start', { source: 'watercolor' })
    const els = [
      unit('A', A('end'), D, 1),
      unit('Awc', aW, D, 2, { opacity: kf(0, '0%', D * 0.22, '100%', E.qIO) }),
    ]
    // three drops: land at t=.30/.42/.54 of D, at spread-out points
    const pts = [[0.32, 0.38], [0.66, 0.3], [0.5, 0.7]]
    let track = 3
    pts.forEach(([px, py], i) => {
      const land = D * (0.3 + i * 0.12), fall = D * 0.14
      // the drop (a soft white teardrop falling onto its landing point)
      els.push({ type: 'shape', track: track++, duration: D, path: 'M 50 0 C 70 30 100 55 100 75 A 50 25 0 1 1 0 75 C 0 55 30 30 50 0 Z',
        fill_color: 'rgba(255,255,255,0.85)', width: '2.6%', height: '4.6%', x: pct(px * 100), x_anchor: '50%', y_anchor: '50%', blur_radius: 2,
        y: kf(land - fall, '-6%', land, pct(py * 100), E.qIn),
        opacity: kfs([[0, '0%'], [land - fall, '0%', E.lin], [land - fall + 0.02, '100%', E.lin], [land, '100%', E.lin], [land + 0.08, '0%']]) })
      // the puddle: a round window onto B's watercolor growing from the point
      // a square (in pixels) window so the rounded corners make a true circle;
      // border_radius must be px/vw/vh/vmin (Creatomate rejected '%', 9/6)
      const w = 0.42, h = 0.42 * (width / height)
      els.push(openWindow(`P${i}`, bW, D, track++, px - w / 2, py - h / 2, w, h, land, 0, land + D * 0.42, 3.4, E.qOut, {
        border_radius: `${r2((w / 2) * 100)} vw`,
        opacity: kfs([[0, '0%'], [land, '0%', E.lin], [land + 0.03, '100%']]),
      }))
    })
    // guarantee full coverage, then dry into the real photo
    els.push(unit('Bwc', bW, D, track++, { opacity: kf(D * 0.74, '0%', D * 0.8, '100%', E.lin) }))
    els.push(unit('B', B('start'), D, track++, { opacity: kf(D * 0.8, '0%', D, '100%', E.qIO) }))
    return els
  } },
  cutpeel: { label: 'Person stays, world changes', family: 'Cut-out', D: 1.55, needs: 'cutoutA', fallback: 'Dissolve', build: ({ A, B, D }) => [
    unit('A', A('end'), D, 1),
    unit('Bfull', B('start'), D, 2, { opacity: kf(0, '0%', D * 0.42, '100%', E.qIO) }),
    unit('Aperson', A('end', { source: 'cutout' }), D, 3, { x: kf(D * 0.68, '50%', D, '-25%', E.qIn), x_scale: kf(D * 0.68, '100%', D, '90%', E.qIn), y_scale: kf(D * 0.68, '100%', D, '90%', E.qIn), opacity: kf(D * 0.68, '100%', D, '0%', E.qIn) }),
  ] },
}
export const FX_KEYS = Object.keys(STILLS_FX)
// Everything the B-side pull-down may offer: Cut (native) + every FX.
export const ALL_TRANSITION_KEYS = ['Cut', ...FX_KEYS]
export const FX_LABELS = Object.fromEntries([['Cut', 'Cut'], ...FX_KEYS.map(k => [k, STILLS_FX[k].label])])

// ── VIBES — preset packages, tame → crazy ────────────────────
// theme values ride projects.theme (clean/emotional/fun/party are the video
// vibes reused for Stills — labelled Timeless/Heartfelt/Fun/Party in the
// Stills UI; 'wild' is new and Stills-only).
//   secs     — how long a 1-up holds
//   pool     — weighted transition pool ([key, weight]) when stills_variety='vibe'
//   screens  — repeating pattern of photos-per-screen (1 = single)
//   fxSpeed  — multiplier on FX durations (<1 = snappier)
export const STILLS_VIBES = {
  clean:     { label: 'Timeless',  secs: 3.2, fxSpeed: 1.15, screens: [1, 1, 1, 1, 1, 2],       pool: [['Dissolve', 4], ['Fade', 3], ['sweep', 2], ['watercolor', 2], ['push', 1]] },
  emotional: { label: 'Heartfelt', secs: 3.0, fxSpeed: 1.1,  screens: [1, 1, 1, 1, 2],          pool: [['Dissolve', 3], ['sweep', 2], ['cutpeel', 2], ['watercolor', 2], ['doors', 1], ['zoomblur', 1], ['Fade', 2]] },
  fun:       { label: 'Fun',       secs: 2.6, fxSpeed: 1,    screens: [1, 1, 2, 1, 3, 1],       pool: [['push', 3], ['whip', 2], ['flip', 2], ['split', 2], ['Pop', 1], ['cutpop', 2], ['mosaic', 1], ['Slide', 1], ['Wipe', 1], ['drop', 2]] },
  party:     { label: 'Party',     secs: 2.2, fxSpeed: 0.9,  screens: [1, 2, 1, 4, 1, 1, 3],    pool: [['whip', 3], ['flash', 3], ['shatter', 2], ['glitch', 2], ['barrel', 2], ['cutfly', 3], ['cutpop', 2], ['spinzoom', 1], ['blinds', 1], ['tumble', 1], ['push', 2], ['split', 1], ['drop', 1]] },
  wild:      { label: 'Wild',      secs: 1.8, fxSpeed: 0.8,  screens: [1, 4, 1, 2, 1, 3, 4, 1], pool: [['cutfly', 4], ['cutpop', 3], ['shatter', 3], ['glitch', 3], ['flash', 2], ['whip', 2], ['barrel', 2], ['spinzoom', 2], ['tumble', 1], ['flip', 1], ['blinds', 1], ['doors', 1], ['mosaic', 1], ['zoomblur', 1], ['drop', 1], ['cutpeel', 1]] },
}
export const VIBE_KEYS = Object.keys(STILLS_VIBES)
export function vibeFor(project) {
  const t = String(project?.theme || 'fun').toLowerCase()
  return STILLS_VIBES[t] || STILLS_VIBES.fun
}

// Does this project want watercolor versions of its photos? (They cost an
// AI generation each, so the page only makes them when the film can use them:
// a vibe whose pool has 'watercolor', a mix that includes it, or a per-photo
// override asking for it.)
export function wantsWatercolor(project, clips = []) {
  const variety = String(project?.stills_variety || 'vibe')
  if (variety === 'shuffle') return true
  if (variety === 'mix') return (Array.isArray(project?.stills_mix) ? project.stills_mix : []).map(String).includes('watercolor')
  if (vibeFor(project).pool.some(([k]) => k === 'watercolor')) return true
  return clips.some(c => c && c.photo_transition === 'watercolor')
}

// ── Sequence: group photos into screens, choose each boundary's transition ──
// Rules (in priority order) for the transition INTO screen i:
//   1. clips.photo_transition on the screen's FIRST photo (organizer/guest
//      override; a group selection in the Clips tab writes the same value on
//      every photo of the group — last override in a multi-up screen wins)
//   2. stills_variety='shuffle' → every transition, seeded shuffle
//      stills_variety='mix'     → the organizer's stills_mix ids, seeded shuffle
//      else ('vibe')            → the vibe's weighted pool, seeded, no repeats
//   3. an FX whose `needs` isn't met by these two screens → its `fallback`
export function planStills(project, clips, opts = {}) {
  const vibe = vibeFor(project)
  const rnd = seededRnd(opts.seed != null ? String(opts.seed) : `${project?.id || 'p'}:${clips.length}:${project?.theme || ''}:${project?.stills_variety || ''}`)
  const secs1 = Number(opts.secs) > 0 ? Number(opts.secs) : vibe.secs
  const screenSecs = (n) => (n === 1 ? secs1 : Number((secs1 * (1 + 0.35 * (n - 1))).toFixed(2)))
  // screens: 'auto' (vibe pattern) | 'off' | 'manual' (only explicit groups)
  const screensMode = opts.screens === false ? 'off' : (opts.screens || (String(project?.stills_screens || 'auto') === 'off' ? 'off' : 'auto'))
  // MANUAL GROUPS (portal 9/9): [{ ids:[clip.id…], layout }] — a screen sits
  // where its first member sat in play order; members are pulled out of the run.
  const groups = Array.isArray(opts.groups) ? opts.groups : []
  const groupOf = new Map()
  groups.forEach((g, gi) => (g?.ids || []).forEach(id => { if (!groupOf.has(id)) groupOf.set(id, gi) }))
  const scenes = []
  const used = new Set()
  let i = 0, p = 0
  while (i < clips.length) {
    const c = clips[i]
    if (used.has(c.id)) { i++; continue }
    if (groupOf.has(c.id)) {
      const g = groups[groupOf.get(c.id)]
      const members = clips.filter(x => (g.ids || []).includes(x.id) && !used.has(x.id)).slice(0, 4)
      members.forEach(m => used.add(m.id))
      scenes.push({ clips: members, secs: screenSecs(members.length), layout: g.layout || null })
      i++; continue
    }
    let n = screensMode === 'auto' ? vibe.screens[p % vibe.screens.length] : 1
    p++
    // an auto screen never swallows a photo that belongs to a manual group
    const run = []
    let j = i
    while (run.length < n && j < clips.length && !groupOf.has(clips[j].id) && !used.has(clips[j].id)) { run.push(clips[j]); j++ }
    run.forEach(m => used.add(m.id))
    scenes.push({ clips: run, secs: screenSecs(run.length) })
    i = j
  }
  // transition choice
  const variety = String(opts.variety || project?.stills_variety || 'vibe')
  let pool
  if (Array.isArray(opts.pool) && opts.pool.length) pool = opts.pool.filter(k => NATIVE[k] !== undefined || STILLS_FX[k]).map(k => [k, 1])
  else if (variety === 'shuffle') pool = ALL_TRANSITION_KEYS.filter(k => k !== 'Cut').map(k => [k, 1])
  else if (variety === 'mix') {
    const ids = Array.isArray(project?.stills_mix) ? project.stills_mix : []
    const ok = ids.map(String).filter(k => NATIVE[k] !== undefined || STILLS_FX[k])
    pool = ok.length ? ok.map(k => [k, 1]) : vibe.pool
  } else pool = vibe.pool
  const total = pool.reduce((s, [, w]) => s + w, 0)
  let last = null
  // 'cycle' (portal default): walk the pool IN ORDER, wrapping — Josh 9/9
  // "cycle through all of the transitions". Anything else = seeded weighted pick.
  let cursor = 0
  const pick = () => {
    if (opts.order === 'cycle') { const k = pool[cursor % pool.length][0]; cursor++; return k }
    for (let tries = 0; tries < 6; tries++) {
      let r = rnd() * total
      for (const [k, w] of pool) { r -= w; if (r <= 0) { if (k !== last || pool.length === 1) return k; break } }
    }
    return pool[0][0]
  }
  const hasCut = (scene) => scene.clips.length === 1 && !!scene.clips[0].cutout_url
  scenes.forEach((scene, k) => {
    if (k === 0) { scene.transition = null; return }
    const ov = scene.clips[0]?.photo_transition
    const picked = !!(ov && (NATIVE[ov] !== undefined || STILLS_FX[ov]))
    let key = picked ? ov : pick()
    // needs / fallback (loop guards a fallback that itself needs something)
    for (let guard = 0; guard < 3; guard++) {
      const fx = STILLS_FX[key]
      if (!fx || !fx.needs) break
      const hasWc = (s) => s.clips.length === 1 && !!s.clips[0].watercolor_url
      const met = fx.needs === 'cutoutB' ? hasCut(scene)
        : fx.needs === 'cutoutA' ? hasCut(scenes[k - 1])
        : fx.needs === 'watercolorAB' ? (hasWc(scene) && hasWc(scenes[k - 1]))
        : true
      if (met) break
      // remember what was asked for, so the render can SAY it fell back
      // (Josh 9/9: "I did a cut out for Image 9 and it didn't happen")
      if (picked && !scene.wanted) scene.wanted = { key, needs: fx.needs }
      key = fx.fallback
    }
    scene.transition = key
    last = key
  })
  return { vibe, scenes }
}

// ── Build the Clips-composition elements for a Stills film ───
// Returns { elements, totalSecs } where totalSecs already accounts for native
// overlaps and inserted FX scenes (used for the music cap).
export function buildStillsElements(project, clips, ctx) {
  const { width, height, format, speedMult = 1 } = ctx
  const { vibe, scenes } = planStills(project, clips, ctx.planOpts || {})
  const elements = []
  let total = 0
  const seedRnd = seededRnd(`fx:${project?.id || 'p'}`)
  scenes.forEach((scene, k) => {
    const sceneEl = { name: `Clip-${k + 1}`, type: 'composition', track: 1, duration: scene.secs, elements: buildStack(scene, ctx, 'run') }
    const key = scene.transition
    if (key && STILLS_FX[key]) {
      const fx = STILLS_FX[key]
      const D = Number((fx.D * (ctx.fxSpeed || vibe.fxSpeed) * speedMult).toFixed(3))
      const prev = scenes[k - 1]
      const aSet = new Set(), bSet = new Set()
      const A = (phase, o = {}) => { const s = stackFor(prev, ctx, phase, D, o); aSet.add(s); return s }
      const B = (phase, o = {}) => { const s = stackFor(scene, ctx, phase, D, o); bSet.add(s); return s }
      let fxEls = fx.build({ A, B, D, rnd: seedRnd, format, width, height })
      if (ctx.keySafe || ctx.morphBoxes !== false) fxEls = keySafe(fxEls, aSet, bSet, sceneBoxes(prev, scene, ctx), D, !!ctx.keySafe)
      elements.push({ name: `FX-${k + 1}-${key}`, type: 'composition', track: 1, duration: D, elements: fxEls })
      total += D
    } else if (key && NATIVE[key]) {
      // only 'Cut' reaches here (null → nothing); kept for any future native
      const tr = NATIVE[key]
      const d = Number((tr.duration * speedMult).toFixed(2))
      sceneEl.animations = [{ time: 'start', duration: d, transition: true, type: tr.type, enable: 'second-only' }]
      total -= d
    }
    elements.push(sceneEl)
    total += scene.secs
  })
  return { elements, totalSecs: Number(total.toFixed(2)), scenes }
}

// ── Key-safe mode (ctx.keySafe — a green/magenta backdrop that will be
// chroma-keyed later). Josh 9/9: "double check key color bleed through
// images" / "background image popping off". Two facts drive everything here:
//   1. A pixel that is PARTLY transparent over the key colour blends with it,
//      and that tint survives the key — so nothing in an FX scene may be
//      semi-transparent where the backdrop shows. Decorative shapes (flash
//      white, dim black, sweep bar, drops) are dropped, blur_radius is dropped,
//      and opacity fades become hard on/off steps at the fade's midpoint —
//      except where a fade sits over real picture (below).
//   2. Every photo is a different shape, and the backdrop is flat, so any
//      moment where the next photo's box is simply "there" outside the old
//      photo's box (or the old one lingers outside the new one) reads as the
//      background popping. So the boxes MORPH: a clipped window slides from
//      one photo's box to the other's while the picture inside zooms just
//      enough to always fill it.
//      • B fades in over A (Fade, Dissolve, Wipe's end, cut-out worlds…):
//        A is held opaque and morphs A-box → B-box during the first 45%,
//        then B's real fade runs on top of picture only.
//      • A leaves and B waits underneath (shatter, blinds, doors, drop…):
//        B first shows zoomed + clipped to A's box, then morphs to its own
//        box over the last 45%, after A's pieces have gone.
//      • A shrinks/fades behind a moving B (Zoom, Pop, Slide): the fade is
//        replaced by A collapsing to nothing — opaque motion never tints.
// The box morphs run on EVERY backdrop (a blurred bed shows the mismatch just
// as plainly — Josh 9/9 V7 ":50 still shows the image under it on the edges");
// only the tint rules (strict) are key-colour specific.
// Elements are told apart by identity: the stack arrays A()/B() returned.
function sceneBoxes(prev, scene, ctx) {
  if (!prev || !scene || prev.clips.length !== 1 || scene.clips.length !== 1) return null
  const fsFor = c => (ctx.frameFor ? ctx.frameFor(c) : frameStyle(ctx.project))
  const insetFor = c => { const fs = fsFor(c); return fs && fs.on ? fs.thick * ctx.height : 0 }
  const ia = insetFor(prev.clips[0]), ib = insetFor(scene.clips[0])
  const a = photoBox(prev.clips[0], ctx.width, ctx.height, null, ia)
  const b = photoBox(scene.clips[0], ctx.width, ctx.height, null, ib)
  const grow = DRIFT.scale1 / 100, off = DRIFT.dy / 2 / 100
  // frame fractions: A frozen at its drift END (106%, centre above middle),
  // B at its drift START (100%, centre below middle). The boxes are the WHOLE
  // print — photo plus its mat — because the morph windows clip to them (Josh
  // 9/9: "the frame comes and goes on many transitions" = windows sized to
  // the bare photo were cutting the mat off for the length of every move).
  return {
    a: { w: ((a.boxW + 2 * ia) * grow) / ctx.width, h: ((a.boxH + 2 * ia) * grow) / ctx.height, cx: 0.5, cy: 0.5 - off },
    b: { w: (b.boxW + 2 * ib) / ctx.width, h: (b.boxH + 2 * ib) / ctx.height, cx: 0.5, cy: 0.5 + off },
  }
}
// Scale (about the frame centre) that makes box C cover box T, ≥ 1.
function coverScale(C, T) {
  const s = [
    (0.5 - T.cx + T.w / 2) / Math.max(0.02, 0.5 - C.cx + C.w / 2),
    (T.cx + T.w / 2 - 0.5) / Math.max(0.02, C.cx + C.w / 2 - 0.5),
    (0.5 - T.cy + T.h / 2) / Math.max(0.02, 0.5 - C.cy + C.h / 2),
    (T.cy + T.h / 2 - 0.5) / Math.max(0.02, C.cy + C.h / 2 - 0.5),
  ]
  return Math.min(4, Math.max(1, ...s) * 1.01)
}
const sameBox = (p, q) => Math.abs(p.w - q.w) < 0.003 && Math.abs(p.h - q.h) < 0.003 && Math.abs(p.cy - q.cy) < 0.003
// A window that slides/resizes from box F to box T over [t0,t1] while the
// content (frame-locked) zooms s0→s1 about the frame centre. Sampled on one
// piecewise-linear curve so window and content agree at every breakpoint.
function morph(name, els, D, track, F, T, s0, s1, t0, t1, props = {}) {
  const NS = 30, fn = EASE_FN[E.qIO]
  const wx = [], wy = [], wsx = [], wsy = [], ix = [], iy = [], isx = [], isy = [], zs = []
  const at = (tm, u) => {
    const w = F.w + (T.w - F.w) * u, h = F.h + (T.h - F.h) * u
    const cx = F.cx + (T.cx - F.cx) * u, cy = F.cy + (T.cy - F.cy) * u
    const s = s0 + (s1 - s0) * u
    const t = r3(tm)
    wx.push({ time: t, value: pct(cx * 100), easing: E.lin }); wy.push({ time: t, value: pct(cy * 100), easing: E.lin })
    wsx.push({ time: t, value: pct((w / T.w) * 100), easing: E.lin }); wsy.push({ time: t, value: pct((h / T.h) * 100), easing: E.lin })
    // inner comp is frame-sized once counter-scaled; place its centre on the frame centre
    isx.push({ time: t, value: pct((T.w / w) * 100), easing: E.lin }); isy.push({ time: t, value: pct((T.h / h) * 100), easing: E.lin })
    ix.push({ time: t, value: pct(50 + ((0.5 - cx) / w) * 100), easing: E.lin }); iy.push({ time: t, value: pct(50 + ((0.5 - cy) / h) * 100), easing: E.lin })
    zs.push({ time: t, value: pct(s * 100), easing: E.lin })
  }
  if (t0 > 0) at(0, 0)
  for (let i = 0; i <= NS; i++) at(t0 + (t1 - t0) * (i / NS), fn(i / NS))
  if (t1 < D) at(D, 1)
  return {
    name, type: 'composition', track, duration: D, clip: true,
    width: pct(T.w * 100), height: pct(T.h * 100),
    x: wx, y: wy, x_anchor: '50%', y_anchor: '50%', x_scale: wsx, y_scale: wsy,
    elements: [{
      type: 'composition', track: 1, duration: D,
      width: pct(100 / T.w), height: pct(100 / T.h),
      x: ix, y: iy, x_anchor: '50%', y_anchor: '50%', x_scale: isx, y_scale: isy,
      elements: [{ type: 'composition', track: 1, duration: D, ...FULL, x_scale: zs, y_scale: zs, elements: els }],
    }],
    ...props,
  }
}
// The unit keeps its own bed layers (MEvid) and its own motion; only its photo
// comps go into the morphing window.
function morphUnit(unit, D, F, T, s0, s1, t0, t1) {
  const stack = unit.elements
  const photos = stack.filter(e => e.type === 'composition')
  const others = stack.filter(e => e.type !== 'composition')
  if (!photos.length) return unit
  const win = morph(`${unit.name}-box`, photos, D, photos[0].track, F, T, s0, s1, t0, t1)
  return { ...unit, elements: [...others, win] }
}
function stepOpacity(v) {
  if (!Array.isArray(v)) return v
  const snap = x => (parseFloat(String(x)) >= 50 ? '100%' : '0%')
  const out = []
  v.forEach((k, i) => {
    const s = snap(k.value)
    if (i > 0) {
      const prevS = snap(v[i - 1].value)
      if (prevS !== s) {
        const tm = (Number(v[i - 1].time) + Number(k.time)) / 2
        out.push({ time: r2(Math.max(Number(v[i - 1].time), tm - 0.01)), value: prevS, easing: E.lin })
        out.push({ time: r2(tm), value: s, easing: E.lin })
      }
    } else out.push({ time: Number(k.time), value: s, easing: E.lin })
  })
  return out
}
const TRANSFORM_KEYS = ['x', 'y', 'x_scale', 'y_scale', 'x_rotation', 'y_rotation', 'z_rotation']
function keySafe(els, aSet, bSet, geo, D, strict = true) {
  const side = el => {
    const inner = el.elements
    if (aSet.has(inner) || bSet.has(inner)) return aSet.has(inner) ? 'A' : 'B'
    const deep = inner && inner[0] && inner[0].elements
    return aSet.has(deep) ? 'A' : bSet.has(deep) ? 'B' : 'A'
  }
  const comps = els.filter(el => el.type === 'composition')
  const moves = el => TRANSFORM_KEYS.some(k => Array.isArray(el[k]))
  const isUnit = el => aSet.has(el.elements) || bSet.has(el.elements)
  const aTracks = comps.filter(el => side(el) === 'A').map(el => el.track)
  const bTracks = comps.filter(el => side(el) === 'B').map(el => el.track)
  const bOnTop = aTracks.length && bTracks.length && Math.max(...aTracks) < Math.min(...bTracks)
  const needHold = comps.some(el => side(el) === 'B' && Array.isArray(el.opacity) && !moves(el))
  const hold = !!(geo && bOnTop && needHold)
  const reveal = !!(geo && !bOnTop && !sameBox(geo.a, geo.b))
  const zoomEnd = geo && bOnTop ? r3(D * 0.45) : 0
  const settle = r3(D * 0.55)
  const out = []
  for (const el of els) {
    if (el.type !== 'composition') { if (!strict) out.push(el); continue }
    const rest = { ...el }
    if (strict) { delete rest.blur_radius; delete rest.blur_mode }
    const s = side(el)
    if (s === 'A' && isUnit(rest) && geo && bOnTop && (hold || !moves(rest))) {
      // A stays underneath while B arrives on top: held opaque, its box morphs
      // into B's (zooming to keep it filled) so nothing of A lingers outside B
      for (const k of TRANSFORM_KEYS) if (Array.isArray(rest[k])) delete rest[k]
      delete rest.opacity
      out.push(sameBox(geo.a, geo.b) ? rest : morphUnit(rest, D, geo.a, geo.b, 1, coverScale(geo.a, geo.b), 0, zoomEnd))
      continue
    }
    if (s === 'B' && hold && !moves(rest) && Array.isArray(rest.opacity)) {
      // the real fade, pushed after the morph so it only ever sits on picture
      if (zoomEnd) rest.opacity = rest.opacity.map(k => ({ ...k, time: r3(zoomEnd + Number(k.time) * (D - zoomEnd) / D) }))
      out.push(rest)
      continue
    }
    if (s === 'B' && reveal && isUnit(rest)) {
      // waits underneath at A's box (zoomed to fill it), settles into its own box last
      const win = morphUnit(rest, D, geo.a, geo.b, coverScale(geo.b, geo.a), 1, settle, D)
      if (strict && 'opacity' in win) win.opacity = stepOpacity(win.opacity)
      out.push(win)
      continue
    }
    if (strict && 'opacity' in rest) {
      const last = Array.isArray(rest.opacity) ? parseFloat(rest.opacity[rest.opacity.length - 1].value) : 100
      const lastScale = Array.isArray(rest.x_scale) ? parseFloat(rest.x_scale[rest.x_scale.length - 1].value) : 100
      if (s === 'A' && isUnit(rest) && last < 50 && Array.isArray(rest.x_scale) && lastScale <= 100) {
        // shrink-and-fade behind B → collapse instead (no tint, no pop)
        const end = Number(rest.opacity[rest.opacity.length - 1].time)
        const start = Number(rest.x_scale[0].time)
        rest.x_scale = kf(start, rest.x_scale[0].value, end, '0%', E.qIn)
        rest.y_scale = kf(start, rest.y_scale[0].value, end, '0%', E.qIn)
        delete rest.opacity
      } else {
        rest.opacity = stepOpacity(rest.opacity)
      }
    }
    out.push(rest)
  }
  return out
}

// A stack frozen for an FX scene: same layers, duration D, no drift motion.
function stackFor(scene, ctx, phase, D, o) {
  const frozen = { ...scene, secs: D }
  if (o.bedOnly) {
    return buildStack({ ...frozen, clips: [scene.clips[0]] }, ctx, phase).slice(0, 2)
  }
  return buildStack(frozen, ctx, phase, { source: o.source || 'photo' })
}

// ═════════════════════════════════════════════════════════════════════════════
// STILLS SOURCE — the Studio Portal adapter (Montage Maker style 'stills').
// Everything above is the MEvid engine verbatim; this section maps the portal's
// play sequence + segment settings onto it and wraps the result in the portal's
// shell (background bed, cards, green bookends, watermark).
//
//   S            the STYLES.stills entry (photoS = seconds per photo)
//   seq          route items: { type:'photo', url, w, h, green?, border?, mode?,
//                contrast?, sourceKey, cutout_url?, watercolor_url? } — placeholders
//                are dropped (a stills reel is photos only)
//   stills       segment settings: { mode:'cycle'|'shuffle'|'mix', mix:[keys],
//                screens:'off'|'auto'|'manual', picks:{sourceKey: fxKey},
//                groups:[{ keys:[sourceKey…], layout }], shadow:true|false }
//   lib          helpers handed in by montage.js (no circular import):
//                { bgLayers, card, CARD_S, greenSlot, applyPhotoColor, backdropIsGreen, borderIsOn }
// ═════════════════════════════════════════════════════════════════════════════
export function stillsSource({ S, seq, title, subtitle, watermarkUrl, includeCards, width: W, height: H, background, perPhoto = null, stills = null, lib }) {
  const st = stills && typeof stills === 'object' ? stills : {}
  const items = (seq || []).filter(it => it && it.type !== 'placeholder')
  // Green bookends arrive as photo items flagged green (first / last).
  const headGreen = items.length && items[0].green ? items[0] : null
  const tailGreen = items.length > 1 && items[items.length - 1].green ? items[items.length - 1] : null
  const photos = items.filter(it => !it.green && it.url)
  const secs = Math.max(0.6, perPhoto != null ? perPhoto : (Number(S.photoS) || 2.6))
  const cardS = includeCards ? lib.CARD_S : 0
  const greenBeat = secs
  const format = W > H ? '16:9' : (W < H ? '9:16' : '1:1')
  const isGreen = lib.backdropIsGreen(background, S)

  // Route items → engine clips. id = the photo's own key so picks/groups match.
  const picks = st.picks && typeof st.picks === 'object' ? st.picks : {}
  const clips = photos.map((it, i) => ({
    id: it.sourceKey || it.r2_key || `p${i}`,
    mime_type: 'image/jpeg', clip_url: it.url, width: it.w || 1500, height: it.h || 1000, dimsUnknown: !(it.w > 0 && it.h > 0),
    cutout_url: it.cutout_url || null, watercolor_url: it.watercolor_url || null,
    photo_transition: picks[it.sourceKey || it.r2_key] || null,
    photo_scale: Number.isFinite(Number(it.size)) && Number(it.size) > 0 ? Number(it.size) / 100 : undefined,
    _it: it,
  }))
  const groups = (Array.isArray(st.groups) ? st.groups : []).map(g => ({ ids: Array.isArray(g?.keys) ? g.keys : (g?.ids || []), layout: g?.layout || null }))

  // Transition order: cycle (default) walks the whole list in order; shuffle is
  // a seeded random walk; mix cycles the organizer's chosen subset.
  // Cycle order mixes the families so no two neighbours feel alike (natives
  // sprinkled between the moves rather than seven fades in a row).
  const CYCLE = ['flip', 'Dissolve', 'push', 'shatter', 'Fade', 'cutfly', 'whip', 'doors', 'Slide', 'barrel', 'split', 'sweep', 'Wipe', 'tumble', 'mosaic', 'flash', 'Zoom', 'spinzoom', 'blinds', 'cutpop', 'Pop', 'glitch', 'zoomblur', 'drop', 'cutpeel', 'watercolor']
  const allKeys = [...CYCLE.filter(k => NATIVE[k] !== undefined || STILLS_FX[k]), ...ALL_TRANSITION_KEYS.filter(k => k !== 'Cut' && !CYCLE.includes(k))]
  const mode = ['cycle', 'shuffle', 'mix'].includes(st.mode) ? st.mode : 'cycle'
  const mix = Array.isArray(st.mix) ? st.mix.filter(k => allKeys.includes(k)) : []
  const planOpts = {
    secs,
    screens: ['off', 'auto', 'manual'].includes(st.screens) ? st.screens : 'off',
    groups,
    pool: mode === 'mix' && mix.length ? mix : allKeys,
    order: mode === 'shuffle' ? 'random' : 'cycle',
    seed: mode === 'shuffle' ? (st.seed || Date.now()) : 'cycle',
  }
  // Frame per photo = the portal's resolved border (album / per-photo /
  // montage-wide), drawn as a print mat. Shadow off on a keyable backdrop.
  const frameFor = (clip) => {
    const b = clip._it && clip._it.border
    const on = !!(b && lib.borderIsOn(b))
    const thick = on ? (Number(b.w) / 100) * Math.min(W, H) / H : 0
    return { on, color: on && /^#[0-9a-f]{6}$/i.test(String(b.color || '')) ? b.color : '#FFFFFF', shadow: st.shadow !== false && !isGreen, thick }
  }
  const ctx = {
    width: W, height: H, format, speedMult: 1, fxSpeed: 1,
    project: { id: 'portal', theme: 'fun', overlays_enabled: false },
    noBed: true, frameFor, planOpts,
    keySafe: isGreen, // chroma-key backdrop: no semi-transparent pixels over it
    imageProps: (el, clip) => lib.applyPhotoColor(el, clip._it || {}),
  }
  const built = buildStillsElements(ctx.project, clips, ctx)

  // Timeline: [card] [green beat] [clips body] [green beat] [card]
  const lead = cardS + (headGreen ? greenBeat : 0)
  const body = built.totalSecs
  const total = lead + body + (tailGreen ? greenBeat : 0) + cardS

  // Blurred-bed shots for the default backdrop: one bed per scene, each holding
  // through the FX that leads INTO the next scene (the FX plays over A's bed).
  const shots = []
  let pendingFx = 0, nextSeam = 0
  for (const el of built.elements) {
    // an FX scene extends A's bed to the FX's end and makes the NEXT bed's seam
    // the FX's length, so the beds crossfade under the move itself
    if (el.name && el.name.startsWith('FX-')) { if (shots.length) { shots[shots.length - 1].dur += el.duration; nextSeam = el.duration } else pendingFx += el.duration; continue }
    const ov = el.animations && el.animations[0] && el.animations[0].transition ? Number(el.animations[0].duration) || 0 : 0
    if (shots.length && ov) shots[shots.length - 1].dur -= ov
    const first = el.elements && el.elements.find(e => e.type === 'composition' && e.elements && e.elements.find(x => x.type === 'image'))
    const url = first ? first.elements.find(x => x.type === 'image').source : (photos[0] && photos[0].url)
    shots.push({ url, dur: Number(el.duration) + pendingFx, it: photos.find(p => p.url === url) || null, seam: nextSeam || undefined }); pendingFx = 0; nextSeam = 0
  }
  shots.lead = lead
  const bg = background || { photoBlur: true }
  const elements = []
  lib.bgLayers(bg, S, { track: 1, time: 0, duration: +total.toFixed(3), shots }).forEach(el => elements.push(el))
  if (includeCards) {
    elements.push({ name: 'Opening', type: 'composition', track: 20, time: 0, duration: lib.CARD_S, elements: lib.card(S, { kicker: S.kicker, title, subtitle, height: H }) })
  }
  if (headGreen) elements.push(lib.greenSlot('GreenIn', cardS, greenBeat, 4))
  elements.push({
    name: 'Clips', type: 'composition', track: 4, time: +lead.toFixed(3), duration: +body.toFixed(3),
    width: '100%', height: '100%', x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
    elements: built.elements,
  })
  if (tailGreen) elements.push(lib.greenSlot('GreenOut', lead + body, greenBeat, 4))
  if (includeCards) {
    elements.push({ name: 'Closing', type: 'composition', track: 20, time: +(total - lib.CARD_S).toFixed(3), duration: lib.CARD_S,
      elements: lib.card(S, { kicker: null, title: title || 'THANK YOU', subtitle: 'A MAIN EVENT STUDIO PRODUCTION', height: H }) })
  }
  if (watermarkUrl) {
    elements.push({ name: 'Watermark', type: 'image', track: 99, source: watermarkUrl, time: 0,
      duration: Math.max(1, +(total - 0.1).toFixed(3)), width: '62%', height: '6.9%',
      x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', opacity: '42%' })
  }
  return { output_format: 'mp4', width: W, height: H, frame_rate: 30, elements, _stills: { scenes: built.scenes.map(s => ({ ids: s.clips.map(c => c.id), transition: s.transition, secs: s.secs, wanted: s.wanted || null })) } }
}
