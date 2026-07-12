"use client";

import { useEffect, useMemo, useState } from "react";
import type { Store, Contact, ContactStatus, Order } from "@/lib/types";
import {
  CONTACT_STATUSES,
  ordersForContact,
  totalSpent,
  mailtoLink,
  waLink,
  contactsToCsv,
  prettyDate,
} from "@/lib/crm";
import { uid } from "@/lib/ids";

const card = "bg-white rounded-2xl shadow-card";
const input = "rounded-xl bg-cream border-2 border-blush font-sans text-plum text-[13.5px] px-3 py-2";
const label = "flex flex-col gap-1 text-[11.5px] font-extrabold text-gold-ink";

const STATUS_COLOR: Record<ContactStatus, { bg: string; fg: string }> = {
  "New enquiry": { bg: "#F3E4C6", fg: "#8a6a1a" },
  Quoted: { bg: "#F3C6C6", fg: "#8a3a5a" },
  Booked: { bg: "#C6D8F3", fg: "#2f4a8a" },
  Delivered: { bg: "#C6F3D0", fg: "#2f6b3a" },
  "Repeat customer": { bg: "#E9C6F3", fg: "#6a2f8a" },
};

// Most recent order date for a contact (ISO) or "" — used in the list summary.
function lastOrderDate(orders: Order[]): string {
  return orders.reduce((latest, o) => (o.date > latest ? o.date : latest), "");
}

