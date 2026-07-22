# DEPLOY — Montage spine v1

The pipeline: admin picks client → Generate → Creatomate renders a
Hollywood-style montage from the client's uploaded photos (folder + numbering
order) → webhook archives the MP4 to R2 → preview/download in admin.
One style for now; more styles are add-ons later, not rebuilds.

## 1. Run the migration

Supabase SQL Editor → paste `sql/003_montages.sql` → run. Creates
`studio_montages` only. Verify query at the bottom should show `service_role`.

## 2. Add ONE env var in Vercel (studio-portal)

| Var | Value |
|---|---|
| `CREATOMATE_API_KEY` | The same API key MEvid uses. Vercel hides MEvid's saved value, so copy it from the **Creatomate dashboard → Project settings → API keys**. |

(Everything else it needs — `NEXT_PUBLIC_SITE_URL`, R2 vars — is already set.)
Then **push + deploy** (env changes need a fresh deployment).

## 3. Test run (the Dylan drill)

1. In `/admin`, create a test client (e.g. "Dylan Test", any email you own).
2. Log into the portal as that client and drag the 30 Dylan stills into the
   uploader (numbered files = the order; folders become chapters later).
3. Back in `/admin` → **Generate montage** → pick the client, Title `DYLAN`,
   Subtitle `A Bat Mitzvah Story`, watermark ON → Generate.
4. Status shows in the Renders list (use Refresh). A ~30-photo montage is
   ~2 minutes of video; rendering typically takes minutes — **verify actual
   time and credit burn on this first render.**
5. When Ready: preview plays inline, Download gets the MP4. If it says "not
   yet archived," the R2 copy didn't fit the webhook window — the download
   still works (Creatomate hosts it ~30 days); grab it and tell me so I can
   move archiving to a retry button.

## What was built

- `sql/003_montages.sql` — render tracking table.
- `lib/creatomate.js` — API client (pattern copied from MEvid's working code).
- `lib/montage.js` — the Hollywood style: gold-on-black title cards, Ken Burns
  push-ins, fade-through transitions, optional logo watermark, closing card.
- `app/api/admin/montage/route.js` — Generate + list (admin-gated).
- `app/api/webhooks/creatomate/route.js` — verified-by-refetch webhook
  (Creatomate doesn't sign calls; we re-fetch the render by id, same as MEvid),
  archives MP4 to `studio/{client}/montages/`.
- `app/admin/page.js` — Generate montage panel + Renders list.
- `lib/r2.js` — added `putFile` for the archive step.

## Honest flags for the first render

- Every Creatomate construct here is copied from MEvid's **working** render
  code — but this particular composition hasn't rendered yet. First-render
  tweaks (title sizing, zoom feel, watermark placement/opacity) are expected
  and cheap. That's the point of the Dylan drill.
- Credit cost: ~14 credits/min at 720p per their docs; this renders at 1080p
  so expect roughly 2–3× that per minute — **estimate, check the dashboard
  after the test.** Credits come from the shared MEvid pool.
- Spine scope: photos only (videos excluded), one style, no chapter cards, no
  per-chapter renders, no music, no beat sync, no client-facing button, cap of
  100 photos. All deliberate — they're the next layers, per MONTAGE-PLAN.md.
- Delivery to the client stays manual for now: download the MP4, sculpt if
  you want, send through "Send a cut."
