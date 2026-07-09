"use client";

import { useMemo, useState } from "react";
import type { Store } from "@/lib/types";
import { computeFinance, type FinanceBasis } from "@/lib/finance";
import { gbp } from "@/lib/pricing";
import PLStatement from "./PLStatement";

const card = "bg-white rounded-2xl shadow-card";
const numInput = "border-2 border-blush rounded-xl font-bold bg-cream text-plum font-sans";
const fieldLabel = "flex flex-col gap-1.5 text-[12.5px] font-extrabold text-gold";

const BASES: { id: FinanceBasis; label: string; sub: string }[] = [
  { id: "all", label: "All orders", sub: "everything booked" },
  { id: "active", label: "Pipeline", sub: "not yet delivered" },
  { id: "delivered", label: "Delivered", sub: "realised income" },
];

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export default function FinanceTab({
  store,
  setSetting,
  onSelectOrder,
  onNavigate,
}: {
  store: Store;
  setSetting: <K extends keyof Store["settings"]>(key: K, value: Store["settings"][K]) => void;
  onSelectOrder: (id: string) => void;
  onNavigate: (tab: "orders" | "pricing" | "zones") => void;
}) {
  const [basis, setBasis] = useState<FinanceBasis>("all");
  const fin = useMemo(() => computeFinance(store, basis), [store, basis]);

  const kpis = [
    { label: "GROSS REVENUE", value: gbp(round(fin.grossRevenue)), sub: `${fin.orderCount} orders · incl. delivery`, color: "#4A2C4D", go: () => onNavigate("orders") },
    { label: "TOTAL COSTS", value: gbp(round(fin.totalCosts)), sub: "materials · delivery", color: "#c14a3e", go: () => onNavigate("pricing") },
    { label: fin.vatRegistered ? "TAX + VAT" : "TAX SET ASIDE", value: gbp(round(fin.tax + fin.vatOnSales)), sub: fin.vatRegistered ? `${fin.taxRatePct}% profit + ${fin.vatRatePct}% VAT` : `${fin.taxRatePct}% of profit`, color: "#8a6a3a" },
    { label: "NET PROFIT (SHARED)", value: gbp(round(fin.netProfit)), sub: `${gbp(round(fin.perOwner))} each · ${fin.netMarginPct.toFixed(1)}% margin`, color: fin.netProfit >= 0 ? "#3c7a3c" : "#c14a3e" },
  ];

  return (
    <>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-1">
        <h1 className="font-display m-0" style={{ fontSize: 30 }}>Finance</h1>
        <div className="flex gap-1 bg-white rounded-full shadow-card" style={{ padding: 4 }}>
          {BASES.map((b) => (
            <button
              key={b.id}
              onClick={() => setBasis(b.id)}
              title={b.sub}
              className="cursor-pointer border-0 font-sans font-extrabold text-[13px] rounded-full"
              style={{
                padding: "8px 16px",
                minHeight: 40,
                background: basis === b.id ? "#FF6F61" : "transparent",
                color: basis === b.id ? "#fff" : "#9a839c",
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
      <p className="m-0 mb-6 text-plum-soft text-[15px]">
        A live profit-and-loss view — what you take, what it costs, what the taxman gets, and what you both share.
        You take no wage, so your time isn&apos;t a cost — it&apos;s part of the net profit. Showing{" "}
        <strong>{BASES.find((b) => b.id === basis)?.label.toLowerCase()}</strong>.
      </p>

      {/* KPI cards (clickable where they lead somewhere) */}
      <div className="grid gap-3.5 mb-7" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {kpis.map((k) => (
          <button
            key={k.label}
            onClick={k.go}
            disabled={!k.go}
            className={`${card} text-left font-sans`}
            style={{ padding: 20, border: "none", cursor: k.go ? "pointer" : "default" }}
          >
            <p className="m-0 mb-1.5 text-xs font-extrabold text-gold flex items-center gap-1" style={{ letterSpacing: "1.5px" }}>
              {k.label} {k.go && <span style={{ color: "#D4AF7A" }}>→</span>}
            </p>
            <p className="m-0 font-display font-bold" style={{ fontSize: 30, color: k.color }}>{k.value}</p>
            <p className="mt-1 mb-0 text-[12.5px] text-plum-soft">{k.sub}</p>
          </button>
        ))}
      </div>

      {/* Profit & loss statement */}
      <div className={card} style={{ padding: "8px 22px 16px", marginBottom: 28 }}>
        <h2 className="font-display" style={{ fontSize: 22, margin: "16px 0 6px" }}>Profit &amp; loss</h2>
        <PLStatement fin={fin} />
      </div>

      {/* Assumptions */}
      <h2 className="font-display m-0 mb-3.5" style={{ fontSize: 22 }}>Assumptions</h2>
      <div className="flex gap-3.5 flex-wrap mb-7 items-stretch">
        <label className={`${fieldLabel} ${card}`} style={{ padding: "16px 18px", letterSpacing: "1px" }}>
          PROFIT TAX RATE (%)
          <input type="number" step="1" value={store.settings.taxRatePct} onChange={(e) => setSetting("taxRatePct", parseFloat(e.target.value) || 0)} className={numInput} style={{ padding: "10px 12px", fontSize: 17, width: 110 }} />
        </label>
        <label className={`${fieldLabel} ${card}`} style={{ padding: "16px 18px", letterSpacing: "1px" }}>
          DELIVERY COST (% OF FEE)
          <input type="number" step="5" value={store.settings.deliveryCostPct} onChange={(e) => setSetting("deliveryCostPct", parseFloat(e.target.value) || 0)} className={numInput} style={{ padding: "10px 12px", fontSize: 17, width: 110 }} />
        </label>
        <div className={`${card} flex flex-col gap-2`} style={{ padding: "16px 18px" }}>
          <span className="text-[12.5px] font-extrabold text-gold" style={{ letterSpacing: "1px" }}>VAT REGISTERED</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSetting("vatRegistered", !store.settings.vatRegistered)}
              className="cursor-pointer border-0 rounded-full font-sans font-extrabold text-[13px]"
              style={{
                padding: "9px 16px",
                minHeight: 42,
                background: store.settings.vatRegistered ? "#3c7a3c" : "#EDEAEE",
                color: store.settings.vatRegistered ? "#fff" : "#7a5f7d",
              }}
            >
              {store.settings.vatRegistered ? "Yes ✓" : "No"}
            </button>
            {store.settings.vatRegistered && (
              <label className="flex items-center gap-1.5 text-[12.5px] font-bold text-plum-soft">
                VAT %
                <input type="number" step="1" value={store.settings.vatRatePct} onChange={(e) => setSetting("vatRatePct", parseFloat(e.target.value) || 0)} className={numInput} style={{ padding: "8px 10px", fontSize: 15, width: 66 }} />
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Per-order breakdown — click a row for that order's full P&L */}
      <h2 className="font-display m-0 mb-1" style={{ fontSize: 22 }}>Per-order breakdown</h2>
      <p className="m-0 mb-3.5 text-plum-soft text-[13.5px]">Click any order to open its own profit &amp; loss.</p>
      <div className={card} style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #F3C6C6" }}>
              {["Order", "Piece", "Status", "Revenue", "Materials", "Delivery cost", "Your time", "Net profit"].map((h, i) => (
                <th key={h} style={{ textAlign: i < 3 ? "left" : "right", padding: "12px 16px", fontSize: 11.5, letterSpacing: "0.5px", color: "#9a839c", fontWeight: 800, whiteSpace: "nowrap" }}>
                  {h.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fin.rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => onSelectOrder(r.id)}
                className="jn-row"
                style={{ borderBottom: "1px solid #FBF7F2", cursor: "pointer" }}
              >
                <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>
                  {r.id}
                  <span style={{ display: "block", fontSize: 11.5, color: "#7a5f7d", fontWeight: 600 }}>{r.customer}</span>
                </td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: "#7a5f7d", whiteSpace: "nowrap" }}>{r.productName}</td>
                <td style={{ padding: "12px 16px", fontSize: 12.5, color: "#7a5f7d", whiteSpace: "nowrap" }}>{r.status}</td>
                <td style={cellNum()}>{gbp(round(r.revenue))}</td>
                <td style={cellNum("#7a5f7d")}>{gbp(round(r.materials))}</td>
                <td style={cellNum("#7a5f7d")}>{gbp(round(r.deliveryCost))}</td>
                <td style={cellNum("#7a5f7d", 600)}>{r.labourHours.toFixed(1)}h</td>
                <td style={cellNum(r.grossProfit >= 0 ? "#3c7a3c" : "#c14a3e", 800)}>{gbp(round(r.grossProfit))}</td>
              </tr>
            ))}
            {fin.rows.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: "20px 16px", textAlign: "center", color: "#7a5f7d", fontSize: 13.5 }}>
                  No orders in this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <style>{`.jn-row:hover td { background: #FFF6F4; }`}</style>
    </>
  );
}

function cellNum(color = "#4A2C4D", weight = 700): React.CSSProperties {
  return { padding: "12px 16px", fontSize: 13.5, textAlign: "right", color, fontWeight: weight, whiteSpace: "nowrap" };
}
