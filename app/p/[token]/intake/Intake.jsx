'use client';

import { useState } from 'react';

const VIBES = [
  'Elegant', 'Glamorous', 'Romantic', 'Luxury', 'Minimalist', 'Emotional',
  'Modern', 'FUN', 'Trendy', 'Hollywood', 'High Energy', 'Editorial',
];

function initialState(existing, prefill) {
  const e = existing || {};
  return {
    first_name: e.first_name ?? '',
    last_name: e.last_name ?? prefill.last_name ?? '',
    main_contact_name: e.main_contact_name ?? '',
    event_date: (e.event_date ?? prefill.event_date ?? '') || '',
    contact_number: e.contact_number ?? '',
    contact_number_type: e.contact_number_type ?? '',
    email: e.email ?? prefill.email ?? '',
    news_signup: !!e.news_signup,
    preferred_contact_method: e.preferred_contact_method ?? '',
    preferred_language: e.preferred_language ?? '',
    preferred_language_other: e.preferred_language_other ?? '',
    venue: e.venue ?? '',
    honoree_names: e.honoree_names ?? '',
    age_milestone: e.age_milestone ?? '',
    has_logo: typeof e.has_logo === 'boolean' ? e.has_logo : null,
    event_description: e.event_description ?? '',
    vibe: Array.isArray(e.vibe) ? e.vibe : [],
    color_palette: e.color_palette ?? '',
    inspiration_links: e.inspiration_links ?? '',
    songs: e.songs ?? '',
    must_include: e.must_include ?? '',
    avoid_content: e.avoid_content ?? '',
    hobbies: e.hobbies ?? '',
    favorite_media: e.favorite_media ?? '',
    favorite_quotes: e.favorite_quotes ?? '',
    anything_else: e.anything_else ?? '',
  };
}

