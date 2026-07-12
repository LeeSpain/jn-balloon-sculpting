// Local/dev implementation of StoreRepository.
//
// Dev: persists to `.data/store.json` (gitignored) so data survives restarts.
//
// Production: this is NEVER a valid record. Previously it fell back to the
// ephemeral OS temp dir, which silently lost admin edits and orders across
// serverless instances. Instead, write() now FAILS LOUDLY in production so the
// admin sees a real error rather than a fake "saved" — connect Postgres
// (DATABASE_URL) and the app uses PostgresRepository automatically.
//
// IMPORTANT: read() always reads from disk (no sticky in-memory cache) so an
// admin edit is reflected by the very next frontend request in the same process.
import { promises as fs } from "fs";
import path from "path";
import type { Store } from "../types";
import { seedStore } from "../seed";
import { hydrate } from "./hydrate";
import type { StoreRepository } from "./repository";

const NO_DB_MESSAGE =
  "No database connected — changes can’t be saved. Add Postgres in Vercel (Storage → Create Database → Postgres) so DATABASE_URL is set.";

function dataFile(): string {
  return path.join(process.cwd(), ".data", "store.json");
}

export class JsonFileRepository implements StoreRepository {
  async read(): Promise<Store> {
    // In production without a DB, reads still return seed defaults so the public
    // site renders; only writes are refused (below).
    if (process.env.NODE_ENV === "production") return hydrate(null);
    try {
      const raw = await fs.readFile(dataFile(), "utf8");
      return hydrate(JSON.parse(raw));
    } catch {
      return hydrate(null);
    }
  }

  async write(store: Store): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      throw new Error(NO_DB_MESSAGE);
    }
    const file = dataFile();
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(store, null, 2), "utf8");
  }

  async deleteContact(id: string): Promise<void> {
    const store = await this.read();
    store.contacts = (store.contacts || []).filter((c) => c.id !== id);
    await this.write(store);
  }

  async reset(): Promise<Store> {
    const fresh = seedStore();
    await this.write(fresh);
    return fresh;
  }
}
