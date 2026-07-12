# Content audit — is every customer-visible number & string admin-editable?

Goal: nothing a customer sees on the public site should require a code change.
This audit lists every customer-visible value, where the admin edits it, and
records the few remaining code-level strings with the reason they stay in code.

## Numbers — all admin-editable

| Value (customer-visible) | Where it's edited | How it flows |
| --- | --- | --- |
| Product prices ("from £X", per-size) | Costs & pricing → Products | Live from recipe × material costs × labour × markup, per request |
| **Manual price override** (per product) | Costs & pricing → Products → Override £ | Overrides the calculated Standard price; sizes scale by multiplier |
| **Size multipliers** | Costs & pricing → Size tiers | Each size = base recipe/labour × its multiplier |
| Material costs / pack sizes | Costs & pricing → Materials | Feed every recipe's material cost |
| Labour rate, markup % | Costs & pricing | Feed every calculated price |
| Delivery zone fees | Delivery zones | Added to the quote for matching postcodes |
| Deposit type & value, lead days, refundable days | Settings → Bookings | Deposit shown at checkout; lead days set the earliest bookable date |
| Max deliveries/day, working hours | Calendar → Availability | Drive the customer date picker's availability |

## Strings — all admin-editable

| String (customer-visible) | Where it's edited |
| --- | --- |
| Hero kicker / headline / subtitle / both buttons | Site content → Words on the site → Hero |
| Gallery heading & subtitle | Site content → Words on the site → Gallery & quote |
| Quote-builder kicker / heading / subtitle | Site content → Words on the site → Gallery & quote |
| Reviews heading | Site content → Words on the site |
| About kicker / heading / paragraph 1 / paragraph 2 | Site content → Words on the site → About |
| Footer tagline, contact email | Site content → Words on the site → Footer & contact |
| Product names & descriptions | Costs & pricing → Products |
| Size tier names | Costs & pricing → Size tiers |
| Material names & units | Costs & pricing → Materials |
| **Delivery zone name / range / covered areas / postcode districts** | Delivery zones |
| Colour theme names | Site content → Colour themes |
| Review text / name / event | Site content → Customer reviews |
| Gallery titles / descriptions / order-link | Site content → Gallery |
| Social links (Instagram / Facebook / TikTok) | Settings → Social links |
| All site images (hero, about, logo, favicon, OG, product & gallery photos) | Site content → Images |

## Remaining code-level strings (by design)

These are functional UI chrome, not marketing content, and are intentionally not
exposed as editable fields:

- **Quote-builder step labels & field prompts** — "1. Choose your piece", "Delivery
  postcode", "Your name", the marketing-consent sentence, "Book now" / "Request
  custom quote". These are form mechanics; the surrounding marketing copy (kicker,
  heading, subtitle) *is* editable.
- **System/validation messages** — postcode-not-recognised, out-of-area, "date fully
  booked", payment success/cancel banners. These describe app behaviour.
- **Legal pages** (`/privacy`, `/terms`) — separate documents, edited in code with review.
- **SEO metadata** (`<title>`, meta description, structured-data labels) — the
  business name and area are brand constants; the contact email and reviews in the
  structured data already come from the store. *Candidate for a future "SEO" copy
  block if desired.*

## Verification

`scripts/verify-pricing.mjs` exercises the full chain against a running server:
recipe edits re-cost, manual overrides drive (and revert) the public price, new
size tiers/products/materials flow to the quote, and edited hero/contact-email/zone
copy appears on the homepage. 11/11 pass.
