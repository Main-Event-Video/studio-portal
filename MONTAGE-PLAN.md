# AUTO-MONTAGE — the morning report
Prepared overnight · Jul 21, 2026 · for Josh

**The short version: yes, this is buildable, and most of the hard parts are
already solved by things you own.** Clients upload numbered photos into the
portal (built). You pick one of six house styles. The system assembles a
full-motion montage — title cards, chapter cards from their folder names, Ken
Burns motion, style-matched transitions and grading — and drops it in your
admin for review. You sculpt to music, add AI moments, deliver through step 6
(built). I rendered three working samples overnight to prove the motion
language; they're in the files I've attached.

---

## 1. Watch the samples first

Three silent ~12–19s proofs, rendered tonight from generated placeholder
frames (no client photos existed to use). They demonstrate pacing, motion,
transitions, titles, and grade per style — imagine real photos in the frames:

| File | Style | What to notice |
|---|---|---|
| `sample_1_timeless_wedding.mp4` | **Timeless** (wedding) | 2.35:1 letterbox, serif title card, slow alternating Ken Burns, 1.2s dissolves, muted grade, film grain |
| `sample_2_mainevent_party.mp4` | **Main Event** (bar mitzvah) | fast 1.6s cuts, punchy zooms, slide/circle/slice transitions, saturated color, neon title |
| `sample_3_hollywood_premiere.mp4` | **Hollywood** (your brand) | fade-through-black, spotlight look, gold serif titles, vignette + grain, slow push-ins |

They're silent **by design** — you lay music. Important honesty note: these
were rendered with ffmpeg on my sandbox, not Creatomate, so they prove the
*look is achievable from stills automatically* — they are not Creatomate
output. The production system would reproduce these styles as Creatomate
templates (or via the ffmpeg path in §3).

---

## 2. How it works — the pipeline

Everything rides on what the portal already does. Clients already upload
**numbered photos in folders**, and the DB already stores `sort_number` +
`folder_path` per file. That's a storyboard. We just haven't been treating it
as one.

```
client uploads (numbered, foldered)  ──►  R2 + studio_media   [BUILT]
        │
admin: pick client → pick style → names/date → Generate
        │
server route builds a render job:
  photos in folder order → slots in the style template
  folder names → chapter title cards ("Joey as a baby" becomes a card)
  client name/date → opening title card
        │
render service (Creatomate) renders in the cloud   [nothing heavy on Vercel]
        │
webhook → copy MP4 into R2 → row in studio_media / studio_montages
        │
you review in admin → download, sculpt to music, insert AI moments
        │
deliver the final through step 6 (upload → email → client View door) [BUILT]
```

**The killer feature is chapters.** "001–100 Joey as a baby" isn't just
ordering — it's the client telling you the story structure. Each folder
becomes a chapter: its own title card, its photos in their order. The client
authored their own edit and didn't know it.

**The "80%, then sculpt" contract.** The system gives you, per generation:
1. the full montage MP4,
2. optionally **one MP4 per chapter** — so in your NLE you re-time chapters to
   the music and splice AI moments *between* chapters without re-cutting
   inside them,
3. a **cut sheet** (CSV: photo, chapter, in-point, duration) so you always
   know where everything landed.

**Watermarking solves itself here.** Auto-generated drafts never pass through
your editor, so your burn-it-in-on-export rule can't apply. Instead each
template gets a logo-overlay layer that's ON for drafts and OFF for finals —
the render itself carries the watermark. (Verify placement/opacity taste on
the first real render.)

## 3. Engine: Creatomate first, ffmpeg in reserve

**Recommendation: Creatomate.** You already have an account (MEvid), it's
API-driven, templates are built once in their visual editor and then filled
per client, rendering happens on their servers (nothing melts Vercel Hobby),
and it does image slots, Ken Burns-style animation, transitions, text layers,
and an audio track. Verified from their live docs tonight:

- Credit math (their pricing FAQ): **1 minute of 720p/25fps video ≈ 14
  credits**; cost scales with resolution/frame rate/length. A 5-minute 1080p
  montage ≈ **roughly 190 credits by my extrapolation — estimate, verify
  against their credit docs before budgeting.** Growth (10,000 credits/mo)
  would cover ~50 such montages/mo by that estimate.
