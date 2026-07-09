# J&N Balloon Sculpting

Production website + admin dashboard for **J&N Balloon Sculpting** — a Cambridgeshire
balloon-art business run by Jade & Nicole. Handcrafted arches, garlands and centrepieces,
quoted instantly and delivered across Cambridgeshire.

Built with **Next.js (App Router) + TypeScript + Tailwind**, deployed on **Vercel**.
Recreated pixel-for-pixel from the Claude Design handoff prototypes.

## Features

- **Public site** (`/`) — hero, instant-quote builder (piece → size → theme → postcode/date →
  details → live price + deposit), gallery, reviews, about, footer.
- **Admin dashboard** (`/admin`, password-protected) — overview stats, orders pipeline,
  editable costs/pricing, delivery zones, site content (gallery/reviews/themes) and settings.
- **Instant quoting** — pricing engine (materials → cost → labour → markup), postcode→zone
  delivery fees, configurable deposits. Customer prices are computed **server-side** so
  material costs, markup and secrets never reach the browser.
- **Real bookings** — the quote form POSTs to `/api/booking`, which persists the order and
  triggers a notification hook.
- **Server-side Stripe deposits** — when Stripe env keys are present, "Book now" creates a
  Stripe Checkout session for the deposit. Otherwise the site takes "pay on confirmation"
  enquiries. Keys live only in server env vars, never in the DB or browser.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in ADMIN_PASSWORD (+ Stripe keys if you have them)
npm run dev                  # http://localhost:3000  ·  admin at /admin
```

## Environment variables

See [`.env.example`](./.env.example). Set the same values in the Vercel project settings.

| Variable | Purpose |
| --- | --- |
| `ADMIN_PASSWORD` | Password for the `/admin` dashboard |
| `STRIPE_SECRET_KEY` | Stripe secret (`sk_…`) — enables real deposit payments |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable (`pk_…`) |
| `NEXT_PUBLIC_SITE_URL` | Public URL for Stripe redirects |
| `BOOKING_NOTIFY_EMAIL` | Where new-booking notifications should go |

## Architecture notes

- **Pricing engine** — `lib/pricing.ts`, ported from the design bundle's `engine.js`
  (logic preserved), with `lib/seed.ts` holding the default data.
- **Data layer** — everything server-side talks to the `StoreRepository` interface
  (`lib/store/`). The current implementation is a JSON-file stub (`JsonFileRepository`).

  > ⚠️ **Before launch, swap in a real database.** The stub persists to a local file in
  > dev and to ephemeral temp storage on Vercel — writes do **not** survive between
  > serverless invocations in production. To add a real DB (e.g. Supabase or Vercel
  > Postgres): create a new `StoreRepository` implementation and return it from
  > `lib/store/index.ts`. No page or API route needs to change.

- **Admin auth** — shared password → hashed httpOnly cookie, gated by `middleware.ts`.
  Replace with a proper auth provider when the database is added.
- **Notifications** — `lib/notify.ts` currently logs to the server console. Wire a real
  email/SMS provider before launch.

## From the original prototypes

The source design prototypes live in `../project/` (`J&N Website.dc.html`, `J&N Admin.dc.html`,
`engine.js`). They are the visual reference; this app is the real implementation.
