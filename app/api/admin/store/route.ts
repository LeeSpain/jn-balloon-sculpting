import { NextResponse } from "next/server";
import { getRepository } from "@/lib/store";
import { isAuthed } from "@/lib/adminAuth";
import { sanitizeStoreForClient } from "@/lib/adminStore";
import { validateStore } from "@/lib/validateStore";
import { sameOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const store = await getRepository().read();
  return NextResponse.json({ store: sanitizeStoreForClient(store) });
}

export async function POST(req: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "Bad origin." }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const incoming = (body as { store?: unknown } | null)?.store;
  const result = validateStore(incoming);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  // Never let a redacted client secret ("") clobber the real stored secret:
  // preserve the existing Stripe fields the client can't see.
  const current = await getRepository().read();
  const merged = {
    ...result.store,
    settings: {
      ...result.store.settings,
      stripeSecret: current.settings.stripeSecret,
      stripePublishable: current.settings.stripePublishable,
    },
  };
  await getRepository().write(merged);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const store = await getRepository().reset();
  return NextResponse.json({ store: sanitizeStoreForClient(store) });
}
