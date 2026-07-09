"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Store, Order, OrderStatus } from "@/lib/types";
import { priceProduct, consumeStock, gbp, round2 } from "@/lib/pricing";

type Tab = "overview" | "orders" | "pricing" | "zones" | "content" | "settings";

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
  "flex flex-col gap-1.5 text-[12.5px] font-extrabold text-gold";

function prettyDate(iso: string): string {
  return new Date(iso + "T12:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function AdminApp({
  initialStore,
  stripeEnvConnected,
}: {
  initialStore: Store;
  stripeEnvConnected: boolean;
}) {
  const [store, setStore] = useState<Store>(initialStore);
  const [tab, setTab] = useState<Tab>("overview");
  const [newTheme, setNewTheme] = useState("");
  const router = useRouter();

  // Apply a mutation to a clone, update UI immediately, persist server-side.
  function commit(mutator: (draft: Store) => void) {
    const draft: Store = structuredClone(store);
    mutator(draft);
    setStore(draft);
    fetch("/api/admin/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ store: draft }),
    }).catch(() => {});
  }

  async function resetData() {
    const res = await fetch("/api/admin/store", { method: "DELETE" });
    if (res.ok) {
      const { store: fresh } = await res.json();
      setStore(fresh);
    }
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
    { id: "pricing", label: "Costs & pricing" },
    { id: "zones", label: "Delivery zones" },
    { id: "content", label: "Site content" },
    { id: "settings", label: "Settings" },
  ];

  // ---- overview derived ----
  const { greeting, stats, upcoming, alerts } = useMemo(() => {
    const active = store.orders.filter((o) => o.status !== "Delivered");
    const upcoming = active
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date));
    const revenue = active.reduce((s, o) => s + o.price + (o.delivery || 0), 0);
    const profitSum = active.reduce((s, o) => {
      const p = productById(o.product);
      const sz = sizeById(o.size);
      return s + (o.price - (p && p.recipe ? priceProduct(store, p, sz.mult).cost : 0)) + (o.delivery || 0) * 0.5;
    }, 0);
    const hour = new Date().getHours();
    const greeting = (hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening") + ", Jade & Nicole";
    const firstUp = upcoming[0];
    const stats = [
      { label: "OPEN ORDERS", value: String(active.length), sub: "not yet delivered", color: "#4A2C4D" },
      { label: "BOOKED REVENUE", value: gbp(revenue), sub: "incl. delivery", color: "#4A2C4D" },
      { label: "EXPECTED PROFIT", value: gbp(Math.round(profitSum)), sub: "after materials & labour", color: "#3c7a3c" },
      {
        label: "NEXT DELIVERY",
        value: firstUp ? prettyDate(firstUp.date) : "—",
        sub: firstUp ? (productById(firstUp.product)?.name ?? firstUp.product) : "nothing booked",
        color: "#FF6F61",
      },
    ];
    const alerts = store.materials
      .filter((m) => m.stock != null && m.lowAt != null && m.stock <= m.lowAt)
      .map((m) => `${m.name} running low (${m.stock} left) — time to reorder.`);
    return { greeting, stats, upcoming, alerts };
  }, [store]);

  function orderTotal(o: Order) {
    return gbp(o.price + (o.delivery || 0));
  }
  function orderProfit(o: Order) {
    const p = productById(o.product);
    const sz = sizeById(o.size);
    const cost = p && p.recipe ? priceProduct(store, p, sz.mult).cost : 0;
    return o.price - cost;
  }
  function setStatus(orderId: string, next: OrderStatus) {
    commit((d) => {
      const o = d.orders.find((x) => x.id === orderId);
      if (!o) return;
      if (next === "Materials purchased" && !o.stockTaken) {
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
          <div className="flex gap-3.5 items-center">
            <a href="/" className="text-[13.5px] font-bold no-underline" style={{ color: "#F3C6C6" }}>View site →</a>
            <button onClick={resetData} className="cursor-pointer bg-transparent font-sans text-xs font-bold rounded-full" style={{ border: "1px solid rgba(251,247,242,0.35)", color: "#FBF7F2", padding: "8px 14px" }}>
              Reset demo data
            </button>
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
        {/* OVERVIEW */}
        {tab === "overview" && (
          <>
            <h1 className="font-display m-0 mb-1" style={{ fontSize: 30 }}>{greeting}</h1>
            <p className="m-0 mb-6 text-plum-soft text-[15px]">Here&apos;s how the business looks today.</p>
            <div className="grid gap-3.5 mb-7" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              {stats.map((s) => (
                <div key={s.label} className={card} style={{ padding: 20 }}>
                  <p className="m-0 mb-1.5 text-xs font-extrabold text-gold" style={{ letterSpacing: "1.5px" }}>{s.label}</p>
                  <p className="m-0 font-display font-bold" style={{ fontSize: 32, color: s.color }}>{s.value}</p>
                  <p className="mt-1 mb-0 text-[12.5px] text-plum-soft">{s.sub}</p>
                </div>
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
                  <div key={o.id} className={`${card} flex flex-wrap gap-3 items-center justify-between`} style={{ padding: "16px 18px" }}>
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
                  <div key={o.id} className={`${card} grid gap-3.5 items-center`} style={{ padding: "18px 20px", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
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
                    <span className="font-bold text-[14.5px]" style={{ flex: 1, minWidth: 180 }}>{m.name}</span>
                    <span className="text-[12.5px] text-plum-soft" style={{ width: 70 }}>per {m.unit}</span>
                    <span className="flex items-center gap-1 font-extrabold">
                      £<input type="number" step="0.1" value={m.cost} onChange={(e) => commit((d) => { d.materials[i].cost = parseFloat(e.target.value) || 0; })} className={numInput} style={{ padding: "8px 10px", fontSize: 15, width: 76 }} />
                    </span>
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
            <p className="m-0 mb-6 text-plum-soft text-[15px]">Gallery, reviews and colour themes — changes appear on the website straight away.</p>

            <h2 className="font-display m-0 mb-3.5" style={{ fontSize: 22 }}>Gallery</h2>
            <div className="flex flex-col gap-2.5 mb-3.5">
              {store.gallery.map((g, i) => (
                <div key={g.id} className={`${card} flex flex-wrap gap-3 items-center`} style={{ padding: "12px 16px" }}>
                  <div style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: "#F8EDE9", backgroundImage: `url('/${g.src}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
                  <input value={g.title} onChange={(e) => commit((d) => { d.gallery[i].title = e.target.value; })} className="rounded-lg font-bold bg-cream text-plum font-sans border-2 border-blush" style={{ flex: 1, minWidth: 160, padding: "9px 12px", fontSize: 14 }} />
                  <select value={g.src} onChange={(e) => commit((d) => { d.gallery[i].src = e.target.value; })} className="rounded-lg bg-cream border-2 border-blush font-sans" style={{ padding: "9px 10px", fontSize: "12.5px", maxWidth: 210, minHeight: 42 }}>
                    {(store.galleryImages || []).map((src) => (
                      <option key={src} value={src}>{src.replace("images/", "").replace(".png", "").replace("gallery-", "")}</option>
                    ))}
                  </select>
                  <div className="flex gap-1.5">
                    <button onClick={() => commit((d) => { if (i > 0) [d.gallery[i - 1], d.gallery[i]] = [d.gallery[i], d.gallery[i - 1]]; })} className="cursor-pointer border-0 bg-cream rounded-lg font-extrabold" style={{ padding: "9px 12px", minHeight: 40 }}>↑</button>
                    <button onClick={() => commit((d) => { if (i < d.gallery.length - 1) [d.gallery[i + 1], d.gallery[i]] = [d.gallery[i], d.gallery[i + 1]]; })} className="cursor-pointer border-0 bg-cream rounded-lg font-extrabold" style={{ padding: "9px 12px", minHeight: 40 }}>↓</button>
                    <button onClick={() => commit((d) => { d.gallery.splice(i, 1); })} className="cursor-pointer border-0 rounded-lg font-extrabold" style={{ background: "#FFE3DF", color: "#c14a3e", padding: "9px 12px", minHeight: 40 }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => commit((d) => { d.gallery.push({ id: "g" + Date.now(), title: "New piece", src: (d.galleryImages || [])[0] || "" }); })} className="cursor-pointer bg-plum text-white border-0 font-sans font-extrabold text-[13.5px] rounded-full" style={{ padding: "11px 20px", marginBottom: 10, minHeight: 44 }}>+ Add gallery item</button>
            <p className="text-[12.5px] text-plum-soft" style={{ margin: "0 0 32px" }}>New items use your existing artwork — drop real photos into the project and they&apos;ll be selectable here.</p>

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
            <button onClick={() => commit((d) => { d.reviews.push({ id: "r" + Date.now(), text: "", name: "", event: "" }); })} className="cursor-pointer bg-plum text-white border-0 font-sans font-extrabold text-[13.5px] rounded-full" style={{ padding: "11px 20px", marginBottom: 32, minHeight: 44 }}>+ Add review</button>

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
                <label className={fieldLabel} style={{ letterSpacing: "1px" }}>
                  {store.settings.depositType === "fixed" ? "DEPOSIT AMOUNT (£)" : "DEPOSIT (%)"}
                  <input type="number" value={store.settings.depositValue} onChange={(e) => setSetting("depositValue", parseFloat(e.target.value) || 0)} className={numInput} style={{ padding: "10px 12px", fontSize: 16, width: 100 }} />
                </label>
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