- **Renders are auto-deleted after 30 days** (verified) — the webhook must
  copy finished files into your R2 immediately. The plan does this.
- Dollar prices didn't render on the pricing page I fetched; **plan cost and
  which plan you're on: verify in your dashboard.** Also verify which plan
  tier your current MEvid subscription is, since credits are shared.

**Alternative held in reserve: a self-hosted ffmpeg worker** (a $5–10/mo
Railway/Fly box running exactly what produced tonight's samples). Zero
per-render fees, total creative control, but more code to own, no visual
template editor, and slower iteration. If Creatomate credits ever become the
expensive line item, this is the escape hatch — tonight proves the look
survives the switch. (Other SaaS options exist — Shotstack, JSON2Video — but
none beats "you already have Creatomate.")

One caution carried over from the Phase 2 notes: Studio and MEvid would share
the Creatomate account; renders draw from the same credit pool. Fine to
start; separate later if volumes grow.

## 4. The six-style bank

Names are working titles — rename to taste. Three exist as samples; three are
specced and follow the same recipe.

| # | Style | Occasion | Pacing | Motion & transitions | Grade / type |
|---|---|---|---|---|---|
| 1 | **Timeless** | weddings, anniversaries | ~3.5s/photo | slow alternating Ken Burns, 1.2s dissolves | ivory letterbox, muted warmth, tracked serif |
| 2 | **Main Event** | bar/bat mitzvahs, parties | ~1.6s/photo | punch zooms, slides/circle/slice mix | saturated, neon glow titles, bold sans |
| 3 | **Hollywood** | sweet sixteens, galas, your signature | ~3.6s/photo | slow push-ins, fade-through-black | near-black + gold, spotlight, vignette, grain |
| 4 | **Modern Editorial** | engagements, corporate | ~2.8s/photo | flat pans, hard cuts + occasional white flash | white space, clean sans, photo-on-canvas framing |
| 5 | **Retro Reel** | milestone birthdays, "through the years" | ~2.5s/photo | gentle wobble/zoom, light-leak dissolves | super-8 warmth, heavy grain, rounded captions |
| 6 | **MVP** | sports-theme mitzvahs | ~1.4s/photo | slam zooms, whip-slide transitions | gritty contrast, scoreboard-style chapter cards |

Every style ships with: opening title card (names + date), chapter cards from
folder names, closing card (your logo — free branding on every video), the
draft watermark layer, and a per-style music-tempo note (e.g. Timeless ≈
70–90 BPM ballads; Main Event ≈ 120+ BPM).

## 5. Music

- **v1 (ship it):** you add music in the NLE — your stated preference. The
  per-chapter renders + cut sheet make re-timing painless. Optionally clients
  name song choices in the intake form (there's already a field).
- **v2 (worth testing later):** beat-synced cuts. Creatomate has **no beat
  detection** (honest limit). But a small script (librosa) can extract beat
  timestamps from a track you upload and feed cut times into the render job —
  photos land on the beat. Real, but experimental; don't block v1 on it.

## 6. What gets built (in the portal)

- `sql/003_montages.sql` — `studio_montages` table: client_id, style, status
  (queued/rendering/ready/failed), render_id, r2_key, params jsonb, timestamps.
- `lib/render.js` — builds the job from `studio_media` order + style + names;
  submits to Creatomate; ~150 lines.
- `app/api/admin/montage/route.js` — Generate button's endpoint (admin-gated,
  same `requireAdmin` pattern).
- `app/api/webhooks/render/route.js` — receives completion, streams MP4 into
  R2 (30-day deletion defense), updates status. Needs a shared-secret check.
- Admin panel section — client picker, style picker (with thumbnail per
  style), names/date fields, chapter-cards toggle, per-chapter-renders toggle,
  status list with preview + "send as rough cut" (reuses step 6).
- Env: `CREATOMATE_API_KEY` (+ webhook secret). **Copy the exact var name from
  MEvid's Creatomate code — paste me `lib/creatomate.js` (or equivalent) same
  as we did for email.**

Phases:
1. **Prove it end-to-end (1 session):** one style (Hollywood — it's the
   brand), full chain from Generate to admin preview. Needs ~30 test photos
   in 2–3 folders.
2. **The bank (1–2 sessions):** remaining five styles as templates; chapter
   cards; style thumbnails in admin.
3. **Polish (later):** client-facing "pick your vibe" in the portal (can
   default from their intake vibe checkboxes — the data's already collected),
   per-chapter renders, beat-sync experiment.

## 7. Honest limits (read before getting excited)

- **Auto-generation composes; it doesn't *curate*.** It won't notice a photo
  is blurry, duplicated, or emotionally the wrong closer. The client's
  numbering is the taste layer, and you're the safety net. That's exactly the
  80/20 you asked for.
- **Faces:** default crops center; a face-aware crop pass is possible later
  (free libraries) but not in v1 — expect the occasional awkward crop on
  extreme portraits in v1.
- **AI moments stay yours.** Nothing here generates scenes; the per-chapter
  workflow just leaves clean seams to splice them into.
- **Needs verification before building:** your Creatomate plan/credits and the
  exact per-render cost at your chosen resolution; the exact API field names
  (their docs pages for the REST endpoint redirected tonight — confirm at
  build time); watermark layer look on real photos.
- Sample videos = ffmpeg proofs of the *style language*, not Creatomate
  output. Real photos will look dramatically better than my placeholder art.

## 8a. Addendum: "Envato-style" accent effects (added after Josh's references)

Josh asked whether we can match AE-template effects: mosaic photo stomps,
cinematic parallax slideshows, mosaic grid transitions, freeze-frame subject
pop-outs. Proof rendered in `sample_4_effects_reel.mp4` (stomp burst → mosaic
grid zoom-out → freeze-frame pop-out mock). Capability tiers:

- **Tier 1 — no new infrastructure** (Creatomate templates or our renderer):
  stomp bursts with flash frames, mosaic grid assemble/zoom transitions, logo
  reveals built from photo walls, punch zooms, whip transitions, light-leak /
  dust / grain overlays, film looks. This is timing + layers, all automatable.
  Stomps only truly *hit* when synced to beats → pairs with the beat-detection
  phase (librosa) in §5.
- **Tier 2 — needs AI subject cutouts (the one new ingredient):** freeze-frame
  pop-outs (person bursts out of a greyed, shrunken frame with stroke +
  shadow) and true 2.5D parallax (subject and background drift at different
  depths, "The Memories" style). Unlock = background-removal AI (open-source
  `rembg`/U2-Net class models on a small worker, or a per-image API — pennies
  per photo; **verify current per-image pricing before relying on it**). Once
  each photo is split into subject + background layers, these effects are
  plain compositing. Quality caveat: cutout quality varies with photo
  (busy backgrounds, group shots); design pop-outs as *accent moments* — one
  per chapter opener, honoree photos only — not every frame. That restraint is
  also what reads as high-end.
- **Mosaic wall ender (proven in `sample_5_mosaic_wall_ender.mp4`):** camera
  pulls back from a single photo to a wall of ALL the client's photos (tiles
  repeat if needed), which then resolves into the honoree's NAME (bulletproof
  — works with any photo set) or a PORTRAIT of the honoree/couple (classic
  photomosaic: each tile placed where its color matches a chosen target photo,
  plus a ~50% blend so the portrait reads; needs a decent variety of photo
  colors to look great). Fully automatic: the wall builds itself from the
  portal uploads. Logo variant = same trick targeting the MES logo, free
  outro branding on every delivery.
- **Not automatable here (honest line):** glitch-heavy AE typography systems
  and hand-keyframed character animation at Envato-preview fidelity. Those
  remain your AE/manual layer — or you buy the template and use it manually
  for hero moments.

## 8. What I need from you to start

1. Paste **MEvid's Creatomate lib file** (env var name + call pattern).
2. Pick the **first style** to build (I vote Hollywood) and bless/rename the
   six names.
3. A **test batch of real photos** (any past event, 2–3 folders, numbered) —
   uploaded through a test client so the whole chain runs on real data.
4. Answers when convenient: typical montage length (I assumed 3–6 min), and
   whether clients see the style picker or it stays admin-only at first.
