# Montage style proposals — 2026-08-18

Written overnight, after finding something that changes what's on the table.

## The find

Creatomate's public docs are a JavaScript app that can't be read by a fetcher,
which is why this repo has spent months guessing at what the renderer can do —
HANDOFF-11 has a whole section of "unverified, straight from the docs" items, and
a standing note that the full transition list "is only in their visual editor".

Their **official `creatomate` npm package ships TypeScript definitions for every
element, property and animation.** `npm i creatomate`, then read
`node_modules/creatomate/src`. That's now the reference.

Three things fall out of it immediately.

### 1. The green-bleed problem has an answer

The long-standing defect: slide and wipe transitions animate *both* photos, so
mid-transition the frame is briefly uncovered, the green backdrop shows through,
and the blend picks up a cast that survives chroma keying. `holdFade` fixed it by
replacing the movement with a dissolve — which is why it can't be used on
Party/Party 2/Duotone, and why you reverted it when it was.

The `slide` animation takes:

```
fixed?: 'none' | 'first-only' | 'second-only'
```

and `wipe` / `circular-wipe` take `clip: 'both' | 'first-only' | 'second-only'`.

Hold the **outgoing** photo still while the incoming one moves over it and the
frame is never uncovered — *and you keep the movement*. That is precisely the
thing holdFade could not do.

I have **not** changed Party, Party 2 or Duotone. They're signed off and in client
use. Instead there's a new **Party 3** which is Party 2's exact look with this
switched on, so you can render both cheaply and compare. If it's clean, turning it
on everywhere is one word per style.

### 2. Things the engine can do that nothing here uses

| capability | property | what it buys |
|---|---|---|
| path trimming | `stroke_start` / `stroke_end` / `stroke_offset` | a light that travels along any outline — this is how Neon Frame works |
| gradients | `fill_mode: linear\|radial` + `fill_x0/y0/x1/y1/fill_radius` | real gradient fills and animated light sweeps |
| masks | `mask_mode: alpha\|alpha-inverted\|luma\|luma-inverted` | an element masks the one on the track below — photos playing *inside letterforms* |
| pattern fill | `repeat: true` | tiling any image — this is how the comic halftone works, no pre-processing |
| colour overlay | `color_overlay` | tint any element directly (Duotone currently does this with stacked shapes) |
| corner pin | `warp_mode: 'perspective'` + `warp_matrix` | After Effects-style perspective warp — real angled planes |
| subject-aware crop | `smart_crop` on images | Creatomate's own head-safe cropping |
| more transitions | `color-wipe`, `film-roll`, `flip`/`flip-page`, `squash`, `spin`, `bounce`, `shake`, `wiggle`, `rotate-slide`, `circular-wipe-shockwave` (with `ring_color`/`ring_width`) | a much wider vocabulary than the four types in use |

### 3. Things it definitively cannot do

Worth stating plainly so we stop re-litigating them:

- **No saturation filter.** `color_filter` is only `brighten | contrast | invert |
  grayscale | sepia`. The editor's saturation slider can never reach the render as
  a colour filter. That question is now closed.
- **No posterize, no edge detection, no per-pixel effects.** Anything pixel-level
  — comic, glitch, displacement, luminance-varying halftone — has to be a
  pre-processed image.
- **No particles, no real 3D.** `flip` and `warp` are 2.5D. A tumbling cube with
  visible side faces is still not possible.

---

## Shipped tonight

Six new styles, all in the picker and the Finish pulldown, all with sample clips,
none rendered yet.

| style | what it is |
|---|---|
| **Sliding Images** | native-shape photos push in one at a time; a landscape enters horizontally, a portrait vertically, and the photo *leaving* exits on the axis of the photo *arriving* — the move is built from the next image |
| **Photo Slide** | bordered prints travel a rail, each print cut to its own photo's shape |
| **Photo Ribbon** | every photo on one horizontal strip at native shape; you see the next photo waiting at the edge of frame before it arrives |
| **Neon Frame** | your laser idea — a neon tube around each photo's own edge with a bright light running the full perimeter once per photo |
| **Comic Book** | your comic idea — the moves happen in comic, the real photograph is the reveal, then it re-inks before the next move |
| **Party 3** | Party 2 with cover transitions, to test the green-bleed fix |

Plus **Two Panel** and **Duotone Split Pastel**, which were fully built months ago
and never added to the dropdown, so you've never seen either render.

**Photo Slide and Sliding Images are interpretations, not ports.** Your Creatomate
template JSON never arrived, so I built to the names and the brief. The style keys
exist, so when the JSON turns up I correct the contents in place and nothing gets
renamed or re-picked.

---

## Proposal 1 — finish the comic pipeline

**Status: the look is proven, the plumbing is not built.**

The conversion works — `tools/style-preview/comicify.py`, and the before/after
sheet I sent. Flatten with an edge-preserving filter, quantise the palette with
k-means in Lab space, ink with an adaptive threshold, multiply, lift saturation.

The style already takes the comic image as `it.altUrl` and works the moment
something supplies one. What's missing is that something:

