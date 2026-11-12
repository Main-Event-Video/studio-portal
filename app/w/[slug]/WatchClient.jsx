'use client';

// The interactive half of the sample-link page: asks /api/watch/<slug> for the
// clip, shows a password box if the link has one, then plays the clip.
// ?studio=1 on the page URL (the admin's Preview button) is passed through so
// Josh's own viewing never counts as an open or sends an email.
import { useEffect, useState } from 'react';

export default function WatchClient({ slug }) {
  const [state, setState] = useState({ phase: 'loading' });
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);

  const qs = () => {
    try { return new URLSearchParams(window.location.search).get('studio') === '1' ? '?studio=1' : ''; } catch { return ''; }
  };

  useEffect(() => {
    let alive = true;
    fetch(`/api/watch/${encodeURIComponent(slug)}${qs()}`, { cache: 'no-store' })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!alive) return;
        if (!r.ok) return setState({ phase: 'gone' });
        if (j.locked) return setState({ phase: 'locked', title: j.title });
        setState({ phase: 'play', ...j });
      })
      .catch(() => alive && setState({ phase: 'gone' }));
    return () => { alive = false; };
  }, [slug]);

  async function unlock(e) {
    e.preventDefault();
    if (!pw.trim() || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/watch/${encodeURIComponent(slug)}${qs()}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) setState((s) => ({ ...s, error: 'That password is not right. Please try again.' }));
      else if (!r.ok) setState({ phase: 'gone' });
      else setState({ phase: 'play', ...j });
    } catch {
      setState((s) => ({ ...s, error: 'Something went wrong. Please try again.' }));
    }
    setBusy(false);
  }

  const heading = (t) => (
    <>
      <p className="eyebrow" style={{ textAlign: 'center' }}>A Main Event Studio Presentation</p>
      <h1 className="neon neon-blue" style={{ textAlign: 'center', fontSize: 24, margin: '4px 0 18px', wordBreak: 'break-word' }}>{t}</h1>
    </>
  );

  if (state.phase === 'loading') {
    return <p style={{ textAlign: 'center', color: 'var(--muted)' }}>Loading…</p>;
  }
  if (state.phase === 'gone') {
    return (
      <div style={{ textAlign: 'center' }}>
        <h1 className="neon neon-blue" style={{ fontSize: 24, margin: '6px 0 8px' }}>Link not available</h1>
        <p style={{ color: 'var(--muted)' }}>This link is no longer active. Please reach out to Main Event Studio for a new one.</p>
      </div>
    );
  }
  if (state.phase === 'locked') {
    return (
      <div style={{ textAlign: 'center' }}>
        {heading(state.title)}
        <form onSubmit={unlock} style={{ maxWidth: 320, margin: '0 auto' }}>
          <label htmlFor="sample-pw" style={{ display: 'block', color: 'var(--muted)', fontSize: 14, marginBottom: 8 }}>🔒 Enter the password to watch</label>
          <input id="sample-pw" type="password" autoFocus autoComplete="off" value={pw}
            onChange={(e) => setPw(e.target.value)} placeholder="Password"
            style={{ width: '100%', marginBottom: 12, textAlign: 'center' }} />
          <button type="submit" className="btn-primary" disabled={busy || !pw.trim()}
            style={{ padding: '12px 30px', borderRadius: 10, fontWeight: 700, fontSize: 16 }}>
            {busy ? 'Checking…' : 'Watch'}
          </button>
          {state.error && <p className="msg-error">{state.error}</p>}
        </form>
      </div>
    );
  }
  const isVideo = String(state.contentType || 'video').startsWith('video');
  return (
    <>
      {heading(state.title)}
      {isVideo ? (
        <video src={state.url} poster={state.poster || undefined} controls playsInline
          controlsList="nodownload" onContextMenu={(e) => e.preventDefault()}
          style={{ width: '100%', maxHeight: '75vh', borderRadius: 12, background: '#000', display: 'block' }} />
      ) : (
        <img src={state.url} alt={state.title} style={{ width: '100%', borderRadius: 12, display: 'block' }} />
      )}
    </>
  );
}
