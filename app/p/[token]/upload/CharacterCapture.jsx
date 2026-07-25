'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { POSES, POSE_COUNT, CAPTURE_INTRO, CAPTURE_INTRO_TITLE } from '@/lib/characterPoses';

// Full-screen guided camera for the client's "Character Build" reference shots.
// Someone else takes the photos (no selfies) — rear camera by default. Uses a
// live getUserMedia preview with a pose outline when available, and falls back
// to the phone's native camera (one tap per shot) if the live preview can't run.

const CSS = `
#ccap{position:fixed;inset:0;z-index:1000;background:#0b0710;color:#eae6f0;display:flex;flex-direction:column;
  font:16px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;--neon:#38b6ff;--album:#7c5cff;--red:#ff3b63;}
#ccap *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
#ccap .top{display:flex;align-items:center;gap:10px;padding:12px 14px;background:#0b0710;border-bottom:1px solid #221a30;}
#ccap .top .ttl{font-weight:800;font-size:16px;color:#f4f1f8;}
#ccap .top .x{margin-left:auto;background:none;border:none;color:#93a3b6;font-size:26px;line-height:1;cursor:pointer;padding:0 4px;}
#ccap .body{flex:1;overflow-y:auto;padding:16px 16px 24px;}
#ccap h1{font-size:26px;margin:6px 0 10px;color:#f4f1f8;font-weight:800;}
#ccap .lead{color:#aab6c4;font-size:15px;margin:0 0 14px;}
#ccap .guide{list-style:none;padding:0;margin:0 0 20px;}
#ccap .guide li{position:relative;padding:9px 12px 9px 40px;border:1px solid #2c2438;border-radius:12px;margin-bottom:8px;font-size:14.5px;background:#141020;}
#ccap .guide li::before{content:"✓";position:absolute;left:12px;top:9px;color:var(--neon);font-weight:800;}
#ccap .btn{display:block;width:100%;border:1.5px solid var(--neon);background:var(--album);color:#fff;border-radius:16px;padding:16px;font-size:18px;font-weight:800;cursor:pointer;text-align:center;}
#ccap .btn.ghost{background:transparent;color:var(--neon);}
#ccap .btn.red{border-color:var(--red);background:transparent;color:var(--red);}
#ccap .btn+.btn{margin-top:10px;}

/* live camera stage */
#ccap .stage{position:relative;flex:1;background:#000;overflow:hidden;display:flex;align-items:center;justify-content:center;}
#ccap video,#ccap .shot{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000;}
#ccap .ovl{position:absolute;inset:0;pointer-events:none;display:flex;align-items:center;justify-content:center;}
#ccap .ovl svg{width:78%;height:78%;opacity:.85;}
#ccap .hud{position:absolute;left:0;right:0;top:0;padding:12px 14px;display:flex;flex-direction:column;gap:6px;background:linear-gradient(180deg,rgba(0,0,0,.65),transparent);}
#ccap .hudrow{display:flex;align-items:center;gap:10px;}
#ccap .counter{font-size:13px;font-weight:800;color:#0b0710;background:var(--neon);border-radius:999px;padding:3px 10px;}
#ccap .shotname{font-size:18px;font-weight:800;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.8);}
#ccap .hint{font-size:13.5px;color:#e6eef5;text-shadow:0 1px 4px rgba(0,0,0,.9);}
#ccap .flip{margin-left:auto;background:rgba(255,255,255,.16);border:1.5px solid rgba(255,255,255,.55);color:#fff;border-radius:10px;padding:6px 11px;font-size:16px;font-weight:800;cursor:pointer;}
#ccap .retake{margin-top:8px;font-size:12.5px;font-weight:800;color:#0b0710;background:var(--neon);display:inline-block;padding:4px 11px;border-radius:999px;align-self:flex-start;}
#ccap .dots{position:absolute;left:0;right:0;bottom:96px;display:flex;gap:5px;justify-content:center;flex-wrap:wrap;padding:0 12px;}
#ccap .dot{width:11px;height:11px;border-radius:999px;background:rgba(255,255,255,.3);border:1px solid rgba(255,255,255,.5);cursor:pointer;}
#ccap .dot.done{background:var(--neon);border-color:var(--neon);}
#ccap .dot.cur{outline:2px solid #fff;outline-offset:1px;}
#ccap .controls{position:absolute;left:0;right:0;bottom:0;padding:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;background:linear-gradient(0deg,rgba(0,0,0,.7),transparent);}
#ccap .cbtn{background:rgba(255,255,255,.14);border:1.5px solid rgba(255,255,255,.5);color:#fff;border-radius:14px;padding:12px 14px;font-size:14px;font-weight:700;cursor:pointer;min-width:76px;}
#ccap .shutter{width:74px;height:74px;border-radius:999px;background:#fff;border:5px solid rgba(255,255,255,.55);cursor:pointer;flex:0 0 auto;}
#ccap .shutter:active{transform:scale(.94);}
#ccap .review{position:absolute;left:0;right:0;bottom:0;padding:16px;display:flex;gap:12px;background:linear-gradient(0deg,rgba(0,0,0,.8),transparent);}
#ccap .review .cbtn{flex:1;text-align:center;font-size:16px;padding:15px;}
#ccap .review .use{background:var(--album);border-color:var(--neon);}
#ccap .msg{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,.8);color:#fff;padding:12px 18px;border-radius:12px;font-weight:700;font-size:14px;text-align:center;max-width:80%;}
#ccap .fallback{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;background:#0b0710;}
#ccap .fallback .fbtn{border:1.5px solid var(--neon);background:var(--album);color:#fff;border-radius:16px;padding:18px 22px;font-size:18px;font-weight:800;cursor:pointer;}
#ccap .qrwrap{display:flex;flex-direction:column;align-items:center;gap:14px;margin:8px 0 6px;}
#ccap .qrcard{background:#fff;border-radius:18px;padding:16px;width:264px;height:264px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 30px rgba(0,0,0,.4);}
#ccap .qrcard img{width:100%;height:100%;display:block;}
#ccap .qrnote{font-size:13.5px;color:#aab6c4;text-align:center;max-width:360px;line-height:1.5;}
#ccap .smalllink{background:none;border:none;color:#93a3b6;text-decoration:underline;font-size:13px;cursor:pointer;padding:8px;display:block;margin:0 auto;}
`;

