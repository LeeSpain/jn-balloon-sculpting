#!/usr/bin/env node
// Live end-to-end verification for the J&N Balloon Sculpting platform.
//
//   BASE=https://jn-balloon-sculpting.vercel.app ADMIN_PW='...' node scripts/verify-live.mjs
//
// Non-destructive except for ONE test enquiry order labelled "ZZ E2E VERIFY",
// created to prove that public bookings persist to the shared store. The id of
// that order is printed at the end so it can be removed afterwards.
//
// Exit code 0 iff every check passes.

const BASE = (process.env.BASE || "").replace(/\/$/, "");
const ADMIN_PW = process.env.ADMIN_PW || "";
const LABEL = "ZZ E2E VERIFY";

if (!BASE) {
  console.error("Set BASE, e.g. BASE=https://jn-balloon-sculpting.vercel.app");
  process.exit(2);
}
if (!ADMIN_PW) {
  console.error("Set ADMIN_PW to the live admin password.");
  process.exit(2);
}

let cookie = ""; // admin session cookie, captured on login
const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

function captureCookie(res) {
  const jar = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of jar) {
    if (c.startsWith("admin")) cookie = c.split(";")[0];
  }
}

async function main() {
  // 1. Homepage loads and shows the brand.
  try {
    const res = await fetch(`${BASE}/?cb=${encodeURIComponent(String(process.pid))}`);
    const html = await res.text();
    const ok = res.status === 200 && /Balloon/i.test(html);
    record("1. Homepage loads (200 + branding)", ok, `status ${res.status}`);
  } catch (e) {
    record("1. Homepage loads (200 + branding)", false, e.message);
  }

  // 2. Public content renders (products/prices are server-rendered into the HTML).
  try {
    const res = await fetch(`${BASE}/`);
    const html = await res.text();
    const ok = res.status === 200 && /(from\s*£|£\s*\d)/i.test(html);
    record("2. Public product/pricing content renders", ok, ok ? "pricing present" : "no £ pricing in HTML");
  } catch (e) {
    record("2. Public product/pricing content renders", false, e.message);
  }

  // 3. Admin store is protected — no cookie ⇒ 401.
  try {
    const res = await fetch(`${BASE}/api/admin/store`);
    record("3. Admin store rejects unauthenticated (401)", res.status === 401, `status ${res.status}`);
  } catch (e) {
    record("3. Admin store rejects unauthenticated (401)", false, e.message);
  }

  // 4. Login rejects a wrong password.
  try {
    const res = await fetch(`${BASE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: BASE },
      body: JSON.stringify({ password: "definitely-not-the-password" }),
    });
    record("4. Login rejects wrong password (401)", res.status === 401, `status ${res.status}`);
  } catch (e) {
    record("4. Login rejects wrong password (401)", false, e.message);
  }

  // 5. CSRF defence — a foreign Origin on a state-changing POST ⇒ 403.
  try {
    const res = await fetch(`${BASE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://evil.example.com" },
      body: JSON.stringify({ password: ADMIN_PW }),
    });
    record("5. Cross-origin POST blocked (403)", res.status === 403, `status ${res.status}`);
  } catch (e) {
    record("5. Cross-origin POST blocked (403)", false, e.message);
  }

  // 6. Login accepts the correct password and sets a session cookie.
  try {
    const res = await fetch(`${BASE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: BASE },
      body: JSON.stringify({ password: ADMIN_PW }),
    });
    captureCookie(res);
    const ok = res.status === 200 && !!cookie;
    record("6. Login accepts correct password (200 + cookie)", ok, ok ? "session cookie set" : `status ${res.status}, cookie ${cookie ? "set" : "missing"}`);
  } catch (e) {
    record("6. Login accepts correct password (200 + cookie)", false, e.message);
  }

  // 7. Authed store read returns a valid store, with the Stripe secret redacted.
  let store = null;
  try {
    const res = await fetch(`${BASE}/api/admin/store`, { headers: { Cookie: cookie } });
    const body = await res.json().catch(() => ({}));
    store = body.store || null;
    const shapeOk =
      res.status === 200 &&
      store &&
      Array.isArray(store.products) &&
      Array.isArray(store.orders) &&
      Array.isArray(store.sizes) &&
      Array.isArray(store.zones);
    const redacted = store && (!store.settings?.stripeSecret) && (!store.settings?.stripePublishable);
    const ok = shapeOk && redacted;
    record(
      "7. Authed store read (valid shape + secrets redacted)",
      ok,
      ok ? `${store.products.length} products, ${store.orders.length} orders` : `status ${res.status}, shape ${shapeOk}, redacted ${redacted}`,
    );
  } catch (e) {
    record("7. Authed store read (valid shape + secrets redacted)", false, e.message);
  }

  // 8. Create the single test enquiry order labelled ZZ E2E VERIFY.
  let createdMsgId = null;
  try {
    const res = await fetch(`${BASE}/api/booking`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: BASE },
      body: JSON.stringify({
        kind: "custom",
        custName: LABEL,
        custContact: "verify-only@example.com",
        theme: "verification",
      }),
    });
    const body = await res.json().catch(() => ({}));
    const m = /JN-\d+/.exec(body.message || body.error || "");
    createdMsgId = m ? m[0] : null;
    const ok = res.status === 200 && !!createdMsgId;
    record("8. Create test enquiry order (ZZ E2E VERIFY)", ok, ok ? `acknowledged ${createdMsgId}` : `status ${res.status}, body ${JSON.stringify(body).slice(0, 120)}`);
  } catch (e) {
    record("8. Create test enquiry order (ZZ E2E VERIFY)", false, e.message);
  }

  // 9. Persistence — the new order is readable back from the shared store.
  let orderId = null;
  try {
    const res = await fetch(`${BASE}/api/admin/store`, { headers: { Cookie: cookie } });
    const body = await res.json().catch(() => ({}));
    const orders = body.store?.orders || [];
    const match = orders.find((o) => typeof o.customer === "string" && o.customer.includes(LABEL));
    orderId = match ? match.id : null;
    const ok = !!match;
    record("9. Test order persisted in shared store", ok, ok ? `found ${orderId}` : "order not found on re-read");
  } catch (e) {
    record("9. Test order persisted in shared store", false, e.message);
  }

  const passed = results.filter((r) => r.ok).length;
  console.log("\n" + "-".repeat(52));
  console.log(`RESULT: ${passed}/${results.length} checks passed`);
  const flagId = orderId || createdMsgId;
  if (flagId) console.log(`TEST ORDER TO REMOVE: ${flagId}  (customer: "${LABEL}")`);
  console.log("-".repeat(52));

  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error("Harness crashed:", e);
  process.exit(3);
});
