# MONTAGE EDITS — this session's repairs (2026-07-27)
Applied to `lib/montage.js` + `app/admin/page.js`, based on MONTAGES-MASTER.md
(git anchor `86e8dae`). Smoke-tested (CJS transpile + node); NOT yet render-
verified on Creatomate — first Test-client render is the truth.

## What changed
1. **Resize (all standard styles).** Size now sets the photo's BASELINE scale and
   the Ken-Burns amount drifts UP from it (was: size multiplied into the zoom +
   a Fill floor at 100%, so shrink was ignored and the size never held).
   - 100% = unchanged from before. Below 100%: Fit adds border; **Fill now
     genuinely shrinks and reveals the style background at the edges — matching
     the editor preview.** Never shrinks past the set size (drift only goes up).
2. **Contrast (wired, needs calibration).** `color_filter:'contrast'`, value =
   `(contrast-100)%` (135 → "35%"). Default 100 emits no filter (renders
   unchanged). **CALIBRATE the value mapping on the first render** — Creatomate's
   contrast scale is unconfirmed; adjust the `-100` mapping if it's too weak/strong.
3. **Saturation (NOT wired — honest blocker).** There is no confirmed Creatomate
   `saturate` color_filter, and Creatomate applies only ONE `color_filter` per
   image, so saturation can't co-exist with B&W/Sepia/contrast anyway. It stays
   **editor-preview only.** TODO: confirm a Creatomate saturation capability
   (color_overlay? a filter name?) on a test render, then wire it.
   - Single-filter priority in code: **B&W / Sepia → Contrast → Auto-color.**
4. **Polaroid render fix** (`polaroidStackSource`), from the first real render:
   - Applies each photo's **colour edit (B&W/Sepia/contrast/auto)** to the print
     (was ignored → rendered full colour).
   - **Head-safe:** the print photo is top-anchored (`y_anchor 0%`), so heads stay
     in; `framing` top/center/bottom honored. (Was centre-crop → chopped heads.)
   - **Drop-in:** starts fully above the frame (`y -70%`) so it feather-falls in
     (was `-20%` → bottom edge popped on screen before falling).
   - **Frame realism:** rounded card corners (rounded-rect path) + a softer, larger
     shadow (`8vmin`) so it stops looking like a hard cut-out.
   - Frame proportions: photo `92×78 y43` → ~4% even top/sides, ~18% bottom strip.
5. **Changeable Background (engine plumbing).** `buildMontageSource({..., background})`
   where `background = { url, tint, opacity }`. Polaroid uses it: a custom `url`
   becomes a single blurred full-bleed backdrop (else the blurred current-photo);
   `tint`+`opacity` are the wash. Defaults = blurred hero + `#241033 @52%`.
   - **TODO (route + UI):** add the "Change background image · Tint · Opacity"
     control to the admin (only for backdrop styles: Polaroid, Duotone, Collage)
     and pass `background` from the render POST. Engine side is ready; the control
     is not built yet.
6. **Collage Wall — Classic + Featured (NEW styles).** Rebuilt from the approved
   mocks (they were never in the engine). A wall of ALL photos in a grid inside a
   "Wall" composition bigger than the frame; the wall's x/y keyframes glide a
   camera across it, resting `cellHoldS` on ~6 featured tiles with neighbours
   visible, over a warm multiply grade. Featured adds 2×2 hero tiles.
   - **FIRST-RENDER TUNING (flagged, not final):** camera path + zoom-to-fill
     feel; **face-aware framing** per tile (needs the face detector — cells are
     top-cropped for now); **light-leaks + dust + vignette** overlays (assets not
     in the repo yet — warm grade only for now); hero placement rhythm.
7. **page.js:** `MONTAGE_STYLES` gains `collage_classic` + `collage_featured`
   (so they're selectable); the selected-chip **✓ literal** bug fixed
   (`{'✓ selected'}` — JSX text wasn't interpreting the escape).

## VERIFY on the Test client (render one clip per changed style)
- **Resize:** a photo at 80% Fit (border) and 85% Fill (bg at edges) — do they
  render at that size and drift up, matching the editor?
- **Contrast:** a photo at 135% — visible, right direction/strength? (calibrate)
- **Polaroid:** B&W honored · heads kept · clean drop from above · rounded soft
  frame · custom background if set.
- **Collage Classic/Featured:** wall builds, camera glides, warm grade reads;
  note anything to tune (speed, zoom, framing).
- **Regression:** Hollywood/Timeless/Party/Party 2/Duotone still render as before.

## Restore anchor
Everything committed builds; if anything regresses:
`git checkout <last-good-commit> -- lib/montage.js app/admin/page.js`
