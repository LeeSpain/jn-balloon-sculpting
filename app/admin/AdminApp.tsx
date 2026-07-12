'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { css } from '@/lib/css';
import { priceProduct, materialCost, round2, gbp } from '@/lib/engine';
import type { Store, Order, OrderStatus, DepositType } from '@/lib/types';

type Tab = 'overview' | 'orders' | 'pricing' | 'zones' | 'content' | 'finance' | 'settings';

const STATUS_STYLES: Record<OrderStatus, { bg: string; color: string }> = {
  'Order received': { bg: '#F3C6C6', color: '#4A2C4D' },
  'Materials purchased': { bg: '#F2E7D8', color: '#8a6a3a' },
  'In progress': { bg: '#FFE3DF', color: '#c14a3e' },
  Ready: { bg: '#E4F0E4', color: '#3c7a3c' },
  Delivered: { bg: '#EDEAEE', color: '#7a5f7d' },
};

const ORDER_STATUSES: OrderStatus[] = [
  'Order received', 'Materials purchased', 'In progress', 'Ready', 'Delivered',
];

const img = (s: string) => (s && !/^(https?:|\/)/.test(s) ? '/' + s : s);

function dateLabel(iso: string): string {
  return new Date(iso + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

const inputCss = 'border: 2px solid #F3C6C6; border-radius: 12px; padding: 10px 12px; font-size: 16px; font-weight: 800; background: #FBF7F2;';
const labelCss = 'display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; font-weight: 800; letter-spacing: 1px; color: #D4AF7A;';

export default function AdminApp({ initialStore }: { initialStore: Store }) {
  const router = useRouter();
  const [store, setStore] = useState<Store>(initialStore);
  const [tab, setTab] = useState<Tab>('overview');
  const [newTheme, setNewTheme] = useState('');
  const [finPipeline, setFinPipeline] = useState(true);
  const [greeting, setGreeting] = useState('Hello, Jade & Nicole');
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<Store>(store);

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting((hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening') + ', Jade & Nicole');
  }, []);

  function scheduleSave(next: Store) {
    latest.current = next;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void fetch('/api/admin/store', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(latest.current),
      });
    }, 500);
  }

  // Immutable mutate + debounced persist (content/settings only; server ignores orders).
  function patch(mutate: (s: Store) => void) {
    setStore((prev) => {
      const next: Store = structuredClone(prev);
      mutate(next);
      scheduleSave(next);
      return next;
    });
  }

  const setSetting = <K extends keyof Store['settings']>(key: K, value: Store['settings'][K]) =>
    patch((s) => {
      s.settings[key] = value;
    });

  async function setStatus(id: string, status: OrderStatus) {
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const { store: fresh } = (await res.json()) as { store: Store };
      setStore(fresh);
    }
  }

  async function resetData() {
    const res = await fetch('/api/admin/reset', { method: 'POST' });
    if (res.ok) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const { store: fresh } = (await res.json()) as { store: Store };
      setStore(fresh);
    }
  }

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.replace('/admin/login');
    router.refresh();
  }

  async function uploadPhoto(file: File) {
    setUploadMsg('Uploading…');
    const body = new FormData();
    body.append('file', file);
    const res = await fetch('/api/admin/upload', { method: 'POST', body });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setUploadMsg(data.error || 'Upload failed.');
      return;
    }
    const { url } = (await res.json()) as { url: string };
    patch((st) => {
      if (!st.galleryImages.includes(url)) st.galleryImages.push(url);
      st.gallery.push({ id: 'g' + Date.now(), title: 'New photo', src: url });
    });
    setUploadMsg('Photo added to the gallery ✓');
  }

  // ---- derived views ----
  const productById = (id: string) => store.products.find((p) => p.id === id);
  const sizeById = (id: string) => store.sizes.find((s) => s.id === id) || { id: 'standard', name: 'Standard', mult: 1 };

  const orderView = (o: Order) => {
    const p = productById(o.product) || { name: o.product, recipe: {} as Record<string, number> };
    const sz = sizeById(o.size);
    const cost = 'recipe' in p && p.recipe ? priceProduct(store, p as never, sz.mult).cost : 0;
    const profit = o.price - cost;
    const ss = STATUS_STYLES[o.status] || STATUS_STYLES['Order received'];
    const totalDue = o.price + (o.delivery || 0);
    return {
      ...o,
      productName: p.name,
      sizeName: sz.name,
      dateLabel: dateLabel(o.date),
      total: gbp(totalDue),
      profit: gbp(Math.round(profit)),
      profitColor: profit > 0 ? '#3c7a3c' : '#c14a3e',
      paidLabel: o.depositPaid
        ? 'paid ' + gbp(o.depositPaid) + (o.depositPaid >= totalDue ? ' · paid in full' : ' · due ' + gbp(round2(totalDue - o.depositPaid)))
        : 'nothing paid yet',
      paidColor: o.depositPaid ? '#3c7a3c' : '#b0862a',
      statusBg: ss.bg,
      statusColor: ss.color,
    };
  };

  const active = store.orders.filter((o) => o.status !== 'Delivered');
  const upcoming = active.slice().sort((a, b) => a.date.localeCompare(b.date)).map(orderView);
  const orderRows = store.orders.slice().sort((a, b) => a.date.localeCompare(b.date)).map(orderView);

  const revenue = active.reduce((s, o) => s + o.price + (o.delivery || 0), 0);
  const profitSum = active.reduce((s, o) => {
    const p = productById(o.product);
    const sz = sizeById(o.size);
    return s + (o.price - (p && p.recipe ? priceProduct(store, p, sz.mult).cost : 0)) + (o.delivery || 0) * 0.5;
  }, 0);

  const stats = [
    { label: 'OPEN ORDERS', value: String(active.length), sub: 'not yet delivered', color: '#4A2C4D' },
    { label: 'BOOKED REVENUE', value: gbp(revenue), sub: 'incl. delivery', color: '#4A2C4D' },
    { label: 'EXPECTED PROFIT', value: gbp(Math.round(profitSum)), sub: 'after materials & labour', color: '#3c7a3c' },
    { label: 'NEXT DELIVERY', value: upcoming.length ? upcoming[0].dateLabel : '—', sub: upcoming.length ? upcoming[0].productName : 'nothing booked', color: '#FF6F61' },
  ];

  const alerts = store.materials
    .filter((m) => m.stock != null && m.lowAt != null && m.stock <= m.lowAt)
    .map((m) => m.name + ' running low (' + m.stock + ' left) — time to reorder.');

  const s = store.settings;
  const stripeConnected = s.stripePublishable.startsWith('pk_') && s.stripeSecret.length > 4;

  // finance
  const finScope = store.orders.filter((o) => finPipeline || o.status === 'Delivered');
  let finRev = 0, finMat = 0;
  for (const o of finScope) {
    finRev += o.price + (o.delivery || 0);
    const p = productById(o.product);
    if (p && p.recipe) finMat += materialCost(store, p, sizeById(o.size).mult);
  }
  const finProfitN = Math.max(0, finRev - finMat);
  const splitPct = s.splitPct ?? 50;
  const allowance = s.allowance ?? 12570;
  const taxRate = s.taxRatePct ?? 20;
  const niRate = s.niRatePct ?? 6;
  const finPartners = [
    { name: 'Jade', frac: splitPct / 100 },
    { name: 'Nicole', frac: (100 - splitPct) / 100 },
  ].map((pt) => {
    const share = finProfitN * pt.frac;
    const taxable = Math.max(0, share - allowance);
    const tax = (taxable * taxRate) / 100;
    const ni = (taxable * niRate) / 100;
    return {
      name: pt.name,
      share: gbp(round2(share)),
      allowanceUsed: gbp(round2(Math.min(share, allowance))) + ' of ' + gbp(allowance),
      taxRate: taxRate + '%', tax: gbp(round2(tax)),
      niRate: niRate + '%', ni: gbp(round2(ni)),
      setAside: gbp(round2(tax + ni)),
      takeHome: gbp(Math.floor(share - tax - ni)),
      taxableN: taxable,
    };
  });
  const allUnder = finPartners.every((p) => p.taxableN === 0);

  const imageOptions = (store.galleryImages || []).map((src) => ({
    value: src,
    label: (src.split('/').pop() || src).replace(/\.[a-z0-9]+$/i, '').replace('gallery-', ''),
  }));

  const tabDefs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'orders', label: 'Orders' },
    { id: 'pricing', label: 'Costs & pricing' },
    { id: 'zones', label: 'Delivery zones' },
    { id: 'content', label: 'Site content' },
    { id: 'finance', label: 'Finance' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <>
      <header style={css('background: #4A2C4D; color: #FBF7F2;')}>
        <div style={css('max-width: 1100px; margin: 0 auto; padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;')}>
          <div style={css('display: flex; align-items: baseline; gap: 12px;')}>
            <span style={css("font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 700;")}>J<span style={css('color: #D4AF7A;')}>&amp;</span>N</span>
            <span style={css('font-size: 12px; letter-spacing: 2px; font-weight: 800; color: #D4AF7A;')}>ADMIN</span>
          </div>
          <div style={css('display: flex; gap: 14px; align-items: center;')}>
            <a href="/" style={css('color: #F3C6C6; font-size: 13.5px; font-weight: 700; text-decoration: none;')}>View site →</a>
            <button onClick={resetData} style={css("cursor: pointer; background: transparent; border: 1px solid rgba(251,247,242,0.35); color: #FBF7F2; font-family: 'Nunito', sans-serif; font-size: 12px; font-weight: 700; padding: 8px 14px; border-radius: 999px;")}>Reset demo data</button>
            <button onClick={logout} style={css("cursor: pointer; background: transparent; border: 1px solid rgba(251,247,242,0.35); color: #FBF7F2; font-family: 'Nunito', sans-serif; font-size: 12px; font-weight: 700; padding: 8px 14px; border-radius: 999px;")}>Log out</button>
          </div>
        </div>
      </header>

      <nav style={css('background: #fff; border-bottom: 1px solid #F3C6C6; position: sticky; top: 0; z-index: 10;')}>
        <div style={css('max-width: 1100px; margin: 0 auto; padding: 0 12px; display: flex; gap: 4px; overflow-x: auto;')}>
          {tabDefs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={css(`cursor: pointer; background: none; border: none; border-bottom: 3px solid ${t.id === tab ? '#FF6F61' : 'transparent'}; color: ${t.id === tab ? '#4A2C4D' : '#9a839c'}; font-family: 'Nunito', sans-serif; font-weight: 800; font-size: 14px; padding: 14px 16px; white-space: nowrap; min-height: 48px;`)}>{t.label}</button>
          ))}
        </div>
      </nav>

      <main style={css('max-width: 1100px; margin: 0 auto; padding: 28px 20px 64px;')}>
        {tab === 'overview' && (
          <>
            <h1 style={css("font-family: 'Playfair Display', serif; font-size: 30px; margin: 0 0 4px;")}>{greeting}</h1>
            <p style={css('margin: 0 0 24px; color: #7a5f7d; font-size: 15px;')}>Here&apos;s how the business looks today.</p>
            <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 28px;')}>
              {stats.map((st) => (
                <div key={st.label} style={css('background: #fff; border-radius: 18px; padding: 20px; box-shadow: 0 4px 14px rgba(74,44,77,0.07);')}>
                  <p style={css('margin: 0 0 6px; font-size: 12px; letter-spacing: 1.5px; font-weight: 800; color: #D4AF7A;')}>{st.label}</p>
                  <p style={css(`margin: 0; font-family: 'Playfair Display', serif; font-size: 32px; font-weight: 700; color: ${st.color};`)}>{st.value}</p>
                  <p style={css('margin: 4px 0 0; font-size: 12.5px; color: #7a5f7d;')}>{st.sub}</p>
                </div>
              ))}
            </div>
            {alerts.length > 0 && (
              <div style={css('background: #FFF3F1; border: 2px solid #FF6F61; border-radius: 16px; padding: 16px 20px; margin-bottom: 28px;')}>
                <p style={css('margin: 0 0 6px; font-weight: 800; font-size: 13px; letter-spacing: 1px; color: #FF6F61;')}>LOW STOCK</p>
                {alerts.map((a, i) => (
                  <p key={i} style={css('margin: 2px 0; font-size: 14px; font-weight: 600;')}>{a}</p>
                ))}
              </div>
            )}
            <h2 style={css("font-family: 'Playfair Display', serif; font-size: 22px; margin: 0 0 14px;")}>Upcoming deliveries</h2>
            <div style={css('display: flex; flex-direction: column; gap: 10px;')}>
              {upcoming.map((o) => (
                <div key={o.id} style={css('background: #fff; border-radius: 16px; padding: 16px 18px; box-shadow: 0 3px 10px rgba(74,44,77,0.06); display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between;')}>
                  <div style={css('min-width: 90px;')}>
                    <p style={css('margin: 0; font-weight: 800; font-size: 15px;')}>{o.dateLabel}</p>
                    <p style={css('margin: 2px 0 0; font-size: 12px; color: #7a5f7d;')}>{o.id}</p>
                  </div>
                  <div style={css('flex: 1; min-width: 180px;')}>
                    <p style={css('margin: 0; font-weight: 700; font-size: 14.5px;')}>{o.productName} · {o.customer}</p>
                    <p style={css('margin: 2px 0 0; font-size: 12.5px; color: #7a5f7d;')}>{o.postcode} · {o.theme}</p>
                  </div>
                  <span style={css(`font-size: 12px; font-weight: 800; padding: 6px 12px; border-radius: 999px; background: ${o.statusBg}; color: ${o.statusColor};`)}>{o.status}</span>
                  <span style={css('font-weight: 800; font-size: 15px; color: #FF6F61;')}>{o.total}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'orders' && (
          <>
            <h1 style={css("font-family: 'Playfair Display', serif; font-size: 30px; margin: 0 0 4px;")}>Orders</h1>
            <p style={css('margin: 0 0 24px; color: #7a5f7d; font-size: 15px;')}>Order received → Materials purchased → In progress → Ready → Delivered</p>
            <div style={css('display: flex; flex-direction: column; gap: 12px;')}>
              {orderRows.map((o) => (
                <div key={o.id} style={css('background: #fff; border-radius: 16px; padding: 18px 20px; box-shadow: 0 3px 10px rgba(74,44,77,0.06); display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; align-items: center;')}>
                  <div>
                    <p style={css('margin: 0; font-weight: 800; font-size: 15px;')}>{o.customer}</p>
                    <p style={css('margin: 2px 0 0; font-size: 12.5px; color: #7a5f7d;')}>{o.id} · {o.phone}</p>
                  </div>
                  <div>
                    <p style={css('margin: 0; font-weight: 700; font-size: 14px;')}>{o.productName} ({o.sizeName})</p>
                    <p style={css('margin: 2px 0 0; font-size: 12.5px; color: #7a5f7d;')}>{o.theme}</p>
                  </div>
                  <div>
                    <p style={css('margin: 0; font-weight: 700; font-size: 14px;')}>{o.dateLabel}</p>
                    <p style={css('margin: 2px 0 0; font-size: 12.5px; color: #7a5f7d;')}>{o.address} {o.postcode}</p>
                  </div>
                  <div>
                    <p style={css('margin: 0; font-weight: 800; font-size: 15px; color: #FF6F61;')}>{o.total}</p>
                    <p style={css(`margin: 2px 0 0; font-size: 12.5px; color: ${o.profitColor}; font-weight: 700;`)}>profit {o.profit}</p>
                    <p style={css(`margin: 2px 0 0; font-size: 12px; color: ${o.paidColor}; font-weight: 700;`)}>{o.paidLabel}</p>
                  </div>
                  <select value={o.status} onChange={(e) => setStatus(o.id, e.target.value as OrderStatus)} style={css('border: 2px solid #F3C6C6; border-radius: 12px; padding: 10px 12px; font-size: 13.5px; font-weight: 700; background: #FBF7F2; min-height: 44px;')}>
                    {ORDER_STATUSES.map((st) => <option key={st}>{st}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'pricing' && (
          <>
            <h1 style={css("font-family: 'Playfair Display', serif; font-size: 30px; margin: 0 0 4px;")}>Costs &amp; pricing</h1>
            <p style={css('margin: 0 0 24px; color: #7a5f7d; font-size: 15px;')}>Change any cost here and every future quote updates automatically.</p>
            <div style={css('display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 28px;')}>
              <label style={css('background: #fff; border-radius: 16px; padding: 16px 18px; box-shadow: 0 3px 10px rgba(74,44,77,0.06); display: flex; flex-direction: column; gap: 8px; font-size: 12.5px; font-weight: 800; letter-spacing: 1px; color: #D4AF7A;')}>LABOUR RATE (£/HR)
                <input type="number" step="0.5" value={s.labourRate} onChange={(e) => setSetting('labourRate', parseFloat(e.target.value) || 0)} style={css('border: 2px solid #F3C6C6; border-radius: 12px; padding: 10px 12px; font-size: 17px; font-weight: 800; width: 110px; background: #FBF7F2;')} />
              </label>
              <label style={css('background: #fff; border-radius: 16px; padding: 16px 18px; box-shadow: 0 3px 10px rgba(74,44,77,0.06); display: flex; flex-direction: column; gap: 8px; font-size: 12.5px; font-weight: 800; letter-spacing: 1px; color: #D4AF7A;')}>MARKUP (%)
                <input type="number" step="5" value={s.markupPct} onChange={(e) => setSetting('markupPct', parseFloat(e.target.value) || 0)} style={css('border: 2px solid #F3C6C6; border-radius: 12px; padding: 10px 12px; font-size: 17px; font-weight: 800; width: 110px; background: #FBF7F2;')} />
              </label>
            </div>

            <h2 style={css("font-family: 'Playfair Display', serif; font-size: 22px; margin: 0 0 14px;")}>Materials</h2>
            <div style={css('background: #fff; border-radius: 18px; box-shadow: 0 3px 10px rgba(74,44,77,0.06); padding: 8px 18px; margin-bottom: 28px;')}>
              {store.materials.map((m, i) => {
                const low = m.stock != null && m.stock <= (m.lowAt ?? 0);
                return (
                  <div key={m.id} style={css('display: flex; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid #FBF7F2; flex-wrap: wrap;')}>
                    <span style={css('flex: 1; min-width: 180px; font-weight: 700; font-size: 14.5px;')}>{m.name}</span>
                    <span style={css('font-size: 12.5px; color: #7a5f7d; width: 70px;')}>per {m.unit}</span>
                    <span style={css('display: flex; align-items: center; gap: 4px; font-weight: 800;')}>£<input type="number" step="0.1" value={m.cost} onChange={(e) => patch((st) => { st.materials[i].cost = parseFloat(e.target.value) || 0; })} style={css('border: 2px solid #F3C6C6; border-radius: 10px; padding: 8px 10px; font-size: 15px; font-weight: 700; width: 76px; background: #FBF7F2;')} /></span>
                    <span style={css(`display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: ${low ? '#c14a3e' : '#7a5f7d'};`)}>stock
                      <input type="number" step="0.5" value={m.stock ?? 0} onChange={(e) => patch((st) => { st.materials[i].stock = parseFloat(e.target.value) || 0; })} style={css(`border: 2px solid ${low ? '#FF6F61' : '#F3C6C6'}; border-radius: 10px; padding: 8px 10px; font-size: 14px; font-weight: 700; width: 62px; background: #FBF7F2;`)} />
                    </span>
                  </div>
                );
              })}
            </div>

            <h2 style={css("font-family: 'Playfair Display', serif; font-size: 22px; margin: 0 0 14px;")}>Products — cost vs price vs profit</h2>
            <div style={css('display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 14px;')}>
              {store.products.map((p, i) => {
                const q = priceProduct(store, p, 1);
                return (
                  <div key={p.id} style={css('background: #fff; border-radius: 18px; padding: 20px; box-shadow: 0 3px 10px rgba(74,44,77,0.06);')}>
                    <p style={css('margin: 0 0 2px; font-weight: 800; font-size: 16px;')}>{p.name}</p>
                    <p style={css('margin: 0 0 12px; font-size: 12px; color: #7a5f7d;')}>{p.fill === 'helium' ? 'Helium-filled · same-day delivery only' : 'Air-filled · lasts 2–3 weeks'}</p>
                    <label style={css('display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; margin-bottom: 12px;')}>Build time (hrs)
                      <input type="number" step="0.25" value={p.buildHours} onChange={(e) => patch((st) => { st.products[i].buildHours = parseFloat(e.target.value) || 0; })} style={css('border: 2px solid #F3C6C6; border-radius: 10px; padding: 7px 10px; font-size: 14px; font-weight: 700; width: 64px; background: #FBF7F2;')} />
                    </label>
                    <div style={css('display: flex; justify-content: space-between; font-size: 13.5px; padding: 4px 0;')}><span style={css('color: #7a5f7d;')}>Materials</span><span style={css('font-weight: 700;')}>{gbp(q.materials)}</span></div>
                    <div style={css('display: flex; justify-content: space-between; font-size: 13.5px; padding: 4px 0;')}><span style={css('color: #7a5f7d;')}>Labour</span><span style={css('font-weight: 700;')}>{gbp(q.labour)}</span></div>
                    <div style={css('display: flex; justify-content: space-between; font-size: 13.5px; padding: 4px 0; border-top: 1px solid #FBF7F2;')}><span style={css('color: #7a5f7d;')}>Customer price</span><span style={css('font-weight: 800; color: #FF6F61;')}>{gbp(q.price)}</span></div>
                    <div style={css('display: flex; justify-content: space-between; font-size: 13.5px; padding: 4px 0;')}><span style={css('color: #7a5f7d;')}>Profit</span><span style={css('font-weight: 800; color: #3c7a3c;')}>{gbp(round2(q.price - q.cost))}</span></div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {tab === 'zones' && (
          <>
            <h1 style={css("font-family: 'Playfair Display', serif; font-size: 30px; margin: 0 0 4px;")}>Delivery zones</h1>
            <p style={css('margin: 0 0 24px; color: #7a5f7d; font-size: 15px;')}>Measured from your base between Huntingdon and Stilton. Postcodes outside all zones route to a custom enquiry.</p>
            <div style={css('display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;')}>
              {store.zones.map((z, i) => (
                <div key={z.id} style={css('background: #fff; border-radius: 16px; padding: 18px 20px; box-shadow: 0 3px 10px rgba(74,44,77,0.06); display: flex; flex-wrap: wrap; gap: 14px; align-items: center;')}>
                  <div style={css('min-width: 130px;')}>
                    <p style={css('margin: 0; font-weight: 800; font-size: 15.5px;')}>{z.name}</p>
                    <p style={css('margin: 2px 0 0; font-size: 12.5px; color: #7a5f7d;')}>{z.range}</p>
                  </div>
                  <p style={css('flex: 1; min-width: 200px; margin: 0; font-size: 13px; color: #7a5f7d;')}>{z.areas}<br /><span style={css('font-family: monospace; font-size: 11.5px;')}>{(z.districts || []).join(' · ')}</span></p>
                  <label style={css('display: flex; align-items: center; gap: 6px; font-weight: 800; font-size: 15px;')}>£<input type="number" step="1" value={z.fee ?? 0} onChange={(e) => patch((st) => { st.zones[i].fee = parseFloat(e.target.value) || 0; })} style={css('border: 2px solid #F3C6C6; border-radius: 10px; padding: 9px 11px; font-size: 15px; font-weight: 800; width: 70px; background: #FBF7F2;')} /></label>
                </div>
              ))}
            </div>
            <div style={css('background: #FBF7F2; border: 2px dashed #D4AF7A; border-radius: 16px; padding: 16px 20px; font-size: 13.5px; font-weight: 600; color: #7a5f7d;')}>Beyond 30 miles → &quot;quote on request&quot; (routed to you as an enquiry). Per-mile pricing (~£1/mile each way) coming in a later phase.</div>
          </>
        )}

        {tab === 'content' && (
          <>
            <h1 style={css("font-family: 'Playfair Display', serif; font-size: 30px; margin: 0 0 4px;")}>Site content</h1>
            <p style={css('margin: 0 0 24px; color: #7a5f7d; font-size: 15px;')}>Gallery, reviews and colour themes — changes appear on the website straight away.</p>

            <h2 style={css("font-family: 'Playfair Display', serif; font-size: 22px; margin: 0 0 14px;")}>Gallery</h2>
            <div style={css('display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px;')}>
              {store.gallery.map((g, i) => (
                <div key={g.id} style={css('background: #fff; border-radius: 16px; padding: 12px 16px; box-shadow: 0 3px 10px rgba(74,44,77,0.06); display: flex; flex-wrap: wrap; gap: 12px; align-items: center;')}>
                  <div style={{ ...css('width: 56px; height: 56px; border-radius: 12px; background-color: #F8EDE9; background-size: cover; background-position: center;'), backgroundImage: `url('${img(g.src)}')` }} />
                  <input value={g.title} onChange={(e) => patch((st) => { st.gallery[i].title = e.target.value; })} style={css('flex: 1; min-width: 160px; border: 2px solid #F3C6C6; border-radius: 10px; padding: 9px 12px; font-size: 14px; font-weight: 700; background: #FBF7F2;')} />
                  <select value={g.src} onChange={(e) => patch((st) => { st.gallery[i].src = e.target.value; })} style={css('border: 2px solid #F3C6C6; border-radius: 10px; padding: 9px 10px; font-size: 12.5px; background: #FBF7F2; max-width: 210px; min-height: 42px;')}>
                    {imageOptions.map((io) => <option key={io.value} value={io.value}>{io.label}</option>)}
                  </select>
                  <div style={css('display: flex; gap: 6px;')}>
                    <button onClick={() => patch((st) => { if (i > 0) [st.gallery[i - 1], st.gallery[i]] = [st.gallery[i], st.gallery[i - 1]]; })} title="Move up" style={css('cursor: pointer; border: none; background: #FBF7F2; border-radius: 10px; padding: 9px 12px; font-weight: 800; min-height: 40px;')}>↑</button>
                    <button onClick={() => patch((st) => { if (i < st.gallery.length - 1) [st.gallery[i + 1], st.gallery[i]] = [st.gallery[i], st.gallery[i + 1]]; })} title="Move down" style={css('cursor: pointer; border: none; background: #FBF7F2; border-radius: 10px; padding: 9px 12px; font-weight: 800; min-height: 40px;')}>↓</button>
                    <button onClick={() => patch((st) => { st.gallery.splice(i, 1); })} title="Remove" style={css('cursor: pointer; border: none; background: #FFE3DF; color: #c14a3e; border-radius: 10px; padding: 9px 12px; font-weight: 800; min-height: 40px;')}>✕</button>
                  </div>
                </div>
              ))}
            </div>
            <div style={css('display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 8px;')}>
              <button onClick={() => patch((st) => { st.gallery.push({ id: 'g' + Date.now(), title: 'New piece', src: (st.galleryImages || [])[0] || '' }); })} style={css("cursor: pointer; background: #4A2C4D; color: #fff; border: none; font-family: 'Nunito', sans-serif; font-weight: 800; font-size: 13.5px; padding: 11px 20px; border-radius: 999px; min-height: 44px;")}>+ Add gallery item</button>
              <button onClick={() => fileInput.current?.click()} style={css("cursor: pointer; background: #D4AF7A; color: #4A2C4D; border: none; font-family: 'Nunito', sans-serif; font-weight: 800; font-size: 13.5px; padding: 11px 20px; border-radius: 999px; min-height: 44px;")}>⬆ Upload photo</button>
              <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadPhoto(f); e.target.value = ''; }} />
              {!!uploadMsg && <span style={css('font-size: 12.5px; font-weight: 700; color: #7a5f7d;')}>{uploadMsg}</span>}
            </div>
            <p style={css('margin: 0 0 32px; font-size: 12.5px; color: #7a5f7d;')}>Upload real photos of your work (PNG/JPEG/WebP, up to 6&nbsp;MB) — they&apos;re stored securely and appear on the site straight away.</p>

            <h2 style={css("font-family: 'Playfair Display', serif; font-size: 22px; margin: 0 0 14px;")}>Customer reviews</h2>
            <div style={css('display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px;')}>
              {store.reviews.map((r, i) => (
                <div key={r.id} style={css('background: #fff; border-radius: 16px; padding: 14px 16px; box-shadow: 0 3px 10px rgba(74,44,77,0.06); display: flex; flex-wrap: wrap; gap: 10px; align-items: center;')}>
                  <input value={r.text} onChange={(e) => patch((st) => { st.reviews[i].text = e.target.value; })} placeholder="Review text" style={css('flex: 2 1 260px; border: 2px solid #F3C6C6; border-radius: 10px; padding: 9px 12px; font-size: 13.5px; background: #FBF7F2;')} />
                  <input value={r.name} onChange={(e) => patch((st) => { st.reviews[i].name = e.target.value; })} placeholder="Name" style={css('flex: 1 1 110px; border: 2px solid #F3C6C6; border-radius: 10px; padding: 9px 12px; font-size: 13.5px; font-weight: 700; background: #FBF7F2;')} />
                  <input value={r.event} onChange={(e) => patch((st) => { st.reviews[i].event = e.target.value; })} placeholder="Event, town" style={css('flex: 1 1 140px; border: 2px solid #F3C6C6; border-radius: 10px; padding: 9px 12px; font-size: 13.5px; background: #FBF7F2;')} />
                  <button onClick={() => patch((st) => { st.reviews.splice(i, 1); })} title="Remove" style={css('cursor: pointer; border: none; background: #FFE3DF; color: #c14a3e; border-radius: 10px; padding: 9px 12px; font-weight: 800; min-height: 40px;')}>✕</button>
                </div>
              ))}
            </div>
            <button onClick={() => patch((st) => { st.reviews.push({ id: 'r' + Date.now(), text: '', name: '', event: '' }); })} style={css("cursor: pointer; background: #4A2C4D; color: #fff; border: none; font-family: 'Nunito', sans-serif; font-weight: 800; font-size: 13.5px; padding: 11px 20px; border-radius: 999px; margin-bottom: 32px; min-height: 44px;")}>+ Add review</button>

            <h2 style={css("font-family: 'Playfair Display', serif; font-size: 22px; margin: 0 0 14px;")}>Colour themes (quote builder)</h2>
            <div style={css('display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 12px;')}>
              {store.themes.map((t, i) => (
                <span key={t} style={css('display: flex; align-items: center; gap: 8px; background: #fff; border: 2px solid #F3C6C6; border-radius: 999px; padding: 8px 8px 8px 16px; font-weight: 700; font-size: 13.5px;')}>{t}
                  <button onClick={() => patch((st) => { st.themes.splice(i, 1); })} title="Remove" style={css('cursor: pointer; border: none; background: #FFE3DF; color: #c14a3e; border-radius: 999px; width: 26px; height: 26px; font-weight: 800;')}>✕</button>
                </span>
              ))}
            </div>
            <div style={css('display: flex; gap: 10px; flex-wrap: wrap;')}>
              <input value={newTheme} onChange={(e) => setNewTheme(e.target.value)} placeholder="New theme, e.g. Silver & white" style={css('border: 2px solid #F3C6C6; border-radius: 12px; padding: 10px 14px; font-size: 14px; background: #FBF7F2; min-width: 220px;')} />
              <button onClick={() => { const t = newTheme.trim(); if (!t || store.themes.includes(t)) return; patch((st) => { st.themes.push(t); }); setNewTheme(''); }} style={css("cursor: pointer; background: #4A2C4D; color: #fff; border: none; font-family: 'Nunito', sans-serif; font-weight: 800; font-size: 13.5px; padding: 11px 20px; border-radius: 999px; min-height: 44px;")}>+ Add theme</button>
            </div>
          </>
        )}

        {tab === 'finance' && (
          <>
            <h1 style={css("font-family: 'Playfair Display', serif; font-size: 30px; margin: 0 0 4px;")}>Finance</h1>
            <p style={css('margin: 0 0 20px; color: #7a5f7d; font-size: 15px;')}>What you&apos;ve earned, what to set aside for the taxman, and what&apos;s safe to take out — each.</p>
            <label style={css('display: inline-flex; align-items: center; gap: 10px; background: #fff; border-radius: 999px; padding: 10px 18px; box-shadow: 0 3px 10px rgba(74,44,77,0.06); font-size: 13.5px; font-weight: 700; cursor: pointer; margin-bottom: 22px;')}>
              <input type="checkbox" checked={finPipeline} onChange={(e) => setFinPipeline(e.target.checked)} style={css('width: 18px; height: 18px; accent-color: #FF6F61;')} />
              Include upcoming booked orders (not just delivered)
            </label>

            <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; margin-bottom: 22px;')}>
              <div style={css('background: #fff; border-radius: 18px; padding: 20px; box-shadow: 0 4px 14px rgba(74,44,77,0.07);')}>
                <p style={css('margin: 0 0 6px; font-size: 12px; letter-spacing: 1.5px; font-weight: 800; color: #D4AF7A;')}>MONEY IN</p>
                <p style={css("margin: 0; font-family: 'Playfair Display', serif; font-size: 30px; font-weight: 700;")}>{gbp(round2(finRev))}</p>
                <p style={css('margin: 4px 0 0; font-size: 12.5px; color: #7a5f7d;')}>{finPipeline ? 'delivered + booked orders' : 'delivered orders only'}</p>
              </div>
              <div style={css('background: #fff; border-radius: 18px; padding: 20px; box-shadow: 0 4px 14px rgba(74,44,77,0.07);')}>
                <p style={css('margin: 0 0 6px; font-size: 12px; letter-spacing: 1.5px; font-weight: 800; color: #D4AF7A;')}>MATERIALS SPENT</p>
                <p style={css("margin: 0; font-family: 'Playfair Display', serif; font-size: 30px; font-weight: 700; color: #c14a3e;")}>{gbp(round2(finMat))}</p>
                <p style={css('margin: 4px 0 0; font-size: 12.5px; color: #7a5f7d;')}>your only deductible cost for now</p>
              </div>
              <div style={css('background: #4A2C4D; border-radius: 18px; padding: 20px; box-shadow: 0 4px 14px rgba(74,44,77,0.2);')}>
                <p style={css('margin: 0 0 6px; font-size: 12px; letter-spacing: 1.5px; font-weight: 800; color: #D4AF7A;')}>PROFIT BEFORE TAX</p>
                <p style={css("margin: 0; font-family: 'Playfair Display', serif; font-size: 30px; font-weight: 700; color: #FBF7F2;")}>{gbp(round2(finProfitN))}</p>
                <p style={css('margin: 4px 0 0; font-size: 12.5px; color: #F3C6C6;')}>split {splitPct + '/' + (100 - splitPct) + ' between Jade & Nicole'}</p>
              </div>
            </div>

            <div style={css('background: #FBF7F2; border: 2px dashed #D4AF7A; border-radius: 16px; padding: 16px 20px; margin-bottom: 22px; font-size: 13.5px; color: #7a5f7d; line-height: 1.55;')}>
              <strong style={css('color: #4A2C4D;')}>Why is this more than the &quot;profit&quot; on orders?</strong> Your build time isn&apos;t a business expense — as sole traders your labour is part of your profit, so HMRC taxes it. The pricing engine pays you for your time; the taxman just sees it all as earnings.
            </div>

            <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; margin-bottom: 26px;')}>
              {finPartners.map((p) => (
                <div key={p.name} style={css('background: #fff; border-radius: 18px; padding: 22px; box-shadow: 0 4px 14px rgba(74,44,77,0.07);')}>
                  <p style={css("margin: 0 0 14px; font-family: 'Playfair Display', serif; font-size: 21px; font-weight: 700;")}>{p.name}</p>
                  <div style={css('display: flex; justify-content: space-between; font-size: 14px; padding: 5px 0;')}><span style={css('color: #7a5f7d;')}>Share of profit</span><span style={css('font-weight: 700;')}>{p.share}</span></div>
                  <div style={css('display: flex; justify-content: space-between; font-size: 14px; padding: 5px 0;')}><span style={css('color: #7a5f7d;')}>Tax-free allowance used</span><span style={css('font-weight: 700;')}>{p.allowanceUsed}</span></div>
                  <div style={css('display: flex; justify-content: space-between; font-size: 14px; padding: 5px 0;')}><span style={css('color: #7a5f7d;')}>Income tax ({p.taxRate})</span><span style={css('font-weight: 700;')}>{p.tax}</span></div>
                  <div style={css('display: flex; justify-content: space-between; font-size: 14px; padding: 5px 0;')}><span style={css('color: #7a5f7d;')}>National Insurance ({p.niRate})</span><span style={css('font-weight: 700;')}>{p.ni}</span></div>
                  <div style={css('display: flex; justify-content: space-between; font-size: 14px; padding: 8px 0 5px; border-top: 1px solid #FBF7F2;')}><span style={css('font-weight: 800; color: #c14a3e;')}>Set aside for HMRC</span><span style={css('font-weight: 800; color: #c14a3e;')}>{p.setAside}</span></div>
                  <div style={css('margin-top: 12px; background: #F0F7F0; border-radius: 14px; padding: 14px 16px; display: flex; justify-content: space-between; align-items: baseline;')}>
                    <span style={css('font-weight: 800; font-size: 13px; color: #3c5a3c;')}>SAFE TO TAKE OUT</span>
                    <span style={css("font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 700; color: #3c7a3c;")}>{p.takeHome}</span>
                  </div>
                </div>
              ))}
            </div>

            <h2 style={css("font-family: 'Playfair Display', serif; font-size: 22px; margin: 0 0 14px;")}>Assumptions (edit to match your situation)</h2>
            <div style={css('background: #fff; border-radius: 18px; padding: 20px 22px; box-shadow: 0 3px 10px rgba(74,44,77,0.06); display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 14px;')}>
              <label style={css(labelCss)}>JADE&apos;S SHARE (%)
                <input type="number" min="0" max="100" value={splitPct} onChange={(e) => setSetting('splitPct', Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))} style={css(inputCss + ' width: 90px;')} />
              </label>
              <label style={css(labelCss)}>PERSONAL ALLOWANCE (£/YR EACH)
                <input type="number" step="10" value={allowance} onChange={(e) => setSetting('allowance', parseFloat(e.target.value) || 0)} style={css(inputCss + ' width: 120px;')} />
              </label>
              <label style={css(labelCss)}>INCOME TAX (%)
                <input type="number" step="1" value={taxRate} onChange={(e) => setSetting('taxRatePct', parseFloat(e.target.value) || 0)} style={css(inputCss + ' width: 90px;')} />
              </label>
              <label style={css(labelCss)}>CLASS 4 NI (%)
                <input type="number" step="1" value={niRate} onChange={(e) => setSetting('niRatePct', parseFloat(e.target.value) || 0)} style={css(inputCss + ' width: 90px;')} />
              </label>
            </div>
            <p style={css('margin: 0; font-size: 12.5px; color: #7a5f7d;')}>{allUnder ? 'You’re both under the personal allowance so far, so there’s nothing to set aside yet — lovely. ' : ''}These are planning estimates, not accountancy advice — the allowance is shared with any other income you each have (jobs, benefits), so do register as sole traders and check with HMRC or an accountant.</p>
          </>
        )}

        {tab === 'settings' && (
          <>
            <h1 style={css("font-family: 'Playfair Display', serif; font-size: 30px; margin: 0 0 24px;")}>Settings</h1>

            <div style={css('background: #fff; border-radius: 18px; padding: 22px; box-shadow: 0 3px 10px rgba(74,44,77,0.06); margin-bottom: 18px;')}>
              <h2 style={css("font-family: 'Playfair Display', serif; font-size: 20px; margin: 0 0 14px;")}>Bookings</h2>
              <div style={css('display: flex; gap: 20px; flex-wrap: wrap;')}>
                <label style={css(labelCss)}>MINIMUM NOTICE (DAYS)
                  <input type="number" value={s.leadDays} onChange={(e) => setSetting('leadDays', parseInt(e.target.value) || 0)} style={css(inputCss + ' width: 100px;')} />
                </label>
                <label style={css(labelCss)}>DEPOSIT TYPE
                  <select value={s.depositType} onChange={(e) => setSetting('depositType', e.target.value as DepositType)} style={css('border: 2px solid #F3C6C6; border-radius: 12px; padding: 10px 12px; font-size: 14.5px; font-weight: 700; background: #FBF7F2; min-height: 46px;')}>
                    <option value="full">Full payment upfront</option>
                    <option value="fixed">Fixed deposit (£)</option>
                    <option value="percent">Percentage deposit (%)</option>
                  </select>
                </label>
                <label style={css(labelCss)}>{s.depositType === 'fixed' ? 'DEPOSIT AMOUNT (£)' : 'DEPOSIT (%)'}
                  <input type="number" value={s.depositValue} onChange={(e) => setSetting('depositValue', parseFloat(e.target.value) || 0)} style={css(inputCss + ' width: 100px;')} />
                </label>
                <label style={css(labelCss)}>REFUNDABLE UNTIL (WORKING DAYS BEFORE)
                  <input type="number" value={s.refundDays} onChange={(e) => setSetting('refundDays', parseInt(e.target.value) || 0)} style={css(inputCss + ' width: 100px;')} />
                </label>
              </div>
            </div>

            <div style={css('background: #fff; border-radius: 18px; padding: 22px; box-shadow: 0 3px 10px rgba(74,44,77,0.06); margin-bottom: 18px;')}>
              <div style={css('display: flex; align-items: center; gap: 12px; margin-bottom: 6px;')}>
                <h2 style={css("font-family: 'Playfair Display', serif; font-size: 20px; margin: 0;")}>Payments — Stripe</h2>
                <span style={css(`font-size: 12px; font-weight: 800; padding: 5px 12px; border-radius: 999px; background: ${stripeConnected ? '#E4F0E4' : '#FFE3DF'}; color: ${stripeConnected ? '#3c7a3c' : '#c14a3e'};`)}>{stripeConnected ? 'Connected ✓' : 'Not connected'}</span>
              </div>
              <p style={css('margin: 0 0 16px; font-size: 13.5px; color: #7a5f7d;')}>Paste your keys from <span style={css('font-family: monospace;')}>dashboard.stripe.com → Developers → API keys</span>. Until connected, the site takes bookings as &quot;pay on confirmation&quot; enquiries.</p>
              <div style={css('display: flex; flex-direction: column; gap: 12px; max-width: 520px;')}>
                <label style={css(labelCss)}>PUBLISHABLE KEY
                  <input value={s.stripePublishable} onChange={(e) => setSetting('stripePublishable', e.target.value.trim())} placeholder="pk_live_..." style={css('border: 2px solid #F3C6C6; border-radius: 12px; padding: 10px 12px; font-size: 14px; font-family: monospace; background: #FBF7F2;')} />
                </label>
                <label style={css(labelCss)}>SECRET KEY
                  <input type="password" value={s.stripeSecret} onChange={(e) => setSetting('stripeSecret', e.target.value.trim())} placeholder="sk_live_..." style={css('border: 2px solid #F3C6C6; border-radius: 12px; padding: 10px 12px; font-size: 14px; font-family: monospace; background: #FBF7F2;')} />
                </label>
              </div>
            </div>

            <div style={css('background: #fff; border-radius: 18px; padding: 22px; box-shadow: 0 3px 10px rgba(74,44,77,0.06);')}>
              <h2 style={css("font-family: 'Playfair Display', serif; font-size: 20px; margin: 0 0 6px;")}>Social links</h2>
              <p style={css('margin: 0 0 16px; font-size: 13.5px; color: #7a5f7d;')}>Icons appear on the site automatically once a link is added — hidden while empty.</p>
              <div style={css('display: flex; flex-direction: column; gap: 12px; max-width: 520px;')}>
                <label style={css(labelCss)}>INSTAGRAM
                  <input value={s.instagram} onChange={(e) => setSetting('instagram', e.target.value.trim())} placeholder="https://instagram.com/jnballoons" style={css('border: 2px solid #F3C6C6; border-radius: 12px; padding: 10px 12px; font-size: 14px; background: #FBF7F2;')} />
                </label>
                <label style={css(labelCss)}>FACEBOOK
                  <input value={s.facebook} onChange={(e) => setSetting('facebook', e.target.value.trim())} placeholder="https://facebook.com/jnballoons" style={css('border: 2px solid #F3C6C6; border-radius: 12px; padding: 10px 12px; font-size: 14px; background: #FBF7F2;')} />
                </label>
                <label style={css(labelCss)}>TIKTOK
                  <input value={s.tiktok} onChange={(e) => setSetting('tiktok', e.target.value.trim())} placeholder="https://tiktok.com/@jnballoons" style={css('border: 2px solid #F3C6C6; border-radius: 12px; padding: 10px 12px; font-size: 14px; background: #FBF7F2;')} />
                </label>
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
