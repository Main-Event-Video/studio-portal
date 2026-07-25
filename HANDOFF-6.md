MAIN EVENT STUDIO — CLIENT PORTAL
Handoff #6 (paste this into the next chat)
Prepared: Jul 25, 2026 · Owner: Josh Dolberg
Read AFTER HANDOFF-5. This session = the real TIMELINE reorder (zoomable, tap-to-move,
collapsible albums, videos placeable anywhere) + the montage render now HONORS that order
+ Box→Album rename. Everything in H-5 still stands.

================================================================
0. DO FIRST — deploy state
================================================================
Commits from this session are on `main`. Pending actions before it works live:

1. Run BOTH migrations in Supabase → SQL Editor, in order:
   - sql/005_studio_boxes.sql   (albums table — from last session; run if not already)
   - sql/006_timeline_pos.sql   (NEW — adds studio_media.timeline_pos)
   MUST run 006 or the timeline can't save an interleaved order.
2. `git push origin main` from Josh's machine (if not already pushed).
3. Vercel rebuilds → HARD refresh → test on a PHONE (phone-first flow).

Both migrations are ADDITIVE and safe for the shared Supabase project (one new table +
one new nullable column). Nothing is dropped or altered.

================================================================
1. WHAT SHIPPED THIS SESSION
================================================================
THE TIMELINE (replaces the v1 "order" view in app/p/[token]/upload/Uploader.jsx)
- One horizontal, left→right = play order strip inside the red-framed window.
- Zoom: – / + buttons AND pinch-to-zoom (two fingers on the strip). 6 zoom levels
  ("Overview" … "Detailed").
- Relocate: DRAG on desktop; TAP-TO-MOVE on phone — tap a photo (it shows "moving…"),
  then tap a striped drop-gap to place it. Tap empty space to cancel.
- Loose photos, albums, and videos all move independently and interleave in ANY order.
- Albums on the timeline: collapsed = a single purple block (with a mini 4-thumb preview)
  you relocate as a unit; tap "⤢ open" to expand it inline into its own lane and arrange
  the photos inside; "Done ✓" collapses it.
- A picked-up loose photo can drop INTO an album (tap the album block, or a gap in its open
  lane); a photo inside an album can pop out to any top-level slot.
- Videos are first-class items (black card, ▶, "Video" label), placeable loose or in an album.
- Landscape hint + "turn your phone sideways for a longer timeline" copy.

REFRESH BUG FIXED (H-5 §4.2): the active view now lives in the URL hash (#order), so a
phone refresh on the timeline stays on the timeline instead of dropping to Add-photos.

BOX → ALBUM: every user-facing "box" is now "Album" (upload page + timeline). Internal
names are unchanged on purpose — the DB table is still `studio_boxes`, the folder_path column
still stores the album name, and the API actions are still createBox/renameBox/deleteBox.
The word "box" appears nowhere a client or the studio can see.

================================================================
2. HOW ORDER IS STORED (the data model)
================================================================
One flat play order = top-level items (loose media + albums) interleaved; each album has an
internal order. Stored on EXISTING-style integer fields, renumbered 1..N on every change:
  - loose media top-level rank .... studio_media.timeline_pos   (NEW, 006)
  - album top-level rank .......... studio_boxes.position        (005)  ← same 1..N scale
  - media order INSIDE an album ... studio_media.sort_number

buildTimeline() in lib/timelineOrder.js is the ONE source of truth that turns rows into the
flat order + the UI structure. It is used by BOTH the portal timeline UI and the montage
render path, so what the client arranges is exactly what the video plays. Tolerant of both
snake_case (DB) and camelCase (portal) field names. Backward-compatible: until a client
touches the timeline (no timeline_pos set), it falls back to the legacy default (loose
photos first, then albums), so existing renders are unchanged.

BACKEND ADDED/CHANGED:
- sql/006_timeline_pos.sql (NEW) — studio_media.timeline_pos int, nullable.
- lib/timelineOrder.js (NEW) — pure buildTimeline(mediaRows, boxRows) → { flat, structure }.
- lib/clientTimeline.js (NEW) — server helper orderedClientMedia(db, clientId, {imagesOnly})
  used by the render path.
- app/api/portal/media/route.js — GET returns timelinePos + createdAt on media and boxes as
  {name, position}; POST gained action 'setArrangement' { top, albums } that persists the
  WHOLE timeline in one request.
- app/api/admin/montage/route.js + .../montage/photos/route.js — now build the photo list via
  orderedClientMedia (timeline order) instead of the old folder+number SQL sort. The admin
  framing strip and the render share the exact same 1..N order. photoSpec + framing (keyed by
  r2_key) behavior preserved.

================================================================
3. VERIFICATION DONE (in the build sandbox, not on a phone yet)
================================================================
- lib/timelineOrder.js: 11 unit tests (default/legacy order, seeded interleave, album
  internal order, empty albums, trash excluded, videos, unplaced new uploads, implied albums)
  + a camelCase smoke test — all pass.
- Full round-trip sim (UI move → setArrangement payload → server writes → buildTimeline
  reload): 12 checks across move loose / relocate album / photo-into-album / photo-out /
  reorder-in-album / sequential moves — every optimistic UI state equals the reloaded state.
- Uploader.jsx transforms cleanly (esbuild); all changed .js parse (node --check).
- Interactive prototype (timeline-mock-v2.html, delivered in chat, NOT in repo) screenshotted
  in headless Chromium across default / overview / album-open / pickup states.
STILL UNTESTED: a real phone against live data + an actual Creatomate render honoring a
re-arranged timeline. DO THIS after running 006 + push.

================================================================
4. STILL PENDING (backlog, rough priority)
================================================================
1. Phone-test the timeline on real data; run one Creatomate render after re-ordering to
   confirm the video matches the timeline (spend one credit).
2. Video-in-montage render pipeline (H-5 §3 flag) — videos are placeable on the timeline and
   saved, but the montage still renders PHOTOS only; interleaving real video clips is a real
   Creatomate + lib/montage.js change. Scope separately before promising it.
3. Auto-correct photos (H-4 §9 / H-5 §4.3) — designed, not built; needs sharp.
4. Montage-by-box → now "montage-by-album": generator could target an album by name (unblocked
   now that albums persist + order is canonical).
5. Folder/album-rename discoverability (H-4 §9); the timeline shows album names but inline
   rename on the timeline is not built yet (rename still lives on the upload screen path).
6. Drop-folder-onto-existing-album = flatten-in (confirm wired end to end).

================================================================
5. FIRST PROMPT SUGGESTION FOR NEXT CHAT
================================================================
"Read HANDOFF-6. Confirm sql/005 + sql/006 are run and this session is pushed + phone-tested,
and that one re-ordered Creatomate render matched the timeline. Then let's [pick from §4]:
scope video-in-montage, or add inline album rename on the timeline, or montage-by-album."
