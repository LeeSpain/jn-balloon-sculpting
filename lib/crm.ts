// CRM helpers shared by the booking route (auto-create/update contacts) and the
// admin UI (history, totals, follow-ups, anniversaries, outreach links).
import type { Store, Contact, ContactStatus, Order } from "./types";
import { uid } from "./ids";

export const CONTACT_STATUSES: ContactStatus[] = [
  "New enquiry",
  "Quoted",
  "Booked",
  "Delivered",
  "Repeat customer",
];
const RANK: Record<ContactStatus, number> = {
  "New enquiry": 0,
  Quoted: 1,
  Booked: 2,
  Delivered: 3,
  "Repeat customer": 4,
};

export function isEmail(v: string): boolean {
  return v.includes("@");
}

// Normalise a contact detail for matching: emails lowercased, phones to digits.
export function normContact(v: string | undefined): string {
  const s = String(v || "").trim();
  if (!s) return "";
  return isEmail(s) ? s.toLowerCase() : s.replace(/\D/g, "");
}

export function findContact(store: Store, raw: string): Contact | null {
  const k = normContact(raw);
  if (!k) return null;
  return (
    (store.contacts || []).find(
      (c) => (c.email && normContact(c.email) === k) || (c.phone && normContact(c.phone) === k),
    ) || null
  );
}

// An order belongs to a contact if the order's contact detail matches either the
// contact's email or phone.
export function ordersForContact(store: Store, contact: Contact): Order[] {
  const keys = [normContact(contact.email), normContact(contact.phone)].filter(Boolean);
  return (store.orders || []).filter(
    (o) => keys.includes(normContact(o.phone)) || (o.email && keys.includes(normContact(o.email))),
  );
}

// Money actually received / due: deposits paid, plus the full total for delivered
// orders that predate card payments (assumed settled on delivery).
export function totalSpent(orders: Order[]): number {
  return Math.round(
    orders.reduce((sum, o) => {
      const total = (o.price || 0) + (o.delivery || 0);
      const paid = o.depositPaid && o.depositPaid > 0 ? o.depositPaid : o.status === "Delivered" ? total : 0;
      return sum + paid;
    }, 0),
  );
}

function higher(a: ContactStatus, b: ContactStatus): ContactStatus {
  return RANK[a] >= RANK[b] ? a : b;
}

export interface ContactSeed {
  name: string;
  rawContact?: string; // the email OR phone the customer entered (legacy single field)
  email?: string; // explicit email (preferred — booking now captures both)
  phone?: string; // explicit mobile
  postcode: string;
  source: string;
  status: ContactStatus;
  consent: boolean;
  occasion: string;
  occasionDate: string;
  note?: string; // a customer note to append to the contact's history
  nowISO: string;
}

// Create or update a contact from an order/enquiry. Mutates store.contacts and
// returns the contact. Never downgrades an existing pipeline status.
export function upsertContactFromOrder(store: Store, seed: ContactSeed): Contact {
  if (!store.contacts) store.contacts = [];
  // Prefer the explicit email/phone; fall back to parsing the legacy rawContact.
  const raw = (seed.rawContact || "").trim();
  const email = (seed.email || (isEmail(raw) ? raw : "")).trim();
  const phone = (seed.phone || (isEmail(raw) ? "" : raw)).trim();
  const noteLine = seed.note
    ? `${prettyDate(seed.nowISO.slice(0, 10))} · ${seed.occasion || "enquiry"}: ${seed.note}`
    : "";
  let c = findContact(store, email || phone || raw);
  if (!c) {
    c = {
      id: uid("c"),
      name: seed.name,
      email,
      phone,
      postcode: seed.postcode,
      source: seed.source,
      status: seed.status,
      notes: noteLine,
      followUpDate: "",
      marketingConsent: seed.consent,
      occasion: seed.occasion,
      occasionDate: seed.occasionDate,
      createdAt: seed.nowISO,
    };
    store.contacts.unshift(c);
  } else {
    c.name = seed.name || c.name;
    if (email) c.email = email;
    if (phone) c.phone = phone;
    c.postcode = seed.postcode || c.postcode;
    if (seed.consent) c.marketingConsent = true; // opt-in is sticky; never revoke on a missed tick
    c.status = higher(c.status, seed.status);
    if (seed.occasion) c.occasion = seed.occasion;
    if (seed.occasionDate) c.occasionDate = seed.occasionDate;
    if (noteLine) c.notes = c.notes ? `${c.notes}\n${noteLine}` : noteLine;
  }
  return c;
}

