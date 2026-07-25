# MAIN EVENT STUDIO — CLIENT PORTAL
## Handoff #5 (paste this into the next chat)
Prepared: Jul 25, 2026 · Owner: Josh Dolberg
Read AFTER HANDOFF-4. This session = the client-portal UPLOAD + REORDER redesign
(look/feel, boxes, and the timeline direction). Everything in H-4 still stands.

---
# 0. DO FIRST — deploy state

Commits from this session are on `main` (some may already be pushed — check
`git status`). The important pending actions:

1. **Run the SQL migration** `sql/005_studio_boxes.sql` in Supabase → SQL Editor
   (creates the `studio_boxes` table). MUST run this or "New box" errors.
2. **Push** `git push origin main` (from Josh's machine — the sandbox can't push).
3. Vercel rebuilds → HARD refresh; test on a PHONE (this is a phone-first flow).

Key commits this session:
- `1732fa0` — portal upload rebuilt: branded drop window + order view (v1)
- `54ee002` — restyle to final look (muted blue / red frame / neon outlines) + phone
- `3a2bea6` — `studio_boxes` table + portal box create/rename/list; new-box field
  opens at bottom of the stack

`git log --oneline -8` to confirm what's pushed.

---
# 1. WHAT SHIPPED — the upload redesign (built + committed)

The client portal upload page (`app/p/[token]/upload/Uploader.jsx`) was fully
rebuilt into a two-view flow, self-contained (styles scoped under `#uploadflow`),
reusing the existing upload plumbing + `/api/portal/media` endpoints.