export default function Intake({ token, welcomeName, existing, prefill }) {
  const [form, setForm] = useState(() => initialState(existing, prefill));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setVal = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  function toggleVibe(v) {
    setForm((f) => ({
      ...f,
      vibe: f.vibe.includes(v) ? f.vibe.filter((x) => x !== v) : [...f.vibe, v],
    }));
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch('/api/portal/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...form }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setSaved(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setError(j.error || 'Could not save your answers. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setSaving(false);
  }

  return (
    <main className="wrap" style={{ maxWidth: 640 }}>
      <a href={`/p/${token}`} className="backlink">← Back to your portal</a>

      <p className="eyebrow">First step</p>
      <h1 className="neon neon-red" style={{ fontSize: 26, margin: '4px 0 10px' }}>
        Your event questionnaire
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.7, marginTop: 0 }}>
        Thank you for choosing Main Event Studio, {welcomeName}. This is our first step in bringing
        your vision to life — the more we learn, the better we can tell your story. Don’t stress, this
        isn’t an exam. Fill out as much or as little as you like; you can come back and update it
        anytime. ✨
      </p>

      {saved && (
        <p className="msg-ok" style={{ fontSize: 15 }}>
          Saved — thank you! You can edit and re-save anytime. ✨
        </p>
      )}

      <form className="panel" onSubmit={submit} style={{ marginTop: 20 }}>
        <p className="section-head" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
          About you
        </p>

        <div className="grid-2">
          <div>
            <label htmlFor="first_name">First name <span className="req">*</span></label>
            <input id="first_name" value={form.first_name} onChange={set('first_name')} required />
          </div>
          <div>
            <label htmlFor="last_name">Last name <span className="req">*</span></label>
            <input id="last_name" value={form.last_name} onChange={set('last_name')} required />
          </div>
        </div>

        <label htmlFor="main_contact_name">Main contact’s name (if different)</label>
        <input id="main_contact_name" value={form.main_contact_name} onChange={set('main_contact_name')} />

        <div className="grid-2">
          <div>
            <label htmlFor="email">Email <span className="req">*</span></label>
            <input id="email" type="email" value={form.email} onChange={set('email')} required />
          </div>
          <div>
            <label htmlFor="event_date">Event date (or estimate) <span className="req">*</span></label>
            <input id="event_date" type="date" value={form.event_date} onChange={set('event_date')} required />
          </div>
        </div>

        <label htmlFor="contact_number">Best contact number <span className="req">*</span></label>
        <input id="contact_number" value={form.contact_number} onChange={set('contact_number')} required />

        <div className="field-group">
          <span className="field-label">Number type</span>
          <div className="choices">
            {['Home', 'Cell', 'Work'].map((t) => (
              <label className="choice" key={t}>
                <input
                  type="radio"
                  name="contact_number_type"
                  checked={form.contact_number_type === t}
                  onChange={() => setVal('contact_number_type', t)}
                />
                {t}
              </label>
            ))}
          </div>
        </div>

        <div className="field-group">
          <label htmlFor="preferred_contact_method">Preferred method of contact</label>
          <select
            id="preferred_contact_method"
            value={form.preferred_contact_method}
            onChange={set('preferred_contact_method')}
          >
            <option value="">Select an option</option>
            <option value="Phone">Phone</option>
            <option value="Text">Text</option>
            <option value="Email">Email</option>
          </select>
        </div>

        <div className="field-group">
          <span className="field-label">Preferred language</span>
          <div className="choices">
            {['English', 'Spanish', 'Other'].map((t) => (
              <label className="choice" key={t}>
                <input
                  type="radio"
                  name="preferred_language"
                  checked={form.preferred_language === t}
                  onChange={() => setVal('preferred_language', t)}
                />
                {t}
              </label>
            ))}
          </div>
          {form.preferred_language === 'Other' && (
            <input
              style={{ marginTop: 10 }}
              placeholder="Which language?"
              value={form.preferred_language_other}
              onChange={set('preferred_language_other')}
            />
          )}
        </div>

        <div className="field-group">
          <label className="choice" style={{ color: 'var(--text)' }}>
            <input
              type="checkbox"
              checked={form.news_signup}
              onChange={(e) => setVal('news_signup', e.target.checked)}
            />
            Sign me up for news and updates
          </label>
        </div>

        <p className="section-head">The event</p>

        <label htmlFor="venue">Event venue / location</label>
        <input id="venue" value={form.venue} onChange={set('venue')} />

        <label htmlFor="honoree_names">Celebrant / honoree name(s) <span className="req">*</span></label>
        <input id="honoree_names" value={form.honoree_names} onChange={set('honoree_names')} required />

        <label htmlFor="age_milestone">Age or milestone being celebrated</label>
        <input id="age_milestone" value={form.age_milestone} onChange={set('age_milestone')} />

        <div className="field-group">
          <span className="field-label">Do you already have a logo or monogram?</span>
          <div className="choices">
            <label className="choice">
              <input
                type="radio"
                name="has_logo"
                checked={form.has_logo === true}
                onChange={() => setVal('has_logo', true)}
              />
              Yes
            </label>
            <label className="choice">
              <input
                type="radio"
                name="has_logo"
                checked={form.has_logo === false}
                onChange={() => setVal('has_logo', false)}
              />
              No
            </label>
          </div>
        </div>

        <label htmlFor="event_description">Please describe your event in a few sentences.</label>
        <textarea
          id="event_description"
          value={form.event_description}
          onChange={set('event_description')}
          placeholder="Theme, atmosphere, energy, inspiration, etc."
        />

        <div className="field-group">
          <span className="field-label">Overall vibe</span>
          <p className="field-help" style={{ marginBottom: 8 }}>Choose as many as you want.</p>
          <div className="choices chips">
            {VIBES.map((v) => (
              <label className="choice" key={v}>
                <input
                  type="checkbox"
                  checked={form.vibe.includes(v)}
                  onChange={() => toggleVibe(v)}
                />
                {v}
              </label>
            ))}
          </div>
        </div>

        <label htmlFor="color_palette">Preferred color palette</label>
        <input id="color_palette" value={form.color_palette} onChange={set('color_palette')} />

        <label htmlFor="inspiration_links">Inspiration links</label>
        <textarea
          id="inspiration_links"
          value={form.inspiration_links}
          onChange={set('inspiration_links')}
          placeholder="Paste any links (Pinterest, videos, etc.) for inspiration here."
        />
        <p className="field-help">
          Have inspiration images? Send them through the “Upload your photos and videos” door on your
          portal, or paste links above.
        </p>

        <label htmlFor="songs">Specific songs you’d like to include</label>
        <textarea id="songs" value={form.songs} onChange={set('songs')} />

        <label htmlFor="must_include">Must-include moments, people, or memories</label>
        <textarea
          id="must_include"
          value={form.must_include}
          onChange={set('must_include')}
          placeholder="Be as specific as possible."
        />

        <label htmlFor="avoid_content">Anything you want us to avoid?</label>
        <textarea id="avoid_content" value={form.avoid_content} onChange={set('avoid_content')} />

        <p className="section-head">A little more color</p>

        <label htmlFor="hobbies">Interests / hobbies / sports of the celebrant</label>
        <textarea id="hobbies" value={form.hobbies} onChange={set('hobbies')} />

        <label htmlFor="favorite_media">Favorite TV shows, movies, or brands</label>
        <textarea id="favorite_media" value={form.favorite_media} onChange={set('favorite_media')} />

        <label htmlFor="favorite_quotes">Favorite quotes or sayings</label>
        <textarea id="favorite_quotes" value={form.favorite_quotes} onChange={set('favorite_quotes')} />

        <label htmlFor="anything_else">Is there anything else we should know?</label>
        <textarea id="anything_else" value={form.anything_else} onChange={set('anything_else')} />

        {error && <p className="msg-error">{error}</p>}
        <button className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : existing ? 'Save changes' : 'Submit questionnaire'}
        </button>
      </form>
    </main>
  );
}
