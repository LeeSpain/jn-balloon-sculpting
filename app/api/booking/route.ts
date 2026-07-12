import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getRepository } from "@/lib/store";
import {
  priceProduct,
  zoneForPostcode,
  depositFor,
  minDate,
  gbp,
} from "@/lib/pricing";
import { resolveStripeConfig } from "@/lib/stripeConfig";
import { notifyNewBooking } from "@/lib/notify";
import { nextOrderId } from "@/lib/ids";
import { sameOrigin, clientIp } from "@/lib/security";
import { checkRateLimit } from "@/lib/rateLimit";
import { upsertContactFromOrder } from "@/lib/crm";
import { isDeliveryAvailable } from "@/lib/calendar";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Body {
  kind: "book" | "custom";
  productId: string;
  sizeId: string;
  theme: string;
  postcode: string;
  date: string;
  custName: string;
  custContact: string;
  marketingConsent: boolean;
}

// Trim + hard-cap a free-text field so a hostile client can't store megabytes.
function clean(v: unknown, max: number): string {
  return String(v ?? "").trim().slice(0, max);
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "Bad origin." }, { status: 403 });
  }
  // Throttle abuse of this public endpoint (it creates orders + Stripe sessions).
  if (!(await checkRateLimit(`booking:${clientIp(req)}`, 12, 10 * 60 * 1000))) {
    return NextResponse.json(
      { error: "Too many requests — please try again in a few minutes." },
      { status: 429 },
    );
  }

  let raw: Partial<Body>;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const body: Body = {
    kind: raw.kind === "custom" ? "custom" : "book",
    productId: clean(raw.productId, 60),
    sizeId: clean(raw.sizeId, 60),
    theme: clean(raw.theme, 80),
    postcode: clean(raw.postcode, 12),
    date: clean(raw.date, 10),
    custName: clean(raw.custName, 120),
    custContact: clean(raw.custContact, 160),
    marketingConsent: raw.marketingConsent === true,
  };

  if (!body.custName || !body.custContact) {
    return NextResponse.json(
      { error: "Please add your name and a mobile number or email so we can confirm your booking." },
      { status: 400 },
    );
  }
  // Date must be an ISO yyyy-mm-dd if provided.
  if (body.date && !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return NextResponse.json({ error: "Invalid delivery date." }, { status: 400 });
  }

  const repo = getRepository();
  const store = await repo.read();

  const product = store.products.find((p) => p.id === body.productId) || store.products[0];
  // Resolve size the SAME way the client does; fall back to the mult-1 size.
  const size =
    store.sizes.find((s) => s.id === body.sizeId) ||
    store.sizes.find((s) => s.mult === 1) ||
    store.sizes[0];
  const zone = body.postcode ? zoneForPostcode(store, body.postcode) : null;

  const priced = priceProduct(store, product, size.mult);
  const zoneOk = !!zone && zone.fee != null;
  const dateOk = !!body.date && body.date >= minDate(store);
  // Availability guard: a real booking can't land on a blocked or fully-booked day
  // (defence-in-depth behind the picker, and against races/tampering).
  if (body.kind === "book" && zoneOk && dateOk && !isDeliveryAvailable(store, body.date)) {
    return NextResponse.json(
      { error: "Sorry — that date has just filled up or isn't available. Please pick another." },
      { status: 409 },
    );
  }
  const isBooking = body.kind === "book" && zoneOk && dateOk;

  const id = nextOrderId(store.orders.map((o) => o.id));
  const total = zoneOk ? priced.price + (zone!.fee as number) : priced.price;
  const deposit = depositFor(store, total);
  const payInFull = store.settings.depositType === "full";

  const order: Order = {
    id,
    customer: isBooking ? body.custName : `${body.custName} (custom enquiry)`,
    phone: body.custContact,
    product: product.id,
    size: size.id,
    theme: body.theme || store.themes[0],
    postcode: body.postcode.toUpperCase(),
    address: "",
    date: body.date || minDate(store),
    price: isBooking ? priced.price : 0,
    delivery: isBooking && zoneOk ? (zone!.fee as number) : 0,
    status: "Order received",
    depositPaid: 0,
    acknowledged: false, // triage: awaits the team's Making/Delivering assignment
    createdAt: new Date().toISOString(),
  };

  // CRM: auto-create or update the customer's contact record from this
  // order/enquiry. Mutates store.contacts, which both write paths below persist.
  upsertContactFromOrder(store, {
    name: body.custName,
    rawContact: body.custContact,
    postcode: order.postcode,
    source: isBooking ? "Website booking" : "Website enquiry",
    status: isBooking ? "Booked" : "New enquiry",
    consent: body.marketingConsent,
    occasion: product.name,
    occasionDate: order.date,
    nowISO: new Date().toISOString(),
  });

  // Real payment via Stripe Checkout — only when the safety gate is open
  // (durable DB configured AND BOOKINGS_LIVE=true). Otherwise fall through to
  // enquiry mode so no card payment is taken against a non-persistent store.
  const stripeCfg = resolveStripeConfig(store);
  if (isBooking && stripeCfg.configured && stripeCfg.acceptCard) {
    try {
      const stripe = new Stripe(stripeCfg.secretKey);
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
      // Mark as awaiting payment until the webhook confirms it.
      order.awaitingPayment = true;
      store.orders.unshift(order);
      await repo.write(store);
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "gbp",
              product_data: {
                name: `${product.name} (${size.name}) — ${payInFull ? "full payment" : "deposit"} · ${id}`,
              },
              unit_amount: Math.round(deposit * 100),
            },
            quantity: 1,
          },
        ],
        customer_email: body.custContact.includes("@") ? body.custContact : undefined,
        success_url: `${siteUrl}/?booked=${id}#quote`,
        cancel_url: `${siteUrl}/?cancelled=${id}#quote`,
        metadata: { orderId: id },
      });
      return NextResponse.json({ checkoutUrl: session.url });
    } catch (e) {
      // Fall through to enquiry mode if Stripe errors.
      console.error("Stripe checkout failed:", e);
    }
  }

  store.orders.unshift(order);
  await repo.write(store);
  await notifyNewBooking(order, product.name);

  const message = isBooking
    ? payInFull
      ? `Booking request ${id} received! We’ll confirm within 24 hours — paying ${gbp(total)} in full secures your date once confirmed. (Pay on confirmation — card payments not yet enabled.)`
      : `Booking request ${id} received! We’ll confirm within 24 hours — your ${gbp(deposit)} deposit secures the date once confirmed. (Pay on confirmation — card payments not yet enabled.)`
    : `Custom quote request ${id} sent — Jade & Nicole will reply within 24 hours with a personal price.`;

  return NextResponse.json({ message });
}
