// Public review form (/review?c=<token>&stars=n) — opened from the
// "How did we do?" email (Reviews, Josh + Robyn signed off 11/17).
// ?preview=1 shows the form with sample details and never saves (admin check).
import Image from 'next/image';
import ReviewClient from './ReviewClient';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'How did we do? | Main Event Studio',
  robots: { index: false, follow: false },
};

export default function ReviewPage({ searchParams }) {
  const c = typeof searchParams?.c === 'string' ? searchParams.c : '';
  const stars = Math.max(0, Math.min(5, parseInt(searchParams?.stars, 10) || 0));
  const preview = searchParams?.preview === '1';
  return (
    <main className="wrap" style={{ maxWidth: 560, margin: '0 auto', padding: '28px 18px 48px', textAlign: 'center' }}>
      <a href="https://www.maineventstudio.com" aria-label="Main Event Studio">
        <Image src="/logo.png" alt="Main Event Studio" width={200} height={135} priority />
      </a>
      <ReviewClient token={c} initialStars={stars} preview={preview} />
      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 26 }}>
        Questions? <a href="mailto:info@maineventstudio.com" style={{ color: 'var(--blue, #3d7bff)', textDecoration: 'none' }}>info@maineventstudio.com</a>
        {' · '}
        <a href="https://www.maineventstudio.com" style={{ color: 'var(--blue, #3d7bff)', textDecoration: 'none' }}>maineventstudio.com</a>
      </p>
    </main>
  );
}
