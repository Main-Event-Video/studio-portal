// =============================================================
// GET  /api/admin/probe            → render a capability probe, returns { id }
// GET  /api/admin/probe?id=<id>    → poll it, returns { status, url, error }
//
// WHY THIS EXISTS. Twice now a Glass render has come back wrong because
// Creatomate silently ignored something the DOM simulator drew happily:
//
//   1. A STROKED shape carrying blur_radius renders GREY, not the stroke's
//      colour. Three rounds of "the edges look black not white" came from that.
//      Browsers blur with premultiplied alpha; Creatomate does not.
//   2. Suspected, and what this probe is for: gradient fills (`fill_mode` with
//      an array of stops in `fill_color`) may do nothing at all. Every piece of
//      Glass's material — the frost, the cool tint, the sheen — is built from
//      one, and measurement of render 017 says the pane interiors are flat to
//      within 3-4 levels of the bare wall where the sheen alone should lift a
//      diagonal band by ~15.
//
// A simulator cannot answer either question, because the simulator is a browser
// and the browser is the thing that lies. Only a real render can. So: a tiny,
// cheap, labelled render of the primitives in question, on a mid-grey card
// where both brighter and darker are visible.
//
// This is a DIAGNOSTIC. It touches no client data, writes no database row, and
// renders 2 seconds at quarter scale so it costs almost nothing. Admin-gated
// like every other admin route.
// =============================================================
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { createRender, getRender } from '@/lib/creatomate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RECT = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';

// A mid-grey card. Deliberately not white and not black: a bug that makes
// something too BRIGHT and a bug that makes it too DARK both have to show.
const WALL = '#8A8A8A';

function label(text, x, y) {
  return {
    type: 'text', text, x: `${x}%`, y: `${y}%`,
    x_anchor: '50%', y_anchor: '50%', width: '22%',
    font_family: 'Open Sans', font_weight: '700', font_size: '2.4 vmin',
    fill_color: '#000000', text_align: 'center',
  };
}

// Each swatch is 18% wide, centred on its own column.
function swatch(x, extra) {
  return {
    type: 'shape', path: RECT,
    x: `${x}%`, y: '46%', x_anchor: '50%', y_anchor: '50%',
    width: '18%', height: '46%',
    ...extra,
  };
}

// =============================================================
// NEON PROBE  —  GET /api/admin/probe?what=neon
//
// The neon squiggles rendered as NOTHING, twice. What is already PROVEN by real
// renders is that a stroke-only shape DOES draw: Framed Box's frame is exactly
// that (fill_color rgba(0,0,0,0), stroke_color, stroke_width in px) and Josh
// signed off "border test was a success". The magenta key backdrop proves plain
// filled shapes draw too.
//
// So the fault is in one of the things the neon arcs add ON TOP of that proven
// shape, and there are five candidates. Guessing costs a full render each time.
// This draws them side by side, each changing ONE thing from the control, so a
// single cheap render says which one kills it.
//
// Read the result by which columns show a line and which are blank.
// =============================================================
const NEON = '#00E5FF';
const RING = (rx, ry) => `M ${rx} 0 L ${(100 - rx).toFixed(2)} 0 Q 100 0 100 ${ry} L 100 ${(100 - ry).toFixed(2)} Q 100 100 ${(100 - rx).toFixed(2)} 100 L ${rx} 100 Q 0 100 0 ${(100 - ry).toFixed(2)} L 0 ${ry} Q 0 0 ${rx} 0 Z`;

