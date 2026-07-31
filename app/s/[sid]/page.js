// Public, branded landing page for a shared/forwarded delivery. This is what a
// friend or vendor sees when they open a share link — Main Event Studio logo,
// the video (playable), and a Download button for finals. No login needed; the
// HMAC-signed token resolves to exactly ONE file and nothing else.
import Image from 'next/image';
import { verifyShareToken } from '@/lib/shareLink';
import { createServiceClient } from '@/lib/supabaseAdmin';
import { getViewUrl } from '@/lib/r2';

export const dynamic = 'force-dynamic';

export default async function SharePage({ params }) {
  const sid = params?.sid;
  const mediaId = verifyShareToken(sid);

  let m = null;
  if (mediaId) {
    const db = createServiceClient();
    const { data } = await db
      .from('studio_media')
      .select('id, filename, r2_key, kind, content_type')
      .eq('id', mediaId)
      .single();
    if (data && data.r2_key && ['rough_cut', 'final'].includes(data.kind)) m = data;
  }

  const viewUrl = m ? await getViewUrl(m.r2_key, 43200) : null;
  const isVideo = m && (m.content_type || '').startsWith('video');
  const canDownload = m && m.kind === 'final';

  return (
    <main className="wrap" style={{ maxWidth: 720, margin: '0 auto', padding: '28px 18px 48px' }}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <Image src="/logo.png" alt="Main Event Studio" width={220} height={148} priority />
      </div>

      {!m ? (
        <div style={{ textAlign: 'center' }}>
          <h1 className="neon neon-blue" style={{ fontSize: 24, margin: '6px 0 8px' }}>Link not available</h1>
          <p style={{ color: 'var(--muted)' }}>This link is invalid or the file is no longer available.</p>
        </div>
      ) : (
        <>
          <p className="eyebrow" style={{ textAlign: 'center' }}>Shared with you</p>
          <h1 className="neon neon-blue" style={{ textAlign: 'center', fontSize: 22, margin: '4px 0 16px', wordBreak: 'break-word' }}>
            {m.filename}
          </h1>

          {isVideo ? (
            <video src={viewUrl} controls playsInline style={{ width: '100%', maxHeight: '70vh', borderRadius: 12, background: '#000', display: 'block' }} />
          ) : (
            <img src={viewUrl} alt={m.filename} style={{ width: '100%', borderRadius: 12, display: 'block' }} />
          )}

          {canDownload && (
            <div style={{ textAlign: 'center', marginTop: 18 }}>
              <a
                href={`/api/portal/share/${sid}?mode=download`}
                className="btn-primary"
                style={{ textDecoration: 'none', padding: '13px 30px', borderRadius: 10, fontWeight: 700, fontSize: 16, display: 'inline-block' }}
              >⤓ Download</a>
            </div>
          )}

          <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginTop: 24 }}>
            Shared via{' '}
            <a href="https://www.maineventstudio.com" style={{ color: 'var(--blue, #3d7bff)', textDecoration: 'none' }}>
              Main Event Studio
            </a>
          </p>
        </>
      )}
    </main>
  );
}
