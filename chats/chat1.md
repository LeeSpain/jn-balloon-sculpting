# J&N Balloon Sculpting Business Platform

_Started 2026-07-09 12:05 UTC_

---

## User

# Project Brief: J&N Balloon Sculpting — Business Platform

## Who this is for
**J&N Balloon Sculpting** is run by Jade and Nicole, two young single mothers based in Huntingdon and Stilton, Cambridgeshire, UK. They make **pre-made balloon pieces** (arches, centrepieces, birthday/graduation/wedding displays — nothing overly intricate yet) which they build in advance and **deliver** to the customer. This platform needs to run their whole business: instant quoting, bookings, order tracking, and marketing — simple enough for two busy people with no technical background.

**All currency is GBP (£). All addresses/delivery use UK postcodes. Keep language UK English.**

---

## 1. Brand Identity — FINAL

**Business name:** J&N Balloon Sculpting
**Tagline suggestion:** "Handcrafted balloon art, delivered across Cambridgeshire"

### Colour palette — "Celebration with elegance"
Must suit weddings as well as kids' birthdays: soft and elegant as the base, with one joyful pop.
- **Blush Pink** `#F3C6C6` — primary brand colour (backgrounds, highlights)
- **Champagne Gold** `#D4AF7A` — accents, buttons, dividers, logo detail
- **Deep Plum** `#4A2C4D` — headings and primary text (rich, premium, readable)
- **Warm Cream** `#FBF7F2` — page background (never stark white)
- **Coral Pop** `#FF6F61` — the fun accent: call-to-action buttons, price highlights, sale badges

### Typography
- **Headings:** Playfair Display (elegant serif — wedding-worthy)
- **Body/UI:** Nunito (rounded, friendly sans-serif — approachable for birthday customers)

### Logo direction
- Wordmark: "J&N" in Playfair Display with the ampersand styled as a subtle balloon shape or with a thin gold balloon-string flourish curling from it, "BALLOON SCULPTING" underneath in spaced Nunito capitals.
- Deep Plum on cream; single-colour versions for social avatars.
- Keep it simple and scalable — it must work as an Instagram profile picture, on invoices, and on delivery labels.

### Overall feel
Warm, handmade, joyful but polished. Generous white space, soft rounded corners, subtle drop shadows. Photography-led — real photos of their work are the hero, not illustrations. Mobile-first throughout.

---

## 2. Backend — Admin Dashboard (Jade & Nicole only, login required)

### Cost Database
- **Materials:** editable list of items with unit cost — e.g. balloons (per balloon or per pack), helium (per canister/unit), ribbon, weights, frames, decorative extras. They can add/edit/delete items anytime.
- **Labour:** hourly rate field (suggest default £20/hr) plus estimated build time per product type (a standard arch takes roughly 1–1.5 hours for beginners).
- **Delivery zones:** postcode/radius-based zones measured from their base (between Huntingdon and Stilton). **Default zones (all editable in admin):**
  - Zone 1: 0–10 miles — £5 (covers Huntingdon, St Ives, Sawtry, Ramsey)
  - Zone 2: 10–20 miles — £12 (covers Peterborough, St Neots, Chatteris)
  - Zone 3: 20–30 miles — £20 (covers Cambridge, Ely)
  - Beyond 30 miles: "quote on request" — routes as an enquiry to admin
  - Admin can add/remove zones, change radii and fees, or switch to per-mile pricing (~£1/mile each way is the market norm)
- **Delivery rules:** helium-filled latex only floats 8–12 hours, so helium products must enforce **same-day delivery**; air-filled pieces last 2–3 weeks and can be built ahead. Product types flag whether they're helium or air-filled and the booking calendar respects this.
- **Markup/margin:** a global or per-product markup percentage they control.

### Pricing Engine
- Pulls material costs + labour time + markup + delivery zone fee → calculates a quote automatically.
- Whenever they change a cost, all future quotes update — no manual recalculation.
- Shows them true cost vs. price vs. profit per product and per order.

