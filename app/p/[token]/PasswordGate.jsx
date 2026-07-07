'use client';

import { useState } from 'react';
import Image from 'next/image';

export default function PasswordGate({ token, displayName }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/portal/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    if (res.ok) {
      window.location.reload();
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "That didn't work");
      setLoading(false);
    }
  }

  return (
    <main className="wrap" style={{ maxWidth: 440 }}>
      <div className="logo-header" style={{ marginTop: '8vh' }}>
        <Image src="/logo.png" alt="Main Event Studio" width={240} height={162} priority />
      </div>
      <form className="panel" onSubmit={submit}>
        <p className="eyebrow">Your private portal</p>
        <h2 className="neon neon-blue" style={{ marginTop: 4 }}>Welcome, {displayName}</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 0 }}>
          Enter your password to open your portal.
        </p>
        <label htmlFor="pw">Password</label>
        <input
          id="pw"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          required
        />
        {error && <p className="msg-error">{error}</p>}
        <button className="btn-primary" disabled={loading}>
          {loading ? 'Opening…' : 'Open my portal'}
        </button>
      </form>
    </main>
  );
}
