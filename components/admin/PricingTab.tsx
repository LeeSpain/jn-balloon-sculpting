"use client";

import type { Store, Product, Fill } from "@/lib/types";
import { priceProduct, recipeBreakdown, perUnitCost, gbp, round2 } from "@/lib/pricing";
import { uid } from "@/lib/ids";

const card = "bg-white rounded-2xl shadow-card";
const numInput = "border-2 border-blush rounded-xl font-bold bg-cream text-plum font-sans";
const fieldLabel = "flex flex-col gap-1.5 text-[12.5px] font-extrabold text-gold-ink";
const txtInput = "rounded-lg bg-cream border-2 border-blush font-sans text-plum";

function fmtQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, "");
}

// Everything that feeds a customer quote — labour, markup, size tiers, materials,
// per-product recipes and manual price overrides — is editable here, no code needed.
export default function PricingTab({
  store,
  commit,
  setSetting,
}: {
  store: Store;
  commit: (m: (d: Store) => void) => void;
  setSetting: <K extends keyof Store["settings"]>(key: K, value: Store["settings"][K]) => void;
}) {
  return (
    <>
      <h1 className="font-display m-0 mb-1" style={{ fontSize: 30 }}>Costs &amp; pricing</h1>
      <p className="m-0 mb-6 text-plum-soft text-[15px]">
        Change any cost, recipe, size or price here and every future quote updates automatically.
      </p>

      {/* Labour + markup */}
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

      {/* Size tiers */}
      <h2 className="font-display m-0 mb-1.5" style={{ fontSize: 22 }}>Size tiers</h2>
      <p className="m-0 mb-3 text-plum-soft text-[13px]">
        Each size multiplies the base recipe &amp; labour. <strong>Standard</strong> should stay at ×1 — manual price overrides are set against it.
      </p>
      <div className={card} style={{ padding: "12px 18px", marginBottom: 28 }}>
        {store.sizes.map((s, i) => (
          <div key={s.id} className="flex gap-3 items-center flex-wrap" style={{ padding: "8px 0", borderBottom: i < store.sizes.length - 1 ? "1px solid #FBF7F2" : "none" }}>
            <input value={s.name} onChange={(e) => commit((d) => { d.sizes[i].name = e.target.value; })} className={`${txtInput} font-bold`} style={{ flex: 1, minWidth: 140, padding: "8px 12px", fontSize: 14 }} />
            <label className="flex items-center gap-1.5 text-[12.5px] font-bold text-plum-soft">
              ×<input type="number" step="0.05" min="0" value={s.mult} onChange={(e) => commit((d) => { d.sizes[i].mult = parseFloat(e.target.value) || 0; })} className={numInput} style={{ padding: "8px 10px", fontSize: 14, width: 80 }} />
            </label>
            {s.mult === 1 && <span className="text-[11px] font-extrabold rounded-full" style={{ background: "#F0F7F0", color: "#3c7a3c", padding: "3px 9px" }}>base</span>}
            <button
              onClick={() => { if (store.sizes.length > 1) commit((d) => { d.sizes.splice(i, 1); }); }}
              disabled={store.sizes.length <= 1}
              className="cursor-pointer border-0 rounded-lg font-extrabold disabled:opacity-30"
              style={{ background: "#FFE3DF", color: "#c14a3e", padding: "8px 12px", minHeight: 38 }}
              title={store.sizes.length <= 1 ? "Keep at least one size" : "Remove size"}
            >✕</button>
          </div>
        ))}
        <button
          onClick={() => commit((d) => { d.sizes.push({ id: uid("sz"), name: "New size", mult: 1 }); })}
          className="cursor-pointer bg-plum text-white border-0 font-sans font-extrabold text-[13px] rounded-full"
          style={{ padding: "9px 16px", minHeight: 40, marginTop: 10 }}
        >+ Add size tier</button>
      </div>

      {/* Materials */}
      <h2 className="font-display m-0 mb-1.5" style={{ fontSize: 22 }}>Materials</h2>
      <p className="m-0 mb-3 text-plum-soft text-[13px]">The building blocks every recipe draws from. Rename, re-cost, or add your own.</p>
      <div className={card} style={{ padding: "8px 18px", marginBottom: 28 }}>
        {store.materials.map((m, i) => {
          const low = m.stock != null && m.stock <= (m.lowAt ?? 0);
          const hasPack = !!(m.packSize && m.packSize > 1);
          return (
            <div key={m.id} className="flex gap-3 items-center flex-wrap" style={{ padding: "10px 0", borderBottom: "1px solid #FBF7F2" }}>
              <input value={m.name} onChange={(e) => commit((d) => { d.materials[i].name = e.target.value; })} className={`${txtInput} font-bold`} style={{ flex: 1, minWidth: 150, padding: "8px 10px", fontSize: 14 }} />
              <label className="flex items-center gap-1 text-[12px] text-plum-soft">per
                <input value={m.unit} onChange={(e) => commit((d) => { d.materials[i].unit = e.target.value; })} className={txtInput} style={{ width: 64, padding: "7px 8px", fontSize: 12.5 }} />
              </label>
              <span className="flex items-center gap-1 font-extrabold">
                £<input type="number" step="0.1" value={m.cost} onChange={(e) => commit((d) => { d.materials[i].cost = parseFloat(e.target.value) || 0; })} className={numInput} style={{ padding: "8px 10px", fontSize: 15, width: 76 }} />
              </span>
              <label className="flex items-center gap-1 text-[12px] font-bold text-plum-soft" title="Individual units per purchase unit (e.g. 100 balloons per pack)">
                of <input type="number" step="1" min="1" value={m.packSize ?? 1} onChange={(e) => commit((d) => { const v = parseInt(e.target.value) || 1; d.materials[i].packSize = v > 1 ? v : undefined; })} className={`${txtInput} font-bold`} style={{ padding: "7px 8px", fontSize: 13, width: 60 }} />
                <input value={m.unitLabel ?? ""} placeholder="unit" onChange={(e) => commit((d) => { d.materials[i].unitLabel = e.target.value || undefined; })} className={txtInput} style={{ width: 74, padding: "7px 8px", fontSize: 12.5 }} />
              </label>
              <span className="rounded-full text-[11.5px]" style={{ background: "#F0F7F0", color: "#3c7a3c", padding: "3px 9px", fontWeight: 800, whiteSpace: "nowrap" }}>
                = £{perUnitCost(m).toFixed(hasPack ? 3 : 2)}/{m.unitLabel || m.unit}
              </span>
              <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: low ? "#c14a3e" : "#7a5f7d" }}>
                stock
                <input type="number" step="0.5" value={m.stock ?? 0} onChange={(e) => commit((d) => { d.materials[i].stock = parseFloat(e.target.value) || 0; })} className="rounded-lg font-bold bg-cream text-plum font-sans" style={{ border: `2px solid ${low ? "#FF6F61" : "#F3C6C6"}`, padding: "8px 10px", fontSize: 14, width: 62 }} />
              </span>
              {/* Reorder threshold: the Overview "low stock" alert fires when stock
                  drops to this or below. Without an editor here it was frozen. */}
              <label className="flex items-center gap-1.5 text-xs font-bold text-plum-soft" title="Warn me on the dashboard when stock drops to this level or below">
                warn at
                <input type="number" step="0.5" min="0" value={m.lowAt ?? 0} onChange={(e) => commit((d) => { d.materials[i].lowAt = parseFloat(e.target.value) || 0; })} className="rounded-lg font-bold bg-cream text-plum font-sans border-2 border-blush" style={{ padding: "8px 10px", fontSize: 14, width: 62 }} />
              </label>
              <button
                onClick={() => { if (confirm(`Delete material “${m.name}”? It will be removed from any product recipes.`)) commit((d) => { d.materials.splice(i, 1); for (const p of d.products) delete p.recipe[m.id]; }); }}
                className="cursor-pointer border-0 rounded-lg font-extrabold"
                style={{ background: "#FFE3DF", color: "#c14a3e", padding: "8px 12px", minHeight: 38 }}
                title="Delete material"
              >✕</button>
            </div>
          );
        })}
        <button
          onClick={() => commit((d) => { d.materials.push({ id: uid("mat"), name: "New material", unit: "each", cost: 0, stock: 0, lowAt: 0 }); })}
          className="cursor-pointer bg-plum text-white border-0 font-sans font-extrabold text-[13px] rounded-full"
          style={{ padding: "9px 16px", minHeight: 40, margin: "10px 0" }}
        >+ Add material</button>
      </div>

      {/* Products */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
        <h2 className="font-display m-0" style={{ fontSize: 22 }}>Products — recipe, cost, price &amp; profit</h2>
        <button
          onClick={() => addProduct(commit)}
          className="cursor-pointer bg-plum text-white border-0 font-sans font-extrabold text-[13.5px] rounded-full"
          style={{ padding: "10px 18px", minHeight: 44 }}
        >+ Add a product</button>
      </div>
      <p className="m-0 mb-3.5 text-plum-soft text-[13px]">
        This is where you add, rename or remove the pieces customers can order — no developer needed. Tap a product&apos;s name to rename it, edit its recipe to re-cost instantly, or use <strong>Delete</strong> to retire it. Changes go live on the next refresh. <span className="text-gold-ink">Product photos are set in <strong>Site content → Product photos</strong>.</span>
      </p>
      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
        {store.products.map((p, i) => (
          <ProductCard key={p.id} store={store} product={p} index={i} commit={commit} />
        ))}
        {/* Add-a-product tile sits right in the grid so it's impossible to miss. */}
        <button
          onClick={() => addProduct(commit)}
          className="cursor-pointer bg-transparent text-plum flex flex-col items-center justify-center gap-1 font-sans font-extrabold"
          style={{ border: "2px dashed #D4AF7A", borderRadius: 16, minHeight: 120, padding: 20 }}
        >
          <span style={{ fontSize: 28, lineHeight: 1 }}>+</span>
          <span className="text-[14px]">Add a product</span>
          <span className="text-[11.5px] font-normal text-plum-soft">a new arch, garland, bouquet…</span>
        </button>
      </div>
    </>
  );
}

