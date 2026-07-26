# New montage styles — build notes (test-render before relying on them)

Three new styles were added to `lib/montage.js` (STYLES) and the admin style list
(`app/admin/page.js`). They render through the existing Creatomate pipeline, so
they queue/segment/track exactly like Hollywood/Timeless/Party, and the
green-screen video-gap behaviour works in all of them.

## What's shipped
- **Party 2** (`party2`): energetic — party transition set, zoom to 118%, plus a
  gentle diagonal Ken-Burns drift on each photo (alternating direction). Default
  2.5s/photo (use the pace control per render). The drift is a calm render-safe
  version of the frantic browser mock.
- **Duotone Split** (`duotone`): same photo duplicated side by side, each half a
  different duotone — grayscale image (`color_filter: grayscale`) + a multiply
  highlight shape + a screen shadow shape (`blend_mode`), the render equivalent of
  the CSS mock. A true-colour hero is centred on top and slowly pushes forward ~8%.
- **Polaroid** (`polaroid`): one tilted white-framed print (`z_rotation`,
  `shadow_*`) over a blurred, darkened copy of the same photo.

## Verified vs. needs a test render
- VERIFIED here: all six styles build to valid Creatomate JSON (no errors, no
  undefined), the video→green-screen gap is intact, existing styles are unchanged
  (the new behaviour is guarded by `pan`/`duotone`/`polaroid` flags).
- NOT verified from the build box (no render access): that Creatomate accepts every
  property as used — `color_filter`/`color_filter_value`, `blend_mode` on shapes,
  `z_rotation`, `shadow_*`, `blur_radius`. These come straight from Creatomate's
  RenderScript docs, but the first real render on the Test client is the truth.
  If a render fails, the Creatomate error names the offending property and it's a
  quick fix.

## Known limitations / next
- Duotone: per-photo framing/fit/size/colour edits are NOT applied inside the
  duotone composition (it's its own layout, cover-cropped centre). Fine for the
  look; revisit if per-photo control is wanted here.
- Polaroid: single print per shot. The fanned multi-print pile from the mock needs
  persistent overlapping elements across shots (a different timeline) — a later
  enhancement.
- The redesigned Montage Maker UI (3-step / albums / big editor / per-photo colour
  modes) is still the mock only. It's a large rewrite of the live admin and should
  be rolled out reviewed, not blind-deployed.
