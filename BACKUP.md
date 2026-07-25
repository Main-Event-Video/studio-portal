# Client media backup — setup

Two layers protect client photos/videos:

1. **R2 object versioning** (in Cloudflare) — makes accidental deletes/overwrites
   recoverable *within* R2.
2. **Nightly off-site copy to Backblaze B2** (this repo's GitHub Action) — an
   independent copy in a different provider, so even a lost Cloudflare account
   can't lose the media. Uses `rclone copy` (never deletes on the B2 side).

The automation (`.github/workflows/backup-media.yml`) is already in the repo.
It stays dormant until the secrets below exist. Do these once.

---

## A. Turn on R2 versioning (Cloudflare)  ~2 min
1. Cloudflare dashboard → **R2** → your media bucket → **Settings**.
2. Enable **Object versioning** (a.k.a. bucket versioning).
3. Add a **lifecycle / object-lifecycle rule** to delete *noncurrent* versions
   after ~60–90 days (keeps the undo window without growing forever).

## B. Create the R2 read credential (Cloudflare)
1. R2 → **Manage R2 API Tokens** → **Create API token**.
2. Permission: **Object Read** (read-only is enough for backup).
3. Save the **Access Key ID**, **Secret Access Key**, and your **Account ID**,
   and the **bucket name**.

## C. Create the Backblaze B2 destination
1. Sign up at backblaze.com → **B2 Cloud Storage**.
2. Create a **private** bucket (e.g. `mes-media-backup`).
3. Note the bucket's **S3 endpoint** (Bucket details → e.g.
   `s3.us-west-004.backblazeb2.com`).
4. **App Keys → Add a New Application Key**, scoped to that bucket. Save the
   **keyID** and **applicationKey**.

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
| `B2_S3_ENDPOINT` | e.g. `https://s3.us-west-004.backblazeb2.com` |
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
