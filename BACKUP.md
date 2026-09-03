# Client media backup

## Current state — 3 September 2026

| | |
|---|---|
| Source | Cloudflare R2 bucket `mev-videos` |
| Backup | Backblaze B2 bucket `mes-media-backup` (private, encrypted, `s3.us-east-005.backblazeb2.com`) |
| First successful run | 3 Sep 2026 — 3,769 files, 37.3 GB, 8m 16s |
| Nightly copy | 09:00 UTC (~1–2am PT) |
| Monthly verify | 11:00 UTC on the 1st |
| Cost | roughly $0.22/month of B2 storage at this size; R2 egress to B2 is free |

**Known gap:** R2 object versioning is *not* enabled — the option was not present
in the bucket's Settings when this was set up (step A below). That means there is
no undo layer *inside* R2. The B2 copy is currently the only safety net, and
because `rclone copy` never deletes, a file removed from R2 does survive in B2.
Worth revisiting if Cloudflare exposes versioning on this bucket.

---

Two layers are meant to protect client photos/videos:

1. **R2 object versioning** (in Cloudflare) — makes accidental deletes/overwrites
   recoverable *within* R2. **Not currently enabled — see the note above.**
2. **Nightly off-site copy to Backblaze B2** (this repo's GitHub Action) — an
   independent copy in a different provider, so even a lost Cloudflare account
   can't lose the media. Uses `rclone copy` (never deletes on the B2 side).

Three workflows do the work:

| Workflow | File | When |
|---|---|---|
| Nightly media backup | `.github/workflows/backup-media.yml` | 09:00 UTC daily |
| Verify backup | `.github/workflows/backup-verify.yml` | 11:00 UTC on the 1st |
| Face detection | `.github/workflows/face-detect.yml` | 10:00 UTC daily |

All three read the same secrets. They stay dormant until those secrets exist —
which is exactly why the nightly backup silently failed 39 times between 4 Aug
and 3 Sep 2026: the repo had no secrets at all, and a workflow that cannot
authenticate still shows up as a failed run nobody was watching.

---

## A. Turn on R2 versioning (Cloudflare)  ~2 min
1. Cloudflare dashboard → **R2** → your media bucket → **Settings**.
2. Enable **Object versioning** (a.k.a. bucket versioning).
3. Add a **lifecycle / object-lifecycle rule** to delete *noncurrent* versions
   after ~60–90 days (keeps the undo window without growing forever).

> As of Sep 2026 this option was not visible on `mev-videos`. Skipped.

## B. Create the R2 read credential (Cloudflare)
1. R2 → **Manage R2 API Tokens** → **Create API token**.
2. Permission: **Object Read** (read-only is enough for backup).
3. Save the **Access Key ID**, **Secret Access Key**, and your **Account ID**,
   and the **bucket name**.

## C. Create the Backblaze B2 destination
1. Sign up at backblaze.com → **B2 Cloud Storage**.
2. Create a **private** bucket (e.g. `mes-media-backup`), encryption enabled.
3. Note the bucket's **S3 endpoint** (Bucket details → e.g.
   `s3.us-east-005.backblazeb2.com`).
4. **App Keys → Add a New Application Key**, scoped to that bucket, Read *and*
   Write. Save the **keyID** and **applicationKey** — Backblaze shows the
   application key exactly once.

## D. Add GitHub repo secrets
Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | from step B |
| `R2_SECRET_ACCESS_KEY` | from step B |
| `R2_BUCKET` | R2 media bucket name |
| `B2_KEY_ID` | Backblaze keyID |
| `B2_APP_KEY` | Backblaze applicationKey |
| `B2_S3_ENDPOINT` | e.g. `https://s3.us-east-005.backblazeb2.com` |
| `B2_BUCKET` | B2 bucket name |

Optional (adds the DB-index manifest to the backup — recommended):

| Secret | Value |
|---|---|
| `SUPABASE_URL` | your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key |

## E. First run
Repo → **Actions** → **Nightly media backup (R2 → Backblaze B2)** →
**Run workflow**. Watch it go green. After that it runs nightly (~1am PT) on its
own, and you can re-run it anytime from that button.

## F. Verifying the backup is actually intact

A green nightly run proves the copy *ran*. It does not prove the copy is
*correct*. `.github/workflows/backup-verify.yml` closes that gap.

**Monthly (automatic, 1st at 11:00 UTC).** Re-lists both sides and compares
every object's size, plus its checksum wherever both providers expose one. R2
and B2 both return the MD5 as the S3 ETag for an object uploaded in a single
part, so most of the library gets a real content comparison. Objects uploaded in
multiple parts — the larger videos — have an ETag that is not an MD5, and those
fall back to a size comparison. Costs listing calls only: pennies, minutes.

**On demand (byte-for-byte).** Actions → **Verify backup (R2 vs B2)** → *Run
workflow* → tick **deep**. This downloads both copies and compares the actual
bytes, so there is no checksum caveat. It reads ~37 GB out of each provider and
takes hours. Run it when you want proof rather than strong evidence — say,
before relying on the backup for a real restore.

Either way the run's **Summary** page shows a table of missing / different /
unreadable counts, and a `backup-verify-report` artifact holds the complete
lists for 90 days. The job is read-only and cannot alter either bucket.

If it fails: re-run the nightly backup by hand, which re-copies anything
missing. If files show as *different* rather than missing, don't assume R2 is
the good side — check the file in the portal first.

## G. Things still worth doing

- **R2 object versioning** — see the note at the top.
- **The R2 bucket has Public Access enabled** with a live `r2.dev` URL. Worth
  confirming that is intentional and that nothing private is reachable through it.
- **B2 grows forever.** `rclone copy` never deletes, which is the safe
  direction, but it means files removed from R2 accumulate in B2 indefinitely.
  At current size that costs almost nothing. Revisit with a lifecycle rule if
  the bucket ever grows out of proportion to R2.
