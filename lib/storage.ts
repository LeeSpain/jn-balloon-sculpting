// Image storage. Images are PUBLIC (they're shown on the website), so:
//   • Vercel Blob when BLOB_READ_WRITE_TOKEN is set — durable, CDN-served,
//     keeps the store JSON tiny. Recommended for production.
//   • No Blob token → inline the image as a base64 data: URL saved in the
//     store itself. This works on Vercel's READ-ONLY filesystem (writing
//     public/uploads there throws ENOENT), so uploads never hard-fail just
//     because Blob isn't configured yet. It persists wherever the store
//     persists (the database), at the cost of a larger store row.
//   • Local dev only → write into public/uploads (nice URLs, fast iteration).
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

  // No Blob configured. Vercel's filesystem is read-only, so only write to disk
  // when we're NOT on Vercel (local dev). Everywhere else, inline the image as a
  // data: URL so the upload succeeds and shows up immediately.
  if (!process.env.VERCEL) {
    try {
      const dir = path.join(process.cwd(), "public", "uploads");
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, name), bytes);
      return `/uploads/${name}`;
    } catch {
      /* fall through to a data URL if the FS isn't writable */
    }
  }
  return `data:${MIME[safeExt]};base64,${bytes.toString("base64")}`;
}
