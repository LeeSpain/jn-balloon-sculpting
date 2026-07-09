import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { sameOrigin, rateLimit, clientIp } from "@/lib/security";
import { saveImage, extFromType } from "@/lib/storage";

export const dynamic = "force-dynamic";

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB per image (client downscales first)
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"];

// Accepts a single image file (multipart form field "file") and returns its
// public URL. Auth + origin + rate limited. The client compresses before upload,
// so only the URL ends up in the store — never the raw image bytes.
export async function POST(req: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "Bad origin." }, { status: 403 });
  }
  if (!rateLimit(`upload:${clientIp(req)}`, 60, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many uploads — try again shortly." }, { status: 429 });
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });

  const type = file.type || "image/jpeg";
  if (!ALLOWED.includes(type)) {
    return NextResponse.json({ error: "Unsupported image type." }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length === 0) return NextResponse.json({ error: "Empty file." }, { status: 400 });
  if (bytes.length > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large (max 6 MB)." }, { status: 413 });
  }

  try {
    const url = await saveImage(bytes, extFromType(type));
    return NextResponse.json({ url });
  } catch (e) {
    console.error("Image upload failed:", e);
    return NextResponse.json({ error: "Upload failed — please try again." }, { status: 500 });
  }
}
