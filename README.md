# Main Event Studio — Client Portal

Phase 1, steps 1–2. Next.js App Router · shared Supabase project (tables prefixed
`studio_`) · Cloudflare R2 (step 4) · Postmark (step 6) · Vercel Hobby.

## Setup order

1. **Repo:** unzip into `~/Documents/GitHub/studio-portal`, then
   `cd ~/Documents/GitHub/studio-portal && git init && git add -A && git commit -m "phase 1 steps 1-2" && git branch -M main`
   → create empty GitHub repo `studio-portal` → `git remote add origin <url> && git push -u origin main`
2. **Vercel:** New Project → import `studio-portal` → add env vars below → deploy.
3. **Subdomain:** Vercel project → Domains → add `clients.maineventstudio.com`
   → in Squarespace DNS add the CNAME Vercel shows → wait for green check.
4. **Supabase:** SQL Editor → paste `sql/001_studio_init.sql` → Run → confirm the
   verification query at the bottom shows service_role grants on all 3 tables.
5. **Postmark:** Sender Signatures → add `hello@maineventstudio.com` → verify the
   maineventstudio.com domain (DKIM + Return-Path DNS records go in Squarespace).
   Needed before step 6 of the build order, so start DNS verification now.
6. Visit `https://clients.maineventstudio.com/admin`, sign in with your existing
   Supabase auth login, create a test client.

## Env vars (Vercel → Settings → Environment Variables)

Copy values from the MEvid Vercel project (same spelling, char for char):

| Var | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | same as MEvid |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same as MEvid |
| `SUPABASE_SERVICE_ROLE_KEY` | same as MEvid — the LEGACY `service_role` key starting `eyJ`, NOT `sb_secret_…` |

New for this project:

| Var | Value |
|---|---|
| `ADMIN_EMAIL` | the email of Josh's Supabase auth login |
| `NEXT_PUBLIC_SITE_URL` | `https://clients.maineventstudio.com` |

Reserved for later steps (add when we build them; copy exact `CLOUDFLARE_R2_*`
and Postmark names from MEvid so the copied lib files work unchanged):
R2 vars + `NEXT_PUBLIC_R2_PUBLIC_URL` (step 4), Postmark token +
`POSTMARK_FROM_EMAIL=hello@maineventstudio.com` (step 6).

Remember: any env var change on Vercel requires a REDEPLOY.

## Deploy line

```
cd ~/Documents/GitHub/studio-portal && git add -A && git commit -m "update" && git push
```

## What's built (steps 1–2)

- `sql/001_studio_init.sql` — `studio_clients` / `studio_media` /
  `studio_messages`, RLS enabled with NO browser policies (all data flows
  through service-role server routes), grants + verification query.
- `/admin` — Josh signs in with his existing Supabase auth user (gated by
  `ADMIN_EMAIL`). Create clients: welcome name, last name, email, event date,
  type. Password auto-generated as lastname+MMDD, shown once in a credential
  ticket with the private portal link (`/p/{token}`). Client list with copy
  link, reset password (re-derives the same pattern), archive.
- `/` — branded placeholder landing (portal shell is step 3).
