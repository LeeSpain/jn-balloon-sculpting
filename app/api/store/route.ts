import { NextResponse } from 'next/server';
import { getPublicStore } from '@/lib/db/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public store snapshot for the customer site (no orders, no Stripe secret).
export async function GET() {
  const store = await getPublicStore();
  return NextResponse.json(store);
}