// Simple dashed outline guides per pose (viewBox 100x100).
function Overlay({ kind }) {
  const S = { fill: 'none', stroke: '#38b6ff', strokeWidth: 1.4, strokeDasharray: '4 3', strokeLinecap: 'round', strokeLinejoin: 'round' };
  let shape = null;
  if (kind === 'faceFront') {
    shape = (<g {...S}><ellipse cx="50" cy="40" rx="21" ry="27" /><path d="M26 92 C30 74 70 74 74 92" /></g>);
  } else if (kind === 'face34l' || kind === 'face34r') {
    const flip = kind === 'face34r' ? 'scale(-1,1) translate(-100,0)' : '';
    shape = (<g {...S} transform={flip}><ellipse cx="54" cy="40" rx="20" ry="27" /><path d="M34 40 q-4 2 0 8" /><path d="M28 92 C33 74 71 74 76 92" /></g>);
  } else if (kind === 'profileL' || kind === 'profileR') {
    const flip = kind === 'profileR' ? 'scale(-1,1) translate(-100,0)' : '';
    shape = (<g {...S} transform={flip}><path d="M60 14 C42 14 34 30 34 40 C34 46 30 48 30 52 C30 55 34 55 34 58 C34 70 46 74 58 72" /><path d="M30 92 C34 76 66 76 72 92" /></g>);
  } else if (kind === 'bodyFront' || kind === 'bodyBack') {
    shape = (<g {...S}><circle cx="50" cy="14" r="8" /><path d="M50 22 L50 60 M50 30 L34 46 M50 30 L66 46 M50 60 L40 92 M50 60 L60 92" /></g>);
  } else if (kind === 'bodySide') {
    shape = (<g {...S}><circle cx="50" cy="14" r="8" /><path d="M50 22 L50 60 M50 32 L44 48 M50 60 L46 92 M50 60 L54 92" /></g>);
  }
  return (<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">{shape}</svg>);
}

export default function CharacterCapture({ token, existing = [], onClose, onChanged }) {
  const doneSet = new Set(existing);                 // sort_numbers already captured
  const firstTodo = Math.max(0, POSES.findIndex((_, i) => !doneSet.has(i + 1)));
  const [stage, setStage] = useState('intro');       // 'intro' | 'capture' | 'finished'
  const [idx, setIdx] = useState(firstTodo === -1 ? 0 : firstTodo);
  const [captured, setCaptured] = useState(doneSet);  // Set<number> (1-based)
  const [facing, setFacing] = useState('environment');
  const [preview, setPreview] = useState(null);       // { blob, url } pending accept
  const [busy, setBusy] = useState('');               // '' | 'uploading' | message
  const [camError, setCamError] = useState(false);    // live preview unavailable → native fallback
  // Desktop users can't do the "someone else photographs you" flow on a webcam,
  // so we hand them to their phone with a QR code.
  const [isDesktop] = useState(() => {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const mobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
    const narrow = window.matchMedia('(max-width: 820px)').matches;
    const noTouch = !('ontouchstart' in window) && (navigator.maxTouchPoints || 0) === 0;
    return !mobileUA && !narrow && noTouch;
  });

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const nativeRef = useRef(null);   // native camera <input>
  const extraRef = useRef(null);    // "upload your own" <input>

  const pose = POSES[idx];

  const stopStream = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
  }, []);

  const startStream = useCallback(async () => {
    stopStream();
    if (!navigator.mediaDevices?.getUserMedia) { setCamError(true); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
      setCamError(false);
    } catch {
      setCamError(true);
    }
  }, [facing, stopStream]);

  // (Re)start the camera whenever we're capturing and not reviewing a shot.
  useEffect(() => {
    if (stage === 'capture' && !preview && !camError) startStream();
    return undefined;
  }, [stage, preview, facing, camError, startStream]);

  useEffect(() => () => stopStream(), [stopStream]);  // cleanup on unmount

  function close() { stopStream(); onClose?.(); }

  // ---- upload one blob to a guided slot (retake-safe) or as an extra ----
  async function putBlob(blob, contentType) {
    const urlRes = await fetch('/api/portal/upload-url', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, contentType }),
    });
    if (!urlRes.ok) throw new Error('Could not start upload');
    const { url, key } = await urlRes.json();
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
      xhr.onerror = () => reject(new Error('Upload failed — check your connection'));
      xhr.send(blob);
    });
    return key;
  }

  async function saveSlot(blob) {
    setBusy('uploading');
    try {
      const key = await putBlob(blob, 'image/jpeg');
      const res = await fetch('/api/portal/character', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'slot', sortNumber: idx + 1, key, filename: `${String(idx + 1).padStart(2, '0')}-${pose.slug}.jpg`, contentType: 'image/jpeg' }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Could not save'); }
      const next = new Set(captured); next.add(idx + 1); setCaptured(next);
      setPreview(null); setBusy('');
      onChanged?.();
      advance(next);
    } catch (e) {
      setBusy(e.message || 'Something went wrong');
      setTimeout(() => setBusy(''), 2500);
    }
  }

  function advance(doneNow) {
    const remaining = POSES.findIndex((_, i) => !doneNow.has(i + 1));
    if (remaining === -1) { stopStream(); setStage('finished'); markComplete(); }
    else setIdx(remaining);
  }

  async function markComplete() {
    try {
      await fetch('/api/portal/character', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'done' }),
      });
    } catch { /* best-effort: sheet can still be built from admin */ }
  }

  // ---- capture from the live video ----
  function shoot() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    c.toBlob((blob) => { if (blob) setPreview({ blob, url: URL.createObjectURL(blob) }); }, 'image/jpeg', 0.92);
  }

  // native camera fallback (one photo per shot)
  function onNativePick(e) {
    const file = e.target.files?.[0]; e.target.value = '';
    if (file) setPreview({ blob: file, url: URL.createObjectURL(file) });
  }

  // client's own uploads → extras
  async function onExtraPick(e) {
    const files = Array.from(e.target.files || []); e.target.value = '';
    if (!files.length) return;
    setBusy('uploading');
    try {
      for (const f of files) {
        /* eslint-disable no-await-in-loop */
        const key = await putBlob(f, f.type || 'image/jpeg');
        await fetch('/api/portal/character', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, action: 'extra', key, filename: f.name, contentType: f.type || 'image/jpeg' }),
        });
        /* eslint-enable no-await-in-loop */
      }
      setBusy(''); onChanged?.();
      setBusy('Added your photos ✓'); setTimeout(() => setBusy(''), 1800);
    } catch (e2) {
      setBusy(e2.message || 'Upload failed'); setTimeout(() => setBusy(''), 2500);
    }
  }

  const doneCount = captured.size;

  return (
    <div id="ccap">
      <style>{CSS}</style>
      <div className="top">
        <span className="ttl">Character Build</span>
        <span style={{ fontSize: 13, color: '#93a3b6' }}>{doneCount}/{POSE_COUNT}</span>
        <button className="x" onClick={close} aria-label="Close">×</button>
      </div>

      {stage === 'intro' && isDesktop && (
        <div className="body">
          <h1>Continue on your phone</h1>
          <p className="lead">Your character photo shoot happens on a phone — grab a friend to snap the pics (no selfies!). Scan this code to start on your phone and pick up right here.</p>
          <div className="qrwrap">
            <div className="qrcard"><img src={`/api/portal/character-qr?token=${encodeURIComponent(token)}`} alt="Scan to continue on your phone" width={232} height={232} /></div>
            <p className="qrnote">Point your phone’s camera at the code. You’ll enter your portal password on your phone, then go straight into the 12 photos.</p>
          </div>
          {busy && busy !== 'uploading' && <p className="qrnote" style={{ color: '#38b6ff' }}>{busy}</p>}
          <button className="btn ghost" onClick={() => extraRef.current?.click()}>Upload photos from this computer instead</button>
          <button className="btn ghost" onClick={close}>Not now</button>
          <button className="smalllink" onClick={() => setStage('capture')}>Use this computer’s camera anyway</button>
          <input ref={extraRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onExtraPick} />
        </div>
      )}

      {stage === 'intro' && !isDesktop && (
        <div className="body">
          <h1>{CAPTURE_INTRO_TITLE}</h1>
          <p className="lead">This is your character photo shoot! A dozen quick poses and you’re done. These stay separate — they’re not part of your event video.</p>
          <ul className="guide">{CAPTURE_INTRO.map((g, i) => <li key={i}>{g}</li>)}</ul>
          <button className="btn" onClick={() => setStage('capture')}>Let’s go — 12 quick photos →</button>
          <button className="btn ghost" onClick={() => extraRef.current?.click()}>Upload my own photos instead</button>
          <button className="btn ghost" onClick={close}>Not now</button>
          <input ref={extraRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onExtraPick} />
        </div>
      )}

      {stage === 'capture' && (
        <div className="stage">
          {!camError && <video ref={videoRef} playsInline muted />}
          {!camError && !preview && <div className="ovl"><Overlay kind={pose.overlay} /></div>}
          {preview && <img className="shot" src={preview.url} alt="review" />}

          {!preview && (
            <div className="hud">
              <div className="hudrow">
                <span className="counter">Shot {idx + 1} of {POSE_COUNT}</span>
                <span className="shotname">{pose.label}</span>
                {!camError && <button className="flip" onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))} title="Flip camera">⟲</button>}
              </div>
              <div className="hint">{pose.hint}</div>
              {captured.has(idx + 1) && <div className="retake">✓ Already taken — tap the shutter to redo it</div>}
            </div>
          )}

          {!preview && !camError && (
            <>
              <div className="dots">
                {POSES.map((p, i) => (
                  <span key={p.slug} className={`dot${captured.has(i + 1) ? ' done' : ''}${i === idx ? ' cur' : ''}`}
                    onClick={() => setIdx(i)} title={p.label} />
                ))}
              </div>
              <div className="controls">
                <button className="cbtn" disabled={idx === 0} onClick={() => setIdx((i) => Math.max(0, i - 1))}>‹ Back</button>
                <button className="shutter" onClick={shoot} aria-label="Take photo" />
                <button className="cbtn" onClick={() => (idx < POSE_COUNT - 1 ? setIdx((i) => i + 1) : advance(captured))}>{idx < POSE_COUNT - 1 ? 'Next ›' : 'Finish'}</button>
              </div>
            </>
          )}

          {preview && (
            <div className="review">
              <button className="cbtn" onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }}>↺ Retake</button>
              <button className="cbtn use" onClick={() => saveSlot(preview.blob)}>{busy === 'uploading' ? 'Saving…' : 'Use photo ✓'}</button>
            </div>
          )}

          {camError && !preview && (
            <div className="fallback">
              <div className="shotname">Shot {idx + 1} of {POSE_COUNT}: {pose.label}</div>
              <div className="hint" style={{ color: '#aab6c4' }}>{pose.hint}</div>
              <button className="fbtn" onClick={() => nativeRef.current?.click()}>📷 {captured.has(idx + 1) ? 'Redo this photo' : 'Take this photo'}</button>
              <div className="dots" style={{ position: 'static' }}>
                {POSES.map((p, i) => <span key={p.slug} className={`dot${captured.has(i + 1) ? ' done' : ''}${i === idx ? ' cur' : ''}`} onClick={() => setIdx(i)} />)}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn ghost" style={{ maxWidth: 150 }} disabled={idx === 0} onClick={() => setIdx((i) => Math.max(0, i - 1))}>‹ Back</button>
                <button className="btn ghost" style={{ maxWidth: 150 }} onClick={() => (idx < POSE_COUNT - 1 ? setIdx((i) => i + 1) : advance(captured))}>{idx < POSE_COUNT - 1 ? 'Next ›' : 'Finish'}</button>
              </div>
            </div>
          )}

          {busy && busy !== 'uploading' && <div className="msg">{busy}</div>}
          <input ref={nativeRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onNativePick} />
        </div>
      )}

      {stage === 'finished' && (
        <div className="body">
          <h1>That’s a wrap — nice! 🎉</h1>
          <p className="lead">All 12 shots are saved and sent to Main Event Studio. You’re all set!</p>
          <button className="btn" onClick={close}>Done</button>
          <button className="btn ghost" onClick={() => { setIdx(0); setStage('capture'); }}>Go back &amp; retake a shot</button>
          <button className="btn ghost" onClick={() => extraRef.current?.click()}>Add more of my own photos</button>
          <input ref={extraRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onExtraPick} />
        </div>
      )}
    </div>
  );
}
