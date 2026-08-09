// Postmark email for Studio. Env names copied from MEvid's lib/email.js so
// they match, not guessed: POSTMARK_API_TOKEN, POSTMARK_FROM_EMAIL,
// POSTMARK_FROM_NAME. Site URL uses this project's NEXT_PUBLIC_SITE_URL.
//
// Deliverability notes carried over from MEvid (Josh 7/8):
// - Always send a TextBody alongside HtmlBody (HTML-only trips spam heuristics).
// - MessageStream pinned explicitly.
// NOTE: The stream defaults to 'outbound'. If Studio ever turns on open/click
// tracking or webhooks, use a SEPARATE Postmark stream so it can't bleed into
// MEvid (flagged in the Phase 2 plan). Override with POSTMARK_MESSAGE_STREAM.
import * as postmark from 'postmark';

const STREAM = { MessageStream: process.env.POSTMARK_MESSAGE_STREAM || 'outbound' };

// Lazily construct so a missing token doesn't crash module import / build.
function getClient() {
  const token = process.env.POSTMARK_API_TOKEN;
  if (!token) throw new Error('POSTMARK_API_TOKEN is not set');
  return new postmark.ServerClient(token);
}

function fromAddress() {
  const email = process.env.POSTMARK_FROM_EMAIL;
  const name = process.env.POSTMARK_FROM_NAME || 'Main Event Studio';
  return email ? `${name} <${email}>` : name;
}

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://clients.maineventstudio.com';
}

// Shared branded shell — Studio is dark/neon, so the email uses a near-black
// header banner (the logo's letters are dark and vanish on white).
function shell(innerHtml) {
  const logo = `${siteUrl()}/logo.png`;
  return `
  <div style="background:#f4f4f6;padding:24px 0;">
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e6e6ea;">
      <div style="background:#0a0410;text-align:center;padding:28px 24px;">
        <img src="${logo}" alt="Main Event Studio" width="200" style="max-width:200px;height:auto;display:inline-block;" />
      </div>
      <div style="padding:32px 32px 36px;">
        ${innerHtml}
      </div>
      <div style="border-top:1px solid #eee;padding:20px 32px;text-align:center;">
        <p style="color:#aaa;font-size:12px;margin:0;">
          Main Event Studio ·
          <a href="https://www.maineventstudio.com" style="color:#3d7bff;text-decoration:none;">maineventstudio.com</a>
        </p>
      </div>
    </div>
  </div>`;
}

function button(href, label) {
  return `
    <div style="text-align:center;margin:32px 0;">
      <a href="${href}" style="background:#ff2e4c;color:#ffffff;padding:15px 36px;border-radius:10px;text-decoration:none;font-size:16px;font-weight:700;display:inline-block;">
        ${label}
      </a>
    </div>`;
}

