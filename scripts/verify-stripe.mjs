// Local verification of admin-managed Stripe config + webhook.
// No real Stripe keys needed: encryption, masking, key precedence and webhook
// signature verification are all exercisable offline. (test-connection PASS and a
// full Checkout need real test keys — that's the live step in the runbook.)
//
// Run the app with: SESSION_SECRET set, no STRIPE_SECRET_KEY, and a DIFFERENT
// env webhook secret so we can prove DB keys take precedence. See the invocation
// in the shell command that runs this file.
import { createHmac } from "node:crypto";

const BASE = (process.env.BASE || "http://localhost:3400").replace(/\/$/, "");
const PW = process.env.ADMIN_PW || "balloons";
const DB_WHSEC = "whsec_DBSECRET_local_123";
const ENV_WHSEC = process.env.STRIPE_WEBHOOK_SECRET || "whsec_ENVFALLBACK_999";
const out = [];
const rec = (n, ok, d = "") => { out.push(ok); console.log(`${ok ? "✓" : "✗"} ${n}${d ? " — " + d : ""}`); };
const round2 = (n) => Math.round(n * 100) / 100;
const depositFor = (s, t) => (s.depositType === "full" ? t : s.depositType === "fixed" ? Math.min(s.depositValue, t) : round2((t * s.depositValue) / 100));

let cookie = "";
async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (opts.json) headers["content-type"] = "application/json";
  headers["origin"] = BASE;
  if (cookie) headers["cookie"] = cookie;
  const res = await fetch(BASE + path, { method: opts.method || "GET", headers, body: opts.json ? JSON.stringify(opts.json) : opts.body });
  const setc = res.headers.get("set-cookie");
  if (setc) cookie = (setc.match(/jn_admin=[^;]+/) || [cookie])[0];
  return res;
}
const sign = (payload, secret, ts) => `t=${ts},v1=${createHmac("sha256", secret).update(`${ts}.${payload}`).digest("hex")}`;

async function main() {
  // deposit-match (pure)
  rec("deposit=full → full total", depositFor({ depositType: "full" }, 80) === 80);
  rec("deposit=fixed £20 → £20", depositFor({ depositType: "fixed", depositValue: 20 }, 80) === 20);
  rec("deposit=percent 25% → £20", depositFor({ depositType: "percent", depositValue: 25 }, 80) === 20);

  const login = await api("/api/admin/login", { method: "POST", json: { password: PW } });
  rec("admin login", login.status === 200 && !!cookie);
  if (!cookie) return finish();

  // Save DB keys (secret + webhook signing secret) via the admin API
  const put = await api("/api/admin/stripe", { method: "PUT", json: { publishable: "pk_test_local", secret: "sk_test_localdummy", webhookSecret: DB_WHSEC } });
  const st = await put.json();
  rec("save keys via API", put.status === 200 && st.secretSet && st.webhookSet, `mode=${st.mode} last4=${st.secretLast4}`);

  // Secrets must NOT be returned — only masked last4
  rec("secret value never returned to client (masked only)",
    !JSON.stringify(st).includes("sk_test_localdummy") && !JSON.stringify(st).includes(DB_WHSEC) && st.secretLast4 === "ummy",
    `last4=${st.secretLast4}`);

  // Sanitised store read must not leak the encrypted secret either
  const storeRes = await api("/api/admin/store");
  const store = (await storeRes.json()).store;
  rec("sanitised store read excludes secrets",
    store.settings.stripeSecret === "" && store.settings.stripeWebhookSecret === "" && store.settings.stripePublishable === "pk_test_local");

  // Key validation
  const bad = await api("/api/admin/stripe", { method: "PUT", json: { secret: "not-a-key" } });
  rec("rejects malformed secret key (must be sk_)", bad.status === 400);

  // Test-connection with a dummy key → not connected (fail path; PASS needs a real key)
  const test = await api("/api/admin/stripe/test", { method: "POST" });
  const tj = await test.json();
  rec("test-connection fail path reports not-connected", test.status === 200 && tj.connected === false, tj.error?.slice(0, 40));

  // Toggle is gated: cannot turn on card payments while not connected
  const toggle = await api("/api/admin/stripe/accept", { method: "PUT", json: { accept: true } });
  rec("accept-payments toggle blocked until connected", toggle.status === 400);

  // Webhook uses the DB signing secret with precedence over the (different) env one.
  // Seed an awaiting-payment order, then fire a checkout.session.completed.
  const order = { ...store.orders[0], id: "JN-9001", price: 70, delivery: 5, depositPaid: 0, awaitingPayment: true, status: "Order received" };
  store.orders = [order, ...store.orders.filter((o) => o.id !== "JN-9001")];
  await api("/api/admin/store", { method: "POST", json: { store } });

  const deposit = depositFor(store.settings, 75);
  const event = JSON.stringify({ id: "evt1", type: "checkout.session.completed", data: { object: { metadata: { orderId: "JN-9001" }, amount_total: Math.round(deposit * 100) } } });
  const ts = Math.floor(Date.now() / 1000);

  const okHook = await api("/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": sign(event, DB_WHSEC, ts), "content-type": "application/json" }, body: event });
  rec("webhook accepts a payload signed with the DB signing secret", okHook.status === 200);

  const envHook = await api("/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": sign(event, ENV_WHSEC, ts), "content-type": "application/json" }, body: event });
  rec("webhook REJECTS the (different) env signing secret — DB key takes precedence", envHook.status === 400, `env-signed status=${envHook.status}`);

  const after = (await (await api("/api/admin/store")).json()).store;
  const o = after.orders.find((x) => x.id === "JN-9001");
  rec("webhook (DB secret) records paid + clears awaitingPayment", !!o && o.depositPaid === deposit && o.awaitingPayment === false, o ? `paid £${o.depositPaid}` : "missing");

  finish();
}
function finish() {
  console.log(`\n${out.filter(Boolean).length}/${out.length} checks passed`);
  process.exit(out.every(Boolean) ? 0 : 1);
}
main().catch((e) => { console.error("FATAL", e); process.exit(2); });
