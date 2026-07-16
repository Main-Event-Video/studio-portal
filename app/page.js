'use client';

import { useState } from 'react';
import Image from 'next/image';

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/portal/login-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.token) {
        window.location.href = `/p/${j.token}`;
      } else {
        setError(j.error || "That didn't work. Try again.");
        setLoading(false);
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <main className="wrap" style={{ maxWidth: 440 }}>
      <div className="logo-header" style={{ marginTop: '8vh' }}>
        <Image src="/logo.png" alt="Main Event Studio" width={240} height={162} priority />
        <p className="eyebrow">Client Portal</p>
      </div>
      <form className="panel" onSubmit={submit}>
        <h2 className="neon neon-blue">Sign in</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 0 }}>
          Use the email and password Main Event Studio gave you.
        </p>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          required
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="msg-error">{error}</p>}
        <button className="btn-primary" disabled={loading}>
          {loading ? 'Signing in…' : 'Open my portal'}
        </button>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 18, lineHeight: 1.6 }}>
          Have a private link from us? You can use that instead — it takes you
          straight to your portal. Forgot your password? Reply to any email from
          Main Event Studio and we’ll reset it.
        </p>
      </form>
    </main>
  );
}
