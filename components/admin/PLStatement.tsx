"use client";

import type { FinanceSummary } from "@/lib/finance";
import { OWNER_NAMES } from "@/lib/finance";
import { gbp } from "@/lib/pricing";

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

// A profit-and-loss statement rendered from a FinanceSummary. Used by both the
// Finance tab (aggregate) and the per-order detail (single order).
export default function PLStatement({ fin }: { fin: FinanceSummary }) {
  return (
    <div>
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
      <Line label={`Delivery costs (${fin.deliveryCostPct}% of fee)`} value={-fin.deliveryCost} muted />
      <Line label="Total costs" value={-fin.totalCosts} bold rule />
      <Spacer />
      <Line label="Profit before tax" value={fin.profitBeforeTax} bold color={fin.profitBeforeTax >= 0 ? "#3c7a3c" : "#c14a3e"} />
      <Line label={`Tax (${fin.taxRatePct}% of profit)`} value={-fin.tax} muted />
      <Line label="Net profit (shared)" value={fin.netProfit} bold rule big color={fin.netProfit >= 0 ? "#3c7a3c" : "#c14a3e"} />

      {/* Owners take no wage — the net profit is theirs to split. */}
      <div
        className="rounded-xl mt-3"
        style={{ background: "#F0F7F0", border: "1.5px solid #CDE3CD", padding: "12px 14px" }}
      >
        <div className="flex justify-between items-baseline flex-wrap gap-2">
          <span className="text-[13px] font-extrabold" style={{ color: "#3c5a3c" }}>
            Owners&apos; share (no wage taken)
          </span>
          <span className="text-[13px] font-bold" style={{ color: "#3c5a3c" }}>
            {OWNER_NAMES.map((n) => `${n} ${gbp(round(fin.perOwner))}`).join("  ·  ")}
          </span>
        </div>
        <p className="text-[12px] m-0 mt-1.5" style={{ color: "#5a7a5a" }}>
          {fin.labourHours > 0 ? (
            <>
              {fin.labourHours.toFixed(1)} hrs of your time · effective{" "}
              <strong>{gbp(round(fin.effectiveHourly))}/hr</strong> (vs {gbp(fin.labourRate)}/hr costed into prices)
            </>
          ) : (
            <>Labour is not a cost — it&apos;s part of what you take home.</>
          )}
        </p>
      </div>

      <p className="text-[12.5px] text-plum-soft m-0 mt-2">
        Net margin {fin.netMarginPct.toFixed(1)}% · figures use current recipe costs &amp; rates.
      </p>
    </div>
  );
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
  const display = (negative ? "−" : "") + gbp(Math.abs(round(value)));
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
