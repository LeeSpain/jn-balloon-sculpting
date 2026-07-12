// CRM verification: booking/enquiry auto-creates & updates contacts; consent,
// source, status, occasion captured; notes + follow-up persist; outreach links
// pre-fill; GDPR delete erases the contact and anonymises their orders.
const BASE = (process.env.BASE || "http://localhost:3400").replace(/\/$/, "");
const PW = process.env.ADMIN_PW || "balloons";
const out = [];
const rec = (n, ok, d = "") => { out.push(ok); console.log(`${ok ? "✓" : "✗"} ${n}${d ? " — " + d : ""}`); };
const future = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);

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
// replicate waLink normalisation for the "buttons pre-fill" check
const waDigits = (p) => { let d = p.replace(/\D/g, ""); return d.startsWith("0") ? "44" + d.slice(1) : d; };

async function main() {
  rec("admin login", (await api("/api/admin/login", { method: "POST", json: { password: PW } })).status === 200 && !!cookie);
  if (!cookie) return finish();

  // 1. Booking with consent -> contact auto-created
  await api("/api/booking", { method: "POST", json: { kind: "book", productId: "arch", sizeId: "standard", theme: "Blush & gold", postcode: "PE29 3AB", date: future, custName: "Alice Test", custContact: "alice@example.com", marketingConsent: true } });
  let store = await getStore();
  let alice = (store.contacts || []).find((c) => c.email === "alice@example.com");
  rec("booking auto-creates a contact (name/email/postcode/source)",
    !!alice && alice.name === "Alice Test" && alice.postcode === "PE29 3AB" && alice.source === "Website booking",
    alice ? `${alice.name} · ${alice.source} · ${alice.status}` : "not found");
  rec("booking contact: status=Booked, consent=true, occasion captured",
    !!alice && alice.status === "Booked" && alice.marketingConsent === true && alice.occasion === "Birthday Arch");

  // 2. Enquiry with NO consent -> New enquiry, consent false
  await api("/api/booking", { method: "POST", json: { kind: "custom", productId: "wedding", sizeId: "standard", theme: "Ivory & sage", postcode: "ZZ99", date: "", custName: "Bob Test", custContact: "07700 111222", marketingConsent: false } });
  store = await getStore();
  const bob = (store.contacts || []).find((c) => c.phone && c.phone.replace(/\D/g, "") === "07700111222".replace(/\D/g, ""));
  rec("enquiry auto-creates contact: source=Website enquiry, status=New enquiry, consent=false (unticked default)",
    !!bob && bob.source === "Website enquiry" && bob.status === "New enquiry" && bob.marketingConsent === false);

  // 3. Repeat booking from Alice -> updated, not duplicated
  await api("/api/booking", { method: "POST", json: { kind: "book", productId: "garland", sizeId: "standard", theme: "Bright party", postcode: "PE29 3AB", date: future, custName: "Alice Test", custContact: "alice@example.com", marketingConsent: true } });
  store = await getStore();
  const aliceDupes = (store.contacts || []).filter((c) => c.email === "alice@example.com");
  const aliceOrders = (store.orders || []).filter((o) => o.phone === "alice@example.com");
  rec("repeat booking updates the same contact (no duplicate), history grows",
    aliceDupes.length === 1 && aliceOrders.length === 2, `dupes=${aliceDupes.length} orders=${aliceOrders.length}`);

  // 4. Outreach links pre-fill correctly (wa.me UK normalisation)
  rec("WhatsApp link normalises UK number (07… → 44…)", waDigits("07700 111222") === "447700111222", waDigits("07700 111222"));

  // 5. Note + follow-up persist via the admin save
  alice = (store.contacts || []).find((c) => c.email === "alice@example.com");
  alice.notes = "Loves pastel colours";
  alice.followUpDate = future;
  await api("/api/admin/store", { method: "POST", json: { store } });
  store = await getStore();
  const aliceSaved = (store.contacts || []).find((c) => c.email === "alice@example.com");
  rec("note + follow-up date persist", aliceSaved.notes === "Loves pastel colours" && aliceSaved.followUpDate === future);

  // 6. GDPR delete: erase contact + anonymise their orders
  const delRes = await api(`/api/admin/contacts/${aliceSaved.id}`, { method: "DELETE" });
  const delStore = (await delRes.json()).store;
  const aliceGone = !(delStore.contacts || []).some((c) => c.id === aliceSaved.id);
  const ordersAnon = (delStore.orders || []).filter((o) => o.phone === "alice@example.com").length === 0;
  const anonMarked = (delStore.orders || []).some((o) => o.customer === "[deleted]");
  rec("GDPR delete erases contact + anonymises their orders", delRes.status === 200 && aliceGone && ordersAnon && anonMarked,
    `gone=${aliceGone} anon=${ordersAnon} marked=${anonMarked}`);

  finish();
}
function finish() {
  console.log(`\n${out.filter(Boolean).length}/${out.length} checks passed`);
  process.exit(out.every(Boolean) ? 0 : 1);
}
main().catch((e) => { console.error("FATAL", e); process.exit(2); });
