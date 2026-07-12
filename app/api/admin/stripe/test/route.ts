import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getRepository } from "@/lib/store";
import { isAuthed } from "@/lib/adminAuth";
import { sameOrigin } from "@/lib/security";
import { decryptSecret } from "@/lib/crypto";
import { modeOfKey } from "@/lib/stripeConfig";

export const dynamic = "force-dynamic";

// Verify the stored secret key against Stripe's API and record mode + connected.
export async function POST(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sameOrigin(req)) return NextResponse.json({ error: "Bad origin." }, { status: 403 });

  const repo = getRepository();
  const store = await repo.read();
  const secret = decryptSecret(store.settings.stripeSecret || "") || process.env.STRIPE_SECRET_KEY || "";

  if (!secret.startsWith("sk_")) {
    return NextResponse.json({ connected: false, error: "No secret key saved yet." }, { status: 400 });
  }

  const mode = modeOfKey(secret);
  try {
    const stripe = new Stripe(secret);
    // A lightweight authenticated call — succeeds only with a valid key.
    const account = await stripe.accounts.retrieve();
    store.settings.stripeConnected = true;
    store.settings.stripeMode = mode;
    await repo.write(store);
    return NextResponse.json({ connected: true, mode, accountId: account.id });
  } catch (e) {
    store.settings.stripeConnected = false;
    // A failed test also disables card payments (fail safe).
    store.settings.acceptCardPayments = false;
    await repo.write(store);
    const message = e instanceof Stripe.errors.StripeError ? e.message : "Could not reach Stripe with that key.";
    return NextResponse.json({ connected: false, mode, error: message }, { status: 200 });
  }
}
