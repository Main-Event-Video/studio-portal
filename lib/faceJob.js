// Kick the face-detection GitHub workflow off on demand, so a photo added
// today has its eyes on record before the next render — instead of waiting
// for the nightly run. Josh 9/14, on a photo added through Revise: "the zoom
// is not moving towards the eyes."
//
// The workflow (.github/workflows/face-detect.yml) already accepts
// workflow_dispatch with a client_id, and runs under a concurrency group, so
// GitHub itself collapses a burst of requests into "one running, one queued".
// This side only needs to avoid hammering the API during an upload burst: one
// dispatch per client per minute per server instance is plenty.
//
// Needs GITHUB_ACTIONS_TOKEN in the environment — a fine-grained token with
// Actions: read & write on the studio-portal repo. Without it this is a no-op
// (the nightly run still covers everything), and it never throws: nothing
// about an upload or a render may fail because GitHub was unreachable.
const REPO = process.env.GITHUB_REPO || 'Main-Event-Video/studio-portal';
const WORKFLOW = 'face-detect.yml';
const REF = process.env.GITHUB_REF_BRANCH || 'main';
const recent = new Map(); // clientId -> last dispatch ms

export async function requestFaceDetection(clientId, { limit = 400 } = {}) {
  const token = process.env.GITHUB_ACTIONS_TOKEN;
  if (!token || !clientId) return { ok: false, skipped: 'no token' };
  const now = Date.now();
  if ((now - (recent.get(clientId) || 0)) < 60 * 1000) return { ok: true, skipped: 'debounced' };
  recent.set(clientId, now);
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: REF, inputs: { client_id: String(clientId), limit: String(limit) } }),
    });
    if (res.status === 204) return { ok: true };
    const text = await res.text().catch(() => '');
    console.error('Face detection dispatch failed', res.status, text.slice(0, 200));
    return { ok: false, status: res.status };
  } catch (e) {
    console.error('Face detection dispatch error', e?.message || e);
    return { ok: false };
  }
}
