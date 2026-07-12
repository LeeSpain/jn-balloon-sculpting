"use client";

import { useEffect, useState } from "react";
import type { Store, Order } from "@/lib/types";
import { gbp } from "@/lib/pricing";

function prettyDate(iso: string): string {
  return new Date(iso + "T12:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

// Confirmation step for cancelling/archiving or permanently deleting an order —
// shows the full order so nobody fat-fingers a real booking away. Permanent
// delete additionally requires typing the order id (type-to-confirm).
export default function ConfirmActionModal({
  store,
  action,
  onCancel,
  onConfirm,
}: {
  store: Store;
  action: { kind: "archive" | "delete"; orderId: string } | null;
  onCancel: () => void;
  onConfirm: (kind: "archive" | "delete", orderId: string) => void;
}) {
  const [typed, setTyped] = useState("");
  useEffect(() => { setTyped(""); }, [action]); // reset when a new action opens
  useEffect(() => {
    if (!action) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [action, onCancel]);

  if (!action) return null;
  const order: Order | undefined = store.orders.find((o) => o.id === action.orderId);
  if (!order) return null;
  const product = store.products.find((p) => p.id === order.product);
  const isDelete = action.kind === "delete";
  const accent = isDelete ? "#c14a3e" : "#8a6a1a";
  // Permanent delete is gated on typing the order id exactly.
  const confirmed = !isDelete || typed.trim().toUpperCase() === order.id.toUpperCase();

  return (
    <div
      onClick={onCancel}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(74,44,77,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-3xl shadow-panel w-full" style={{ maxWidth: 440 }}>
        <div style={{ padding: "22px 24px" }}>
          <h3 className="font-display m-0 mb-1.5" style={{ fontSize: 21, color: accent }}>
            {isDelete ? "Delete this order permanently?" : "Cancel & archive this order?"}
          </h3>
          <p className="m-0 mb-3.5 text-[13.5px] text-plum-soft" style={{ lineHeight: 1.5 }}>
            {isDelete
              ? "This removes the record completely and can’t be undone. Only do this for test or junk orders — for a real cancellation, use Cancel & archive so the record is kept."
              : "It’ll be moved out of your active orders, calendar and finance, but kept on record — you can restore it any time."}
          </p>

          <div className="rounded-2xl mb-4" style={{ background: "#FBF7F2", border: "1px solid #F3C6C6", padding: "14px 16px" }}>
            <p className="m-0 font-extrabold text-[15px]">{order.id} · {order.customer}</p>
            <p className="m-0 mt-1 text-[13px] text-plum-soft">
              {product?.name ?? order.product} · {prettyDate(order.date)}
            </p>
            <p className="m-0 mt-0.5 text-[13px] text-plum-soft">
              {gbp(order.price + (order.delivery || 0))} · {order.postcode || "no postcode"} · {order.archived ? "Cancelled" : order.status}
            </p>
          </div>

          {isDelete && (
            <label className="flex flex-col gap-1.5 mb-4 text-[12.5px] font-bold text-plum-soft">
              Type <span className="font-extrabold text-plum" style={{ fontFamily: "monospace" }}>{order.id}</span> to confirm
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={order.id}
                autoFocus
                className="border-2 rounded-xl font-bold bg-cream text-plum font-sans"
                style={{ padding: "10px 12px", fontSize: 15, borderColor: confirmed ? "#3c7a3c" : "#F3C6C6", fontFamily: "monospace" }}
              />
            </label>
          )}

          <div className="flex gap-2.5 justify-end flex-wrap">
            <button
              onClick={onCancel}
              className="cursor-pointer bg-cream border-0 font-sans font-bold text-[14px] rounded-full"
              style={{ padding: "11px 20px", minHeight: 44 }}
            >
              Keep order
            </button>
            <button
              onClick={() => confirmed && onConfirm(action.kind, action.orderId)}
              disabled={!confirmed}
              className="cursor-pointer border-0 font-sans font-extrabold text-[14px] rounded-full text-white disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ padding: "11px 20px", minHeight: 44, background: isDelete ? "#c14a3e" : "#D49A2A" }}
            >
              {isDelete ? "Delete permanently" : "Cancel & archive"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
