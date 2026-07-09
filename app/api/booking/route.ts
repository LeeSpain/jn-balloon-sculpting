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
import { serverStripeEnabled } from "@/lib/publicData";
import { notifyNewBooking } from "@/lib/notify";
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
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const custName = (body.custName || "").trim();
  const custContact = (body.custContact || "").trim();
  if (!custName || !custContact) {
    return NextResponse.json(
      { error: "Please add your name and a mobile number or email so we can confirm your booking." },
      { status: 400 }
    );
  }

  const repo = getRepository();
  const store = await repo.read();

  const product = store.products.find((p) => p.id === body.productId) || store.products[0];
  const size = store.sizes.find((s) => s.id === body.sizeId) || store.sizes[1] || store.sizes[0];
  const zone = body.postcode?.trim() ? zoneForPostcode(store, body.postcode) : null;

  const priced = priceProduct(store, product, size.mult);
  const zoneOk = !!zone && zone.fee != null;
  const dateOk = !!body.date && body.date >= minDate(store);
  const isBooking = body.kind === "book" && zoneOk && dateOk;

  const id = "JN-" + (1044 + store.orders.length);
  const total = zoneOk ? priced.price + (zone!.fee as number) : priced.price;
  const deposit = depositFor(store, total);
  const payInFull = store.settings.depositType === "full";

  const order: Order = {
    id,
    customer: isBooking ? custName : `${custName} (custom enquiry)`,
    phone: custContact,
    product: product.id,
    size: size.id,
    theme: body.theme || store.themes[0],
    postcode: (body.postcode || "").toUpperCase(),
    address: "",
    date: body.date || minDate(store),
    price: isBooking ? priced.price : 0,
    delivery: isBooking && zoneOk ? (zone!.fee as number) : 0,
    status: "Order received",
    depositPaid: 0,
  };

  // Real deposit payment via Stripe Checkout (server-side, env-driven).
  if (isBooking && serverStripeEnabled()) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
      store.orders.unshift(order);
      await repo.write(store);
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "gbp",
              product_data: { name: `${product.name} (${size.name}) — ${payInFull ? "full payment" : "deposit"} · ${id}` },
              unit_amount: Math.round(deposit * 100),
            },
            quantity: 1,
          },
        ],
        customer_email: custContact.includes("@") ? custContact : undefined,
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
