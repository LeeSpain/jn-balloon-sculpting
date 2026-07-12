# Stripe test-mode runbook (Checkout Sessions)

Turn on card payments **in Stripe test mode**, verify the whole chain on the **live
deployment** (including the webhook), then — and only then — swap in live keys.
The site keeps two independent safety gates, so nothing charges a real card until
both are deliberately on:

- **Stripe configured:** `STRIPE_SECRET_KEY` starts `sk_` **and**
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` starts `pk_`.
- **Bookings live:** a database is connected **and** `BOOKINGS_LIVE=true`.

If either is off, the site quietly falls back to "pay on confirmation" enquiry mode.

---

## How payment works here

1. Customer books → `POST /api/booking` recomputes the price server-side and creates
   the order with `awaitingPayment: true`, `depositPaid: 0`.
2. The server creates a **Stripe Checkout Session** charging the **deposit**
   (`depositFor(total)` — see below) and redirects the customer to Stripe.
3. On success Stripe returns them to `/?booked=<id>` (a confirmation message shows);
   on cancel/back — including after a declined card — to `/?cancelled=<id>` (a
   "held as unpaid, nothing charged" message shows).
4. The **webhook** (`/api/stripe/webhook`) is the only trusted signal of payment: on
   `checkout.session.completed` it sets `depositPaid = amount_total/100` and clears
   `awaitingPayment`. The order shows as paid in admin.

**Deposit amount = the admin's setting** (Admin → Settings → Deposit):
- `full` → the whole total
- `fixed` → `min(£amount, total)`
- `percent` → `total × pct/100`

The Checkout line item is `Math.round(deposit × 100)` pence, and the webhook records
exactly `amount_total` — so what's charged and what's recorded both equal the
configured deposit. (Verified: `deposit=full→£80/£80`, `fixed £20→£20`, `25%→£20`.)

---

## Step 1 — Add test keys in Vercel (test mode)

Stripe Dashboard → toggle **Test mode** (top right) → Developers → API keys. Copy the
**test** keys. In Vercel → Project → Settings → Environment Variables (Production
scope), set:

```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

Do **not** set `BOOKINGS_LIVE` yet.

## Step 2 — Register the webhook on the LIVE deployment

Stripe Dashboard (Test mode) → Developers → **Webhooks** → **Add endpoint**:

- Endpoint URL: `https://jn-balloon-sculpting.vercel.app/api/stripe/webhook`
- Events to send: **`checkout.session.completed`**
- Create, then copy the endpoint's **Signing secret** (`whsec_...`).

In Vercel set:

```
STRIPE_WEBHOOK_SECRET=whsec_...
```

Redeploy so all three env vars are live.

> Why a dashboard endpoint (not `stripe listen`)? `stripe listen --forward-to`
> forwards to a URL but issues a throwaway secret and only runs while your terminal
> is open — fine for local dev, not for verifying the deployed site. The dashboard
> endpoint is the real, persistent path and lets you inspect **Recent deliveries**.

## Step 3 — Turn bookings live (test mode)

Only after the DB is connected and verified (see `PRODUCTION-DB.md`):

```
BOOKINGS_LIVE=true
```

Redeploy. The site now creates real Checkout Sessions — but with **test keys**, so
only test cards work.

## Step 4 — Verify end-to-end on the live URL

Use Stripe's [test cards](https://stripe.com/docs/testing). On the live site, make a
booking that produces a valid price (in-area postcode, date ≥ the lead time).

**A) Successful payment**
1. At Checkout enter card `4242 4242 4242 4242`, any future expiry, any CVC, any postcode.
2. You're returned to `/?booked=JN-XXXX` and see the green **"Payment received — booking JN-XXXX is confirmed"** message.
3. Stripe → Webhooks → your endpoint → **Recent deliveries**: the `checkout.session.completed` delivery is **200**.
4. Admin → Orders: order `JN-XXXX` shows **paid**, and the amount equals your configured deposit (e.g. full total, or the fixed/percent deposit).

**B) Declined card**
1. Book again; at Checkout enter `4000 0000 0000 0002` (generic decline).
2. Stripe shows the decline inline. Either try another card, or press **← Back** to leave.
3. On leaving you land on `/?cancelled=JN-YYYY` and see the amber **"Payment wasn't completed … held as unpaid — nothing has been charged"** message.
4. Admin → Orders: `JN-YYYY` is still **unpaid** (`awaitingPayment`, deposit £0). No webhook `completed` event fired for it (Recent deliveries shows none), so nothing was recorded — the sensible unpaid state.

**C) Deposit-setting check**
- Set Admin → Settings → Deposit to `fixed £20` (or `25%`), redeploy/save, book again with `4242…`.
- Confirm Checkout's "Due today" and the recorded `depositPaid` both equal £20 (or 25% of the total), not the full price.

## Step 5 — Go live (real cards)

Once A–C pass on the live URL with test keys:

1. Stripe → **Test mode off**. Developers → API keys → copy the **live** `sk_live_`/`pk_live_`.
2. Developers → Webhooks → add the **same endpoint** in live mode; copy its live `whsec_`.
3. In Vercel replace `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
   `STRIPE_WEBHOOK_SECRET` with the **live** values. Redeploy.
4. Do one real low-value booking with a real card to smoke-test, then refund it from
   the Stripe dashboard.

## Troubleshooting

- **Order stuck `awaitingPayment` after paying** → the webhook didn't reach the site
  or the signature failed. Check Stripe → Webhooks → Recent deliveries (non-200?),
  confirm `STRIPE_WEBHOOK_SECRET` matches the endpoint's secret, and that the endpoint
  URL is exactly `/api/stripe/webhook`.
- **Customer redirected to enquiry mode instead of Stripe** → a gate is off: verify
  both keys are set (`sk_`/`pk_`), a DB is connected, and `BOOKINGS_LIVE=true`.
- **Wrong amount charged** → check Admin → Settings → Deposit; the charge is the
  deposit, not always the full price.
