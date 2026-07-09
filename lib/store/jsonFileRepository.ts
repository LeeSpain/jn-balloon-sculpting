// Local/stub implementation of StoreRepository.
//
// Dev: persists to `.data/store.json` (gitignored) so data survives restarts.
// Serverless (Vercel): the app bundle is read-only, so it falls back to the
// ephemeral OS temp dir — writes DO NOT persist across instances there. Swap in
// a real database (see ./index.ts) before relying on it in production.
//
// IMPORTANT: read() always reads from disk (no sticky in-memory cache) so an
// admin edit is reflected by the very next frontend request in the same process.
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import type { Store } from "../types";
import { seedStore } from "../seed";
import { hydrate } from "./hydrate";
import type { StoreRepository } from "./repository";

function dataFile(): string {
  const base =
    process.env.NODE_ENV === "production"
      ? path.join(os.tmpdir(), "jn-store")
      : path.join(process.cwd(), ".data");
  return path.join(base, "store.json");
}

export class JsonFileRepository implements StoreRepository {
  async read(): Promise<Store> {
    try {
      const raw = await fs.readFile(dataFile(), "utf8");
      return hydrate(JSON.parse(raw));
    } catch {
      return hydrate(null);
    }
  }

  async write(store: Store): Promise<void> {
    const file = dataFile();
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(store, null, 2), "utf8");
  }

  async reset(): Promise<Store> {
    const fresh = seedStore();
    await this.write(fresh);
    return fresh;
  }
}
