import { ImageResponse } from "next/og";

// Apple touch icon — Apple devices need a raster (PNG) icon, so this is
// generated rather than served from the SVG favicon.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#4A2C4D",
          borderRadius: 40,
          fontSize: 92,
          fontWeight: 700,
          fontFamily: "Georgia, serif",
        }}
      >
        <span style={{ color: "#FBF7F2" }}>J</span>
        <span style={{ color: "#D4AF7A" }}>&amp;</span>
        <span style={{ color: "#FBF7F2" }}>N</span>
      </div>
    ),
    { ...size },
  );
}
