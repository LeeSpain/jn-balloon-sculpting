// Image storage abstraction. Production (Vercel): Vercel Blob, selected when
// BLOB_READ_WRITE_TOKEN is present. Local dev: write into public/uploads so the
// file is served straight away. Both return a URL usable as an <img>/background src.

import { randomBytes } from 'node:crypto';

function safeName(filename: string): string {
  const dot = filename.lastIndexOf('.');
  const ext = dot > -1 ? filename.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g, '') : '.png';
  return randomBytes(8).toString('hex') + ext;
}

export async function saveUpload(filename: string, bytes: Buffer, contentType: string): Promise<string> {
  const name = safeName(filename);
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob');
    const blob = await put(`gallery/${name}`, bytes, { access: 'public', contentType });
    return blob.url;
  }
  // Local fallback — write into public/uploads (served at /uploads/*).
  const { writeFile, mkdir } = await import('node:fs/promises');
  const path = await import('node:path');
  const dir = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes);
  return `/uploads/${name}`;
}
