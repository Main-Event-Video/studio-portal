// Public, branded landing page for a SET of finals (e.g. multiple aspect ratios)
// delivered together. No login. The HMAC token resolves to one set_id; we list
// every final in that set, each with its own player + Download. Filenames are the
// labels, kept exactly as delivered.
import Image from 'next/image';
import { headers } from 'next/headers';
import { verifyShareToken } from '@/lib/shareLink';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { getViewUrl, getDownloadUrl } from '@/lib/r2';
import { sendCutOpenedNotice } from '@/lib/email';

export const dynamic = 'force-dynamic';

const BOT_RE = /(bot|crawl|spider|slurp|facebookexternalhit|slackbot|twitterbot|whatsapp|telegrambot|discordbot|linkedinbot|embedly|redditbot|applebot|bingbot|googlebot|duckduckbot|yandexbot|mediapartners|proofpoint|mimecast|barracuda|skypeuripreview|preview|curl|wget|python|axios|node-fetch|go-http|headless|phantom|puppeteer|pingdom|uptimerobot|monitor|scanner)/i;

export async function generateMetadata() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://clients.maineventstudio.com';
  const title = 'A Main Event Studio Presentation';
  const image = `${base}/og-share.png`;
  return {
    title,
    description: title,
    openGraph: { title, description: title, siteName: 'Main Event Studio', type: 'website', images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, description: title, images: [image] },
  };
}

export default async function SetPage({ params }) {
  const setId = verifyShareToken(params?.sid);
  const db = createServiceClient();

  let items = [];
  let client = null;
  if (setId) {
    const { data } = await db
      .from('studio_media')
      .select('id, filename, r2_key, kind, content_type, client_id')
      .eq('set_id', setId)
      .eq('kind', 'final')
      .order('created_at', { ascending: true });
    items = (data || []).filter((m) => m.r2_key);
    if (items.length) {
      const { data: c } = await db.from('studio_clients').select('display_name').eq('id', items[0].client_id).single();
      client = c;
    }
  }

  // First-open notification (best-effort, bot-filtered, once per set).
  if (items.length) {
    try {
      const ua = headers().get('user-agent') || '';
      if (ua && !BOT_RE.test(ua)) {
        const ids = items.map((m) => m.id);
        const { data: alreadyOpened } = await db.from('studio_media').select('id').in('id', ids).not('opened_at', 'is', null).limit(1);
        if (!Array.isArray(alreadyOpened) || !alreadyOpened.length) {
          await db.from('studio_media').update({ opened_at: new Date().toISOString() }).in('id', ids).is('opened_at', null);
          await sendCutOpenedNotice({ filename: `${items.length} final video${items.length === 1 ? '' : 's'}`, kind: 'final', clientName: client?.display_name || '' });
        }
      }
    } catch { /* never block playback */ }
  }

  const files = await Promise.all(items.map(async (m) => ({
    id: m.id,
    filename: m.filename,
    isVideo: (m.content_type || '').startsWith('video'),
    viewUrl: await getViewUrl(m.r2_key, 43200),
    downloadUrl: await getDownloadUrl(m.r2_key, m.filename || 'main-event-studio', 43200),
  })));

  return (
    <main className="wrap" style={{ maxWidth: 760, margin: '0 auto', padding: '28px 18px 48px' }}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <Image src="/logo.png" alt="Main Event Studio" width={220} height={148} priority />
      </div>

      {!files.length ? (
        <div style={{ textAlign: 'center' }}>
          <h1 className="neon neon-blue" style={{ fontSize: 24, margin: '6px 0 8px' }}>Link not available</h1>
          <p style={{ color: 'var(--muted)' }}>This link is invalid or the files are no longer available.</p>
        </div>
      ) : (
        <>
          <p className="eyebrow" style={{ textAlign: 'center' }}>Shared with you</p>
          <h1 className="neon neon-blue" style={{ textAlign: 'center', fontSize: 22, margin: '4px 0 20px' }}>
            Your final video{files.length === 1 ? '' : 's'}
          </h1>

          {files.map((f) => (
            <div key={f.id} style={{ marginBottom: 28 }}>
              <p style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600, margin: '0 0 8px', wordBreak: 'break-word' }}>{f.filename}</p>
              {f.isVideo ? (
                <video src={f.viewUrl} controls playsInline style={{ width: '100%', maxHeight: '70vh', borderRadius: 12, background: '#000', display: 'block' }} />
              ) : (
                <img src={f.viewUrl} alt={f.filename} style={{ width: '100%', borderRadius: 12, display: 'block' }} />
              )}
              <div style={{ textAlign: 'center', marginTop: 10 }}>
                <a href={f.downloadUrl} className="btn-primary" style={{ textDecoration: 'none', padding: '11px 26px', borderRadius: 10, fontWeight: 700, fontSize: 15, display: 'inline-block' }}>⤓ Download</a>
              </div>
            </div>
          ))}

          <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginTop: 8 }}>
            Shared via{' '}
            <a href="https://www.maineventstudio.com" style={{ color: 'var(--blue, #3d7bff)', textDecoration: 'none' }}>Main Event Studio</a>
          </p>
        </>
      )}
    </main>
  );
}
