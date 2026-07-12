// Durable, DB-backed rate limiting.
//
// When Postgres is connected it records attempts in a `rate_hits` table so the
// limit holds ACROSS serverless instances and cold starts (unlike the in-memory
// limiter in security.ts, which is per-instance). Without a database — or if the
// DB errors — it falls back to the in-memory limiter so a blip can't lock admins
// out. Shares the store's connection pool.
import { hasDatabase } from "./store";
import { getPool } from "./store/postgresRepository";
import { rateLimit as memoryRateLimit } from "./security";

let ensured: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      const p = getPool();
      await p.query(`CREATE TABLE IF NOT EXISTS rate_hits (id BIGSERIAL PRIMARY KEY, k TEXT NOT NULL, at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
      await p.query(`CREATE INDEX IF NOT EXISTS rate_hits_k_at_idx ON rate_hits (k, at)`);
    })().catch((e) => {
      ensured = null; // allow retry on a later request
      throw e;
    });
  }
  return ensured;
}

/**
 * Returns true if the caller is within the limit, false if throttled.
 * `limit` requests are allowed per `windowMs` per `key`.
 */
export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  if (!hasDatabase()) return memoryRateLimit(key, limit, windowMs);
  try {
    await ensureTable();
    const p = getPool();
    // Opportunistic cleanup of old rows keeps the table small.
    await p.query(`DELETE FROM rate_hits WHERE at < NOW() - INTERVAL '1 hour'`);
    const { rows } = await p.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM rate_hits WHERE k = $1 AND at > NOW() - ($2 || ' milliseconds')::interval`,
      [key, String(windowMs)],
    );
    if (Number(rows[0]?.c ?? 0) >= limit) return false;
    await p.query(`INSERT INTO rate_hits (k) VALUES ($1)`, [key]);
    return true;
  } catch (e) {
    console.error("Rate-limit DB error — falling back to in-memory limiter:", e);
    return memoryRateLimit(key, limit, windowMs);
  }
}
