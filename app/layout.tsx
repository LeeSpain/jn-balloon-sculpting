import type { Metadata } from "next";
import { Playfair_Display, Nunito } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "J&N Balloon Sculpting — Handcrafted balloon art, delivered",
  description:
    "Arches, garlands and centrepieces for birthdays, weddings and every celebration in between — handmade by Jade & Nicole and delivered across Cambridgeshire.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB" className={`${playfair.variable} ${nunito.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
