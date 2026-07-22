# MAIN EVENT STUDIO — CLIENT PORTAL
## Handoff #3 (paste this into the next chat)
Prepared: Jul 22, 2026 · Owner: Josh Dolberg
Read ALONGSIDE HANDOFF-2 and MONTAGE-PLAN.md. Supersedes the admin-layout
parts of both; everything else in them still stands.

---
# 1. FIRST ORDER OF BUSINESS (Josh's spec, do this before anything else)

**Restructure `/admin` into a client-centric accordion.**

- At the top: ONLY the **New client** panel.
- Below it: the **Clients list**. No standalone "Send a cut" or "Generate
  montage" panels at the top of the page anymore.
- Each client row toggles open/closed. Clicking **Montage** on a client opens
  the montage generator INLINE, directly below that client's row. Clicking
  **Send cut** opens the delivery form inline below the row the same way.
- Name/title auto-fills from the client but everything stays editable.
- Renders for a client live inside that client's opened section.

All the logic already exists (see §3 file map) — this is a LAYOUT refactor of
`app/admin/page.js`, moving the two panels into per-row expandable sections.
The shared `pickClient()` selection pattern from this session is halfway there.
Consider whether a `/admin/client/[id]` detail page is cleaner than an
accordion if the page keeps growing — Josh hasn't decided; accordion is the ask.

---
# 2. WHAT SHIPPED THIS SESSION (all deployed and live)

## Portal combining (Phase 1 complete)
- **Email + password login** at the portal root (additive; private links still work).
- **Intake questionnaire** as a third hub door, prefilled, re-editable
  (`studio_intake` table, notification email to Josh on submit).
- **Step 6 delivery flow**: admin uploads a cut → R2 → records media → emails
  client (Postmark; `POSTMARK_API_TOKEN`, from/reply-to `info@maineventstudio.com`).
- **Squarespace**: "Client Portal" nav link live on maineventstudio.com
  (link-field gotcha: paste the URL and VERIFY it saved — it once saved as
  `https://h`).
- Docs: DEPLOY-STEP-6.md.

## Montage pipeline (new — the big one)
- Admin generates a montage from a client's uploaded photos (folder + number
  order, images only, cap 100). Creatomate renders in the cloud; webhook +
  fallback archive the MP4 into R2 (`studio/{client}/montages/`).
- **Styles dropdown**: hollywood / timeless / party (in `lib/montage.js`
  STYLES). Tilted-cards + duotone from the samples are NOT ported (rotation
  fails in Creatomate; duotone unverified).
- **Seconds-per-photo** control (1–10 or style default); transitions clamp to
  40% of hold.
- **Title cards hard-cut** to/from photos (Josh replaces cards in his edit).
- **Framing fixes**: per-photo dropdown (show top/bottom/left/right) via
  thumbnail grid on ready renders → re-render. Picks auto-save to the row
  (refresh-proof). "Show top" shifts 13%; effectiveness depends on photo
  aspect (portrait shots have the most recovery room).
- **Deterrent watermark**: `public/watermark.png` (outlined MAIN EVENT STUDIO,
  translucent), centered at 62% × 6.9%, 42% opacity on drafts. The height MUST
  stay explicit — width-only made Creatomate cover-crop it into giant letters.
- **Collapsed previews** ("Show preview" per render), render rows show recipe
  (style · pace · photo count), sticky Generate form (localStorage).
- **Per-client buttons** (Montage / Send cut) on client rows arm the panels —
  §1 replaces this with inline accordion.
- Docs: DEPLOY-MONTAGE.md, MONTAGE-PLAN.md (full roadmap: chapter cards, wall
  ender, per-chapter renders, beat sync, AI cutouts, mosaic/stomp effects).

## Infra deltas
- Vercel env added: `CREATOMATE_API_KEY` (from Creatomate → Project Settings →
  API Key; shared account/credit pool with MEvid, "Default Project").
- SQL run: 002 (intake), 003 (studio_montages), 004 (params jsonb).
- Creatomate: webhook URL field left EMPTY on purpose (we pass per-render).

---
# 3. FILE MAP (montage system)

| File | What |
|---|---|
| `lib/montage.js` | STYLES + source builder (cards, Ken Burns, transitions, framing offsets, watermark) |
| `lib/creatomate.js` | API client (POST /v1/renders, GET render; pattern copied from MEvid) |
| `app/api/admin/montage/route.js` | POST generate / GET list (with presigned URLs) |
| `app/api/admin/montage/sync/route.js` | "Check status" fallback — polls Creatomate, archives, flips status |
| `app/api/admin/montage/photos/route.js` | thumbnail strip for framing UI |
| `app/api/admin/montage/adjust/route.js` | auto-saves framing picks to params |
| `app/api/webhooks/creatomate/route.js` | webhook (verify-by-refetch) — **currently not landing, see §4** |
| `public/watermark.png` | deterrent wordmark asset |

---
# 4. OPEN BUGS / VERIFY NEXT SESSION

1. **Webhook never updates rows.** Renders succeed on Creatomate but
   `studio_montages` stays "rendering" until Check status is clicked. Post-
   mortem: check Vercel → Logs for `/api/webhooks/creatomate` around a render
   completion. No entries = Creatomate isn't calling / can't reach; entries
   with errors = fix handler. Non-fatal (sync button covers it) but renders
   should finish themselves.
2. **First full end-to-end tests still outstanding**: intake submit email,
   Send-a-cut email + client View door, client guide revision (HANDOFF-2 §8).
3. **Uploader's misleading "Network error during upload"** (HANDOFF-2 §5.11) —
   still unfixed.
4. **MEvid repo has 3 local commits never pushed** (seen in GitHub Desktop).
   Josh's call, separate from Studio.

## Verified numbers (from the first real renders)
- ~31-photo 1080p montage = **55.99 credits**. Account: 2,000 credits/mo
  (plan $ unverified — check Creatomate billing). ≈35 montages/mo shared
  with MEvid. Renders take single-digit minutes.

## Verified Creatomate constraints (from MEvid code + this session)
- Transition = animation on the SECOND same-track element, `transition:true`
  (types used: fade, slide, circular-wipe, scale).
- Motion via keyframes on x/y/x_scale/y_scale/opacity. **z_rotation fails.**
  Easing on the FIRST keyframe. Explicit tracks everywhere.
- Images: give width AND height or cover-crop will surprise you.
- Webhooks are unsigned → always verify by re-fetching the render by id.
- Renders auto-delete after ~30 days → always archive to R2.

---
# 5. WORKFLOW LESSONS (git kept biting)

- Stale `.git/index.lock` blocked commits twice. Fix: quit GitHub Desktop /
  editors, `rm -f .git/index.lock`, then add/commit/push. A terminal stuck in
  a pager/editor ate a whole session of pasted commands once — if commands
  echo with no output, quit Terminal and start fresh.
- studio-portal is now added to GitHub Desktop (commit there works fine —
  message goes in the small "Summary (required)" box).
- After every deploy, HARD refresh `/admin` (Cmd-Shift-R) before judging
  whether a UI change "worked."

---
# 6. FIRST PROMPT SUGGESTION FOR NEXT CHAT

"Read HANDOFF-3. Do §1 first — rebuild /admin as the client-centric accordion
exactly as specced. Then let's post-mortem the Creatomate webhook (§4.1)."

Roadmap after that, in Josh-priority order: style tuning from real renders →
chapter cards from folder names → mosaic wall ender → remaining styles →
client-facing polish (guide revision, uploader error message).
