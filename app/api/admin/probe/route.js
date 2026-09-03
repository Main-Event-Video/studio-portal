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
    // Quarter scale: this is a diagnostic, not a deliverable.
    const r = await createRender({
      source: probeSource(),
      metadata: JSON.stringify({ kind: 'capability-probe' }),
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
