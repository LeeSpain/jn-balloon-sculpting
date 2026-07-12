import { NextResponse } from 'next/server';
import { loadStore, saveContent } from '@/lib/db/store';
import { getSession } from '@/lib/session';
import type { Store } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Full store for the admin dashboard (includes orders + Stripe secret). Authed.
export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await loadStore());
}

// Persist edited content + settings (materials, products, zones, gallery, reviews,
// themes, settings). Orders are handled by their own endpoints. Authed.
export async function PUT(req: Request) {
  if (!(await getSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let store: Store;
  try {
    store = (await req.json()) as Store;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  await saveContent(store);
  return NextResponse.json({ ok: true });
}