### Payments — Stripe (admin-connectable)
- A **Payments settings page** in admin where Jade and Nicole paste their own Stripe API keys (publishable + secret) to connect their account — no developer needed. Show a clear "Connected ✓ / Not connected" status and a link to where they find their keys in Stripe.
- **Deposit options they control:** full payment upfront, fixed deposit (e.g. £20), or percentage deposit (e.g. 25% / 50%) with the balance due before or on delivery. Default: 50% deposit to confirm the booking.
- Refund/cancellation window setting (e.g. cancellations up to 5 working days before delivery are refundable — editable).
- Until Stripe is connected, the site falls back gracefully to "Book now, pay on confirmation" enquiry mode so nothing breaks.

### Order Management
- Incoming orders show: customer name, contact details, item ordered, delivery address + postcode, delivery date, quoted price.
- Status pipeline: **Order received → Materials purchased → In progress → Ready → Delivered.**
- Calendar view of booked deliveries and free production slots, so they can spot overbooking.
- Notifications/reminders for when to start building and when deliveries are due.
- Each order logs materials used → live inventory tracking with **low-stock alerts** (e.g. "helium running low, reorder").
- Profit shown per order; over time, reporting on which products are most profitable.

---

## 3. Frontend — Customer-Facing Website

### Instant Quote Builder (the centrepiece feature)
Customer selects:
1. Product type — birthday arch, wedding centrepiece, graduation display, etc.
2. Size/complexity level
3. Colours/theme
4. Delivery postcode + preferred date

→ Instant price appears (base price + delivery), powered by the backend pricing engine. Market research puts standard pieces in the **£35–£100 range**, with £50–£75 + delivery as the sweet spot for their starting products.

- "Book now" with payment/deposit via Stripe, or "Request custom quote" for anything the builder can't handle (custom requests route to the admin dashboard as an enquiry).
- **Lead time:** minimum **7 days' notice** by default — the date picker blocks anything sooner. This is an admin-configurable setting (they can shorten or extend it anytime).
- Style the quote result card with the Coral Pop accent so the price feels exciting, not transactional.

### Other frontend pages
- **Portfolio/gallery** — photos of finished pieces (this is a visual business; make it beautiful).
- **Customer reviews/testimonials** section.
- **About** — Jade and Nicole's story: two local mums building something for their families. Warm, personal, genuine.
- **Contact + shareable booking link** designed to be dropped into Instagram/Facebook bios and posts.
- Mobile-first design — most customers will find them on social media on their phones.

