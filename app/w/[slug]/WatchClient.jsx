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
  const items = Array.isArray(state.items) && state.items.length
    ? state.items
    : [{ id: 'one', title: state.title, url: state.url, poster: state.poster, contentType: state.contentType }];

  // One clip: plays straight away, exactly as before.
  if (items.length === 1) {
    return (
      <>
        {heading(state.title)}
        <Player item={items[0]} />
      </>
    );
  }

  // Several clips: a list to choose from; the picked one plays at the top.
  return (
    <>
      {heading(state.title)}
      <MultiList slug={slug} items={items} studioQs={qs()} />
    </>
  );
}

function Player({ item, autoPlay = false }) {
  const isVideo = String(item.contentType || 'video').startsWith('video');
  return isVideo ? (
    <video key={item.url} src={item.url} poster={item.poster || undefined} controls playsInline autoPlay={autoPlay}
      controlsList="nodownload" onContextMenu={(e) => e.preventDefault()}
      style={{ width: '100%', maxHeight: '75vh', borderRadius: 12, background: '#000', display: 'block' }} />
  ) : (
    <img src={item.url} alt={item.title} style={{ width: '100%', borderRadius: 12, display: 'block' }} />
  );
}

const fmtDur = (s) => {
  const n = Math.round(Number(s) || 0);
  return n ? `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}` : '';
};

function MultiList({ slug, items, studioQs }) {
  const [current, setCurrent] = useState(null);

  function pick(it) {
    setCurrent(it);
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* noop */ }
    // Count the play (best-effort, never blocks playback).
    fetch(`/api/watch/${encodeURIComponent(slug)}${studioQs}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ play: it.id }),
    }).catch(() => {});
  }

  return (
    <>
      {current ? (
        <div style={{ marginBottom: 22 }}>
          <button type="button" onClick={() => setCurrent(null)}
            style={{ background: 'transparent', border: '1px solid var(--line)', color: 'var(--text)', borderRadius: 8,
              padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 10 }}>
            ◂ All videos
          </button>
          <Player item={current} autoPlay />
          <p style={{ textAlign: 'center', fontWeight: 700, fontSize: 17, margin: '12px 0 0' }}>{current.title}</p>
        </div>
      ) : (
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14, margin: '-8px 0 16px' }}>Tap a video to watch</p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        {items.map((it) => {
          const on = current && current.id === it.id;
          return (
            <button key={it.id} type="button" onClick={() => pick(it)}
              style={{ background: 'var(--panel-2, #150f20)', border: `1px solid ${on ? 'var(--blue, #3d7bff)' : 'var(--line, #241c33)'}`,
                borderRadius: 12, overflow: 'hidden', padding: 0, textAlign: 'left', cursor: 'pointer', color: 'var(--text)',
                boxShadow: on ? '0 0 16px rgba(61,123,255,.35)' : 'none' }}>
              <span style={{ display: 'block', aspectRatio: '16/9', background: '#000', position: 'relative' }}>
                {it.poster && <img src={it.poster} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff', fontSize: 34, textShadow: '0 2px 10px rgba(0,0,0,.7)' }}>▶</span>
                {fmtDur(it.duration) && (
                  <span style={{ position: 'absolute', right: 8, bottom: 6, fontSize: 11, background: 'rgba(0,0,0,.65)', padding: '1px 6px', borderRadius: 4, color: '#fff' }}>{fmtDur(it.duration)}</span>
                )}
              </span>
              <span style={{ display: 'block', padding: '10px 12px', fontWeight: 700, fontSize: 15 }}>{it.title}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
