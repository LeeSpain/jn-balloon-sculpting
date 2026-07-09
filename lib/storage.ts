// Image storage. Images are PUBLIC (they're shown on the website), so:
//   • Production (Vercel): store in Vercel Blob when BLOB_READ_WRITE_TOKEN is
//     set — durable, CDN-served, survives across serverless instances.
//   • Dev / self-hosted: write into public/uploads (served at /uploads/...).
// Only the returned URL is kept in the store, so the store JSON stays tiny.
import { promises as fs } from "fs";
import path from "path";
import { uid } from "./ids";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
};

export function extFromType(contentType: string): string {
  const t = contentType.toLowerCase();
  if (t.includes("png")) return "png";
  if (t.includes("webp")) return "webp";
  if (t.includes("gif")) return "gif";
  if (t.includes("svg")) return "svg";
  if (t.includes("icon")) return "ico";
  return "jpg";
}

export function hasBlobStorage(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/** Persist image bytes and return a public URL for the store + frontend. */
export async function saveImage(bytes: Buffer, ext: string): Promise<string> {
  const safeExt = MIME[ext] ? ext : "jpg";
  const name = `${uid("img")}.${safeExt}`;

  if (hasBlobStorage()) {
    const { put } = await import("@vercel/blob");
    const res = await put(`site-images/${name}`, bytes, {
      access: "public",
      contentType: MIME[safeExt],
      addRandomSuffix: false,
    });
    return res.url;
  }

  // Dev / self-hosted fallback.
  const dir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), bytes);
  return `/uploads/${name}`;
}
