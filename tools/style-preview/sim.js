/* ---------------------------------------------------------------------------
 * creatomate-sim — a DOM approximation of Creatomate's RenderScript player.
 *
 * WHY THIS EXISTS: lib/montage.js builds Creatomate source JSON. We cannot
 * render it here (Creatomate renders in their cloud). This plays that SAME JSON
 * in a browser so a style's look can be seen, screenshotted and turned into a
 * style-picker sample clip — driven by the real engine output, not a hand-drawn
 * mock, so the preview cannot silently drift from the code.
 *
 * IT IS AN APPROXIMATION. It models my understanding of Creatomate's semantics.
 * Anything it gets wrong, it will get wrong CONFIDENTLY. Only a real Creatomate
 * draft render is proof. Known approximations are marked APPROX below.
 *
 * Modelled: nested compositions (clip), images (cover/contain), shapes (SVG
 * path in 0..100 space), text, % geometry with anchors, x/y/x_scale/y_scale/
 * z_rotation/opacity/blur_radius keyframes with linear + quadratic easing,
 * same-track auto-sequencing, transition animations (fade/slide/scale/
 * circular-wipe), color_filter, blend_mode, shadows.
 * ------------------------------------------------------------------------- */

(function (global) {
  'use strict';

  // ---- value parsing -------------------------------------------------------
  function num(v, dflt) {
    if (v == null) return dflt;
    if (typeof v === 'number') return v;
    const m = String(v).match(/-?\d*\.?\d+/);
    return m ? parseFloat(m[0]) : dflt;
  }
  const isKf = (v) => Array.isArray(v) && v.length > 0 && typeof v[0] === 'object';

  // Creatomate easing names seen in the engine. Everything else -> linear.
  function ease(name, p) {
    switch (name) {
      case 'quadratic-in': return p * p;
      case 'quadratic-out': return 1 - (1 - p) * (1 - p);
      case 'quadratic-in-out': return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      default: return p; // linear
    }
  }

  // Sample a keyframe array at local time t. Easing lives on the FIRST keyframe
  // of a pair (the engine's stated convention).
  function sampleKf(kf, t, dflt) {
    if (!isKf(kf)) return num(kf, dflt);
    if (t <= num(kf[0].time, 0)) return num(kf[0].value, dflt);
    for (let i = 0; i < kf.length - 1; i++) {
      const a = kf[i], b = kf[i + 1];
      const ta = num(a.time, 0), tb = num(b.time, 0);
      if (t >= ta && t <= tb) {
        if (tb <= ta) return num(b.value, dflt);
        const p = ease(a.easing, (t - ta) / (tb - ta));
        const va = num(a.value, dflt), vb = num(b.value, dflt);
        return va + (vb - va) * p;
      }
    }
    return num(kf[kf.length - 1].value, dflt);
  }

  const prop = (el, key, t, dflt) => sampleKf(el[key], t, dflt);

  // ---- timeline ------------------------------------------------------------
  // Siblings on the SAME track auto-sequence when they carry no explicit `time`;
  // a transition animation makes an element overlap its predecessor by the
  // transition's duration. Elements with an explicit `time` are pinned.
  function transitionOf(el) {
    if (!Array.isArray(el.animations)) return null;
    return el.animations.find((a) => a && a.transition) || null;
  }

  // An element with an EXPLICIT track shares that track (and therefore
  // auto-sequences with its track-mates). An element with NO track gets its own
  // track, so it STACKS rather than sequences.
  //
  // Evidence for this rule, not a guess: polaroidStackSource builds each print as
  // a composition containing a paper `shape` and the photo `image`, neither with
  // a track, and that style is confirmed rendering correctly in production with
  // the photo ON the paper. If untracked siblings shared track 1 they would play
  // one after the other and the photo would never appear. (My first version of
  // this simulator defaulted them to track 1 and drew blank white prints —
  // which is how I found it.)
  const trackKey = (el, i) => (el.track == null ? `A${i}` : `T${el.track}`);
  const zOf = (el, i) => (el.track == null ? i + 1 : el.track);

  function schedule(children, parentDur) {
    const byTrack = new Map();
    children.forEach((el, i) => {
      const tr = trackKey(el, i);
      if (!byTrack.has(tr)) byTrack.set(tr, []);
      byTrack.get(tr).push({ el, i });
    });
    const out = new Map(); // index -> {start, dur}
    for (const list of byTrack.values()) {
      let cursor = 0;
      for (const { el, i } of list) {
        const tr = transitionOf(el);
        const overlap = tr ? num(tr.duration, 0) : 0;
        let start = typeof el.time === 'number' ? el.time : Math.max(0, cursor - overlap);
        let dur = typeof el.duration === 'number' ? el.duration : Math.max(0, parentDur - start);
        out.set(i, { start, dur, transition: tr });
        cursor = start + dur;
      }
    }
    return out;
  }

  function sourceDuration(src) {
    const sch = schedule(src.elements || [], 0);
    let end = 0;
    (src.elements || []).forEach((_, i) => {
      const s = sch.get(i);
      if (s) end = Math.max(end, s.start + s.dur);
    });
    return end;
  }

  // ---- rendering -----------------------------------------------------------
  function pct(v, dflt) { return num(v, dflt); }

  function applyFilters(el, style, t, scale) {
    const f = [];
    if (el.color_filter) {
      const v = num(el.color_filter_value, 100);
      if (el.color_filter === 'grayscale') f.push(`grayscale(${v}%)`);
      else if (el.color_filter === 'sepia') f.push(`sepia(${v}%)`);
      else if (el.color_filter === 'contrast') f.push(`contrast(${100 + v}%)`);
      else if (el.color_filter === 'brighten') f.push(`brightness(${100 + v}%)`);
      else if (el.color_filter === 'invert') f.push(`invert(${v}%)`);
      else if (el.color_filter === 'hue') f.push(`hue-rotate(${v * 3.6}deg)`);
    }
    // blur_radius is in the source's own pixel space (1920-wide), so it must be
    // scaled to the preview or a preview at 520px shows ~4x too much blur.
    const blur = prop(el, 'blur_radius', t, 0) * (scale || 1);
    if (blur > 0) f.push(`blur(${blur.toFixed(2)}px)`);
    if (f.length) style.filter = f.join(' ');
  }

  function applyShadow(el, style, vmin) {
    if (!el.shadow_color) return;
    const u = (v) => {
      const n = num(v, 0);
      return String(v).includes('vmin') ? (n / 100) * vmin : n;
    };
    style.boxShadow = `${u(el.shadow_x)}px ${u(el.shadow_y)}px ${u(el.shadow_blur)}px ${el.shadow_color}`;
  }

  // A transition animation modifies the INCOMING element over its first
  // `duration` seconds. APPROX: Creatomate also animates the outgoing element
  // for slide/scale/circular-wipe; we only animate the incoming one, so those
  // transitions read softer here than in a real render. (This is exactly the
  // "green bleed on movement transitions" area — do not trust this sim there.)
  function transitionStyle(kind, p, box) {
    const s = { opacity: 1, tx: 0, ty: 0, sc: 1, clip: null };
    if (p >= 1) return s;
    switch (kind) {
      case 'fade':
        s.opacity = p; break;
      case 'slide':
        s.tx = (1 - p) * 100; break;              // enters from the right
      case 'scale':
        s.sc = 0.6 + 0.4 * p; s.opacity = p; break;
      case 'wipe': {
        s.clip = `inset(0 0 0 ${((1 - p) * 100).toFixed(1)}%)`; break;   // APPROX: linear reveal, incoming only
      }
      case 'circular-wipe': {
        const r = p * 75;                          // % of the box diagonal
        s.clip = `circle(${r}% at 50% 50%)`; break;
      }
      default:
        s.opacity = p;
    }
    return s;
  }

  function renderEl(el, ctx, parentBox, localT, span) {
    const { doc, vmin } = ctx;
    const node = doc.createElement('div');
    const st = node.style;
    st.position = 'absolute';
    st.transformStyle = 'flat';

    // ABSOLUTE UNITS. Creatomate accepts '535 px' for width/height, in the
    // SOURCE's pixel space (1920x1080). num() strips the unit, so this used to
    // write `width: 535%` — 535 percent of the parent — and any element sized
    // in px previewed as nonsense. Framed Box pins its picture at an explicit
    // pixel size precisely so it does not scale with its animating parent, and
    // it previewed as garbage while the JSON was correct. Same class of bug the
    // README already records for stroke_width.
    const absLen = (v) => {
      if (typeof v !== 'string') return null;
      const m = v.match(/^\s*(-?\d*\.?\d+)\s*(px|vmin|vmax|vw|vh)\s*$/);
      if (!m) return null;
      const n = parseFloat(m[1]);
      const u = m[2];
      const src = u === 'px' ? n
        : u === 'vmin' ? n / 100 * Math.min(ctx.srcW || 1920, ctx.srcH || 1080)
        : u === 'vmax' ? n / 100 * Math.max(ctx.srcW || 1920, ctx.srcH || 1080)
        : u === 'vw' ? n / 100 * (ctx.srcW || 1920)
        : n / 100 * (ctx.srcH || 1080);
      return src * (ctx.scale || 1);
    };
    const rawW = prop(el, 'width', localT, 100);
    const rawH = prop(el, 'height', localT, 100);
    const absW = absLen(rawW), absH = absLen(rawH);
    const w = pct(rawW, 100);
    const h = pct(rawH, 100);
    const x = pct(prop(el, 'x', localT, 50), 50);
    const y = pct(prop(el, 'y', localT, 50), 50);
    const ax = pct(el.x_anchor, 50);
    const ay = pct(el.y_anchor, 50);
    const sx = pct(prop(el, 'x_scale', localT, 100), 100) / 100;
    const sy = pct(prop(el, 'y_scale', localT, 100), 100) / 100;
    const rot = prop(el, 'z_rotation', localT, 0);
    let op = pct(prop(el, 'opacity', localT, 100), 100) / 100;

    // transition on the incoming element
    let tsc = 1, ttx = 0, tty = 0, clip = null;
    if (span && span.transition) {
      const d = num(span.transition.duration, 0);
      if (d > 0 && localT < d) {
        const ts = transitionStyle(span.transition.type, localT / d);
        op *= ts.opacity; tsc = ts.sc; ttx = ts.tx; tty = ts.ty; clip = ts.clip;
      }
    }

    st.width = absW != null ? absW.toFixed(2) + 'px' : w + '%';
    st.height = absH != null ? absH.toFixed(2) + 'px' : h + '%';
    st.left = x + '%';
    st.top = y + '%';
    st.transformOrigin = `${ax}% ${ay}%`;
    st.transform = `translate(${-ax}%, ${-ay}%) translate(${ttx}%, ${tty}%) rotate(${rot}deg) scale(${sx * tsc}, ${sy * tsc})`;
    st.opacity = String(Math.max(0, Math.min(1, op)));
    if (clip) st.clipPath = clip;
    if (el.blend_mode && el.blend_mode !== 'normal') st.mixBlendMode = el.blend_mode;
    applyShadow(el, st, vmin);

    const boxW = parentBox.w * w / 100, boxH = parentBox.h * h / 100;

    if (el.type === 'composition') {
      if (el.clip) st.overflow = 'hidden';
      const dur = span ? span.dur : 0;
      const kids = el.elements || [];
      const sch = schedule(kids, dur);
      const drawn = [];
      kids.forEach((k, i) => {
        const s = sch.get(i);
        if (!s) return;
        if (localT < s.start - 1e-6 || localT > s.start + s.dur + 1e-6) return;
        drawn.push({ z: zOf(k, i), node: renderEl(k, ctx, { w: boxW, h: boxH }, localT - s.start, s) });
      });
      drawn.sort((a, b) => a.z - b.z);
      drawn.forEach((d) => node.appendChild(d.node));
    } else if (el.type === 'image') {
      if (el.repeat) {
        // Creatomate's `repeat: true` turns the image into a tiled pattern fill.
        // Tile at the source's natural pixel size scaled to the preview, so the
        // dot density matches what a 1920-wide render would produce.
        const probe = new Image();
        probe.src = el.source;
        const nw = probe.naturalWidth || 224;
        node.style.backgroundImage = `url("${el.source}")`;
        node.style.backgroundRepeat = 'repeat';
        node.style.backgroundSize = `${(nw * (ctx.scale || 1)).toFixed(1)}px auto`;
        applyFilters(el, st, localT, ctx.scale);
      } else {
        const img = doc.createElement('img');
        img.src = el.source;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.display = 'block';
        img.style.objectFit = el.fit === 'contain' ? 'contain' : 'cover';
        applyFilters(el, img.style, localT, ctx.scale);
        node.appendChild(img);
      }
    } else if (el.type === 'video') {
      // Video backdrops. Seeked rather than played: the whole capture pipeline is
      // deterministic frame-stepping, so the video is scrubbed to the element's
      // local time (wrapped when loop is set, exactly as Creatomate would).
      const v = doc.createElement('video');
      v.src = el.source;
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.style.width = '100%';
      v.style.height = '100%';
      v.style.display = 'block';
      v.style.objectFit = el.fit === 'contain' ? 'contain' : 'cover';
      const trim = num(el.trim_start, 0);
      const seek = () => {
        const d = v.duration;
        if (!Number.isFinite(d) || d <= 0) return;
        const raw = trim + localT;
        v.currentTime = el.loop ? (raw % d) : Math.min(raw, d - 0.001);
      };
      if (v.readyState >= 1) seek(); else v.addEventListener('loadedmetadata', seek, { once: true });
      applyFilters(el, v.style, localT, ctx.scale);
      node.appendChild(v);
    } else if (el.type === 'shape') {
      const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.style.width = '100%'; svg.style.height = '100%'; svg.style.display = 'block';
      svg.style.overflow = 'visible';
      const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', el.path || 'M 0 0 L 100 0 L 100 100 L 0 100 Z');
      // GRADIENT FILLS. Creatomate writes fill_color as an ARRAY of {offset,color}
      // stops when fill_mode is 'linear' or 'radial', with fill_x0/y0/x1/y1 giving
      // the axis in percentages. The first version of this simulator passed the
      // array straight to setAttribute, which stringifies to nonsense and paints
      // the shape BLACK — so every gradient-built style (the whole Glass room,
      // every pane body, the light sweep) previewed as black rectangles and the
      // tool was useless for exactly the style it was most needed on.
      if (Array.isArray(el.fill_color) && el.fill_color.length) {
        const gid = 'g' + Math.random().toString(36).slice(2, 9);
        const ns = 'http://www.w3.org/2000/svg';
        const defs = doc.createElementNS(ns, 'defs');
        const radial = el.fill_mode === 'radial';
        const grad = doc.createElementNS(ns, radial ? 'radialGradient' : 'linearGradient');
        grad.setAttribute('id', gid);
        grad.setAttribute('gradientUnits', 'objectBoundingBox');
        const num = (v, d) => (v == null ? d : parseFloat(v) / 100);
        if (radial) {
          grad.setAttribute('cx', num(el.fill_x0, 0.5)); grad.setAttribute('cy', num(el.fill_y0, 0.5));
          grad.setAttribute('r', num(el.fill_radius, 0.5));
        } else {
          grad.setAttribute('x1', num(el.fill_x0, 0)); grad.setAttribute('y1', num(el.fill_y0, 0));
          grad.setAttribute('x2', num(el.fill_x1, 1)); grad.setAttribute('y2', num(el.fill_y1, 1));
        }
        for (const stop of el.fill_color) {
          const st = doc.createElementNS(ns, 'stop');
          st.setAttribute('offset', stop.offset == null ? '0%' : stop.offset);
          st.setAttribute('stop-color', stop.color || '#000');
          grad.appendChild(st);
        }
        defs.appendChild(grad); svg.appendChild(defs);
        path.setAttribute('fill', `url(#${gid})`);
      } else {
        path.setAttribute('fill', el.fill_color || (el.stroke_color ? 'none' : '#000'));
      }
      if (el.stroke_color) {
        // Creatomate: stroke_width in the element's own 0..100 path space; and
        // stroke_start / stroke_end / stroke_offset are "relative to its total
        // length", i.e. path trimming. SVG models that natively with
        // pathLength=100 + stroke-dasharray/dashoffset, so the mapping is exact.
        path.setAttribute('stroke', el.stroke_color);
        // The engine writes stroke widths in vmin (same unit convention the
        // existing styles use for shadow_blur), so convert to preview pixels.
        // non-scaling-stroke keeps the line an even thickness — the viewBox is
        // stretched (preserveAspectRatio=none) and a path-space stroke would come
        // out thicker on one axis than the other.
        // A BARE / 'px' width is in the SOURCE's pixel space (1920x1080), not the
        // preview's, so it must be scaled down by the same factor as the stage.
        // Without this the preview drew a 28px border at 28 preview pixels — about
        // five times too heavy — which made the thickness slider impossible to
        // judge from a contact strip. (Found while checking photo borders.)
        const swRaw = el.stroke_width;
        const sw = String(swRaw).includes('vmin') ? (num(swRaw, 1) / 100) * vmin
          : String(swRaw).includes('%') ? (num(swRaw, 1) / 100) * Math.min(boxW, boxH)
            : num(swRaw, 1) * (ctx && ctx.scale ? ctx.scale : 1);
        path.setAttribute('stroke-width', String(Math.max(0.5, sw)));
        path.setAttribute('stroke-linecap', el.stroke_cap === 'butt' ? 'butt' : (el.stroke_cap || 'round'));
        path.setAttribute('stroke-linejoin', el.stroke_join || 'round');
        path.setAttribute('vector-effect', 'non-scaling-stroke');
        const hasTrim = el.stroke_start != null || el.stroke_end != null || el.stroke_offset != null;
        if (hasTrim) {
          const s0 = prop(el, 'stroke_start', localT, 0);
          const s1 = prop(el, 'stroke_end', localT, 100);
          const off = prop(el, 'stroke_offset', localT, 0);
          const len = Math.max(0, Math.min(100, s1 - s0));
          path.setAttribute('pathLength', '100');
          path.setAttribute('stroke-dasharray', `${len} ${Math.max(0.0001, 100 - len)}`);
          path.setAttribute('stroke-dashoffset', String(-(s0 + off)));
        }
      }
      svg.appendChild(path);
      node.appendChild(svg);
      applyFilters(el, st, localT, ctx.scale);
    } else if (el.type === 'text') {
      const span2 = doc.createElement('div');
      span2.textContent = el.text || '';
      span2.style.width = '100%';
      span2.style.color = el.fill_color || '#fff';
      span2.style.fontFamily = `'${el.font_family || 'Montserrat'}', Georgia, serif`;
      span2.style.fontWeight = el.font_weight || '400';
      span2.style.fontSize = (num(el.font_size, 40) / ctx.baseH * parentBox.h) + 'px';
      span2.style.lineHeight = '1.15';
      span2.style.textAlign = num(el.x_alignment, 0) >= 50 ? 'center' : 'left';
      if (el.letter_spacing) span2.style.letterSpacing = (num(el.letter_spacing, 0) / 100) + 'em';
      span2.style.whiteSpace = 'pre-wrap';
      node.appendChild(span2);
    }
    return node;
  }

  // ---- public API ----------------------------------------------------------
  function createPlayer(source, mount, opts) {
    const o = opts || {};
    const doc = mount.ownerDocument;
    const W = source.width || 1920, H = source.height || 1080;
    const stage = doc.createElement('div');
    stage.style.position = 'relative';
    stage.style.overflow = 'hidden';
    stage.style.background = '#000';
    stage.style.width = (o.width || W) + 'px';
    stage.style.height = ((o.width || W) * H / W) + 'px';
    mount.appendChild(stage);

    const total = sourceDuration(source);
    const sch = schedule(source.elements || [], total);
    const ctx = { doc, vmin: Math.min(stage.offsetWidth, stage.offsetHeight), baseH: H, scale: stage.offsetWidth / W, srcW: W, srcH: H };

    function seek(t) {
      stage.textContent = '';
      const box = { w: stage.offsetWidth, h: stage.offsetHeight };
      ctx.vmin = Math.min(box.w, box.h);
      ctx.scale = box.w / W;
      (source.elements || []).forEach((el, i) => {
        const s = sch.get(i);
        if (!s) return;
        if (t < s.start - 1e-6 || t > s.start + s.dur + 1e-6) return;
        const node = renderEl(el, ctx, box, t - s.start, s);
        node.dataset.track = String(zOf(el, i));
        stage.appendChild(node);
      });
      // Creatomate composites by track order, not document order.
      const kids = Array.from(stage.children);
      kids.sort((a, b) => (+a.dataset.track) - (+b.dataset.track));
      kids.forEach((k) => stage.appendChild(k));
    }

    return { stage, duration: total, seek };
  }

  global.CreatomateSim = { createPlayer, sourceDuration };
})(typeof window !== 'undefined' ? window : globalThis);
