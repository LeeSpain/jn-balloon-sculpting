// J&N Balloon Sculpting — shared domain types

export type DepositType = "full" | "fixed" | "percent";

export interface Settings {
  labourRate: number; // £/hr
  markupPct: number; // %
  leadDays: number; // min notice
  depositType: DepositType;
  depositValue: number; // £ if fixed, % if percent
  refundDays: number; // working days before delivery
  // Finance assumptions
  taxRatePct: number; // income/corporation tax on profit before tax
  vatRegistered: boolean; // treat customer prices as VAT-inclusive
  vatRatePct: number; // VAT rate when registered
  deliveryCostPct: number; // portion of delivery fee that is an actual cost
  stripePublishable: string;
  stripeSecret: string;
  instagram: string;
  facebook: string;
  tiktok: string;
}

export interface Material {
  id: string;
  name: string;
  unit: string; // how it's purchased, e.g. "pack", "roll", "each"
  cost: number; // cost per purchase unit (per pack/roll/each)
  packSize?: number; // individual units per purchase unit (e.g. 100 balloons per pack); defaults to 1
  unitLabel?: string; // name of a single unit, e.g. "balloon" — used when packSize > 1
  stock?: number;
  lowAt?: number;
}

export type Fill = "air" | "helium";

export interface Product {
  id: string;
  name: string;
  fill: Fill;
  buildHours: number;
  desc: string;
  recipe: Record<string, number>;
  image?: string; // optional product photo shown in the quote builder
}

// Every fixed image slot on the site, editable from the admin Image Manager.
// Empty string means "use the built-in default" (logo → text wordmark,
// favicon → generated monogram, ogImage → generated share card).
export interface SiteImages {
  hero: string;
  aboutJade: string;
  aboutNicole: string;
  logo: string;
  favicon: string;
  ogImage: string;
}

export interface Size {
  id: string;
  name: string;
  mult: number;
}

export interface GalleryItem {
  id: string;
  title: string;
  src: string; // cover image (shown on the card)
  images?: string[]; // extra photos shown in the creation popup
  desc?: string; // optional blurb shown in the popup
  productId?: string; // linked product — enables "Order this piece" in the popup
}

export interface Review {
  id: string;
  text: string;
  name: string;
  event: string;
}

export interface Zone {
  id: string;
  name: string;
  range: string;
  fee: number | null;
  areas: string;
  districts?: string[];
}

export type OrderStatus =
  | "Order received"
  | "Materials purchased"
  | "In progress"
  | "Ready"
  | "Delivered";

export interface Order {
  id: string;
  customer: string;
  phone: string;
  product: string;
  size: string;
  theme: string;
  postcode: string;
  address: string;
  date: string;
  price: number;
  delivery: number;
  status: OrderStatus;
  depositPaid?: number;
  stockTaken?: boolean;
  awaitingPayment?: boolean; // true until Stripe confirms payment via webhook
}

export interface Store {
  settings: Settings;
  materials: Material[];
  products: Product[];
  sizes: Size[];
  themes: string[];
  images: SiteImages;
  gallery: GalleryItem[];
  galleryImages: string[];
  reviews: Review[];
  zones: Zone[];
  orders: Order[];
}

export interface PriceBreakdown {
  materials: number;
  labour: number;
  cost: number;
  price: number;
}