## Upload view — "the drop window"
- A red-outlined **window** holds TWO areas side by side: **In the open** (photos
  that aren't in a box) and the **boxes**. Play order = open first, then boxes.
- **Add photos** (opens the file/photo picker) → into the open area. **Tap a box**
  → adds straight into that box. **New box** → name it; the name field opens at the
  **bottom of the box stack** (where it lands — no jump).
- Drag a folder onto the open area = **new box**; drop a folder onto a box =
  **flatten its photos into that box** (decided, portal wiring is the number/folder
  model; the flatten-onto-existing-box nicety is noted for polish).
- **Empty boxes persist** now (studio_boxes table) — clients can set up boxes ahead
  and fill later.

## Order view — "See your photos & order"
- Reorder within the open area and within each box (‹ ›), move photos between
  open/boxes, rename boxes (writes `renameBox` → updates table + photos' folder).
- NOTE: this v1 order view is the SIMPLE one (open section, then box sections). It
  is NOT the timeline yet (see §3).

## Final look (locked with Josh, lots of iterations)
- ONE muted steel-blue palette, **no glows**, solid dark bg. A thin **red** line
  frames the whole upload window (the one pop of brand red).
- **Neon-blue thin outlines** on buttons. Add photos = outline only; **New box** and
  **See your photos** = grey (muted-blue) fill + neon outline. Each **folder box**
  has a thin neon-blue outline.
- Big type, short copy, encouraging progress line ("Nice — 12 in! 🎉").
- Greys shifted to a **light brand blue**. Box names **wrap/readable**, one line on
  phone.
- **Phone behavior** (≤640px): no top buttons; the "Drop here" box becomes
  **"📷 Add photos"** and opens the photo library; drag hint, "drop a folder" line,
  and per-box counts are hidden; layout stacks + condenses; box names single-line.
- Clients can upload **videos** too (picker allows them); they're saved to the
  client's files. NOTE: the montage builder still uses PHOTOS only — see §3 video note.

---
# 2. BACKEND ADDED THIS SESSION

- **`sql/005_studio_boxes.sql`** (NEW) — `studio_boxes(id, client_id, name,
  position, created_at, unique(client_id,name))`. RLS on, service-role only. MUST
  BE RUN in Supabase.
- **`app/api/portal/media/route.js`** — GET now returns `{ media, boxes }`; POST
  gained `createBox` / `renameBox` / `deleteBox` (before delegating to the shared
  `applyMediaAction`). Box GET is non-fatal if the table is missing.
- No other schema changes. Photos still key to a box by `folder_path = box name`.

---
# 3. THE REORDER DIRECTION — TIMELINE (designed, NOT built yet)

Josh wants reordering to be a **zoomable horizontal timeline** (left→right = play
order) — the video-editor metaphor, since the output is a video. Mock delivered in
chat: `timeline-mock.html` (interactive). Locked requirements:

- **Linear timeline**, zoomable. Zoom out = whole video as tiny thumbs; zoom in =
  big thumbs for precise placement. **Pinch-to-zoom on phone** (Josh asked) IN
  ADDITION to – / + buttons.
- **Landscape**: turning the phone sideways should give a longer timeline (it's
  horizontally scrollable, so landscape just shows more — confirm/encourage it).
- **Relocate is linear + familiar**: drag on desktop; **tap-to-move on phone**
  (tap an item to pick up, tap a drop-gap to place) since touch-drag is unreliable.
- **Boxes on the timeline**: a box can **collapse to a single block** you slide to
  relocate as a unit, and **expand inline** to arrange the photos inside. (This is
  the "closed box relocates" idea from the old v4 order-screen mock, which was
  never live.)
- **Videos are first-class timeline items** — a client can load videos and place
  each one wherever they want, **in the open or inside a box**, and move it like a
  photo. Videos show distinctly (black thumb, ▶, duration).

**Big honest flag for the build:** putting videos INTO the ordered sequence means
the final render must include video clips, not just photos. The current montage
pipeline (`lib/montage.js` + Creatomate) is **photos-only**. Interleaving real
video clips is a real pipeline change (Creatomate can composite video, but the
source builder + `/api/admin/montage` need work, and credit/timing behavior
differs). Scope this separately before promising video-in-montage.

**Data model note:** the timeline needs a top-level order that interleaves loose
photos AND boxes (and where a box has internal order). Today we have `folder_path`
+ `sort_number` (within-group) + the new `studio_boxes.position` (box order). A
true interleave (a box sitting between two loose photos) still needs either a
global position on media+boxes or a single ordering column. Decide this when
building the timeline.

---
# 4. STILL PENDING (backlog, in rough priority)

1. **Build the real timeline reorder UI** (replaces the v1 order view). Requirements
   in §3. This is the next big feature.
2. **Mobile bug (known, deferred by Josh):** on the order/photos view, a phone
   refresh drops back to the Add-photos view — because `view` state isn't persisted.
   Fix by remembering the view (URL hash or storage). Easy; do it with the timeline.
3. **Auto-correct photos** — DESIGNED, not built. Per-photo, reversible (original
   never touched), fail-safe. Needs `sharp` (npm install) and touches the montage
   render path. Placement decided: per-photo checkbox in the "Fix framing" grid.
   (See H-4 §9.)
4. **Montage-by-box** (H-4 §9): montage generator should let you pick a BOX name to
   montage, not just photo numbers. Now that boxes persist, this is unblocked.
5. **Video-in-montage render pipeline** (see §3 flag) — only if we go there.
6. **Folder-rename discoverability** (H-4 §9) — make it obvious; allow on upload screen.
7. Drop-folder-onto-existing-box = flatten-in (confirm wired end to end).

---
# 5. MOCKUPS DELIVERED IN CHAT (design only — NOT in the repo)

`upload-neon.html` (desktop look), `phone-preview.html` (phone, framed),
`order-screen-mockup.html` (old v4 interleave idea), `timeline-mock.html` (the
timeline direction, with zoom + collapsible boxes + videos). These are reference
prototypes; the real styling already lives in `Uploader.jsx`.

---
# 6. FIRST PROMPT SUGGESTION FOR NEXT CHAT

"Read HANDOFF-5. Confirm sql/005 is run and the upload redesign is pushed + tested
on a phone. Then let's build the real timeline reorder (per §3) — zoomable
(pinch + buttons), tap-to-move on phone, collapsible boxes, videos placeable
anywhere — and fix the refresh-resets-view bug while we're in there."
