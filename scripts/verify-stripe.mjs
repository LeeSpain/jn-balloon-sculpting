// Local verification of the Stripe webhook + deposit logic (no real Stripe keys
// needed: constructEvent verifies the HMAC signature offline).
//   1. deposit amount == admin's configured deposit setting (full/fixed/percent)
//   2. a signed checkout.session.completed marks the order paid with that amount
//      and clears awaitingPayment.
// Requires the app running with STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET set.
import { createHmac } from "node:crypto";

const BASE = (process.env.BASE || "http://localhost:3400").replace(/\/$/, "");
const PW = process.env.ADMIN_PW || "balloons";
const WHSEC = process.env.STRIPE_WEBHOOK_SECRET || "whsec_localtest";
const out = [];
const rec = (n, ok, d = "") => { out.push(ok); console.log(`${ok ? "✓" : "✗"} ${n}${d ? " — " + d : ""}`); };

const round2 = (n) => Math.round(n * 100) / 100;
function depositFor(settings, total) {
  if (settings.depositType === "full") return total;
  if (settings.depositType === "fixed") return Math.min(settings.depositValue, total);
  return round2((total * settings.depositValue) / 100);
}

// 1. deposit matches configured setting (pure logic)
{
  const t = 80;
  rec("deposit=full → charges the full total", depositFor({ depositType: "full" }, t) === 80, "£80 of £80");
  rec("deposit=fixed £20 → charges £20", depositFor({ depositType: "fixed", depositValue: 20 }, t) === 20, "£20 of £80");
  rec("deposit=percent 25% → charges £20", depositFor({ depositType: "percent", depositValue: 25 }, t) === 20, "25% of £80");
}

let cookie = "";
async function login() {
  const r = await fetch(`${BASE}/api/admin/login`, {
    method: "POST", headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ password: PW }),
  });
  const setc = r.headers.get("set-cookie");
  if (setc) cookie = (setc.match(/jn_admin=[^;]+/) || [])[0] || "";
  return r.status === 200 && !!cookie;
}

function stripeSignature(payload, secret, ts) {
  const v1 = createHmac("sha256", secret).update(`${ts}.${payload}`).digest("hex");
  return `t=${ts},v1=${v1}`;
}

async function main() {
  rec("admin login", await login());
  if (!cookie) return finish();

  // Seed an order awaiting payment (clone a real one for schema validity)
  const store = (await (await fetch(`${BASE}/api/admin/store`, { headers: { cookie } })).json()).store;
  const base = structuredClone(store.orders[0]);
  const order = { ...base, id: "JN-9001", price: 70, delivery: 5, depositPaid: 0, awaitingPayment: true, status: "Order received" };
  store.orders = [order, ...store.orders.filter((o) => o.id !== "JN-9001")];
  const put = await fetch(`${BASE}/api/admin/store`, {
    method: "POST", headers: { "content-type": "application/json", origin: BASE, cookie },
    body: JSON.stringify({ store }),
  });
  rec("seed awaiting-payment order (JN-9001)", put.status === 200);

  const total = order.price + order.delivery;
  const deposit = depositFor(store.settings, total);
  const amountTotal = Math.round(deposit * 100);

  // Fire a signed checkout.session.completed
  const event = {
    id: "evt_test_1", type: "checkout.session.completed",
    data: { object: { id: "cs_test_1", metadata: { orderId: "JN-9001" }, amount_total: amountTotal } },
  };
  const payload = JSON.stringify(event);
  const ts = Math.floor(Date.now() / 1000);
  const whRes = await fetch(`${BASE}/api/stripe/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": stripeSignature(payload, WHSEC, ts) },
    body: payload,
  });
  const whJson = await whRes.json().catch(() => ({}));
  rec("webhook accepts a validly-signed event", whRes.status === 200 && whJson.received === true, JSON.stringify(whJson));

  // Confirm the order is now paid with the exact deposit
  const after = (await (await fetch(`${BASE}/api/admin/store`, { headers: { cookie } })).json()).store;
  const o = after.orders.find((x) => x.id === "JN-9001");
  rec("webhook records paid status + deposit, clears awaitingPayment",
    !!o && o.depositPaid === deposit && o.awaitingPayment === false,
    o ? `depositPaid=£${o.depositPaid} (expected £${deposit}) awaitingPayment=${o.awaitingPayment}` : "order missing");

  // A bad signature must be rejected
  const badRes = await fetch(`${BASE}/api/stripe/webhook`, {
    method: "POST", headers: { "content-type": "application/json", "stripe-signature": `t=${ts},v1=deadbeef` }, body: payload,
  });
  rec("webhook rejects an invalid signature", badRes.status === 400, `status=${badRes.status}`);

  finish();
}

function finish() {
  console.log(`\n${out.filter(Boolean).length}/${out.length} checks passed`);
  process.exit(out.every(Boolean) ? 0 : 1);
}
main().catch((e) => { console.error("FATAL", e); process.exit(2); });
