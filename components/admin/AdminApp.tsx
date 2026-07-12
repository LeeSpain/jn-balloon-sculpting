"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Store, Order, OrderStatus, SiteImages, EnquiryStatus } from "@/lib/types";
import { priceProduct, consumeStock, gbp } from "@/lib/pricing";
import { assetUrl } from "@/lib/assets";
import { uid } from "@/lib/ids";
import { DEFAULT_IMAGES } from "@/lib/seed";
import { computeFinance } from "@/lib/finance";
import FinanceTab from "./FinanceTab";
import PricingTab from "./PricingTab";
import SiteCopyEditor from "./SiteCopyEditor";
import OrderDetailModal from "./OrderDetailModal";
import ConfirmActionModal from "./ConfirmActionModal";
import PaymentsSettings from "./PaymentsSettings";
import ContactsTab from "./ContactsTab";
import EnquiriesTab from "./EnquiriesTab";
import CalendarTab from "./CalendarTab";
import TriageBanner from "./TriageBanner";
import { eventsInRange, EVENT_STYLE, unacknowledgedOrders, makerOf, delivererOf, personOnOrder } from "@/lib/calendar";
import type { Assignee } from "@/lib/types";
import { followUpsDue, anniversaries, prettyDate as crmPretty, normContact, ordersForContact, findContact, fillTemplate } from "@/lib/crm";
import { toIntlDigits } from "@/lib/phone";

// Downscale a chosen image on the client and return a compressed Blob. Vector
// and animated formats are passed through untouched. Photos become JPEG; logos
// and favicons keep transparency as PNG.
async function compressImage(
  file: File,
  maxDim: number,
  mime: "image/jpeg" | "image/png",
  quality = 0.82,
): Promise<Blob> {
  if (/svg|gif|icon/.test(file.type)) return file; // don't rasterise these
  const dataUrl: string = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(file);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => resolve(b || file), mime, quality);
    };
    image.onerror = () => resolve(file);
    image.src = dataUrl;
  });
}

type Tab = "overview" | "orders" | "enquiries" | "contacts" | "calendar" | "finance" | "pricing" | "zones" | "content" | "settings";

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  "Order received": { bg: "#F3C6C6", color: "#4A2C4D" },
  "Materials purchased": { bg: "#F2E7D8", color: "#8a6a3a" },
  "In progress": { bg: "#FFE3DF", color: "#c14a3e" },
  Ready: { bg: "#E4F0E4", color: "#3c7a3c" },
  Delivered: { bg: "#EDEAEE", color: "#7a5f7d" },
};

const STATUSES: OrderStatus[] = [
  "Order received",
  "Materials purchased",
  "In progress",
  "Ready",
  "Delivered",
];

const card = "bg-white rounded-2xl shadow-card";
const numInput =
  "border-2 border-blush rounded-xl font-bold bg-cream text-plum font-sans";
const fieldLabel =
  "flex flex-col gap-1.5 text-[12.5px] font-extrabold text-gold-ink";

