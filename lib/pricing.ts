// J&N Balloon Sculpting — pricing engine
// Ported verbatim (logic-preserving) from the design bundle's engine.js.
import type { Product, Store, PriceBreakdown, Zone } from "./types";

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function gbp(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return "—";
  return "£" + (Number.isInteger(Number(n)) ? Number(n) : Number(n).toFixed(2));
}

export function offsetDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function materialCost(store: Store, product: Product, sizeMult = 1): number {
  let sum = 0;
  for (const [mid, qty] of Object.entries(product.recipe || {})) {
    const m = store.materials.find((x) => x.id === mid);
    if (m) sum += m.cost * qty * sizeMult;
  }
  return sum;
}

export function priceProduct(store: Store, product: Product, sizeMult = 1): PriceBreakdown {
  const mats = materialCost(store, product, sizeMult);
  const labour = product.buildHours * sizeMult * store.settings.labourRate;
  const cost = mats + labour;
  const price = Math.ceil(cost * (1 + store.settings.markupPct / 100));
  return { materials: round2(mats), labour: round2(labour), cost: round2(cost), price };
}

export function zoneForPostcode(store: Store, postcode: string): Zone | null {
  const m = String(postcode || "")
    .trim()
    .toUpperCase()
    .match(/^([A-Z]{1,2}\d{1,2})/);
  if (!m) return null;
  const district = m[1];
  for (const z of store.zones) {
    if ((z.districts || []).includes(district)) return z;
  }
  return { id: "outside", name: "Beyond 30 miles", range: "", fee: null, areas: "" };
}

export function minDate(store: Store): string {
  return offsetDate(store.settings.leadDays);
}

export function depositFor(store: Store, total: number): number {
  const s = store.settings;
  if (s.depositType === "full") return total;
  if (s.depositType === "fixed") return Math.min(s.depositValue, total);
  return round2((total * s.depositValue) / 100);
}

// Deduct an order's recipe from stock (called when materials are purchased)
export function consumeStock(store: Store, productId: string, sizeId: string): void {
  const p = store.products.find((x) => x.id === productId);
  if (!p || !p.recipe) return;
  const sz = store.sizes.find((s) => s.id === sizeId);
  const mult = sz ? sz.mult : 1;
  for (const [mid, qty] of Object.entries(p.recipe)) {
    const m = store.materials.find((x) => x.id === mid);
    if (m && m.stock != null) m.stock = Math.max(0, Math.round((m.stock - qty * mult) * 10) / 10);
  }
}

export function stripeEnabled(store: Store): boolean {
  const s = store.settings;
  return (s.stripePublishable || "").startsWith("pk_") && (s.stripeSecret || "").length > 4;
}