// -------------------------------------------------------------------
// Delivery email: Josh uploaded a cut for a client (step 6).
// kind: 'rough_cut' | 'final'. Throws on send failure so the admin UI
// can surface it — the record is already saved, email is the last step.
// -------------------------------------------------------------------
export async function sendCutReady({ client, kind = 'rough_cut', note = '', version = '', to = '', watchUrl = '' }) {
  const portalUrl = `${siteUrl()}/p/${client.portal_token}`;
  const link = watchUrl || portalUrl; // direct no-login video link when available
  const isFinal = kind === 'final';
  const vtag = version && String(version).trim() ? ` (${String(version).trim()})` : '';
  const recipient = to && String(to).trim() ? String(to).trim() : `${client.display_name} <${client.email}>`;
  const headline = isFinal
    ? 'Your final video is ready.'
    : 'We have something to show you.';
  const lead = isFinal
    ? `The final cut${vtag} for your event is ready to view.`
    : `Main Event Studio just posted a new cut${vtag} to your private portal — take a look and let us know what you think.`;

  const noteBlockHtml = note
    ? `<div style="background:#f6f8ff;border-left:4px solid #3d7bff;padding:14px 18px;margin:22px 0;border-radius:0 8px 8px 0;">
         <p style="color:#1a1523;font-size:15px;line-height:1.6;margin:0;white-space:pre-wrap;">${escapeHtml(note)}</p>
       </div>`
    : '';

  const html = shell(`
    <h1 style="color:#1a1523;font-size:24px;margin:0 0 12px;">Hi ${escapeHtml(client.display_name)},</h1>
    <p style="color:#555;font-size:16px;line-height:1.7;margin:0 0 8px;">${lead}</p>
    ${noteBlockHtml}
    ${button(link, isFinal ? 'Watch your final video' : 'View your cut')}
    ${watchUrl ? '' : `<p style="color:#888;font-size:13px;line-height:1.6;text-align:center;margin:8px 0 0;">
      You'll be asked for your portal password — the one Main Event Studio gave you.
    </p>`}
  `);

  const text = `Hi ${client.display_name},

${lead}
${note ? `\nNote from Main Event Studio:\n"${note}"\n` : ''}
${isFinal ? 'Watch your final video' : 'View your cut'}: ${link}
${watchUrl ? '' : `\nYou'll be asked for your portal password — the one Main Event Studio gave you.\n`}
Main Event Studio — maineventstudio.com`;

  await getClient().sendEmail({
    From: fromAddress(),
    To: recipient,
    ReplyTo: process.env.POSTMARK_REPLY_TO || undefined,
    Subject: isFinal
      ? `Your final video from Main Event Studio is ready${vtag}`
      : `Main Event Studio has something to show you${vtag}`,
    ...STREAM,
    TextBody: text,
    HtmlBody: html,
  });
}

// -------------------------------------------------------------------
// Watermark FAILED alert → goes to Josh, never the client. Fires when a rough
// cut couldn't be watermarked (render failed, or the finished file couldn't be
// stored), so a clean cut is never delivered by accident. Best-effort.
// -------------------------------------------------------------------
export async function sendCutWatermarkFailed({ client, version = '', error = '', rawKey = '', renderUrl = '' }) {
  const to = process.env.INTAKE_NOTIFY_EMAIL || process.env.ADMIN_EMAIL || 'josh@maineventstudio.com';
  if (!to) return false;
  const who = escapeHtml(client?.display_name || 'a client');
  const vtag = version ? ` (${escapeHtml(version)})` : '';

  const html = shell(`
    <h1 style="color:#a3161f;font-size:22px;margin:0 0 12px;">⚠ A rough cut was NOT sent</h1>
    <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 8px;">
      The watermark step failed for <strong>${who}</strong>${vtag}, so the cut was <strong>not</strong> delivered —
      nothing un-watermarked went out. Handle this one manually.
    </p>
    <div style="background:#fff5f5;border-left:4px solid #d33;padding:12px 16px;margin:16px 0;border-radius:0 8px 8px 0;">
      <p style="color:#1a1523;font-size:13px;line-height:1.6;margin:0;white-space:pre-wrap;">Reason: ${escapeHtml(String(error))}</p>
      ${rawKey ? `<p style="color:#666;font-size:12px;margin:8px 0 0;">Uploaded file still in storage: <code>${escapeHtml(rawKey)}</code></p>` : ''}
      ${renderUrl ? `<p style="color:#666;font-size:12px;margin:6px 0 0;">Watermarked render (temporary): <a href="${renderUrl}">${escapeHtml(renderUrl)}</a></p>` : ''}
    </div>
  `);
  const text = `A rough cut was NOT sent.
The watermark step failed for ${client?.display_name || 'a client'}${version ? ` (${version})` : ''}, so nothing was delivered.
Reason: ${error}
${rawKey ? `Uploaded file still in storage: ${rawKey}` : ''}
${renderUrl ? `Watermarked render (temporary): ${renderUrl}` : ''}`;

  try {
    await getClient().sendEmail({
      From: fromAddress(),
      To: to,
      Subject: `⚠ Rough cut NOT sent — watermark failed (${client?.display_name || 'client'})`,
      ...STREAM,
      TextBody: text,
      HtmlBody: html,
    });
    return true;
  } catch (e) {
    console.error('Watermark-failed alert could not send:', e?.message);
    return false;
  }
}

// -------------------------------------------------------------------
// Open notice → goes to the studio (info@maineventstudio.com) the FIRST time a
// share link is opened by a real viewer. Best-effort; never blocks playback.
// -------------------------------------------------------------------
export async function sendCutOpenedNotice({ filename = '', kind = 'rough_cut', clientName = '' }) {
  const to = process.env.OPEN_NOTIFY_EMAIL || 'info@maineventstudio.com';
  if (!to) return false;
  const label = kind === 'final' ? 'final video' : 'cut';
  const who = clientName ? ` for ${escapeHtml(clientName)}` : '';

  const html = shell(`
    <h1 style="color:#1a1523;font-size:22px;margin:0 0 12px;">👀 Your ${label} was just opened</h1>
    <p style="color:#555;font-size:15px;line-height:1.6;margin:0;">
      <strong>${escapeHtml(filename)}</strong>${who} was just opened from its share link for the first time.
    </p>
    <p style="color:#888;font-size:12px;margin:14px 0 0;">You're notified once, on the first open of each link.</p>
  `);
  const text = `Your ${label}${who} — ${filename} — was just opened from its share link (first open).`;

  try {
    await getClient().sendEmail({
      From: fromAddress(),
      To: to,
      Subject: `👀 Opened${who}: ${filename}`.slice(0, 120),
      ...STREAM,
      TextBody: text,
      HtmlBody: html,
    });
    return true;
  } catch (e) {
    console.error('Open-notice could not send:', e?.message);
    return false;
  }
}

// -------------------------------------------------------------------
// Vendor forward: a client forwards one of their delivered files to a vendor.
// The vendor gets a durable download link (+ optional note). Replies go to the
// client so the vendor can respond to them, not the studio. Throws on failure so
// the portal can surface it.
// -------------------------------------------------------------------
export async function sendVendorForward({ client, vendorEmail, note = '', fileName = '', shareUrl }) {
  const who = escapeHtml(client.display_name || 'A Main Event Studio client');
  const noteBlockHtml = note
    ? `<div style="background:#f6f8ff;border-left:4px solid #3d7bff;padding:14px 18px;margin:22px 0;border-radius:0 8px 8px 0;">
         <p style="color:#1a1523;font-size:15px;line-height:1.6;margin:0;white-space:pre-wrap;">${escapeHtml(note)}</p>
       </div>`
    : '';

  const html = shell(`
    <h1 style="color:#1a1523;font-size:23px;margin:0 0 12px;">${who} shared a file with you</h1>
    <p style="color:#555;font-size:16px;line-height:1.7;margin:0 0 8px;">
      ${who} forwarded a file from their Main Event Studio project${fileName ? `: <strong>${escapeHtml(fileName)}</strong>` : ''}.
    </p>
    ${noteBlockHtml}
    ${button(shareUrl, 'Download the file')}
    <p style="color:#888;font-size:13px;line-height:1.6;text-align:center;margin:8px 0 0;">
      This link downloads the file directly — no sign-in needed.
    </p>
  `);

  const text = `${client.display_name || 'A Main Event Studio client'} shared a file with you${fileName ? ` (${fileName})` : ''}.
${note ? `\nNote:\n"${note}"\n` : ''}
Download the file: ${shareUrl}

This link downloads the file directly — no sign-in needed.

Main Event Studio — maineventstudio.com`;

  await getClient().sendEmail({
    From: fromAddress(),
    To: vendorEmail,
    // Vendor replies go back to the client who forwarded it.
    ReplyTo: client.email || process.env.POSTMARK_REPLY_TO || undefined,
    Subject: `${client.display_name || 'A client'} shared a file with you — Main Event Studio`,
    ...STREAM,
    TextBody: text,
    HtmlBody: html,
  });
}

// -------------------------------------------------------------------
// Intake notification: a client submitted their questionnaire.
// Sent to Josh. Best-effort — never blocks the save. Returns true/false.
// -------------------------------------------------------------------
export async function sendIntakeNotification({ client, intake }) {
  const to = process.env.INTAKE_NOTIFY_EMAIL || process.env.ADMIN_EMAIL;
  if (!to) return false;

  const adminUrl = `${siteUrl()}/admin`;
  const rows = [
    ['Client', client.display_name],
    ['Email', client.email],
    ['Honoree(s)', intake.honoree_names],
    ['Event date', intake.event_date],
    ['Venue', intake.venue],
    ['Vibe', Array.isArray(intake.vibe) ? intake.vibe.join(', ') : ''],
  ]
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#888;font-size:13px;">${k}</td><td style="padding:4px 0;color:#1a1523;font-size:14px;">${escapeHtml(String(v))}</td></tr>`
    )
    .join('');

  const html = shell(`
    <h1 style="color:#1a1523;font-size:22px;margin:0 0 12px;">New intake submitted</h1>
    <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 16px;">
      ${escapeHtml(client.display_name)} just filled out their questionnaire.
    </p>
    <table style="border-collapse:collapse;margin:0 0 8px;">${rows}</table>
    ${button(adminUrl, 'Open the admin dashboard')}
  `);

  const text = `New intake submitted by ${client.display_name} (${client.email}).

Honoree(s): ${intake.honoree_names || '—'}
Event date: ${intake.event_date || '—'}
Venue: ${intake.venue || '—'}
Vibe: ${Array.isArray(intake.vibe) ? intake.vibe.join(', ') : '—'}

Open admin: ${adminUrl}`;

  try {
    await getClient().sendEmail({
      From: fromAddress(),
      To: to,
      Subject: `New intake — ${client.display_name}`,
      ...STREAM,
      TextBody: text,
      HtmlBody: html,
    });
    return true;
  } catch (e) {
    console.error('Intake notification failed:', e?.message);
    return false;
  }
}

