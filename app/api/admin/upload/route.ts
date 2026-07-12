import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { saveUpload } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

// Upload a gallery photo. Authed. Returns { url } for the admin to add to the store.
export async function POST(req: Request) {
  if (!(await getSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Please upload a PNG, JPEG, WebP or GIF image.' }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length > MAX_BYTES) {
    return NextResponse.json({ error: 'Image is too large (max 6 MB).' }, { status: 400 });
  }

  const url = await saveUpload(file.name, bytes, file.type);
  return NextResponse.json({ url });
}
