'use client';

import { useEffect, useState, useCallback, useRef, Fragment } from 'react';
import Image from 'next/image';
import { createClient } from '@supabase/supabase-js';
import { parsePhotoSpec } from '@/lib/montage';

// Read-only intake display: field groups + how each value renders.
const INTAKE_SECTIONS = [
  {
    title: 'Contact & logistics',
    fields: [
      ['first_name', 'First name'],
      ['last_name', 'Last name'],
      ['main_contact_name', 'Main contact (if different)'],
      ['email', 'Email (as they entered)'],
      ['contact_number', 'Contact number'],
      ['contact_number_type', 'Number type'],
      ['event_date', 'Event date (their estimate)'],
      ['venue', 'Venue'],
      ['preferred_contact_method', 'Preferred contact method'],
      ['preferred_language', 'Preferred language'],
      ['preferred_language_other', 'Language (other)'],
      ['news_signup', 'Newsletter sign-up'],
    ],
  },
  {
    title: 'Event & creative direction',
    fields: [
      ['honoree_names', 'Honoree name(s)'],
      ['age_milestone', 'Age / milestone'],
      ['has_logo', 'Has a logo'],
      ['event_description', 'Event description'],
      ['vibe', 'Vibe'],
      ['color_palette', 'Color palette'],
      ['inspiration_links', 'Inspiration links'],
      ['songs', 'Songs'],
      ['must_include', 'Must include'],
      ['avoid_content', 'Avoid'],
      ['hobbies', 'Hobbies'],
      ['favorite_media', 'Favorite shows / movies / brands'],
      ['favorite_quotes', 'Favorite quotes'],
      ['anything_else', 'Anything else'],
    ],
  },
];

function intakeValue(key, v) {
  if (key === 'vibe') return Array.isArray(v) && v.length ? v.join(', ') : '—';
  if (key === 'news_signup') return v ? 'Yes' : 'No';
  if (key === 'has_logo') return v === true ? 'Yes' : v === false ? 'No' : '—';
  if (v == null || v === '') return '—';
  return String(v);
}

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

