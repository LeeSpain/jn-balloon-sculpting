"use client";

import { useMemo, useState } from "react";
import type { Store } from "@/lib/types";
import { computeFinance, type FinanceBasis } from "@/lib/finance";
import { gbp } from "@/lib/pricing";

const card = "bg-white rounded-2xl shadow-card";
const numInput = "border-2 border-blush rounded-xl font-bold bg-cream text-plum font-sans";
const fieldLabel = "flex flex-col gap-1.5 text-[12.5px] font-extrabold text-gold";

const BASES: { id: FinanceBasis; label: string; sub: string }[] = [
  { id: "all", label: "All orders", sub: "everything booked" },
  { id: "active", label: "Pipeline", sub: "not yet delivered" },
  { id: "delivered", label: "Delivered", sub: "realised income" },
];

export default function FinanceTab({
  store,
  setSetting,
}: {
  store: Store;
  setSetting: <K extends keyof Store["settings"]>(key: K, value: Store["settings"][K]) => void;
}) {
  const [basis, setBasis] = useState<FinanceBasis>("all");
  const fin = useMemo(() => computeFinance(store, basis), [store, basis]);

  const kpis = [
    { label: "GROSS REVENUE", value: gbp(fin.grossRevenue), sub: `${fin.orderCount} orders · incl. delivery`, color: "#4A2C4D" },
    { label: "TOTAL COSTS", value: gbp(round(fin.totalCosts)), sub: "materials · labour · delivery", color: "#c14a3e" },
    { label: fin.vatRegistered ? "TAX + VAT" : "TAX SET ASIDE", value: gbp(round(fin.tax + fin.vatOnSales)), sub: fin.vatRegistered ? `${fin.taxRatePct}% profit + ${fin.vatRatePct}% VAT` : `${fin.taxRatePct}% of profit`, color: "#8a6a3a" },
    { label: "NET PROFIT", value: gbp(round(fin.netProfit)), sub: `${fin.netMarginPct.toFixed(1)}% net margin`, color: fin.netProfit >= 0 ? "#3c7a3c" : "#c14a3e" },
  ];

  return (
    <>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-1">
        <h1 className="font-display m-0" style={{ fontSize: 30 }}>Finance</h1>
        {/* Basis selector */}
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
        A live profit-and-loss view — what you take, what it costs, what the taxman gets, and what&apos;s left.
        Showing <strong>{BASES.find((b) => b.id === basis)?.label.toLowerCase()}</strong> ({BASES.find((b) => b.id === basis)?.sub}).
      </p>

      {/* KPI cards */}
      <div className="grid gap-3.5 mb-7" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {kpis.map((k) => (
          <div key={k.label} className={card} style={{ padding: 20 }}>
            <p className="m-0 mb-1.5 text-xs font-extrabold text-gold" style={{ letterSpacing: "1.5px" }}>{k.label}</p>
            <p className="m-0 font-display font-bold" style={{ fontSize: 30, color: k.color }}>{k.value}</p>
            <p className="mt-1 mb-0 text-[12.5px] text-plum-soft">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Profit & loss statement */}
      <div className={card} style={{ padding: "8px 22px 14px", marginBottom: 28 }}>
        <h2 className="font-display" style={{ fontSize: 22, margin: "16px 0 6px" }}>Profit &amp; loss</h2>
        <Line label="Product sales" value={fin.productSales} />
        <Line label="Delivery income" value={fin.deliveryIncome} />
        <Line label="Gross revenue" value={fin.grossRevenue} bold rule />
        {fin.vatRegistered && (
          <>
            <Line label={`VAT collected (${fin.vatRatePct}%)`} value={-fin.vatOnSales} muted />
            <Line label="Net revenue (ex-VAT)" value={fin.netRevenue} bold rule />
          </>
        )}
        <Spacer />
        <Line label="Materials" value={-fin.materials} muted />
        <Line label={`Labour (your time @ ${gbp(fin.labourRate)}/hr)`} value={-fin.labour} muted />
        <Line label={`Delivery costs (${fin.deliveryCostPct}% of fee)`} value={-fin.deliveryCost} muted />
        <Line label="Total costs" value={-fin.totalCosts} bold rule />
        <Spacer />
        <Line label="Profit before tax" value={fin.profitBeforeTax} bold color={fin.profitBeforeTax >= 0 ? "#3c7a3c" : "#c14a3e"} />
        <Line label={`Tax (${fin.taxRatePct}% of profit)`} value={-fin.tax} muted />
        <Line label="Net profit" value={fin.netProfit} bold rule big color={fin.netProfit >= 0 ? "#3c7a3c" : "#c14a3e"} />
        <p className="text-[12.5px] text-plum-soft m-0 mt-2">
          Net margin {fin.netMarginPct.toFixed(1)}% · figures use current recipe costs &amp; rates.
        </p>
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

      {/* Per-order breakdown */}
      <h2 className="font-display m-0 mb-3.5" style={{ fontSize: 22 }}>Per-order breakdown</h2>
      <div className={card} style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #F3C6C6" }}>
              {["Order", "Piece", "Status", "Revenue", "Materials", "Labour", "Delivery cost", "Gross profit"].map((h, i) => (
                <th key={h} style={{ textAlign: i < 3 ? "left" : "right", padding: "12px 16px", fontSize: 11.5, letterSpacing: "0.5px", color: "#9a839c", fontWeight: 800, whiteSpace: "nowrap" }}>
                  {h.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fin.rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid #FBF7F2" }}>
                <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>
                  {r.id}
                  <span style={{ display: "block", fontSize: 11.5, color: "#7a5f7d", fontWeight: 600 }}>{r.customer}</span>
                </td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: "#7a5f7d", whiteSpace: "nowrap" }}>{r.productName}</td>
                <td style={{ padding: "12px 16px", fontSize: 12.5, color: "#7a5f7d", whiteSpace: "nowrap" }}>{r.status}</td>
                <td style={cellNum()}>{gbp(round(r.revenue))}</td>
                <td style={cellNum("#7a5f7d")}>{gbp(round(r.materials))}</td>
                <td style={cellNum("#7a5f7d")}>{gbp(round(r.labour))}</td>
                <td style={cellNum("#7a5f7d")}>{gbp(round(r.deliveryCost))}</td>
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
    </>
  );
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function cellNum(color = "#4A2C4D", weight = 700): React.CSSProperties {
  return { padding: "12px 16px", fontSize: 13.5, textAlign: "right", color, fontWeight: weight, whiteSpace: "nowrap" };
}

function Spacer() {
  return <div style={{ height: 10 }} />;
}

function Line({
  label,
  value,
  bold,
  muted,
  rule,
  big,
  color,
}: {
  label: string;
  value: number;
  bold?: boolean;
  muted?: boolean;
  rule?: boolean;
  big?: boolean;
  color?: string;
}) {
  const negative = value < 0;
  const display = (negative ? "−" : "") + gbp(Math.abs(round(value))).replace("£", "£");
  return (
    <div
      className="flex justify-between items-baseline"
      style={{
        padding: big ? "12px 0 4px" : "6px 0",
        borderTop: rule ? "1.5px solid #EDE6EC" : undefined,
        marginTop: rule ? 4 : undefined,
      }}
    >
      <span style={{ fontSize: big ? 16 : 14, fontWeight: bold ? 800 : 600, color: muted ? "#7a5f7d" : "#4A2C4D" }}>
        {label}
      </span>
      <span
        style={{
          fontSize: big ? 22 : bold ? 16 : 14,
          fontWeight: bold ? 800 : 700,
          fontFamily: big ? "var(--font-playfair), serif" : undefined,
          color: color ?? (muted ? "#7a5f7d" : "#4A2C4D"),
        }}
      >
        {display}
      </span>
    </div>
  );
}
