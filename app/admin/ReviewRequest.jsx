'use client';

// "★ Request Review" box (Reviews, Josh 11/17) — opens under a client row in
// the client list. Pre-filled for that client with Robyn's approved wording
// (editable). Nothing is sent until the admin clicks the green
// "Request approved to send to client" button at the top. "Copy link only"
// is for texting the link instead.

import { useState } from 'react';
import { eventPhrase, greetingName } from '@/lib/reviewName';

const MARKER = '[Tap a star to rate us ★★★★★]  [Leave a review →]'; // must match lib/email.js REVIEW_MARKER
const OK = '#37d99a', GOLD = '#ffc93d';

function defaults(c) {
  const g = greetingName(c.display_name);
  return {
    to: `${c.display_name} <${c.email}>`,
    subject: 'How did we do? A quick favor from Main Event Studio',
    heading: `How did we do${g ? `, ${g}` : ''}?`,
    message:
`Hi ${g || 'there'},

Thank you again for letting us be part of ${eventPhrase(c.event_type)}. It was a joy bringing your celebration to the screen, and we hope you and your family loved watching it as much as we loved making it.

If you have a minute, we'd be so grateful if you'd share a few words about your experience. Your review helps other families find us, and it means the world to our small team.

${MARKER}

You choose how your name appears, and nothing is posted without your OK.

With gratitude,
Robyn & Josh
Main Event Studio`,
  };
}

export default function ReviewRequest({ client, api, onDone, onClose }) {
  const [f, setF] = useState(() => defaults(client));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const asked = client.review_reminded_at || client.review_asked_at;

  async function send() {
    setBusy(true); setErr(''); setMsg('');
    try {
      const j = await api('/api/admin/reviews', { method: 'POST', body: JSON.stringify({ action: 'send-request', clientId: client.id, ...f }) });
      setMsg(j.reminder ? 'Reminder sent ✓' : 'Sent ✓');
      onDone?.();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function copyLink() {
    setErr('');
    try {
      const j = await api('/api/admin/reviews', { method: 'POST', body: JSON.stringify({ action: 'request-link', clientId: client.id }) });
      await navigator.clipboard.writeText(j.url);
      setMsg('Link copied — paste it into a text.');
    } catch (e) { setErr(e.message || 'Could not copy the link.'); }
  }

  const lab = { display: 'block', fontSize: 12, color: 'var(--muted)', margin: '10px 0 4px' };
  return (
    <div style={{ border: `1px solid ${GOLD}`, borderRadius: 12, padding: 16, background: 'rgba(255,201,61,.05)', whiteSpace: 'normal' }}>
      <button type="button" disabled={busy} onClick={send}
        style={{ display: 'block', width: '100%', background: OK, color: '#06150f', border: 0, borderRadius: 10, padding: 14, fontWeight: 800, fontSize: 16, cursor: 'pointer', boxShadow: '0 0 14px rgba(55,217,154,.35)', opacity: busy ? 0.6 : 1 }}>
        {busy ? 'Sending…' : '✓ Request approved to send to client'}
      </button>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'center', margin: '6px 0 4px' }}>
        Sends the email below to {client.display_name}, with a copy to info@. Edit anything first if you like.
        {asked && <> Already requested {new Date(asked).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — this sends a reminder.</>}
      </p>
      {msg && <p style={{ color: OK, fontWeight: 700, textAlign: 'center', margin: '8px 0 0' }}>{msg}</p>}
      {err && <p className="msg-error">{err}</p>}
      <label style={lab}>To</label>
      <input value={f.to} onChange={set('to')} />
      <label style={lab}>Subject</label>
      <input value={f.subject} onChange={set('subject')} />
      <label style={lab}>Heading (big line at the top of the email)</label>
      <input value={f.heading} onChange={set('heading')} />
      <label style={lab}>Message — the star box and &quot;Leave a review&quot; button go where the [Tap a star…] line is</label>
      <textarea value={f.message} onChange={set('message')} rows={16} style={{ width: '100%', boxSizing: 'border-box', fontSize: 14 }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button type="button" className="btn-ghost" onClick={copyLink}>Copy link only (to text it)</button>
        <button type="button" className="btn-ghost" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
