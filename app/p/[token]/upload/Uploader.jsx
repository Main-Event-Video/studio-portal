'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

function leadingNumber(name) {
  const m = name.match(/^\s*0*(\d+)/);
  return m ? parseInt(m[1], 10) : null;
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

export default function Uploader({ token }) {
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState([]); // { name, size, status, pct }
  const [mine, setMine] = useState([]);
  const [loadingMine, setLoadingMine] = useState(true);
  const inputRef = useRef(null);

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

  function putWithProgress(url, file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(file);
    });
  }

  async function uploadOne(file, index, setStatus) {
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
      }),
    });
    setStatus(index, { status: 'done', pct: 100 });
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const base = items.length;
    setItems((prev) => [...prev, ...files.map((f) => ({ name: f.name, size: f.size, status: 'queued', pct: 0 }))]);

    const setStatus = (i, patch) =>
      setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

    for (let i = 0; i < files.length; i++) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await uploadOne(files[i], base + i, setStatus);
      } catch (e) {
        setStatus(base + i, { status: 'error', error: e.message });
      }
    }
    loadMine();
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  }

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
        photos in. Video is welcome too.
      </p>

      <div
        className={`dropzone${dragging ? ' drag' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
      >
        Drag your files here, or tap to choose
        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => e.target.files?.length && handleFiles(e.target.files)}
        />
      </div>

      {items.length > 0 && (
        <div style={{ marginTop: 20 }}>
          {items.map((it, i) => (
            <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <div className="upload-row" style={{ border: 'none', padding: 0 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {it.name}
                </span>
                <span style={{ color: it.status === 'error' ? 'var(--red)' : 'var(--muted)', whiteSpace: 'nowrap' }}>
                  {it.status === 'done' ? 'Uploaded' : it.status === 'error' ? (it.error || 'Failed') : `${it.pct}%`}
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
      {loadingMine ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : mine.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>Nothing yet — your uploads will appear here.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {mine.map((m) => (
            <li key={m.id} className="upload-row">
              <span>{m.sortNumber != null ? `${String(m.sortNumber).padStart(3, '0')} · ` : ''}{m.filename}</span>
              <span style={{ color: 'var(--muted)' }}>{(m.contentType || '').startsWith('video') ? 'Video' : 'Photo'}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
