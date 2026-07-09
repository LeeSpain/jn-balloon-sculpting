// Finance / profit-and-loss computation for the admin dashboard.
//
// Builds a clear statement: Gross revenue → costs → tax → net profit, both in
// aggregate and per order. Costs are derived from the current recipes and
// labour/markup settings (the data model doesn't snapshot historical costs, so
// figures reflect today's rates — matching how the Overview tab already works).
import type { Store } from "./types";
import { priceProduct } from "./pricing";

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
  labour: number;
  deliveryCost: number;
  totalCost: number;
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
  labour: number;
  deliveryCost: number;
  totalCosts: number;
  profitBeforeTax: number;
  taxRatePct: number;
  tax: number;
  netProfit: number;
  netMarginPct: number;
  vatRegistered: boolean;
  vatRatePct: number;
  labourRate: number;
  deliveryCostPct: number;
  rows: OrderFinance[];
}

export function computeFinance(store: Store, basis: FinanceBasis): FinanceSummary {
  const s = store.settings;
  const taxRatePct = s.taxRatePct ?? 0;
  const vatRegistered = !!s.vatRegistered;
  const vatRatePct = s.vatRatePct ?? 0;
  const deliveryCostPct = s.deliveryCostPct ?? 0;

  let orders = store.orders;
  if (basis === "delivered") orders = orders.filter((o) => o.status === "Delivered");
  else if (basis === "active") orders = orders.filter((o) => o.status !== "Delivered");

  const rows: OrderFinance[] = orders.map((o) => {
    const p = store.products.find((x) => x.id === o.product);
    const sz = store.sizes.find((x) => x.id === o.size) || { id: o.size, name: "Standard", mult: 1 };
    const pr = p && p.recipe ? priceProduct(store, p, sz.mult) : { materials: 0, labour: 0, cost: 0, price: 0 };
    const sales = o.price || 0;
    const deliveryIncome = o.delivery || 0;
    const revenue = sales + deliveryIncome;
    const materials = pr.materials;
    const labour = pr.labour;
    const deliveryCost = (deliveryIncome * deliveryCostPct) / 100;
    const totalCost = materials + labour + deliveryCost;
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
      labour,
      deliveryCost,
      totalCost,
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
  const labour = sum((r) => r.labour);
  const deliveryCost = sum((r) => r.deliveryCost);
  const totalCosts = materials + labour + deliveryCost;
  const profitBeforeTax = netRevenue - totalCosts;
  const tax = profitBeforeTax > 0 ? (profitBeforeTax * taxRatePct) / 100 : 0;
  const netProfit = profitBeforeTax - tax;
  const netMarginPct = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

  return {
    basis,
    orderCount: rows.length,
    productSales,
    deliveryIncome,
    grossRevenue,
    vatOnSales,
    netRevenue,
    materials,
    labour,
    deliveryCost,
    totalCosts,
    profitBeforeTax,
    taxRatePct,
    tax,
    netProfit,
    netMarginPct,
    vatRegistered,
    vatRatePct,
    labourRate: s.labourRate,
    deliveryCostPct,
    rows,
  };
}
