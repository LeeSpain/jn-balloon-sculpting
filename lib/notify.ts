// Notification hook for new bookings.
//
// Stub for now: logs to the server console. Wire a real email/SMS provider
// (Resend, Postmark, Twilio …) here before launch so bookings reach Jade & Nicole.
import type { Order } from "./types";

export async function notifyNewBooking(order: Order, productName: string): Promise<void> {
  const to = process.env.BOOKING_NOTIFY_EMAIL || "hello@jnballoons.co.uk";
  const lines = [
    `New booking ${order.id} (${order.status})`,
    `Customer: ${order.customer} — ${order.phone}`,
    `Piece: ${productName} (${order.size}), theme ${order.theme}`,
    `Deliver: ${order.date} to ${order.postcode}`,
    `Price: £${order.price} + delivery £${order.delivery}`,
  ];
  // TODO: replace with real email send to `to`.
  console.log(`[notify → ${to}]\n${lines.join("\n")}`);
}
