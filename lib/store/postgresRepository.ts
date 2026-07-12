// Production data layer — any Postgres (Vercel Postgres / Neon / Supabase / RDS).
// Activated when a connection string is present (see ./index.ts).
//
// Design notes:
//   • store_content: a single JSONB row holding the whole store EXCEPT orders
//     (settings, products, images, gallery, reviews, zones, themes …). Admin
//     edits rewrite this row — there's only ever one editor, so no contention.
//   • store_orders: one row per order. write() UPSERTS orders and never DELETES
//     them, so a booking created concurrently with an admin save can never be
//     lost. Orders are only cleared by an explicit reset().
// This keeps the StoreRepository interface (read/write/reset) intact while
// making order creation safe under concurrency.
import { Pool } from "pg";
import type { Store, Order, Contact, Enquiry } from "../types";
import { seedStore } from "../seed";
import { hydrate } from "./hydrate";
import type { StoreRepository } from "./repository";

function connectionString(): string {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    ""
  );
}

// One pool per warm serverless instance (module scope), reused across requests.
// Exported so other durable features (e.g. rate limiting) share the same pool.
let pool: Pool | null = null;
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: connectionString(),
      ssl: { rejectUnauthorized: false },
      max: 3,
    });
  }
  return pool;
}

let initPromise: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const p = getPool();
      await p.query(`CREATE TABLE IF NOT EXISTS store_content (id INT PRIMARY KEY, data JSONB NOT NULL)`);
      await p.query(
        `CREATE TABLE IF NOT EXISTS store_orders (id TEXT PRIMARY KEY, seq BIGSERIAL, data JSONB NOT NULL)`,
      );
      await p.query(
        `CREATE TABLE IF NOT EXISTS store_contacts (id TEXT PRIMARY KEY, seq BIGSERIAL, data JSONB NOT NULL)`,
      );
      await p.query(
        `CREATE TABLE IF NOT EXISTS store_enquiries (id TEXT PRIMARY KEY, seq BIGSERIAL, data JSONB NOT NULL)`,
      );
    })().catch((e) => {
      initPromise = null; // allow retry on a later request
      throw e;
    });
  }
  return initPromise;
}

export class PostgresRepository implements StoreRepository {
  async read(): Promise<Store> {
    await ensureSchema();
    const p = getPool();
    const content = await p.query<{ data: Partial<Store> }>(
      `SELECT data FROM store_content WHERE id = 1`,
    );
    if (content.rows.length === 0) {
      // First run — seed the database and return the seed.
      const fresh = seedStore();
      await this.write(fresh);
      return fresh;
    }
    const orders = await p.query<{ data: Order }>(
      `SELECT data FROM store_orders ORDER BY seq DESC`,
    );
    const contacts = await p.query<{ data: Contact }>(
      `SELECT data FROM store_contacts ORDER BY seq DESC`,
    );
    const enquiries = await p.query<{ data: Enquiry }>(
      `SELECT data FROM store_enquiries ORDER BY seq DESC`,
    );
    return hydrate({
      ...content.rows[0].data,
      orders: orders.rows.map((r) => r.data),
      contacts: contacts.rows.map((r) => r.data),
      enquiries: enquiries.rows.map((r) => r.data),
    });
  }

  async write(store: Store): Promise<void> {
    await ensureSchema();
    const p = getPool();
    const { orders, contacts, enquiries, ...content } = store;
    await p.query(
      `INSERT INTO store_content (id, data) VALUES (1, $1::jsonb)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      [JSON.stringify(content)],
    );
    // Upsert every order/contact; never delete here (protects records created
    // concurrently with an admin save). Contacts are erased via deleteContact().
    for (const o of orders || []) {
      await p.query(
        `INSERT INTO store_orders (id, data) VALUES ($1, $2::jsonb)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
        [o.id, JSON.stringify(o)],
      );
    }
    for (const c of contacts || []) {
      await p.query(
        `INSERT INTO store_contacts (id, data) VALUES ($1, $2::jsonb)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
        [c.id, JSON.stringify(c)],
      );
    }
    for (const e of enquiries || []) {
      await p.query(
        `INSERT INTO store_enquiries (id, data) VALUES ($1, $2::jsonb)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
        [e.id, JSON.stringify(e)],
      );
    }
  }

  async deleteContact(id: string): Promise<void> {
    await ensureSchema();
    await getPool().query(`DELETE FROM store_contacts WHERE id = $1`, [id]);
  }

  // Permanent removal — write() never deletes orders, so this is the only way a
  // record actually leaves the table (used to purge junk/test orders).
  async deleteOrder(id: string): Promise<void> {
    await ensureSchema();
    await getPool().query(`DELETE FROM store_orders WHERE id = $1`, [id]);
  }

  async reset(): Promise<Store> {
    await ensureSchema();
    const p = getPool();
    await p.query(`TRUNCATE store_orders`);
    await p.query(`TRUNCATE store_contacts`);
    await p.query(`TRUNCATE store_enquiries`);
    const fresh = seedStore();
    await this.write(fresh);
    return fresh;
  }
}
