'use client';

import { useCallback, useEffect, useState } from 'react';

export default function Viewer({ token }) {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/media?token=${token}&scope=view`);
      const j = await res.json();
      setMedia(j.media || []);
    } catch {
      setMedia([]);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const isVideo = (m) => (m.contentType || '').startsWith('video');

  return (
    <main className="wrap hub">
      <a href={`/p/${token}`} className="backlink">← Back to your portal</a>

      <p className="eyebrow">From Main Event Studio</p>
      <h1 className="neon neon-blue" style={{ fontSize: 26, margin: '4px 0 14px' }}>
        Take a look at what we sent you
      </h1>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : media.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>
          Nothing here yet. When Main Event Studio sends you a cut or photos, they’ll show up here.
        </p>
      ) : (
        <div className="media-grid">
          {media.map((m) => (
            <button
              key={m.id}
              className="media-cell"
              onClick={() => setActive(m)}
              title={m.filename}
              style={{ padding: 0, border: '1px solid var(--line)', cursor: 'pointer' }}
            >
              {isVideo(m) ? (
                <video src={m.url} muted playsInline preload="metadata" />
              ) : (
                <img src={m.url} alt={m.filename} loading="lazy" />
              )}
            </button>
          ))}
        </div>
      )}

      {active && (
        <div
          onClick={() => setActive(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.88)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 50,
          }}
        >
          <div style={{ maxWidth: '92vw', maxHeight: '92vh' }} onClick={(e) => e.stopPropagation()}>
            {isVideo(active) ? (
              <video src={active.url} controls autoPlay style={{ maxWidth: '92vw', maxHeight: '82vh' }} />
            ) : (
              <img src={active.url} alt={active.filename} style={{ maxWidth: '92vw', maxHeight: '82vh' }} />
            )}
            {active.note && (
              <p style={{ color: '#edebf2', textAlign: 'center', marginTop: 10 }}>{active.note}</p>
            )}
            <p style={{ textAlign: 'center', marginTop: 8 }}>
              <button className="btn-ghost" onClick={() => setActive(null)}>Close</button>
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