function addProduct(commit: (m: (d: Store) => void) => void) {
  commit((d) => { d.products.push({ id: uid("prod"), name: "New product", fill: "air", buildHours: 0.5, desc: "", recipe: {} }); });
}

function Row({ label, value, valueColor, border, strike }: { label: string; value: string; valueColor?: string; border?: boolean; strike?: boolean }) {
  return (
    <div className="flex justify-between text-[13.5px]" style={{ padding: "4px 0", borderTop: border ? "1px solid #FBF7F2" : undefined }}>
      <span className="text-plum-soft">{label}</span>
      <span className="font-extrabold" style={{ color: valueColor, textDecoration: strike ? "line-through" : undefined, opacity: strike ? 0.6 : 1 }}>{value}</span>
    </div>
  );
}

function ProductCard({ store, product: p, index: i, commit }: { store: Store; product: Product; index: number; commit: (m: (d: Store) => void) => void }) {
  const q = priceProduct(store, p, 1); // Standard size
  const overridden = p.priceOverride != null && p.priceOverride >= 0;
  const effective = q.price; // already reflects the override when set
  const profit = round2(effective - q.cost);
  const calcProfit = round2(q.calculated - q.cost);
  // Materials available to add to the recipe (not already in it).
  const available = store.materials.filter((m) => !(m.id in (p.recipe || {})));

  return (
    <div className="bg-white rounded-2xl shadow-card" style={{ padding: 20 }}>
      <div className="flex items-start gap-2 mb-2">
        <input
          value={p.name}
          onChange={(e) => commit((d) => { d.products[i].name = e.target.value; })}
          className="rounded-lg bg-cream border-2 border-blush font-sans font-extrabold text-plum"
          style={{ flex: 1, minWidth: 0, padding: "8px 10px", fontSize: 15 }}
        />
        <button
          onClick={() => { if (confirm(`Delete product “${p.name}”? Existing orders keep their details but it won’t be bookable.`)) commit((d) => { d.products.splice(i, 1); }); }}
          className="cursor-pointer border-0 rounded-lg font-extrabold text-[12px] whitespace-nowrap"
          style={{ background: "#FFE3DF", color: "#c14a3e", padding: "8px 12px", minHeight: 38 }}
          title="Delete this product"
        >✕ Delete</button>
      </div>

      <div className="flex gap-2 flex-wrap mb-2.5">
        <label className="flex items-center gap-1.5 text-[12px] font-bold text-plum-soft">
          Fill
          <select value={p.fill} onChange={(e) => commit((d) => { d.products[i].fill = e.target.value as Fill; })} className="rounded-lg bg-cream border-2 border-blush font-bold font-sans text-plum" style={{ padding: "7px 8px", fontSize: 12.5, minHeight: 36 }}>
            <option value="air">Air · lasts 2–3 weeks</option>
            <option value="helium">Helium · same-day only</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-[12px] font-bold text-plum-soft">
          Build hrs
          <input type="number" step="0.25" value={p.buildHours} onChange={(e) => commit((d) => { d.products[i].buildHours = parseFloat(e.target.value) || 0; })} className="border-2 border-blush rounded-lg font-bold bg-cream text-plum font-sans" style={{ padding: "7px 8px", fontSize: 13, width: 64 }} />
        </label>
      </div>
      <textarea
        value={p.desc}
        onChange={(e) => commit((d) => { d.products[i].desc = e.target.value; })}
        placeholder="Short description shown on the quote-builder card"
        rows={2}
        className="w-full rounded-lg bg-cream border-2 border-blush font-sans text-plum text-[12.5px] mb-3"
        style={{ padding: "8px 10px", resize: "vertical" }}
      />

      {/* Recipe editor */}
      <p className="m-0 mb-1.5 text-[11px] font-extrabold text-gold" style={{ letterSpacing: "1px" }}>RECIPE (per Standard size)</p>
      <div className="mb-2">
        {Object.keys(p.recipe || {}).length === 0 && <p className="m-0 text-[12px] text-plum-soft mb-1">No materials yet — add one below.</p>}
        {recipeBreakdown(store, p, 1).map((l) => (
          <div key={l.id} className="flex items-center gap-2" style={{ padding: "2px 0" }}>
            <span className="text-[12.5px]" style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.name}</span>
            <input
              type="number" step="0.5" min="0" value={l.qty}
              onChange={(e) => commit((d) => { const v = parseFloat(e.target.value); if (v > 0) d.products[i].recipe[l.id] = v; else delete d.products[i].recipe[l.id]; })}
              className="border-2 border-blush rounded-lg font-bold bg-cream text-plum font-sans"
              style={{ padding: "5px 7px", fontSize: 12.5, width: 66 }}
            />
            <span className="text-[11px] text-plum-soft" style={{ width: 52, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.unitLabel}</span>
            <span className="text-[12px] font-bold" style={{ width: 54, textAlign: "right" }}>{gbp(round2(l.lineCost))}</span>
            <button onClick={() => commit((d) => { delete d.products[i].recipe[l.id]; })} className="cursor-pointer border-0 rounded font-extrabold text-[11px]" style={{ background: "#FFE3DF", color: "#c14a3e", padding: "4px 7px" }} title="Remove from recipe">✕</button>
          </div>
        ))}
      </div>
      {available.length > 0 && (
        <select
          value=""
          onChange={(e) => { const id = e.target.value; if (id) commit((d) => { d.products[i].recipe[id] = 1; }); }}
          className="rounded-lg bg-cream border-2 border-blush font-sans text-[12px] text-plum mb-3"
          style={{ padding: "7px 9px", minHeight: 36 }}
        >
          <option value="">+ Add material to recipe…</option>
          {available.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      )}

      {/* Cost / price / override / profit */}
      <div style={{ borderTop: "1px solid #FBF7F2", paddingTop: 6, marginTop: 4 }}>
        <Row label="Materials" value={gbp(q.materials)} />
        <Row label="Labour" value={gbp(q.labour)} />
        <Row label="Total cost" value={gbp(q.cost)} border />
        <Row label="Calculated price" value={gbp(q.calculated)} valueColor={overridden ? "#9a839c" : "#FF6F61"} strike={overridden} />
        <label className="flex justify-between items-center text-[13.5px]" style={{ padding: "6px 0" }}>
          <span className="text-plum-soft font-bold">Override £ (Standard)</span>
          <input
            type="number" step="1" min="0"
            value={p.priceOverride ?? ""}
            placeholder="auto"
            onChange={(e) => commit((d) => { const v = e.target.value; d.products[i].priceOverride = v === "" ? undefined : Math.max(0, parseFloat(v) || 0); })}
            className="border-2 rounded-lg font-extrabold bg-cream text-plum font-sans"
            style={{ padding: "6px 9px", fontSize: 14, width: 92, borderColor: overridden ? "#FF6F61" : "#F3C6C6" }}
          />
        </label>
        <Row label="Customer pays" value={gbp(effective)} valueColor="#FF6F61" border />
        <Row label="Profit" value={`${gbp(profit)}${overridden ? ` (calc ${gbp(calcProfit)})` : ""}`} valueColor={profit >= 0 ? "#3c7a3c" : "#c14a3e"} />
      </div>
    </div>
  );
}
