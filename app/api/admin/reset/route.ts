import { NextResponse } from 'next/server';
import { resetStore, loadStore } from '@/lib/db/store';
import { getSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Reset all data back to the seeded demo dataset. Authed.
export async function POST() {
  if (!(await getSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await resetStore();
  return NextResponse.json({ store: await loadStore() });
}
