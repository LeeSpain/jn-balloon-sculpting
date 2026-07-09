// Single entry point for data access. Everything server-side imports from here.
//
// Selection:
//   • Postgres (production) when a connection string is present — DATABASE_URL,
//     POSTGRES_URL or POSTGRES_PRISMA_URL. Provision "Postgres" (Neon) from the
//     Vercel Marketplace, or use any Postgres (Supabase/RDS) — it injects one of
//     these. This is the durable, shared store: orders, bookings and content all
//     survive across serverless instances.
//   • JSON file (dev / no DB) — persists to .data/store.json locally; ephemeral
//     on serverless (does NOT survive across instances). Never rely on it in prod.
import type { StoreRepository } from "./repository";
import { JsonFileRepository } from "./jsonFileRepository";
import { PostgresRepository } from "./postgresRepository";

let instance: StoreRepository | null = null;

export function hasDatabase(): boolean {
  return !!(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL);
}

export function getRepository(): StoreRepository {
  if (instance) return instance;
  instance = hasDatabase() ? new PostgresRepository() : new JsonFileRepository();
  return instance;
}

export type { StoreRepository } from "./repository";
