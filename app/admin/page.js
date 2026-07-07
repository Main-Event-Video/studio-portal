'use client';

import { useEffect, useState, useCallback } from 'react';
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

  useEffect(() => {
    if (session) loadClients();
  }, [session, loadClients]);

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

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';

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
