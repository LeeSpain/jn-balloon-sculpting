// Client-safe projection of the store for the public website.
// Prices are computed on the server so material costs, markup and the Stripe
// secret never reach the browser.
import type { Store, DepositType, SiteImages } from "./types";
import { priceProduct, minDate } from "./pricing";
import { hasDatabase } from "./store";

// Real payments are driven by server-side env vars, never by keys in the DB.
export function serverStripeEnabled(): boolean {
  return (
    (process.env.STRIPE_SECRET_KEY || "").startsWith("sk_") &&
    (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "").startsWith("pk_")
  );
}

// SAFETY GATE: the site only takes real (card) bookings when BOTH a durable
// database is configured AND BOOKINGS_LIVE=true. Until then it runs in
// enquiry-only mode so no payment is taken against a store that can't persist.
export function bookingsLive(): boolean {
  return hasDatabase() && process.env.BOOKINGS_LIVE === "true";
}

export interface PublicProduct {
  id: string;
  name: string;
  desc: string;
  fill: "air" | "helium";
  helium: boolean;
  image: string; // "" when no product photo set
  fromPrice: number; // cheapest size
  priceBySize: Record<string, number>;
}

export interface PublicZone {
  id: string;
  name: string;
  range: string;
  fee: number | null;
  areas: string;
  districts: string[];
}

export interface PublicData {
  products: PublicProduct[];
  sizes: { id: string; name: string; mult: number }[];
  themes: string[];
  images: SiteImages;
  zones: PublicZone[];
  gallery: { id: string; title: string; src: string }[];
  reviews: { id: string; text: string; name: string; event: string }[];
  settings: {
    leadDays: number;
    refundDays: number;
    depositType: DepositType;
    depositValue: number;
    stripeEnabled: boolean;
    instagram: string;
    facebook: string;
    tiktok: string;
  };
  minDate: string;
}

export function buildPublicData(store: Store): PublicData {
  const products: PublicProduct[] = store.products.map((p) => {
    const priceBySize: Record<string, number> = {};
    for (const s of store.sizes) {
      priceBySize[s.id] = priceProduct(store, p, s.mult).price;
    }
    // "from" uses the cheapest size multiplier (0.7 in the design)
    const cheapest = Math.min(...store.sizes.map((s) => s.mult));
    return {
      id: p.id,
      name: p.name,
      desc: p.desc,
      fill: p.fill,
      helium: p.fill === "helium",
      image: p.image || "",
      fromPrice: priceProduct(store, p, cheapest).price,
      priceBySize,
    };
  });

  return {
    products,
    sizes: store.sizes.map((s) => ({ id: s.id, name: s.name, mult: s.mult })),
    themes: store.themes,
    images: store.images,
    zones: store.zones.map((z) => ({
      id: z.id,
      name: z.name,
      range: z.range,
      fee: z.fee,
      areas: z.areas,
      districts: z.districts || [],
    })),
    gallery: store.gallery,
    reviews: store.reviews,
    settings: {
      leadDays: store.settings.leadDays,
      refundDays: store.settings.refundDays,
      depositType: store.settings.depositType,
      depositValue: store.settings.depositValue,
      stripeEnabled: serverStripeEnabled() && bookingsLive(),
      instagram: store.settings.instagram,
      facebook: store.settings.facebook,
      tiktok: store.settings.tiktok,
    },
    minDate: minDate(store),
  };
}
