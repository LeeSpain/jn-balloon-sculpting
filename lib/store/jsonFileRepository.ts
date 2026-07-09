// Local/stub implementation of StoreRepository.
//
// Dev: persists to `.data/store.json` (gitignored) so data survives restarts.
// Serverless (Vercel): the app bundle is read-only, so it falls back to the
// ephemeral OS temp dir. That means writes DO NOT persist between requests in
// production — this is intentional for the stub. Swap in a real database
// (Supabase / Vercel Postgres) before launch. See ./index.ts.
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import type { Store } from "../types";
import { seedStore } from "../seed";
import type { StoreRepository } from "./repository";

function dataFile(): string {
  const base =
    process.env.NODE_ENV === "production"
      ? path.join(os.tmpdir(), "jn-store")
      : path.join(process.cwd(), ".data");
  return path.join(base, "store.json");
}

// Merge persisted data over fresh defaults so new seed keys always appear.
function hydrate(saved: Partial<Store> | null): Store {
  const defaults = seedStore();
  if (!saved) return defaults;
  return {
    ...defaults,
    ...saved,
    settings: { ...defaults.settings, ...(saved.settings || {}) },
  };
}

export class JsonFileRepository implements StoreRepository {
  private cache: Store | null = null;

  async read(): Promise<Store> {
    if (this.cache) return this.cache;
    try {
      const raw = await fs.readFile(dataFile(), "utf8");
      this.cache = hydrate(JSON.parse(raw));
    } catch {
      this.cache = hydrate(null);
    }
    return this.cache;
  }

  async write(store: Store): Promise<void> {
    this.cache = store;
    const file = dataFile();
    try {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, JSON.stringify(store, null, 2), "utf8");
    } catch {
      // Read-only FS in some environments — cache still serves this instance.
    }
  }

  async reset(): Promise<Store> {
    const fresh = seedStore();
    await this.write(fresh);
    return fresh;
  }
}