// ---- Overview widgets ----

export interface FollowUp {
  contact: Contact;
  due: string; // ISO
  overdue: boolean;
}

// Follow-ups due today/overdue, plus the next `days` ahead.
export function followUpsDue(store: Store, todayISO: string, days = 7): FollowUp[] {
  const horizon = addDays(todayISO, days);
  return (store.contacts || [])
    .filter((c) => c.followUpDate && c.followUpDate <= horizon)
    .map((c) => ({ contact: c, due: c.followUpDate, overdue: c.followUpDate < todayISO }))
    .sort((a, b) => a.due.localeCompare(b.due));
}

export interface Anniversary {
  contact: Contact | null;
  name: string;
  occasion: string;
  originalDate: string;
  nextDate: string; // ISO of the upcoming anniversary
  yearsAgo: number;
}

// Orders whose delivery date recurs within the next `days` — gold for a friendly
// "you booked X a year ago" nudge.
export function anniversaries(store: Store, todayISO: string, days = 30): Anniversary[] {
  const horizon = addDays(todayISO, days);
  const out: Anniversary[] = [];
  for (const o of store.orders || []) {
    if (!o.date || o.date >= todayISO) continue; // only past events
    const next = nextAnniversaryISO(o.date, todayISO);
    if (next >= todayISO && next <= horizon) {
      const contact = (store.contacts || []).find((c) => normContact(c.phone) === normContact(o.phone) || normContact(c.email) === normContact(o.phone)) || null;
      const product = store.products.find((p) => p.id === o.product);
      out.push({
        contact,
        name: o.customer.replace(" (custom enquiry)", ""),
        occasion: product?.name || o.product,
        originalDate: o.date,
        nextDate: next,
        yearsAgo: yearsBetween(o.date, next),
      });
    }
  }
  return out.sort((a, b) => a.nextDate.localeCompare(b.nextDate));
}

// ---- outreach ----

export function fillTemplate(tpl: string, contact: Contact): string {
  return (tpl || "")
    .replace(/\{name\}/g, contact.name || "there")
    .replace(/\{occasion\}/g, contact.occasion || "celebration")
    .replace(/\{date\}/g, contact.occasionDate ? prettyDate(contact.occasionDate) : "");
}

export function mailtoLink(contact: Contact, template: string): string {
  const subject = "J&N Balloon Sculpting";
  return `mailto:${encodeURIComponent(contact.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fillTemplate(template, contact))}`;
}

// wa.me needs an international number with no +/spaces. Assume UK if it starts 0.
export function waLink(contact: Contact, template: string): string {
  let digits = (contact.phone || "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "44" + digits.slice(1);
  return `https://wa.me/${digits}?text=${encodeURIComponent(fillTemplate(template, contact))}`;
}

export function contactsToCsv(store: Store): string {
  const head = ["Name", "Email", "Phone", "Postcode", "Status", "Source", "Marketing consent", "Occasion", "Occasion date", "Follow-up", "Total spent (£)", "Orders", "Notes"];
  const rows = (store.contacts || []).map((c) => {
    const os = ordersForContact(store, c);
    return [
      c.name, c.email, c.phone, c.postcode, c.status, c.source,
      c.marketingConsent ? "yes" : "no", c.occasion, c.occasionDate, c.followUpDate,
      String(totalSpent(os)), String(os.length), (c.notes || "").replace(/\s+/g, " "),
    ].map(csvCell).join(",");
  });
  return [head.join(","), ...rows].join("\r\n");
}

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

// ---- date helpers (contact/order dates are plain ISO yyyy-mm-dd) ----

export function prettyDate(iso: string): string {
  const d = new Date(iso + "T12:00");
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T12:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function nextAnniversaryISO(pastISO: string, todayISO: string): string {
  const past = new Date(pastISO + "T12:00");
  const today = new Date(todayISO + "T12:00");
  const candidate = new Date(past);
  candidate.setFullYear(today.getFullYear());
  if (candidate < today) candidate.setFullYear(today.getFullYear() + 1);
  return candidate.toISOString().slice(0, 10);
}
function yearsBetween(fromISO: string, toISO: string): number {
  return Math.max(1, Math.round((new Date(toISO).getTime() - new Date(fromISO).getTime()) / (365.25 * 864e5)));
}
