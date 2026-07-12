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
  // Stripe config is managed only via /api/admin/stripe* — preserve ALL of it here
  // so the general store save can never clobber keys or flip the payments toggle
  // (the client's copy has secrets redacted, and the toggle is gated server-side).
  const current = await getRepository().read();
  const merged = {
    ...result.store,
    settings: {
      ...result.store.settings,
      stripeSecret: current.settings.stripeSecret,
      stripePublishable: current.settings.stripePublishable,
      stripeWebhookSecret: current.settings.stripeWebhookSecret,
      stripeMode: current.settings.stripeMode,
      stripeConnected: current.settings.stripeConnected,
      acceptCardPayments: current.settings.acceptCardPayments,
    },
  };
  await getRepository().write(merged);
  return NextResponse.json({ ok: true });
}
