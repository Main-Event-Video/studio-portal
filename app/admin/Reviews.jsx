'use client';

// REVIEWS (Josh + Robyn signed off 11/17) — folded under the "Reviews" pill
// beside Sample links. Waiting reviews first: Approve & post / Edit / Hide.
// On-site reviews: Take down / Edit. Hidden ones can be brought back.
// Nothing is ever deleted from here. "＋ Add a review by hand" is for reviews
// that came in by text or email. "Preview the form" opens the client form
// with sample details (nothing is saved).

import { useCallback, useEffect, useState } from 'react';
import { displayName } from '@/lib/reviewName';

const BLUE = '#3d7bff', OK = '#37d99a', GOLD = '#ffc93d', RED = '#ff2e4c';
const btn = (c = 'var(--line)', fg = 'var(--text)') => ({ background: 'transparent', border: `1px solid ${c}`, color: fg, borderRadius: 8, padding: '6px 11px', fontSize: 12, fontWeight: 600, cursor: 'pointer' });
const solid = { background: BLUE, color: '#fff', border: 0, borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const kicker = { fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--muted)', margin: '20px 0 8px' };
const MODES = [['full', 'Full name'], ['first', 'First name only'], ['initials', 'Initials only']];
const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
const fmt = (iso) => { try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return ''; } };
const TAG = { waiting: ['WAITING', GOLD], posted: ['ON SITE', OK], hidden: ['HIDDEN', 'var(--muted)'] };

