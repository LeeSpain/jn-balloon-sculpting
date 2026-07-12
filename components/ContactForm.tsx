"use client";

import { useEffect, useMemo, useState } from "react";
import type { PublicData } from "@/lib/publicData";

const input = "border-2 border-blush rounded-xl px-3.5 py-3 text-base bg-cream text-plum w-full";
const label = "flex flex-col gap-1.5 text-[12.5px] font-bold";

// Looks like a price-only question? Gently point them at the instant quote.
function looksPriceOnly(msg: string): boolean {
  const m = msg.toLowerCase();
  return /\b(how much|price|prices|cost|costs|quote|£|per balloon|cheap)\b/.test(m) && msg.trim().length < 140;
}

export default function ContactForm({ data }: { data: PublicData }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [productId, setProductId] = useState("");
  const [source, setSource] = useState("Contact page");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Pre-fill from a product/gallery "Ask us first" link.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get("product");
    const piece = params.get("piece");
    if (pid) {
      const p = data.products.find((x) => x.id === pid);
      if (p) {
        setProductId(p.id);
        setSource(`Quote builder: ${p.name}`);
        setMessage((m) => m || `Hi Jade & Nicole, I have a question about the ${p.name} — `);
        return;
      }
    }
    if (piece) {
      setSource(`Gallery: ${piece}`);
      setMessage((m) => m || `Hi Jade & Nicole, I have a question about "${piece}" — `);
    }
  }, [data.products]);

  const priceHint = useMemo(() => looksPriceOnly(message), [message]);
  const productName = productId ? data.products.find((p) => p.id === productId)?.name : "";

  async function submit() {
    setErr(null);
    if (!name.trim() || !email.trim()) { setErr("Please add your name and email so we can reply."); return; }
    if (!message.trim()) { setErr("Please add a short message so we know how to help."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, eventDate, message, productId, source, company }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong");
      setSent(json.message);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sorry, we couldn’t send that — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div role="status" aria-live="polite" className="rounded-2xl text-[15px] font-bold" style={{ background: "#F0F7F0", border: "2px solid #9DC49D", padding: "22px 24px", color: "#3c5a3c" }}>
        {sent}
        <p className="m-0 mt-2 font-semibold text-[13.5px]" style={{ color: "#3c5a3c" }}>
          Meanwhile, feel free to <a href="/#gallery" className="font-extrabold" style={{ color: "#c9402f" }}>browse our recent creations</a>.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-panel" style={{ padding: "clamp(22px, 4vw, 36px)" }}>
      {productName && (
        <p className="m-0 mb-4 text-[13px] font-bold rounded-xl" style={{ background: "#FFF3F1", color: "#c14a3e", padding: "9px 14px" }}>
          About: {productName}
        </p>
      )}
      <div className="flex flex-col gap-4">
        <div className="flex gap-4 flex-wrap">
          <label className={`${label} flex-1`} style={{ minWidth: 200 }}>
            Your name
            <input value={name} onChange={(e) => { setName(e.target.value); setErr(null); }} placeholder="e.g. Sophie Turner" className={input} />
          </label>
          <label className={`${label} flex-1`} style={{ minWidth: 200 }}>
            Email
            <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(null); }} placeholder="you@example.com" className={input} />
          </label>
        </div>
        <div className="flex gap-4 flex-wrap">
          <label className={`${label} flex-1`} style={{ minWidth: 200 }}>
            Phone <span className="font-normal text-plum-soft">(optional)</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07700 900123" className={input} />
          </label>
          <label className={`${label} flex-1`} style={{ minWidth: 200 }}>
            Event date <span className="font-normal text-plum-soft">(optional)</span>
            <input type="date" value={eventDate} min={data.minDate} onChange={(e) => setEventDate(e.target.value)} className={input} />
          </label>
        </div>
        <label className={label}>
          Your message
          <textarea value={message} onChange={(e) => { setMessage(e.target.value); setErr(null); }} rows={5} placeholder="Tell us what you’re celebrating and how we can help…" className={input} style={{ resize: "vertical" }} />
        </label>

        {/* Honeypot — visually hidden, not announced to screen readers */}
        <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
          <label>Company<input tabIndex={-1} autoComplete="off" value={company} onChange={(e) => setCompany(e.target.value)} /></label>
        </div>

        {priceHint && (
          <div className="rounded-xl text-[13.5px]" style={{ background: "#FBF7F2", border: "2px dashed #D4AF7A", padding: "12px 16px" }}>
            💡 Just after a price? Our <a href="/#quote" className="font-extrabold no-underline" style={{ color: "#c9402f" }}>instant quote</a> gives you a figure in seconds — pick a piece, size and postcode. Still want a hand? Send this and we’ll help.
          </div>
        )}

        {err && (
          <div role="alert" className="rounded-xl text-[14px] font-bold" style={{ background: "#FFF3F1", border: "2px solid #FF6F61", padding: "12px 16px", color: "#c14a3e" }}>
            {err}
          </div>
        )}

        <button
          onClick={submit}
          disabled={submitting}
          className="cursor-pointer bg-coral-deep text-white border-0 font-sans font-extrabold text-base rounded-full disabled:opacity-70 self-start"
          style={{ padding: "14px 32px", minHeight: 48, boxShadow: "0 4px 14px rgba(201,64,47,0.35)" }}
        >
          {submitting ? "Sending…" : "Send message"}
        </button>
        <p className="m-0 text-[12.5px] text-plum-soft">
          We’ll reply {data.copy.contactResponseTime}. Your details are only used to answer you — see our <a href="/privacy" className="font-bold" style={{ color: "#c9402f" }}>privacy notice</a>.
        </p>
      </div>
    </div>
  );
}
