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

// renderScale (0–1) shrinks the OUTPUT resolution to save Creatomate credits —
// cost is ~proportional to width×height, so a 0.5 scale renders at 1/4 the
// credits. We use it for watermarked DRAFTS (checking motion/framing), and leave
// finals at full resolution (renderScale omitted → 1).
export async function createRender({ source, webhookUrl, metadata, renderScale = null }) {
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
      ...(renderScale && renderScale > 0 && renderScale < 1 ? { render_scale: renderScale } : {}),
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

// BEST-EFFORT cancel. Creatomate has no *documented* cancel/stop-render endpoint,
// so we try DELETE /v1/renders/{id} and tolerate any failure. The portal-side
// cancel (marking the montage failed so it leaves the rendering state and polling
// stops) always works; this just also asks Creatomate to drop it if it can. Never
// throws — returns a small status object for the caller to log.
export async function cancelRender(id) {
  try {
    const res = await fetch(`${API}/renders/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${key()}` },
    });
    return { attempted: true, ok: res.ok, status: res.status };
  } catch (e) {
    return { attempted: true, ok: false, error: e.message };
  }
}
