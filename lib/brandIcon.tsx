import { ImageResponse } from "next/og";
import { getRepository } from "@/lib/store";
import { assetUrl } from "@/lib/assets";

// Shared renderer for every favicon / app icon size. Uses the admin-managed
// favicon (Admin → Site images → Favicon) when set; otherwise falls back to the
// J&N monogram on brand plum. Sourcing them all from here guarantees the tab
// icon is consistent across sizes and updates when the admin uploads a new one.

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

function toAbsolute(src: string): string {
  if (!src) return "";
  if (src.startsWith("data:") || src.startsWith("http://") || src.startsWith("https://")) return src;
  const p = assetUrl(src); // ensures a leading "/"
  return p.startsWith("/") ? SITE + p : p;
}

async function adminFavicon(): Promise<string> {
  try {
    const images = (await getRepository().read()).images;
    return images?.favicon ? toAbsolute(images.favicon) : "";
  } catch {
    return "";
  }
}

export async function brandIconResponse(size: number): Promise<ImageResponse> {
  const favicon = await adminFavicon();

  if (favicon) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={favicon} alt="" width={size} height={size} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      ),
      { width: size, height: size },
    );
  }

  // Monogram fallback. Tiny sizes drop the "&" so it stays legible.
  const small = size <= 40;
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
          borderRadius: Math.round(size * 0.22),
          fontFamily: "Georgia, serif",
          fontWeight: 700,
          fontSize: Math.round(size * (small ? 0.52 : 0.46)),
          letterSpacing: small ? -1 : 0,
        }}
      >
        <span style={{ color: "#FBF7F2" }}>J</span>
        {!small && <span style={{ color: "#D4AF7A" }}>&amp;</span>}
        <span style={{ color: "#FBF7F2" }}>N</span>
      </div>
    ),
    { width: size, height: size },
  );
}
