import { brandIconResponse } from "@/lib/brandIcon";

// 512×512 PNG for the web manifest / PWA install / Android splash.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return brandIconResponse(512);
}
