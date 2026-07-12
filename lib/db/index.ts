// Database driver abstraction.
//
// Production (Vercel): Neon serverless Postgres, selected when POSTGRES_URL /
// DATABASE_URL is present. Local dev / CI: PGlite — a real Postgres compiled to
// WASM, running in-process against a persisted directory. Both speak the same
// Postgres SQL with $1 placeholders, so all query code is driver-agnostic.

export type Row = Record<string, unknown>;

export interface Sql {
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
}

function connectionUrl(): string | undefined {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) return undefined;
  if (url.startsWith('pglite')) return undefined; // explicit local override
  return url;
}

async function makeSql(): Promise<Sql> {
  const url = connectionUrl();
  if (url) {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(url);
    return {
      async query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
        const rows = await sql.query(text, params);
        return rows as unknown as T[];
      },
    };
  }
  // Local PGlite — persisted to disk so data survives restarts (it's the record).
  const { PGlite } = await import('@electric-sql/pglite');
  const dir = process.env.PGLITE_DIR || '.pgdata';
  const pg = new PGlite(dir);
  await pg.waitReady;
  return {
    async query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
      const res = await pg.query(text, params);
      return res.rows as T[];
    },
  };
}

// Cache the connection on globalThis so Next.js dev hot-reloads and repeated
// serverless invocations reuse one client instead of leaking connections.
const g = globalThis as unknown as { __jnSql?: Promise<Sql> };

export function getSql(): Promise<Sql> {
  if (!g.__jnSql) g.__jnSql = makeSql();
  return g.__jnSql;
}
