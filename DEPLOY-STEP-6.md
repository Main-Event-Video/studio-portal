# DEPLOY — Intake + Login + Delivery (finishes Phase 1)

Prepared for Josh. This covers everything added in this session:
the combined portal (email login + intake form as a third door) **and**
step 6 (you uploading a cut → auto-email to the client).

Do these steps in order. Nothing here touches MEvid's data or resources.

---

## 1. Install the new dependency

One new package was added (`postmark`). On your Mac, from the repo:

```
rm -rf node_modules .next    # clears leftovers from the build check
npm install
```

## 2. Run the database migration

New table only — `studio_intake`. Additive, safe on the shared project.

- Open Supabase → project `cyykrfnltvauqqxyujln` → SQL Editor.
- Paste the contents of `sql/002_intake.sql` and run it.
- The verify query at the bottom should show `service_role` rows.

## 3. Add environment variables in Vercel (studio-portal project)

The var **names** are copied from MEvid's `lib/email.js` (not guessed):

| Var | Value | Notes |
|---|---|---|
| `POSTMARK_API_TOKEN` | Your Postmark **Server API token** | ⚠️ Needs verification: use the token for the Postmark server that sends as `maineventstudio.com`. Same name MEvid uses. |
| `POSTMARK_FROM_EMAIL` | `info@maineventstudio.com` | See the sender decision below. |
| `POSTMARK_FROM_NAME` | `Main Event Studio` | Display name on the email. |
| `POSTMARK_REPLY_TO` | `info@maineventstudio.com` | Optional but recommended. Where replies go. |
| `INTAKE_NOTIFY_EMAIL` | `joshdolberg@gmail.com` | Optional. Where intake alerts go. Defaults to `ADMIN_EMAIL` if unset. |
| `POSTMARK_MESSAGE_STREAM` | `outbound` | Optional. Only change if you set up a separate Studio stream. |

Redeploy after adding them.

### Sender decision (resolves handoff §4.4)
`hello@maineventstudio.com` still does not exist as a mailbox. Simplest clean
option: **send from `info@` and reply-to `info@`** (both set above) — `info@`
is real and receives, so nothing gets lost. If you'd rather show `hello@` as
the sender for branding, create `hello@` as a **Google Workspace alias into
`info@`** first, then set `POSTMARK_FROM_EMAIL=hello@maineventstudio.com` and
keep `POSTMARK_REPLY_TO=info@maineventstudio.com`. Don't send from `hello@`
until that alias exists.

## 4. Add the "Client Portal" link on Squarespace

Goal: a nav item on `maineventstudio.com` that opens the portal login.

In Squarespace (7.1):
1. Edit your site → open the **Pages** panel.
2. In **Main Navigation**, click **+** → **Link**.
3. Label: `Client Portal`. URL: `https://clients.maineventstudio.com`.
   (Optionally set it to open in a new tab.)
4. Save.

You already have a "Client Page" (`/new-page`) with the old intake form in the
nav. Now that intake lives inside the portal (behind login), that public page is
redundant for existing clients — you can leave it, repoint it, or remove it.
Your call; nothing breaks either way.

> Squarespace's editor wording changes over time — if the steps above don't
> match what you see, I can walk through it live in the browser with you.

---

## What changed (files)

**New**
- `sql/002_intake.sql` — the `studio_intake` table.
- `lib/email.js` — Postmark client + `sendCutReady` and `sendIntakeNotification`.
- `app/api/portal/login-email/route.js` — email + password sign-in.
- `app/api/portal/intake/route.js` — save the questionnaire + notify you.
- `app/p/[token]/intake/page.js` + `Intake.jsx` — the intake form (third door).
- `app/api/admin/upload-url/route.js` — admin presigned upload for cuts.
- `app/api/admin/deliver/route.js` — records the cut + emails the client.

**Edited**
- `app/page.js` — now the email/password login (was a placeholder).
- `app/p/[token]/page.js` — hub now has three doors (added "Tell us about your event").
- `app/admin/page.js` — added the "Send a cut" panel.
- `lib/portal.js` — `getIntakeByClientId` + `last_name` in the token lookup.
- `app/globals.css` — styles for the intake form (radios/checkboxes/textarea).
- `package.json` — added `postmark`.

**Untouched / safe:** no changes to R2 CORS, MEvid tables, DNS, or the existing
`studio_clients` / `studio_media` schema. The private-link login still works
exactly as before — email login is additive.

---

## Test checklist (after deploy)

1. **Login:** go to `clients.maineventstudio.com`, sign in with a test client's
   email + password. Should land on the three-door hub.
2. **Private link still works:** open `/p/{token}` directly → password gate → hub.
3. **Intake:** open "Tell us about your event," fill it, submit. Confirm a
   success message, a row in `studio_intake`, and an email to you.
4. **Re-edit intake:** reopen it — your answers should be pre-filled; save again.
5. **Delivery:** in `/admin` → "Send a cut," pick the client, upload a short
   test video, flag it, add a note, send. Confirm the client gets the email and
   the video appears in their "View" door.
6. If the delivery email says it saved but didn't send, re-check the Postmark
   env vars (that's the usual cause).

## Still open (not blockers)
- Inspiration **image upload** in the intake form was deferred — clients paste
  links for now and have the full Upload door for real media. Say the word to
  add attachments.
- Revise the client guide's "we'll send you the link" line now that email login
  exists (handoff §8).
- The misleading "Network error during upload" message (handoff §5.11) is still
  there — separate fix.
