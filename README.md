# J&N Balloon Sculpting — Business Platform

The real implementation of the J&N Balloon Sculpting platform: a customer-facing
booking site with an instant quote builder, and a founder admin dashboard for
costs, orders, content, finances and settings. Built from the Claude Design
prototypes (see [`DESIGN-HANDOFF.md`](./DESIGN-HANDOFF.md), the chat transcripts in
[`chats/`](./chats), and the original prototypes in [`project/`](./project)).

- **Stack:** Next.js 16 (App Router) · React 19 · TypeScript · deployed to Vercel
- **Data:** Postgres is the single source of truth (Neon in production, PGlite
  locally) via API routes. No `localStorage` is used as a record.
- **Auth:** admin sits behind a signed-cookie session with a scrypt-hashed login
  and DB-backed rate limiting.
- **Images:** Vercel Blob in production, local `public/uploads` in dev.

## Architecture

```
app/
  page.tsx              Public site (server) → reads sanitised public store
  site/SiteApp.tsx      Quote builder, checkout, gallery, reviews, about (client)
  admin/                Auth-gated dashboard
    page.tsx            Server guard → loads full store
    AdminApp.tsx        Overview · Orders · Costs & pricing · Delivery zones ·
                        Site content · Finance · Settings (client)
    login/page.tsx      Founder login
  api/
    store/              GET public store (no orders, no Stripe secret)
    orders/             POST booking / custom enquiry (server recomputes price)
    admin/store/        GET full store · PUT content+settings   (authed)
    admin/orders/[id]/  PATCH status (consumes stock server-side)  (authed)
    admin/upload/       POST gallery photo → Blob / local          (authed)
    admin/login|logout  session cookie · rate-limited
    admin/reset/        restore seeded demo data                   (authed)
lib/
  engine.ts             Framework-agnostic pricing engine (ported from prototype)
  types.ts              Domain types (Store, Order, Settings, …)
  seed.ts               Default/demo dataset
  db/index.ts           Driver abstraction: Neon (prod) / PGlite (local)
  db/store.ts           Schema, seeding, reads (public/admin), writes
  auth.ts               scrypt hashing, HMAC sessions, rate limiting
  storage.ts            Uploads: Vercel Blob (prod) / filesystem (local)
  css.ts                Parses prototype inline-style strings → React style objects
```

The prototypes' shared-store behaviour is preserved, just server-backed: a booking
on the site appears in admin instantly, and a cost/content change in admin reprices
the site on its next load. Order prices are **recomputed server-side** from the
engine — the client's numbers are never trusted.

## Local development

Requires Node 22+. No database server needed — it uses PGlite (in-process Postgres)
persisted to `./.pgdata`.

```bash
npm install
cp .env.example .env.local     # defaults work for local dev
npm run dev                     # http://localhost:3000
```

Admin: <http://localhost:3000/admin> — default login `admin` / `balloons`
(set `ADMIN_USERNAME` / `ADMIN_PASSWORD` to change; seeded on first use).

### Verify end-to-end

```bash
npm run dev
node scripts/e2e-smoke.mjs      # drives both apps in Chromium (Playwright)
```

## Deploying to Vercel

1. Push this repo to GitHub and import it into Vercel.
2. **Add Postgres:** Vercel dashboard → Storage → create a Neon Postgres database and
   connect it to the project. This injects `POSTGRES_URL` / `DATABASE_URL`. The
   schema and demo data are created automatically on first request.
3. **Add Blob** (for photo uploads): Storage → Blob → connect. This injects
   `BLOB_READ_WRITE_TOKEN`.
4. **Set env vars** (Project → Settings → Environment Variables):
   - `AUTH_SECRET` — a long random string
   - `ADMIN_USERNAME`, `ADMIN_PASSWORD` — founder login (required in production)
5. Deploy. Every route is server-rendered on demand, so data is always live.

To rotate the founder password later, update `ADMIN_PASSWORD` and delete the row in
`admin_users` (or add an in-admin password change — a natural next step).

## Notes & next steps

- **Stripe** keys are stored and the checkout switches to card entry once connected,
  but the charge is simulated — wiring a real PaymentIntent needs a Stripe secret-key
  call in `api/orders` at launch.
- Not yet built (future phases): production calendar view, build/delivery reminders,
  per-mile delivery pricing, package deals, and email/SMS notifications.
