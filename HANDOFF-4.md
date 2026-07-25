# MAIN EVENT STUDIO — CLIENT PORTAL
## Handoff #4 (paste this into the next chat)
Prepared: Jul 23, 2026 · Owner: Josh Dolberg
Read ALONGSIDE HANDOFF-3 and MONTAGE-PLAN.md. This supersedes the admin-layout
AND montage-generator parts of HANDOFF-3 (the accordion is built; the montage
generator is now a multi-segment builder). Everything else in H-3/H-2 stands.

---
# 0. PUSH STATE — READ FIRST

Three commits exist on `main` from the last two sessions:

| Commit | What | Pushed? |
|---|---|---|
| `b34376a` | Accordion refactor + client upload stats | YES (origin/main is here) |
| `b4cf529` | Multi-segment montage builder | **NOT pushed** |
| `941b37c` | Intake view + Send-a-cut drag-and-drop | **NOT pushed** |

**Cloud/Cowork CANNOT push** — the sandbox has no outbound GitHub access
(`git push` → `403 from proxy`). Pushing MUST happen on Josh's machine:
- GitHub Desktop → **Push origin** (shows both unpushed commits), or
- Terminal: `cd ~/Documents/GitHub/studio-portal && git push origin main`

`main` is currently **2 commits ahead** of origin. After push, Vercel rebuilds;
HARD refresh `/admin` (Cmd-Shift-R). Nothing this session is live until pushed.

Commits were made with an inline identity (`Josh Dolberg / joshdolberg@gmail.com`,
NOT written to git config) because the sandbox has no git identity. If that email
differs from Josh's GitHub identity, `git commit --amend --reset-author` before push.

---
# 1. FIRST ORDER OF BUSINESS (next session)

1. **Push the two commits** (above) and smoke-test on the live site.
2. **Creatomate webhook post-mortem** — STILL OPEN from H-3 §4.1: renders finish
   on Creatomate but `studio_montages` stays "rendering" until "Check status" is
   clicked. Check Vercel → Logs for `/api/webhooks/creatomate` around a completion.
3. **Live-test the new montage builder** — especially the two UNPROVEN paths
   (see §4): a no-cards (photos-only) render, and a cherry-picked/re-ordered
   selection. These were unit-tested but never actually rendered on Creatomate.

---
# 2. WHAT SHIPPED THIS SESSION (committed; see §0 for push state)

## Admin rebuilt as a client-centric accordion (H-3 §1 — DONE)
- Page is now: **New client** panel on top, then the **Clients** list. The two
  old standalone panels (Send a cut, Generate montage) are GONE.
- Each client's **name is a pill** — click it to open that client's workspace
  inline. The always-visible row is: **Name pill · Email · Event · Last upload ·
  Files · Reset password / Archive**.
- Opened workspace shows three tool buttons — **Generate montage · Send a cut ·
  Intake form** — plus a **Copy portal link**. Choosing a tool opens its window
  inline ("tool-buttons-then-expand" model Josh picked). Renders live inside the
  client's Montage window.
- localStorage form-memory was dropped (the open pill now IS the selection).

## Client upload stats on the list
- `GET /api/admin/clients` now also returns `upload_count` and `last_upload_at`
  per client, aggregated from `studio_media` where `kind='client_upload'`
  (their own uploads only). Non-fatal if that query fails (shows 0 / em-dash).

## Multi-segment montage builder (the big one)
- Each client's Montage window is now a **segment plan**. Shared fields: title
  (honoree), subtitle, watermark. Each segment row: **Photos expression · Style ·
  Pace · "Include title cards" toggle**. "+ Add segment" / "Generate N segments".
- **One render per segment.** Segments are SEPARATE files Josh intercuts in his
  edit (this is the deliberate model — NOT one file that switches styles).
- **Photos expression**: ranges + singles, e.g. `1-50` or `1-10, 15, 11-51`.
  - Plays **in TYPED ORDER** (so `10, 3, 25` renders 10→3→25 — it's a selector
    AND a sequencer).
  - Duplicates keep FIRST occurrence; numbers past the client's photo count are
    dropped; a descending range like `10-1` counts down; **blank = all photos**.
  - Numbers match the 1..N order in the "Fix framing" / "Show numbered photos"
    strip.
