import type { Store } from "../types";
import { seedStore } from "../seed";

// Merge persisted data over fresh defaults so new seed keys (e.g. `images`)
// always appear even for stores saved before those keys existed.
export function hydrate(saved: Partial<Store> | null): Store {
  const defaults = seedStore();
  if (!saved) return defaults;
  return {
    ...defaults,
    ...saved,
    settings: { ...defaults.settings, ...(saved.settings || {}) },
    images: { ...defaults.images, ...(saved.images || {}) },
    copy: { ...defaults.copy, ...(saved.copy || {}) },
  };
}
