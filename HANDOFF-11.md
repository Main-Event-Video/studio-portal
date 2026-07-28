# HANDOFF-11 — studio-portal montage system (Main Event Studio)

> Read this ENTIRELY before doing anything. HANDOFF-10 was too thin and the next
> session wasted time re-discovering the workflow, the authoritative file
> locations, and the deploy dance. This one is deliberately exhaustive. Josh is
> the user/owner.

Current repo HEAD when this was written: **`04b84bc`** (branch `main`, in sync with `origin/main`). Everything described here is committed + pushed + live on Vercel unless flagged "NOT deployed / pending".

---

## 0) THE SINGLE MOST IMPORTANT SECTION — environment & deploy workflow

There are **three** filesystems. Confusing them wasted hours last session.

1. **Cloud container** (where you, Claude, run): your working copies live in `/home/claude/` (e.g. `/home/claude/montage.js`). The `Bash` tool runs here. Has network. This is scratch space; it is discarded when the session ends.
2. **Josh's Mac** (the real repo), reached via the **device bridge** MCP tools (`mcp__remote-devices__*`):
   - Real path: `/Users/joshuadolberg/Documents/GitHub/studio-portal`
   - Inside `device_bash` it is mounted at `/sessions/<session-id>/mnt/studio-portal` (the session id changes; find it with `find /sessions -maxdepth 3 -name studio-portal -type d`).
   - `device_bash` runs ON the Mac, **no network**, and **cannot `rm`/`unlink`** (fuse mount → "Operation not permitted").
3. **Stale staged snapshot** at `/mnt/user-data/uploads/studio-portal/` — **DO NOT TRUST THIS. It is old.** It was staged once long ago and does not reflect the real repo. Reading it will give you wrong/outdated code.

### The authoritative files are on Josh's Mac. Your `/home/claude/*` copies must be verified against it.
At session start, for any file you'll edit, confirm your local copy matches the Mac:
```
# cloud:   md5sum /home/claude/montage.js
# device:  device_bash → cd <mount> && md5sum lib/montage.js
```
If they differ, pull the real one (see below) before editing.

### To pull a fresh copy of a repo file into the container
`device_stage_files` has a **stale cache**. If a staged file's md5 doesn't match the Mac, do:
```
rm -f /mnt/user-data/uploads/studio-portal/<path>      # cloud Bash: delete the stale stage
mcp__remote-devices__device_stage_files(["/Users/joshuadolberg/.../<path>"])   # re-stage fresh
```
Then verify md5 == the Mac before trusting it. (Or just `cat` it via `device_bash` and reconstruct.)

### To DEPLOY a change (this is the loop for every edit)
1. Edit the `/home/claude/<file>` working copy.
2. **Parse-check** it (see §9). Never deploy code that doesn't parse.
3. `SendUserFile(["/home/claude/<file>"])` → returns a `file_uuid`.
4. `mcp__remote-devices__device_commit_files([{fileUuid, devicePath: "/Users/joshuadolberg/Documents/GitHub/studio-portal/<path>"}], force: true)` → writes the file to the Mac's disk. **This is NOT a git commit** — it just writes the file into the working tree.
5. Verify: `md5sum` local vs `device_bash md5sum` on the Mac.
6. **Josh runs git himself** in his **native macOS Terminal** (not device_bash — see below). Give him copy-paste blocks, ONE command per block:
   ```
   cd ~/Documents/GitHub/studio-portal
   ```
   ```
   rm -f .git/index.lock
   ```
   ```
   git add -A
   ```
   ```
   git commit -m "…"
   ```
   ```
   git push
   ```

### git gotchas (these bit us repeatedly)
- **`.git/index.lock`**: `device_bash` git operations leave a 0-byte `.git/index.lock` that `device_bash` **cannot delete**. Every commit block must start with `rm -f .git/index.lock` in Josh's **native** Terminal. Do NOT try to git-commit via `device_bash` — it fails on the lock.
- **New files** (e.g. `public/green.png`): a plain `git add <named files>` will MISS an untracked new file → green renders 404 on the missing asset. Use **`git add -A`** whenever a new file was added, and say so explicitly.
- Untracked junk that lives in the mount and should be ignored: `.fuse_hidden*`, a stray 0-byte `claude-sonnet-5.` file. Filter them out of `git status` output when reporting (`grep -vE 'fuse|claude-sonnet'`).
- Nothing you do via `device_commit_files` is live until Josh pushes. Vercel auto-deploys `main` on push.

