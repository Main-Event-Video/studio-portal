'use client';

import { useEffect, useState, useCallback, useRef, Fragment } from 'react';
import Image from 'next/image';
import { createClient } from '@supabase/supabase-js';
import { parsePhotoSpec } from '@/lib/montage';
import { buildTimeline } from '@/lib/timelineOrder';

// Clients move unwanted / duplicate files into this folder; only the admin
// actually deletes them ("Empty Trash"). Must match the portal's constant.
const TRASH_FOLDER = 'Trash';

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
      ['dj_contact', 'DJ (name & contact)'],
      ['planner_contact', 'Planner (name & contact)'],
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

// Read a video file's duration in the browser (it's already loaded for upload),
// so the server knows whether to watermark the first 90s only or the whole cut.
async function readVideoDuration(file) {
  return new Promise((resolve) => {
    try {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.onloadedmetadata = () => {
        const d = v.duration;
        try { URL.revokeObjectURL(v.src); } catch { /* noop */ }
        resolve(Number.isFinite(d) && d > 0 ? d : null);
      };
      v.onerror = () => resolve(null);
      v.src = URL.createObjectURL(file);
    } catch {
      resolve(null);
    }
  });
}

// Branded default note that pre-fills the "note to the client" field for every cut.
// Version-aware and editable — Josh can overwrite it per send.
function brandNote(kind, v) {
  if (kind === 'final') {
    return `Main Event Studio proudly presents your finished video! It's been a pleasure bringing your celebration to the screen. Enjoy! We know the ones you share it with will love it too.  ·  www.maineventstudio.com`;
  }
  const tag = v && String(v).trim() ? ` — presenting ${String(v).trim()}` : '';
  return `Main Event Studio${tag}. Here's your latest cut — take a look and let us know what you think!  ·  www.maineventstudio.com`;
}

