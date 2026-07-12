import { NextResponse } from "next/server";
import { getRepository, hasDatabase } from "@/lib/store";
import { isAuthed } from "@/lib/adminAuth";
import { sameOrigin } from "@/lib/security";
import { resolveStripeConfig } from "@/lib/stripeConfig";

export const dynamic = "force-dynamic";

// The "Accept card payments" toggle (replaces the BOOKINGS_LIVE env var).
// It can only be switched ON when a tested, connected key exists and a database
// is configured — so cards can never be charged against a non-persistent store.
export async function PUT(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sameOrigin(req)) return NextResponse.json({ error: "Bad origin." }, { status: 403 });

  let accept = false;
  try {
    accept = !!(await req.json()).accept;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const repo = getRepository();
  const store = await repo.read();

  if (accept) {
    const cfg = resolveStripeConfig(store);
    if (!store.settings.stripeConnected || !cfg.configured) {
      return NextResponse.json(
        { error: "Save your keys and run “Test connection” successfully before turning payments on." },
        { status: 400 },
      );
    }
    if (!hasDatabase()) {
      return NextResponse.json(
        { error: "Connect a database before accepting card payments." },
        { status: 400 },
      );
    }
  }

  store.settings.acceptCardPayments = accept;
  await repo.write(store);
  const cfg = resolveStripeConfig(store);
  return NextResponse.json({ acceptCardPayments: accept, effectiveAcceptCard: cfg.acceptCard });
}