1. **A comic-render step.** In `app/api/admin/montage/route.js`, where photo items
   are built, add: for a comic-flagged style, check R2 for `comic/<r2_key>`; if
   absent, fetch the original, run the pipeline in `sharp`, write it back, and set
   `altUrl` to a presigned URL for it.
2. **Cache key must include a pipeline version** — `comic/v1/<r2_key>` — so tuning
   the look doesn't serve stale art forever.
3. **Do it in parallel** with the existing `probeDims` pass, and fall back to the
   no-`altUrl` path on any failure. A comic style that silently degrades is much
   better than a render that dies.
4. **Cost:** storage only. It's ~200KB per photo, and 50GB of R2 storage is
   already in the plan with 0 bytes used.

**Effort:** a solid session. **Risk:** low — it's additive, it fails soft, and the
only new dependency is a library the app already ships.

**The one honest caveat:** `sharp` has no k-means. The palette quantisation would
need reworking as posterisation via `linear()` + a palette-limited PNG write, or
the whole conversion moved to a small OpenCV worker. I'd try `sharp` first and
compare against the OpenCV output before committing to it.

---

## Proposal 2 — three more styles, ranked by how new they'd feel

### A. Name Reveal — photos playing inside letterforms

`mask_mode: 'luma'` makes an element mask the one on the track below. So: the
honoree's name as a huge text element, and the montage playing *inside the
letters*. Photos cross-fade behind, the letters hold, the camera drifts across the
word. At the end the letters push apart and the last photo fills the frame.

Nobody in this category is doing this, because it needs real masking rather than
an overlay. **Effort: medium.** **Unproven:** whether `mask_mode` masks a
composition as cleanly as a single element.

### B. Shockwave — the neon idea as a transition, not a frame

`circular-wipe` takes `ring_color` and `ring_width`. So each cut becomes an
expanding ring of light that reveals the next photo from the point of the cut.
Pair it with Neon Frame's palette and the two become a family: the light circles
the photo, then the light *becomes* the transition.

Cheap, striking, and it makes the transitions themselves a design element rather
than a way of getting from A to B. **Effort: small.** **Unproven:** whether
`ring_color` renders as a glowing ring or a hard edge.

### C. Angled Wall — real perspective, not fake tilt

`warp_mode: 'perspective'` with a `warp_matrix` is an After Effects corner pin.
Photos can sit on genuinely angled planes and turn as the camera moves. Trendy
Photo Wall fakes this with `x_rotation`/`y_rotation`; a corner pin would let
prints lie on a *surface* and the camera travel over it convincingly.

**Effort: medium-high** — the warp matrix format needs to be worked out by trial,
and each trial is a render. **Unproven:** everything about it. This is the one I'd
do last.

### Also cheap and worth doing

- **Brand colour-wipe.** `color-wipe` with `color: '#FF0000'` sweeps a Main Event
  Studio red band across each cut. One line, instantly on-brand. Add blue for a
  second variant.
- **Light sweep.** An animated linear gradient (`fill_x0`/`fill_x1` keyframed)
  crossing the frame — a real specular sweep rather than a PNG overlay.
- **Try `smart_crop`.** Creatomate's own subject-aware cropping might do the
  head-safe job that `coverBox` + framing bias does by hand. Worth one test render
  before building more framing logic.

---

## Proposal 3 — the neon idea, taken further

Three extensions to Neon Frame, in increasing order of difficulty:

1. **Colour from the photo.** `sharp` can pull a dominant colour server-side in
   milliseconds. The neon then matches whatever the photo is — green for the
   fairy costume, pink for the birthday. Cheap, and it makes the effect feel
   designed rather than applied.
2. **The light hands off.** Instead of restarting on every photo, the light runs
   off the edge of one frame and onto the next, so it travels continuously through
   the whole montage. Keyframing across a boundary; medium effort.
3. **The light traces the subject.** Needs a background-removal cutout to get an
   outline path — which the MEvid work already found is only ~5-in-8 reliable with
   `rembg`. I'd not promise this one.

---

## What I would do next, in order

1. **You render the cheap test batch** — the button is in Finish, ~2 credits a
   style. That answers, in one go: does `stroke_start/end/offset` really trim a
   path, does `repeat` really tile, does `fixed: 'first-only'` really kill the
   green bleed, and does the aspect probe actually run on Vercel.
2. **Fix whatever that reveals.** Everything in this document is reasoned and
   simulated; none of it has met the renderer.
3. **Get me the template JSON** via the porting panel, and Photo Slide and Sliding
   Images stop being interpretations.
4. **Build the comic pipeline.**
5. **Then** the new styles above, in the order they're ranked.

## The standing caveat

I cannot render. `api.creatomate.com` is blocked from my sandbox at the proxy
(hard 403 on the connection itself), so no API key or token would help. Everything
here was built by reasoning about the source JSON and playing it in a simulator I
wrote, which is genuinely useful — it caught two real bugs tonight — but which
does not model the outgoing half of a transition. That is exactly the green-bleed
behaviour. **Party 3 is a hypothesis, not a result.**
