import type { Metadata, Viewport } from "next";
import { Playfair_Display, Nunito } from "next/font/google";
import "./globals.css";
import { getRepository } from "@/lib/store";
import { assetUrl } from "@/lib/assets";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const title = "J&N Balloon Sculpting — Handcrafted balloon art, delivered across Cambridgeshire";
const description =
  "Arches, garlands and centrepieces for birthdays, weddings and every celebration in between — handmade by Jade & Nicole and delivered across Cambridgeshire.";

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

// Dynamic so admin-uploaded favicon / social-share image are honoured. When
// those slots are blank the built-in defaults apply: the file-based icon.svg
// and the generated opengraph-image route.
export async function generateMetadata(): Promise<Metadata> {
  const images = (await getRepository().read()).images;
  const meta: Metadata = {
    metadataBase: new URL(siteUrl),
    title: {
      default: title,
      template: "%s | J&N Balloon Sculpting",
    },
    description,
    applicationName: "J&N Balloon Sculpting",
    authors: [{ name: "Jade & Nicole" }],
    creator: "J&N Balloon Sculpting",
    keywords: [
      "balloon sculpting",
      "balloon arch",
      "balloon garland",
      "balloon delivery",
      "party balloons",
      "wedding balloons",
      "birthday balloons",
      "Cambridgeshire",
      "Huntingdon",
      "Jade & Nicole",
    ],
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      locale: "en_GB",
      url: "/",
      siteName: "J&N Balloon Sculpting",
      title,
      description,
      ...(images.ogImage ? { images: [{ url: assetUrl(images.ogImage) }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(images.ogImage ? { images: [assetUrl(images.ogImage)] } : {}),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large" },
    },
  };
  // Favicons/app icons are produced by the file-based routes (app/icon.tsx,
  // app/apple-icon.tsx, /icon-192, /icon-512), which already source the admin
  // favicon slot — so no meta.icons override is needed here.
  return meta;
}

export const viewport: Viewport = {
  themeColor: "#4A2C4D",
  colorScheme: "light",
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