// Roster of a client's characters (multi-character, #9).
async function fetchCharacterList(clientId) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const res = await fetch(`/api/admin/character-sheet?list=1&clientId=${clientId}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) return [];
  const j = await res.json().catch(() => ({}));
  return Array.isArray(j.characters) ? j.characters : [];
}

// Download one character's build sheet by character id.
async function downloadCharacterSheetById(characterId, name, regenerate = false) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const q = `${name ? `&name=${encodeURIComponent(name)}` : ''}${regenerate ? '&regenerate=1' : ''}`;
  const res = await fetch(`/api/admin/character-sheet?characterId=${characterId}&download=1${q}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) {
    let msg = 'Failed';
    try { msg = (await res.json()).error || msg; } catch { /* ignore */ }
    return { ok: false, error: msg };
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `character-build-${String(name || 'client').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { ok: true };
}

// Admin control: pick one of the client's characters and download its sheet.
function CharacterSheetPicker({ client }) {
  const [chars, setChars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [err, setErr] = useState('');
  const [regen, setRegen] = useState(false);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchCharacterList(client.id).then((list) => {
      if (!alive) return;
      setChars(list);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [client.id]);

  async function download(ch) {
    setBusyId(ch.id); setErr('');
    const r = await downloadCharacterSheetById(ch.id, ch.name || '', regen);
    setBusyId('');
    if (!r.ok) setErr(r.error || 'Failed');
  }

  if (loading) return <p style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</p>;
  if (!chars.length) return <p style={{ fontSize: 13, color: 'var(--muted)' }}>No character builds yet.</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 520 }}>
      <label style={{ fontSize: 12, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="checkbox" checked={regen} onChange={(e) => setRegen(e.target.checked)} /> Generate a fresh write-up on download
      </label>
      {chars.map((ch) => (
        <div key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid rgba(127,127,127,0.3)', borderRadius: 8 }}>
          <span style={{ fontWeight: 700 }}>{ch.name || 'Unnamed'}</span>
          <span style={{ fontSize: 12, opacity: 0.65 }}>{ch.done}/{ch.total}{ch.done >= ch.total ? ' ✓' : ''}</span>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            className="btn-ghost"
            disabled={!!busyId}
            title="Download this character's build sheet (PNG)"
            onClick={() => download(ch)}
          >
            {busyId === ch.id ? 'Building…' : 'Download sheet'}
          </button>
        </div>
      ))}
      {err && <span style={{ color: '#ff6b6b', fontSize: 12 }}>{err}</span>}
    </div>
  );
}

// ---- per-client private admin info sheet (#new) ----
const INFO_FIELDS = [
  { k: 'client_name', label: 'Client Name' },
  { k: 'honoree_names', label: 'Honoree Name(s)' },
  { k: 'instructing_party', label: 'Instructing Party' },
  { k: 'event_date', label: 'Event Date', type: 'date' },
  { k: 'event_type', label: 'Event Type' },
  { k: 'address', label: 'Address', type: 'area' },
  { k: 'billing_address', label: 'Billing Address (if different)', type: 'area' },
  { k: 'contract_amount', label: 'Contract Amount', type: 'money' },
  { k: 'deposit_amount', label: 'Deposit Amount', type: 'money' },
  { k: 'deposit_paid_date', label: 'Date Deposit Paid', type: 'date' },
  { k: 'outstanding_amount', label: 'Outstanding Amount', type: 'money' },
  { k: 'balance_due_date', label: 'Balance Amount Due Date', type: 'date' },
  { k: 'balance_paid_date', label: 'Date Balance Paid', type: 'date' },
  { k: 'contract_details', label: 'Contract Details', type: 'area' },
  { k: 'contract_in_portal', label: 'Contract (in portal?)' },
  { k: 'portal_link', label: 'Portal Link' },
  { k: 'portal_pw', label: 'Portal PW' },
  { k: 'image_use_optout', label: 'Image Use / Opt Out' },
  { k: 'dj_contact', label: 'DJ Name and Contact' },
  { k: 'venue', label: 'Venue' },
  { k: 'planner_contact', label: 'Planner Name and Contact' },
  { k: 'referral', label: 'Referral / How Did They Hear About Us', type: 'area' },
  { k: 'referral_code', label: 'Referral Thank-You / Discount MEV Code Sent' },
  { k: 'special_details', label: 'Special Details', type: 'area' },
  { k: 'notes', label: 'Notes', type: 'area' },
];

function portalPw(c) {
  if (!c?.last_name || !c?.event_date) return '';
  const [, mm, dd] = String(c.event_date).split('-');
  return `${String(c.last_name).toLowerCase().replace(/[^a-z]/g, '')}${mm || ''}${dd || ''}`;
}
function infoDefaults(c, siteUrl) {
  return {
    client_name: c.display_name || '',
    event_date: c.event_date || '',
    event_type: c.event_type || '',
    portal_link: c.portal_token ? `${siteUrl}/p/${c.portal_token}` : '',
    portal_pw: portalPw(c),
  };
}
function infoValues(c, siteUrl) {
  return { ...infoDefaults(c, siteUrl), ...(c.admin_info || {}) };
}

async function saveAdminInfo(clientId, info) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const res = await fetch(`/api/admin/clients/${clientId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ action: 'set_admin_info', admin_info: info }),
  });
  if (!res.ok) { let m = 'Save failed'; try { m = (await res.json()).error || m; } catch { /* non-json */ } throw new Error(m); }
  return true;
}

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}
function exportInfoCsv(clients, siteUrl, stamp) {
  const header = INFO_FIELDS.map((f) => csvCell(f.label)).join(',');
  const rows = clients.map((c) => {
    const v = infoValues(c, siteUrl);
    return INFO_FIELDS.map((f) => csvCell(v[f.k])).join(',');
  });
  const csv = [header, ...rows].join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mev-client-info-${stamp || 'export'}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function ClientInfoForm({ client, siteUrl, onSaved }) {
  const [form, setForm] = useState(() => infoValues(client, siteUrl));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const set = (k, val) => setForm((f) => ({ ...f, [k]: val }));
  const fs = { width: '100%', padding: '7px 9px', borderRadius: 8, border: '1px solid #c2c2c2', background: '#ffffff', color: '#111111', fontSize: 14 };
  return (
    <div style={{ background: '#ffffff', color: '#111111', padding: '14px 14px 16px', borderRadius: 10, border: '1px solid #dddddd', marginTop: 4 }}>
      <p style={{ fontSize: 12, color: '#555555', margin: '0 0 12px' }}>Private studio notes — never shown to the client. Name, event date/type, portal link, and password are pre-filled; edit anything and Save.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        {INFO_FIELDS.map((f) => (
          <label key={f.k} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#333333', gridColumn: f.type === 'area' ? '1 / -1' : 'auto' }}>
            <span style={{ fontWeight: 700, letterSpacing: 0.3, color: '#111111' }}>{f.label}</span>
            {f.type === 'area' ? (
              <textarea rows={2} value={form[f.k] || ''} onChange={(e) => set(f.k, e.target.value)} style={{ ...fs, resize: 'vertical' }} />
            ) : (
              <input type={f.type === 'date' ? 'date' : 'text'} inputMode={f.type === 'money' ? 'decimal' : undefined} placeholder={f.type === 'money' ? '$' : ''} value={form[f.k] || ''} onChange={(e) => set(f.k, e.target.value)} style={fs} />
            )}
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
        <button
          type="button"
          className="btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true); setMsg('');
            try { await saveAdminInfo(client.id, form); setMsg('Saved ✓'); onSaved?.(); }
            catch (e) { setMsg(e.message || 'Save failed'); }
            setBusy(false);
            setTimeout(() => setMsg(''), 2500);
          }}
        >
          {busy ? 'Saving…' : 'Save details'}
        </button>
        {msg && <span style={{ fontSize: 13, fontWeight: 700, color: msg.includes('✓') ? '#15803d' : '#b91c1c' }}>{msg}</span>}
      </div>
    </div>
  );
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
    { value: 'party2', label: 'Party 2 — energetic, drift + varied transitions' },
    { value: 'duotone', label: 'Duotone Split — dual-tint bg + true-colour hero' },
    { value: 'duotone2', label: 'Duotone Split 2 — frantic, bg & hero transition separately' },
    { value: 'duotone_pastel', label: 'Duotone Split Pastel — soft rainbow bg + true-colour hero' },
    { value: 'polaroid', label: 'Polaroid Drop — square print, thick white bottom' },
    { value: 'photo_drop', label: 'Photo Drop — whole photo, even white border' },
    { value: 'collage_classic', label: 'Collage Wall Classic — uniform photo grid, camera glides across' },
    { value: 'collage_featured', label: 'Collage Wall Featured — big hero photos + smaller tiles' },
    { value: 'gallery150', label: 'Gallery 150 — scattered tilted prints, camera flies over' },
    { value: 'epic_vintage', label: 'Epic Vintage — one hero print, blurred bokeh, heavy light leaks' },
    { value: 'story_builder', label: 'Story Builder — one at a time, builds a story wall (green screen)' },
    { value: 'trendy', label: 'Trendy Photo Wall — 3D angled grid of matte prints' },
    { value: 'multi_page', label: 'Multi Page — green screen, images pop on one by one' },
    { value: 'multi_page_record', label: 'Multi Page Record — green screen, page pivots then reveals' },
    { value: 'two_panel', label: 'Two Panel — green screen, 2 photos per card, sides alternate' },
    { value: 'photo_slide', label: 'Photo Slide — bordered prints slide across, each cut to its own shape' },
    { value: 'sliding_images', label: 'Sliding Images — native-shape photos push in; the next photo sets the direction' },
    { value: 'photo_ribbon', label: 'Photo Ribbon — one strip of native-shape photos, the next one always in view' },
    { value: 'comic_book', label: 'Comic Book — moves happen in comic, the real photo is the reveal' },
    { value: 'neon_frame', label: 'Neon Frame — a light runs around each photo\u2019s own edge, dark backdrop' },
    // Reuses Party 2's real render clip on purpose: Party 3 IS Party 2's look —
    // the difference is only what happens mid-transition, which a thumbnail
    // cannot show honestly.
    { value: 'party3', preview: 'party2', label: 'Party 3 — Party 2 movement with cover transitions (green-bleed fix test)' },
  ];

  // Styles that have never been through a real Creatomate render. The "Try the
  // new styles" button in Finish fires one short cheap draft of each. Prune this
  // list once a style has been seen and signed off.
  const NEW_STYLES = ['photo_slide', 'sliding_images', 'photo_ribbon', 'neon_frame', 'comic_book', 'party3', 'two_panel', 'duotone_pastel'];

  // ---- Studio background library -------------------------------------------
  // Imported backdrops — images AND videos — shared across every client, so a
  // look is uploaded once and reused. Files go browser -> R2 directly via a
  // presigned PUT; a 400MB background video never passes through Vercel.
  const [bgLib, setBgLib] = useState(null);      // null = not loaded yet
  const [bgLibErr, setBgLibErr] = useState('');
  const [bgLibBusy, setBgLibBusy] = useState(false);
  // How long each backdrop CLIP runs, in seconds, keyed by its R2 key. The
  // engine needs this to cross-dissolve each loop: a clip that was not built to
  // loop wraps with a visible jump, so copies are laid end to end and blended
  // at the seam — which is only placeable if we know where the seam is. Read in
  // the browser, from the file on upload and from the gallery thumbnails
  // otherwise, so backdrops imported before this existed still get it.
  const [bgDur, setBgDur] = useState({});
  const noteBgDur = (key, d) => {
    const secs = Number(d);
    if (!key || !(secs > 0) || !Number.isFinite(secs)) return;
    setBgDur((m) => (m[key] ? m : { ...m, [key]: Math.round(secs * 1000) / 1000 }));
  };
  // Duration straight from the chosen file, before it is uploaded.
  const readVideoDuration = (file) => new Promise((resolve) => {
    if (!file || !String(file.type || '').startsWith('video/')) return resolve(null);
    const v = document.createElement('video');
    const url = URL.createObjectURL(file);
    const done = (d) => { URL.revokeObjectURL(url); resolve(Number.isFinite(d) && d > 0 ? d : null); };
    v.preload = 'metadata';
    v.onloadedmetadata = () => done(v.duration);
    v.onerror = () => done(null);
    v.src = url;
  });
  const bgFileRef = useRef(null);
  const bgTargetSeg = useRef(null);

  const loadBgLib = async () => {
    setBgLibBusy(true);
    setBgLibErr('');
    try {
      const { backgrounds } = await api('/api/admin/backgrounds');
      setBgLib(backgrounds || []);
    } catch (e) {
      setBgLibErr(e.message);
    } finally {
      setBgLibBusy(false);
    }
  };

  const uploadBackground = async (file, segKeyForSelect) => {
    if (!file) return;
    setBgLibBusy(true);
    setBgLibErr('');
    try {
      const { url, key, kind } = await api('/api/admin/backgrounds', {
        method: 'POST',
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      const put = await fetch(url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      const clipS = await readVideoDuration(file);
      if (clipS) noteBgDur(key, clipS);
      await loadBgLib();
      // Select what was just uploaded on the segment that asked for it.
      if (segKeyForSelect) updateSegment(segKeyForSelect, { bgKey: key, bgKind: kind, bgClipS: clipS || null });
    } catch (e) {
      setBgLibErr(e.message);
    } finally {
      setBgLibBusy(false);
    }
  };

  const deleteBackground = async (key) => {
    setBgLibErr('');
    try {
      await api(`/api/admin/backgrounds?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
      setSegments((arr) => arr.map((x) => (x.bgKey === key ? { ...x, bgKey: '', bgKind: '' } : x)));
      await loadBgLib();
    } catch (e) {
      setBgLibErr(e.message);
    }
  };

  // ---- Creatomate template porting tool (READ-ONLY dev utility) -------------
  // Lists the templates in the Creatomate project this app already renders with,
  // and downloads any one's source JSON (its RenderScript) so the look can be
  // rebuilt as a montage style in lib/montage.js. We never render FROM a hosted
  // template — the engine builds its own source — so this is purely a way to read
  // a design out of the Creatomate editor. Uses the existing server-side API key;
  // nothing about the render integration changes.
  const [cmTemplates, setCmTemplates] = useState(null); // null = not loaded yet
  const [cmTplErr, setCmTplErr] = useState('');
  const [cmTplBusy, setCmTplBusy] = useState(false);
  const loadCmTemplates = async () => {
    setCmTplBusy(true);
    setCmTplErr('');
    try {
      const { templates } = await api('/api/admin/creatomate/templates');
      setCmTemplates(templates || []);
    } catch (e) {
      setCmTplErr(e.message);
    } finally {
      setCmTplBusy(false);
    }
  };
  const downloadCmTemplate = async (t) => {
    setCmTplErr('');
    try {
      const { template } = await api(`/api/admin/creatomate/templates?id=${encodeURIComponent(t.id)}`);
      const slug = String(t.name || t.id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || t.id;
      const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `creatomate-${slug}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 4000);
    } catch (e) {
      setCmTplErr(e.message);
    }
  };
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
  const newSegment = () => ({ key: `seg${segKey.current++}`, photos: '', album: '', style: 'hollywood', speed: '', paceMode: 'perphoto', tMin: '', tSec: '', tFrames: '', cards: true, green: true, bgMode: 'default', bgUrl: '', bgKey: '', bgKind: '', bgClipS: null, bgTint: '#102040', bgOpacity: '50', mpTransition: 'record-fwd', mpStagger: '', mpHold: '' });
  const [segments, setSegments] = useState([]);          // seeded when a client's montage tool opens
  const [projPhotos, setProjPhotos] = useState([]);      // [{ index, key, filename, url }]
  const [projPhotosClientId, setProjPhotosClientId] = useState(null);
  const [projPhotosLoading, setProjPhotosLoading] = useState(false);
  const [showRef, setShowRef] = useState(false);         // numbered reference strip
  const [genBusy, setGenBusy] = useState(false);
  const [showHidden, setShowHidden] = useState(false); // reveal hidden renders
  const [montageSort, setMontageSort] = useState('new'); // new|old|high|low|style
  const [montageStep, setMontageStep] = useState(1); // 1 edit · 2 style · 3 finish

  // Photo Editor (per-client): per-photo framing/fit/size/removed + global
  // colorCorrect. Persisted on the client row and applied to EVERY style render.
  const [photoEdits, setPhotoEdits] = useState({ photos: {}, colorCorrect: false });
  const [editsClientId, setEditsClientId] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editsSaving, setEditsSaving] = useState(false);
  const [editsSaved, setEditsSaved] = useState(false);
  const editsTimer = useRef(null);
  const replaceInputRef = useRef(null);
  const replaceKeyRef = useRef(null);
  const [replacing, setReplacing] = useState(null); // r2_key currently uploading
  const [rotatingKey, setRotatingKey] = useState(null); // r2_key currently rotating
  // Admin timeline reorder (same order the client arranges; writes back to the
  // shared timeline so admin<->client stays in sync).
  const [roOpen, setRoOpen] = useState(false);        // reorder panel shown?
  const [roClientId, setRoClientId] = useState(null);
  const [roTl, setRoTl] = useState([]);               // buildTimeline structure
  const [roPick, setRoPick] = useState(null);         // { scope:'top'|'album', album, id }
  const [roOpenAlbums, setRoOpenAlbums] = useState(() => new Set());
  const [roLoading, setRoLoading] = useState(false);
  const [roSaving, setRoSaving] = useState(false);
  const [roMsg, setRoMsg] = useState('');
  // Drag-to-reorder in the Photo editor grid (and reorder track): the natural
  // "grab a photo and drop it where you want it" gesture. Writes the same shared
  // timeline, so it syncs to the client's portal.
  const pcDrag = useRef(null);                        // { id, key } currently dragged
  const [pcOver, setPcOver] = useState(null);         // { key, id, album, side } hovered
  const pcOverRef = useRef(null);                     // same, synchronous (read on drop)
  const [pcMsg, setPcMsg] = useState('');
  // Undo / redo for reorder moves. Stacks hold whole-timeline arrangements
  // ({top,albums}); lastArrRef is the currently-applied one. Reset per client.
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const lastArrRef = useRef(null);
  const histClientRef = useRef(null);
  // Cached full timeline order (photos + videos) so drags apply instantly with no
  // per-drop fetch; saves run in the background, chained so they never race.
  const fullOrderRef = useRef(null);      // [{ id, album }] in play order
  const fullOrderClientRef = useRef(null);
  const saveChainRef = useRef(null);
  const [selKey, setSelKey] = useState(null);        // photo open in the big editor
  const bigDragRef = useRef(null);                   // drag-to-position state

  // client intake (read-only view in the workspace)
  const [intake, setIntake] = useState(null);
  const [intakeClientId, setIntakeClientId] = useState(null);
  const [intakeLoading, setIntakeLoading] = useState(false);

  // send-a-cut drag-and-drop
  const [dragOver, setDragOver] = useState(false);

  // client file manager (reorder / rename / move / delete / download)
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaClientId, setMediaClientId] = useState(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingEmpty, setPendingEmpty] = useState(false);
  // Multi-select (checkbox / shift-range / lasso) for bulk download in the files tool.
  const [selIds, setSelIds] = useState(() => new Set());
  const [zipBusy, setZipBusy] = useState(false);
  const [zipMsg, setZipMsg] = useState(''); // download status/error, shown in the Files tool
  const [lightbox, setLightbox] = useState(null); // { type:'image'|'video', url, filename } — click a thumbnail to enlarge
  useEffect(() => {
    if (!lightbox) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setLightbox(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);
  const [pendingHide, setPendingHide] = useState(null); // album name awaiting hide-confirm
  const lastPickRef = useRef(null);

  // deliver a cut (step 6)
  const [dKind, setDKind] = useState('rough_cut');
  const [dNote, setDNote] = useState('');
  const [dFiles, setDFiles] = useState([]);          // one or more video files staged to send
  const [dPct, setDPct] = useState(0);
  const [dPhase, setDPhase] = useState('idle'); // idle | uploading | saving | done | error
  const [dMsg, setDMsg] = useState('');
  const [dVersion, setDVersion] = useState('V1');   // version for the next cut (auto-advances)
  const [dSendTo, setDSendTo] = useState('');        // '' = the client; else override recipient(s), comma-separated
  const [dCcClient, setDCcClient] = useState(false); // when Send-to is used, also include the client
  const [rowSendId, setRowSendId] = useState(null);  // which sent-cut row has its "Send to…" field open
  const [rowSendEmail, setRowSendEmail] = useState('');
  const [copiedId, setCopiedId] = useState(null);    // sent-cut row whose share link was just copied
  const [dCustomOpen, setDCustomOpen] = useState(false);
  const [sentCuts, setSentCuts] = useState([]);      // this client's already-sent cuts (red/green + resend)
  const [dNoteAuto, setDNoteAuto] = useState(true);  // true = note is the auto brand default (safe to refresh)
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
      // Preserve the previously-presigned video URL for each render we already
      // had. The GET mints a FRESH presigned URL every call, so without this the
      // <video> src changes on every auto-refresh poll and an open preview snaps
      // back to 0:00 (the "previews won't play" bug). Same URL → React reuses the
      // element and playback continues.
      setMontages((prev) => {
        const prevUrl = new Map(prev.map((m) => [m.id, m.url]));
        return montages.map((m) => {
          const old = prevUrl.get(m.id);
          return (old && m.url) ? { ...m, url: old } : m;
        });
      });
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

  // Auto-refresh the renders list while anything is still queued/rendering, so
  // the admin doesn't have to keep hitting Refresh. Polls every 7s and stops on
  // its own once everything is Ready/Failed.
  useEffect(() => {
    if (!session) return undefined;
    const pendingIds = montages.filter((m) => m.status === 'queued' || m.status === 'rendering').map((m) => m.id);
    if (!pendingIds.length) return undefined;
    // Actively POLL Creatomate (via /sync) for each pending render, then reload.
    // A plain GET only reflects the DB, which is updated by Creatomate's webhook —
    // if that webhook doesn't fire, the status never flips. Polling sync makes the
    // auto-check work regardless of the webhook.
    const iv = setInterval(async () => {
      await Promise.all(pendingIds.map((id) =>
        api('/api/admin/montage/sync', { method: 'POST', body: JSON.stringify({ montageId: id }) }).catch(() => {})));
      loadMontages();
    }, 8000);
    return () => clearInterval(iv);
  }, [session, montages, loadMontages]);

  // While the Files tool is open, auto-refresh every few seconds so the admin
  // can watch a client organize in near-real-time (e.g. guiding them on a call).
  // Paused during the admin's own edits so a poll can't clobber a field mid-type.
  useEffect(() => {
    if (activeTool !== 'files' || !openClientId) return undefined;
    const id = setInterval(() => {
      if (!mediaBusy) loadMedia(openClientId, true);
    }, 5000);
    return () => clearInterval(id);
  }, [activeTool, openClientId, mediaBusy]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (next === 'montage') { loadProjPhotos(c.id); loadPhotoEdits(c.id); } // photos + saved edits
    if (next === 'intake') loadIntake(c.id);
    if (next === 'files') loadMedia(c.id);
    if (next === 'cut') loadSentCuts(c.id);
  }

  // Load this client's already-sent cuts and auto-pick the next version
  // (highest sent V# + 1; V1 if none). Custom labels don't affect the count.
  async function loadSentCuts(clientId) {
    // Nudge any in-flight watermark renders to complete before reading the list, so
    // reopening the tool recovers a cut whose Creatomate webhook never fired.
    try { await api(`/api/admin/cut-status?clientId=${clientId}`); } catch { /* best-effort */ }
    try {
      const { cuts } = await api(`/api/admin/deliver?clientId=${clientId}`);
      const list = Array.isArray(cuts) ? cuts : [];
      setSentCuts(list);
      const nums = list
        .map((cut) => /^V(\d+)$/i.exec(String(cut.version || '').trim()))
        .filter(Boolean)
        .map((m) => parseInt(m[1], 10));
      const nextV = `V${nums.length ? Math.max(...nums) + 1 : 1}`;
      setDVersion(nextV);
      setDNote(brandNote(dKind, nextV));
      setDNoteAuto(true);
      setDCustomOpen(false);
      setDSendTo('');
      setDCcClient(false);
    } catch {
      setSentCuts([]);
      setDVersion('V1');
      setDNote(brandNote(dKind, 'V1'));
      setDNoteAuto(true);
      setDCustomOpen(false);
      setDSendTo('');
      setDCcClient(false);
    }
  }

  // Resend an already-delivered cut (no re-upload) — to the client or the
  // address typed in "Send to".
  async function resendCut(cut) {
    setDMsg('');
    const to = dSendTo.trim();
    try {
      const r = await api('/api/admin/deliver', {
        method: 'POST',
        body: JSON.stringify({ clientId: mClientId, resendId: cut.id, sendTo: dSendTo, ccClient: dCcClient, note: dNote }),
      });
      setDPhase(r.emailed ? 'done' : 'error');
      setDMsg(
        r.emailed
          ? `Resent ${cut.version || 'cut'}${to ? ` to ${to}${dCcClient ? ' + the client' : ''}` : ' to the client'}.`
          : `Could not email the resend${r.emailError ? ` (${r.emailError})` : ''}.`
      );
    } catch (e) {
      setDPhase('error');
      setDMsg(e.message || 'Resend failed.');
    }
  }

  // Send an already-delivered version to a specific address (anyone, not the client).
  async function resendCutTo(cut, toEmail) {
    const to = String(toEmail || '').trim();
    if (!to) return;
    setDMsg('');
    try {
      const r = await api('/api/admin/deliver', {
        method: 'POST',
        body: JSON.stringify({ clientId: mClientId, resendId: cut.id, sendTo: to, note: dNote }),
      });
      setDPhase(r.emailed ? 'done' : 'error');
      setDMsg(r.emailed ? `Sent ${cut.version || 'cut'} to ${to}.` : `Could not send${r.emailError ? ` (${r.emailError})` : ''}.`);
      setRowSendId(null);
      setRowSendEmail('');
    } catch (e) {
      setDPhase('error');
      setDMsg(e.message || 'Send failed.');
    }
  }

  // Copy the durable, no-login share link for a sent version so it can be forwarded.
  async function copyShareLink(cut) {
    if (!cut.shareUrl) return;
    try {
      await navigator.clipboard.writeText(cut.shareUrl);
      setCopiedId(cut.id);
      setTimeout(() => setCopiedId((id) => (id === cut.id ? null : id)), 1600);
    } catch {
      setDMsg(`Copy failed — here's the link: ${cut.shareUrl}`);
    }
  }

  // After a rough-cut send, poll the status endpoint until it's delivered or failed.
  // This DRIVES completion (not just watches), so delivery works even if Creatomate's
  // webhook never fires. Idempotent server-side, so it's safe to run alongside it.
  async function pollCutStatus(cutRenderId, clientId, attempt = 0) {
    try {
      const { cuts } = await api(`/api/admin/cut-status?clientId=${clientId}`);
      const c = (cuts || []).find((x) => x.id === cutRenderId);
      if (c && c.status === 'ready') {
        setDPhase('done');
        setDMsg('✓ Delivered — the client has the watermarked cut and the email is on its way.');
        loadSentCuts(clientId);
        return;
      }
      if (c && c.status === 'failed') {
        setDPhase('error');
        setDMsg(`⚠ Not sent — watermarking failed${c.error ? `: ${c.error}` : ''}. Nothing un-watermarked went out; check your alert email.`);
        return;
      }
    } catch { /* keep trying */ }
    if (attempt >= 45) { // ~3 minutes
      setDMsg('Still watermarking — taking longer than usual. It will deliver on its own when the render finishes; reopen this tool later to confirm.');
      return;
    }
    setDMsg('Watermarking… this can take a minute or two. Leave this open and it delivers automatically when done.');
    setTimeout(() => pollCutStatus(cutRenderId, clientId, attempt + 1), 4000);
  }

  // Client file manager. Reload after each change so the view can't drift.
  async function loadMedia(clientId, force = false) {
    if (!force && mediaClientId === clientId) return;
    setMediaLoading(true);
    try {
      const { files } = await api(`/api/admin/media?clientId=${clientId}`);
      setMediaFiles(files || []);
      if (mediaClientId !== clientId) { setSelIds(new Set()); lastPickRef.current = null; }
      setMediaClientId(clientId);
    } catch (err) {
      setMErr(true);
      setMMsg(err.message);
    }
    setMediaLoading(false);
  }

  async function mediaAction(clientId, payload) {
    setMediaBusy(true);
    try {
      await api('/api/admin/media', { method: 'POST', body: JSON.stringify({ clientId, ...payload }) });
      await loadMedia(clientId, true);
    } catch (err) {
      setMErr(true);
      setMMsg(err.message);
    }
    setMediaBusy(false);
  }

  // ---- Multi-select + bulk ZIP download (files tool) ----
  const filesBoxRef = useRef(null);
  const lassoRef = useRef(null);
  const [lassoBox, setLassoBox] = useState(null);
  // Drag a rectangle over the photos to select them (adds to the current
  // selection; hold nothing to start fresh, shift to keep what's selected).
  function lassoDown(e) {
    if (e.button !== 0 || e.target.closest('input,button,a,textarea,select')) return;
    const sx = e.pageX, sy = e.pageY;
    lassoRef.current = { active: true };
    if (!e.shiftKey) clearSel();
    const move = (ev) => {
      if (!lassoRef.current?.active) return;
      const x = Math.min(ev.pageX, sx), y = Math.min(ev.pageY, sy), w = Math.abs(ev.pageX - sx), h = Math.abs(ev.pageY - sy);
      setLassoBox({ x, y, w, h });
      const r = { left: x, top: y, right: x + w, bottom: y + h };
      const el = filesBoxRef.current; if (!el) return;
      const hits = [];
      el.querySelectorAll('[data-fid]').forEach((row) => {
        const b = row.getBoundingClientRect();
        const bb = { left: b.left + window.scrollX, top: b.top + window.scrollY, right: b.right + window.scrollX, bottom: b.bottom + window.scrollY };
        if (!(bb.right < r.left || bb.left > r.right || bb.bottom < r.top || bb.top > r.bottom)) hits.push(row.getAttribute('data-fid'));
      });
      if (hits.length) selectIds(hits, true);
    };
    const up = () => { lassoRef.current = null; setLassoBox(null); window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    e.preventDefault();
  }
  function clearSel() { setSelIds(new Set()); lastPickRef.current = null; }
  // Toggle one file; shift+click selects the range from the last picked, using the
  // current on-screen order (what `orderedIds` passes in).
  function toggleSel(id, shift, orderedIds) {
    setSelIds((prev) => {
      const next = new Set(prev);
      if (shift && lastPickRef.current && orderedIds) {
        let a = orderedIds.indexOf(lastPickRef.current), b = orderedIds.indexOf(id);
        if (a > -1 && b > -1) { if (a > b) [a, b] = [b, a]; for (let i = a; i <= b; i++) next.add(orderedIds[i]); }
      } else {
        next.has(id) ? next.delete(id) : next.add(id);
      }
      return next;
    });
    lastPickRef.current = id;
  }
  function selectIds(ids, on = true) {
    setSelIds((prev) => { const next = new Set(prev); ids.forEach((id) => (on ? next.add(id) : next.delete(id))); return next; });
  }
  // Zip a set of files server-side and save them. On Chrome/Edge we open a native
  // "Save As" dialog so you CHOOSE the folder (e.g. a folder on your Desktop) — and
  // it must open on the click, BEFORE the (possibly slow) zip fetch, or the browser
  // blocks the picker. On other browsers (Safari) it falls back to Downloads.
  async function downloadZip(clientId, ids, filename) {
    const list = [...ids];
    if (!list.length) { setZipMsg('No files to download.'); return; }
    // Open the folder chooser FIRST — it must fire within the click gesture. On
    // Chrome/Edge this is a native "Save As" so you pick any folder (Desktop, etc.);
    // Safari has no picker, so there it falls back to the Downloads folder.
    let handle = null;
    if (typeof window !== 'undefined' && window.showSaveFilePicker) {
      try {
        handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }],
        });
      } catch (e) { if (e && e.name === 'AbortError') return; handle = null; } // cancelled → stop
    }
    setZipMsg('Zipping…'); setZipBusy(true);
    try {
      // Admin endpoints need the Supabase bearer token (same as the api() helper).
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const res = await fetch('/api/admin/media/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ clientId, ids: list }),
      });
      if (!res.ok) {
        let d = '';
        try { d = (await res.json()).error; } catch { try { d = await res.text(); } catch {} }
        throw new Error(`${(d || 'server error').slice(0, 200)} (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      if (!blob || blob.size === 0) throw new Error('the server sent an empty file (0 bytes)');
      if (handle) {
        const w = await handle.createWritable(); await w.write(blob); await w.close();
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 8000);
      }
      setZipMsg(`✓ Downloaded ${filename} (${(blob.size / (1024 * 1024)).toFixed(1)} MB)${handle ? '' : ' to your Downloads folder'}.`);
    } catch (err) {
      setZipMsg(`Download failed: ${err && err.message}`);
    }
    setZipBusy(false);
  }
  function downloadSelectedZip(clientId) {
    const ids = [...selIds];
    return downloadZip(clientId, ids, `photos_${ids.length}.zip`);
  }
  // Whole album/folder in one click.
  function downloadAlbumZip(clientId, name, list) {
    const safe = String(name || 'files').replace(/[^a-z0-9._-]+/gi, '_').replace(/^_+|_+$/g, '') || 'files';
    return downloadZip(clientId, list.map((m) => m.id), `${safe}.zip`);
  }

  // Reorder within a folder: swap two neighbours, then renumber the folder 1..n.
  function mediaMove(clientId, folderKey, id, dir) {
    const ids = mediaFiles.filter((m) => (m.folderPath || '') === folderKey).map((m) => m.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    const next = ids.slice();
    [next[i], next[j]] = [next[j], next[i]];
    mediaAction(clientId, { action: 'renumber', ids: next });
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
  async function loadProjPhotos(clientId, force = false) {
    if (!force && projPhotosClientId === clientId && projPhotos.length) return; // already have them
    // Switching to a different client → clear the reorder undo/redo history so a
    // move from one client can never be applied to another.
    if (projPhotosClientId !== clientId) { setUndoStack([]); setRedoStack([]); lastArrRef.current = null; histClientRef.current = clientId; }
    setProjPhotosLoading(true);
    try {
      const { photos } = await api(`/api/admin/montage/photos?clientId=${clientId}`);
      setProjPhotos(photos || []);
      setProjPhotosClientId(clientId);
      // Refresh + warm the cached full order (so the first drag is instant too).
      fullOrderRef.current = null; fullOrderClientRef.current = null;
      ensureFullOrder(clientId).catch(() => {});
    } catch (err) {
      setMErr(true);
      setMMsg(err.message);
    }
    setProjPhotosLoading(false);
  }

  // Turn a flat, ordered list of { id, album } into the shared-timeline payload
  // (top-level order + per-album order). An album becomes ONE top-level slot at
  // the position of its first photo; its photos keep the order they appear in.
  function arrangementFromFlat(items) {
    const top = [];
    const albums = {};
    const seen = new Set();
    for (const it of items) {
      if (it.album) {
        if (!seen.has(it.album)) { seen.add(it.album); top.push({ type: 'album', name: it.album }); }
        (albums[it.album] = albums[it.album] || []).push(it.id);
      } else {
        top.push({ type: 'media', id: it.id });
      }
    }
    return { top, albums };
  }

  // Which half of the hovered cell the cursor is over → where the clip lands.
  // Left half = drop BEFORE this clip; right half = drop AFTER it.
  function dropSide(e) {
    try { const r = e.currentTarget.getBoundingClientRect(); return (e.clientX - r.left) > r.width / 2 ? 'after' : 'before'; }
    catch { return 'before'; }
  }
  // Record the clip currently hovered while dragging (drives the green indicator
  // AND the drop). Kept in a ref too so the drop reads the freshest value even if
  // the release lands in a gap between cells.
  function setDropHover(o) { pcOverRef.current = o; setPcOver(o); }
  // Commit wherever the cursor last hovered a real clip — so a drop in the gap
  // between two clips still lands exactly beside the clip you were pointing at,
  // instead of falling through to "append to the end".
  function commitDrop(clientId, fallbackAlbum) {
    if (!pcDrag.current) return;
    const o = pcOverRef.current;
    if (o && o.id != null && o.id !== pcDrag.current.id) reorderByDrag(clientId, o.album || null, o.id, o.side);
    else reorderByDrag(clientId, fallbackAlbum || null, null); // nothing hovered → end of that group
  }

  // Load the client's FULL timeline order (photos + videos) once and cache it.
  // Everything after is done locally, so drags are instant.
  async function ensureFullOrder(clientId) {
    if (fullOrderClientRef.current === clientId && fullOrderRef.current) return fullOrderRef.current;
    const { files, boxes } = await api(`/api/admin/media?clientId=${clientId}`);
    const media = (files || []).filter((f) => !f.hidden);
    const bx = (boxes || []).filter((b) => !b.hidden_at).map((b) => ({ name: b.name, position: b.position }));
    const { structure } = buildTimeline(media, bx);
    const list = [];
    for (const n of structure) {
      if (n.type === 'media') list.push({ id: n.item.id, album: null });
      else for (const it of n.items) list.push({ id: it.id, album: n.name });
    }
    fullOrderRef.current = list; fullOrderClientRef.current = clientId;
    return list;
  }

  // Flatten an arrangement back into an ordered [{id, album}] list.
  function flattenArrangement(arr) {
    const list = [];
    for (const t of (arr.top || [])) {
      if (t.type === 'media') list.push({ id: t.id, album: null });
      else if (t.type === 'album') for (const id of (arr.albums?.[t.name] || [])) list.push({ id, album: t.name });
    }
    return list;
  }

  // Reorder the on-screen photos to match `order` — no network, no reload.
  function applyOrderToProjPhotos(order) {
    setProjPhotos((cur) => {
      const byId = new Map(cur.map((p) => [p.id, p]));
      const next = [];
      const used = new Set();
      for (const it of order) { const p = byId.get(it.id); if (p) { next.push({ ...p, album: it.album || null }); used.add(it.id); } }
      for (const p of cur) if (!used.has(p.id)) next.push(p); // safety: keep any stragglers
      return next.map((p, i) => ({ ...p, index: i + 1 }));
    });
  }

  // Save an arrangement in the background, chained so rapid moves never race.
  function queueSave(clientId, arr) {
    setPcMsg('Saving…');
    const run = async () => {
      try {
        await api('/api/admin/media', { method: 'POST', body: JSON.stringify({ clientId, action: 'setArrangement', top: arr.top, albums: arr.albums }) });
        setPcMsg('Saved ✓'); setTimeout(() => setPcMsg((m) => (m === 'Saved ✓' ? '' : m)), 1200);
      } catch {
        setPcMsg('Could not save — reloading…');
        fullOrderRef.current = null; fullOrderClientRef.current = null;
        loadProjPhotos(clientId, true);
        if (roOpen && roClientId === clientId) loadReorder(clientId, true);
      }
    };
    saveChainRef.current = (saveChainRef.current || Promise.resolve()).then(run, run);
  }

  // Apply a whole-timeline arrangement to the screen instantly + queue the save
  // (used by undo/redo). Keeps the cache + on-screen order in lock-step.
  function applyArrangementLocal(clientId, arr) {
    const order = flattenArrangement(arr);
    fullOrderRef.current = order; fullOrderClientRef.current = clientId;
    lastArrRef.current = arr;
    applyOrderToProjPhotos(order);
    if (roOpen && roClientId === clientId) loadReorder(clientId, true);
    queueSave(clientId, arr);
  }

  // Move the dragged photo relative to `targetId` (`side` = 'before' | 'after'),
  // or to the END of `destAlbum`'s group when targetId is null. Applies instantly
  // to the cached FULL timeline (photos AND videos keep their slots) and the
  // screen, then saves in the background.
  async function reorderByDrag(clientId, destAlbum, targetId, side) {
    const drag = pcDrag.current;
    setPcOver(null); pcOverRef.current = null; pcDrag.current = null;
    if (!drag || !drag.id) return;
    let full;
    try { full = (await ensureFullOrder(clientId)).slice(); }
    catch { setPcMsg('Could not load the order — try again.'); return; }
    const before = arrangementFromFlat(full); // snapshot for undo
    const di = full.findIndex((x) => x.id === drag.id);
    if (di < 0) { // cache stale → refetch next time
      fullOrderRef.current = null; fullOrderClientRef.current = null;
      loadProjPhotos(clientId, true);
      return;
    }
    const [moved] = full.splice(di, 1);
    moved.album = destAlbum || null;
    let ti;
    if (targetId != null) {
      ti = full.findIndex((x) => x.id === targetId);
      if (ti < 0) ti = full.length;
      else if (side === 'after') ti += 1;
    } else if (destAlbum) {
      // Dropped into an album's open space → end of THAT album's run (keeps it contiguous).
      let last = -1;
      for (let i = 0; i < full.length; i++) if (full[i].album === destAlbum) last = i;
      ti = last >= 0 ? last + 1 : full.length;
    } else {
      ti = full.length; // loose area → end of the timeline
    }
    full.splice(ti, 0, moved);
    fullOrderRef.current = full; fullOrderClientRef.current = clientId;
    const after = arrangementFromFlat(full);
    // History for undo.
    histClientRef.current = clientId;
    setUndoStack((s) => [...s, before].slice(-50));
    setRedoStack([]);
    lastArrRef.current = after;
    // Instant on-screen update, then background save.
    applyOrderToProjPhotos(full);
    if (roOpen && roClientId === clientId) loadReorder(clientId, true);
    queueSave(clientId, after);
  }

  function undoOrder(clientId) {
    if (!undoStack.length) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    if (lastArrRef.current) setRedoStack((s) => [...s, lastArrRef.current]);
    applyArrangementLocal(clientId, prev);
  }
  function redoOrder(clientId) {
    if (!redoStack.length) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((s) => s.slice(0, -1));
    if (lastArrRef.current) setUndoStack((s) => [...s, lastArrRef.current]);
    applyArrangementLocal(clientId, next);
  }

  // Load this client's saved photo edits (defaults if none yet).
  async function loadPhotoEdits(clientId) {
    if (editsClientId === clientId) return;
    try {
      const { edits } = await api(`/api/admin/montage/photo-edits?clientId=${clientId}`);
      setPhotoEdits(edits && edits.photos ? edits : { photos: {}, colorCorrect: false });
    } catch {
      setPhotoEdits({ photos: {}, colorCorrect: false });
    }
    setEditsClientId(clientId);
    setEditsSaved(false);
  }

  // Debounced persist — the edits are refresh-proof and shared by every render.
  function persistEdits(clientId, next) {
    setEditsSaving(true);
    setEditsSaved(false);
    if (editsTimer.current) clearTimeout(editsTimer.current);
    editsTimer.current = setTimeout(() => {
      api('/api/admin/montage/photo-edits', {
        method: 'POST',
        body: JSON.stringify({ clientId, edits: next }),
      })
        .then(() => { setEditsSaving(false); setEditsSaved(true); })
        .catch(() => setEditsSaving(false));
    }, 500);
  }

  // Rotate a montage photo's ACTUAL stored image 90° (by r2_key), then reload the
  // project photos so the editor preview + montage pick up the new orientation.
  async function rotateProjPhoto(clientId, key) {
    setRotatingKey(key);
    try {
      await api('/api/admin/media', { method: 'POST', body: JSON.stringify({ clientId, action: 'rotate', key }) });
      await loadProjPhotos(clientId, true);
    } catch { /* best-effort; the reload reflects the result */ }
    setRotatingKey(null);
  }

  // ---- Admin timeline reorder (mirrors the client's tap-to-move) ----
  async function loadReorder(clientId, force = false) {
    if (!force && roClientId === clientId && roTl.length) return;
    setRoLoading(true); setRoMsg('');
    try {
      const { files, boxes } = await api(`/api/admin/media?clientId=${clientId}`);
      const media = (files || []).filter((f) => !f.hidden);
      const bx = (boxes || []).filter((b) => !b.hidden_at).map((b) => ({ name: b.name, position: b.position }));
      const { structure } = buildTimeline(media, bx);
      setRoTl(structure);
      setRoClientId(clientId);
    } catch { setRoMsg('Could not load photos.'); }
    setRoLoading(false);
  }
  const roIdOf = (n) => (n.type === 'media' ? n.item.id : n.name);
  function roDetach(work) {
    if (roPick.scope === 'top') {
      const i = work.findIndex((n) => roIdOf(n) === roPick.id);
      const [node] = work.splice(i, 1);
      return { removedFrom: { top: true, idx: i }, node };
    }
    const ai = work.findIndex((n) => n.type === 'album' && n.name === roPick.album);
    const album = { ...work[ai], items: work[ai].items.slice() };
    const j = album.items.findIndex((m) => m.id === roPick.id);
    const [m] = album.items.splice(j, 1);
    work[ai] = album;
    return { removedFrom: { album: roPick.album, idx: j }, node: { type: 'media', item: m } };
  }
  async function roCommit(work) {
    setRoTl(work); setRoPick(null);
    const top = work.map((n) => (n.type === 'media' ? { type: 'media', id: n.item.id } : { type: 'album', name: n.name }));
    const albums = {};
    work.forEach((n) => { if (n.type === 'album') albums[n.name] = n.items.map((m) => m.id); });
    setRoSaving(true); setRoMsg('');
    try {
      await api('/api/admin/media', { method: 'POST', body: JSON.stringify({ clientId: roClientId, action: 'setArrangement', top, albums }) });
      setRoMsg('Saved ✓');
      if (projPhotosClientId === roClientId) loadProjPhotos(roClientId, true); // refresh the montage strip/order
    } catch { setRoMsg('Could not save the order.'); }
    setRoSaving(false);
    setTimeout(() => setRoMsg(''), 2000);
  }
  function roDropTop(pos) {
    if (!roPick) return;
    const work = roTl.slice();
    const { removedFrom, node } = roDetach(work);
    let p = pos;
    if (removedFrom.top && removedFrom.idx < pos) p -= 1;
    work.splice(p, 0, node);
    roCommit(work);
  }
  function roDropInAlbum(albumName, pos) {
    if (!roPick || roPick.kind === 'album') return; // albums can't nest
    const work = roTl.slice();
    const { removedFrom, node } = roDetach(work);
    let p = pos;
    if (removedFrom.album === albumName && removedFrom.idx < pos) p -= 1;
    const ti = work.findIndex((n) => n.type === 'album' && n.name === albumName);
    if (ti < 0) return;
    const album = { ...work[ti], items: work[ti].items.slice() };
    album.items.splice(p, 0, node.item);
    work[ti] = album;
    roCommit(work);
  }
  function roMoveOut(albumName) {
    if (!roPick || roPick.scope !== 'album' || roPick.album !== albumName) return;
    const work = roTl.slice();
    const { node } = roDetach(work);
    const ai = work.findIndex((n) => n.type === 'album' && n.name === albumName);
    work.splice(ai + 1, 0, node);
    roCommit(work);
  }
  function roToggleOpen(name) {
    setRoOpenAlbums((prev) => { const s = new Set(prev); if (s.has(name)) s.delete(name); else s.add(name); return s; });
    setRoPick(null);
  }
  function roPickToggle(p) {
    setRoPick((cur) => (cur && cur.scope === p.scope && (cur.album || null) === (p.album || null) && cur.id === p.id ? null : p));
  }

  // ---- Reorder UI (tap-to-move track; mirrors the client's Uploader) ----
  function roGap(k, live, onDrop) {
    return (
      <div
        key={k}
        onClick={live ? (e) => { e.stopPropagation(); onDrop(); } : undefined}
        onDragOver={live ? (e) => e.preventDefault() : undefined}
        onDrop={live ? (e) => { e.preventDefault(); e.stopPropagation(); onDrop(); } : undefined}
        style={{
          flex: '0 0 auto', width: live ? 22 : 8, alignSelf: 'stretch', minHeight: 74,
          margin: '0 2px', borderRadius: 6, cursor: live ? 'pointer' : 'default',
          background: live ? 'repeating-linear-gradient(45deg,rgba(56,182,255,.25) 0 6px,transparent 6px 12px)' : 'transparent',
          border: live ? '1.5px dashed #38b6ff' : 'none',
        }}
      />
    );
  }
  function roMediaCard(m, num, scope, album) {
    const isVideo = (m.contentType || '').startsWith('video');
    const isPk = roPick && roPick.scope === scope && (roPick.album || null) === (album || null) && roPick.id === m.id;
    return (
      <div
        key={`${scope}:${album || ''}:${m.id}`}
        draggable
        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', m.id); } catch { /* older */ } setRoPick({ scope, album: album || null, id: m.id, kind: 'media' }); }}
        onDragEnd={() => setRoPick((cur) => (cur && cur.id === m.id ? null : cur))}
        onClick={(e) => { e.stopPropagation(); roPickToggle({ scope, album: album || null, id: m.id, kind: 'media' }); }}
        title={`${m.filename} — drag to reorder, or tap then tap a gap`}
        style={{
          position: 'relative', flex: '0 0 auto', width: 96, cursor: 'grab',
          border: isPk ? '2px solid #38b6ff' : '2px solid transparent', borderRadius: 10, overflow: 'hidden',
          boxShadow: isPk ? '0 0 0 3px rgba(56,182,255,.3)' : 'none', background: '#0a0f18',
        }}
      >
        <div style={{ width: '100%', height: 72, background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isVideo || !m.url
            ? <span style={{ color: '#9fb3c8', fontSize: 12, fontWeight: 700 }}>{isVideo ? '▶ Video' : '📄'}</span>
            : <img src={m.url} alt={m.filename} loading="lazy" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>
        <span style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(0,0,0,.72)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '1px 6px', borderRadius: 8 }}>{num}</span>
        {m.importSeq != null && <span title={`Import #${String(m.importSeq).padStart(3, '0')} — permanent reference number`} style={{ position: 'absolute', top: 52, left: 4, background: '#f5a623', color: '#241700', fontSize: 10, fontWeight: 900, letterSpacing: '.3px', padding: '1px 5px', borderRadius: 5, boxShadow: '0 1px 3px rgba(0,0,0,.5)' }}>{String(m.importSeq).padStart(3, '0')}</span>}
        <div style={{ fontSize: 9, color: '#7d8ea0', padding: '2px 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.filename}</div>
      </div>
    );
  }
  function roAlbumBlock(node) {
    const name = node.name;
    const count = node.items.length;
    const isOpen = roOpenAlbums.has(name);
    const pickedIsMedia = roPick && roPick.kind === 'media';
    const isPk = roPick && roPick.scope === 'top' && roPick.kind === 'album' && roPick.id === name;

    if (!isOpen) {
      return (
        <div
          key={name}
          onDragOver={(e) => { if (pickedIsMedia) e.preventDefault(); }}
          onDrop={(e) => { if (pickedIsMedia) { e.preventDefault(); e.stopPropagation(); roDropInAlbum(name, count); } }}
          onClick={(e) => {
            e.stopPropagation();
            if (pickedIsMedia) roDropInAlbum(name, count);          // drop picked photo into this album (end)
            else if (isPk) setRoPick(null);                          // tap picked album again = cancel
            else if (!roPick) roPickToggle({ scope: 'top', album: null, id: name, kind: 'album' }); // pick album to relocate
            else setRoPick(null);
          }}
          style={{
            flex: '0 0 auto', width: 150, cursor: 'pointer', padding: 10, borderRadius: 12, color: '#eae6f0',
            border: isPk ? '2px solid #7c5cff' : (pickedIsMedia ? '2px dashed #7c5cff' : '2px solid rgba(124,92,255,.5)'),
            background: 'linear-gradient(160deg,rgba(124,92,255,.18),rgba(124,92,255,.05))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 13 }}>📁 {name}</div>
          <div style={{ fontSize: 11, color: '#b9a9e6', margin: '2px 0 6px' }}>{count} item{count === 1 ? '' : 's'}</div>
          <div style={{ display: 'flex', gap: 2, height: 34, overflow: 'hidden' }}>
            {node.items.slice(0, 4).map((m, i) => (
              <span key={i} style={{ flex: 1, borderRadius: 4, background: (m.contentType || '').startsWith('video') ? '#050505' : `center/cover no-repeat url('${m.url}')` }} />
            ))}
          </div>
          {pickedIsMedia
            ? <div style={{ fontSize: 11, color: '#c9b8ff', marginTop: 6, fontWeight: 700 }}>＋ tap to add here</div>
            : <button type="button" onClick={(e) => { e.stopPropagation(); roToggleOpen(name); }} style={{ marginTop: 6, fontSize: 11, background: 'transparent', border: '1px solid rgba(124,92,255,.5)', color: '#d8ccff', borderRadius: 8, padding: '3px 8px', cursor: 'pointer' }}>⤢ open</button>}
        </div>
      );
    }

    // open album — inline lane with its own gaps
    const laneLive = pickedIsMedia;
    const lane = [];
    lane.push(roGap(`${name}-lg0`, laneLive, () => roDropInAlbum(name, 0)));
    node.items.forEach((m, j) => {
      lane.push(roMediaCard(m, j + 1, 'album', name));
      lane.push(roGap(`${name}-lg${j + 1}`, laneLive, () => roDropInAlbum(name, j + 1)));
    });
    return (
      <div key={name} onClick={(e) => e.stopPropagation()} style={{ flex: '0 0 auto', padding: 10, borderRadius: 12, border: '2px solid rgba(124,92,255,.6)', background: 'rgba(124,92,255,.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontWeight: 800, color: '#eae6f0' }}>📁 {name}</span>
          <span style={{ fontSize: 11, color: '#b9a9e6' }}>{count} item{count === 1 ? '' : 's'}</span>
          {roPick && roPick.scope === 'album' && roPick.album === name && (
            <button type="button" onClick={(e) => { e.stopPropagation(); roMoveOut(name); }} style={{ fontSize: 11, background: 'rgba(56,182,255,.15)', border: '1px solid #38b6ff', color: '#cfe6ff', borderRadius: 8, padding: '3px 8px', cursor: 'pointer' }}>⤴ Move out</button>
          )}
          <button type="button" onClick={(e) => { e.stopPropagation(); roToggleOpen(name); }} style={{ marginLeft: 'auto', fontSize: 11, background: 'rgba(124,92,255,.2)', border: '1px solid rgba(124,92,255,.5)', color: '#e6dcff', borderRadius: 8, padding: '3px 10px', cursor: 'pointer' }}>Done ✓</button>
        </div>
        {count === 0 && !laneLive
          ? <div style={{ fontSize: 12, color: '#9fb3c8', padding: '8px 4px' }}>Empty — pick a photo from the timeline, then tap here to add it.</div>
          : <div style={{ display: 'flex', alignItems: 'stretch', overflowX: 'auto', paddingBottom: 2 }}>{lane}</div>}
      </div>
    );
  }
  function renderReorder(c) {
    const els = [];
    const topLive = !!roPick;
    let n = 0;
    els.push(roGap('rtg0', topLive, () => roDropTop(0)));
    roTl.forEach((node, idx) => {
      if (node.type === 'media') { n += 1; els.push(roMediaCard(node.item, n, 'top')); }
      else els.push(roAlbumBlock(node));
      els.push(roGap(`rtg${idx + 1}`, topLive, () => roDropTop(idx + 1)));
    });
    return (
      <div style={{ marginTop: 12, border: '1px solid #24304a', borderRadius: 12, background: '#0d1420', padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <strong style={{ color: '#cfe0f5', fontSize: 13 }}>Reorder timeline</strong>
          <span style={{ fontSize: 12, color: '#8ea3bd' }}>Tap a photo or album to pick it up, then tap a striped gap to drop it. Changes save automatically and sync to the client’s portal.</span>
          {roLoading && <span style={{ fontSize: 12, color: '#8ea3bd' }}>Loading…</span>}
          {roSaving && <span style={{ fontSize: 12, color: '#8ea3bd' }}>Saving…</span>}
          {roMsg && <span style={{ fontSize: 12, color: roMsg.includes('Could not') ? '#ff9a9a' : '#6ee7a0', fontWeight: 700 }}>{roMsg}</span>}
          <button type="button" onClick={() => loadReorder(c.id, true)} style={{ marginLeft: 'auto', fontSize: 12, background: 'transparent', border: '1px solid #24304a', color: '#9fb3c8', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>↻ Refresh</button>
        </div>
        {roTl.length === 0 && !roLoading
          ? <div style={{ fontSize: 12, color: '#8ea3bd', padding: 8 }}>No photos to arrange yet.</div>
          : <div style={{ display: 'flex', alignItems: 'stretch', overflowX: 'auto', padding: '4px 0', minHeight: 96 }}>{els}</div>}
        {roPick && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#38b6ff' }}>
            Picked {roPick.kind === 'album' ? `album “${roPick.id}”` : 'a photo'} — tap a striped gap to place it{roPick.scope === 'album' ? ', or ⤴ Move out to the timeline' : ''}.{' '}
            <button type="button" onClick={() => setRoPick(null)} style={{ background: 'transparent', border: 'none', color: '#9fb3c8', textDecoration: 'underline', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
          </div>
        )}
      </div>
    );
  }

  function editPhoto(clientId, key, patch) {
    setPhotoEdits((prev) => {
      const cur = prev.photos[key] || { anchor: 'top', fit: null, size: 100, removed: false, colorCorrect: false, mode: 'color', contrast: 100, saturation: 100, posX: null, posY: null };
      const next = { ...prev, photos: { ...prev.photos, [key]: { ...cur, ...patch } } };
      persistEdits(clientId, next);
      return next;
    });
  }


  // Replace one photo in place: upload the fixed file straight to R2 (presigned
  // PUT — big files skip Vercel), then repoint the media row so the montage uses
  // it in the same slot. The slot's edits carry over; the original stays in R2.
  async function replacePhoto(clientId, oldKey, file) {
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) {
      setMErr(true); setMMsg('Replacement must be an image file.'); return;
    }
    setReplacing(oldKey);
    setMErr(false); setMMsg('');
    try {
      const { url, key: newKey } = await api('/api/admin/upload-url', {
        method: 'POST',
        body: JSON.stringify({ clientId, contentType: file.type }),
      });
      const put = await fetch(url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!put.ok) throw new Error('Upload to storage failed');
      await api('/api/admin/montage/replace-photo', {
        method: 'POST',
        body: JSON.stringify({ clientId, oldKey, newKey, filename: file.name, contentType: file.type, sizeBytes: file.size }),
      });
      await loadProjPhotos(clientId, true); // refresh with the swapped-in image
      setMMsg('Photo replaced — the montage will use the new version.');
    } catch (err) {
      setMErr(true); setMMsg('Replace failed: ' + err.message);
    }
    setReplacing(null);
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

  // Hide/unhide a render (non-destructive — just filters it from the list).
  async function hideMontage(id, hidden) {
    try {
      await api('/api/admin/montage/visibility', {
        method: 'POST',
        body: JSON.stringify({ montageId: id, hidden }),
      });
      loadMontages();
    } catch (err) {
      setMErr(true);
      setMMsg(err.message);
    }
  }

  // X on a render card: cancel it if it's still rendering, then remove it from
  // the list (hidden). Works on any clip — rendering or finished.
  async function removeClip(m) {
    const rendering = m.status === 'rendering' || m.status === 'queued';
    if (!window.confirm(rendering ? 'Cancel this render and remove it?' : 'Remove this render from the list?')) return;
    try {
      if (rendering) {
        await api('/api/admin/montage/cancel', { method: 'POST', body: JSON.stringify({ montageId: m.id }) }).catch(() => {});
      }
      await api('/api/admin/montage/visibility', { method: 'POST', body: JSON.stringify({ montageId: m.id, hidden: true }) });
      loadMontages();
    } catch (err) {
      setMErr(true);
      setMMsg(err.message);
    }
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

  // Record review state (viewed / thumbs up-down) on a render. Stored in params
  // server-side; reloads the list to reflect the new label/rating.
  async function reviewMontage(id, patch) {
    try {
      await api('/api/admin/montage/review', { method: 'POST', body: JSON.stringify({ montageId: id, ...patch }) });
      loadMontages();
    } catch (err) {
      setMErr(true);
      setMMsg(err.message);
    }
  }

  // Re-render an existing render at the other resolution, keeping EXACTLY its
  // settings (style, pace, cards, green-screen, and each photo's edits as they
  // were snapshotted). full=true → 1920×1080 no watermark; full=false → low-res
  // watermarked draft. Creates a new render row (uses Creatomate credits).
  async function rerenderMontage(id, full) {
    const label = full ? 'full-resolution (1920×1080, no watermark)' : 'low-resolution draft';
    if (!window.confirm(`Export a ${label} version with the exact same settings? This starts a new render (uses credits).`)) return;
    setMMsg('');
    setMErr(false);
    try {
      await api('/api/admin/montage/finalize', {
        method: 'POST',
        body: JSON.stringify({ montageId: id, full: !!full }),
      });
      setMMsg(`${full ? 'Full-res' : 'Low-res'} render started — it’ll appear below when ready.`);
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
            photoSeconds: (s.paceMode !== 'total' && s.speed) ? Number(s.speed) : null,
            totalSeconds: (() => {
              if (s.paceMode !== 'total') return null;
              const t = Number(s.tMin || 0) * 60 + Number(s.tSec || 0) + Number(s.tFrames || 0) / 30;
              return t > 0 ? Math.round(t * 1000) / 1000 : null;
            })(),
            photoSpec: s.photos.trim() || null,
            includeCards: s.cards,
            greenScreen: s.green !== false,
            background: s.bgMode === 'green'
              ? { green: true }
              : ['soft_focus', 'linen', 'gradient'].includes(s.bgMode)
                ? { texture: s.bgMode, animated: true }
                : (s.bgMode === 'library' && s.bgKey)
                  // r2_key, not a URL — the route presigns it at render time so
                  // Export Full Rez still works days later.
                  ? { r2_key: s.bgKey, kind: s.bgKind || 'image', clipS: s.bgClipS || null, tint: s.bgTint || null, opacity: `${parseInt(s.bgOpacity || '50', 10)}%` }
                  : (s.bgMode === 'image' && s.bgUrl?.trim())
                    ? { url: s.bgUrl.trim(), tint: s.bgTint || null, opacity: `${parseInt(s.bgOpacity || '50', 10)}%` }
                    : null,
            // Multi Page motion options (only meaningful for the multi_page styles)
            mpTransition: s.mpTransition || 'record-fwd',
            mpStagger: s.mpStagger ? Number(s.mpStagger) : null,
            mpHold: s.mpHold ? Number(s.mpHold) : null,
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

  // ---- Try the new styles ---------------------------------------------------
  // Fires ONE short watermarked draft per style in NEW_STYLES so a batch of new
  // looks can be seen for a couple of credits instead of a couple of hundred.
  // Deliberately cheap: the first TEST_PHOTOS photos, a fast pace, and NO title
  // cards (8 seconds of cards per render is pure waste when you're judging motion).
  //
  // Cost, using Creatomate's published formula
  //   credits = width x height x fps x seconds / 100,000,000
  // A watermarked draft renders at render_scale 0.5 -> 960x540, so one ~13-second
  // test is about 2 credits. Five styles is about 10. The estimate is shown on the
  // button so it is never a surprise.
  const TEST_PHOTOS = 6;
  const TEST_SECONDS_PER_PHOTO = 1.6;
  const testCreditEstimate = (styleCount) => {
    const perRender = (TEST_PHOTOS + 2) * TEST_SECONDS_PER_PHOTO; // +2 green bookends
    return Math.ceil(styleCount * (960 * 540 * 30 * perRender) / 100000000);
  };

  async function draftNewStyles(c) {
    setMMsg('');
    setMErr(false);
    const N = projPhotos.length;
    if (!N) { setMErr(true); return setMMsg('This client has no photos to test with.'); }
    if (!mTitle.trim()) { setMErr(true); return setMMsg('Give it a title first — the render is named from it.'); }
    const styles = NEW_STYLES.filter((s) => MONTAGE_STYLES.some((o) => o.value === s));
    setGenBusy(true);
    let ok = 0;
    const errs = [];
    for (const style of styles) {
      try {
        await api('/api/admin/montage', {
          method: 'POST',
          body: JSON.stringify({
            clientId: c.id,
            style,
            title: mTitle.trim(),
            subtitle: mSubtitle.trim() || null,
            watermark: true,                       // watermark ON = draft = half res = 1/4 credits
            photoSeconds: TEST_SECONDS_PER_PHOTO,
            totalSeconds: null,
            photoSpec: `1-${Math.min(TEST_PHOTOS, N)}`,
            includeCards: false,                   // judging motion, not title cards
            greenScreen: true,
            background: null,                      // each style's own default (green on these)
            mpTransition: 'record-fwd', mpStagger: null, mpHold: null,
          }),
        });
        ok++;
      } catch (err) {
        errs.push(`${style}: ${err.message}`);
      }
    }
    setGenBusy(false);
    setMErr(errs.length > 0);
    setMMsg(
      `Queued ${ok} test draft${ok === 1 ? '' : 's'} (~${testCreditEstimate(ok)} credits)` +
        `${errs.length ? ` — ${errs.length} failed: ${errs.join('; ')}` : ''}. ` +
        'They appear below as Rendering, then Ready.'
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

  async function uploadOne(file) {
    const contentType = file.type || 'application/octet-stream';
    const { url, key } = await api('/api/admin/upload-url', {
      method: 'POST',
      body: JSON.stringify({ clientId: mClientId, contentType }),
    });
    await putWithProgress(url, file, setDPct);
    return { key, filename: file.name, contentType, size: file.size };
  }

  async function sendCut(e) {
    e.preventDefault();
    setDMsg('');
    if (!mClientId) return setDMsg('Pick a client first — open their workspace from the Clients list.');
    if (!dFiles.length) return setDMsg('Choose at least one video file to send.');

    try {
      // ---- FINAL: one OR more files → one bundled delivery, one email ----
      if (dKind === 'final') {
        setDPhase('uploading');
        const uploaded = [];
        for (let i = 0; i < dFiles.length; i++) {
          setDPct(0);
          setDMsg(dFiles.length > 1 ? `Uploading ${i + 1} of ${dFiles.length}…` : 'Uploading…');
          uploaded.push(await uploadOne(dFiles[i]));
        }
        setDPhase('saving');
        const result = await api('/api/admin/deliver-set', {
          method: 'POST',
          body: JSON.stringify({ clientId: mClientId, files: uploaded, note: dNote, sendTo: dSendTo, ccClient: dCcClient }),
        });
        setDPhase(result.emailed ? 'done' : 'error');
        setDMsg(
          result.emailed
            ? `Sent — ${result.count} final${result.count === 1 ? '' : 's'} delivered in one email.`
            : `Saved, but the email did not send${result.emailError ? ` (${result.emailError})` : ''}.`
        );
        setDFiles([]);
        if (dFileRef.current) dFileRef.current.value = '';
        setDSendTo('');
        setDCcClient(false);
        loadSentCuts(mClientId);
        return;
      }

      // ---- ROUGH CUT: single file through the watermark pipeline ----
      const file = dFiles[0];
      setDPhase('uploading');
      setDPct(0);
      const up = await uploadOne(file);
      setDPhase('saving');
      const durationSec = await readVideoDuration(file);
      const result = await api('/api/admin/deliver', {
        method: 'POST',
        body: JSON.stringify({
          clientId: mClientId,
          key: up.key,
          filename: up.filename,
          contentType: up.contentType,
          size: up.size,
          kind: dKind,
          note: dNote,
          version: dVersion,
          sendTo: dSendTo,
          ccClient: dCcClient,
          durationSec,
        }),
      });

      setDPhase('done');
      if (result.watermarking) {
        setDMsg(dFiles.length > 1
          ? 'Uploaded the first file — watermarking now. (Rough cuts send one at a time; only finals bundle into one email.)'
          : 'Uploaded — watermarking now… (usually a minute or two)');
        setDSendTo('');
        setDCcClient(false);
        if (result.cutRenderId) pollCutStatus(result.cutRenderId, mClientId);
      } else {
        setDMsg(
          result.emailed
            ? 'Sent — the client has the file and an email is on its way.'
            : `Saved to the client's portal, but the email did not send${
                result.emailError ? ` (${result.emailError})` : ''
              }. Check Postmark env vars.`
        );
        loadSentCuts(mClientId);
      }
      setDFiles([]);
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
    const sentVers = new Set(sentCuts.map((cut) => String(cut.version || '').trim()).filter(Boolean));
    const VBTNS = ['V1', 'V2', 'V3', 'V4'];
    const isCustom = dVersion !== '' && !/^V\d+$/.test(dVersion);
    const versionBtnStyle = (label) => {
      const isNext = dVersion === label;
      const sent = sentVers.has(label);
      return {
        border: '1px solid ' + (isNext ? 'transparent' : sent ? '#6e2f34' : 'var(--line)'),
        background: isNext ? 'linear-gradient(135deg,#2f9e6a,#43c088)' : sent ? '#2a1618' : 'var(--panel2, #1e242c)',
        color: isNext ? '#08130d' : sent ? '#ff9a9a' : 'var(--text)',
        borderRadius: 8, padding: '6px 13px', fontSize: 13, fontWeight: 650, cursor: 'pointer',
      };
    };
    return (
      <div className="tool-window" style={{ marginTop: 16 }}>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>
          Uploads to this client’s portal and emails a link. Rough cuts are watermarked automatically
          (logo + version, exported at 720p) before the client can see them; finals go out clean and full-res.
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
                  onChange={() => { setDKind('rough_cut'); if (dNoteAuto) setDNote(brandNote('rough_cut', dVersion)); }}
                />
                Rough cut (auto-watermarked)
              </label>
              <label className="choice">
                <input
                  type="radio"
                  name="d_kind"
                  checked={dKind === 'final'}
                  onChange={() => { setDKind('final'); if (dNoteAuto) setDNote(brandNote('final', dVersion)); }}
                />
                Final (clean, full-res)
              </label>
            </div>
          </div>

          <div className="field-group">
            <span className="field-label">Version</span>
            <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
              {VBTNS.map((label) => (
                <button type="button" key={label} style={versionBtnStyle(label)}
                  onClick={() => { setDVersion(label); setDCustomOpen(false); if (dNoteAuto) setDNote(brandNote(dKind, label)); }}>
                  {label}
                </button>
              ))}
              {(dCustomOpen || isCustom) ? (
                <input
                  autoFocus
                  value={isCustom ? dVersion : ''}
                  placeholder="Name it…"
                  onChange={(e) => { setDVersion(e.target.value); if (dNoteAuto) setDNote(brandNote(dKind, e.target.value)); }}
                  onBlur={() => { if (!dVersion.trim()) setDCustomOpen(false); }}
                  style={{ width: 130, padding: '6px 10px', borderRadius: 8, border: '1px solid #43c088',
                    background: 'var(--panel2, #1e242c)', color: 'var(--text)', fontSize: 13 }}
                />
              ) : (
                <button type="button" onClick={() => { setDCustomOpen(true); setDVersion(''); if (dNoteAuto) setDNote(brandNote(dKind, '')); }}
                  style={{ border: '1px solid var(--line)', background: 'var(--panel2, #1e242c)', color: 'var(--muted)',
                    borderRadius: 8, padding: '6px 13px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  ＋ Custom
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11.5, color: 'var(--muted)' }}>
              <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 9, background: '#e5484d', marginRight: 5 }} />already sent</span>
              <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 9, background: '#43c088', marginRight: 5 }} />next to send</span>
            </div>
          </div>

          <label htmlFor="d_file">{dKind === 'final' ? 'Video file(s)' : 'Video file'}</label>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const fs = [...(e.dataTransfer.files || [])].filter((f) => f && (f.type.startsWith('video/') || !f.type));
              if (fs.length) setDFiles((prev) => [...prev, ...fs]);
              if (dFileRef.current) dFileRef.current.value = '';
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
            {dFiles.length ? (
              <span style={{ color: 'var(--text)' }}>{dFiles.length} file{dFiles.length === 1 ? '' : 's'} selected — click to add more</span>
            ) : (
              <>Drag &amp; drop {dKind === 'final' ? 'video(s)' : 'a video'} here, or <span style={{ color: 'var(--text)', textDecoration: 'underline' }}>click to choose</span></>
            )}
          </div>
          <input
            id="d_file"
            ref={dFileRef}
            type="file"
            accept="video/*"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => { const fs = [...(e.target.files || [])]; if (fs.length) setDFiles((prev) => [...prev, ...fs]); }}
          />
          {dFiles.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
              {dFiles.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, background: 'var(--panel2, #1e242c)', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 10px' }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>{f.name}</span>
                  <button type="button" onClick={() => setDFiles((prev) => prev.filter((_, j) => j !== i))} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 15, lineHeight: 1 }} title="Remove">×</button>
                </div>
              ))}
            </div>
          )}
          {dFiles.length > 1 && (
            <p style={{ color: 'var(--muted)', fontSize: 11.5, marginTop: 6 }}>
              {dKind === 'final'
                ? 'These will be delivered together — one email, one page, your filenames kept as the labels.'
                : 'Rough cuts send one at a time — only the first will send. Switch to Final to bundle them.'}
            </p>
          )}

          <label htmlFor="d_sendto">Send to</label>
          <input
            id="d_sendto"
            type="text"
            value={dSendTo}
            onChange={(e) => setDSendTo(e.target.value)}
            placeholder="Blank = the client · or name@email.com, another@email.com"
          />
          <p style={{ color: 'var(--muted)', fontSize: 11.5, marginTop: 4 }}>
            Blank sends to the client. Add one or more addresses (comma-separated) to send elsewhere.
          </p>
          {dSendTo.trim() && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text)', margin: '2px 0 8px' }}>
              <input type="checkbox" checked={dCcClient} onChange={(e) => setDCcClient(e.target.checked)} />
              Also send to the client
            </label>
          )}

          <label htmlFor="d_note">Note to the client (auto-filled — edit freely, shown in the email)</label>
          <textarea
            id="d_note"
            value={dNote}
            onChange={(e) => { setDNote(e.target.value); setDNoteAuto(false); }}
            placeholder="Main Event Studio — here's your latest cut…"
          />

          {sentCuts.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <span className="field-label">Previously sent — resend any version</span>
              <div style={{ border: '1px solid var(--line)', borderRadius: 9, overflow: 'hidden', marginTop: 6 }}>
                {sentCuts.map((cut) => (
                  <div key={cut.id} style={{ borderTop: '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', fontSize: 13, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 11, background: '#20303f', color: '#7fb0ff', border: '1px solid #2a4258', borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                        {cut.version || (cut.kind === 'final' ? 'FINAL' : '—')}
                      </span>
                      {cut.viewUrl ? (
                        <a href={cut.viewUrl} target="_blank" rel="noopener noreferrer" title="View the cut that was sent to the client" style={{ color: 'var(--text)', textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 120 }}>{cut.filename}</a>
                      ) : (
                        <span style={{ color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 120 }}>{cut.filename}</span>
                      )}
                      {cut.shareUrl && (
                        <button type="button" className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} title="Copy a no-login link you can forward to anyone" onClick={() => copyShareLink(cut)}>
                          {copiedId === cut.id ? 'Copied ✓' : 'Copy link'}
                        </button>
                      )}
                      <button type="button" className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => { setRowSendId(rowSendId === cut.id ? null : cut.id); setRowSendEmail(''); }}>Send to…</button>
                      <button type="button" className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => resendCut(cut)}>Resend</button>
                    </div>
                    {rowSendId === cut.id && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0 11px 10px 11px' }}>
                        <input
                          type="text"
                          autoFocus
                          value={rowSendEmail}
                          onChange={(e) => setRowSendEmail(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && rowSendEmail.trim()) resendCutTo(cut, rowSendEmail); if (e.key === 'Escape') setRowSendId(null); }}
                          placeholder="Send this version to… name@email.com"
                          style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--panel2, #1e242c)', color: 'var(--text)', fontSize: 13 }}
                        />
                        <button type="button" className="btn-primary" style={{ padding: '6px 14px', fontSize: 12.5 }} disabled={!rowSendEmail.trim()} onClick={() => resendCutTo(cut, rowSendEmail)}>Send</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

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
              : `Upload & send${dVersion ? ` · ${dVersion}` : ''}`}
          </button>
        </form>
      </div>
    );
  }

  function renderFilesTool(c) {
    const showing = mediaClientId === c.id;
    const files = showing ? mediaFiles : [];
    const groups = {};
    for (const f of files) {
      const k = f.folderPath || '';
      (groups[k] = groups[k] || []).push(f);
    }
    const keys = Object.keys(groups).sort((a, b) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b, undefined, { numeric: true })));
    const folderNames = keys.filter((k) => k !== '');
    const orderedIds = keys.flatMap((k) => groups[k].map((f) => f.id)); // on-screen order (shift-range)
    const selN = selIds.size;
    return (
      <div className="tool-window" style={{ marginTop: 16, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>
            {mediaLoading && !showing
              ? 'Loading files…'
              : `${files.length} file${files.length === 1 ? '' : 's'}. Edit a number to reorder, rename files or folders, type a folder to move a file, or delete. Tick photos (or drag a box across them) to select, then Download selected. Changes save as you make them — this view auto-refreshes.`}
          </p>
          <button type="button" className="btn-ghost" onClick={() => loadMedia(c.id, true)}>Refresh</button>
        </div>
        {zipMsg && (
          <div style={{ margin: '10px 0 0', fontSize: 13.5, fontWeight: 600, padding: '8px 12px', borderRadius: 8,
            border: `1px solid ${zipMsg.startsWith('Download failed') ? 'var(--red)' : 'var(--ok, #1f6d3a)'}`,
            background: zipMsg.startsWith('Download failed') ? 'rgba(122,34,48,0.12)' : 'rgba(31,109,58,0.12)',
            color: zipMsg.startsWith('Download failed') ? 'var(--red)' : 'var(--ok, #1f6d3a)' }}>
            {zipMsg}
          </div>
        )}

        {selN > 0 && (
          <div style={{ position: 'sticky', top: 8, zIndex: 20, display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 4px', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--blue)', background: 'linear-gradient(180deg, rgba(61,123,255,0.16), rgba(61,123,255,0.06))', boxShadow: '0 6px 22px rgba(61,123,255,0.20)' }}>
            <strong style={{ fontSize: 14 }}><span style={{ color: 'var(--blue)' }}>{selN}</span> selected</strong>
            <span style={{ flex: 1 }} />
            <button type="button" className="btn-primary" style={{ padding: '5px 12px', fontSize: 12.5 }} disabled={zipBusy} onClick={() => downloadSelectedZip(c.id)}>{zipBusy ? 'Zipping…' : `⬇ Download ${selN} as ZIP`}</button>
            <button type="button" className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12.5 }} onClick={clearSel}>Clear</button>
          </div>
        )}

        <datalist id={`folders_${c.id}`}>
          {folderNames.map((n) => <option key={n} value={n} />)}
        </datalist>
        {showing && files.length === 0 && !mediaLoading && (
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>This client hasn’t uploaded any files yet.</p>
        )}

        <div ref={filesBoxRef} onMouseDown={lassoDown} style={{ position: 'relative' }}>
        {keys.map((k) => {
          const list = groups[k];
          const isLoose = k === '';
          const isTrash = k === TRASH_FOLDER;
          const isAlbum = !isLoose && !isTrash;
          const hidden = isAlbum && list.length > 0 && list.every((f) => f.hidden);
          const allSel = list.length > 0 && list.every((f) => selIds.has(f.id));
          // Squared-off card per section: purple for albums, muted for loose/trash,
          // dashed + dimmed for a hidden album.
          const cardStyle = {
            marginTop: 16, borderRadius: 14, padding: '12px 14px 8px',
            border: hidden ? '1.5px dashed var(--line)' : isAlbum ? '1.5px solid #4a3d6b' : '1px solid var(--line)',
            background: hidden ? 'rgba(127,127,127,0.03)' : isAlbum ? 'linear-gradient(160deg, rgba(124,92,255,0.07), rgba(124,92,255,0.02))' : 'rgba(127,127,127,0.03)',
            opacity: hidden ? 0.6 : 1,
          };
          return (
            <section key={k || '__loose__'} style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                {isAlbum && <span style={{ width: 10, height: 10, borderRadius: 3, background: hidden ? 'var(--muted)' : '#7c5cff', flex: '0 0 auto' }} />}
                {isLoose ? (
                  <h3 className="folder-head" style={{ margin: 0 }}>Loose files</h3>
                ) : isTrash ? (
                  <h3 className="folder-head" style={{ margin: 0 }}>
                    Trash <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12 }}>· client-flagged for removal</span>
                  </h3>
                ) : (
                  <input
                    key={`fname_${k}`}
                    defaultValue={k}
                    title="Rename this whole album"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== k) mediaAction(c.id, { action: 'renameFolder', from: k, to: v });
                      else if (!v) e.target.value = k;
                    }}
                    style={{ fontWeight: 700, maxWidth: 240 }}
                  />
                )}
                {hidden && <span className="pill" style={{ fontSize: 10.5, color: 'var(--muted)' }}>hidden</span>}
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>{list.length}</span>
                <span style={{ flex: 1 }} />
                {list.length > 0 && (
                  <button type="button" className="btn-ghost" style={{ fontSize: 12 }} onClick={() => selectIds(list.map((m) => m.id), !allSel)}>{allSel ? 'Deselect' : 'Select all'}</button>
                )}
                {!isTrash && list.length > 0 && (
                  <button type="button" className="btn-primary" style={{ fontSize: 12, padding: '5px 12px' }} disabled={zipBusy}
                    title={`Download all ${list.length} ${isAlbum ? 'photos in this album' : 'files'} as a ZIP (choose the folder on Chrome/Edge)`}
                    onClick={() => downloadAlbumZip(c.id, isLoose ? 'loose_files' : k, list)}>
                    {zipBusy ? 'Zipping…' : `⬇ Download ${isAlbum ? 'album' : 'all'} (${list.length})`}
                  </button>
                )}
                {isTrash ? (
                  pendingEmpty ? (
                    <span style={{ whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn-ghost" style={{ color: 'var(--red)' }} disabled={mediaBusy} onClick={() => { mediaAction(c.id, { action: 'deleteMany', ids: list.map((m) => m.id) }); setPendingEmpty(false); }}>
                        Confirm empty ({list.length})
                      </button>{' '}
                      <button type="button" className="btn-ghost" onClick={() => setPendingEmpty(false)}>Cancel</button>
                    </span>
                  ) : (
                    <button type="button" className="btn-ghost" style={{ color: 'var(--red)' }} onClick={() => setPendingEmpty(true)}>
                      Empty Trash
                    </button>
                  )
                ) : (
                  <>
                    <button type="button" className="btn-ghost" style={{ fontSize: 12 }} disabled={mediaBusy} onClick={() => mediaAction(c.id, { action: 'renumber', ids: list.map((m) => m.id) })}>
                      Renumber 1…{list.length}
                    </button>
                    {isAlbum && (hidden ? (
                      <button type="button" className="btn-ghost" style={{ fontSize: 12, color: 'var(--ok)' }} disabled={mediaBusy} onClick={() => mediaAction(c.id, { action: 'unhideBox', name: k })}>↩ Restore album</button>
                    ) : pendingHide === k ? (
                      <span style={{ whiteSpace: 'nowrap' }}>
                        <span style={{ color: 'var(--muted)', fontSize: 12, marginRight: 6 }}>Hide album + its {list.length} photos? (reversible)</span>
                        <button type="button" className="btn-ghost" style={{ fontSize: 12, color: 'var(--blue)' }} disabled={mediaBusy} onClick={() => { mediaAction(c.id, { action: 'hideBox', name: k }); setPendingHide(null); }}>Confirm hide</button>{' '}
                        <button type="button" className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setPendingHide(null)}>Cancel</button>
                      </span>
                    ) : (
                      <button type="button" className="btn-ghost" style={{ fontSize: 12, color: 'var(--muted)' }} onClick={() => setPendingHide(k)} title="Hide this album and all its photos from the timeline, montage maker and client — reversible">🕶 Hide album</button>
                    ))}
                  </>
                )}
              </div>
              {list.map((f, idx) => {
                const sel = selIds.has(f.id);
                return (
                <div
                  key={`${f.id}-${f.sortNumber}-${f.folderPath}-${f.filename}`}
                  data-fid={f.id}
                  className="upload-row"
                  style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--line)', padding: '8px 6px', borderRadius: 8, background: sel ? 'rgba(61,123,255,0.12)' : 'transparent' }}
                >
                  <input
                    type="checkbox"
                    checked={sel}
                    title="Select for download"
                    onClick={(e) => toggleSel(f.id, e.shiftKey, orderedIds)}
                    onChange={() => {}}
                    style={{ width: 18, height: 18, accentColor: 'var(--blue)', cursor: 'pointer', flex: '0 0 auto' }}
                  />
                  <input
                    type="number"
                    defaultValue={f.sortNumber ?? ''}
                    title="Order number"
                    onBlur={(e) => {
                      const raw = e.target.value.trim();
                      const val = raw === '' ? null : Number(raw);
                      if (String(f.sortNumber ?? '') !== String(raw)) mediaAction(c.id, { action: 'update', id: f.id, sortNumber: val });
                    }}
                    style={{ width: 56 }}
                  />
                  {f.isVideo ? (
                    <button type="button" className="pill" style={{ fontSize: 11, cursor: 'pointer' }} title="Click to play larger"
                      onClick={() => setLightbox({ type: 'video', url: f.url, filename: f.filename })}>▶ video</button>
                  ) : (
                    <img src={f.url} alt={f.filename} title="Click to enlarge"
                      onClick={() => setLightbox({ type: 'image', url: f.url, filename: f.filename })}
                      style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)', cursor: 'zoom-in' }} />
                  )}
                  <input
                    defaultValue={f.filename}
                    title="File name"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== f.filename) mediaAction(c.id, { action: 'update', id: f.id, filename: v });
                      else if (!v) e.target.value = f.filename;
                    }}
                    style={{ flex: '1 1 160px', minWidth: 120 }}
                  />
                  <input
                    list={`folders_${c.id}`}
                    defaultValue={f.folderPath || ''}
                    placeholder="(loose)"
                    title="Folder — type or pick to move this file"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (f.folderPath || '')) mediaAction(c.id, { action: 'update', id: f.id, folderPath: v });
                    }}
                    style={{ width: 130 }}
                  />
                  <span style={{ whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn-ghost" disabled={mediaBusy || idx === 0} onClick={() => mediaMove(c.id, k, f.id, -1)} title="Move up">↑</button>{' '}
                    <button type="button" className="btn-ghost" disabled={mediaBusy || idx === list.length - 1} onClick={() => mediaMove(c.id, k, f.id, 1)} title="Move down">↓</button>
                  </span>
                  {!f.isVideo && (
                    <button type="button" className="linklike" disabled={mediaBusy} title="Rotate this photo 90°" onClick={() => mediaAction(c.id, { action: 'rotate', id: f.id })}>Rotate ↻</button>
                  )}
                  <a href={f.downloadUrl || f.url} download={f.filename} className="linklike">Download</a>
                  {pendingDelete === f.id ? (
                    <span style={{ whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn-ghost" style={{ color: 'var(--red)' }} disabled={mediaBusy} onClick={() => { mediaAction(c.id, { action: 'delete', id: f.id }); setPendingDelete(null); }}>Confirm delete</button>{' '}
                      <button type="button" className="btn-ghost" onClick={() => setPendingDelete(null)}>Cancel</button>
                    </span>
                  ) : (
                    <button type="button" className="linklike" style={{ color: 'var(--red)' }} onClick={() => setPendingDelete(f.id)}>Delete</button>
                  )}
                </div>
                );
              })}
            </section>
          );
        })}
        {lassoBox && (
          <div style={{ position: 'absolute', left: lassoBox.x - (filesBoxRef.current ? filesBoxRef.current.getBoundingClientRect().left + window.scrollX : 0), top: lassoBox.y - (filesBoxRef.current ? filesBoxRef.current.getBoundingClientRect().top + window.scrollY : 0), width: lassoBox.w, height: lassoBox.h, border: '1.5px solid var(--blue)', background: 'rgba(61,123,255,0.14)', pointerEvents: 'none', zIndex: 30 }} />
        )}
        </div>
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
    const allRows = montages.filter((x) => x.clientId === c.id);
    const hiddenCount = allRows.filter((m) => m.hidden).length;
    const ts = (m) => { const d = new Date(m.createdAt).getTime(); return isNaN(d) ? 0 : d; };
    const cmp = {
      new: (a, b) => ts(b) - ts(a),
      old: (a, b) => ts(a) - ts(b),
      high: (a, b) => (a.watermarked ? 1 : 0) - (b.watermarked ? 1 : 0) || ts(b) - ts(a), // full rez first
      low: (a, b) => (b.watermarked ? 1 : 0) - (a.watermarked ? 1 : 0) || ts(b) - ts(a),  // low rez first
      style: (a, b) => String(a.style || '').localeCompare(String(b.style || '')) || ts(b) - ts(a),
    }[montageSort] || ((a, b) => ts(b) - ts(a));
    const rows = allRows
      .filter((m) => showHidden || !m.hidden)
      .slice()
      // starred keepers always float to the top; the chosen sort orders everything within that
      .sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0) || cmp(a, b));
    return (
      <div className="tool-window" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 18, padding: 8, borderRadius: 14, background: 'rgba(47,107,255,0.06)', border: '1px solid rgba(47,107,255,0.22)' }}>
          {[[1, 'Edit photos'], [2, 'Choose style'], [3, 'Finish & export']].map((st) => {
            const on = montageStep === st[0];
            return (
              <button key={st[0]} type="button" onClick={() => setMontageStep(st[0])}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                  border: on ? '2px solid #2f6bff' : '1.5px solid var(--line)',
                  background: on ? 'linear-gradient(180deg,#3f7bff,#2f6bff)' : 'var(--panel-2, #14161c)',
                  boxShadow: on ? '0 6px 18px rgba(47,107,255,0.35)' : '0 1px 3px rgba(0,0,0,0.2)',
                  borderRadius: 11, padding: '12px 14px', cursor: 'pointer',
                  color: on ? '#fff' : 'var(--text)', transform: on ? 'translateY(-1px)' : 'none', transition: 'all .12s ease',
                }}>
                <span style={{ display: 'inline-flex', width: 26, height: 26, flex: '0 0 auto', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, background: on ? '#fff' : 'var(--line)', color: on ? '#2f6bff' : 'var(--muted)' }}>{st[0]}</span>
                <strong style={{ fontSize: 14 }}>{st[1]}</strong>
              </button>
            );
          })}
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>
          Build one or more montage segments from this client’s photos. Each segment renders as its
          own file — choose the photos (a range like <span className="mono">1-50</span>, or a mix like{' '}
          <span className="mono">1-10, 15, 11-51</span>; photos play in the order you type), a style, a
          pace, and whether it carries title cards. Generate them all at once and intercut in your edit.
        </p>

        {montageStep === 3 && (<>
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
        </>)}

        {montageStep === 1 && (<>
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
              {' · '}
              <button
                type="button"
                className="linklike"
                onClick={() => {
                  const opening = !(roOpen && roClientId === c.id);
                  setRoOpen(opening);
                  if (opening) loadReorder(c.id);
                }}
              >
                {roOpen && roClientId === c.id ? 'Close reorder' : 'Reorder photos'}
              </button>
            </>
          )}
        </p>
        {roOpen && roClientId === c.id && renderReorder(c)}
        {showRef && projPhotos.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 8, marginBottom: 16 }}>
            {projPhotos.map((p) => {
              const over = (pcOver && pcOver.key === p.key && pcDrag.current && pcDrag.current.key !== p.key) ? pcOver.side : null;
              return (
              <div key={p.key || p.index} style={{ textAlign: 'center' }}>
                <div
                  draggable
                  onDragStart={(e) => { pcDrag.current = { id: p.id, key: p.key }; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', p.key); } catch { /* older */ } }}
                  onDragEnd={() => { pcDrag.current = null; setDropHover(null); }}
                  onDragOver={(e) => { if (pcDrag.current && pcDrag.current.key !== p.key) { e.preventDefault(); const s = dropSide(e); if (!pcOver || pcOver.key !== p.key || pcOver.side !== s) setDropHover({ key: p.key, id: p.id, album: p.album || null, side: s }); } }}
                  onDrop={(e) => { if (pcDrag.current) { e.preventDefault(); e.stopPropagation(); commitDrop(c.id, p.album || null); } }}
                  title="Drag to reorder"
                  style={{ position: 'relative', cursor: 'grab', borderRadius: 6, outline: over ? '2px solid rgba(56,182,255,.5)' : 'none', outlineOffset: '-2px' }}>
                  <img
                    src={p.url}
                    alt={p.filename}
                    draggable={false}
                    style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)' }}
                  />
                  {over && <span style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 6, borderRadius: '6px 0 0 6px', background: over === 'before' ? '#22c55e' : '#38b6ff', boxShadow: over === 'before' ? '0 0 8px #22c55e' : 'none', zIndex: 7 }} />}
                  {over && <span style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 6, borderRadius: '0 6px 6px 0', background: over === 'after' ? '#22c55e' : '#38b6ff', boxShadow: over === 'after' ? '0 0 8px #22c55e' : 'none', zIndex: 7 }} />}
                  {p.importSeq != null && <span title={`Import #${String(p.importSeq).padStart(3, '0')} — permanent reference number`} style={{ position: 'absolute', bottom: 4, left: 4, fontSize: 10, fontWeight: 900, letterSpacing: '.3px', background: '#f5a623', color: '#241700', padding: '1px 5px', borderRadius: 5, boxShadow: '0 1px 3px rgba(0,0,0,.5)' }}>{String(p.importSeq).padStart(3, '0')}</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{p.index}</div>
              </div>
              );
            })}
          </div>
        )}

        {/* Photo editor — click a thumbnail to edit it large. Edits persist on the
            client and apply to EVERY style. Thumbnails mirror each photo's edits. */}
        {projPhotos.length > 0 && (() => {
          const defE = { anchor: 'top', fit: 'fit', size: 100, removed: false, colorCorrect: false, mode: 'color', contrast: 100, saturation: 100, posX: null, posY: null };
          const styleFor = (e) => {
            const pos = e.fit === 'fill'
              ? ((Number.isFinite(e.posX) && Number.isFinite(e.posY)) ? `${e.posX}% ${e.posY}%`
                 : e.anchor === 'top' ? '50% 0%' : e.anchor === 'bottom' ? '50% 100%' : e.anchor === 'left' ? '0% 50%' : e.anchor === 'right' ? '100% 50%' : '50% 50%')
              : 'center';
            // Auto color = one-tap enhance (a starting point to fine-tune with the
            // sliders): a brightness + contrast + saturation lift, multiplied on top
            // of the manual contrast/saturation. Now shown in the preview so On/Off
            // is visibly different (was omitted here → toggling looked identical).
            const cc = e.colorCorrect ? { b: 1.08, c: 1.14, s: 1.20 } : { b: 1, c: 1, s: 1 };
            let f = e.mode === 'bw' ? 'grayscale(1) ' : e.mode === 'sepia' ? 'sepia(.8) ' : '';
            const contrast = ((e.contrast || 100) / 100) * cc.c;
            const sat = (e.mode === 'bw' ? 0 : (e.saturation || 100) / 100) * cc.s;
            f += `brightness(${cc.b}) contrast(${contrast.toFixed(3)}) saturate(${sat.toFixed(3)})`;
            return { objectFit: e.fit === 'fill' ? 'cover' : 'contain', objectPosition: pos, transform: `scale(${(e.size || 100) / 100})`, filter: f };
          };
          // The inline editor for ONE photo — opens directly under its
          // thumbnail on double-click. ‹ › move to the previous/next photo.
          const editorPanel = (selP) => {
            const e = { ...defE, ...(photoEdits.photos[selP.key] || {}) };
            const idx = projPhotos.findIndex((p) => p.key === selP.key);
            const goto = (j) => { if (j >= 0 && j < projPhotos.length) setSelKey(projPhotos[j].key); };
            const startDrag = (ev) => {
              if (e.fit !== 'fill') return;
              const r = ev.currentTarget.getBoundingClientRect();
              const px = Number.isFinite(e.posX) ? e.posX : (e.anchor === 'top' ? 0 : e.anchor === 'bottom' ? 100 : 50);
              const py = Number.isFinite(e.posY) ? e.posY : 50;
              bigDragRef.current = { sx: ev.clientX, sy: ev.clientY, px, py, w: r.width, h: r.height };
              try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch (_) {}
            };
            const moveDrag = (ev) => {
              const d = bigDragRef.current; if (!d) return;
              const nx = Math.max(0, Math.min(100, d.px - (ev.clientX - d.sx) / d.w * 140));
              const ny = Math.max(0, Math.min(100, d.py - (ev.clientY - d.sy) / d.h * 140));
              editPhoto(c.id, selP.key, { posX: Math.round(nx), posY: Math.round(ny) });
            };
            const endDrag = () => { bigDragRef.current = null; };
            const arrow = (dir, disabled) => (
              <button type="button" onClick={() => goto(idx + dir)} disabled={disabled} aria-label={dir < 0 ? 'Previous photo' : 'Next photo'}
                style={{ position: 'absolute', top: '50%', [dir < 0 ? 'left' : 'right']: 8, transform: 'translateY(-50%)', zIndex: 4, width: 40, height: 40, borderRadius: '50%', border: 'none', background: disabled ? 'rgba(0,0,0,.25)' : 'rgba(0,0,0,.6)', color: '#fff', fontSize: 22, lineHeight: 1, cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{dir < 0 ? '‹' : '›'}</button>
            );
            return (
              <div style={{ gridColumn: '1 / -1', border: '1px solid var(--line)', borderRadius: 10, padding: 12, margin: '4px 0 8px', background: 'rgba(127,127,127,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                  <strong style={{ fontSize: 13 }}>Editing photo {selP.index}{' '}
                    <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· {selP.filename}</span></strong>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{editsSaving ? 'Saving…' : editsSaved ? 'Saved' : ''}</span>
                    <button type="button" className="linklike" onClick={() => setSelKey(null)}>Close ✕</button>
                  </span>
                </div>
                <div
                  onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag}
                  style={{ position: 'relative', width: '100%', maxWidth: 720, margin: '0 auto', aspectRatio: '16 / 9', background: '#000', borderRadius: 10, overflow: 'hidden', cursor: e.fit === 'fill' ? 'grab' : 'default' }}
                >
                  <img src={selP.url} alt={selP.filename} draggable={false} style={{ width: '100%', height: '100%', userSelect: 'none', ...styleFor(e) }} />
                  {arrow(-1, idx <= 0)}
                  {arrow(1, idx >= projPhotos.length - 1)}
                  <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 11, background: 'rgba(0,0,0,.6)', color: '#fff', padding: '2px 8px', borderRadius: 6 }}>Photo {selP.index} of {projPhotos.length}</span>
                  <span style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', fontSize: 11, background: 'rgba(0,0,0,.6)', color: '#e9dcc0', padding: '3px 10px', borderRadius: 6 }}>
                    {e.fit === 'fill' ? 'Fill — drag the photo to position it' : 'Fit — whole photo, nothing cropped'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', maxWidth: 720, margin: '12px auto 0', fontSize: 12, color: 'var(--muted)' }}>
                  <div style={{ border: '1px solid var(--line)', borderRadius: 9, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>Framing
                    {['top', 'center', 'bottom'].map((a) => (
                      <button key={a} type="button" className={e.anchor === a && e.fit === 'fill' && !Number.isFinite(e.posX) ? 'btn-primary' : 'btn-ghost'} style={{ padding: '4px 8px', fontSize: 11 }}
                        onClick={() => editPhoto(c.id, selP.key, { anchor: a, fit: 'fill', posX: null, posY: null })}>{a[0].toUpperCase() + a.slice(1)}</button>
                    ))}
                  </div>
                  <div style={{ border: '1px solid var(--line)', borderRadius: 9, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>Fit
                    <button type="button" className={e.fit === 'fill' ? 'btn-primary' : 'btn-ghost'} style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => editPhoto(c.id, selP.key, { fit: 'fill' })}>Fill</button>
                    <button type="button" className={e.fit === 'fit' ? 'btn-primary' : 'btn-ghost'} style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => editPhoto(c.id, selP.key, { fit: 'fit' })}>Fit</button>
                    <span style={{ marginLeft: 6 }}>Size</span>
                    <input type="range" min="60" max="140" step="5" value={e.size || 100} style={{ width: 110 }} onChange={(ev) => editPhoto(c.id, selP.key, { size: Number(ev.target.value) })} />
                    <span style={{ display: 'inline-block', minWidth: 40 }}>{e.size || 100}%</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', maxWidth: 720, margin: '10px auto 0', fontSize: 12, color: 'var(--muted)' }}>
                  <div style={{ border: '1px solid var(--line)', borderRadius: 9, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>Look
                    {[['color', 'Colour'], ['bw', 'B&W'], ['sepia', 'Sepia']].map((mm) => (
                      <button key={mm[0]} type="button" className={e.mode === mm[0] ? 'btn-primary' : 'btn-ghost'} style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => editPhoto(c.id, selP.key, { mode: mm[0] })}>{mm[1]}</button>
                    ))}
                  </div>
                  <div style={{ border: '1px solid var(--line)', borderRadius: 9, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>Contrast
                    <input type="range" min="50" max="200" step="2" value={e.contrast || 100} style={{ width: 100 }} onChange={(ev) => editPhoto(c.id, selP.key, { contrast: Number(ev.target.value) })} />
                    <span style={{ display: 'inline-block', minWidth: 40 }}>{e.contrast || 100}%</span>
                    <span style={{ marginLeft: 8 }}>Saturation</span>
                    <input type="range" min="0" max="200" step="5" value={e.saturation || 100} style={{ width: 100 }} onChange={(ev) => editPhoto(c.id, selP.key, { saturation: Number(ev.target.value) })} />
                    <span style={{ display: 'inline-block', minWidth: 40 }}>{e.saturation || 100}%</span>
                  </div>
                  <div style={{ border: '1px solid var(--line)', borderRadius: 9, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>Auto color
                    <button type="button" className={!e.colorCorrect ? 'btn-primary' : 'btn-ghost'} style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => editPhoto(c.id, selP.key, { colorCorrect: false })}>Off</button>
                    <button type="button" className={e.colorCorrect ? 'btn-primary' : 'btn-ghost'} style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => editPhoto(c.id, selP.key, { colorCorrect: true })}>On</button>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
                    <button type="button" className="linklike" style={{ fontSize: 12 }} disabled={rotatingKey === selP.key} title="Rotate this photo 90°" onClick={() => rotateProjPhoto(c.id, selP.key)}>{rotatingKey === selP.key ? 'Rotating…' : 'Rotate ↻'}</button>
                    <a href={selP.downloadUrl || selP.url} download={selP.filename} className="linklike" style={{ fontSize: 12 }}>Download</a>
                    <button type="button" className="linklike" style={{ fontSize: 12 }} disabled={replacing === selP.key} onClick={() => { replaceKeyRef.current = selP.key; if (replaceInputRef.current) replaceInputRef.current.click(); }}>{replacing === selP.key ? 'Uploading…' : 'Replace'}</button>
                    <button type="button" className="linklike" style={{ fontSize: 12 }} onClick={() => editPhoto(c.id, selP.key, { removed: !e.removed })}>{e.removed ? 'Restore' : 'Remove'}</button>
                  </div>
                </div>
              </div>
            );
          };

          // One thumbnail cell.
          const photoCell = (p) => {
            const pe = { ...defE, ...(photoEdits.photos[p.key] || {}) };
            const isSel = p.key === selKey;
            const over = (pcOver && pcOver.key === p.key && pcDrag.current && pcDrag.current.key !== p.key) ? pcOver.side : null;
            return (
              <div key={`t:${p.key || p.index}`}
                draggable
                onDragStart={(e) => { pcDrag.current = { id: p.id, key: p.key }; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', p.key); } catch { /* older */ } }}
                onDragEnd={() => { pcDrag.current = null; setDropHover(null); }}
                onDragOver={(e) => { if (pcDrag.current && pcDrag.current.key !== p.key) { e.preventDefault(); const s = dropSide(e); if (!pcOver || pcOver.key !== p.key || pcOver.side !== s) setDropHover({ key: p.key, id: p.id, album: p.album || null, side: s }); } }}
                onDrop={(e) => { if (pcDrag.current) { e.preventDefault(); e.stopPropagation(); commitDrop(c.id, p.album || null); } }}
                onDoubleClick={() => setSelKey(isSel ? null : p.key)} title="Drag to reorder · double-click to edit"
                style={{ border: isSel ? '2px solid #d8b56b' : '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', cursor: 'grab', opacity: pe.removed ? 0.4 : 1, position: 'relative', outline: over ? '2px solid rgba(56,182,255,.5)' : 'none', outlineOffset: '-2px' }}>
                <div style={{ aspectRatio: '16 / 9', background: '#000', overflow: 'hidden' }}>
                  <img src={p.url} alt={p.filename} draggable={false} style={{ width: '100%', height: '100%', ...styleFor(pe) }} />
                </div>
                {over && <span style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 7, borderRadius: '8px 0 0 8px', background: over === 'before' ? '#22c55e' : '#38b6ff', boxShadow: over === 'before' ? '0 0 8px #22c55e' : 'none', zIndex: 7 }} />}
                {over && <span style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 7, borderRadius: '0 8px 8px 0', background: over === 'after' ? '#22c55e' : '#38b6ff', boxShadow: over === 'after' ? '0 0 8px #22c55e' : 'none', zIndex: 7 }} />}
                <span style={{ position: 'absolute', top: 4, left: 4, fontSize: 10, background: 'rgba(0,0,0,.65)', color: '#fff', padding: '1px 6px', borderRadius: 5 }}>{p.index}</span>
                {p.importSeq != null && <span title={`Import #${String(p.importSeq).padStart(3, '0')} — permanent reference number`} style={{ position: 'absolute', bottom: 4, left: 4, fontSize: 10, fontWeight: 900, letterSpacing: '.3px', background: '#f5a623', color: '#241700', padding: '1px 5px', borderRadius: 5, boxShadow: '0 1px 3px rgba(0,0,0,.5)' }}>{String(p.importSeq).padStart(3, '0')}</span>}
                {pe.removed && <span style={{ position: 'absolute', bottom: 4, right: 4, fontSize: 9, background: '#e23b3b', color: '#fff', padding: '1px 5px', borderRadius: 4 }}>removed</span>}
              </div>
            );
          };
          // Group the montage photos into their albums (contiguous runs in play
          // order) so the editor shows squared-off album sections, not one flat grid.
          const groups = [];
          projPhotos.forEach((p) => {
            const a = p.album || '';
            let g = groups.length && groups[groups.length - 1].album === a ? groups[groups.length - 1] : null;
            if (!g) { g = { album: a, photos: [] }; groups.push(g); }
            g.photos.push(p);
          });
          const hasAlbums = groups.some((g) => g.album);
          const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(122px, 1fr))', gap: 10 };
          const renderCells = (photos) => photos.map((p) => (
            <Fragment key={`c:${p.key || p.index}`}>
              {photoCell(p)}
              {p.key === selKey && editorPanel(p)}
            </Fragment>
          ));

          return (
            <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                <strong style={{ fontSize: 13 }}>Photo editor{' '}
                  <span style={{ color: 'var(--muted)', fontWeight: 400 }}>— drag a photo to reorder · double-click to edit</span></strong>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button type="button" onClick={() => undoOrder(c.id)} disabled={!undoStack.length} title="Undo the last move"
                    style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: !undoStack.length ? 'var(--muted)' : 'var(--text)', cursor: !undoStack.length ? 'default' : 'pointer', opacity: !undoStack.length ? 0.5 : 1 }}>↶ Undo</button>
                  <button type="button" onClick={() => redoOrder(c.id)} disabled={!redoStack.length} title="Redo the move"
                    style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: !redoStack.length ? 'var(--muted)' : 'var(--text)', cursor: !redoStack.length ? 'default' : 'pointer', opacity: !redoStack.length ? 0.5 : 1 }}>↷ Redo</button>
                  {pcMsg && <span style={{ fontSize: 12, fontWeight: 700, color: pcMsg.includes('Could not') ? '#e06b6b' : (pcMsg === 'Saving…' ? 'var(--muted)' : '#2fbf71') }}>{pcMsg}</span>}
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{Object.values(photoEdits.photos).filter((x) => x && x.removed).length} removed</span>
                </span>
              </div>
              {hasAlbums ? (
                groups.map((g, gi) => {
                  const isAlbum = !!g.album;
                  return (
                    <section key={`g:${gi}:${g.album}`} style={{
                      marginBottom: 12, borderRadius: 12, padding: '10px 12px',
                      border: isAlbum ? '1.5px solid #4a3d6b' : '1px solid var(--line)',
                      background: isAlbum ? 'linear-gradient(160deg, rgba(124,92,255,0.07), rgba(124,92,255,0.02))' : 'rgba(127,127,127,0.03)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        {isAlbum && <span style={{ width: 10, height: 10, borderRadius: 3, background: '#7c5cff', flex: '0 0 auto' }} />}
                        <strong style={{ fontSize: 13 }}>{isAlbum ? g.album : 'Loose photos'}</strong>
                        <span style={{ color: 'var(--muted)', fontSize: 12 }}>{g.photos.length} photo{g.photos.length === 1 ? '' : 's'}</span>
                      </div>
                      <div style={gridStyle}
                        onDragOver={(e) => { if (pcDrag.current) e.preventDefault(); }}
                        onDrop={(e) => { if (pcDrag.current) { e.preventDefault(); commitDrop(c.id, g.album || null); } }}
                      >{renderCells(g.photos)}</div>
                    </section>
                  );
                })
              ) : (
                <div style={gridStyle}
                  onDragOver={(e) => { if (pcDrag.current) e.preventDefault(); }}
                  onDrop={(e) => { if (pcDrag.current) { e.preventDefault(); commitDrop(c.id, null); } }}
                >{renderCells(groups[0] ? groups[0].photos : [])}</div>
              )}
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
Drag any photo to a new spot to reorder it — the order saves automatically and syncs to the client’s portal. Double-click a photo to open its editor right below it; use ‹ › to move between photos. Photos are grouped into their albums. Default is Fit (nothing cropped); Fill crops — then drag the big photo to position it. B&amp;W / Sepia and Auto-color render in the montage; contrast &amp; saturation preview in the editor (render tuning pending a test render). Removed photos are skipped.
              </p>
              <input ref={replaceInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={(ev) => { const f = ev.target.files && ev.target.files[0]; ev.target.value = ''; const key = replaceKeyRef.current; if (f && key) replacePhoto(c.id, key, f); }} />
            </div>
          );
        })()}
        </>)}

        {montageStep === 2 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>Click a look to use it. For multiple styles in one pass, add segments in Finish.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {MONTAGE_STYLES.map((o) => {
                const sel = segments.length > 0 && segments[0].style === o.value;
                return (
                  <button key={o.value} type="button" onClick={() => setSegments((arr) => arr.map((x) => ({ ...x, style: o.value })))}
                    style={{ textAlign: 'left', border: sel ? '2px solid #2f6bff' : '1px solid var(--line)', borderRadius: 12, padding: 12, cursor: 'pointer', background: sel ? 'rgba(47,107,255,0.08)' : 'transparent', color: 'var(--text)' }}>
                    <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 8, overflow: 'hidden', marginBottom: 8, background: '#000' }}>
                      <video src={`/style-previews/${o.preview || o.value}.mp4`} muted loop autoPlay playsInline preload="auto"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        onError={(ev) => { const w = ev.currentTarget.parentElement; if (w) w.style.display = 'none'; }} />
                    </div>
                    <strong style={{ fontSize: 13 }}>{o.label.split(' \u2014 ')[0]}</strong>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{o.label.split(' \u2014 ')[1] || ''}</div>
                    {sel && <div style={{ color: '#2f6bff', fontSize: 12, marginTop: 4 }}>{'\u2713 selected'}</div>}
                  </button>
                );
              })}
            </div>

            {/* Read-only porting tool: read a look out of the Creatomate editor so
                it can be rebuilt as a style above. Nothing here renders anything. */}
            <details style={{ marginTop: 14, border: '1px solid var(--line)', borderRadius: 10, padding: '8px 12px' }}
              onToggle={(ev) => { if (ev.currentTarget.open && cmTemplates === null && !cmTplBusy) loadCmTemplates(); }}>
              <summary style={{ cursor: 'pointer', fontSize: 12.5, color: 'var(--muted)' }}>
                Creatomate templates (porting tool)
              </summary>
              <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '8px 0' }}>
                Templates in the Creatomate project this portal already renders with. Download a template’s
                source JSON to have its look rebuilt as a montage style. Read-only — nothing is created or
                changed at Creatomate.
              </p>
              {cmTplBusy && <div style={{ fontSize: 12 }}>Loading…</div>}
              {cmTplErr && <div style={{ fontSize: 12, color: '#e5484d' }}>{cmTplErr}</div>}
              {cmTemplates && cmTemplates.length === 0 && !cmTplBusy && (
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  No templates in this Creatomate project.
                </div>
              )}
              {cmTemplates && cmTemplates.length > 0 && (
                <div style={{ display: 'grid', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
                  {cmTemplates.map((t) => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                      <code style={{ fontSize: 10.5, color: 'var(--muted)' }}>{t.id}</code>
                      <button type="button" className="btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }}
                        onClick={() => downloadCmTemplate(t)}>Download JSON</button>
                    </div>
                  ))}
                </div>
              )}
              {cmTemplates !== null && !cmTplBusy && (
                <button type="button" className="btn-ghost" style={{ fontSize: 11, padding: '2px 8px', marginTop: 8 }}
                  onClick={loadCmTemplates}>Refresh</button>
              )}
            </details>

            {(() => {
              const st = segments[0]?.style;
              if (st !== 'multi_page' && st !== 'multi_page_record') return null;
              const seg = segments[0] || {};
              const set = (patch) => setSegments((arr) => arr.map((x) => ({ ...x, ...patch })));
              const TRANS = [
                ['record-fwd', 'Record forward'], ['record-back', 'Record backward'],
                ['slide-left', 'Slide left'], ['slide-right', 'Slide right'],
                ['slide-up', 'Slide up'], ['slide-down', 'Slide down'], ['random', 'Random'],
              ];
              return (
                <div style={{ marginTop: 16, border: '1px solid var(--blue)', borderRadius: 10, padding: '12px 14px', background: 'rgba(61,123,255,0.06)' }}>
                  <strong style={{ fontSize: 13 }}>Multi Page options</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 10, alignItems: 'flex-end' }}>
                    <label style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {st === 'multi_page_record' ? 'Page exit motion' : 'Image entrance motion'}
                      <select value={seg.mpTransition || 'record-fwd'} onChange={(e) => set({ mpTransition: e.target.value })}
                        style={{ display: 'block', marginTop: 4, minWidth: 170 }}>
                        {TRANS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </label>
                    <label style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Reveal stagger
                      <select value={seg.mpStagger || ''} onChange={(e) => set({ mpStagger: e.target.value })}
                        style={{ display: 'block', marginTop: 4 }}>
                        <option value="">Default</option>
                        <option value="0.12">Fast</option>
                        <option value="0.24">Medium</option>
                        <option value="0.38">Slow</option>
                      </select>
                    </label>
                    <label style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Hold per page
                      <select value={seg.mpHold || ''} onChange={(e) => set({ mpHold: e.target.value })}
                        style={{ display: 'block', marginTop: 4 }}>
                        <option value="">Default</option>
                        <option value="0.9">Short</option>
                        <option value="1.3">Medium</option>
                        <option value="2.2">Long</option>
                      </select>
                    </label>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8 }}>
                    Applies to every Multi Page segment. 3D X/Y-spin isn’t available in the render (Creatomate can’t do true 3D) — those live only in the browser preview.
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {montageStep === 3 && (<>
        {/* Hidden picker for background imports. Must live INSIDE Step 3: the
            background control is here, and a ref to an input rendered in Step 1
            is null while Step 3 is on screen. */}
        <input ref={bgFileRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" style={{ display: 'none' }}
          onChange={(ev) => { const f = ev.target.files && ev.target.files[0]; ev.target.value = ''; uploadBackground(f, bgTargetSeg.current); }} />
        {/* Segment plan */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {segments.map((s, idx) => {
            const N = projPhotos.length;
            const matched = parsePhotoSpec(s.photos, N).length;
            // Album ranges (contiguous runs in play order) so a segment can output a
            // whole album by name — the pulldown just fills the photo numbers below.
            const albumRanges = [];
            projPhotos.forEach((p, i) => {
              const a = p.album || ''; const pos = i + 1;
              const prev = albumRanges[albumRanges.length - 1];
              if (a && prev && prev.name === a && prev.to === pos - 1) prev.to = pos;
              else if (a) albumRanges.push({ name: a, from: pos, to: pos });
            });
            return (
              <div key={s.key} style={{ border: '1px solid var(--line)', borderLeft: '3px solid var(--blue)', borderRadius: 10, padding: 12, boxShadow: '0 3px 14px rgba(0,0,0,0.28)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '-12px -12px 14px', padding: '9px 12px', background: 'linear-gradient(var(--blue), var(--blue)) 0 0 / 132px 3px no-repeat, var(--panel-2)', borderBottom: '1px solid var(--line)', borderRadius: '8px 8px 0 0' }}>
                  <strong style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: '50%', alignItems: 'center', justifyContent: 'center', fontSize: 12, background: 'var(--blue)', color: '#fff', fontWeight: 800 }}>{idx + 1}</span>
                    Segment {idx + 1}
                  </strong>
                  {segments.length > 1 && (
                    <button type="button" className="linklike" onClick={() => removeSegment(s.key)}>Remove</button>
                  )}
                </div>
                {albumRanges.length > 0 && (
                  <div className="field-group" style={{ marginBottom: 8 }}>
                    <label htmlFor={`al_${s.key}`}>Album to output</label>
                    <select
                      id={`al_${s.key}`}
                      value={s.album || ''}
                      onChange={(e) => {
                        const name = e.target.value;
                        const r = albumRanges.find((x) => x.name === name);
                        updateSegment(s.key, { album: name, photos: r ? `${r.from}-${r.to}` : '' });
                      }}
                    >
                      <option value="">All photos</option>
                      {albumRanges.map((r) => (
                        <option key={r.name} value={r.name}>{r.name} (#{r.from}–{r.to}, {r.to - r.from + 1} photos)</option>
                      ))}
                    </select>
                  </div>
                )}
                <label htmlFor={`ph_${s.key}`}>Photos (blank = all; e.g. 1-50 or 1-10, 15, 11-51)</label>
                <input
                  id={`ph_${s.key}`}
                  placeholder="1-50"
                  value={s.photos}
                  onChange={(e) => updateSegment(s.key, { photos: e.target.value, album: '' })}
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
                    <label htmlFor={`pm_${s.key}`}>Pace by</label>
                    <select id={`pm_${s.key}`} value={s.paceMode || 'perphoto'} onChange={(e) => updateSegment(s.key, { paceMode: e.target.value })}>
                      <option value="perphoto">Seconds per photo</option>
                      <option value="total">Total length (time)</option>
                    </select>
                  </div>
                </div>
                {s.paceMode === 'total' ? (
                  <div className="field-group">
                    <label htmlFor={`tmin_${s.key}`}>Total length — the selected photos cycle to fit this time</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input id={`tmin_${s.key}`} type="number" min="0" max="30" step="1" placeholder="min" aria-label="minutes"
                        value={s.tMin} onChange={(e) => updateSegment(s.key, { tMin: e.target.value })} style={{ width: 66, textAlign: 'center' }} />
                      <span style={{ color: 'var(--muted)', fontWeight: 800 }}>:</span>
                      <input type="number" min="0" max="59" step="1" placeholder="sec" aria-label="seconds"
                        value={s.tSec} onChange={(e) => updateSegment(s.key, { tSec: e.target.value })} style={{ width: 66, textAlign: 'center' }} />
                      <span style={{ color: 'var(--muted)', fontWeight: 800 }}>:</span>
                      <input type="number" min="0" max="29" step="1" placeholder="fr" aria-label="frames"
                        value={s.tFrames} onChange={(e) => updateSegment(s.key, { tFrames: e.target.value })} style={{ width: 66, textAlign: 'center' }} />
                      <span style={{ color: 'var(--muted)', fontSize: 12.5, marginLeft: 6 }}>min : sec : frames (30&nbsp;fps)</span>
                    </div>
                  </div>
                ) : (
                  <div className="field-group">
                    <label htmlFor={`sp_${s.key}`}>Seconds per photo</label>
                    <select id={`sp_${s.key}`} value={s.speed} onChange={(e) => updateSegment(s.key, { speed: e.target.value })}>
                      <option value="">Style default</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <option key={n} value={n}>{n} second{n > 1 ? 's' : ''}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="field-group">
                  <label className="choice" style={{ color: 'var(--text)', display: 'flex' }}>
                    <input type="checkbox" checked={s.cards} onChange={(e) => updateSegment(s.key, { cards: e.target.checked })} />
                    Include title cards (opening + closing)
                  </label>
                </div>
                <div className="field-group" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                  <label className="choice" style={{ color: 'var(--text)', display: 'flex' }}>
                    <input type="checkbox" checked={s.green !== false} onChange={(e) => updateSegment(s.key, { green: e.target.checked })} />
                    Green-screen frame (keyable green photo, first &amp; last)
                  </label>
                </div>
                <div className="field-group" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                  <label style={{ color: 'var(--text)', display: 'block', marginBottom: 4 }}>Background</label>
                  <select value={s.bgMode || 'default'} onChange={(e) => {
                    updateSegment(s.key, { bgMode: e.target.value });
                    if (e.target.value === 'library' && bgLib === null && !bgLibBusy) loadBgLib();
                  }}>
                    <option value="default">Style default</option>
                    <option value="green">Green screen (keyable)</option>
                    <option value="soft_focus">Texture — Soft-focus (animated)</option>
                    <option value="linen">Texture — Cream linen (animated)</option>
                    <option value="gradient">Texture — Gradient wash (animated)</option>
                    <option value="library">Imported image or video…</option>
                    <option value="image">Image by URL…</option>
                  </select>
                  {s.bgMode === 'library' && (() => {
                    const tintRow = (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>
                        <span>Tint</span>
                        <input type="color" value={s.bgTint || '#102040'} onChange={(e) => updateSegment(s.key, { bgTint: e.target.value })} />
                        <span>Opacity</span>
                        <input type="range" min="0" max="100" value={parseInt(s.bgOpacity || '50', 10)} onChange={(e) => updateSegment(s.key, { bgOpacity: e.target.value })} />
                        <span>{parseInt(s.bgOpacity || '50', 10)}%</span>
                      </div>
                    );
                    return (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button type="button" className="btn-ghost" disabled={bgLibBusy}
                            onClick={() => { bgTargetSeg.current = s.key; bgFileRef.current?.click(); }}>
                            {bgLibBusy ? 'Working…' : '+ Import image or video'}
                          </button>
                          {bgLib !== null && (
                            <button type="button" className="btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }}
                              onClick={loadBgLib}>Refresh</button>
                          )}
                        </div>
                        {bgLibErr && <div style={{ fontSize: 12, color: '#e5484d', marginTop: 6 }}>{bgLibErr}</div>}
                        {bgLib && bgLib.length === 0 && !bgLibBusy && (
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                            Nothing imported yet. JPEG/PNG/WebP images, or MP4/MOV/WebM video.
                          </div>
                        )}
                        {bgLib && bgLib.length > 0 && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8, marginTop: 8, maxHeight: 260, overflowY: 'auto' }}>
                            {bgLib.map((b) => {
                              const sel = s.bgKey === b.key;
                              return (
                                <div key={b.key} style={{ position: 'relative' }}>
                                  <button type="button"
                                    onClick={() => updateSegment(s.key, { bgKey: b.key, bgKind: b.kind, bgClipS: b.kind === 'video' ? (bgDur[b.key] || null) : null })}
                                    title={b.filename}
                                    style={{ display: 'block', width: '100%', padding: 0, cursor: 'pointer', background: '#000',
                                      border: sel ? '2px solid #2f6bff' : '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
                                    <div style={{ width: '100%', aspectRatio: '16 / 9', background: '#000' }}>
                                      {b.kind === 'video'
                                        ? <video src={b.url} muted loop autoPlay playsInline preload="metadata"
                                            onLoadedMetadata={(ev) => {
                                              noteBgDur(b.key, ev.currentTarget.duration);
                                              // Backfill a selection made before the metadata arrived,
                                              // so an older backdrop still gets its crossfade.
                                              if (s.bgKey === b.key && b.kind === 'video' && !s.bgClipS && ev.currentTarget.duration > 0) {
                                                updateSegment(s.key, { bgClipS: Math.round(ev.currentTarget.duration * 1000) / 1000 });
                                              }
                                            }}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                        : <img src={b.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                                    </div>
                                    <div style={{ fontSize: 10.5, color: 'var(--muted)', padding: '3px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {b.kind === 'video' ? '▶ ' : ''}{b.filename}
                                    </div>
                                  </button>
                                  <button type="button" title="Delete from the library"
                                    onClick={() => deleteBackground(b.key)}
                                    style={{ position: 'absolute', top: 2, right: 2, fontSize: 11, lineHeight: 1, padding: '2px 5px',
                                      background: 'rgba(0,0,0,0.65)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>✕</button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {s.bgKey && tintRow}
                        {s.bgKind === 'video' && (
                          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>
                            Video backdrops loop for the whole montage and render silent.
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {s.bgMode === 'image' && (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input type="text" placeholder="Background image URL" value={s.bgUrl || ''} onChange={(e) => updateSegment(s.key, { bgUrl: e.target.value })} style={{ width: '100%' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)' }}>
                        <span>Tint</span>
                        <input type="color" value={s.bgTint || '#102040'} onChange={(e) => updateSegment(s.key, { bgTint: e.target.value })} />
                        <span>Opacity</span>
                        <input type="range" min="0" max="100" value={parseInt(s.bgOpacity || '50', 10)} onChange={(e) => updateSegment(s.key, { bgOpacity: e.target.value })} />
                        <span>{parseInt(s.bgOpacity || '50', 10)}%</span>
                      </div>
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                    Default keeps the style’s own backdrop. Green screen is keyable. An imported image or video
                    sits behind everything, tinted. Backgrounds apply to the one-at-a-time styles, Story Builder,
                    Polaroid/Photo Drop and the slide family — the wall styles (Collage, Epic, Trendy, Gallery,
                    Multi Page) supply their own backdrop and ignore this.
                  </div>
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
        {NEW_STYLES.length > 0 && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
            <button type="button" className="btn-ghost" disabled={genBusy} onClick={() => draftNewStyles(c)}>
              {genBusy ? 'Queuing…' : `Try the ${NEW_STYLES.length} new styles (~${testCreditEstimate(NEW_STYLES.length)} credits)`}
            </button>
            <span style={{ fontSize: 11.5, color: 'var(--muted)', marginLeft: 10 }}>
              One short watermarked draft of each style that has never been rendered — first {TEST_PHOTOS} photos,
              no title cards, half resolution. Mix portrait and landscape photos in the first {TEST_PHOTOS} to see
              how each style handles shape changes.
            </span>
          </div>
        )}
        {mMsg && <p className={mErr ? 'msg-error' : 'msg-ok'} style={{ fontSize: 14 }}>{mMsg}</p>}
        </>)}

        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 className="folder-head" style={{ margin: 0 }}>Renders</h3>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {allRows.length > 1 && (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--muted)' }}>
                  Sort
                  <select
                    value={montageSort}
                    onChange={(e) => setMontageSort(e.target.value)}
                    style={{ fontSize: 12.5, padding: '4px 8px', borderRadius: 8, border: '1px solid var(--line)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}
                  >
                    <option value="new">Newest first</option>
                    <option value="old">Oldest first</option>
                    <option value="high">High rez first</option>
                    <option value="low">Low rez first</option>
                    <option value="style">Style (A–Z)</option>
                  </select>
                </label>
              )}
              {hiddenCount > 0 && (
                <button type="button" className="linklike" style={{ fontSize: 13 }} onClick={() => setShowHidden((v) => !v)}>
                  {showHidden ? `Hide hidden (${hiddenCount})` : `Show hidden (${hiddenCount})`}
                </button>
              )}
              {montages.some((m) => m.status === 'queued' || m.status === 'rendering') && (
                <span style={{ fontSize: 12.5, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--blue)' }} />
                  Auto‑refreshing…
                </span>
              )}
              <button className="btn-ghost" type="button" onClick={loadMontages}>Refresh</button>
            </div>
          </div>
          {rows.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>No montages yet for this client.</p>
          ) : (
            rows.map((m) => (
              <div key={m.id} style={{
                border: '1px solid var(--line)',
                borderLeft: m.watermarked ? '1px solid var(--line)' : '4px solid #2f6bff',
                borderRadius: 10, padding: 14, marginBottom: 12,
                background: m.watermarked ? 'rgba(255,255,255,0.02)' : 'rgba(47,107,255,0.06)',
                opacity: m.hidden ? 0.5 : 1,
              }}>
                {/* Header: title + status badge + remove (X) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <strong style={{ fontSize: 15 }}>{m.title}</strong>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                    {(() => {
                      const st = m.status === 'rendering' || m.status === 'queued'
                        ? { t: 'Rendering…', bg: '#8a6d1f', fg: '#ffe9b0' }
                        : m.status === 'failed'
                          ? { t: 'Failed', bg: '#7a2230', fg: '#ffd0d6' }
                          : m.viewed
                            ? { t: 'Viewed', bg: 'transparent', fg: 'var(--muted)', bd: '1px solid var(--line)' }
                            : { t: 'Ready to view', bg: '#1f6d3a', fg: '#c8f7d8' };
                      return (
                        <>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: st.bg, color: st.fg, border: st.bd || 'none', letterSpacing: '.02em' }}>{st.t}</span>
                          {(m.status === 'rendering' || m.status === 'queued') && (
                            <button type="button" className="btn-ghost" style={{ fontSize: 12 }} onClick={() => syncMontage(m.id)}>Check status</button>
                          )}
                        </>
                      );
                    })()}
                    <button type="button" title={(m.status === 'rendering' || m.status === 'queued') ? 'Cancel render & remove' : 'Remove from list'}
                      onClick={() => removeClip(m)}
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = '#7a2230'; e.currentTarget.style.borderColor = '#7a2230'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--line)'; }}>
                      {'×'}
                    </button>
                  </span>
                </div>
                {/* Meta line: rez + tags + details + time-ago */}
                <div style={{ marginTop: 7, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--muted)' }}>
                  {m.watermarked
                    ? <span className="pill">low rez</span>
                    : <span className="pill" style={{ background: '#2f6bff', color: '#fff', borderColor: '#2f6bff', fontWeight: 700, letterSpacing: '.03em' }}>HIGH REZ</span>}
                  {m.starred && <span className="pill" style={{ color: '#f5b301', borderColor: '#f5b301' }}>★ starred</span>}
                  {m.includeCards === false && <span className="pill">no cards</span>}
                  {m.hidden && <span className="pill">hidden</span>}
                  <span>{m.style} · {m.photoSeconds ? `${m.photoSeconds}s/photo` : 'default pace'} · {m.photoCount} photos{m.photoSpec ? ` · #${m.photoSpec}` : ''}</span>
                  <span style={{ marginLeft: 'auto', textAlign: 'right', lineHeight: 1.35 }}>
                    {(() => {
                      const d = new Date(m.createdAt);
                      if (isNaN(d.getTime())) return '';
                      const s = Math.floor((Date.now() - d.getTime()) / 1000);
                      const rel = !(s >= 0) ? '' : s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : `${Math.floor(s / 86400)}d ago`;
                      const stamp = d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
                      return (
                        <>
                          <span style={{ display: 'block', fontVariantNumeric: 'tabular-nums', color: 'var(--fg, #222)' }}>{stamp}</span>
                          {rel ? <span style={{ display: 'block', fontSize: 11, opacity: 0.7 }}>{rel}</span> : null}
                        </>
                      );
                    })()}
                  </span>
                  <button type="button" className="linklike" style={{ fontSize: 12 }} onClick={() => hideMontage(m.id, !m.hidden)}>
                    {m.hidden ? 'Unhide' : 'Hide'}
                  </button>
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
                      <button type="button" className="linklike" onClick={() => { setShowVid((v) => ({ ...v, [m.id]: !v[m.id] })); if (!m.viewed) reviewMontage(m.id, { viewed: true }); }}>
                        {showVid[m.id] ? 'Hide Preview' : 'Show Preview'}
                      </button>
                      {' '}·{' '}
                      {m.watermarked ? (
                        <a href={m.downloadUrl || m.url} download>Export Low Rez</a>
                      ) : (
                        <button type="button" className="linklike" onClick={() => rerenderMontage(m.id, false)}>Export Low Rez</button>
                      )}
                      {' '}·{' '}
                      {!m.watermarked ? (
                        <a href={m.downloadUrl || m.url} download>Export Full Rez</a>
                      ) : (
                        <button type="button" className="linklike" onClick={() => rerenderMontage(m.id, true)}>Export Full Rez</button>
                      )}
                      {' '}·{' '}
                      <button type="button" className="linklike" title={m.starred ? 'Unstar' : 'Star as a keeper'} style={{ color: m.starred ? '#f5b301' : 'var(--muted)', fontWeight: 600 }} onClick={() => reviewMontage(m.id, { starred: !m.starred })}>{m.starred ? '★ Starred' : '☆ Star'}</button>
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
                                <div style={{ position: 'relative' }}>
                                  <img
                                    src={p.url}
                                    alt={p.filename}
                                    style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 8, border: adjMap[p.key] ? '2px solid var(--blue)' : '1px solid var(--line)' }}
                                  />
                                  {p.importSeq != null && <span title={`Import #${String(p.importSeq).padStart(3, '0')} — permanent reference number`} style={{ position: 'absolute', bottom: 5, left: 5, fontSize: 10, fontWeight: 900, letterSpacing: '.3px', background: '#f5a623', color: '#241700', padding: '1px 5px', borderRadius: 5, boxShadow: '0 1px 3px rgba(0,0,0,.5)' }}>{String(p.importSeq).padStart(3, '0')}</span>}
                                </div>
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

      {!openClientId && (
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
      )}

      <section className="panel">
        {(() => {
          const fc = openClientId ? clients.find((x) => x.id === openClientId) : null;
          if (!fc) return null;
          const c = fc;
          return (
            <div>
              <button type="button" className="btn-ghost" style={{ marginBottom: 12 }} onClick={() => { setOpenClientId(null); setActiveTool(null); }}>{'←'} Return to client list</button>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid var(--blue)', borderRadius: 12, background: 'rgba(47,107,255,0.06)', marginBottom: 14 }}>
                <h2 className="neon neon-blue" style={{ margin: 0 }}>{c.display_name}</h2>
                {c.archived && <span className="pill archived">archived</span>}
                <span style={{ color: 'var(--muted)', fontSize: 13 }}>{c.email}</span>
                <span style={{ color: 'var(--muted)', fontSize: 13 }}>{c.event_date}{c.event_type ? ` · ${c.event_type}` : ''}</span>
                <span style={{ flex: 1 }} />
                <CopyButton text={`${siteUrl}/p/${c.portal_token}`} label="Copy portal link" />
                <button className="btn-ghost" onClick={() => resetPassword(c.id)}>Reset password</button>
                <button className="btn-ghost" onClick={() => toggleArchive(c.id)}>{c.archived ? 'Unarchive' : 'Archive'}</button>
              </div>
              <div className="client-workspace">
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <button type="button" className={activeTool === 'montage' ? 'btn-primary' : 'btn-ghost'} onClick={() => chooseTool(c, 'montage')}>Montage Maker</button>
                  <button type="button" className={activeTool === 'cut' ? 'btn-primary' : 'btn-ghost'} onClick={() => chooseTool(c, 'cut')}>Send a cut</button>
                  <button type="button" className={activeTool === 'intake' ? 'btn-primary' : 'btn-ghost'} onClick={() => chooseTool(c, 'intake')}>Intake form</button>
                  <button type="button" className={activeTool === 'files' ? 'btn-primary' : 'btn-ghost'} onClick={() => chooseTool(c, 'files')}>Files</button>
                  <button type="button" className={activeTool === 'info' ? 'btn-primary' : 'btn-ghost'} onClick={() => chooseTool(c, 'info')}>Details</button>
                  <button type="button" className={activeTool === 'character' ? 'btn-primary' : 'btn-ghost'} onClick={() => chooseTool(c, 'character')}>Character builds</button>
                </div>
                {activeTool === 'montage' && renderMontageTool(c)}
                {activeTool === 'cut' && renderCutTool()}
                {activeTool === 'intake' && renderIntakeTool(c)}
                {activeTool === 'files' && renderFilesTool(c)}
                {activeTool === 'info' && <ClientInfoForm client={c} siteUrl={siteUrl} onSaved={loadClients} />}
                {activeTool === 'character' && (
                  <div style={{ padding: '8px 2px' }}>
                    <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 8px' }}>Pick a character for this client, then download their build sheet.</p>
                    <CharacterSheetPicker client={c} />
                  </div>
                )}
                {!activeTool && <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 10 }}>Pick a tool above to get started.</p>}
              </div>
            </div>
          );
        })()}
        {!openClientId && (<>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h2 className="neon neon-blue" style={{ margin: 0 }}>Clients</h2>
          {clients.length > 0 && (
            <button
              type="button"
              className="btn-ghost"
              title="Download every client's Details sheet as a CSV (opens in Excel/Sheets)"
              onClick={() => exportInfoCsv(clients, siteUrl, new Date().toISOString().slice(0, 10))}
            >
              ⬇ Export details (CSV)
            </button>
          )}
        </div>
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
                                  Montage Maker
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
                                <button
                                  type="button"
                                  className={activeTool === 'files' ? 'btn-primary' : 'btn-ghost'}
                                  onClick={() => chooseTool(c, 'files')}
                                >
                                  Files
                                </button>
                                <button
                                  type="button"
                                  className={activeTool === 'info' ? 'btn-primary' : 'btn-ghost'}
                                  onClick={() => chooseTool(c, 'info')}
                                >
                                  Details
                                </button>
                                <button
                                  type="button"
                                  className={activeTool === 'character' ? 'btn-primary' : 'btn-ghost'}
                                  onClick={() => chooseTool(c, 'character')}
                                >
                                  Character builds
                                </button>
                                <span style={{ flex: 1 }} />
                                <CopyButton text={`${siteUrl}/p/${c.portal_token}`} label="Copy portal link" />
                              </div>

                              {activeTool === 'montage' && renderMontageTool(c)}
                              {activeTool === 'cut' && renderCutTool()}
                              {activeTool === 'intake' && renderIntakeTool(c)}
                              {activeTool === 'files' && renderFilesTool(c)}
                              {activeTool === 'info' && <ClientInfoForm client={c} siteUrl={siteUrl} onSaved={loadClients} />}
                              {activeTool === 'character' && (
                                <div style={{ padding: '8px 2px' }}>
                                  <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 8px' }}>Pick a character for this client, then download their build sheet.</p>
                                  <CharacterSheetPicker client={c} />
                                </div>
                              )}
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
        </>)}
      </section>

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.88)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}>
          <button type="button" onClick={() => setLightbox(null)}
            style={{ position: 'absolute', top: 16, right: 20, width: 40, height: 40, borderRadius: 20, border: '1px solid rgba(255,255,255,0.4)',
              background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 22, lineHeight: 1, cursor: 'pointer' }} title="Close (Esc)">×</button>
          {lightbox.type === 'video' ? (
            <video src={lightbox.url} controls autoPlay onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '92vw', maxHeight: '88vh', borderRadius: 8, background: '#000' }} />
          ) : (
            <img src={lightbox.url} alt={lightbox.filename} onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '92vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: 8, cursor: 'default' }} />
          )}
          <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', color: '#fff',
            fontSize: 13, background: 'rgba(0,0,0,0.5)', padding: '5px 12px', borderRadius: 20, maxWidth: '80vw',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lightbox.filename}</div>
        </div>
      )}
    </main>
  );
}

// Groups a client's summary row with its (optional) expanded workspace row
// without adding DOM around them — <tbody> only allows <tr> children.
function FragmentRow({ children }) {
  return <>{children}</>;
}