- **Title-cards toggle**: off → segment renders as bare photos (no opening/closing
  card to trim around mid-edit). Either way the FIRST frame HARD-CUTS in and cards
  NEVER dissolve over photos (Josh's explicit constraint).
- Selection capped at **100 photos per render**; the addressable/numbered universe
  was raised to 500 (photos route). Render rows now show the spec (`#1-10,15,...`)
  and a **"no cards"** pill. Framing re-render carries the segment's photoSpec +
  cards choice through.
- `parsePhotoSpec(spec, count)` lives in `lib/montage.js` and is shared by the
  browser (live per-segment preview) and the server (authoritative) — they can't
  drift. Unit-tested (18 cases) this session.

## Intake form view (read-only) in the client workspace
- NEW `GET /api/admin/intake?clientId=...` (admin-only, service-role) returns the
  client's `studio_intake` row or `{ intake: null }`.
- "Intake form" tool shows a **read-only**, grouped view of all ~25 fields
  ("Contact & logistics" + "Event & creative direction"), vibe tags joined,
  Yes/No for booleans, em-dash for blanks, empty state when unsubmitted.
- It's a VIEW of submitted answers, not an editor. Making it editable is a
  separate, larger change if Josh wants it.

## Send-a-cut drag-and-drop
- The video picker is now a drop zone: drag a file on, or click to browse. Hidden
  `<input type=file>` behind it; dropped non-video files are ignored; chosen
  filename shows in the box.

## Infra / SQL
- **No new SQL this session.** `studio_intake` (sql/002) and `params jsonb`
  (sql/004) already existed — the builder stores `photoSpec`, `photoIndexes`,
  `includeCards` inside the existing `params` jsonb; intake reads the existing
  table. Nothing to run in Supabase.

---
# 3. FILE MAP (this session's changes)

| File | What changed |
|---|---|
| `app/admin/page.js` | Accordion, segment builder, intake view, drag-and-drop — the whole admin UI |
| `app/api/admin/clients/route.js` | GET aggregates `upload_count` + `last_upload_at` |
| `app/api/admin/montage/route.js` | Photo selection/reorder over full list; `includeCards`; stores spec in params; GET surfaces `photoSpec`/`includeCards` |
| `app/api/admin/montage/photos/route.js` | Numbering cap 100 → 500 |
| `app/api/admin/intake/route.js` | **NEW** — admin read of a client's intake |
| `lib/montage.js` | `parsePhotoSpec()`; `includeCards` in `buildMontageSource()` |

---
# 4. OPEN BUGS / VERIFY NEXT SESSION

1. **Creatomate webhook never updates rows** (H-3 §4.1) — still open, top of list.
   Sync "Check status" button still covers it.
2. **UNPROVEN render paths (new this session)** — unit-tested but never rendered
   on Creatomate: (a) a **no-cards** photos-only source, (b) a **re-ordered /
   cherry-picked** selection. Watch the first of each; z_rotation-style surprises
   are the risk area (though these don't use rotation).
3. **Verify the new UI live**: upload stats columns populate correctly; intake
   view shows a submitted client's answers; drag-drop upload goes end-to-end.
4. Upload-stats query assumes `studio_media` columns `client_id`, `created_at`,
   `kind='client_upload'` (inferred from the photos route, not a fresh schema
   read) — confirm counts look right.
5. Carry-forward from H-3/H-2, still outstanding: intake submit email, Send-a-cut
   email + client View door, client guide revision (H-2 §8), uploader's
   misleading "Network error during upload" (H-2 §5.11), MEvid's 3 unpushed local
   commits (Josh's call, separate repo).

## Verified Creatomate constraints (unchanged from H-3, still true)
- Transition = animation on the SECOND same-track element, `transition:true`
  (fade, slide, circular-wipe, scale). Motion via keyframes on
  x/y/x_scale/y_scale/opacity — **z_rotation fails**. Easing on FIRST keyframe.
- Images need width AND height or cover-crop surprises. Webhooks unsigned →
  verify by re-fetching by id. Renders auto-delete ~30 days → always archive to R2.
- ~31-photo 1080p montage ≈ 56 credits; 2,000/mo shared with MEvid (~35 montages).

---
# 5. DESIGN DECISIONS LOCKED THIS SESSION (don't re-litigate)

- Accordion: the **name pill** is the access point; tool-buttons-then-expand;
  renders live inside the Montage window.
- Montage segments render as **separate files** (intercut in edit), never one
  multi-style file.
- Photo spec plays in **typed order**; dedup first occurrence; blank = all.
- **Per-segment** title-cards toggle; cards ALWAYS hard-cut, never dissolve on
  images; first montage frame is always a cut.
- Intake view is **read-only** for now.

---
# 6. WORKFLOW LESSONS (carry-forward + new)

- Stale `.git/index.lock` still bites. In the Cowork sandbox, `rm` CANNOT delete
  files under `.git` ("Operation not permitted") — **`mv` the lock aside** instead
  (e.g. `mv .git/index.lock .git/index.lock.old`), then add/commit.
- The cloud sandbox has **NO GitHub network** — commit there, but **push from
  Josh's machine** (GitHub Desktop or terminal). See §0.
- After every deploy, HARD refresh `/admin` (Cmd-Shift-R) before judging a UI change.

---
# 7. FIRST PROMPT SUGGESTION FOR NEXT CHAT

"Read HANDOFF-4. Confirm the commits are pushed and live. Then let's
post-mortem the Creatomate webhook (§4.1), and I'll test the new montage segment
builder — starting with a no-cards render and a cherry-picked selection."

---
# 8. FILE MANAGER — clients + admin (added same session, commit `ea9f371`)

**What it does.** Both the studio (admin) and the client can now organize the
client's uploaded files — reorder (the numbering that drives montages), rename
files, rename folders, and move files between folders. Built on one shared engine.

- **Admin**: new **Files** tool button in the client workspace. Folder-grouped
  browser with thumbnails (videos show a "video" pill), inline edit of number /
  filename / folder, up/down reorder + "Renumber 1…N", per-file **download**, and
  **delete** (two-step confirm; removes the DB row + best-effort R2 object).
- **Client (portal uploader)**: the "Files you've sent us" list is now editable —
  same reorder/rename/move, plus **Move to Trash / Restore**. Clients CANNOT
  delete.
- **Trash workflow**: clients drop dupes/unwanted into a **`Trash`** folder (just
  a normal move — `folder_path = 'Trash'`). Only the admin actually clears it via
  **Empty Trash** (bulk delete). The Trash folder is protected from rename on the
  admin side. Constant `TRASH_FOLDER = 'Trash'` is duplicated in
  `app/admin/page.js` AND `app/p/[token]/upload/Uploader.jsx` — keep them equal.
- **Watch-live**: while the admin Files tool is open it **auto-refreshes every 5s**
  (paused during the admin's own edits) so Josh can watch a client organize on a
  call. NOT true realtime push — Supabase Realtime is blocked by the deny-all RLS
  design; polling is the deliberate workaround.

**Auth split**: delete is gated by `allowDelete` — admin route passes `true`,
portal route passes `false`. So the portal can never delete, only set-aside.

**Shared-login caveat**: a client is ONE login; all family members share it, so
there's no per-person attribution for who moved/trashed what. Known + accepted.

## File map (file manager)
| File | What |
|---|---|
| `lib/mediaOrganize.js` | **NEW** shared actions: update / renumber / renameFolder / delete / deleteMany (delete gated by allowDelete) |
| `app/api/admin/media/route.js` | **NEW** admin GET (list w/ presigned URLs) + POST (allowDelete:true) |
| `app/api/portal/media/route.js` | added POST (allowDelete:false) — client organize |
| `app/admin/page.js` | Files tool + 5s auto-refresh poll |
| `app/p/[token]/upload/Uploader.jsx` | client-side organize UI + Move to Trash / Restore |

**No SQL** — reuses `studio_media.folder_path` / `sort_number`; Trash is just a
folder value. Delete removes the row and best-effort deletes the R2 object (an
orphaned blob is harmless if the R2 delete fails).

---
# 9. BACKLOG / DESIGN NOTES (captured mid-session)

- **Montage-by-box (Josh's ask):** the montage generator must let you pick a
  BOX / folder name to montage — not just photo numbers. Today `photoSpec` is
  number-based (1-10, 15, …) over the flat photo list. When the folder/box model
  lands (below), add a "montage this box" option that resolves the box's photos
  in their order. Keep number-based selection too.
- **Portal upload/organize redesign (in progress, NOT built):** we're moving the
  client portal to a "drop window with boxes + a separate order screen" —
  play order = top-to-bottom; loose photos and whole boxes share one sequence;
  each box has its own internal order. Look = playful neon, red window + blue
  boxes, big buttons, short copy, encouraging progress. Interactive mockups were
  delivered in chat (upload-neon / order-screen / dropwindow). This needs a DB
  change: photos currently store only folder_path + sort_number; a top-level
  order for "loose photos AND boxes interleaved" isn't representable yet.
- When both land, the montage box-picker should read the SAME box/folder names
  the portal uses.

---
## Verify next session (file manager)
- Organize round-trips on BOTH sides; the montage numbering reflects reorders.
- Client can Move to Trash / Restore but the delete endpoints reject them (403).
- Admin Empty Trash deletes rows AND R2 objects.
- Auto-refresh actually shows a client's change within ~5s on the admin side.
- Delete on a photo referenced by an already-rendered montage doesn't break the
  finished MP4 (it's archived separately) — just leaves a stale framing key.
