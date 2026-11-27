
// -------------------------------------------------------------------
// Sample link opened (Josh 11/11). Unlike cut links (first open only), a sample
// link notifies on EVERY real open, with the running count and the previous open.
// -------------------------------------------------------------------
export async function sendSampleOpenedNotice({ recipient = '', title = '', opens = null, prevOpenedAt = null }) {
  const to = process.env.OPEN_NOTIFY_EMAIL || 'info@maineventstudio.com';
  if (!to) return false;
  const who = recipient ? recipient : 'a sample link';
  const when = (iso) => {
    try {
      return new Date(iso).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch { return ''; }
  };
  const countLine = opens ? `This is open #${opens}.` : '';
  const prevLine = prevOpenedAt ? ` Previous open: ${when(prevOpenedAt)} (Pacific).` : (opens === 1 ? ' First time it has been opened.' : '');

  const html = shell(`
    <h1 style="color:#1a1523;font-size:22px;margin:0 0 12px;">👀 Sample opened: ${escapeHtml(who)}</h1>
    <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 8px;">
      <strong>${escapeHtml(title)}</strong> was just opened from its sample link.
    </p>
    <p style="color:#555;font-size:15px;line-height:1.6;margin:0;">${escapeHtml(countLine + prevLine)}</p>
    <p style="color:#888;font-size:12px;margin:14px 0 0;">You're notified on every open of a sample link. Manage links in the Studio Admin under Sample links.</p>
  `);
  const text = `Sample opened: ${who} — ${title}. ${countLine}${prevLine}`;

  try {
    await getClient().sendEmail({
      From: fromAddress(),
      To: to,
      Subject: `👀 Sample opened: ${who}${opens ? ` (#${opens})` : ''}`.slice(0, 120),
      ...STREAM,
      TextBody: text,
      HtmlBody: html,
    });
    return true;
  } catch (e) {
    console.error('Sample open-notice could not send:', e?.message);
    return false;
  }
}
