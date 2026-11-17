'use client';

// The review form itself (see app/review/page.js). Stars → review → name and
// how it should appear → "OK to post" → Send → thank-you screen with the
// "Also share it on Google" step, shown to EVERYONE regardless of stars
// (Google does not allow asking only happy clients).

import { useEffect, useState } from 'react';
import { displayName, eventPhrase, STAR_LABELS } from '@/lib/reviewName';

const GOOGLE_REVIEW = 'https://search.google.com/local/writereview?placeid=ChIJK7bQKxouHa8RrkAtxHZJ8es';
const PINK = '#ff2e93', BLUE = '#3d7bff';

const field = { width: '100%', boxSizing: 'border-box', background: 'var(--panel2, #150f20)', border: '1px solid var(--line, #241c33)', borderRadius: 10, color: 'var(--text, #edebf2)', padding: '12px 13px', font: 'inherit', fontSize: 16 };
const lab = { display: 'block', fontSize: 13, color: 'var(--muted)', margin: '16px 0 6px', textAlign: 'left' };

export default function ReviewClient({ token, initialStars = 0, preview = false }) {
  const [state, setState] = useState(preview ? 'form' : 'loading'); // loading | bad | form | sending | done
  const [err, setErr] = useState('');
  const [greeting, setGreeting] = useState(preview ? 'Julie' : '');
  const [stars, setStars] = useState(initialStars);
  const [body, setBody] = useState('');
  const [name, setName] = useState(preview ? 'Julie Taylor' : '');
  const [event, setEvent] = useState(preview ? "B'nai Mitzvah" : '');
  const [eventType, setEventType] = useState(preview ? "B'nai Mitzvah" : '');
  const [display, setDisplay] = useState('full');
  const [ok, setOk] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (preview) return;
    if (!token) { setState('bad'); return; }
    fetch(`/api/review?c=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { setErr(j.error || ''); setState('bad'); return; }
        setGreeting(j.greeting || ''); setName(j.name || ''); setEvent(j.event || ''); setEventType(j.event || '');
        setState('form');
      })
      .catch(() => setState('bad'));
  }, [token, preview]);

  async function send(e) {
    e.preventDefault();
    setErr('');
    if (!stars) { setErr('Please tap a star rating.'); return; }
    if (!body.trim()) { setErr('Please write a few words.'); return; }
    if (!name.trim()) { setErr('Please add your name.'); return; }
    if (preview) { setState('done'); return; }
    setState('sending');
    try {
      const r = await fetch('/api/review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ c: token, stars, body, name, event, display, ok }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error || 'Sorry, something went wrong. Please try again.'); setState('form'); return; }
      setState('done');
    } catch {
      setErr('Sorry, something went wrong. Please try again.'); setState('form');
    }
  }

  async function google() {
    try { await navigator.clipboard.writeText(body.trim()); setCopied(true); } catch { /* still open Google */ }
    window.open(GOOGLE_REVIEW, '_blank', 'noopener');
  }

  if (state === 'loading') return <p style={{ color: 'var(--muted)', marginTop: 24 }}>Loading…</p>;
  if (state === 'bad') return (
    <p style={{ color: 'var(--muted)', marginTop: 24 }}>
      {err || 'This review link is not valid. Please use the link from your email.'}
    </p>
  );

  if (state === 'done') {
    const first = (name.trim().split(/\s+/)[0]) || greeting;
    return (
      <div style={{ border: '1px solid var(--line, #241c33)', borderRadius: 14, padding: '26px 18px', background: 'var(--panel, #0e0a16)', marginTop: 20 }}>
        <div style={{ fontSize: 40 }}>💛</div>
        <h1 style={{ fontSize: 24, margin: '6px 0' }}>Thank you{first ? `, ${first}` : ''}!</h1>
        <p style={{ color: 'var(--muted)', margin: '0 0 18px' }}>Your review means the world to us.</p>
        <div style={{ borderTop: '1px solid var(--line, #241c33)', paddingTop: 18 }}>
          <p style={{ margin: '0 0 10px', fontSize: 15 }}>Would you also share it on Google? It helps other families find us.</p>
          <button type="button" onClick={google}
            style={{ background: 'transparent', border: `1px solid ${BLUE}`, color: '#cfe0ff', borderRadius: 10, padding: '12px 22px', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            Also share it on Google ⭐
          </button>
          <p style={{ color: 'var(--muted)', fontSize: 12.5, margin: '10px 0 0' }}>
            {copied ? 'Your review is copied. Just paste it into the Google box.' : 'We copy your review for you, so you can paste it straight in.'}
          </p>
        </div>
        {preview && <p style={{ color: '#ffb44d', fontSize: 12.5, marginTop: 14 }}>Preview only. Nothing was saved.</p>}
      </div>
    );
  }

  const opts = [['full', 'Full name'], ['first', 'First name only'], ['initials', 'Initials only']];
  return (
    <form onSubmit={send} style={{ marginTop: 6 }}>
      {preview && <p style={{ color: '#ffb44d', fontSize: 13, margin: '0 0 8px' }}>Preview with sample details. Nothing will be saved.</p>}
      <p style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', margin: '14px 0 4px' }}>Main Event Studio</p>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800 }}>How did we do{greeting ? `, ${greeting}` : ''}?</h1>
      <p style={{ color: 'var(--muted)', fontSize: 15, margin: '0 0 16px' }}>
        Thank you for letting us be part of {eventPhrase(eventType)}. A few words from you help other families find us.
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }} role="radiogroup" aria-label="Star rating">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" aria-label={`${i} star${i > 1 ? 's' : ''}`} onClick={() => setStars(i)}
            style={{ background: 'none', border: 0, fontSize: 42, lineHeight: 1, cursor: 'pointer', padding: '0 2px',
              color: i <= stars ? '#ffc93d' : '#3a3248', textShadow: i <= stars ? '0 0 12px rgba(255,201,61,.45)' : 'none' }}>★</button>
        ))}
      </div>
      <div style={{ fontSize: 13, color: 'var(--muted)', minHeight: 20 }}>{STAR_LABELS[stars] || 'Tap a star'}</div>

      <label style={lab} htmlFor="rv-body">Your review</label>
      <textarea id="rv-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000}
        placeholder="What did you love? How did your family and guests react?" style={{ ...field, minHeight: 130, resize: 'vertical' }} />

      <label style={lab} htmlFor="rv-name">Your name</label>
      <input id="rv-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="First and last name" style={field} />

      <label style={lab} htmlFor="rv-event">Your event</label>
      <input id="rv-event" value={event} onChange={(e) => setEvent(e.target.value)} maxLength={120} placeholder="Bar Mitzvah, Wedding…" style={field} />

      <span style={lab}>How should your name appear on our website?</span>
      {opts.map(([v, l]) => {
        const on = display === v;
        return (
          <button key={v} type="button" onClick={() => setDisplay(v)} aria-pressed={on}
            style={{ display: 'flex', width: '100%', gap: 10, alignItems: 'center', background: 'var(--panel2, #150f20)', textAlign: 'left',
              border: `1px solid ${on ? BLUE : 'var(--line, #241c33)'}`, boxShadow: on ? '0 0 10px rgba(61,123,255,.25)' : 'none',
              borderRadius: 10, padding: '11px 13px', marginTop: 8, cursor: 'pointer', fontSize: 15, color: 'var(--text, #edebf2)' }}>
            <span style={{ width: 18, height: 18, borderRadius: '50%', flex: 'none', border: `2px solid ${on ? BLUE : 'var(--muted)'}`,
              background: on ? `radial-gradient(${BLUE} 45%, transparent 50%)` : 'none' }} />
            {l}
            <small style={{ color: 'var(--muted)', marginLeft: 'auto' }}>{displayName(name, v) || '—'}</small>
          </button>
        );
      })}

      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 16, fontSize: 14, textAlign: 'left', cursor: 'pointer' }}>
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2, accentColor: PINK }} />
        It&apos;s OK for Main Event Studio to post my review on its website.
      </label>

      {err && <p style={{ color: '#ff6b81', fontSize: 14, margin: '14px 0 0' }}>{err}</p>}
      <button type="submit" disabled={state === 'sending'}
        style={{ background: PINK, color: '#fff', border: 0, borderRadius: 10, padding: '14px 34px', fontWeight: 700, fontSize: 17, marginTop: 20, cursor: 'pointer', width: '100%', opacity: state === 'sending' ? 0.6 : 1 }}>
        {state === 'sending' ? 'Sending…' : 'Send my review'}
      </button>
    </form>
  );
}
