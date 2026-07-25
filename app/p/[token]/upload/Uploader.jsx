'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Files moved here are set aside for the studio to clear — clients never delete.
// Must match the admin's constant in app/admin/page.js.
const TRASH_FOLDER = 'Trash';

// "001.jpg" -> 1 ; "12 - dance.mov" -> 12 ; "IMG_0214.jpeg" -> null
function leadingNumber(name) {
  const m = name.match(/^\s*0*(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

// "Joey as a baby/001.jpg" -> "Joey as a baby"   (nested paths preserved)
// "001.jpg" -> null (loose file, no folder)
function folderFromPath(relPath) {
  if (!relPath) return null;
  const parts = relPath.split('/').filter(Boolean);
  parts.pop(); // drop the filename
  return parts.length ? parts.join('/') : null;
}

function humanSize(bytes) {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

// Recursively walk a dropped directory entry, collecting {file, relPath}.
function readEntry(entry, path = '') {
  return new Promise((resolve) => {
    if (entry.isFile) {
      entry.file(
        (file) => resolve([{ file, relPath: path + file.name }]),
        () => resolve([])
      );
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
          readBatch(); // directories page results; keep reading
        }, () => resolve([]));
      };
      readBatch();
    } else {
      resolve([]);
    }
  });
}

export default function Uploader({ token }) {
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState([]);
  const [mine, setMine] = useState([]);
  const [loadingMine, setLoadingMine] = useState(true);
  const [orgBusy, setOrgBusy] = useState(false);
  const [orgMsg, setOrgMsg] = useState('');
  const fileRef = useRef(null);
  const folderRef = useRef(null);

  // Browsers only expose webkitdirectory at runtime; set it after mount.
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

  useEffect(() => {
    loadMine();
  }, [loadMine]);

  // Organize your own uploads: reorder / rename / move / send to Trash. Deleting
  // for good is left to the studio — anything you move to "Trash" just gets set
  // aside for them to clear.
  async function organize(payload) {
    setOrgBusy(true);
    setOrgMsg('');
    try {
      const res = await fetch('/api/portal/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...payload }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Could not save your change');
      }
      await loadMine();
    } catch (e) {
      setOrgMsg(e.message || 'Something went wrong.');
    }
    setOrgBusy(false);
  }

  // Reorder within a folder: swap neighbours, then renumber that folder 1..n.
  function moveWithin(folderKey, id, dir) {
    const ids = mine.filter((m) => (m.folderPath || '') === folderKey).map((m) => m.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    const next = ids.slice();
    [next[i], next[j]] = [next[j], next[i]];
    organize({ action: 'renumber', ids: next });
  }

  function putWithProgress(url, file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`));
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(file);
    });
  }

  async function uploadOne({ file, relPath }, index, setStatus) {
    const contentType = file.type || 'application/octet-stream';
    setStatus(index, { status: 'starting', pct: 0 });

    const urlRes = await fetch('/api/portal/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, contentType }),
    });
    if (!urlRes.ok) {
      const j = await urlRes.json().catch(() => ({}));
      throw new Error(j.error || 'Could not start upload');
    }
    const { url, key } = await urlRes.json();

    setStatus(index, { status: 'uploading', pct: 0 });
    await putWithProgress(url, file, (pct) => setStatus(index, { status: 'uploading', pct }));

    await fetch('/api/portal/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        key,
        filename: file.name,
        contentType,
        size: file.size,
        sortNumber: leadingNumber(file.name),
        folderPath: folderFromPath(relPath),
      }),
    });
    setStatus(index, { status: 'done', pct: 100 });
  }

  // entries: [{ file, relPath }]
  async function handleEntries(entries) {
    const clean = entries.filter(
      (e) => e.file && e.file.name && !e.file.name.startsWith('.') // skip .DS_Store etc
    );
    if (!clean.length) return;

    clean.sort((a, b) => a.relPath.localeCompare(b.relPath, undefined, { numeric: true }));

    const base = items.length;
    setItems((prev) => [
      ...prev,
      ...clean.map((e) => ({
        name: e.file.name,
        folder: folderFromPath(e.relPath),
        size: e.file.size,
        status: 'queued',
        pct: 0,
      })),
    ]);

    const setStatus = (i, patch) =>
      setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

    for (let i = 0; i < clean.length; i++) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await uploadOne(clean[i], base + i, setStatus);
      } catch (e) {
        setStatus(base + i, { status: 'error', error: e.message });
      }
    }
    loadMine();
  }

  // Plain <input> files. Folder picker gives webkitRelativePath; file picker doesn't.
  function fromInput(fileList) {
    return Array.from(fileList).map((file) => ({
      file,
      relPath: file.webkitRelativePath || file.name,
    }));
  }

  async function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const dt = e.dataTransfer;

    // Folder-aware path (Chrome/Safari/Edge). Falls back to flat files.
    const entries = Array.from(dt.items || [])
      .map((it) => (it.webkitGetAsEntry ? it.webkitGetAsEntry() : null))
      .filter(Boolean);

    if (entries.length) {
      const nested = await Promise.all(entries.map((en) => readEntry(en)));
      await handleEntries(nested.flat());
    } else if (dt.files?.length) {
      await handleEntries(fromInput(dt.files));
    }
  }

  // Group the already-uploaded list by folder for display.
  const grouped = mine.reduce((acc, m) => {
    const k = m.folderPath || '';
    (acc[k] = acc[k] || []).push(m);
    return acc;
  }, {});
  const groupKeys = Object.keys(grouped).sort((a, b) => {
    if (a === '') return -1;
    if (b === '') return 1;
    return a.localeCompare(b, undefined, { numeric: true });
  });

  return (
    <main className="wrap hub">
      <a href={`/p/${token}`} className="backlink">← Back to your portal</a>

      <p className="eyebrow">Send us your media</p>
      <h1 className="neon neon-red" style={{ fontSize: 26, margin: '4px 0 10px' }}>
        Upload your photos and videos here
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6, marginTop: 0 }}>
        Number your photos in the order you’d like them — 001.jpg, 002.jpg, and so on. We wish we
        knew your family and friends, but until we do, you’ll need to tell us the order to put your
        photos in. Drop in whole folders if you like — we’ll keep your folder names and the order
        inside each one, so “Joey as a baby” stays exactly as you built it.
      </p>

      <div
        className={`dropzone${dragging ? ' drag' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}
      >
        Drag your files or folders here
        <div style={{ marginTop: 10, fontSize: 13, color: 'var(--muted)' }}>
          or{' '}
          <button
            type="button"
            className="linklike"
            onClick={(e) => {
              e.stopPropagation();
              fileRef.current?.click();
            }}
          >
            choose files
          </button>{' '}
          ·{' '}
          <button
            type="button"
            className="linklike"
            onClick={(e) => {
              e.stopPropagation();
              folderRef.current?.click();
            }}
          >
            choose a folder
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => e.target.files?.length && handleEntries(fromInput(e.target.files))}
        />
        <input
          ref={folderRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => e.target.files?.length && handleEntries(fromInput(e.target.files))}
        />
      </div>

      {items.length > 0 && (
        <div style={{ marginTop: 20 }}>
          {items.map((it, i) => (
            <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <div className="upload-row" style={{ border: 'none', padding: 0 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {it.folder && <span style={{ color: 'var(--muted)' }}>{it.folder}/</span>}
                  {it.name}
                </span>
                <span
                  style={{
                    color: it.status === 'error' ? 'var(--red)' : 'var(--muted)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {it.status === 'done'
                    ? 'Uploaded'
                    : it.status === 'error'
                    ? it.error || 'Failed'
                    : `${it.pct}%`}
                </span>
              </div>
              {it.status !== 'done' && it.status !== 'error' && (
                <div className="progress" style={{ marginTop: 6 }}>
                  <span style={{ width: `${it.pct}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <h2 className="neon neon-blue" style={{ fontSize: 18, marginTop: 32 }}>Files you’ve sent us</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: -4, lineHeight: 1.6 }}>
        Put them in the order you want (edit the number), rename anything, move a file by typing a folder
        name, and drop duplicates or ones you don’t want into <strong>Trash</strong> — we’ll clear those
        for you. Everyone in your family can help here.
      </p>
      {orgMsg && <p className="msg-error" style={{ fontSize: 13 }}>{orgMsg}</p>}
      {loadingMine ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : mine.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>Nothing yet — your uploads will appear here.</p>
      ) : (
        <>
          <datalist id="my-folders">
            {groupKeys.filter((k) => k !== '').map((n) => <option key={n} value={n} />)}
          </datalist>
          {groupKeys.map((k) => {
            const list = grouped[k];
            const isTrash = k === TRASH_FOLDER;
            return (
              <section key={k || 'loose'} style={{ marginTop: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  {k === '' ? (
                    <h3 className="folder-head" style={{ margin: 0 }}>Loose files</h3>
                  ) : isTrash ? (
                    <h3 className="folder-head" style={{ margin: 0 }}>
                      Trash <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12 }}>· we’ll clear these</span>
                    </h3>
                  ) : (
                    <input
                      key={`fh_${k}`}
                      defaultValue={k}
                      title="Rename this folder"
                      disabled={orgBusy}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== k) organize({ action: 'renameFolder', from: k, to: v });
                        else if (!v) e.target.value = k;
                      }}
                      style={{ fontWeight: 700, maxWidth: 260 }}
                    />
                  )}
                  {!isTrash && (
                    <>
                      <span style={{ flex: 1 }} />
                      <button type="button" className="linklike" disabled={orgBusy} onClick={() => organize({ action: 'renumber', ids: list.map((m) => m.id) })}>
                        Number 1…{list.length} in this order
                      </button>
                    </>
                  )}
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {list.map((m, idx) => (
                    <li
                      key={`${m.id}-${m.sortNumber}-${m.folderPath}-${m.filename}`}
                      className="upload-row"
                      style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
                    >
                      <input
                        type="number"
                        defaultValue={m.sortNumber ?? ''}
                        title="Order number"
                        disabled={orgBusy}
                        onBlur={(e) => {
                          const raw = e.target.value.trim();
                          if (String(m.sortNumber ?? '') !== String(raw)) organize({ action: 'update', id: m.id, sortNumber: raw === '' ? null : Number(raw) });
                        }}
                        style={{ width: 52 }}
                      />
                      <input
                        defaultValue={m.filename}
                        title="File name"
                        disabled={orgBusy}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== m.filename) organize({ action: 'update', id: m.id, filename: v });
                          else if (!v) e.target.value = m.filename;
                        }}
                        style={{ flex: '1 1 150px', minWidth: 110 }}
                      />
                      <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                        {(m.contentType || '').startsWith('video') ? 'Video' : 'Photo'}
                      </span>
                      <input
                        list="my-folders"
                        defaultValue={m.folderPath || ''}
                        placeholder="(loose)"
                        title="Type a folder to move this file"
                        disabled={orgBusy}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v !== (m.folderPath || '')) organize({ action: 'update', id: m.id, folderPath: v });
                        }}
                        style={{ width: 120 }}
                      />
                      <span style={{ whiteSpace: 'nowrap' }}>
                        <button type="button" className="linklike" disabled={orgBusy || idx === 0} onClick={() => moveWithin(k, m.id, -1)} title="Move up">↑</button>{' '}
                        <button type="button" className="linklike" disabled={orgBusy || idx === list.length - 1} onClick={() => moveWithin(k, m.id, 1)} title="Move down">↓</button>
                      </span>
                      {isTrash ? (
                        <button type="button" className="linklike" disabled={orgBusy} onClick={() => organize({ action: 'update', id: m.id, folderPath: '' })}>Restore</button>
                      ) : (
                        <button type="button" className="linklike" style={{ color: 'var(--red)' }} disabled={orgBusy} onClick={() => organize({ action: 'update', id: m.id, folderPath: TRASH_FOLDER })}>Move to Trash</button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}
    </main>
  );
}
