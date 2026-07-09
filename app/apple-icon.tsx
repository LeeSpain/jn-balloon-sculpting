import { brandIconResponse } from "@/lib/brandIcon";

// Apple touch icon (home-screen icon on iOS). Sourced from the admin favicon
// slot, monogram fallback.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  return brandIconResponse(180);
}
