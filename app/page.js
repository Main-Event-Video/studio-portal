import Image from 'next/image';

export default function Home() {
  return (
    <main className="wrap" style={{ textAlign: 'center', paddingTop: '10vh' }}>
      <div className="logo-header">
        <Image src="/logo.png" alt="Main Event Studio" width={340} height={230} priority />
      </div>
      <p className="eyebrow">Client Portal</p>
      <h1 className="neon neon-blue" style={{ fontSize: 34, margin: '6px 0 10px' }}>
        Your event. Front and center.
      </h1>
      <p style={{ color: 'var(--muted)', maxWidth: 460, margin: '0 auto' }}>
        Client sign-in opens here soon. If Main Event Studio sent you a private
        link, use that link to reach your portal.
      </p>
    </main>
  );
}
