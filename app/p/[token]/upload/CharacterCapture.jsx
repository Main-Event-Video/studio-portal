'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { POSES, POSE_COUNT, CAPTURE_INTRO, CAPTURE_INTRO_TITLE } from '@/lib/characterPoses';

// ---- Studio character voices (spoken guidance) ------------------------------
// The six personalities from the studio builder. Clips live in
// public/character-voices/<theme>/<key>.mp3 and are played per pose. Best-effort:
// a missing clip just plays nothing.
const VOICE_THEMES = [
  ['warm', '😊 Friendly'],
  ['mommy', '🤗 Sweet'],
  ['drill', '🪖 Drill sgt'],
  ['cockney', '🎩 Cockney'],
  ['robotic', '🤖 Robot'],
  ['pirate', '🏴‍☠️ Pirate'],
];
// Map each of the 12 canonical poses to its voice clip key.
const VOICE_FOR_POSE = {
  'face-front-neutral': 'neutral',
  'face-front-smile': 'smile',
  'face-front-angry': 'angry',
  'face-34-left': 'face34left',
  'face-34-right': 'face34right',
  'face-profile-left': 'profileleft',
  'face-profile-right': 'profileright',
  'head-top': 'headtop',
  'body-front-apose': 'bodyfront',
  'body-back': 'bodyback',
  'body-left': 'bodyleft',
  'body-right': 'bodyright',
};

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
#ccap .top .back{background:rgba(255,255,255,.08);border:1.5px solid rgba(255,255,255,.28);color:#cbd5e1;border-radius:10px;padding:6px 11px;font-size:14px;font-weight:800;cursor:pointer;}
#ccap .nameinput{width:100%;padding:14px;border-radius:14px;border:1.5px solid #2c2438;background:#141020;color:#eae6f0;font-size:18px;margin:2px 0 14px;}
#ccap .nameinput:focus{outline:none;border-color:var(--neon);}
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
#ccap .posebox{background:rgba(11,7,16,.82);border:2px solid var(--red);border-radius:12px;padding:10px 12px;margin-top:4px;box-shadow:0 3px 14px rgba(0,0,0,.55);display:flex;gap:12px;align-items:center;}
#ccap .posetext{flex:1;min-width:0;}
#ccap .posebox .shotname{font-size:21px;display:block;}
#ccap .posebox .hint{font-size:15.5px;color:#fff;margin-top:4px;line-height:1.35;}
/* animated "how to move" figure (looping front -> pose -> front) */
#ccap .pd{position:relative;width:58px;height:80px;flex:0 0 auto;perspective:560px;display:flex;align-items:center;justify-content:center;}
#ccap .pdarrow{position:absolute;bottom:-3px;left:0;right:0;text-align:center;font-size:22px;font-weight:900;line-height:1;color:var(--neon);text-shadow:0 1px 4px rgba(0,0,0,.95),0 0 3px rgba(0,0,0,.9);}
#ccap .pds{transform:scale(.58);transform-origin:center;}
#ccap .pdhead{position:relative;width:78px;height:96px;transform-style:preserve-3d;animation:pd-turn 2.8s ease-in-out infinite;}
#ccap .pdskin{position:absolute;inset:0;background:#e9b48c;border-radius:46% 46% 44% 44%/52% 52% 46% 46%;}
#ccap .pdhair{position:absolute;left:-4px;right:-4px;top:-8px;height:38px;background:#3a3040;border-radius:46% 46% 40% 40%;transform:translateZ(-6px);}
#ccap .pdear{position:absolute;top:44px;width:12px;height:18px;background:#e0a87f;border-radius:50%;}
#ccap .pdear.l{left:-6px;transform:translateZ(-2px);}#ccap .pdear.r{right:-6px;transform:translateZ(-2px);}
#ccap .pdeye{position:absolute;top:40px;width:9px;height:9px;background:#241f2b;border-radius:50%;}
#ccap .pdeye.l{left:18px;}#ccap .pdeye.r{right:18px;}
#ccap .pdbrow{position:absolute;top:32px;width:14px;height:4px;background:#2a2330;border-radius:3px;}
#ccap .pdbrow.l{left:15px;}#ccap .pdbrow.r{right:15px;}
#ccap .pdnose{position:absolute;left:50%;top:46px;width:9px;height:20px;margin-left:-4.5px;background:#dda27a;border-radius:0 0 50% 50%;transform:translateZ(16px);}
#ccap .pdmouth{position:absolute;left:50%;top:74px;width:26px;height:10px;margin-left:-13px;border-bottom:4px solid #7a4a4a;border-radius:0 0 40% 40%;transform:translateZ(4px);}
#ccap .pdbody{position:relative;width:60px;height:130px;transform-style:preserve-3d;animation:pd-turn 2.8s ease-in-out infinite;}
#ccap .pdbhead{position:absolute;left:50%;top:0;width:26px;height:26px;margin-left:-13px;background:#e9b48c;border-radius:50%;}
#ccap .pdtorso{position:absolute;left:50%;top:24px;width:34px;height:52px;margin-left:-17px;background:#6f8fb0;border-radius:12px 12px 8px 8px;}
#ccap .pdarm{position:absolute;top:28px;width:9px;height:44px;background:#e9b48c;border-radius:6px;}
#ccap .pdarm.l{left:2px;transform:rotate(12deg);}#ccap .pdarm.r{right:2px;transform:rotate(-12deg);}
#ccap .pdleg{position:absolute;top:74px;width:12px;height:52px;background:#33344a;border-radius:6px;}
#ccap .pdleg.l{left:12px;}#ccap .pdleg.r{right:12px;}
#ccap .pdbnose{position:absolute;left:50%;top:8px;width:6px;height:8px;margin-left:-3px;background:#c99;transform:translateZ(13px);border-radius:0 0 40% 40%;}
@keyframes pd-turn{0%{transform:rotateY(0deg) rotateX(0deg)}42%{transform:var(--tf)}72%{transform:var(--tf)}100%{transform:rotateY(0deg) rotateX(0deg)}}
@media (prefers-reduced-motion: reduce){#ccap .pdhead,#ccap .pdbody{animation:none;transform:var(--tf);}}
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

// Small animated figure that loops the movement for the current pose (front ->
// pose -> front), from the camera's point of view (so it matches the outline).
const POSE_DEMO = {
  'face-front-neutral': { type: 'head', tf: 'rotateY(0deg) rotateX(9deg)' },
  'face-front-smile':   { type: 'head', tf: 'rotateY(0deg) rotateX(9deg)', mouth: 'smile' },
  'face-front-angry':   { type: 'head', tf: 'rotateY(0deg) rotateX(9deg)', brow: 'angry' },
  'face-34-left':       { type: 'head', tf: 'rotateY(40deg) rotateX(0deg)', arrow: 'right' },
  'face-34-right':      { type: 'head', tf: 'rotateY(-40deg) rotateX(0deg)', arrow: 'left' },
  'face-profile-left':  { type: 'head', tf: 'rotateY(80deg) rotateX(0deg)', arrow: 'right' },
  'face-profile-right': { type: 'head', tf: 'rotateY(-80deg) rotateX(0deg)', arrow: 'left' },
  'head-top':           { type: 'head', tf: 'rotateY(0deg) rotateX(-72deg)' },
  'body-front-apose':   { type: 'body', tf: 'rotateY(0deg) rotateX(6deg)' },
  'body-back':          { type: 'body', tf: 'rotateY(180deg) rotateX(0deg)', arrow: 'circle' },
  'body-left':          { type: 'body', tf: 'rotateY(58deg) rotateX(0deg)', arrow: 'right' },
  'body-right':         { type: 'body', tf: 'rotateY(-58deg) rotateX(0deg)', arrow: 'left' },
};

function PoseDemo({ slug }) {
  const d = POSE_DEMO[slug] || { type: 'head', tf: 'rotateY(0deg) rotateX(0deg)' };
  const s = { '--tf': d.tf };
  const mouth = d.mouth === 'smile' ? { borderBottomColor: '#7a4a4a', height: 14, borderRadius: '0 0 60% 60%' } : undefined;
  const brow = d.brow === 'angry' ? { transform: 'rotate(14deg)', top: 34 } : undefined;
  return (
    <div className="pd" aria-hidden="true">
      <div className="pds">
        {d.type === 'head' ? (
          <div className="pdhead" style={s}>
            <div className="pdhair" /><div className="pdear l" /><div className="pdear r" /><div className="pdskin" />
            <div className="pdbrow l" style={brow} /><div className="pdbrow r" style={brow} />
            <div className="pdeye l" /><div className="pdeye r" /><div className="pdnose" />
            <div className="pdmouth" style={mouth} />
          </div>
        ) : (
          <div className="pdbody" style={s}>
            <div className="pdbhead" /><div className="pdbnose" /><div className="pdarm l" /><div className="pdarm r" />
            <div className="pdtorso" /><div className="pdleg l" /><div className="pdleg r" />
          </div>
        )}
      </div>
      {d.arrow && <div className="pdarrow">{d.arrow === 'right' ? '→' : d.arrow === 'left' ? '←' : '↻'}</div>}
    </div>
  );
}

export default function CharacterCapture({ token, character = null, existing = [], onClose, onChanged }) {
  const doneSet = new Set(existing);                 // sort_numbers already captured
  const firstTodo = Math.max(0, POSES.findIndex((_, i) => !doneSet.has(i + 1)));
  // Multi-character (#9): a character must exist (with a name) before shooting.
  const [charId, setCharId] = useState(character?.id || null);
  const [charName, setCharName] = useState(character?.name || '');
  const [nameDraft, setNameDraft] = useState(character?.name || '');
  const [stage, setStage] = useState(character?.id ? 'intro' : 'name'); // 'name' | 'intro' | 'capture' | 'finished'
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

  // ---- spoken guidance (studio voices) ----
  const [voiceTheme, setVoiceTheme] = useState('warm');
  const [voiceOn, setVoiceOn] = useState(true);
  const [readyToPose, setReadyToPose] = useState(false); // welcome finished → poses may speak
  const audioRef = useRef(null);
  const genRef = useRef(0);         // bumps on every speak; cancels stale onended
  const spokenIdxRef = useRef(-1);  // last pose we spoke (never double-speak one)
  const greetedRef = useRef(false); // welcome has played once

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

  function close() { stopStream(); stopVoice(); onClose?.(); }

  // ---- spoken guidance: ONE audio channel, overlap-proof ----
  const stopVoice = useCallback(() => {
    genRef.current += 1;                 // invalidate any pending onended
    const a = audioRef.current;
    if (a) { try { a.onended = null; a.pause(); } catch { /* ignore */ } }
  }, []);

  // Speak one clip from the given voice. Hard-stops whatever was playing first,
  // and the gen guard makes a superseded clip's onended a no-op — so a chained
  // line can never fire late over a newer one (that was the double-audio bug).
  const speak = useCallback((theme, key, onEnd) => {
    genRef.current += 1; const gen = genRef.current;
    let a = audioRef.current; if (!a) { a = new Audio(); audioRef.current = a; }
    try { a.onended = null; a.pause(); } catch { /* ignore */ }
    if (!key) { if (onEnd) onEnd(); return; }
    try {
      a.src = `/character-voices/${theme}/${key}.mp3`; a.currentTime = 0;
      a.onended = () => { if (gen === genRef.current && onEnd) onEnd(); };
      const p = a.play();
      if (p && p.catch) p.catch(() => { if (gen === genRef.current && onEnd) onEnd(); });
    } catch { if (onEnd) onEnd(); }
  }, []);

  // Pick a voice and play a short sample (runs in a tap → unlocks audio on iOS).
  function previewVoice(val) {
    setVoiceTheme(val); setVoiceOn(true);
    speak(val, 'smile');
  }

  // Enter capture; greet once, THEN allow pose lines. readyToPose flips only when
  // the welcome ends, so the greeting and the first pose never overlap.
  function enterCapture(greet = true) {
    setStage('capture');
    spokenIdxRef.current = -1;
    setReadyToPose(false);
    if (greet && !greetedRef.current && voiceOn) {
      greetedRef.current = true;
      speak(voiceTheme, 'welcome', () => setReadyToPose(true));
    } else {
      greetedRef.current = true;
      setReadyToPose(true);
    }
  }

  // Speak the visible pose — only after the welcome, never while reviewing a
  // shot, and never twice for the same pose.
  useEffect(() => {
    if (stage !== 'capture' || preview || !readyToPose) return undefined;
    if (spokenIdxRef.current === idx) return undefined;
    spokenIdxRef.current = idx;
    if (voiceOn) speak(voiceTheme, VOICE_FOR_POSE[POSES[idx]?.slug]);
    return undefined;
  }, [stage, idx, preview, readyToPose, voiceOn, voiceTheme, speak]);

  // Ending line on the finish screen.
  useEffect(() => {
    if (stage === 'finished' && voiceOn) speak(voiceTheme, 'done');
    return undefined;
  }, [stage, voiceOn, voiceTheme, speak]);

  useEffect(() => () => stopVoice(), [stopVoice]);  // stop audio on unmount

  // Create the named character before shooting (or when arriving via QR link).
  async function createCharacter() {
    const nm = nameDraft.trim();
    if (!nm) { setBusy('Please enter a name'); setTimeout(() => setBusy(''), 1800); return; }
    setBusy('uploading');
    try {
      const res = await fetch('/api/portal/character', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'create', name: nm }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.character?.id) throw new Error(j.error || 'Could not start this character');
      setCharId(j.character.id); setCharName(nm); setBusy('');
      onChanged?.();
      setStage('intro');
    } catch (e) {
      setBusy(e.message || 'Something went wrong'); setTimeout(() => setBusy(''), 2500);
    }
  }

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
        body: JSON.stringify({ token, characterId: charId, action: 'slot', sortNumber: idx + 1, key, filename: `${String(idx + 1).padStart(2, '0')}-${pose.slug}.jpg`, contentType: 'image/jpeg' }),
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
        body: JSON.stringify({ token, characterId: charId, action: 'done' }),
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
          body: JSON.stringify({ token, characterId: charId, action: 'extra', key, filename: f.name, contentType: f.type || 'image/jpeg' }),
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
        <button className="back" onClick={close} aria-label="Return to photo upload">‹ Photos</button>
        <span className="ttl">Character Build{charName ? ` — ${charName}` : ''}</span>
        <span style={{ fontSize: 13, color: '#93a3b6', marginLeft: 'auto' }}>{doneCount}/{POSE_COUNT}</span>
        <button onClick={() => { setVoiceOn((v) => !v); stopVoice(); }} aria-label={voiceOn ? 'Mute voice' : 'Unmute voice'} title={voiceOn ? 'Mute voice' : 'Unmute voice'} style={{ background: 'none', border: 'none', color: '#93a3b6', fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: '0 4px' }}>{voiceOn ? '🔊' : '🔇'}</button>
        <button className="x" onClick={close} aria-label="Close">×</button>
      </div>

      {stage === 'name' && (
        <div className="body">
          <h1>Whose character is this?</h1>
          <p className="lead">Give this character a name — that’s how you can build more than one person on this account and keep them straight. The name prints on their build sheet.</p>
          <input
            className="nameinput"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            placeholder="e.g. Mom, Emma, Grandpa Joe"
            maxLength={60}
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') createCharacter(); }}
          />
          <button className="btn" onClick={createCharacter}>{busy === 'uploading' ? 'Starting…' : 'Start character →'}</button>
          <button className="btn ghost" onClick={close}>Return to photo upload</button>
          {busy && busy !== 'uploading' && <p className="qrnote" style={{ color: '#ff3b63' }}>{busy}</p>}
        </div>
      )}

      {stage === 'intro' && isDesktop && (
        <div className="body">
          <h1>Continue on your phone</h1>
          <p className="lead">Your character photo shoot happens on a phone — grab a friend to snap the pics (no selfies!). Scan this code to start on your phone and pick up right here.</p>
          <div className="qrwrap">
            <div className="qrcard"><img src={`/api/portal/character-qr?token=${encodeURIComponent(token)}${charId ? `&character=${encodeURIComponent(charId)}` : ''}`} alt="Scan to continue on your phone" width={232} height={232} /></div>
            <p className="qrnote">Point your phone’s camera at the code. You’ll enter your portal password on your phone, then go straight into the 12 photos.</p>
          </div>
          {busy && busy !== 'uploading' && <p className="qrnote" style={{ color: '#38b6ff' }}>{busy}</p>}
          <button className="btn ghost" onClick={() => extraRef.current?.click()}>Upload photos from this computer instead</button>
          <button className="btn ghost" onClick={close}>Not now</button>
          <button className="smalllink" onClick={() => enterCapture()}>Use this computer’s camera anyway</button>
          <input ref={extraRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onExtraPick} />
        </div>
      )}

      {stage === 'intro' && !isDesktop && (
        <div className="body">
          <h1>{CAPTURE_INTRO_TITLE}</h1>
          <p className="lead">This is your character photo shoot! A dozen quick poses and you’re done. These stay separate — they’re not part of your event video.</p>
          <ul className="guide">{CAPTURE_INTRO.map((g, i) => <li key={i}>{g}</li>)}</ul>
          <div style={{ margin: '2px 0 16px' }}>
            <p style={{ fontSize: 14.5, fontWeight: 800, color: '#f4f1f8', margin: '0 0 8px' }}>Pick your guide’s voice 🔊 <span style={{ fontWeight: 600, color: '#93a3b6', fontSize: 13 }}>(tap to hear it)</span></p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {VOICE_THEMES.map(([val, label]) => (
                <button key={val} type="button" onClick={() => previewVoice(val)}
                  style={{ padding: '9px 13px', borderRadius: 999, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    border: '1.5px solid ' + (voiceTheme === val ? '#38b6ff' : '#2c2438'),
                    background: voiceTheme === val ? 'rgba(56,182,255,.16)' : '#141020', color: '#eae6f0' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <button className="btn" onClick={() => enterCapture()}>Let’s go — 12 quick photos →</button>
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
                <span style={{ flex: 1 }} />
                {!camError && <button className="flip" onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))} title="Flip camera">⟲</button>}
              </div>
              <div className="posebox">
                <PoseDemo slug={pose.slug} />
                <div className="posetext">
                  <span className="shotname">{pose.label}</span>
                  <div className="hint">{pose.hint}</div>
                </div>
              </div>
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
          <button className="btn ghost" onClick={() => { setIdx(0); enterCapture(false); }}>Go back &amp; retake a shot</button>
          <button className="btn ghost" onClick={() => extraRef.current?.click()}>Add more of my own photos</button>
          <input ref={extraRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onExtraPick} />
        </div>
      )}
    </div>
  );
}
