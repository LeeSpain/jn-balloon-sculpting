import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getRepository } from "@/lib/store";
import { notifyNewBooking } from "@/lib/notify";
import { resolveStripeConfig } from "@/lib/stripeConfig";

// Stripe webhook — the ONLY trustworthy signal that a customer actually paid.
// Keys/secret resolve DB-first (admin-managed, decrypted) with env fallback. On
// `checkout.session.completed` we record the paid amount and clear the "awaiting
// payment" flag on the matching order.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const repo = getRepository();
  const store = await repo.read();
  const cfg = resolveStripeConfig(store);

  if (!cfg.webhookSecret || !cfg.secretKey) {
    // Webhooks not configured yet — acknowledge without acting.
    return NextResponse.json({ received: true, configured: false });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  const raw = await req.text(); // raw body required for signature verification
  const stripe = new Stripe(cfg.secretKey);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, cfg.webhookSecret);
  } catch (e) {
    console.error("Stripe webhook signature verification failed:", e);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    const paid = (session.amount_total ?? 0) / 100;
    if (orderId) {
      const order = store.orders.find((o) => o.id === orderId);
      if (order && order.awaitingPayment) {
        order.depositPaid = paid;
        order.awaitingPayment = false;
        await repo.write(store);
        const product = store.products.find((p) => p.id === order.product);
        await notifyNewBooking(order, product?.name ?? order.product);
      }
    }
  }

  return NextResponse.json({ received: true });
}
