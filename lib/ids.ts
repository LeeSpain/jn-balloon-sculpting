// Collision-resistant id helper. Date.now() alone collides when two items are
// created in the same millisecond (rapid clicks / concurrent requests), so we
// append a short random suffix.
export function uid(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}${Date.now().toString(36)}${rand}`;
}

// Next sequential order id of the form "JN-1044", based on the highest existing
// numeric suffix (not the array length — length collides after deletions).
export function nextOrderId(existingIds: string[]): string {
  let max = 1043; // seed ships JN-1040..1043
  for (const id of existingIds) {
    const m = /^JN-(\d+)$/.exec(id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `JN-${max + 1}`;
}
