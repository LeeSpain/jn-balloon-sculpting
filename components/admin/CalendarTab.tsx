"use client";

import { useMemo, useState } from "react";
import type { Store, Assignee, CalendarBlock } from "@/lib/types";
import {
  eventsInRange, conflicts, EVENT_STYLE, addDaysISO, ASSIGNEES, isDayBlocked,
  type CalEvent, type EventType,
} from "@/lib/calendar";
import { normContact } from "@/lib/crm";
import { toIntlDigits } from "@/lib/phone";
import { uid } from "@/lib/ids";

const card = "bg-white rounded-2xl shadow-card";
const btn = "cursor-pointer border-0 font-sans font-extrabold rounded-full";
const inp = "rounded-xl bg-cream border-2 border-blush font-sans text-plum text-[13px] px-2.5 py-1.5";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TYPE_LABEL: Record<EventType, string> = { delivery: "Delivery", build: "Build slot", followup: "Follow-up", block: "Blocked", personal: "Personal" };

// Monday-based week index (0=Mon)
const mondayIdx = (iso: string) => (new Date(iso + "T12:00").getDay() + 6) % 7;
const startOfMonth = (iso: string) => iso.slice(0, 8) + "01";
const fmtMonth = (iso: string) => new Date(iso + "T12:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" });
const fmtDay = (iso: string) => new Date(iso + "T12:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const dayNum = (iso: string) => iso.slice(8, 10).replace(/^0/, "");

export default function CalendarTab({
  store, commit, onOpenOrder, onOpenContact,
}: {
  store: Store;
  commit: (m: (d: Store) => void) => void;
  onOpenOrder: (id: string) => void;
  onOpenContact: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [cursor, setCursor] = useState(today);
  const [selDay, setSelDay] = useState(today);
  const [filter, setFilter] = useState<"all" | Assignee>("all");
  const [notify, setNotify] = useState<{ orderId: string; date: string } | null>(null);
  const [subUrl, setSubUrl] = useState("");
  const [newBlock, setNewBlock] = useState<{ title: string; date: string; kind: "blocked" | "personal"; recurrence: "none" | "weekly" }>({ title: "", date: today, kind: "blocked", recurrence: "none" });

  // Visible range
  const range = useMemo(() => {
    if (view === "day") return { from: cursor, to: cursor, days: [cursor] };
    if (view === "week") {
      const from = addDaysISO(cursor, -mondayIdx(cursor));
      return { from, to: addDaysISO(from, 6), days: Array.from({ length: 7 }, (_, i) => addDaysISO(from, i)) };
    }
    const first = startOfMonth(cursor);
    const gridStart = addDaysISO(first, -mondayIdx(first));
    const days = Array.from({ length: 42 }, (_, i) => addDaysISO(gridStart, i));
    return { from: gridStart, to: days[41], days };
  }, [view, cursor]);

  const events = useMemo(
    () => eventsInRange(store, range.from, range.to).filter((e) => filter === "all" || e.assignee === filter || e.assignee === "Both"),
    [store, range.from, range.to, filter],
  );
  const byDay = useMemo(() => {
    const m: Record<string, CalEvent[]> = {};
    for (const e of events) (m[e.date] ||= []).push(e);
    return m;
  }, [events]);
  const conf = useMemo(() => conflicts(store, range.from, range.to), [store, range.from, range.to]);

  // ---- reschedule via drag/drop ----
  function reschedule(e: CalEvent, newDate: string) {
    if (newDate === e.date) return;
    if (e.type === "build" && e.orderId) commit((d) => { const o = d.orders.find((x) => x.id === e.orderId); if (o) o.buildDate = newDate; });
    else if (e.type === "followup" && e.contactId) commit((d) => { const c = d.contacts.find((x) => x.id === e.contactId); if (c) c.followUpDate = newDate; });
    else if ((e.type === "block" || e.type === "personal") && e.blockId) commit((d) => { const b = d.blocks.find((x) => x.id === e.blockId); if (b) b.date = newDate; });
    else if (e.type === "delivery" && e.orderId) {
      commit((d) => { const o = d.orders.find((x) => x.id === e.orderId); if (o) o.date = newDate; });
      setNotify({ orderId: e.orderId, date: newDate });
    }
  }
  const onDrop = (ev: React.DragEvent, date: string) => {
    ev.preventDefault();
    try { reschedule(JSON.parse(ev.dataTransfer.getData("text/plain")) as CalEvent, date); } catch { /* ignore */ }
  };

  const openEvent = (e: CalEvent) => {
    if (e.orderId) onOpenOrder(e.orderId);
    else if (e.contactId) onOpenContact();
  };

  const setAssignee = (e: CalEvent, a: Assignee) => {
    // A build slot assigns the MAKER; a delivery event assigns the DELIVERER —
    // so "who's on today" reflects making vs delivering, not one lumped owner.
    if (e.orderId) commit((d) => {
      const o = d.orders.find((x) => x.id === e.orderId);
      if (!o) return;
      if (e.type === "build") o.maker = a;
      else if (e.type === "delivery") o.deliverer = a;
      else o.assignee = a;
    });
    else if (e.contactId) commit((d) => { const c = d.contacts.find((x) => x.id === e.contactId); if (c) c.assignee = a; });
    else if (e.blockId) commit((d) => { const b = d.blocks.find((x) => x.id === e.blockId); if (b) b.assignee = a; });
  };

  async function getSubscribeUrl() {
    const r = await fetch("/api/admin/calendar-token", { method: "POST" });
    if (r.ok) setSubUrl((await r.json()).url);
  }
  function addBlock() {
    if (!newBlock.date) return;
    const b: CalendarBlock = { id: uid("blk"), title: newBlock.title || (newBlock.kind === "blocked" ? "Blocked" : "Personal"), date: newBlock.date, kind: newBlock.kind, recurrence: newBlock.recurrence };
    commit((d) => { (d.blocks ||= []).push(b); });
    setNewBlock({ title: "", date: today, kind: "blocked", recurrence: "none" });
  }

  const notifyOrder = notify ? store.orders.find((o) => o.id === notify.orderId) : null;

  const EventChip = ({ e, compact }: { e: CalEvent; compact?: boolean }) => {
    const s = EVENT_STYLE[e.type];
    return (
      <div
        draggable
        onDragStart={(ev) => ev.dataTransfer.setData("text/plain", JSON.stringify(e))}
        onClick={() => openEvent(e)}
        title={`${TYPE_LABEL[e.type]}: ${e.title} — ${e.subtitle}`}
        className="cursor-pointer rounded-md truncate"
        style={{ background: s.bg, color: s.fg, fontSize: compact ? 10.5 : 12, fontWeight: 700, padding: compact ? "1px 5px" : "3px 8px", marginBottom: 2 }}
      >
        {e.title}{e.assignee ? ` · ${e.assignee[0]}` : ""}
      </div>
    );
  };

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h1 className="font-display m-0" style={{ fontSize: 30 }}>Calendar</h1>
        <div className="flex gap-1.5 flex-wrap items-center">
          {(["month", "week", "day"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={btn} style={{ padding: "7px 14px", fontSize: 13, background: view === v ? "#4A2C4D" : "#fff", color: view === v ? "#FBF7F2" : "#4A2C4D", border: view === v ? "0" : "2px solid #F3C6C6" }}>{v[0].toUpperCase() + v.slice(1)}</button>
          ))}
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className={inp} style={{ minHeight: 36 }}>
            <option value="all">Everyone</option>
            {ASSIGNEES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* nav */}
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => setCursor(addDaysISO(cursor, view === "month" ? -28 : view === "week" ? -7 : -1))} className={`${btn} bg-cream`} style={{ padding: "6px 12px" }}>‹</button>
        <button onClick={() => { setCursor(today); setSelDay(today); }} className={`${btn} bg-cream`} style={{ padding: "6px 12px", fontSize: 12.5, fontWeight: 800 }}>Today</button>
        <button onClick={() => setCursor(addDaysISO(cursor, view === "month" ? 28 : view === "week" ? 7 : 1))} className={`${btn} bg-cream`} style={{ padding: "6px 12px" }}>›</button>
        <span className="font-display" style={{ fontSize: 19 }}>{view === "day" ? fmtDay(cursor) : fmtMonth(cursor)}</span>
      </div>

      {/* legend */}
      <div className="flex gap-3 flex-wrap mb-3 text-[12px]">
        {(Object.keys(EVENT_STYLE) as EventType[]).map((t) => (
          <span key={t} className="flex items-center gap-1.5"><span style={{ width: 12, height: 12, borderRadius: 3, background: EVENT_STYLE[t].bg, display: "inline-block" }} />{TYPE_LABEL[t]}</span>
        ))}
      </div>

      {conf.length > 0 && (
        <div className="rounded-2xl mb-3" style={{ background: "#FFF3F1", border: "2px solid #FF6F61", padding: "12px 16px" }}>
          <p className="m-0 mb-1 font-extrabold text-[12.5px] text-coral" style={{ letterSpacing: "0.5px" }}>⚠ CONFLICTS</p>
          {conf.map((c, i) => <p key={i} className="m-0 text-[13px] font-semibold">{c.message}</p>)}
        </div>
      )}

      {/* MONTH grid */}
      {view === "month" && (
        <div className={card} style={{ padding: 10, overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(84px, 1fr))", gap: 4 }}>
            {DOW.map((d) => <div key={d} className="text-center font-extrabold text-[11px] text-plum-soft" style={{ padding: "2px 0" }}>{d}</div>)}
            {range.days.map((d) => {
              const inMonth = d.slice(0, 7) === cursor.slice(0, 7);
              const blocked = isDayBlocked(store, d);
              return (
                <div key={d} onClick={() => setSelDay(d)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, d)}
                  style={{ minHeight: 82, borderRadius: 10, padding: 4, background: blocked ? "#F0E9F1" : d === today ? "#FFF3F1" : "#FBF7F2", border: d === selDay ? "2px solid #FF6F61" : "1px solid #F3C6C6", opacity: inMonth ? 1 : 0.45, cursor: "pointer" }}>
                  <div className="text-[11px] font-bold" style={{ color: d === today ? "#FF6F61" : "#7a5f7d" }}>{dayNum(d)}</div>
                  {(byDay[d] || []).slice(0, 4).map((e) => <EventChip key={e.id} e={e} compact />)}
                  {(byDay[d] || []).length > 4 && <div className="text-[10px] text-plum-soft">+{byDay[d].length - 4} more</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* WEEK columns */}
      {view === "week" && (
        <div className={card} style={{ padding: 10, overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(110px, 1fr))", gap: 6 }}>
            {range.days.map((d) => (
              <div key={d} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, d)} style={{ minHeight: 160, background: isDayBlocked(store, d) ? "#F0E9F1" : "#FBF7F2", borderRadius: 10, padding: 6, border: d === today ? "2px solid #FF6F61" : "1px solid #F3C6C6" }}>
                <div className="text-[11.5px] font-extrabold mb-1">{fmtDay(d)}</div>
                {(byDay[d] || []).map((e) => <EventChip key={e.id} e={e} />)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DAY / selected-day detail list (also under the month grid) */}
      {(view === "day" || view === "month") && (
        <div className={card} style={{ padding: "16px 18px", marginTop: 12 }}>
          <h3 className="font-display m-0 mb-2" style={{ fontSize: 18 }}>{fmtDay(view === "day" ? cursor : selDay)}</h3>
          <DayDetail store={store} date={view === "day" ? cursor : selDay} events={(byDay[view === "day" ? cursor : selDay] || [])} onOpen={openEvent} onAssign={setAssignee} />
        </div>
      )}

      {/* Blocks + availability + subscribe */}
      <div className="grid gap-3 mt-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <div className={card} style={{ padding: "16px 18px" }}>
          <h3 className="font-display m-0 mb-2" style={{ fontSize: 17 }}>Personal / blocked time</h3>
          <div className="flex flex-col gap-1.5 mb-3">
            {(store.blocks || []).map((b) => (
              <div key={b.id} className="flex items-center gap-2 text-[13px]">
                <span style={{ width: 10, height: 10, borderRadius: 3, background: EVENT_STYLE[b.kind === "blocked" ? "block" : "personal"].bg }} />
                <span className="flex-1">{b.title} · {b.recurrence === "weekly" ? `every ${fmtDay(b.date).slice(0, 3)}` : fmtDay(b.date)}{b.kind === "blocked" ? " · no deliveries" : ""}</span>
                <button onClick={() => commit((d) => { d.blocks = d.blocks.filter((x) => x.id !== b.id); })} className={`${btn}`} style={{ padding: "3px 9px", background: "#FFE3DF", color: "#c14a3e", fontSize: 12 }}>✕</button>
              </div>
            ))}
            {(store.blocks || []).length === 0 && <span className="text-[12.5px] text-plum-soft">None yet.</span>}
          </div>
          <div className="flex gap-1.5 flex-wrap items-end">
            <input value={newBlock.title} onChange={(e) => setNewBlock({ ...newBlock, title: e.target.value })} placeholder="e.g. School run" className={inp} style={{ flex: "1 1 120px" }} />
            <input type="date" value={newBlock.date} onChange={(e) => setNewBlock({ ...newBlock, date: e.target.value })} className={inp} />
            <select value={newBlock.kind} onChange={(e) => setNewBlock({ ...newBlock, kind: e.target.value as "blocked" | "personal" })} className={inp}><option value="blocked">Blocks deliveries</option><option value="personal">Personal (info)</option></select>
            <select value={newBlock.recurrence} onChange={(e) => setNewBlock({ ...newBlock, recurrence: e.target.value as "none" | "weekly" })} className={inp}><option value="none">One-off</option><option value="weekly">Weekly</option></select>
            <button onClick={addBlock} className={`${btn} bg-plum text-cream`} style={{ padding: "8px 14px", fontSize: 13 }}>Add</button>
          </div>
        </div>

        <div className={card} style={{ padding: "16px 18px" }}>
          <h3 className="font-display m-0 mb-2" style={{ fontSize: 17 }}>Availability</h3>
          <div className="flex gap-3 flex-wrap">
            <label className="flex flex-col gap-1 text-[11.5px] font-extrabold text-gold-ink">MAX DELIVERIES / DAY
              <input type="number" min={1} value={store.settings.maxDeliveriesPerDay} onChange={(e) => commit((d) => { d.settings.maxDeliveriesPerDay = parseInt(e.target.value) || 1; })} className={inp} style={{ width: 80 }} />
            </label>
            <label className="flex flex-col gap-1 text-[11.5px] font-extrabold text-gold-ink">WORKING HOURS
              <span className="flex gap-1 items-center">
                <input type="time" value={store.settings.workDayStart} onChange={(e) => commit((d) => { d.settings.workDayStart = e.target.value; })} className={inp} />
                <input type="time" value={store.settings.workDayEnd} onChange={(e) => commit((d) => { d.settings.workDayEnd = e.target.value; })} className={inp} />
              </span>
            </label>
          </div>
          <p className="m-0 mt-2 text-[12px] text-plum-soft">Full or blocked days are automatically removed from the customer date picker.</p>
          <div className="mt-3">
            <button onClick={getSubscribeUrl} className={`${btn} bg-gold text-plum`} style={{ padding: "8px 14px", fontSize: 12.5 }}>📅 Get calendar subscribe link (.ics)</button>
            {subUrl && <p className="m-0 mt-2 text-[11.5px] break-all"><code className="bg-cream" style={{ padding: "2px 5px", borderRadius: 4 }}>{subUrl}</code><br />Add this in Google/Apple Calendar → &quot;Subscribe from URL&quot;.</p>}
          </div>
        </div>
      </div>

      {/* Notify-customer prompt after a delivery drag */}
      {notify && notifyOrder && (
        <NotifyModal store={store} order={notifyOrder} date={notify.date} onClose={() => setNotify(null)} />
      )}
    </>
  );
}

function DayDetail({ store, date, events, onOpen, onAssign }: { store: Store; date: string; events: CalEvent[]; onOpen: (e: CalEvent) => void; onAssign: (e: CalEvent, a: Assignee) => void }) {
  if (events.length === 0) return <p className="m-0 text-[13px] text-plum-soft">Nothing scheduled.</p>;
  return (
    <div className="flex flex-col gap-2">
      {events.map((e) => {
        const s = EVENT_STYLE[e.type];
        return (
          <div key={e.id} style={{ padding: "7px 10px", borderRadius: 10, background: "#FBF7F2", borderLeft: `4px solid ${s.bg}` }}>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[10px] font-extrabold rounded-full" style={{ background: s.bg, color: s.fg, padding: "2px 8px" }}>{e.type === "personal" ? "PERSONAL" : e.type.toUpperCase()}</span>
              <span className="flex-1 min-w-[140px]">
                <span className="font-bold text-[14px] cursor-pointer" onClick={() => onOpen(e)}>{e.title}</span>
                {e.subtitle && <span className="text-[12.5px] text-plum-soft"> · {e.subtitle}</span>}
              </span>
              {(e.orderId || e.contactId || e.blockId) && (
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-plum-soft">
                  {e.type === "build" ? "Making" : e.type === "delivery" ? "Delivering" : "Owner"}
                  <select value={e.assignee || ""} onChange={(ev) => onAssign(e, ev.target.value as Assignee)} className="rounded-lg bg-white border-2 border-blush text-[12px]" style={{ padding: "3px 6px" }}>
                    <option value="">Unassigned</option>{ASSIGNEES.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </label>
              )}
            </div>
            {/* On the day, the deliverer needs the number + any note in one tap. */}
            {(e.phone || e.notes) && (
              <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 6 }}>
                {e.phone && (
                  <>
                    <button type="button" onClick={() => { window.location.href = `tel:${e.phone}`; }} className="cursor-pointer border-0 rounded-full font-sans font-extrabold text-[11.5px]" style={{ background: "#EDEAEE", color: "#4A2C4D", padding: "5px 11px" }}>📞 {e.phone}</button>
                    <button type="button" onClick={() => e.phone && window.open(`https://wa.me/${toIntlDigits(e.phone)}`, "_blank", "noopener,noreferrer")} className="cursor-pointer border-0 rounded-full font-sans font-extrabold text-[11.5px] text-white" style={{ background: "#25D366", padding: "5px 11px" }}>WhatsApp</button>
                  </>
                )}
                {e.notes && (
                  <span className="text-[12px] rounded-lg" style={{ background: "#FFF8ED", border: "1px solid #E6C88A", color: "#8a6a1a", padding: "5px 9px", whiteSpace: "pre-wrap" }}>📝 {e.notes}</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NotifyModal({ store, order, date, onClose }: { store: Store; order: Store["orders"][number]; date: string; onClose: () => void }) {
  const contact = (store.contacts || []).find((c) => normContact(c.phone) === normContact(order.phone) || normContact(c.email) === normContact(order.phone));
  const name = (contact?.name || order.customer).replace(" (custom enquiry)", "");
  const pretty = new Date(date + "T12:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const msg = `Hi ${name}, just to let you know your J&N Balloon Sculpting delivery is now booked for ${pretty}. Any questions, just reply!`;
  const email = contact?.email || (order.phone.includes("@") ? order.phone : "");
  let digits = (contact?.phone || (order.phone.includes("@") ? "" : order.phone)).replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "44" + digits.slice(1);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(74,44,77,0.5)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div className="bg-white rounded-3xl" style={{ padding: 24, maxWidth: 420, width: "100%" }} onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display m-0 mb-1" style={{ fontSize: 20 }}>Delivery moved to {pretty}</h3>
        <p className="m-0 mb-3 text-[13.5px] text-plum-soft">Notify {name}? This opens a pre-filled message with the new date.</p>
        <div className="flex gap-2 flex-wrap">
          <button type="button" disabled={!email} onClick={() => { if (email) window.location.href = `mailto:${email}?subject=${encodeURIComponent("Your J&N delivery date")}&body=${encodeURIComponent(msg)}`; }} className="cursor-pointer border-0 bg-gold text-plum font-extrabold text-[13px] rounded-full disabled:opacity-40 disabled:cursor-not-allowed" style={{ padding: "9px 16px" }}>✉ Email</button>
          <button type="button" disabled={!digits} onClick={() => { if (digits) window.open(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer"); }} className="cursor-pointer border-0 text-white font-extrabold text-[13px] rounded-full disabled:opacity-40 disabled:cursor-not-allowed" style={{ padding: "9px 16px", background: "#25D366" }}>WhatsApp</button>
          <span style={{ flex: 1 }} />
          <button onClick={onClose} className="cursor-pointer bg-cream border-0 font-bold text-[13px] rounded-full" style={{ padding: "9px 16px" }}>Skip</button>
        </div>
      </div>
    </div>
  );
}
