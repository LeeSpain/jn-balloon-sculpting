// Notification hook for new/paid bookings.
//
// If RESEND_API_KEY is set, sends a real email via Resend's HTTP API (no SDK
// dependency needed). Otherwise falls back to logging to the server console —
// so the app works out of the box and "goes live" the moment the key is added.
import type { Order } from "./types";

export async function notifyNewBooking(order: Order, productName: string): Promise<void> {
  const to = process.env.BOOKING_NOTIFY_EMAIL || "hello@jnballoons.co.uk";
  const paid =
    order.depositPaid && order.depositPaid > 0 ? `£${order.depositPaid} paid` : "unpaid";
  const lines = [
    `New booking ${order.id} (${order.status}, ${paid})`,
    `Customer: ${order.customer} — ${order.phone}`,
    `Piece: ${productName} (${order.size}), theme ${order.theme}`,
    `Deliver: ${order.date} to ${order.postcode}`,
    `Price: £${order.price} + delivery £${order.delivery}`,
  ];
  const body = lines.join("\n");

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[notify → ${to}] (email provider not configured)\n${body}`);
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "J&N Bookings <bookings@jnballoons.co.uk>",
        to: [to],
        subject: `New booking ${order.id} — ${order.customer}`,
        text: body,
      }),
    });
    if (!res.ok) {
      console.error(`[notify] Resend responded ${res.status}: ${await res.text()}`);
    }
  } catch (e) {
    // Never let a notification failure break the booking flow.
    console.error("[notify] Failed to send booking email:", e);
  }
}
