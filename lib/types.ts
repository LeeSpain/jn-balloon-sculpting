// J&N Balloon Sculpting — shared domain types.
// These mirror the prototype's store shape so the ported engine stays framework-agnostic.

export type DepositType = 'full' | 'fixed' | 'percent';
export type Fill = 'air' | 'helium';
export type OrderStatus =
  | 'Order received'
  | 'Materials purchased'
  | 'In progress'
  | 'Ready'
  | 'Delivered';

export interface Settings {
  labourRate: number; // £/hr
  markupPct: number; // %
  leadDays: number; // minimum notice (days)
  depositType: DepositType;
  depositValue: number; // £ if fixed, % if percent
  refundDays: number; // working days before delivery
  // finance / tax planning (editable estimates, not accountancy advice)
  splitPct: number; // Jade's share % (Nicole gets the rest)
  allowance: number; // personal allowance £/yr each
  taxRatePct: number; // basic-rate income tax
  niRatePct: number; // Class 4 National Insurance
  stripePublishable: string;
  stripeSecret: string;
  instagram: string;
  facebook: string;
  tiktok: string;
}

export interface Material {
  id: string;
  name: string;
  unit: string;
  cost: number;
  stock: number | null;
  lowAt: number | null;
}

export type Recipe = Record<string, number>;

export interface Product {
  id: string;
  name: string;
  fill: Fill;
  buildHours: number;
  desc: string;
  recipe: Recipe;
}

export interface Size {
  id: string;
  name: string;
  mult: number;
}

export interface GalleryItem {
  id: string;
  title: string;
  src: string;
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
  districts: string[];
}

export interface Order {
  id: string;
  customer: string;
  phone: string;
  product: string;
  size: string;
  theme: string;
  postcode: string;
  address: string;
  date: string; // ISO yyyy-mm-dd
  price: number;
  delivery: number;
  status: OrderStatus;
  depositPaid?: number;
  stockTaken?: boolean;
  createdAt?: string;
}

// Full store — admin/server view (includes orders + secrets).
export interface Store {
  settings: Settings;
  materials: Material[];
  products: Product[];
  sizes: Size[];
  themes: string[];
  gallery: GalleryItem[];
  galleryImages: string[];
  reviews: Review[];
  zones: Zone[];
  orders: Order[];
}

// Public store — what the customer site is allowed to see.
// No orders (customer PII), no Stripe secret; Stripe connection reduced to a boolean.
export type PublicSettings = Omit<Settings, 'stripeSecret'> & {
  stripeConnected: boolean;
};

export interface PublicStore {
  settings: PublicSettings;
  materials: Material[];
  products: Product[];
  sizes: Size[];
  themes: string[];
  gallery: GalleryItem[];
  galleryImages: string[];
  reviews: Review[];
  zones: Zone[];
}

// The subset the engine needs to price a product. Both Store and PublicStore satisfy it.
export interface PricingContext {
  settings: Pick<Settings, 'labourRate' | 'markupPct' | 'leadDays' | 'depositType' | 'depositValue'>;
  materials: Material[];
  products: Product[];
  sizes: Size[];
  zones: Zone[];
}
