MAIN EVENT STUDIO — CLIENT PORTAL
Handoff #7 (paste this into the next chat)
Prepared: Jul 25, 2026 · Owner: Josh Dolberg
Read AFTER HANDOFF-6. This session added: (A) the TIMELINE reorder + montage-honors-order
+ Box→Album (committed), and (B) the "Character Build" feature — guided 12-shot capture,
a premium AI character build sheet PNG, and a Claude-vision character write-up.

================================================================
0. DO FIRST — deploy state
================================================================
Committed on `main` locally (NOT pushed yet — push from your machine):
  db3a0e4  timeline reorder + Character Build (capture + sheet)
  + a follow-up commit for the premium sheet redesign + AI write-up (this session's tail).

Run these before it all works live:
1. `git push origin main` from your machine.
2. Supabase → SQL Editor, run in order (if not already):
     sql/005_studio_boxes.sql            (albums table)
     sql/006_timeline_pos.sql            (timeline order column)
     sql/007_character_name.sql          (subject/character name field)
     sql/008_character_profile_cache.sql (caches the AI write-up so it bills once)
   (Character Build capture needs NO migration — it uses a reserved folder sentinel.
    008 is only needed for write-up caching; without it, each sheet build re-generates.)
3. Vercel env vars to add:
     ANTHROPIC_API_KEY   — enables the AI character write-up (Claude vision).
     ANTHROPIC_MODEL     — OPTIONAL; overrides the vision model id
                           (default 'claude-3-5-sonnet-latest'). Set this to a
                           newer model id if you want.
     (Email of the sheet uses your existing INTAKE_NOTIFY_EMAIL / ADMIN_EMAIL.)
4. `sharp` was added to package.json — Vercel installs it on build. For LOCAL dev,
   run `npm install` once.
5. Hard refresh; test on a PHONE.

================================================================
1. CHARACTER BUILD — what it is
================================================================
A holding area on the upload page (button labeled "Character Build", between the drop
window and "See your photos & order"). It is completely separate from the montage +
timeline (reserved folder_path sentinel '__character_build__', excluded like Trash).

Client flow (app/p/[token]/upload/CharacterCapture.jsx):
- Intro screen with instructions (someone else shoots — NO selfies; rear camera; plain
  wall; good light; same outfit/hair; fill the outline; etc.).
- Guided LIVE camera (getUserMedia) through 12 curated shots with a pose OUTLINE overlay,
  shot counter, hint, progress dots, flip camera, skip, retake/accept. Falls back to the
  phone's native camera per shot if the live preview can't run.
- The 12 shots (lib/characterPoses.js POSES): face front-neutral / big-smile / angry,
  3/4 left, 3/4 right, left profile, right profile, top-of-head; full body front (A-pose),
  back, left, right.
- Clients can ALSO upload their own shots into the same area ("Upload my own photos").

Storage: kind='client_upload', folder_path='__character_build__'. Guided shots use
sort_number 1..12 (retake-safe: re-taking a slot replaces it). Free uploads: sort_number null.

================================================================
2. THE BUILD SHEET (premium PNG) + AI write-up
================================================================
lib/characterSheet.js — buildCharacterSheet(db, clientId) → { buffer, count, missing, profile }.
- High-end layout: gold-ruled branded header (studio kicker + client name), grouped
  sections (Face / Full body / Additional), rounded thumbnails, "not taken yet" placeholders,
  and a "Character Profile" panel.
- Character Profile = lib/characterProfile.js → Claude vision reads a representative subset
  of the shots and returns grounded appearance attributes + a 2-3 sentence summary + a
  paste-ready AI image prompt. Non-sensitive by design (no ethnicity/health/identity; skin
  described only as tone for color-matching). Marked "AI-generated draft — review before use."
- Degrades gracefully: with no ANTHROPIC_API_KEY the sheet still renders, showing a hint
  where the profile would go.

Where you get it:
- ADMIN, on demand: each client's workspace has a "Character build" button
  (app/admin/page.js) → downloads the PNG (GET /api/admin/character-sheet?clientId=...).
- AUTO on completion: when the client finishes all 12, POST /api/portal/character action
  'done' generates the sheet and EMAILS it to you (lib/email.js sendCharacterSheetReady),
  with the profile text (incl. the AI prompt) inline so it's copyable from your inbox.

Files: NEW lib/characterPoses.js, lib/characterSheet.js, lib/characterProfile.js,
app/api/portal/character/route.js, app/api/admin/character-sheet/route.js,
app/p/[token]/upload/CharacterCapture.jsx. CHANGED lib/email.js, app/admin/page.js,
app/p/[token]/upload/Uploader.jsx, lib/timelineOrder.js (excludes the reserved folder),
package.json (+sharp).

================================================================
3. VERIFICATION DONE (sandbox) / STILL TO TEST
================================================================
Verified: ordering + move round-trip (23 checks total across timeline), sheet PNG renders
(premium layout + profile panel) via headless render, all files parse/transform, capture
UI screenshotted (intro + guided states).
NOT yet tested on real hardware: live camera on an actual phone; a real Claude call with
real photos (needs ANTHROPIC_API_KEY); the completion email; a Creatomate render honoring a
re-ordered timeline. Do these after push + env + SQL.

Known notes / risks:
- Sheet text uses system 'sans-serif' (safe on Vercel's Node runtime). If labels ever render
  blank on Vercel, a bundled font is the fix.
- Admin "Character build" download triggers a Claude call each time (cost). Fine for now; add
  a ?noprofile toggle if you want a cheaper re-download.
- Full-body self-capture assumes a helper (per your instruction: no selfies).

================================================================
4. STILL PENDING (backlog)
================================================================
1. Montage VIDEO PLACEHOLDER (your ask): the render can drop a labeled "▶ VIDEO — place clip
   here" card at each video's timeline slot so you know where to cut in editorial. Designed,
   NOT built yet — say the word and it's a contained change to lib/montage.js + the montage route.
2. Video-in-montage actual render (separate, bigger Creatomate change).
3. Auto-correct photos (H-4/§9) — designed, needs sharp (now installed).
4. Montage-by-album.
5. Inline album rename on the timeline.
6. Copy-to-clipboard of the AI prompt inside admin (currently in the email + on the sheet).

================================================================
5. FIRST PROMPT SUGGESTION FOR NEXT CHAT
================================================================
"Read HANDOFF-7. Confirm push + sql/005+006 + ANTHROPIC_API_KEY are set, and that the phone
capture + emailed build sheet worked. Then [pick]: build the montage video placeholder, or add
the AI-prompt copy button in admin, or scope video-in-montage."
