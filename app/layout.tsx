import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'J&N Balloon Sculpting — Handcrafted balloon art, delivered across Cambridgeshire',
  description:
    'Arches, garlands and centrepieces for birthdays, weddings and every celebration in between — handmade by Jade & Nicole and delivered across Cambridgeshire.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=Nunito:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
