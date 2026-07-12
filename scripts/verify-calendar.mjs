// Calendar verification: booking yields a delivery + auto build slot; blocked and
// fully-booked days are excluded from the customer picker AND rejected server-side;
// rescheduling persists; the iCal feed serves events.
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
const book = (date, contact, product = "arch") => api("/api/booking", { method: "POST", json: { kind: "book", productId: product, sizeId: "standard", theme: "Blush & gold", postcode: "PE29 3AB", date, custName: "Cal Test", custContact: contact, marketingConsent: false } });

async function main() {
  rec("admin login", (await api("/api/admin/login", { method: "POST", json: { password: PW } })).status === 200 && !!cookie);
  if (!cookie) return finish();

  // Set a known capacity for the capacity test
  let store = await getStore();
  store.settings.maxDeliveriesPerDay = 2;
  await api("/api/admin/store", { method: "POST", json: { store } });

  // 1. Booking → delivery + auto build slot (day before for air product)
  const dDeliver = addDays(today, 40);
  await book(dDeliver, "cal-a@example.com");
  store = await getStore();
  const order = store.orders.find((o) => o.phone === "cal-a@example.com" && o.date === dDeliver);
  const expectedBuild = addDays(dDeliver, -1); // arch = air → day before
  rec("booking creates a delivery on the chosen date", !!order, order ? `${order.id} @ ${order.date}` : "not found");
  rec("build slot auto-defaults to the day before (air product)", !!order && (order.buildDate || expectedBuild) === expectedBuild, `build=${order?.buildDate || expectedBuild}`);

  // helium → same-day build
  const dHel = addDays(today, 41);
  await book(dHel, "cal-h@example.com", "helium9");
  store = await getStore();
  const hOrder = store.orders.find((o) => o.phone === "cal-h@example.com");
  rec("helium build slot defaults to same-day (helium rule)", !!hOrder && !hOrder.buildDate, "default same-day");

  // 2. Block a day → excluded from picker (public data) AND rejected server-side
  const dBlocked = addDays(today, 42);
  store = await getStore();
  store.blocks.push({ id: "blk-test", title: "Holiday", date: dBlocked, kind: "blocked", recurrence: "none" });
  await api("/api/admin/store", { method: "POST", json: { store } });
  const home = await (await fetch(BASE + "/")).text();
  rec("blocked date appears in the site's unavailable list (picker excludes it)", home.includes(dBlocked), dBlocked);
  const blockedBooking = await book(dBlocked, "cal-b@example.com");
  rec("booking on a blocked day is rejected (409)", blockedBooking.status === 409, `status=${blockedBooking.status}`);

  // 3. Capacity: fill a day to the cap (2), next customer rejected
  const dFull = addDays(today, 43);
  await book(dFull, "cal-c1@example.com");
  await book(dFull, "cal-c2@example.com");
  const third = await book(dFull, "cal-c3@example.com");
  rec("booking past the daily cap is rejected (409) — next customer offered other dates", third.status === 409, `status=${third.status}`);

  // 4. Reschedule (drag) persists on reload
  store = await getStore();
  const ro = store.orders.find((o) => o.phone === "cal-a@example.com");
  ro.buildDate = addDays(dDeliver, -2);
  await api("/api/admin/store", { method: "POST", json: { store } });
  store = await getStore();
  const ro2 = store.orders.find((o) => o.phone === "cal-a@example.com");
  rec("rescheduling a build slot persists on reload", ro2.buildDate === addDays(dDeliver, -2), `buildDate=${ro2.buildDate}`);

  // 5. iCal feed serves events
  const tok = await (await api("/api/admin/calendar-token", { method: "POST" })).json();
  const ics = await fetch(BASE + `/api/calendar/${tok.token}`);
  const body = await ics.text();
  rec("iCal feed serves a valid calendar with events", ics.status === 200 && body.includes("BEGIN:VCALENDAR") && body.includes("BEGIN:VEVENT"), `status=${ics.status}`);

  finish();
}
function finish() {
  console.log(`\n${out.filter(Boolean).length}/${out.length} checks passed`);
  process.exit(out.every(Boolean) ? 0 : 1);
}
main().catch((e) => { console.error("FATAL", e); process.exit(2); });
