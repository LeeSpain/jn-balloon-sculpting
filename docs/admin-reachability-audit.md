# Admin reachability audit

_Goal: every backend/data feature must be findable and operable by a non-technical
founder through the admin UI — no code or API calls needed._

Date: 2026-07-12. Scope: the full `Store` model (`lib/types.ts`) and every route
under `app/api/`, mapped to its admin control.

## Result

**No unreachable API routes.** Every admin API endpoint has a UI trigger, and the
public/iCal routes are consumed as designed. **One data feature had no UI at all**
— fixed in this pass — plus a handful of discoverability polish items, also fixed.

## Fixed in this pass

| Item | Was | Now |
|---|---|---|
| `materials.lowAt` (low-stock threshold) | **No UI** — only `stock` was editable; new materials were frozen at `lowAt: 0`, so the Overview "low stock" alert could never be configured | "warn at" input added to every material row (Costs & pricing → Materials) |
| Message templates (email / WhatsApp / **review request**) | Buried in a collapsed `<details>` labelled only "used by the email/WhatsApp buttons" | Relabelled "✏️ Message wording — edit your email, WhatsApp & review-request templates (tap to open)" |
| Unlabelled `✕` / reorder buttons | Bare glyphs on gallery, reviews, themes (and gallery ↑/↓) | `title` + `aria-label` added; gallery-piece delete now also confirms |
| Product photos hard to associate | Product editing on Costs & pricing, photos on Site content with no signpost | Cross-reference line added under Products: "Product photos are set in Site content → Product photos" |

## Reachability map (post-fix)

Settings — bookings/deposit/refund, social links: **Settings tab**. Stripe keys,
test connection, webhook setup, accept-cards toggle: **Settings → Payments**
(`PaymentsSettings`). Labour rate & markup, size tiers, materials (cost/stock/**warn-at**),
products (add/remove/recipe/override): **Costs & pricing** (`PricingTab`). Tax/VAT,
delivery-cost %, and the All/Pipeline/**Delivered** basis: **Finance → Assumptions**.
Max deliveries/day, working hours, calendar-subscribe link, blocks: **Calendar →
Availability**. Copy, images, gallery, reviews, themes, product photos: **Site content**.
Orders (status, cancel/archive, delete, maker/deliverer, acknowledge): **Orders** +
order modal + **Triage banner**. Contacts (edit/delete/CSV, occasion memory,
follow-ups): **Contacts** + card modal. Enquiries (New→Replied→Closed): **Enquiries**.

Every `app/api/admin/*` route maps to a control: `store` ← every save; `upload` ←
image pickers; `orders/[id]` DELETE ← Delete permanently; `contacts/[id]` DELETE ←
"Yes, erase"; `stripe` / `stripe/test` / `stripe/accept` ← Payments; `calendar-token`
← "Get subscribe link"; `logout` ← header. The `/api/calendar/[token]` iCal feed is
consumed by an external calendar app after subscribing — by design.

## Known-and-accepted (not gaps)

- **Conditionally hidden but sensible:** `depositValue` (only when deposit ≠ full),
  `vatRatePct` (only when VAT on), recipe "+ Add material" (only when materials remain
  to add). No lockouts.
- **Location choices:** availability lives on Calendar and finance assumptions on
  Finance rather than Settings — contextually reasonable; left as-is ahead of freeze.
- **Order core fields** (price, product, theme, postcode, address, contact, notes) are
  read-only in the order modal by design; the delivery date is changed via calendar
  drag. Not part of this pass's scope.
