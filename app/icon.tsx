import { brandIconResponse } from "@/lib/brandIcon";

// Browser-tab favicons at the standard small sizes. Sourced from the admin
// favicon slot (monogram fallback). Next injects a <link rel="icon"> per size.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function generateImageMetadata() {
  return [
    { id: "16", size: { width: 16, height: 16 }, contentType: "image/png" },
    { id: "32", size: { width: 32, height: 32 }, contentType: "image/png" },
    { id: "48", size: { width: 48, height: 48 }, contentType: "image/png" },
  ];
}

export default async function Icon({ id }: { id: string }) {
  return brandIconResponse(Number(id) || 32);
}