### Optional extras to design in
- Package deals (e.g. discount for ordering three pieces).
- Lead-time rule (e.g. bookings require minimum X days' notice — make configurable in admin).

---

## 4. Social media — build the hooks, connect later
- A **Social settings page** in admin with empty fields for Instagram, Facebook, TikTok profile links, plus API key/token fields for future integrations (e.g. auto-posting new portfolio photos).
- Social icons in the site header/footer appear automatically once a link is added; hidden while empty.
- Every portfolio item and the quote builder get a **share link/button** ready for social use.
- Nothing on the site should break or look unfinished while these are unconnected.

## 5. All previously open questions — now DECIDED
- ✅ Payments: Stripe, connected by admin via API keys; deposit type/amount chosen in admin (default 50% deposit)
- ✅ Lead time: 7 days minimum, admin-editable
- ✅ Delivery: three default zones out to 30 miles, fully editable in admin, per-mile option available
- ✅ Socials: placeholder link + API fields in admin, connect later

---

## 6. Build priority (phases)
1. **Phase 1:** Frontend site with quote builder + admin cost database + pricing engine + delivery zones
2. **Phase 2:** Order management, calendar, statuses, 7-day lead-time logic
3. **Phase 3:** Stripe payment settings + deposit flow, inventory tracking, low-stock alerts, profit reporting
4. **Phase 4:** Reviews, packages, social hooks polish

Keep everything simple, warm, and manageable for two non-technical founders. The goal: they open the admin panel, see today's orders and profits at a glance, and get on with making balloons.

## Assistant

_[tool: questions_v2]_

## User

Questions answered:
- scope: Decide for me
- fidelity: Decide for me
- variations: Decide for me
- products: Decide for me
- quote_ux: Decide for me
- admin_tone: Decide for me
- seed_data: Decide for me

## Assistant

_[tool: read_skill_prompt]_

_[tool: read_skill_prompt]_

_[tool: write_file]_

_[tool: dc_write]_

_[tool: dc_write]_

_[tool: ready_for_verification]_

Built Phase 1 as a working, connected prototype:

**Customer site** (open now) — hero, instant quote builder (pick a piece → size → theme → postcode + date, live price with real postcode-to-zone lookup, 7-day lead-time enforcement, deposit line, same-day badge for helium), gallery + reviews + about + footer with share/booking-link copy.

**Admin dashboard** (`J&N Admin.dc.html`, linked from the site footer) — overview with profit/revenue/low-stock alerts, orders pipeline with status dropdowns, editable materials/labour/markup (quotes recalculate instantly), delivery zone fees, and settings for lead time, deposit, Stripe keys (Connected ✓ status) and social links.

Everything shares one pricing engine and saved data — book on the site and the order appears in admin; change a cost in admin and site prices update.

Next steps: real photos for the gallery/hero (placeholders marked), then Phase 2 calendar view and build reminders.

## User

Add images you can create and make a lin on the footer for "Admin" and that will link to the admin page

## Assistant

_[tool: grep]_

The Admin footer link is already in place (bottom bar of the footer, gold "Admin" link) — I'll leave it. Now generating real images with balloon artwork drawn on canvas:

_[tool: run_script]_

_[tool: view_image]_

_[tool: view_image]_

Wedding piece looks good; the hero arch is too sparse — regenerating denser:

_[tool: run_script]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: ready_for_verification]_

Done — I generated balloon artwork (soft studio-style renders in the brand palette) and replaced all the striped placeholders: hero arch, all six gallery pieces, and the Jade & Nicole portraits.

The footer Admin link was already there — bottom bar of the footer, the gold "Admin" text links to the admin page.

These are illustrative renders; swap in real photos of their work when available for maximum impact.

## User

Found issues — fixing…

## Assistant

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

Hardcoding the gallery in the template (static list — no holes in `src`):

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: ready_for_verification]_

Fixed — the gallery images are now written directly into the template, so the broken placeholder request is gone and the page loads with no console errors.

## User

cross check what is not connected from the front end to the backend like images and agllarery

## Assistant

Here's the audit — what's genuinely wired up vs. what's only on the frontend:

**Connected (admin changes really affect the site):**
- Material costs, labour rate, markup → quote prices recalc instantly
- Product build times → prices
- Delivery zone fees + postcodes → quote delivery charge
- Lead-time days → date picker blocking
- Deposit type/amount → deposit line on the quote card
- Social links → footer icons appear when filled in
- Site bookings → appear in admin Orders/Overview

**Not connected (static on the frontend):**
1. **Gallery images** — hardcoded in the site; admin has no Portfolio section to add/remove/reorder photos
2. **Reviews** — hardcoded three testimonials; no admin management
3. **Hero image & about text/photos** — static
4. **Booking form collects no customer details** — orders land in admin as "New enquiry (website)" with no name/phone. Biggest real gap.
5. **Stripe status** — admin shows Connected ✓, but the site's booking message always says "pay on confirmation" either way
6. **Refund window** — editable in admin, never shown to customers
7. **Inventory** — orders don't reduce stock counts; low-stock alerts only move if you edit stock by hand
8. **Colour themes list** — site reads it from the store, but admin has no UI to edit the theme names

