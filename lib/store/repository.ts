// Data-layer abstraction.
//
// The whole app talks to this interface only — it never knows whether the data
// lives in a JSON file, Supabase, Vercel Postgres, or anything else. To move to
// a real database before launch, add a new implementation of StoreRepository
// (e.g. SupabaseRepository) and return it from getRepository() in ./index.ts.
import type { Store } from "../types";

export interface StoreRepository {
  /** Read the full store (settings, products, orders, content …). */
  read(): Promise<Store>;
  /** Persist the full store. */
  write(store: Store): Promise<void>;
  /** Reset back to seed defaults and return the fresh store. */
  reset(): Promise<Store>;
  /** Permanently delete a single contact record (GDPR erasure). */
  deleteContact(id: string): Promise<void>;
  /** Permanently delete a single order record (write() only upserts, so removal
   *  needs its own call). Use for genuine junk/test data — real cancellations
   *  should archive instead. */
  deleteOrder(id: string): Promise<void>;
}
