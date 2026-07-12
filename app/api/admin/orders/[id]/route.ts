import { NextResponse } from 'next/server';
import { setOrderStatus, loadStore } from '@/lib/db/store';
import { getSession } from '@/lib/session';
import type { OrderStatus } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES: OrderStatus[] = [
  'Order received', 'Materials purchased', 'In progress', 'Ready', 'Delivered',
];

// Advance an order's status. First move to "Materials purchased" consumes stock
// server-side. Returns the fresh store so the admin reflects any stock changes.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  let status: OrderStatus;
  try {
    status = ((await req.json()) as { status: OrderStatus }).status;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (!STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  await setOrderStatus(id, status);
  return NextResponse.json({ store: await loadStore() });
}
