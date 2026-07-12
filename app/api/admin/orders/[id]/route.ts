import { NextResponse } from "next/server";
import { getRepository } from "@/lib/store";
import { isAuthed } from "@/lib/adminAuth";
import { sameOrigin } from "@/lib/security";
import { sanitizeStoreForClient } from "@/lib/adminStore";

export const dynamic = "force-dynamic";

// Permanently delete a single order. write() only upserts orders (so concurrent
// bookings are never lost), which means removal needs this dedicated call —
// otherwise a deleted order would reappear on the next read. Real cancellations
// should archive instead; this is for genuine junk/test data.
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sameOrigin(req)) return NextResponse.json({ error: "Bad origin." }, { status: 403 });

  const { id } = await ctx.params;
  const repo = getRepository();
  const store = await repo.read();
  if (!(store.orders || []).some((o) => o.id === id)) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  await repo.deleteOrder(id); // truly removes the row (Postgres) / rewrites file (dev)

  const fresh = await repo.read();
  return NextResponse.json({ ok: true, store: sanitizeStoreForClient(fresh) });
}
