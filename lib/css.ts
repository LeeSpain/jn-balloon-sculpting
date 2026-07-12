import type { CSSProperties } from 'react';

// Parse a CSS declaration string into a React style object. This lets us port the
// prototype's inline styles near-verbatim (preserving pixel fidelity) instead of
// hand-transcribing every rule into camelCase objects.
//
//   css('margin: 0 0 4px; font-size: 30px')  ->  { margin: '0 0 4px', fontSize: '30px' }
//
// Values are kept as strings so React never auto-appends "px" to numeric-looking values.
const cache = new Map<string, CSSProperties>();

export function css(decls: string): CSSProperties {
  const cached = cache.get(decls);
  if (cached) return cached;
  const out: Record<string, string> = {};
  for (const part of decls.split(';')) {
    const idx = part.indexOf(':');
    if (idx === -1) continue;
    const rawProp = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!rawProp || !value) continue;
    const prop = rawProp.startsWith('--')
      ? rawProp // CSS custom property — keep as-is
      : rawProp.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    out[prop] = value;
  }
  cache.set(decls, out as CSSProperties);
  return out as CSSProperties;
}
