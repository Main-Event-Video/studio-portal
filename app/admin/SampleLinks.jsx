'use client';

// SAMPLE LINKS (Josh 11/11) — folded under the "Sample links" pill beside New
// client. A library of sample clips uploaded ONCE, and any number of trackable
// links per clip to send prospective clients (/w/<slug>). Each link has who it's
// for, an optional page title and optional password; info@ is emailed on EVERY
// real open (see /api/watch/[slug]). Links can be turned off, archived, or
// deleted; clips are only ever archived from here, never deleted.
// The library itself opens and closes, closed on load like the other folds.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const BLUE = '#3d7bff', RED = '#ff2e4c', OK = '#37d99a';

const pillBtn = (color = 'var(--line)', fg = 'var(--text)') => ({
  background: 'transparent', border: `1px solid ${color}`, color: fg, borderRadius: 8,
  padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
});
const solidBtn = { background: BLUE, color: '#fff', border: 0, borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const kicker = { fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--muted)', margin: '20px 0 10px' };
const th = { fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' };
const td = { padding: '9px 6px', borderBottom: '1px solid var(--line)', verticalAlign: 'middle', fontSize: 14 };

const fmtDur = (s) => {
  const n = Math.round(Number(s) || 0);
  if (!n) return '';
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
};
const fmtWhen = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const today = new Date();
  const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `Today ${t}`;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${t}`;
};
const baseName = (f) => String(f || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();

// Average brightness (0-255) of what's on a canvas — used to skip black frames.
function brightness(ctx, w, h) {
  try {
    const d = ctx.getImageData(0, 0, w, h).data;
    let sum = 0, n = 0;
    for (let k = 0; k < d.length; k += 4 * 37) { sum += 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2]; n++; }
    return n ? sum / n : 0;
  } catch { return 255; } // can't read pixels → don't block on it
}

// Draw the current frame of a <video> to a JPEG blob (null if the browser refuses).
function frameToBlob(v) {
  return new Promise((resolve) => {
    try {
      const w = 640, h = Math.round((v.videoHeight / v.videoWidth) * 640) || 360;
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(v, 0, 0, w, h);
      c.toBlob((b) => resolve(b), 'image/jpeg', 0.85);
    } catch { resolve(null); }
  });
}

const seekTo = (v, t) => new Promise((res) => {
  const done = () => { v.removeEventListener('seeked', done); res(); };
  v.addEventListener('seeked', done);
  try { v.currentTime = t; } catch { res(); }
  setTimeout(done, 4000);
});

// Read duration + grab a still from the local file (no network, no CORS) for the
// library thumbnail. Skips dark frames (fade-ins): tries several moments and uses
// the first bright one, else the brightest it saw. Formats the browser can't
// decode just come back without a thumbnail.
function probeVideo(file) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'auto'; v.muted = true; v.playsInline = true;
    let settled = false;
    const finish = (out) => { if (!settled) { settled = true; try { URL.revokeObjectURL(v.src); } catch {} resolve(out); } };
    setTimeout(() => finish({ duration: Number.isFinite(v.duration) ? v.duration : null, thumb: null }), 25000);
    v.onerror = () => finish({ duration: null, thumb: null });
    v.onloadedmetadata = async () => {
      const d = Number.isFinite(v.duration) ? v.duration : null;
      const tries = [2, 4, (d || 10) * 0.15, (d || 10) * 0.3, (d || 10) * 0.5].map((t) => Math.min(t, Math.max(0, (d || 1) - 0.1)));
      const w = 160, h = Math.round((v.videoHeight / v.videoWidth) * 160) || 90;
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      let best = { t: tries[0], b: -1 };
      for (const t of tries) {
        await seekTo(v, t);
        try { ctx.drawImage(v, 0, 0, w, h); } catch { break; }
        const b = brightness(ctx, w, h);
        if (b > best.b) best = { t, b };
        if (b > 40) break;
      }
      await seekTo(v, best.t);
      finish({ duration: d, thumb: await frameToBlob(v) });
    };
    v.src = URL.createObjectURL(file);
  });
}

// PUT straight to R2 with progress (big files never touch Vercel).
function putWithProgress(url, body, contentType, onProgress) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('PUT', url);
    x.setRequestHeader('Content-Type', contentType);
    x.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new Error(`Upload failed (${x.status})`)));
    x.onerror = () => reject(new Error('Upload failed (network)'));
    x.send(body);
  });
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

// THUMBNAIL PICKER (Josh 11/11): slide through the clip and pick the frame for
// its thumbnail, or upload an image instead. Grabbing a frame from the stored
// clip needs the file storage to allow cross-origin reads; if it doesn't, the
// video still plays (reloaded without that flag) and only upload-an-image is offered.
function ThumbPicker({ sample, post, onDone, onCancel }) {
  const vref = useRef(null);
  const [cors, setCors] = useState(true);       // false = frames can't be grabbed
  const [dur, setDur] = useState(Number(sample.duration_s) || 0);
  const [t, setT] = useState(0);
  const [strip, setStrip] = useState([]);       // [{t, url}]
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  // Contact strip of 8 stills from a hidden copy of the clip.
  useEffect(() => {
    if (!cors || !sample.video_url) return;
    let alive = true;
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous'; v.muted = true; v.preload = 'auto'; v.playsInline = true;
    const urls = [];
    v.onloadedmetadata = async () => {
      const d = v.duration || dur || 1;
      const out = [];
      for (let k = 0; k < 8 && alive; k++) {
        const at = Math.min(d - 0.1, (d * (k + 0.5)) / 8);
        await seekTo(v, at);
        const b = await frameToBlob(v);
        if (!b) break;
        const u = URL.createObjectURL(b); urls.push(u); out.push({ t: at, url: u });
        if (alive) setStrip([...out]);
      }
    };
    v.src = sample.video_url;
    return () => { alive = false; urls.forEach((u) => URL.revokeObjectURL(u)); v.removeAttribute('src'); };
  }, [cors, sample.video_url]); // eslint-disable-line react-hooks/exhaustive-deps

  const jump = (sec) => { setT(sec); if (vref.current) { try { vref.current.currentTime = sec; } catch {} } };

  async function upload(blob, ct) {
    const u = await post({ action: 'upload-url', contentType: ct });
    await putWithProgress(u.url, blob, ct);
    await post({ action: 'set-thumb', id: sample.id, thumbKey: u.key });
  }

  async function useFrame() {
    setBusy(true); setMsg('');
    try {
      const b = await frameToBlob(vref.current);
      if (!b) { setCors(false); setMsg("This clip's frames can't be grabbed in the browser. Use Upload an image instead."); setBusy(false); return; }
      await upload(b, 'image/jpeg');
      onDone();
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  }

  async function useImage(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { setMsg('Please choose an image file (.jpg / .png).'); return; }
    setBusy(true); setMsg('');
    try { await upload(file, file.type); onDone(); } catch (e) { setMsg(e.message); }
    setBusy(false);
  }

  const fmt = (x) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`;

  return (
    <div style={{ marginTop: 16, border: `1px solid ${BLUE}`, borderRadius: 12, padding: 16, background: 'rgba(61,123,255,.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>Pick a thumbnail for &ldquo;{sample.title}&rdquo;</h3>
        <button type="button" style={pillBtn()} onClick={onCancel}>Cancel</button>
      </div>
      {sample.video_url ? (
        <div style={{ position: 'relative', maxWidth: 640 }}>
          <video key={cors ? 'c' : 'n'} ref={vref} src={sample.video_url} crossOrigin={cors ? 'anonymous' : undefined}
            muted playsInline preload="auto"
            onLoadedMetadata={(e) => { if (e.currentTarget.duration) setDur(e.currentTarget.duration); try { e.currentTarget.currentTime = t; } catch {} }}
            onError={() => { if (cors) { setCors(false); setMsg("Frames can't be grabbed from this clip in the browser, so slide-to-pick is off. Upload an image instead."); } }}
            style={{ width: '100%', aspectRatio: '16/9', background: '#000', borderRadius: 10, display: 'block' }} />
          <span style={{ position: 'absolute', right: 10, bottom: 8, fontSize: 12, background: 'rgba(0,0,0,.65)', padding: '2px 8px', borderRadius: 4, color: '#fff' }}>
            {fmt(t)} / {fmt(dur)}
          </span>
        </div>
      ) : <p style={{ color: 'var(--muted)' }}>Clip not available.</p>}
      {cors && dur > 0 && (
        <input type="range" min={0} max={Math.max(0.1, dur - 0.05)} step={0.04} value={t}
          onChange={(e) => jump(Number(e.target.value))}
          style={{ width: '100%', maxWidth: 640, margin: '14px 0 6px', accentColor: BLUE, display: 'block' }} />
      )}
      {cors && strip.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4, maxWidth: 640, marginBottom: 12 }}>
          {strip.map((f) => (
            <img key={f.t} src={f.url} alt="" onClick={() => jump(f.t)} title={`Jump to ${fmt(f.t)}`}
              style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 3, cursor: 'pointer', display: 'block' }} />
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        {cors && <button type="button" style={solidBtn} disabled={busy} onClick={useFrame}>{busy ? 'Saving…' : 'Use this frame'}</button>}
        <label style={{ ...pillBtn(cors ? 'var(--line)' : BLUE), display: 'inline-block' }}>
          Upload an image instead
          <input type="file" accept="image/*" style={{ display: 'none' }} disabled={busy}
            onChange={(e) => { useImage(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </div>
      {msg && <p className="msg-error">{msg}</p>}
    </div>
  );
}

export default function SampleLinks({ api }) {
  const [samples, setSamples] = useState([]);
  const [links, setLinks] = useState([]);
  const [err, setErr] = useState('');
  const [libOpen, setLibOpen] = useState(false);          // closed on load
  const [showArchivedClips, setShowArchivedClips] = useState(false);
  const [upload, setUpload] = useState(null);             // {name, pct, stage}
  const [pending, setPending] = useState(null);           // uploaded, waiting for a name
  const [renaming, setRenaming] = useState(null);         // {id, title}
  const [thumbFor, setThumbFor] = useState(null);         // sample id for the thumbnail picker
  const [linkOpen, setLinkOpen] = useState(false);        // New link form showing
  const [pickIds, setPickIds] = useState([]);             // clips on the new link, in tap order
  const [form, setForm] = useState({ recipient: '', title: '', password: '' });
  const [made, setMade] = useState(null);                 // the link just created
  const [tab, setTab] = useState('active');
  const [filterClip, setFilterClip] = useState(null);
  const [pwEdit, setPwEdit] = useState(null);             // {id, value}
  const [flash, setFlash] = useState('');
  const [drag, setDrag] = useState(false);

  const say = (m) => { setFlash(m); setTimeout(() => setFlash(''), 1800); };

  const load = useCallback(async () => {
    try {
      const j = await api('/api/admin/samples');
      setSamples(j.samples || []); setLinks(j.links || []); setErr('');
    } catch (e) { setErr(e.message); }
  }, [api]);
  useEffect(() => { load(); }, [load]);

  const post = async (body) => { const j = await api('/api/admin/samples', { method: 'POST', body: JSON.stringify(body) }); return j; };
  const byId = useMemo(() => Object.fromEntries(samples.map((s) => [s.id, s])), [samples]);
  const stats = useMemo(() => {
    const m = {};
    for (const l of links) for (const id of (l.sample_ids || [l.sample_id])) { const s = (m[id] ||= { links: 0, opens: 0 }); s.links++; s.opens += l.opens || 0; }
    return m;
  }, [links]);

  async function handleFile(file) {
    if (!file) return;
    if (!/^video\//.test(file.type) && !/\.(mp4|mov|m4v|webm)$/i.test(file.name)) { setErr('Please choose a video file (.mp4 / .mov).'); return; }
    setErr(''); setLibOpen(true);
    const ct = file.type || 'video/mp4';
    try {
      setUpload({ name: file.name, pct: 0, stage: 'Reading clip…' });
      const probe = await probeVideo(file);
      setUpload({ name: file.name, pct: 0, stage: 'Uploading…' });
      const { url, key } = await post({ action: 'upload-url', contentType: ct });
      await putWithProgress(url, file, ct, (p) => setUpload({ name: file.name, pct: p, stage: 'Uploading…' }));
      let thumbKey = null;
      if (probe.thumb) {
        try {
          const t = await post({ action: 'upload-url', contentType: 'image/jpeg' });
          await putWithProgress(t.url, probe.thumb, 'image/jpeg');
          thumbKey = t.key;
        } catch { /* thumbnail is optional */ }
      }
      setUpload(null);
      setPending({ key, thumbKey, filename: file.name, contentType: ct, size: file.size, duration: probe.duration, title: baseName(file.name) });
    } catch (e) { setUpload(null); setErr(e.message); }
  }

  async function savePending(e) {
    e?.preventDefault();
    try {
      await post({ action: 'create-sample', ...pending });
      setPending(null); await load(); say('Clip added');
    } catch (e2) { setErr(e2.message); }
  }

  async function saveRename(e) {
    e?.preventDefault();
    try { await post({ action: 'rename-sample', id: renaming.id, title: renaming.title }); setRenaming(null); await load(); }
    catch (e2) { setErr(e2.message); }
  }

  async function archiveClip(s, archived) {
    try { await post({ action: 'archive-sample', id: s.id, archived }); if (archived) setPickIds((p) => p.filter((x) => x !== s.id)); await load(); }
    catch (e) { setErr(e.message); }
  }

  // From a clip card: starts the link with that clip picked. From "＋ New link"
  // above the list: starts empty. More clips can be tapped on/off either way.
  function openNewLink(s) {
    setLinkOpen(true); setMade(null);
    setPickIds(s ? [s.id] : []);
    setForm({ recipient: '', title: '', password: '' });
  }
  const togglePick = (id) => setPickIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  async function createLink(e) {
    e?.preventDefault();
    try {
      if (!pickIds.length) { setErr('Pick at least one clip for this link.'); return; }
      const title = form.title.trim() || (pickIds.length > 1 ? 'Main Event Studio Samples' : '');
      const j = await post({ action: 'create-link', sampleIds: pickIds, ...form, title });
      setMade(j.link); await load();
    } catch (e2) { setErr(e2.message); }
  }

  async function updateLink(id, patch) {
    try { await post({ action: 'update-link', id, ...patch }); await load(); }
    catch (e) { setErr(e.message); }
  }
  async function deleteLink(l) {
    if (!window.confirm(`Delete the link for "${l.recipient || 'no name'}"? It will stop working for good. The clip stays in your library.`)) return;
    try { await post({ action: 'delete-link', id: l.id }); await load(); say('Link deleted'); }
    catch (e) { setErr(e.message); }
  }

  const copyLinkPw = async (l) => {
    const t = l.password ? `${l.url}\nPassword: ${l.password}` : l.url;
    say((await copy(t)) ? 'Copied' : 'Could not copy');
  };

  const visibleClips = samples.filter((s) => (showArchivedClips ? true : !s.archived_at));
  const archivedClipCount = samples.filter((s) => s.archived_at).length;
  const inTab = (l) => (tab === 'archived' ? !!l.archived_at : tab === 'off' ? !l.archived_at && !!l.disabled_at : !l.archived_at && !l.disabled_at);
  const counts = {
    active: links.filter((l) => !l.archived_at && !l.disabled_at).length,
    off: links.filter((l) => !l.archived_at && l.disabled_at).length,
    archived: links.filter((l) => l.archived_at).length,
  };
  const shownLinks = links.filter((l) => inTab(l) && (!filterClip || (l.sample_ids || [l.sample_id]).includes(filterClip)));

  return (
    <div style={{ marginTop: 16 }}>
      <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 6px' }}>
        Upload a clip once, then make as many links from it as you want. info@maineventstudio.com gets an email every time a link is opened.
      </p>
      {err && <p className="msg-error">{err}</p>}
      {flash && <p className="msg-ok" style={{ position: 'sticky', top: 8 }}>{flash}</p>}

      {/* ---- 1 · Sample library (fold) ---- */}
      <button type="button" onClick={() => setLibOpen((v) => !v)} aria-expanded={libOpen}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'var(--panel-2)', border: '1px solid var(--line)',
          borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 15, padding: '10px 14px', margin: '16px 0 12px', cursor: 'pointer', textAlign: 'left' }}>
        <span aria-hidden="true" style={{ color: BLUE, fontSize: 12 }}>{libOpen ? '▾' : '▸'}</span>
        Sample library <small style={{ color: 'var(--muted)', fontWeight: 500 }}>({samples.filter((s) => !s.archived_at).length} clips)</small>
      </button>

      {libOpen && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14 }}>
            <label
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]); }}
              style={{ border: `2px dashed ${BLUE}`, borderRadius: 12, display: 'grid', placeItems: 'center', textAlign: 'center',
                color: 'var(--muted)', minHeight: 190, padding: 12, cursor: upload ? 'default' : 'pointer',
                background: drag ? 'rgba(61,123,255,.15)' : 'rgba(61,123,255,.05)' }}>
              <input type="file" accept="video/*,.mov,.mp4,.m4v" style={{ display: 'none' }} disabled={!!upload}
                onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />
              {upload ? (
                <div style={{ width: '100%' }}>
                  <b style={{ color: '#fff', display: 'block', fontSize: 14, wordBreak: 'break-all' }}>{upload.name}</b>
                  <div style={{ fontSize: 13, margin: '6px 0' }}>{upload.stage} {upload.pct ? `${Math.round(upload.pct * 100)}%` : ''}</div>
                  <div style={{ height: 6, background: 'var(--line)', borderRadius: 4 }}>
                    <div style={{ height: 6, width: `${Math.round((upload.pct || 0) * 100)}%`, background: BLUE, borderRadius: 4 }} />
                  </div>
                </div>
              ) : (
                <div><b style={{ color: '#fff', display: 'block', fontSize: 15 }}>＋ Add a clip</b>Drop or click · .mp4 / .mov<br />You&apos;ll name it after it uploads</div>
              )}
            </label>

            {visibleClips.map((s) => {
              const st = stats[s.id] || { links: 0, opens: 0 };
              const selected = filterClip === s.id;
              return (
                <div key={s.id} onClick={() => setFilterClip(selected ? null : s.id)}
                  title="Click to show only this clip's links"
                  style={{ background: 'var(--panel-2)', border: `1px solid ${selected ? BLUE : 'var(--line)'}`, borderRadius: 12, overflow: 'hidden',
                    boxShadow: selected ? '0 0 16px rgba(61,123,255,.35)' : 'none', cursor: 'pointer', opacity: s.archived_at ? 0.55 : 1 }}>
                  <div style={{ aspectRatio: '16/9', background: '#000', position: 'relative', display: 'grid', placeItems: 'center' }}>
                    {s.thumb_url
                      ? <img src={s.thumb_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      : <span style={{ color: '#fff', fontSize: 26 }}>▶</span>}
                    {s.duration_s ? <span style={{ position: 'absolute', right: 8, bottom: 6, fontSize: 11, background: 'rgba(0,0,0,.65)', padding: '1px 6px', borderRadius: 4, color: '#fff' }}>{fmtDur(s.duration_s)}</span> : null}
                    {s.archived_at && <span style={{ position: 'absolute', left: 8, top: 6, fontSize: 10, fontWeight: 700, color: RED, border: `1px solid ${RED}`, borderRadius: 999, padding: '1px 7px', background: 'rgba(0,0,0,.6)' }}>ARCHIVED</span>}
                  </div>
                  <div style={{ padding: '10px 12px' }} onClick={(e) => e.stopPropagation()}>
                    {renaming?.id === s.id ? (
                      <form onSubmit={saveRename} style={{ display: 'flex', gap: 6 }}>
                        <input autoFocus value={renaming.title} onChange={(e) => setRenaming({ ...renaming, title: e.target.value })} style={{ flex: 1, padding: '5px 8px', fontSize: 13 }} />
                        <button type="submit" style={pillBtn(BLUE)}>Save</button>
                      </form>
                    ) : (
                      <b style={{ display: 'block', fontSize: 14, wordBreak: 'break-word' }}>{s.title}</b>
                    )}
                    <small style={{ color: 'var(--muted)', fontSize: 12 }}>
                      {st.links ? `${st.links} link${st.links === 1 ? '' : 's'} · ${st.opens} open${st.opens === 1 ? '' : 's'}` : 'No links yet'}
                    </small>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      {!s.archived_at && <button type="button" style={solidBtn} onClick={() => openNewLink(s)}>＋ New link</button>}
                      <button type="button" style={pillBtn()} onClick={() => setRenaming({ id: s.id, title: s.title })}>Rename</button>
                      <button type="button" style={pillBtn(thumbFor === s.id ? BLUE : 'var(--line)')} onClick={() => setThumbFor(thumbFor === s.id ? null : s.id)}>Thumbnail</button>
                      <button type="button" style={pillBtn()} onClick={() => archiveClip(s, !s.archived_at)}>{s.archived_at ? 'Unarchive' : 'Archive'}</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {archivedClipCount > 0 && (
            <button type="button" onClick={() => setShowArchivedClips((v) => !v)} style={{ ...pillBtn(), marginTop: 10 }}>
              {showArchivedClips ? 'Hide archived clips' : `Show archived clips (${archivedClipCount})`}
            </button>
          )}
        </>
      )}

      {/* Name a just-uploaded clip (shown even if the library is folded). */}
      {pending && (
        <form onSubmit={savePending} style={{ marginTop: 14, border: `1px solid ${OK}`, borderRadius: 12, padding: 14, background: 'rgba(55,217,154,.06)' }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>✅ Uploaded. Name this clip:</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input autoFocus value={pending.title} onChange={(e) => setPending({ ...pending, title: e.target.value })} style={{ flex: 1, minWidth: 220 }} />
            <button type="submit" style={{ ...solidBtn, padding: '10px 18px' }}>Save clip</button>
          </div>
          {!pending.thumbKey && <p style={{ color: 'var(--muted)', fontSize: 12, margin: '8px 0 0' }}>No thumbnail: this browser could not read a frame from the file. The clip still works.</p>}
        </form>
      )}

      {thumbFor && byId[thumbFor] && (
        <ThumbPicker key={thumbFor} sample={byId[thumbFor]} post={post}
          onCancel={() => setThumbFor(null)}
          onDone={async () => { setThumbFor(null); await load(); say('Thumbnail updated'); }} />
      )}

      {/* ---- New link form ---- */}
      {linkOpen && (
        <form onSubmit={createLink} style={{ marginTop: 16, border: `1px solid ${BLUE}`, borderRadius: 12, padding: 16, background: 'rgba(61,123,255,.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>New link</h3>
            <button type="button" style={pillBtn()} onClick={() => { setLinkOpen(false); setMade(null); }}>Close</button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 6px' }}>
            Clips on this link: tap to add or remove. They show to the client in the order you tap them. One clip plays straight away; two or more give the client a list to choose from.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 14 }}>
            {samples.filter((x) => !x.archived_at).map((x) => {
              const n = pickIds.indexOf(x.id) + 1;
              return (
                <button key={x.id} type="button" onClick={() => togglePick(x.id)}
                  style={{ border: `1px solid ${n ? BLUE : 'var(--line)'}`, borderRadius: 10, overflow: 'hidden', background: 'var(--panel-2)',
                    position: 'relative', padding: 0, cursor: 'pointer', textAlign: 'left', color: 'var(--text)',
                    boxShadow: n ? '0 0 12px rgba(61,123,255,.35)' : 'none' }}>
                  <span style={{ display: 'block', aspectRatio: '16/9', background: '#000' }}>
                    {x.thumb_url && <img src={x.thumb_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: n ? 1 : 0.6 }} />}
                  </span>
                  <span style={{ position: 'absolute', left: 6, top: 6, width: 22, height: 22, borderRadius: 6, border: `2px solid ${n ? BLUE : '#fff'}`,
                    background: n ? BLUE : 'rgba(0,0,0,.4)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 900, color: '#fff' }}>{n || ''}</span>
                  <span style={{ display: 'block', fontSize: 12, padding: '6px 8px', fontWeight: 600 }}>{x.title}</span>
                </button>
              );
            })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Who&apos;s it for? (shows in the open emails)</label>
              <input value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} placeholder="Jennifer Lee – Bat Mitzvah inquiry" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Title on the page</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={pickIds.length > 1 ? 'Main Event Studio Samples' : (byId[pickIds[0]]?.title || 'Clip name')} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Password (optional, blank = none)</label>
              <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="off" />
            </div>
            <div><button type="submit" disabled={!pickIds.length} style={{ ...solidBtn, padding: '10px 18px', fontSize: 14, opacity: pickIds.length ? 1 : 0.5 }}>Create link{pickIds.length > 1 ? ` (${pickIds.length} clips)` : ''}</button></div>
          </div>
          {made && (
            <div style={{ marginTop: 12, border: `1px solid ${OK}`, borderRadius: 10, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: 'rgba(55,217,154,.06)' }}>
              <span>✅ Link ready:</span>
              <code className="mono" style={{ flex: 1, minWidth: 200, wordBreak: 'break-all' }}>
                {made.url}{made.password ? <><br /><span style={{ color: 'var(--muted)' }}>Password: {made.password}</span></> : null}
              </code>
              <button type="button" style={pillBtn(BLUE)} onClick={async () => say((await copy(made.url)) ? 'Copied' : 'Could not copy')}>Copy link</button>
              {made.password && <button type="button" style={pillBtn(BLUE)} onClick={() => copyLinkPw(made)}>Copy link + password</button>}
              <a href={`${made.url}?studio=1`} target="_blank" rel="noreferrer" style={{ ...pillBtn(), textDecoration: 'none' }}>Preview</a>
            </div>
          )}
        </form>
      )}

      {/* ---- 2 · All links ---- */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <p style={kicker}>All links</p>
        {!linkOpen && samples.some((x) => !x.archived_at) && (
          <button type="button" style={solidBtn} onClick={() => openNewLink(null)}>＋ New link</button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        {[['active', 'Active'], ['off', 'Turned off'], ['archived', 'Archived']].map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            style={{ fontSize: 13, padding: '5px 12px', borderRadius: 999, cursor: 'pointer', background: 'transparent',
              border: `1px solid ${tab === k ? BLUE : 'var(--line)'}`, color: tab === k ? '#fff' : 'var(--muted)' }}>
            {label} ({counts[k]})
          </button>
        ))}
        {filterClip && byId[filterClip] && (
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            Only &ldquo;{byId[filterClip].title}&rdquo; ·{' '}
            <button type="button" onClick={() => setFilterClip(null)} style={{ ...pillBtn(BLUE), padding: '2px 8px' }}>Show all</button>
          </span>
        )}
      </div>

      {shownLinks.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>
          {links.length ? 'No links here.' : 'No links yet. Open the Sample library, add a clip, then click ＋ New link.'}
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>For</th><th style={th}>Clip</th><th style={th}>Password</th><th style={th}>Opens</th><th style={th}>Last opened</th><th style={th}></th></tr></thead>
            <tbody>
              {shownLinks.map((l) => {
                const ids = l.sample_ids || [l.sample_id];
                const s = byId[ids[0]];
                return (
                  <tr key={l.id}>
                    <td style={td}>
                      {l.recipient || <span style={{ color: 'var(--muted)' }}>No name</span>}
                      {l.disabled_at && !l.archived_at && <span style={{ color: RED, fontSize: 11, fontWeight: 700, border: `1px solid ${RED}`, borderRadius: 999, padding: '1px 7px', marginLeft: 6 }}>OFF</span>}
                    </td>
                    <td style={td}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 56, aspectRatio: '16/9', borderRadius: 4, overflow: 'hidden', background: '#000', display: 'inline-block', flex: 'none' }}>
                          {s?.thumb_url && <img src={s.thumb_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                        </span>
                        <span>
                          {l.title || s?.title || '—'}
                          {ids.length > 1 && <small style={{ color: 'var(--muted)', marginLeft: 6 }}>({ids.length} videos)</small>}
                        </span>
                      </span>
                      {ids.length > 1 && (
                        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                          {ids.map((id) => {
                            const n = (l.plays || {})[id] || 0;
                            return (
                              <div key={id}>
                                • {byId[id]?.title || 'Removed clip'} —{' '}
                                <b style={{ color: n ? OK : 'var(--muted)' }}>{n} play{n === 1 ? '' : 's'}</b>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {pwEdit?.id === l.id ? (
                        <form onSubmit={async (e) => { e.preventDefault(); await updateLink(l.id, { password: pwEdit.value }); setPwEdit(null); }} style={{ display: 'flex', gap: 6 }}>
                          <input autoFocus value={pwEdit.value} onChange={(e) => setPwEdit({ ...pwEdit, value: e.target.value })} placeholder="blank = no password" style={{ width: 140, padding: '5px 8px', fontSize: 13 }} />
                          <button type="submit" style={pillBtn(BLUE)}>Save</button>
                          <button type="button" style={pillBtn()} onClick={() => setPwEdit(null)}>✕</button>
                        </form>
                      ) : l.password ? (
                        <>🔒 <span className="mono">{l.password}</span> <button type="button" style={pillBtn()} onClick={() => setPwEdit({ id: l.id, value: l.password })}>Change</button></>
                      ) : (
                        <><span style={{ color: 'var(--muted)' }}>None</span> <button type="button" style={pillBtn()} onClick={() => setPwEdit({ id: l.id, value: '' })}>Add</button></>
                      )}
                    </td>
                    <td style={{ ...td, fontWeight: 800, color: l.opens ? OK : 'var(--muted)' }}>{l.opens || 0}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtWhen(l.last_opened_at)}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', gap: 6 }}>
                        {!l.archived_at && !l.disabled_at && <button type="button" style={pillBtn(BLUE)} onClick={() => copyLinkPw(l)} title={l.password ? 'Copies the link and its password' : 'Copies the link'}>Copy</button>}
                        {!l.archived_at && !l.disabled_at && <a href={`${l.url}?studio=1`} target="_blank" rel="noreferrer" style={{ ...pillBtn(), textDecoration: 'none' }}>Preview</a>}
                        {!l.archived_at && (l.disabled_at
                          ? <button type="button" style={pillBtn(BLUE)} onClick={() => updateLink(l.id, { disabled: false })}>Turn on</button>
                          : <button type="button" style={pillBtn()} onClick={() => updateLink(l.id, { disabled: true })}>Turn off</button>)}
                        {l.archived_at
                          ? <button type="button" style={pillBtn(BLUE)} onClick={() => updateLink(l.id, { archived: false })}>Unarchive</button>
                          : <button type="button" style={pillBtn()} onClick={() => updateLink(l.id, { archived: true })}>Archive</button>}
                        <button type="button" style={pillBtn(RED, RED)} onClick={() => deleteLink(l)}>Delete</button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 10 }}>
        Turn off and Archive both stop a link working (you can undo either). Delete removes the link for good; the clip stays in the library. Preview never counts as an open.
      </p>
    </div>
  );
}