function prettyDate(iso: string): string {
  return new Date(iso + "T12:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function AdminApp({
  initialStore,
  dbConnected,
  blobConnected,
  bookingsLive,
}: {
  initialStore: Store;
  dbConnected: boolean;
  blobConnected: boolean;
  bookingsLive: boolean;
}) {
  const [store, setStore] = useState<Store>(initialStore);
  const [tab, setTab] = useState<Tab>("overview");
  const [newTheme, setNewTheme] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [jobFilter, setJobFilter] = useState<"all" | "Jade" | "Nicole">("all"); // Orders "my jobs" filter
  const [orderView, setOrderView] = useState<"active" | "delivered" | "cancelled">("active"); // Active / Delivered / Cancelled
  const [reviewPrompt, setReviewPrompt] = useState<string | null>(null); // orderId just marked Delivered — offer a review request
  // Pending destructive action awaiting confirmation (archive/restore/delete).
  const [confirmAction, setConfirmAction] = useState<{ kind: "archive" | "delete"; orderId: string } | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string>("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const selectedOrder = selectedOrderId
    ? store.orders.find((o) => o.id === selectedOrderId) ?? null
    : null;

  // Apply a mutation to a clone, update the UI immediately, then persist to the
  // shared store — AWAITING the response so failures are surfaced, not swallowed.
  async function commit(mutator: (draft: Store) => void) {
    const draft: Store = structuredClone(store);
    mutator(draft);
    setStore(draft);
    setSaveState("saving");
    try {
      const res = await fetch("/api/admin/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store: draft }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Save failed (${res.status})`);
      }
      setSaveState("saved");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => setSaveState("idle"), 2000);
    } catch (e) {
      setSaveState("error");
      setSaveError(e instanceof Error ? e.message : "Save failed");
      // Re-sync from the server so the UI reflects what actually persisted.
      try {
        const r = await fetch("/api/admin/store");
        if (r.ok) {
          const j = await r.json();
          if (j.store) setStore(j.store);
        }
      } catch {
        /* leave optimistic state; user can retry */
      }
    }
  }

  // Compress an image, upload it to the shared store, and return its URL.
  // Returns null on failure (and flags the error in the save indicator).
  async function uploadImage(
    file: File,
    opts: { maxDim?: number; mime?: "image/jpeg" | "image/png" } = {},
  ): Promise<string | null> {
    setSaveState("saving");
    try {
      const blob = await compressImage(file, opts.maxDim ?? 1400, opts.mime ?? "image/jpeg");
      const fd = new FormData();
      const ext = (blob.type || file.type).includes("png") ? "png" : (blob.type || file.type).includes("svg") ? "svg" : "jpg";
      fd.append("file", blob, `upload.${ext}`);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Upload failed (${res.status})`);
      }
      const { url } = await res.json();
      return url as string;
    } catch (e) {
      setSaveState("error");
      setSaveError(e instanceof Error ? e.message : "Upload failed");
      return null;
    }
  }

  // ---- image slot helpers (hero, about, logo, favicon, OG) ----
  async function uploadSiteImage(slot: keyof SiteImages, file: File | undefined) {
    if (!file) return;
    const isMark = slot === "logo" || slot === "favicon";
    const url = await uploadImage(file, {
      maxDim: slot === "favicon" ? 512 : isMark ? 600 : slot === "ogImage" ? 1200 : 1600,
      mime: isMark ? "image/png" : "image/jpeg",
    });
    if (url) await commit((d) => { d.images[slot] = url; });
  }
  function resetSiteImage(slot: keyof SiteImages) {
    commit((d) => { d.images[slot] = DEFAULT_IMAGES[slot]; });
  }

  // ---- gallery photo helpers (now upload → URL, not inline data) ----
  async function changeGalleryPhoto(index: number, file: File | undefined) {
    if (!file) return;
    const url = await uploadImage(file, { maxDim: 1200 });
    if (url) await commit((d) => { d.gallery[index].src = url; });
  }
  async function addGalleryPhoto(file: File | undefined) {
    if (!file) return;
    const url = await uploadImage(file, { maxDim: 1200 });
    if (!url) return;
    const title = file.name.replace(/\.[^.]+$/, "").slice(0, 60) || "New piece";
    await commit((d) => { d.gallery.push({ id: uid("g"), title, src: url }); });
  }
  // Extra photos shown in the creation popup on the website.
  async function addGalleryExtraPhoto(index: number, file: File | undefined) {
    if (!file) return;
    const url = await uploadImage(file, { maxDim: 1200 });
    if (url) await commit((d) => { const g = d.gallery[index]; g.images = [...(g.images || []), url]; });
  }
  function removeGalleryExtraPhoto(index: number, photoIdx: number) {
    commit((d) => { (d.gallery[index].images || []).splice(photoIdx, 1); });
  }
  // Swap an extra photo with the cover (the card image on the website).
  function makeGalleryCover(index: number, photoIdx: number) {
    commit((d) => {
      const g = d.gallery[index];
      const imgs = [...(g.images || [])];
      const pick = imgs[photoIdx];
      if (!pick) return;
      imgs[photoIdx] = g.src;
      g.src = pick;
      g.images = imgs;
    });
  }

  // ---- product photo helpers ----
  async function uploadProductImage(index: number, file: File | undefined) {
    if (!file) return;
    const url = await uploadImage(file, { maxDim: 1000 });
    if (url) await commit((d) => { d.products[index].image = url; });
  }
  function resetProductImage(index: number) {
    commit((d) => { delete d.products[index].image; });
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  const setSetting = <K extends keyof Store["settings"]>(key: K, value: Store["settings"][K]) =>
    commit((d) => {
      d.settings[key] = value;
    });

  const productById = (id: string) => store.products.find((p) => p.id === id);
  const sizeById = (id: string) => store.sizes.find((s) => s.id === id) || { name: "Standard", mult: 1 };

  const tabDefs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "orders", label: "Orders" },
    { id: "enquiries", label: "Enquiries" },
    { id: "contacts", label: "Contacts" },
    { id: "calendar", label: "Calendar" },
    { id: "finance", label: "Finance" },
    { id: "pricing", label: "Costs & pricing" },
    { id: "zones", label: "Delivery zones" },
    { id: "content", label: "Site content" },
    { id: "settings", label: "Settings" },
  ];

  // Time-of-day greeting is computed only after mount. On production the server
  // runs in UTC but the browser is in the founder's local timezone, so rendering
  // it during SSR mismatches on hydration whenever the two fall in different
  // Morning/Afternoon/Evening buckets (a real React #425).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const greeting = mounted
    ? ((h) => (h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening"))(new Date().getHours()) + ", Jade & Nicole"
    : "Hello, Jade & Nicole";

  // ---- overview derived (finance figures come straight from the P&L engine) ----
  const { stats, upcoming, alerts } = useMemo(() => {
    const active = store.orders.filter((o) => o.status !== "Delivered" && !o.archived);
    const upcoming = active.slice().sort((a, b) => a.date.localeCompare(b.date));
    const fin = computeFinance(store, "active");
    const firstUp = upcoming[0];
    const stats: {
      label: string;
      value: string;
      sub: string;
      color: string;
      goTab?: Tab;
    }[] = [
      { label: "OPEN ORDERS", value: String(active.length), sub: "not yet delivered", color: "#4A2C4D", goTab: "orders" },
      { label: "BOOKED REVENUE", value: gbp(Math.round(fin.grossRevenue)), sub: "incl. delivery", color: "#4A2C4D", goTab: "finance" },
      { label: "NET PROFIT", value: gbp(Math.round(fin.netProfit)), sub: `${gbp(Math.round(fin.perOwner))} each · after costs & tax`, color: "#3c7a3c", goTab: "finance" },
      {
        label: "NEXT DELIVERY",
        value: firstUp ? prettyDate(firstUp.date) : "—",
        sub: firstUp ? (productById(firstUp.product)?.name ?? firstUp.product) : "nothing booked",
        color: "#FF6F61",
        goTab: "orders",
      },
    ];
    const alerts = store.materials
      .filter((m) => m.stock != null && m.lowAt != null && m.stock <= m.lowAt)
      .map((m) => `${m.name} running low (${m.stock} left) — time to reorder.`);
    return { stats, upcoming, alerts };
    // productById/sizeById derive from `store`, which is already a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  function orderTotal(o: Order) {
    return gbp(o.price + (o.delivery || 0));
  }
  // Owner profit per order: revenue − materials − delivery cost (no wage).
  function orderProfit(o: Order) {
    const p = productById(o.product);
    const sz = sizeById(o.size);
    const materials = p && p.recipe ? priceProduct(store, p, sz.mult).materials : 0;
    const deliveryCost = ((o.delivery || 0) * (store.settings.deliveryCostPct ?? 0)) / 100;
    return o.price + (o.delivery || 0) - materials - deliveryCost;
  }
  function setStatus(orderId: string, next: OrderStatus) {
    // Detect the moment an order first becomes Delivered so we can offer a review
    // request — delivered-and-delighted is the best time to ask.
    const before = store.orders.find((x) => x.id === orderId);
    const becomingDelivered = next === "Delivered" && !!before && before.status !== "Delivered";
    commit((d) => {
      const o = d.orders.find((x) => x.id === orderId);
      if (!o) return;
      // Consume stock the first time an order reaches "Materials purchased" OR
      // any later stage — jumping straight to "In progress"/"Ready"/"Delivered"
      // must not skip the deduction. Guarded by stockTaken so it runs once.
      const materialsStageOrLater =
        STATUSES.indexOf(next) >= STATUSES.indexOf("Materials purchased");
      if (materialsStageOrLater && !o.stockTaken) {
        consumeStock(d, o.product, o.size);
        o.stockTaken = true;
      }
      o.status = next;
      // Keep the linked CRM contact's pipeline in step: a delivered order moves
      // the contact to Delivered, or Repeat customer once they have 2+ delivered.
      if (next === "Delivered") {
        const c = (d.contacts || []).find((x) => normContact(x.phone) === normContact(o.phone) || normContact(x.email) === normContact(o.phone));
        if (c) {
          const delivered = ordersForContact(d, c).filter((x) => x.status === "Delivered").length;
          c.status = delivered >= 2 ? "Repeat customer" : "Delivered";
          // Post-delivery value: remember what this order was for, so it feeds the
          // outreach templates and next year's anniversaries-coming-up nudge.
          const prod = d.products.find((p) => p.id === o.product);
          if (prod) c.occasion = prod.name;
          c.occasionDate = o.date;
        }
      }
    });
    if (becomingDelivered) setReviewPrompt(orderId);
  }

  // ---- triage: making / delivering / acknowledge ----
  function setMaker(orderId: string, who: Assignee) {
    commit((d) => {
      const o = d.orders.find((x) => x.id === orderId);
      if (o) o.maker = who;
    });
  }
  function setDeliverer(orderId: string, who: Assignee) {
    commit((d) => {
      const o = d.orders.find((x) => x.id === orderId);
      if (o) o.deliverer = who;
    });
  }
  // Acknowledge: mark the order seen and move it out of "Order received" into the
  // pipeline. Advancing to "Materials purchased" runs the SAME stock-consumption
  // invariant as setStatus so status and stock never disagree.
  function acknowledgeOrder(orderId: string) {
    commit((d) => {
      const o = d.orders.find((x) => x.id === orderId);
      if (!o) return;
      o.acknowledged = true;
      if (o.status === "Order received") {
        const next: OrderStatus = "Materials purchased";
        if (!o.stockTaken) {
          consumeStock(d, o.product, o.size);
          o.stockTaken = true;
        }
        o.status = next;
      }
    });
  }

  // GDPR erasure — dedicated endpoint (anonymises orders, purges the contact row).
  async function deleteContact(id: string) {
    setSaveState("saving");
    try {
      const res = await fetch(`/api/admin/contacts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Delete failed");
      const j = await res.json();
      if (j.store) setStore(j.store);
      setSaveState("saved");
    } catch (e) {
      setSaveState("error");
      setSaveError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  // Cancel & archive: reversible, keeps the record but drops it from the active
  // pipeline, finance, calendar and availability.
  function archiveOrder(id: string) {
    commit((d) => {
      const o = d.orders.find((x) => x.id === id);
      if (o) { o.archived = true; o.archivedAt = new Date().toISOString(); }
    });
    setSelectedOrderId(null);
  }
  function restoreOrder(id: string) {
    commit((d) => {
      const o = d.orders.find((x) => x.id === id);
      if (o) { o.archived = false; delete o.archivedAt; }
    });
  }
  // Permanent delete via the dedicated endpoint (write() never removes orders, so
  // a plain save wouldn't actually delete the row).
  async function deleteOrder(id: string) {
    setSaveState("saving");
    try {
      const res = await fetch(`/api/admin/orders/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Delete failed");
      const j = await res.json();
      if (j.store) setStore(j.store);
      setSaveState("saved");
    } catch (e) {
      setSaveState("error");
      setSaveError(e instanceof Error ? e.message : "Delete failed");
    }
    setSelectedOrderId(null);
  }

  const pendingCount = unacknowledgedOrders(store).length;
  const newEnquiryCount = (store.enquiries || []).filter((e) => e.status === "New").length;
  function setEnquiryStatus(id: string, status: EnquiryStatus) {
    commit((d) => {
      const e = (d.enquiries || []).find((x) => x.id === id);
      if (e) e.status = status;
    });
  }
  const jobRows = store.orders
    .slice()
    .filter((o) => jobFilter === "all" || personOnOrder(o, jobFilter))
    .sort((a, b) => a.date.localeCompare(b.date));
  // Active = live pipeline (not delivered, not cancelled) and the default view.
  // Delivered = complete but still counted in Finance/CRM. Cancelled = archived.
  const activeRows = jobRows.filter((o) => !o.archived && o.status !== "Delivered");
  const deliveredRows = jobRows.filter((o) => !o.archived && o.status === "Delivered");
  const archivedRows = jobRows.filter((o) => o.archived);

  return (
    <div>
      {/* Header */}
      <header style={{ background: "#4A2C4D", color: "#FBF7F2" }}>
        <div className="max-w-admin mx-auto flex items-center justify-between gap-4 flex-wrap" style={{ padding: "16px 20px" }}>
          <div className="flex items-baseline gap-3">
            <span className="font-display text-2xl font-bold">
              J<span className="text-gold">&amp;</span>N
            </span>
            <span className="text-xs font-extrabold text-gold" style={{ letterSpacing: "2px" }}>ADMIN</span>
          </div>
          <div className="flex gap-3.5 items-center flex-wrap">
            <span
              role="status"
              aria-live="polite"
              title={saveState === "error" ? saveError : undefined}
              className="text-xs font-extrabold rounded-full"
              style={{
                padding: "6px 12px",
                minHeight: 30,
                display: "inline-flex",
                alignItems: "center",
                background:
                  saveState === "saved" ? "#E4F0E4" : saveState === "error" ? "#FFE3DF" : "rgba(251,247,242,0.15)",
                color:
                  saveState === "saved" ? "#3c7a3c" : saveState === "error" ? "#c14a3e" : "#FBF7F2",
              }}
            >
              {saveState === "saving"
                ? "Saving…"
                : saveState === "saved"
                ? "Saved ✓"
                : saveState === "error"
                ? "Save failed — retry"
                : "All changes saved"}
            </span>
            <a href="/" className="text-[13.5px] font-bold no-underline" style={{ color: "#F3C6C6" }}>View site →</a>
            <button onClick={logout} className="cursor-pointer bg-transparent font-sans text-xs font-bold rounded-full" style={{ border: "1px solid rgba(251,247,242,0.35)", color: "#FBF7F2", padding: "8px 14px" }}>
              Log out
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-white sticky top-0 z-10" style={{ borderBottom: "1px solid #F3C6C6" }}>
        <div className="max-w-admin mx-auto flex gap-1 overflow-x-auto" style={{ padding: "0 12px" }}>
          {tabDefs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="cursor-pointer bg-none border-0 font-sans font-extrabold text-sm whitespace-nowrap"
              style={{
                borderBottom: `3px solid ${t.id === tab ? "#FF6F61" : "transparent"}`,
                color: t.id === tab ? "#4A2C4D" : "#9a839c",
                padding: "14px 16px",
                minHeight: 48,
                background: "none",
              }}
            >
              {t.label}
              {(t.id === "orders" || t.id === "overview") && pendingCount > 0 && (
                <span
                  aria-label={`${pendingCount} orders awaiting triage`}
                  className="ml-1.5 text-[11px] font-extrabold rounded-full"
                  style={{ background: "#FF6F61", color: "#fff", padding: "1px 7px" }}
                >
                  {pendingCount}
                </span>
              )}
              {t.id === "enquiries" && newEnquiryCount > 0 && (
                <span
                  aria-label={`${newEnquiryCount} new enquiries`}
                  className="ml-1.5 text-[11px] font-extrabold rounded-full"
                  style={{ background: "#FF6F61", color: "#fff", padding: "1px 7px" }}
                >
                  {newEnquiryCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-admin mx-auto" style={{ padding: "28px 20px 64px" }}>
        {/* Go-live setup status — only shows while something still needs doing */}
        {(!dbConnected || !blobConnected || !bookingsLive) && (
          <div className="rounded-2xl mb-6" style={{ background: "#FFF8ED", border: "2px solid #E6C88A", padding: "16px 20px" }}>
            <p className="m-0 mb-2 font-extrabold text-[13px] text-gold-ink" style={{ letterSpacing: "1px" }}>
              GETTING READY TO GO LIVE
            </p>
            <ul className="m-0 text-[13.5px]" style={{ paddingLeft: 18, lineHeight: 1.7 }}>
              {!dbConnected && (
                <li>
                  <strong>Database not connected.</strong> Until a database is added in Vercel (Storage → Create
                  Database → Postgres), changes can’t be saved on the live site — you’ll see a save error rather than
                  losing edits silently. This is the one must-do before launch.
                </li>
              )}
              {!blobConnected && (
                <li>
                  <strong>Image hosting not connected (optional).</strong> Photos still work — they&apos;re saved inside
                  the site data. Adding Vercel Blob makes them load faster and keeps the data light.
                </li>
              )}
              {dbConnected && !bookingsLive && (
                <li>
                  <strong>Card payments are off.</strong> The site takes bookings as enquiries (no charge). Add your
                  Stripe keys and turn on card payments in <strong>Settings → Payments</strong> when you&apos;re ready.
                </li>
              )}
            </ul>
          </div>
        )}

        {/* OVERVIEW */}
        {tab === "overview" && (
          <>
            <h1 className="font-display m-0 mb-1" style={{ fontSize: 30 }}>{greeting}</h1>
            <p className="m-0 mb-6 text-plum-soft text-[15px]">Here&apos;s how the business looks today.</p>
            <TriageBanner
              store={store}
              onSetMaker={setMaker}
              onSetDeliverer={setDeliverer}
              onAcknowledge={acknowledgeOrder}
              onOpenOrder={setSelectedOrderId}
            />
            {newEnquiryCount > 0 && (
              <button
                onClick={() => setTab("enquiries")}
                className="w-full text-left cursor-pointer rounded-2xl mb-7"
                style={{ background: "#FFF3F1", border: "2px solid #FF6F61", padding: "16px 20px" }}
              >
                <p className="m-0 font-extrabold text-[13px] text-coral flex items-center gap-2" style={{ letterSpacing: "1px" }}>
                  ✉ {newEnquiryCount} NEW {newEnquiryCount === 1 ? "ENQUIRY" : "ENQUIRIES"}
                  <span className="text-[11px] font-bold" style={{ color: "#c14a3e" }}>— tap to reply →</span>
                </p>
                <p className="m-0 mt-1 text-[13px] text-plum-soft">
                  {(store.enquiries || []).filter((e) => e.status === "New").slice(0, 3).map((e) => e.name + (e.productName ? ` (${e.productName})` : "")).join(" · ")}
                </p>
              </button>
            )}
            <div className="grid gap-3.5 mb-7" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              {stats.map((s) => (
                <button
                  key={s.label}
                  onClick={() => s.goTab && setTab(s.goTab)}
                  disabled={!s.goTab}
                  className={`${card} text-left font-sans`}
                  style={{ padding: 20, border: "none", cursor: s.goTab ? "pointer" : "default" }}
                >
                  <p className="m-0 mb-1.5 text-xs font-extrabold text-gold flex items-center gap-1" style={{ letterSpacing: "1.5px" }}>
                    {s.label} {s.goTab && <span style={{ color: "#D4AF7A" }}>→</span>}
                  </p>
                  <p className="m-0 font-display font-bold" style={{ fontSize: 32, color: s.color }}>{s.value}</p>
                  <p className="mt-1 mb-0 text-[12.5px] text-plum-soft">{s.sub}</p>
                </button>
              ))}
            </div>
            {alerts.length > 0 && (
              <div className="rounded-2xl mb-7" style={{ background: "#FFF3F1", border: "2px solid #FF6F61", padding: "16px 20px" }}>
                <p className="m-0 mb-1.5 font-extrabold text-[13px] text-coral" style={{ letterSpacing: "1px" }}>LOW STOCK</p>
                {alerts.map((a, i) => (
                  <p key={i} className="my-0.5 text-sm font-semibold">{a}</p>
                ))}
              </div>
            )}
            {(() => {
              const today = new Date().toISOString().slice(0, 10);
              const todays = eventsInRange(store, today, today);
              if (!todays.length) return null;
              return (
                <div className="rounded-2xl mb-7" style={{ background: "#fff", border: "2px solid #F3C6C6", padding: "16px 20px" }}>
                  <p className="m-0 mb-2 font-extrabold text-[13px]" style={{ letterSpacing: "1px", color: "#4A2C4D" }}>TODAY&apos;S AGENDA</p>
                  {todays.map((e) => (
                    <div key={e.id} className="flex items-center gap-2.5 flex-wrap" style={{ padding: "3px 0" }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: EVENT_STYLE[e.type].bg, flexShrink: 0 }} />
                      <span className="text-[14px] font-semibold">{e.title}</span>
                      <span className="text-[12.5px] text-plum-soft">{e.subtitle}</span>
                      <span style={{ flex: 1 }} />
                      <button onClick={() => setTab("calendar")} className="cursor-pointer bg-cream border-0 rounded-full text-[12px] font-bold" style={{ padding: "5px 10px" }}>Calendar</button>
                    </div>
                  ))}
                </div>
              );
            })()}
            {(() => {
              const today = new Date().toISOString().slice(0, 10);
              const fu = followUpsDue(store, today);
              const anv = anniversaries(store, today);
              return (
                <div className="grid gap-3.5 mb-7" style={{ gridTemplateColumns: fu.length && anv.length ? "repeat(auto-fit, minmax(280px, 1fr))" : "1fr" }}>
                  {fu.length > 0 && (
                    <div className="rounded-2xl" style={{ background: "#fff", border: "2px solid #E6C88A", padding: "16px 20px" }}>
                      <p className="m-0 mb-2 font-extrabold text-[13px] text-gold-ink" style={{ letterSpacing: "1px" }}>FOLLOW-UPS DUE</p>
                      {fu.map((f) => (
                        <div key={f.contact.id} className="flex justify-between items-center gap-2 flex-wrap" style={{ padding: "4px 0" }}>
                          <span className="text-[14px] font-semibold">{f.contact.name} <span className="text-plum-soft font-normal">· {f.contact.status}</span></span>
                          <span className="flex items-center gap-2">
                            <span className="text-[12.5px] font-bold" style={{ color: f.overdue ? "#c14a3e" : "#8a6a1a" }}>{f.overdue ? "overdue · " : ""}{crmPretty(f.due)}</span>
                            <button onClick={() => setTab("contacts")} className="cursor-pointer bg-cream border-0 rounded-full text-[12px] font-bold" style={{ padding: "5px 10px" }}>View</button>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {anv.length > 0 && (
                    <div className="rounded-2xl" style={{ background: "#fff", border: "2px solid #F3C6C6", padding: "16px 20px" }}>
                      <p className="m-0 mb-2 font-extrabold text-[13px]" style={{ letterSpacing: "1px", color: "#a35a7a" }}>🎉 ANNIVERSARIES COMING UP</p>
                      {anv.map((a, i) => (
                        <div key={i} className="flex justify-between items-center gap-2 flex-wrap" style={{ padding: "4px 0" }}>
                          <span className="text-[14px] font-semibold">{a.name} <span className="text-plum-soft font-normal">· {a.occasion}</span></span>
                          <span className="text-[12.5px] text-plum-soft">{a.yearsAgo} yr ago · again {crmPretty(a.nextDate)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
            <h2 className="font-display m-0 mb-3.5" style={{ fontSize: 22 }}>Upcoming deliveries</h2>
            <div className="flex flex-col gap-2.5">
              {upcoming.map((o) => {
                const ss = STATUS_STYLES[o.status] || STATUS_STYLES["Order received"];
                return (
                  <div
                    key={o.id}
                    onClick={() => setSelectedOrderId(o.id)}
                    className={`${card} jn-click flex flex-wrap gap-3 items-center justify-between`}
                    style={{ padding: "16px 18px", cursor: "pointer" }}
                  >
                    <div style={{ minWidth: 90 }}>
                      <p className="m-0 font-extrabold text-[15px]">{prettyDate(o.date)}</p>
                      <p className="mt-0.5 mb-0 text-xs text-plum-soft">{o.id}</p>
                    </div>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <p className="m-0 font-bold text-[14.5px]">{productById(o.product)?.name ?? o.product} · {o.customer}</p>
                      <p className="mt-0.5 mb-0 text-[12.5px] text-plum-soft">{o.postcode} · {o.theme}</p>
                    </div>
                    <span className="text-xs font-extrabold rounded-full" style={{ padding: "6px 12px", background: ss.bg, color: ss.color }}>{o.status}</span>
                    <span className="font-extrabold text-[15px] text-coral">{orderTotal(o)}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ORDERS */}
        {tab === "orders" && (
          <>
            <h1 className="font-display m-0 mb-1" style={{ fontSize: 30 }}>Orders</h1>
            <p className="m-0 mb-4 text-plum-soft text-[15px]">Order received → Materials purchased → In progress → Ready → Delivered</p>
            <div className="flex gap-2 items-center flex-wrap mb-3">
              <span className="text-[12px] font-extrabold text-plum-soft" style={{ letterSpacing: "0.5px" }}>MY JOBS:</span>
              {(["all", "Jade", "Nicole"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setJobFilter(f)}
                  aria-pressed={jobFilter === f}
                  className="cursor-pointer rounded-full border-2 font-sans font-bold text-[13px]"
                  style={{
                    padding: "7px 16px",
                    minHeight: 38,
                    borderColor: jobFilter === f ? "#FF6F61" : "#F3C6C6",
                    background: jobFilter === f ? "#FFF3F1" : "#fff",
                    color: "#4A2C4D",
                  }}
                >
                  {f === "all" ? "Everyone" : f}
                </button>
              ))}
            </div>
            <div className="flex gap-2 items-center flex-wrap mb-5">
              <span className="text-[12px] font-extrabold text-plum-soft" style={{ letterSpacing: "0.5px" }}>SHOW:</span>
              {([["active", `Active (${activeRows.length})`], ["delivered", `Delivered (${deliveredRows.length})`], ["cancelled", `Cancelled (${archivedRows.length})`]] as const).map(([v, lbl]) => (
                <button
                  key={v}
                  onClick={() => setOrderView(v)}
                  aria-pressed={orderView === v}
                  className="cursor-pointer rounded-full border-2 font-sans font-bold text-[13px]"
                  style={{
                    padding: "7px 16px", minHeight: 38,
                    borderColor: orderView === v ? "#FF6F61" : "#F3C6C6",
                    background: orderView === v ? "#FFF3F1" : "#fff",
                    color: "#4A2C4D",
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>
            {orderView === "active" && (
            <div className="flex flex-col gap-3">
              {activeRows.map((o) => {
                const profit = orderProfit(o);
                return (
                  <div
                    key={o.id}
                    onClick={() => setSelectedOrderId(o.id)}
                    className={`${card} jn-click grid gap-3.5 items-center`}
                    // 180px basis so a phone drops to a clean single-column stack
                    // instead of two cramped columns; desktop still packs 5 across.
                    style={{ padding: "18px 20px", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", cursor: "pointer" }}
                  >
                    <div>
                      <p className="m-0 font-extrabold text-[15px] flex items-center gap-1.5">
                        {o.customer}
                        {o.acknowledged === false && (
                          <span className="text-[10px] font-extrabold rounded-full" style={{ background: "#FF6F61", color: "#fff", padding: "1px 7px", letterSpacing: "0.5px" }}>NEW</span>
                        )}
                        {o.notes && (
                          <span title={o.notes} className="text-[10px] font-extrabold rounded-full" style={{ background: "#FFF8ED", color: "#8a6a1a", border: "1px solid #E6C88A", padding: "1px 7px" }}>📝 NOTE</span>
                        )}
                      </p>
                      <p className="mt-0.5 mb-0 text-[12.5px] text-plum-soft">{o.id} · {o.phone}</p>
                    </div>
                    <div>
                      <p className="m-0 font-bold text-sm">{productById(o.product)?.name ?? o.product} ({sizeById(o.size).name})</p>
                      <p className="mt-0.5 mb-0 text-[12.5px] text-plum-soft">{o.theme}</p>
                    </div>
                    <div>
                      <p className="m-0 font-bold text-sm">{prettyDate(o.date)} · <span className="text-plum-soft font-normal">{o.postcode}</span></p>
                      <p className="mt-0.5 mb-0 text-[12.5px] text-plum-soft">
                        {makerOf(o) ? <>🔨 {makerOf(o)}</> : <span style={{ color: "#c14a3e" }}>needs maker</span>}
                        {" · "}
                        {delivererOf(o) ? <>🚗 {delivererOf(o)}</> : <span style={{ color: "#c14a3e" }}>needs driver</span>}
                      </p>
                    </div>
                    <div>
                      <p className="m-0 font-extrabold text-[15px] text-coral">{orderTotal(o)}</p>
                      <p className="mt-0.5 mb-0 text-[12.5px] font-bold" style={{ color: profit > 0 ? "#3c7a3c" : "#c14a3e" }}>profit {gbp(Math.round(profit))}</p>
                    </div>
                    {/* Status + Cancel. flex-wrap + basis so they never crush each
                        other in a narrow grid track — Cancel drops below the status
                        picker on mobile rather than getting squashed against it. */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={o.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setStatus(o.id, e.target.value as OrderStatus)}
                        className="border-2 border-blush rounded-xl font-bold bg-cream font-sans"
                        style={{ padding: "10px 12px", fontSize: "13.5px", minHeight: 44, flex: "1 1 130px", minWidth: 120 }}
                      >
                        {STATUSES.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmAction({ kind: "archive", orderId: o.id }); }}
                        title="Cancel & archive this order"
                        className="cursor-pointer border-0 rounded-xl font-sans font-bold text-[12.5px]"
                        style={{ background: "#F2E7D8", color: "#8a6a1a", padding: "10px 14px", minHeight: 44, whiteSpace: "nowrap", flex: "0 0 auto" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              })}
              {activeRows.length === 0 && (
                <p className="m-0 text-plum-soft text-[14px]">No active orders{jobFilter !== "all" ? ` for ${jobFilter}` : ""}.</p>
              )}
            </div>
            )}

            {/* Delivered orders — complete, but still fully counted in Finance and
                the customer's CRM history. Kept here for looking things up. */}
            {orderView === "delivered" && (
              <div className="flex flex-col gap-2.5">
                <p className="m-0 mb-1 text-[13px] text-plum-soft">Delivered orders are complete. They stay counted in Finance and each customer&apos;s contact history &amp; total spent, and feed next year&apos;s anniversary nudges. Tap one to view or reopen it.</p>
                {deliveredRows.map((o) => (
                  <div key={o.id} onClick={() => setSelectedOrderId(o.id)} className={`${card} jn-click flex flex-wrap gap-3 items-center`} style={{ padding: "14px 18px", cursor: "pointer" }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <p className="m-0 font-bold text-[14.5px] flex items-center gap-1.5">
                        {o.customer}
                        <span className="text-[10px] font-extrabold rounded-full" style={{ background: "#C6F3D0", color: "#2f6b3a", padding: "1px 8px", letterSpacing: "0.5px" }}>✓ DELIVERED</span>
                      </p>
                      <p className="mt-0.5 mb-0 text-[12.5px] text-plum-soft">{o.id} · {productById(o.product)?.name ?? o.product} · {prettyDate(o.date)} · {orderTotal(o)}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setReviewPrompt(o.id); }}
                      title="Ask this customer for a review"
                      className="cursor-pointer border-0 rounded-full font-sans font-bold text-[12.5px]"
                      style={{ background: "#F3E4C6", color: "#8a6a1a", padding: "9px 14px", minHeight: 40 }}
                    >
                      ★ Ask for a review
                    </button>
                  </div>
                ))}
                {deliveredRows.length === 0 && (
                  <p className="m-0 text-plum-soft text-[14px]">No delivered orders yet{jobFilter !== "all" ? ` for ${jobFilter}` : ""}.</p>
                )}
              </div>
            )}

            {/* Cancelled / archived orders — kept on record, restorable, deletable */}
            {orderView === "cancelled" && (
              <div className="flex flex-col gap-2.5">
                <p className="m-0 mb-1 text-[13px] text-plum-soft">Cancelled orders are kept for your records (refunds, finance history) but are out of the active pipeline, calendar and finance. Restore one, or delete permanently.</p>
                {archivedRows.map((o) => (
                  <div key={o.id} className={`${card} flex flex-wrap gap-3 items-center`} style={{ padding: "14px 18px" }}>
                    <div style={{ flex: 1, minWidth: 180, cursor: "pointer" }} onClick={() => setSelectedOrderId(o.id)}>
                      <p className="m-0 font-bold text-[14.5px] flex items-center gap-1.5">
                        {o.customer}
                        <span className="text-[10px] font-extrabold rounded-full" style={{ background: "#EDEAEE", color: "#7a5f7d", padding: "1px 8px", letterSpacing: "0.5px" }}>CANCELLED</span>
                      </p>
                      <p className="mt-0.5 mb-0 text-[12.5px] text-plum-soft">{o.id} · {productById(o.product)?.name ?? o.product} · {prettyDate(o.date)} · {orderTotal(o)}</p>
                    </div>
                    <button
                      onClick={() => restoreOrder(o.id)}
                      className="cursor-pointer border-0 rounded-xl font-sans font-bold text-[12.5px]"
                      style={{ background: "#E4F0E4", color: "#3c7a3c", padding: "9px 14px", minHeight: 40 }}
                    >
                      Restore
                    </button>
                    <button
                      onClick={() => setConfirmAction({ kind: "delete", orderId: o.id })}
                      title="Delete permanently"
                      className="cursor-pointer border-0 rounded-xl font-sans font-bold text-[12.5px]"
                      style={{ background: "#FFE3DF", color: "#c14a3e", padding: "9px 14px", minHeight: 40 }}
                    >
                      Delete permanently
                    </button>
                  </div>
                ))}
                {archivedRows.length === 0 && (
                  <p className="m-0 text-plum-soft text-[14px]">No cancelled orders.</p>
                )}
              </div>
            )}
          </>
        )}

        {/* CONTACTS (CRM) */}
        {tab === "calendar" && (
          <CalendarTab store={store} commit={commit} onOpenOrder={setSelectedOrderId} onOpenContact={() => setTab("contacts")} />
        )}

        {tab === "contacts" && (
          <ContactsTab store={store} commit={commit} onDelete={deleteContact} onOpenOrder={setSelectedOrderId} />
        )}

        {tab === "enquiries" && (
          <EnquiriesTab store={store} onStatus={setEnquiryStatus} />
        )}

        {/* FINANCE */}
        {tab === "finance" && (
          <FinanceTab
            store={store}
            setSetting={setSetting}
            onSelectOrder={setSelectedOrderId}
            onNavigate={(t) => setTab(t)}
          />
        )}

        {/* PRICING */}
        {tab === "pricing" && (
          <PricingTab store={store} commit={commit} setSetting={setSetting} />
        )}

        {/* ZONES */}
        {tab === "zones" && (
          <>
            <h1 className="font-display m-0 mb-1" style={{ fontSize: 30 }}>Delivery zones</h1>
            <p className="m-0 mb-6 text-plum-soft text-[15px]">Measured from your base between Huntingdon and Stilton. Postcodes outside all zones route to a custom enquiry.</p>
            <div className="flex flex-col gap-3 mb-5">
              {store.zones.map((z, i) => (
                <div key={z.id} className={`${card} flex flex-wrap gap-3 items-start`} style={{ padding: "16px 20px" }}>
                  <div style={{ minWidth: 150, flex: "1 1 150px" }}>
                    <input value={z.name} onChange={(e) => commit((d) => { d.zones[i].name = e.target.value; })} placeholder="Zone name" className="rounded-lg bg-cream border-2 border-blush font-sans font-extrabold text-plum w-full" style={{ padding: "8px 10px", fontSize: 14.5 }} />
                    <input value={z.range} onChange={(e) => commit((d) => { d.zones[i].range = e.target.value; })} placeholder="e.g. 0–10 miles" className="mt-1.5 rounded-lg bg-cream border-2 border-blush font-sans text-plum w-full" style={{ padding: "7px 10px", fontSize: 12.5 }} />
                  </div>
                  <div style={{ flex: "2 1 240px" }}>
                    <input value={z.areas} onChange={(e) => commit((d) => { d.zones[i].areas = e.target.value; })} placeholder="Towns covered, e.g. Huntingdon, St Ives" className="rounded-lg bg-cream border-2 border-blush font-sans text-plum w-full" style={{ padding: "8px 10px", fontSize: 13 }} />
                    <input value={(z.districts || []).join(", ")} onChange={(e) => commit((d) => { d.zones[i].districts = e.target.value.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean); })} placeholder="Postcode districts, e.g. PE29, PE28" className="mt-1.5 rounded-lg bg-cream border-2 border-blush font-sans text-plum w-full" style={{ padding: "7px 10px", fontSize: 11.5, fontFamily: "monospace" }} title="Comma-separated postcode districts that map to this zone" />
                  </div>
                  <label className="flex flex-col gap-1 text-[11px] font-extrabold text-gold-ink" style={{ letterSpacing: "0.5px" }}>
                    FEE £
                    <input type="number" step="1" value={z.fee ?? 0} onChange={(e) => commit((d) => { d.zones[i].fee = parseFloat(e.target.value) || 0; })} className={numInput} style={{ padding: "9px 11px", fontSize: 15, width: 74 }} />
                  </label>
                  <button
                    onClick={() => { if (store.zones.length > 1 && confirm(`Delete “${z.name}”? Postcodes in it will route to a custom enquiry.`)) commit((d) => { d.zones.splice(i, 1); }); }}
                    disabled={store.zones.length <= 1}
                    className="cursor-pointer border-0 rounded-lg font-extrabold disabled:opacity-30"
                    style={{ background: "#FFE3DF", color: "#c14a3e", padding: "8px 12px", minHeight: 40, alignSelf: "center" }}
                    title="Delete zone"
                  >✕</button>
                </div>
              ))}
              <button
                onClick={() => commit((d) => { d.zones.push({ id: uid("z"), name: "New zone", range: "", fee: 0, areas: "", districts: [] }); })}
                className="cursor-pointer bg-plum text-white border-0 font-sans font-extrabold text-[13px] rounded-full self-start"
                style={{ padding: "10px 18px", minHeight: 42 }}
              >+ Add zone</button>
            </div>
            <div className="rounded-2xl text-[13.5px] font-semibold text-plum-soft" style={{ background: "#FBF7F2", border: "2px dashed #D4AF7A", padding: "16px 20px" }}>
              Beyond 30 miles → &quot;quote on request&quot; (routed to you as an enquiry). Per-mile pricing (~£1/mile each way) coming in a later phase.
            </div>
          </>
        )}

        {/* CONTENT */}
        {tab === "content" && (
          <>
            <h1 className="font-display m-0 mb-1" style={{ fontSize: 30 }}>Site content</h1>
            <p className="m-0 mb-6 text-plum-soft text-[15px]">Words, images, gallery, reviews and colour themes — changes appear on the website on the next refresh.</p>

            <SiteCopyEditor store={store} commit={commit} />

            <h2 className="font-display m-0 mb-1.5" style={{ fontSize: 22 }}>Images</h2>
            <p className="m-0 mb-3.5 text-plum-soft text-[13px]">Every image on the site is managed here. Uploads are saved to shared storage and shown on the website on the next refresh. Photos are resized automatically.</p>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))" }}>
              <ImageSlot label="Homepage hero" hint="Main banner beside the headline" src={store.images.hero} onUpload={(f) => uploadSiteImage("hero", f)} onReset={() => resetSiteImage("hero")} />
              <ImageSlot label="About — Jade" hint="Portrait in the About section" src={store.images.aboutJade} onUpload={(f) => uploadSiteImage("aboutJade", f)} onReset={() => resetSiteImage("aboutJade")} />
              <ImageSlot label="About — Nicole" hint="Portrait in the About section" src={store.images.aboutNicole} onUpload={(f) => uploadSiteImage("aboutNicole", f)} onReset={() => resetSiteImage("aboutNicole")} />
              <ImageSlot label="Logo" hint="Header logo — blank uses the J&N wordmark" src={store.images.logo} accept="image/png,image/svg+xml,image/jpeg,image/webp" emptyLabel="Text wordmark (default)" onUpload={(f) => uploadSiteImage("logo", f)} onReset={() => resetSiteImage("logo")} />
              <ImageSlot label="Favicon" hint="Browser-tab icon" src={store.images.favicon} accept="image/png,image/x-icon,image/svg+xml" emptyLabel="Generated monogram (default)" onUpload={(f) => uploadSiteImage("favicon", f)} onReset={() => resetSiteImage("favicon")} />
              <ImageSlot label="Social share image" hint="Preview when the link is posted to Instagram/Facebook" src={store.images.ogImage} emptyLabel="Auto-designed card (default)" onUpload={(f) => uploadSiteImage("ogImage", f)} onReset={() => resetSiteImage("ogImage")} />
            </div>

            <h3 className="font-display m-0 mt-5 mb-1.5" style={{ fontSize: 17 }}>Product photos</h3>
            <p className="m-0 mb-3.5 text-plum-soft text-[13px]">Optional photo shown on each product card in the quote builder.</p>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", marginBottom: 32 }}>
              {store.products.map((p, i) => (
                <ImageSlot
                  key={p.id}
                  label={p.name}
                  hint="Quote-builder product card"
                  src={p.image || ""}
                  emptyLabel="No photo (name + price only)"
                  onUpload={(f) => uploadProductImage(i, f)}
                  onReset={p.image ? () => resetProductImage(i) : undefined}
                />
              ))}
            </div>

            <h2 className="font-display m-0 mb-3.5" style={{ fontSize: 22 }}>Gallery</h2>
            <div className="flex flex-col gap-2.5 mb-3.5">
              {store.gallery.map((g, i) => {
                const uploaded = g.src.startsWith("data:");
                return (
                <div key={g.id} className={card} style={{ padding: "12px 16px" }}>
                  <div className="flex flex-wrap gap-3 items-center">
                    <div style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: "#F8EDE9", backgroundImage: `url('${assetUrl(g.src)}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
                    <input value={g.title} onChange={(e) => commit((d) => { d.gallery[i].title = e.target.value; })} className="rounded-lg font-bold bg-cream text-plum font-sans border-2 border-blush" style={{ flex: 1, minWidth: 160, padding: "9px 12px", fontSize: 14 }} />
                    <select
                      value={uploaded ? "__uploaded__" : g.src}
                      onChange={(e) => { if (e.target.value !== "__uploaded__") commit((d) => { d.gallery[i].src = e.target.value; }); }}
                      className="rounded-lg bg-cream border-2 border-blush font-sans"
                      style={{ padding: "9px 10px", fontSize: "12.5px", maxWidth: 210, minHeight: 42 }}
                    >
                      {uploaded && <option value="__uploaded__">Uploaded photo</option>}
                      {(store.galleryImages || []).map((src) => (
                        <option key={src} value={src}>{src.replace("images/", "").replace(".png", "").replace("gallery-", "")}</option>
                      ))}
                    </select>
                    <label className="cursor-pointer bg-cream text-plum font-sans font-extrabold text-[12.5px] rounded-lg" style={{ border: "2px solid #F3C6C6", padding: "9px 12px", minHeight: 40, display: "inline-flex", alignItems: "center" }}>
                      Change photo
                      <input type="file" accept="image/*" onChange={(e) => { changeGalleryPhoto(i, e.target.files?.[0]); e.target.value = ""; }} style={{ display: "none" }} />
                    </label>
                    <div className="flex gap-1.5">
                      <button title="Move earlier" aria-label="Move earlier" onClick={() => commit((d) => { if (i > 0) [d.gallery[i - 1], d.gallery[i]] = [d.gallery[i], d.gallery[i - 1]]; })} className="cursor-pointer border-0 bg-cream rounded-lg font-extrabold" style={{ padding: "9px 12px", minHeight: 40 }}>↑</button>
                      <button title="Move later" aria-label="Move later" onClick={() => commit((d) => { if (i < d.gallery.length - 1) [d.gallery[i + 1], d.gallery[i]] = [d.gallery[i], d.gallery[i + 1]]; })} className="cursor-pointer border-0 bg-cream rounded-lg font-extrabold" style={{ padding: "9px 12px", minHeight: 40 }}>↓</button>
                      <button title="Delete this gallery piece" aria-label="Delete this gallery piece" onClick={() => { if (confirm("Remove this piece from the gallery?")) commit((d) => { d.gallery.splice(i, 1); }); }} className="cursor-pointer border-0 rounded-lg font-extrabold" style={{ background: "#FFE3DF", color: "#c14a3e", padding: "9px 12px", minHeight: 40 }}>✕</button>
                    </div>
                  </div>

                  {/* Popup content: extra photos, description, order link */}
                  <div className="flex flex-wrap gap-3 items-center" style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #F3C6C6" }}>
                    <div className="flex gap-2 items-center flex-wrap">
                      {(g.images || []).map((src, j) => (
                        <div key={`${src}-${j}`} className="relative" style={{ width: 44, height: 44 }}>
                          <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: "#F8EDE9", backgroundImage: `url('${assetUrl(src)}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
                          <button onClick={() => makeGalleryCover(i, j)} title="Make this the card photo" aria-label="Make this the card photo" className="cursor-pointer absolute border-0 rounded-full bg-white font-extrabold" style={{ top: -7, left: -7, width: 20, height: 20, fontSize: 10, lineHeight: "20px", padding: 0, boxShadow: "0 1px 4px rgba(74,44,77,0.3)" }}>★</button>
                          <button onClick={() => removeGalleryExtraPhoto(i, j)} title="Remove this photo" aria-label="Remove this photo" className="cursor-pointer absolute border-0 rounded-full font-extrabold" style={{ top: -7, right: -7, width: 20, height: 20, fontSize: 10, lineHeight: "20px", padding: 0, background: "#FFE3DF", color: "#c14a3e", boxShadow: "0 1px 4px rgba(74,44,77,0.3)" }}>✕</button>
                        </div>
                      ))}
                      <label className="cursor-pointer bg-cream text-plum font-sans font-extrabold text-[11.5px] rounded-lg" style={{ border: "2px dashed #F3C6C6", padding: "8px 10px", minHeight: 40, display: "inline-flex", alignItems: "center" }}>
                        + Photo
                        <input type="file" accept="image/*" onChange={(e) => { addGalleryExtraPhoto(i, e.target.files?.[0]); e.target.value = ""; }} style={{ display: "none" }} />
                      </label>
                    </div>
                    <input
                      value={g.desc || ""}
                      onChange={(e) => commit((d) => { d.gallery[i].desc = e.target.value; })}
                      placeholder="Popup description (optional) — e.g. size, colours, occasion"
                      className="rounded-lg bg-cream border-2 border-blush font-sans"
                      style={{ flex: "2 1 220px", padding: "9px 12px", fontSize: "12.5px" }}
                    />
                    <select
                      value={g.productId || ""}
                      onChange={(e) => commit((d) => { d.gallery[i].productId = e.target.value || undefined; })}
                      title="Customers can order this piece straight from the popup"
                      className="rounded-lg bg-cream border-2 border-blush font-sans font-bold"
                      style={{ padding: "9px 10px", fontSize: "12.5px", maxWidth: 220, minHeight: 42 }}
                    >
                      <option value="">No order button</option>
                      {store.products.map((p) => (
                        <option key={p.id} value={p.id}>Order as: {p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                );
              })}
            </div>
            <div className="flex gap-2.5 flex-wrap" style={{ marginBottom: 10 }}>
              <label className="cursor-pointer bg-plum text-white font-sans font-extrabold text-[13.5px] rounded-full" style={{ padding: "11px 20px", minHeight: 44, display: "inline-flex", alignItems: "center" }}>
                + Upload new photo
                <input type="file" accept="image/*" onChange={(e) => { addGalleryPhoto(e.target.files?.[0]); e.target.value = ""; }} style={{ display: "none" }} />
              </label>
              <button onClick={() => commit((d) => { d.gallery.push({ id: uid("g"), title: "New piece", src: (d.galleryImages || [])[0] || "" }); })} className="cursor-pointer bg-white text-plum font-sans font-extrabold text-[13.5px] rounded-full" style={{ border: "2px solid #F3C6C6", padding: "11px 20px", minHeight: 44 }}>+ Add from existing artwork</button>
            </div>
            <p className="text-[12.5px] text-plum-soft" style={{ margin: "0 0 32px" }}>Upload a photo straight from your phone or computer to add or replace a gallery image — it appears on the website immediately. Photos are resized automatically to keep the site fast. On the website each creation opens a popup: add extra photos with <strong>+ Photo</strong>, write a short description, and pick <strong>Order as</strong> so customers can order that piece in one tap (★ makes an extra photo the card image).</p>

            <h2 className="font-display m-0 mb-3.5" style={{ fontSize: 22 }}>Customer reviews</h2>
            <div className="flex flex-col gap-2.5 mb-3.5">
              {store.reviews.map((r, i) => (
                <div key={r.id} className={`${card} flex flex-wrap gap-2.5 items-center`} style={{ padding: "14px 16px" }}>
                  <input value={r.text} onChange={(e) => commit((d) => { d.reviews[i].text = e.target.value; })} placeholder="Review text" className="rounded-lg bg-cream border-2 border-blush font-sans" style={{ flex: "2 1 260px", padding: "9px 12px", fontSize: "13.5px" }} />
                  <input value={r.name} onChange={(e) => commit((d) => { d.reviews[i].name = e.target.value; })} placeholder="Name" className="rounded-lg bg-cream border-2 border-blush font-bold font-sans" style={{ flex: "1 1 110px", padding: "9px 12px", fontSize: "13.5px" }} />
                  <input value={r.event} onChange={(e) => commit((d) => { d.reviews[i].event = e.target.value; })} placeholder="Event, town" className="rounded-lg bg-cream border-2 border-blush font-sans" style={{ flex: "1 1 140px", padding: "9px 12px", fontSize: "13.5px" }} />
                  <button title="Delete this review" aria-label="Delete this review" onClick={() => commit((d) => { d.reviews.splice(i, 1); })} className="cursor-pointer border-0 rounded-lg font-extrabold" style={{ background: "#FFE3DF", color: "#c14a3e", padding: "9px 12px", minHeight: 40 }}>✕</button>
                </div>
              ))}
            </div>
            <button onClick={() => commit((d) => { d.reviews.push({ id: uid("r"), text: "", name: "", event: "" }); })} className="cursor-pointer bg-plum text-white border-0 font-sans font-extrabold text-[13.5px] rounded-full" style={{ padding: "11px 20px", marginBottom: 32, minHeight: 44 }}>+ Add review</button>

            <h2 className="font-display m-0 mb-3.5" style={{ fontSize: 22 }}>Colour themes (quote builder)</h2>
            <div className="flex gap-2.5 flex-wrap items-center mb-3">
              {store.themes.map((t, i) => (
                <span key={t} className="flex items-center gap-2 bg-white rounded-full font-bold text-[13.5px]" style={{ border: "2px solid #F3C6C6", padding: "8px 8px 8px 16px" }}>
                  {t}
                  <button title={`Remove the “${t}” theme`} aria-label={`Remove the ${t} theme`} onClick={() => commit((d) => { d.themes.splice(i, 1); })} className="cursor-pointer border-0 rounded-full font-extrabold" style={{ background: "#FFE3DF", color: "#c14a3e", width: 26, height: 26 }}>✕</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2.5 flex-wrap">
              <input value={newTheme} onChange={(e) => setNewTheme(e.target.value)} placeholder="New theme, e.g. Silver & white" className="rounded-xl bg-cream border-2 border-blush font-sans" style={{ padding: "10px 14px", fontSize: 14, minWidth: 220 }} />
              <button
                onClick={() => {
                  const t = newTheme.trim();
                  if (!t || store.themes.includes(t)) return;
                  commit((d) => { d.themes.push(t); });
                  setNewTheme("");
                }}
                className="cursor-pointer bg-plum text-white border-0 font-sans font-extrabold text-[13.5px] rounded-full"
                style={{ padding: "11px 20px", minHeight: 44 }}
              >
                + Add theme
              </button>
            </div>
          </>
        )}

        {/* SETTINGS */}
        {tab === "settings" && (
          <>
            <h1 className="font-display m-0 mb-6" style={{ fontSize: 30 }}>Settings</h1>

            <div className={card} style={{ padding: 22, marginBottom: 18 }}>
              <h2 className="font-display m-0 mb-3.5" style={{ fontSize: 20 }}>Bookings</h2>
              <div className="flex gap-5 flex-wrap">
                <label className={fieldLabel} style={{ letterSpacing: "1px" }}>
                  MINIMUM NOTICE (DAYS)
                  <input type="number" value={store.settings.leadDays} onChange={(e) => setSetting("leadDays", parseInt(e.target.value) || 0)} className={numInput} style={{ padding: "10px 12px", fontSize: 16, width: 100 }} />
                </label>
                <label className={fieldLabel} style={{ letterSpacing: "1px" }}>
                  DEPOSIT TYPE
                  <select value={store.settings.depositType} onChange={(e) => setSetting("depositType", e.target.value as Store["settings"]["depositType"])} className="border-2 border-blush rounded-xl font-bold bg-cream font-sans" style={{ padding: "10px 12px", fontSize: "14.5px", minHeight: 46 }}>
                    <option value="full">Full payment upfront</option>
                    <option value="fixed">Fixed deposit (£)</option>
                    <option value="percent">Percentage deposit (%)</option>
                  </select>
                </label>
                {store.settings.depositType !== "full" && (
                  <label className={fieldLabel} style={{ letterSpacing: "1px" }}>
                    {store.settings.depositType === "fixed" ? "DEPOSIT AMOUNT (£)" : "DEPOSIT (%)"}
                    <input type="number" value={store.settings.depositValue} onChange={(e) => setSetting("depositValue", parseFloat(e.target.value) || 0)} className={numInput} style={{ padding: "10px 12px", fontSize: 16, width: 100 }} />
                  </label>
                )}
                <label className={fieldLabel} style={{ letterSpacing: "1px" }}>
                  REFUNDABLE UNTIL (WORKING DAYS BEFORE)
                  <input type="number" value={store.settings.refundDays} onChange={(e) => setSetting("refundDays", parseInt(e.target.value) || 0)} className={numInput} style={{ padding: "10px 12px", fontSize: 16, width: 100 }} />
                </label>
              </div>
            </div>

            <PaymentsSettings />

            <div className={card} style={{ padding: 22 }}>
              <h2 className="font-display m-0 mb-1.5" style={{ fontSize: 20 }}>Social links</h2>
              <p className="m-0 mb-4 text-[13.5px] text-plum-soft">Icons appear on the site automatically once a link is added — hidden while empty.</p>
              <div className="flex flex-col gap-3" style={{ maxWidth: 520 }}>
                <label className={fieldLabel} style={{ letterSpacing: "1px" }}>
                  INSTAGRAM
                  <input value={store.settings.instagram} onChange={(e) => setSetting("instagram", e.target.value.trim())} placeholder="https://instagram.com/jnballoons" className="rounded-xl bg-cream border-2 border-blush font-sans font-normal text-plum" style={{ padding: "10px 12px", fontSize: 14 }} />
                </label>
                <label className={fieldLabel} style={{ letterSpacing: "1px" }}>
                  FACEBOOK
                  <input value={store.settings.facebook} onChange={(e) => setSetting("facebook", e.target.value.trim())} placeholder="https://facebook.com/jnballoons" className="rounded-xl bg-cream border-2 border-blush font-sans font-normal text-plum" style={{ padding: "10px 12px", fontSize: 14 }} />
                </label>
                <label className={fieldLabel} style={{ letterSpacing: "1px" }}>
                  TIKTOK
                  <input value={store.settings.tiktok} onChange={(e) => setSetting("tiktok", e.target.value.trim())} placeholder="https://tiktok.com/@jnballoons" className="rounded-xl bg-cream border-2 border-blush font-sans font-normal text-plum" style={{ padding: "10px 12px", fontSize: 14 }} />
                </label>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Order detail with its own P&L */}
      <OrderDetailModal
        store={store}
        order={selectedOrder}
        onClose={() => setSelectedOrderId(null)}
        onStatusChange={setStatus}
        onSetMaker={setMaker}
        onSetDeliverer={setDeliverer}
        onArchive={(id) => setConfirmAction({ kind: "archive", orderId: id })}
        onRestore={restoreOrder}
        onDelete={(id) => setConfirmAction({ kind: "delete", orderId: id })}
      />

      {/* Confirmation step for cancel/archive & permanent delete */}
      <ConfirmActionModal
        store={store}
        action={confirmAction}
        onCancel={() => setConfirmAction(null)}
        onConfirm={(kind, orderId) => {
          setConfirmAction(null);
          if (kind === "archive") archiveOrder(orderId);
          else deleteOrder(orderId);
        }}
      />

      {/* Ask-for-a-review prompt — fires when an order is marked Delivered */}
      {reviewPrompt && (() => {
        const o = store.orders.find((x) => x.id === reviewPrompt);
        return o ? <ReviewPromptModal store={store} order={o} onClose={() => setReviewPrompt(null)} /> : null;
      })()}

      <style>{`.jn-click:hover { box-shadow: 0 6px 18px rgba(74,44,77,0.14); transform: translateY(-1px); transition: box-shadow .12s, transform .12s; }`}</style>
    </div>
  );
}

// Shown the moment an order is marked Delivered: offer a one-tap review request
// via WhatsApp or email, pre-filled from the editable review template. Reviews are
// this business's marketing engine, and delivered-and-delighted is the time to ask.
function ReviewPromptModal({ store, order, onClose }: { store: Store; order: Order; onClose: () => void }) {
  const contact = findContact(store, order.phone) || (order.email ? findContact(store, order.email) : null);
  const name = (contact?.name || order.customer).replace(" (custom enquiry)", "");
  const productName = store.products.find((p) => p.id === order.product)?.name || order.product;
  // fillTemplate only reads name/occasion/occasionDate; synthesise a contact-shaped
  // object from the order when there isn't a linked contact yet so {name}/{occasion}
  // still resolve.
  const forFill = (contact ?? { name, occasion: productName, occasionDate: order.date }) as unknown as Parameters<typeof fillTemplate>[1];
  const tpl = store.settings.reviewTemplate || "";
  const msg = fillTemplate(tpl, forFill);
  const email = contact?.email || order.email || "";
  const phone = contact?.phone || order.phone || "";
  const digits = phone ? toIntlDigits(phone) : "";
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(74,44,77,0.5)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div className="bg-white rounded-3xl" style={{ padding: 24, maxWidth: 440, width: "100%" }} onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display m-0 mb-1" style={{ fontSize: 21 }}>Delivered! 🎈 Ask {name} for a review?</h3>
        <p className="m-0 mb-3 text-[13.5px] text-plum-soft">Reviews are how new families find you — and right now is the perfect moment. This opens a pre-filled message you can tweak before sending.</p>
        <p className="m-0 mb-4 text-[13px] text-plum" style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, background: "#FBF7F2", borderRadius: 12, padding: "12px 14px" }}>{msg}</p>
        <div className="flex gap-2 flex-wrap items-center">
          <button type="button" disabled={!digits} onClick={() => { if (digits) window.open(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer"); }} className="cursor-pointer border-0 text-white font-extrabold text-[13px] rounded-full disabled:opacity-40 disabled:cursor-not-allowed" style={{ padding: "10px 18px", minHeight: 44, background: "#25D366" }}>WhatsApp</button>
          <button type="button" disabled={!email} onClick={() => { if (email) window.location.href = `mailto:${email}?subject=${encodeURIComponent("How did we do? 🎈")}&body=${encodeURIComponent(msg)}`; }} className="cursor-pointer border-0 bg-gold text-plum font-extrabold text-[13px] rounded-full disabled:opacity-40 disabled:cursor-not-allowed" style={{ padding: "10px 18px", minHeight: 44 }}>✉ Email</button>
          <span style={{ flex: 1 }} />
          <button onClick={onClose} className="cursor-pointer bg-cream border-0 font-bold text-[13px] rounded-full" style={{ padding: "10px 18px", minHeight: 44 }}>Not now</button>
        </div>
        <p className="m-0 mt-3 text-[11.5px] text-plum-soft">Edit the wording anytime in Contacts → Message templates (add your Google review link there).</p>
      </div>
    </div>
  );
}


// One editable image slot: thumbnail + upload/change + optional reset-to-default.
function ImageSlot({
  label,
  hint,
  src,
  accept = "image/*",
  emptyLabel,
  onUpload,
  onReset,
}: {
  label: string;
  hint?: string;
  src: string;
  accept?: string;
  emptyLabel?: string;
  onUpload: (file: File) => void;
  onReset?: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-card" style={{ padding: 14 }}>
      <div className="flex items-start gap-3">
        <div
          style={{
            width: 72,
            height: 72,
            minWidth: 72,
            borderRadius: 10,
            background: "#F8EDE9",
            overflow: "hidden",
            border: "1px solid #F3C6C6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
            <img src={assetUrl(src)} alt={label} className="w-full h-full object-cover" />
          ) : (
            <span className="text-[9px] font-bold text-plum-soft" style={{ textAlign: "center", padding: 4 }}>
              default
            </span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="m-0 font-extrabold text-[13.5px]">{label}</p>
          {hint && <p className="m-0 mt-0.5 text-[11.5px] text-plum-soft">{hint}</p>}
          {!src && emptyLabel && (
            <p className="m-0 mt-0.5 text-[11px] font-bold text-gold-ink">{emptyLabel}</p>
          )}
          <div className="flex gap-2 mt-2 flex-wrap">
            <label
              className="cursor-pointer bg-plum text-white font-sans font-extrabold text-[12px] rounded-full"
              style={{ padding: "8px 14px", minHeight: 36, display: "inline-flex", alignItems: "center" }}
            >
              {src ? "Change" : "Upload"}
              <input
                type="file"
                accept={accept}
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
            {onReset && (
              <button
                onClick={onReset}
                className="cursor-pointer bg-cream text-plum font-sans font-extrabold text-[12px] rounded-full"
                style={{ border: "2px solid #F3C6C6", padding: "8px 12px", minHeight: 36 }}
              >
                Reset to default
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