function neonProbeSource() {
  // Six columns, one variable each. Every column draws the SAME rounded ring in
  // the same place; only the listed property differs.
  const col = (i) => 8.5 + i * 16.6;
  const ring = (i, extra, track) => ({
    type: 'shape', path: RING(14, 14), track,
    x: `${col(i)}%`, y: '44%', x_anchor: '50%', y_anchor: '50%',
    width: '14%', height: '46%',
    fill_color: 'rgba(0,0,0,0)',
    stroke_color: NEON, stroke_width: '6 px',
    stroke_cap: 'round', stroke_join: 'round',
    ...extra,
  });
  const cap = (i, text, track) => ({
    type: 'text', text, track,
    x: `${col(i)}%`, y: '80%', x_anchor: '50%', y_anchor: '50%', width: '15%',
    font_family: 'Open Sans', font_weight: '700', font_size: '1.9 vmin',
    fill_color: '#FFFFFF', text_align: 'center',
  });
  return {
    output_format: 'mp4',
    width: 1280, height: 720, frame_rate: 25, duration: 2,
    elements: [
      { type: 'shape', path: RECT, track: 1, width: '100%', height: '100%',
        x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', fill_color: '#101014' },

      // 1 CONTROL. Nothing but the proven Framed Box construction. If THIS is
      // blank, stroke-only shapes are not the problem and something far more
      // basic is (the path, the units, the track).
      ring(0, {}, 2), cap(0, '1 plain stroke', 2),

      // 2 SCREEN BLEND. The only difference. Neon has to be screen-blended to
      // read as light.
      ring(1, { blend_mode: 'screen' }, 3), cap(1, '2 + screen', 3),

      // 3 STROKE TRIMMING. stroke_start / stroke_end, the properties the whole
      // travelling-light idea rests on and which no render has ever confirmed.
      // The SDK types list them; that proves the NAME, not the behaviour.
      ring(2, { stroke_start: '10%', stroke_end: '35%' }, 4), cap(2, '3 + trim', 4),

      // 4 TRIM ANIMATED. stroke_offset keyframed, which is how the light travels.
      ring(3, { stroke_start: '10%', stroke_end: '35%',
        stroke_offset: [{ time: 0, value: '0%', easing: 'linear' }, { time: 2, value: '40%' }] }, 5),
      cap(3, '4 + offset anim', 5),

      // 5 A HIGH TRACK. The overlay sits on 120+, above everything else in the
      // montage. Nothing in this repo has ever used a track that high, so it is
      // an untested assumption, not a fact.
      ring(4, { blend_mode: 'screen' }, 122), cap(4, '5 on track 122', 123),

      // 6 EXACTLY WHAT THE ENGINE EMITS: high track, screen, trimmed, offset
      // animated, keyframed opacity, three stacked widths. If 1-5 all draw and
      // this does not, the fault is in the combination or the opacity ramp.
      ...[[14, 26], [7, 50], [3, 100]].map((w, k) => ({
        ...ring(5, {
          blend_mode: 'screen',
          stroke_width: `${w[0]} px`,
          stroke_start: '10%', stroke_end: '35%',
          stroke_offset: [{ time: 0, value: '0%', easing: 'linear' }, { time: 2, value: '40%' }],
          opacity: [
            { time: 0, value: '0%', easing: 'quadratic-out' },
            { time: 0.4, value: `${w[1]}%`, easing: 'linear' },
            { time: 1.6, value: `${w[1]}%`, easing: 'quadratic-in' },
            { time: 2, value: '0%' },
          ],
        }, 124 + k),
      })),
      cap(5, '6 the real thing', 128),
    ],
  };
}

function probeSource() {
  return {
    output_format: 'mp4',
    width: 1280, height: 720, frame_rate: 25, duration: 2,
    elements: [
      { type: 'shape', path: RECT, track: 1, width: '100%', height: '100%',
        x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', fill_color: WALL },

      // ---- 1. SOLID FILL. The control. If this is wrong, nothing else means
      //         anything. Expect: a flat white block.
      swatch(14, { track: 2, fill_color: '#FFFFFF' }),
      { ...label('1 solid fill', 14, 82), track: 2 },

      // ---- 2. LINEAR GRADIENT, opaque stops. White to black, left to right.
      //         The most basic gradient there is. Expect: a visible ramp.
      //         If this comes back flat, `fill_mode` is unsupported outright.
      swatch(38, { track: 3,
        fill_mode: 'linear', fill_x0: '0%', fill_y0: '50%', fill_x1: '100%', fill_y1: '50%',
        fill_color: [{ offset: '0%', color: '#FFFFFF' }, { offset: '100%', color: '#000000' }] }),
      { ...label('2 gradient, opaque', 38, 82), track: 3 },

      // ---- 3. THE SHEEN, EXACTLY AS GLASS BUILDS IT. Alpha stops, screen
      //         blended, diagonal. This is the real question. Expect: a bright
      //         diagonal band across the middle of the swatch.
      swatch(62, { track: 4,
        blend_mode: 'screen',
        fill_mode: 'linear', fill_x0: '96%', fill_y0: '0%', fill_x1: '4%', fill_y1: '100%',
        fill_color: [
          { offset: '26%', color: 'rgba(255,255,255,0)' },
          { offset: '44%', color: 'rgba(255,255,255,0.42)' },
          { offset: '58%', color: 'rgba(255,255,255,0.06)' },
          { offset: '70%', color: 'rgba(255,255,255,0)' },
        ] }),
      { ...label('3 sheen (alpha, screen)', 62, 82), track: 4 },

      // ---- 4. THE FALLBACK IF 2 AND 3 FAIL: a stack of solid filled shapes at
      //         stepped opacity, which is a gradient built from primitives that
      //         are already proven to work. Expect: a stepped ramp. If this
      //         works and 2/3 do not, it is how the material gets rebuilt.
      { type: 'composition', track: 5,
        x: '86%', y: '46%', x_anchor: '50%', y_anchor: '50%',
        width: '18%', height: '46%',
        elements: [0, 1, 2, 3, 4, 5].map((i) => ({
          type: 'shape', path: RECT,
          x: `${(i * 100) / 6 + 100 / 12}%`, y: '50%', x_anchor: '50%', y_anchor: '50%',
          width: `${100 / 6}%`, height: '100%',
          fill_color: '#FFFFFF', opacity: `${100 - i * 18}%`,
        })) },
      { ...label('4 stepped solids', 86, 82), track: 5 },

      // ---- 6. y_scale '-100%' — the MIRROR the new .refl reflection is built
      //         on. Two swatches: an upright reference bar with a bright top
      //         and dark bottom, and the same thing flipped. If the flip works
      //         the second swatch is dark on top.
      { type: 'composition', track: 7,
        x: '20%', y: '78%', x_anchor: '50%', y_anchor: '50%', width: '14%', height: '18%',
        elements: [
          { type: 'shape', path: RECT, x: '50%', y: '25%', x_anchor: '50%', y_anchor: '50%',
            width: '100%', height: '50%', fill_color: '#FFFFFF' },
          { type: 'shape', path: RECT, x: '50%', y: '75%', x_anchor: '50%', y_anchor: '50%',
            width: '100%', height: '50%', fill_color: '#101010' },
        ] },
      { type: 'composition', track: 8, y_scale: '-100%',
        x: '38%', y: '78%', x_anchor: '50%', y_anchor: '50%', width: '14%', height: '18%',
        elements: [
          { type: 'shape', path: RECT, x: '50%', y: '25%', x_anchor: '50%', y_anchor: '50%',
            width: '100%', height: '50%', fill_color: '#FFFFFF' },
          { type: 'shape', path: RECT, x: '50%', y: '75%', x_anchor: '50%', y_anchor: '50%',
            width: '100%', height: '50%', fill_color: '#101010' },
        ] },

      // ---- 7. mask_mode 'alpha' with a GRADIENT mask — the fade on the
      //         reflection. A white block masked by a top-to-bottom alpha ramp.
      //         Expect: white at the top, gone by the bottom.
      { type: 'composition', track: 9,
        x: '62%', y: '78%', x_anchor: '50%', y_anchor: '50%', width: '14%', height: '18%',
        elements: [
          { type: 'shape', path: RECT, track: 1, x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
            width: '100%', height: '100%', fill_color: '#FFFFFF' },
          { type: 'shape', path: RECT, track: 2, x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
            width: '100%', height: '100%', mask_mode: 'alpha',
            fill_mode: 'linear', fill_x0: '50%', fill_y0: '0%', fill_x1: '50%', fill_y1: '100%',
            fill_color: [
              { offset: '0%', color: 'rgba(0,0,0,0.85)' },
              { offset: '58%', color: 'rgba(0,0,0,0)' },
              { offset: '100%', color: 'rgba(0,0,0,0)' },
            ] },
        ] },

      // ---- 8. a FILLED dark shape with blur — the drop shadow. Expect a soft
      //         dark smudge, clearly darker than the wall.
      { type: 'shape', path: RECT, track: 10,
        x: '86%', y: '78%', x_anchor: '50%', y_anchor: '50%', width: '12%', height: '15%',
        fill_color: '#2D3C50', blur_radius: 18, blur_mode: 'stack', opacity: '26%' },

      // ---- 9. PINNED time+duration WITH KEYFRAMED OPACITY. The construction
      //         that made every Glass transition a hard cut. Two identical
      //         white blocks fading 0 -> 100% across the 2s render. The LEFT
      //         one pins time and duration on the same composition that carries
      //         the keyframes; the RIGHT one pins them on an outer composition
      //         and keyframes an inner one that pins nothing.
      //
      //         At t=1s (half way) both should read about half way up from the
      //         wall. If the left one is at FULL white while the right one is
      //         mid-fade, the hypothesis is confirmed: Creatomate drops
      //         animation on a composition with both time and duration pinned.
      { type: 'composition', track: 11,
        x: '30%', y: '95%', x_anchor: '50%', y_anchor: '100%', width: '10%', height: '10%',
        time: 0, duration: 2,
        opacity: [
          { time: 0, value: '0%', easing: 'linear' },
          { time: 2, value: '100%' },
        ],
        elements: [
          { type: 'shape', path: RECT, x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
            width: '100%', height: '100%', fill_color: '#FFFFFF' },
        ] },
      { type: 'composition', track: 12,
        x: '46%', y: '95%', x_anchor: '50%', y_anchor: '100%', width: '10%', height: '10%',
        time: 0, duration: 2,
        elements: [
          { type: 'composition',
            x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%', width: '100%', height: '100%',
            opacity: [
              { time: 0, value: '0%', easing: 'linear' },
              { time: 2, value: '100%' },
            ],
            elements: [
              { type: 'shape', path: RECT, x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
                width: '100%', height: '100%', fill_color: '#FFFFFF' },
            ] },
        ] },

      // ---- 10. DOES A COMPOSITION CLIP ITS CHILDREN BY DEFAULT?
      //          Glass's .refl reflection sits BELOW its pane, outside the pane
      //          composition's own bounds. If compositions clip by default it is
      //          being cut away entirely, which would explain Josh on render
      //          018: "no refelections of the images in other pannels".
      //
      //          Left: a composition with a white child hanging out the bottom.
      //          Right: the same with clip:false stated explicitly.
      //          If the left shows no tab below its box and the right does, the
      //          default is to clip and every reflection is being discarded.
      { type: 'composition', track: 13,
        x: '30%', y: '62%', x_anchor: '50%', y_anchor: '50%', width: '8%', height: '8%',
        elements: [
          { type: 'shape', path: RECT, x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
            width: '100%', height: '100%', fill_color: '#FFFFFF' },
          { type: 'shape', path: RECT, x: '50%', y: '150%', x_anchor: '50%', y_anchor: '50%',
            width: '60%', height: '100%', fill_color: '#101010' },
        ] },
      { type: 'composition', track: 14, clip: false,
        x: '46%', y: '62%', x_anchor: '50%', y_anchor: '50%', width: '8%', height: '8%',
        elements: [
          { type: 'shape', path: RECT, x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
            width: '100%', height: '100%', fill_color: '#FFFFFF' },
          { type: 'shape', path: RECT, x: '50%', y: '150%', x_anchor: '50%', y_anchor: '50%',
            width: '60%', height: '100%', fill_color: '#101010' },
        ] },

      // ---- 5. THE KNOWN-BAD ONE, kept as a positive control so the probe can
      //         prove itself honest. A stroked shape with blur_radius. If this
      //         comes back GREY on a grey wall while 1 comes back white, the
      //         probe is measuring what it claims to measure.
      { type: 'shape', path: RECT, track: 6,
        x: '50%', y: '12%', x_anchor: '50%', y_anchor: '50%',
        width: '86%', height: '12%',
        fill_color: 'rgba(0,0,0,0)', stroke_color: '#FFFFFF', stroke_width: '6 px',
        blur_radius: 10, blend_mode: 'screen' },
      { ...label('5 blurred stroke — expect grey', 50, 3), track: 6, width: '60%' },
    ],
  };
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const id = new URL(request.url).searchParams.get('id');

  if (id) {
    try {
      const r = await getRender(id);
      return NextResponse.json({
        id: r.id, status: r.status, url: r.url || null,
        error: r.error_message || null,
      });
    } catch (e) {
      return NextResponse.json({ error: String(e.message || e) }, { status: 502 });
    }
  }

  try {
    // ?what=neon draws the neon-construction probe instead of the material one.
    const what = new URL(request.url).searchParams.get('what');
    const neon = what === 'neon';
    // Quarter scale: this is a diagnostic, not a deliverable.
    const r = await createRender({
      source: neon ? neonProbeSource() : probeSource(),
      metadata: JSON.stringify({ kind: neon ? 'neon-probe' : 'capability-probe' }),
      renderScale: 0.5,
    });
    return NextResponse.json({
      id: r.id, status: r.status,
      poll: `/api/admin/probe?id=${r.id}`,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 502 });
  }
}
