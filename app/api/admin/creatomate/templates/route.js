// GET /api/admin/creatomate/templates          → list every template in the
//   Creatomate project this app already renders with (metadata only).
// GET /api/admin/creatomate/templates?id=<id>   → that template INCLUDING its
//   `source` (the RenderScript JSON), so a look Josh designed in the Creatomate
//   editor can be ported into lib/montage.js as a montage style.
//
// READ-ONLY and admin-gated. It reuses the existing CREATOMATE_API_KEY from the
// server environment — the key is never sent to the browser, never changed, and
// the render integration is untouched. Templates are a v2 endpoint; renders stay
// on v1 (see lib/creatomate.js).
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { listTemplates, getTemplate } from '@/lib/creatomate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const id = new URL(request.url).searchParams.get('id');
  try {
    if (id) {
      const tpl = await getTemplate(id);
      return NextResponse.json({ template: tpl });
    }
    const list = await listTemplates();
    return NextResponse.json({
      templates: list.map((t) => ({
        id: t.id,
        name: t.name || '(untitled)',
        tags: Array.isArray(t.tags) ? t.tags : [],
        updated_at: t.updated_at || t.created_at || null,
      })),
    });
  } catch (e) {
    // Surface the real Creatomate message — a 401/403 here means the project key
    // can't see templates, which is a different problem from "no templates".
    return NextResponse.json({ error: e.message || 'Creatomate request failed' }, { status: 502 });
  }
}