Want me to wire these up? I'd prioritise **4** (name/phone fields before booking), then **1 + 2** (Portfolio & Reviews tabs in admin that feed the site), then **5–7**. Say which and I'll build them.

## User

Update all and review and list what is missing throughout the complete app and add and fix and create

## Assistant

_[tool: update_todos]_

_[tool: str_replace_edit]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: grep]_

_[tool: read_file]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

Now the admin: Site content tab, editable stock, auto stock deduction.

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: ready_for_verification]_

_[tool: ready_for_verification]_

_[tool: update_todos]_

All eight gaps are now wired up — you're looking at the admin, where a new **Site content** tab manages what the website shows:

**Added/fixed:**
1. **Booking now requires name + mobile/email** (step 5 on the quote card) — orders arrive in admin with real contact details; missing details shows a coral warning
2. **Gallery** — admin can retitle, swap artwork, reorder, add and remove items; site updates instantly
3. **Reviews** — fully editable/add/remove in admin
4. **Colour themes** — add/remove chips; quote builder follows
5. **Stripe-aware booking** — once keys are pasted, the button becomes "Pay £X deposit" and confirmation says the deposit is paid; without keys it stays enquiry mode
6. **Refund window** — now shown on the quote card ("Free cancellation up to 5 working days before delivery")
7. **Inventory** — stock is editable per material, and moving an order to "Materials purchased" automatically deducts its recipe from stock (low-stock alerts go red on the Overview)
8. **Custom quote requests** — now saved as enquiries in admin with the customer's details, including the beyond-30-miles route

**Still missing (future phases):** admin login, calendar view of production/delivery slots, build/delivery reminders, real Stripe charging (keys are stored but no live payment), per-mile delivery pricing, package deals, email/SMS notifications, and photo *upload* (gallery currently picks from bundled artwork — real photos need to be added to the project). Say the word and I'll take on any of these.

## User

have request quote but what about buy now and pay and then instant sales?

## Assistant

Good call — let's add a real instant checkout. I'll make "Book now" open a secure-checkout sheet: with Stripe connected it takes card details and confirms the sale instantly (deposit paid, balance tracked in admin); without keys it falls back to the booking request.

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

_[tool: snip]_

Instant sales are in. "Book now" (or "Pay £X deposit" once Stripe keys are connected) now opens a **secure checkout sheet**:

- Order summary — item, delivery, date, **"Due today"** deposit and the balance due before delivery
- **Stripe connected:** card number/expiry/CVC → "Pay £X now" → processing → instant confirmed sale, deposit recorded
- **Not connected:** graceful fallback — "Send booking request", confirmed within 24h

Admin orders now show payment state per order: *paid £49 · due £49*, *paid in full*, or *nothing paid yet* in the Orders tab.

To try the paid flow: Admin → Settings → paste anything starting `pk_` + any secret key → status flips to Connected ✓ → the site switches to instant payment. (It's a simulated charge — real Stripe processing needs a live backend at launch.)

## User

NO they pay now but we have 7 days order time so they pay in full 100% and not quote on front end!

## Assistant

_[tool: str_replace_edit]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

Done — full payment up front is now the policy:

- Default is **100% payment at booking** (existing saved settings migrate automatically)
- Price card now says "Pay in full today — your date is locked in instantly"; checkout's "Due today" is the full total, confirmation says "Paid in full"
- All "quote" language on the front end replaced with **"Price & book"** — nav, hero button, and the booking section header
- "Request custom quote" stays only for bespoke pieces and beyond-30-miles delivery, which still route to you as enquiries

Admin → Settings still lets you switch to fixed/percentage deposits later if you ever want to.

## User

OK I wnat to add a finance package page so with the profit they make we need to show then how mcuh they pay taxes etc and then net profits they can take out of the acount each!

## Assistant

_[tool: str_replace_edit]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: update_todos]_

_[tool: dc_js_str_replace]_

_[tool: ready_for_verification]_

