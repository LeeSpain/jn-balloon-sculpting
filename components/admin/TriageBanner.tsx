"use client";

import type { Store, Order, Assignee } from "@/lib/types";
import { unacknowledgedOrders, daysWaiting, ASSIGNEES, makerOf, delivererOf } from "@/lib/calendar";

function prettyDate(iso: string): string {
  return new Date(iso + "T12:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// New-order triage: every unacknowledged order needs a MAKER and a DELIVERER
// assigned, then Acknowledge moves it into the pipeline. Unmissable on Overview.
export default function TriageBanner({
  store,
  onSetMaker,
  onSetDeliverer,
  onAcknowledge,
  onOpenOrder,
}: {
  store: Store;
  onSetMaker: (orderId: string, who: Assignee) => void;
  onSetDeliverer: (orderId: string, who: Assignee) => void;
  onAcknowledge: (orderId: string) => void;
  onOpenOrder: (orderId: string) => void;
}) {
  const pending = unacknowledgedOrders(store).slice().sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  if (!pending.length) return null;

  const nowISO = new Date().toISOString();
  const productName = (id: string) => store.products.find((p) => p.id === id)?.name || id;
  // Worst wait, in whole days, across all pending orders — drives the urgent flag.
  const maxWait = pending.reduce((mx, o) => Math.max(mx, daysWaiting(o, nowISO)), 0);
  const urgent = maxWait >= 1;

  return (
    <div
      className="rounded-2xl mb-7"
      style={{ background: "#FFF3F1", border: "2px solid #FF6F61", padding: "18px 20px" }}
    >
      <div className="flex items-center gap-2.5 flex-wrap mb-3">
        <span className="font-extrabold text-[13px] text-coral" style={{ letterSpacing: "1px" }}>
          🎈 NEW ORDER{pending.length > 1 ? "S" : ""} — WHO DOES WHAT?
        </span>
        <span
          className="text-xs font-extrabold rounded-full"
          style={{ background: "#FF6F61", color: "#fff", padding: "3px 10px" }}
        >
          {pending.length} waiting
        </span>
        {urgent && (
          <span
            className="text-xs font-extrabold rounded-full"
            style={{ background: "#c14a3e", color: "#fff", padding: "3px 10px" }}
          >
            ⚠ {pending.length === 1 ? "1 order" : `${pending.filter((o) => daysWaiting(o, nowISO) >= 1).length} orders`} waiting {maxWait === 1 ? "a day" : `${maxWait} days`}!
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        {pending.map((o) => {
          const wait = daysWaiting(o, nowISO);
          return (
            <TriageRow
              key={o.id}
              order={o}
              wait={wait}
              productName={productName(o.product)}
              onSetMaker={onSetMaker}
              onSetDeliverer={onSetDeliverer}
              onAcknowledge={onAcknowledge}
              onOpenOrder={onOpenOrder}
            />
          );
        })}
      </div>
    </div>
  );
}

function TriageRow({
  order: o,
  wait,
  productName,
  onSetMaker,
  onSetDeliverer,
  onAcknowledge,
  onOpenOrder,
}: {
  order: Order;
  wait: number;
  productName: string;
  onSetMaker: (orderId: string, who: Assignee) => void;
  onSetDeliverer: (orderId: string, who: Assignee) => void;
  onAcknowledge: (orderId: string) => void;
  onOpenOrder: (orderId: string) => void;
}) {
  const maker = makerOf(o);
  const deliverer = delivererOf(o);
  const ready = !!maker && !!deliverer;

  return (
    <div
      className="bg-white rounded-xl flex flex-wrap gap-3 items-center"
      style={{ padding: "14px 16px", border: wait >= 2 ? "2px solid #c14a3e" : "1px solid #F3C6C6" }}
    >
      <button
        onClick={() => onOpenOrder(o.id)}
        className="text-left cursor-pointer bg-transparent border-0 font-sans"
        style={{ flex: "1 1 200px", minWidth: 180, padding: 0 }}
      >
        <p className="m-0 font-extrabold text-[14.5px] text-plum">
          {productName} · {o.customer}
        </p>
        <p className="mt-0.5 mb-0 text-[12.5px] text-plum-soft">
          {o.id} · {prettyDate(o.date)} · {o.postcode}
          {o.phone ? ` · ${o.phone}` : ""}
          {wait >= 1 && (
            <span className="font-bold" style={{ color: "#c14a3e" }}>
              {" "}· waiting {wait === 1 ? "1 day" : `${wait} days`}
            </span>
          )}
        </p>
        {o.notes && (
          <p className="mt-1.5 mb-0 text-[12.5px] rounded-lg" style={{ background: "#FFF8ED", border: "1px solid #E6C88A", color: "#8a6a1a", padding: "6px 10px", whiteSpace: "pre-wrap" }}>
            📝 {o.notes}
          </p>
        )}
      </button>

      <label className="flex flex-col gap-1 text-[11px] font-extrabold text-gold-ink" style={{ letterSpacing: "0.5px" }}>
        MAKING
        <select
          value={maker || ""}
          onChange={(e) => onSetMaker(o.id, e.target.value as Assignee)}
          className="border-2 border-blush rounded-lg font-bold bg-cream text-plum font-sans"
          style={{ padding: "8px 10px", fontSize: 13, minHeight: 40 }}
        >
          <option value="" disabled>
            Who makes it?
          </option>
          {ASSIGNEES.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-[11px] font-extrabold text-gold-ink" style={{ letterSpacing: "0.5px" }}>
        DELIVERING
        <select
          value={deliverer || ""}
          onChange={(e) => onSetDeliverer(o.id, e.target.value as Assignee)}
          className="border-2 border-blush rounded-lg font-bold bg-cream text-plum font-sans"
          style={{ padding: "8px 10px", fontSize: 13, minHeight: 40 }}
        >
          <option value="" disabled>
            Who delivers it?
          </option>
          {ASSIGNEES.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>

      <button
        onClick={() => onAcknowledge(o.id)}
        disabled={!ready}
        title={ready ? "Confirm and start the pipeline" : "Assign making & delivering first"}
        className="cursor-pointer border-0 font-sans font-extrabold text-[13px] rounded-full disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: "#3c7a3c", color: "#fff", padding: "11px 20px", minHeight: 44, alignSelf: "flex-end" }}
      >
        ✓ Acknowledge
      </button>
    </div>
  );
}
