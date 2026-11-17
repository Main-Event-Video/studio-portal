// How a reviewer's name shows on the website (Reviews, Josh 11/17).
// Shared by the review form (live preview), the admin panel and the public feed.
//   full     → "Julie Taylor"
//   first    → "Julie"
//   initials → "J.T."
export function displayName(name, mode) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  if (mode === 'first') return words[0];
  if (mode === 'initials') return words.map((w) => w[0].toUpperCase() + '.').join('');
  return words.join(' ');
}

// The event phrase used in the email and form: "your Bar Mitzvah", or
// "your celebration" when the client has no event type.
export function eventPhrase(eventType) {
  const t = String(eventType || '').trim();
  return t ? `your ${t}` : 'your celebration';
}

// First name for "Hi Julie," — the welcome name's first word, unless it is a
// family name like "The Taylors" / "Noah & family", in which case the whole
// welcome name is used as-is.
export function greetingName(welcome) {
  const w = String(welcome || '').trim();
  if (!w) return '';
  if (/^the\s/i.test(w) || /&|\band\b|family/i.test(w)) return w;
  return w.split(/\s+/)[0];
}

export const STAR_LABELS = ['', 'Not great', 'Could be better', 'Good', 'Great', 'Amazing!'];
