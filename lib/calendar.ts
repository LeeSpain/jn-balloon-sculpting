// Calendar + availability engine. Isomorphic (used by the booking route, the admin
// calendar, and the iCal feed). All dates are plain ISO yyyy-mm-dd.
import type { Store, Order, CalendarBlock, Contact, Assignee } from "./types";
import { minDate } from "./pricing";

export type EventType = "delivery" | "build" | "followup" | "block" | "personal";

export interface CalEvent {
  id: string;
  type: EventType;
  date: string;
  title: string;
  subtitle: string;
  assignee?: Assignee;
  orderId?: string;
  contactId?: string;
  blockId?: string;
  phone?: string; // customer mobile (delivery/build events) — for one-tap call/WhatsApp
  notes?: string; // customer note (delivery event)
}

export const EVENT_STYLE: Record<EventType, { bg: string; fg: string }> = {
  delivery: { bg: "#FF6F61", fg: "#fff" }, // coral
  build: { bg: "#D4AF7A", fg: "#4A2C4D" }, // gold
  followup: { bg: "#7BB6E0", fg: "#123" }, // blue
  block: { bg: "#B8A0BC", fg: "#2b192e" }, // muted plum (unavailable)
  personal: { bg: "#E7DDEA", fg: "#4A2C4D" }, // light plum (info)
};

// ---- date helpers ----
export function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + "T12:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
export function weekdayOf(iso: string): number {
  return new Date(iso + "T12:00").getDay();
}
function compact(iso: string): string {
  return iso.replace(/-/g, "");
}

// ---- build slots ----
export function isHelium(store: Store, productId: string): boolean {
  return store.products.find((p) => p.id === productId)?.fill === "helium";
}
// Helium floats only hours, so it must be built the same day it's delivered.
export function defaultBuildDate(store: Store, order: Order): string {
  return isHelium(store, order.product) ? order.date : addDaysISO(order.date, -1);
}
export function buildDateFor(store: Store, order: Order): string {
  return order.buildDate || defaultBuildDate(store, order);
}

// ---- availability ----
export function blockOccursOn(block: CalendarBlock, dateISO: string): boolean {
  if (block.recurrence === "weekly") {
    return block.date <= dateISO && weekdayOf(block.date) === weekdayOf(dateISO);
  }
  return block.date === dateISO;
}
export function isDayBlocked(store: Store, dateISO: string): boolean {
  return (store.blocks || []).some((b) => b.kind === "blocked" && blockOccursOn(b, dateISO));
}
export function deliveriesOn(store: Store, dateISO: string): number {
  return (store.orders || []).filter((o) => o.date === dateISO && !o.archived).length;
}
export function maxPerDay(store: Store): number {
  return store.settings.maxDeliveriesPerDay > 0 ? store.settings.maxDeliveriesPerDay : 3;
}
// A customer may pick this delivery date only if it clears lead time, isn't blocked,
// and hasn't hit the daily delivery cap.
export function isDeliveryAvailable(store: Store, dateISO: string): boolean {
  return dateISO >= minDate(store) && !isDayBlocked(store, dateISO) && deliveriesOn(store, dateISO) < maxPerDay(store);
}
// Dates in the next `days` the customer date picker must exclude (blocked or full).
// Lead time is handled separately by the picker's minimum.
export function unavailableDates(store: Store, days = 120): string[] {
  const out: string[] = [];
  const start = new Date().toISOString().slice(0, 10);
  for (let i = 0; i <= days; i++) {
    const d = addDaysISO(start, i);
    if (isDayBlocked(store, d) || deliveriesOn(store, d) >= maxPerDay(store)) out.push(d);
  }
  return out;
}

