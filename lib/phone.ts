// UK mobile validation/normalisation, shared by the booking form (client) and
// the booking route (server) so both agree. Deliveries are confirmed by
// WhatsApp/text, so a valid mobile is required — not optional.

// Returns the number normalised to 07xxxxxxxxx, or null if it isn't a valid UK
// mobile. Accepts spaces, hyphens, and +44 / 0044 / 44 international prefixes.
export function normalizeUkMobile(raw: string): string | null {
  let d = String(raw || "").replace(/[^\d+]/g, "");
  d = d.replace(/^\+/, "");
  if (d.startsWith("0044")) d = d.slice(2); // 0044… → 44…
  if (d.startsWith("44")) d = "0" + d.slice(2); // 44… → 0…
  return /^07\d{9}$/.test(d) ? d : null;
}

export function isUkMobile(raw: string): boolean {
  return normalizeUkMobile(raw) !== null;
}

export function isEmailValid(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(raw || "").trim());
}

// wa.me / tel: need an international number with no +/spaces. 07… → 447…
export function toIntlDigits(raw: string): string {
  const n = normalizeUkMobile(raw);
  if (n) return "44" + n.slice(1);
  return String(raw || "").replace(/\D/g, "");
}
