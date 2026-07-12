/** @type {import('next').NextConfig} */

// Baseline security headers applied to every response. CSP allows inline styles
// (the app uses style attributes and next/font extensively) and data: images
// (uploaded gallery photos are stored as data URLs), but blocks loading scripts,
// frames and resources from third-party origins.
const csp = [
  "default-src 'self'",
  // Allow admin-uploaded images served from Vercel Blob storage.
  "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // The homepage is force-dynamic so prices/availability reflect the latest admin
  // edits. Disable the client Router Cache for dynamic pages too, so a soft
  // navigation back to "/" never shows a stale quote instead of the new one.
  experimental: {
    staleTimes: { dynamic: 0 },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
