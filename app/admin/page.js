'use client';

import { useEffect, useState, useCallback, useRef, Fragment } from 'react';
import Image from 'next/image';
import { createClient } from '@supabase/supabase-js';
import { parsePhotoSpec } from '@/lib/montage';

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
    { value: 'polaroid', label: 'Polaroid Drop — square print, thick white bottom' },
    { value: 'photo_drop', label: 'Photo Drop — whole photo, even white border', preview: 'polaroid' },
    { value: 'collage_classic', label: 'Collage Wall Classic — uniform photo grid, camera glides across' },
    { value: 'collage_featured', label: 'Collage Wall Featured — big hero photos + smaller tiles' },
    { value: 'gallery150', label: 'Gallery 150 — scattered tilted prints, camera flies over' },
    { value: 'epic_vintage', label: 'Epic Vintage — one hero print, blurred bokeh, heavy light leaks' },
    { value: 'story_builder', label: 'Story Builder — one at a time, builds a story wall (green screen)' },
    { value: 'trendy', label: 'Trendy Photo Wall — 3D angled grid of matte prints' },
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
  const newSegment = () => ({ key: `seg${segKey.current++}`, photos: '', album: '', style: 'hollywood', speed: '', paceMode: 'perphoto', tMin: '', tSec: '', tFrames: '', cards: true, green: true, bgMode: 'default', bgUrl: '', bgTint: '#102040', bgOpacity: '50' });
  const [segments, setSegments] = useState([]);          // seeded when a client's montage tool opens
  const [projPhotos, setProjPhotos] = useState([]);      // [{ index, key, filename, url }]
  const [projPhotosClientId, setProjPhotosClientId] = useState(null);
  const [projPhotosLoading, setProjPhotosLoading] = useState(false);
  const [showRef, setShowRef] = useState(false);         // numbered reference strip
  const [genBusy, setGenBusy] = useState(false);
  const [showHidden, setShowHidden] = useState(false); // reveal hidden renders
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
  const [pendingHide, setPendingHide] = useState(null); // album name awaiting hide-confirm
  const lastPickRef = useRef(null);

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
  async function downloadSelectedZip(clientId) {
    const ids = [...selIds];
    if (!ids.length) return;
    setZipBusy(true);
    try {
      const res = await fetch('/api/admin/media/download-zip', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, ids }),
      });
      if (!res.ok) { let d = ''; try { d = (await res.json()).error; } catch {} throw new Error(d || `Download failed (${res.status})`); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `photos_${ids.length}.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) { setMErr(true); setMMsg(err.message); }
    setZipBusy(false);
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

  function editPhoto(clientId, key, patch) {
    setPhotoEdits((prev) => {
      const cur = prev.photos[key] || { anchor: 'top', fit: 'fit', size: 100, removed: false, colorCorrect: false, mode: 'color', contrast: 100, saturation: 100, posX: null, posY: null };
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
              : (s.bgMode === 'image' && s.bgUrl?.trim())
                ? { url: s.bgUrl.trim(), tint: s.bgTint || null, opacity: `${parseInt(s.bgOpacity || '50', 10)}%` }
                : null,
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
                    <span className="pill" style={{ fontSize: 11 }}>video</span>
                  ) : (
                    <img src={f.url} alt={f.filename} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)' }} />
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
                  <a href={f.url} download={f.filename} className="linklike">Download</a>
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
    const rows = allRows.filter((m) => showHidden || !m.hidden);
    return (
      <div className="tool-window" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[[1, 'Edit photos'], [2, 'Choose style'], [3, 'Finish & generate']].map((st) => (
            <button key={st[0]} type="button" onClick={() => setMontageStep(st[0])}
              style={{ flex: 1, textAlign: 'left', border: montageStep === st[0] ? '1px solid #2f6bff' : '1px solid var(--line)', background: montageStep === st[0] ? 'rgba(47,107,255,0.10)' : 'transparent', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', color: 'var(--text)' }}>
              <span style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: '50%', alignItems: 'center', justifyContent: 'center', fontSize: 12, marginRight: 8, background: montageStep === st[0] ? '#2f6bff' : 'var(--line)', color: montageStep === st[0] ? '#fff' : 'var(--muted)' }}>{st[0]}</span>
              <strong style={{ fontSize: 13 }}>{st[1]}</strong>
            </button>
          ))}
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
            return (
              <div key={`t:${p.key || p.index}`} onDoubleClick={() => setSelKey(isSel ? null : p.key)} title="Double-click to edit"
                style={{ border: isSel ? '2px solid #d8b56b' : '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', opacity: pe.removed ? 0.4 : 1, position: 'relative' }}>
                <div style={{ aspectRatio: '16 / 9', background: '#000', overflow: 'hidden' }}>
                  <img src={p.url} alt={p.filename} draggable={false} style={{ width: '100%', height: '100%', ...styleFor(pe) }} />
                </div>
                <span style={{ position: 'absolute', top: 4, left: 4, fontSize: 10, background: 'rgba(0,0,0,.65)', color: '#fff', padding: '1px 6px', borderRadius: 5 }}>{p.index}</span>
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
                  <span style={{ color: 'var(--muted)', fontWeight: 400 }}>— double-click a photo to edit it; edits apply to every style</span></strong>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{Object.values(photoEdits.photos).filter((x) => x && x.removed).length} removed</span>
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
                      <div style={gridStyle}>{renderCells(g.photos)}</div>
                    </section>
                  );
                })
              ) : (
                <div style={gridStyle}>{renderCells(groups[0] ? groups[0].photos : [])}</div>
              )}
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                Double-click a photo to open its editor right below it; use ‹ › to move between photos. Photos are grouped into their albums. Default is Fit (nothing cropped); Fill crops — then drag the big photo to position it. B&amp;W / Sepia and Auto-color render in the montage; contrast &amp; saturation preview in the editor (render tuning pending a test render). Removed photos are skipped.
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
          </div>
        )}

        {montageStep === 3 && (<>
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
              <div key={s.key} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <strong style={{ fontSize: 13 }}>Segment {idx + 1}</strong>
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
                  <select value={s.bgMode || 'default'} onChange={(e) => updateSegment(s.key, { bgMode: e.target.value })}>
                    <option value="default">Style default</option>
                    <option value="green">Green screen (keyable)</option>
                    <option value="image">Image…</option>
                  </select>
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
                    Default keeps the style’s own backdrop. Green screen is keyable; Image sits behind, tinted.
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
        {mMsg && <p className={mErr ? 'msg-error' : 'msg-ok'} style={{ fontSize: 14 }}>{mMsg}</p>}
        </>)}

        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 className="folder-head" style={{ margin: 0 }}>Renders</h3>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
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
              <div key={m.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
                <div className="upload-row" style={{ border: 'none', padding: 0 }}>
                  <span>
                    <strong>{m.title}</strong>
                    <span style={{ color: 'var(--muted)' }}>
                      {' '}· {m.style} · {m.watermarked ? 'Low rez' : 'High rez'} · {m.photoSeconds ? `${m.photoSeconds}s/photo` : 'default pace'} · {m.photoCount} photos
                      {m.photoSpec ? ` · #${m.photoSpec}` : ''}
                    </span>
                    <span className="pill" style={{ marginLeft: 8 }}>{m.watermarked ? 'low rez' : 'high rez'}</span>
                    {m.rating === 'up' && <span className="pill" style={{ marginLeft: 8, color: 'var(--ok)' }}>👍</span>}
                    {m.rating === 'down' && <span className="pill" style={{ marginLeft: 8, color: 'var(--red)' }}>👎</span>}
                    {m.includeCards === false && <span className="pill" style={{ marginLeft: 8 }}>no cards</span>}
                  </span>
                  <span
                    style={{
                      color:
                        m.status === 'failed' ? 'var(--red)' : (m.status === 'ready' && !m.viewed) ? 'var(--ok)' : 'var(--muted)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {m.status === 'rendering' ? 'Rendering…' : m.status === 'ready' ? (m.viewed ? 'Viewed' : 'Ready to view') : m.status}
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
                <div style={{ marginTop: 4 }}>
                  <button type="button" className="linklike" style={{ fontSize: 12 }} onClick={() => hideMontage(m.id, !m.hidden)}>
                    {m.hidden ? 'Unhide' : 'Hide'}
                  </button>
                  {m.hidden && <span className="pill" style={{ marginLeft: 8 }}>hidden</span>}
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
                      <button type="button" className="linklike" title="Thumbs up" style={{ color: m.rating === 'up' ? 'var(--ok)' : 'var(--muted)', fontSize: 15 }} onClick={() => reviewMontage(m.id, { rating: m.rating === 'up' ? null : 'up' })}>👍</button>
                      {' '}
                      <button type="button" className="linklike" title="Thumbs down" style={{ color: m.rating === 'down' ? 'var(--red)' : 'var(--muted)', fontSize: 15 }} onClick={() => reviewMontage(m.id, { rating: m.rating === 'down' ? null : 'down' })}>👎</button>
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
      </section>
    </main>
  );
}

// Groups a client's summary row with its (optional) expanded workspace row
// without adding DOM around them — <tbody> only allows <tr> children.
function FragmentRow({ children }) {
  return <>{children}</>;
}
