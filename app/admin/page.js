'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function api(path, options = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn-ghost"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? 'Copied' : label}
    </button>
  );
}

export default function AdminPage() {
  const [session, setSession] = useState(null);
  const [checked, setChecked] = useState(false);

  // login form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // create form
  const [form, setForm] = useState({
    display_name: '',
    last_name: '',
    email: '',
    event_date: '',
    event_type: '',
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [ticket, setTicket] = useState(null); // { credentials, portal_link, client }

  // list
  const [clients, setClients] = useState([]);
  const [listError, setListError] = useState('');

  // montage generator (spine v1)
  const MONTAGE_STYLES = [
    { value: 'hollywood', label: 'Hollywood — gold on black, slow + cinematic' },
    { value: 'timeless', label: 'Timeless — ivory, elegant, gentle' },
    { value: 'party', label: 'Party — fast, punchy, high energy' },
  ];
  const [mStyle, setMStyle] = useState('hollywood');
  const [mSpeed, setMSpeed] = useState(''); // '' = style default, else 1–10 s/photo
  const [mClientId, setMClientId] = useState('');
  const [mTitle, setMTitle] = useState('');
  const [mSubtitle, setMSubtitle] = useState('');
  const [mWatermark, setMWatermark] = useState(true);
  const [mBusy, setMBusy] = useState(false);
  const [mMsg, setMMsg] = useState('');
  const [mErr, setMErr] = useState(false);
  const [montages, setMontages] = useState([]);

  // deliver a cut (step 6)
  const [dClientId, setDClientId] = useState('');
  const [dKind, setDKind] = useState('rough_cut');
  const [dNote, setDNote] = useState('');
  const [dFile, setDFile] = useState(null);
  const [dPct, setDPct] = useState(0);
  const [dPhase, setDPhase] = useState('idle'); // idle | uploading | saving | done | error
  const [dMsg, setDMsg] = useState('');
  const dFileRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadClients = useCallback(async () => {
    try {
      const { clients } = await api('/api/admin/clients');
      setClients(clients);
      setListError('');
    } catch (e) {
      setListError(e.message);
    }
  }, []);

  const loadMontages = useCallback(async () => {
    try {
      const { montages } = await api('/api/admin/montage');
      setMontages(montages);
    } catch {
      /* panel shows empty; refresh button retries */
    }
  }, []);

  useEffect(() => {
    if (session) {
      loadClients();
      loadMontages();
    }
  }, [session, loadClients, loadMontages]);

  // framing adjustments
  const [adjFor, setAdjFor] = useState(null); // montage row being adjusted
  const [adjPhotos, setAdjPhotos] = useState([]);
  const [adjMap, setAdjMap] = useState({});
  const [adjSpeed, setAdjSpeed] = useState('');
  const [adjBusy, setAdjBusy] = useState(false);

  async function openAdjust(m) {
    if (adjFor?.id === m.id) { setAdjFor(null); return; }
    setAdjFor(m);
    setAdjMap(m.adjustments || {});
    setAdjSpeed(m.photoSeconds ? String(m.photoSeconds) : '');
    setAdjPhotos([]);
    try {
      const { photos } = await api(`/api/admin/montage/photos?clientId=${m.clientId}`);
      setAdjPhotos(photos);
    } catch (err) {
      setMErr(true);
      setMMsg(err.message);
    }
  }

  async function rerenderAdjusted() {
    if (!adjFor) return;
    setAdjBusy(true);
    setMMsg('');
    setMErr(false);
    try {
      await api('/api/admin/montage', {
        method: 'POST',
        body: JSON.stringify({
          clientId: adjFor.clientId,
          style: adjFor.style,
          title: adjFor.title,
          subtitle: adjFor.subtitle || null,
          watermark: adjFor.watermarked,
          photoSeconds: adjSpeed ? Number(adjSpeed) : null,
          adjustments: adjMap,
        }),
      });
      setMMsg('Re-render started with your framing fixes — it will appear as a new render below.');
      setAdjFor(null);
      loadMontages();
    } catch (err) {
      setMErr(true);
      setMMsg(err.message);
    }
    setAdjBusy(false);
  }

  async function syncMontage(id) {
    try {
      await api('/api/admin/montage/sync', {
        method: 'POST',
        body: JSON.stringify({ montageId: id }),
      });
      loadMontages();
    } catch (err) {
      setMErr(true);
      setMMsg(err.message);
    }
  }

  async function generateMontage(e) {
    e.preventDefault();
    setMMsg('');
    setMErr(false);
    if (!mClientId) { setMErr(true); return setMMsg('Pick a client first.'); }
    if (!mTitle.trim()) { setMErr(true); return setMMsg('Give it a title (usually the honoree’s name).'); }
    setMBusy(true);
    try {
      await api('/api/admin/montage', {
        method: 'POST',
        body: JSON.stringify({
          clientId: mClientId,
          style: mStyle,
          photoSeconds: mSpeed ? Number(mSpeed) : null,
          title: mTitle.trim(),
          subtitle: mSubtitle.trim() || null,
          watermark: mWatermark,
        }),
      });
      setMMsg('Render started — it will appear below as Rendering, then Ready. Renders take a few minutes; use Refresh.');
      setMTitle('');
      setMSubtitle('');
      loadMontages();
    } catch (err) {
      setMErr(true);
      setMMsg(err.message);
    }
    setMBusy(false);
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError(error.message);
    setLoggingIn(false);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    setTicket(null);
    try {
      const result = await api('/api/admin/clients', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setTicket(result);
      setForm({ display_name: '', last_name: '', email: '', event_date: '', event_type: '' });
      loadClients();
    } catch (err) {
      setCreateError(err.message);
    }
    setCreating(false);
  }

  async function resetPassword(id) {
    try {
      const result = await api(`/api/admin/clients/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'reset_password' }),
      });
      setTicket({ credentials: result.credentials, portal_link: null, reset: true });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setListError(e.message);
    }
  }

  async function toggleArchive(id) {
    try {
      await api(`/api/admin/clients/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'toggle_archive' }),
      });
      loadClients();
    } catch (e) {
      setListError(e.message);
    }
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
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error(`Upload failed (${xhr.status})`));
      xhr.onerror = () => reject(new Error('Upload failed (network)'));
      xhr.send(file);
    });
  }

  async function sendCut(e) {
    e.preventDefault();
    setDMsg('');
    if (!dClientId) return setDMsg('Pick a client first.');
    if (!dFile) return setDMsg('Choose a video file to send.');

    const contentType = dFile.type || 'application/octet-stream';
    try {
      setDPhase('uploading');
      setDPct(0);
      const { url, key } = await api('/api/admin/upload-url', {
        method: 'POST',
        body: JSON.stringify({ clientId: dClientId, contentType }),
      });
      await putWithProgress(url, dFile, setDPct);

      setDPhase('saving');
      const result = await api('/api/admin/deliver', {
        method: 'POST',
        body: JSON.stringify({
          clientId: dClientId,
          key,
          filename: dFile.name,
          contentType,
          size: dFile.size,
          kind: dKind,
          note: dNote,
        }),
      });

      setDPhase('done');
      setDMsg(
        result.emailed
          ? 'Sent — the client has the file and an email is on its way.'
          : `Saved to the client's portal, but the email did not send${
              result.emailError ? ` (${result.emailError})` : ''
            }. Check Postmark env vars.`
      );
      setDFile(null);
      setDNote('');
      if (dFileRef.current) dFileRef.current.value = '';
    } catch (err) {
      setDPhase('error');
      setDMsg(err.message || 'Something went wrong.');
    }
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const activeClients = clients.filter((c) => !c.archived);

  if (!checked) return null;

  if (!session) {
    return (
      <main className="wrap" style={{ maxWidth: 440 }}>
        <div className="logo-header" style={{ marginTop: '8vh' }}>
          <Image src="/logo.png" alt="Main Event Studio" width={240} height={162} priority />
          <p className="eyebrow">Studio Admin</p>
        </div>
        <form className="panel" onSubmit={handleLogin}>
          <h2 className="neon neon-blue">Sign in</h2>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {loginError && <p className="msg-error">{loginError}</p>}
          <button className="btn-primary" disabled={loggingIn}>
            {loggingIn ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="wrap">
      <div className="logo-header">
        <Image src="/logo.png" alt="Main Event Studio" width={220} height={148} priority />
        <p className="eyebrow">Studio Admin</p>
        <button className="btn-ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>

      <section className="panel">
        <h2 className="neon neon-red">New client</h2>
        <form onSubmit={handleCreate}>
          <div className="grid-2">
            <div>
              <label htmlFor="display_name">Welcome name (shown on portal)</label>
              <input id="display_name" placeholder="The Goldbergs" value={form.display_name} onChange={set('display_name')} required />
            </div>
            <div>
              <label htmlFor="last_name">Last name (password base)</label>
              <input id="last_name" placeholder="Goldberg" value={form.last_name} onChange={set('last_name')} required />
            </div>
            <div>
              <label htmlFor="client_email">Client email (username)</label>
              <input id="client_email" type="email" placeholder="family@example.com" value={form.email} onChange={set('email')} required />
            </div>
            <div>
              <label htmlFor="event_date">Event date</label>
              <input id="event_date" type="date" value={form.event_date} onChange={set('event_date')} required />
            </div>
            <div>
              <label htmlFor="event_type">Event type (optional)</label>
              <input id="event_type" placeholder="Bar Mitzvah, Wedding…" value={form.event_type} onChange={set('event_type')} />
            </div>
          </div>
          {form.last_name && form.event_date && (
            <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 12 }}>
              Password will be:{' '}
              <span className="mono" style={{ color: 'var(--text)' }}>
                {form.last_name.toLowerCase().replace(/[^a-z]/g, '')}
                {form.event_date.slice(5, 7)}
                {form.event_date.slice(8, 10)}
              </span>
            </p>
          )}
          {createError && <p className="msg-error">{createError}</p>}
          <button className="btn-primary" disabled={creating}>
            {creating ? 'Creating…' : 'Create client'}
          </button>
        </form>

        {ticket && (
          <dl className="ticket">
            <dt>{ticket.reset ? 'Password reset — new credentials' : 'Client created — credentials'}</dt>
            <dd>
              {ticket.credentials.username} / {ticket.credentials.password}{' '}
              <CopyButton text={`${ticket.credentials.username} / ${ticket.credentials.password}`} />
            </dd>
            {ticket.portal_link && (
              <>
                <dt>Private portal link</dt>
                <dd>
                  {ticket.portal_link} <CopyButton text={ticket.portal_link} label="Copy link" />
                </dd>
              </>
            )}
          </dl>
        )}
      </section>

      <section className="panel">
        <h2 className="neon neon-red">Send a cut</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: -8 }}>
          Uploads straight to the client’s portal and emails them a link. Watermark rough cuts on
          export before uploading; send finals clean and full-res.
        </p>
        <form onSubmit={sendCut}>
          <label htmlFor="d_client">Client</label>
          <select id="d_client" value={dClientId} onChange={(e) => setDClientId(e.target.value)}>
            <option value="">Select a client…</option>
            {activeClients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name} — {c.email}
              </option>
            ))}
          </select>

          <div className="field-group">
            <span className="field-label">What is this?</span>
            <div className="choices">
              <label className="choice">
                <input
                  type="radio"
                  name="d_kind"
                  checked={dKind === 'rough_cut'}
                  onChange={() => setDKind('rough_cut')}
                />
                Rough cut (watermarked)
              </label>
              <label className="choice">
                <input
                  type="radio"
                  name="d_kind"
                  checked={dKind === 'final'}
                  onChange={() => setDKind('final')}
                />
                Final (clean, full-res)
              </label>
            </div>
          </div>

          <label htmlFor="d_file">Video file</label>
          <input
            id="d_file"
            ref={dFileRef}
            type="file"
            accept="video/*"
            onChange={(e) => setDFile(e.target.files?.[0] || null)}
          />

          <label htmlFor="d_note">Personal note (optional — shown in the email)</label>
          <textarea
            id="d_note"
            value={dNote}
            onChange={(e) => setDNote(e.target.value)}
            placeholder="Hi! Here's the first look — can't wait to hear what you think."
          />

          {(dPhase === 'uploading' || dPhase === 'saving') && (
            <div className="progress" style={{ marginTop: 14 }}>
              <span style={{ width: `${dPhase === 'saving' ? 100 : dPct}%` }} />
            </div>
          )}
          {dMsg && (
            <p className={dPhase === 'error' ? 'msg-error' : 'msg-ok'} style={{ fontSize: 14 }}>
              {dMsg}
            </p>
          )}
          <button
            className="btn-primary"
            disabled={dPhase === 'uploading' || dPhase === 'saving'}
          >
            {dPhase === 'uploading'
              ? `Uploading… ${dPct}%`
              : dPhase === 'saving'
              ? 'Sending…'
              : 'Upload & send'}
          </button>
        </form>
      </section>

      <section className="panel">
        <h2 className="neon neon-red">Generate montage</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: -8 }}>
          Builds a Hollywood-style montage from the client’s uploaded photos, in their folder and
          numbering order. Drafts carry the logo watermark automatically. Rendering happens in the
          cloud — start it and check back.
        </p>
        <form onSubmit={generateMontage}>
          <div className="grid-2">
            <div>
              <label htmlFor="m_client">Client</label>
              <select id="m_client" value={mClientId} onChange={(e) => setMClientId(e.target.value)}>
                <option value="">Select a client…</option>
                {activeClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.display_name} — {c.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="m_style">Style</label>
              <select id="m_style" value={mStyle} onChange={(e) => setMStyle(e.target.value)}>
                {MONTAGE_STYLES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="m_title">Title (honoree)</label>
              <input id="m_title" placeholder="DYLAN" value={mTitle} onChange={(e) => setMTitle(e.target.value)} />
            </div>
            <div>
              <label htmlFor="m_subtitle">Subtitle (optional)</label>
              <input id="m_subtitle" placeholder="A Bat Mitzvah Story" value={mSubtitle} onChange={(e) => setMSubtitle(e.target.value)} />
            </div>
            <div>
              <label htmlFor="m_speed">Seconds per photo</label>
              <select id="m_speed" value={mSpeed} onChange={(e) => setMSpeed(e.target.value)}>
                <option value="">Style default</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
                  <option key={s} value={s}>{s} second{s > 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field-group">
            <label className="choice" style={{ color: 'var(--text)' }}>
              <input type="checkbox" checked={mWatermark} onChange={(e) => setMWatermark(e.target.checked)} />
              Watermark this draft with the logo
            </label>
          </div>
          {mMsg && <p className={mErr ? 'msg-error' : 'msg-ok'} style={{ fontSize: 14 }}>{mMsg}</p>}
          <button className="btn-primary" disabled={mBusy}>
            {mBusy ? 'Starting…' : 'Generate montage'}
          </button>
        </form>

        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 className="folder-head" style={{ margin: 0 }}>Renders</h3>
            <button className="btn-ghost" type="button" onClick={loadMontages}>Refresh</button>
          </div>
          {montages.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>No montages yet.</p>
          ) : (
            montages.map((m) => (
              <div key={m.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
                <div className="upload-row" style={{ border: 'none', padding: 0 }}>
                  <span>
                    <strong>{m.title}</strong>
                    <span style={{ color: 'var(--muted)' }}> · {m.client} · {m.style} · {m.photoCount} photos</span>
                    {m.watermarked && <span className="pill" style={{ marginLeft: 8 }}>draft</span>}
                  </span>
                  <span
                    style={{
                      color:
                        m.status === 'ready' ? 'var(--ok)' : m.status === 'failed' ? 'var(--red)' : 'var(--muted)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {m.status === 'rendering' ? 'Rendering…' : m.status}
                    {(m.status === 'rendering' || m.status === 'queued') && (
                      <>
                        {' '}
                        <button type="button" className="btn-ghost" onClick={() => syncMontage(m.id)}>
                          Check status
                        </button>
                      </>
                    )}
                  </span>
                </div>
                {m.status === 'failed' && m.error && (
                  <p className="msg-error" style={{ marginTop: 6, fontSize: 13 }}>{m.error}</p>
                )}
                {m.status === 'ready' && m.url && (
                  <div style={{ marginTop: 10 }}>
                    <video src={m.url} controls preload="metadata" style={{ width: '100%', maxHeight: 320, borderRadius: 10, background: '#000' }} />
                    <p style={{ marginTop: 8, fontSize: 13 }}>
                      <a href={m.url} download>Download MP4</a>
                      {' '}·{' '}
                      <button type="button" className="linklike" onClick={() => openAdjust(m)}>
                        {adjFor?.id === m.id ? 'Close framing fixes' : 'Fix framing (head cut off, etc.)'}
                      </button>
                      {!m.archived && (
                        <span style={{ color: 'var(--muted)' }}>
                          {' '}· not yet archived to our storage — this copy expires in ~30 days, download it
                        </span>
                      )}
                    </p>
                    {adjFor?.id === m.id && (
                      <div style={{ marginTop: 10, padding: '14px 0', borderTop: '1px solid var(--line)' }}>
                        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>
                          Photos in montage order. For any photo cropped badly, pick which part to show,
                          then re-render. A re-render is a full new render (uses credits).
                        </p>
                        {adjPhotos.length === 0 ? (
                          <p style={{ color: 'var(--muted)' }}>Loading photos…</p>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
                            {adjPhotos.map((p) => (
                              <div key={p.key}>
                                <img
                                  src={p.url}
                                  alt={p.filename}
                                  style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 8, border: adjMap[p.key] ? '2px solid var(--blue)' : '1px solid var(--line)' }}
                                />
                                <div style={{ fontSize: 11, color: 'var(--muted)', margin: '4px 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {p.index}. {p.filename}
                                </div>
                                <select
                                  value={adjMap[p.key] || ''}
                                  onChange={(e) =>
                                    setAdjMap((prev) => {
                                      const next = { ...prev };
                                      if (e.target.value) next[p.key] = e.target.value;
                                      else delete next[p.key];
                                      return next;
                                    })
                                  }
                                  style={{ fontSize: 12, padding: '6px 8px' }}
                                >
                                  <option value="">Center (default)</option>
                                  <option value="top">Show top (keep heads)</option>
                                  <option value="bottom">Show bottom</option>
                                  <option value="left">Show left side</option>
                                  <option value="right">Show right side</option>
                                </select>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="field-group" style={{ maxWidth: 260 }}>
                          <label htmlFor="adj_speed">Seconds per photo (for this re-render)</label>
                          <select id="adj_speed" value={adjSpeed} onChange={(e) => setAdjSpeed(e.target.value)}>
                            <option value="">Style default</option>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
                              <option key={s} value={s}>{s} second{s > 1 ? 's' : ''}</option>
                            ))}
                          </select>
                        </div>
                        <button className="btn-primary" type="button" disabled={adjBusy || adjPhotos.length === 0} onClick={rerenderAdjusted}>
                          {adjBusy ? 'Starting…' : `Re-render with ${Object.keys(adjMap).length} fix${Object.keys(adjMap).length === 1 ? '' : 'es'}`}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="panel">
        <h2 className="neon neon-blue">Clients</h2>
        {listError && <p className="msg-error">{listError}</p>}
        {clients.length === 0 && !listError && (
          <p style={{ color: 'var(--muted)' }}>No clients yet. Create the first one above.</p>
        )}
        {clients.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Email</th>
                  <th>Event</th>
                  <th>Portal link</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td>
                      {c.display_name}{' '}
                      {c.archived && <span className="pill archived">archived</span>}
                    </td>
                    <td className="mono">{c.email}</td>
                    <td>
                      {c.event_date}
                      {c.event_type ? ` · ${c.event_type}` : ''}
                    </td>
                    <td>
                      <CopyButton text={`${siteUrl}/p/${c.portal_token}`} label="Copy link" />
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn-ghost" onClick={() => resetPassword(c.id)}>Reset password</button>{' '}
                      <button className="btn-ghost" onClick={() => toggleArchive(c.id)}>
                        {c.archived ? 'Unarchive' : 'Archive'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
