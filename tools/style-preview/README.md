# tools/style-preview — play the engine's own output, and make picker clips from it

This is **sandbox tooling**, not part of the Next.js app. It exists so a montage
style can be *seen* without spending Creatomate credits, and so every style's
sample clip in `public/style-previews/` is generated from the real
`lib/montage.js` output rather than a hand-drawn mock that can silently drift
from the code.

## What it is

`sim.js` is a DOM approximation of Creatomate's RenderScript player. You give it
the exact source JSON `buildMontageSource()` produces and it plays it in a
browser: nested compositions with clipping, images with cover/contain, shapes
(including stroke trimming), text, `%` geometry with anchors, keyframes on
`x/y/x_scale/y_scale/z_rotation/opacity/blur_radius` with linear and quadratic
easing, same-track auto-sequencing, transitions, `color_filter`, `blend_mode`,
shadows.

## What it is NOT

**It is an approximation and it will be wrong confidently.** Only a real
Creatomate draft render is proof. Known gaps, all marked `APPROX` in `sim.js`:

- Transitions animate the **incoming** element only. Creatomate also animates the
  outgoing one for slide/scale/wipe. **Do not trust this simulator on the
  green-bleed question** — that is precisely the behaviour it does not model.
- Fonts fall back to whatever the sandbox has; the render uses Creatomate's font
  service.
- Blend modes are CSS `mix-blend-mode`, which is close but not identical.
- Renders come out **brighter** than any preview (a finding from earlier
  sessions) — screen-blended layers stack harder in the real render.
- **The sandbox Chromium has no H.264 decoder.** An `.mp4` in a `<video>` sits at
  `readyState 0` forever and paints black. To preview a video background locally,
  transcode a WebM proxy (`ffmpeg -i bg.mp4 -c:v libvpx-vp9 bg.webm`) and point
  the harness at that. Creatomate has no such limit — this is preview-only.

## Why it earns its keep anyway

It has already caught two real bugs that would otherwise have burned credits:

1. My first version defaulted untracked sibling elements to track 1, so they
   auto-sequenced and the Photo Slide prints rendered as blank white cards.
   That is what proved Creatomate gives each untracked element its **own** track
   (`polaroidStackSource` relies on this and renders correctly in production).
2. It rendered every photo flat grey, which traced back to the test harness
   passing `contrast: null` — `Number(null) === 0`, so `applyPhotoColor` emitted
   `contrast: '-100%'`. The production route clamps this, but the same class of
   bug in a builder would have shipped invisibly.

## Usage

```
node build-source.mjs <style> [count] [--secs=N] [--no-green] [--no-cards] [--no-watermark]
node strip.mjs   <label> [--n=12] [--from=0] [--to=0] [--w=480] [--cols=4]   # contact sheet for review
node capture.mjs <out.mp4> [--fps=24] [--w=1280] [--max=0]                   # picker clip
node verify.mjs                                                              # build EVERY style, 4 modes, assert sane JSON
```

Background flags for `build-source.mjs`: `--bg-video` (a looping WebM backdrop,
exercising the studio background library) and `--bg-image` (a still backdrop).

`verify.mjs` is the one to run after any engine change. It builds every style in
`STYLES` in seven modes — cards+green, bare, 60-second length mode, dimensions
missing (the probe-failed path), and image / video / texture backgrounds — then
asserts no `undefined`/`NaN`/`null%`, no zero durations, no image without a
source, keyframes ordered and inside their element's duration, that length mode
actually snaps, and **no same-track overlaps**.

That last check is the important one. A track is a lane: two elements sharing one
and overlapping in time is not a valid timeline, and Creatomate resolves it by
dropping one of them. The only legal overlap is a transition. This is what caught
the imported-background bug — the fill, the backdrop and the tint all sat on
track 1 for the whole montage, so the backdrop vanished after the first shot.
**The simulator could not have caught it**: it stacks overlapping layers rather
than modelling the conflict, so it showed the background working perfectly.

Structural checks and visual checks catch different things. Run both.

## Making a picker clip

Sample clips are 1280×720, 24fps, ~10s, no cards, no green bookends and no
watermark — the picker is showing the *motion*, not a montage:

```
node build-source.mjs sliding_images 8 --secs=1.2 --no-green --no-cards --no-watermark
node capture.mjs out.mp4 --fps=24 --w=1280
```

Then drop the result in `public/style-previews/<style-key>.mp4`.

## Requirements

Playwright plus the sandbox's preinstalled Chromium at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (do **not** run
`playwright install`), ffmpeg, and a folder of sample photos with a
`manifest.json` of `{file, w, h}`. `make_samples.py` builds that set from a
folder of stills, face-detecting each one and cropping it to a spread of aspect
ratios so mixed-shape behaviour is actually exercised.

Frames are captured by **seeking**, never by recording in real time — realtime
capture drops large background images because of a paint-timing bug noted in
HANDOFF-11 §9.
