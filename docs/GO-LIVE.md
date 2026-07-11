# Go-live checklist — J&N Balloon Sculpting

Everything code-side is **done and verified** (build ✓ · type-check ✓ · lint ✓):
legal pages (`/privacy`, `/terms`), demo data removed from the production seed,
SVG uploads blocked, sitemap updated, image uploads now work even before Vercel
Blob is connected. What remains is **account/config work only** — things that
need your logins (Vercel, Stripe, domain registrar, Resend).

The admin dashboard shows a **"Getting ready to go live"** banner listing exactly
what still needs connecting — it disappears once everything's set.

> **The one thing that actually blocks launch: connect a database.** Without it,
> edits you make in the admin (hero image, prices, content, orders) save for the
> moment but reset whenever the server idles — Vercel gives every save a fresh,
> empty instance. It's a 2-minute click (step 3). Everything else below is
> polish or payments.

Do them in this order. Steps 1–7 get you **live taking enquiries**.
Steps 8–10 switch on **real card payments**.

---

## Phase 1 — live, enquiry-only (~30–60 min)

1. **Domain** — buy/confirm `jnballoons.co.uk` (or your chosen domain) and add it
   to the Vercel project (Project → Settings → Domains). The site references
   `hello@jnballoons.co.uk` — if you use a different domain, tell Claude and the
   references get updated in one pass.

2. **Email inbox** — make sure `hello@jnballoons.co.uk` actually receives mail
   (registrar email forwarding to Jade/Nicole's Gmail is fine and usually free).

3. **Postgres** — Vercel → project → **Storage → Create Database → Postgres (Neon)**
   → link to project. `DATABASE_URL` is injected automatically. Nothing else to do
   — the schema auto-creates and seeds on first visit.

4. **Vercel env vars** (Project → Settings → Environment Variables, all "Production"):
   | Variable | Value |
   | --- | --- |
   | `ADMIN_PASSWORD` | copy from local `web/.env.local` (generated 2026-07-11) |
   | `SESSION_SECRET` | copy from local `web/.env.local` (generated 2026-07-11) |
   | `NEXT_PUBLIC_SITE_URL` | `https://your-domain` — no trailing slash |
   | `RESEND_API_KEY` | from resend.com (free tier fine) — verify your domain there |
   | `RESEND_FROM` | `J&N Bookings <bookings@your-domain>` |
   | `BOOKING_NOTIFY_EMAIL` | where booking alerts should land |
   | `BLOB_READ_WRITE_TOKEN` | confirm it exists (added when Blob store was created) |

   Leave **`BOOKINGS_LIVE` unset** for now.

5. **Deploy** — push/redeploy so the env vars take effect.

6. **Verify persistence** — run the two-step check in
   [PRODUCTION-DB.md](./PRODUCTION-DB.md) §4 (`scripts/verify-prod.sh write` →
   redeploy → `read`). Also upload a hero image in `/admin` and confirm it comes
   back as a `blob.vercel-storage.com` URL.

7. **Real content** (log into `/admin` → Site content):
   - The production database seeds **clean** — no fake orders, no fake reviews
     (the reviews section stays hidden on the homepage until you add real ones).
   - Add: real gallery photos, real customer reviews (with permission!),
     Instagram/Facebook/TikTok links, and check prices/zones/lead time in Settings.
   - **Read `/privacy` and `/terms` once** — they were drafted for you; confirm
     the refund window (5 days, also in Admin → Settings) and contact details
     match how you actually operate.

**→ At this point the site is live**: instant quotes work, bookings arrive as
enquiries, and you get an email for each one.

## Phase 2 — card payments (~30 min, whenever ready)

8. **Stripe account** — activate at stripe.com (business details, bank account
   for payouts).

9. **Stripe env vars** in Vercel:
   - `STRIPE_SECRET_KEY` (`sk_live_…`)
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_live_…`)
   - `STRIPE_WEBHOOK_SECRET` — Stripe dashboard → Developers → Webhooks → Add
     endpoint → `https://your-domain/api/stripe/webhook`, event
     `checkout.session.completed` → copy the signing secret (`whsec_…`).

10. **Open the gate** — set `BOOKINGS_LIVE=true`, redeploy, and make one real
    £-small test booking end-to-end (you can refund it in Stripe). Confirm the
    order flips from "awaiting payment" to paid in `/admin`.

## Post-launch (optional, no rush)

- Google Business Profile + submit the sitemap in Search Console.
- Shared rate-limit store (Upstash) if traffic ever grows.
- An accessibility pass (keyboard-walk the quote builder).
