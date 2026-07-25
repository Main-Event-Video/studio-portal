'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Files moved here are set aside for the studio to clear — clients never delete.
const TRASH_FOLDER = 'Trash';

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
#uploadflow{--red:#ff2e63;--blue:#38b6ff;--gold:#e8cc8a;--pnl:#181120;--pnl2:#1f1729;--line:#2c2438;--txt:#f2ecf7;--mut:#b3a9c1;
  --rglow:0 0 8px rgba(255,46,99,.5);--rglowS:0 0 16px rgba(255,46,99,.85);--bglow:0 0 8px rgba(56,182,255,.5);--bglowS:0 0 16px rgba(56,182,255,.85);
  max-width:640px;margin:0 auto;padding:8px 2px 70px;color:var(--txt);}
#uploadflow .back{color:var(--mut);text-decoration:none;font-size:14px;}
#uploadflow .kick{font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--red);margin:12px 0 6px;font-weight:800;text-shadow:var(--rglow);}
#uploadflow h1{font-size:32px;line-height:1.05;margin:2px 0 8px;color:#fff;font-weight:800;text-shadow:0 0 14px rgba(255,46,99,.45);}
#uploadflow .say{font-size:18px;line-height:1.4;color:var(--mut);margin:0 0 12px;}
#uploadflow .tip{border-left:3px solid var(--blue);background:rgba(56,182,255,.10);padding:10px 12px;border-radius:0 12px 12px 0;font-size:14px;margin:0 0 16px;box-shadow:var(--bglow);}
#uploadflow .tip b{color:#fff;}
#uploadflow .prog{display:flex;align-items:center;gap:12px;margin:0 0 16px;}
#uploadflow .pmsg{font-size:17px;font-weight:800;color:#fff;white-space:nowrap;}
#uploadflow .pbar{flex:1;height:12px;border-radius:999px;background:#241a30;overflow:hidden;}
#uploadflow .pfill{height:100%;border-radius:999px;transition:width .4s;background:linear-gradient(90deg,var(--red),var(--blue));}
#uploadflow .addrow{display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap;}
#uploadflow .big{flex:1;min-width:150px;border:none;border-radius:16px;padding:18px;font-size:19px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;}
#uploadflow .big:active{transform:scale(.97);}
#uploadflow .redbtn{background:linear-gradient(180deg,#ff3a6b,#df2151);color:#fff;box-shadow:var(--rglowS);}
#uploadflow .bluebtn{background:linear-gradient(180deg,#4cbcff,#1f9fef);color:#04121d;box-shadow:var(--bglowS);}
#uploadflow .window{border:1.5px solid var(--red);border-radius:20px;background:var(--pnl);padding:14px;box-shadow:var(--rglow),inset 0 0 18px rgba(255,46,99,.06);}
#uploadflow .dragnote{font-size:15px;text-align:center;color:var(--mut);margin:0 0 12px;}
#uploadflow .dragnote b{font-weight:800;}
#uploadflow .cols{display:flex;gap:12px;align-items:stretch;}
#uploadflow .col{flex:1;min-width:0;display:flex;flex-direction:column;}
#uploadflow .lbl{font-size:12px;letter-spacing:.1em;text-transform:uppercase;font-weight:800;margin:2px 2px 8px;}
#uploadflow .lbl.red{color:var(--red);text-shadow:var(--rglow);}
#uploadflow .lbl.blue{color:var(--blue);text-shadow:var(--bglow);}
#uploadflow .openzone{border:2px dashed var(--red);border-radius:16px;padding:16px;text-align:center;box-shadow:inset 0 0 14px rgba(255,46,99,.08);cursor:pointer;flex:1;display:flex;flex-direction:column;justify-content:center;}
#uploadflow .openzone.drop{border-color:#ff6b8f;background:#26101a;box-shadow:var(--rglowS);}
#uploadflow .obig{font-size:22px;font-weight:800;color:#fff;}
#uploadflow .otag{font-size:13px;font-weight:700;font-style:italic;color:var(--red);margin-top:6px;}
#uploadflow .ofolder{font-size:12.5px;color:var(--mut);margin-top:10px;line-height:1.4;}
#uploadflow .ocount{font-size:15px;font-weight:800;color:var(--red);margin-top:12px;}
#uploadflow .box{border:1.5px solid var(--blue);border-radius:16px;background:var(--pnl2);padding:12px 14px;margin-bottom:10px;box-shadow:var(--bglow);cursor:pointer;}
#uploadflow .box:active{transform:scale(.98);}
#uploadflow .box.drop{background:#101f2b;box-shadow:var(--bglowS);}
#uploadflow .bhead{display:flex;align-items:center;gap:12px;}
#uploadflow .bicon{font-size:22px;}
#uploadflow .bname{font-size:18px;font-weight:800;color:#fff;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
#uploadflow .bname.sample{color:#6b6478;font-style:italic;font-weight:500;font-size:15px;}
#uploadflow .bcount{margin-left:auto;font-size:13px;color:var(--blue);font-weight:700;white-space:nowrap;flex:0 0 auto;}
#uploadflow .btag{margin-left:auto;font-size:12px;color:var(--mut);font-style:italic;white-space:nowrap;flex:0 0 auto;}
#uploadflow .newbox{border:2px dashed var(--blue);color:var(--blue);border-radius:16px;padding:14px;text-align:center;font-size:15px;font-weight:800;cursor:pointer;box-shadow:var(--bglow);}
#uploadflow .newrow{display:flex;gap:8px;margin-top:8px;}
#uploadflow .newrow input{flex:1;background:var(--pnl2);color:#fff;border:1.5px solid var(--blue);border-radius:12px;padding:12px;font-size:15px;}
#uploadflow .newrow button{background:var(--blue);border:none;color:#04121d;border-radius:12px;padding:0 16px;font-weight:800;cursor:pointer;}
#uploadflow .seebtn{width:100%;border:none;border-radius:20px;padding:20px;font-size:20px;font-weight:800;cursor:pointer;margin-top:16px;background:linear-gradient(180deg,#ff3a6b,#df2151);color:#fff;box-shadow:var(--rglowS);}
#uploadflow .up-item{display:flex;justify-content:space-between;gap:10px;font-size:13px;padding:6px 2px;border-bottom:1px solid var(--line);color:var(--mut);}
#uploadflow .up-item .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
#uploadflow .miniprog{height:6px;border-radius:999px;background:#241a30;overflow:hidden;margin-top:4px;}
#uploadflow .miniprog span{display:block;height:100%;background:var(--blue);}
/* order view */
#uploadflow .osec{margin-top:20px;}
#uploadflow .osec.box{border:1.5px solid var(--blue);border-radius:16px;background:var(--pnl);padding:12px;box-shadow:var(--bglow);cursor:default;}
#uploadflow .ohead{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
#uploadflow .ohead h3{margin:0;font-size:18px;color:#fff;}
#uploadflow .ohead .rn{font-weight:800;font-size:16px;color:#fff;background:none;border:none;border-radius:6px;padding:2px 4px;max-width:200px;}
#uploadflow .ohead .rn:focus{outline:1px solid var(--line);background:var(--pnl2);}
#uploadflow .ohead .cnt{margin-left:auto;color:var(--mut);font-size:12px;}
#uploadflow .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;}
@media(max-width:640px){#uploadflow .grid{grid-template-columns:repeat(3,1fr);}}
#uploadflow .pcard{border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--pnl2);}
#uploadflow .pthumb{position:relative;width:100%;aspect-ratio:1/1;background:#000;}
#uploadflow .pthumb img{width:100%;height:100%;object-fit:cover;}
#uploadflow .pvid{display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#fff;font-size:12px;}
#uploadflow .pnum{position:absolute;top:5px;left:5px;background:rgba(0,0,0,.72);color:#fff;border-radius:999px;min-width:20px;height:20px;padding:0 5px;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;}
#uploadflow .pctrls{display:flex;align-items:center;justify-content:center;gap:4px;padding:5px;}
#uploadflow .ib{background:var(--pnl);border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:2px 9px;font-size:15px;line-height:1.1;cursor:pointer;font-weight:700;}
#uploadflow .ib:disabled{opacity:.3;cursor:default;}
#uploadflow .msel{width:100%;margin-top:5px;background:var(--pnl);color:var(--txt);border:1px solid var(--blue);border-radius:8px;font-size:12px;padding:5px;}
#uploadflow .backbtn{background:none;border:none;color:var(--blue);font-size:15px;font-weight:700;cursor:pointer;padding:0;margin-bottom:6px;}
`;

export default function Uploader({ token }) {
  const [view, setView] = useState('upload'); // 'upload' | 'order'
  const [dragging, setDragging] = useState('');   // '' | 'open' | box name being hovered
  const [items, setItems] = useState([]);
  const [mine, setMine] = useState([]);
  const [loadingMine, setLoadingMine] = useState(true);
  const [localBoxes, setLocalBoxes] = useState([]); // user-made boxes not yet holding photos
  const [naming, setNaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [orgBusy, setOrgBusy] = useState(false);
  const [orgMsg, setOrgMsg] = useState('');

  const fileRef = useRef(null);     // add to the open area
  const folderRef = useRef(null);   // choose a folder
  const boxFileRef = useRef(null);  // add into a specific box
  const boxTarget = useRef(null);   // which box boxFileRef is adding to

  useEffect(() => {
    if (folderRef.current) {
      folderRef.current.setAttribute('webkitdirectory', '');
      folderRef.current.setAttribute('directory', '');
    }
  }, []);

  const loadMine = useCallback(async () => {
    setLoadingMine(true);
    try {
      const res = await fetch(`/api/portal/media?token=${token}&scope=mine`);
      const j = await res.json();
      setMine(j.media || []);
    } catch {
      setMine([]);
    }
    setLoadingMine(false);
  }, [token]);

  useEffect(() => { loadMine(); }, [loadMine]);

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

  // folderOverride: undefined = keep dropped-folder names; '' or name = force into that box.
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
    if (list.length) handleEntries(list); // keep folder names (a dropped folder becomes a box)
  }

  async function onDropBox(e, boxName) {
    e.preventDefault(); setDragging('');
    const list = await entriesFromDrop(e.dataTransfer);
    if (list.length) handleEntries(list, boxName); // flatten everything into this box
  }

  function pickInto(boxName) {
    boxTarget.current = boxName; // '' for open, or a box name
    boxFileRef.current?.click();
  }

  // ---- organize (order view) ----
  async function organize(payload) {
    setOrgBusy(true); setOrgMsg('');
    try {
      const res = await fetch('/api/portal/media', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...payload }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Could not save your change'); }
      await loadMine();
    } catch (e) { setOrgMsg(e.message || 'Something went wrong.'); }
    setOrgBusy(false);
  }
  function reorderInGroup(groupKey, id, dir) {
    const ids = mine.filter((m) => (m.folderPath || '') === groupKey).map((m) => m.id);
    const i = ids.indexOf(id); const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    const next = ids.slice(); [next[i], next[j]] = [next[j], next[i]];
    organize({ action: 'renumber', ids: next });
  }

  // ---- derived ----
  const grouped = mine.reduce((acc, m) => { const k = m.folderPath || ''; (acc[k] = acc[k] || []).push(m); return acc; }, {});
  const folderBoxes = Object.keys(grouped).filter((k) => k !== '' && k !== TRASH_FOLDER);
  const allBoxes = Array.from(new Set([...folderBoxes, ...localBoxes]));
  const openCount = (grouped[''] || []).length;
  const total = mine.length;
  const pmsg = total === 0 ? 'Add your first photos 👇' : total < 6 ? `Great start — ${total} in!` : total < 16 ? `Nice — ${total} photos in! 🎉` : `Wow, ${total} photos! 🔥`;
  const SAMPLE = ['Childhood', 'Family', 'Friends'];
  const showSamples = allBoxes.length === 0;

  function createBox() {
    const v = newName.trim();
    if (v && !allBoxes.includes(v)) setLocalBoxes((b) => [...b, v]);
    setNewName(''); setNaming(false);
    if (v) pickInto(v); // let them add photos into the box they just made
  }

  // ================= RENDER =================
  return (
    <main id="uploadflow">
      <style>{CSS}</style>
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
            <button className="big bluebtn" onClick={() => setNaming((v) => !v)}>📁 New box</button>
          </div>
          {naming && (
            <div className="newrow">
              <input autoFocus placeholder="Name your box (ie. Childhood)" value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') createBox(); }} />
              <button onClick={createBox}>Create</button>
            </div>
          )}

          <div className="window" style={{ marginTop: 14 }}>
            <p className="dragnote">Drag photos into <b style={{ color: 'var(--red)' }}>the open</b> — or into <b style={{ color: 'var(--blue)' }}>a box</b>. Either works!</p>
            <div className="cols">
              <div className="col">
                <div className="lbl red">▶ In the open</div>
                <div className={`openzone${dragging === 'open' ? ' drop' : ''}`}
                  onClick={() => pickInto('')}
                  onDragOver={(e) => { e.preventDefault(); setDragging('open'); }}
                  onDragLeave={() => setDragging('')}
                  onDrop={onDropOpen}>
                  <div className="obig">📥 Drop here</div>
                  <div className="otag">＋ tap to add</div>
                  <div className="ofolder">📁 Drop a folder here creates a new box</div>
                  {openCount > 0 && <div className="ocount">{openCount} photo{openCount === 1 ? '' : 's'} here</div>}
                </div>
              </div>
              <div className="col">
                <div className="lbl blue">📁 Or into a box</div>
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
                <div className="newbox" onClick={() => setNaming(true)}>＋ New box</div>
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

          <button className="seebtn" onClick={() => { loadMine(); setView('order'); }}>👁 See your photos &amp; order</button>

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
          <button className="backbtn" onClick={() => setView('upload')}>‹ Back to adding photos</button>
          <p className="kick">Your video order</p>
          <h1>Put everything in order</h1>
          <p className="say">Top to bottom is how it plays. The open photos play first, then each box.</p>
          {orgMsg && <p style={{ color: 'var(--red)', fontSize: 13 }}>{orgMsg}</p>}

          {loadingMine ? (
            <p style={{ color: 'var(--mut)' }}>Loading…</p>
          ) : mine.length === 0 ? (
            <p style={{ color: 'var(--mut)' }}>Nothing yet — add some photos first.</p>
          ) : (
            <>
              <OrderSection title="In the open" groupKey="" list={grouped[''] || []} boxes={folderBoxes}
                orgBusy={orgBusy} reorder={reorderInGroup} organize={organize} />
              {folderBoxes.map((name) => (
                <OrderSection key={name} title={name} groupKey={name} list={grouped[name] || []} boxes={folderBoxes} isBox
                  orgBusy={orgBusy} reorder={reorderInGroup} organize={organize} />
              ))}
            </>
          )}
        </>
      )}
    </main>
  );
}

function OrderSection({ title, groupKey, list, boxes, isBox, orgBusy, reorder, organize }) {
  return (
    <section className={`osec${isBox ? ' box' : ''}`}>
      <div className="ohead">
        {isBox ? (
          <input className="rn" defaultValue={title} disabled={orgBusy}
            onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== title) organize({ action: 'renameFolder', from: title, to: v }); else if (!v) e.target.value = title; }} />
        ) : (
          <h3>▶ In the open</h3>
        )}
        <span className="cnt">{list.length} photo{list.length === 1 ? '' : 's'}</span>
      </div>
      {list.length === 0 ? (
        <p style={{ color: 'var(--mut)', fontSize: 13 }}>Empty.</p>
      ) : (
        <div className="grid">
          {list.map((m, idx) => {
            const isVideo = (m.contentType || '').startsWith('video');
            const targets = isBox ? ['__open__', ...boxes.filter((b) => b !== title)] : boxes;
            return (
              <div className="pcard" key={`${m.id}-${m.sortNumber}-${m.folderPath}`}>
                <div className="pthumb">
                  {isVideo ? <div className="pvid">▶ Video</div> : <img src={m.url} alt={m.filename} loading="lazy" />}
                  <span className="pnum">{idx + 1}</span>
                </div>
                <div className="pctrls">
                  <button className="ib" disabled={orgBusy || idx === 0} onClick={() => reorder(groupKey, m.id, -1)}>‹</button>
                  <button className="ib" disabled={orgBusy || idx === list.length - 1} onClick={() => reorder(groupKey, m.id, 1)}>›</button>
                </div>
                {targets.length > 0 && (
                  <select className="msel" value="" disabled={orgBusy}
                    onChange={(e) => { const v = e.target.value; if (v) organize({ action: 'update', id: m.id, folderPath: v === '__open__' ? '' : v }); }}>
                    <option value="">Move to…</option>
                    {isBox && <option value="__open__">In the open</option>}
                    {boxes.filter((b) => b !== title).map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
