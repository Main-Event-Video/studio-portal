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
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={display.variable}>
      <body className={body.className}>{children}</body>
    </html>
  );
}
