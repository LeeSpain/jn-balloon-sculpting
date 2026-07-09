import { ImageResponse } from "next/og";

// Social share card — shown when the site is linked on Facebook, WhatsApp,
// iMessage, LinkedIn, X/Twitter, etc. Generated at build time from the brand
// palette so there is no binary asset to maintain.
export const alt = "J&N Balloon Sculpting — handcrafted balloon art, delivered across Cambridgeshire";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#4A2C4D",
          padding: "72px 80px",
          fontFamily: "Georgia, serif",
        }}
      >
        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 92,
              height: 92,
              borderRadius: 24,
              background: "#FBF7F2",
              fontSize: 46,
              fontWeight: 700,
            }}
          >
            <span style={{ color: "#4A2C4D" }}>J</span>
            <span style={{ color: "#D4AF7A" }}>&amp;</span>
            <span style={{ color: "#4A2C4D" }}>N</span>
          </div>
          <div
            style={{
              color: "#D4AF7A",
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 6,
            }}
          >
            BALLOON SCULPTING
          </div>
        </div>

        {/* Gold accent bar */}
        <div style={{ width: 132, height: 8, borderRadius: 4, background: "#D4AF7A", margin: "48px 0 32px" }} />

        {/* Headline */}
        <div style={{ color: "#FBF7F2", fontSize: 82, fontWeight: 700, lineHeight: 1.05, maxWidth: 900 }}>
          Handcrafted balloon art, delivered.
        </div>

        {/* Subhead */}
        <div style={{ color: "#F3C6C6", fontSize: 34, marginTop: 28, maxWidth: 940, lineHeight: 1.3 }}>
          Arches, garlands &amp; centrepieces for every celebration — made by Jade &amp; Nicole, delivered across Cambridgeshire.
        </div>

        {/* Footer row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 56 }}>
          <div
            style={{
              display: "flex",
              background: "#FF6F61",
              color: "#FBF7F2",
              fontSize: 26,
              fontWeight: 700,
              padding: "14px 28px",
              borderRadius: 999,
            }}
          >
            Instant online quotes
          </div>
          <div style={{ color: "#D4AF7A", fontSize: 28, fontWeight: 700 }}>jnballoons.co.uk</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