// -------------------------------------------------------------------
// Character Build sheet ready: a client finished (or the studio generated)
// their AI character reference sheet. Sent to Josh with the PNG attached.
// Best-effort — never blocks the client. Returns true/false.
// -------------------------------------------------------------------
export async function sendCharacterSheetReady({ client, buffer, count = 0, profile = null, name = '' }) {
  // Character build sheets go to the studio's business inbox. Override with
  // CHARACTER_SHEET_EMAIL if it should ever change.
  const to = process.env.CHARACTER_SHEET_EMAIL || 'josh@maineventstudio.com';
  if (!to) return false;

  // Subject/character name for the sheet; falls back to the project name.
  const subjectName = (name && String(name).trim()) || client.display_name;
  const projectTag = subjectName !== client.display_name ? ` (${client.display_name})` : '';
  const adminUrl = `${siteUrl()}/admin`;
  const filename = `character-build-${String(subjectName || 'client').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.png`;

  // Copyable write-up (so the AI prompt is usable straight from the inbox).
  const A = profile?.attributes || {};
  const attrPairs = [
    ['Apparent age', A.apparent_age_range], ['Hair', A.hair], ['Eyes', A.eyes], ['Complexion', A.complexion],
    ['Face shape', A.face_shape], ['Features', A.facial_features], ['Build', A.build], ['Wardrobe', A.wardrobe_style],
  ].filter(([, v]) => v && String(v).trim());

  const profileHtml = profile ? `
    <div style="background:#f6f8ff;border-left:4px solid #3d7bff;padding:14px 18px;margin:18px 0;border-radius:0 8px 8px 0;">
      <p style="color:#1a1523;font-size:13px;font-weight:700;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">Character profile <span style="color:#999;font-weight:400;text-transform:none;">(AI draft — review)</span></p>
      <table style="border-collapse:collapse;margin:0 0 10px;">${attrPairs.map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#888;font-size:12px;vertical-align:top;">${k}</td><td style="padding:2px 0;color:#1a1523;font-size:13px;">${escapeHtml(v)}</td></tr>`).join('')}</table>
      ${profile.summary ? `<p style="color:#333;font-size:13px;line-height:1.6;margin:0 0 10px;">${escapeHtml(profile.summary)}</p>` : ''}
      ${profile.ai_prompt ? `<p style="color:#1a1523;font-size:12px;font-weight:700;margin:0 0 4px;">AI prompt</p><pre style="white-space:pre-wrap;font-family:Menlo,Consolas,monospace;font-size:12px;color:#1a1523;background:#fff;border:1px solid #e0e4ee;border-radius:8px;padding:10px 12px;margin:0;">${escapeHtml(profile.ai_prompt)}</pre>` : ''}
    </div>` : '';

  const html = shell(`
    <h1 style="color:#1a1523;font-size:22px;margin:0 0 12px;">Character build sheet ready</h1>
    <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 8px;">
      ${escapeHtml(subjectName)}${escapeHtml(projectTag)} has ${count} character reference shot${count === 1 ? '' : 's'} in.
      The labeled build sheet is attached — drop it straight into your AI tool.
    </p>
    ${profileHtml}
    <p style="color:#888;font-size:13px;line-height:1.6;margin:0 0 16px;">
      You can also regenerate or re-download it any time from the client's workspace in admin.
    </p>
    ${button(adminUrl, 'Open the admin dashboard')}
  `);
  const profileText = profile
    ? `\nCHARACTER PROFILE (AI draft — review):\n${attrPairs.map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n${profile.summary ? `\n${profile.summary}\n` : ''}${profile.ai_prompt ? `\nAI prompt:\n${profile.ai_prompt}\n` : ''}`
    : '';
  const text = `${subjectName}${projectTag} has ${count} character reference shot(s) in.
The labeled character build sheet is attached (${filename}).
${profileText}
Open admin: ${adminUrl}`;

  try {
    await getClient().sendEmail({
      From: fromAddress(),
      To: to,
      Subject: `Character build sheet — ${subjectName}`,
      ...STREAM,
      TextBody: text,
      HtmlBody: html,
      Attachments: buffer
        ? [{ Name: filename, Content: Buffer.from(buffer).toString('base64'), ContentType: 'image/png' }]
        : undefined,
    });
    return true;
  } catch (e) {
    console.error('Character sheet email failed:', e?.message);
    return false;
  }
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