function Editor({ init, onSave, onCancel, busy, addMode }) {
  const [f, setF] = useState(init);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(f); }} style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" onClick={() => setF({ ...f, stars: i })}
            style={{ background: 'none', border: 0, fontSize: 26, cursor: 'pointer', padding: 0, color: i <= f.stars ? GOLD : '#3a3248' }}>★</button>
        ))}
      </div>
      <textarea value={f.body} onChange={set('body')} rows={4} placeholder="Review text" style={{ width: '100%', boxSizing: 'border-box' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginTop: 8 }}>
        <input value={f.name_given} onChange={set('name_given')} placeholder="Their name" />
        <input value={f.event_label || ''} onChange={set('event_label')} placeholder="Event (e.g. Bar Mitzvah)" />
        <select value={f.name_display} onChange={set('name_display')}>
          {MODES.map(([v, l]) => <option key={v} value={v}>{l} — {displayName(f.name_given, v) || '…'}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        {addMode ? (<>
          <button type="button" disabled={busy} style={{ ...solid, background: OK, color: '#06150f' }} onClick={() => onSave({ ...f, post: true })}>Add &amp; post</button>
          <button type="submit" disabled={busy} style={btn(BLUE, '#cfe0ff')}>Add as waiting</button>
        </>) : <button type="submit" disabled={busy} style={solid}>Save</button>}
        <button type="button" style={btn()} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function Reviews({ api, onCount }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  const load = useCallback(async () => {
    try {
      const j = await api('/api/admin/reviews');
      setRows(j.reviews || []); setErr('');
      onCount?.(j.waiting || 0);
    } catch (e) { setErr(e.message); }
  }, [api, onCount]);
  useEffect(() => { load(); }, [load]);

  async function act(body) {
    setBusy(true); setErr('');
    try { await api('/api/admin/reviews', { method: 'POST', body: JSON.stringify(body) }); setEditId(null); setAdding(false); await load(); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  function approve(r) {
    if (!r.ok_to_post && !window.confirm(`${r.name_given} did NOT tick "OK to post on our website". Post it anyway?`)) return;
    act({ action: 'approve', id: r.id });
  }

  if (!rows) return <div style={{ marginTop: 14 }}>{err ? <p className="msg-error">{err}</p> : <p style={{ color: 'var(--muted)' }}>Loading…</p>}</div>;

  const waiting = rows.filter((r) => r.status === 'waiting');
  const posted = rows.filter((r) => r.status === 'posted');
  const hidden = rows.filter((r) => r.status === 'hidden');

  const card = (r) => {
    const [tag, color] = TAG[r.status];
    const shown = displayName(r.name_given, r.name_display);
    return (
      <div key={r.id} style={{ border: `1px solid ${r.status === 'waiting' ? GOLD : 'var(--line)'}`, borderRadius: 12, padding: 14, marginTop: 10, background: 'var(--panel2, #150f20)' }}>
        <div style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span style={{ color: GOLD, letterSpacing: 1 }}>{stars(r.stars)}</span>
          <b style={{ color: 'var(--text)' }}>{shown}</b>
          {r.name_display !== 'full' && <span>({r.name_given})</span>}
          {r.event_label && <span>· {r.event_label}</span>}
          {r.client_name && <span>· client: {r.client_name}</span>}
          {r.source === 'manual' && <span>· added by hand</span>}
          <span>· {fmt(r.created_at)}</span>
          <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '1px 8px', border: `1px solid ${color}`, color }}>{tag}</span>
          {!r.ok_to_post && <span style={{ fontSize: 11, fontWeight: 700, color: RED }}>NOT OK TO POST</span>}
        </div>
        {editId === r.id ? (
          <Editor busy={busy} init={{ stars: r.stars, body: r.body, name_given: r.name_given, name_display: r.name_display, event_label: r.event_label }}
            onCancel={() => setEditId(null)} onSave={(f) => act({ action: 'edit', id: r.id, ...f })} />
        ) : (<>
          <p style={{ margin: '8px 0 0', fontSize: 15, whiteSpace: 'pre-wrap' }}>&ldquo;{r.body}&rdquo;</p>
          {r.original_body && r.original_body !== r.body && (
            <details style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}><summary style={{ cursor: 'pointer' }}>What they originally wrote</summary><p style={{ whiteSpace: 'pre-wrap' }}>{r.original_body}</p></details>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {r.status === 'waiting' && <button type="button" disabled={busy} style={btn(OK, OK)} onClick={() => approve(r)}>✓ Approve &amp; post</button>}
            {r.status === 'hidden' && <button type="button" disabled={busy} style={btn(BLUE, '#cfe0ff')} onClick={() => act({ action: 'restore', id: r.id })}>Bring back</button>}
            <button type="button" disabled={busy} style={btn(BLUE, '#cfe0ff')} onClick={() => setEditId(r.id)}>Edit</button>
            {r.status === 'waiting' && <button type="button" disabled={busy} style={btn()} onClick={() => act({ action: 'hide', id: r.id })}>Hide</button>}
            {r.status === 'posted' && <button type="button" disabled={busy} style={btn()} onClick={() => act({ action: 'hide', id: r.id })}>Take down</button>}
          </div>
        </>)}
      </div>
    );
  };

  return (
    <div style={{ marginTop: 14 }}>
      <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 10px' }}>
        Reviews from clients wait here until you approve them. Only approved reviews show on maineventstudio.com/testimonials. info@ gets an email for each new one.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" style={solid} onClick={() => { setAdding((v) => !v); setEditId(null); }}>＋ Add a review by hand</button>
        <a href="/review?preview=1" target="_blank" rel="noopener" style={{ ...btn(BLUE, '#cfe0ff'), textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Preview the form ↗</a>
      </div>
      {adding && (
        <div style={{ border: `1px solid ${BLUE}`, borderRadius: 12, padding: 14, marginTop: 10 }}>
          <b>Add a review by hand</b>
          <Editor addMode busy={busy} init={{ stars: 5, body: '', name_given: '', name_display: 'first', event_label: '' }}
            onCancel={() => setAdding(false)} onSave={(f) => act({ action: 'add', ...f })} />
        </div>
      )}
      {err && <p className="msg-error">{err}</p>}

      <p style={kicker}>Waiting ({waiting.length})</p>
      {waiting.length ? waiting.map(card) : <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>No reviews waiting.</p>}

      <p style={kicker}>On the website ({posted.length})</p>
      {posted.length ? posted.map(card) : <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>None posted yet.</p>}

      {hidden.length > 0 && (<>
        <button type="button" style={{ ...btn(), marginTop: 18 }} onClick={() => setShowHidden((v) => !v)}>
          {showHidden ? '▾' : '▸'} Hidden ({hidden.length})
        </button>
        {showHidden && hidden.map(card)}
      </>)}
    </div>
  );
}
