// Data-access layer. The database is the single source of truth; these functions
// load a Store snapshot (for pricing/UI) and persist mutations. Public reads are
// sanitised (no orders, no Stripe secret).

import { getSql, type Sql, type Row } from './index';
import { defaultStore } from '../seed';
import { stockAfterConsume } from '../engine';
import type {
  Store,
  PublicStore,
  Settings,
  Material,
  Product,
  Size,
  GalleryItem,
  Review,
  Zone,
  Order,
  OrderStatus,
} from '../types';

const num = (v: unknown): number => (v == null ? 0 : Number(v));
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));
const jsonb = <T,>(v: unknown, fallback: T): T => {
  if (v == null) return fallback;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return v as T;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  id INT PRIMARY KEY DEFAULT 1,
  labour_rate DOUBLE PRECISION, markup_pct DOUBLE PRECISION, lead_days INT,
  deposit_type TEXT, deposit_value DOUBLE PRECISION, refund_days INT,
  split_pct DOUBLE PRECISION, allowance DOUBLE PRECISION,
  tax_rate_pct DOUBLE PRECISION, ni_rate_pct DOUBLE PRECISION,
  stripe_publishable TEXT, stripe_secret TEXT,
  instagram TEXT, facebook TEXT, tiktok TEXT
);
CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY, name TEXT, unit TEXT, cost DOUBLE PRECISION,
  stock DOUBLE PRECISION, low_at DOUBLE PRECISION, sort INT
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, name TEXT, fill TEXT, build_hours DOUBLE PRECISION,
  descr TEXT, recipe JSONB, sort INT
);
CREATE TABLE IF NOT EXISTS sizes (
  id TEXT PRIMARY KEY, name TEXT, mult DOUBLE PRECISION, sort INT
);
CREATE TABLE IF NOT EXISTS themes (
  id SERIAL PRIMARY KEY, name TEXT, sort INT
);
CREATE TABLE IF NOT EXISTS gallery (
  id TEXT PRIMARY KEY, title TEXT, src TEXT, sort INT
);
CREATE TABLE IF NOT EXISTS gallery_images (
  src TEXT PRIMARY KEY, sort INT
);
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY, body TEXT, name TEXT, evt TEXT, sort INT
);
CREATE TABLE IF NOT EXISTS zones (
  id TEXT PRIMARY KEY, name TEXT, rng TEXT, fee DOUBLE PRECISION,
  areas TEXT, districts JSONB, sort INT
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, customer TEXT, phone TEXT, product TEXT, size TEXT,
  theme TEXT, postcode TEXT, address TEXT, ddate TEXT,
  price DOUBLE PRECISION, delivery DOUBLE PRECISION, status TEXT,
  deposit_paid DOUBLE PRECISION DEFAULT 0, stock_taken BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS admin_users (
  username TEXT PRIMARY KEY, pass_hash TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS login_attempts (
  id SERIAL PRIMARY KEY, ip TEXT, at TIMESTAMPTZ DEFAULT NOW()
);
`;

async function runSchema(sql: Sql): Promise<void> {
  for (const stmt of SCHEMA.split(';')) {
    const s = stmt.trim();
    if (s) await sql.query(s);
  }
}

async function isSeeded(sql: Sql): Promise<boolean> {
  const rows = await sql.query<{ c: string }>('SELECT COUNT(*)::int AS c FROM settings');
  return num(rows[0]?.c) > 0;
}

// Write the full default dataset. Used for first-run seeding and "Reset demo data".
async function writeAll(sql: Sql, store: Store): Promise<void> {
  const tables = [
    'orders', 'zones', 'reviews', 'gallery_images', 'gallery',
    'themes', 'sizes', 'products', 'materials', 'settings',
  ];
  for (const t of tables) await sql.query(`DELETE FROM ${t}`);

  const s = store.settings;
  await sql.query(
    `INSERT INTO settings (id, labour_rate, markup_pct, lead_days, deposit_type, deposit_value,
       refund_days, split_pct, allowance, tax_rate_pct, ni_rate_pct,
       stripe_publishable, stripe_secret, instagram, facebook, tiktok)
     VALUES (1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [s.labourRate, s.markupPct, s.leadDays, s.depositType, s.depositValue, s.refundDays,
      s.splitPct, s.allowance, s.taxRatePct, s.niRatePct,
      s.stripePublishable, s.stripeSecret, s.instagram, s.facebook, s.tiktok]
  );
  await insertContent(sql, store);
  for (const o of store.orders) await insertOrder(sql, o);
}

// Insert every content table (materials/products/sizes/themes/gallery/reviews/zones)
// from a store snapshot. Callers DELETE first for a clean replace.
async function insertContent(sql: Sql, store: Store): Promise<void> {
  for (let i = 0; i < store.materials.length; i++) {
    const m = store.materials[i];
    await sql.query(
      `INSERT INTO materials (id, name, unit, cost, stock, low_at, sort)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [m.id, m.name, m.unit, m.cost, m.stock, m.lowAt, i]
    );
  }
  for (let i = 0; i < store.products.length; i++) {
    const p = store.products[i];
    await sql.query(
      `INSERT INTO products (id, name, fill, build_hours, descr, recipe, sort)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [p.id, p.name, p.fill, p.buildHours, p.desc, JSON.stringify(p.recipe), i]
    );
  }
  for (let i = 0; i < store.sizes.length; i++) {
    const z = store.sizes[i];
    await sql.query('INSERT INTO sizes (id, name, mult, sort) VALUES ($1,$2,$3,$4)', [z.id, z.name, z.mult, i]);
  }
  for (let i = 0; i < store.themes.length; i++) {
    await sql.query('INSERT INTO themes (name, sort) VALUES ($1,$2)', [store.themes[i], i]);
  }
  for (let i = 0; i < store.gallery.length; i++) {
    const g = store.gallery[i];
    await sql.query('INSERT INTO gallery (id, title, src, sort) VALUES ($1,$2,$3,$4)', [g.id, g.title, g.src, i]);
  }
  for (let i = 0; i < store.galleryImages.length; i++) {
    await sql.query('INSERT INTO gallery_images (src, sort) VALUES ($1,$2)', [store.galleryImages[i], i]);
  }
  for (let i = 0; i < store.reviews.length; i++) {
    const r = store.reviews[i];
    await sql.query('INSERT INTO reviews (id, body, name, evt, sort) VALUES ($1,$2,$3,$4,$5)', [r.id, r.text, r.name, r.event, i]);
  }
  for (let i = 0; i < store.zones.length; i++) {
    const z = store.zones[i];
    await sql.query(
      'INSERT INTO zones (id, name, rng, fee, areas, districts, sort) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [z.id, z.name, z.range, z.fee, z.areas, JSON.stringify(z.districts), i]
    );
  }
}

async function insertOrder(sql: Sql, o: Order): Promise<void> {
  await sql.query(
    `INSERT INTO orders (id, customer, phone, product, size, theme, postcode, address, ddate,
       price, delivery, status, deposit_paid, stock_taken)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [o.id, o.customer, o.phone, o.product, o.size, o.theme, o.postcode, o.address, o.date,
      o.price, o.delivery, o.status, o.depositPaid ?? 0, o.stockTaken ?? false]
  );
}

// Ensure schema exists and seed once. Guarded on globalThis so concurrent requests
// don't race the first-run seed.
const g = globalThis as unknown as { __jnInit?: Promise<void> };
export function init(): Promise<void> {
  if (!g.__jnInit) {
    g.__jnInit = (async () => {
      const sql = await getSql();
      await runSchema(sql);
      if (!(await isSeeded(sql))) await writeAll(sql, defaultStore());
    })();
  }
  return g.__jnInit;
}

// ---- reads ----

function mapSettings(r: Row): Settings {
  return {
    labourRate: num(r.labour_rate),
    markupPct: num(r.markup_pct),
    leadDays: num(r.lead_days),
    depositType: (r.deposit_type as Settings['depositType']) || 'full',
    depositValue: num(r.deposit_value),
    refundDays: num(r.refund_days),
    splitPct: num(r.split_pct),
    allowance: num(r.allowance),
    taxRatePct: num(r.tax_rate_pct),
    niRatePct: num(r.ni_rate_pct),
    stripePublishable: (r.stripe_publishable as string) || '',
    stripeSecret: (r.stripe_secret as string) || '',
    instagram: (r.instagram as string) || '',
    facebook: (r.facebook as string) || '',
    tiktok: (r.tiktok as string) || '',
  };
}

async function readContent(sql: Sql) {
  const [settingsRows, materialRows, productRows, sizeRows, themeRows, galleryRows, imageRows, reviewRows, zoneRows] =
    await Promise.all([
      sql.query('SELECT * FROM settings WHERE id = 1'),
      sql.query('SELECT * FROM materials ORDER BY sort'),
      sql.query('SELECT * FROM products ORDER BY sort'),
      sql.query('SELECT * FROM sizes ORDER BY sort'),
      sql.query('SELECT * FROM themes ORDER BY sort'),
      sql.query('SELECT * FROM gallery ORDER BY sort'),
      sql.query('SELECT * FROM gallery_images ORDER BY sort'),
      sql.query('SELECT * FROM reviews ORDER BY sort'),
      sql.query('SELECT * FROM zones ORDER BY sort'),
    ]);

  const settings = mapSettings(settingsRows[0] || {});
  const materials: Material[] = materialRows.map((m) => ({
    id: m.id as string, name: m.name as string, unit: m.unit as string,
    cost: num(m.cost), stock: numOrNull(m.stock), lowAt: numOrNull(m.low_at),
  }));
  const products: Product[] = productRows.map((p) => ({
    id: p.id as string, name: p.name as string, fill: p.fill as Product['fill'],
    buildHours: num(p.build_hours), desc: (p.descr as string) || '',
    recipe: jsonb(p.recipe, {} as Record<string, number>),
  }));
  const sizes: Size[] = sizeRows.map((z) => ({ id: z.id as string, name: z.name as string, mult: num(z.mult) }));
  const themes: string[] = themeRows.map((t) => t.name as string);
  const gallery: GalleryItem[] = galleryRows.map((gg) => ({ id: gg.id as string, title: gg.title as string, src: gg.src as string }));
  const galleryImages: string[] = imageRows.map((i) => i.src as string);
  const reviews: Review[] = reviewRows.map((r) => ({ id: r.id as string, text: (r.body as string) || '', name: (r.name as string) || '', event: (r.evt as string) || '' }));
  const zones: Zone[] = zoneRows.map((z) => ({
    id: z.id as string, name: z.name as string, range: (z.rng as string) || '',
    fee: numOrNull(z.fee), areas: (z.areas as string) || '', districts: jsonb(z.districts, [] as string[]),
  }));

  return { settings, materials, products, sizes, themes, gallery, galleryImages, reviews, zones };
}

export async function loadStore(): Promise<Store> {
  await init();
  const sql = await getSql();
  const content = await readContent(sql);
  const orderRows = await sql.query('SELECT * FROM orders ORDER BY ddate');
  const orders: Order[] = orderRows.map(mapOrder);
  return { ...content, orders };
}

function mapOrder(o: Row): Order {
  return {
    id: o.id as string, customer: o.customer as string, phone: (o.phone as string) || '',
    product: o.product as string, size: o.size as string, theme: (o.theme as string) || '',
    postcode: (o.postcode as string) || '', address: (o.address as string) || '',
    date: o.ddate as string, price: num(o.price), delivery: num(o.delivery),
    status: o.status as OrderStatus, depositPaid: num(o.deposit_paid), stockTaken: !!o.stock_taken,
  };
}

export async function getPublicStore(): Promise<PublicStore> {
  await init();
  const sql = await getSql();
  const c = await readContent(sql);
  const { stripeSecret, stripePublishable, ...rest } = c.settings;
  const stripeConnected = stripePublishable.startsWith('pk_') && stripeSecret.length > 4;
  return {
    settings: { ...rest, stripePublishable, stripeConnected },
    materials: c.materials,
    products: c.products,
    sizes: c.sizes,
    themes: c.themes,
    gallery: c.gallery,
    galleryImages: c.galleryImages,
    reviews: c.reviews,
    zones: c.zones,
  };
}

// ---- writes ----

// Persist the editable content + settings from an admin snapshot. Orders are
// intentionally excluded (they have dedicated, non-clobbering endpoints).
export async function saveContent(store: Store): Promise<void> {
  await init();
  const sql = await getSql();
  const s = store.settings;
  await sql.query(
    `UPDATE settings SET labour_rate=$1, markup_pct=$2, lead_days=$3, deposit_type=$4,
       deposit_value=$5, refund_days=$6, split_pct=$7, allowance=$8, tax_rate_pct=$9,
       ni_rate_pct=$10, stripe_publishable=$11, stripe_secret=$12, instagram=$13,
       facebook=$14, tiktok=$15 WHERE id = 1`,
    [s.labourRate, s.markupPct, s.leadDays, s.depositType, s.depositValue, s.refundDays,
      s.splitPct, s.allowance, s.taxRatePct, s.niRatePct,
      s.stripePublishable, s.stripeSecret, s.instagram, s.facebook, s.tiktok]
  );
  for (const t of ['materials', 'products', 'sizes', 'themes', 'gallery', 'gallery_images', 'reviews', 'zones']) {
    await sql.query(`DELETE FROM ${t}`);
  }
  await insertContent(sql, store);
}

async function nextOrderId(sql: Sql): Promise<string> {
  const rows = await sql.query<{ c: string }>('SELECT COUNT(*)::int AS c FROM orders');
  return 'JN-' + (1044 + num(rows[0]?.c));
}

// Create an order from the site. The caller supplies the trusted, server-computed
// price/delivery so the client can't tamper with what it pays.
export async function createOrder(input: Omit<Order, 'id'>): Promise<Order> {
  await init();
  const sql = await getSql();
  const id = await nextOrderId(sql);
  const order: Order = { ...input, id };
  await insertOrder(sql, order);
  return order;
}

// Move an order along the pipeline. On the first transition to "Materials
// purchased" the recipe is deducted from stock (server-side, once).
export async function setOrderStatus(id: string, status: OrderStatus): Promise<void> {
  await init();
  const sql = await getSql();
  const rows = await sql.query('SELECT * FROM orders WHERE id = $1', [id]);
  if (!rows.length) return;
  const order = mapOrder(rows[0]);

  if (status === 'Materials purchased' && !order.stockTaken) {
    const ctx = await loadStore();
    const changes = stockAfterConsume(ctx, order.product, order.size);
    for (const [mid, newStock] of Object.entries(changes)) {
      await sql.query('UPDATE materials SET stock = $1 WHERE id = $2', [newStock, mid]);
    }
    await sql.query('UPDATE orders SET status = $1, stock_taken = TRUE WHERE id = $2', [status, id]);
  } else {
    await sql.query('UPDATE orders SET status = $1 WHERE id = $2', [status, id]);
  }
}

export async function resetStore(): Promise<void> {
  await init();
  const sql = await getSql();
  await writeAll(sql, defaultStore());
}
