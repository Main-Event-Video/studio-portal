// Public sample-link page (/w/<slug>) — what a prospective client opens.
// Branded like the cut share page (/s/): Main Event Studio logo, title, the clip
// (play only, no download). If the link has a password, a password box comes
// first. All the real work (password check, open counting, the info@ email)
// happens in /api/watch/<slug>; this page only renders.
import Image from 'next/image';
import { createServiceClient } from '@/lib/supabaseAdmin';
import WatchClient from './WatchClient';

export const dynamic = 'force-dynamic';

async function lookupTitle(slug) {
  try {
    if (!slug || !/^[A-Za-z0-9]{4,32}$/.test(slug)) return null;
    const db = createServiceClient();
    const { data: link } = await db.from('studio_sample_links')
      .select('title, sample_id, disabled_at, archived_at').eq('slug', slug).maybeSingle();
    if (!link || link.disabled_at || link.archived_at) return null;
    if (link.title) return link.title;
    const { data: s } = await db.from('studio_samples').select('title').eq('id', link.sample_id).maybeSingle();
    return s?.title || null;
  } catch { return null; }
}

// Link-preview card (text / email / social) — the clip title over the branded image.
export async function generateMetadata({ params }) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://clients.maineventstudio.com';
  const title = (await lookupTitle(params?.slug)) || 'A Main Event Studio Presentation';
  const description = 'A Main Event Studio Presentation';
  const image = `${base}/og-share.png`;
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, siteName: 'Main Event Studio', type: 'website', images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

export default function SampleWatchPage({ params }) {
  return (
    <main className="wrap" style={{ maxWidth: 820, margin: '0 auto', padding: '28px 18px 48px' }}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <a href="https://www.maineventstudio.com" aria-label="Main Event Studio">
          <Image src="/logo.png" alt="Main Event Studio" width={220} height={148} priority />
        </a>
      </div>
      <WatchClient slug={params?.slug || ''} />
      <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginTop: 28 }}>
        <a href="https://www.maineventstudio.com" style={{ color: 'var(--blue, #3d7bff)', textDecoration: 'none' }}>
          maineventstudio.com
        </a>
      </p>
    </main>
  );
}
