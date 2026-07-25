MAIN EVENT STUDIO — CLIENT PORTAL
Handoff #8 (paste this into the next chat)
Prepared: Jul 25, 2026 · Owner: Josh Dolberg
Read AFTER HANDOFF-7. This session shipped: AI-write-up caching, the portal
favicon, and the nightly off-site media backup. It also surfaced a prioritized
to-do list (below) that we were working through top-to-bottom.

================================================================
0. WHAT WENT LIVE THIS SESSION (all committed + pushed to origin/main)
================================================================
- Character sheet AI write-up is now CACHED (generate once, reuse). Columns
  character_profile + character_profile_sig on studio_clients. Admin download
  supports ?regenerate=1 to force a fresh write-up. (commit 49a2132)
- sql/007_character_name.sql + sql/008_character_profile_cache.sql RUN in
  Supabase. ANTHROPIC_API_KEY added in Vercel (Sensitive, Prod+Preview).
  Redeployed. Portal verified healthy at clients.maineventstudio.com.
- Portal favicon now matches the main site (points at the Squarespace-hosted
  icon maineventstudio.com uses). (commit 7dcc4e5)
- Nightly OFF-SITE media backup shipped as code (commit b165ef7):
  .github/workflows/backup-media.yml + scripts/backup-manifest.mjs + BACKUP.md.

ONE THING NOT VERIFIED: the AI write-up generating end-to-end on a real client
(needs an admin/client login). Code, key, and columns are all in place.

================================================================
1. DATA SAFETY — action still required by Josh (P0, your #1 concern)
================================================================
The backup automation is DORMANT until you do the one-time setup in BACKUP.md:
  A. Cloudflare: turn on R2 object versioning + a lifecycle rule to expire
     noncurrent versions after ~60-90 days.
  B. Cloudflare: create a read-only R2 API token (Access Key / Secret / Account
     ID / bucket name).
  C. Backblaze: create a B2 account + PRIVATE bucket + app key; note the S3
     endpoint.
  D. GitHub repo → Settings → Secrets and variables → Actions: add the 8
     secrets (R2_* and B2_*), plus optional SUPABASE_URL /
     SUPABASE_SERVICE_ROLE_KEY for the DB index manifest.
  E. GitHub → Actions → "Nightly media backup" → Run workflow (first run),
     confirm green. After that it runs nightly (~1am PT).
Design notes: uses `rclone copy` (NEVER deletes on B2, so a hard-delete in R2
can't propagate); manifest step no-ops safely if SUPABASE_* aren't set.

ALSO P0 (item #3): confirm Supabase PITR / daily backups are enabled in the
Supabase dashboard (plan-dependent). The DB is the only index to R2's opaque
keys — the manifest above is a belt-and-suspenders backup of that index.

================================================================
2. OPEN TO-DO LIST (priority order — we were going top to bottom)
================================================================
1. [DONE] Go live. (verify write-up on a real client when convenient)
2. [CODE DONE / SETUP PENDING] Off-site media backup — see section 1.
3. [PENDING - Josh] Confirm Supabase PITR/backups enabled.
4. [CODE - not started] Soft-delete instead of hard-delete. Today
   lib/r2.js deleteFile() + lib/mediaOrganize.js hard-DeleteObject on admin
   "Empty Trash", single delete, and character retake. Change to move objects to
   a deleted/ prefix with a 30-90 day lifecycle expiry so a mis-click can't
   permanently lose photos.
5. [CODE - not started] Upload reconciliation sweep. Two-step upload can leave
   an R2 object with no studio_media row (silently vanishes from view). Add an
   admin/cron sweep: list R2 under studio/{clientId}/, find objects with no
   matching r2_key, re-attach or report. Doubles as an orphan check.
6. [CODE - not started] Montage re-archive safety. Delivered montages can vanish
   ~30 days out if the R2 archive step failed. Add a re-archive job + an
   "unarchived" alert.
7. [CODE - not started] Login hardening. Portal passwords are lastname+MMDD
   (guessable); /api/portal/login has no rate limiting. Add rate limiting/lockout
   and let clients set a stronger password.
8. [DECISION] Character Builder as a product + pricing (Josh floated
   $0.99/download). Product review is in AUDIT-2026-07-26.md; needs a direction
   decision, then build.
9. [FEATURE - not started] MULTI-CHARACTER BUILD. A project can have several
   people who each need a character; today the system assumes one per client
   (single __character_build__ folder, slots 1-12). Change to:
   - a roster on the Character Build box showing each person + progress
     (e.g. "Mom 12/12", "Emma 5/12"), continue/retake each;
   - a "Build another character" button that starts a new person;
   - REQUIRE a subject name per character AT BUILD TIME (client enters it when
     starting each person) — this replaces the admin-only "Subject name for the
     sheet" field (which becomes an optional override). The name prints on that
     character's sheet;
   - ONE build sheet per character (not per project); move the write-up cache
     (008 columns) to be per-character.
   - 9b. Add a clear "Return to photo upload" button in the Character Build UI
     — the X to exit is too hard to find.
   Touches: characterPoses/folder model (namespace shots per character, e.g. a
   studio_characters table or a character_id/sub-folder), CharacterCapture.jsx,
   app/api/portal/character/route.js, lib/characterSheet.js (per-character),
   app/api/admin/character-sheet + admin page, lib/email.js, and the 008 cache.
10.[FEATURE - not started] Admin "View timeline". No admin-native timeline view
   today; only "Copy portal link" → open the client's portal. Add a read-only
   timeline preview in admin so Josh can review the arrangement BEFORE exporting
   a montage. Reuse lib/clientTimeline.js / the media GET ordering.

================================================================
3. STANDING ITEMS
================================================================
- Weekly scheduled task reminds Josh to check the Anthropic API balance
  (console.anthropic.com/settings/billing); $5 prepaid, no auto-reload.
- Commit/push flow: repo is edited via the Cowork device mount; commits need the
  trailers (Co-Authored-By: Claude Opus 4.8; Claude-Session). Sandbox + device
  have no network for git push — Josh pushes from his Mac.