// "2026-07-12T18:03:00Z" → "Jul 12, 2026". Date only; safe on null.
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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

  // accordion: which client's workspace is open, and which tool inside it.
  const [openClientId, setOpenClientId] = useState(null);
  const [activeTool, setActiveTool] = useState(null); // 'montage' | 'cut' | null

  // montage generator (spine v1)
  const MONTAGE_STYLES = [
    { value: 'hollywood', label: 'Hollywood — gold on black, slow + cinematic' },
    { value: 'timeless', label: 'Timeless — ivory, elegant, gentle' },
    { value: 'party', label: 'Party — fast, punchy, high energy' },
  ];
  const [mClientId, setMClientId] = useState('');
  const [mClientName, setMClientName] = useState('');
  const [mTitle, setMTitle] = useState('');       // honoree — used on any segment with cards
  const [mSubtitle, setMSubtitle] = useState('');
  const [mWatermark, setMWatermark] = useState(true);
  const [mMsg, setMMsg] = useState('');
  const [mErr, setMErr] = useState(false);
  const [montages, setMontages] = useState([]);

  // multi-segment montage builder. One montage per segment; typed photo order.
  const segKey = useRef(1);
  const newSegment = () => ({ key: `seg${segKey.current++}`, photos: '', style: 'hollywood', speed: '', cards: true });
  const [segments, setSegments] = useState([]);          // seeded when a client's montage tool opens
  const [projPhotos, setProjPhotos] = useState([]);      // [{ index, key, filename, url }]
  const [projPhotosClientId, setProjPhotosClientId] = useState(null);
  const [projPhotosLoading, setProjPhotosLoading] = useState(false);
  const [showRef, setShowRef] = useState(false);         // numbered reference strip
  const [genBusy, setGenBusy] = useState(false);

  // client intake (read-only view in the workspace)
  const [intake, setIntake] = useState(null);
  const [intakeClientId, setIntakeClientId] = useState(null);
  const [intakeLoading, setIntakeLoading] = useState(false);

  // send-a-cut drag-and-drop
  const [dragOver, setDragOver] = useState(false);

  // deliver a cut (step 6)
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

  // Prime the shared work forms for a specific client. One selection drives
  // BOTH the montage generator and Send a cut inside that client's workspace.
  function pickClient(c) {
    setMClientId(c.id);
    setMClientName(c.display_name);
    setMTitle(c.display_name);
    setMSubtitle('');
    setMMsg('');
    setMErr(false);
    setDMsg('');
    setDPhase('idle');
    setSegments([newSegment()]); // fresh one-segment plan for this client
    setShowRef(false);
  }

  // Click the client's name pill: toggle their workspace open/closed.
  function openClient(c) {
    if (openClientId === c.id) {
      setOpenClientId(null);
      setActiveTool(null);
      return;
    }
    pickClient(c);
    setOpenClientId(c.id);
    setActiveTool(null); // show the two tool buttons first; user picks one
  }

  // Inside an open workspace: pick Montage or Send a cut (toggles the window).
  function chooseTool(c, tool) {
    const next = activeTool === tool ? null : tool;
    setActiveTool(next);
    if (next === 'montage') loadProjPhotos(c.id); // need the photo count + numbering
    if (next === 'intake') loadIntake(c.id);
  }

  // The client's submitted questionnaire. Cached per client; Refresh forces it.
  async function loadIntake(clientId, force = false) {
    if (!force && intakeClientId === clientId) return; // already have it (even if null)
    setIntakeLoading(true);
    try {
      const { intake } = await api(`/api/admin/intake?clientId=${clientId}`);
      setIntake(intake || null);
      setIntakeClientId(clientId);
    } catch (err) {
      setMErr(true);
      setMMsg(err.message);
    }
    setIntakeLoading(false);
  }

  // This client's photos (numbered 1..N in montage order) — powers range
  // validation, the live per-segment preview, and the numbered reference strip.
  async function loadProjPhotos(clientId) {
    if (projPhotosClientId === clientId && projPhotos.length) return; // already have them
    setProjPhotosLoading(true);
    try {
      const { photos } = await api(`/api/admin/montage/photos?clientId=${clientId}`);
      setProjPhotos(photos || []);
      setProjPhotosClientId(clientId);
    } catch (err) {
      setMErr(true);
      setMMsg(err.message);
    }
    setProjPhotosLoading(false);
  }

  const addSegment = () => setSegments((s) => [...s, newSegment()]);
  const removeSegment = (key) => setSegments((s) => (s.length > 1 ? s.filter((x) => x.key !== key) : s));
  const updateSegment = (key, patch) => setSegments((s) => s.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  // framing adjustments
  const [adjFor, setAdjFor] = useState(null); // montage row being adjusted
  const [adjPhotos, setAdjPhotos] = useState([]);
  const [adjMap, setAdjMap] = useState({});
  const [adjSpeed, setAdjSpeed] = useState('');
  const [adjBusy, setAdjBusy] = useState(false);
  const [showVid, setShowVid] = useState({}); // per-render preview toggle

  // Persist framing picks as they're made (refresh-proof). Fire-and-forget.
  function saveAdjustments(montageId, next) {
    api('/api/admin/montage/adjust', {
      method: 'POST',
      body: JSON.stringify({ montageId, adjustments: next }),
    }).catch(() => {});
  }

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
          photoSpec: adjFor.photoSpec || null,       // keep this render's photo selection
          includeCards: adjFor.includeCards !== false, // keep its cards choice
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

  // Fire one render per segment, in order. Segments that select no photos are
  // skipped. Reports how many queued and surfaces any per-segment errors.
  async function generateAll(c) {
    setMMsg('');
    setMErr(false);
    if (!mTitle.trim()) {
      setMErr(true);
      return setMMsg('Give it a title (the honoree) — it’s used on any segment that has title cards.');
    }
    const N = projPhotos.length;
    const plan = segments.filter((s) => parsePhotoSpec(s.photos, N).length > 0);
    if (!plan.length) {
      setMErr(true);
      return setMMsg(`No segment selects any photos — check the numbers against this client’s ${N} photo${N === 1 ? '' : 's'}.`);
    }
    setGenBusy(true);
    let ok = 0;
    const errs = [];
    for (const s of plan) {
      try {
        await api('/api/admin/montage', {
          method: 'POST',
          body: JSON.stringify({
            clientId: c.id,
            style: s.style,
            title: mTitle.trim(),
            subtitle: mSubtitle.trim() || null,
            watermark: mWatermark,
            photoSeconds: s.speed ? Number(s.speed) : null,
            photoSpec: s.photos.trim() || null,
            includeCards: s.cards,
          }),
        });
        ok++;
      } catch (err) {
        errs.push(err.message);
      }
    }
    setGenBusy(false);
    setMErr(errs.length > 0);
    setMMsg(
      `Queued ${ok} render${ok === 1 ? '' : 's'}${errs.length ? ` — ${errs.length} failed: ${errs.join('; ')}` : ''}. ` +
        'They’ll appear below as Rendering, then Ready. Renders take a few minutes; use Refresh.'
    );
    loadMontages();
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
    if (!mClientId) return setDMsg('Pick a client first — open their workspace from the Clients list.');
    if (!dFile) return setDMsg('Choose a video file to send.');

    const contentType = dFile.type || 'application/octet-stream';
    try {
      setDPhase('uploading');
      setDPct(0);
      const { url, key } = await api('/api/admin/upload-url', {
        method: 'POST',
        body: JSON.stringify({ clientId: mClientId, contentType }),
      });
      await putWithProgress(url, dFile, setDPct);

      setDPhase('saving');
      const result = await api('/api/admin/deliver', {
        method: 'POST',
        body: JSON.stringify({
          clientId: mClientId,
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

  // ---- Inline tool windows (rendered inside an open client's workspace) ----

  function renderCutTool() {
    return (
      <div className="tool-window" style={{ marginTop: 16 }}>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>
          Uploads straight to this client’s portal and emails them a link. Watermark rough cuts on
          export before uploading; send finals clean and full-res.
        </p>
        <form onSubmit={sendCut}>
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
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f && (f.type.startsWith('video/') || !f.type)) {
                setDFile(f);
                if (dFileRef.current) dFileRef.current.value = '';
              }
            }}
            onClick={() => dFileRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') dFileRef.current?.click(); }}
            style={{
              border: `2px dashed ${dragOver ? 'var(--blue, #2563eb)' : 'var(--line)'}`,
              borderRadius: 10,
              padding: '18px 16px',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragOver ? 'rgba(37,99,235,0.06)' : 'transparent',
              color: 'var(--muted)',
              fontSize: 14,
            }}
          >
            {dFile ? (
              <span style={{ color: 'var(--text)' }}>{dFile.name}</span>
            ) : (
              <>Drag &amp; drop a video here, or <span style={{ color: 'var(--text)', textDecoration: 'underline' }}>click to choose</span></>
            )}
          </div>
          <input
            id="d_file"
            ref={dFileRef}
            type="file"
            accept="video/*"
            style={{ display: 'none' }}
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
          <button className="btn-primary" disabled={dPhase === 'uploading' || dPhase === 'saving'}>
            {dPhase === 'uploading'
              ? `Uploading… ${dPct}%`
              : dPhase === 'saving'
              ? 'Sending…'
              : 'Upload & send'}
          </button>
        </form>
      </div>
    );
  }

  function renderIntakeTool(c) {
    const showing = intakeClientId === c.id;
    const data = showing ? intake : null;
    return (
      <div className="tool-window" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>
            {intakeLoading && !showing
              ? 'Loading intake…'
              : data
              ? `Submitted ${fmtDate(data.submitted_at || data.updated_at)} — read-only snapshot of what the client entered.`
              : 'This client hasn’t submitted their intake questionnaire yet.'}
          </p>
          <button type="button" className="btn-ghost" onClick={() => loadIntake(c.id, true)}>Refresh</button>
        </div>
        {data &&
          INTAKE_SECTIONS.map((sec) => (
            <div key={sec.title} style={{ marginTop: 16 }}>
              <h3 className="folder-head" style={{ margin: '0 0 8px' }}>{sec.title}</h3>
              <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 220px) 1fr', gap: '6px 16px', margin: 0 }}>
                {sec.fields.map(([key, label]) => (
                  <Fragment key={key}>
                    <dt style={{ color: 'var(--muted)', fontSize: 13 }}>{label}</dt>
                    <dd style={{ margin: 0, fontSize: 14, whiteSpace: 'pre-wrap' }}>{intakeValue(key, data[key])}</dd>
                  </Fragment>
                ))}
              </dl>
            </div>
          ))}
      </div>
    );
  }

  function renderMontageTool(c) {
    const rows = montages.filter((x) => x.clientId === c.id);
    return (
      <div className="tool-window" style={{ marginTop: 16 }}>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>
          Build one or more montage segments from this client’s photos. Each segment renders as its
          own file — choose the photos (a range like <span className="mono">1-50</span>, or a mix like{' '}
          <span className="mono">1-10, 15, 11-51</span>; photos play in the order you type), a style, a
          pace, and whether it carries title cards. Generate them all at once and intercut in your edit.
        </p>

        {/* Shared across every segment */}
        <div className="grid-2">
          <div>
            <label htmlFor="m_title">Title (honoree — shown on any segment with cards)</label>
            <input id="m_title" placeholder="DYLAN" value={mTitle} onChange={(e) => setMTitle(e.target.value)} />
          </div>
          <div>
            <label htmlFor="m_subtitle">Subtitle (optional)</label>
            <input id="m_subtitle" placeholder="A Bat Mitzvah Story" value={mSubtitle} onChange={(e) => setMSubtitle(e.target.value)} />
          </div>
        </div>
        <div className="field-group">
          <label className="choice" style={{ color: 'var(--text)' }}>
            <input type="checkbox" checked={mWatermark} onChange={(e) => setMWatermark(e.target.checked)} />
            Watermark these drafts with the logo
          </label>
        </div>

        {/* Photo count + numbered reference */}
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          {projPhotosLoading
            ? 'Loading this client’s photos…'
            : `This client has ${projPhotos.length} photo${projPhotos.length === 1 ? '' : 's'}. The numbers below match this order.`}
          {projPhotos.length > 0 && (
            <>
              {' '}
              <button type="button" className="linklike" onClick={() => setShowRef((v) => !v)}>
                {showRef ? 'Hide numbered photos' : 'Show numbered photos'}
              </button>
            </>
          )}
        </p>
        {showRef && projPhotos.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 8, marginBottom: 16 }}>
            {projPhotos.map((p) => (
              <div key={p.key || p.index} style={{ textAlign: 'center' }}>
                <img
                  src={p.url}
                  alt={p.filename}
                  style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)' }}
                />
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{p.index}</div>
              </div>
            ))}
          </div>
        )}

        {/* Segment plan */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {segments.map((s, idx) => {
            const N = projPhotos.length;
            const matched = parsePhotoSpec(s.photos, N).length;
            return (
              <div key={s.key} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <strong style={{ fontSize: 13 }}>Segment {idx + 1}</strong>
                  {segments.length > 1 && (
                    <button type="button" className="linklike" onClick={() => removeSegment(s.key)}>Remove</button>
                  )}
                </div>
                <label htmlFor={`ph_${s.key}`}>Photos (blank = all; e.g. 1-50 or 1-10, 15, 11-51)</label>
                <input
                  id={`ph_${s.key}`}
                  placeholder="1-50"
                  value={s.photos}
                  onChange={(e) => updateSegment(s.key, { photos: e.target.value })}
                />
                <p style={{ fontSize: 12, margin: '4px 0 8px', color: N > 0 && matched === 0 ? 'var(--red)' : 'var(--muted)' }}>
                  {N === 0
                    ? 'Photos will load in a moment…'
                    : matched === 0
                    ? 'This selection matches no photos — check the numbers.'
                    : s.photos.trim()
                    ? `→ ${matched} of ${N} photos, in the order typed`
                    : `→ all ${N} photos`}
                </p>
                <div className="grid-2">
                  <div>
                    <label htmlFor={`st_${s.key}`}>Style</label>
                    <select id={`st_${s.key}`} value={s.style} onChange={(e) => updateSegment(s.key, { style: e.target.value })}>
                      {MONTAGE_STYLES.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`sp_${s.key}`}>Seconds per photo</label>
                    <select id={`sp_${s.key}`} value={s.speed} onChange={(e) => updateSegment(s.key, { speed: e.target.value })}>
                      <option value="">Style default</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <option key={n} value={n}>{n} second{n > 1 ? 's' : ''}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="field-group">
                  <label className="choice" style={{ color: 'var(--text)' }}>
                    <input type="checkbox" checked={s.cards} onChange={(e) => updateSegment(s.key, { cards: e.target.checked })} />
                    Include title cards (opening + closing)
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
          <button type="button" className="btn-ghost" onClick={addSegment}>+ Add segment</button>
          <button type="button" className="btn-primary" disabled={genBusy} onClick={() => generateAll(c)}>
            {genBusy ? 'Queuing…' : `Generate ${segments.length} segment${segments.length === 1 ? '' : 's'}`}
          </button>
        </div>
        {mMsg && <p className={mErr ? 'msg-error' : 'msg-ok'} style={{ fontSize: 14 }}>{mMsg}</p>}

        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 className="folder-head" style={{ margin: 0 }}>Renders</h3>
            <button className="btn-ghost" type="button" onClick={loadMontages}>Refresh</button>
          </div>
          {rows.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>No montages yet for this client.</p>
          ) : (
            rows.map((m) => (
              <div key={m.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
                <div className="upload-row" style={{ border: 'none', padding: 0 }}>
                  <span>
                    <strong>{m.title}</strong>
                    <span style={{ color: 'var(--muted)' }}>
                      {' '}· {m.style} · {m.photoSeconds ? `${m.photoSeconds}s/photo` : 'default pace'} · {m.photoCount} photos
                      {m.photoSpec ? ` · #${m.photoSpec}` : ''}
                    </span>
                    {m.watermarked && <span className="pill" style={{ marginLeft: 8 }}>draft</span>}
                    {m.includeCards === false && <span className="pill" style={{ marginLeft: 8 }}>no cards</span>}
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
                    {showVid[m.id] && (
                      <video src={m.url} controls preload="metadata" style={{ width: '100%', maxHeight: 320, borderRadius: 10, background: '#000' }} />
                    )}
                    <p style={{ marginTop: 8, fontSize: 13 }}>
                      <button type="button" className="linklike" onClick={() => setShowVid((v) => ({ ...v, [m.id]: !v[m.id] }))}>
                        {showVid[m.id] ? 'Hide preview' : 'Show preview'}
                      </button>
                      {' '}·{' '}
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
                                      saveAdjustments(m.id, next);
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
      </div>
    );
  }

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
                  <th>Last upload</th>
                  <th>Files</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => {
                  const isOpen = openClientId === c.id;
                  return (
                    <FragmentRow key={c.id}>
                      <tr className={isOpen ? 'row-open' : undefined}>
                        <td>
                          <button
                            type="button"
                            className="name-pill"
                            onClick={() => openClient(c)}
                            aria-expanded={isOpen}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '4px 12px',
                              borderRadius: 999,
                              border: '1px solid var(--line)',
                              background: isOpen ? 'var(--blue, #2563eb)' : 'transparent',
                              color: isOpen ? '#fff' : 'var(--text)',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            <span aria-hidden="true" style={{ fontSize: 11 }}>{isOpen ? '▾' : '▸'}</span>
                            {c.display_name}
                          </button>{' '}
                          {c.archived && <span className="pill archived">archived</span>}
                        </td>
                        <td className="mono">{c.email}</td>
                        <td>
                          {c.event_date}
                          {c.event_type ? ` · ${c.event_type}` : ''}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(c.last_upload_at)}</td>
                        <td>{c.upload_count ?? 0}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="btn-ghost" onClick={() => resetPassword(c.id)}>Reset password</button>{' '}
                          <button className="btn-ghost" onClick={() => toggleArchive(c.id)}>
                            {c.archived ? 'Unarchive' : 'Archive'}
                          </button>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr className="row-workspace">
                          <td colSpan={6} style={{ background: 'rgba(127,127,127,0.06)', padding: '18px 16px' }}>
                            <div className="client-workspace">
                              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <button
                                  type="button"
                                  className={activeTool === 'montage' ? 'btn-primary' : 'btn-ghost'}
                                  onClick={() => chooseTool(c, 'montage')}
                                >
                                  Generate montage
                                </button>
                                <button
                                  type="button"
                                  className={activeTool === 'cut' ? 'btn-primary' : 'btn-ghost'}
                                  onClick={() => chooseTool(c, 'cut')}
                                >
                                  Send a cut
                                </button>
                                <button
                                  type="button"
                                  className={activeTool === 'intake' ? 'btn-primary' : 'btn-ghost'}
                                  onClick={() => chooseTool(c, 'intake')}
                                >
                                  Intake form
                                </button>
                                <span style={{ flex: 1 }} />
                                <CopyButton text={`${siteUrl}/p/${c.portal_token}`} label="Copy portal link" />
                              </div>

                              {activeTool === 'montage' && renderMontageTool(c)}
                              {activeTool === 'cut' && renderCutTool()}
                              {activeTool === 'intake' && renderIntakeTool(c)}
                            </div>
                          </td>
                        </tr>
                      )}
                    </FragmentRow>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

// Groups a client's summary row with its (optional) expanded workspace row
// without adding DOM around them — <tbody> only allows <tr> children.
function FragmentRow({ children }) {
  return <>{children}</>;
}
