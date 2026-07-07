# Step 3 — client hub (welcome + upload + viewer)

Unzip this INTO your existing repo folder, overwriting when asked. It adds new
files and replaces two you already have (`package.json`, `app/globals.css`) with
updated versions.

## What's inside
- `app/p/[token]/page.js` — welcome hub: private link → password → two doors
- `app/p/[token]/PasswordGate.jsx` — the password screen
- `app/p/[token]/upload/…` — "Upload your photos and videos here" (drag + drop → R2)
- `app/p/[token]/view/…` — "Take a look at what we sent you" (rough cuts + finals)
- `app/api/portal/…` — login, upload-url, confirm, media (all session-gated)
- `lib/r2.js` — your MEvid R2 code, key prefix changed to `studio/{client_id}/`
- `lib/session.js`, `lib/portal.js` — client login sessions (signed cookie)
- updated `package.json` (adds aws-sdk + uuid) and `app/globals.css`

## DO THIS

1. Unzip into `~/Documents/GitHub/studio-portal`, overwriting `package.json`
   and `app/globals.css` when prompted.

2. Add the R2 env vars in Vercel (studio-portal → Settings → Environment
   Variables). Copy the SAME values from your MEvid project — same bucket:
   - `CLOUDFLARE_R2_ENDPOINT`
   - `CLOUDFLARE_R2_ACCESS_KEY_ID`
   - `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
   - `CLOUDFLARE_R2_BUCKET`
   - `NEXT_PUBLIC_R2_PUBLIC_URL`
   (Optional: `SESSION_SECRET` = any long random string. If you skip it, the app
   signs client sessions with the service-role key you already set — works fine.)

3. Push:
   ```
   cd ~/Documents/GitHub/studio-portal && git add -A && git commit -m "step 3: client hub" && git push
   ```
   Vercel redeploys automatically (installs the new packages during build).

## Test it
- In `/admin`, copy Robyn's portal link (the "Copy link" button on her row).
- Open it in an incognito window → you should see "Welcome, the Matlins" and a
  password box → enter `matlin0417` → the two doors appear.
- "Upload" → drag a photo → watch it upload → it appears under "Files you've sent us."
- "Take a look…" → empty for now (nothing sent yet); it fills once we build
  Josh's delivery flow (the next step).

## Note
Uploads go straight from the browser to R2 (presigned), never through Vercel —
so big files are fine, exactly like MEvid. Josh's send-to-client delivery flow
(watermark + email) is the next build step.
