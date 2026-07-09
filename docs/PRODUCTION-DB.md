# Production database & go-live runbook

The app uses **Postgres** for durable data in production and the JSON file store
only in local dev. Selection is automatic: if `DATABASE_URL` / `POSTGRES_URL` /
`POSTGRES_PRISMA_URL` is set, it uses `lib/store/postgresRepository.ts`; otherwise
the dev file store (`lib/store/jsonFileRepository.ts`).

Data model (see `postgresRepository.ts`):
- `store_content` — one JSONB row: settings, products, images, gallery, reviews, zones, themes.
- `store_orders` — one row per order. `write()` **upserts, never deletes**, so a
  booking created at the same moment as an admin save can never be lost.

This design was verified against a real Postgres (auto-seed, admin edit + concurrent
booking survival, fresh-connection read, reset). What remains is verifying it on **your
live deployment** — steps below.

## 1. Provision Postgres (once)
- Vercel dashboard → your project → **Storage → Create Database → Postgres** (Neon).
  Link it to the project. Vercel injects `DATABASE_URL` / `POSTGRES_URL` automatically.
- (Any Postgres works — Supabase/RDS/etc. Paste its **pooled** connection string as
  `DATABASE_URL` in Project → Settings → Environment Variables.)

## 2. Blob (images) — already enabled by you
- Confirm `BLOB_READ_WRITE_TOKEN` exists under Project → Settings → Environment Variables
  (Vercel adds it when the Blob store is created). Images then persist to Blob in prod.

## 3. Deploy
- Redeploy so the new env vars take effect. Keep **`BOOKINGS_LIVE` unset** for now —
  the site stays enquiry-only (no card payments) until you've verified persistence.

## 4. Verify persistence on the LIVE site
Run the script (writes a marker, then — after you force a fresh instance — reads it back):

```bash
SITE_URL="https://your-domain" ADMIN_PASSWORD="your-admin-password" \
  bash scripts/verify-prod.sh write     # creates a test order + edits a gallery title

# Force a fresh serverless instance: redeploy (Vercel → Deployments → Redeploy),
# or wait ~15 min for instances to recycle.

SITE_URL="https://your-domain" ADMIN_PASSWORD="your-admin-password" \
  bash scripts/verify-prod.sh read      # confirms BOTH survived the fresh instance
```

Green output on the `read` run = orders **and** content survive across instances.
Then clean up the test order in the admin (Orders) and reset any test edit.

### Confirm Blob images live
- Log into `/admin` → Site content → Images → upload a Hero image.
- View source of the homepage: the hero `src` should be a
  `https://<id>.public.blob.vercel-storage.com/...` URL (not `/uploads/...`).
- Redeploy; reload — the image should still be there. That confirms Blob persistence.

## 5. Go live with card bookings
Only after step 4 passes:
- Set `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`.
- Set **`BOOKINGS_LIVE=true`**. Redeploy.
- Until both a database is configured AND `BOOKINGS_LIVE=true`, the site refuses to take
  card payments and shows "Book now" as an enquiry (no charge).

## Seeding / migrating existing content
The prod file store was ephemeral, so there is nothing to migrate — the DB **auto-seeds**
on first read. To pre-populate real content, run the app locally pointed at the prod DB
and edit in the admin (uses the exact same repository):

```bash
DATABASE_URL="<prod pooled url>" npm run dev   # edits in /admin write straight to prod DB
```
