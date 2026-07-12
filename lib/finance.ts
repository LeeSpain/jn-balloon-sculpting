// Finance / profit-and-loss computation for the admin dashboard.
//
// Jade & Nicole OWN the business and do NOT draw a wage — they share the net
// profit after real costs. So their build time (labour) is NOT treated as a
// cost here: the only cash costs are materials and delivery. Labour hours are
// tracked purely for reference (to show the effective £/hr they earn).
//
// Costs are derived from the current recipes and rates (the data model doesn't
// snapshot historical costs, so figures reflect today's rates).
import type { Store } from "./types";
import { priceProduct } from "./pricing";

export const OWNER_COUNT = 2; // Jade & Nicole
export const OWNER_NAMES = ["Jade", "Nicole"];

export type FinanceBasis = "all" | "active" | "delivered";

export interface OrderFinance {
  id: string;
  customer: string;
  status: string;
  date: string;
  productName: string;
  sales: number; // product price
  deliveryIncome: number;
  revenue: number; // sales + delivery (what the customer pays)
  materials: number;
  deliveryCost: number;
  totalCost: number; // materials + delivery (cash costs only — no wage)
  labourHours: number; // owners' build time (reference only, not a cost)
  labourValue: number; // notional value of that time (reference only)
  grossProfit: number; // revenue - totalCost (pre-tax, pre-VAT)
}

export interface FinanceSummary {
  basis: FinanceBasis;
  orderCount: number;
  productSales: number;
  deliveryIncome: number;
  grossRevenue: number; // VAT-inclusive if registered
  vatOnSales: number; // extracted output VAT (0 if not registered)
  netRevenue: number; // ex-VAT
  materials: number;
  deliveryCost: number;
  totalCosts: number; // materials + delivery (no wage)
  profitBeforeTax: number;
  taxRatePct: number;
  tax: number;
  netProfit: number; // shared between the owners
  netMarginPct: number;
  ownerCount: number;
  perOwner: number; // net profit / owners
  labourHours: number; // total owner build time (reference)
  labourValue: number; // notional value of time (reference)
  effectiveHourly: number; // net profit / labour hours
  vatRegistered: boolean;
  vatRatePct: number;
  labourRate: number;
  deliveryCostPct: number;
  rows: OrderFinance[];
}

export function computeFinance(store: Store, basis: FinanceBasis): FinanceSummary {
  // Archived (cancelled) orders never count towards revenue or profit.
  let orders = store.orders.filter((o) => !o.archived);
  if (basis === "delivered") orders = orders.filter((o) => o.status === "Delivered");
  else if (basis === "active") orders = orders.filter((o) => o.status !== "Delivered");
  return computeFinanceForOrders(store, orders, basis);
}

// Build a full P&L statement for any set of orders — the aggregate views and a
// single order's detail all flow through here, so the maths stays identical.
export function computeFinanceForOrders(
  store: Store,
  orders: Store["orders"],
  basis: FinanceBasis = "all"
): FinanceSummary {
  const s = store.settings;
  const taxRatePct = s.taxRatePct ?? 0;
  const vatRegistered = !!s.vatRegistered;
  const vatRatePct = s.vatRatePct ?? 0;
  const deliveryCostPct = s.deliveryCostPct ?? 0;
  const rate = s.labourRate || 0;

  const rows: OrderFinance[] = orders.map((o) => {
    const p = store.products.find((x) => x.id === o.product);
    const sz = store.sizes.find((x) => x.id === o.size) || { id: o.size, name: "Standard", mult: 1 };
    const pr = p && p.recipe ? priceProduct(store, p, sz.mult) : { materials: 0, labour: 0, cost: 0, price: 0 };
    const sales = o.price || 0;
    const deliveryIncome = o.delivery || 0;
    const revenue = sales + deliveryIncome;
    const materials = pr.materials;
    const deliveryCost = (deliveryIncome * deliveryCostPct) / 100;
    const totalCost = materials + deliveryCost; // no wage — owners aren't paid
    const labourValue = pr.labour;
    const labourHours = rate > 0 ? pr.labour / rate : 0;
    return {
      id: o.id,
      customer: o.customer,
      status: o.status,
      date: o.date,
      productName: p?.name ?? o.product,
      sales,
      deliveryIncome,
      revenue,
      materials,
      deliveryCost,
      totalCost,
      labourHours,
      labourValue,
      grossProfit: revenue - totalCost,
    };
  });

  const sum = (f: (r: OrderFinance) => number) => rows.reduce((a, r) => a + f(r), 0);
  const productSales = sum((r) => r.sales);
  const deliveryIncome = sum((r) => r.deliveryIncome);
  const grossRevenue = productSales + deliveryIncome;
  const netRevenue = vatRegistered ? grossRevenue / (1 + vatRatePct / 100) : grossRevenue;
  const vatOnSales = grossRevenue - netRevenue;
  const materials = sum((r) => r.materials);
  const deliveryCost = sum((r) => r.deliveryCost);
  const totalCosts = materials + deliveryCost;
  const profitBeforeTax = netRevenue - totalCosts;
  const tax = profitBeforeTax > 0 ? (profitBeforeTax * taxRatePct) / 100 : 0;
  const netProfit = profitBeforeTax - tax;
  const netMarginPct = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;
  const labourHours = sum((r) => r.labourHours);
  const labourValue = sum((r) => r.labourValue);
  const effectiveHourly = labourHours > 0 ? netProfit / labourHours : 0;

  return {
    basis,
    orderCount: rows.length,
    productSales,
    deliveryIncome,
    grossRevenue,
    vatOnSales,
    netRevenue,
    materials,
    deliveryCost,
    totalCosts,
    profitBeforeTax,
    taxRatePct,
    tax,
    netProfit,
    netMarginPct,
    ownerCount: OWNER_COUNT,
    perOwner: netProfit / OWNER_COUNT,
    labourHours,
    labourValue,
    effectiveHourly,
    vatRegistered,
    vatRatePct,
    labourRate: s.labourRate,
    deliveryCostPct,
    rows,
  };
}
