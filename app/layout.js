import './globals.css';
import { Big_Shoulders_Display, Inter } from 'next/font/google';

const display = Big_Shoulders_Display({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
});
const body = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Main Event Studio — Client Portal',
  description: 'Private client media portal for Main Event Studio',
  // Same favicon the main site (maineventstudio.com) serves, so the portal tab
  // matches the brand. Points at the Squarespace-hosted asset the marketing site
  // uses; if the studio updates that icon, the portal stays in sync automatically.
  icons: {
    icon: 'https://images.squarespace-cdn.com/content/v1/69fab063103b857eb3289a97/b2d8028c-994c-44a7-a5f1-483fa95884aa/favicon.ico',
    shortcut: 'https://images.squarespace-cdn.com/content/v1/69fab063103b857eb3289a97/b2d8028c-994c-44a7-a5f1-483fa95884aa/favicon.ico',
    apple: 'https://images.squarespace-cdn.com/content/v1/69fab063103b857eb3289a97/b2d8028c-994c-44a7-a5f1-483fa95884aa/favicon.ico',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={display.variable}>
      <body className={body.className}>{children}</body>
    </html>
  );
}
