'use client';

import { useCallback, useEffect, useState } from 'react';

export default function Viewer({ token }) {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);

  // Forward-to-vendor state (per open lightbox item).
  const [showForward, setShowForward] = useState(false);
  const [vEmail, setVEmail] = useState('');
  const [vNote, setVNote] = useState('');
  const [sending, setSending] = useState(false);
  const [fwMsg, setFwMsg] = useState(null);      // { ok:boolean, text:string }
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/media?token=${token}&scope=view`, { cache: 'no-store' });
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

  // Reset the forward panel whenever a different item is opened / closed.
  function openItem(m) {
    setActive(m);
    setShowForward(false);
    setVEmail(''); setVNote(''); setFwMsg(null); setCopied(false);
  }
  function closeItem() {
    setActive(null);
    setShowForward(false);
  }

  async function copyLink(m) {
    if (!m.shareUrl) return;
    try {
      await navigator.clipboard.writeText(m.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard blocked — fall back to the native share sheet if we can.
      shareLink(m);
    }
  }

  async function shareLink(m) {
    if (!m.shareUrl) return;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: m.filename || 'Main Event Studio', url: m.shareUrl }); } catch { /* user cancelled */ }
    } else {
      copyLink(m);
    }
  }

  async function sendForward(m) {
    setFwMsg(null);
    const email = vEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFwMsg({ ok: false, text: 'Enter a valid email address.' }); return; }
    setSending(true);
    try {
      const res = await fetch('/api/portal/forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, mediaId: m.id, vendorEmail: email, note: vNote.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Could not send.');
      setFwMsg({ ok: true, text: `Sent to ${email}.` });
      setVEmail(''); setVNote('');
    } catch (e) {
      setFwMsg({ ok: false, text: e.message || 'Could not send.' });
    }
    setSending(false);
  }

  const canShareNative = typeof navigator !== 'undefined' && !!navigator.share;

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
            <div key={m.id} style={{ position: 'relative' }}>
              <button
                className="media-cell"
                onClick={() => openItem(m)}
                title={m.filename}
                style={{ padding: 0, border: '1px solid var(--line)', cursor: 'pointer', width: '100%' }}
              >
                {isVideo(m) ? (
                  <video src={m.url} muted playsInline preload="metadata" />
                ) : (
                  <img src={m.url} alt={m.filename} loading="lazy" />
                )}
              </button>
              {m.shareUrl && (
                <a
                  href={m.shareUrl}
                  onClick={(e) => e.stopPropagation()}
                  title="Download"
                  style={{ position: 'absolute', top: 6, right: 6, zIndex: 4, width: 30, height: 30, borderRadius: '50%', background: 'rgba(0,0,0,.62)', color: '#fff', fontSize: 15, lineHeight: '30px', textAlign: 'center', textDecoration: 'none' }}
                >⤓</a>
              )}
            </div>
          ))}
        </div>
      )}

      {active && (
        <div
          onClick={closeItem}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.88)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 50,
            overflowY: 'auto',
          }}
        >
          <div style={{ maxWidth: '92vw', width: 640, margin: 'auto' }} onClick={(e) => e.stopPropagation()}>
            {isVideo(active) ? (
              <video src={active.url} controls autoPlay style={{ maxWidth: '92vw', maxHeight: '70vh', display: 'block', margin: '0 auto' }} />
            ) : (
              <img src={active.url} alt={active.filename} style={{ maxWidth: '92vw', maxHeight: '70vh', display: 'block', margin: '0 auto' }} />
            )}
            {active.note && (
              <p style={{ color: '#edebf2', textAlign: 'center', marginTop: 10 }}>{active.note}</p>
            )}

            {/* Actions: download + forward */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 14 }}>
              {active.shareUrl && (
                <a
                  href={active.shareUrl}
                  className="btn-primary"
                  style={{ textDecoration: 'none', padding: '10px 20px', borderRadius: 10, fontWeight: 700 }}
                >⤓ Download</a>
              )}
              {active.shareUrl && (
                <button type="button" className="btn-ghost" style={{ padding: '10px 18px', borderRadius: 10 }}
                  onClick={() => setShowForward((v) => !v)}>
                  ✉ Forward to a vendor
                </button>
              )}
              {active.shareUrl && (
                <button type="button" className="btn-ghost" style={{ padding: '10px 18px', borderRadius: 10 }}
                  onClick={() => (canShareNative ? shareLink(active) : copyLink(active))}>
                  {copied ? '✓ Link copied' : canShareNative ? '🔗 Share link' : '🔗 Copy link'}
                </button>
              )}
            </div>

            {showForward && active.shareUrl && (
              <div style={{ background: '#14101c', border: '1px solid var(--line)', borderRadius: 12, padding: 16, marginTop: 12 }}>
                <p style={{ color: '#cfc6e0', fontSize: 13, margin: '0 0 10px' }}>
                  Email this file to a vendor. They’ll get a download link — no sign-in needed. Replies come back to you.
                </p>
                <input
                  type="email"
                  value={vEmail}
                  onChange={(e) => setVEmail(e.target.value)}
                  placeholder="vendor@example.com"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', background: '#0d0a14', color: '#fff', marginBottom: 8 }}
                />
                <textarea
                  value={vNote}
                  onChange={(e) => setVNote(e.target.value)}
                  placeholder="Add a note (optional)"
                  rows={3}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', background: '#0d0a14', color: '#fff', marginBottom: 10, resize: 'vertical' }}
                />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button type="button" className="btn-primary" disabled={sending} style={{ padding: '9px 18px', borderRadius: 9, fontWeight: 700 }}
                    onClick={() => sendForward(active)}>
                    {sending ? 'Sending…' : 'Send to vendor'}
                  </button>
                  {fwMsg && (
                    <span style={{ fontSize: 13, color: fwMsg.ok ? '#4fce7c' : '#ff6b6b' }}>{fwMsg.text}</span>
                  )}
                </div>
              </div>
            )}

            <p style={{ textAlign: 'center', marginTop: 12 }}>
              <button className="btn-ghost" onClick={closeItem}>Close</button>
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
