"use client";

import { useEffect } from "react";
import type { Store, Order, OrderStatus, Assignee } from "@/lib/types";
import { computeFinanceForOrders } from "@/lib/finance";
import { gbp } from "@/lib/pricing";
import { ASSIGNEES, makerOf, delivererOf } from "@/lib/calendar";
import PLStatement from "./PLStatement";

const STATUSES: OrderStatus[] = [
  "Order received",
  "Materials purchased",
  "In progress",
  "Ready",
  "Delivered",
];

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  "Order received": { bg: "#F3C6C6", color: "#4A2C4D" },
  "Materials purchased": { bg: "#F2E7D8", color: "#8a6a3a" },
  "In progress": { bg: "#FFE3DF", color: "#c14a3e" },
  Ready: { bg: "#E4F0E4", color: "#3c7a3c" },
  Delivered: { bg: "#EDEAEE", color: "#7a5f7d" },
};

function prettyDate(iso: string): string {
  return new Date(iso + "T12:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function OrderDetailModal({
  store,
  order,
  onClose,
  onStatusChange,
  onSetMaker,
  onSetDeliverer,
  onArchive,
  onRestore,
  onDelete,
}: {
  store: Store;
  order: Order | null;
  onClose: () => void;
  onStatusChange: (id: string, status: OrderStatus) => void;
  onSetMaker: (id: string, who: Assignee) => void;
  onSetDeliverer: (id: string, who: Assignee) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  useEffect(() => {
    if (!order) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [order, onClose]);

  if (!order) return null;

  const fin = computeFinanceForOrders(store, [order]);
  const product = store.products.find((p) => p.id === order.product);
  const size = store.sizes.find((s) => s.id === order.size);
  const ss = STATUS_STYLES[order.status] || STATUS_STYLES["Order received"];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(74,44,77,0.45)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "24px 16px",
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-cream rounded-3xl shadow-panel w-full"
        style={{ maxWidth: 560, margin: "auto" }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between gap-3 rounded-t-3xl"
          style={{ background: "#4A2C4D", color: "#FBF7F2", padding: "18px 22px" }}
        >
          <div>
            <p className="m-0 font-display font-bold" style={{ fontSize: 22 }}>{order.id}</p>
            <p className="m-0 mt-0.5 text-[13px]" style={{ color: "#F3C6C6" }}>
              {order.customer} · {order.phone}
            </p>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer border-0 rounded-full font-extrabold"
            style={{ background: "rgba(251,247,242,0.15)", color: "#FBF7F2", width: 34, height: 34, fontSize: 16 }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 22 }}>
          {/* Order facts */}
          <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            <Fact label="Piece" value={`${product?.name ?? order.product}${size ? ` · ${size.name}` : ""}`} />
            <Fact label="Theme" value={order.theme} />
            <Fact label="Delivery date" value={prettyDate(order.date)} />
            <Fact label="Postcode" value={order.postcode || "—"} />
            {order.address && <Fact label="Address" value={order.address} />}
            {order.depositPaid ? <Fact label="Deposit paid" value={gbp(order.depositPaid)} /> : null}
          </div>

          {/* Status control */}
          <div className="flex items-center gap-3 flex-wrap mb-5">
            <span
              className="text-xs font-extrabold rounded-full"
              style={{ padding: "6px 12px", background: ss.bg, color: ss.color }}
            >
              {order.status}
            </span>
            <label className="flex items-center gap-2 text-[12.5px] font-bold text-plum-soft">
              Update status
              <select
                value={order.status}
                onChange={(e) => onStatusChange(order.id, e.target.value as OrderStatus)}
                className="border-2 border-blush rounded-xl font-bold bg-white font-sans"
                style={{ padding: "8px 10px", fontSize: 13, minHeight: 40 }}
              >
                {STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Who does what — making & delivering (changeable any time) */}
          <div className="bg-white rounded-2xl shadow-card mb-5" style={{ padding: "14px 18px" }}>
            <p className="m-0 mb-2.5 text-[11px] font-extrabold text-gold flex items-center gap-2" style={{ letterSpacing: "1px" }}>
              WHO DOES WHAT
              {order.acknowledged === false && (
                <span className="text-[10px] rounded-full" style={{ background: "#FF6F61", color: "#fff", padding: "1px 7px" }}>NOT YET ACKNOWLEDGED</span>
              )}
            </p>
            <div className="flex gap-4 flex-wrap">
              <label className="flex flex-col gap-1 text-[12px] font-bold text-plum-soft">
                🔨 Making
                <select
                  value={makerOf(order) || ""}
                  onChange={(e) => onSetMaker(order.id, e.target.value as Assignee)}
                  className="border-2 border-blush rounded-xl font-bold bg-cream text-plum font-sans"
                  style={{ padding: "8px 10px", fontSize: 13, minHeight: 40, minWidth: 130 }}
                >
                  <option value="" disabled>Unassigned</option>
                  {ASSIGNEES.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-bold text-plum-soft">
                🚗 Delivering
                <select
                  value={delivererOf(order) || ""}
                  onChange={(e) => onSetDeliverer(order.id, e.target.value as Assignee)}
                  className="border-2 border-blush rounded-xl font-bold bg-cream text-plum font-sans"
                  style={{ padding: "8px 10px", fontSize: 13, minHeight: 40, minWidth: 130 }}
                >
                  <option value="" disabled>Unassigned</option>
                  {ASSIGNEES.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* This order's P&L */}
          <div className="bg-white rounded-2xl shadow-card" style={{ padding: "6px 18px 14px" }}>
            <h3 className="font-display" style={{ fontSize: 18, margin: "14px 0 4px" }}>
              This order&apos;s profit &amp; loss
            </h3>
            <PLStatement fin={fin} />
          </div>

          {/* Danger zone — cancel/archive (safe, reversible) or permanent delete */}
          <div className="mt-5" style={{ borderTop: "1px solid #F3C6C6", paddingTop: 16 }}>
            {order.archived ? (
              <div className="flex flex-wrap gap-2.5 items-center">
                <span className="text-[13px] font-bold text-plum-soft" style={{ flex: 1, minWidth: 160 }}>
                  This order is cancelled &amp; archived — kept on record, out of the active pipeline.
                </span>
                <button
                  onClick={() => onRestore(order.id)}
                  className="cursor-pointer border-0 rounded-full font-sans font-extrabold text-[13px]"
                  style={{ background: "#E4F0E4", color: "#3c7a3c", padding: "10px 18px", minHeight: 44 }}
                >
                  Restore order
                </button>
                <button
                  onClick={() => onDelete(order.id)}
                  className="cursor-pointer border-0 rounded-full font-sans font-extrabold text-[13px]"
                  style={{ background: "#FFE3DF", color: "#c14a3e", padding: "10px 18px", minHeight: 44 }}
                >
                  Delete permanently
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2.5 items-center">
                <button
                  onClick={() => onArchive(order.id)}
                  className="cursor-pointer border-0 rounded-full font-sans font-extrabold text-[13px]"
                  style={{ background: "#F2E7D8", color: "#8a6a1a", padding: "10px 18px", minHeight: 44 }}
                >
                  Cancel &amp; archive
                </button>
                <button
                  onClick={() => onDelete(order.id)}
                  className="cursor-pointer bg-transparent rounded-full font-sans font-bold text-[13px]"
                  style={{ border: "2px solid #F3C6C6", color: "#c14a3e", padding: "9px 16px", minHeight: 44 }}
                >
                  Delete permanently
                </button>
                <span className="text-[12px] text-plum-soft" style={{ flex: 1, minWidth: 140 }}>
                  Cancelling keeps the record; deleting removes it for good.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="m-0 text-[11px] font-extrabold text-gold" style={{ letterSpacing: "1px" }}>
        {label.toUpperCase()}
      </p>
      <p className="m-0 mt-0.5 text-[14px] font-bold text-plum">{value}</p>
    </div>
  );
}
