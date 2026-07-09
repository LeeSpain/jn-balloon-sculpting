// J&N Balloon Sculpting — pricing engine
// Ported verbatim (logic-preserving) from the design bundle's engine.js.
import type { Product, Store, PriceBreakdown, Zone, Material } from "./types";

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

// Cost of a single individual unit (e.g. one balloon out of a pack of 100).
export function perUnitCost(m: Material): number {
  const packSize = m.packSize && m.packSize > 0 ? m.packSize : 1;
  return m.cost / packSize;
}

export function materialCost(store: Store, product: Product, sizeMult = 1): number {
  let sum = 0;
  for (const [mid, qty] of Object.entries(product.recipe || {})) {
    const m = store.materials.find((x) => x.id === mid);
    if (m) sum += perUnitCost(m) * qty * sizeMult;
  }
  return sum;
}

export interface RecipeLine {
  id: string;
  name: string;
  unitLabel: string; // "balloon", "roll", "each" …
  qty: number; // individual units used (already size-adjusted)
  perUnit: number; // cost of one unit
  lineCost: number; // perUnit * qty
  packSize: number;
}

// Break a product's material cost into individual line items — e.g.
// "Latex balloon × 200 @ £0.065 = £13.00" — so the cost is never just one lump.
export function recipeBreakdown(store: Store, product: Product, sizeMult = 1): RecipeLine[] {
  const lines: RecipeLine[] = [];
  for (const [mid, qty] of Object.entries(product.recipe || {})) {
    const m = store.materials.find((x) => x.id === mid);
    if (!m) continue;
    const packSize = m.packSize && m.packSize > 0 ? m.packSize : 1;
    const perUnit = perUnitCost(m);
    const q = qty * sizeMult;
    lines.push({
      id: mid,
      name: m.name,
      unitLabel: m.unitLabel || m.unit,
      qty: q,
      perUnit,
      lineCost: perUnit * q,
      packSize,
    });
  }
  return lines;
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
