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
export async function sendCutReady({ client, kind = 'rough_cut', note = '' }) {
  const portalUrl = `${siteUrl()}/p/${client.portal_token}`;
  const isFinal = kind === 'final';
  const headline = isFinal
    ? 'Your final video is ready.'
    : 'We have something to show you.';
  const lead = isFinal
    ? `The final cut for your event is ready to view.`
    : `Main Event Studio just posted a new cut to your private portal — take a look and let us know what you think.`;

  const noteBlockHtml = note
    ? `<div style="background:#f6f8ff;border-left:4px solid #3d7bff;padding:14px 18px;margin:22px 0;border-radius:0 8px 8px 0;">
         <p style="color:#1a1523;font-size:15px;line-height:1.6;margin:0;white-space:pre-wrap;">${escapeHtml(note)}</p>
       </div>`
    : '';

  const html = shell(`
    <h1 style="color:#1a1523;font-size:24px;margin:0 0 12px;">Hi ${escapeHtml(client.display_name)},</h1>
    <p style="color:#555;font-size:16px;line-height:1.7;margin:0 0 8px;">${lead}</p>
    ${noteBlockHtml}
    ${button(portalUrl, isFinal ? 'Watch your final video' : 'View your cut')}
    <p style="color:#888;font-size:13px;line-height:1.6;text-align:center;margin:8px 0 0;">
      You'll be asked for your portal password — the one Main Event Studio gave you.
    </p>
  `);

  const text = `Hi ${client.display_name},

${lead}
${note ? `\nNote from Main Event Studio:\n"${note}"\n` : ''}
${isFinal ? 'Watch your final video' : 'View your cut'}: ${portalUrl}

You'll be asked for your portal password — the one Main Event Studio gave you.

Main Event Studio — maineventstudio.com`;

  await getClient().sendEmail({
    From: fromAddress(),
    To: `${client.display_name} <${client.email}>`,
    ReplyTo: process.env.POSTMARK_REPLY_TO || undefined,
    Subject: isFinal
      ? 'Your final video from Main Event Studio is ready'
      : 'Main Event Studio has something to show you',
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

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
