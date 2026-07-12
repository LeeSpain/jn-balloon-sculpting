"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Store, Order, OrderStatus, SiteImages } from "@/lib/types";
import { priceProduct, consumeStock, gbp, round2, perUnitCost, recipeBreakdown } from "@/lib/pricing";
import { assetUrl } from "@/lib/assets";
import { uid } from "@/lib/ids";
import { DEFAULT_IMAGES } from "@/lib/seed";
import { computeFinance } from "@/lib/finance";
import FinanceTab from "./FinanceTab";
import OrderDetailModal from "./OrderDetailModal";

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

type Tab = "overview" | "orders" | "finance" | "pricing" | "zones" | "content" | "settings";

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

// Show whole numbers plainly (200), fractions to 2dp (0.5).
function fmtQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, "");
}

export default function AdminApp({
  initialStore,
  stripeEnvConnected,
  dbConnected,
  blobConnected,
  bookingsLive,
}: {
  initialStore: Store;
  stripeEnvConnected: boolean;
  dbConnected: boolean;
  blobConnected: boolean;
  bookingsLive: boolean;
}) {
  const [store, setStore] = useState<Store>(initialStore);
  const [tab, setTab] = useState<Tab>("overview");
  const [newTheme, setNewTheme] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
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
    { id: "finance", label: "Finance" },
    { id: "pricing", label: "Costs & pricing" },
    { id: "zones", label: "Delivery zones" },
    { id: "content", label: "Site content" },
    { id: "settings", label: "Settings" },
  ];

  // ---- overview derived (finance figures come straight from the P&L engine) ----
  const { greeting, stats, upcoming, alerts } = useMemo(() => {
    const active = store.orders.filter((o) => o.status !== "Delivered");
    const upcoming = active.slice().sort((a, b) => a.date.localeCompare(b.date));
    const fin = computeFinance(store, "active");
    const hour = new Date().getHours();
    const greeting = (hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening") + ", Jade & Nicole";
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
    return { greeting, stats, upcoming, alerts };
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
    });
  }

  const orderRows = store.orders.slice().sort((a, b) => a.date.localeCompare(b.date));

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
                  <strong>Card payments are off.</strong> The site takes bookings as enquiries (no charge). Turn on
                  Stripe + <code>BOOKINGS_LIVE</code> in Vercel when you&apos;re ready to take deposits.
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
            <p className="m-0 mb-6 text-plum-soft text-[15px]">Order received → Materials purchased → In progress → Ready → Delivered</p>
            <div className="flex flex-col gap-3">
              {orderRows.map((o) => {
                const profit = orderProfit(o);
                return (
                  <div
                    key={o.id}
                    onClick={() => setSelectedOrderId(o.id)}
                    className={`${card} jn-click grid gap-3.5 items-center`}
                    style={{ padding: "18px 20px", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", cursor: "pointer" }}
                  >
                    <div>
                      <p className="m-0 font-extrabold text-[15px]">{o.customer}</p>
                      <p className="mt-0.5 mb-0 text-[12.5px] text-plum-soft">{o.id} · {o.phone}</p>
                    </div>
                    <div>
                      <p className="m-0 font-bold text-sm">{productById(o.product)?.name ?? o.product} ({sizeById(o.size).name})</p>
                      <p className="mt-0.5 mb-0 text-[12.5px] text-plum-soft">{o.theme}</p>
                    </div>
                    <div>
                      <p className="m-0 font-bold text-sm">{prettyDate(o.date)}</p>
                      <p className="mt-0.5 mb-0 text-[12.5px] text-plum-soft">{o.address} {o.postcode}</p>
                    </div>
                    <div>
                      <p className="m-0 font-extrabold text-[15px] text-coral">{orderTotal(o)}</p>
                      <p className="mt-0.5 mb-0 text-[12.5px] font-bold" style={{ color: profit > 0 ? "#3c7a3c" : "#c14a3e" }}>profit {gbp(Math.round(profit))}</p>
                    </div>
                    <select
                      value={o.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setStatus(o.id, e.target.value as OrderStatus)}
                      className="border-2 border-blush rounded-xl font-bold bg-cream font-sans"
                      style={{ padding: "10px 12px", fontSize: "13.5px", minHeight: 44 }}
                    >
                      {STATUSES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </>
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
          <>
            <h1 className="font-display m-0 mb-1" style={{ fontSize: 30 }}>Costs &amp; pricing</h1>
            <p className="m-0 mb-6 text-plum-soft text-[15px]">Change any cost here and every future quote updates automatically.</p>
            <div className="flex gap-3.5 flex-wrap mb-7">
              <label className={`${fieldLabel} ${card}`} style={{ padding: "16px 18px", letterSpacing: "1px" }}>
                LABOUR RATE (£/HR)
                <input type="number" step="0.5" value={store.settings.labourRate} onChange={(e) => setSetting("labourRate", parseFloat(e.target.value) || 0)} className={numInput} style={{ padding: "10px 12px", fontSize: 17, width: 110 }} />
              </label>
              <label className={`${fieldLabel} ${card}`} style={{ padding: "16px 18px", letterSpacing: "1px" }}>
                MARKUP (%)
                <input type="number" step="5" value={store.settings.markupPct} onChange={(e) => setSetting("markupPct", parseFloat(e.target.value) || 0)} className={numInput} style={{ padding: "10px 12px", fontSize: 17, width: 110 }} />
              </label>
            </div>

            <h2 className="font-display m-0 mb-3.5" style={{ fontSize: 22 }}>Materials</h2>
            <div className={card} style={{ padding: "8px 18px", marginBottom: 28 }}>
              {store.materials.map((m, i) => {
                const low = m.stock != null && m.stock <= (m.lowAt ?? 0);
                return (
                  <div key={m.id} className="flex gap-3 items-center flex-wrap" style={{ padding: "10px 0", borderBottom: "1px solid #FBF7F2" }}>
                    <span className="font-bold text-[14.5px]" style={{ flex: 1, minWidth: 150 }}>{m.name}</span>
                    <span className="text-[12.5px] text-plum-soft" style={{ width: 56 }}>per {m.unit}</span>
                    <span className="flex items-center gap-1 font-extrabold">
                      £<input type="number" step="0.1" value={m.cost} onChange={(e) => commit((d) => { d.materials[i].cost = parseFloat(e.target.value) || 0; })} className={numInput} style={{ padding: "8px 10px", fontSize: 15, width: 76 }} />
                    </span>
                    {m.packSize && m.packSize > 1 ? (
                      <span className="flex items-center gap-1.5 text-[12px] font-bold text-plum-soft" title={`Each ${m.unitLabel || "unit"} costs £${perUnitCost(m).toFixed(3)}`}>
                        of
                        <input type="number" step="1" value={m.packSize} onChange={(e) => commit((d) => { d.materials[i].packSize = parseInt(e.target.value) || 1; })} className="rounded-lg font-bold bg-cream text-plum font-sans border-2 border-blush" style={{ padding: "7px 8px", fontSize: 13, width: 56 }} />
                        {m.unitLabel || "units"}
                        <span className="rounded-full" style={{ background: "#F0F7F0", color: "#3c7a3c", padding: "3px 9px", fontWeight: 800, whiteSpace: "nowrap" }}>
                          = £{perUnitCost(m).toFixed(3)}/{m.unitLabel || "unit"}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[12px] text-plum-soft" style={{ minWidth: 90 }}>
                        £{perUnitCost(m).toFixed(2)} / {m.unitLabel || m.unit}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: low ? "#c14a3e" : "#7a5f7d" }}>
                      stock
                      <input type="number" step="0.5" value={m.stock ?? 0} onChange={(e) => commit((d) => { d.materials[i].stock = parseFloat(e.target.value) || 0; })} className="rounded-lg font-bold bg-cream text-plum font-sans" style={{ border: `2px solid ${low ? "#FF6F61" : "#F3C6C6"}`, padding: "8px 10px", fontSize: 14, width: 62 }} />
                    </span>
                  </div>
                );
              })}
            </div>

            <h2 className="font-display m-0 mb-3.5" style={{ fontSize: 22 }}>Products — cost vs price vs profit</h2>
            <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
              {store.products.map((p, i) => {
                const q = priceProduct(store, p, 1);
                return (
                  <div key={p.id} className={card} style={{ padding: 20 }}>
                    <p className="m-0 mb-0.5 font-extrabold text-base">{p.name}</p>
                    <p className="m-0 mb-3 text-xs text-plum-soft">{p.fill === "helium" ? "Helium-filled · same-day delivery only" : "Air-filled · lasts 2–3 weeks"}</p>
                    <label className="flex items-center gap-2 text-[13px] font-bold mb-3">
                      Build time (hrs)
                      <input type="number" step="0.25" value={p.buildHours} onChange={(e) => commit((d) => { d.products[i].buildHours = parseFloat(e.target.value) || 0; })} className={numInput} style={{ padding: "7px 10px", fontSize: 14, width: 64 }} />
                    </label>
                    <Row label="Materials" value={gbp(q.materials)} />
                    {/* Per-material breakdown so cost is never just one lump */}
                    <div className="mb-1" style={{ paddingLeft: 8 }}>
                      {recipeBreakdown(store, p, 1).map((l) => (
                        <div
                          key={l.id}
                          className="flex justify-between gap-2 text-[11.5px]"
                          style={{ padding: "1px 0" }}
                          title={`${fmtQty(l.qty)} ${l.unitLabel} @ £${l.perUnit.toFixed(l.perUnit < 1 ? 3 : 2)} each`}
                        >
                          <span className="text-plum-soft" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {l.name} <span style={{ opacity: 0.7 }}>×{fmtQty(l.qty)}</span>
                          </span>
                          <span className="font-bold" style={{ whiteSpace: "nowrap" }}>{gbp(round2(l.lineCost))}</span>
                        </div>
                      ))}
                    </div>
                    <Row label="Labour" value={gbp(q.labour)} />
                    <Row label="Customer price" value={gbp(q.price)} valueColor="#FF6F61" border />
                    <Row label="Profit" value={gbp(round2(q.price - q.cost))} valueColor="#3c7a3c" />
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ZONES */}
        {tab === "zones" && (
          <>
            <h1 className="font-display m-0 mb-1" style={{ fontSize: 30 }}>Delivery zones</h1>
            <p className="m-0 mb-6 text-plum-soft text-[15px]">Measured from your base between Huntingdon and Stilton. Postcodes outside all zones route to a custom enquiry.</p>
            <div className="flex flex-col gap-3 mb-5">
              {store.zones.map((z, i) => (
                <div key={z.id} className={`${card} flex flex-wrap gap-3.5 items-center`} style={{ padding: "18px 20px" }}>
                  <div style={{ minWidth: 130 }}>
                    <p className="m-0 font-extrabold text-[15.5px]">{z.name}</p>
                    <p className="mt-0.5 mb-0 text-[12.5px] text-plum-soft">{z.range}</p>
                  </div>
                  <p className="m-0 text-[13px] text-plum-soft" style={{ flex: 1, minWidth: 200 }}>
                    {z.areas}
                    <br />
                    <span style={{ fontFamily: "monospace", fontSize: "11.5px" }}>{(z.districts || []).join(" · ")}</span>
                  </p>
                  <label className="flex items-center gap-1.5 font-extrabold text-[15px]">
                    £<input type="number" step="1" value={z.fee ?? 0} onChange={(e) => commit((d) => { d.zones[i].fee = parseFloat(e.target.value) || 0; })} className={numInput} style={{ padding: "9px 11px", fontSize: 15, width: 70 }} />
                  </label>
                </div>
              ))}
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
            <p className="m-0 mb-6 text-plum-soft text-[15px]">Images, gallery, reviews and colour themes — changes appear on the website on the next refresh.</p>

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
                      <button onClick={() => commit((d) => { if (i > 0) [d.gallery[i - 1], d.gallery[i]] = [d.gallery[i], d.gallery[i - 1]]; })} className="cursor-pointer border-0 bg-cream rounded-lg font-extrabold" style={{ padding: "9px 12px", minHeight: 40 }}>↑</button>
                      <button onClick={() => commit((d) => { if (i < d.gallery.length - 1) [d.gallery[i + 1], d.gallery[i]] = [d.gallery[i], d.gallery[i + 1]]; })} className="cursor-pointer border-0 bg-cream rounded-lg font-extrabold" style={{ padding: "9px 12px", minHeight: 40 }}>↓</button>
                      <button onClick={() => commit((d) => { d.gallery.splice(i, 1); })} className="cursor-pointer border-0 rounded-lg font-extrabold" style={{ background: "#FFE3DF", color: "#c14a3e", padding: "9px 12px", minHeight: 40 }}>✕</button>
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
                  <button onClick={() => commit((d) => { d.reviews.splice(i, 1); })} className="cursor-pointer border-0 rounded-lg font-extrabold" style={{ background: "#FFE3DF", color: "#c14a3e", padding: "9px 12px", minHeight: 40 }}>✕</button>
                </div>
              ))}
            </div>
            <button onClick={() => commit((d) => { d.reviews.push({ id: uid("r"), text: "", name: "", event: "" }); })} className="cursor-pointer bg-plum text-white border-0 font-sans font-extrabold text-[13.5px] rounded-full" style={{ padding: "11px 20px", marginBottom: 32, minHeight: 44 }}>+ Add review</button>

            <h2 className="font-display m-0 mb-3.5" style={{ fontSize: 22 }}>Colour themes (quote builder)</h2>
            <div className="flex gap-2.5 flex-wrap items-center mb-3">
              {store.themes.map((t, i) => (
                <span key={t} className="flex items-center gap-2 bg-white rounded-full font-bold text-[13.5px]" style={{ border: "2px solid #F3C6C6", padding: "8px 8px 8px 16px" }}>
                  {t}
                  <button onClick={() => commit((d) => { d.themes.splice(i, 1); })} className="cursor-pointer border-0 rounded-full font-extrabold" style={{ background: "#FFE3DF", color: "#c14a3e", width: 26, height: 26 }}>✕</button>
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

            <div className={card} style={{ padding: 22, marginBottom: 18 }}>
              <div className="flex items-center gap-3 mb-1.5">
                <h2 className="font-display m-0" style={{ fontSize: 20 }}>Payments — Stripe</h2>
                <span className="text-xs font-extrabold rounded-full" style={{ padding: "5px 12px", background: stripeEnvConnected ? "#E4F0E4" : "#FFE3DF", color: stripeEnvConnected ? "#3c7a3c" : "#c14a3e" }}>
                  {stripeEnvConnected ? "Connected ✓" : "Not connected"}
                </span>
              </div>
              <p className="m-0 text-[13.5px] text-plum-soft">
                Live Stripe keys are set securely as server environment variables (<span style={{ fontFamily: "monospace" }}>STRIPE_SECRET_KEY</span> / <span style={{ fontFamily: "monospace" }}>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</span>) in Vercel — never stored in the browser or database. Until set, the site takes bookings as &quot;pay on confirmation&quot; enquiries.
              </p>
            </div>

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
      />

      <style>{`.jn-click:hover { box-shadow: 0 6px 18px rgba(74,44,77,0.14); transform: translateY(-1px); transition: box-shadow .12s, transform .12s; }`}</style>
    </div>
  );
}

function Row({
  label,
  value,
  valueColor,
  border,
}: {
  label: string;
  value: string;
  valueColor?: string;
  border?: boolean;
}) {
  return (
    <div className="flex justify-between text-[13.5px]" style={{ padding: "4px 0", borderTop: border ? "1px solid #FBF7F2" : undefined }}>
      <span className="text-plum-soft">{label}</span>
      <span className="font-extrabold" style={{ color: valueColor }}>{value}</span>
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
