"use client";

import { useMemo, useState } from "react";
import type { Store, Contact, ContactStatus } from "@/lib/types";
import {
  CONTACT_STATUSES,
  ordersForContact,
  totalSpent,
  mailtoLink,
  waLink,
  contactsToCsv,
  prettyDate,
  normContact,
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

export default function ContactsTab({
  store,
  commit,
  onDelete,
}: {
  store: Store;
  commit: (m: (d: Store) => void) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | ContactStatus>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const contacts = useMemo(() => store.contacts || [], [store.contacts]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => {
      if (filter !== "all" && c.status !== filter) return false;
      if (!q) return true;
      return [c.name, c.email, c.phone, c.postcode].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [contacts, query, filter]);

  const editC = (id: string, m: (c: Contact) => void) =>
    commit((d) => {
      const c = (d.contacts || []).find((x) => x.id === id);
      if (c) m(c);
    });

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
      <p className="m-0 mb-4 text-plum-soft text-[15px]">Every booking and enquiry becomes a contact automatically. {contacts.length} total.</p>

      {/* Search + filter */}
      <div className="flex gap-2 flex-wrap mb-4">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, postcode…" className={`${input} flex-1`} style={{ minWidth: 220 }} />
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className={input} style={{ minHeight: 42 }}>
          <option value="all">All statuses</option>
          {CONTACT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Message templates */}
      <details className={card} style={{ padding: "14px 18px", marginBottom: 16 }}>
        <summary className="cursor-pointer font-extrabold text-[14px]">Message templates (used by the email / WhatsApp buttons)</summary>
        <div className="flex flex-col gap-3 mt-3" style={{ maxWidth: 620 }}>
          <label className={label} style={{ letterSpacing: "0.5px" }}>EMAIL TEMPLATE
            <textarea value={store.settings.emailTemplate} onChange={(e) => commit((d) => { d.settings.emailTemplate = e.target.value; })} rows={4} className={`${input} font-sans`} />
          </label>
          <label className={label} style={{ letterSpacing: "0.5px" }}>WHATSAPP TEMPLATE
            <textarea value={store.settings.whatsappTemplate} onChange={(e) => commit((d) => { d.settings.whatsappTemplate = e.target.value; })} rows={3} className={`${input} font-sans`} />
          </label>
          <p className="m-0 text-[12px] text-plum-soft">Placeholders: <code>{"{name}"}</code>, <code>{"{occasion}"}</code>, <code>{"{date}"}</code>.</p>
        </div>
      </details>

      {/* List */}
      <div className="flex flex-col gap-2.5">
        {filtered.length === 0 && <p className="text-plum-soft text-[14px]">No contacts match.</p>}
        {filtered.map((c) => {
          const os = ordersForContact(store, c);
          const spent = totalSpent(os);
          const open = openId === c.id;
          const sc = STATUS_COLOR[c.status];
          return (
            <div key={c.id} className={card} style={{ padding: 0, overflow: "hidden" }}>
              <button onClick={() => setOpenId(open ? null : c.id)} className="w-full cursor-pointer bg-white border-0 text-left flex items-center gap-3 flex-wrap" style={{ padding: "14px 18px" }}>
                <span className="font-extrabold text-[15px]" style={{ flex: "1 1 160px" }}>{c.name || "(no name)"}</span>
                <span className="text-xs font-extrabold rounded-full" style={{ padding: "4px 10px", background: sc.bg, color: sc.fg }}>{c.status}</span>
                <span className="text-[12.5px] text-plum-soft" style={{ flex: "1 1 160px" }}>{c.email || c.phone || "—"}</span>
                {c.followUpDate && <span className="text-[12px] font-bold" style={{ color: "#c14a3e" }}>↻ {prettyDate(c.followUpDate)}</span>}
                <span className="font-extrabold text-[14px] text-coral-deep">£{spent}</span>
              </button>

              {open && (
                <div style={{ padding: "4px 18px 18px", borderTop: "1px solid #F3C6C6" }}>
                  {/* editable fields */}
                  <div className="grid gap-2.5 mt-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
                    <label className={label}>NAME<input value={c.name} onChange={(e) => editC(c.id, (x) => { x.name = e.target.value; })} className={input} /></label>
                    <label className={label}>EMAIL<input value={c.email} onChange={(e) => editC(c.id, (x) => { x.email = e.target.value.trim(); })} className={input} /></label>
                    <label className={label}>PHONE<input value={c.phone} onChange={(e) => editC(c.id, (x) => { x.phone = e.target.value.trim(); })} className={input} /></label>
                    <label className={label}>POSTCODE<input value={c.postcode} onChange={(e) => editC(c.id, (x) => { x.postcode = e.target.value.trim(); })} className={input} /></label>
                    <label className={label}>STATUS
                      <select value={c.status} onChange={(e) => editC(c.id, (x) => { x.status = e.target.value as ContactStatus; })} className={input} style={{ minHeight: 40 }}>
                        {CONTACT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </label>
                    <label className={label}>FOLLOW UP ON<input type="date" value={c.followUpDate} onChange={(e) => editC(c.id, (x) => { x.followUpDate = e.target.value; })} className={input} /></label>
                  </div>

                  <label className="flex items-center gap-2 mt-3 text-[13px] cursor-pointer">
                    <input type="checkbox" checked={c.marketingConsent} onChange={(e) => editC(c.id, (x) => { x.marketingConsent = e.target.checked; })} style={{ width: 16, height: 16, accentColor: "#FF6F61" }} />
                    Marketing consent given
                  </label>

                  <label className={`${label} mt-3`}>NOTES
                    <textarea value={c.notes} onChange={(e) => editC(c.id, (x) => { x.notes = e.target.value; })} rows={3} className={`${input} font-sans`} placeholder="Free-text notes…" />
                  </label>

                  {(c.occasion || c.occasionDate) && (
                    <p className="m-0 mt-3 text-[13px] text-plum-soft">🎉 Occasion memory: <strong>{c.occasion || "—"}</strong>{c.occasionDate ? ` · ${prettyDate(c.occasionDate)}` : ""} · <span>source: {c.source}</span></p>
                  )}

                  {/* history */}
                  <p className="m-0 mt-3 mb-1 font-extrabold text-[13px]">History ({os.length} order{os.length === 1 ? "" : "s"}) · total £{spent}</p>
                  <div className="flex flex-col gap-1">
                    {os.length === 0 && <span className="text-[12.5px] text-plum-soft">No orders yet.</span>}
                    {os.map((o) => (
                      <div key={o.id} className="flex justify-between text-[12.5px]" style={{ padding: "3px 0" }}>
                        <span>{o.id} · {store.products.find((p) => p.id === o.product)?.name || o.product} · {prettyDate(o.date)}</span>
                        <span className="font-bold">{o.status}{o.depositPaid ? ` · £${o.depositPaid} paid` : ""}</span>
                      </div>
                    ))}
                  </div>

                  {/* outreach + delete — buttons (no declarative href), so they
                      can ONLY fire on a deliberate click, never on focus/Enter/
                      re-render/assistive-tech activation. */}
                  <div className="flex gap-2 flex-wrap mt-4 items-center">
                    <button
                      type="button"
                      disabled={!c.email}
                      onClick={() => { if (c.email) window.location.href = mailtoLink(c, store.settings.emailTemplate); }}
                      className="cursor-pointer border-0 bg-gold text-plum font-extrabold text-[13px] rounded-full disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ padding: "9px 16px" }}
                    >✉ Email</button>
                    <button
                      type="button"
                      disabled={!c.phone}
                      onClick={() => { if (c.phone) window.open(waLink(c, store.settings.whatsappTemplate), "_blank", "noopener,noreferrer"); }}
                      className="cursor-pointer border-0 text-white font-extrabold text-[13px] rounded-full disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ padding: "9px 16px", background: "#25D366" }}
                    >WhatsApp</button>
                    <span style={{ flex: 1 }} />
                    {confirmDelete === c.id ? (
                      <span className="flex gap-2 items-center text-[12.5px]">
                        <span className="font-bold" style={{ color: "#c14a3e" }}>Delete all data?</span>
                        <button onClick={async () => { setConfirmDelete(null); await onDelete(c.id); }} className="cursor-pointer border-0 text-white font-extrabold text-[12px] rounded-full" style={{ padding: "7px 12px", background: "#c14a3e" }}>Yes, erase</button>
                        <button onClick={() => setConfirmDelete(null)} className="cursor-pointer bg-cream border-0 font-bold text-[12px] rounded-full" style={{ padding: "7px 12px" }}>Cancel</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmDelete(c.id)} className="cursor-pointer bg-white border-2 font-extrabold text-[12.5px] rounded-full" style={{ padding: "7px 14px", borderColor: "#c14a3e", color: "#c14a3e" }}>Delete all data</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
