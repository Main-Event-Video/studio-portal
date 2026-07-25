// =============================================================
// MAIN EVENT STUDIO — AI character write-up (Anthropic Claude vision)
// Looks at a few of the client's reference shots and returns a grounded
// appearance profile + a paste-ready AI image prompt, for building a consistent
// AI character. Best-effort: returns null if no key or on any failure, so the
// build sheet still renders without it.
//
// Env:
//   ANTHROPIC_API_KEY  (required to enable) — add in Vercel.
//   ANTHROPIC_MODEL    (optional) — override the vision model id.
// =============================================================
import sharp from 'sharp';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
// Current vision-capable default (Claude 3.5 Sonnet was retired 2025-10-28, which
// silently nulled the write-up). Override with ANTHROPIC_MODEL for a newer one.
const DEFAULT_MODEL = 'claude-sonnet-5';

// Which shots to send (by slug), most informative first. We cap how many go to
// the model to keep latency + cost sane.
const PREFERRED = ['face-front-neutral', 'face-34-left', 'face-profile-left', 'body-front-apose', 'face-front-smile'];
const MAX_IMAGES = 5;

const SYSTEM = `You help a professional video studio build a CONSISTENT AI character portrait of a consenting subject from their own reference photos. Describe ONLY what is visibly apparent in the photos, strictly for recreating a consistent character in AI image tools.`;

const INSTRUCTION = `Look at these reference photos of one person and return STRICT JSON (no text outside the JSON) with exactly this shape:
{
  "attributes": {
    "apparent_age_range": "",
    "hair": "",
    "eyes": "",
    "complexion": "",
    "face_shape": "",
    "facial_features": "",
    "build": "",
    "wardrobe_style": ""
  },
  "summary": "",
  "ai_prompt": ""
}
Field guidance:
- hair: color, length, texture, and how it's styled.
- eyes: color if visible.
- complexion: skin tone for COLOR-MATCHING only, described neutrally (e.g. "fair with warm undertones", "deep brown"). Do NOT state or imply ethnicity, race, nationality, or heritage.
- face_shape / facial_features: shape, brows, nose, jaw, facial hair, glasses, freckles, dimples, etc.
- build: general body type and height impression.
- wardrobe_style: the clothing worn in the shots.
- summary: 2-3 plain sentences describing the person's appearance.
- ai_prompt: ONE paste-ready paragraph describing this character's APPEARANCE for an AI image generator, optimized for consistent-character results.
Rules: Describe only what is visible. Do NOT identify or name the person. Do NOT infer ethnicity, race, nationality, religion, politics, health, or any sensitive attribute. If a field can't be determined, use "". Keep it respectful and appropriate for all ages. Output JSON only.`;

async function toJpegBase64(buffer) {
  const out = await sharp(buffer).rotate().resize(640, 640, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  return out.toString('base64');
}

// shots: [{ buffer, slug, label }]. Returns the profile object or null.
export async function generateCharacterProfile(shots) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !Array.isArray(shots) || shots.length === 0) return null;

  // Pick a representative subset.
  const bySlug = new Map(shots.map((s) => [s.slug, s]));
  const chosen = [];
  for (const slug of PREFERRED) { if (bySlug.has(slug)) chosen.push(bySlug.get(slug)); }
  for (const s of shots) { if (chosen.length >= MAX_IMAGES) break; if (!chosen.includes(s)) chosen.push(s); }
  const picked = chosen.slice(0, MAX_IMAGES);

  let content;
  try {
    const imgs = await Promise.all(picked.map(async (s) => ({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: await toJpegBase64(s.buffer) },
    })));
    content = [{ type: 'text', text: INSTRUCTION }, ...imgs];
  } catch {
    return null;
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: 1024,
        system: SYSTEM,
        messages: [{ role: 'user', content }],
      }),
    });
    if (!res.ok) {
      console.error('character profile: API', res.status, (await res.text().catch(() => '')).slice(0, 200));
      return null;
    }
    const data = await res.json();
    const text = (data?.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    const parsed = extractJson(text);
    if (!parsed || !parsed.attributes) return null;
    return parsed;
  } catch (e) {
    console.error('character profile failed:', e?.message);
    return null;
  }
}

function extractJson(text) {
  if (!text) return null;
  const a = text.indexOf('{');
  const b = text.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(text.slice(a, b + 1)); } catch { return null; }
}

// Flatten a profile into printable rows for the sheet + email.
export function profileRows(profile) {
  if (!profile?.attributes) return [];
  const A = profile.attributes;
  const map = [
    ['Apparent age', A.apparent_age_range],
    ['Hair', A.hair],
    ['Eyes', A.eyes],
    ['Complexion', A.complexion],
    ['Face shape', A.face_shape],
    ['Features', A.facial_features],
    ['Build', A.build],
    ['Wardrobe', A.wardrobe_style],
  ];
  return map.filter(([, v]) => v && String(v).trim());
}