export default function ContactsTab({
  store,
  commit,
  onDelete,
  onOpenOrder,
}: {
  store: Store;
  commit: (m: (d: Store) => void) => void;
  onDelete: (id: string) => Promise<void>;
  onOpenOrder: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | ContactStatus>("all");
  const [sort, setSort] = useState<"recent" | "spend">("recent");
  const [openId, setOpenId] = useState<string | null>(null);

  const contacts = useMemo(() => store.contacts || [], [store.contacts]);

  // Filter + sort. Spend/last-order are derived per contact once here so the list
  // and the sort agree.
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const withMeta = contacts
      .filter((c) => {
        if (filter !== "all" && c.status !== filter) return false;
        if (!q) return true;
        return [c.name, c.email, c.phone, c.postcode].some((v) => (v || "").toLowerCase().includes(q));
      })
      .map((c) => {
        const os = ordersForContact(store, c);
        return { c, os, spent: totalSpent(os), last: lastOrderDate(os) };
      });
    withMeta.sort((a, b) =>
      sort === "spend"
        ? b.spent - a.spent || (b.last || b.c.createdAt || "").localeCompare(a.last || a.c.createdAt || "")
        : (b.last || b.c.createdAt || "").localeCompare(a.last || a.c.createdAt || ""),
    );
    return withMeta;
  }, [contacts, store, query, filter, sort]);

  function addContact() {
    const c: Contact = {
      id: uid("c"), name: "New contact", email: "", phone: "", postcode: "",
      source: "Added manually", status: "New enquiry", notes: "", followUpDate: "",
      marketingConsent: false, occasion: "", occasionDate: "",
      createdAt: new Date().toISOString(),
    };
    commit((d) => { (d.contacts ||= []).unshift(c); });
    setOpenId(c.id);
  }

  function exportCsv() {
    const blob = new Blob([contactsToCsv(store)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jn-contacts.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
        <h1 className="font-display m-0" style={{ fontSize: 30 }}>Contacts</h1>
        <div className="flex gap-2">
          <button onClick={addContact} className="cursor-pointer bg-plum text-cream border-0 font-sans font-extrabold text-[13px] rounded-full" style={{ padding: "9px 16px", minHeight: 40 }}>+ Add contact</button>
          <button onClick={exportCsv} className="cursor-pointer bg-white text-plum border-2 border-blush font-sans font-extrabold text-[13px] rounded-full" style={{ padding: "7px 16px", minHeight: 40 }}>Export CSV</button>
        </div>
      </div>
      <p className="m-0 mb-4 text-plum-soft text-[15px]">Every booking and enquiry becomes a contact automatically. Tap a name to open their card. {contacts.length} total.</p>

      {/* Search + filter + sort */}
      <div className="flex gap-2 flex-wrap mb-4">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, postcode…" className={`${input} flex-1`} style={{ minWidth: 200 }} />
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className={input} style={{ minHeight: 42 }}>
          <option value="all">All statuses</option>
          {CONTACT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={input} style={{ minHeight: 42 }} title="Sort contacts">
          <option value="recent">Sort: most recent</option>
          <option value="spend">Sort: highest spend</option>
        </select>
      </div>

      {/* Message templates */}
      <details className={card} style={{ padding: "14px 18px", marginBottom: 16 }}>
        <summary className="cursor-pointer font-extrabold text-[14px]">✏️ Message wording — edit your email, WhatsApp &amp; review-request templates <span className="font-normal text-plum-soft">(tap to open)</span></summary>
        <div className="flex flex-col gap-3 mt-3" style={{ maxWidth: 620 }}>
          <label className={label} style={{ letterSpacing: "0.5px" }}>EMAIL TEMPLATE
            <textarea value={store.settings.emailTemplate} onChange={(e) => commit((d) => { d.settings.emailTemplate = e.target.value; })} rows={4} className={`${input} font-sans`} />
          </label>
          <label className={label} style={{ letterSpacing: "0.5px" }}>WHATSAPP TEMPLATE
            <textarea value={store.settings.whatsappTemplate} onChange={(e) => commit((d) => { d.settings.whatsappTemplate = e.target.value; })} rows={3} className={`${input} font-sans`} />
          </label>
          <label className={label} style={{ letterSpacing: "0.5px" }}>REVIEW REQUEST TEMPLATE
            <textarea value={store.settings.reviewTemplate} onChange={(e) => commit((d) => { d.settings.reviewTemplate = e.target.value; })} rows={4} className={`${input} font-sans`} placeholder="Sent when you mark an order Delivered — paste your Google/Facebook review link here." />
          </label>
          <p className="m-0 text-[12px] text-plum-soft">Placeholders: <code>{"{name}"}</code>, <code>{"{occasion}"}</code>, <code>{"{date}"}</code>. The review template is offered automatically when you mark an order <strong>Delivered</strong>.</p>
        </div>
      </details>

      {/* List — one tidy row per contact; click anywhere (except the quick actions) to open the card */}
      <div className="flex flex-col gap-2">
        {rows.length === 0 && <p className="text-plum-soft text-[14px]">No contacts match.</p>}
        {rows.map(({ c, os, spent, last }) => {
          const sc = STATUS_COLOR[c.status];
          return (
            <div
              key={c.id}
              onClick={() => setOpenId(c.id)}
              className={`${card} jn-click flex items-center gap-3 flex-wrap`}
              style={{ padding: "13px 18px", cursor: "pointer" }}
            >
              <span className="font-extrabold text-[15px]" style={{ flex: "2 1 150px", minWidth: 120 }}>{c.name || "(no name)"}</span>
              <span className="text-xs font-extrabold rounded-full" style={{ padding: "4px 10px", background: sc.bg, color: sc.fg, whiteSpace: "nowrap" }}>{c.status}</span>
              <span className="text-[12.5px] text-plum-soft" style={{ flex: "1 1 140px", minWidth: 120 }}>
                {last ? `Last order ${prettyDate(last)}` : c.email || c.phone || "—"}
              </span>
              {c.followUpDate && <span className="text-[12px] font-bold" style={{ color: "#c14a3e", whiteSpace: "nowrap" }} title="Follow-up due">↻ {prettyDate(c.followUpDate)}</span>}
              <span className="font-extrabold text-[14px] text-coral-deep" style={{ whiteSpace: "nowrap" }} title={`${os.length} order${os.length === 1 ? "" : "s"}`}>£{spent}</span>
              {/* Quick actions — real click only; stopPropagation so they never open the card. */}
              <span className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  disabled={!c.email}
                  title={c.email ? "Email this contact" : "No email on file"}
                  onClick={() => { if (c.email) window.location.href = mailtoLink(c, store.settings.emailTemplate); }}
                  className="cursor-pointer border-0 bg-gold text-plum font-extrabold text-[12px] rounded-full disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ padding: "7px 12px", minHeight: 36 }}
                >✉</button>
                <button
                  type="button"
                  disabled={!c.phone}
                  title={c.phone ? "WhatsApp this contact" : "No mobile on file"}
                  onClick={() => { if (c.phone) window.open(waLink(c, store.settings.whatsappTemplate), "_blank", "noopener,noreferrer"); }}
                  className="cursor-pointer border-0 text-white font-extrabold text-[12px] rounded-full disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ padding: "7px 12px", minHeight: 36, background: "#25D366" }}
                >WA</button>
              </span>
            </div>
          );
        })}
      </div>

      {openId && (
        <ContactCard
          store={store}
          contactId={openId}
          commit={commit}
          onClose={() => setOpenId(null)}
          onDelete={onDelete}
          onOpenOrder={(id) => { setOpenId(null); onOpenOrder(id); }}
        />
      )}
    </>
  );
}

// ---- Professional contact card, opened as a modal from the list ----
function ContactCard({
  store,
  contactId,
  commit,
  onClose,
  onDelete,
  onOpenOrder,
}: {
  store: Store;
  contactId: string;
  commit: (m: (d: Store) => void) => void;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
  onOpenOrder: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const c = (store.contacts || []).find((x) => x.id === contactId);
  // If the contact was just erased, close the card rather than crash.
  useEffect(() => { if (!c) onClose(); }, [c, onClose]);
  if (!c) return null;

  const os = ordersForContact(store, c).slice().sort((a, b) => b.date.localeCompare(a.date));
  const spent = totalSpent(os);
  const sc = STATUS_COLOR[c.status];

  const edit = (m: (x: Contact) => void) =>
    commit((d) => {
      const x = (d.contacts || []).find((y) => y.id === contactId);
      if (x) m(x);
    });

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(74,44,77,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 16px", overflowY: "auto" }}
    >
      <div onClick={(e) => e.stopPropagation()} className="bg-cream rounded-3xl shadow-panel w-full" style={{ maxWidth: 560, margin: "0 auto" }}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 rounded-t-3xl" style={{ background: "#4A2C4D", color: "#FBF7F2", padding: "18px 22px" }}>
          <div style={{ minWidth: 0 }}>
            <p className="m-0 font-display font-bold flex items-center gap-2 flex-wrap" style={{ fontSize: 22 }}>
              {c.name || "(no name)"}
              <span className="text-[11px] font-extrabold rounded-full" style={{ padding: "3px 10px", background: sc.bg, color: sc.fg }}>{c.status}</span>
            </p>
            <p className="m-0 mt-0.5 text-[13px]" style={{ color: "#F3C6C6" }}>
              {os.length} order{os.length === 1 ? "" : "s"} · £{spent} total · via {c.source}
            </p>
          </div>
          <button onClick={onClose} className="cursor-pointer border-0 rounded-full font-extrabold" style={{ background: "rgba(251,247,242,0.15)", color: "#FBF7F2", width: 34, height: 34, fontSize: 16 }} aria-label="Close">✕</button>
        </div>

        <div style={{ padding: 22 }}>
          {/* Outreach — one-tap, real click only */}
          <div className="flex gap-2 flex-wrap mb-5">
            <button
              type="button"
              disabled={!c.phone}
              onClick={() => { if (c.phone) window.location.href = `tel:${c.phone}`; }}
              className="cursor-pointer border-0 rounded-full font-sans font-extrabold text-[13px] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "#EDEAEE", color: "#4A2C4D", padding: "9px 16px", minHeight: 42 }}
            >📞 Call</button>
            <button
              type="button"
              disabled={!c.phone}
              onClick={() => { if (c.phone) window.open(waLink(c, store.settings.whatsappTemplate), "_blank", "noopener,noreferrer"); }}
              className="cursor-pointer border-0 text-white font-extrabold text-[13px] rounded-full disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ padding: "9px 16px", minHeight: 42, background: "#25D366" }}
            >WhatsApp</button>
            <button
              type="button"
              disabled={!c.email}
              onClick={() => { if (c.email) window.location.href = mailtoLink(c, store.settings.emailTemplate); }}
              className="cursor-pointer border-0 bg-gold text-plum font-extrabold text-[13px] rounded-full disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ padding: "9px 16px", minHeight: 42 }}
            >✉ Email</button>
          </div>

          {/* Editable details */}
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            <label className={label}>NAME<input value={c.name} onChange={(e) => edit((x) => { x.name = e.target.value; })} className={input} /></label>
            <label className={label}>EMAIL<input value={c.email} onChange={(e) => edit((x) => { x.email = e.target.value.trim(); })} className={input} /></label>
            <label className={label}>PHONE<input value={c.phone} onChange={(e) => edit((x) => { x.phone = e.target.value.trim(); })} className={input} /></label>
            <label className={label}>POSTCODE<input value={c.postcode} onChange={(e) => edit((x) => { x.postcode = e.target.value.trim(); })} className={input} /></label>
            <label className={label}>STATUS
              <select value={c.status} onChange={(e) => edit((x) => { x.status = e.target.value as ContactStatus; })} className={input} style={{ minHeight: 40 }}>
                {CONTACT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className={label}>FOLLOW UP ON<input type="date" value={c.followUpDate} onChange={(e) => edit((x) => { x.followUpDate = e.target.value; })} className={input} /></label>
          </div>

          <label className="flex items-center gap-2 mt-3 text-[13px] cursor-pointer">
            <input type="checkbox" checked={c.marketingConsent} onChange={(e) => edit((x) => { x.marketingConsent = e.target.checked; })} style={{ width: 16, height: 16, accentColor: "#FF6F61" }} />
            Marketing consent given
          </label>

          {/* Occasion memory + next anniversary */}
          <div className="grid gap-2.5 mt-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            <label className={label}>🎉 OCCASION MEMORY<input value={c.occasion} onChange={(e) => edit((x) => { x.occasion = e.target.value; })} placeholder="e.g. Sofia's 1st birthday" className={input} /></label>
            <label className={label}>OCCASION DATE<input type="date" value={c.occasionDate} onChange={(e) => edit((x) => { x.occasionDate = e.target.value; })} className={input} /></label>
          </div>
          {c.occasionDate && (
            <p className="m-0 mt-2 text-[12.5px] text-plum-soft">
              Next anniversary: <strong>{nextAnniversaryLabel(c.occasionDate)}</strong> — a good moment for a friendly nudge.
            </p>
          )}

          <label className={`${label} mt-3`}>NOTES &amp; FOLLOW-UPS
            <textarea value={c.notes} onChange={(e) => edit((x) => { x.notes = e.target.value; })} rows={4} className={`${input} font-sans`} placeholder="Free-text notes, past conversations, what to follow up on…" />
          </label>

          {/* Order history — click a row to open the order */}
          <p className="m-0 mt-4 mb-1.5 font-extrabold text-[13px]">Order history ({os.length}) · total £{spent}</p>
          <div className="flex flex-col gap-1.5">
            {os.length === 0 && <span className="text-[12.5px] text-plum-soft">No orders yet.</span>}
            {os.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => onOpenOrder(o.id)}
                className="jn-click cursor-pointer bg-white border-0 rounded-xl text-left flex justify-between items-center gap-2 flex-wrap"
                style={{ padding: "9px 13px" }}
              >
                <span className="text-[12.5px]">
                  <strong>{o.id}</strong> · {store.products.find((p) => p.id === o.product)?.name || o.product} · {prettyDate(o.date)}
                  {o.archived ? <span className="text-plum-soft"> · cancelled</span> : ""}
                </span>
                <span className="text-[12.5px] font-bold" style={{ whiteSpace: "nowrap" }}>{o.status}{o.depositPaid ? ` · £${o.depositPaid} paid` : ""} ›</span>
              </button>
            ))}
          </div>

          {/* GDPR erase — behind an explicit confirm */}
          <div className="mt-5 flex items-center gap-2 flex-wrap" style={{ borderTop: "1px solid #F3C6C6", paddingTop: 16 }}>
            <span className="text-[12px] text-plum-soft" style={{ flex: 1, minWidth: 160 }}>Erasing removes this contact and anonymises their orders. This can&apos;t be undone.</span>
            {confirmDelete ? (
              <span className="flex gap-2 items-center text-[12.5px]">
                <span className="font-bold" style={{ color: "#c14a3e" }}>Delete all data?</span>
                <button onClick={async () => { setConfirmDelete(false); await onDelete(c.id); onClose(); }} className="cursor-pointer border-0 text-white font-extrabold text-[12px] rounded-full" style={{ padding: "8px 14px", background: "#c14a3e" }}>Yes, erase</button>
                <button onClick={() => setConfirmDelete(false)} className="cursor-pointer bg-white border-0 font-bold text-[12px] rounded-full" style={{ padding: "8px 14px" }}>Cancel</button>
              </span>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="cursor-pointer bg-white border-2 font-extrabold text-[12.5px] rounded-full" style={{ padding: "8px 14px", borderColor: "#c14a3e", color: "#c14a3e" }}>Delete all data</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Friendly label for the next recurrence of an occasion date (day + month). Purely
// presentational — the anniversaries widget on the Overview does the real
// scheduling from order dates.
function nextAnniversaryLabel(iso: string): string {
  const base = new Date(iso + "T12:00");
  if (isNaN(base.getTime())) return iso;
  return base.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}
