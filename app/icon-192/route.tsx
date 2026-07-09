import { brandIconResponse } from "@/lib/brandIcon";

// 192×192 PNG for the web manifest / Android home screen.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return brandIconResponse(192);
}
