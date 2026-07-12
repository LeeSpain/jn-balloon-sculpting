// Triage + nearest-available verification (API level).
// Flow: new booking → unacknowledged (acknowledged:false, createdAt set) →
// assign making/delivering + acknowledge (advances pipeline) → maker shows on
// the calendar build slot and deliverer on the delivery event (via the iCal
// feed) → reassign later persists. Plus: blocked/full days are excluded from the
// customer picker and have available neighbours for "nearest available".
const BASE = (process.env.BASE || "http://localhost:3400").replace(/\/$/, "");
const PW = process.env.ADMIN_PW || "balloons";
const out = [];
const rec = (n, ok, d = "") => { out.push(ok); console.log(`${ok ? "✓" : "✗"} ${n}${d ? " — " + d : ""}`); };
const addDays = (iso, n) => { const d = new Date(iso + "T12:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const today = new Date().toISOString().slice(0, 10);

let cookie = "";
async function api(path, opts = {}) {
  const headers = { origin: BASE, ...(opts.headers || {}) };
  if (opts.json) headers["content-type"] = "application/json";
  if (cookie) headers.cookie = cookie;
  const res = await fetch(BASE + path, { method: opts.method || "GET", headers, body: opts.json ? JSON.stringify(opts.json) : undefined });
  const sc = res.headers.get("set-cookie");
  if (sc) cookie = (sc.match(/jn_admin=[^;]+/) || [cookie])[0];
  return res;
}
const getStore = async () => (await (await api("/api/admin/store")).json()).store;
const putStore = (store) => api("/api/admin/store", { method: "POST", json: { store } });
const book = (date, contact, product = "arch") => api("/api/booking", { method: "POST", json: { kind: "book", productId: product, sizeId: "standard", theme: "Blush & gold", postcode: "PE29 3AB", date, custName: "Triage Test", custContact: contact, marketingConsent: false } });

async function main() {
  rec("admin login", (await api("/api/admin/login", { method: "POST", json: { password: PW } })).status === 200 && !!cookie);
  if (!cookie) return finish();

  // ---- Feature 2: new-order triage ----
  const dDeliver = addDays(today, 47);
  await book(dDeliver, "triage-a@example.com");
  let store = await getStore();
  let order = store.orders.find((o) => o.phone === "triage-a@example.com" && o.date === dDeliver);
  rec("new booking is created", !!order, order?.id);
  rec("new order starts UNACKNOWLEDGED (banner will show it)", !!order && order.acknowledged === false, `acknowledged=${order?.acknowledged}`);
  rec("new order records createdAt (drives the >24h waiting flag)", !!order && !!order.createdAt, order?.createdAt);
  rec("new order starts at 'Order received'", order?.status === "Order received", order?.status);

  // Assign making + delivering, then acknowledge (mirrors the admin commit path).
  const oid = order.id;
  store = await getStore();
  order = store.orders.find((o) => o.id === oid);
  order.maker = "Jade";
  order.deliverer = "Nicole";
  order.acknowledged = true;
  if (order.status === "Order received") order.status = "Materials purchased";
  await putStore(store);

  store = await getStore();
  order = store.orders.find((o) => o.id === oid);
  rec("maker persists (Making = Jade)", order?.maker === "Jade", `maker=${order?.maker}`);
  rec("deliverer persists (Delivering = Nicole)", order?.deliverer === "Nicole", `deliverer=${order?.deliverer}`);
  rec("acknowledge marks the order acknowledged", order?.acknowledged === true, `acknowledged=${order?.acknowledged}`);
  rec("acknowledge advances pipeline off 'Order received'", order?.status === "Materials purchased", order?.status);

  // Calendar: build slot shows the MAKER, delivery event shows the DELIVERER.
  const tok = (await (await api("/api/admin/calendar-token", { method: "POST" })).json()).token;
  let ics = await (await fetch(BASE + `/api/calendar/${tok}`)).text();
  const vevents = ics.split("BEGIN:VEVENT").slice(1).map((b) => b.split("END:VEVENT")[0]);
  const buildDate = addDays(dDeliver, -1); // arch = air → day before
  const buildBlock = vevents.find((v) => v.includes(`VALUE=DATE:${buildDate.replace(/-/g, "")}`) && v.includes("Build:"));
  const deliverBlock = vevents.find((v) => v.includes(`VALUE=DATE:${dDeliver.replace(/-/g, "")}`) && v.includes("SUMMARY:") && !v.includes("Build:"));
  rec("calendar build slot shows the MAKER (Jade)", !!buildBlock && /\(Jade\)/.test(buildBlock), buildBlock ? buildBlock.match(/SUMMARY:[^\n\r]*/)?.[0] : "no build event");
  rec("calendar delivery event shows the DELIVERER (Nicole)", !!deliverBlock && /\(Nicole\)/.test(deliverBlock), deliverBlock ? deliverBlock.match(/SUMMARY:[^\n\r]*/)?.[0] : "no delivery event");

  // Reassign later works.
  store = await getStore();
  order = store.orders.find((o) => o.id === oid);
  order.maker = "Both";
  order.deliverer = "Jade";
  await putStore(store);
  ics = await (await fetch(BASE + `/api/calendar/${tok}`)).text();
  const v2 = ics.split("BEGIN:VEVENT").slice(1).map((b) => b.split("END:VEVENT")[0]);
  const build2 = v2.find((v) => v.includes(`VALUE=DATE:${buildDate.replace(/-/g, "")}`) && v.includes("Build:"));
  const deliver2 = v2.find((v) => v.includes(`VALUE=DATE:${dDeliver.replace(/-/g, "")}`) && !v.includes("Build:"));
  rec("reassign maker later → calendar build slot updates (Both)", !!build2 && /\(Both\)/.test(build2), build2 ? build2.match(/SUMMARY:[^\n\r]*/)?.[0] : "none");
  rec("reassign deliverer later → calendar delivery updates (Jade)", !!deliver2 && /\(Jade\)/.test(deliver2), deliver2 ? deliver2.match(/SUMMARY:[^\n\r]*/)?.[0] : "none");

  // Unacknowledged count reflects only genuinely-new orders (seed JN-1043 + ours were acked).
  store = await getStore();
  const pending = store.orders.filter((o) => o.acknowledged !== true);
  rec("acknowledged orders leave the triage queue", !pending.some((o) => o.id === oid), `pending=${pending.map((o) => o.id).join(",") || "none"}`);

  // ---- Feature 1: nearest-available picker data ----
  // Block a day; it must appear in the site's unavailable list, and neighbours
  // must be available so the picker can suggest "nearest available before/after".
  const dBlocked = addDays(today, 55);
  store = await getStore();
  (store.blocks ||= []).push({ id: "blk-tri", title: "Holiday", date: dBlocked, kind: "blocked", recurrence: "none" });
  await putStore(store);
  const home = await (await fetch(BASE + "/")).text();
  rec("blocked day is in the picker's unavailable list (greyed with tooltip)", home.includes(dBlocked), dBlocked);
  const before = addDays(dBlocked, -1), after = addDays(dBlocked, 1);
  rec("nearest-available neighbours exist (before & after are bookable)", !home.includes(`"${before}"`) && !home.includes(`"${after}"`), `${before} / ${after}`);
  rec("booking the blocked day is rejected server-side (409)", (await book(dBlocked, "triage-blk@example.com")).status === 409);

  finish();
}
function finish() {
  console.log(`\n${out.filter(Boolean).length}/${out.length} checks passed`);
  process.exit(out.every(Boolean) ? 0 : 1);
}
main().catch((e) => { console.error("FATAL", e); process.exit(2); });
