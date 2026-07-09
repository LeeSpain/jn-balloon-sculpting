"use client";

import { useMemo, useState } from "react";
import type { PublicData, PublicZone } from "@/lib/publicData";

function gbp(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return "—";
  return "£" + (Number.isInteger(Number(n)) ? Number(n) : Number(n).toFixed(2));
}

function zoneForPostcode(zones: PublicZone[], postcode: string): PublicZone | null {
  const m = String(postcode || "").trim().toUpperCase().match(/^([A-Z]{1,2}\d{1,2})/);
  if (!m) return null;
  const district = m[1];
  for (const z of zones) {
    if ((z.districts || []).includes(district)) return z;
  }
  return { id: "outside", name: "Beyond 30 miles", range: "", fee: null, areas: "", districts: [] };
}

function depositFor(
  total: number,
  depositType: PublicData["settings"]["depositType"],
  depositValue: number
): number {
  if (depositType === "full") return total;
  if (depositType === "fixed") return Math.min(depositValue, total);
  return Math.round((total * depositValue) / 100 * 100) / 100;
}

function prettyDate(iso: string): string {
  return new Date(iso + "T12:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

const input =
  "border-2 border-blush rounded-xl px-3.5 py-3 text-base bg-cream text-plum";
const label = "flex flex-col gap-1.5 text-[12.5px] font-bold flex-1 min-w-[180px]";

export default function QuoteBuilder({ data }: { data: PublicData }) {
  const [productId, setProductId] = useState(data.products[0]?.id ?? "arch");
  const [sizeId, setSizeId] = useState("standard");
  const [theme, setTheme] = useState(data.themes[0] ?? "Blush & gold");
  const [postcode, setPostcode] = useState("");
  const [date, setDate] = useState("");
  const [custName, setCustName] = useState("");
  const [custContact, setCustContact] = useState("");
  const [warnMsg, setWarnMsg] = useState<string | null>(null);
  const [bookedMsg, setBookedMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const s = data.settings;
  const product = data.products.find((p) => p.id === productId) ?? data.products[0];
  const size = data.sizes.find((z) => z.id === sizeId) ?? data.sizes[1] ?? data.sizes[0];

  const q = useMemo(() => {
    const zone = postcode.trim() ? zoneForPostcode(data.zones, postcode) : null;
    let zoneMsg =
      `Minimum ${s.leadDays} days’ notice. We deliver up to 30 miles from Huntingdon.`;
    let outside = false;
    if (postcode.trim()) {
      if (!zone) {
        zoneMsg = "Hmm, that doesn’t look like a UK postcode — try e.g. PE29 3AB.";
      } else if (zone.fee == null) {
        zoneMsg =
          "That’s beyond our 30-mile delivery area — send it as a custom enquiry and we’ll quote delivery personally.";
        outside = true;
      } else {
        zoneMsg = `${zone.name} (${zone.range}) — delivery ${gbp(zone.fee)}. Covers ${zone.areas}.`;
      }
    }

    const basePrice = product.priceBySize[sizeId] ?? product.fromPrice;
    const zoneOk = !!zone && zone.fee != null;
    const dateOk = !!date && date >= data.minDate;
    const quoteReady = zoneOk && dateOk;
    const total = quoteReady ? basePrice + (zone!.fee as number) : basePrice;
    const deposit = depositFor(total, s.depositType, s.depositValue);
    const depositWord = s.depositType === "full" ? "Full payment" : `${gbp(deposit)} deposit`;

    let blockedMsg: string | null = null;
    if (postcode.trim() && outside) {
      blockedMsg =
        "Beyond 30 miles we quote delivery personally — tap “Request custom quote” below and we’ll come back within 24 hours.";
    } else if (zoneOk && date && !dateOk) {
      blockedMsg =
        `We need at least ${s.leadDays} days’ notice to build your piece — the earliest date we can deliver is ${prettyDate(data.minDate)}.`;
    } else if (!quoteReady) {
      blockedMsg =
        "Add your postcode and a delivery date to see your price" +
        (date || postcode ? "." : " — e.g. PE29 3AB.");
    }

    return {
      zone,
      zoneMsg,
      outside,
      basePrice,
      zoneOk,
      quoteReady,
      total,
      deposit,
      depositWord,
      blockedMsg,
      bookLabel: s.stripeEnabled ? `Pay ${gbp(deposit)} deposit` : "Book now",
    };
  }, [postcode, date, product, sizeId, s, data.zones, data.minDate]);

  const sel = (on: boolean) =>
    on
      ? { borderColor: "#FF6F61", background: "#FFF3F1" }
      : { borderColor: "#F3C6C6", background: "#fff" };

  function validDetails(): boolean {
    if (!custName.trim() || !custContact.trim()) {
      setWarnMsg(
        "Please add your name and a mobile number or email (step 5) so we can confirm your booking."
      );
      setBookedMsg(null);
      return false;
    }
    return true;
  }

  async function submit(kind: "book" | "custom") {
    if (!validDetails()) return;
    setSubmitting(true);
    setWarnMsg(null);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          productId,
          sizeId,
          theme,
          postcode,
          date,
          custName,
          custContact,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong");
      if (json.checkoutUrl) {
        window.location.href = json.checkoutUrl;
        return;
      }
      setBookedMsg(json.message);
    } catch (e) {
      setWarnMsg(
        e instanceof Error ? e.message : "Sorry, we couldn’t send that — please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-3xl shadow-panel" style={{ padding: "clamp(22px, 4vw, 40px)" }}>
      <p className="m-0 mb-1.5 text-xs font-extrabold text-gold" style={{ letterSpacing: "3px" }}>
        INSTANT QUOTE
      </p>
      <h2 className="font-display m-0 mb-2" style={{ fontSize: "clamp(26px, 3.5vw, 36px)" }}>
        Build your quote in seconds
      </h2>
      <p className="m-0 mb-7 text-[15px] text-plum-soft">
        Pick a piece, choose your colours, tell us where — your price appears instantly.
      </p>

      {/* 1. Choose your piece */}
      <h3 className="text-sm font-extrabold m-0 mb-3">
        <span className="text-coral">1.</span> Choose your piece
      </h3>
      <div
        className="grid gap-3 mb-7"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
      >
        {data.products.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setProductId(p.id);
              setBookedMsg(null);
            }}
            className="text-left cursor-pointer rounded-2xl p-3.5 border-2 flex flex-col gap-1.5 font-sans text-plum"
            style={{ minHeight: 44, ...sel(p.id === productId) }}
          >
            <span className="font-extrabold text-[15px]">{p.name}</span>
            <span className="text-[12.5px] leading-snug text-plum-soft">{p.desc}</span>
            <span className="flex gap-1.5 items-center mt-auto">
              <span className="font-extrabold text-sm text-coral">from {gbp(p.fromPrice)}</span>
              {p.helium && (
                <span
                  className="text-[10px] font-extrabold bg-blush rounded-full"
                  style={{ letterSpacing: "1px", padding: "3px 8px" }}
                >
                  SAME-DAY
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      {/* 2. Pick a size */}
      <h3 className="text-sm font-extrabold m-0 mb-3">
        <span className="text-coral">2.</span> Pick a size
      </h3>
      <div className="flex gap-2.5 flex-wrap mb-7">
        {data.sizes.map((z) => (
          <button
            key={z.id}
            onClick={() => {
              setSizeId(z.id);
              setBookedMsg(null);
            }}
            className="cursor-pointer rounded-full border-2 font-sans text-plum font-bold text-sm"
            style={{ padding: "11px 20px", minHeight: 44, ...sel(z.id === sizeId) }}
          >
            {z.name} · <span className="text-coral font-extrabold">{gbp(product.priceBySize[z.id])}</span>
          </button>
        ))}
      </div>

      {/* 3. Colours & theme */}
      <h3 className="text-sm font-extrabold m-0 mb-3">
        <span className="text-coral">3.</span> Colours &amp; theme
      </h3>
      <div className="flex gap-2.5 flex-wrap mb-7">
        {data.themes.map((t) => (
          <button
            key={t}
            onClick={() => setTheme(t)}
            className="cursor-pointer rounded-full border-2 font-sans text-plum font-bold text-sm"
            style={{ padding: "11px 20px", minHeight: 44, ...sel(t === theme) }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* 4. Delivery */}
      <h3 className="text-sm font-extrabold m-0 mb-3">
        <span className="text-coral">4.</span> Delivery
      </h3>
      <div className="flex gap-3.5 flex-wrap mb-2.5">
        <label className={label}>
          Delivery postcode
          <input
            value={postcode}
            onChange={(e) => {
              setPostcode(e.target.value);
              setBookedMsg(null);
            }}
            placeholder="e.g. PE29 3AB"
            className={input}
          />
        </label>
        <label className={label}>
          Delivery date
          <input
            type="date"
            value={date}
            min={data.minDate}
            onChange={(e) => {
              setDate(e.target.value);
              setBookedMsg(null);
            }}
            className={input}
          />
        </label>
      </div>
      <p className="m-0 mb-6 text-[13px] text-plum-soft">{q.zoneMsg}</p>

      {/* 5. Your details */}
      <h3 className="text-sm font-extrabold m-0 mb-3">
        <span className="text-coral">5.</span> Your details
      </h3>
      <div className="flex gap-3.5 flex-wrap mb-6">
        <label className={label}>
          Your name
          <input
            value={custName}
            onChange={(e) => {
              setCustName(e.target.value);
              setWarnMsg(null);
            }}
            placeholder="e.g. Sophie Turner"
            className={input}
          />
        </label>
        <label className={label}>
          Mobile or email
          <input
            value={custContact}
            onChange={(e) => {
              setCustContact(e.target.value);
              setWarnMsg(null);
            }}
            placeholder="07700 900123"
            className={input}
          />
        </label>
      </div>

      {/* Quote result */}
      {q.quoteReady && (
        <div
          className="rounded-[20px] text-white flex flex-wrap gap-5 items-center justify-between"
          style={{
            background: "linear-gradient(135deg, #FF6F61, #ff8a7d)",
            padding: "clamp(20px, 3vw, 30px)",
            boxShadow: "0 8px 24px rgba(255,111,97,0.35)",
          }}
        >
          <div>
            <p className="m-0 mb-1 text-xs font-extrabold" style={{ letterSpacing: "2px", opacity: 0.85 }}>
              YOUR QUOTE
            </p>
            <p
              className="m-0 font-display font-bold leading-none"
              style={{ fontSize: "clamp(34px, 5vw, 46px)" }}
            >
              {gbp(q.total)}
            </p>
            <p className="mt-2 mb-0 text-[13.5px] font-semibold" style={{ opacity: 0.95 }}>
              {product.name} ({size.name}) {gbp(q.basePrice)} + delivery{" "}
              {q.zoneOk ? gbp(q.zone!.fee) : "—"}
            </p>
            <p className="mt-1 mb-0 text-[13px] font-bold">
              {q.depositWord} to confirm · balance before delivery
            </p>
            <p className="mt-1 mb-0 text-xs font-semibold" style={{ opacity: 0.9 }}>
              Free cancellation up to {s.refundDays} working days before delivery
            </p>
          </div>
          <div className="flex flex-col gap-2.5 items-stretch">
            <button
              onClick={() => submit("book")}
              disabled={submitting}
              className="cursor-pointer bg-white text-coral border-0 font-sans font-extrabold text-base rounded-full disabled:opacity-70"
              style={{ padding: "14px 30px", minHeight: 48 }}
            >
              {submitting ? "…" : q.bookLabel}
            </button>
            <button
              onClick={() => submit("custom")}
              disabled={submitting}
              className="cursor-pointer bg-transparent text-white font-sans font-bold text-sm rounded-full disabled:opacity-70"
              style={{ border: "2px solid rgba(255,255,255,0.7)", padding: "10px 22px", minHeight: 44 }}
            >
              Request custom quote
            </button>
          </div>
        </div>
      )}

      {!q.quoteReady && q.blockedMsg && (
        <div
          className="rounded-[20px] bg-cream flex flex-wrap gap-3.5 items-center justify-between"
          style={{ border: "2px dashed #D4AF7A", padding: 22 }}
        >
          <span className="text-[14.5px] font-semibold" style={{ flex: "1 1 280px" }}>
            {q.blockedMsg}
          </span>
          <button
            onClick={() => submit("custom")}
            disabled={submitting}
            className="cursor-pointer bg-plum text-white border-0 font-sans font-extrabold text-sm rounded-full disabled:opacity-70"
            style={{ padding: "12px 22px", minHeight: 44 }}
          >
            Request custom quote
          </button>
        </div>
      )}

      {bookedMsg && (
        <div
          className="mt-4 rounded-2xl text-[14.5px] font-bold"
          style={{ background: "#F0F7F0", border: "2px solid #9DC49D", padding: "18px 20px", color: "#3c5a3c" }}
        >
          {bookedMsg}
        </div>
      )}

      {warnMsg && (
        <div
          className="mt-4 rounded-2xl text-[14.5px] font-bold"
          style={{ background: "#FFF3F1", border: "2px solid #FF6F61", padding: "18px 20px", color: "#c14a3e" }}
        >
          {warnMsg}
        </div>
      )}
    </div>
  );
}
