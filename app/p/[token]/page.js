import Image from 'next/image';
import Link from 'next/link';
import { getClientByToken, getAuthedClientId } from '@/lib/portal';
import PasswordGate from './PasswordGate';

export const dynamic = 'force-dynamic';

function formatDate(d) {
  if (!d) return '';
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return d;
  }
}

export default async function PortalHome({ params }) {
  const { token } = params;
  const client = await getClientByToken(token);

  if (!client || client.archived) {
    return (
      <main className="wrap" style={{ maxWidth: 440, textAlign: 'center', paddingTop: '12vh' }}>
        <h2 className="neon neon-blue">Portal not available</h2>
        <p style={{ color: 'var(--muted)' }}>
          This link isn’t active. If you think that’s a mistake, reach out to Main Event Studio.
        </p>
      </main>
    );
  }

  const authed = getAuthedClientId() === client.id;
  if (!authed) {
    return <PasswordGate token={token} displayName={client.display_name} />;
  }

  const when = [formatDate(client.event_date), client.event_type].filter(Boolean).join(' · ');

  return (
    <main className="wrap hub">
      <div className="logo-header">
        <Image src="/logo.png" alt="Main Event Studio" width={220} height={148} priority />
      </div>
      <div style={{ textAlign: 'center' }}>
        <h1 className="neon neon-blue" style={{ fontSize: 30, margin: '8px 0 4px' }}>
          Welcome, {client.display_name}
        </h1>
        {when && <p style={{ color: 'var(--muted)', marginTop: 0 }}>{when}</p>}
      </div>

      <div className="tiles">
        <Link href={`/p/${token}/upload`} className="tile red">
          <div className="tile-title neon-red">Upload your photos and videos here</div>
          <div className="tile-sub">Send us your event media so we can get to work.</div>
        </Link>
        <Link href={`/p/${token}/view`} className="tile">
          <div className="tile-title neon-blue">Take a look at what we sent you</div>
          <div className="tile-sub">View rough cuts and images from Main Event Studio.</div>
        </Link>
      </div>
    </main>
  );
}
