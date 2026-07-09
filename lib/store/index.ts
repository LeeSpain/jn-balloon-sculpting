// Single entry point for data access. Everything server-side imports from here.
//
// TO ADD A REAL DATABASE:
//   1. Create e.g. lib/store/supabaseRepository.ts implementing StoreRepository.
//   2. Return it below when the relevant env vars are present, e.g.:
//        if (process.env.SUPABASE_URL) return new SupabaseRepository();
//   No page or API route needs to change — they only depend on StoreRepository.
import type { StoreRepository } from "./repository";
import { JsonFileRepository } from "./jsonFileRepository";

let instance: StoreRepository | null = null;

export function getRepository(): StoreRepository {
  if (instance) return instance;
  // Only the local stub for now (chosen: "decide DB later").
  instance = new JsonFileRepository();
  return instance;
}

export type { StoreRepository } from "./repository";
