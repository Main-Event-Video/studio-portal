// Creatomate client for Studio. API pattern copied from MEvid's working code
// (app/api/creatomate/compile + webhook): Bearer CREATOMATE_API_KEY,
// POST /v1/renders with { source, output_format, webhook_url, metadata },
// verify webhooks by re-fetching GET /v1/renders/{id} (Creatomate does not
// sign webhook calls — never trust the posted body).
const API = 'https://api.creatomate.com/v1';

function key() {
  const k = process.env.CREATOMATE_API_KEY;
  if (!k) throw new Error('CREATOMATE_API_KEY is not set');
  return k;
}

export async function createRender({ source, webhookUrl, metadata }) {
  const res = await fetch(`${API}/renders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source,
      output_format: 'mp4',
      webhook_url: webhookUrl,
      metadata,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg =
      err?.hint ||
      err?.message ||
      (Array.isArray(err?.errors) ? err.errors.join('; ') : null) ||
      `Creatomate HTTP ${res.status}`;
    throw new Error(msg);
  }
  const out = await res.json();
  return Array.isArray(out) ? out[0] : out; // { id, status, ... }
}

export async function getRender(id) {
  const res = await fetch(`${API}/renders/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${key()}` },
  });
  if (!res.ok) throw new Error(`Creatomate render lookup failed (${res.status})`);
  return res.json(); // { id, status, url, metadata, error_message? }
}
