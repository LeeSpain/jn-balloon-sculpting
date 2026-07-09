// Server-side validation for the admin store POST. The client sends the full
// Store object, so we cannot trust it: enforce shape, numeric sanity, array
// caps and a total payload-size limit before persisting.
import type { Store } from "./types";

const MAX_JSON_BYTES = 8 * 1024 * 1024; // 8 MB total (gallery data-URLs included)
const MAX_ARRAY = 500; // per collection
const MAX_STRING = 20000; // any single string field (data URLs are larger — see below)
const MAX_DATAURL = 3 * 1024 * 1024; // 3 MB per uploaded image data URL

function isFiniteNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function stringsOk(obj: unknown, depth = 0): boolean {
  if (depth > 8) return false;
  if (typeof obj === "string") {
    // Allow large data URLs (uploaded photos) up to their own cap; everything
    // else is bounded tightly.
    const limit = obj.startsWith("data:") ? MAX_DATAURL : MAX_STRING;
    return obj.length <= limit;
  }
  if (Array.isArray(obj)) {
    if (obj.length > MAX_ARRAY) return false;
    return obj.every((v) => stringsOk(v, depth + 1));
  }
  if (obj && typeof obj === "object") {
    return Object.values(obj).every((v) => stringsOk(v, depth + 1));
  }
  return true;
}

export function validateStore(raw: unknown): { ok: true; store: Store } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Store must be an object." };
  const s = raw as Partial<Store>;

  if (!s.settings || typeof s.settings !== "object") return { ok: false, error: "Missing settings." };
  const st = s.settings;
  const numericSettings: (keyof typeof st)[] = [
    "labourRate", "markupPct", "leadDays", "depositValue", "refundDays",
    "taxRatePct", "vatRatePct", "deliveryCostPct",
  ];
  for (const k of numericSettings) {
    const v = st[k];
    if (v != null && !isFiniteNum(v)) return { ok: false, error: `Setting ${String(k)} must be a number.` };
    if (isFiniteNum(v) && (v < 0 || v > 100000)) return { ok: false, error: `Setting ${String(k)} out of range.` };
  }
  if (st.depositType && !["full", "fixed", "percent"].includes(st.depositType)) {
    return { ok: false, error: "Invalid deposit type." };
  }

  const arrays: (keyof Store)[] = ["materials", "products", "sizes", "themes", "gallery", "galleryImages", "reviews", "zones", "orders"];
  for (const key of arrays) {
    const v = s[key];
    if (v != null && !Array.isArray(v)) return { ok: false, error: `${key} must be an array.` };
    if (Array.isArray(v) && v.length > MAX_ARRAY) return { ok: false, error: `${key} has too many items.` };
  }
  if (!Array.isArray(s.products)) return { ok: false, error: "products is required." };

  // Total payload size guard.
  let bytes = 0;
  try {
    bytes = JSON.stringify(raw).length;
  } catch {
    return { ok: false, error: "Store is not serializable." };
  }
  if (bytes > MAX_JSON_BYTES) return { ok: false, error: "Store payload too large." };

  if (!stringsOk(raw)) return { ok: false, error: "A field exceeds its size limit." };

  return { ok: true, store: raw as Store };
}
