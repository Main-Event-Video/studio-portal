MAIN EVENT STUDIO — CLIENT PORTAL
Handoff #9 (paste this into the next chat)
Prepared: Jul 25, 2026 · Owner: Josh Dolberg
Read AFTER HANDOFF-8. This session was almost entirely about the Character Build
feature: fixing it end-to-end, making it multi-character, and polishing the
capture UX — plus a private admin "Details" sheet and questionnaire additions.

================================================================
0. REPO / DEPLOY STATE (as of this handoff)
================================================================
* Branch main == origin/main. Everything below is COMMITTED and PUSHED.
* Latest commit: 9a4eb4c. Vercel auto-deploys on push.
* Remote: https://github.com/Main-Event-Video/studio-portal (HTTPS PAT "MEV Deploy";
  it now has the `workflow` scope, so pushes that touch .github/workflows work).
* THREE SQL migrations were added this session and MUST be run in Supabase SQL
  Editor if not already (all additive / safe, "add column if not exists"):
    - sql/009_multi_character.sql   → studio_characters table + backfill (REQUIRED
                                       for the whole multi-character feature)
    - sql/010_admin_info.sql        → studio_clients.admin_info + studio_intake
                                       dj_contact / planner_contact
    - sql/011_character_soft_delete.sql → studio_characters.deleted_at
  If the questionnaire fails to save, or the Details save / character Delete
  errors, it means one of these hasn't been run yet.
* DEPLOY GOTCHA (keep): next.config.mjs sets
  experimental.serverComponentsExternalPackages: ['@resvg/resvg-js'].
  Without it, `next build` fails trying to bundle resvg's native .node binary.
* Build fonts: public/fonts/DejaVuSans*.ttf are vendored and loaded at runtime
  by the sheet renderer. Do not delete them.

================================================================
1. WHAT SHIPPED THIS SESSION
================================================================
CHARACTER WRITE-UP — now actually works (was the "profile did not work" bug):
* Model claude-3-5-sonnet-latest was RETIRED 2025-10-28 → now `claude-sonnet-5`
  (lib/characterProfile.js; override with ANTHROPIC_MODEL env).
* The whole sheet's text rendered as ".notdef" tofu boxes on Vercel (no system
  fonts). Sheet text now renders with @resvg/resvg-js + bundled DejaVu fonts,
  then sharp composites the photo thumbnails/logo on top. (lib/characterSheet.js)

CHARACTER SHEET polish:
* Thumbnails use fit:'contain' (no more cropped heads/feet).
* Completion email goes to josh@maineventstudio.com (override: CHARACTER_SHEET_EMAIL).
* Profile-panel fallback text is now client-safe.

POSE CAPTURE (app/p/[token]/upload/CharacterCapture.jsx):
* Fixed the left/right OVERLAY flip — the 4 directional face overlays were
  mirror-swapped vs their "their left/right" labels. (lib/characterPoses.js)
* Added a small animated 3D "how to move" figure in the red instruction box that
  loops front→pose→front, from the camera's POV. Angles: 3/4 = 40° (a quarter
  turn), profile = 80°, top-of-head = rotateX(-72) (looks DOWN). Direction arrows
  on the figure: → / ← for left/right turns, ↻ (circular) for body-back.
* On-camera pose name + hint moved into a red-bordered box so they pop.
* Intro instruction list trimmed 10 → 6 lines.
* "‹ Photos" return button in the header (9b).

