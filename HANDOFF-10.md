# HANDOFF-10 — studio-portal (2026-07-27)

## ⭐ NEXT TASK #1 (Josh's stated top priority)
**Build a new montage style that shows MULTIPLE photos in the SAME frame** at once
(collage / split-screen / grid), not one photo at a time.

Where to build it:
- Engine: `lib/montage.js` — add a new entry to the `STYLES` object and a builder
  (see how `duotoneShot()` / `polaroidShot()` compose multiple Creatomate elements
  into one on-screen "slot"). A multi-pic frame = one timeline slot that lays out
  2–4 photos simultaneously (e.g. 2-up split, 3-up, 2x2 grid), each its own image
  element positioned with `x`/`y`/`width`/`height` (% of frame) + optional
  `stroke`/`shadow` gutters.
- `buildMontageSource({photos, items, style, ...})` walks the photo sequence and
  emits one "shot" per slot. For a multi-pic style, CONSUME N photos per slot
  (e.g. slice the sequence in groups) instead of one, and lay them out together.
- Decisions to get from Josh before/while building (mock first — he approves
  mockups before code): how many per frame (fixed 2? mix of 1/2/3?), layout
  (equal split vs featured-large-plus-thumbs), gutter colour (brand RED/BLUE?),
  whether photos animate independently inside the frame, and 9:16 handling.
- Prior collage exploration lives in the cloud scratch workspace (not in the repo):
  `collage_v3_template.html`, notes in `CARD-FLIP-PARKED-NOTES.md` (Collage Wall —
  Classic uniform grid, and Featured large-photo variants were signed off as
  concepts). Reuse those layouts as the starting spec.
- Verify: can't run live Creatomate renders from the build box — smoke-test
  `buildMontageSource` (CJS transpile + node) to confirm the slot emits N image
  elements with sane geometry, then Josh renders a real clip on the Test client.

---

## What shipped in this session (commits after e7fae9c)

### 295ccba — HEIC→JPEG + Photo Library interleave + placeholders
- `lib/heic.js`: `isHeic()`, `convertHeicToJpeg()` (decode via **heic-convert** WASM —
  sharp's binary can't decode HEVC; verified), `toJpgName()`/`toJpgKey()`.
- `app/api/portal/confirm/route.js`: converts HEIC→JPEG on upload and REPLACES the
  original (keeps original only if conversion throws). `maxDuration=60`.
- `app/api/admin/convert-heic/route.js`: admin-only backfill. GET = dry-run count,
  POST = convert a time-budgeted batch, returns `remaining`. **Already run once in
  prod** (IMG_3672.heic → .jpg; 0 remaining).
- `app/api/admin/montage/route.js`: defensively skips any still-HEIC photo.
- `next.config.mjs`: externalized heic-convert/heic-decode/libheif-js/sharp.
- `Uploader.jsx` Photo Library: loose photos + album blocks now render in ONE
  interleaved order (mirrors the timeline); labelled placeholders (🎵 Audio / 📄 File)
  instead of black tiles for non-images.

### aa38ce7 — Photo Library reorder fix
- Added "⇥ move to the end" drop zones (top level + per album) — you couldn't reach
  the last position before. Drops now consistently land BEFORE the target (index
  computed after removing the dragged item). `END_DROP='__end__'` sentinel.

### (this commit) — Admin editor rebuild + one-touch download + character delete
- `lib/r2.js`: `getDownloadUrl(key, filename)` — presigned URL with
  `ResponseContentDisposition: attachment` (forces a real download, no CORS, no tab).
- `app/api/admin/montage/photos/route.js`: returns `downloadUrl` per photo.
- `app/admin/page.js` Photo editor:
  - Editor is CLOSED by default; **double-click** a thumbnail opens it inline
    directly BELOW that photo (full-width grid row via `gridColumn:'1/-1'`).
  - **‹ ›** arrows over the big image move to the previous/next photo.
  - **Download** is now one-touch (uses `downloadUrl`).
  - **Removed Left/Right framing** (kept Top/Center/Bottom; the drag-to-position
    focal point covers L/R). `showEditor` state is now unused (left declared).
- `Uploader.jsx` `deleteCharacter()`: now checks `res.ok`, ALERTS the real error,
  and optimistically removes the character from the roster.

## ⚠️ Character delete — likely needs a migration in prod
The server soft-delete (`markCharacterDeleted` → `deleted_at`) is correct **only if
`sql/011_character_soft_delete.sql` has been run in production**. If delete still
fails after deploy, the alert will say something like "column deleted_at does not
exist" — run this in the Supabase SQL editor (idempotent, safe):
```sql
alter table public.studio_characters add column if not exists deleted_at timestamptz;
```

## Deploy steps for this session's work
1. `cd /Users/joshuadolberg/Documents/GitHub/studio-portal && rm -f .git/*.lock .git/refs/heads/*.lock .git/objects/*.lock 2>/dev/null; git push origin main`
2. In Supabase SQL editor, run the `deleted_at` migration above (only needed once).
3. Test: admin editor (double-click/arrows/download/no L-R), portal Photo Library
   (move-to-end), portal character delete.

## Working constraints (unchanged)
- `device_bash` has NO network — Josh pushes; installs/lockfiles done in the cloud
  container then written back via SendUserFile + device_commit_files.
- Git in the fuse-mounted repo leaves un-unlinkable `.lock`/tmp_obj files; recipe:
  `mv .git/*.lock aside` before commit (warnings are harmless); Josh clears with the
  `rm -f .git/*.lock ...` one-liner above.
- `device_stage_files` can return STALE cached copies — `rm` the staged path first,
  re-stage, verify before editing.
- Can't run the live Next/Supabase app or Creatomate renders from the build box —
  parse-check with esbuild; Josh deploy-tests.
- Admin editor edits persist per-client in `photo_edits` (sql/012) and apply to every
  style. Contrast/saturation still preview-only in the editor (render wiring pending
  a calibration render — see earlier handoffs).

---

## ⭐ MONTAGE STYLES — SOURCE OF TRUTH (added 2026-07-27)
`MONTAGES-MASTER.md` is the canonical reference for ALL montage styles — read it
before editing `lib/montage.js`. It documents the SIX shipped styles (hollywood,
timeless, party, party2, duotone, polaroid) with verbatim params + how each renders,
the shared engine rules, and a verify checklist. `POLAROID-FIX.md` has the Polaroid
stacking builder in full.

Rules: never delete/rename a style key; `MONTAGE_STYLES` in app/admin/page.js must
list every key in `STYLES`; restore any lost/broken style with
`git checkout 7c2db4f -- lib/montage.js`. The TWO Collage Wall styles (Classic
uniform grid, Featured large heroes) are approved MOCKS only — never built into the
engine — build them from the spec in MONTAGES-MASTER.md (mocks: collage-wall-optionA-
MASTER.html / collage-wall-optionB.html / collage_v3_template.html).
