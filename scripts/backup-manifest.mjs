// =============================================================
// Exports the studio_media index to manifest.json so the R2/B2 backup carries
// its OWN catalog (id -> r2_key -> client -> filename). If the Supabase DB is
// ever lost, this maps the opaque object keys back to clients/files.
//
// No-ops (exits 0) if SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set, so
// the media backup still succeeds before you wire these secrets up.
// =============================================================
import { writeFileSync } from 'fs';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set - skipping manifest.');
  process.exit(0);
}

const headers = { apikey: key, authorization: `Bearer ${key}` };
const cols = 'id,client_id,r2_key,filename,kind,folder_path,sort_number,created_at';
const page = 1000;
let from = 0;
const rows = [];

for (;;) {
  const res = await fetch(
    `${url}/rest/v1/studio_media?select=${cols}&order=created_at.asc`,
    { headers: { ...headers, Range: `${from}-${from + page - 1}` } },
  );
  if (!res.ok) {
    console.error('manifest fetch failed', res.status, await res.text());
    process.exit(1);
  }
  const batch = await res.json();
  rows.push(...batch);
  if (batch.length < page) break;
  from += page;
}

writeFileSync(
  'manifest.json',
  JSON.stringify({ generated_at: new Date().toISOString(), count: rows.length, rows }),
);
console.log('manifest rows:', rows.length);