MULTI-CHARACTER BUILD (#9 — DONE):
* studio_characters table (sql/009). Each character's 12 shots live under a
  reserved folder: '__character_build__' (first/legacy) or
  '__character_build__::<id>' (additional). Name + AI write-up cache moved to the
  character row. Legacy single characters auto-backfilled.
* Client flow: photo-drop page shows a ROSTER (name + progress, continue/retake),
  "＋ Build another character", and a required "Whose character is this?" name
  step. Per-character QR desktop→phone handoff.
* Admin: "Character builds" tab lists each character with a "Download sheet"
  button beside the name (+ "fresh write-up" toggle to force regeneration). The
  old "Subject name" field is gone.
* Client can now VIEW their own sheet (GET /api/portal/character-sheet, uses the
  cached write-up so no API cost) via "See your character sheet ↗" on the roster.
* Client can SOFT-DELETE a build ("Delete" on the roster; sql/011 deleted_at).
  It's hidden from the roster but the row + R2 photos are kept — recoverable by
  clearing deleted_at. THIS IS THE CHARACTER-SCOPED SLICE OF #4 (see open items).
* Character shots are excluded from the album list + play-order timeline + montage
  everywhere (folderBoxes, serverBoxes merge, and buildTimeline seeding all use
  isCharacterFolder / isExcludedFolder). A stray studio_boxes row for a character
  folder is now just hidden (harmless; can be deleted in SQL if you want tidy).

ADMIN "DETAILS" SHEET (new, private per-client):
* New "Details" tab per client → a form (white bg / black text) with: Client
  Name, Honoree(s), Instructing Party, Event Date/Type, Address, Billing Address,
  Contract Amount/Deposit/Outstanding + paid dates + balance due date, Contract
  Details, Contract-in-portal, Portal Link, Portal PW, Image Use/Opt-Out, DJ,
  Venue, Planner, Referral / how-heard, Referral code, Special Details, Notes.
* Auto-filled: Client Name, Event Date/Type, Portal Link, Portal PW (derived
  lastname+MMDD). Saved to studio_clients.admin_info (jsonb, sql/010). Never
  shown to clients.
* "⬇ Export details (CSV)" button by the Clients heading → all clients' sheets.

QUESTIONNAIRE:
* Added DJ (name & contact) and Planner (name & contact) fields (Venue already
  existed). Stored on studio_intake (sql/010 columns) and shown in the admin
  Intake tab. (Intake.jsx, portal/intake route, admin INTAKE_SECTIONS)

COPY:
* Portal home upload tile → "Upload your photos, video & build your character here".
* Order/timeline mobile copy clarified: turn phone sideways, videos ARE shown (▶),
  and "first tap the photo, then tap where it should go".

================================================================
2. OPEN TO-DO LIST (priority order — continue top to bottom)
================================================================
P0 DATA SAFETY (Josh actions, still pending):
  * [#2 SETUP] Off-site media backup is code-done but DORMANT until the BACKUP.md
    one-time setup is done (Cloudflare R2 versioning + read-only token; Backblaze
    B2 private bucket + key; 8 GitHub Actions secrets; first manual workflow run).
    NOTE: the backup-media.yml workflow can now be pushed (PAT has workflow scope).
  * [#3 PENDING] Confirm Supabase PITR / daily backups are enabled.

CODE (not started unless noted):
  4. Soft-delete instead of hard-delete — PARTIAL. Character builds now soft-delete
     (recoverable). STILL hard-delete: admin "Empty Trash", single delete, and
     character-slot RETAKE (lib/r2.js deleteFile + lib/mediaOrganize.js + the
     retake path in app/api/portal/character/route.js). Finish by moving those to
     a deleted/ prefix with a lifecycle expiry.
  5. Upload reconciliation sweep. Two-step upload can leave an R2 object with no
     studio_media row (silently vanishes). Add an admin/cron sweep over
     studio/{clientId}/ that finds orphans and re-attaches or reports.
  6. Montage re-archive safety. Delivered montages can vanish ~30 days out if the
     R2 archive step failed. Add a re-archive job + an "unarchived" alert.
  7. Login hardening. Portal passwords are lastname+MMDD (guessable); /api/portal/
     login has no rate limiting. Add rate limiting/lockout + let clients set a
     stronger password. (NOTE: the admin Details sheet auto-fills Portal PW from
     the lastname+MMDD formula — if you add custom passwords, revisit that.)
  8. [DECISION] Character Builder as a product + pricing ($0.99/download floated).
     See AUDIT-2026-07-26.md. Needs a direction decision, then build.
 10. Admin "View timeline" — a read-only in-admin preview of the client's
     arrangement before exporting a montage (reuse lib/clientTimeline.js).

SMALL FOLLOW-UPS (nice-to-have):
  * Client-side RENAME of a character. The API supports action:'rename' but there's
    no client UI. The backfilled legacy character keeps the PROJECT name until
    renamed. Easy add: a pencil/rename control on the roster row.
  * Optional: delete the stray studio_boxes row(s) whose name starts with
    '__character_build__' (only cosmetic; already hidden).

JOSH'S NEXT TASK: building refined montage templates for current projects.

================================================================
3. STANDING ITEMS / FLOW
================================================================
* Anthropic: $5 prepaid, NO auto-reload (console.anthropic.com/settings/billing).
  Write-up model = claude-sonnet-5, generated ONCE per character and cached, so
  everyday downloads are free; only "fresh write-up" re-bills. Watch the balance.
* Commit/push flow: the repo is edited via the Cowork device mount. The sandbox +
  the device VM have NO network for `git push` — Josh pushes from his Mac terminal.
  Commits need the trailers (Co-Authored-By: Claude Opus 4.8; Claude-Session).
  If a `git push` is ever rejected for a workflow file, the PAT needs the
  `workflow` scope (already added). If git complains about a stale lock, run
  `rm -f .git/HEAD.lock .git/index.lock` then retry.
* Weekly scheduled reminder still checks the Anthropic API balance.
