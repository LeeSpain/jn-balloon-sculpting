"use client";

import { useState } from "react";
import type { Store, Enquiry, EnquiryStatus } from "@/lib/types";

const STATUSES: EnquiryStatus[] = ["New", "Replied", "Closed"];
const STATUS_STYLE: Record<EnquiryStatus, { bg: string; color: string; bar: string }> = {
  New: { bg: "#FFE3DF", color: "#c14a3e", bar: "#FF6F61" },
  Replied: { bg: "#E4F0E4", color: "#3c7a3c", bar: "#9DC49D" },
  Closed: { bg: "#EDEAEE", color: "#7a5f7d", bar: "#C9B8CB" },
};

function when(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) + " · " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function prettyDate(iso: string): string {
  return new Date(iso + "T12:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

// Pre-filled reply that opens the founder's own mail client, addressed to the enquirer.
function replyMailto(e: Enquiry): string {
  const subject = `Re: your message to J&N Balloon Sculpting`;
  const body = `Hi ${e.name || "there"},\n\nThank you for getting in touch with J&N Balloon Sculpting`
    + (e.productName ? ` about the ${e.productName}` : "")
    + `!\n\n\n\n— Jade & Nicole`;
  return `mailto:${encodeURIComponent(e.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function EnquiriesTab({
  store,
  onStatus,
}: {
  store: Store;
  onStatus: (id: string, status: EnquiryStatus) => void;
}) {
  const [filter, setFilter] = useState<"all" | EnquiryStatus>("all");
  const all = (store.enquiries || []).slice().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const counts: Record<string, number> = { all: all.length };
  for (const s of STATUSES) counts[s] = all.filter((e) => e.status === s).length;
  const rows = filter === "all" ? all : all.filter((e) => e.status === filter);

  return (
    <>
      <h1 className="font-display m-0 mb-1" style={{ fontSize: 30 }}>Enquiries</h1>
      <p className="m-0 mb-5 text-plum-soft text-[15px]">Messages from the contact form. New → Replied → Closed. Each enquirer is also saved to Contacts.</p>

      <div className="flex gap-2 flex-wrap mb-5">
        {(["all", ...STATUSES] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className="cursor-pointer rounded-full border-2 font-sans font-bold text-[13px]"
            style={{
              padding: "7px 16px", minHeight: 38,
              borderColor: filter === f ? "#FF6F61" : "#F3C6C6",
              background: filter === f ? "#FFF3F1" : "#fff", color: "#4A2C4D",
            }}
          >
            {f === "all" ? "All" : f} ({counts[f] || 0})
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-plum-soft text-[14px]">No {filter === "all" ? "" : filter.toLowerCase() + " "}enquiries yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((e) => {
            const ss = STATUS_STYLE[e.status];
            return (
              <div key={e.id} className="bg-white rounded-2xl shadow-card" style={{ padding: "16px 20px", borderLeft: `5px solid ${ss.bar}` }}>
                <div className="flex flex-wrap gap-3 items-start justify-between">
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <p className="m-0 font-extrabold text-[15.5px] flex items-center gap-2 flex-wrap">
                      {e.name}
                      <span className="text-[10px] font-extrabold rounded-full" style={{ background: ss.bg, color: ss.color, padding: "2px 9px", letterSpacing: "0.5px" }}>{e.status.toUpperCase()}</span>
                      {e.productName && <span className="text-[11px] font-bold rounded-full" style={{ background: "#F2E7D8", color: "#8a6a3a", padding: "2px 9px" }}>{e.productName}</span>}
                    </p>
                    <p className="mt-1 mb-0 text-[12.5px] text-plum-soft">
                      <a href={`mailto:${e.email}`} className="font-bold no-underline" style={{ color: "#c9402f" }}>{e.email}</a>
                      {e.phone ? ` · ${e.phone}` : ""}
                      {e.eventDate ? ` · event ${prettyDate(e.eventDate)}` : ""}
                    </p>
                    <p className="mt-0.5 mb-0 text-[11.5px] text-plum-soft">{when(e.createdAt)} · via {e.source}</p>
                  </div>
                  <a
                    href={replyMailto(e)}
                    onClick={() => { if (e.status === "New") onStatus(e.id, "Replied"); }}
                    className="no-underline cursor-pointer bg-coral-deep text-white font-sans font-extrabold text-[13px] rounded-full"
                    style={{ padding: "10px 18px", minHeight: 42, display: "inline-flex", alignItems: "center" }}
                  >
                    ✉ Reply
                  </a>
                </div>

                <p className="m-0 mt-3 text-[14px] text-plum" style={{ whiteSpace: "pre-wrap", lineHeight: 1.55, background: "#FBF7F2", borderRadius: 12, padding: "12px 14px" }}>
                  {e.message}
                </p>

                <div className="flex gap-1.5 items-center flex-wrap mt-3">
                  <span className="text-[11.5px] font-bold text-plum-soft mr-1">Move to:</span>
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() => onStatus(e.id, s)}
                      aria-pressed={e.status === s}
                      className="cursor-pointer rounded-full border-2 font-sans font-bold text-[12px]"
                      style={{
                        padding: "5px 12px", minHeight: 34,
                        borderColor: e.status === s ? STATUS_STYLE[s].bar : "#F3C6C6",
                        background: e.status === s ? STATUS_STYLE[s].bg : "#fff",
                        color: e.status === s ? STATUS_STYLE[s].color : "#7a5f7d",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
