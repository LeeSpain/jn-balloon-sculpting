// Booking contact-fields (name/email/mobile required + validated) + notes.
const BASE = process.env.BASE || "http://localhost:3450";
const out = []; const rec = (n, ok, d = "") => { out.push(ok); console.log(`${ok ? "✓" : "✗"} ${n}${d ? " — " + d : ""}`); };
const addDays = (iso, n) => { const d = new Date(iso + "T12:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const today = new Date().toISOString().slice(0, 10);
let cookie = "";
async function api(path, opts = {}) { const h = { origin: BASE, ...(opts.headers || {}) }; if (opts.json) h["content-type"] = "application/json"; if (cookie) h.cookie = cookie; const r = await fetch(BASE + path, { method: opts.method || "GET", headers: h, body: opts.json ? JSON.stringify(opts.json) : undefined }); const sc = r.headers.get("set-cookie"); if (sc) cookie = (sc.match(/jn_admin=[^;]+/) || [cookie])[0]; return r; }
const getStore = async () => (await (await api("/api/admin/store")).json()).store;
const book = (over = {}, ip = "20.0.0.1") => api("/api/booking", { method: "POST", headers: { "x-forwarded-for": ip }, json: { kind: "book", productId: "arch", sizeId: "standard", theme: "Blush & gold", postcode: "PE29 3AB", date: addDays(today, 50), custName: "Field Test", custEmail: "field@example.com", custMobile: "07700900123", notes: "", marketingConsent: false, ...over } });

async function main() {
  await api("/api/admin/login", { method: "POST", json: { password: "balloons" } });

  // 1. Valid booking with all fields + notes
  let r = await book({ custEmail: "ada@example.com", custMobile: "07700 900456", notes: "Pastel pinks please; ring on arrival." }, "20.0.0.2");
  rec("valid booking accepted", r.status === 200, `status=${r.status}`);
  let store = await getStore();
  let o = store.orders.find((x) => x.email === "ada@example.com");
  rec("order stores email", !!o && o.email === "ada@example.com");
  rec("order stores mobile normalised to 07…", !!o && o.phone === "07700900456", `phone=${o?.phone}`);
  rec("order stores notes", !!o && /Pastel pinks/.test(o.notes || ""), o?.notes);

  // 2. Validation
  rec("missing name → 400", (await book({ custName: "" }, "20.0.0.3")).status === 400);
  rec("invalid email → 400", (await book({ custEmail: "nope" }, "20.0.0.4")).status === 400);
  rec("landline mobile → 400", (await book({ custMobile: "01480 123456" }, "20.0.0.5")).status === 400);
  rec("too-short mobile → 400", (await book({ custMobile: "0770012" }, "20.0.0.6")).status === 400);

  // 3. International format normalises
  r = await book({ custEmail: "intl@example.com", custMobile: "+44 7700 900999", date: addDays(today, 51) }, "20.0.0.7");
  store = await getStore(); o = store.orders.find((x) => x.email === "intl@example.com");
  rec("+44 mobile normalises to 07…", !!o && o.phone === "07700900999", `phone=${o?.phone}`);

  // 4. Notes cap (>500 truncated) + control-char sanitise
  const big = "A".repeat(600);
  const dirty = "clean" + String.fromCharCode(0) + String.fromCharCode(7) + "end";
  r = await book({ custEmail: "big@example.com", notes: big + " tail", date: addDays(today, 52) }, "20.0.0.8");
  store = await getStore(); o = store.orders.find((x) => x.email === "big@example.com");
  rec("notes capped at 500 chars", !!o && (o.notes || "").length <= 500, `len=${o?.notes?.length}`);
  r = await book({ custEmail: "ctrl@example.com", notes: dirty, date: addDays(today, 53) }, "20.0.0.9");
  store = await getStore(); o = store.orders.find((x) => x.email === "ctrl@example.com");
  rec("control characters stripped from notes", !!o && !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(o.notes || ""), JSON.stringify(o?.notes));

  // 5. CRM contact gets both email + phone, and the note appended
  const c = (store.contacts || []).find((x) => x.email === "ada@example.com");
  rec("CRM contact captures email AND mobile", !!c && c.email === "ada@example.com" && c.phone === "07700900456", `${c?.email}/${c?.phone}`);
  rec("customer note appended to CRM contact history", !!c && /Pastel pinks/.test(c.notes || ""));

  // 6. iCal still serves delivery events
  const tok = (await (await api("/api/admin/calendar-token", { method: "POST" })).json()).token;
  const ics = await (await fetch(BASE + `/api/calendar/${tok}`)).text();
  rec("calendar feed still serves delivery events", ics.includes("BEGIN:VEVENT"));

  console.log(`\n${out.filter(Boolean).length}/${out.length} checks passed`);
  process.exit(out.every(Boolean) ? 0 : 1);
}
main().catch((e) => { console.error("FATAL", e); process.exit(2); });