// ---- events in a range ----
export function eventsInRange(store: Store, fromISO: string, toISO: string): CalEvent[] {
  const inRange = (d: string) => d >= fromISO && d <= toISO;
  const events: CalEvent[] = [];
  const productName = (id: string) => store.products.find((p) => p.id === id)?.name || id;

  for (const o of store.orders || []) {
    if (o.archived) continue; // cancelled — no build/delivery events
    if (inRange(o.date)) {
      events.push({
        id: `del-${o.id}`, type: "delivery", date: o.date,
        title: productName(o.product), subtitle: `${o.customer} · ${o.postcode}`,
        assignee: delivererOf(o), orderId: o.id, phone: o.phone, notes: o.notes,
      });
    }
    const bd = buildDateFor(store, o);
    if (inRange(bd)) {
      events.push({
        id: `bld-${o.id}`, type: "build", date: bd,
        title: `Build: ${productName(o.product)}`, subtitle: `${o.customer}${isHelium(store, o.product) ? " · helium, same-day" : ""}`,
        assignee: makerOf(o), orderId: o.id, phone: o.phone, notes: o.notes,
      });
    }
  }
  for (const c of store.contacts || []) {
    if (c.followUpDate && inRange(c.followUpDate)) {
      events.push({
        id: `fu-${c.id}`, type: "followup", date: c.followUpDate,
        title: `Follow up: ${c.name}`, subtitle: c.status, assignee: c.assignee, contactId: c.id,
      });
    }
  }
  // Blocks: expand weekly recurrences across the range.
  for (const b of store.blocks || []) {
    if (b.recurrence === "weekly") {
      for (let d = fromISO; d <= toISO; d = addDaysISO(d, 1)) {
        if (blockOccursOn(b, d)) events.push(blockEvent(b, d));
      }
    } else if (inRange(b.date)) {
      events.push(blockEvent(b, b.date));
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date));
}
function blockEvent(b: CalendarBlock, date: string): CalEvent {
  return {
    id: `blk-${b.id}-${date}`, type: b.kind === "blocked" ? "block" : "personal", date,
    title: b.title || (b.kind === "blocked" ? "Blocked" : "Personal"), subtitle: b.kind === "blocked" ? "no deliveries" : "",
    assignee: b.assignee, blockId: b.id,
  };
}

// ---- conflicts ----
export interface Conflict { date: string; message: string; }
export function conflicts(store: Store, fromISO: string, toISO: string): Conflict[] {
  const out: Conflict[] = [];
  const seenDays = new Set<string>();
  for (const o of store.orders || []) {
    if (o.archived) continue;
    if (o.date >= fromISO && o.date <= toISO && !seenDays.has(o.date)) {
      seenDays.add(o.date);
      const n = deliveriesOn(store, o.date);
      if (n > maxPerDay(store)) out.push({ date: o.date, message: `${n} deliveries on ${o.date} — over the ${maxPerDay(store)}/day cap` });
    }
    const bd = buildDateFor(store, o);
    if (bd >= fromISO && bd <= toISO && isDayBlocked(store, bd)) {
      out.push({ date: bd, message: `Build for ${o.customer} falls on a blocked day (${bd})` });
    }
  }
  return out;
}

// ---- iCal ----
function esc(s: string): string {
  return (s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}
export function toICS(store: Store, stampISO: string): string {
  const from = addDaysISO(stampISO, -30);
  const to = addDaysISO(stampISO, 180);
  const stamp = compact(stampISO) + "T000000Z";
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//J&N Balloon Sculpting//Calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:J&N Balloon Sculpting"];
  for (const e of eventsInRange(store, from, to)) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@jnballoons`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(e.date)}`,
      `DTEND;VALUE=DATE:${compact(addDaysISO(e.date, 1))}`,
      `SUMMARY:${esc(e.title)}${e.assignee ? esc(" (" + e.assignee + ")") : ""}`,
      `DESCRIPTION:${esc(e.subtitle)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export const ASSIGNEES: Assignee[] = ["Jade", "Nicole", "Both"];
// Small helper so the follow-up widgets and calendar agree on "today".
export function contactHasFollowUp(c: Contact): boolean {
  return !!c.followUpDate;
}

// ---- triage: making vs delivering ----
// Who builds it (calendar build slot). Falls back to the legacy single owner.
export function makerOf(o: Order): Assignee | undefined {
  return o.maker || o.assignee;
}
// Who delivers it (calendar delivery event).
export function delivererOf(o: Order): Assignee | undefined {
  return o.deliverer || o.assignee;
}
// A person is "on" this order if they make OR deliver it (for the by-person filter).
export function personOnOrder(o: Order, who: Assignee): boolean {
  const m = makerOf(o), d = delivererOf(o);
  const covers = (a: Assignee | undefined) => a === who || a === "Both" || who === "Both";
  return covers(m) || covers(d);
}

// An order needs triage until someone has acknowledged it.
export function isUnacknowledged(o: Order): boolean {
  return o.acknowledged !== true;
}
export function unacknowledgedOrders(store: Store): Order[] {
  return (store.orders || []).filter((o) => isUnacknowledged(o) && !o.archived);
}
// Whole days an order has waited since it was placed (for the >24h / "waiting N days" flag).
export function daysWaiting(o: Order, nowISO: string): number {
  if (!o.createdAt) return 0;
  const then = new Date(o.createdAt).getTime();
  const now = new Date(nowISO).getTime();
  return Math.max(0, Math.floor((now - then) / 86400000));
}
