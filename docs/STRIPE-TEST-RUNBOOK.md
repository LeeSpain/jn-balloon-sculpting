# Stripe test-mode runbook (admin-first)

Configure Stripe **from the admin dashboard** (Settings → Payments), verify the
whole chain on the **live deployment** in test mode, then swap in live keys.
Keys live in the database (secret values **encrypted at rest**, never shown again),
so no redeploy is needed to change them.

Two safety gates still protect against charging a real card by accident:
- **Configured & connected:** a valid `sk_`/`pk_` pair is saved and "Test
  connection" has succeeded.
- **Accept card payments** is toggled on (only switchable on once connected) **and**
  a database is connected.

Until both hold, the booking form runs in "pay on confirmation" enquiry mode.

> Env vars (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
> `STRIPE_WEBHOOK_SECRET`, `BOOKINGS_LIVE=true`) still work as a fallback/override,
> but the admin path is primary and takes precedence when set.

---

## How payment works

1. Customer books → the server recomputes the price and creates the order with
   `awaitingPayment: true`, `depositPaid: 0`.
2. The server creates a **Stripe Checkout Session** for the **deposit**
   (`depositFor(total)`: `full`=whole total, `fixed`=£amount, `percent`=%), using
   the keys resolved from the DB (falling back to env), and redirects to Stripe.
3. Success → `/?booked=<id>` (confirmation shown); cancel/back, incl. after a
   declined card → `/?cancelled=<id>` ("held as unpaid — nothing charged").
4. The **webhook** (`/api/stripe/webhook`) is the only trusted payment signal: on
   `checkout.session.completed` it records `depositPaid = amount_total/100` and
   clears `awaitingPayment`. So charged = recorded = the configured deposit.

---

## Step 1 — Enter TEST keys in the admin

Stripe Dashboard → **Test mode** on → Developers → API keys. In your site:
**Admin → Settings → Payments — Stripe**:

1. Paste the **Publishable key** (`pk_test_…`) and **Secret key** (`sk_test_…`).
2. Click **Save keys**. (The secret is encrypted before storage; afterwards only
   its last 4 digits are shown.)
3. Click **Test connection**. On success the badge shows a loud
   **● TEST MODE — no real money moves**. (`● LIVE MODE` appears for `sk_live_`.)

## Step 2 — Register the webhook on the LIVE deployment

In the Payments section, copy the **Webhook endpoint** shown
(`https://<your-site>/api/stripe/webhook`). Then in Stripe (Test mode) →
Developers → **Webhooks → Add endpoint**:

- URL: paste the copied endpoint.
- Event: **`checkout.session.completed`**.
- Create it, copy the endpoint's **Signing secret** (`whsec_…`).

Back in admin → Payments: paste it into **Webhook signing secret** → **Save keys**.

> A dashboard endpoint (not `stripe listen`) is what verifies the *deployed* site
> and lets you inspect **Recent deliveries** (should be 200).

## Step 3 — Turn on card payments

Only after a database is connected: flip **Accept card payments** on. (The toggle
is disabled until "Test connection" has passed — it can't be forced on.)

## Step 4 — Verify end-to-end on the live URL

Using Stripe [test cards](https://stripe.com/docs/testing), book on the live site
(in-area postcode, date ≥ lead time):

**A) Success** — card `4242 4242 4242 4242`:
- Return to `/?booked=JN-XXXX` with the green confirmation.
- Stripe → Webhooks → your endpoint → Recent deliveries: `checkout.session.completed` = **200**.
- Admin → Orders: `JN-XXXX` is **paid**, amount = your configured deposit.

**B) Declined** — card `4000 0000 0000 0002`:
- Stripe shows the decline; press Back to leave.
- Return to `/?cancelled=JN-YYYY` with the amber "held as unpaid — nothing charged".
- Admin → Orders: `JN-YYYY` still **unpaid** (`awaitingPayment`, £0).

**C) Deposit setting** — set Admin → Settings → Deposit to `fixed £20` (or `25%`),
book with `4242…`, confirm the charge and recorded `depositPaid` = £20 (or 25%).

## Step 5 — Go live (real cards)

Once A–C pass in test mode:
1. Stripe → Test mode off → copy the **live** `sk_live_`/`pk_live_`; add a live-mode
   webhook endpoint (same URL) and copy its live `whsec_`.
2. Admin → Settings → Payments: paste the live keys + live webhook secret → Save →
   **Test connection** (badge flips to **● LIVE MODE**) → toggle Accept card payments on.
3. Make one real low-value booking, then refund it from Stripe.

## Security notes

- Secret key + webhook secret are **AES-256-GCM encrypted at rest** in Postgres
  (key from `ENCRYPTION_KEY`, else derived from `SESSION_SECRET`). They are never
  returned to the browser or included in sanitised store reads — only last-4.
- Changing the secret key resets "connected" and turns Accept card payments **off**
  until you re-test — you can't accidentally run on a stale/wrong key.

## Troubleshooting

- **Order stuck `awaitingPayment` after paying** → webhook didn't verify. Check
  Stripe → Webhooks → Recent deliveries (non-200?) and that the **Webhook signing
  secret** saved in admin matches the endpoint's secret.
- **Redirected to enquiry mode instead of Stripe** → a gate is off: keys saved &
  tested (green badge), a database connected, and Accept card payments on.
- **Wrong amount** → check Admin → Settings → Deposit; the charge is the deposit.
