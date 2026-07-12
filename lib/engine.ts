// J&N Balloon Sculpting — pricing engine.
// Ported verbatim (in behaviour) from the prototype's engine.js, now typed and
// framework-agnostic. No storage concerns live here — the data layer owns persistence.

import type { PricingContext, Product, Zone } from './types';

export function offsetDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface Priced {
  materials: number;
  labour: number;
  cost: number;
  price: number;
}

export function materialCost(ctx: PricingContext, product: Product, sizeMult = 1): number {
  let sum = 0;
  for (const [mid, qty] of Object.entries(product.recipe || {})) {
    const m = ctx.materials.find((x) => x.id === mid);
    if (m) sum += m.cost * qty * sizeMult;
  }
  return sum;
}

export function priceProduct(ctx: PricingContext, product: Product, sizeMult = 1): Priced {
  const mats = materialCost(ctx, product, sizeMult);
  const labour = product.buildHours * sizeMult * ctx.settings.labourRate;
  const cost = mats + labour;
  const price = Math.ceil(cost * (1 + ctx.settings.markupPct / 100));
  return { materials: round2(mats), labour: round2(labour), cost: round2(cost), price };
}

// Resolve a UK postcode to a delivery zone. Returns null for unparseable input,
// or a synthetic "outside" zone (fee null) for postcodes beyond all zones.
export function zoneForPostcode(ctx: PricingContext, postcode: string): Zone | null {
  const m = String(postcode || '')
    .trim()
    .toUpperCase()
    .match(/^([A-Z]{1,2}\d{1,2})/);
  if (!m) return null;
  const district = m[1];
  for (const z of ctx.zones) {
    if ((z.districts || []).includes(district)) return z;
  }
  return { id: 'outside', name: 'Beyond 30 miles', range: '', fee: null, areas: '', districts: [] };
}

export function minDate(ctx: PricingContext): string {
  return offsetDate(ctx.settings.leadDays);
}

export function depositFor(ctx: PricingContext, total: number): number {
  const s = ctx.settings;
  if (s.depositType === 'full') return total;
  if (s.depositType === 'fixed') return Math.min(s.depositValue, total);
  return round2((total * s.depositValue) / 100);
}

// Compute the stock levels after an order's recipe is consumed. Pure — the data
// layer applies the returned deltas. Mirrors the prototype's consumeStock().
export function stockAfterConsume(
  ctx: PricingContext,
  productId: string,
  sizeId: string
): Record<string, number> {
  const changes: Record<string, number> = {};
  const p = ctx.products.find((x) => x.id === productId);
  if (!p || !p.recipe) return changes;
  const sz = ctx.sizes.find((s) => s.id === sizeId);
  const mult = sz ? sz.mult : 1;
  for (const [mid, qty] of Object.entries(p.recipe)) {
    const m = ctx.materials.find((x) => x.id === mid);
    if (m && m.stock != null) {
      changes[mid] = Math.max(0, Math.round((m.stock - qty * mult) * 10) / 10);
    }
  }
  return changes;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function gbp(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return '—';
  return '£' + (Number.isInteger(Number(n)) ? Number(n) : Number(n).toFixed(2));
}
