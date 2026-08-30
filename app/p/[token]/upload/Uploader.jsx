'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { buildTimeline } from '@/lib/timelineOrder';
import { isCharacterFolder } from '@/lib/characterPoses';
import CharacterCapture from './CharacterCapture';

// Files moved here are set aside for the studio to clear. Clients can also delete their own uploads outright (the ✕ on each photo).
const TRASH_FOLDER = 'Trash';
// Sentinel drop target meaning "append to the very end" (Photo Library reorder).
const END_DROP = '__end__';

// Thumbnail sizes for the timeline zoom (px). Index into this array.
const ZOOMS = [56, 72, 96, 128, 168, 210];

// "001.jpg" -> 1 ; "12 - dance.mov" -> 12 ; "IMG_0214.jpeg" -> null
function leadingNumber(name) {
  const m = name.match(/^\s*0*(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

// "Grandma/001.jpg" -> "Grandma" ; "001.jpg" -> null
function folderFromPath(relPath) {
  if (!relPath) return null;
  const parts = relPath.split('/').filter(Boolean);
  parts.pop();
  return parts.length ? parts.join('/') : null;
}

// Recursively walk a dropped directory entry, collecting {file, relPath}.
function readEntry(entry, path = '') {
  return new Promise((resolve) => {
    if (entry.isFile) {
      entry.file((file) => resolve([{ file, relPath: path + file.name }]), () => resolve([]));
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const all = [];
      const readBatch = () => {
        reader.readEntries(async (entries) => {
          if (!entries.length) {
            const nested = await Promise.all(all.map((e) => readEntry(e, `${path}${entry.name}/`)));
            resolve(nested.flat());
            return;
          }
          all.push(...entries);
          readBatch();
        }, () => resolve([]));
      };
      readBatch();
    } else {
      resolve([]);
    }
  });
}

const CSS = `
#uploadflow{--pnl:#181120;--pnl2:#1f1729;--line:#2c2438;--txt:#eae6f0;--titlecol:#f4f1f8;--mut:#93a3b6;
  --blue:#6d93b3;--bluedim:#3a566e;--red:#ff3b63;--neon:#38b6ff;--album:#7c5cff;--shadow:0 6px 16px rgba(0,0,0,.35);
  max-width:640px;margin:0 auto;padding:8px 2px 90px;color:var(--txt);}
#uploadflow .back,#uploadflow .backbtn{color:var(--mut);text-decoration:none;font-size:14px;background:none;border:none;cursor:pointer;padding:0;margin-bottom:6px;}
#uploadflow .kick{font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--blue);margin:12px 0 6px;font-weight:800;}
#uploadflow h1{font-size:32px;line-height:1.05;margin:2px 0 8px;color:var(--titlecol);font-weight:800;}
#uploadflow .say{font-size:18px;line-height:1.4;color:var(--mut);margin:0 0 12px;}
#uploadflow .say b{color:var(--titlecol);}
#uploadflow .tip{border-left:3px solid var(--blue);background:rgba(109,147,179,.10);padding:10px 12px;border-radius:0 12px 12px 0;font-size:14px;margin:0 0 16px;}
#uploadflow .tip b{color:var(--titlecol);}
#uploadflow .prog{display:flex;align-items:center;gap:12px;margin:0 0 16px;}
#uploadflow .pmsg{font-size:17px;font-weight:800;color:var(--titlecol);white-space:nowrap;}
#uploadflow .pbar{flex:1;height:12px;border-radius:999px;background:#241f2e;overflow:hidden;}
#uploadflow .pfill{height:100%;border-radius:999px;transition:width .4s;background:var(--blue);}
#uploadflow .addrow{display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap;}
#uploadflow .big{flex:1;min-width:150px;border:1.5px solid var(--neon);border-radius:16px;padding:18px;font-size:19px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;background:transparent;color:var(--neon);transition:transform .08s;}
#uploadflow .big:active{transform:scale(.97);}
#uploadflow .window{border:1.5px solid var(--red);border-radius:20px;background:var(--pnl);padding:14px;}
#uploadflow .dragnote{font-size:15px;text-align:center;color:var(--mut);margin:0 0 12px;}
#uploadflow .dragnote b{font-weight:800;color:var(--blue);}
#uploadflow .cols{display:flex;gap:12px;align-items:stretch;}
#uploadflow .col{flex:1;min-width:0;display:flex;flex-direction:column;}
#uploadflow .lbl{font-size:12px;letter-spacing:.1em;text-transform:uppercase;font-weight:800;margin:2px 2px 8px;color:var(--blue);}
#uploadflow .openzone{border:1.5px solid var(--neon);border-radius:16px;padding:16px;text-align:center;cursor:pointer;flex:1;display:flex;flex-direction:column;justify-content:center;}
#uploadflow .openzone.drop{background:#122031;}
#uploadflow .obig{font-size:22px;font-weight:800;color:var(--titlecol);}
#uploadflow .otag{font-size:13px;font-weight:700;color:var(--neon);margin-top:6px;}
#uploadflow .ofolder{font-size:12.5px;color:var(--mut);margin-top:10px;line-height:1.4;}
#uploadflow .ocount{font-size:15px;font-weight:800;color:var(--blue);margin-top:12px;}
#uploadflow .box{border:1.5px solid var(--neon);border-radius:16px;background:var(--pnl2);padding:12px 14px;margin-bottom:10px;cursor:pointer;transition:transform .08s;}
#uploadflow .box:active{transform:scale(.98);}
#uploadflow .box.drop{background:#122031;}
#uploadflow .bhead{display:flex;align-items:center;gap:12px;}
#uploadflow .bicon{font-size:22px;}
#uploadflow .bname{font-size:17px;font-weight:800;color:var(--titlecol);min-width:0;white-space:normal;overflow-wrap:anywhere;line-height:1.2;}
#uploadflow .bname.sample{color:#8fb0cc;font-style:italic;font-weight:500;font-size:15px;}
#uploadflow .bcount{margin-left:auto;font-size:13px;color:var(--mut);font-weight:700;white-space:nowrap;flex:0 0 auto;}
#uploadflow .btag{margin-left:auto;font-size:12px;color:var(--mut);font-style:italic;white-space:nowrap;flex:0 0 auto;}
#uploadflow .newbox{border:1.5px solid var(--neon);color:#e6eef5;background:var(--bluedim);border-radius:16px;padding:14px;text-align:center;font-size:15px;font-weight:800;cursor:pointer;}
#uploadflow .newrow{display:flex;gap:8px;margin-top:8px;}
#uploadflow .newrow input{flex:1;background:var(--pnl2);color:#fff;border:1.5px solid var(--neon);border-radius:12px;padding:12px;font-size:15px;}
#uploadflow .newrow button{background:var(--bluedim);border:1.5px solid var(--neon);color:#e6eef5;border-radius:12px;padding:0 16px;font-weight:800;cursor:pointer;}
#uploadflow .seebtn{width:100%;border:1.5px solid var(--neon);border-radius:20px;padding:20px;font-size:20px;font-weight:800;cursor:pointer;margin-top:16px;background:var(--bluedim);color:#e6eef5;box-shadow:var(--shadow);}
#uploadflow .charbox{width:100%;display:flex;align-items:center;gap:14px;text-align:left;border:1.5px solid var(--album);border-radius:18px;padding:16px 18px;margin-top:16px;cursor:pointer;background:linear-gradient(160deg,rgba(124,92,255,.18),rgba(124,92,255,.05));color:#eae6f0;}
#uploadflow .charbox:active{transform:scale(.99);}
#uploadflow .charbox .cbicon{font-size:30px;flex:0 0 auto;}
#uploadflow .charbox .cbtext{display:flex;flex-direction:column;min-width:0;}
#uploadflow .charbox .cbtitle{font-size:18px;font-weight:800;color:#f4f1f8;}
#uploadflow .charbox .cbsub{font-size:13px;color:#cbb8ff;line-height:1.3;margin-top:2px;}
#uploadflow .charbox .cbgo{margin-left:auto;font-size:26px;color:var(--album);font-weight:800;flex:0 0 auto;}
#uploadflow .charwrap{margin-top:16px;border:1.5px solid var(--album);border-radius:18px;padding:14px;background:linear-gradient(160deg,rgba(124,92,255,.18),rgba(124,92,255,.05));}
#uploadflow .charwrap .chtitle{display:flex;align-items:center;gap:10px;font-size:18px;font-weight:800;color:#f4f1f8;margin:2px 2px 10px;}
#uploadflow .charwrap .chtitle .chi{font-size:24px;}
#uploadflow .charempty{font-size:13px;color:#cbb8ff;margin:0 2px 12px;line-height:1.45;}
#uploadflow .charrow{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:rgba(0,0,0,.18);border:1px solid rgba(124,92,255,.35);border-radius:14px;padding:11px 13px;margin-bottom:9px;cursor:pointer;color:#eae6f0;}
#uploadflow .charrow:active{transform:scale(.99);}
#uploadflow .charrow .crmeta{display:flex;flex-direction:column;min-width:0;flex:1;}
#uploadflow .charrow .crname{font-size:16px;font-weight:800;color:#f4f1f8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
#uploadflow .charrow .crsub{font-size:12.5px;color:#cbb8ff;margin-top:2px;}
#uploadflow .charrow .crpill{font-size:12px;font-weight:800;border-radius:999px;padding:3px 10px;flex:0 0 auto;}
#uploadflow .charrow .crpill.done{background:var(--neon);color:#0b0710;}
#uploadflow .charrow .crpill.wip{background:rgba(124,92,255,.35);color:#e9e2ff;border:1px solid var(--album);}
#uploadflow .charrow .crgo{font-size:22px;color:var(--album);font-weight:800;flex:0 0 auto;}
#uploadflow .charadd{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;border:1.5px dashed var(--album);background:transparent;color:#e9e2ff;border-radius:14px;padding:12px;font-size:15px;font-weight:800;cursor:pointer;margin-top:2px;}
#uploadflow .charadd:active{transform:scale(.99);}
#uploadflow .charitem{margin-bottom:12px;}
#uploadflow .charitem .charrow{margin-bottom:6px;}
#uploadflow .cractions{display:flex;gap:16px;align-items:center;padding:0 6px;}
#uploadflow .cract{font-size:12.5px;font-weight:800;color:var(--neon);text-decoration:none;background:none;border:none;cursor:pointer;padding:2px 0;font-family:inherit;}
#uploadflow .cract.del{color:#ff6b7f;margin-left:auto;}
#uploadflow .up-item{display:flex;justify-content:space-between;gap:10px;font-size:13px;padding:6px 2px;border-bottom:1px solid var(--line);color:var(--mut);}
#uploadflow .up-item .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
#uploadflow .mob{display:none;}

/* ===== TIMELINE (order view) ===== */
#uploadflow .tlbar{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:10px;background:#0d0913;padding:8px 0 10px;flex-wrap:wrap;}
#uploadflow .zoom{display:flex;align-items:center;gap:6px;}
#uploadflow .zbtn{width:42px;height:42px;border-radius:12px;border:1.5px solid var(--neon);background:transparent;color:var(--neon);font-size:22px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;}
#uploadflow .zbtn:active{transform:scale(.94);}
#uploadflow .zbtn:disabled{opacity:.3;}
#uploadflow .zlabel{font-size:12px;color:var(--mut);min-width:64px;}
#uploadflow .tlhint{font-size:12.5px;color:var(--mut);margin-left:auto;}
#uploadflow .tlhint b{color:var(--blue);}
#uploadflow .frame{border:1.5px solid var(--red);border-radius:18px;background:var(--pnl);padding:10px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;--tz:96px;}
#uploadflow .track{display:flex;align-items:stretch;gap:0;min-height:calc(var(--tz) + 46px);padding:4px 0;}
#uploadflow .gap{flex:0 0 auto;width:12px;align-self:stretch;border-radius:8px;margin:0 2px;}
#uploadflow .gap.live{width:26px;background:repeating-linear-gradient(45deg,rgba(56,182,255,.20)0 6px,transparent 6px 12px);border:1.5px dashed var(--neon);cursor:pointer;}
#uploadflow .gap.live:active{background:rgba(56,182,255,.4);}
#uploadflow .card,#uploadflow .album{user-select:none;-webkit-user-select:none;}
#uploadflow .card img,#uploadflow .album .mini span{-webkit-user-drag:none;user-drag:none;pointer-events:none;}
#uploadflow .card{flex:0 0 auto;position:relative;border-radius:12px;overflow:hidden;background:var(--pnl2);border:1px solid var(--line);cursor:grab;}
#uploadflow .card:active,#uploadflow .album:active{cursor:grabbing;}
#uploadflow .card .thumb{width:var(--tz);height:var(--tz);background:#000;display:block;}
#uploadflow .card img{width:100%;height:100%;object-fit:cover;display:block;}
#uploadflow .card.video .thumb{display:flex;align-items:center;justify-content:center;flex-direction:column;color:#fff;gap:4px;background:#050505;}
#uploadflow .card.video .vplay{font-size:calc(var(--tz)*.26);line-height:1;}
#uploadflow .card.video .vdur{font-size:11px;color:#c9d4de;font-weight:700;}
#uploadflow .card.video{border-color:#3a3350;}
#uploadflow .num{position:absolute;top:5px;left:5px;background:rgba(0,0,0,.72);color:#fff;border-radius:999px;min-width:20px;height:20px;padding:0 5px;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;}
#uploadflow .impno{position:absolute;top:calc(var(--tz) - 23px);left:5px;background:#f5a623;color:#241700;border-radius:6px;height:18px;padding:0 6px;font-size:10.5px;font-weight:900;letter-spacing:.3px;display:flex;align-items:center;box-shadow:0 1px 3px rgba(0,0,0,.5);z-index:6;}
#uploadflow .cap{font-size:11px;color:var(--mut);text-align:center;padding:4px 2px 5px;max-width:var(--tz);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
#uploadflow .card.picked{outline:3px solid var(--neon);outline-offset:-1px;}
#uploadflow .card.picked::after{content:"moving…";position:absolute;inset:auto 0 0 0;background:var(--neon);color:#0d0913;font-size:10px;font-weight:800;text-align:center;padding:2px;}
#uploadflow .album{flex:0 0 auto;position:relative;border-radius:12px;border:1.5px solid var(--album);background:linear-gradient(160deg,rgba(124,92,255,.18),rgba(124,92,255,.05));cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px;min-width:calc(var(--tz)*.95);}
#uploadflow .album .aico{font-size:calc(var(--tz)*.30);line-height:1;}
#uploadflow .album .aname{font-size:12.5px;font-weight:800;color:var(--titlecol);margin-top:4px;max-width:calc(var(--tz)*1.1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center;}
#uploadflow .album .acount{font-size:11px;color:#cbb8ff;margin-top:2px;}
#uploadflow .album .aopen{margin-top:6px;font-size:11px;font-weight:800;color:#0d0913;background:var(--album);border:none;border-radius:999px;padding:4px 10px;cursor:pointer;}
#uploadflow .album.picked{outline:3px solid var(--neon);outline-offset:-1px;}
#uploadflow .album.target{outline:2px dashed var(--neon);outline-offset:-1px;background:rgba(56,182,255,.12);}
#uploadflow .album .mini{height:calc(var(--tz)*.5);width:100%;display:flex;gap:2px;margin-top:6px;overflow:hidden;}
#uploadflow .album .mini span{flex:1;border-radius:3px;background-size:cover;background-position:center;background-color:#000;}
#uploadflow .album.open{flex-direction:column;align-items:stretch;background:rgba(124,92,255,.10);min-width:auto;padding:8px 10px;cursor:default;}
#uploadflow .album .ahead{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
#uploadflow .album .ahead .aico{font-size:20px;}
#uploadflow .album .ahead .aname{max-width:none;font-size:15px;margin:0;}
#uploadflow .album .ahead .acount{margin:0 0 0 2px;}
#uploadflow .album .ahead .aclose{margin-left:auto;font-size:12px;font-weight:800;color:var(--album);background:none;border:1.5px solid var(--album);border-radius:999px;padding:4px 10px;cursor:pointer;}
#uploadflow .album .lane{display:flex;align-items:stretch;gap:0;overflow-x:auto;padding-bottom:2px;min-height:calc(var(--tz) + 30px);}
#uploadflow .album .ahead .acount{margin-right:auto;}
#uploadflow .album .ahead .amoveout{font-size:12px;font-weight:800;color:#0d0913;background:var(--neon);border:none;border-radius:999px;padding:5px 12px;cursor:pointer;}
#uploadflow .album .ahead .ahide{font-size:12px;font-weight:800;color:#ff9db0;background:none;border:1.5px solid #6b2a3a;border-radius:999px;padding:4px 10px;cursor:pointer;}
#uploadflow .album .ahead .ahide:hover{border-color:var(--red);background:rgba(255,59,99,.10);}
#uploadflow .album .ahead .aclose{margin-left:0;}
#uploadflow .album .ahint{font-size:12px;color:#cbb8ff;margin:0 2px 8px;}
#uploadflow .album .adrop{margin-top:6px;font-size:11px;font-weight:800;color:#0d0913;background:var(--neon);border-radius:999px;padding:4px 10px;}
#uploadflow .album .laneempty{color:#cbb8ff;font-size:12.5px;padding:14px 4px;}
#uploadflow .tlfoot{font-size:12.5px;color:var(--mut);margin-top:12px;text-align:center;line-height:1.5;}
#uploadflow .tlfoot b{color:var(--blue);}
#uploadflow .savebar{position:fixed;left:0;right:0;bottom:0;background:linear-gradient(0deg,#0d0913 72%,transparent);padding:12px;display:flex;justify-content:center;z-index:30;}
#uploadflow .savebtn{border:1.5px solid var(--neon);background:var(--bluedim);color:#e6eef5;border-radius:16px;padding:14px 26px;font-size:16px;font-weight:800;box-shadow:var(--shadow);cursor:pointer;}

@media(max-width:640px){
  #uploadflow .addrow{display:none;} #uploadflow .dragnote{display:none;}
  #uploadflow .desk{display:none;} #uploadflow .mob{display:inline;}
  #uploadflow h1{font-size:26px;} #uploadflow .say{font-size:15px;margin-bottom:10px;}
  #uploadflow .tip{font-size:13px;margin-bottom:12px;} #uploadflow .prog{margin-bottom:12px;}
  #uploadflow .cols{flex-direction:column;gap:10px;} #uploadflow .openzone{flex:none;padding:14px;}
  #uploadflow .ofolder{display:none;} #uploadflow .bcount{display:none;}
  #uploadflow .lbl{margin:2px 2px 6px;} #uploadflow .window{padding:12px;}
  #uploadflow .box{padding:11px 13px;margin-bottom:8px;}
  #uploadflow .bname{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  #uploadflow .newbox{padding:12px;} #uploadflow .seebtn{padding:16px;font-size:18px;margin-top:12px;}
  #uploadflow .tlhint{width:100%;margin-left:0;}
}
`;

export default function Uploader({ token }) {
  const [view, setView] = useState('upload'); // 'upload' | 'order'
  const [dragging, setDragging] = useState('');   // '' | 'open' | box name being hovered
  const [items, setItems] = useState([]);
  const [mine, setMine] = useState([]);
  const [loadingMine, setLoadingMine] = useState(true);
  const [serverBoxes, setServerBoxes] = useState([]); // [{ name, position }] — persist even empty
  const [naming, setNaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [orgBusy, setOrgBusy] = useState(false);
  const [orgMsg, setOrgMsg] = useState('');
  const [saveErr, setSaveErr] = useState(false);  // last save failed → honest status + retry
  const lastOrgPayload = useRef(null);             // last organize() payload, for retry
  const [activeChar, setActiveChar] = useState(null);         // open capture: {id,name,existing} | {build:true} | null
  const [characters, setCharacters] = useState([]);           // multi-character roster
  const [isDesktop, setIsDesktop] = useState(false);          // desktop → non-phone copy

  // timeline (order view) state
  const [tl, setTl] = useState([]);            // [{type:'media',item} | {type:'album',name,items}]
  const [picked, setPicked] = useState(null);  // { scope:'top'|'album', album, id, kind:'media'|'album' }
  const [zoomIdx, setZoomIdx] = useState(2);
  const [openAlbums, setOpenAlbums] = useState(() => new Set());
  const [libOpen, setLibOpen] = useState(false);       // Photo Library grid
  const libDragRef = useRef(null);                      // { scope, id }
  const [librarySel, setLibrarySel] = useState(() => new Set()); // selected photo ids in the Library
  const libLastSel = useRef(null);                      // anchor id for shift-range select
  const [libMenu, setLibMenu] = useState(null);         // { x, y, title, items:[{label,fn}] } popup
  const [libUndo, setLibUndo] = useState([]);           // stack of pre-move timeline snapshots
  const [lastTrashed, setLastTrashed] = useState(null); // { id, filename, prev } for Undo
  const undoTimer = useRef(null);
  const frameRef = useRef(null);
  const zoomRef = useRef(2);

  const fileRef = useRef(null);     // add to the open area
  const folderRef = useRef(null);   // choose a folder
  const boxFileRef = useRef(null);  // add into a specific album
  const boxTarget = useRef(null);   // which album boxFileRef is adding to

  useEffect(() => {
    if (folderRef.current) {
      folderRef.current.setAttribute('webkitdirectory', '');
      folderRef.current.setAttribute('directory', '');
    }
  }, []);

  // Remember which view we're on across a refresh (fixes phone refresh dropping
  // back to the add-photos screen). The active view lives in the URL hash.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Desktop → show non-phone copy (no "pinch"/"turn your phone").
    const ua = navigator.userAgent || '';
    const mobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
    const narrow = window.matchMedia('(max-width: 820px)').matches;
    const noTouch = !('ontouchstart' in window) && (navigator.maxTouchPoints || 0) === 0;
    setIsDesktop(!mobileUA && !narrow && noTouch);

    if (window.location.hash === '#order') setView('order');
    // Deep-link from the desktop QR: land straight in Character Build on the phone.
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('start') === 'character') {
      const wantChar = sp.get('character');
      if (wantChar) pendingCharRef.current = wantChar; // continue this specific character once the roster loads
      else setActiveChar({ build: true });
      const clean = window.location.pathname + window.location.hash;
      window.history.replaceState(null, '', clean); // drop the param so a refresh doesn't re-trigger
    }
  }, []);
  const goView = useCallback((v) => {
    setView(v);
    setPicked(null);
    if (typeof window !== 'undefined') {
      const base = window.location.pathname + window.location.search;
      window.history.replaceState(null, '', v === 'order' ? `${base}#order` : base);
    }
  }, []);

  const serverBoxNames = serverBoxes.map((b) => (typeof b === 'string' ? b : b.name));

  const loadMine = useCallback(async () => {
    setLoadingMine(true);
    try {
      const res = await fetch(`/api/portal/media?token=${token}&scope=mine`, { cache: 'no-store' });
      const j = await res.json();
      setMine(j.media || []);
      setServerBoxes(j.boxes || []);
    } catch {
      setMine([]);
    }
    setLoadingMine(false);
  }, [token]);

  useEffect(() => { loadMine(); }, [loadMine]);

  // Multi-character roster for the Character Build box.
  const loadCharacters = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/character?token=${token}`);
      const j = await res.json();
      setCharacters(Array.isArray(j.characters) ? j.characters : []);
    } catch { /* keep prior roster */ }
  }, [token]);
  useEffect(() => { loadCharacters(); }, [loadCharacters]);

  // When arriving via a per-character QR deep-link, open that character to
  // continue once the roster (with its name + captured slots) has loaded.
  const pendingCharRef = useRef(null);
  useEffect(() => {
    const id = pendingCharRef.current;
    if (!id) return;
    const ch = characters.find((c) => c.id === id);
    if (ch) {
      pendingCharRef.current = null;
      setActiveChar({ id: ch.id, name: ch.name, existing: ch.slots || [] });
    }
  }, [characters]);

  async function deleteCharacter(ch) {
    if (typeof window !== 'undefined' && !window.confirm(`Delete the character “${ch.name || 'Unnamed'}”? Main Event Studio can restore it if you change your mind.`)) return;
    // Optimistic: drop it from the roster immediately so the tap clearly did something.
    setCharacters((cur) => cur.filter((x) => x.id !== ch.id));
    try {
      const res = await fetch('/api/portal/character', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'delete', characterId: ch.id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        // Surface WHY it failed (e.g. a missing deleted_at column) instead of silently reappearing.
        if (typeof window !== 'undefined') window.alert(`Couldn't delete this character${j.error ? `: ${j.error}` : ''}${j.detail ? ` (${j.detail})` : ''}.`);
      }
    } catch {
      if (typeof window !== 'undefined') window.alert("Couldn't reach the server to delete this character.");
    }
    loadCharacters();
  }

  // Rebuild the timeline whenever the server data changes. This is the single
  // source of truth for play order (shared with the montage render path).
  useEffect(() => {
    const { structure } = buildTimeline(mine, serverBoxes);
    setTl(structure);
  }, [mine, serverBoxes]);

  useEffect(() => { zoomRef.current = zoomIdx; }, [zoomIdx]);

  // Pinch-to-zoom on the timeline frame (in addition to the – / + buttons).
  useEffect(() => {
    const el = frameRef.current;
    if (!el || view !== 'order') return undefined;
    let base = null;
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const ts = (e) => { if (e.touches.length === 2) base = { d: dist(e.touches), z: zoomRef.current }; };
    const tm = (e) => {
      if (e.touches.length === 2 && base) {
        const r = dist(e.touches) / base.d;
        const steps = Math.round((r - 1) * 3);
        setZoomIdx(Math.max(0, Math.min(ZOOMS.length - 1, base.z + steps)));
      }
    };
    const te = () => { base = null; };
    el.addEventListener('touchstart', ts, { passive: true });
    el.addEventListener('touchmove', tm, { passive: true });
    el.addEventListener('touchend', te, { passive: true });
    return () => {
      el.removeEventListener('touchstart', ts);
      el.removeEventListener('touchmove', tm);
      el.removeEventListener('touchend', te);
    };
  }, [view]);

  function putWithProgress(url, file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
      xhr.onerror = () => reject(new Error('Upload didn’t go through — check your connection and try again'));
      xhr.send(file);
    });
  }

  async function uploadOne({ file, relPath }, index, setStatus, folderOverride) {
    const contentType = file.type || 'application/octet-stream';
    setStatus(index, { status: 'uploading', pct: 0 });
    const urlRes = await fetch('/api/portal/upload-url', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, contentType }),
    });
    if (!urlRes.ok) { const j = await urlRes.json().catch(() => ({})); throw new Error(j.error || 'Could not start upload'); }
    const { url, key } = await urlRes.json();
    await putWithProgress(url, file, (pct) => setStatus(index, { status: 'uploading', pct }));
    await fetch('/api/portal/confirm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token, key, filename: file.name, contentType, size: file.size,
        sortNumber: leadingNumber(file.name),
        folderPath: folderOverride !== undefined ? folderOverride || null : folderFromPath(relPath),
      }),
    });
    setStatus(index, { status: 'done', pct: 100 });
  }

  // folderOverride: undefined = keep dropped-folder names; '' or name = force into that album.
  async function handleEntries(entries, folderOverride) {
    const clean = entries.filter((e) => e.file && e.file.name && !e.file.name.startsWith('.'));
    if (!clean.length) return;
    clean.sort((a, b) => a.relPath.localeCompare(b.relPath, undefined, { numeric: true }));
    const base = items.length;
    setItems((prev) => [...prev, ...clean.map((e) => ({ name: e.file.name, status: 'queued', pct: 0 }))]);
    const setStatus = (i, patch) => setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
    for (let i = 0; i < clean.length; i++) {
      try { /* eslint-disable-next-line no-await-in-loop */ await uploadOne(clean[i], base + i, setStatus, folderOverride); }
      catch (e) { setStatus(base + i, { status: 'error', error: e.message }); }
    }
    loadMine();
  }

  function fromInput(fileList) {
    return Array.from(fileList).map((file) => ({ file, relPath: file.webkitRelativePath || file.name }));
  }

  async function entriesFromDrop(dt) {
    const entries = Array.from(dt.items || []).map((it) => (it.webkitGetAsEntry ? it.webkitGetAsEntry() : null)).filter(Boolean);
    if (entries.length) { const nested = await Promise.all(entries.map((en) => readEntry(en))); return nested.flat(); }
    if (dt.files?.length) return fromInput(dt.files);
    return [];
  }

  async function onDropOpen(e) {
    e.preventDefault(); setDragging('');
    const list = await entriesFromDrop(e.dataTransfer);
    if (list.length) handleEntries(list); // keep folder names (a dropped folder becomes an album)
  }

  async function onDropBox(e, boxName) {
    e.preventDefault(); setDragging('');
    const list = await entriesFromDrop(e.dataTransfer);
    if (list.length) handleEntries(list, boxName); // flatten everything into this album
  }

  function pickInto(boxName) {
    boxTarget.current = boxName; // '' for open, or an album name
    boxFileRef.current?.click();
  }

  // ---- organize (persist a change) ----
  async function organize(payload) {
    lastOrgPayload.current = payload;
    setOrgBusy(true); setOrgMsg('');
    try {
      const res = await fetch('/api/portal/media', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...payload }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error([j.error, j.detail].filter(Boolean).join(' — ') || 'Could not save your change'); }
      await loadMine();
      setSaveErr(false);
    } catch (e) { setOrgMsg(e.message || 'Something went wrong.'); setSaveErr(true); }
    setOrgBusy(false);
  }

  // Re-send the last save that failed (the always-visible status pill's Retry).
  async function retrySave() {
    if (lastOrgPayload.current) await organize(lastOrgPayload.current);
  }

  // Hide a whole album (non-destructive). The album + all its photos leave the
  // timeline everywhere, but nothing is deleted — Main Event Studio can restore it.
  async function hideAlbum(name, count) {
    if (typeof window !== 'undefined' && !window.confirm(
      `Hide the album “${name}” and all ${count} photo${count === 1 ? '' : 's'} inside it?\n\n` +
      `They'll be removed from your timeline, but nothing is deleted — Main Event Studio can bring them back anytime.`
    )) return;
    await organize({ action: 'hideBox', name });
  }

  // ---- Photo Library: grouped grid, reorder within a group + delete ----
  function saveTl(nextTl) {
    const top = nextTl.map((n) => (n.type === 'media' ? { type: 'media', id: n.item.id } : { type: 'album', name: n.name }));
    const albums = {};
    nextTl.forEach((n) => { if (n.type === 'album') albums[n.name] = n.items.map((m) => m.id); });
    setTl(nextTl);
    organize({ action: 'setArrangement', top, albums });
  }
  // Reorder photos INSIDE one album. dropId === END_DROP appends to the end.
  // ti is computed AFTER removing the dragged item, so the dragged photo always
  // lands BEFORE the target regardless of drag direction (consistent + no drift).
  function libReorder(scope, dragId, dropId) {
    if (!dragId || dragId === dropId) return;
    const nextTl = tl.map((n) => {
      if (n.type === 'album' && n.name === scope) {
        const arr = [...n.items];
        const fi = arr.findIndex((m) => m.id === dragId);
        if (fi < 0) return n;
        const [mv] = arr.splice(fi, 1);
        if (dropId === END_DROP) { arr.push(mv); }
        else { const ti = arr.findIndex((m) => m.id === dropId); if (ti < 0) arr.push(mv); else arr.splice(ti, 0, mv); }
        return { ...n, items: arr };
      }
      return n;
    });
    saveTl(nextTl);
  }
  // Reorder across the WHOLE top level — loose photos AND albums interleave in
  // one sequence, so the Library mirrors the real timeline play order. Keys are
  // prefixed ('m:'+id for a loose photo, 'a:'+name for an album) so a photo id
  // and an album name can never collide. dropKey === END_DROP appends to the end
  // (this is how you move something to the very last position).
  function libReorderTop(dragKey, dropKey) {
    if (!dragKey || dragKey === dropKey) return;
    const keyOf = (n) => (n.type === 'album' ? `a:${n.name}` : `m:${n.item.id}`);
    const arr = [...tl];
    const fi = arr.findIndex((n) => keyOf(n) === dragKey);
    if (fi < 0) return;
    const [mv] = arr.splice(fi, 1);
    if (dropKey === END_DROP) { arr.push(mv); }
    else { const ti = arr.findIndex((n) => keyOf(n) === dropKey); if (ti < 0) arr.push(mv); else arr.splice(ti, 0, mv); }
    saveTl(arr);
  }

  // ===== Photo Library organize (drag-free + drag) =====
  // Derive display SECTIONS from the timeline: each album is a section; runs of
  // consecutive loose photos coalesce into one "Loose photos" section. This is a
  // pure view of `tl` (the single source of truth), so nothing reorders on load.
  function libSections() {
    const secs = [];
    tl.forEach((n) => {
      if (n.type === 'album') secs.push({ kind: 'album', name: n.name, items: n.items });
      else {
        const last = secs[secs.length - 1];
        if (last && last.kind === 'loose') last.items.push(n.item);
        else secs.push({ kind: 'loose', items: [n.item] });
      }
    });
    return secs;
  }
  // Undo: snapshot the whole timeline BEFORE a Library move so any move (or a
  // wrong drag) is one click away from being reversed — nothing gets lost.
  function pushLibUndo() {
    setLibUndo((s) => [...s, tl.map((n) => (n.type === 'album' ? { ...n, items: [...n.items] } : { ...n }))].slice(-25));
  }
  function undoLibMove() {
    if (!libUndo.length) return;
    const snap = libUndo[libUndo.length - 1];
    setLibUndo((s) => s.slice(0, -1));
    setLibrarySel(new Set());
    saveTl(snap); // persists the restored order (and reloads from server)
  }
  // Rebuild `tl` from a reordered section list and persist.
  function saveSections(secs) {
    pushLibUndo();
    const next = [];
    secs.forEach((s) => {
      if (s.kind === 'album') next.push({ type: 'album', name: s.name, items: s.items });
      else s.items.forEach((m) => next.push({ type: 'media', item: m }));
    });
    saveTl(next);
  }
  // Move a whole section up/down in play order (swap with its neighbour).
  function nudgeSection(idx, dir) {
    const secs = libSections();
    const j = idx + dir;
    if (j < 0 || j >= secs.length) return;
    [secs[idx], secs[j]] = [secs[j], secs[idx]];
    saveSections(secs);
  }
  // Move an album section to an absolute section position.
  function moveAlbumToPos(name, targetIdx) {
    const secs = libSections();
    const fi = secs.findIndex((s) => s.kind === 'album' && s.name === name);
    if (fi < 0) return;
    const [mv] = secs.splice(fi, 1);
    secs.splice(Math.max(0, Math.min(secs.length, targetIdx)), 0, mv);
    saveSections(secs);
  }
  // Move photo(s) into an album (target = album name) or out to loose (target =
  // ''), optionally landing BEFORE beforeId (any position); else appended.
  function moveToAlbum(ids, target, beforeId) {
    const idset = ids instanceof Set ? ids : new Set(ids);
    if (!idset.size) return;
    const moved = [];
    tl.forEach((n) => {
      if (n.type === 'media') { if (idset.has(n.item.id)) moved.push(n.item); }
      else n.items.forEach((m) => { if (idset.has(m.id)) moved.push(m); });
    });
    if (!moved.length) return;
    pushLibUndo();
    let next = tl
      .filter((n) => !(n.type === 'media' && idset.has(n.item.id)))
      .map((n) => (n.type === 'album' ? { ...n, items: n.items.filter((m) => !idset.has(m.id)) } : n));
    if (!target) {
      const nodes = moved.map((m) => ({ type: 'media', item: { ...m, folderPath: '' } }));
      let idx = next.length;
      if (beforeId) { const bi = next.findIndex((n) => n.type === 'media' && n.item.id === beforeId); if (bi >= 0) idx = bi; }
      next.splice(idx, 0, ...nodes);
    } else {
      let found = false;
      next = next.map((n) => {
        if (n.type === 'album' && n.name === target) {
          found = true;
          const arr = [...n.items];
          let idx = arr.length;
          if (beforeId) { const bi = arr.findIndex((m) => m.id === beforeId); if (bi >= 0) idx = bi; }
          arr.splice(idx, 0, ...moved.map((m) => ({ ...m, folderPath: target })));
          return { ...n, items: arr };
        }
        return n;
      });
      // Target album has no node yet (brand-new album, or an empty one not in the
      // timeline) — create it so the photos are never dropped.
      if (!found) next.push({ type: 'album', name: target, items: moved.map((m) => ({ ...m, folderPath: target })) });
    }
    saveTl(next);
    setLibrarySel(new Set());
  }
  // Selection: click toggles; shift-click selects a range across play order.
  function toggleLibSel(id, shift) {
    setLibrarySel((cur) => {
      const nextSel = new Set(cur);
      if (shift && libLastSel.current) {
        const order = [];
        tl.forEach((n) => { if (n.type === 'media') order.push(n.item.id); else n.items.forEach((m) => order.push(m.id)); });
        const a = order.indexOf(libLastSel.current), b = order.indexOf(id);
        if (a >= 0 && b >= 0) { const [lo, hi] = a < b ? [a, b] : [b, a]; for (let i = lo; i <= hi; i++) nextSel.add(order[i]); }
      } else {
        if (nextSel.has(id)) nextSel.delete(id); else nextSel.add(id);
        libLastSel.current = id;
      }
      return nextSel;
    });
  }
  // Album names in current order (for the Move menus).
  function libAlbumNames() { return libSections().filter((s) => s.kind === 'album').map((s) => s.name); }
  function openMoveMenu(e, forIds) {
    e.stopPropagation();
    const ids = forIds || (librarySel.size ? [...librarySel] : []);
    if (!ids.length) return;
    const items = [
      ...libAlbumNames().map((nm) => ({ label: `📁  ${nm}`, fn: () => moveToAlbum(ids, nm, null) })),
      { label: '📥  Loose (no album)', fn: () => moveToAlbum(ids, '', null) },
      { label: '＋  New album…', fn: () => { const nm = (typeof window !== 'undefined' && window.prompt('New album name:') || '').trim(); if (nm) { if (!allBoxes.includes(nm)) organize({ action: 'createBox', name: nm }); moveToAlbum(ids, nm, null); } } },
    ];
    setLibMenu({ x: e.clientX, y: e.clientY, title: `Move ${ids.length} to`, items });
  }
  function openAlbumPosMenu(e, name) {
    e.stopPropagation();
    const secs = libSections();
    const items = secs.map((s, i) => ({ label: `${i + 1}.  ${s.kind === 'album' ? s.name : 'Loose photos'}`, fn: () => moveAlbumToPos(name, i) }));
    setLibMenu({ x: e.clientX, y: e.clientY, title: 'Move album to position', items });
  }

  // Soft delete: move to Trash (recoverable) + show an Undo. Never a hard delete
  // from a single tap — clients restore from Trash or Undo right after.
  async function trashPhoto(m) {
    const prev = m.folderPath || '';
    setLastTrashed({ id: m.id, filename: m.filename, prev });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setLastTrashed(null), 9000);
    // Optimistic: retag locally so the photo leaves its album (or loose lane)
    // instantly — buildTimeline excludes Trash — instead of waiting on the server
    // round-trip (the ✕ used to look like it did nothing inside an album).
    setMine((cur) => cur.map((x) => (x.id === m.id ? { ...x, folderPath: TRASH_FOLDER } : x)));
    await organize({ action: 'update', id: m.id, folderPath: TRASH_FOLDER });
  }
  async function restorePhoto(id, toFolder) {
    // Optimistic restore too, so Undo pops the photo back immediately.
    setMine((cur) => cur.map((x) => (x.id === id ? { ...x, folderPath: toFolder || '' } : x)));
    await organize({ action: 'update', id, folderPath: toFolder || '' });
  }
  async function undoTrash() {
    if (!lastTrashed) return;
    const lt = lastTrashed; setLastTrashed(null);
    await restorePhoto(lt.id, lt.prev);
  }
  async function deleteForever(m) {
    if (!window.confirm(`Permanently delete "${m.filename}"? This can't be undone.`)) return;
    await organize({ action: 'delete', id: m.id });
  }

  // ---- derived (upload view) ----
  const grouped = mine.reduce((acc, m) => { const k = m.folderPath || ''; (acc[k] = acc[k] || []).push(m); return acc; }, {});
  const folderBoxes = Object.keys(grouped).filter((k) => k !== '' && k !== TRASH_FOLDER && !isCharacterFolder(k));
  const allBoxes = Array.from(new Set([...serverBoxNames, ...folderBoxes])).filter((k) => !isCharacterFolder(k));
  const openCount = (grouped[''] || []).length;
  // Headline count = photos the client is actually keeping. Trashed photos
  // (moved to the Trash lane, set aside for removal) are NOT counted — they
  // still live in `mine` so the Trash lane can show + restore them.
  const total = mine.filter((m) => (m.folderPath || '') !== TRASH_FOLDER).length;
  const uploaded = mine.length;             // everything uploaded, trash included
  const trashCount = uploaded - total;      // photos set aside in the Trash lane
  const trashNote = trashCount > 0 ? ` (${trashCount} in trash · ${uploaded} total)` : '';
  const pmsg = (total === 0 ? 'Add your first photos 👇' : total < 6 ? `Great start — ${total} in!` : total < 16 ? `Nice — ${total} photos in! 🎉` : `Wow, ${total} photos active in your project! 🔥`) + trashNote;
  const SAMPLE = ['Childhood', 'Family', 'Friends'];
  const showSamples = allBoxes.length === 0;

  function createBox() {
    const v = newName.trim();
    if (!v) { setNewName(''); setNaming(false); return; }
    // "Trash" collides with the system trash folder — block it with a friendly nudge.
    if (/^trash$/i.test(v)) { setOrgMsg('“Trash” is a reserved name — please choose another name for your album.'); return; }
    setNewName(''); setNaming(false);
    if (!allBoxes.includes(v)) organize({ action: 'createBox', name: v }); // saves the album (persists even empty) + reloads
    pickInto(v); // opens the picker within this tap so they can add photos now
  }

  // ================= TIMELINE MOVES =================
  // Persist the WHOLE arrangement after each move (small N; keeps state exact).
  const commit = useCallback((nextTl) => {
    setTl(nextTl);
    setPicked(null);
    const top = nextTl.map((n) => (n.type === 'media' ? { type: 'media', id: n.item.id } : { type: 'album', name: n.name }));
    const albums = {};
    nextTl.forEach((n) => { if (n.type === 'album') albums[n.name] = n.items.map((m) => m.id); });
    organize({ action: 'setArrangement', top, albums });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const idOf = (n) => (n.type === 'album' ? n.name : n.item.id);

  // Remove the currently-picked node from a working copy; return { next, node }.
  function detachPicked(work) {
    if (picked.scope === 'top') {
      const i = work.findIndex((n) => idOf(n) === picked.id);
      const [node] = work.splice(i, 1);
      return { removedFrom: { top: true, idx: i }, node };
    }
    const ai = work.findIndex((n) => n.type === 'album' && n.name === picked.album);
    const album = { ...work[ai], items: work[ai].items.slice() };
    const j = album.items.findIndex((m) => m.id === picked.id);
    const [m] = album.items.splice(j, 1);
    work[ai] = album;
    return { removedFrom: { album: picked.album, idx: j }, node: { type: 'media', item: m } };
  }

  function dropTop(pos) {
    if (!picked) return;
    const work = tl.slice();
    const { removedFrom, node } = detachPicked(work);
    let p = pos;
    if (removedFrom.top && removedFrom.idx < pos) p -= 1; // account for the removal shift
    work.splice(p, 0, node);
    commit(work);
  }

  function dropInAlbum(albumName, pos) {
    if (!picked || picked.kind === 'album') return; // albums can't nest
    const work = tl.slice();
    const { removedFrom, node } = detachPicked(work);
    let p = pos;
    if (removedFrom.album === albumName && removedFrom.idx < pos) p -= 1;
    const ti = work.findIndex((n) => n.type === 'album' && n.name === albumName);
    const album = { ...work[ti], items: work[ti].items.slice() };
    album.items.splice(p, 0, node.item);
    work[ti] = album;
    commit(work);
  }

  // Pull the currently-picked in-album photo OUT to the loose timeline, right
  // after its album. (You can also drop it on any timeline gap.)
  function moveOut(albumName) {
    if (!picked || picked.scope !== 'album' || picked.album !== albumName) return;
    const work = tl.slice();
    const { node } = detachPicked(work);
    const ai = work.findIndex((n) => n.type === 'album' && n.name === albumName);
    work.splice(ai + 1, 0, node);
    commit(work);
  }

  function toggleOpen(name) {
    setOpenAlbums((prev) => { const s = new Set(prev); if (s.has(name)) s.delete(name); else s.add(name); return s; });
    setPicked(null);
  }

  function pickToggle(p) {
    setPicked((cur) => (cur && cur.scope === p.scope && (cur.album || null) === (p.album || null) && cur.id === p.id ? null : p));
  }

  // ================= RENDER =================
  const zoomStyle = { '--tz': `${ZOOMS[zoomIdx]}px` };

  // Plain builders (not components) so React doesn't remount them — which would
  // reload every thumbnail on each zoom/move. Each sets its own key.
  // Classify an upload so tiles show the right thing: a real photo, or a
  // labelled placeholder for things that can't preview / aren't part of a video
  // (audio, HEIC that failed to convert, other files).
  function mediaKind(m) {
    const ct = (m.contentType || '').toLowerCase();
    const name = (m.filename || '').toLowerCase();
    if (ct.startsWith('video') || /\.(mp4|mov|m4v|webm|avi|mkv)$/.test(name)) return 'video';
    if (ct.startsWith('audio') || /\.(mp3|wav|m4a|aac|flac|ogg)$/.test(name)) return 'audio';
    if (/\.(heic|heif)$/.test(name) || ct.includes('heic') || ct.includes('heif')) return 'heic';
    if (ct.startsWith('image') || /\.(jpe?g|png|gif|webp|avif|bmp|tiff?)$/.test(name)) return 'image';
    return 'file';
  }
  // Inner content of a square Library tile (photo, or a labelled placeholder).
  function tileInner(m) {
    const k = mediaKind(m);
    if (k === 'image') return (<img src={m.url} alt={m.filename} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />);
    const label = k === 'video' ? '▶ Video' : k === 'audio' ? '🎵 Audio' : k === 'heic' ? 'HEIC' : '📄 File';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9fb3c8', gap: 4, padding: 6, textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 10, color: '#7d8ea0', lineHeight: 1.2, wordBreak: 'break-word' }}>{m.filename}</div>
      </div>
    );
  }

  function mediaCard(m, num, scope, album) {
    const isVideo = (m.contentType || '').startsWith('video');
    const isPk = picked && picked.scope === scope && (picked.album || null) === (album || null) && picked.id === m.id;
    return (
      <div
        key={`${scope}:${album || ''}:${m.id}`}
        className={`card${isVideo ? ' video' : ''}${isPk ? ' picked' : ''}`}
        draggable
        onDragStart={(e) => { try { e.dataTransfer.setData('text/plain', m.id); e.dataTransfer.effectAllowed = 'move'; } catch { /* older browsers */ } setPicked({ scope, album: album || null, id: m.id, kind: 'media' }); }}
        onDragEnd={() => setPicked((c) => (c && c.id === m.id ? null : c))}
        onClick={(e) => { e.stopPropagation(); pickToggle({ scope, album: album || null, id: m.id, kind: 'media' }); }}
      >
        <div className="thumb">
          {(() => {
            const k = mediaKind(m);
            if (k === 'image') return (<img src={m.url} alt={m.filename} loading="lazy" draggable={false} />);
            const ic = k === 'audio' ? '🎵' : k === 'video' ? '▶' : '📄';
            const lbl = k === 'video' ? 'Video' : k === 'audio' ? 'Audio' : k === 'heic' ? 'HEIC' : 'File';
            return (<><span className="vplay">{ic}</span><span className="vdur">{lbl}</span></>);
          })()}
        </div>
        <span className="num">{num}</span>
        {m.importSeq != null && <span className="impno" title={`Import #${String(m.importSeq).padStart(3, '0')} — this photo’s permanent reference number`}>{String(m.importSeq).padStart(3, '0')}</span>}
        <button
          type="button"
          title="Delete this photo"
          onClick={(e) => { e.stopPropagation(); trashPhoto(m); }}
          style={{ position: 'absolute', top: 6, right: 6, zIndex: 6, width: 26, height: 26, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.62)', color: '#fff', fontSize: 13, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >✕</button>
        {mediaKind(m) === 'image' && (
          <button
            type="button"
            title="Rotate 90°"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); organize({ action: 'rotate', id: m.id }); }}
            style={{ position: 'absolute', top: 6, right: 38, zIndex: 6, width: 26, height: 26, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.62)', color: '#fff', fontSize: 14, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >↻</button>
        )}
        <div className="cap">{m.filename}</div>
      </div>
    );
  }

  function gap(k, live, onDrop) {
    return (
      <div
        key={k}
        className={`gap${live ? ' live' : ''}`}
        onClick={live ? (e) => { e.stopPropagation(); onDrop(); } : undefined}
        onDragOver={live ? (e) => e.preventDefault() : undefined}
        onDrop={live ? (e) => { e.preventDefault(); onDrop(); } : undefined}
      />
    );
  }

  function renderTrack() {
    const els = [];
    const topLive = !!picked;                       // anything picked can go to a top slot
    let n = 0;                                       // running number for loose items
    els.push(gap('tg0', topLive, () => dropTop(0)));
    tl.forEach((node, idx) => {
      if (node.type === 'media') {
        n += 1;
        els.push(mediaCard(node.item, n, 'top'));
      } else {
        els.push(renderAlbum(node, idx));
      }
      els.push(gap(`tg${idx + 1}`, topLive, () => dropTop(idx + 1)));
    });
    return els;
  }

  function renderAlbum(node, idx) {
    const name = node.name;
    const count = node.items.length;
    const isOpen = openAlbums.has(name);
    const pickedIsMedia = picked && picked.kind === 'media';
    const isPk = picked && picked.scope === 'top' && picked.kind === 'album' && picked.id === name;

    if (!isOpen) {
      const minis = node.items.slice(0, 4).map((m, i) => (
        <span key={i} style={(m.contentType || '').startsWith('video') ? { background: '#050505' } : { backgroundImage: `url('${m.url}')` }} />
      ));
      const onClick = (e) => {
        e.stopPropagation();
        if (pickedIsMedia) dropInAlbum(name, count);          // drop the picked photo into this album (at end)
        else if (isPk) setPicked(null);                        // tap the picked album again = cancel
        else if (!picked) pickToggle({ scope: 'top', album: null, id: name, kind: 'album' }); // pick the album up to relocate
        else setPicked(null);
      };
      return (
        <div
          key={name}
          className={`album${isPk ? ' picked' : ''}${pickedIsMedia ? ' target' : ''}`}
          draggable
          onDragStart={(e) => { try { e.dataTransfer.setData('text/plain', name); e.dataTransfer.effectAllowed = 'move'; } catch { /* older browsers */ } setPicked({ scope: 'top', album: null, id: name, kind: 'album' }); }}
          onDragEnd={() => setPicked((c) => (c && c.id === name ? null : c))}
          onDragOver={pickedIsMedia ? (e) => e.preventDefault() : undefined}
          onDrop={pickedIsMedia ? (e) => { e.preventDefault(); dropInAlbum(name, count); } : undefined}
          onClick={onClick}
        >
          <div className="aico">📁</div>
          <div className="aname">{name}</div>
          <div className="acount">{count} item{count === 1 ? '' : 's'}</div>
          {count > 0 && <div className="mini">{minis}</div>}
          {pickedIsMedia ? <div className="adrop">＋ drop to add</div> : <button className="aopen" onClick={(e) => { e.stopPropagation(); toggleOpen(name); }}>⤢ open</button>}
        </div>
      );
    }

    // open album — its own inline lane
    const laneLive = pickedIsMedia; // a photo can be placed inside
    const lane = [];
    lane.push(gap(`${name}-lg0`, laneLive, () => dropInAlbum(name, 0)));
    node.items.forEach((m, j) => {
      lane.push(mediaCard(m, j + 1, 'album', name));
      lane.push(gap(`${name}-lg${j + 1}`, laneLive, () => dropInAlbum(name, j + 1)));
    });
    return (
      <div className="album open" key={name} onClick={(e) => e.stopPropagation()}>
        <div className="ahead">
          <span className="aico">📁</span>
          <span className="aname">{name}</span>
          <span className="acount">{count} item{count === 1 ? '' : 's'}</span>
          {picked && picked.scope === 'album' && picked.album === name && (
            <button className="amoveout" onClick={(e) => { e.stopPropagation(); moveOut(name); }}>⤴ Move out</button>
          )}
          <button className="ahide" onClick={(e) => { e.stopPropagation(); hideAlbum(name, count); }} title="Hide this album and its photos (reversible)">🕶 Hide</button>
          <button className="aclose" onClick={(e) => { e.stopPropagation(); toggleOpen(name); }}>Done ✓</button>
        </div>
        {count === 0 && !laneLive ? (
          <div className="laneempty">Empty — pick a photo from the timeline, then tap here to add it.</div>
        ) : (
          <>
            {count > 0 && (
              <div className="ahint">
                {picked && picked.scope === 'album' && picked.album === name
                  ? 'Tap ⤴ Move out to pull it to the timeline, or tap a gap out there.'
                  : 'Tap a photo to move it — drag it out to the timeline, or into another album.'}
              </div>
            )}
            <div className="lane">{lane}</div>
          </>
        )}
      </div>
    );
  }

  return (
    <main id="uploadflow">
      <style>{CSS}</style>
      {/* Always-visible save status — stays put while scrolling through photos. */}
      <div
        onClick={saveErr ? retrySave : undefined}
        title={saveErr ? (orgMsg || 'Save failed — tap to retry') : ''}
        style={{ position: 'fixed', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 60,
          padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap',
          boxShadow: '0 6px 20px rgba(0,0,0,.45)', cursor: saveErr ? 'pointer' : 'default',
          border: '1px solid ' + (saveErr ? '#e23b3b' : orgBusy ? '#d8a83b' : '#2f9e5b'),
          background: saveErr ? '#3a1414' : orgBusy ? '#332a12' : '#123020',
          color: saveErr ? '#ffb3b3' : orgBusy ? '#ffd98a' : '#8ff0b5' }}>
        {orgBusy ? 'Saving…' : saveErr ? '⚠ Not saved — tap to retry' : '✓ All changes saved'}
      </div>
      <a href={`/p/${token}`} className="back">← Back to your portal</a>

      {view === 'upload' ? (
        <>
          <p className="kick">Send us your media</p>
          <h1>Add your photos</h1>
          <p className="say">Drop them in. Put them in order. Done.</p>
          <div className="tip">💡 <b>Tip:</b> order your photos before you upload if you can — you can still change it after.</div>

          <div className="prog">
            <span className="pmsg">{pmsg}</span>
            <span className="pbar"><span className="pfill" style={{ width: `${Math.min(100, (total / 24) * 100)}%` }} /></span>
          </div>

          <div className="addrow">
            <button className="big redbtn" onClick={() => pickInto('')}>＋ Add photos</button>
            <button className="big bluebtn" onClick={() => setNaming((v) => !v)}>📁 New album</button>
          </div>
          <div className="window" style={{ marginTop: 14 }}>
            <p className="dragnote">Drag photos into <b>the open</b> — or into <b>an album</b>. Either works!</p>
            <div className="cols">
              <div className="col">
                <div className="lbl red">▶ In the open</div>
                <div className={`openzone${dragging === 'open' ? ' drop' : ''}`}
                  onClick={() => pickInto('')}
                  onDragOver={(e) => { e.preventDefault(); setDragging('open'); }}
                  onDragLeave={() => setDragging('')}
                  onDrop={onDropOpen}>
                  <div className="obig"><span className="desk">📥 Drop here</span><span className="mob">📷 Add photos</span></div>
                  <div className="otag">＋ tap to open your photo library</div>
                  <div className="ofolder">📁 Drop a folder here creates a new album</div>
                  {openCount > 0 && <div className="ocount">{openCount} photo{openCount === 1 ? '' : 's'} here</div>}
                </div>
              </div>
              <div className="col">
                <div className="lbl blue">📁 Or into an album</div>
                {showSamples
                  ? SAMPLE.map((s) => (
                      <div className="box" key={s} onClick={() => { setNewName(s); setNaming(true); }}>
                        <div className="bhead"><span className="bicon">📁</span><span className="bname sample">ie. {s}</span><span className="btag">＋ tap to add</span></div>
                      </div>
                    ))
                  : allBoxes.map((name) => {
                      const cnt = (grouped[name] || []).length;
                      return (
                        <div className={`box${dragging === name ? ' drop' : ''}`} key={name}
                          onClick={() => pickInto(name)}
                          onDragOver={(e) => { e.preventDefault(); setDragging(name); }}
                          onDragLeave={() => setDragging('')}
                          onDrop={(e) => onDropBox(e, name)}>
                          <div className="bhead"><span className="bicon">📁</span><span className="bname">{name}</span>
                            {cnt > 0 ? <span className="bcount">{cnt} photo{cnt === 1 ? '' : 's'}</span> : <span className="btag">＋ tap to add</span>}
                          </div>
                        </div>
                      );
                    })}
                {naming ? (
                  <div className="newrow">
                    <input autoFocus placeholder="Name your album (ie. Childhood)" value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') createBox(); }} />
                    <button onClick={createBox}>Create</button>
                  </div>
                ) : (
                  <div className="newbox" onClick={() => setNaming(true)}>＋ New album</div>
                )}
              </div>
            </div>
          </div>

          {items.length > 0 && (
            <div style={{ marginTop: 14 }}>
              {items.slice(-8).map((it, i) => (
                <div key={i} className="up-item">
                  <span className="nm">{it.name}</span>
                  <span style={{ color: it.status === 'error' ? 'var(--red)' : 'var(--mut)' }}>
                    {it.status === 'done' ? '✓' : it.status === 'error' ? (it.error || 'Failed') : `${it.pct}%`}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="charwrap">
            <div className="chtitle"><span className="chi">🧑‍🎨</span> Character Build</div>
            {characters.length === 0 && (
              <p className="charempty">Turn a person into an AI character with a quick 12-photo shoot — kept separate from your event video. Build one for each person you want.</p>
            )}
            {characters.map((ch) => {
              const done = ch.done >= ch.total;
              return (
                <div key={ch.id} className="charitem">
                  <button
                    className="charrow"
                    onClick={() => setActiveChar({ id: ch.id, name: ch.name, existing: ch.slots || [] })}
                  >
                    <span className="crmeta">
                      <span className="crname">{ch.name || 'Unnamed character'}</span>
                      <span className="crsub">{done ? 'All 12 shots in — tap to review or retake' : 'Tap to keep going'}</span>
                    </span>
                    <span className={`crpill ${done ? 'done' : 'wip'}`}>{done ? '✓ 12/12' : `${ch.done}/${ch.total}`}</span>
                    <span className="crgo">›</span>
                  </button>
                  <div className="cractions">
                    {ch.done > 0 && (
                      <a
                        className="cract"
                        href={`/api/portal/character-sheet?token=${encodeURIComponent(token)}&characterId=${encodeURIComponent(ch.id)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        See your character sheet ↗
                      </a>
                    )}
                    <button type="button" className="cract del" onClick={() => deleteCharacter(ch)}>Delete</button>
                  </div>
                </div>
              );
            })}
            <button className="charadd" onClick={() => { window.location.href = '/character-studio.html?token=' + encodeURIComponent(token); }}>
              ＋ {characters.length === 0 ? 'Start a character' : 'Build another character'}
            </button>
          </div>

          <button className="seebtn" onClick={() => { loadMine(); goView('order'); }}>👁 See your photos &amp; order</button>

          {/* hidden inputs */}
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files?.length) handleEntries(fromInput(e.target.files), ''); e.target.value = ''; }} />
          <input ref={folderRef} type="file" multiple style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files?.length) handleEntries(fromInput(e.target.files)); e.target.value = ''; }} />
          <input ref={boxFileRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files?.length) handleEntries(fromInput(e.target.files), boxTarget.current); e.target.value = ''; }} />
        </>
      ) : (
        <>
          <button className="backbtn" onClick={() => goView('upload')}>‹ Back to adding photos</button>
          <p className="kick">Your video timeline</p>
          <h1>Put everything in play order</h1>
          <p className="say">
            {isDesktop
              ? <>Left to right is how your video plays. <b>Drag to rearrange</b>, or click a photo then click where it should go. Drag a photo onto an album to file it; open an album to arrange or pull photos back out.</>
              : <>Left to right is the order your video plays. To move something: <b>first tap the photo you want to move, then tap the spot where it should go</b>. Videos are shown here too, marked <b>▶</b>. Tap an album to drop a photo inside; open an album to rearrange or pull photos out.</>}
          </p>
          {orgMsg && <p style={{ color: 'var(--red)', fontSize: 13 }}>{orgMsg}</p>}

          <div className="tlbar">
            <div className="zoom">
              <button className="zbtn" disabled={zoomIdx === 0} onClick={() => setZoomIdx((z) => Math.max(0, z - 1))}>–</button>
              <button className="zbtn" disabled={zoomIdx === ZOOMS.length - 1} onClick={() => setZoomIdx((z) => Math.min(ZOOMS.length - 1, z + 1))}>+</button>
              <span className="zlabel">{zoomIdx <= 1 ? 'Overview' : zoomIdx >= 4 ? 'Detailed' : 'Zoom'}</span>
            </div>
            <span className="tlhint"><b>Tip:</b> {isDesktop ? 'use – / + to zoom · scroll sideways to see more' : 'pinch to zoom · turn your phone sideways for a longer view'}</span>
          </div>

          {loadingMine ? (
            <p style={{ color: 'var(--mut)' }}>Loading…</p>
          ) : tl.length === 0 ? (
            <p style={{ color: 'var(--mut)' }}>Nothing yet — add some photos first.</p>
          ) : (
            <div className="frame" ref={frameRef} style={zoomStyle} onClick={() => { if (picked) setPicked(null); }}>
              <div className="track">{renderTrack()}</div>
            </div>
          )}

          <p className="tlfoot">
            {!isDesktop && <><b>↻ Turn your phone sideways</b> for a longer, easier-to-use timeline. </>}
            Videos are shown too, marked <b>▶</b> — place them anywhere, loose or inside an album.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }}>
            <button type="button" onClick={() => setLibOpen(true)}
              style={{ border: '1.5px solid var(--neon)', background: 'var(--bluedim)', color: '#e6eef5', borderRadius: 12, padding: '12px 20px', fontWeight: 800, cursor: 'pointer', fontSize: 15 }}>
              📚 Photo Library — reorder & delete
            </button>
          </div>
          <div className="savebar">
            {saveErr ? (
              <button className="savebtn" style={{ borderColor: '#e23b3b', background: '#3a1414', color: '#ffb3b3' }} onClick={retrySave}>
                {orgBusy ? 'Retrying…' : '⚠ Not saved — tap to retry'}
              </button>
            ) : (
              <button className="savebtn" onClick={() => goView('upload')}>{orgBusy ? 'Saving…' : '✓ Done — order saved'}</button>
            )}
          </div>
        </>
      )}

      {libOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(8,7,12,0.96)', overflowY: 'auto', padding: 20 }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6, background: 'rgba(8,7,12,0.98)', padding: '10px 0' }}>
              <h2 style={{ color: '#fff', margin: 0, fontSize: 20 }}>Photo Library</h2>
              <span style={{ flex: 1 }} />
              <button type="button" disabled={!libUndo.length} onClick={undoLibMove} title="Undo the last move"
                style={{ border: '1.5px solid #f0b429', background: 'transparent', color: libUndo.length ? '#ffd873' : '#6a6350', borderRadius: 10, padding: '8px 14px', cursor: libUndo.length ? 'pointer' : 'default', fontWeight: 800, fontSize: 13.5, opacity: libUndo.length ? 1 : 0.5 }}>↩ Undo{libUndo.length ? ` (${libUndo.length})` : ''}</button>
              <button type="button" onClick={() => { const nm = (typeof window !== 'undefined' && window.prompt('New album name:') || '').trim(); if (nm && !allBoxes.includes(nm)) organize({ action: 'createBox', name: nm }); }}
                style={{ border: '1.5px solid #7c5cff', background: 'transparent', color: '#e9e2ff', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontWeight: 800, fontSize: 13.5 }}>+ New album</button>
              <button type="button" onClick={() => { setLibrarySel(new Set()); setLibMenu(null); setLibUndo([]); setLibOpen(false); }} style={{ border: '1px solid #38b6ff', background: 'transparent', color: '#e6eef5', borderRadius: 10, padding: '8px 16px', cursor: 'pointer', fontWeight: 700 }}>Done ✓</button>
            </div>
            <p style={{ color: '#9fb3c8', fontSize: 13, margin: '0 0 12px' }}>This top-to-bottom order is <b style={{ color: '#38b6ff' }}>exactly how your video plays</b> — every move updates it live. Click a photo to select (Shift-click for a range), then <b>Move ▾</b>. Drag a photo onto another to drop it right before that spot, in any album.</p>
            {librarySel.size > 0 && (
              <div style={{ position: 'sticky', top: 64, zIndex: 5, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(8,7,12,0.96)', padding: '8px 0', marginBottom: 6 }}>
                <button type="button" onClick={(e) => openMoveMenu(e, [...librarySel])}
                  style={{ border: 'none', background: '#7c5cff', color: '#0d0913', borderRadius: 11, padding: '9px 14px', cursor: 'pointer', fontWeight: 800, fontSize: 13.5 }}>Move {librarySel.size} selected to ▾</button>
                <button type="button" onClick={() => setLibrarySel(new Set())}
                  style={{ border: '1.5px solid #2a3340', background: 'transparent', color: '#9fb3c8', borderRadius: 11, padding: '9px 14px', cursor: 'pointer', fontWeight: 800, fontSize: 13.5 }}>Clear</button>
                <span style={{ color: '#3ddc84', fontWeight: 800, fontSize: 13.5 }}>{librarySel.size} selected</span>
              </div>
            )}
            {tl.length === 0 ? (
              <p style={{ color: '#9fb3c8' }}>No photos yet.</p>
            ) : (() => {
              // Play-order number for every photo, across the whole interleaved
              // sequence, so badges match the real timeline exactly.
              let pn = 0; const playNo = {};
              tl.forEach((node) => {
                if (node.type === 'media') { pn += 1; playNo[node.item.id] = pn; }
                else node.items.forEach((m) => { pn += 1; playNo[m.id] = pn; });
              });
              const sections = libSections();
              const trashed = mine.filter((m) => (m.folderPath || '') === TRASH_FOLDER);
              const SEL = librarySel;
              const startPhotoDrag = (id) => { const ids = (SEL.has(id) && SEL.size) ? [...SEL] : [id]; libDragRef.current = { photos: ids }; };
              const dropOnTile = (sec, beforeM) => { const d = libDragRef.current; if (d && d.photos) moveToAlbum(d.photos, sec.kind === 'album' ? sec.name : '', beforeM.id); libDragRef.current = null; };
              const dropOnSection = (sec) => { const d = libDragRef.current; if (d && d.photos) moveToAlbum(d.photos, sec.kind === 'album' ? sec.name : '', null); libDragRef.current = null; };

              const tile = (m, sec) => (
                <div key={m.id} draggable
                  onClick={(e) => toggleLibSel(m.id, e.shiftKey)}
                  onDragStart={(e) => { if (!SEL.has(m.id)) { setLibrarySel(new Set([m.id])); libLastSel.current = m.id; } startPhotoDrag(m.id); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', m.id); } catch { /* older */ } }}
                  onDragOver={(e) => { if (libDragRef.current && libDragRef.current.photos) { e.preventDefault(); e.stopPropagation(); } }}
                  onDrop={(e) => { e.preventDefault(); e.stopPropagation(); dropOnTile(sec, m); }}
                  style={{ position: 'relative', width: 120, height: 120, borderRadius: 10, overflow: 'hidden', background: '#000', cursor: 'grab', border: SEL.has(m.id) ? '2px solid #38b6ff' : '2px solid transparent', boxShadow: SEL.has(m.id) ? '0 0 0 3px rgba(56,182,255,.28)' : 'none' }}>
                  {tileInner(m)}
                  <span style={{ position: 'absolute', top: 5, left: 5, fontSize: 11, fontWeight: 800, background: 'rgba(0,0,0,.72)', color: '#fff', padding: '1px 6px', borderRadius: 999 }}>{playNo[m.id]}</span>
                  {m.importSeq != null && <span title={`Import #${String(m.importSeq).padStart(3, '0')} — this photo’s permanent reference number`} style={{ position: 'absolute', bottom: 5, left: 5, fontSize: 10.5, fontWeight: 900, letterSpacing: '.3px', background: '#f5a623', color: '#241700', padding: '1px 6px', borderRadius: 6, boxShadow: '0 1px 3px rgba(0,0,0,.5)' }}>{String(m.importSeq).padStart(3, '0')}</span>}
                  {SEL.has(m.id) && <span style={{ position: 'absolute', top: 5, right: 5, width: 20, height: 20, borderRadius: 6, background: '#38b6ff', color: '#0d0913', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900 }}>✓</span>}
                  <button type="button" onClick={(e) => { e.stopPropagation(); openMoveMenu(e, [m.id]); }} title="Move to an album"
                    style={{ position: 'absolute', bottom: 5, left: 46, border: 'none', background: 'rgba(0,0,0,.72)', color: '#fff', borderRadius: 8, fontSize: 11.5, fontWeight: 800, padding: '3px 7px', cursor: 'pointer' }}>Move ▾</button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); trashPhoto(m); }} title="Move to Trash"
                    style={{ position: 'absolute', bottom: 5, right: 5, width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.66)', color: '#fff', cursor: 'pointer', fontSize: 12, lineHeight: 1 }}>✕</button>
                </div>
              );

              return (
                <>
                  {sections.map((sec, si) => {
                    const isAlbum = sec.kind === 'album';
                    return (
                      <div key={isAlbum ? `a:${sec.name}` : `loose:${si}`}
                        onDragOver={(e) => { const d = libDragRef.current; if (d && (d.photos || d.section != null)) e.preventDefault(); }}
                        onDrop={(e) => {
                          const d = libDragRef.current;
                          if (d && d.photos) { e.preventDefault(); dropOnSection(sec); }
                          else if (d && d.section != null) { e.preventDefault(); if (d.section !== si) { const secs = libSections(); const [mv] = secs.splice(d.section, 1); secs.splice(si, 0, mv); saveSections(secs); } libDragRef.current = null; }
                        }}
                        style={{ border: isAlbum ? '1.5px solid rgba(124,92,255,.5)' : '1.5px solid #2a3340', borderRadius: 14, background: isAlbum ? 'rgba(124,92,255,.06)' : 'rgba(56,182,255,.04)', marginBottom: 14, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 13px', background: isAlbum ? 'linear-gradient(160deg,rgba(124,92,255,.14),rgba(124,92,255,.03))' : 'rgba(56,182,255,.06)' }}>
                          <span draggable={isAlbum} onDragStart={() => { if (isAlbum) libDragRef.current = { section: si }; }}
                            title={isAlbum ? 'Drag to reorder this album' : ''} style={{ cursor: isAlbum ? 'grab' : 'default', color: '#8a7fb0', fontSize: 16, letterSpacing: '-2px' }}>⠿</span>
                          <span style={{ fontWeight: 800, fontSize: 15.5, color: '#eef' }}>{isAlbum ? `📁 ${sec.name}` : '📥 Loose photos'}</span>
                          <span style={{ color: isAlbum ? '#cbb8ff' : '#9fc7e6', fontSize: 12.5 }}>{sec.items.length} photo{sec.items.length === 1 ? '' : 's'}</span>
                          {!isAlbum && <span style={{ background: 'rgba(56,182,255,.14)', color: '#38b6ff', borderRadius: 6, padding: '1px 7px', fontSize: 11, fontWeight: 800 }}>not in an album</span>}
                          <span style={{ flex: 1 }} />
                          <button type="button" disabled={si === 0} onClick={() => nudgeSection(si, -1)} title="Move up" style={{ width: 30, height: 30, borderRadius: 8, border: '1.5px solid #2a3340', background: 'transparent', color: '#9fb3c8', cursor: si === 0 ? 'default' : 'pointer', opacity: si === 0 ? 0.3 : 1, fontSize: 14 }}>▲</button>
                          <button type="button" disabled={si === sections.length - 1} onClick={() => nudgeSection(si, 1)} title="Move down" style={{ width: 30, height: 30, borderRadius: 8, border: '1.5px solid #2a3340', background: 'transparent', color: '#9fb3c8', cursor: si === sections.length - 1 ? 'default' : 'pointer', opacity: si === sections.length - 1 ? 0.3 : 1, fontSize: 14 }}>▼</button>
                          {isAlbum && <button type="button" onClick={(e) => openAlbumPosMenu(e, sec.name)} style={{ border: '1.5px solid #7c5cff', color: '#e9e2ff', background: 'none', borderRadius: 999, padding: '5px 11px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Move album ▾</button>}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 13 }}>
                          {sec.items.length ? sec.items.map((m) => tile(m, sec)) : <div style={{ color: '#9fb0c4', fontSize: 12.5, padding: '18px 6px' }}>Empty — drag photos here, or use a photo’s Move ▾.</div>}
                        </div>
                      </div>
                    );
                  })}

                  {trashed.length > 0 && (
                    <div style={{ marginTop: 20, borderTop: '1px solid #2a3340', paddingTop: 16 }}>
                      <div style={{ color: '#e6a3a3', fontWeight: 800, fontSize: 14, margin: '0 0 10px' }}>🗑 Trash <span style={{ color: '#7d8ea0', fontWeight: 400 }}>({trashed.length}) — restore, or delete forever</span></div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
                        {trashed.map((m) => (
                          <div key={m.id} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid #402a2a', background: '#000', aspectRatio: '1 / 1', opacity: 0.85 }}>
                            {tileInner(m)}
                            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', gap: 4, padding: 4, background: 'rgba(0,0,0,.55)' }}>
                              <button type="button" onClick={() => restorePhoto(m.id, '')} style={{ flex: 1, border: 'none', borderRadius: 6, padding: '5px 0', background: '#2fbf71', color: '#04210f', fontWeight: 800, fontSize: 11, cursor: 'pointer' }}>Restore</button>
                              <button type="button" onClick={() => deleteForever(m)} title="Delete forever" style={{ border: 'none', borderRadius: 6, padding: '5px 8px', background: '#7a2333', color: '#fff', fontSize: 11, cursor: 'pointer' }}>✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {orgMsg && <p style={{ color: '#ff6b8a', fontSize: 13 }}>{orgMsg}</p>}
                  <p style={{ color: '#7d8ea0', fontSize: 12, marginTop: 12 }}>Tip: drag a photo onto another photo to drop it right before that spot — inside any album. Drag an album by its ⠿ handle, or use ▲▼ / Move album ▾, to reorder. ✕ sends a photo to Trash (restore here or Undo right after).</p>
                </>
              );
            })()}
            {libMenu && (
              <>
                <div onClick={() => setLibMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 1000 }} />
                <div style={{ position: 'fixed', left: Math.min(libMenu.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 230), top: Math.min(libMenu.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 40 - libMenu.items.length * 40), zIndex: 1001, background: '#221b30', border: '1.5px solid #7c5cff', borderRadius: 12, padding: 6, minWidth: 210, maxHeight: '70vh', overflowY: 'auto', boxShadow: '0 12px 34px rgba(0,0,0,.55)' }}>
                  <div style={{ color: '#9a8fb0', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.5px', padding: '6px 12px 4px' }}>{libMenu.title}</div>
                  {libMenu.items.map((it, ix) => (
                    <div key={ix} onClick={() => { it.fn(); setLibMenu(null); }}
                      style={{ padding: '9px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13.5, fontWeight: 700, color: '#eae6f0' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(124,92,255,.25)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>{it.label}</div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {lastTrashed && (
        <div style={{ position: 'fixed', left: '50%', bottom: 20, transform: 'translateX(-50%)', zIndex: 1000, background: '#12233a', border: '1px solid #38b6ff', borderRadius: 12, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, color: '#e6eef5', boxShadow: '0 8px 24px rgba(0,0,0,.5)', maxWidth: '92vw' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Moved “{lastTrashed.filename}” to Trash.</span>
          <button type="button" onClick={undoTrash} style={{ border: 'none', background: '#38b6ff', color: '#04210f', fontWeight: 800, borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}>Undo</button>
          <button type="button" onClick={() => setLastTrashed(null)} style={{ border: 'none', background: 'transparent', color: '#9fb3c8', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      )}
      {activeChar && (
        <CharacterCapture
          token={token}
          character={activeChar.build ? null : { id: activeChar.id, name: activeChar.name }}
          existing={activeChar.existing || []}
          onClose={() => { setActiveChar(null); loadMine(); loadCharacters(); }}
          onChanged={() => { loadMine(); loadCharacters(); }}
        />
      )}
    </main>
  );
}