### Connected device folders (may change per session)
`mcp__remote-devices__get_device_info` → `connectedFolders`. This session had:
- `/Users/joshuadolberg/Documents/GitHub/studio-portal` (the repo)
- `/Users/joshuadolberg/Documents/GitHub/maineventvideo` (the OTHER app, "MEvid" — shares the Creatomate account; see §8)
- a "Dylan Life Stills" photo folder.
The bridge **drops occasionally** ("device not connected to the bridge") — just retry after a moment. For overnight work Josh runs `caffeinate -dimsu -t 14400` (keep-Mac-awake, 14400s = 4h) so the bridge stays up.

---

## 1) What the product is

`studio-portal` = a **video-montage client portal** for Main Event Studio (Josh's business — event/bat-mitzvah/family montage videos).
- Stack: **Next.js (App Router) + Supabase (Postgres) + Cloudflare R2 (storage) + Creatomate (video render API)**. Deploys on **Vercel** (auto-deploy on push to `main`).
- Flow: clients upload photos/videos on a token portal → organize them into **albums** → studio admin builds **montage segments** (choose photos, style, pace, cards, green screen) → Creatomate renders MP4s → admin downloads / delivers.
- Admin builds montages in the `/admin` page (3 steps: Edit photos → Choose style → Finish & generate). The client uploads/organizes at `/p/[token]/upload`.

---

## 2) Josh — profile, preferences, working style (FOLLOW THESE)

- **Honesty is his #1 rule.** Never invent sources/stats/claims. Flag anything unverified. If you can't verify, say so. Separate proven from inferred. (This is in his saved preferences.)
- **Correctness > clarity > natural voice > anti-AI-polish.**
- Wants **numbered steps, minimal prose, copy-paste command blocks — ONE command per block** (he's had terminal trouble; multi-command blocks caused stuck quote-prompts before).
- He **steps away for long stretches**; says **"green"/"confirmed"/"pushed"** when a deploy is live and he's ready.
- **He render-tests on Creatomate himself.** YOU CANNOT trigger renders (no API key in-session, admin needs his login) and CANNOT see his renders. You verify with **browser previews only** (Playwright + Chromium) — **zero Creatomate credits**. He then renders and sends screenshots/MP4s of problems.
- He **likes mockups/previews before you finalize** ("feel free to show me a mockup before final"). Show, don't just tell.
- Clients are **mostly on desktop** (so drag-and-drop is fine, plus menus).
- He gets **frustrated when you don't understand a spec** — re-read his words carefully, reflect them back, and when unsure ask ONE concrete question rather than guessing (but don't over-ask; he dislikes being blocked).
- Deliver files with `SendUserFile`. Code files as `display:'attach'`; visual previews as `display:'render'` (he couldn't "see" attach-mode previews once).

---

## 3) Repo map — the files that matter

**Engine / server:**
- `lib/montage.js` — **THE montage engine.** Exports `buildMontageSource({...})` → a Creatomate `source` JSON. Contains all 12 styles + builders. ~1200+ lines. This is 90% of the montage work. Deep-dived in §5.
- `lib/creatomate.js` — `createRender({source, webhookUrl, metadata, renderScale})` → POSTs to Creatomate. `renderScale` (0–1) → `render_scale` (cheap drafts). `getRender(id)`.
- `lib/timelineOrder.js` — `buildTimeline(mediaRows, boxRows)` → `{flat, structure}`. THE single source of truth for play order (shared by client UI + render path). Loose media + albums interleave in one order; album `position` and loose `timeline_pos` share one 1..N scale; media inside an album ordered by `sort_number`. Seeds EMPTY albums from `studio_boxes` so they still appear.
- `lib/clientTimeline.js` — `orderedClientMedia` / `orderedClientTimeline` — server-side ordered media; filters out hidden (`hidden_at`) + Trash + character folders.
- `lib/mediaOrganize.js` — shared media actions (`update`, `renumber`, `renameFolder`, `delete`, `deleteMany`, `hideBox`/`unhideBox`).
- `lib/r2.js` — `getViewUrl` (presigned view), `getDownloadUrl`. R2 storage.
- `lib/heic.js` — `isHeic()` (HEIC excluded from renders; converted elsewhere).
- `app/api/admin/montage/route.js` — **POST** builds the render (loads timeline, resolves photo spec, probes photo dimensions for wall/print styles, injects the green photo, calls buildMontageSource + createRender, tracks in `studio_montages`). **GET** lists renders. This is where green injection + dimension probing + draft render_scale live.
- `app/api/admin/montage/photos/route.js` — the client's photo list for the admin framing strip (adds `album` per photo).
- `app/api/portal/media/route.js` — client-facing: GET media+boxes; POST actions `createBox/renameBox/deleteBox/setArrangement`. `setArrangement` persists the WHOLE timeline (upserts album rows so a brand-new album persists).
- `app/api/admin/media/route.js`, `app/api/admin/media/download-zip/route.js` — admin media list (`hidden` flag) + store-only ZIP bulk download.

**UI:**
- `app/admin/page.js` — the whole admin app (montage builder, Files tool, photo editor, renders list). Big file. Segment editor is in "Finish & generate" (`montageStep === 3`).
- `app/p/[token]/upload/Uploader.jsx` — the client upload + **Photo Library** (drag + move menus + multi-select + Undo). ~1200 lines.

**Assets / SQL:**
- `public/green.png` — solid `#00B140` 1920×1080 — the green-screen "photo". **NEW this session.**
- `public/watermark.png` — the draft watermark.
- `public/overlays/*` — light-leak + dust PNGs (leak1-3.png, dust1-2.png, leak_epic1-3.png) used by collage/epic; require `assetBase` (the site URL) to be passed so Creatomate can fetch them.
- `sql/0XX_*.sql` — migrations. **`sql/013_album_hide.sql` adds `hidden_at` to `studio_boxes` + `studio_media`** — Josh must run it in Supabase for the album-hide feature. **STATUS UNKNOWN — confirm he ran it.**

---

## 4) Data model quick reference (Supabase)
- `studio_clients` — clients. `photo_edits` (jsonb) = per-client photo editor edits applied to every render.
- `studio_media` — uploaded files. `folder_path` = album name (null = loose), `sort_number` = order in album, `timeline_pos` = loose top-level rank, `hidden_at` (013), `kind='client_upload'`.
- `studio_boxes` — albums. `name`, `position` (top-level rank), `hidden_at` (013).
- `studio_montages` — render jobs. `style`, `title`, `status` (queued/rendering/ready/failed), `params` (jsonb: photoSeconds, totalSeconds, adjustments, photoSpec, includeCards, videoPlaceholders, greenScreen, hidden, …), `video_url`, `r2_key`, `error`.

---

## 5) THE MONTAGE ENGINE (`lib/montage.js`) — full map

`buildMontageSource({ photos, items, style, title, subtitle, watermarkUrl, photoSeconds, totalSeconds, includeCards, width=1920, height=1080, background, greenBookends, assetBase })`
- Prefer `items` (array of `{type:'photo'|'placeholder', url, framing, fit, size, colorCorrect, mode, contrast, saturation, posX, posY, w, h, green}`). `photos` is a back-compat shorthand.
- **`totalSeconds`** (length mode): computes `perPhoto = totalSeconds / photoCount`, threads it into builders, then a final **`scaleMontageToLength(src, target)`** pass scales EVERY time/duration/keyframe so the whole montage lands exactly on `totalSeconds` (absorbs each style's overlap/overhead). This is why length mode is exact.
- **`greenBookends`** — now always passed `false` by the route (green is an injected photo, not an overlay). The old overlay code (`addGreenBookends`, `greenWipe`) and the standard-path `gseq` green-slot code still exist but are INERT (only fire if `greenBookends` true). Safe to leave.

### The 12 styles (in `STYLES`) and how each is built
Slideshow / one-at-a-time (fall through the standard per-photo loop):
- **hollywood** — gold-on-black, slow cinematic. photoS 3.5, fade 1.0, fade transitions, zoom 100→112.
- **timeless** — ivory, elegant, gentle. photoS 4.0, fade 1.4, fade, zoom 100→108.
- **party** — fast/punchy. photoS 2.0, fade 0.4, varied transitions (slide/circular-wipe/scale/fade), zoom 100→116.
- **party2** — energetic + diagonal `pan` drift. photoS 2.5, fade 0.5, varied, zoom 100→118.
- **duotone** — dual-tint split bg + true-colour hero. `duotoneShot()`. (Josh: looks good.)

Special builders (own functions, own timelines):
- **duotone2** (`duotone2Source`) — frantic; bg + hero transition independently (`duotoneParts`). (Josh: looks good.)
- **polaroid** (`polaroidStackSource`) — growing stacked PILE of tilted prints. See §6-Polaroid.
- **collage_classic / collage_featured** (`collageWallSource`, `scatter=false`) — **JUSTIFIED ROWS** of native-aspect cells; camera whips to rest on each photo in chronological order. (Josh: looks good.)
- **gallery150** (`collageWallSource`, `S.scatter=true`) — **SCATTER PILE**: overlapping tilted native-aspect prints on a dark surface, camera flies in to feature each. Restored this session (was wrongly justified rows).
- **epic_vintage** (`epicVintageSource`) — one hero print at a time over blurred bokeh + heavy warm light leaks; faded vintage grade. See §6-Epic.
- **trendy** (`trendyWallSource`) — 3D angled wall (perspective + x/y rotation) of white-bordered native-aspect prints, camera drifts across. Matches its ref.

### Universal rules baked in (Josh insisted)
- **Feature every photo in chronological order.** Wall styles place photos in a SHUFFLED order (so the camera whips haphazardly) but the camera **rests on photo 1, 2, 3 … N in order** (`cellOfPhoto` maps chronological index → cell). Every included photo gets its own focused rest — even ones also visible as accents.
- **Native aspect where the layout allows; else cover-crop to the TOP.** Portrait photos: walls give them tall cells, Epic a tall print; the one-at-a-time slideshow styles cover-crop to the **top** (keeps heads). NO pillar bars, NO blurred fill (both rejected by Josh). Polaroid is exempt (its own card design). The route probes each photo's real pixel dimensions (`probeDims` via `sharp` + a Range fetch of the header) ONLY for `collage||epic||trendy` styles; graceful fallback to landscape if `sharp`/probe fails.

### Photo color/framing helpers
- `applyPhotoColor(el, it)` — ONE Creatomate `color_filter` per image (mutually exclusive): bw→grayscale, sepia→sepia 80%, else explicit contrast, else auto-colour (`colorCorrect` → contrast 15% "one-tap enhance"). A green item (`it.green`) has no flags → stays pure.
- Framing: `FRAMING` (top/center/bottom → x/y shifts) for slideshow; `printFraming(it)` for polaroid (default top = head-safe). Drag-to-position `posX/posY` overrides.

---

## 6) Per-style CURRENT STATE + references + what's tuned + what's pending

References I have (in `/home/claude/`, and Josh's uploads dir): `epic_ref.mov`/`Epic_Vintage.mov` + frames (`epic_sheet.png`), `150_Gallery.mov` (`gallery_ref_sheet.png`), `Trendy_Photo_Montage_1.mov` (`trendy_ref_sheet.png`), `polaroid_16x9_8.mp4` + `polref/f1-f6.png` + `polref_sheet.png`, `Collage_Wall___Option_B_faceframed.mp4`.

- **Polaroid** (rebuilt this session, matches `polref_sheet.png`): tall PORTRAIT prints (40%×78%), photo cover-cropped to TOP (heads safe, `printFraming` default top), thick bottom caption border, **stable** deep-violet background + vignette (the per-photo blurred backdrop that changed each drop is GONE; `background.url` still supported for a custom static image), wider haphazard scatter (±17% x, ±10% y, ±15° tilt) with a dominant front print, prints **fall quick then feather to a soft still landing, no bounce** (removed the x_scale overshoot; y is 3-keyframe quadratic-in→out). `POL = {HOLD:4.4, MOVE:1.2, KEEP:4, FADE:0.65}`. Needs Josh's render-test.
- **Epic Vintage**: hero print now NATIVE aspect (portrait photo → tall print). **Exit reworked**: the whole pile (tan base + bg prints + hero) RECEDES + spins + fades away together (scale→56%, opacity→0), NOT the print flying off leaving the tan gap. Grade/leaks deliberately toned DOWN vs the very-blown-out reference because **the Creatomate render OVER-BRIGHTENS** (see §10) — do not blindly re-raise them. Needs render-test of the exit; Josh may want leaks up.
- **Gallery 150**: scatter pile restored (overlapping tilted native-aspect prints, dark backing). Camera flies to feature each in order.
- **Collage classic/featured**: justified rows, native aspect. Josh approved.
- **Trendy**: native-aspect justified cells in a 3D perspective wall, airy grade, drifts across. Matches ref.
- **Hollywood/Timeless/Party/Party2**: one-at-a-time, cover-crop-to-top. Params well-differentiated (see §5). Josh said "the others need tweaking" but gave NO specific gripe for these — **ask him what specifically bugs him before changing numbers.** The Timeless "ivory border at 22-23s" bug (portrait pillarbox) was fixed by the cover-crop-to-top change.

---

## 7) GREEN SCREEN — the current design (evolved a LOT; get this right)
Josh's real need: a **keyable green frame** at the montage IN and OUT that he composites in his NLE.
- **Current (correct) design:** the green toggle injects a real **green PHOTO** (`public/green.png`, `{type:'photo', green:true, url, w:1920, h:1080}`) as the **first AND last item** in the render sequence (done in `app/api/admin/montage/route.js`, guarded by `greenScreen !== false`; it passes `greenBookends:false`).
  - Slideshows → full-frame green (cover). Polaroid → a green PRINT that drops in. Walls → a green CELL. Duotone/duotone2 → **pure full-frame green** (guarded by `it.green` to SKIP the tint so it stays keyable).
  - Because it's a real photo, it "drops in like a photo" and no longer HID the first Polaroid print landing (the old full-screen overlay wipe did — that was the "first frame showed a photo already landed" bug).
- **Toggle:** "Finish & generate" → each segment → checkbox **"Green-screen frame (keyable green photo, first & last)"**, on its own row (Josh kept missing it when it was inline with title cards). Wired: page.js `s.green` → POST `greenScreen` → route.
- **History of what was tried and REJECTED** (so you don't regress): (1) flat full-screen green hold+cut overlay → "does nothing"; (2) a moving green WIPE overlay → still an overlay, hid the first landing; (3) green as an injected first/last full-frame slot for slideshow only + overlay for pile styles → Josh: "add a green photo to every export so it is treated like a green photo" → led to the current per-style injected green photo.
- **Open option:** for the WALL styles the green is a green CELL (partial), not full-frame. If Josh wants always-full-frame green regardless of style, that's a small switch — he was told this and hasn't asked for it yet.

---

## 8) CREATOMATE — credits, cost, the shared-account issue
- **Credit formula (verified from Creatomate docs):** `credits = width × height × fps × seconds ÷ 100,000,000`. At 1080p/30fps ≈ **0.62 credits/sec** (60s ≈ 37 credits; 6-min ≈ 224; 4K ≈ 4×).
- **Josh upgraded to Growth (monthly, ~$129, 10,000 credits/mo).** Previously Essential (2,000) and ran out — which is why renders failed with **"Insufficient credits"** (that was the real cause of the "renders failing / taking too long" mystery, NOT a code bug).
- **Cheap drafts (deployed):** watermarked renders go out at `renderScale: 0.5` (half-res ≈ ¼ credits); un-watermarked finals stay full 1080p. In `route.js` → `createRender({... renderScale: watermark ? 0.5 : null})`.
- **SHARED ACCOUNT with Main Event Video** (`/Users/joshuadolberg/Documents/GitHub/maineventvideo`, "MEvid"): both apps use the same `CREATOMATE_API_KEY`. studio-portal's dev testing was draining MEvid's (a live product's) credits. **Recommended: split them onto separate Creatomate accounts.** MEvid itself is well-behaved (no auto-render on submit, no render cron, cheap cached previews via `render_scale`); its only heavy cost is 4K exports, which ARE gated to the "Hollywood" tier / `fourk_paid`. (You gave Josh a one-line patch to stop MEvid auto-selecting 4K after purchase — his other Claude window handles MEvid; **do not touch the maineventvideo repo** unless asked.)
- **Monthly usage review** scheduled task exists: `trig_0181aahCSJ2rayD2d4H1qxs1`, fires 1st of each month 15:00 UTC, push+email; asks Josh for the dashboard number, logs to memory `/areas/creatomate-usage.md`, recommends keep/downgrade/annual. (Created via `mcp__claude-code-remote__create_trigger` — the CORRECT tool for durable scheduled tasks; NEVER use the in-process `CronCreate`.)

---

## 9) VERIFICATION — how to check work without Creatomate
- **Parse-check every JS/JSX before deploy:** `cp file _c.jsx && npx --yes esbuild _c.jsx --bundle=false --outfile=/dev/null [--loader:.jsx=jsx] 2>&1 | tail -1`. Success prints an "⚡ Done" summary to **stderr** — check for the word "error", not just any stderr.
- **Structural tests:** `node -e "import('./montage.js').then(({buildMontageSource,STYLES})=>{ … build all 12 styles, JSON.stringify, assert no undefined/NaN, check element shapes … })"`. Always build **all 12 styles** with cards+green after an engine change to catch throws.
- **Browser previews (Playwright + preinstalled Chromium):** `chromium.launch({executablePath:'/opt/pw-browsers/chromium'})`. **Pause-and-screenshot** at a `currentTime` is reliable; **recording webm has a paint-timing bug** where large CSS background-images appear ~15s late — don't record, screenshot frames + assemble with ffmpeg. Data-URL images in HTML must be UNQUOTED in `background-image:url(...)` (quoting inside a double-quoted style attr breaks them — this bit us on two previews).
- Dylan sample images for previews are in `/home/claude/dyl_imgs.json` (8 data URLs, mixed real photos).

---

## 10) CREATOMATE RENDER GOTCHAS (hard-won)
- **The render OVER-BRIGHTENS vs browser preview.** Screen-blend layers (light leaks/haze) stack more strongly in the actual render than the browser predicts. Epic's exposure was tuned DOWN repeatedly for this reason. When adding screen/haze layers, assume the render will be brighter than your preview.
- **Keyframed `z_rotation` DOES animate in the render** (docs don't confirm it, a render proved it). Keyframed rotation is fine.
- **Scaling a composition UP rasterize-blurs** (upscale). Scaling DOWN is safe. Epic/collage push cameras by scaling; keep hero content at ≥100% and drift down, not up, where sharpness matters.
- **`render_scale`** is a top-level render param (not in the source) — used for cheap drafts.
- One `color_filter` per image only (mutually exclusive). No confirmed `saturate` filter.
- `fit:'cover'` crops to fill; `fit:'contain'` shows whole with letterbox; native-aspect cells use cover (aspect matches → no crop) or contain (guaranteed no crop).
- Green must stay **exactly `#00B140`** to key — never run a color_filter/tint over green frames.

---

## 11) FEATURES built this session (all live)
- **Green-as-real-photo** (§7).
- **Length / Pace-by-time:** segment "Pace by" dropdown → "Seconds per photo" OR "Total length (time)". Total opens a **min : sec : frames** entry (30 fps); `totalSeconds = min*60 + sec + frames/30`; engine paces the whole set to fit exactly (via `scaleMontageToLength`). Route validates 3–1800s.
- **Client Photo Library reorg** (`Uploader.jsx`): desktop drag between albums + drop-before-a-tile for any position; **"Move to ▾"** menu per photo + multi-select (click / shift-click range) "Move N to ▾"; album reorder via ⠿ drag handle / ▲▼ / "Move album ▾"; live play-order numbers; **Undo** button (snapshots timeline before each move — added after Josh lost a photo in his first test). Timeline stays for sequence flops. Backed by `setArrangement`.
- **Renders list auto-refresh:** polls every 7s while anything is queued/rendering, shows an "Auto-refreshing…" dot, stops when all Ready/Failed.
- **Album hide** (non-destructive, client + admin, reversible): `hideBox`/`unhideBox` stamp `hidden_at`; hidden albums/photos vanish from timeline + montage + client. **Requires `sql/013_album_hide.sql` in Supabase.**
- **Admin lasso multi-select + bulk ZIP download** (store-only zip, `download-zip` route).
- **Album pulldown** in Finish & generate (choose an album to output + numbers).
- **Auto-color** = one-tap enhance (contrast bump), adjustable.
- **Squared-off album sections** in the montage editor + Files tool.

---

## 12) PENDING / TODO / needs Josh
1. **Render-test priority** (Josh, once credits confirmed): Polaroid → a style with green ON → Gallery 150 → Epic Vintage (does the pile leave together?).
2. **`sql/013_album_hide.sql`** — confirm it was run in Supabase (album hide breaks without it).
3. **Hollywood/Timeless/Party/Party2 "tweaking"** — Josh flagged them but gave no specifics. **Ask what specifically bugs him** (pace? grade? transitions?) before changing numbers.
4. **Epic leaks/exposure** — awaiting his render-test; he may want the leaks brought up (careful re: over-brighten).
5. **Green on WALL styles** = a green cell, not full-frame — offer full-frame option if he wants it.
6. **Separate Creatomate accounts** for studio-portal vs MEvid (his call).
7. **Brand RED / BLUE hex codes** — Josh owed these; not yet provided.
8. **GitHub token expiration** — a daily reminder was set up in an earlier session.
9. Sharp dimension probe: if portraits still render wide in Epic/walls, `sharp` isn't loading in that route → switch `probeDims` to a dependency-free JPEG/PNG header reader.

---

## 13) FULL ISSUE LOG (chronological, so nothing is lost) — every issue + resolution
1. **gallery150 blank cards in preview** → preview CSS `padding` computed against wall width; engine was always correct. (Lesson: verify whether a bug is engine or preview.)
2. **Epic Vintage long saga**: floating (unconnected) print border → connected thin border; must drift AWAY from camera; other prints visible behind; big light leaks + dust; the SPIN; unified motion (whole pile as one camera); slow-drift-then-fast transitions; "spin-away-then-fall-on" not crossfades; bright full pile (no dark gaps/white boxes); render OVER-EXPOSED → toned leaks/haze/dust way down; "weird white square revealed as pic falls back"; finally the EXIT: **whole pile must leave together** (was the print flying off leaving a tan gap) → recede+spin+fade the whole comp, hero holds (no independent fly-off).
3. **Green screen saga** (see §7 history): flat overlay → wipe overlay → injected slot (slideshow) + overlay (pile) → **injected green PHOTO for all** (current). The overlay was HIDING Polaroid's first print landing.
4. **Polaroid saga**: smooshed/short prints + heads chopped → tall portrait + top-crop; background changing each photo → stable changeable bg; tight cluster → wider scatter; bounce on landing → quick-fall feather no-bounce; first print looked pre-landed → was the green overlay (fixed by green-as-photo). Rebuilt to `polref_sheet.png`.
5. **Aspect ratio saga**: pillars rejected → blurred-fill → ALSO rejected → final rule: **keep native shape where the layout allows, else cover-crop to the TOP; no pillars, no blur.** Black bars were only the editor's letterbox preview, NOT baked into files. Needed photo dimensions → `sharp` header probe in the route.
6. **Timeless "resize carry over" ivory borders at 22-23s** → fixed by cover-crop-to-top.
7. **Client Photo Library too hard to reorganize** → drag + menus + multi-select + Undo (Undo added after Josh lost a photo).
8. **"Renders failing / taking too long"** → actually **Creatomate out of credits** ("Insufficient credits"), worsened by the shared account with MEvid. Fixed by Growth upgrade + cheap drafts.
9. **Total-length feature** → then refined to the Pace-by choice with min:sec:frames.
10. **The deploy/git friction** (index.lock, stale staging, stale `/mnt/user-data` snapshot, `git add -A` for green.png, device_bash can't rm/commit) — all documented in §0.
11. **Green toggle "invisible"** → it was inline with title cards; moved to its own row + relabeled.

---

## 14) One-liner reminders
- You cannot render or see renders — preview in the browser, deploy, let Josh render-test.
- Nothing is live until Josh pushes. Give him the one-command-per-block commit dance starting with `rm -f .git/index.lock` and using `git add -A`.
- Trust the Mac repo, not `/mnt/user-data/uploads`. Verify md5s.
- Re-read Josh's spec words literally; reflect them back; don't guess on his sensitive styles (Polaroid, Epic).
- Honesty first — flag anything you didn't verify.
